import React from 'react'

const h = React.createElement

// 16px strokes drawn in currentColor, the weight DSH's own glyphs use.
const ICONS: Record<string, string> = {
  health: 'M8 13.4S2.4 10.2 2.4 6.2A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.6 1.2c0 1-.4 2-1 2.8M3.6 8.6h2.2l1-1.5 1.5 3 1-1.5h1.2',
  check: 'M4 8.5l2.5 2.5L12 5.5',
  within: 'M3.5 6.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0M3.5 9.8c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0',
  worse: 'M5 11L11 5M6 5h5v5',
  unknown: 'M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6M8 11.6v.1',
  flame: 'M8 2.5c.4 2-1.9 2.9-1.9 5.3a1.9 1.9 0 0 0 3.8.1c0-.7-.3-1.2-.3-1.2s1.9.8 1.9 3A3.5 3.5 0 0 1 4.5 9.8C4.5 6.3 8 5.4 8 2.5z',
  calendar: 'M3 5.5h10M5 2.8v2M11 2.8v2M3.5 4h9a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5z',
  download: 'M8 2.8v7M5 7l3 3 3-3M3.5 12.5h9',
  refresh: 'M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.4h-2.4',
  spark: 'M8 2.5l1.3 3.6 3.7 1.4-3.7 1.4L8 12.5l-1.3-3.6L3 7.5l3.7-1.4z',
  flask: 'M6.5 2.5h3M7 2.5v3.8L3.8 11.8a.9.9 0 0 0 .8 1.2h6.8a.9.9 0 0 0 .8-1.2L9 6.3V2.5',
  arrow: 'M3.5 8h9M9 4.5L12.5 8 9 11.5',
  play: 'M5.5 4v8l6-4z',
  info: 'M8 7.3v4M8 5v.1M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z',
  close: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  plus: 'M8 3.5v9M3.5 8h9',
  link: 'M6.8 9.2l2.4-2.4M7.3 4.9l.9-.9a2.4 2.4 0 0 1 3.4 3.4l-.9.9M8.7 11.1l-.9.9a2.4 2.4 0 0 1-3.4-3.4l.9-.9',
  user: 'M8 7.6a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM3.5 13c.6-2.2 2.4-3.4 4.5-3.4s3.9 1.2 4.5 3.4',
  ruler: 'M2.8 10.6l7.8-7.8 2.6 2.6-7.8 7.8zM5 8.4l1.2 1.2M6.8 6.6l1.2 1.2M8.6 4.8l1.2 1.2',
  trash: 'M3.5 4.5h9M6.5 4.5V3.3h3v1.2M4.8 4.5l.5 8.2h5.4l.5-8.2',
  lock: 'M4.5 7.3h7v5.2h-7zM5.8 7.3V5.6a2.2 2.2 0 0 1 4.4 0v1.7',
  chevron: 'M6 4l4 4-4 4',
  dot: 'M8 8.01v-.02',
}

export function Icon(props: { name: string; size?: number; className?: string; strokeWidth?: number }): React.ReactElement {
  const size = props.size ?? 16
  return h('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false', className: `lp-icon ${props.className ?? ''}`.trim() },
    h('path', { d: ICONS[props.name] ?? ICONS.info, fill: 'none', stroke: 'currentColor', strokeWidth: props.strokeWidth ?? 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
}

/** The LongPi mark: the same glyph as the 健康 entry in the sidebar. */
export function Mark(props: { size?: number }): React.ReactElement {
  return h('span', { className: 'lp-mark', 'aria-hidden': true }, h(Icon, { name: 'health', size: props.size ?? 16 }))
}

const VERDICT_STYLE: Record<string, { icon: string; className: string }> = {
  有效: { icon: 'check', className: 'lp-v-good' },
  波动内: { icon: 'within', className: 'lp-v-within' },
  反向: { icon: 'worse', className: 'lp-v-worse' },
  无法判断: { icon: 'unknown', className: 'lp-v-unknown' },
}

/** Verdicts always travel with an icon and a label, never color alone. */
export function VerdictChip(props: { verdict: string }): React.ReactElement {
  const label = VERDICT_STYLE[props.verdict] ? props.verdict : '无法判断'
  const style = VERDICT_STYLE[label] as { icon: string; className: string }
  return h('span', { className: `lp-chip-v ${style.className}` }, h(Icon, { name: style.icon, size: 14 }), label)
}
