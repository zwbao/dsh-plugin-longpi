import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  compositeAge,
  HD_PROVENANCE,
  PHENOAGE_PROVENANCE,
  phenoAge,
  type BiomarkerInput,
  type ModuleAge,
  type PhenoAgeMarker,
} from './bioage.ts'
import { DEMO_COMPOSITE, DEMO_LAB_PANEL, DEMO_PHENOAGE } from './fixture.ts'
import { appendAudit } from './s2f/audit.ts'
import { PRODUCT_VERSION } from './s2f/report.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function audited(tool: string, args: unknown, result: unknown) {
  appendAudit(tool, args, result)
  return result
}

const MARKER_KEYS: PhenoAgeMarker[] = [
  'albumin_gL',
  'creatinine_umolL',
  'glucose_mmolL',
  'ln_crp_mgL',
  'lymphocyte_pct',
  'mcv_fL',
  'rdw_pct',
  'alp_UL',
  'wbc_1000uL',
]

const LAYERS = ['measured', 'user_reported', 'demo_synthetic'] as const

/** Coerce the model-supplied biomarker rows into engine inputs, dropping anything unusable. */
function toInputs(raw: unknown): { inputs: BiomarkerInput[]; rejected: Array<Record<string, unknown>> } {
  const inputs: BiomarkerInput[] = []
  const rejected: Array<Record<string, unknown>> = []
  if (!Array.isArray(raw)) return { inputs, rejected }
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const key = String(r.key ?? '')
    const value = Number(r.value)
    const layer = String(r.layer ?? '')
    if (!MARKER_KEYS.includes(key as PhenoAgeMarker) || !Number.isFinite(value)
      || !(LAYERS as readonly string[]).includes(layer)) {
      rejected.push({ key, value: r.value, layer, reason: 'unknown key, non-numeric value, or layer not in measured|user_reported|demo_synthetic' })
      continue
    }
    inputs.push({
      key: key as PhenoAgeMarker,
      value,
      layer: layer as BiomarkerInput['layer'],
      source_ref: String(r.source_ref ?? 'unspecified'),
    })
  }
  return { inputs, rejected }
}

export function registerBioageTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'compute_biological_age',
    description:
      'Compute PhenoAge (Levine 2018) from nine blood biomarkers plus chronological age, with full provenance. '
      + 'Refuses on missing or implausible inputs instead of guessing. Call read_bioage_model first if unsure of units. '
      + 'This is a population model, not a diagnosis.',
    parameters: {
      chronological_age: { type: 'number', required: true, description: 'Chronological age in years' },
      biomarkers: {
        type: 'array',
        required: true,
        description:
          'Rows of {key, value, layer, source_ref}. layer must be measured | user_reported | demo_synthetic. '
          + 'Keys: albumin_gL (g/L), creatinine_umolL (umol/L), glucose_mmolL (mmol/L), ln_crp_mgL (natural log of hs-CRP in mg/L), '
          + 'lymphocyte_pct (%), mcv_fL (fL), rdw_pct (%), alp_UL (U/L), wbc_1000uL (1000/uL). '
          + 'For hs-CRP in mg/L use the ln_crp helper: ln(4.2)=1.435.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: { type: 'string', required: true, description: 'One of the nine marker keys' },
            value: { type: 'number', required: true, description: 'Value in the unit that key expects' },
            layer: { type: 'string', required: true, enum: LAYERS as unknown as string[], description: 'Provenance layer' },
            source_ref: { type: 'string', description: 'Where the value came from, e.g. labs.jsonl#2026-09-10' },
          },
        },
      },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      const { inputs, rejected } = toInputs(args.biomarkers)
      const result = phenoAge(inputs, Number(args.chronological_age))
      const demo = inputs.some((b) => b.layer === 'demo_synthetic')
      const out = {
        product_version: PRODUCT_VERSION,
        demo_data_present: demo,
        ...(demo
          ? { banner_zh: '演示数据 · 非个人病历。当前面板含合成演示值，不得作为个人结论展示。' }
          : {}),
        ...(rejected.length ? { rejected_inputs: rejected } : {}),
        phenoage: result,
        ...(result.ok
          ? {
            how_to_read_zh: [
              `表型年龄 ${result.phenoage.toFixed(1)} 岁；实足 ${result.chronological_age} 岁；加速 ${result.phenoage_advance >= 0 ? '+' : ''}${result.phenoage_advance.toFixed(1)} 年。`,
              `模型隐含 10 年全因死亡概率 ${(result.mortality_10y * 100).toFixed(2)}%（人群模型输出，不是个人预测）。`,
              '只看同一实验室、同一单位下的趋势；单次值个体误差很大。',
            ],
            limits_zh: result.provenance.claim_ceiling,
            must_not_zh: [
              '不得称为诊断、病情或风险判决',
              '不得据此建议加药、减药、停药或换药',
              '不得把 demo_synthetic 值当作真实检测结果',
            ],
          }
          : { what_to_do_zh: '补齐缺失项或修正单位后重算；不要用均值填充，不要外推。' }),
      }
      return audited('compute_biological_age', args, out)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_bioage_model',
    description:
      'Return the biological-age model card: PhenoAge citations, required units per marker, claim ceilings, '
      + 'and the status of every other clock in the registry. Use before computing so units are right.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute() {
      return audited('read_bioage_model', {}, {
        product_version: PRODUCT_VERSION,
        implemented_now: [
          {
            model: PHENOAGE_PROVENANCE.model,
            label: PHENOAGE_PROVENANCE.label,
            status: 'implemented',
            citation: PHENOAGE_PROVENANCE.citation,
            citation_url: PHENOAGE_PROVENANCE.citation_url,
            required_units: PHENOAGE_PROVENANCE.required_units,
            claim_ceiling: PHENOAGE_PROVENANCE.claim_ceiling,
            note_zh: '常数来自 Levine 2018 论文，本仓独立实现并用手算黄金向量锁住；可在无网络、无 Python 的环境复算。',
          },
          {
            model: HD_PROVENANCE.model,
            label: HD_PROVENANCE.label,
            status: 'implemented_needs_reference',
            citation: HD_PROVENANCE.citation,
            claim_ceiling: HD_PROVENANCE.claim_ceiling,
            note_zh: '机制已实现（马氏距离）。缺年轻健康参考队列的均值与协方差参数时不计算、不编数。',
          },
        ],
        not_implemented_v1: [
          { model: 'kdm-biological-age', reason_zh: 'KDM 需要 NHANES 参考人群的回归参数；本仓不内置未经验证的系数。' },
          { model: 'dnam-clocks (Horvath, GrimAge, DunedinPACE)', reason_zh: '需要甲基化芯片数据与预训练系数；建议经 pyaging / BioLearn 在本地跑，再把结果作为 measured 层回填。' },
          { model: 'atac-clock', reason_zh: '需要原始染色质可及性数据。' },
        ],
        how_to_extend_zh: '新增时钟必须带：可引用公式、每项输入的期望单位、claim ceiling。没有这三样就不要加进引擎。',
        composite: {
          method: DEMO_COMPOSITE.method,
          weights: DEMO_COMPOSITE.weights,
          module_source_demo: DEMO_COMPOSITE.module_source,
        },
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_demo_lab_panel',
    description:
      'Return the synthetic nine-marker demo panel and the ages it produces. Use to show how a computation is reproducible without exposing any real person’s labs.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute() {
      return audited('read_demo_lab_panel', {}, {
        demo: true,
        banner_zh: '合成演示数据 · 非真实个体 · 非个人病历',
        panel: DEMO_LAB_PANEL,
        phenoage: DEMO_PHENOAGE,
        composite: DEMO_COMPOSITE,
        reproduce_zh: '任何人在本仓跑 `npm test` 都会得到同一个表型年龄；这是黄金向量测试锁定的值。',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'compute_composite_age',
    description:
      'Compute the LongPi composite age from five module ages using the published weights. Returns each module’s '
      + 'contribution so the arithmetic is auditable. Rejects module ages outside 0–130.',
    parameters: {
      chronological_age: { type: 'number', required: true, description: 'Chronological age in years' },
      biological: { type: 'number', required: true, description: 'Biological module age; should come from compute_biological_age' },
      physiological: { type: 'number', required: true, description: 'Physiological module age' },
      psychological: { type: 'number', required: true, description: 'Psychological module age' },
      behavioral: { type: 'number', required: true, description: 'Behavioral module age' },
      social_env: { type: 'number', required: true, description: 'Social & environmental module age' },
      biological_source: {
        type: 'string',
        enum: ['engine', 'demo'],
        description: 'Whether the biological module age came from the engine or is a fixed demo input',
      },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      const modules: ModuleAge = {
        biological: Number(args.biological),
        physiological: Number(args.physiological),
        psychological: Number(args.psychological),
        behavioral: Number(args.behavioral),
        social_env: Number(args.social_env),
      }
      const result = compositeAge(modules, Number(args.chronological_age), {
        biological: args.biological_source === 'engine' ? 'engine' : 'demo',
      })
      return audited('compute_composite_age', args, {
        product_version: PRODUCT_VERSION,
        composite: result,
        honesty_zh: result.ok
          ? `五维中只有 biological 来自引擎（${result.module_source.biological}），其余四维标记为 ${[...new Set(Object.values(result.module_source))].filter((s) => s === 'demo').length} 个演示输入。展示时不要让人误以为五维都是算出来的。`
          : '输入不合法，未计算。',
      })
    },
  }))
}
