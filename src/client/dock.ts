import React from 'react'
import { NAMESPACE } from './constants.ts'
import { SUGGESTED } from './prompts.ts'

export function registerDock(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: NAMESPACE, order: 25 },
    SuggestDock,
  ))
}

function SuggestDock(): React.ReactElement {
  const [copied, setCopied] = React.useState<string | null>(null)
  return React.createElement(
    'div',
    { className: 'lp-dock' },
    React.createElement('span', { className: 'lp-dock-kicker' }, 'LongPi'),
    ...SUGGESTED.map((s) => React.createElement('button', {
      key: s.id,
      type: 'button',
      className: copied === s.id ? 'lp-dock-chip lp-dock-chip-on' : 'lp-dock-chip',
      onClick: () => {
        void navigator.clipboard.writeText(s.zh).then(() => setCopied(s.id)).catch(() => setCopied(s.id))
      },
    }, s.zh)),
  )
}
