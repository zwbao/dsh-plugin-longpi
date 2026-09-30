// The bridge that puts prompts into the composer. PromptBridge sits in
// conversation.input.dock, which DSH renders on the home and in a chat whenever
// a session exists. It draws nothing: it takes the prompt the page queued in the
// store and inserts it. With no session (a fresh DSH has no workspace) there is
// no bridge and the prompt waits. (The row of pills under the composer on the
// home is gone: LongPi no longer changes DSH's home.)

import React from 'react'
import { hasPendingPrompt, setPromptNote, takePendingPrompt, useBridgeMounted, usePendingVersion } from './store.ts'
import { copyText } from './ui.ts'

/** Shown while a prompt waits for a session to exist. */
export const WAIT_FOR_WORKSPACE = '先在输入框上方选择一个工作区，选好后会自动放进输入框'

/** The composer's action face. Older DSH builds only offer setDraft, so every method is optional. */
interface InputActions {
  captureInsertion?: () => unknown
  insertText?: (text: string, span: unknown) => boolean
  setDraft?: (text: string) => void
}

interface BridgeProps {
  inputActions?: InputActions
  input?: { draft?: string }
}

function insertInto(props: BridgeProps, text: string): boolean {
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

/**
 * Registered in conversation.input.dock; renders nothing. A queued prompt is
 * inserted as soon as the bridge sees it: at once for a pill on the home, and
 * when the chat shows for a prompt chosen on the page.
 */
export function PromptBridge(props: BridgeProps): null {
  useBridgeMounted()
  const pending = usePendingVersion()
  const latest = React.useRef(props)
  latest.current = props

  React.useEffect(() => {
    if (!hasPendingPrompt()) return undefined
    // One tick later, so a composer mounting in the same commit as the bridge is bound first.
    const timer = window.setTimeout(() => {
      const text = takePendingPrompt()
      if (!text) return
      if (insertInto(latest.current, text)) {
        setPromptNote(null)
        return
      }
      void copyText(text).then((copied) => setPromptNote(copied ? '没能放进输入框，已复制，粘贴即可' : '没能放进输入框，请手动输入'))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pending])

  return null
}
