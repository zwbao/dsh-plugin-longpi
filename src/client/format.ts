import { fmt } from './charts.ts'

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

export function chineseDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-')
  return `${Number(month)} 月 ${Number(day)} 日`
}

export function chineseMonth(iso: string): string {
  const [year, month] = iso.slice(0, 10).split('-')
  return `${year} 年 ${Number(month)} 月`
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
  return `${percent > 0 ? '+' : ''}${text}%`
}

/** How the body age compares with the calendar age, in words. */
export function versusAge(advance: number | null | undefined): string {
  if (advance == null || !Number.isFinite(advance)) return ''
  if (Math.abs(advance) < 0.5) return '和实足年龄相当'
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
