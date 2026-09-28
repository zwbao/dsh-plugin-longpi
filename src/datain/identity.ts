// Whose report is this? A page that names someone else (p36: the husband's Labcorp page) is not
// written into this person's Mirobody record. The chat never receives either name (D10).

import { readProfile } from '../profile.ts'

export interface IdentityHit {
  names: string[]
  births: string[]
}

const NAME_PATTERNS = [
  /(?:姓名|病人|患者|客户|Patient|Name)\s*[:：]\s*([\u4e00-\u9fff·]{2,8})/gi,
  /\b(?:Patient|Name)\s*[:：]\s*([A-Za-z][A-Za-z .'-]{1,40})/gi,
]
const BIRTH = /(?:出生日期|出生|DOB|Date of Birth)\s*[:：]\s*(\d{4})[-/.年](\d{2})[-/.月](\d{2})/gi

function normName(value: string): string {
  return value.replace(/\s+/g, '').replace(/先生|女士|小姐/g, '').toLowerCase()
}

export function readIdentity(text: string): IdentityHit {
  const names: string[] = []
  const seen = new Set<string>()
  for (const pattern of NAME_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      const name = (match[1] ?? '').trim()
      const key = normName(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      names.push(name)
    }
  }
  const births: string[] = []
  const birthSeen = new Set<string>()
  BIRTH.lastIndex = 0
  let birth: RegExpExecArray | null
  while ((birth = BIRTH.exec(text))) {
    const day = `${birth[1]}-${birth[2]}-${birth[3]}`
    if (birthSeen.has(day)) continue
    birthSeen.add(day)
    births.push(day)
  }
  return { names, births }
}

export interface IdentityJudgement {
  wrong_person: boolean
  /** Why, without any name, for the chat. */
  reason_zh: string
  /** For the 档案 page only. May name the report so the person can recognise it. */
  page_note_zh: string
  names: string[]
}

export function judgeIdentity(text: string, dataDir: string): IdentityJudgement {
  const hit = readIdentity(text)
  const profile = readProfile(dataDir)
  const mine = normName(profile.displayName)
  const distinct = hit.names
  if (distinct.length >= 2 && mine && distinct.some((name) => normName(name) !== mine)) {
    const other = distinct.find((name) => normName(name) !== mine) ?? ''
    return {
      wrong_person: true,
      reason_zh: '这份报告里有和档案不同的姓名，没有写入你的记录。请只上传你自己的那几页。',
      page_note_zh: other ? `报告上还有「${other}」，和档案里的姓名不同，这一份没有写入。` : '报告上有两个姓名，没有写入。',
      names: distinct,
    }
  }
  if (mine && distinct.some((name) => normName(name) !== mine)) {
    const other = distinct.find((name) => normName(name) !== mine) ?? distinct[0] ?? ''
    return {
      wrong_person: true,
      reason_zh: '报告上的姓名和档案不一致，没有写入。请核对是不是你的报告。',
      page_note_zh: `报告姓名「${other}」和档案不同，没有写入你的记录。`,
      names: distinct,
    }
  }
  if (!mine && distinct.length >= 2) {
    return {
      wrong_person: true,
      reason_zh: '这份报告里有两个不同的姓名，没有写入。请先在档案里填写你的姓名，再分开上传。',
      page_note_zh: `报告里出现了两个姓名（${distinct.join('、')}）。档案还没有姓名，所以没有写入。`,
      names: distinct,
    }
  }
  if (mine && distinct.length === 0 && profile.birthYear && hit.births.length > 0) {
    const years = [...new Set(hit.births.map((day) => Number(day.slice(0, 4))))]
    if (years.length > 0 && years.every((year) => Math.abs(year - (profile.birthYear as number)) > 1)) {
      return {
        wrong_person: true,
        reason_zh: '报告上的出生年份和档案差得较多，没有写入。请核对是不是你的报告。',
        page_note_zh: `报告出生年份是 ${years.join('、')}，档案是 ${profile.birthYear}，没有写入。`,
        names: [],
      }
    }
  }
  return { wrong_person: false, reason_zh: '', page_note_zh: '', names: distinct }
}
