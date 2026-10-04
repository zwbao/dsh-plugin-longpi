// LongPi's stylesheet: tokens, then base components, then each page's own layout (docs/design-system.md §6).

import { TOKENS } from './tokens.ts'
import { BASE } from './base.ts'
import { SHELL } from './shell.ts'
import { OVERVIEW } from './overview.ts'
import { INDICATORS } from './indicators.ts'
import { PLAN } from './plan.ts'
import { ANALYSIS } from './analysis.ts'
import { SETTINGS } from './settings.ts'
import { ONBOARDING } from './onboarding.ts'
import { CHAT } from './chat.ts'
import { CODEX } from './codex.ts'

export const CSS = [TOKENS, BASE, SHELL, OVERVIEW, INDICATORS, PLAN, ANALYSIS, SETTINGS, ONBOARDING, CHAT, CODEX].join('\n')

export function injectStyles(): void {
  const id = 'dsh-plugin-longpi-style'
  const existing = document.getElementById(id)
  // A plugin reload brings new CSS; replace the old sheet instead of keeping it.
  if (existing) {
    existing.textContent = CSS
    return
  }
  const style = document.createElement('style')
  style.id = id
  style.textContent = CSS
  document.head.appendChild(style)
}
