// Whose record the calculators use. The account holder and the person the labs
// belong to are not always the same (a daughter opening her father's checkups).

import type { Profile, Sex } from './profile.ts'

export interface RecordSubject {
  relationship_zh: string
  age: number | null
  sex: Sex
}

export function calculatorIdentity(profile: Profile): { age: number | null; sex: Sex; subject: boolean } {
  const subject = profile.subject
  if (!subject) return { age: profile.age, sex: profile.sex, subject: false }
  const sex = subject.sex === 'male' || subject.sex === 'female' ? subject.sex : profile.sex
  return { age: subject.age ?? profile.age, sex, subject: true }
}

/** A sentence that the checkup belongs to a parent, with their age when it is stated. */
export function subjectFromText(text: string): RecordSubject | null {
  const raw = String(text ?? '').replace(/\s/g, '')
  const female = /我(?:妈|妈妈|母亲)/.test(raw)
  const male = /我(?:爸|父亲|爹)/.test(raw)
  if (!female && !male) return null
  if (/我自己|我本人/.test(raw) && !/我(?:爸|父亲|爹|妈|妈妈|母亲)/.test(raw)) return null
  const ageMatch = raw.match(/(?:他|她)(?:今年|年纪)?(\d{2})岁/)
  const age = ageMatch ? Number(ageMatch[1]) : null
  if (age != null && (age < 1 || age > 120)) return null
  return { relationship_zh: female && !male ? '母亲' : '父亲', age, sex: female && !male ? 'female' : 'male' }
}
