// A few things said in the first person are kept at once by rule, before any model: pregnancy or planning
// one, and a close relative's breast cancer. They only add caution (plan safety) and a screening topic.

import type { NewMemoryItem } from '../contracts/memory.ts'
import { readProfile, writeProfile } from '../profile.ts'
import { subjectFromText } from '../subject.ts'
import { memoryFor } from './memory.ts'

const OTHER_PERSON = /老婆|妻子|太太|女朋友|女儿|朋友|同事|她(?:在|正在|怀)/

export function rememberFromWords(dataDir: string, text: string, session = ''): string[] {
  const raw = String(text ?? '')
  const ops: NewMemoryItem[] = []
  const at = new Date().toISOString()
  const provenance = (quote: string) => ({ kind: 'chat' as const, at, by: 'M0' as const, ...(session ? { session_id: session } : {}), quote_zh: quote.slice(0, 200) })
  const pregnancy = raw.match(/我(?:现在|已经|正在|在|准备|打算|计划)?(?:怀孕了?|备孕)[^。？?！!]{0,10}|怀孕\s*\d+\s*(?:周|个月)/)
  if (pregnancy && !OTHER_PERSON.test(raw.slice(Math.max(0, (pregnancy.index ?? 0) - 6), (pregnancy.index ?? 0) + pregnancy[0].length))) {
    const planning = /备孕|准备|打算|计划/.test(pregnancy[0])
    ops.push({ kind: 'condition', name_zh: planning ? '备孕' : '怀孕', flags: [planning ? 'pregnancy_planning' : 'pregnancy'], state: 'current', text_zh: planning ? '在备孕' : '怀孕', confirmed: true, provenance: provenance(pregnancy[0]) } as NewMemoryItem)
  }
  const family = raw.match(/(?:我妈妈?|我母亲|母亲|我姐姐?|我妹妹?|我外婆|我奶奶)[^。？?！!]{0,14}(?:乳腺癌|乳癌)[^。？?！!]{0,8}/)
  if (family) {
    ops.push({ kind: 'family_history', relative: /姐|妹/.test(family[0]) ? (/姐/.test(family[0]) ? 'sister' : 'sister') : /外婆|奶奶/.test(family[0]) ? 'grandparent' : 'mother', condition_zh: '乳腺癌', flags: [], text_zh: family[0].trim(), confirmed: true, provenance: provenance(family[0]) } as NewMemoryItem)
  }
  const subject = subjectFromText(raw)
  if (subject) {
    try {
      writeProfile(dataDir, { ...readProfile(dataDir), subject })
    } catch {
      // a damaged profile is left alone; the sentence is still in the chat
    }
  }
  if (ops.length === 0) return []
  return memoryFor(dataDir).apply(ops.map((item) => ({ op: 'add' as const, item })), 'M0').applied
}
