// Inline SVG charts for the board. No chart library: thin marks (2px lines,
// 8px dots with a 2px surface ring, bars at most 24px with 4px rounded ends),
// hairline solid grids, one accent for the person's own data, a neutral wash
// for the noise band, and a hover layer that never gates a value (every chart
// has a table twin). Text never wears the data color.

import React from 'react'

const h = React.createElement

export interface Point {
  date: string
  value: number
}

function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000)
}

export function shortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-')
  return `${Number(month)}/${Number(day)}`
}

export function monthLabel(iso: string): string {
  const [year, month] = iso.slice(0, 10).split('-')
  return `${year?.slice(2)}/${month}`
}

/** Two decimals under 10, one under 100, none above: 1.26 mmol/L, 44.8 岁, 125 mmHg. */
export function fmtAuto(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const size = Math.abs(value)
  return fmt(value, size >= 100 ? 0 : size >= 10 ? 1 : 2)
}

export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const fixed = value.toFixed(digits)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function linear(d0: number, d1: number, r0: number, r1: number): (value: number) => number {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return (value) => r0 + (value - d0) * k
}

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(raw || 1))
  const scaled = raw / power
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10
  return nice * power
}

function ticks(min: number, max: number, count = 3): number[] {
  if (!(max > min)) return [min]
  const step = niceStep(max - min, count)
  const out: number[] = []
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) out.push(Number(value.toFixed(10)))
  return out
}

/** Width of an element, kept current as the board resizes. */
export function useWidth(fallback = 320): [React.RefObject<HTMLDivElement>, number] {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(fallback)
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const update = () => setWidth(Math.max(160, Math.floor(node.getBoundingClientRect().width)))
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

interface TipState {
  x: number
  y: number
  title: string
  rows: Array<{ label: string; value: string }>
}

function Tooltip(props: { tip: TipState | null; width: number }): React.ReactElement | null {
  const tip = props.tip
  if (!tip) return null
  const left = Math.min(Math.max(8, tip.x + 12), props.width - 168)
  return h('div', { className: 'lp-tip', style: { left, top: Math.max(0, tip.y - 12) }, role: 'status' },
    h('div', { className: 'lp-tip-title' }, tip.title),
    ...tip.rows.map((row, index) => h('div', { className: 'lp-tip-row', key: index },
      h('span', { className: 'lp-tip-value' }, row.value),
      h('span', { className: 'lp-tip-label' }, row.label))))
}

// --- line chart with a noise band and a goal ---------------------------------------

export interface LineChartProps {
  points: Point[]
  unit: string
  label: string
  height?: number
  band?: { low: number; high: number; from: string } | null
  goal?: number | null
  /** A reference line with its own label, such as 0 = 与实足年龄持平. */
  reference?: { value: number; label: string } | null
  digits?: number
  compact?: boolean
}

export function LineChart(props: LineChartProps): React.ReactElement {
  const [ref, width] = useWidth()
  const [tip, setTip] = React.useState<TipState | null>(null)
  const [focus, setFocus] = React.useState<number | null>(null)
  const height = props.height ?? 150
  const digits = props.digits ?? 1
  const pad = { top: 14, right: props.compact ? 10 : 56, bottom: props.compact ? 6 : 22, left: props.compact ? 6 : 36 }
  const points = props.points
  if (points.length === 0) return h('div', { ref, className: 'lp-chart-empty' }, '还没有数据')
  const values = points.map((point) => point.value)
  const extra = [props.band?.low, props.band?.high, props.goal ?? undefined, props.reference?.value].filter((value): value is number => typeof value === 'number')
  let min = Math.min(...values, ...extra)
  let max = Math.max(...values, ...extra)
  if (max === min) {
    max += Math.abs(max) * 0.1 || 1
    min -= Math.abs(min) * 0.1 || 1
  }
  const span = max - min
  min -= span * 0.12
  max += span * 0.12
  const days = points.map((point) => dayNumber(point.date))
  let d0 = Math.min(...days)
  let d1 = Math.max(...days)
  if (d0 === d1) {
    d0 -= 15
    d1 += 15
  }
  const x = linear(d0, d1, pad.left, width - pad.right)
  const y = linear(min, max, height - pad.bottom, pad.top)
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(dayNumber(point.date)).toFixed(1)},${y(point.value).toFixed(1)}`).join('')
  const area = `${path}L${x(days.at(-1) as number).toFixed(1)},${(height - pad.bottom).toFixed(1)}L${x(days[0] as number).toFixed(1)},${(height - pad.bottom).toFixed(1)}Z`
  const yTicks = props.compact ? [] : ticks(min, max, 3)
  const last = points.at(-1) as Point
  const nearest = (clientX: number, bounds: DOMRect): number => {
    const at = clientX - bounds.left
    let best = 0
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(x(days[i] as number) - at) < Math.abs(x(days[best] as number) - at)) best = i
    }
    return best
  }
  const show = (index: number) => {
    const point = points[index] as Point
    setFocus(index)
    setTip({ x: x(days[index] as number), y: y(point.value), title: point.date, rows: [{ label: props.label, value: `${fmt(point.value, digits)} ${props.unit}`.trim() }] })
  }
  const bandFrom = props.band ? Math.max(pad.left, x(dayNumber(props.band.from))) : 0
  return h('div', { ref, className: 'lp-chart', style: { height } },
    h('svg', {
      width, height, role: 'img',
      'aria-label': `${props.label}：${points.map((point) => `${point.date} ${fmt(point.value, digits)}${props.unit}`).join('，')}`,
      onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => show(nearest(event.clientX, event.currentTarget.getBoundingClientRect())),
      onPointerLeave: () => { setTip(null); setFocus(null) },
      tabIndex: 0,
      onFocus: () => show(points.length - 1),
      onBlur: () => { setTip(null); setFocus(null) },
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowLeft') show(Math.max(0, (focus ?? points.length - 1) - 1))
        if (event.key === 'ArrowRight') show(Math.min(points.length - 1, (focus ?? 0) + 1))
      },
    },
    ...yTicks.map((value) => h('g', { key: `g${value}` },
      h('line', { x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value), className: 'lp-grid' }),
      h('text', { x: pad.left - 6, y: y(value) + 3, className: 'lp-axis', textAnchor: 'end' }, fmt(value, value % 1 === 0 ? 0 : digits)))),
    props.band ? h('rect', {
      x: bandFrom, width: Math.max(0, width - pad.right - bandFrom), y: y(props.band.high), height: Math.max(1, y(props.band.low) - y(props.band.high)),
      className: 'lp-band', rx: 3,
    }) : null,
    props.reference ? h('g', null,
      h('line', { x1: pad.left, x2: width - pad.right, y1: y(props.reference.value), y2: y(props.reference.value), className: 'lp-ref' }),
      props.compact ? null : h('text', { x: width - pad.right + 4, y: y(props.reference.value) + 3, className: 'lp-axis' }, props.reference.label)) : null,
    props.goal != null ? h('g', null,
      h('line', { x1: pad.left, x2: width - pad.right, y1: y(props.goal), y2: y(props.goal), className: 'lp-goal' }),
      props.compact ? null : h('text', { x: pad.left + 4, y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5), className: 'lp-goal-text' }, `目标 ${fmt(props.goal, digits)}`)) : null,
    h('path', { d: area, className: 'lp-area' }),
    h('path', { d: path, className: 'lp-line' }),
    focus != null ? h('line', { x1: x(days[focus] as number), x2: x(days[focus] as number), y1: pad.top, y2: height - pad.bottom, className: 'lp-cross' }) : null,
    ...points.map((point, index) => (points.length > 24 && index !== points.length - 1 && index !== focus) ? null : h('circle', {
      key: `p${index}`, cx: x(days[index] as number), cy: y(point.value), r: focus === index ? 5.5 : 4, className: 'lp-dot',
    })),
    props.compact ? null : h('text', { x: x(days.at(-1) as number) + 8, y: y(last.value) + 4, className: 'lp-end' }, `${fmt(last.value, digits)}`),
    props.compact ? null : h('text', { x: pad.left, y: height - 6, className: 'lp-axis' }, monthLabel(points[0]?.date ?? '')),
    props.compact || points.length < 2 ? null : h('text', { x: width - pad.right, y: height - 6, className: 'lp-axis', textAnchor: 'end' }, monthLabel(last.date))),
    h(Tooltip, { tip, width }))
}

// --- plan timeline ----------------------------------------------------------------

export interface TimelineItem {
  id: string
  title: string
  start: string
  end: string | null
  subtitle: string
  headline: string
}

export function Timeline(props: { items: TimelineItem[]; checkups: string[]; today: string }): React.ReactElement {
  const [ref, width] = useWidth(560)
  const [tip, setTip] = React.useState<TipState | null>(null)
  const labelWidth = Math.min(168, Math.max(96, width * 0.24))
  const row = 34
  const top = 26
  const height = top + props.items.length * row + 8
  const starts = props.items.map((item) => dayNumber(item.start))
  const today = dayNumber(props.today)
  const d0 = Math.min(...starts, ...props.checkups.map(dayNumber)) - 10
  const d1 = today + 10
  const x = linear(d0, d1, labelWidth, width - 12)
  const months: string[] = []
  for (let day = d0; day <= d1; day += 1) {
    const iso = new Date(day * 86_400_000).toISOString().slice(0, 10)
    if (iso.endsWith('-01')) months.push(iso)
  }
  const step = Math.max(1, Math.ceil(months.length / Math.max(2, Math.floor((width - labelWidth) / 64))))
  return h('div', { ref, className: 'lp-chart', style: { height } },
    h('svg', { width, height, role: 'img', 'aria-label': `方案时间线：${props.items.map((item) => `${item.title} ${item.start} 起`).join('，')}` },
      ...months.filter((_, index) => index % step === 0).map((iso) => h('g', { key: iso },
        h('line', { x1: x(dayNumber(iso)), x2: x(dayNumber(iso)), y1: top - 6, y2: height - 6, className: 'lp-grid' }),
        h('text', { x: x(dayNumber(iso)) + 3, y: 12, className: 'lp-axis' }, monthLabel(iso)))),
      ...props.checkups.map((iso) => h('g', { key: `c${iso}` },
        h('line', { x1: x(dayNumber(iso)), x2: x(dayNumber(iso)), y1: top - 4, y2: height - 6, className: 'lp-checkup' }),
        h('circle', { cx: x(dayNumber(iso)), cy: top - 4, r: 3, className: 'lp-checkup-dot' }))),
      h('line', { x1: x(today), x2: x(today), y1: 16, y2: height - 6, className: 'lp-today' }),
      h('text', { x: x(today) - 3, y: 24, className: 'lp-axis', textAnchor: 'end' }, '今天'),
      ...props.items.map((item, index) => {
        const y0 = top + index * row + row / 2
        const x0 = x(dayNumber(item.start))
        const x1 = x(item.end ? Math.min(dayNumber(item.end), today) : today)
        const done = Boolean(item.end && dayNumber(item.end) < today)
        return h('g', {
          key: item.id,
          onPointerEnter: () => setTip({ x: (x0 + x1) / 2, y: y0 - 8, title: item.title, rows: [{ label: item.subtitle, value: item.headline }] }),
          onPointerLeave: () => setTip(null),
        },
        h('text', { x: 0, y: y0 + 4, className: 'lp-row-label' }, item.title.length > 12 ? `${item.title.slice(0, 11)}…` : item.title),
        h('rect', { x: labelWidth, y: y0 - 12, width: width - labelWidth, height: 24, className: 'lp-hit' }),
        h('rect', { x: x0, y: y0 - 5, width: Math.max(6, x1 - x0), height: 10, rx: 5, className: done ? 'lp-bar-muted' : 'lp-bar' }))
      })),
    h('div', { className: 'lp-legend-inline' },
      h('span', { className: 'lp-key-bar' }), '执行中', h('span', { className: 'lp-key-dot' }), '体检日'),
    h(Tooltip, { tip, width }))
}

// --- 12-week adherence strip --------------------------------------------------------

export function AdherenceStrip(props: { calendar: Array<{ date: string; status: string }>; label: string }): React.ReactElement {
  const [tip, setTip] = React.useState<TipState | null>(null)
  const cell = 9
  const gap = 2
  const weeks = Math.ceil(props.calendar.length / 7)
  const width = weeks * (cell + gap)
  const height = 7 * (cell + gap)
  const statusZh: Record<string, string> = { done: '完成', missed: '没完成', unknown: '没有记录' }
  return h('div', { className: 'lp-strip', style: { width, height: height + 2 } },
    h('svg', { width, height, role: 'img', 'aria-label': `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === 'done').length} 天` },
      ...props.calendar.map((day, index) => h('rect', {
        key: day.date,
        x: Math.floor(index / 7) * (cell + gap),
        y: (index % 7) * (cell + gap),
        width: cell, height: cell, rx: 2,
        className: `lp-cell lp-cell-${day.status}`,
        onPointerEnter: () => setTip({ x: Math.floor(index / 7) * (cell + gap), y: (index % 7) * (cell + gap), title: day.date, rows: [{ label: props.label, value: statusZh[day.status] ?? day.status }] }),
        onPointerLeave: () => setTip(null),
      }))),
    h(Tooltip, { tip, width: Math.max(width, 180) }))
}

// --- levers: what moving one marker does in the model --------------------------------

export function LeverBars(props: { rows: Array<{ label: string; detail: string; value: number; unit: string }> }): React.ReactElement {
  const [ref, width] = useWidth(420)
  const max = Math.max(...props.rows.map((row) => Math.abs(row.value)), 0.1)
  const labelWidth = Math.min(210, width * 0.46)
  const barMax = width - labelWidth - 70
  const row = 36
  const height = props.rows.length * row
  return h('div', { ref, className: 'lp-chart', style: { height } },
    h('svg', { width, height, role: 'img', 'aria-label': props.rows.map((row) => `${row.label} ${row.detail}：${fmt(row.value)}${row.unit}`).join('，') },
      ...props.rows.map((item, index) => {
        const y0 = index * row + row / 2
        const length = Math.max(3, (Math.abs(item.value) / max) * barMax)
        return h('g', { key: item.label },
          h('text', { x: 0, y: y0 - 2, className: 'lp-row-label' }, item.label),
          h('text', { x: 0, y: y0 + 12, className: 'lp-axis' }, item.detail),
          h('path', { d: roundedBar(labelWidth, y0 - 6, length, 12), className: item.value <= 0 ? 'lp-bar' : 'lp-bar-muted' }),
          h('text', { x: labelWidth + length + 8, y: y0 + 4, className: 'lp-end' }, `${item.value > 0 ? '+' : ''}${fmt(item.value)} ${item.unit}`))
      })))
}

/** A bar square at its baseline and rounded (4px) at its data end. */
function roundedBar(x: number, y: number, length: number, thickness: number): string {
  const r = Math.min(4, length / 2, thickness / 2)
  return `M${x},${y}H${x + length - r}Q${x + length},${y} ${x + length},${y + r}V${y + thickness - r}Q${x + length},${y + thickness} ${x + length - r},${y + thickness}H${x}Z`
}

// --- ring meter ---------------------------------------------------------------------

export function Ring(props: { value: number | null; size?: number; label: string }): React.ReactElement {
  const size = props.size ?? 64
  const stroke = 7
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const share = props.value == null ? 0 : Math.max(0, Math.min(1, props.value))
  return h('svg', { width: size, height: size, role: 'img', 'aria-label': `${props.label} ${props.value == null ? '未知' : `${Math.round(share * 100)}%`}`, className: 'lp-ring' },
    h('circle', { cx: size / 2, cy: size / 2, r: radius, className: 'lp-ring-track', strokeWidth: stroke }),
    h('circle', {
      cx: size / 2, cy: size / 2, r: radius, className: 'lp-ring-fill', strokeWidth: stroke,
      strokeDasharray: `${(share * length).toFixed(2)} ${length.toFixed(2)}`, transform: `rotate(-90 ${size / 2} ${size / 2})`,
    }))
}

// --- table twin -------------------------------------------------------------------

export function TableTwin(props: { caption: string; head: string[]; rows: Array<Array<string>> }): React.ReactElement {
  return h('details', { className: 'lp-twin' },
    h('summary', null, '表格'),
    h('table', null,
      h('caption', null, props.caption),
      h('thead', null, h('tr', null, ...props.head.map((cell) => h('th', { key: cell, scope: 'col' }, cell)))),
      h('tbody', null, ...props.rows.map((row, index) => h('tr', { key: index }, ...row.map((cell, column) => h('td', { key: column }, cell)))))))
}
