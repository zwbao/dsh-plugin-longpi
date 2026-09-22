export const NAMESPACE = 'dsh-plugin-longpi'
export const VIEW_ID = 'longpi-board'

export const SUGGESTED = [
  { id: 'dispatch', zh: '根据我现在的档案和检查，能调度哪些长寿技能？' },
  { id: 'pheno', zh: '如果九项血指标都在记录里，用表型年龄读我自己，缺的不要补。' },
  { id: 'loinc', zh: '把我最近的检查名解析成 LOINC，解析不了的就说未解析。' },
  { id: 'meds', zh: '我的用药计划里有哪些药？只读，不要建议加减量。' },
] as const
