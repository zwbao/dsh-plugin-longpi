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

let workspaceId: Promise<string | null> | null = null
function healthWorkspaceId(): Promise<string | null> {
  workspaceId ??= getJson<{ workspace_id: string | null }>('/api/longpi/workspace').then((v) => v.workspace_id).catch(() => {
    workspaceId = null
    return null
  })
  return workspaceId
}

/**
 * Open a session in 健康对话 (a blank one when there is one), where LongPi's persona and tools are; a prompt the
 * page queued is put into its composer there. False when DSH cannot open workspaces or there is no 健康对话.
 */
export async function openHealthChat(): Promise<boolean> {
  const id = await healthWorkspaceId()
  if (!id || !opener) return false
  try {
    await opener(id)
    return true
  } catch {
    return false
  }
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
      onClick: () => { setError(''); void opener?.(id).catch(() => setError('未能打开，请在左侧「健康对话」中新建会话')) },
    }, h(Icon, { name: 'send', size: 14 }), '前往健康对话'),
    error ? h('span', { className: 'lp-form-error', role: 'alert' }, error) : null)
}
