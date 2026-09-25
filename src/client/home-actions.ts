// The one LongPi row under the composer on DSH's blank-session home. It shows
// only while the greeting does (never under a running conversation): in the
// routine, today's check-ins, the nearest retest and a link to the page; in
// every other stage, the journey's two prompts, which a tap puts into the
// composer (the person still decides whether to send them). It also picks up
// a prompt chosen on the LongPi page once the chat is showing.

import React from 'react'
import { errorText, postJson } from './api.ts'
import { chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { retestDates } from './plan.ts'
import { hasPendingPrompt, notifyChanged, takePendingPrompt, useHeroShowing, useJourney, usePendingVersion, useTracking } from './store.ts'
import type { Face, Journey } from './types.ts'
import { copyText } from './ui.ts'

const h = React.createElement

/** The composer's action face. Older DSH builds only offer setDraft, so every method is optional. */
interface InputActions {
  captureInsertion?: () => unknown
  insertText?: (text: string, span: unknown) => boolean
  setDraft?: (text: string) => void
}

interface ActionsProps extends Partial<Face> {
  inputActions?: InputActions
  input?: { draft?: string }
}

function insertInto(props: ActionsProps, text: string): boolean {
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

function RoutineRow(props: { journey: Journey; openPage: () => void; note: string | null }): React.ReactElement {
  const { journey } = props
  const [done, setDone] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)
  const items = journey.plan.checkin_items
  const reminder = journey.reminders
    .filter((row) => row.kind === 'retest' && row.date)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]

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
    failed || props.note ? h('span', { className: 'lp-row-note', role: 'status' }, failed ?? props.note) : null)
}

export function HomeActions(props: ActionsProps): React.ReactElement | null {
  const { journey } = useJourney()
  const heroShowing = useHeroShowing()
  const pending = usePendingVersion()
  const [note, setNote] = React.useState<string | null>(null)
  const latest = React.useRef(props)
  latest.current = props

  const place = React.useCallback((text: string) => {
    if (insertInto(latest.current, text)) {
      setNote(null)
      return
    }
    void copyText(text).then((copied) => setNote(copied ? '没能放进输入框，已复制，粘贴即可' : '没能放进输入框，请手动输入'))
  }, [])

  // A prompt picked on the LongPi page lands here once the chat is showing, home or not.
  React.useEffect(() => {
    if (!hasPendingPrompt()) return
    const text = takePendingPrompt()
    if (text) place(text)
  }, [pending, place])

  React.useEffect(() => {
    if (!note) return undefined
    const timer = window.setTimeout(() => setNote(null), 4000)
    return () => window.clearTimeout(timer)
  }, [note])

  if (!heroShowing || !journey) return null
  if (journey.stage === 'routine') return h(RoutineRow, { journey, openPage: () => props.openPage?.(), note })
  const suggestions = journey.suggestions.slice(0, 2)
  if (suggestions.length === 0) return null
  return h('div', { className: 'lp lp-home-row', role: 'group', 'aria-label': 'LongPi 建议的问题' },
    ...suggestions.map((row) => h('button', {
      key: row.id, type: 'button', className: 'lp-suggest', title: '放进输入框',
      onClick: () => place(row.text_zh),
    }, row.text_zh)),
    note ? h('span', { className: 'lp-row-note', role: 'status' }, note) : null)
}
