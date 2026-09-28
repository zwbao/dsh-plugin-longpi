import type { ComponentType } from 'react'
import { registerToolView } from '../registry.ts'
import { AdviceCard } from './advice-card.ts'

/** The chat card for advise_on_substance. Client modules.ts does not call this until the integrator does. */
export function registerAdviceCard(): void {
  registerToolView({ tool: 'advise_on_substance', Component: AdviceCard as unknown as ComponentType<Record<string, unknown>> })
}
