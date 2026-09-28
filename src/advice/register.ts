// Module entry. src/modules.ts calls register(ctx, deps). The guard also calls mountAdvice so the
// tool exists on the running plugin before the integrator passes CoreDeps.

import type { Context } from '@deepseek-ai/cordis'
import type { CoreDeps } from '../contracts/index.ts'
import { adviceFor } from './index.ts'
import { adviseOnSubstance } from './tools.ts'

const mounted = new WeakSet<object>()

/** Register advise_on_substance once. Safe when the host has no tool registry. */
export function mountAdvice(ctx: Context): void {
  const host = ctx as { tools?: { register?: (tool: unknown) => unknown } }
  if (!host.tools?.register || mounted.has(ctx)) return
  try {
    host.tools.register(adviseOnSubstance)
    mounted.add(ctx)
  } catch {
    // a host without the tool schema
  }
}

export function register(ctx: Context, deps: CoreDeps): void {
  mountAdvice(ctx)
  try {
    deps.validators.register({
      id: 'advice.no-individual-rx',
      owner: 'M2',
      applies: ['advice'],
      check(text) {
        if (/你(?:可以|应该)?(?:每天|每周)(?:吃|服|打)\s*\d+\s*(?:mg|毫克)/i.test(text) && /二甲双胍|他汀|雷帕|胰岛素|华法林/.test(text)) return 'individual prescription dose'
        if (/你可以停|建议你停掉|换成.{0,6}自己/.test(text)) return 'start stop or switch'
        return null
      },
    })
    deps.nba.register('M2', () => [])
    deps.http.route('GET', '/api/longpi/advice', async (req) => {
      const url = String((req as { url?: string }).url ?? '')
      const subject = new URL(url || '/', 'http://local').searchParams.get('subject') ?? ''
      return { advice: adviceFor(subject, deps.memory) }
    })
  } catch {
    // deps are stubs until the integrator finishes CoreDeps
  }
}
