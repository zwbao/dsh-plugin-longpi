// Record changes beyond normal fluctuation (spec A.2), the card right under the
// journey card. Each row is one checkup marker whose latest value moved further
// than its reference change value (RCV) from the biological-variation table.
// The server decides which rows qualify and writes every sentence; the card
// only lays them out with the trend, the band that was used and the source.
// No model estimate is involved, so there is no 模型估计 tag, and nothing here
// names a cause.

import React from 'react'
import { fmtAuto, LineChart } from './charts.ts'
import { Icon } from './icons.ts'
import type { Journey, RecordChange } from './types.ts'

const h = React.createElement

/** The trend, with the RCV band around the value it was compared from: points outside the band are the change. */
function Spark(props: { row: RecordChange }): React.ReactElement | null {
  const { row } = props
  if (row.points.length < 2) return null
  const base = row.compare.from
  const dated = row.compare.from_date !== ''
  return h('div', { className: 'lp-change-spark' },
    h(LineChart, {
      points: row.points, unit: row.unit, label: row.label_zh, height: 64, compact: true, digits: 2,
      band: dated ? { low: base * (1 + row.band_pct.down / 100), high: base * (1 + row.band_pct.up / 100), from: row.compare.from_date } : null,
    }),
    dated ? h('div', { className: 'lp-caption' }, `浅色带：以 ${row.compare.from_date} 的 ${fmtAuto(base)} 为基线的正常波动`) : null)
}

/** The server's sentence opens with the label, which the row already shows in bold just above it. */
function withoutLabel(row: RecordChange): string {
  return row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() || row.text_zh : row.text_zh
}

function ChangeRow(props: { row: RecordChange }): React.ReactElement {
  const { row } = props
  const tone = row.ask_doctor ? 'warn' : 'good'
  return h('li', { className: 'lp-change' },
    h('div', { className: 'lp-change-main' },
      h('div', { className: 'lp-strong' }, row.label_zh),
      h('p', { className: 'lp-change-text' }, withoutLabel(row)),
      row.advice_zh ? h('p', { className: `lp-change-advice lp-change-${tone}` },
        h(Icon, { name: row.ask_doctor ? 'warn' : 'check', size: 14 }), h('span', null, row.advice_zh)) : null,
      row.caveat_zh ? h('p', { className: 'lp-caption lp-change-caveat' }, row.caveat_zh) : null,
      row.source.title ? h('p', { className: 'lp-caption lp-change-source' },
        '波动数据来源：',
        row.source.url ? h('a', { href: row.source.url, target: '_blank', rel: 'noopener noreferrer' }, row.source.title) : row.source.title,
        row.verified ? null : '（引用尚未逐字核对）') : null),
    h(Spark, { row }))
}

export function ChangesCard(props: { journey: Journey }): React.ReactElement | null {
  const rows = props.journey.changes
  if (rows.length === 0) return null
  return h('section', { className: 'lp-card lp-changes', id: 'lp-changes', 'aria-labelledby': 'lp-changes-title' },
    h('div', { className: 'lp-label', id: 'lp-changes-title' }, '记录里的明显变化', h('span', { className: 'lp-optional' }, `${rows.length} 项`)),
    h('ul', { className: 'lp-change-list' }, ...rows.map((row) => h(ChangeRow, { key: row.key, row }))),
    props.journey.changes_note_zh ? h('p', { className: 'lp-fine' }, props.journey.changes_note_zh) : null)
}
