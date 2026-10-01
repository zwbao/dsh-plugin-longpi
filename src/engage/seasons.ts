// Personal seasons of 8–12 weeks, ending on a retest when one falls in that window.

import type { Season } from '../contracts/engagement.ts'
import type { IsoDay } from '../contracts/common.ts'
import { addDays, daysBetween } from '../interventions.ts'

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhS(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

export const MIN_SEASON_DAYS = 56
export const MAX_SEASON_DAYS = 84

const HEAD: Record<string, string[]> = {
  care: ['明确要咨询的问题', '写成一张简报', '预约就诊', '就诊并记录医生答复', '按医嘱执行一周', '中间不必汇报', '补做缺失的检查', '连续记录，生病可以冻结', '回顾本季完成情况', '复测之前留白'],
  data: ['确认缺失的检查', '它能解锁什么', '测量腰围或预约加测', '记录结果', '解锁对应的结果', '其余时间无需打开', '有记录即可', '生病或出行时记录', '中期查看', '复测之前留白'],
  generic: ['了解本季主题', '完成一件具体的事', '记录结果', '无需每日打开', '连续记录', '中途查看', '补做缺失项目', '生病可以冻结', '中期查看', '复测之前留白'],
}

export function seasonSpan(today: IsoDay, retestHint: IsoDay | null): { start: IsoDay; end: IsoDay; retest_day: IsoDay; days: number; weeks: number } {
  let days = MAX_SEASON_DAYS
  if (retestHint && retestHint > today) {
    const inclusive = daysBetween(today, retestHint) + 1
    if (inclusive >= MIN_SEASON_DAYS && inclusive <= MAX_SEASON_DAYS) days = inclusive
    else if (inclusive > MAX_SEASON_DAYS) days = MAX_SEASON_DAYS
    else days = MIN_SEASON_DAYS
  }
  const end = addDays(today, days - 1)
  const retest = retestHint && retestHint >= today && retestHint <= end ? retestHint : end
  return { start: today, end, retest_day: retest, days, weeks: Math.round(days / 7) }
}

export function chapterList(focus: string, weeks: number): Season['chapters'] {
  const head = (HEAD[focus] ?? HEAD.generic).slice(0, Math.max(1, weeks - 2))
  const titles = [...head, '准备复测', '写这一季的回看'].slice(0, weeks)
  return titles.map((title, index) => ({ week: index + 1, title_zh: title }))
}

export function seasonStatus(season: Pick<Season, 'start' | 'end'>, today: IsoDay): Season['status'] {
  if (today < season.start) return 'upcoming'
  if (today > season.end) return 'closed'
  if (today >= addDays(season.end, -13)) return 'retest_window'
  return 'active'
}

export function weekOf(season: Pick<Season, 'start' | 'chapters'>, today: IsoDay): number {
  const elapsed = Math.max(0, daysBetween(season.start, today))
  return Math.min(season.chapters.length, Math.floor(elapsed / 7) + 1)
}

export function recapText(input: {
  title: string
  start: IsoDay
  end: IsoDay
  weeks: number
  done: number
  total: number
  best: number
  frozen: number
  draws: number
  retest: boolean
}): string {
  return [
    `「${input.title}」从 ${dayZhS(input.start)}到 ${dayZhS(input.end)}，共 ${input.weeks} 周。`,
    `完成了 ${input.done} / ${input.total} 项任务。`,
    `连续记录最好是 ${input.best} 天。生病或出行冻结了 ${input.frozen} 天，这些天不算中断。`,
    `图鉴抽了 ${input.draws} 张。稀有度看的是研究证据，不是检查结果。`,
    input.retest ? '复测窗口内已记录一次复测。' : '复测窗口内尚无新的检查，可在下次体检时补做。',
    '下一季可在你准备好后开始。',
  ].join('')
}
