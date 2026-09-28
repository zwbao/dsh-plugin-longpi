// Codex collection and the disclosed odds. Hidden when the person is under 18 or has opted out.

import React from 'react'
import { CODEX_INTRO } from '../../ux/plain.ts'

const h = React.createElement

export interface CodexView {
  enabled: boolean
  hidden: boolean
  reason_zh: string
  odds_zh: string | null
  draws_available: number
  draws_today: number
  daily_cap: number
  owned: Array<{ id: string; title_zh: string; body_zh: string; rarity_zh: string; family: string; offer?: { kind: string; text_zh: string; label?: string | null } }>
}

export function CodexPanel(props: { codex: CodexView | null; onDraw: () => void; onOpt: (on: boolean) => void; onRun?: (cardId: string) => void; busy: boolean; note: string }): React.ReactElement | null {
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
    h('p', { style: { margin: '0 0 8px', lineHeight: 1.5 } }, CODEX_INTRO),
    h('details', null,
      h('summary', null, '概率说明'),
      h('ul', { style: { margin: '8px 0', paddingLeft: 18, lineHeight: 1.5 } },
        h('li', null, '铜：细胞实验。'),
        h('li', null, '银：动物实验。'),
        h('li', null, '紫：观察人群。'),
        h('li', null, '金：分组做的人体试验，和几种长寿动物。'),
        h('li', null, '颜色不代表身体好坏。'),
        h('li', null, '连续 10 次里，至少有一次是银或更好。这不是指标变好了。'),
        codex.odds_zh ? h('li', null, codex.odds_zh) : null)),
    h('p', { style: { margin: '0 0 8px' } }, `可抽 ${codex.draws_available} 次 · 今天已抽 ${codex.draws_today} / ${codex.daily_cap}`),
    h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h('button', { type: 'button', onClick: props.onDraw, disabled: props.busy || codex.draws_available < 1, style: buttonStyle }, '抽一张'),
      h('button', { type: 'button', onClick: () => props.onOpt(false), style: buttonStyle }, '关闭图鉴')),
    props.note ? h('p', { style: { margin: '8px 0 0' } }, props.note) : null,
    codex.owned.length === 0
      ? h('p', { style: { opacity: 0.7 } }, '还没有抽到卡。次数只从测量、记录、就诊或复测来。')
      : h('ul', { style: { paddingLeft: 18, margin: '8px 0' } }, codex.owned.slice(0, 12).map((card) =>
        h('li', { key: card.id },
          h('div', null, `${card.rarity_zh} · ${card.title_zh}`),
          card.family === 'insight' ? h('div', null, card.body_zh) : null,
          card.offer ? h('div', null, card.offer.text_zh) : null,
          card.offer?.kind === 'run' && props.onRun ? h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onRun?.(card.id) }, '用我的记录算') : null))))
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
