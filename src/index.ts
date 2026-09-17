import type { Context } from '@deepseek-ai/cordis'
import './host-shims.ts'
import { Config } from './config.ts'
import { extractUserText, preGuard, wrapGuardMessage } from './guardrails.ts'
import { registerCommands } from './commands.ts'
import { registerPrompt, formatRetrieveHint } from './prompt.ts'
import { registerRoutes } from './routes.ts'
import { registerSkills } from './skills.ts'
import { registerS2fTools } from './s2f/tools.ts'
import { registerTools } from './tools.ts'

export const name = 'dsh-plugin-longpi'
export const inject = ['tools']
export { Config }
export { retrieve } from './retrieve.ts'
export { preGuard } from './guardrails.ts'
export { CUSTOMER, findMetric, METRICS } from './fixture.ts'
export { routeQuery } from './s2f/routing.ts'
export { buildBatchRequest } from './s2f/penguin.ts'
export { annotateVariant } from './s2f/annotate.ts'
export { lookupEvidence } from './s2f/evidence.ts'
export { parseVcf } from './s2f/vcf.ts'
export { buildOmicsReport, PRODUCT_VERSION } from './s2f/report.ts'

interface PreStepPayload {
  messages: Array<{ content?: unknown }>
}

type PreStepDecision =
  | { kind: 'reject' }
  | { kind: 'enter'; messages: PreStepPayload['messages'] }

export function apply(ctx: Context, config: Config): void {
  const configSource = () => config

  registerTools(ctx, configSource)
  registerS2fTools(ctx, configSource)
  registerSkills(ctx)
  registerPrompt(ctx, configSource)
  registerRoutes(ctx, configSource)
  registerCommands(ctx)

  ctx.on('agent/pre-step', async (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => {
    const text = payload.messages.map((m) => extractUserText(m.content)).join('\n')
    const hit = preGuard(text)
    if (hit) {
      const first = payload.messages[0]
      if (!first) return { kind: 'reject' }
      return {
        kind: 'enter',
        messages: [{ ...first, content: [{ type: 'text', text: wrapGuardMessage(text, hit) }] }],
      }
    }
    const hint = formatRetrieveHint(text)
    if (hint && payload.messages[0]) {
      const first = payload.messages[0]
      const original = extractUserText(first.content)
      return {
        kind: 'enter',
        messages: [{ ...first, content: [{ type: 'text', text: `${original}\n\n${hint}` }] }],
      }
    }
    return next()
  })
}
