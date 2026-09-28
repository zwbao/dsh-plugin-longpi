// Renders one advise_on_substance result. Mounted by the client registry when the integrator calls it.

import React from 'react'

const h = React.createElement

export interface AdviceCardProps {
  advice?: {
    tier?: number
    subject?: { name_zh?: string }
    person?: { notes_zh?: string[] }
    tier4?: { first_aid_zh?: string[] }
  } | null
}

export function AdviceCard({ advice }: AdviceCardProps): React.ReactElement {
  const lines = advice?.tier4?.first_aid_zh ?? advice?.person?.notes_zh ?? []
  const title = advice?.tier ? `第 ${advice.tier} 层` : '建议'
  return h('div', { className: 'longpi-advice' },
    h('div', { className: 'longpi-advice-title' }, `${title}${advice?.subject?.name_zh ? ` · ${advice.subject.name_zh}` : ''}`),
    ...lines.slice(0, 4).map((line, index) => h('p', { key: index }, line)),
  )
}
