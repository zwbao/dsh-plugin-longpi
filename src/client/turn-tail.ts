// Quick actions under a finished turn (conversation.chat.turnTail). DSH folds a turn's tool calls, the LongPi
// cards among them, once the turn ends; what a card offers would be folded away with it. When the turn left
// something to do, one row under it offers it again:
//   a plan draft          采用这份方案 (the same confirm dialog as the card), or 已采用为方案第 N 版
//   a read-back waiting   确认保存 / 还要调整, which put a reply into the composer (the person still sends it)
//   a plan saved          已保存为方案第 N 版
//   today's check-ins     已记录：… with 撤销, or 已撤销
// then 在右侧查看 (the 健康 tab of the right column) and 健康页 →. Turns without LongPi calls get no row.

import React from 'react'
import { errorText } from './api.ts'
import { adoptedVersion, isUndone, setAdopted, setUndone, useCallState } from './call-state.ts'
import { postCheckIn } from './checkin.ts'
import { localToday } from './format.ts'
import { Icon } from './icons.ts'
import { normalizePlanDraft } from './normalize.ts'
import { usePaneOpener } from './pane.ts'
import { acceptDraft, ConfirmModal, keptGoals } from './plan-draft.ts'
import { requestView, setPendingPrompt, useJourney } from './store.ts'
import type { TailCall, TailMatch } from './turn-data.ts'
import type { Face } from './types.ts'

const h = React.createElement

type Raw = Record<string, unknown>

function objectOf(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string' && row.length > 0) : []
}

/** Adopt the turn's draft as drafted (removing items is the card's job, above). */
function DraftAction(props: { call: TailCall }): React.ReactElement | null {
  useCallState()
  const { journey } = useJourney()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const adopted = adoptedVersion(props.call.callId)
  let data = null
  try {
    data = props.call.result ? normalizePlanDraft(props.call.result) : null
  } catch {
    data = null
  }
  const draft = data?.draft
  if (!data || !draft) return null
  if (adopted != null) return h('span', { className: 'lp-chip-saved' }, h(Icon, { name: 'check', size: 12, strokeWidth: 2 }), `已采用为方案第 ${adopted} 版`)
  const source = { focus: data.brief.focus.map(String), markers: strings(props.call.args.markers) }

  async function accept(remind: boolean): Promise<void> {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const result = await acceptDraft(draft, draft.items, remind, source)
      if (!result.ok) {
        setError(`没有保存：${result.error}`)
        return
      }
      setAdopted(props.call.callId, result.version)
      setConfirming(false)
    } catch (err) {
      setError(`没有保存：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }

  return h(React.Fragment, null,
    h('button', { type: 'button', className: 'lp-tail-btn lp-tail-primary', onClick: () => { setError(null); setConfirming(true) } },
      h(Icon, { name: 'spark', size: 13 }), `采用这份方案（${draft.items.length} 项）`),
    confirming ? h(ConfirmModal, {
      draft, items: draft.items, goals: keptGoals(draft, draft.items), today: journey?.today ?? localToday(), busy, error,
      onCancel: () => setConfirming(false), onConfirm: (remind) => { void accept(remind) },
    }) : null)
}

/** Today's check-ins from this turn, with 撤销 while they can still be taken back. */
function CheckinAction(props: { call: TailCall }): React.ReactElement | null {
  useCallState()
  const { journey } = useJourney()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const today = journey?.today ?? localToday()
  const entries = (Array.isArray(objectOf(props.call.result).entries) ? objectOf(props.call.result).entries as unknown[] : []).map(objectOf)
  const undoable = entries.filter((row) => row.undo !== true && (row.done === true || row.done === false) && row.date === today && typeof row.item === 'string')
  if (undoable.length === 0) return null
  const names = undoable.map((row) => `${String(row.title || row.item)}${row.done === false ? '（没做到）' : ''}`).join('、')
  if (isUndone(props.call.callId)) return h('span', { className: 'lp-chip-saved lp-chip-undone' }, h(Icon, { name: 'close', size: 12, strokeWidth: 2 }), `已撤销：${names}`)

  async function undo(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      for (const row of undoable) await postCheckIn(today, String(row.item), null)
      setUndone(props.call.callId)
    } catch (err) {
      setError(`没有撤销：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }

  return h('span', { className: 'lp-tail-group' },
    h('span', { className: 'lp-chip-saved' }, h(Icon, { name: 'check', size: 12, strokeWidth: 2 }), `已记录：${names}`),
    h('button', { type: 'button', className: 'lp-tail-btn', disabled: busy, onClick: () => { void undo() }, 'aria-label': `撤销今天的打卡：${names}` }, busy ? '撤销中' : '撤销'),
    error ? h('span', { className: 'lp-form-error' }, error) : null)
}

export interface TurnTailProps extends Partial<Face> {
  /** What the chain selector found in this turn (selectLongPiTail). */
  matched?: TailMatch | null
}

export function LongPiTurnTail(props: TurnTailProps): React.ReactElement | null {
  const openPane = usePaneOpener()
  const match = props.matched
  if (!match) return null
  const savedVersion = typeof objectOf(match.saved?.result).version === 'number' ? objectOf(match.saved?.result).version as number : null
  const openPlan = props.openPage ? () => { requestView({ tab: 'plan', id: 'lp-plan' }); props.openPage?.() } : null
  const reply = (text: string) => setPendingPrompt(text, 'page')
  return h('div', { className: 'lp lp-turn-tail', role: 'group', 'aria-label': 'LongPi 快捷操作' },
    match.draft ? h(DraftAction, { call: match.draft }) : null,
    match.readBack && !match.saved ? h('span', { className: 'lp-tail-group' },
      h('span', { className: 'lp-caption' }, '方案还没有保存'),
      h('button', { type: 'button', className: 'lp-tail-btn lp-tail-primary', onClick: () => reply('确认，保存这份方案') }, h(Icon, { name: 'check', size: 13 }), '确认保存'),
      h('button', { type: 'button', className: 'lp-tail-btn', onClick: () => reply('我想调整一下：') }, '还要调整')) : null,
    match.saved ? h('span', { className: 'lp-chip-saved' }, h(Icon, { name: 'check', size: 12, strokeWidth: 2 }), savedVersion != null ? `已保存为方案第 ${savedVersion} 版` : '方案已保存') : null,
    match.checkin ? h(CheckinAction, { call: match.checkin }) : null,
    h('span', { className: 'lp-tail-links' },
      openPane ? h('button', { type: 'button', className: 'lp-row-link', onClick: openPane }, '在右侧查看') : null,
      openPlan ? h('button', { type: 'button', className: 'lp-row-link', onClick: openPlan }, '健康页 →') : null))
}
