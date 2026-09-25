import type { Focus, RiskFact, SelfKey } from './types.ts'

export const NAMESPACE = 'dsh-plugin-longpi'
/** The main-panel key and the sidebar entry id; DSH requires them to match. */
export const PANEL_ID = 'longpi'

/** Used only when the server sent no question list (the journey carries the real labels). */
export const RISK_FACTS: ReadonlyArray<{ key: RiskFact; zh: string; menOnly?: boolean }> = [
  { key: 'smoker', zh: '现在吸烟' },
  { key: 'diabetes', zh: '有糖尿病' },
  { key: 'bp_treated', zh: '两周内用过降压药' },
  { key: 'north', zh: '住在北方（长江以北）' },
  { key: 'urban', zh: '住在城市', menOnly: true },
  { key: 'family_history', zh: '父母或兄弟姐妹有心梗或脑卒中', menOnly: true },
]

export const FOCUS_FALLBACK: ReadonlyArray<{ key: Focus; label_zh: string }> = [
  { key: 'bioage', label_zh: '身体年龄' },
  { key: 'cardio', label_zh: '心血管' },
  { key: 'glucose', label_zh: '血糖' },
  { key: 'weight', label_zh: '体重' },
  { key: 'sleep', label_zh: '睡眠' },
  { key: 'plan', label_zh: '看方案有没有用' },
]

/** Units offered first in the self-measurement form; the server accepts more spellings. */
export const PREFERRED_UNITS: Record<SelfKey, string[]> = {
  waist: ['cm', '尺', '寸', 'in'],
  sbp: ['mmHg'],
  dbp: ['mmHg'],
  weight: ['kg', '斤', 'lb'],
}

export const SELF_FALLBACK: ReadonlyArray<{ key: SelfKey; label_zh: string; unit: string; units: string[] }> = [
  { key: 'waist', label_zh: '腰围', unit: 'cm', units: PREFERRED_UNITS.waist },
  { key: 'sbp', label_zh: '收缩压', unit: 'mmHg', units: PREFERRED_UNITS.sbp },
  { key: 'dbp', label_zh: '舒张压', unit: 'mmHg', units: PREFERRED_UNITS.dbp },
  { key: 'weight', label_zh: '体重', unit: 'kg', units: PREFERRED_UNITS.weight },
]

export const CONSENT_SENTENCES = [
  'LongPi 用你自己的体检和可穿戴数据计算身体年龄、心血管风险等指标，并跟踪你的干预方案是否有效；它不做诊断，不开处方，也不给用药剂量。',
  '病历保存在你自己的 Mirobody 中，档案、方案和打卡只保存在这台电脑上；与 LongPi 对话时，对话内容会发送给 DeepSeek 模型处理。',
  '每个数字都注明来源，并标出正常波动的范围，帮助你判断哪些努力真正有效。',
] as const

export const BOUNDARY_FALLBACK = '模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。'
