// Client modules register into client/registry.ts from here (AA §3.1).

import { registerPrivacyClient } from './privacy/index.ts'
import { registerScienceClient } from './science/index.ts'

let once = false

export function registerClientModules(): void {
  if (once) return
  once = true
  registerPrivacyClient()
  registerScienceClient()
}
