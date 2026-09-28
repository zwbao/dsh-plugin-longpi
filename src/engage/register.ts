// Module entry (AA §3.1). Also started from the follow-up tools so it runs before M0 calls register().

import type { Context } from '@deepseek-ai/cordis'
import type { CoreDeps } from '../contracts/index.ts'
import { resolveDataDir } from '../paths.ts'
import { bootEngage } from './boot.ts'

export function register(ctx: Context, deps: CoreDeps): void {
  bootEngage(ctx, {
    dataDir: () => resolveDataDir(deps.config().dataDir),
    codexOn: () => deps.config().engage?.codex !== false,
    bus: deps.bus,
  })
}
