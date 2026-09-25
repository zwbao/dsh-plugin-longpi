// 指标: every checkup value and wearable series the record holds, grouped by
// body system, each with its latest value, its trend, and how its last change
// compares with normal within-person fluctuation. A row opens a panel with
// every value, the report it came from and the source of the band. A series
// that could not be read says so; it is never shown as "no data".

import React from 'react'
import { getJson, errorText } from './api.ts'
import { fmt, fmtAuto, LineChart, TableTwin } from './charts.ts'
import { ChangeChip, prettyUnits } from './changes.ts'
import { chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { normalizeIndicatorDetail } from './normalize.ts'
import { reload, useIndicators, type IndicatorFilter } from './store.ts'
import type { IndicatorDetail, IndicatorRow, IndicatorsResponse, IndicatorSource } from './types.ts'
import { Btn, Info, LoadError, Skeleton } from './ui.ts'

const h = React.createElement

const SOURCE_ZH: Record<IndicatorSource, string> = { checkup: '体检', device: '手环', self: '自测' }

const FILTERS: Array<{ key: IndicatorFilter; label: string; test: (row: IndicatorRow) => boolean }> = [
  { key: 'all', label: '全部', test: () => true },
  { key: 'changed', label: '有变化', test: (row) => row.judged === 'changed' },
  { key: 'plan', label: '方案相关', test: (row) => row.plan_marker },
  { key: 'device', label: '手环', test: (row) => row.source === 'device' },
]

/** A trend in 88 × 24: the line and the latest point, no axes (the panel has the full chart). */
function Sparkline(props: { points: Array<{ date: string; value: number }>; label: string }): React.ReactElement | null {
  const points = props.points
  if (points.length < 2) return h('span', { className: 'lp-spark-none', 'aria-hidden': true }, points.length === 1 ? '仅 1 次' : '')
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
  return h('svg', { width, height, className: 'lp-spark', role: 'img', 'aria-label': `${props.label}趋势：${points.map((point) => `${point.date} ${fmtAuto(point.value)}`).join('，')}` },
    h('path', { d: path, className: 'lp-spark-line' }),
    h('circle', { cx: x(points.length - 1), cy: y(last.value), r: 2.5, className: 'lp-spark-dot' }))
}

export function JudgedChip(props: { row: IndicatorRow }): React.ReactElement {
  const { row } = props
  if (row.judged === 'changed' && row.change) return h(ChangeChip, { verdict: row.change.verdict, askDoctor: row.change.ask_doctor })
  if (row.judged === 'within') return h('span', { className: 'lp-chip-c lp-chip-c-within' }, h(Icon, { name: 'within', size: 12 }), '波动内')
  const why = row.read_error ? '这项没有读到' : row.points.length < 2 ? '只有一次结果' : '缺少这项的正常波动数据'
  return h('span', { className: 'lp-chip-c lp-chip-c-unjudged', title: why }, '未判断')
}

function latestText(row: IndicatorRow): string {
  if (!row.latest) return '—'
  if (row.latest.text) return row.latest.text
  return row.latest.value == null ? '—' : fmtAuto(row.latest.value)
}

function IndicatorLine(props: { row: IndicatorRow; open: boolean; onToggle: () => void }): React.ReactElement {
  const { row } = props
  const panelId = `lp-ind-panel-${row.id.replace(/[^A-Za-z0-9_-]/g, '_')}`
  return h('li', { className: `lp-ind-row ${props.open ? 'lp-ind-open' : ''} ${row.read_error ? 'lp-ind-failed' : ''}` },
    h('button', { type: 'button', className: 'lp-ind-btn', 'aria-expanded': props.open, 'aria-controls': panelId, onClick: props.onToggle },
      h('span', { className: 'lp-ind-name' },
        h('span', { className: 'lp-strong' }, row.label_zh),
        row.plan_marker ? h('span', { className: 'lp-tag lp-tag-plan' }, '方案') : null),
      row.read_error
        ? h('span', { className: 'lp-ind-error' }, h(Icon, { name: 'warn', size: 13 }), `没有读到：${row.read_error}`)
        : h('span', { className: 'lp-ind-value' },
          h('span', { className: 'lp-num' }, latestText(row)),
          row.latest?.text ? null : h('span', { className: 'lp-caption' }, ` ${prettyUnits(row.unit)}`),
          row.latest ? h('span', { className: 'lp-caption lp-ind-date' }, row.latest.date) : null),
      row.read_error ? h('span', { className: 'lp-ind-spark' }) : h('span', { className: 'lp-ind-spark' }, h(Sparkline, { points: row.points, label: row.label_zh })),
      h('span', { className: 'lp-ind-judged' }, h(JudgedChip, { row })),
      h('span', { className: 'lp-ind-source lp-caption' }, SOURCE_ZH[row.source]),
      h(Icon, { name: 'chevron', size: 14, className: 'lp-ind-chevron' })),
    props.open ? h(DetailPanel, { row, id: panelId }) : null)
}

function DetailPanel(props: { row: IndicatorRow; id: string }): React.ReactElement {
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
  return h('div', { className: 'lp-ind-panel', id: props.id, role: 'region', 'aria-label': `${props.row.label_zh}详情` }, body)
}

function DetailBody(props: { detail: IndicatorDetail }): React.ReactElement {
  const { row, all_points: points, biovar } = props.detail
  const numeric = points.filter((point): point is typeof point & { value: number } => point.value != null)
  const digits = Math.max(...numeric.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
  const units = [...new Set(points.map((point) => point.unit).filter(Boolean))]
  return h('div', { className: 'lp-ind-detail' },
    row.read_error ? h('p', { className: 'lp-blocker lp-blocker-bad' }, `这项这次没有读到：${row.read_error}。下面是能读到的部分。`) : null,
    row.change?.text_zh ? h('p', { className: 'lp-muted' }, prettyUnits(row.change.text_zh)) : null,
    numeric.length > 1 && units.length <= 1
      ? h(LineChart, { points: numeric.map((point) => ({ date: point.date, value: point.value })), unit: prettyUnits(units[0] ?? row.unit), label: row.label_zh, height: 150, digits })
      : null,
    biovar
      ? h('p', { className: 'lp-caption' },
        `正常波动：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（个体内变异 ${fmt(biovar.cvi_pct, 1)}%）。两次结果之差在这个范围内，多半是测量和生理波动。`,
        biovar.source.url ? h(React.Fragment, null, ' 来源：', h('a', { href: biovar.source.url, target: '_blank', rel: 'noopener noreferrer' }, biovar.source.title || biovar.source.url)) : biovar.source.title ? ` 来源：${biovar.source.title}` : '',
        biovar.source.doi ? ` · doi:${biovar.source.doi}` : '')
      : h('p', { className: 'lp-caption' }, row.source === 'checkup' ? '这项没有收录个体正常波动数据，分不清真实变化和波动，所以不作判断。' : '手环和自测数据按周均值或日值显示趋势，不作正常波动判断。'),
    biovar?.caveat_zh ? h('p', { className: 'lp-caption' }, biovar.caveat_zh) : null,
    points.length > 0
      ? h('table', { className: 'lp-ind-table' },
        h('caption', { className: 'lp-sr' }, `${row.label_zh}历次数值`),
        h('thead', null, h('tr', null, ...['日期', '数值', '单位', '来自'].map((cell) => h('th', { key: cell, scope: 'col' }, cell)))),
        h('tbody', null, ...[...points].reverse().map((point, index) => h('tr', { key: `${point.date}-${index}` },
          h('td', null, point.date),
          h('td', { className: 'lp-num' }, point.text ?? (point.value == null ? '—' : fmt(point.value, digits))),
          h('td', null, prettyUnits(point.unit)),
          h('td', { className: 'lp-caption' }, point.file ?? SOURCE_ZH[row.source])))))
      : h('p', { className: 'lp-muted' }, '没有可显示的数值。'),
    numeric.length > 1 && units.length > 1 ? h(TableTwin, { caption: row.label_zh, head: ['日期', '数值'], rows: numeric.map((point) => [point.date, `${fmt(point.value, digits)} ${point.unit}`]) }) : null)
}

function Loading(): React.ReactElement {
  return h('div', { className: 'lp-tab-body', 'aria-busy': true, 'aria-label': '正在读取指标' },
    h(Skeleton, { height: 32, width: 320 }),
    h('div', { className: 'lp-card' }, ...[0, 1, 2, 3, 4].map((index) => h(Skeleton, { key: index, height: 28, className: 'lp-ind-skeleton' }))))
}

function Empty(props: { data: IndicatorsResponse; onConnect: () => void }): React.ReactElement {
  const none = props.data.record.status === 'none'
  return h('div', { className: 'lp-card lp-empty' },
    h(Icon, { name: 'flask', size: 18 }),
    h('div', null,
      h('div', { className: 'lp-strong' }, none ? '还没有连接体检记录' : '记录里还没有指标'),
      h('p', { className: 'lp-muted' }, none
        ? '连接你的 Mirobody 之后，这里会列出每一次体检的化验值和手环数据，按系统分组，带趋势和正常波动的判断。'
        : '已连接 Mirobody，但还没有读到体检或手环数据。在 Mirobody 上传体检报告后，点右上角的刷新。'),
      none ? h(Btn, { size: 'sm', onClick: props.onConnect }, '连接记录') : null))
}

function lastCheckup(data: IndicatorsResponse): string | null {
  let last: string | null = null
  for (const group of data.groups) {
    for (const row of group.indicators) {
      if (row.source === 'checkup' && row.latest && (!last || row.latest.date > last)) last = row.latest.date
    }
  }
  return last
}

export function IndicatorsTab(props: { filter: IndicatorFilter; onFilter: (filter: IndicatorFilter) => void; onConnect: () => void }): React.ReactElement {
  const { data, loading, error } = useIndicators()
  const [open, setOpen] = React.useState<string | null>(null)
  if (!data && loading) return h(Loading)
  if (!data) return h('div', { className: 'lp-tab-body' }, h(LoadError, { what: '指标', error, onRetry: () => reload('indicators') }))
  if (data.groups.length === 0) {
    if (data.record.status === 'error') {
      return h('div', { className: 'lp-tab-body' }, h(LoadError, { what: '体检记录', error: data.record.error || null, onRetry: () => reload('indicators') }))
    }
    return h('div', { className: 'lp-tab-body' }, h(Empty, { data, onConnect: props.onConnect }))
  }
  const all = data.groups.flatMap((group) => group.indicators)
  const filter = FILTERS.find((row) => row.key === props.filter) ?? FILTERS[0]
  const groups = data.groups
    .map((group) => ({ ...group, indicators: group.indicators.filter(filter.test) }))
    .filter((group) => group.indicators.length > 0)
  const failed = all.filter((row) => row.read_error).length
  const checkup = lastCheckup(data)
  return h('div', { className: 'lp-tab-body lp-indicators' },
    data.record.status === 'partial' || data.record.status === 'error'
      ? h('p', { className: 'lp-blocker lp-blocker-bad lp-partial', role: 'note' }, h(Icon, { name: 'warn', size: 14 }),
        h('span', null, `有一部分记录这次没有读到${data.record.error ? `：${data.record.error}` : failed > 0 ? `（${failed} 项）` : ''}。标着“没有读到”的指标不是没测，稍后刷新再读。`))
      : null,
    h('div', { className: 'lp-ind-toolbar' },
      h('div', { className: 'lp-ind-filters', role: 'group', 'aria-label': '筛选指标' },
        ...FILTERS.map((row) => {
          const count = all.filter(row.test).length
          return h('button', {
            key: row.key, type: 'button', className: `lp-toggle ${props.filter === row.key ? 'lp-toggle-on' : ''}`, 'aria-pressed': props.filter === row.key,
            onClick: () => props.onFilter(row.key),
          }, row.label, h('span', { className: 'lp-toggle-count' }, String(count)))
        })),
      h('span', { className: 'lp-caption' }, checkup ? `最近一次体检 ${chineseDate(checkup)}` : '',
        h(Info, { label: '和正常波动比', align: 'end' },
          '“变好/变差”：最近两次体检之差超出个体正常波动（参考变化值 RCV，按生物学变异数据库计算）；“需结合参考范围”：变化超出波动，但好坏要看是否在参考范围内；“波动内”：差值在正常波动以内；“未判断”：只有一次结果、没有这项的波动数据，或这次没有读到。手环为每周均值，自测为每日值，只显示趋势。'))),
    groups.length === 0
      ? h('div', { className: 'lp-card lp-empty' }, h('p', { className: 'lp-muted' }, `没有“${filter.label}”的指标。`), h('button', { type: 'button', className: 'lp-row-link', onClick: () => props.onFilter('all') }, '看全部 →'))
      : h('div', { className: 'lp-card lp-ind-card' },
        h('div', { className: 'lp-ind-head', 'aria-hidden': true },
          h('span', null, '指标'), h('span', null, '最近一次'), h('span', null, '趋势'), h('span', null, '和正常波动比'), h('span', null, '来源')),
        ...groups.map((group) => h('section', { key: group.key, className: 'lp-ind-group', 'aria-label': group.label_zh },
          h('h3', { className: 'lp-ind-group-title' }, group.label_zh, h('span', { className: 'lp-optional' }, `${group.indicators.length} 项`)),
          h('ul', { className: 'lp-ind-list' },
            ...group.indicators.map((row) => h(IndicatorLine, { key: row.id, row, open: open === row.id, onToggle: () => setOpen((current) => (current === row.id ? null : row.id)) })))))),
    h('p', { className: 'lp-fine' }, '点任一行看历次数值、单位、来自哪份报告，以及正常波动的依据。这里只列出记录里的数值，不做诊断。'))
}
