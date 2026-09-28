// The streak line: frozen sick and travel days are bridges, not broken days.

import React from 'react'

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
  return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } },
    h('span', null, `连续 ${streak.current} 天`),
    h('span', { style: { opacity: 0.7 } }, `最好 ${streak.best} 天`),
    h('span', { style: { opacity: 0.7 } }, frozen > 0 ? `冻结 ${frozen} 天` : `还可冻结 ${streak.freezes_available} 天`),
    h('button', { type: 'button', onClick: () => props.onFreeze('sick'), disabled: props.busy, style: buttonStyle }, '今天生病'),
    h('button', { type: 'button', onClick: () => props.onFreeze('travel'), disabled: props.busy, style: buttonStyle }, '今天出行'))
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--lp-line-2, rgba(0,0,0,.12))',
  background: 'transparent',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
  color: 'var(--lp-ink)',
  font: 'inherit',
}
