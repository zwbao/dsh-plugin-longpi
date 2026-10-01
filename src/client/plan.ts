// The 方案 tab: the person's own plan next to their record. Today's
// check-ins, how well the plan is followed, when to retest, the changes beyond
// normal fluctuation, the timeline, one card per item, each target marker
// against its noise band, the goals and the next steps. With no plan yet, the
// draft. A tracking read that fails shows as such, with a retry.

import React from 'react'
import { AdherenceStrip, datesZh, fmt, fmtAuto, LineChart, Ring, TableTwin, Timeline } from './charts.ts'
import { CheckChoices, todayCounts, useCheckIns } from './checkin.ts'
import { chineseDate, daysBetween, pct } from './format.ts'
import { Goals, minus, NextSteps } from './goals.ts'
import { Icon, VerdictChip } from './icons.ts'
import { PlanDraftCard } from './plan-draft.ts'
import { reload } from './store.ts'
import type { CheckState, Item, Journey, PlanItemRaw, Tracking, Verdict } from './types.ts'
import { Info, LoadError, Section, Skeleton } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void
type Answer = (id: string, title: string, state: CheckState) => void

/** Today's items with their three answers; also the 概览 tab's today card. */
export function TodayList(props: { journey: Journey; stateOf: (id: string) => CheckState; busy: string | null; onAnswer: Answer }): React.ReactElement {
  const items = props.journey.plan.checkin_items
  if (items.length === 0) return h('p', { className: 'lp-small lp-muted lp-measure' }, '今天没有需要亲手记的项目。手环和已经记下的服药会自动算进去。')
  return h('ul', { className: 'lp-today-list' },
    ...items.map((row) => {
      const state = props.stateOf(row.id)
      return h('li', { key: row.id, className: `lp-today-row ${state === true ? 'lp-today-done' : state === false ? 'lp-today-missed' : ''}` },
        h('span', { className: 'lp-today-title' }, row.title),
        h(CheckChoices, { title: row.title, state, busy: props.busy === row.id, onAnswer: (next) => props.onAnswer(row.id, row.title, next) }))
    }))
}

/** Today's progress only: the check-in buttons live once, in the item list below. */
function TodayTile(props: { journey: Journey }): React.ReactElement {
  const counts = todayCounts(props.journey)
  const share = counts.total > 0 ? counts.done / counts.total : 0
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title' }, '今天')),
    counts.total > 0
      ? h('div', { className: 'lp-plan-grow' },
        h('div', { className: 'lp-num-md' }, `${counts.done}/${counts.total}`),
        h('div', {
          className: 'lp-bar', role: 'progressbar', 'aria-label': '今天的打卡', 'aria-valuemin': 0, 'aria-valuemax': counts.total, 'aria-valuenow': counts.done,
        }, h('span', { style: { width: `${Math.round(share * 100)}%` } })),
        h('p', { className: 'lp-caption' }, '在下面的项目里打卡。'))
      : h('p', { className: 'lp-small lp-muted lp-measure' }, '今天没有需要亲手记的项目。手环和已经记下的服药会自动算进去。'))
}

function AdherenceTile(props: { journey: Journey; tracking: Tracking | null }): React.ReactElement {
  const items = props.tracking?.items ?? []
  const known = items.filter((item) => item.adherence && item.adherence.level !== 'unknown' && item.adherence.rate != null)
  const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null
  const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback
  const streak = props.journey.plan.streak || Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0))
  // No record yet: an empty state, not an empty ring and a dash.
  if (rate == null || !Number.isFinite(rate)) {
    return h('div', { className: 'lp-card' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '方案执行')),
      h('div', { className: 'lp-empty' },
        h('div', { className: 'lp-empty-title' }, '还没有执行记录'),
        h('p', { className: 'lp-empty-text' }, '在下面的项目里打卡后，这里显示近 12 周的执行率。')))
  }
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '方案执行')),
    h('div', { className: 'lp-plan-grow' },
      h('div', { className: 'lp-plan-figure-row' },
        h(Ring, { value: rate, label: '方案平均执行率', size: 56 }),
        h('div', null,
          h('div', { className: 'lp-num-md' }, `${Math.round(rate * 100)}%`),
          h('div', { className: 'lp-caption' }, '近 12 周平均')))),
    streak > 1
      ? h('div', { className: 'lp-plan-streak' }, h(Icon, { name: 'flame', size: 14 }), `连续 ${streak} 天`)
      : h('p', { className: 'lp-caption lp-measure' }, '连续完成两天以上会在这里显示'))
}

/** Retest dates as the reminders see them: the earliest date each verdict gives per marker. */
export function retestDates(tracking: Tracking | null): Array<{ marker: string; date: string }> {
  const earliest = new Map<string, string>()
  for (const item of tracking?.items ?? []) {
    for (const row of item.verdicts ?? []) {
      if (!row.next_retest) continue
      const seen = earliest.get(row.marker)
      if (!seen || row.next_retest < seen) earliest.set(row.marker, row.next_retest)
    }
  }
  // Older servers put the dates only in the suggestions.
  if (earliest.size === 0) {
    for (const row of tracking?.suggestions ?? []) if (row.kind === 'retest' && row.date && row.marker && !earliest.has(row.marker)) earliest.set(row.marker, row.date)
  }
  return [...earliest.entries()].map(([marker, date]) => ({ marker, date })).sort((a, b) => a.date.localeCompare(b.date))
}

function RetestTile(props: { tracking: Tracking | null; today: string; failed: boolean }): React.ReactElement {
  const retests = retestDates(props.tracking)
  const upcoming = retests.filter((row) => row.date > props.today)
  const now = retests.filter((row) => row.date <= props.today)
  const first = upcoming[0]
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '下次复测')),
    h('div', { className: 'lp-plan-grow' },
      now.length > 0
        ? h('div', null, h('div', { className: 'lp-h2' }, '现在'), h('div', { className: 'lp-caption' }, `可以复测${now.map((row) => row.marker).slice(0, 3).join('、')}`))
        : first
          ? h('div', null,
            h('div', { className: 'lp-num-md' }, `${daysBetween(props.today, first.date)} 天后`),
            h('div', { className: 'lp-caption' }, `${chineseDate(first.date)}之后 · ${first.marker}`))
          : h('div', null, h('div', { className: 'lp-h2 lp-muted' }, '—'),
            h('div', { className: 'lp-caption' }, props.failed ? '复测日期没有读到' : '方案里的指标还没有排出复测日'))),
    h('p', { className: 'lp-caption lp-measure' }, '复测太早，变化多半只是波动。'))
}

/**
 * Markers that moved toward the goal beyond normal fluctuation. The words never
 * credit an item with the change: several items may run at once, and a change
 * in step with a plan is not proof the plan caused it.
 */
export function Wins(props: { tracking: Tracking | null }): React.ReactElement | null {
  const items = props.tracking?.items ?? []
  if (!props.tracking?.plan) return null
  const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === '有效').map((row) => ({ item, row })))
  if (wins.length === 0) {
    return h('div', { className: 'lp-card' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '还没有超出正常波动的变化')),
      h('p', { className: 'lp-small lp-muted lp-measure' }, '血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。'))
  }
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '朝目标方向、超出正常波动的变化')),
    h('ul', { className: 'lp-rows' },
      ...wins.map(({ item, row }, index) => h('li', { className: 'lp-row lp-plan-win', key: index },
        h('span', { className: 'lp-plan-win-icon' }, h(Icon, { name: 'check', size: 14 })),
        h('div', { className: 'lp-plan-win-text lp-row-main' },
          h('div', { className: 'lp-strong lp-num' }, minus(`${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ''}`)),
          h('p', { className: 'lp-muted lp-measure' },
          minus([`执行「${item.title}」期间`, row.change ? pct(row.change.pct) : '', '超出个体正常波动'].filter(Boolean).join(' · ')),
          (row.combined_with ?? []).length > 0 ? `；同期还在执行${(row.combined_with ?? []).map((name) => `「${name}」`).join('')}，无法区分各自的作用` : ''))))))
}

/** Check-in items not running today (not started, or ended) get no button, as the server leaves them out of today's list. */
function checkinFoot(item: Item, today: string): string | null {
  if (item.start > today) return `${chineseDate(item.start)}开始，到时再打卡`
  if (item.end && item.end < today) return '已结束，不用再打卡'
  return null
}

/** Under 28 days nothing can be judged yet: the list says so once, so the rows carry no per-item 记录不足 or per-marker 无法判断. */
const YOUNG_DAYS = 28

function ItemRow(props: { item: Item; raw?: PlanItemRaw; today: string; onAnswer: Answer; busy: boolean; state: CheckState; checkable: boolean; young: boolean }): React.ReactElement {
  const item = props.item
  const adherence = item.adherence ?? {}
  const source = props.raw?.mirobody ? 'mirobody' : props.raw?.target ? 'wearable' : 'checkin'
  const idle = source === 'checkin' ? checkinFoot(item, props.today) : null
  const rate = adherence.rate
  const known = rate != null && adherence.level !== 'unknown'
  // Young plan: drop only the 「太早」 verdicts the list caption already covers; other reasons (e.g. not enough home readings) stay.
  const verdicts = (item.verdicts ?? []).filter((row) => !(props.young && row.verdict === '无法判断' && /太早/.test(row.reason_zh ?? '')))
  const end = idle
    ? h('span', { className: 'lp-caption' }, idle)
    : source === 'checkin'
      ? props.checkable
        ? h(CheckChoices, { title: item.title, state: props.state, busy: props.busy, onAnswer: (next) => props.onAnswer(item.id, item.title, next) })
        : h('span', { className: 'lp-caption' }, '今天不用打卡')
      : h('span', { className: 'lp-caption' }, source === 'wearable' ? '手环自动记录' : '服用情况在原来的用药记录里')
  return h('li', { className: `lp-row lp-plan-row ${props.state === true ? 'lp-today-done' : ''}` },
    h('div', { className: 'lp-row-main lp-plan-row-main' },
      h('div', { className: 'lp-plan-row-title' }, item.title),
      h('div', { className: 'lp-tags' },
        item.category_zh ? h('span', { className: 'lp-tag' }, item.category_zh) : null,
        item.headline && !(props.young && item.headline === '无法判断') ? h(VerdictChip, { verdict: item.headline }) : null,
        h('span', { className: 'lp-caption' }, `${chineseDate(item.start)}起 · 第 ${item.days ?? 0} 天`),
        known ? h('span', { className: 'lp-caption lp-num' }, `近 12 周执行 ${Math.round((rate as number) * 100)}%`) : null),
      known && (adherence.calendar ?? []).length > 0 ? h(AdherenceStrip, { calendar: adherence.calendar ?? [], label: item.title }) : null,
      !known && !props.young ? h('p', { className: 'lp-caption lp-measure' }, `近 12 周执行：记录不足${adherence.note_zh ? `。${adherence.note_zh}` : ''}`) : null,
      ...verdicts.map((row, index) => h('div', { className: 'lp-plan-verdict', key: index },
        h('div', { className: 'lp-plan-verdict-head' },
          h(VerdictChip, { verdict: row.verdict }),
          h('span', { className: 'lp-strong' }, row.marker),
          row.baseline && row.followup ? h('span', { className: 'lp-num' }, minus(`${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ''}${row.change ? `（${pct(row.change.pct)}）` : ''}`)) : null),
        row.reason_zh ? h('p', { className: 'lp-caption lp-measure' }, datesZh(row.reason_zh)) : null,
        (row.expected ?? []).length > 0 ? h('details', null,
          h('summary', null, '试验里平均能改变多少'),
          ...(row.expected ?? []).map((line) => h('p', { key: line.id, className: 'lp-caption lp-measure' },
            line.text_zh,
            line.comparison && line.comparison !== 'not_comparable' ? `你的变化${({ consistent: '与试验平均一致', smaller: '小于试验平均', larger: '大于试验平均', opposite: '方向与试验相反' } as Record<string, string>)[line.comparison] ?? ''}。` : '',
            ` doi:${line.doi}`))) : null))),
    h('div', { className: 'lp-plan-row-end' }, end))
}

/** Stage plan, next to the draft: the person may bring their own plan instead. */
function PlanStart(props: { journey: Journey; onPrompt: (text: string) => void }): React.ReactElement {
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '已经有自己的方案？')),
    h('p', { className: 'lp-text lp-muted' }, '说出你的方案，或上传医生、长寿师给的方案。LongPi 会读给你确认后保存，再按每个指标安排复测日，并算出达到目标时的模型估计。'),
    props.journey.suggestions.length > 0 ? h('div', { className: 'lp-stack' },
      ...props.journey.suggestions.map((row) => h('button', { key: row.id, type: 'button', className: 'lp-row-btn', onClick: () => props.onPrompt(row.text_zh) },
        h('span', { className: 'lp-row-main' }, row.text_zh), h(Icon, { name: 'chevron', size: 14 })))) : null,
    h('p', { className: 'lp-caption lp-measure' }, 'LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。'))
}

export function PlanSection(props: {
  journey: Journey
  tracking: Tracking | null
  loading: boolean
  error: string | null
  onNotice: Notify
  onPrompt: (text: string) => void
  onOpenPlanTab?: () => void
}): React.ReactElement {
  const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice)
  const tracking = props.tracking
  const today = props.journey.today
  if (!props.journey.plan.exists && !tracking?.plan) {
    return h('div', { className: 'lp-stack', id: 'lp-plan' },
      h(PlanDraftCard, { journey: props.journey, onNotice: props.onNotice, onPrompt: props.onPrompt }),
      h(PlanStart, { journey: props.journey, onPrompt: props.onPrompt }))
  }
  if (props.loading && !tracking) {
    return h('div', { className: 'lp-stack', id: 'lp-plan', 'aria-busy': true }, h(Skeleton, { height: 260, className: 'lp-card-skeleton' }))
  }
  const failed = !tracking && props.error != null
  const plan = tracking?.plan
  const items = tracking?.items ?? []
  const checkups = [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))]
  const todayIds = new Set(props.journey.plan.checkin_items.map((row) => row.id))
  const days = props.journey.plan.days ?? (items.length > 0 ? Math.max(...items.map((item) => item.days ?? 0)) : null)
  const young = days != null && days < YOUNG_DAYS
  const firstRetest = retestDates(tracking ?? null).find((row) => row.date > today)?.date ?? null
  const meta = [
    `第 ${plan?.version ?? props.journey.plan.version ?? 1} 版`,
    `${items.length || props.journey.plan.items} 项`,
    props.journey.plan.started ? `${chineseDate(props.journey.plan.started)}起` : '',
    days != null ? `第 ${days} 天` : '',
  ].filter(Boolean).join(' · ')
  return h('div', { className: 'lp-stack', id: 'lp-plan' },
    failed ? h(LoadError, { what: '方案的执行记录和评判', error: props.error, onRetry: () => reload('tracking') }) : null,
    h('div', { className: 'lp-plan-tiles' },
      h(TodayTile, { journey: props.journey }),
      h(AdherenceTile, { journey: props.journey, tracking }),
      h(RetestTile, { tracking, today, failed })),
    h(Wins, { tracking }),
    // The plan's name and version live on the timeline card: the tab itself has no page header.
    h('div', { className: 'lp-card' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title' }, plan?.title || props.journey.plan.title || '时间线'),
        h('span', { className: 'lp-caption' }, meta)),
      items.length > 0
        ? h(Timeline, {
          items: items.map((item) => ({ id: item.id, title: item.title, start: item.start, end: item.end ?? null, subtitle: `${chineseDate(item.start)}起，第 ${item.days ?? 0} 天`, headline: item.headline ?? '' })),
          checkups, today,
        })
        : h('p', { className: 'lp-small lp-muted lp-measure' }, failed ? '方案的项目没有读到。' : '方案里还没有项目。')),
    items.length > 0 ? h('section', { className: 'lp-card', 'aria-labelledby': 'lp-plan-items-title' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title', id: 'lp-plan-items-title' }, '方案项目'),
        h('span', { className: 'lp-caption' }, '完成 / 没做到 记在这里，点错了可以撤销')),
      young ? h('p', { className: 'lp-caption lp-measure' }, `方案开始才 ${days ?? 0} 天。执行率和指标变化要满 ${YOUNG_DAYS} 天才能判断${firstRetest ? `，${chineseDate(firstRetest)}之后再看` : ''}。`) : null,
      h('ul', { className: 'lp-rows' },
        ...items.map((item) => h(ItemRow, {
          key: item.id, item, raw: plan?.items.find((raw) => raw.id === item.id), today, onAnswer: answer, busy: busy === item.id,
          state: stateOf(item.id), checkable: todayIds.has(item.id), young,
        })))) : null)
}

/** The whole 方案 tab. */
export function PlanTab(props: {
  journey: Journey
  tracking: Tracking | null
  loading: boolean
  error: string | null
  onNotice: Notify
  onPrompt: (text: string) => void
}): React.ReactElement {
  return h('div', { className: 'lp-tab-body' },
    h(PlanSection, props),
    h(Markers, { tracking: props.tracking }),
    h(Goals, { tracking: props.tracking }),
    h(NextSteps, { tracking: props.tracking }))
}

export function Markers(props: { tracking: Tracking | null }): React.ReactElement | null {
  const charts = props.tracking?.charts ?? []
  if (charts.length === 0) return null
  const verdictOf = (indicator: string): Verdict | undefined => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? [])
    .find((row) => row.indicator === indicator && row.verdict !== '无法判断')
  return h(Section, {
    id: 'lp-markers', title: '方案相关的指标',
    aside: h(Info, { label: '图上的浅色带', align: 'end' }, '浅色带是以基线为中心的平常起伏。落在带外才值得注意；带里的起伏多半不算数。'),
  },
    h('div', { className: 'lp-grid-2' },
      ...charts.map((chart) => {
        const verdict = verdictOf(chart.indicator)
        const digits = Math.max(...chart.points.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
        return h('figure', { className: 'lp-card lp-plan-chart', key: chart.indicator },
          h('div', { className: 'lp-card-head' },
            h('figcaption', { className: 'lp-card-title' }, chart.label, chart.unit ? h('span', { className: 'lp-caption' }, chart.unit) : null)),
          verdict ? h('div', { className: 'lp-tags' }, h(VerdictChip, { verdict: verdict.verdict })) : null,
          h(LineChart, {
            points: chart.points, unit: chart.unit, label: chart.label, height: 150, digits,
            band: chart.band ? { low: chart.band.low, high: chart.band.high, from: chart.band.base_date } : null,
            goal: chart.goal ?? null,
            weekly: chart.weekly === true,
          }),
          h('p', { className: 'lp-caption lp-measure' }, chart.band
            ? `浅色带：以 ${chineseDate(chart.band.base_date)}的 ${fmt(chart.band.base, 2)} 为基线的正常波动${chart.band.verified === false ? '（变异数据待核对）' : ''}。`
            : '缺少这项的个体变异数据，分不清真实变化和波动。'),
          h(TableTwin, { caption: `${chart.label}（${chart.unit}）`, head: ['日期', '数值'], rows: chart.points.map((point) => [chart.weekly ? `${chineseDate(point.date)}起一周` : chineseDate(point.date), fmt(point.value, digits)]) }))
      })))
}
