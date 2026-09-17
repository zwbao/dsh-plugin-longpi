import { routeQuery } from './routing.ts'
import { DEMO_VARIANTS, findVariant, type DemoVariant, type OmicsLayer } from './genome.ts'

export const LAYERS: OmicsLayer[] = ['genome', 'epigenome', 'transcriptome', 'proteome', 'metabolome']

const LAYER_HELP: Record<OmicsLayer, string> = {
  genome: 'SNV/indel 注释：基因、后果、频率、ClinVar 声明、s2f variant-effect 路由。',
  epigenome: '表观：甲基化时钟 / 染色质可及性。本插件不跑 Horvath/PhenoAge 计算，只指出应接的开源工具。',
  transcriptome: '表达 / 剪接：eQTL、SpliceAI/Pangolin/Borzoi RNA tracks。',
  proteome: '蛋白：错义对蛋白的可能影响；不替代 AlphaFold 结构临床解读。',
  metabolome: '代谢：脂质/炎症通路的文献层，必须与血液表型一起看。',
}

export function annotateVariant(query: string): Record<string, unknown> {
  const hit = findVariant(query)
  const route = routeQuery(`variant-effect ${query} hg38 REF ALT`)
  if (!hit) {
    return {
      demo: true,
      found: false,
      message_zh: '不在演示基因组面板中。请提供 hg38 坐标 + REF/ALT，或 rsID。不会编造 ClinVar 致病性。',
      s2f_route: route,
      how_to_score: '在 s2f-agent 中跑 alphagenome-api / gpn-models / spliceai-workflows（dry-run 先）。',
    }
  }
  return formatVariant(hit, route)
}

function formatVariant(hit: DemoVariant, route: ReturnType<typeof routeQuery>) {
  return {
    demo: true,
    found: true,
    variant: {
      rsid: hit.rsid,
      gene: hit.gene,
      hg38: `${hit.chrom}:${hit.position}`,
      ref: hit.ref,
      alt: hit.alt,
      genotype_demo: hit.genotype_demo,
      consequence: hit.consequence,
    },
    genome: {
      clinvar: hit.clinvar,
      gnomad_af_note: hit.gnomad_af_note,
      coordinate_convention: 'hg38 1-based (as written); s2f skills may expect 0-based internally — state convention before scoring',
    },
    omics_layers: hit.layers,
    longevity_note_zh: hit.longevity_note_zh,
    citation: hit.citation,
    s2f: {
      recommended_skills: hit.s2f_skills,
      route,
    },
    not: ['diagnosis', 'polygenic score as clinical test', 'dose change'],
    disclaimer_zh: '演示基因型。关联研究不是诊断。模型打分需在 s2f-agent 中执行，DSH 不发明 delta-score。',
  }
}

export function annotateMultiomics(layer: string, focus?: string): Record<string, unknown> {
  const key = LAYERS.includes(layer as OmicsLayer) ? layer as OmicsLayer : null
  if (!key) {
    return { error: true, code: 'INVALID_ARGS', message_zh: `layer 必须是 ${LAYERS.join(', ')}` }
  }
  const related = DEMO_VARIANTS.filter((v) => {
    if (!v.layers.includes(key)) return false
    if (!focus) return true
    const f = focus.toLowerCase()
    return v.rsid === f || v.gene.toLowerCase() === f || f.includes(v.rsid)
  })
  const tools: Record<OmicsLayer, string[]> = {
    genome: ['s2f: alphagenome-api, gpn-models', 'ClinVar / gnomAD (external)'],
    epigenome: ['pyaging / BioAge / methylclock (external)', 's2f: chrombpnet-skill, sei-workflows'],
    transcriptome: ['s2f: spliceai-workflows, pangolin-workflows, borzoi-workflows'],
    proteome: ['s2f: gpn-models missense scoring', 'AlphaFold not bundled'],
    metabolome: ['pair with LongPi blood panel (hs-CRP, lipids) — no MS pipeline bundled'],
  }
  return {
    demo: true,
    layer: key,
    what_this_layer_does: LAYER_HELP[key],
    demo_variants: related.map((v) => ({ rsid: v.rsid, gene: v.gene, note: v.longevity_note_zh })),
    suggested_tooling: tools[key],
    disclaimer_zh: '多组学注释是分层解释，不是融合诊断。缺少的组学层会明确说「未测」。',
  }
}

export function listDemoGenome() {
  return {
    demo: true,
    assembly: 'hg38',
    variants: DEMO_VARIANTS.map((v) => ({
      rsid: v.rsid,
      gene: v.gene,
      gt: v.genotype_demo,
      hg38: `${v.chrom}:${v.position}`,
    })),
    disclaimer_zh: '合成演示基因组，不是张明远的真实测序。',
  }
}
