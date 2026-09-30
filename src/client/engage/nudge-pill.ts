// One opt-in offer, then at most one in-workflow line a day. Never while a turn is running.

import React from 'react'
import { Btn } from '../ui.ts'

const h = React.createElement

export function turnBusy(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-streaming="true"], button[aria-label="停止"], button[aria-label="停止生成"], button[aria-label="Stop"]'))
}

export function NudgeOffer(props: { offer: boolean; onAccept: () => void; onDismiss: () => void }): React.ReactElement | null {
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!props.offer) return undefined
    const timer = window.setInterval(() => setBusy(turnBusy()), 1000)
    return () => window.clearInterval(timer)
  }, [props.offer])
  if (!props.offer || busy || turnBusy()) return null
  return h('div', { className: 'lp-callout lp-callout-info', role: 'status' },
    h('div', { className: 'lp-callout-body' },
      h('p', null, '要不要在别的对话里，偶尔看到一句这个赛季的事？默认关闭。'),
      h('div', { className: 'lp-actions' },
        h(Btn, { size: 'sm', variant: 'outline', onClick: props.onAccept }, '偶尔一句'),
        h(Btn, { size: 'sm', variant: 'ghost', onClick: props.onDismiss }, '不用'))))
}
