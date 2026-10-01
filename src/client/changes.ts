// Record changes beyond normal fluctuation: each row is one checkup marker
// whose latest value moved further than its reference change value (RCV) from
// the biological-variation table. The server decides which rows qualify and
// writes every sentence; the card lays them out with the trend, and the band,
// caveats and sources wait behind 判断依据. No model estimate is involved, so
// there is no 模型估计 tag, and nothing here names a cause.

import React from 'react'
import { LineChart } from './charts.ts'
import { plainUnits } from './format.ts'
import { Icon } from './icons.ts'
import type { Journey, RecordChange } from './types.ts'
import { sourceLabel } from '../ux/plain.ts'
import { isCovered, notableRows, NOTHING_COVERED, type Covered } from './overview-facts.ts'

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

/** Units as labs print them: 10^12/L → ×10¹²/L, umol/L → μmol/L, kg/m2 → kg/m². */
export function prettyUnits(text: string): string {
  return plainUnits(text).replace(/(×)?10\^(\d+)\/L/g, (_, _times: string | undefined, power: string) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join('')}/L`)
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

const VERDICT_ZH: Record<RecordChange['verdict'], string> = { better: '变好', worse: '变差', unclear: '需结合参考范围' }

export function ChangeChip(props: { verdict: RecordChange['verdict']; askDoctor?: boolean }): React.ReactElement {
  const tone = props.verdict === 'better' && !props.askDoctor ? 'good' : props.verdict === 'worse' || props.askDoctor ? 'warn' : 'neutral'
  return h('span', { className: `lp-badge lp-badge-${tone}` },
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
    h('span', { className: 'lp-num lp-notable-values' }, `${row.compare.from === row.compare.to ? `${row.compare.to} ${prettyUnits(row.unit)}`.trim() : `${pairText(row.compare.from, row.compare.to)} ${prettyUnits(row.unit)}`.trim()}`),
    h(Spark, { row }))
}

/** The one plain sentence behind 判断依据 (INT062 fix 7): what "超出正常波动" means, and what it is not. */
export const BASIS_ZH = '“超出正常波动”是说两次结果的差别，比同一个人平常的起伏更大。不同医院、不同仪器之间的差别没有算进去，这也不是诊断。'

/**
 * 判断依据: one plain sentence and where the fluctuation data comes from. Method notes (CV scales, instrument
 * error, how wide a band may be) are for the chat's tool text, not for this fold.
 */
export function Basis(props: { journey: Journey; rows: readonly RecordChange[] }): React.ReactElement | null {
  const { rows } = props
  const unjudged = props.journey.changes_unjudged
  if (rows.length === 0 && unjudged.length === 0) return null
  const sources = distinct(rows.map((row) => row.source), (source) => source.url || source.title)
  return h('details', { className: 'lp-basis' },
    h('summary', null, '判断依据'),
    h('div', { className: 'lp-change-notes' },
      h('p', { className: 'lp-caption' }, BASIS_ZH),
      unjudged.length > 0 ? h('p', { className: 'lp-caption' }, `这几项这次没有读全，先不判断：${unjudged.map((row) => row.label_zh).join('、')}。`) : null,
      sources.length > 0 ? h('p', { className: 'lp-caption lp-change-source' },
        '数据来源：',
        ...sources.flatMap((source, index) => [
          index > 0 ? '；' : null,
          source.url ? h('a', { key: source.url, href: source.url, target: '_blank', rel: 'noopener noreferrer', title: source.title || undefined }, sourceLabel(source.title)) : sourceLabel(source.title),
        ])) : null))
}

/**
 * 值得注意的变化 on 概览: at most three rows (a doctor's first), the advice
 * said once per group, and a link to 指标 for the rest. The server decides
 * which rows qualify and writes every sentence; nothing here names a cause.
 */
export function NotableChanges(props: { journey: Journey; onOpenIndicators: () => void; covered?: Covered }): React.ReactElement | null {
  const rows = props.journey.changes
  if (rows.length === 0 && props.journey.changes_unjudged.length === 0) return null
  // Values 最重要的一步 is already about are one short line here, not rows and advice again (INT062 fix 7).
  const covered = props.covered ?? NOTHING_COVERED
  const onCard = rows.filter((row) => isCovered(covered, row))
  const shown = notableRows(rows, covered)
  const advice = groupsOf(shown).filter((group) => group.advice && group.tone === 'warn')
  const pointer = onCard.length > 0
    ? `${onCard[0]?.label_zh ?? ''}${onCard.length > 1 ? `等 ${onCard.length} 项` : ''}的变化，就是上面「最重要的一步」说的那件事。`
    : ''
  return h('section', { className: 'lp-card lp-notable', id: 'lp-changes', 'aria-labelledby': 'lp-changes-title' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title', id: 'lp-changes-title' }, '值得注意的变化', rows.length > 0 ? h('span', { className: 'lp-caption' }, `${rows.length} 项超出正常波动`) : null),
      h('button', { type: 'button', className: 'lp-textbtn', onClick: props.onOpenIndicators }, '在「化验」里看全部', h(Icon, { name: 'chevron', size: 14 }))),
    pointer ? h('p', { className: 'lp-caption' }, pointer) : null,
    ...advice.map((group) => h('div', { key: group.advice, className: 'lp-callout lp-callout-warn' },
      h(Icon, { name: 'warn', size: 14 }), h('span', null, group.advice))),
    shown.length > 0
      ? h('ul', { className: 'lp-notable-list' }, ...shown.map((row) => h(NotableRow, { key: row.key, row })))
      : pointer ? null : h('p', { className: 'lp-muted' }, '没有超出正常波动的变化。'),
    h(Basis, { journey: props.journey, rows }))
}
