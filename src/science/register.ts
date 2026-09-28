// Module entry. Routes always answer (off and live explain themselves). Tools and the skill run only in simulated mode.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { CoreDeps } from '../contracts/index.ts'
import { activeStudyIds } from './consent-flow.ts'
import { scienceCandidates } from './community.ts'
import { effectiveMode, startScience } from './index.ts'
import { registerScienceRoutes } from './routes.ts'
import { registerScienceTools } from './tools.ts'

function skillFile(): string | null {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [join(here, '../../skills/longpi-science/SKILL.md'), join(here, '../skills/longpi-science/SKILL.md')]
  return candidates.find((path) => existsSync(path)) ?? null
}

export function register(ctx: Context, deps: CoreDeps): void {
  startScience({
    configured: () => deps.config().scienceMode,
    dataDir: () => deps.dataDir(),
  })
  registerScienceRoutes(deps)
  if (effectiveMode() !== 'simulated') return
  deps.nba.register('M8', () => scienceCandidates('simulated', activeStudyIds(deps.dataDir()).length))
  registerScienceTools(ctx, deps)
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (!decision || decision.kind !== 'allow') return decision
    if (exec.name !== 'record_study_consent') return decision
    return { kind: 'ask', reason: '记下参加这项研究的同意。原始化验、姓名和基因不会离开这台电脑。请确认说明已经看过，并且理解测验是本人答的。' }
  })
  const path = skillFile()
  if (!path) return
  ctx.inject(['skills'], (scoped) => {
    const raw = readFileSync(path, 'utf8')
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return
    const name = match[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim()
    const description = match[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim()
    if (!name || !description) return
    scoped.skills.register({ name, description, content: (match[2] ?? '').trim(), source: 'runtime', invocation: { modelInvocable: true, userInvocable: false } })
  })
}
