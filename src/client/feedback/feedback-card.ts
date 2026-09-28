// The graded sentences on 概览: celebration, the within-band story, today's check-in, a projection.

import React from 'react'
import type { FeedbackMessage } from '../../contracts/feedback.ts'

const h = React.createElement

export function FeedbackCard(props: { messages: FeedbackMessage[] }): React.ReactElement | null {
  if (props.messages.length === 0) return null
  return h('section', { className: 'lp-card', id: 'lp-feedback', 'aria-label': '这次的变化' },
    h('div', { className: 'lp-label' }, '这次的变化'),
    ...props.messages.map((row) => h('div', { key: row.id },
      h('p', { className: row.tone === 'celebrate' ? 'lp-strong' : 'lp-muted' }, row.headline_zh),
      row.body_zh ? h('p', { className: 'lp-caption' }, row.body_zh) : null,
      row.retest ? h('p', { className: 'lp-fine' }, `建议复测：${row.retest.earliest} 至 ${row.retest.recommended}。${row.retest.why_zh}`) : null)))
}
