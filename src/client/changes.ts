// Record changes beyond normal fluctuation (spec A.2), the card right under the
// journey card. Each row is one checkup marker whose latest value moved further
// than its reference change value (RCV) from the biological-variation table.
// The server decides which rows qualify and writes every sentence; the card
// only lays them out with the trend, the band that was used and the source.
// No model estimate is involved, so there is no 模型估计 tag, and nothing here
// names a cause.

import React from 'react'
import { LineChart } from './charts.ts'
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
      points: row.points, unit: row.unit, label: row.label_zh, height: 56, compact: true, digits: 2,
      band: dated ? { low: base * (1 + row.band_pct.down / 100), high: base * (1 + row.band_pct.up / 100), from: row.compare.from_date } : null,
    }))
}

const SUPERSCRIPT: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

/** Count units as labs print them: 10^12/L → ×10¹²/L. */
function prettyUnits(text: string): string {
  return text.replace(/(×)?10\^(\d+)\/L/g, (_, _times: string | undefined, power: string) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join('')}/L`)
}

/** The server's sentence opens with the label, which the row already shows in bold just above it. */
function withoutLabel(row: RecordChange): string {
  const text = row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() || row.text_zh : row.text_zh
  return prettyUnits(text)
}

function toneOf(row: RecordChange): 'warn' | 'good' | 'neutral' {
  return row.ask_doctor ? 'warn' : row.verdict === 'better' ? 'good' : 'neutral'
}

function ChangeRow(props: { row: RecordChange }): React.ReactElement {
  const { row } = props
  return h('li', { className: 'lp-change' },
    h('div', { className: 'lp-change-main' },
      h('div', { className: 'lp-strong' }, row.label_zh),
      h('p', { className: 'lp-change-text' }, withoutLabel(row))),
    h(Spark, { row }))
}

/** Rows that share one piece of advice, under that advice said once. */
interface Group {
  advice: string
  tone: 'warn' | 'good' | 'neutral'
  rows: RecordChange[]
}

function groupsOf(rows: readonly RecordChange[]): Group[] {
  const groups: Group[] = []
  for (const row of rows) {
    const found = groups.find((group) => group.advice === row.advice_zh && group.tone === toneOf(row))
    if (found) found.rows.push(row)
    else groups.push({ advice: row.advice_zh, tone: toneOf(row), rows: [row] })
  }
  return groups
}

function distinct<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** "MCV 的个体内变异非常小…" and "MCH 的个体内变异非常小…" become one line: "MCV、MCH 的个体内变异非常小…". */
function mergedCaveats(rows: readonly RecordChange[]): string[] {
  const byRest = new Map<string, Array<{ head: string; text: string }>>()
  for (const row of rows) {
    const text = row.caveat_zh ?? ''
    if (!text) continue
    const at = text.indexOf('的')
    const [head, rest] = at > 0 && at <= 12 ? [text.slice(0, at).trim(), text.slice(at)] : ['', text]
    const members = byRest.get(rest) ?? []
    if (!members.some((member) => member.text === text)) members.push({ head, text })
    byRest.set(rest, members)
  }
  return [...byRest.entries()].map(([rest, members]) =>
    members.length > 1 && members.every((member) => member.head) ? `${members.map((member) => member.head).join('、')} ${rest}` : (members[0] as { text: string }).text)
}

export function ChangesCard(props: { journey: Journey }): React.ReactElement | null {
  const rows = props.journey.changes
  if (rows.length === 0) return null
  const caveats = mergedCaveats(rows)
  const sources = distinct(rows.map((row) => ({ ...row.source, verified: row.verified })), (source) => source.url || source.title)
  return h('section', { className: 'lp-card lp-changes', id: 'lp-changes', 'aria-labelledby': 'lp-changes-title' },
    h('div', { className: 'lp-label', id: 'lp-changes-title' }, '记录里的明显变化', h('span', { className: 'lp-optional' }, `${rows.length} 项`)),
    ...groupsOf(rows).map((group) => h('div', { key: `${group.tone}:${group.advice}`, className: 'lp-change-group' },
      group.advice ? h('p', { className: `lp-change-advice lp-change-${group.tone}` },
        h(Icon, { name: group.tone === 'warn' ? 'warn' : group.tone === 'good' ? 'check' : 'info', size: 14 }), h('span', null, group.advice)) : null,
      h('ul', { className: 'lp-change-list' }, ...group.rows.map((row) => h(ChangeRow, { key: row.key, row }))))),
    h('div', { className: 'lp-change-notes' },
      h('p', { className: 'lp-caption' }, '趋势图里的浅色带：以比较起点那次结果为基线的正常波动范围，落在带外就是真实变化。'),
      ...caveats.map((text) => h('p', { key: `caveat:${text}`, className: 'lp-caption' }, text)),
      sources.length > 0 ? h('p', { className: 'lp-caption lp-change-source' },
        '波动数据来源：',
        ...sources.flatMap((source, index) => [
          index > 0 ? '；' : null,
          source.url ? h('a', { key: source.url, href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title || source.url) : source.title,
          source.verified ? null : '（引用尚未逐字核对）',
        ])) : null,
      props.journey.changes_note_zh ? h('p', { className: 'lp-fine' }, props.journey.changes_note_zh) : null))
}
