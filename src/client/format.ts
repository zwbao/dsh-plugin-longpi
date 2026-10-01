import { fmt } from './charts.ts'
import type { DraftItem } from './types.ts'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000)
}

export function chineseDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return ''
  // Another year says which (docs/design-system.md: 跨年加年份).
  const year = Number(match[1])
  return year !== new Date().getFullYear() ? `${year} 年 ${month} 月 ${day} 日` : `${month} 月 ${day} 日`
}

export function chineseMonth(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (!match) return ''
  const month = Number(match[2])
  if (!Number.isInteger(month) || month < 1 || month > 12) return ''
  return `${match[1]} 年 ${month} 月`
}

export function weekday(iso: string): string {
  return WEEKDAYS[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()] ?? ''
}

export function localToday(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * A fraction as a signed percentage: one decimal below 10 % (+0.4%, −3.2%),
 * none above (+18%). A change that rounds to nothing is 0%, never +0% or -0%.
 */
export function pct(value: number): string {
  const percent = value * 100
  const text = fmt(percent, Math.abs(percent) < 10 ? 1 : 0)
  if (text === '—') return text
  if (Number(text) === 0) return '0%'
  return `${percent > 0 ? '+' : ''}${text.replace(/^-/, '−')}%`
}

/** How the body age compares with the calendar age, in words. */
/**
 * Body age against the calendar. A single blood draw is never presented as "younger" (PLAN §B5, FINDINGS 54):
 * it is a model estimate from one draw, said as such; "younger" needs at least two complete checkups.
 */
export function versusAge(advance: number | null | undefined, checkups: number | null | undefined = 2): string {
  if (advance == null || !Number.isFinite(advance)) return ''
  if (Math.abs(advance) < 0.5) return '与实足年龄相当'
  if (advance < 0 && (checkups ?? 0) < 2) return `根据单次检查估算（模型估计，不是诊断），比实足年龄小 ${fmt(-advance)} 岁。单次检查不能说明你变年轻了`
  return advance < 0 ? `比实足年龄年轻 ${fmt(-advance)} 岁` : `比实足年龄大 ${fmt(advance)} 岁`
}

export function riskText(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(1)
}

/** Scroll a page section into view and put the cursor in its first field. */
export function goTo(id: string): void {
  const node = document.getElementById(id)
  if (!node) return
  node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const field = node.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button')
  window.setTimeout(() => field?.focus({ preventScroll: true }), 350)
}

/**
 * What to do, without what the card already shows: the server starts a detail with the category and title
 * (饮食：减盐。) and ends it with the evidence (证据：<trial average>，DOI ….个人效果因人而异。), which the card
 * shows on its own line, under 证据 and in its caption.
 */
export function behaviorOf(item: Pick<DraftItem, 'detail' | 'title' | 'category_zh' | 'evidence'>): string {
  const evidence = item.evidence.expected_zh
  let text = item.detail
  const tail = evidence ? text.lastIndexOf(`证据：${evidence}`) : -1
  if (tail >= 0) text = text.slice(0, tail)
  else if (evidence && text.includes(evidence)) text = text.replace(evidence, '')
  const head = item.category_zh ? `${item.category_zh}：${item.title}` : ''
  if (head && text.startsWith(head)) text = text.slice(head.length).replace(/^[，,。；;\s]+/, '')
  return text.replace(/\s*(证据|依据)[:：]\s*$/, '').replace(/[\s，,；;]+$/, '').trim()
}

/** Machine field names that can reach a sentence through a source quote, in the words the page uses. */
const FIELD_ZH: Record<string, string> = {
  sleepDuration: '睡眠时长', sleepHours: '睡眠时长', deepSleep: '深睡', remSleep: '快速眼动睡眠', sleepScore: '睡眠评分',
  steps: '步数', stepCount: '步数', restingHeartRate: '静息心率', heartRate: '心率', hrv: '心率变异性', heartRateVariability: '心率变异性',
  vo2max: '最大摄氧量', vo2Max: '最大摄氧量', activeCalories: '活动消耗', exerciseMinutes: '运动时长', weight: '体重', bmi: 'BMI',
  waist: '腰围', systolic: '收缩压', diastolic: '舒张压', spo2: '血氧',
}

/**
 * Units and field names as a lab report prints them (#19): umol/L → μmol/L, kg/m2 → kg/m², 1.73m2 → 1.73m²,
 * a bare "5.6 h" → 5.6 小时, and camelCase field names in plain Chinese. Anything unknown is left as it is.
 */
const SUPERSCRIPT: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

/** The one place units, field names and number signs are made readable; every page goes through it. */
export function plainUnits(text: string): string {
  return text
    .replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b|\b(?:steps|hrv|spo2|waist|weight|systolic|diastolic|vo2max)\b/g, (word) => FIELD_ZH[word] ?? word)
    .replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, '$1μ$2')
    // 10^3/uL, ×10^9/L → ×10³/μL, ×10⁹/L
    .replace(/(×)?10\^(\d+)\//g, (_, _times: string | undefined, power: string) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join('')}/`)
    // 5.8 % → 5.8%
    .replace(/(\d)\s+%/g, '$1%')
    // no space hugging a full-width bracket: （尿） UACR → （尿）UACR
    .replace(/\s+([（【「])/g, '$1').replace(/([）】」])\s+(?=[\w\u4e00-\u9fff])/g, '$1')
    .replace(/(\d|\/)m2\b/g, '$1m²')
    .replace(/\bm2\b/g, 'm²')
    .replace(/(\d)\s*h\b(?![\w/])/g, '$1 小时')
    .replace(/(\d)\s*min\b/g, '$1 分钟')
    // A negative number takes the minus sign (−1.81), not a hyphen; ranges and dates (8-12, 2026-11-05) keep theirs.
    .replace(/(^|[^\w.\-−])-(?=\d)/g, '$1−')
}
