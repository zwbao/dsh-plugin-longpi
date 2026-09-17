import type { Context } from '@deepseek-ai/cordis'
import '../host-shims.ts'
import { injectStyles } from './styles.ts'
import { registerDashboard } from './dashboard.ts'
import { registerSidebar } from './sidebar.ts'
import { registerDock } from './dock.ts'

export const inject = ['slots']

export function apply(ctx: Context): void {
  injectStyles()
  registerDashboard(ctx)
  registerSidebar(ctx)
  registerDock(ctx)
}
