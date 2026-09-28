// Personal seasons of 8–12 weeks, ending on a retest when one falls in that window.

import type { Season } from '../contracts/engagement.ts'
import type { IsoDay } from '../contracts/common.ts'
import { addDays, daysBetween } from '../interventions.ts'

export const MIN_SEASON_DAYS = 56
export const MAX_SEASON_DAYS = 84

const HEAD: Record<string, string[]> = {
  care: ['看清要问的事', '写成一张简报', '约到医生', '去问，并记下回答', '按医生说的做一周', '中间不必汇报', '缺的检查补上', '连续记录，生病可以冻结', '看看这一季做了什么', '复测之前留白'],
  data: ['看缺的那一项', '它能解锁什么', '量腰围或约加测', '记下来', '解锁对应的结果', '其余的日子不必打开', '有记录就够', '生病或出行记一笔', '中期看一眼', '复测之前留白'],
  generic: ['看这一季的主题', '做一件具体的事', '记下来', '不必日日打开', '连续的日子', '中间看一眼', '把缺的补上', '生病可以冻结', '中期看一眼', '复测之前留白'],
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
    `「${input.title}」从 ${input.start} 到 ${input.end}，共 ${input.weeks} 周。`,
    `完成了 ${input.done} / ${input.total} 项任务。`,
    `连续记录最好是 ${input.best} 天。生病或出行冻结了 ${input.frozen} 天，这些天不算中断。`,
    `图鉴抽了 ${input.draws} 张。稀有度看的是研究证据，不是检查结果。`,
    input.retest ? '复测窗口里记下了一次复测。' : '复测窗口里还没有新的检查。下次体检可以补上。',
    '下一季等你准备好再开始。',
  ].join('')
}
