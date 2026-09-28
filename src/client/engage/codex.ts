// Codex collection and the disclosed odds. Hidden when the person is under 18 or has opted out.

import React from 'react'

const h = React.createElement

export interface CodexView {
  enabled: boolean
  hidden: boolean
  reason_zh: string
  odds_zh: string | null
  draws_available: number
  draws_today: number
  daily_cap: number
  owned: Array<{ id: string; title_zh: string; body_zh: string; rarity_zh: string; family: string }>
}

export function CodexPanel(props: { codex: CodexView | null; onDraw: () => void; onOpt: (on: boolean) => void; busy: boolean; note: string }): React.ReactElement | null {
  const codex = props.codex
  if (!codex) return null
  if (codex.hidden) {
    return h('section', null,
      h('h3', { style: { margin: '8px 0 4px', fontSize: 14 } }, '长寿图鉴'),
      h('p', { style: { margin: 0 } }, codex.reason_zh || '图鉴没有打开。'),
      codex.reason_zh.includes('已关闭') ? h('button', { type: 'button', onClick: () => props.onOpt(true), style: buttonStyle }, '重新打开') : null)
  }
  return h('section', null,
    h('h3', { style: { margin: '8px 0 4px', fontSize: 14 } }, '长寿图鉴'),
    h('p', { style: { margin: '0 0 8px', lineHeight: 1.5 } }, codex.odds_zh),
    h('p', { style: { margin: '0 0 8px' } }, `可抽 ${codex.draws_available} 次 · 今天已抽 ${codex.draws_today} / ${codex.daily_cap}`),
    h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h('button', { type: 'button', onClick: props.onDraw, disabled: props.busy || codex.draws_available < 1, style: buttonStyle }, '抽一张'),
      h('button', { type: 'button', onClick: () => props.onOpt(false), style: buttonStyle }, '关闭图鉴')),
    props.note ? h('p', { style: { margin: '8px 0 0' } }, props.note) : null,
    codex.owned.length === 0
      ? h('p', { style: { opacity: 0.7 } }, '还没有抽到卡。次数只从测量、记录、就诊或复测来。')
      : h('ul', { style: { paddingLeft: 18, margin: '8px 0' } }, codex.owned.slice(0, 12).map((card) =>
        h('li', { key: card.id }, `${card.rarity_zh} · ${card.title_zh}`))))
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
