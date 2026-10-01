// The graded sentences on 概览: celebration, the within-band story, today's check-in, a projection.

import React from 'react'
import type { FeedbackMessage } from '../../contracts/feedback.ts'
import { dateZh, datesZh } from '../charts.ts'

const h = React.createElement

function retestLine(retest: NonNullable<FeedbackMessage['retest']>): string {
  if (retest.why_zh.includes('复测已在')) return datesZh(retest.why_zh)
  return `建议复测：${dateZh(retest.earliest)}至 ${dateZh(retest.recommended)}。${datesZh(retest.why_zh)}`
}

/** Keep compound names whole: γ-谷氨酰转移酶 must not break after the hyphen. */
function keepWhole(text: string): string {
  return text.replace(/([α-ωΑ-Ω])-/g, '$1\u2011')
}

/** The lines of one message, each thing said once: a repeated sentence, or a later clause that restates a waiting time
 * already given (「…糖化血红蛋白至少要满 90 天」 then 「…至少 90 天」), is dropped. */
function linesOf(row: FeedbackMessage): string[] {
  const seen: string[] = []
  const waits = new Set<string>()
  const key = (text: string) => text.replace(/[\s，,。；]/g, '')
  const out = [row.headline_zh, row.body_zh ?? '', row.retest ? retestLine(row.retest) : ''].map((line) => {
    const clauses = datesZh(line).split(/(?<=[，。；])/)
    const kept = clauses.filter((clause) => {
      const k = key(clause)
      if (!k) return false
      const wait = /至少(?:要满|要隔|隔)?\s*(\d+)\s*天/.exec(clause)?.[1]
      const dup = seen.some((other) => other.includes(k)) || (wait != null && waits.has(wait))
      return !dup
    })
    for (const clause of kept) {
      seen.push(key(clause))
      const wait = /至少(?:要满|要隔|隔)?\s*(\d+)\s*天/.exec(clause)?.[1]
      if (wait) waits.add(wait)
    }
    // A line cut after a comma ends with a full stop.
    return kept.join('').replace(/[，；]$/, '。')
  })
  return out.filter(Boolean).map(keepWhole)
}

export function FeedbackCard(props: { messages: FeedbackMessage[] }): React.ReactElement | null {
  if (props.messages.length === 0) return null
  return h('section', { className: 'lp-card', id: 'lp-feedback', 'aria-label': '这次的变化' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '这次的变化')),
    h('ul', { className: 'lp-rows' },
      ...props.messages.map((row) => h('li', { key: row.id, className: 'lp-row lp-row-stack' },
        ...linesOf(row).map((line, index) => h('p', { key: index, className: `lp-small lp-muted lp-measure ${index === 0 ? 'lp-fb-lead' : ''}`.trim() }, line))))))
}
