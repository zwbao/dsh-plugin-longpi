// 概览, the first tab and the one opened every day: today's check-ins with
// the week at a glance, the two results as small cards, one next step, and at
// most three changes worth a look (the rest are on 指标). One screen.

import React from 'react'
import { NotableChanges } from './changes.ts'
import { todayCounts, useCheckIns } from './checkin.ts'
import { chineseDate } from './format.ts'
import { isDiagnosisName, scrubVisible } from '../ux/plain.ts'
import { Icon } from './icons.ts'
import { retestDates, TodayList } from './plan.ts'
import { ResultsRow, type ResultTarget } from './results.ts'
import type { PageTab, ViewRequest } from './store.ts'
import type { Journey, NextAction, Tracking } from './types.ts'
import { Btn } from './ui.ts'
import { CareCard } from './triage/care-card.ts'
import { InsightCard, ScienceIntro } from './life.ts'
import { coveredByCare } from './overview-facts.ts'
import { stepsLeft } from './onboarding.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

type DayState = 'done' | 'part' | 'missed' | 'unknown'

function addDays(iso: string, days: number): string {
  const at = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

/** The last seven days of the plan's check-ins, pooled over items: all done, some, none, or no record. */
function weekOf(tracking: Tracking | null, today: string): Array<{ date: string; state: DayState }> {
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
  return days.map((date) => {
    const statuses = (tracking?.items ?? []).flatMap((item) => (item.adherence?.calendar ?? []).filter((day) => day.date === date).map((day) => day.status))
    const done = statuses.filter((status) => status === 'done').length
    const missed = statuses.filter((status) => status === 'missed').length
    const state: DayState = done > 0 && done === statuses.length ? 'done' : done > 0 ? 'part' : missed > 0 ? 'missed' : 'unknown'
    return { date, state }
  })
}

const DAY_ZH: Record<DayState, string> = { done: '都完成', part: '部分完成', missed: '没做到', unknown: '没有记录' }

function WeekStrip(props: { tracking: Tracking | null; today: string }): React.ReactElement | null {
  if (!props.tracking) return null
  const week = weekOf(props.tracking, props.today)
  const retest = retestDates(props.tracking)[0]
  const retestText = retest ? (retest.date <= props.today ? `现在可以复测${retest.marker}` : `${chineseDate(retest.date)}可复测${retest.marker}`) : ''
  return h('div', { className: 'lp-week' },
    h('div', { className: 'lp-week-line' },
      h('span', { className: 'lp-caption' }, '本周'),
      h('ol', { className: 'lp-week-cells', 'aria-label': `近 7 天：${week.map((day) => `${chineseDate(day.date)}${DAY_ZH[day.state]}`).join('，')}` },
        ...week.map((day) => h('li', { key: day.date, className: `lp-week-cell lp-week-${day.state}`, title: `${chineseDate(day.date)} ${DAY_ZH[day.state]}` },
          h('span', { className: 'lp-week-day', 'aria-hidden': true }, WEEK_ZH[new Date(`${day.date}T12:00:00Z`).getUTCDay()]))))),
    retestText ? h('p', { className: 'lp-caption' }, retestText) : null)
}

function TodayCard(props: { journey: Journey; tracking: Tracking | null; onNotice: Notify }): React.ReactElement {
  const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice)
  const counts = todayCounts(props.journey)
  return h('section', { className: 'lp-card', id: 'lp-today', 'aria-labelledby': 'lp-today-title' },
    h('div', { className: 'lp-card-head' },
      // 方案第 N 天 is on the page header already (P2-13); the count is written 0/7 everywhere.
      h('h3', { className: 'lp-card-title', id: 'lp-today-title' }, '今天', counts.total > 0 ? h('span', { className: 'lp-caption lp-num' }, `${counts.done}/${counts.total}`) : null)),
    h(TodayList, { journey: props.journey, stateOf, busy, onAnswer: answer }),
    h(WeekStrip, { tracking: props.tracking, today: props.journey.today }))
}

interface Cta {
  label: string
  run: () => void
}

function ctaOf(action: NextAction, props: OverviewProps): Cta | null {
  switch (action) {
    case 'consent':
    case 'profile':
    case 'records':
      return { label: '继续', run: props.openOnboarding }
    case 'addons':
      return { label: '查看加测清单', run: () => props.onAction('addons') }
    case 'plan':
      return { label: '起草方案', run: () => props.goTab('plan') }
    case 'checkin':
      return { label: '记录今天', run: () => props.goTab('overview', { id: 'lp-today' }) }
    case 'review':
      return { label: '看方案效果', run: () => props.goTab('plan') }
    case 'doctor':
      return { label: '看这些指标', run: () => props.goTab('indicators') }
    default:
      return null
  }
}

/** Next steps that are the unfinished setup, which the banner above the tabs already offers (P2-3). */
const SETUP_ACTIONS: readonly NextAction[] = ['consent', 'profile', 'records']

function NextCard(props: OverviewProps): React.ReactElement | null {
  const next = props.journey.next
  if (!next.title_zh && !next.detail_zh) return null
  if (SETUP_ACTIONS.includes(next.action) && stepsLeft(props.journey) > 0) return null
  // 记录今天 is the 今天 card right above: say it once (N3).
  if (next.action === 'checkin' && props.journey.plan.exists) return null
  const cta = ctaOf(next.action, props)
  return h('section', { className: 'lp-card lp-next-card', 'aria-label': '下一步' },
    h('div', { className: 'lp-next-text' },
      h('div', { className: 'lp-caption' }, '下一步'),
      h('h3', { className: 'lp-h3' }, next.title_zh),
      next.detail_zh && next.detail_zh !== next.title_zh ? h('p', { className: 'lp-muted lp-small' }, next.detail_zh) : null),
    cta ? h(Btn, { onClick: cta.run }, cta.label) : null)
}

/** Some reads failed: the missing values are unknown, not "not measured". */
function PartialNote(props: { journey: Journey }): React.ReactElement | null {
  const records = props.journey.records
  if (records.status !== 'partial') return null
  const missing = records.missing_reads.filter((name) => name && !isDiagnosisName(name)).map((name) => scrubVisible(name)).filter(Boolean)
  const errors = records.read_errors.map((line) => scrubVisible(line)).filter(Boolean)
  return h('div', { className: 'lp-callout lp-callout-warn', role: 'note' },
    h(Icon, { name: 'warn', size: 14 }),
    h('span', null,
      `有一部分记录这次没有读到${errors.length > 0 ? `（${errors.slice(0, 2).join('；')}）` : ''}。`,
      missing.length > 0 ? `没读到的指标：${missing.slice(0, 6).join('、')}${missing.length > 6 ? ` 等 ${missing.length} 项` : ''}。` : '',
      '它们不是「没测」，稍后点右上角的刷新再读一次。'))
}

export interface OverviewProps {
  journey: Journey
  tracking: Tracking | null
  onNotice: Notify
  onAction: (target: ResultTarget) => void
  goTab: (tab: PageTab, request?: Omit<ViewRequest, 'tab'>) => void
  openOnboarding: () => void
}

export function Overview(props: OverviewProps): React.ReactElement {
  const { journey } = props
  const doctor = journey.next.action === 'doctor'
  // Each fact once (INT062 fix 7): the values 最重要的一步 is about stay on that card; the rest of 总览 leaves them out.
  const covered = coveredByCare(journey)
  return h('div', { className: 'lp-tab-body' },
    h(PartialNote, { journey }),
    // A value to show a doctor is the top fact: first, before the day's check-ins and the results (M1: with the brief and the visit answers).
    doctor ? h(CareCard, { journey, onNotice: props.onNotice, onIndicators: () => props.goTab('indicators', { filter: 'changed' }), onProfile: props.openOnboarding }) : null,
    h(InsightCard, { journey, covered }),
    journey.plan.exists ? h(TodayCard, { journey, tracking: props.tracking, onNotice: props.onNotice }) : null,
    h(ResultsRow, { journey, tracking: props.tracking, onAction: props.onAction, onNotice: props.onNotice, covered }),
    doctor ? null : h(NextCard, props),
    h(NotableChanges, { journey, covered, onOpenIndicators: () => props.goTab('indicators', { filter: 'changed' }) }),
    // The research invitation waits under the person's own results, and not on a day the top fact is a doctor step.
    doctor ? null : h(ScienceIntro, { goTab: props.goTab }))
}
