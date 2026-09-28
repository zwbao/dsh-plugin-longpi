// One opt-in offer, then at most one in-workflow line a day. Never while a turn is running.

import React from 'react'

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
  return h('div', {
    className: 'lp',
    role: 'status',
    style: {
      position: 'static', marginTop: 8, maxWidth: '100%',
      padding: '8px 10px', borderRadius: 12, background: 'var(--lp-layer-2)', color: 'var(--lp-ink)',
      fontSize: 13, lineHeight: '18px',
    },
  },
    h('div', null, '要不要在别的对话里，偶尔看到一句这个赛季的事？默认关闭。'),
    h('div', { style: { display: 'flex', gap: 8, marginTop: 6 } },
      h('button', { type: 'button', onClick: props.onAccept, style: buttonStyle }, '偶尔一句'),
      h('button', { type: 'button', onClick: props.onDismiss, style: buttonStyle }, '不用')))
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--lp-line, #ddd)', background: 'transparent', borderRadius: 999, padding: '2px 8px', cursor: 'pointer', color: 'inherit', font: 'inherit',
}
