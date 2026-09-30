// The streak line: frozen sick and travel days are bridges, not broken days.

import React from 'react'
import { Btn } from '../ui.ts'

const h = React.createElement

export interface StreakView {
  current: number
  best: number
  freezes_available: number
  frozen: Array<{ day: string; reason: string }>
}

export function StreakLine(props: { streak: StreakView | null; onFreeze: (reason: 'sick' | 'travel') => void; busy: boolean }): React.ReactElement | null {
  const streak = props.streak
  if (!streak) return null
  const frozen = streak.frozen.length
  return h('div', { className: 'lp-actions' },
    h('span', { className: 'lp-small lp-strong' }, `连续 ${streak.current} 天`),
    h('span', { className: 'lp-caption' }, `最好 ${streak.best} 天 · ${frozen > 0 ? `冻结 ${frozen} 天` : `还可冻结 ${streak.freezes_available} 天`}`),
    h(Btn, { size: 'sm', variant: 'outline', onClick: () => props.onFreeze('sick'), disabled: props.busy }, '今天生病'),
    h(Btn, { size: 'sm', variant: 'outline', onClick: () => props.onFreeze('travel'), disabled: props.busy }, '今天出行'))
}
