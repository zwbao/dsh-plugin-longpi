// Season dock in the shell overlay, plus registry seats for the integrator.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { registerOverviewCard, registerPageTab, registerSettingsSection } from '../registry.ts'
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
  const [open, setOpen] = React.useState(false)
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
    onFreeze: (reason) => { const day = shanghaiDay(); void run('/api/longpi/streak-freeze', { reason, from: day, to: day }) },
    onOpt: (on) => { void run('/api/longpi/nudges', { codex_enabled: on }) },
  }) : null
  if (page) {
    return h('div', { className: 'lp lp-season-page', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      failed ? h('p', null, failed) : null,
      panel ?? h('p', { className: 'lp-muted' }, '这一季正在读取。'))
  }
  if (view?.needs_consent && !open) return null
  const shell = {
    position: 'absolute' as const, left: 20, bottom: 136, zIndex: 1, pointerEvents: 'auto' as const, maxWidth: open ? 380 : 160,
    color: 'var(--lp-ink)',
  }
  const card = { background: 'var(--lp-layer-2)', color: 'var(--lp-ink)', boxShadow: 'var(--lp-lift, 0 4px 16px rgba(0,0,0,.12))' }
  const frozen = view?.streak.frozen ?? []
  return h(React.Fragment, null,
    h('style', null, '@media (max-width: 900px) { .lp-season-dock { display: none !important; } }'),
    frozen.length > 0 ? h('p', { className: 'lp-caption', id: 'lp-streak-freeze' }, `连续打卡冻结 ${frozen.length} 天（${frozen.slice(-3).map((row) => row.day).join('、')}）。`) : null,
    h('div', { className: 'lp lp-season-dock', style: shell },
      h('button', {
        type: 'button',
        onClick: () => { setOpen((value) => !value); void load() },
        style: { ...card, border: 0, borderRadius: 999, padding: '6px 12px', font: 'inherit', cursor: 'pointer' },
      }, view?.season ? `本季 · 第 ${view.season.week} 周` : '本季'),
      open ? h('div', {
        style: { ...card, marginTop: 8, maxHeight: '60vh', overflow: 'auto', padding: 12, borderRadius: 16, fontSize: 13, lineHeight: '20px' },
      },
        failed ? h('p', null, failed) : null,
        panel) : null),
    view?.nudge?.offer ? h(NudgeOffer, {
      offer: true,
      onAccept: () => { void run('/api/longpi/nudges', { nudge_in_workflow: true, offer_seen: true }) },
      onDismiss: () => { void run('/api/longpi/nudges', { dismiss: true, offer_seen: true }) },
    }) : null)
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

function SeasonDock(_props: Record<string, unknown>): React.ReactElement | null {
  return EngageDock({})
}

registerPageTab({ id: 'season', label_zh: '本季', order: 35, Component: SeasonPage })
registerOverviewCard({ id: 'season', order: 40, Component: SeasonDock })
registerSettingsSection({ id: 'season-reminder', order: 30, Component: EngageSettingsNote })

export { SeasonPanel } from './season-tab.ts'
export { freezeToday }
