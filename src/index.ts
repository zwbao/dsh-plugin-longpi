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
import { registerTrackingTools } from './tools-tracking.ts'

export const name = 'dsh-plugin-longpi'
export const inject = ['tools']
export { Config }
export { preGuard, wrapGuardMessage, rememberMedications } from './guardrails.ts'
export { PRODUCT_VERSION, TOOL_NAMES, HARNESS_SKILLS } from './version.ts'
export { parseFrontmatter, loadCatalog, parseReadme, commandExcerpt } from './catalog.ts'
export { matchSkills, domainSummary, organismsAsked, organismOf } from './match.ts'
export { detectIntents, mentionedEntities, loadEvidenceLexicon } from './intents.ts'
export { normalizeUnit, foldName, nameVariants, parseNumber } from './units.ts'
export { stageMeasurements, runnableFrom, unitFactor } from './measurements.ts'
export { recordOutputs, readHistory, latestOutputs, seriesOf, readResultFile } from './history.ts'
export { buildStats, writeStats } from './stats.ts'
export { manifestSummary, versionCheck } from './tools.ts'
export { normalizeProfile, readProfile, writeProfile, EMPTY_PROFILE, estimatedAge } from './profile.ts'
export { summarizeIndicators, summarizeMedications, indicatorsFromTable } from './situation.ts'
export { parseCompact, tableOf, cellNumber } from './compact.ts'
export { loadRecords, loadSeries, loadDoseLog, loadCourses, invalidateRecords } from './records.ts'
export { runSkill, reportExcerpt, readReceipts } from './runner.ts'
export { resolveSkillsHome, resolveMirobodyPlugin, resolveDataDir } from './paths.ts'
export { buildBoard } from './board.ts'
export { readiness, runReady, buildReport } from './overview.ts'
export { normalizePlan, savePlan, currentPlan, readPlans, addCheckIns, readCheckIns, isoDay, addDays, daysBetween } from './interventions.ts'
export { adherenceFor, evaluateMarker, evaluatePlan, resolveMarkers, suggestNext } from './evaluate.ts'
export { loadReference, markerFor, rcvBand, effectsFor } from './reference.ts'
export { buildTracking, invalidateTracking, modelGoals, PHENOAGE_SKILL, RISK_SKILL } from './tracking.ts'

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
  registerTrackingTools(ctx, source, mount)
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
