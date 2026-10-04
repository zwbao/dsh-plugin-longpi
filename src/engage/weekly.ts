// Deterministic weekly narrative. Counts and dates only; no age claim.

import type { IsoDay } from '../contracts/common.ts'

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhW(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

export function weeklyText(input: {
  title: string
  week: number
  weeks: number
  status: string
  /** Days with a health action, all time and this season; counts never reset. */
  days_total: number
  days_season: number
  next_milestone: number
  done: number
  total: number
  open: string[]
  reminder: string | null
  retestDay: IsoDay | null
}): string {
  const lines = [
    `第 ${input.week} 周，共 ${input.weeks} 周 · ${input.title}`,
    `累计 ${input.days_total} 天做了健康行动（本季 ${input.days_season} 天），到第 ${input.next_milestone} 天会多一次抽卡机会。`,
    input.open.length > 0
      ? `任务完成 ${input.done} / ${input.total}。未完成：${input.open.join('、')}。`
      : `任务完成 ${input.done} / ${input.total}。这一季的任务都做完了。`,
  ]
  if (input.reminder) lines.push(input.reminder)
  if (input.status === 'retest_window') {
    lines.push(input.retestDay ? `复测窗口已开启，请在 ${dayZhW(input.retestDay)}前完成一次相同的检查，本季即告结束。` : '复测窗口已开启，本季即将结束。')
  }
  lines.push('此处仅总结你完成的事项，不将单次检查解读为身体年龄下降。')
  return lines.join('\n')
}
