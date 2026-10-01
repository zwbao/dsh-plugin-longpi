// Codex collection and the disclosed odds. Hidden when the person is under 18 or has opted out.

import React from 'react'
import { CODEX_INTRO } from '../../ux/plain.ts'
import { Btn, Switch } from '../ui.ts'

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
    const closed = codex.reason_zh.includes('已关闭')
    return h('section', { className: 'lp-card', 'aria-label': '长寿图鉴' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title' }, '长寿图鉴'),
        closed ? h(Switch, { checked: false, label: '显示图鉴', disabled: props.busy, onChange: () => props.onOpt(true) }) : null),
      h('p', { className: 'lp-small lp-muted lp-measure' }, codex.reason_zh || '图鉴没有打开。'))
  }
  return h('section', { className: 'lp-card', 'aria-label': '长寿图鉴' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title' }, '长寿图鉴'),
      h(Switch, { checked: true, label: '显示图鉴', disabled: props.busy, onChange: () => props.onOpt(false) })),
    h('p', { className: 'lp-text lp-muted' }, CODEX_INTRO),
    h('details', null,
      h('summary', null, '概率说明'),
      h('ul', { className: 'lp-bullets' },
        h('li', null, '铜：细胞实验。'),
        h('li', null, '银：动物实验。'),
        h('li', null, '紫：观察人群。'),
        h('li', null, '金：分组做的人体试验，和几种长寿动物。'),
        h('li', null, '颜色不代表身体好坏。'),
        h('li', null, '连续 10 次里，至少有一次是银或更好。这不是指标变好了。'),
        codex.odds_zh ? h('li', null, codex.odds_zh) : null)),
    h('div', { className: 'lp-actions' },
      h(Btn, { onClick: props.onDraw, disabled: props.busy || codex.draws_available < 1 }, '抽一张'),
      h('span', { className: 'lp-caption' }, `可抽 ${codex.draws_available} 次 · 今天已抽 ${codex.draws_today} / ${codex.daily_cap}`)),
    props.note ? h('p', { className: 'lp-small lp-measure', role: 'status' }, props.note) : null,
    codex.owned.length === 0
      ? h('p', { className: 'lp-caption lp-measure' }, '还没有抽到卡。次数只从测量、记录、就诊或复测来。')
      : h('ul', { className: 'lp-rows' }, codex.owned.slice(0, 12).map((card) =>
        h('li', { key: card.id, className: 'lp-row' },
          h('div', { className: 'lp-row-main lp-season-card' },
            h('div', { className: 'lp-tags' }, h('span', { className: 'lp-tag' }, card.rarity_zh), h('span', { className: 'lp-strong' }, card.title_zh)),
            card.family === 'insight' ? h('p', { className: 'lp-muted lp-measure' }, card.body_zh) : null,
            card.offer ? h('p', { className: 'lp-muted lp-measure' }, card.offer.text_zh) : null),
          card.offer?.kind === 'run' && props.onRun
            ? h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy, onClick: () => props.onRun?.(card.id) }, '用我的记录算')
            : null))))
}
