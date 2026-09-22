import type { Context } from '@deepseek-ai/cordis'
import './host-shims.ts'
import { Config } from './config.ts'
import { registerCommands } from './commands.ts'
import { extractUserText, preGuard, wrapGuardMessage } from './guardrails.ts'
import { registerHarnessSkills } from './harness-skills.ts'
import { mountMirobody } from './mirobody.ts'
import { resolveMirobodyPlugin } from './paths.ts'
import { registerPrompt } from './prompt.ts'
import { registerRoutes } from './routes.ts'
import { registerTools } from './tools.ts'

export const name = 'dsh-plugin-longpi'
export const inject = ['tools']
export { Config }
export { preGuard, wrapGuardMessage } from './guardrails.ts'
export { PRODUCT_VERSION, TOOL_NAMES, HARNESS_SKILLS } from './version.ts'
export { parseFrontmatter, loadCatalog, parseReadme, commandExcerpt } from './catalog.ts'
export { matchSkills, domainSummary } from './match.ts'
export { normalizeProfile, readProfile, writeProfile, EMPTY_PROFILE, estimatedAge } from './profile.ts'
export { summarizeIndicators, summarizeMedications } from './situation.ts'
export { runSkill, reportExcerpt, readReceipts } from './runner.ts'
export { resolveSkillsHome, resolveMirobodyPlugin, resolveDataDir } from './paths.ts'
export { buildBoard } from './board.ts'

export async function apply(ctx: Context, config: Config): Promise<void> {
  const pluginHome = resolveMirobodyPlugin(config.mirobodyPluginHome)
  const mount = await mountMirobody(ctx, {
    pythonBin: config.pythonBin,
    mirobodyHome: config.mirobodyHome,
    mcpUrl: config.mcpUrl,
    mcpToken: config.mcpToken,
    timeoutMs: config.timeoutMs,
  }, pluginHome)
  const source = () => config
  registerTools(ctx, source, mount)
  registerHarnessSkills(ctx)
  registerPrompt(ctx, source, mount)
  registerRoutes(ctx, source, mount)
  registerCommands(ctx, source, mount)

  ctx.on('agent/pre-step', async (payload, next) => {
    const text = payload.messages.map((message) => extractUserText(message.content)).join('\n')
    const hit = preGuard(text)
    if (!hit) return next()
    const first = payload.messages[0]
    if (!first) return { kind: 'reject' }
    return {
      kind: 'enter',
      messages: [{
        ...first,
        content: [{ type: 'text', text: wrapGuardMessage(text, hit) }],
      }],
    }
  })
}
