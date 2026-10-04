// The count line: days with a health action, cumulative (a missed day never takes one away), and when the next draw
// comes. The streak fields stay in the view for older readers and are not shown.

import React from 'react'

const h = React.createElement

export interface StreakView {
  current: number
  best: number
  freezes_available: number
  frozen: Array<{ day: string; reason: string }>
}

export interface CountView { total: number; season: number; next_milestone: number }

export function CountLine(props: { count: CountView | null | undefined }): React.ReactElement | null {
  const count = props.count
  if (!count || count.total < 1) return null
  return h('div', { className: 'lp-actions' },
    h('span', { className: 'lp-small lp-strong' }, `累计 ${count.total} 天`),
    h('span', { className: 'lp-caption' }, `本季 ${count.season} 天 · 第 ${count.next_milestone} 天多一次抽卡机会`))
}
