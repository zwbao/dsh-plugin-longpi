// The person's own plan next to their record: today's check-ins, how well the
// plan is followed, when to retest, what really improved, the timeline, one
// card per item and each target marker against its noise band.

import React from 'react'
import { errorText, postJson } from './api.ts'
import { AdherenceStrip, fmt, fmtAuto, LineChart, Ring, TableTwin, Timeline } from './charts.ts'
import { chineseDate, daysBetween, pct } from './format.ts'
import { Icon, VerdictChip } from './icons.ts'
import { notifyChanged } from './store.ts'
import type { Item, Journey, PlanItemRaw, Tracking, Verdict } from './types.ts'
import { Btn, Section, Skeleton } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

/** Check-ins are shared by the today tile and the item cards, so both flip at once. */
export function useCheckIn(onNotice: Notify): { done: Set<string>; busy: string | null; checkIn: (id: string, title: string) => void } {
  const [done, setDone] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState<string | null>(null)
  const checkIn = React.useCallback((id: string, title: string) => {
    setBusy(id)
    postJson('/api/longpi/checkin', { item: id, done: true })
      .then(() => {
        setDone((current) => new Set(current).add(id))
        onNotice(`已记下：${title}，今天完成。`, 'good')
        notifyChanged()
      })
      .catch((err: unknown) => onNotice(`没有记下：${errorText(err, '请稍后再试')}`, 'bad'))
      .finally(() => setBusy(null))
  }, [onNotice])
  return { done, busy, checkIn }
}

function TodayTile(props: { journey: Journey; done: Set<string>; busy: string | null; onCheckIn: (id: string, title: string) => void }): React.ReactElement {
  const items = props.journey.plan.checkin_items
  const finished = items.filter((row) => row.done_today || props.done.has(row.id)).length
  return h('div', { className: 'lp-card lp-tile lp-tile-today' },
    h('div', { className: 'lp-tile-head' },
      h('div', { className: 'lp-label' }, '今天'),
      items.length > 0 ? h('span', { className: 'lp-caption' }, `${finished}/${items.length} 完成`) : null),
    items.length === 0
      ? h('p', { className: 'lp-muted' }, '今天没有需要打卡的项目，手环和 Mirobody 记录的会自动计入。')
      : h('ul', { className: 'lp-today-list' },
        ...items.map((row) => {
          const isDone = row.done_today || props.done.has(row.id)
          return h('li', { key: row.id, className: `lp-today-row ${isDone ? 'lp-today-done' : ''}` },
            h('span', { className: 'lp-today-title' }, row.title),
            isDone
              ? h('span', { className: 'lp-done-label' }, h(Icon, { name: 'check', size: 14 }), '已完成')
              : h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy === row.id, onClick: () => props.onCheckIn(row.id, row.title) },
                props.busy === row.id ? '记录中' : '今天完成了'))
        })),
    h('p', { className: 'lp-fine' }, '也可以在对话里说一句“今天的方案我都完成了”。'))
}

function AdherenceTile(props: { journey: Journey; tracking: Tracking | null }): React.ReactElement {
  const items = props.tracking?.items ?? []
  const known = items.filter((item) => item.adherence && item.adherence.level !== 'unknown' && item.adherence.rate != null)
  const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null
  const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback
  const streak = props.journey.plan.streak || Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0))
  return h('div', { className: 'lp-card lp-tile' },
    h('div', { className: 'lp-label' }, '方案执行'),
    h('div', { className: 'lp-tile-row' },
      h(Ring, { value: rate, label: '方案平均执行率', size: 56 }),
      h('div', null,
        h('div', { className: 'lp-tile-figure' }, rate == null ? '—' : `${Math.round(rate * 100)}%`),
        h('div', { className: 'lp-caption' }, rate == null ? '还没有执行记录' : '近 12 周平均'))),
    streak > 1
      ? h('div', { className: 'lp-streak' }, h(Icon, { name: 'flame', size: 15 }), `连续 ${streak} 天`)
      : h('div', { className: 'lp-caption lp-streak-empty' }, '连续完成两天以上会在这里显示'))
}

/** Retest dates as the reminders see them: the earliest date each verdict gives per marker. */
function retestDates(tracking: Tracking | null): Array<{ marker: string; date: string }> {
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

function RetestTile(props: { tracking: Tracking | null; today: string }): React.ReactElement {
  const retests = retestDates(props.tracking)
  const upcoming = retests.filter((row) => row.date > props.today)
  const now = retests.filter((row) => row.date <= props.today)
  const first = upcoming[0]
  return h('div', { className: 'lp-card lp-tile' },
    h('div', { className: 'lp-label' }, '下次复测'),
    now.length > 0
      ? h('div', null, h('div', { className: 'lp-tile-figure' }, '现在'), h('div', { className: 'lp-caption' }, `可以复测${now.map((row) => row.marker).slice(0, 3).join('、')}`))
      : first
        ? h('div', null,
          h('div', { className: 'lp-tile-figure' }, `${daysBetween(props.today, first.date)} 天后`),
          h('div', { className: 'lp-caption' }, `${chineseDate(first.date)}之后 · ${first.marker}`))
        : h('div', null, h('div', { className: 'lp-tile-figure lp-muted-ink' }, '—'), h('div', { className: 'lp-caption' }, '保存方案后按指标排复测日')),
    h('p', { className: 'lp-fine' }, h(Icon, { name: 'calendar', size: 13 }), ' 复测太早，变化多半只是波动。'))
}

export function Wins(props: { tracking: Tracking | null }): React.ReactElement | null {
  const items = props.tracking?.items ?? []
  if (!props.tracking?.plan) return null
  const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === '有效').map((row) => ({ item, row })))
  if (wins.length === 0) {
    return h('div', { className: 'lp-card lp-wins lp-wins-empty' },
      h('span', { className: 'lp-win-icon lp-win-icon-quiet' }, h(Icon, { name: 'spark', size: 16 })),
      h('div', null,
        h('div', { className: 'lp-strong' }, '还没有超出波动的改善'),
        h('div', { className: 'lp-muted' }, '血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。')))
  }
  return h('div', { className: 'lp-card lp-wins' },
    h('div', { className: 'lp-label' }, '真实的改善'),
    ...wins.map(({ item, row }, index) => h('div', { className: 'lp-win', key: index, style: { animationDelay: `${index * 80}ms` } },
      h('span', { className: 'lp-win-icon' }, h(Icon, { name: 'check', size: 16 })),
      h('div', null,
        h('div', { className: 'lp-strong' }, `${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ''}`),
        h('div', { className: 'lp-muted' },
          `${item.title} · ${row.change ? pct(row.change.pct) : ''} · 超出个体正常波动`,
          (row.combined_with ?? []).length > 0 ? `（与${(row.combined_with ?? []).join('、')}共同作用）` : '')))))
}

/** Check-in items not running today (not started, or ended) get no button, as the server leaves them out of today's list. */
function checkinFoot(item: Item, today: string): string | null {
  if (item.start > today) return `${chineseDate(item.start)}开始，到时再打卡`
  if (item.end && item.end < today) return '已结束，不用再打卡'
  return null
}

function ItemCard(props: { item: Item; raw?: PlanItemRaw; today: string; onCheckIn: (id: string, title: string) => void; busy: boolean; done: boolean }): React.ReactElement {
  const item = props.item
  const adherence = item.adherence ?? {}
  const source = props.raw?.mirobody ? 'mirobody' : props.raw?.target ? 'wearable' : 'checkin'
  const idle = source === 'checkin' ? checkinFoot(item, props.today) : null
  const rate = adherence.rate
  return h('article', { className: 'lp-card lp-item' },
    h('div', { className: 'lp-item-head' },
      h('div', null,
        item.category_zh ? h('span', { className: 'lp-cat' }, item.category_zh) : null,
        h('h3', { className: 'lp-h3' }, item.title),
        h('div', { className: 'lp-caption' }, `${item.start} 起 · 第 ${item.days ?? 0} 天`)),
      item.headline ? h(VerdictChip, { verdict: item.headline }) : null),
    h('div', { className: 'lp-item-adherence' },
      h('div', null,
        h('div', { className: 'lp-caption' }, '近 12 周执行'),
        h('div', { className: 'lp-item-figure' }, rate == null || adherence.level === 'unknown' ? '记录不足' : `${Math.round(rate * 100)}%`),
        adherence.note_zh ? h('div', { className: 'lp-fine lp-fine-tight' }, adherence.note_zh) : null),
      (adherence.calendar ?? []).length > 0 ? h(AdherenceStrip, { calendar: adherence.calendar ?? [], label: item.title }) : null),
    ...(item.verdicts ?? []).map((row, index) => h('div', { className: 'lp-verdict', key: index },
      h('div', { className: 'lp-verdict-head' },
        h(VerdictChip, { verdict: row.verdict }),
        h('span', { className: 'lp-strong' }, row.marker),
        row.baseline && row.followup ? h('span', { className: 'lp-num' }, `${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ''}${row.change ? `（${pct(row.change.pct)}）` : ''}`) : null),
      h('p', { className: 'lp-reason' }, row.reason_zh ?? ''),
      (row.expected ?? []).length > 0 ? h('details', { className: 'lp-expected' },
        h('summary', null, '试验里平均能改变多少'),
        ...(row.expected ?? []).map((line) => h('p', { key: line.id, className: 'lp-fine' },
          line.text_zh,
          line.comparison && line.comparison !== 'not_comparable' ? `你的变化${({ consistent: '与试验平均一致', smaller: '小于试验平均', larger: '大于试验平均', opposite: '方向与试验相反' } as Record<string, string>)[line.comparison] ?? ''}。` : '',
          ` doi:${line.doi}`))) : null)),
    h('div', { className: 'lp-item-foot' },
      idle ? h('span', { className: 'lp-caption' }, idle)
      : source === 'checkin'
        ? props.done
          ? h('span', { className: 'lp-done-label lp-pop' }, h(Icon, { name: 'check', size: 14 }), '今天已完成')
          : h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy, onClick: () => props.onCheckIn(item.id, item.title) }, h(Icon, { name: 'check', size: 14 }), '今天完成了')
        : h('span', { className: 'lp-caption' }, source === 'wearable' ? '手环自动记录，不用打卡' : '服用情况在 Mirobody 里打卡')))
}

/** Stage plan: nothing saved yet. LongPi never proposes items; the person brings their own. */
function PlanStart(props: { journey: Journey; onPrompt: (text: string) => void }): React.ReactElement {
  return h('div', { className: 'lp-card lp-plan-start' },
    h('div', { className: 'lp-plan-start-text' },
      h('h3', { className: 'lp-h3' }, '想先改善哪一项？'),
      h('p', { className: 'lp-muted' }, '说出你的方案，或上传医生、长寿师给的方案。LongPi 会读给你确认后保存，再按每个指标安排复测日，并算出达到目标时的模型估计。'),
      h('p', { className: 'lp-fine' }, 'LongPi 不替你制定方案，也不建议开始、停止或调整任何药物、补剂和剂量。')),
    h('div', { className: 'lp-prompts' },
      ...props.journey.suggestions.map((row) => h('button', { key: row.id, type: 'button', className: 'lp-prompt', onClick: () => props.onPrompt(row.text_zh) },
        h('span', null, row.text_zh), h(Icon, { name: 'arrow', size: 14 })))))
}

export function PlanSection(props: {
  journey: Journey
  tracking: Tracking | null
  loading: boolean
  onNotice: Notify
  onPrompt: (text: string) => void
}): React.ReactElement {
  const { done, busy, checkIn } = useCheckIn(props.onNotice)
  const tracking = props.tracking
  const today = props.journey.today
  if (!props.journey.plan.exists && !tracking?.plan) {
    return h(Section, { id: 'lp-plan', title: '我的方案', kicker: '干预' }, h(PlanStart, { journey: props.journey, onPrompt: props.onPrompt }))
  }
  if (props.loading && !tracking) {
    return h(Section, { id: 'lp-plan', title: props.journey.plan.title || '我的方案', kicker: '我的方案' }, h(Skeleton, { height: 260 }))
  }
  const plan = tracking?.plan
  const items = tracking?.items ?? []
  const checkups = [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))]
  const doneIds = new Set([...done, ...props.journey.plan.checkin_items.filter((row) => row.done_today).map((row) => row.id)])
  const days = props.journey.plan.days
  return h(Section, {
    id: 'lp-plan',
    title: plan?.title || props.journey.plan.title,
    kicker: `我的方案 · 第 ${plan?.version ?? props.journey.plan.version ?? 1} 版`,
    aside: h('span', { className: 'lp-caption' }, [
      `${items.length || props.journey.plan.items} 项`,
      props.journey.plan.started ? `${chineseDate(props.journey.plan.started)}起` : '',
      days != null ? `第 ${days} 天` : '',
    ].filter(Boolean).join(' · ')),
  },
  h('div', { className: 'lp-tiles' },
    h(TodayTile, { journey: props.journey, done, busy, onCheckIn: checkIn }),
    h(AdherenceTile, { journey: props.journey, tracking }),
    h(RetestTile, { tracking, today })),
  h(Wins, { tracking }),
  items.length > 0 ? h('div', { className: 'lp-card lp-timeline-card' },
    h('div', { className: 'lp-label' }, '时间线'),
    h(Timeline, {
      items: items.map((item) => ({ id: item.id, title: item.title, start: item.start, end: item.end ?? null, subtitle: `${item.start} 起，第 ${item.days ?? 0} 天`, headline: item.headline ?? '' })),
      checkups, today,
    })) : null,
  items.length > 0 ? h('div', { className: 'lp-grid-items' },
    ...items.map((item) => h(ItemCard, {
      key: item.id, item, raw: plan?.items.find((raw) => raw.id === item.id), today, onCheckIn: checkIn, busy: busy === item.id, done: doneIds.has(item.id),
    }))) : null)
}

export function Markers(props: { tracking: Tracking | null }): React.ReactElement | null {
  const charts = props.tracking?.charts ?? []
  if (charts.length === 0) return null
  const verdictOf = (indicator: string): Verdict | undefined => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? [])
    .find((row) => row.indicator === indicator && row.verdict !== '无法判断')
  return h(Section, { id: 'lp-markers', title: '指标变化', kicker: '对照正常波动' },
    h('div', { className: 'lp-grid-charts' },
      ...charts.map((chart) => {
        const verdict = verdictOf(chart.indicator)
        const digits = Math.max(...chart.points.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
        return h('figure', { className: 'lp-card lp-figure', key: chart.indicator },
          h('div', { className: 'lp-figure-head' },
            h('figcaption', null, h('span', { className: 'lp-strong' }, chart.label), h('span', { className: 'lp-caption' }, ` ${chart.unit}`)),
            verdict ? h(VerdictChip, { verdict: verdict.verdict }) : null),
          h(LineChart, {
            points: chart.points, unit: chart.unit, label: chart.label, height: 150, digits,
            band: chart.band ? { low: chart.band.low, high: chart.band.high, from: chart.band.base_date } : null,
            goal: chart.goal ?? null,
          }),
          h('p', { className: 'lp-fine' }, chart.band
            ? `浅色带：以 ${chart.band.base_date} 的 ${fmt(chart.band.base, 2)} 为基线的正常波动范围${chart.band.verified === false ? '（变异数据待核对）' : ''}。落在带外才算真实变化。`
            : '缺少这项的个体变异数据，分不清真实变化和波动。'),
          h(TableTwin, { caption: `${chart.label}（${chart.unit}）`, head: ['日期', '数值'], rows: chart.points.map((point) => [point.date, fmt(point.value, digits)]) }))
      })))
}
