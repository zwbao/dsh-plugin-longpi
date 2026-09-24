// Two or three prompts above the composer, chosen by the server for the
// person's stage and focus. A click puts the words in the composer; the
// person still decides whether to send them.

import React from 'react'
import { Mark } from './icons.ts'
import { hasPendingPrompt, takePendingPrompt, useJourney, usePendingVersion } from './store.ts'
import type { Face } from './types.ts'
import { copyText } from './ui.ts'

const h = React.createElement

/** The composer's action face. Older DSH builds only offer setDraft, so every method is optional. */
interface InputActions {
  captureInsertion?: () => unknown
  insertText?: (text: string, span: unknown) => boolean
  setDraft?: (text: string) => void
}

interface DockProps extends Partial<Face> {
  inputActions?: InputActions
  input?: { draft?: string }
}

function insertInto(props: DockProps, text: string): boolean {
  const actions = props.inputActions
  try {
    if (actions?.captureInsertion && actions.insertText) {
      return actions.insertText(text, actions.captureInsertion()) === true
    }
    if (actions?.setDraft) {
      const draft = (props.input?.draft ?? '').replace(/\s+$/, '')
      actions.setDraft(draft ? `${draft} ${text}` : text)
      return true
    }
  } catch {
    return false
  }
  return false
}

export function SmartDock(props: DockProps): React.ReactElement | null {
  const { journey } = useJourney()
  const pending = usePendingVersion()
  const [message, setMessage] = React.useState<string | null>(null)
  const latest = React.useRef(props)
  latest.current = props

  const place = React.useCallback((text: string) => {
    if (insertInto(latest.current, text)) {
      setMessage(null)
      return
    }
    void copyText(text).then((copied) => setMessage(copied ? '没能放进输入框，已复制，粘贴即可' : '没能放进输入框，请手动输入'))
  }, [])

  // A prompt picked on the LongPi page lands here once the chat is showing.
  React.useEffect(() => {
    if (!hasPendingPrompt()) return
    const text = takePendingPrompt()
    if (text) place(text)
  }, [pending, place])

  React.useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  const suggestions = journey?.suggestions ?? []
  if (suggestions.length === 0) return null
  return h('div', { className: 'lp lp-dock', role: 'group', 'aria-label': 'LongPi 建议的问题' },
    h('span', { className: 'lp-dock-mark' }, h(Mark, { size: 14 }), 'LongPi'),
    ...suggestions.slice(0, 3).map((row) => h('button', {
      key: row.id, type: 'button', className: 'lp-dock-pill', title: '放进输入框',
      onClick: () => place(row.text_zh),
    }, row.text_zh)),
    message ? h('span', { className: 'lp-dock-note', role: 'status' }, message) : null)
}
