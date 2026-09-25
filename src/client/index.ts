// LongPi's seats in the DSH client: a full page with a 健康 entry in the
// sidebar, a greeting in place of the blank-session headline (which also
// places one row under the composer), an invisible prompt bridge in the input
// dock, a step in first-run onboarding, a LongPi page in settings, cards for
// five of its tools in the chat, and a reminder pill in the shell overlay.
// Nothing visible sits above the composer.

import React from 'react'
import { PANEL_ID } from './constants.ts'
import { HomeHero } from './home.ts'
import { PromptBridge } from './home-actions.ts'
import { Icon } from './icons.ts'
import { setModelProbe, setModelSettings, type SettingsFace } from './model-status.ts'
import { Onboarding } from './onboarding.ts'
import { LongPiPage } from './page.ts'
import { ReminderPill } from './pill.ts'
import { LongPiSettings } from './settings-page.ts'
import { injectStyles } from './styles.ts'
import { TOOL_VIEWS } from './toolviews.ts'
import type { Face } from './types.ts'

const h = React.createElement

interface Slots {
  inject: (name: string, factory: () => unknown) => unknown
  register: (options: Record<string, unknown>, component: unknown) => unknown
}

export interface ClientContext {
  slots: Slots
  layout?: { selectPanel: (id: string | null) => void }
  /** Cordis: run a callback once the named services exist (never, when they do not). */
  inject?: (deps: string[], callback: (ctx: { remote?: unknown; settingsScope?: unknown; effect?: (run: () => () => void, label?: string) => unknown }) => void) => unknown
}

export const inject = ['slots', 'layout']

/** The id of LongPi's page in DSH's settings (openSection('longpi')). */
export const SETTINGS_ID = 'longpi'

function PanelIcon(props: { size?: number }): React.ReactElement {
  return h(Icon, { name: 'health', size: props.size ?? 18 })
}

export function apply(ctx: ClientContext): void {
  injectStyles()
  // Looked up at click time: selectPanel throws for a panel that is not (yet) registered.
  const select = (id: string | null) => {
    try {
      ctx.layout?.selectPanel(id)
    } catch {
      // The panel is gone (plugin reloading); stay where we are.
    }
  }
  const face = (): Face => ({ openPage: () => select(PANEL_ID), openChat: () => select(null) })

  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, inject: face }, LongPiPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 5, label: () => '健康' }, PanelIcon))
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({ name: 'conversation.hero.brand.mark', inject: face }, HomeHero))
  // Rendered whenever a session exists, on the home and in a chat; draws nothing, inserts queued prompts.
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'dsh-plugin-longpi', order: 90 }, PromptBridge))
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({ name: 'settings.onboarding', id: 'longpi', order: 100, inject: face }, Onboarding))
  // After DSH's own pages (Models is order 10).
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: SETTINGS_ID, order: 60, label: () => 'LongPi', inject: face }, LongPiSettings))
  for (const [key, view] of Object.entries(TOOL_VIEWS)) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key, inject: face }, view))
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'longpi-reminders', order: 50, inject: face }, ReminderPill))
  // Whether a model key is set, for onboarding step 1: only when DSH exposes the Remote services
  // its Models page reads. Absent services leave the status unknown, and step 1 says nothing.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['remote', 'remote.llm', 'remote.credentials'], (sub) => {
      setModelProbe(sub.remote as Parameters<typeof setModelProbe>[0])
      sub.effect?.(() => () => setModelProbe(null), 'longpi: model status')
    })
    // The key reference the DeepSeek route reads (a custom apiKeyEnv); without it an unset default says nothing.
    ctx.inject(['settingsScope'], (sub) => {
      try {
        const scope = sub.settingsScope as { describe?: () => SettingsFace } | undefined
        setModelSettings(scope?.describe?.() ?? null)
      } catch {
        setModelSettings(null)
      }
      sub.effect?.(() => () => setModelSettings(null), 'longpi: model settings')
    })
  }
}
