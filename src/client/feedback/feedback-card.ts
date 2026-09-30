// The graded sentences on 概览: celebration, the within-band story, today's check-in, a projection.

import React from 'react'
import type { FeedbackMessage } from '../../contracts/feedback.ts'

const h = React.createElement

function retestLine(retest: NonNullable<FeedbackMessage['retest']>): string {
  if (retest.why_zh.includes('复测已在')) return retest.why_zh
  return `建议复测：${retest.earliest} 至 ${retest.recommended}。${retest.why_zh}`
}

export function FeedbackCard(props: { messages: FeedbackMessage[] }): React.ReactElement | null {
  if (props.messages.length === 0) return null
  return h('section', { className: 'lp-card', id: 'lp-feedback', 'aria-label': '这次的变化' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '这次的变化')),
    h('ul', { className: 'lp-rows' },
      ...props.messages.map((row) => h('li', { key: row.id, className: 'lp-row lp-row-stack' },
        h('p', { className: row.tone === 'celebrate' ? 'lp-text lp-strong' : 'lp-text' }, row.headline_zh),
        row.body_zh ? h('p', { className: 'lp-muted' }, row.body_zh) : null,
        row.retest ? h('p', { className: 'lp-caption' }, retestLine(row.retest)) : null))))
}
