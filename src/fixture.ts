import {
  compositeAge,
  lnCrp,
  phenoAge,
  type BiomarkerInput,
  type CompositeAgeResult,
  type PhenoAgeResult,
} from './bioage.ts'

export type ModuleCode =
  | 'biological'
  | 'physiological'
  | 'psychological'
  | 'behavioral'
  | 'social_env'

export type MetricStatus = 'optimal' | 'normal' | 'high' | 'low' | 'watch'

export interface Metric {
  code: string
  name_zh: string
  name_en: string
  value: number | string
  unit: string
  status: MetricStatus
  ref: string
  previous?: number | string
  module: ModuleCode
  aliases: string[]
}

export interface Insight {
  id: string
  type: string
  title_zh: string
  body_zh: string
  next_step_zh: string
  metric_codes: string[]
  reviewed: boolean
}

export interface FaqDoc {
  id: string
  question: string
  answer: string
  tags: string[]
}

export interface TermDoc {
  code: string
  term_zh: string
  definition_zh: string
}

export interface ItineraryItem {
  t: string
  title_zh: string
  place_zh: string
  note_zh: string
}

export interface DemoCustomer {
  id: string
  display_name: string
  age: number
  sex: string
  tier: string
  language: string
  months_enrolled: number
  chrono_age: number
  composite_age: number
  modules: Record<ModuleCode, { age: number; label_zh: string }>
  disclaimer_zh: string
}

/** Demo lab panel for the 9 PhenoAge markers. Synthetic — belongs to no real person. */
export const DEMO_LAB_PANEL: BiomarkerInput[] = [
  { key: 'albumin_gL', value: 41.0, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'creatinine_umolL', value: 92.0, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'glucose_mmolL', value: 5.6, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'ln_crp_mgL', value: lnCrp(4.2), layer: 'demo_synthetic', source_ref: 'demo_panel#hs_crp=4.2 mg/L' },
  { key: 'lymphocyte_pct', value: 24.0, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'mcv_fL', value: 93.0, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'rdw_pct', value: 14.2, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'alp_UL', value: 88.0, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
  { key: 'wbc_1000uL', value: 7.1, layer: 'demo_synthetic', source_ref: 'demo_panel#张明远' },
]

const DEMO_CHRONO_AGE = 45

/** Display metadata for the nine PhenoAge markers. Reference ranges are adult, assay-typical. */
const LAB_META: Record<string, { name_zh: string; name_en: string; unit: string; ref: string }> = {
  albumin_gL: { name_zh: '白蛋白', name_en: 'Albumin', unit: 'g/L', ref: '35–50' },
  creatinine_umolL: { name_zh: '肌酐', name_en: 'Creatinine', unit: 'µmol/L', ref: '62–106（男）' },
  glucose_mmolL: { name_zh: '空腹血糖', name_en: 'Fasting glucose', unit: 'mmol/L', ref: '4.0–5.6' },
  ln_crp_mgL: { name_zh: 'hs-CRP（对数）', name_en: 'ln(hs-CRP)', unit: 'ln(mg/L)', ref: '<1.0 mg/L 最优' },
  lymphocyte_pct: { name_zh: '淋巴细胞百分比', name_en: 'Lymphocyte %', unit: '%', ref: '20–45' },
  mcv_fL: { name_zh: '平均红细胞体积', name_en: 'MCV', unit: 'fL', ref: '80–100' },
  rdw_pct: { name_zh: '红细胞分布宽度', name_en: 'RDW', unit: '%', ref: '11.5–14.5' },
  alp_UL: { name_zh: '碱性磷酸酶', name_en: 'ALP', unit: 'U/L', ref: '40–130' },
  wbc_1000uL: { name_zh: '白细胞计数', name_en: 'WBC', unit: '10⁹/L', ref: '4.0–11.0' },
}

/** One Metric per PhenoAge input, so the panel that feeds the clock is visible in the dashboard. */
export const PHENOAGE_LAB_METRICS: Metric[] = DEMO_LAB_PANEL.map((b) => {
  const meta = LAB_META[b.key]!
  return {
    code: b.key,
    name_zh: meta.name_zh,
    name_en: meta.name_en,
    value: Math.round(b.value * 1000) / 1000,
    unit: meta.unit,
    status: 'normal' as MetricStatus,
    ref: meta.ref,
    module: 'biological' as ModuleCode,
    aliases: [b.key, meta.name_en.toLowerCase(), meta.name_zh],
  }
})

/** Marker keys that feed PhenoAge — exported so a caller can check coverage before scoring. */
export const PHENOAGE_MARKER_KEYS = DEMO_LAB_PANEL.map((b) => b.key)

/** Biological module age — computed by the engine, not authored as a constant. */
export const DEMO_PHENOAGE: PhenoAgeResult = (() => {
  const r = phenoAge(DEMO_LAB_PANEL, DEMO_CHRONO_AGE)
  if (!r.ok) {
    throw new Error(`demo panel must produce a PhenoAge: ${r.code} ${r.message_zh}`)
  }
  return r
})()

const DEMO_MODULE_AGES = {
  biological: DEMO_PHENOAGE.phenoage,
  physiological: 39.8,
  psychological: 42.0,
  behavioral: 42.6,
  social_env: 42.2,
}

export const DEMO_COMPOSITE: CompositeAgeResult = (() => {
  const r = compositeAge(DEMO_MODULE_AGES, DEMO_CHRONO_AGE, { biological: 'engine' })
  if (!r.ok) throw new Error(`demo composite must compute: ${r.message_zh}`)
  return r
})()

export const CUSTOMER: DemoCustomer = {
  id: 'demo_zhang_mingyuan',
  display_name: '张明远（演示）',
  age: DEMO_CHRONO_AGE,
  sex: '男',
  tier: 'Distinction',
  language: 'zh',
  months_enrolled: 18,
  chrono_age: DEMO_CHRONO_AGE,
  composite_age: DEMO_COMPOSITE.composite_age,
  modules: {
    biological: { age: DEMO_MODULE_AGES.biological, label_zh: '生物学' },
    physiological: { age: DEMO_MODULE_AGES.physiological, label_zh: '生理学' },
    psychological: { age: DEMO_MODULE_AGES.psychological, label_zh: '心理学' },
    behavioral: { age: DEMO_MODULE_AGES.behavioral, label_zh: '行为学' },
    social_env: { age: DEMO_MODULE_AGES.social_env, label_zh: '社会与环境' },
  },
  disclaimer_zh: '以上为演示数据，不是您的个人病历。AI 生成内容仅供参考，不替代医师诊断。',
}

export const METRICS: Metric[] = [
  {
    code: 'hs_crp',
    name_zh: '超敏 C 反应蛋白',
    name_en: 'hs-CRP',
    value: 4.2,
    unit: 'mg/L',
    status: 'high',
    ref: '<1.0 最优, <3.0 正常',
    previous: 4.5,
    module: 'biological',
    aliases: ['hs-crp', 'crp', '超敏c反应蛋白', '炎症'],
  },
  {
    code: 'iage',
    name_zh: '炎症/表型年龄',
    name_en: 'Phenotypic age (PhenoAge)',
    value: Math.round(DEMO_PHENOAGE.phenoage * 10) / 10,
    unit: '岁',
    status: DEMO_PHENOAGE.phenoage_advance > 0 ? 'high' : 'optimal',
    ref: `引擎计算值；实足 ${DEMO_CHRONO_AGE} 岁，加速 ${DEMO_PHENOAGE.phenoage_advance >= 0 ? '+' : ''}${DEMO_PHENOAGE.phenoage_advance.toFixed(1)} 年`,
    previous: 59,
    module: 'biological',
    aliases: ['炎症年龄', 'iage', 'phenoage', '表型年龄', '生物年龄'],
  },
  {
    code: 'vo2max',
    name_zh: '最大摄氧量',
    name_en: 'VO₂ Max',
    value: 38.4,
    unit: 'mL/kg/min',
    status: 'normal',
    ref: '同龄男性 35–45',
    previous: 36.1,
    module: 'physiological',
    aliases: ['vo2', '摄氧量'],
  },
  {
    code: 'hrv',
    name_zh: '心率变异性',
    name_en: 'HRV',
    value: 55,
    unit: 'ms',
    status: 'normal',
    ref: '7 日均值 58',
    previous: 58,
    module: 'physiological',
    aliases: ['hrv', '心率变异'],
  },
  {
    code: 'sleep_total_min',
    name_zh: '睡眠总时长',
    name_en: 'Sleep duration',
    value: 444,
    unit: 'min',
    status: 'normal',
    ref: '≥420',
    previous: 430,
    module: 'psychological',
    aliases: ['睡眠', 'sleep'],
  },
  {
    code: 'adherence',
    name_zh: '方案依从率',
    name_en: 'Adherence',
    value: 92,
    unit: '%',
    status: 'optimal',
    ref: '≥85%',
    previous: 88,
    module: 'behavioral',
    aliases: ['依从', '打卡'],
  },
  {
    code: 'pm25',
    name_zh: 'PM2.5 暴露',
    name_en: 'PM2.5',
    value: 28,
    unit: 'µg/m³',
    status: 'watch',
    ref: '30 日目标 <35',
    previous: 32,
    module: 'social_env',
    aliases: ['pm2.5', '空气'],
  },
  ...PHENOAGE_LAB_METRICS,
]

export const INSIGHTS: Insight[] = [
  {
    id: 'ins-trend-vo2',
    type: 'trend_explanation',
    title_zh: 'VO₂ Max 连续三次上升',
    body_zh: '最大摄氧量从 36.1 升至 38.4，与 Zone-2 训练频率增加一致。',
    next_step_zh: '维持每周 3–4 次 Zone-2。',
    metric_codes: ['vo2max'],
    reviewed: true,
  },
  {
    id: 'ins-crp',
    type: 'risk_watch',
    title_zh: 'hs-CRP 仍高于最优区间，且是表型年龄加速的主因',
    body_zh: `当前 4.2 mg/L，上次 4.5，有下降但仍高于 <1.0 最优。它把表型年龄推到 ${DEMO_PHENOAGE.phenoage.toFixed(1)} 岁（实足 ${DEMO_CHRONO_AGE}，加速 +${DEMO_PHENOAGE.phenoage_advance.toFixed(1)} 年）。`,
    next_step_zh: '与医师复核抗炎方案，勿自行改药。',
    metric_codes: ['hs_crp', 'iage'],
    reviewed: true,
  },
  {
    id: 'ins-sleep',
    type: 'lifestyle_nudge',
    title_zh: '睡眠时长已回到目标',
    body_zh: '近 30 日均 7.4 小时，深睡占比约 18%。',
    next_step_zh: '保持固定入睡窗口。',
    metric_codes: ['sleep_total_min'],
    reviewed: true,
  },
]

export const FAQ: FaqDoc[] = [
  {
    id: 'faq-hscrp',
    question: 'hs-CRP 高说明什么？',
    answer: 'hs-CRP 是低度炎症的观察指标。偏高提示需要与医师一起看趋势和伴随指标，不能单独用来下诊断。演示值 4.2 mg/L，上次 4.5。',
    tags: ['hs_crp', '炎症', 'crp'],
  },
  {
    id: 'faq-iage',
    question: '炎症年龄 / 表型年龄比实际年龄大意味着什么？',
    answer: `表型年龄（PhenoAge，Levine 2018）由 9 项血液指标 + 实足年龄经 Gompertz 死亡风险模型算出，本仓内置实现，可离线复算。演示数据算出 ${DEMO_PHENOAGE.phenoage.toFixed(1)} 岁，实足 ${DEMO_CHRONO_AGE} 岁，加速 ${DEMO_PHENOAGE.phenoage_advance >= 0 ? '+' : ''}${DEMO_PHENOAGE.phenoage_advance.toFixed(1)} 年，主要由 hs-CRP 4.2 mg/L 拉动。它是人群模型给出的相对位置，不是诊断，也不能当治疗靶点。`,
    tags: ['iage', '炎症年龄', 'phenoage', '表型年龄'],
  },
  {
    id: 'faq-composite',
    question: '综合生物年龄怎么算？',
    answer: `综合年龄 = 生物学×0.35 + 生理学×0.30 + 心理学×0.15 + 行为学×0.10 + 社会与环境×0.10。其中生物学维来自引擎算出的 PhenoAge，其余四维目前是演示输入。演示数据：${DEMO_MODULE_AGES.biological.toFixed(1)}×0.35 + 39.8×0.30 + 42.0×0.15 + 42.6×0.10 + 42.2×0.10 = ${DEMO_COMPOSITE.composite_age.toFixed(1)} 岁（实足 ${DEMO_CHRONO_AGE}）。`,
    tags: ['综合', '生物年龄', '权重'],
  },
  {
    id: 'faq-rx',
    question: '我可以自己加减药吗？',
    answer: '不可以。助手不能建议加、减、停、换处方药或剂量。请联系您的 Concierge 或主治医师。紧急情况请拨打 120。',
    tags: ['药', '处方', '剂量'],
  },
  {
    id: 'faq-event',
    question: '10 月 24 日发布会当天怎么安排？',
    answer: '使用当日行程：签到、产品演示、长寿之旅团体验、顾问答疑。具体时刻以 get_event_briefing 为准。',
    tags: ['发布会', '行程', '10月24'],
  },
  {
    id: 'faq-foxo3',
    question: 'FOXO3 和长寿有什么关系？',
    answer: '演示基因组含 FOXO3 rs2802292 GT。文献有人群关联（Willcox 2008），不是诊断，也不能据此改药。要做变异效应打分请走 s2f_plan（AlphaGenome/GPN），DSH 内不跑 GPU。',
    tags: ['foxo3', '基因组', 'rs2802292', '长寿'],
  },
  {
    id: 'faq-s2f',
    question: '什么是 s2f-agent？',
    answer: 's2f-agent 是计算基因组学的 skill 路由 agent（AlphaGenome、DNABERT-2、Evo 2、SpliceAI、Borzoi 等）。LongPi 把它的路由与计划接到 DSH，执行仍在 s2f 仓库 dry-run。',
    tags: ['s2f', 'alphagenome', '基因组', '组学'],
  },
]

export const TERMS: TermDoc[] = [
  { code: 'hs_crp', term_zh: '超敏 C 反应蛋白', definition_zh: '反映低度全身炎症的血液标志物。' },
  { code: 'vo2max', term_zh: '最大摄氧量', definition_zh: '心肺耐力的常用实验室/可穿戴估计指标。' },
  { code: 'hrv', term_zh: '心率变异性', definition_zh: '相邻心跳间隔的变异，常用于恢复状态观察。' },
  { code: 'zone2', term_zh: 'Zone-2', definition_zh: '可对话的有氧训练强度区间，常用于基础耐力。' },
  { code: 'foxo3', term_zh: 'FOXO3', definition_zh: 'Forkhead 转录因子，人类长寿队列中反复报道的关联基因。' },
  { code: 'apoe', term_zh: 'APOE', definition_zh: '载脂蛋白 E；ε4 等位基因与 Alzheimer / 心血管风险相关。演示基因型不是 ε4。' },
]

export const DEFAULT_ITINERARY: ItineraryItem[] = [
  { t: '09:30', title_zh: '签到与激活', place_zh: '主会场入口', note_zh: '打印密码卡登录 Portal / DSH Web' },
  { t: '10:00', title_zh: '产品发布', place_zh: '主会场', note_zh: '综合生物年龄与五维表型叙事' },
  { t: '11:00', title_zh: '长寿之旅团体验', place_zh: '体验区', note_zh: '打开 Dashboard，问健康助手一个指标问题' },
  { t: '14:00', title_zh: '顾问答疑', place_zh: '洽谈区', note_zh: '预约意向交给 Concierge，不在现场改药' },
  { t: '16:30', title_zh: '收场', place_zh: '主会场', note_zh: '带走下一步，而不是完整病历结论' },
]

export const MODULE_WEIGHTS: Record<ModuleCode, number> = {
  biological: 0.35,
  physiological: 0.30,
  psychological: 0.15,
  behavioral: 0.10,
  social_env: 0.10,
}

export function findMetric(code: string): Metric | undefined {
  const q = code.trim().toLowerCase()
  return METRICS.find(
    (m) => m.code === q || m.aliases.some((a) => a.toLowerCase() === q) || m.name_zh === code,
  )
}

export function metricsFor(module: ModuleCode): Metric[] {
  return METRICS.filter((m) => m.module === module)
}

export function customerBlock(): string {
  const m = CUSTOMER.modules
  const metricLines = METRICS.map(
    (x) => `| ${x.code} | ${x.name_zh} | ${x.value}${x.unit} | ${x.status} | ${x.ref} | ${x.previous ?? '—'} |`,
  ).join('\n')
  return [
    '## 客户（演示数据）',
    `${CUSTOMER.age}岁 ${CUSTOMER.sex} · ${CUSTOMER.tier} · 入组 ${CUSTOMER.months_enrolled} 月`,
    '',
    '## 最新面板',
    `综合 ${CUSTOMER.composite_age}（实际 ${CUSTOMER.chrono_age}）· 生物学 ${m.biological.age} · 生理学 ${m.physiological.age} · 心理学 ${m.psychological.age} · 行为学 ${m.behavioral.age} · 社会环境 ${m.social_env.age}`,
    '',
    '## 指标',
    '| code | 名称 | 值 | 状态 | 参考 | 上次 |',
    metricLines,
    '',
    '## 近 5 条洞察',
    ...INSIGHTS.map((i) => `- [${i.type}] ${i.title_zh}`),
    '',
    CUSTOMER.disclaimer_zh,
  ].join('\n')
}
