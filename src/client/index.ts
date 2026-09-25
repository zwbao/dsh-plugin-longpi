// LongPi's seats in the DSH client: a full page with a 健康 entry in the
// sidebar, a card on the blank-session home, prompts above the composer, a
// step in first-run onboarding, and a reminder pill in the shell overlay.

import React from 'react'
import { PANEL_ID } from './constants.ts'
import { SmartDock } from './dock.ts'
import { HomeCard } from './home.ts'
import { Icon } from './icons.ts'
import { Onboarding } from './onboarding.ts'
import { LongPiPage } from './page.ts'
import { ReminderPill } from './pill.ts'
import { injectStyles } from './styles.ts'
import type { Face } from './types.ts'

const h = React.createElement

interface Slots {
  inject: (name: string, factory: () => unknown) => unknown
  register: (options: Record<string, unknown>, component: unknown) => unknown
}

export interface ClientContext {
  slots: Slots
  layout?: { selectPanel: (id: string | null) => void }
}

export const inject = ['slots', 'layout']

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
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({ name: 'conversation.hero.brand.mark', inject: face }, HomeCard))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'dsh-plugin-longpi', order: 18, inject: face }, SmartDock))
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({ name: 'settings.onboarding', id: 'longpi', order: 100, inject: face }, Onboarding))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'longpi-reminders', order: 50, inject: face }, ReminderPill))
}
