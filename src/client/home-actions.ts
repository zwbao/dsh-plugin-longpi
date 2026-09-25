// The one LongPi row under the composer on DSH's blank-session home, and the
// bridge that puts prompts into the composer. The row belongs to the greeting
// (home.ts renders it, portalled in right after the composer card), so it shows
// exactly when the greeting does and never under a running conversation: in
// the routine, today's check-ins, the nearest retest and a link to the page; in
// every other stage, the journey's two prompts, which a tap puts into the
// composer (the person still decides whether to send them).
//
// PromptBridge sits in conversation.input.dock, which DSH renders on the home
// and in a chat whenever a session exists. It draws nothing: it takes the
// prompt a pill or the page queued in the store and inserts it. With no
// session (a fresh DSH has no workspace) there is no bridge, the prompt waits,
// and the row says what to do.

import React from 'react'
import { errorText, postJson } from './api.ts'
import { chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { retestDates } from './plan.ts'
import {
  hasPendingPrompt, notifyChanged, setPendingPrompt, setPromptNote, takePendingPrompt, useBridgeMounted, useComposerReady,
  usePendingVersion, usePromptNote, useTracking,
} from './store.ts'
import type { Journey } from './types.ts'
import { copyText } from './ui.ts'

const h = React.createElement

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

function Sep(): React.ReactElement {
  return h('span', { className: 'lp-row-sep', 'aria-hidden': true }, '·')
}

function retestText(date: string, what: string, today: string): string {
  return date <= today ? `可以${what}了` : `${chineseDate(date)}可${what}`
}

/** The retest part of the row, with the separators around it (the page link always follows). */
function RetestPart(props: { text: string | null; before: boolean }): React.ReactElement | null {
  if (!props.text) return props.before ? h(Sep) : null
  return h(React.Fragment, null, props.before ? h(Sep) : null, h('span', null, props.text), h(Sep))
}

/** Retest dates beyond the journey's 7-day reminder window live only in tracking; read it just for this line. */
function LaterRetest(props: { today: string; before: boolean }): React.ReactElement | null {
  const tracking = useTracking()
  const next = retestDates(tracking.data)[0]
  return h(RetestPart, { text: next ? retestText(next.date, `复测${next.marker}`, props.today) : null, before: props.before })
}

function Note(props: { text: string | null }): React.ReactElement | null {
  return props.text ? h('span', { className: 'lp-row-note', role: 'status' }, props.text) : null
}

function RoutineRow(props: { journey: Journey; openPage: () => void; note: string | null }): React.ReactElement {
  const { journey } = props
  const [done, setDone] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const items = journey.plan.checkin_items
  const reminder = journey.reminders
    .filter((row) => row.kind === 'retest' && row.date)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]

  // Check-ins post straight to LongPi: no session or composer needed.
  const checkIn = (id: string, title: string) => {
    setBusy(id)
    setFailed(null)
    postJson('/api/longpi/checkin', { item: id, done: true })
      .then(() => {
        setDone((current) => new Set(current).add(id))
        notifyChanged()
      })
      .catch((err: unknown) => setFailed(`没有记下「${title}」：${errorText(err, '请稍后再试')}`))
      .finally(() => setBusy(null))
  }

  const lead: React.ReactNode[] = items.map((row) => {
    const isDone = row.done_today || done.has(row.id)
    return h('button', {
      key: row.id, type: 'button', className: `lp-task ${isDone ? 'lp-task-done' : ''}`,
      'aria-pressed': isDone, disabled: busy === row.id,
      title: isDone ? '今天已完成' : '点一下记为今天完成',
      // A done item stays done: a second tap does nothing (undo lives on the page and in chat).
      onClick: isDone || busy ? undefined : () => checkIn(row.id, row.title),
    },
    h('span', { className: 'lp-task-ring', 'aria-hidden': true }, isDone ? h(Icon, { name: 'check', size: 10, strokeWidth: 2.4 }) : null),
    row.title)
  })
  if (items.length === 0 && journey.next.detail_zh) lead.push(h('span', { key: 'next' }, journey.next.detail_zh))
  return h('div', { className: 'lp lp-home-row', role: 'group', 'aria-label': 'LongPi 今天' },
    ...lead,
    reminder?.date
      ? h(RetestPart, { text: retestText(reminder.date, reminder.text_zh, journey.today), before: lead.length > 0 })
      : h(LaterRetest, { today: journey.today, before: lead.length > 0 }),
    h('button', { type: 'button', className: 'lp-row-link', onClick: props.openPage }, '健康页 →'),
    h(Note, { text: failed ?? props.note }))
}

/** The row itself; null when the stage has nothing for it (then the host stays empty and takes no room). */
export function HomeRow(props: { journey: Journey; openPage: () => void }): React.ReactElement | null {
  const { journey } = props
  const ready = useComposerReady()
  const bridgeNote = usePromptNote()
  usePendingVersion()
  // A prompt waiting with no session to take it: say what unblocks it, for as long as it waits.
  const note = bridgeNote ?? (!ready && hasPendingPrompt() ? WAIT_FOR_WORKSPACE : null)
  if (journey.stage === 'routine') return h(RoutineRow, { journey, openPage: props.openPage, note })
  const suggestions = journey.suggestions.slice(0, 2)
  if (suggestions.length === 0) return null
  return h('div', { className: 'lp lp-home-row', role: 'group', 'aria-label': 'LongPi 建议的问题' },
    ...suggestions.map((row) => h('button', {
      key: row.id, type: 'button', className: 'lp-suggest', title: '放进输入框',
      onClick: () => setPendingPrompt(row.text_zh, 'hero'),
    }, row.text_zh)),
    h(Note, { text: note }))
}
