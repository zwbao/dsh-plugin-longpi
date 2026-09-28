// Client modules register into client/registry.ts from here (AA §3.1).

import { registerAdviceCard } from './advice/index.ts'
import { registerPrivacyClient } from './privacy/index.ts'
import { registerScienceClient } from './science/index.ts'

let once = false

export function registerClientModules(): void {
  if (once) return
  once = true
  registerAdviceCard()
  registerPrivacyClient()
  registerScienceClient()
}
