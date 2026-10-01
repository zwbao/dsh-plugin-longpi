// 指标: every checkup value and wearable series the record holds, grouped by
// body system, each with its latest value, its trend, and how its last change
// compares with normal within-person fluctuation. A row opens a panel with
// every value, the report it came from and the source of the band. A series
// that could not be read says so; it is never shown as "no data".

import React from 'react'
import { getJson, errorText } from './api.ts'
import { dateZh, datesZh, fmt, fmtAuto, LineChart, TableTwin } from './charts.ts'
import { prettyUnits } from './changes.ts'
import { Icon } from './icons.ts'
import { normalizeIndicatorDetail } from './normalize.ts'
import { reload, requestView, useIndicators, type IndicatorFilter } from './store.ts'
import { judgementKind, judgementText, lifeAreaOf, movementOf, scrubVisible, sourceLabel, type JudgementKey, type LifeArea } from '../ux/plain.ts'
import type { IndicatorDetail, IndicatorRow, IndicatorsResponse, IndicatorSource } from './types.ts'
import { Btn, Info, LoadError, Skeleton } from './ui.ts'

const h = React.createElement

const SOURCE_ZH: Record<IndicatorSource, string> = { checkup: '体检', device: '手环', self: '自测' }

/** Names as typeset Chinese: no space hugging a full-width bracket (「比（尿） UACR」 → 「比（尿）UACR」). */
export function cleanLabel(text: string): string {
  return text.replace(/\s+([（【「])/g, '$1').replace(/([）】」])\s+/g, '$1')
}

/** Units as printed on a lab sheet: μ for micro (uIU/mL → μIU/mL, umol/L → μmol/L). */
function unitText(unit: string | undefined): string {
  return prettyUnits(unit ?? '').replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, '$1μ$2')
}

/** A value and its unit: 「62%」 with no space before %, 「3.8 mmol/L」 otherwise. */
function withUnit(value: string, unit: string): string {
  if (!unit) return value
  return unit === '%' || unit.startsWith('%') ? `${value}${unit}` : `${value} ${unit}`
}

/** Sentences from the movement helper: ISO dates as 「9 月 10 日」, micro units, no space before %. */
function tidy(text: string): string {
  return datesZh(unitText(text)).replace(/(\d) %/g, '$1%')
}

/** The chip already says 太早. The caption keeps the rest of the sentence once, never a second 太早 or a noise line. */
function reasonBesideChip(gate: string | undefined, reason: string | undefined): string {
  const text = (reason ?? '').trim()
  if (!text) return ''
  if (gate === 'too_early' || text.startsWith('太早')) return text.replace(/^太早[：:]?\s*/, '')
  return text
}

function noiseSentence(detail: IndicatorDetail): string | null {
  const { row, biovar } = detail
  if (!biovar) return null
  const tooEarly = row.gate === 'too_early' || (row.reason_zh ?? '').startsWith('太早')
  const beyond = row.judged === 'changed'
  if (tooEarly || beyond) return null
  return `正常波动：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（个体内变异 ${fmt(biovar.cvi_pct, 1)}%）。两次结果之差在这个范围内，多半是测量和生理波动。`
}

const FILTERS: Array<{ key: IndicatorFilter; label: string; test: (row: IndicatorRow) => boolean }> = [
  { key: 'all', label: '全部', test: () => true },
  { key: 'changed', label: '有变化', test: (row) => row.judged === 'changed' },
  { key: 'plan', label: '方案相关', test: (row) => row.plan_marker },
  { key: 'device', label: '手环', test: (row) => row.source === 'device' },
]

/** A trend in 88 × 24: the line and the latest point, no axes (the panel has the full chart). Fewer than two values: 「—」. */
function Sparkline(props: { points: Array<{ date: string; value: number }>; label: string }): React.ReactElement | null {
  const points = props.points
  if (points.length < 2) return h('span', { className: 'lp-caption', title: points.length === 1 ? '只有 1 次结果' : '没有数值' }, '—')
  const width = 88
  const height = 24
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) * 0.1 || 1
  const x = (index: number) => 3 + (index / (points.length - 1)) * (width - 6)
  const y = (value: number) => height - 3 - ((value - min) / span) * (height - 6)
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join('')
  const last = points.at(-1) as { value: number }
  return h('svg', { width, height, className: 'lp-spark', role: 'img', 'aria-label': `${props.label}趋势：${points.map((point) => `${dateZh(point.date)} ${fmtAuto(point.value)}`).join('，')}` },
    h('path', { d: path, className: 'lp-spark-line' }),
    h('circle', { cx: x(points.length - 1), cy: y(last.value), r: 2.5, className: 'lp-spark-dot' }))
}

/** The 「和正常波动比」 cell: a short badge; the full sentence is its tooltip (the toolbar ⓘ explains every word). */
export function JudgedChip(props: { row: IndicatorRow; gate?: string; reason?: string }): React.ReactElement {
  const { row } = props
  const reason = props.reason ?? ''
  if (row.range_flag === 'low' || row.range_flag === 'high') {
    const low = row.range_flag === 'low'
    return h('span', { className: 'lp-badge lp-badge-warn', title: row.range_zh || (low ? '低于参考范围' : '高于参考范围') }, low ? '偏低' : '偏高')
  }
  const kind: JudgementKey = judgementKind({ gate: props.gate, judged: row.judged, reason })
  const full = judgementText(kind, true)
  if (kind === 'beyond') {
    const tone = row.change?.verdict === 'better' && !row.change.ask_doctor ? 'good' : row.change && row.change.verdict === 'unclear' && !row.change.ask_doctor ? 'neutral' : 'warn'
    return h('span', { className: `lp-badge lp-badge-${tone}`, title: full }, judgementText(kind, false))
  }
  if (kind === 'within') return h('span', { className: 'lp-badge lp-badge-good', title: full }, judgementText(kind, false))
  if (kind === 'unjudged') {
    // No judgement is shown as 「—」; the reason stays in the tooltip and the detail panel.
    const why = row.read_error ? '这项没有读到' : row.points.length < 2 ? '只有一次结果，还不能下结论' : '还缺比较要用的信息，还不能下结论'
    return h('span', { className: 'lp-caption', title: why, 'aria-label': judgementText(kind, false) }, '—')
  }
  return h('span', { className: 'lp-caption', title: reason || full }, judgementText(kind, false))
}

function latestText(row: IndicatorRow): string {
  if (!row.latest) return '—'
  if (row.latest.text) return row.latest.text
  return row.latest.value == null ? '—' : fmtAuto(row.latest.value)
}

function panelSlug(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_')
}

/** One table row: name | latest value + date | trend | vs normal fluctuation | source | chevron. Every cell always has content. */
function IndicatorLine(props: { row: IndicatorRow; open: boolean; onToggle: () => void; gate?: string; reason?: string }): React.ReactElement {
  const { row } = props
  const slug = panelSlug(row.id)
  const missed = row.read_error ? scrubVisible(row.read_error).replace(/没有在 \d+ 秒内返回这一项/, '这次没有读到，稍后刷新再看') : ''
  const unit = unitText(row.unit)
  const when = row.latest ? dateZh(row.latest.date) : ''
  return h('li', { className: `lp-ind-row ${props.open ? 'lp-ind-open' : ''}` },
    h('button', { type: 'button', className: 'lp-ind-btn', 'aria-expanded': props.open, 'aria-controls': `lp-ind-panel-${slug}`, onClick: props.onToggle },
      h('span', { className: 'lp-ind-name' },
        h('span', { className: 'lp-ind-label', title: cleanLabel(row.label_zh) }, cleanLabel(row.label_zh)),
        row.plan_marker ? h('span', { className: 'lp-tag' }, '方案') : null),
      missed
        ? h('span', { className: 'lp-ind-value' }, h('span', { className: 'lp-ind-error', title: missed }, h(Icon, { name: 'warn', size: 12 }), '没有读到'))
        : h('span', { className: 'lp-ind-value' },
          // 「5.8%」: a percent sign belongs to the number, never a gap before it.
          h('span', { className: 'lp-ind-num' }, unit.startsWith('%') ? `${latestText(row)}${unit}` : latestText(row)),
          h('span', { className: 'lp-ind-unit' }, unit.startsWith('%') ? '' : unit)),
      h('span', { className: 'lp-ind-date lp-caption' }, missed || !when ? '—' : when),
      h('span', { className: 'lp-ind-spark' }, missed ? h('span', { className: 'lp-caption' }, '—') : h(Sparkline, { points: row.points, label: row.label_zh })),
      h('span', { className: 'lp-ind-judged' }, missed ? h('span', { className: 'lp-caption' }, '—') : h(JudgedChip, { row, gate: props.gate, reason: props.reason })),
      h('span', { className: 'lp-ind-source' }, SOURCE_ZH[row.source] ?? '—'),
      h(Icon, { name: 'chevron', size: 14, className: 'lp-ind-chevron' })),
    props.open ? h(DetailPanel, { row, slug }) : null)
}

function DetailPanel(props: { row: IndicatorRow; slug: string }): React.ReactElement {
  const [state, setState] = React.useState<{ detail: IndicatorDetail | null; error: string | null; loading: boolean }>({ detail: null, error: null, loading: true })
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let live = true
    setState((current) => ({ ...current, loading: true, error: null }))
    getJson<unknown>(`/api/longpi/indicators/detail?id=${encodeURIComponent(props.row.id)}`)
      .then((raw) => { if (live) setState({ detail: normalizeIndicatorDetail(raw), error: null, loading: false }) })
      .catch((err: unknown) => { if (live) setState({ detail: null, error: errorText(err, '请稍后再试'), loading: false }) })
    return () => { live = false }
  }, [props.row.id, attempt])
  const body = state.loading && !state.detail
    ? h(Skeleton, { height: 120 })
    : !state.detail
      ? h(LoadError, { what: `${props.row.label_zh}的历次数值`, error: state.error, compact: true, onRetry: () => setAttempt((count) => count + 1) })
      : h(DetailBody, { detail: state.detail })
  return h('div', { className: 'lp-ind-panel', id: `lp-ind-panel-${props.slug}`, role: 'region', 'aria-label': `${props.row.label_zh}详情` }, body)
}

function DetailBody(props: { detail: IndicatorDetail }): React.ReactElement {
  const { row, all_points: points, biovar } = props.detail
  const numeric = points.filter((point): point is typeof point & { value: number } => point.value != null)
  const digits = Math.max(...numeric.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
  const units = [...new Set(points.map((point) => point.unit).filter(Boolean))]
  const move = movementOf(numeric.map((point) => ({ date: point.date, value: point.value })), unitText(units[0] ?? row.unit))
  return h('div', { className: 'lp-ind-detail' },
    move ? h('p', { className: 'lp-small lp-num' }, tidy(move.lead)) : null,
    row.read_error ? h('p', { className: 'lp-blocker lp-blocker-bad' }, `这项这次没有读到：${row.read_error}。下面是能读到的部分。`) : null,
    row.change?.text_zh ? h('p', { className: 'lp-muted' }, tidy(row.change.text_zh)) : null,
    numeric.length > 1 && units.length <= 1
      ? h(LineChart, { points: numeric.map((point) => ({ date: point.date, value: point.value })), unit: unitText(units[0] ?? row.unit), label: row.label_zh, height: 150, digits })
      : null,
    row.range_zh ? h('p', { className: 'lp-caption' }, tidy(row.range_zh)) : null,
    noiseSentence(props.detail)
      ? h('p', { className: 'lp-caption' },
        noiseSentence(props.detail),
        biovar?.source.url ? h(React.Fragment, null, ' 来源：', h('a', { href: biovar.source.url, target: '_blank', rel: 'noopener noreferrer', title: biovar.source.title || undefined }, sourceLabel(biovar.source.title))) : biovar?.source.title ? ` 来源：${sourceLabel(biovar.source.title)}` : '',
        biovar?.source.doi ? ` · doi:${biovar.source.doi}` : '')
      : biovar && (row.gate === 'too_early' || (row.reason_zh ?? '').startsWith('太早'))
        ? h('p', { className: 'lp-caption' }, reasonBesideChip(row.gate, row.reason_zh) || '间隔还没到这项的最短复测时间。')
        : biovar && row.judged === 'changed'
          ? h('p', { className: 'lp-caption' }, '两次结果之差超出了上面的正常波动范围。')
          : h('p', { className: 'lp-caption' }, row.range_zh
            ? '这项没有用来比较两次变化的波动数据。上面按参考范围标了偏低或偏高。'
            : row.source === 'checkup' ? '这项没有收录个体正常波动数据，分不清真实变化和波动，所以不作判断。' : '手环和自测数据按周均值或日值显示趋势，不作正常波动判断。'),
    biovar ? h('p', { className: 'lp-caption' }, `研究里用来判断变化的范围：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（来源：${sourceLabel(biovar.source.title)}）`) : null,
    biovar?.caveat_zh && !row.gate ? h('p', { className: 'lp-caption' }, biovar.caveat_zh) : null,
    points.length > 0
      ? h('div', { className: 'lp-table-wrap' }, h('table', { className: 'lp-table' },
        h('caption', { className: 'lp-sr' }, `${row.label_zh}历次数值`),
        h('thead', null, h('tr', null, ...['日期', '数值', '单位', '来自'].map((cell) => h('th', { key: cell, scope: 'col', className: cell === '数值' ? 'lp-td-num' : undefined }, cell)))),
        h('tbody', null, ...[...points].reverse().map((point, index) => h('tr', { key: `${point.date}-${index}` },
          h('td', null, dateZh(point.date)),
          h('td', { className: 'lp-td-num' }, point.text ?? (point.value == null ? '—' : fmt(point.value, digits))),
          h('td', null, unitText(point.unit) || '—'),
          h('td', { className: 'lp-caption' }, point.file ?? SOURCE_ZH[row.source]))))))
      : h('p', { className: 'lp-muted' }, '没有可显示的数值。'),
    numeric.length > 1 && units.length > 1 ? h(TableTwin, { caption: row.label_zh, head: ['日期', '数值'], rows: numeric.map((point) => [dateZh(point.date), withUnit(fmt(point.value, digits), unitText(point.unit))]) }) : null)
}

function Loading(): React.ReactElement {
  return h('div', { className: 'lp-tab-body', 'aria-busy': true, 'aria-label': '正在读取指标' },
    h(Skeleton, { height: 32, width: 320 }),
    h('div', { className: 'lp-card' }, ...[0, 1, 2, 3, 4].map((index) => h(Skeleton, { key: index, height: 32, className: 'lp-ind-skeleton' }))))
}

/** An empty state in a card: icon, title, one sentence, and a button only when there is somewhere to go. */
function EmptyCard(props: { icon: string; title: string; text: string; action?: { label: string; onClick: () => void } }): React.ReactElement {
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-empty' },
      h(Icon, { name: props.icon, size: 20 }),
      h('div', { className: 'lp-empty-title' }, props.title),
      h('p', { className: 'lp-empty-text' }, props.text),
      props.action ? h(Btn, { variant: 'outline', size: 'md', onClick: props.action.onClick }, props.action.label) : null))
}

const AREA_EMPTY: Record<Exclude<LifeArea, 'labs'>, { icon: string; title: string; text: string }> = {
  sleep: { icon: 'pulse', title: '还没有睡眠数据', text: '连上手环或导入睡眠记录后，这里会列出睡眠时长和变化趋势。' },
  training: { icon: 'flame', title: '还没有运动数据', text: '连上手环或导入运动记录后，这里会列出步数、活动量和变化趋势。' },
}

function Empty(props: { data: IndicatorsResponse; area: LifeArea; onConnect?: () => void }): React.ReactElement {
  const none = props.data.record.status === 'none'
  const action = props.onConnect ? { label: '连接记录', onClick: props.onConnect } : undefined
  if (props.area !== 'labs') return h(EmptyCard, { ...AREA_EMPTY[props.area], action: action && !none ? { ...action, label: '查看数据连接' } : action })
  // New or empty record: one way forward, the report upload on 档案.
  return h(EmptyCard, {
    icon: 'flask',
    title: '还没有化验数据',
    text: '上传体检报告后，这里会列出每一项化验，先看变化，再看这点变化算不算数。',
    action: { label: '上传报告', onClick: () => requestView({ tab: 'profile', id: 'lp-findings-card' }) },
  })
}

function lastCheckup(rows: IndicatorRow[]): string | null {
  let last: string | null = null
  for (const row of rows) {
    if (row.source === 'checkup' && row.latest && (!last || row.latest.date > last)) last = row.latest.date
  }
  return last
}

/** gate and reason_zh are not in the normalised row; the page reads them from the same response. */
function useGates(stamp: string | undefined): Record<string, { gate?: string; reason?: string }> {
  const [gates, setGates] = React.useState<Record<string, { gate?: string; reason?: string }>>({})
  React.useEffect(() => {
    let live = true
    getJson<unknown>('/api/longpi/indicators').then((raw) => {
      if (!live || !raw || typeof raw !== 'object') return
      const groups = (raw as { groups?: unknown }).groups
      if (!Array.isArray(groups)) return
      const next: Record<string, { gate?: string; reason?: string }> = {}
      for (const group of groups) {
        const indicators = group && typeof group === 'object' ? (group as { indicators?: unknown }).indicators : undefined
        if (!Array.isArray(indicators)) continue
        for (const row of indicators) {
          if (!row || typeof row !== 'object') continue
          const item = row as { id?: unknown; gate?: unknown; reason_zh?: unknown }
          if (typeof item.id !== 'string') continue
          if (typeof item.gate === 'string' || typeof item.reason_zh === 'string') {
            next[item.id] = {
              ...(typeof item.gate === 'string' ? { gate: item.gate } : {}),
              ...(typeof item.reason_zh === 'string' ? { reason: item.reason_zh } : {}),
            }
          }
        }
      }
      setGates(next)
    }).catch(() => { if (live) setGates({}) })
    return () => { live = false }
  }, [stamp])
  return gates
}

const JUDGEMENT_HELP = '超出正常波动：比你平常的起伏更大，值得问医生，不是急症。在正常波动范围内：这点变化不算数。太早：离上次太近。不可比：两次不是同一家机构。还不能下结论：看缺的是哪一步。'

export function IndicatorsTab(props: { filter: IndicatorFilter; onFilter: (filter: IndicatorFilter) => void; onConnect?: () => void; area?: LifeArea }): React.ReactElement {
  const { data, loading, error } = useIndicators()
  const gates = useGates(data?.updated_at)
  const [open, setOpen] = React.useState<string | null>(null)
  const area = props.area ?? 'labs'
  if (!data && loading) return h(Loading)
  if (!data) return h('div', { className: 'lp-tab-body' }, h(LoadError, { what: '指标', error, onRetry: () => reload('indicators') }))
  if (data.groups.length === 0 && data.record.status === 'error') {
    return h('div', { className: 'lp-tab-body' }, h(LoadError, { what: '体检记录', error: data.record.error || null, onRetry: () => reload('indicators') }))
  }
  const all = data.groups.flatMap((group) => group.indicators).filter((row) => lifeAreaOf(row.label_zh) === area || (area === 'labs' && row.source !== 'device'))
  // No rows in this area: no filters, no checkup date, just what is missing and where to add it.
  if (all.length === 0) return h('div', { className: 'lp-tab-body' }, h(Empty, { data, area, onConnect: props.onConnect }))
  // 「手环」 is the whole list on the sleep and training tabs, so it is only offered on 化验.
  const filters = area === 'labs' ? FILTERS : FILTERS.filter((row) => row.key !== 'device')
  const filter = filters.find((row) => row.key === props.filter) ?? filters[0] as (typeof FILTERS)[number]
  const groups = data.groups
    .map((group) => ({ ...group, indicators: group.indicators.filter((row) => all.includes(row)).filter(filter.test) }))
    .filter((group) => group.indicators.length > 0)
  const failed = all.filter((row) => row.read_error).length
  const gateOf = (row: IndicatorRow) => ({ gate: row.gate ?? gates[row.id]?.gate, reason: row.reason_zh ?? gates[row.id]?.reason })
  // The 「和正常波动比」 column only shows when some row in view has something to say in it.
  const judgedAny = groups.some((group) => group.indicators.some((row) => !row.read_error
    && (row.range_flag === 'low' || row.range_flag === 'high' || judgementKind({ ...gateOf(row), judged: row.judged }) !== 'unjudged')))
  // 化验: the last checkup; 睡眠 / 运动: the newest value of any row.
  const sources = new Set(groups.flatMap((group) => group.indicators.map((row) => row.source)))
  const oneSource = sources.size <= 1
  const lastDate = area === 'labs' ? lastCheckup(all) : all.reduce<string | null>((last, row) => (row.latest && (!last || row.latest.date > last) ? row.latest.date : last), null)
  const latestLine = lastDate ? `${area === 'labs' ? '最近一次体检' : '最近一次'} ${dateZh(lastDate)}` : ''
  return h('div', { className: 'lp-tab-body' },
    data.record.status === 'partial' || data.record.status === 'error'
      ? h('div', { className: 'lp-callout lp-callout-warn', role: 'note' }, h(Icon, { name: 'warn', size: 14 }),
        h('div', { className: 'lp-callout-body' },
          `有一部分记录这次没有读到${data.record.error ? `：${data.record.error}` : failed > 0 ? `（${failed} 项）` : ''}。标着「没有读到」的指标不是没测，稍后刷新再读。`))
      : null,
    h('div', { className: 'lp-ind-toolbar' },
      h('div', { className: 'lp-seg', role: 'group', 'aria-label': '筛选指标' },
        ...filters.map((row) => {
          const count = all.filter(row.test).length
          const on = filter.key === row.key
          return h('button', {
            key: row.key, type: 'button', className: `lp-seg-item ${on ? 'is-on' : ''}`, 'aria-pressed': on,
            disabled: count === 0 && !on, onClick: () => props.onFilter(row.key),
          }, row.label, h('span', { className: 'lp-seg-count' }, String(count)))
        })),
      latestLine ? h('span', { className: 'lp-caption lp-ind-meta' }, latestLine,
        judgedAny ? h(Info, { label: '和正常波动比', align: 'end' }, JUDGEMENT_HELP) : null) : null),
    groups.length === 0
      ? h(EmptyCard, { icon: 'check', title: `没有「${filter.label}」的指标`, text: '换一个筛选看看。', action: { label: '看全部', onClick: () => props.onFilter('all') } })
      : h('div', { className: `lp-card lp-ind-card ${judgedAny ? '' : 'lp-ind-nojudge'} ${oneSource ? 'lp-ind-nosource' : ''}`.replace(/\s+/g, ' ').trim() },
        h('div', { className: 'lp-ind-head', 'aria-hidden': true },
          h('span', null, '指标'), h('span', { className: 'lp-ind-value' }, h('span', { className: 'lp-ind-num' }, '最近一次'), h('span', null)), h('span', { className: 'lp-ind-date' }, '日期'), h('span', null, '趋势'), h('span', { className: 'lp-ind-head-judged' }, '和正常波动比'), h('span', { className: 'lp-ind-source' }, '来源'), h('span', null)),
        ...groups.map((group) => h('section', { key: group.key, className: 'lp-ind-group', 'aria-label': group.label_zh },
          h('h3', { className: 'lp-ind-group-title' }, group.label_zh, h('span', { className: 'lp-optional' }, `${group.indicators.length} 项`)),
          h('ul', { className: 'lp-ind-list' },
            ...group.indicators.map((row) => h(IndicatorLine, {
              key: row.id, row, open: open === row.id, ...gateOf(row),
              onToggle: () => setOpen((current) => (current === row.id ? null : row.id)),
            })))))),
    h('p', { className: 'lp-fine' }, '点任一行看历次数值、单位、来自哪份报告，以及正常波动的依据。'))
}
