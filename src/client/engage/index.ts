// Season page and an in-flow header. Nothing from this module is position:fixed or position:absolute.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { registerPageTab, registerSettingsSection } from '../registry.ts'
import { NudgeOffer } from './nudge-pill.ts'
import { SeasonPanel, type SeasonView } from './season-tab.ts'

const h = React.createElement

function isView(value: unknown): value is SeasonView {
  return Boolean(value) && typeof value === 'object' && 'quests' in (value as Record<string, unknown>)
}

function shanghaiDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function EngageDock(props: { variant?: 'dock' | 'page' } = {}): React.ReactElement | null {
  const [view, setView] = React.useState<SeasonView | null>(null)
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState('')

  const load = React.useCallback(async () => {
    try {
      const next = await getJson<SeasonView>('/api/longpi/season')
      if (!isView(next)) return
      setView(next)
      setFailed('')
    } catch (error) {
      setFailed(errorText(error, '这一季没有读到'))
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function run(path: string, body: unknown): Promise<void> {
    setBusy(true)
    setNote('')
    try {
      const result = await postJson<SeasonView & { ok?: boolean; error?: string; note?: string; card?: { rarity_zh?: string; title_zh?: string; duplicate?: boolean }; questions_zh?: string[] }>(path, body)
      if (isView(result)) setView(result)
      else if (isView((result as { view?: unknown }).view)) setView((result as { view: SeasonView }).view)
      const card = result.card
      const extra = result.note || result.error || ''
      const drawn = card ? `抽到${card.rarity_zh ?? ''}「${card.title_zh ?? ''}」${card.duplicate ? '（重复）' : ''}` : ''
      const questions = Array.isArray(result.questions_zh) ? result.questions_zh.join(' ') : ''
      setNote([drawn, questions, extra].filter(Boolean).join(' '))
      if (!isView(result) && !isView((result as { view?: unknown }).view)) await load()
    } catch (error) {
      setNote(errorText(error, '没有完成'))
    } finally {
      setBusy(false)
    }
  }

  if (!view && !failed) return null
  const page = props?.variant === 'page'
  const panel = view ? h(SeasonPanel, {
    view,
    busy,
    note,
    onAction: (body) => { void run('/api/longpi/season', body) },
    onDraw: () => { void run('/api/longpi/codex/draw', {}) },
    onRun: (cardId) => { void run('/api/longpi/codex/run', { card_id: cardId }) },
    onFreeze: (reason) => { const day = shanghaiDay(); void run('/api/longpi/streak-freeze', { reason, from: day, to: day }) },
    onOpt: (on) => { void run('/api/longpi/nudges', { codex_enabled: on }) },
  }) : null
  if (page) {
    return h('div', { className: 'lp lp-season-page', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      failed ? h('p', null, failed) : null,
      panel ?? h('p', { className: 'lp-muted' }, '这一季正在读取。'),
      view?.nudge?.offer ? h(NudgeOffer, {
        offer: true,
        onAccept: () => { void run('/api/longpi/nudges', { nudge_in_workflow: true, offer_seen: true }) },
        onDismiss: () => { void run('/api/longpi/nudges', { dismiss: true, offer_seen: true }) },
      }) : null)
  }
  return null
}

/** In-flow season title. Hidden until the person opts in, so it never covers the page. */
export function SeasonBar(props: { onOpen?: () => void }): React.ReactElement | null {
  const [text, setText] = React.useState('')
  React.useEffect(() => {
    void getJson<SeasonView>('/api/longpi/season').then((view) => {
      const header = (view as SeasonView & { header?: { show?: boolean; text_zh?: string } }).header
      setText(header?.show && header.text_zh ? header.text_zh : '')
    }).catch(() => setText(''))
  }, [])
  if (!text) return null
  return h('button', { type: 'button', className: 'lp-season-bar', onClick: () => props.onOpen?.() }, text)
}

function freezeToday(reason: 'sick' | 'travel'): void {
  const today = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
  const day = fmt.format(today)
  void postJson('/api/longpi/streak-freeze', { reason, from: day, to: day })
}

export function EngageSettingsNote(_props?: Record<string, unknown>): React.ReactElement {
  const [line, setLine] = React.useState('没有方案时，有待解锁的检查或本季任务才会每周提醒一次；都没有就不发。')
  React.useEffect(() => {
    void getJson<SeasonView>('/api/longpi/season').then((view) => {
      if (view.reminder_zh) setLine(view.reminder_zh)
      else if (view.needs_consent) setLine('还没有同意使用说明，所以这一季和提醒都还没开始。')
    }).catch(() => { /* the static line stays */ })
  }, [])
  return h('p', { className: 'lp-caption', style: { marginTop: 8 } }, line)
}

function SeasonPage(_props: Record<string, unknown>): React.ReactElement | null {
  return EngageDock({ variant: 'page' })
}

registerPageTab({ id: 'season', label_zh: '本季', order: 35, Component: SeasonPage })
registerSettingsSection({ id: 'season-reminder', order: 30, Component: EngageSettingsNote })

export { SeasonPanel } from './season-tab.ts'
export { freezeToday }
