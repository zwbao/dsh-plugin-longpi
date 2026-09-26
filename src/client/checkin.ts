// Today's check-ins, shared by the page (概览 and 方案), the row on the home
// and the chat card. Three answers per item and day: 完成 (done: true),
// 没做到 (done: false, an explicit miss) and 撤销 (done: null, today's record
// removed, unknown again). What was just answered shows at once on every
// surface and stays until a journey fetched after the answer says otherwise.

import React from 'react'
import { errorText, postJson } from './api.ts'
import { Icon } from './icons.ts'
import { bumpStore, journeyFetchedAt, notifyChanged, useStoreVersion } from './store.ts'
import type { CheckState, Journey } from './types.ts'

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

interface Mark {
  state: CheckState
  at: number
}

const marks = new Map<string, Mark>()

function keyOf(day: string, id: string): string {
  return `${day}|${id}`
}

/** The item's state today: a fresh local answer, else what the server says. */
export function checkStateOf(journey: Journey, id: string): CheckState {
  const mark = marks.get(keyOf(journey.today, id))
  if (mark && mark.at >= journeyFetchedAt()) return mark.state
  return journey.plan.checkin_items.find((row) => row.id === id)?.done_today ?? null
}

/** Post one answer for today. Resolves true when the server kept it. */
export async function postCheckIn(day: string, id: string, state: CheckState): Promise<void> {
  await postJson('/api/longpi/checkin', { item: id, done: state })
  marks.set(keyOf(day, id), { state, at: Date.now() })
  bumpStore()
  notifyChanged()
}

const SAID: Record<'true' | 'false' | 'null', string> = { true: '今天完成', false: '今天没做到', null: '已撤销今天的记录' }

export function saidText(title: string, state: CheckState): string {
  return state === null ? `「${title}」${SAID.null}。` : `已记下：${title}，${SAID[String(state) as 'true' | 'false']}。`
}

export function useCheckIns(journey: Journey, onNotice?: Notify): {
  stateOf: (id: string) => CheckState
  busy: string | null
  error: string | null
  answer: (id: string, title: string, state: CheckState) => void
} {
  useStoreVersion()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const today = journey.today
  const answer = React.useCallback((id: string, title: string, state: CheckState) => {
    setBusy(id)
    setError(null)
    postCheckIn(today, id, state)
      .then(() => onNotice?.(saidText(title, state), 'good'))
      .catch((err: unknown) => {
        const text = `没有记下「${title}」：${errorText(err, '请稍后再试')}`
        setError(text)
        onNotice?.(text, 'bad')
      })
      .finally(() => setBusy(null))
  }, [today, onNotice])
  return { stateOf: (id: string) => checkStateOf(journey, id), busy, error, answer }
}

/** How many of today's items have an answer, and how many are done. */
export function todayCounts(journey: Journey): { done: number; answered: number; total: number } {
  const items = journey.plan.checkin_items
  let done = 0
  let answered = 0
  for (const row of items) {
    const state = checkStateOf(journey, row.id)
    if (state === true) done += 1
    if (state !== null) answered += 1
  }
  return { done, answered, total: items.length }
}

const h = React.createElement

/**
 * The answer controls for one item: 完成 and 没做到 while unanswered; the
 * answer and 撤销 once given. Every state carries words, never color alone.
 */
export function CheckChoices(props: { title: string; state: CheckState; busy: boolean; onAnswer: (state: CheckState) => void }): React.ReactElement {
  const { state, busy } = props
  if (state === null) {
    return h('span', { className: 'lp-choices', role: 'group', 'aria-label': `${props.title}：今天` },
      h('button', { type: 'button', className: 'lp-choice lp-choice-done', disabled: busy, onClick: () => props.onAnswer(true) },
        h(Icon, { name: 'check', size: 13, strokeWidth: 2 }), busy ? '记录中' : '完成'),
      h('button', { type: 'button', className: 'lp-choice', disabled: busy, onClick: () => props.onAnswer(false) }, '没做到'))
  }
  return h('span', { className: 'lp-choices', role: 'group', 'aria-label': `${props.title}：今天` },
    h('span', { className: `lp-choice-state ${state ? 'lp-choice-state-done' : 'lp-choice-state-missed'}` },
      h(Icon, { name: state ? 'check' : 'close', size: 12, strokeWidth: 2 }), state ? '已完成' : '没做到'),
    h('button', { type: 'button', className: 'lp-choice lp-choice-undo', disabled: busy, onClick: () => props.onAnswer(null), 'aria-label': `撤销「${props.title}」今天的记录` },
      busy ? '撤销中' : '撤销'))
}
