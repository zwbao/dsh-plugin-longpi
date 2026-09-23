export type GuardHit =
  | { code: 'emergency'; reply_zh: string }
  | { code: 'no_medication_change'; reply_zh: string }

const EMERGENCY = [
  '胸痛',
  '胸口疼',
  '胸口痛',
  '心口疼',
  '呼吸困难',
  '喘不上气',
  '喘不过气',
  '晕倒',
  '晕厥',
  '昏迷',
  '意识不清',
  '抽搐',
  '大出血',
  '吐血',
  '自杀',
  '不想活',
  '想死',
  '轻生',
  '割腕',
  '严重过敏',
  '中风',
  '脑梗',
  '心梗',
  '半身麻木',
  '口角歪斜',
  'chest pain',
  "can't breathe",
  'cannot breathe',
  'fainted',
  'seizure',
  'suicide',
  'kill myself',
  'overdose',
  'stroke',
  'heart attack',
]

// Generic references to a medicine. Named drugs come from DRUGS and from the
// person's medication plan (rememberMedications).
const MEDICINE = /(药|药物|药片|胶囊|处方|medication|medicine|drug|pill|tablet)/i

const DRUGS = [
  '二甲双胍', '阿司匹林', '雷帕霉素', '西罗莫司', '他汀', '阿托伐他汀', '瑞舒伐他汀', '辛伐他汀', '降压药', '降糖药',
  '胰岛素', '司美格鲁肽', '替尔泊肽', '利拉鲁肽', '阿卡波糖', '达格列净', '恩格列净', '华法林', '氯吡格雷', '左甲状腺素',
  '优甲乐', '激素', '泼尼松', '地塞米松', '褪黑素', '安眠药', '抗抑郁药', '达沙替尼', '槲皮素', '非瑟酮', '白藜芦醇',
  'nmn', 'nr', '烟酰胺核糖', '烟酰胺单核苷酸', '亚精胺', '尿石素', '辅酶q10', '维生素d', '维生素', '鱼油', '补剂', '保健品',
  'metformin', 'aspirin', 'rapamycin', 'sirolimus', 'statin', 'atorvastatin', 'rosuvastatin', 'insulin', 'semaglutide',
  'tirzepatide', 'acarbose', 'warfarin', 'clopidogrel', 'levothyroxine', 'prednisone', 'melatonin', 'dasatinib',
  'quercetin', 'fisetin', 'resveratrol', 'spermidine', 'urolithin', 'coq10', 'vitamin d', 'fish oil', 'supplement',
]

// Asking to start, stop, continue, or dose. Checked only when a medicine is mentioned.
const CHANGE = new RegExp([
  '停药', '把药停', '停掉', '停了', '停用', '停吃', '能停', '可以停', '要不要停', '该不该停', '断药', '戒掉',
  '不吃', '别吃', '不用吃', '不用再吃', '不再吃', '能不能不吃', '可以不吃',
  '继续吃', '还要吃', '还用吃', '要不要吃', '该不该吃', '能不能吃', '可以吃吗', '能吃吗',
  '开始吃', '开始服', '开始用', '开始打', '吃多少', '吃几', '几片', '几粒', '几颗', '多少毫克', '多少mg', '多少微克',
  '一天吃', '每天吃', '一次吃', '怎么吃', '吃法', '剂量', '用量', '加量', '减量', '加药', '减药', '换药', '换成',
  '改剂量', '调整剂量', '加大', '减半',
  'increase (the |my )?dose', 'decrease (the |my )?dose', 'change (my |the )?dose', 'dosage',
  'how much [a-z0-9 -]{0,40}(should|can|do|to) i? ?take', 'should i (take|stop|start|keep|quit)',
  'stop (taking|my|the)', 'start taking', 'keep taking', 'quit (taking|my)', 'come off',
].join('|'), 'i')

let rememberedDrugs: string[] = []

/** Names from this person's medication plan, so "停掉<药名>" is caught too. */
export function rememberMedications(names: readonly string[]): void {
  rememberedDrugs = names.map((name) => name.trim()).filter((name) => name.length >= 2).slice(0, 60)
}

function mentionsMedicine(text: string): boolean {
  const lower = text.toLowerCase()
  if (MEDICINE.test(text)) return true
  for (const name of [...DRUGS, ...rememberedDrugs]) {
    const item = name.toLowerCase()
    if (/^[a-z0-9 ]+$/.test(item)) {
      if (new RegExp(`(?<![a-z0-9])${item}(?![a-z0-9])`, 'i').test(lower)) return true
    } else if (lower.includes(item)) {
      return true
    }
  }
  return false
}

export function preGuard(text: string): GuardHit | null {
  const lower = text.toLowerCase()
  if (EMERGENCY.some((item) => lower.includes(item.toLowerCase()))) {
    return {
      code: 'emergency',
      reply_zh: '如果您正在经历紧急不适，请立即拨打 120 或当地急救电话。在美国可拨打或发短信至 988。我不能替代急救，也不会给出处理步骤。',
    }
  }
  if (CHANGE.test(text) && mentionsMedicine(text)) {
    return {
      code: 'no_medication_change',
      reply_zh: '我不能建议开始、停止、继续、加量、减量或更换药物和补剂，也不给剂量。用药记录只读。调整处方请联系开具该药的医生或药师。',
    }
  }
  return null
}

export function extractUserText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (block && typeof block === 'object' && 'type' in block && (block as { type: string }).type === 'text') {
        return String((block as { text?: string }).text ?? '')
      }
      return ''
    })
    .join('\n')
}

export function wrapGuardMessage(text: string, hit: GuardHit): string {
  return [
    hit.reply_zh,
    '',
    'Answer with that boundary only. Do not add a diagnosis, a dose, a treatment step, or a skill report.',
    'For a medication question you may offer to look up what the collected papers say (query_longevity_evidence), without a dose and without telling them to start or stop.',
    `The user said: ${text.slice(0, 500)}`,
  ].join('\n')
}
