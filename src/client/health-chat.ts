// 去健康对话: health conversations happen in the 健康对话 workspace (LongPi's persona and rules are scoped to it),
// so the 健康 page opens a new session there instead of taking over DSH's own home.

import React from 'react'
import { getJson } from './api.ts'
import { Icon } from './icons.ts'

const h = React.createElement

let opener: ((id: string) => Promise<void>) | null = null
export function setWorkspaceOpener(fn: ((id: string) => Promise<void>) | null): void {
  opener = fn
}

export function HealthChatButton(): React.ReactElement | null {
  const [id, setId] = React.useState<string | null>(null)
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    void getJson<{ workspace_id: string | null }>('/api/longpi/workspace').then((v) => setId(v.workspace_id)).catch(() => setId(null))
  }, [])
  if (!id || !opener) return null
  return h('span', { className: 'lp-healthchat' },
    h('button', {
      type: 'button', className: 'lp-linkbtn lp-healthchat-btn',
      onClick: () => { setError(''); void opener?.(id).catch(() => setError('没有打开，请在左侧「健康对话」里新建会话')) },
    }, h(Icon, { name: 'send', size: 14 }), '去健康对话'),
    error ? h('span', { className: 'lp-form-error', role: 'alert' }, error) : null)
}
