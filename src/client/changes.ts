// Record changes beyond normal fluctuation: each row is one checkup marker
// whose latest value moved further than its reference change value (RCV) from
// the biological-variation table. The server decides which rows qualify and
// writes every sentence; the card lays them out with the trend, and the band,
// caveats and sources wait behind 判断依据. No model estimate is involved, so
// there is no 模型估计 tag, and nothing here names a cause.

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
export function prettyUnits(text: string): string {
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

/** Rows shown on 概览; the rest are one tap away on 指标. */
const NOTABLE = 3

const VERDICT_ZH: Record<RecordChange['verdict'], string> = { better: '变好', worse: '变差', unclear: '需结合参考范围' }

export function ChangeChip(props: { verdict: RecordChange['verdict']; askDoctor?: boolean }): React.ReactElement {
  const tone = props.verdict === 'better' && !props.askDoctor ? 'good' : props.verdict === 'worse' || props.askDoctor ? 'warn' : 'neutral'
  return h('span', { className: `lp-chip-c lp-chip-c-${tone}` },
    h(Icon, { name: tone === 'good' ? 'check' : tone === 'warn' ? 'warn' : 'info', size: 12 }), VERDICT_ZH[props.verdict])
}

function decimals(value: number): number {
  return (String(value).split('.')[1] ?? '').length
}

/** Both ends with the same decimals, as a lab prints them: 4.2 → 3.0, not 4.2 → 3. */
export function pairText(from: number, to: number): string {
  const digits = Math.min(2, Math.max(decimals(from), decimals(to)))
  return `${from.toFixed(digits)} → ${to.toFixed(digits)}`
}

function NotableRow(props: { row: RecordChange }): React.ReactElement {
  const { row } = props
  return h('li', { className: 'lp-notable-row' },
    h(ChangeChip, { verdict: row.verdict, askDoctor: row.ask_doctor }),
    h('span', { className: 'lp-strong' }, row.label_zh),
    h('span', { className: 'lp-num lp-notable-values' }, `${pairText(row.compare.from, row.compare.to)} ${prettyUnits(row.unit)}`.trim()),
    h(Spark, { row }))
}

/** How a change is judged, the caveats and the sources: behind 判断依据, never in the way. */
export function Basis(props: { journey: Journey; rows: readonly RecordChange[] }): React.ReactElement | null {
  const { rows } = props
  const unjudged = props.journey.changes_unjudged
  if (rows.length === 0 && unjudged.length === 0) return null
  const caveats = mergedCaveats(rows)
  const sources = distinct(rows.map((row) => ({ ...row.source, verified: row.verified })), (source) => source.url || source.title)
  return h('details', { className: 'lp-basis' },
    h('summary', null, '判断依据'),
    h('div', { className: 'lp-change-notes' },
      h('p', { className: 'lp-caption' }, '“超出正常波动”指两次结果之差大于个体正常波动（参考变化值，RCV）。趋势图里的浅色带以比较起点那次结果为基线，落在带外就是真实变化。'),
      ...rows.map((row) => h('p', { key: `text:${row.key}`, className: 'lp-caption' }, h('span', { className: 'lp-strong' }, row.label_zh), `：${withoutLabel(row)}`)),
      ...caveats.map((text) => h('p', { key: `caveat:${text}`, className: 'lp-caption' }, text)),
      unjudged.length > 0 ? h('p', { className: 'lp-caption' }, `没有判断：${unjudged.map((row) => `${row.label_zh}（${row.reason_zh || '读取没有完成'}）`).join('、')}`) : null,
      sources.length > 0 ? h('p', { className: 'lp-caption lp-change-source' },
        '波动数据来源：',
        ...sources.flatMap((source, index) => [
          index > 0 ? '；' : null,
          source.url ? h('a', { key: source.url, href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title || source.url) : source.title,
          source.verified ? null : '（引用尚未逐字核对）',
        ])) : null,
      props.journey.changes_note_zh ? h('p', { className: 'lp-fine' }, props.journey.changes_note_zh) : null))
}

/**
 * 值得注意的变化 on 概览: at most three rows (a doctor's first), the advice
 * said once per group, and a link to 指标 for the rest. The server decides
 * which rows qualify and writes every sentence; nothing here names a cause.
 */
export function NotableChanges(props: { journey: Journey; onOpenIndicators: () => void }): React.ReactElement | null {
  const rows = props.journey.changes
  if (rows.length === 0 && props.journey.changes_unjudged.length === 0) return null
  const shown = rows.slice(0, NOTABLE)
  const advice = groupsOf(shown).filter((group) => group.advice && group.tone === 'warn')
  return h('section', { className: 'lp-card lp-notable', id: 'lp-changes', 'aria-labelledby': 'lp-changes-title' },
    h('div', { className: 'lp-card-head' },
      h('div', { className: 'lp-label', id: 'lp-changes-title' }, '值得注意的变化', rows.length > 0 ? h('span', { className: 'lp-optional' }, `${rows.length} 项超出正常波动`) : null),
      h('button', { type: 'button', className: 'lp-row-link', onClick: props.onOpenIndicators }, '在“指标”里看全部 →')),
    ...advice.map((group) => h('p', { key: group.advice, className: 'lp-change-advice lp-change-warn' },
      h(Icon, { name: 'warn', size: 14 }), h('span', null, group.advice))),
    shown.length > 0
      ? h('ul', { className: 'lp-notable-list' }, ...shown.map((row) => h(NotableRow, { key: row.key, row })))
      : h('p', { className: 'lp-muted' }, '没有超出正常波动的变化。'),
    h(Basis, { journey: props.journey, rows }))
}
