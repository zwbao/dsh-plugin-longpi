// The one prompt slot in the DSH workday (docs/codex-design.md §2), in DSH's own style: the top row of the right
// 健康 pane, or a small bar at the bottom right when that pane is not on screen. Two kinds only: the stand-up
// reminder (wristband owners who turned it on, ≥90 min of continuous use, an agent turn running ≥60 s, no typing in
// the last 10 s; no reward, no health number, no time promise) and, on a reveal day, 「有一张实验卡可以翻了」.
// Also here: the page's in-flow 赛季 line and the 演示模式 switch (sidebar foot, a shortcut, a slash command).

import React from 'react'
import { PANEL_ID } from '../constants.ts'
import { Icon } from '../icons.ts'
import { usePageShowing, usePaneShowing } from '../store.ts'
import type { Face } from '../types.ts'
import { Btn } from '../ui.ts'
import { installActivity, noteTurnRunning, sittingMinutes, turnBusy, turnRunningMs, typedWithin } from './activity.ts'
import { setPresentation, slotEvent, togglePresentation, useSlot } from './slot-store.ts'

const h = React.createElement

import { nextPrompt, STANDUP_VISIBLE_MS, TYPING_MS, type Prompt } from './slot-rules.ts'

// One prompt at a time, shared by the pane row and the bottom-right bar so it is recorded once.
let prompt: Prompt | null = null
let promptVersion = 0
const promptListeners = new Set<() => void>()
function setPrompt(next: Prompt | null): void {
  prompt = next
  promptVersion += 1
  for (const listener of promptListeners) listener()
}
function usePrompt(): Prompt | null {
  React.useSyncExternalStore((listener) => {
    promptListeners.add(listener)
    return () => { promptListeners.delete(listener) }
  }, () => promptVersion, () => promptVersion)
  return prompt
}

function useTick(ms: number): void {
  const [, set] = React.useState(0)
  React.useEffect(() => {
    const timer = window.setInterval(() => set((n) => n + 1), ms)
    return () => window.clearInterval(timer)
  }, [ms])
}

function useDecide(running: boolean): Prompt | null {
  const slot = useSlot()
  const current = usePrompt()
  useTick(5000)
  React.useEffect(() => installActivity(), [])
  noteTurnRunning(running)
  React.useEffect(() => {
    const now = Date.now()
    if (current) {
      if (slot.presentation) setPrompt(null)
      else if (current.kind === 'standup' && now - current.at > STANDUP_VISIBLE_MS) setPrompt(null)
      return
    }
    const next = nextPrompt({
      enabled: slot.enabled,
      presentation: slot.presentation,
      standup: slot.slot.standup,
      reveal: slot.slot.reveal,
      sitting: sittingMinutes(now),
      turnMs: turnRunningMs(now),
      typing: typedWithin(TYPING_MS, now),
      now,
    })
    if (!next) return
    setPrompt(next)
    if (next.kind === 'standup') slotEvent('shown')
    else slotEvent('reveal_shown', next.ref)
  })
  return current
}

function PromptRow(props: { prompt: Prompt; openCodex: () => void; className: string }): React.ReactElement {
  const p = props.prompt
  const buttons = p.kind === 'standup'
    ? [
      h(Btn, { key: 'ok', size: 'sm', variant: 'outline', onClick: () => { slotEvent('ok'); setPrompt(null) } }, '好'),
      h(Btn, { key: 'off', size: 'sm', variant: 'ghost', onClick: () => { slotEvent('dismiss_today'); setPrompt(null) } }, '今天别提醒了'),
    ]
    : [
      h(Btn, { key: 'go', size: 'sm', variant: 'outline', onClick: () => { slotEvent('reveal_open', p.ref); setPrompt(null); props.openCodex() } }, '去看'),
      h(Btn, { key: 'later', size: 'sm', variant: 'ghost', onClick: () => { slotEvent('reveal_later', p.ref); setPrompt(null) } }, '稍后'),
    ]
  return h('div', { className: props.className, role: 'status' },
    h('span', { className: 'lp-slot-text' }, p.text),
    h('span', { className: 'lp-slot-actions' }, ...buttons))
}

/** The pane's top row: the prompt, or in presentation mode the one line 「演示模式中」. */
export function PaneSlot(props: { openCodex: () => void; running?: boolean }): React.ReactElement | null {
  const slot = useSlot()
  const current = useDecide(props.running ?? turnBusy())
  if (slot.presentation) return null
  if (!current) return null
  return h(PromptRow, { prompt: current, openCodex: props.openCodex, className: 'lp-slot lp-slot-pane' })
}

type PanelInfoHook = (select: (info: { activePanelId: string | null }) => boolean) => boolean
type SessionsHook = (select: (state: { byId?: Record<string, { running?: boolean }> }) => boolean) => boolean
interface OverlayProps extends Partial<Face> { usePanelInfo?: PanelInfoHook; useSessions?: SessionsHook }

function Bar(props: OverlayProps & { hidden: boolean; running: boolean }): React.ReactElement | null {
  const current = useDecide(props.running)
  if (!current || props.hidden) return null
  const open = () => {
    try { window.localStorage.setItem('dsh-plugin-longpi.page-tab', 'codex') } catch { /* the page opens on its last tab */ }
    props.openPage?.()
  }
  return h('div', { className: 'lp lp-slot-wrap' }, h(PromptRow, { prompt: current, openCodex: open, className: 'lp-slot lp-slot-bar' }))
}

function useBusy(useSessions: SessionsHook | undefined): boolean {
  // Called unconditionally below: the component that calls it is chosen once from the props.
  return useSessions ? useSessions((state) => Object.values(state.byId ?? {}).some((row) => row.running === true)) : turnBusy()
}

function WithHooks(props: OverlayProps): React.ReactElement | null {
  const active = props.usePanelInfo ? props.usePanelInfo((info) => info.activePanelId === PANEL_ID) : false
  const page = usePageShowing()
  const pane = usePaneShowing()
  const running = useBusy(props.useSessions)
  return h(Bar, { ...props, hidden: active || page || pane, running })
}

/** shell.overlay: the bottom-right bar when neither the pane nor the page is on screen. */
export function CodexOverlay(props: OverlayProps): React.ReactElement | null {
  const key = `${typeof props.usePanelInfo}-${typeof props.useSessions}`
  return h(WithHooks, { ...props, key })
}

/** The page's in-flow line under the header: what the Codex has going, never a value. */
export function SeasonBar(props: { onOpen?: () => void }): React.ReactElement | null {
  const slot = useSlot()
  if (!slot.enabled || slot.presentation) return null
  const text = slot.ready > 0 ? '长寿图鉴 · 有一张实验卡可以翻了' : slot.pane_zh ? `长寿图鉴 · ${slot.pane_zh}` : ''
  if (!text) return null
  return h('button', { type: 'button', className: 'lp-season-bar', onClick: () => props.onOpen?.() },
    h(Icon, { name: 'spark', size: 14 }), h('span', { className: 'lp-banner-text' }, text), h(Icon, { name: 'chevron', size: 14 }))
}

/** sidebar.footer.action: 演示模式 on/off, always reachable. */
export function PresentationButton(_props: Record<string, unknown>): React.ReactElement {
  const slot = useSlot()
  const on = slot.presentation
  return h('button', {
    type: 'button',
    className: `lp lp-present-btn ${on ? 'lp-present-on' : ''}`,
    'aria-pressed': on,
    title: on ? '演示模式已打开：LongPi 的提示和健康栏内容都已隐藏（⌘⌥P / Ctrl+Alt+P）' : '演示模式：投屏或开会时隐藏 LongPi 的提示和健康栏内容（⌘⌥P / Ctrl+Alt+P）',
    onClick: () => togglePresentation(),
  }, h(Icon, { name: 'lock', size: 14 }), on ? '演示中' : '演示')
}

/** ⌘⌥P / Ctrl+Alt+P toggles presentation mode anywhere in DSH. */
export function installPresentationShortcut(): () => void {
  if (typeof document === 'undefined') return () => {}
  const onKey = (event: KeyboardEvent) => {
    if (event.code !== 'KeyP' || !event.altKey || !(event.metaKey || event.ctrlKey) || event.shiftKey) return
    event.preventDefault()
    togglePresentation()
  }
  document.addEventListener('keydown', onKey, true)
  return () => document.removeEventListener('keydown', onKey, true)
}

/** The /演示模式 command where DSH offers client commands. */
export function presentationCommand() {
  return {
    name: '演示模式',
    description: () => '打开或关闭演示模式：隐藏 LongPi 的提示和健康栏内容',
    available: () => true,
    ui: { kind: 'action' as const, run: () => togglePresentation() },
  }
}

export { setPresentation }
