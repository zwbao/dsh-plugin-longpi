export const NAMESPACE = 'dsh-plugin-longpi'
export const VIEW_ID = 'longpi-board'

export const SUGGESTED = [
  { id: 'review', zh: '我的干预方案有没有效果？哪些有效，哪些还看不出来？' },
  { id: 'plan', zh: '帮我保存我的干预方案，先读给我确认再保存。' },
  { id: 'goal', zh: '如果空腹血糖降到 5.0、超敏 CRP 降到 1，表型年龄会怎样？' },
  { id: 'dispatch', zh: '根据我的档案和检查，现在能跑哪些长寿方法？还差哪几项？' },
  { id: 'pheno', zh: '用我记录里的血检算表型年龄，数值和单位按记录原样传，缺的不要补。' },
  { id: 'evidence', zh: 'NMN 和二甲双胍在收录的论文里有什么说法？分人群、动物和细胞说，不要给剂量。' },
] as const

/** Yes/no facts China-PAR needs that a record does not hold; the person states them. */
export const RISK_FACTS = [
  { key: 'smoker', zh: '现在吸烟' },
  { key: 'diabetes', zh: '有糖尿病' },
  { key: 'bp_treated', zh: '两周内用过降压药' },
  { key: 'north', zh: '住在北方（长江以北）' },
  { key: 'urban', zh: '住在城市' },
  { key: 'family_history', zh: '父母或兄弟姐妹有心梗或脑卒中' },
] as const
