// The one LongPi row under the composer on DSH's blank-session home, and the
// bridge that puts prompts into the composer. The row belongs to the greeting
// (home.ts renders it, portalled in right after the composer card), so it shows
// exactly when the greeting does and never under a running conversation: in
// the routine, today's check-ins (a tap opens 完成 / 没做到 / 撤销), the
// nearest retest and a link to the page; in
// every other stage, the journey's two prompts, which a tap puts into the
// composer (the person still decides whether to send them).
//
// PromptBridge sits in conversation.input.dock, which DSH renders on the home
// and in a chat whenever a session exists. It draws nothing: it takes the
// prompt a pill or the page queued in the store and inserts it. With no
// session (a fresh DSH has no workspace) there is no bridge, the prompt waits,
// and the row says what to do.

import React from 'react'
import { useCheckIns } from './checkin.ts'
import { chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { retestDates } from './plan.ts'
import {
  hasPendingPrompt, setPendingPrompt, setPromptNote, takePendingPrompt, useBridgeMounted, useComposerReady,
  usePendingVersion, usePromptNote, useTracking,
} from './store.ts'
import type { CheckState, Journey } from './types.ts'
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

/**
 * A check-in pill's three answers in a small popover under it: 完成, 没做到,
 * and 撤销 once there is an answer. Escape or a click elsewhere closes it.
 */
function CheckPill(props: { id: string; title: string; state: CheckState; busy: boolean; onAnswer: (state: CheckState) => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLSpanElement>(null)
  const menuId = `lp-pill-menu-${props.id.replace(/[^A-Za-z0-9_-]/g, '_')}`
  React.useEffect(() => {
    if (!open) return undefined
    const onDown = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const choose = (state: CheckState) => {
    setOpen(false)
    props.onAnswer(state)
  }
  const { state } = props
  const label = state === true ? '今天已完成' : state === false ? '今天没做到' : '今天还没记录'
  return h('span', { className: 'lp-task-wrap', ref: wrap },
    h('button', {
      type: 'button', className: `lp-task ${state === true ? 'lp-task-done' : state === false ? 'lp-task-missed' : ''}`,
      'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId, disabled: props.busy,
      title: `${label}，点一下记录`, 'aria-label': `${props.title}：${label}`,
      onClick: () => setOpen((current) => !current),
    },
    h('span', { className: 'lp-task-ring', 'aria-hidden': true },
      state === true ? h(Icon, { name: 'check', size: 10, strokeWidth: 2.4 }) : state === false ? h(Icon, { name: 'close', size: 9, strokeWidth: 2.4 }) : null),
    props.title),
    open ? h('span', { className: 'lp-task-menu', id: menuId, role: 'menu', 'aria-label': `${props.title}：今天` },
      h('button', { type: 'button', role: 'menuitem', className: 'lp-task-choice', disabled: state === true, onClick: () => choose(true) },
        h(Icon, { name: 'check', size: 12, strokeWidth: 2 }), '完成'),
      h('button', { type: 'button', role: 'menuitem', className: 'lp-task-choice', disabled: state === false, onClick: () => choose(false) }, '没做到'),
      state !== null ? h('button', { type: 'button', role: 'menuitem', className: 'lp-task-choice lp-task-undo', onClick: () => choose(null) }, '撤销') : null) : null)
}

function RoutineRow(props: { journey: Journey; openPage: () => void; note: string | null }): React.ReactElement {
  const { journey } = props
  const { stateOf, busy, error, answer } = useCheckIns(journey)
  const items = journey.plan.checkin_items
  const reminder = journey.reminders
    .filter((row) => row.kind === 'retest' && row.date)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]

  // Check-ins post straight to LongPi: no session or composer needed.
  const lead: React.ReactNode[] = items.map((row) => h(CheckPill, {
    key: row.id, id: row.id, title: row.title, state: stateOf(row.id), busy: busy === row.id,
    onAnswer: (state) => answer(row.id, row.title, state),
  }))
  if (items.length === 0 && journey.next.detail_zh) lead.push(h('span', { key: 'next' }, journey.next.detail_zh))
  return h('div', { className: 'lp lp-home-row', role: 'group', 'aria-label': 'LongPi 今天' },
    ...lead,
    reminder?.date
      ? h(RetestPart, { text: retestText(reminder.date, reminder.text_zh, journey.today), before: lead.length > 0 })
      : h(LaterRetest, { today: journey.today, before: lead.length > 0 }),
    h('button', { type: 'button', className: 'lp-row-link', onClick: props.openPage }, '健康页 →'),
    h(Note, { text: error ?? props.note }))
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
