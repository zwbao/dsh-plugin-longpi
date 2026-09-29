// What a reply must carry whatever its shape (0.6.3). The owner's policy is concrete, complete advice, and the
// 0.6.2 length budget dropped three things the person needs:
//   - the earliest retest date, when a plan verdict is 波动内 or it is too early to judge;
//   - the offer to put the values and the questions for the doctor on one page, when the reply sends the person
//     to a doctor about a finding in their record, and in that doctor line every specialist and the time the
//     doctor-first sentence names (缺铁的原因常要消化科一起查，尽量在 1 到 2 周内去);
//   - for an older person's list of medicines: a pharmacist or medication review with every box, falls
//     prevention, and each named drug of concern with the reason.
// These are checks, not wording rules: the guard reads the reply that closes a turn and, when one of them is
// missing, adds it with its single correction for that turn (guard-llm.ts turnStopping).

import { addDays, daysBetween, retestAdvice } from '../feedback/retest-timing.ts'
import { normalizeAdviceText } from './playbook.ts'

export type GapId = 'retest_date' | 'doctor_line' | 'doctor_brief' | 'med_review'

export interface CompletenessGap {
  id: GapId
  /** The Chinese sentence to add, ready to send. */
  say: string
}

/** One tool call of this turn with its parsed result (null when the result was not JSON). */
export interface TurnTool {
  name: string
  args: Record<string, unknown>
  result: unknown
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

const ISO = /^\d{4}-\d{2}-\d{2}/

// ------------------------------------------------------------------------------------------ retest date

/** Retest interval key from a marker's name on the report. */
export function retestKey(label: string): string {
  const text = String(label ?? '')
  if (/糖化|hba1c|a1c/i.test(text)) return 'hba1c'
  if (/身体年龄|表型年龄|phenoage/i.test(text)) return 'phenoage'
  if (/维生素\s*d|25.?羟/i.test(text)) return 'vitd'
  if (/低密度|ldl/i.test(text)) return 'ldl'
  if (/高密度|hdl/i.test(text)) return 'hdl'
  if (/甘油三酯|triglycer|\btg\b/i.test(text)) return 'tg'
  if (/总胆固醇|胆固醇/i.test(text)) return 'tc'
  if (/空腹血糖|血糖|glucose/i.test(text)) return 'glucose'
  if (/体重|体质指数|体重指数|bmi|weight/i.test(text)) return 'weight'
  return String(label ?? '')
}

export interface RetestDue {
  marker: string
  /** Earliest date a retest can show a real change. */
  date: string
  /** Days from the anchor (the plan start, or the last retest) to that date. */
  days: number
  anchor: 'start' | 'retest'
  verdict: string
}

/**
 * The earliest retest per marker that is 波动内 or too early to judge, from a review_interventions result.
 * A too-early verdict carries next_retest; a 波动内 verdict after a retest opens the next window at that retest
 * plus the marker's interval (lipids, glucose and weight 8 weeks, HbA1c and body age 90 days).
 */
export function retestDue(review: unknown): RetestDue[] {
  const data = record(review)
  const today = typeof data.today === 'string' && ISO.test(data.today) ? data.today.slice(0, 10) : ''
  const out: RetestDue[] = []
  const seen = new Set<string>()
  for (const item of list(data.items)) {
    const start = String(record(item).start ?? '').slice(0, 10)
    for (const raw of list(record(item).verdicts)) {
      const row = record(raw)
      const verdict = String(row.verdict ?? '')
      if (verdict !== '波动内' && verdict !== '无法判断') continue
      const marker = String(row.marker ?? '')
      if (!marker || seen.has(marker)) continue
      const advice = retestAdvice(retestKey(`${row.indicator ?? ''} ${marker}`.trim()) || marker)
      const keyed = retestAdvice(retestKey(marker))
      const minDays = Math.max(advice.minDays, keyed.minDays)
      const next = typeof row.next_retest === 'string' && ISO.test(row.next_retest) ? row.next_retest.slice(0, 10) : ''
      const followup = String(record(row.followup).date ?? '').slice(0, 10)
      let due: RetestDue | null = null
      if (next && (!today || next >= today)) {
        due = { marker, date: next, days: ISO.test(start) ? Math.max(0, daysBetween(start, next)) : minDays, anchor: 'start', verdict }
      } else if (verdict === '波动内' && ISO.test(followup)) {
        const date = addDays(followup, minDays)
        if (!today || date >= today) due = { marker, date, days: minDays, anchor: 'retest', verdict }
      }
      if (!due) continue
      seen.add(marker)
      out.push(due)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

const RETEST_WORD = /复测|复查|再测|再查|重测|再抽血|再验|下次查|下次测/
const WHEN = /\d{4}\s*[-年/.]\s*\d{1,2}(?:\s*[-月/.]\s*\d{1,2})?|\d{1,2}\s*月\s*\d{1,2}\s*[日号]?|\d{1,2}\s*月(?:[上中下]旬|底|初|份)|\d+(?:\s*[-–~到至]\s*\d+)?\s*(?:周|个月|天|星期)|[一二三四五六八九十两半]+\s*(?:周|个月|年|星期)|月底|年底|明年/

/** A retest word and a time in one sentence. */
export function saysWhenToRetest(reply: string): boolean {
  const sentences = String(reply ?? '').split(/[。！!？?\n；;]/)
  return sentences.some((sentence) => RETEST_WORD.test(sentence) && WHEN.test(sentence))
}

function weeksZh(days: number): string {
  if (days >= 84 && days % 30 === 0) return `${days / 30} 个月`
  if (days % 7 === 0) return `${days / 7} 周`
  return `${days} 天`
}

export function retestSentence(due: RetestDue): string {
  const since = due.anchor === 'retest' ? '离这次复测' : '从方案开始算'
  return `${due.marker}下次复查最早在 ${due.date}（${since}满 ${weeksZh(due.days)}），那时才分得清是不是真实变化。`
}

// ------------------------------------------------------------------------------------------ doctor brief

const DOCTOR_VISIT = /(?:去|先|请|挂|看|找|带)[^。\n]{0,10}(?:医生|血液科|消化科|内分泌科|心内科|肾内科|全科|门诊|专科|就医|就诊)/
const BRIEF_OFFER = /简报|问题清单|给医生看|一页纸|一页|要问医生的问题|问医生的问题|要问的问题/
const ABOUT_RESULTS = /结果|变化|要紧|严重|怎么回事|复查|复测|化验|报告|指标|体检|正常吗|算不算|正不正常|偏低|偏高|该做什么|怎么办|下一步|接下来|方案|计划|医生|看病|就医|挂号|效果|有没有用|有没有效/

/** Whether a read_personal_situation or review_interventions result says the record has a doctor-first finding. */
export function hasDoctorFinding(result: unknown): boolean {
  const data = record(result)
  if (typeof data.doctor_first_zh === 'string' && data.doctor_first_zh.trim()) return true
  const doctor = record(data.doctor_first)
  if (typeof doctor.sentence_zh === 'string' && doctor.sentence_zh.trim()) return true
  if (doctor.stop === true) return true
  const changes = [...list(data.record_changes), ...list(data.changes)]
  return changes.some((row) => record(row).ask_doctor === true)
}

/** The doctor-first sentence a read_personal_situation (doctor_first_zh) or review_interventions (doctor_first) result carries. */
export function doctorFirstText(result: unknown): string {
  const data = record(result)
  if (typeof data.doctor_first_zh === 'string' && data.doctor_first_zh.trim()) return data.doctor_first_zh
  const doctor = record(data.doctor_first)
  return typeof doctor.sentence_zh === 'string' ? doctor.sentence_zh : ''
}

// Specialists a doctor-first sentence names. 全科 is the way in, not a specialist the reply must repeat.
const SPECIALIST = /血液科|消化科|内分泌科|心内科|肾内科|眼科|泌尿外科|乳腺外科|乳腺专科|妇科|产科|神经内科|老年科/g
const WEEKS = /(?:\d+|[一二两三四])\s*(?:(?:到|至|-|–|~)\s*(?:\d+|[一二两三四])\s*)?(?:个)?(?:周|星期)(?:内|之内)/

/**
 * The doctor line keeps what makes it actionable: every specialist the doctor-first sentence names and the time it
 * gives (缺铁的原因常要消化科一起查，尽量在 1 到 2 周内去). Returns the clauses to add, or null.
 */
export function doctorLineGap(doctorFirst: string, reply: string): string | null {
  const sentence = String(doctorFirst ?? '')
  if (!sentence.trim()) return null
  const clauses = sentence.split(/[，。；（）()]/).map((part) => part.trim()).filter(Boolean)
  const add: string[] = []
  for (const dept of new Set(sentence.match(SPECIALIST) ?? [])) {
    if (reply.includes(dept)) continue
    const clause = clauses.find((part) => part.includes(dept))
    if (clause && !add.includes(clause)) add.push(clause)
  }
  const time = clauses.find((part) => WEEKS.test(part))
  if (time && !WEEKS.test(reply) && !add.includes(time)) add.push(time)
  return add.length > 0 ? `${add.join('，')}。` : null
}

export const BRIEF_SENTENCE = '我可以按这些结果整理一份给医生看的简报（数值、日期和要问医生的几个问题），你去看病时直接给医生看。'

// ------------------------------------------------------------------------------------------ medication review

interface Concern { names: string[]; why: string }

// Drugs an older person's medication review looks at first (Beers 2023; 中国老年人潜在不适当用药判断标准 2017).
const CONCERNS: Concern[] = [
  { names: ['艾司唑仑', '阿普唑仑', '地西泮', '劳拉西泮', '氯硝西泮', '硝西泮', '奥沙西泮', '三唑仑'], why: '属于苯二氮䓬类安眠药，老人吃了容易白天头晕、反应慢、跌倒' },
  { names: ['唑吡坦', '右佐匹克隆', '佐匹克隆', '扎来普隆'], why: '是安眠药，老人夜里起身时容易跌倒' },
  { names: ['格列美脲', '格列本脲', '格列齐特', '格列吡嗪', '格列喹酮', '消渴丸'], why: '是磺脲类降糖药，老人容易低血糖，低血糖也会表现为头晕' },
  { names: ['苯海拉明', '氯苯那敏', '扑尔敏', '异丙嗪', '赛庚啶'], why: '是老一代抗过敏药，老人吃了容易嗜睡、糊涂、便秘' },
  { names: ['阿米替林', '多塞平', '丙米嗪', '氯米帕明'], why: '是三环类抗抑郁药，容易站起来头晕、口干、便秘' },
  { names: ['喹硫平', '奥氮平', '利培酮', '氟哌啶醇'], why: '是抗精神病药，老人用要医生定期评估跌倒和卒中风险' },
  { names: ['特拉唑嗪', '多沙唑嗪', '哌唑嗪'], why: '容易在站起来时让血压掉得太低、头晕' },
  { names: ['地高辛'], why: '老人肾功能下降时容易在体内蓄积，要医生看心率和血药浓度' },
  { names: ['奥昔布宁', '托特罗定'], why: '容易口干、便秘、糊涂' },
]

const BP_DRUGS = ['氨氯地平', '左氨氯地平', '硝苯地平', '非洛地平', '拉西地平', '美托洛尔', '比索洛尔', '阿替洛尔', '卡维地洛', '厄贝沙坦', '缬沙坦', '氯沙坦', '替米沙坦', '坎地沙坦', '奥美沙坦', '沙库巴曲', '贝那普利', '依那普利', '培哚普利', '福辛普利', '卡托普利', '氢氯噻嗪', '吲达帕胺', '螺内酯', '呋塞米', '特拉唑嗪', '多沙唑嗪']

const OTHER_DRUGS = ['阿托伐他汀', '瑞舒伐他汀', '辛伐他汀', '二甲双胍', '阿卡波糖', '达格列净', '恩格列净', '西格列汀', '胰岛素', '阿司匹林', '氯吡格雷', '华法林', '利伐沙班', '奥美拉唑', '泮托拉唑', '雷贝拉唑', '左甲状腺素', '优甲乐', '别嘌醇', '非布司他', '布洛芬', '双氯芬酸', '塞来昔布', '多奈哌齐', '美金刚', '坦索罗辛', '非那雄胺', '钙片', '维生素']

const ELDER = /老人|老年|高龄|老伴|爷爷|奶奶|外公|外婆|姥姥|姥爷/
const PARENT = /我妈|我爸|妈妈|爸爸|母亲|父亲|老妈|老爸|婆婆|公公|岳母|岳父/
const MANY = /(?:\d+|[三四五六七八九十]|好几|很多|一堆|一大堆|十几)\s*种(?:药|的药)/

function ageIn(text: string): number | null {
  let best: number | null = null
  for (const hit of text.matchAll(/(\d{2,3})\s*(?:岁|周岁)/g)) {
    const age = Number(hit[1])
    if (age >= 18 && age <= 120) best = Math.max(best ?? 0, age)
  }
  return best
}

function namedIn(text: string, names: readonly string[]): string[] {
  return names.filter((name) => text.includes(name))
}

/** The drugs of concern named in the message, and whether it is an older person's medicine list at all. */
export function medicationReview(userText: string): { concerns: Array<{ name: string; why: string }>; bp: string[] } | null {
  const text = normalizeAdviceText(userText)
  const bp = namedIn(text, BP_DRUGS)
  const concerns = CONCERNS.flatMap((row) => namedIn(text, row.names).map((name) => ({ name, why: row.why })))
  const named = new Set([...bp, ...concerns.map((row) => row.name), ...namedIn(text, OTHER_DRUGS)])
  const many = MANY.test(text) || named.size >= 3
  if (!many) return null
  const age = ageIn(text)
  const older = (age != null && age >= 65) || ELDER.test(text) || (age == null && PARENT.test(text))
  if (!older) return null
  return { concerns, bp }
}

const REVIEW = /药师|用药评估|用药重整|药物重整|老年科|老年医学科/
const BOXES = /药盒|所有的药|全部的药|全部药|所有药|药全带|药都带/
const FALLS = /跌倒|摔倒|防摔|绊倒|摔跤/
const ORTHOSTATIC = /体位性低血压|直立性低血压|站起来[^。]{0,12}(?:头晕|血压)|躺着和站着|卧立位/

export const REVIEW_SENTENCE = '带上她（他）现在吃的全部药盒，包括保健品，去老年科或医院的药师门诊做一次用药评估，哪一种可以减、可以停，由医生和药师来定，家里先不要自己停。'
export const FALLS_SENTENCE = '头晕的老人先防跌倒：起床、起身要慢，先坐一会儿再站；夜里留一盏小夜灯，把地上的电线和杂物挪开，浴室放防滑垫。'

// ------------------------------------------------------------------------------------------ all of it

export interface CompletenessInput {
  userText: string
  reply: string
  /** This turn's tool calls with their parsed results. */
  tools: readonly TurnTool[]
  /** The latest read_personal_situation result in the session, when this turn did not call it. */
  situation?: unknown
}

export function completenessGaps(input: CompletenessInput): CompletenessGap[] {
  const reply = String(input.reply ?? '')
  const userText = String(input.userText ?? '')
  const gaps: CompletenessGap[] = []

  const reviews = input.tools.filter((tool) => tool.name === 'review_interventions').map((tool) => tool.result)
  const due = reviews.flatMap(retestDue)
  if (due.length > 0 && !saysWhenToRetest(reply)) {
    gaps.push({ id: 'retest_date', say: due.slice(0, 2).map(retestSentence).join('') })
  }

  const situations = [
    ...input.tools.filter((tool) => tool.name === 'read_personal_situation' || tool.name === 'review_interventions').map((tool) => tool.result),
    ...(input.situation === undefined ? [] : [input.situation]),
  ]
  if (situations.some(hasDoctorFinding) && ABOUT_RESULTS.test(userText) && DOCTOR_VISIT.test(reply)) {
    const doctorFirst = situations.map(doctorFirstText).find((text) => text.trim()) ?? ''
    const line = doctorLineGap(doctorFirst, reply)
    if (line) gaps.push({ id: 'doctor_line', say: line })
    if (!BRIEF_OFFER.test(reply)) gaps.push({ id: 'doctor_brief', say: BRIEF_SENTENCE })
  }

  const meds = medicationReview(userText)
  if (meds) {
    const hay = normalizeAdviceText(reply)
    const parts: string[] = []
    if (!(REVIEW.test(hay) && BOXES.test(hay))) parts.push(REVIEW_SENTENCE)
    for (const row of meds.concerns) if (!hay.includes(row.name)) parts.push(`${row.name}${row.why}，这一条要专门问医生。`)
    if (meds.bp.length >= 2 && !ORTHOSTATIC.test(hay)) {
      parts.push(`${meds.bp.join('和')}都是降压药，叠在一起可能让血压在站起来时掉得太低（体位性低血压），可以量一下躺着和站着的血压。`)
    }
    if (!FALLS.test(hay)) parts.push(FALLS_SENTENCE)
    if (parts.length > 0) gaps.push({ id: 'med_review', say: parts.join('') })
  }
  return gaps
}
