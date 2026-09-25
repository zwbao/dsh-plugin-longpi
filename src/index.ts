import type { Context } from '@deepseek-ai/cordis'
import './host-shims.ts'
import { Config } from './config.ts'
import { registerCommands } from './commands.ts'
import { extractUserText, preGuard, wrapGuardMessage } from './guardrails.ts'
import { registerHarnessSkills } from './harness-skills.ts'
import { mountMirobody } from './mirobody.ts'
import { registerPrompt } from './prompt.ts'
import { registerRoutes } from './routes.ts'
import { registerTools } from './tools.ts'
import { registerTrackingTools } from './tools-tracking.ts'
import { registerFollowupTools } from './tools-followup.ts'
import { startFollowup, type FollowupState } from './followup.ts'
import { buildJourneyFull, followupStateOf, within } from './journey.ts'
import { loadCatalog } from './catalog.ts'
import { loadRecords } from './records.ts'
import { trackingGeneration } from './tracking.ts'
import { isoDay } from './interventions.ts'
import { resolveDataDir, resolveMirobodyPlugin, resolveSkillsHome } from './paths.ts'
import { bootstrapWorkspace, type WorkspaceRegistryLike } from './workspace.ts'

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
export { normalizeProfile, mergeProfile, readProfile, writeProfile, setConsent, EMPTY_PROFILE, estimatedAge, RISK_FACTS, RISK_FACT_ZH, FOCUS, FOCUS_ZH, CONSENT_VERSION } from './profile.ts'
export type { Profile, Focus, Consent, RiskFact } from './profile.ts'
export { summarizeIndicators, summarizeMedications, indicatorsFromTable } from './situation.ts'
export { parseCompact, tableOf, cellNumber } from './compact.ts'
export { loadRecords, loadSeries, loadDoseLog, loadCourses, invalidateRecords, mergeSelf, sameMeasure } from './records.ts'
export { readSelf, addSelf, deleteSelf, latestSelf, selfIndicators, selfSeries, SELF_KEYS, SELF_SPEC, SELF_ALIASES } from './selfmeasure.ts'
export type { SelfKey, SelfRow } from './selfmeasure.ts'
export { runSkill, reportExcerpt, readReceipts } from './runner.ts'
export { resolveSkillsHome, resolveMirobodyPlugin, resolveDataDir } from './paths.ts'
export { buildBoard } from './board.ts'
export { readiness, runReady, buildReport } from './overview.ts'
export { normalizePlan, savePlan, currentPlan, readPlans, addCheckIns, readCheckIns, isoDay, addDays, daysBetween } from './interventions.ts'
export { adherenceFor, evaluateMarker, evaluatePlan, resolveMarkers, suggestNext } from './evaluate.ts'
export { loadReference, markerFor, checkupMarkerFor, rcvBand, effectsFor } from './reference.ts'
export { buildTracking, invalidateTracking, trackingGeneration, modelGoals, homeBloodPressure, readFailed, PHENOAGE_SKILL, RISK_SKILL } from './tracking.ts'
export { buildJourney, buildJourneyFull, followupStateOf, retestsOf, stageNow, profileComplete, unansweredOf, within } from './journey.ts'
export type { Journey, Stage, RecordChange } from './journey.ts'
export { buildChanges, CHANGES_NOTE_ZH } from './changes.ts'
export { buildCalendar, escapeText, foldLine, retestDay } from './calendar.ts'
export {
  readFollowup, writeFollowup, publicFollowup, maskUrl, webhookUrlProblem, readFollowupLog, appendFollowupLog, sentToday, isoWeek, isoWeekday, inQuiet,
  decideFollowup, followupArmed, nextTimes, heldUntil, desktopCommand, desktopSupported, webhookRequest, webhookAnswer, sendFollowup, sendNow, setFollowupDeps,
  followupTick, startFollowup, followupResponse, followupSummary, DEFAULT_FOLLOWUP, FOLLOWUP_MAX_PER_DAY, FOLLOWUP_TEST_TEXT, WEBHOOK_KINDS,
} from './followup.ts'
export type { FollowupSettings, FollowupState, FollowupLogRow, FollowupDeps, SendResult } from './followup.ts'
export { followupTextProblem, followupApprovalReason } from './tools-followup.ts'
export { buildPlanBrief, draftPlan, acceptedPlan, expectedText, DRAFT_CATEGORIES } from './planner.ts'
export type { PlanBrief, PlanDraft, DraftItem } from './planner.ts'
export { bootstrapWorkspace, WORKSPACE_MARKER, WORKSPACE_DIR, WORKSPACE_TITLE } from './workspace.ts'
export type { WorkspaceRegistryLike, BootstrapResult } from './workspace.ts'
// 5.1 reads, doses and verdicts (tests and other modules): one block, so it merges apart from the lines above.
export { dosePattern, hasDose, stripDoses } from './dose.ts'
export { checkinStatus } from './interventions.ts'
export { recordReadable, tokenKey } from './records.ts'
export { candidatesFor, indicatorFor } from './measurements.ts'
export { skillEnv } from './runner.ts'
export { bridgeEnv } from './bridge.ts'
export { describeItem, describePlan, goalProblems } from './tracking.ts'
export { togetherZh } from './evaluate.ts'
export { factorFor } from './changes.ts'
export type { UnjudgedChange } from './changes.ts'

function logTo(ctx: Context, level: 'info' | 'warn', message: string): void {
  try {
    ctx.logger('longpi')[level](message)
  } catch {
    // a host without a logger
  }
}

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
  // What the follow-up decisions read: the journey and its tracking, within a deadline so a slow skill never stacks up.
  const followupState = async (deadlineMs: number): Promise<FollowupState> => {
    const dataDir = resolveDataDir(config.dataDir)
    const skillsHome = resolveSkillsHome(config.skillsHome)
    const records = await loadRecords(config, dataDir, mount.pluginHome)
    const built = await within(buildJourneyFull({ config, dataDir, skillsHome, catalog: loadCatalog(skillsHome), records, today: isoDay(), mount }), deadlineMs)
    if (!('value' in built)) throw new Error('journey not ready')
    return followupStateOf(built.value.journey, built.value.tracking)
  }
  registerTools(ctx, source, mount)
  registerTrackingTools(ctx, source, mount)
  registerFollowupTools(ctx, source, () => followupState(20_000).catch(() => null))
  startFollowup(ctx, () => ({ dataDir: resolveDataDir(config.dataDir), getState: () => followupState(60_000), generation: trackingGeneration }))
  registerHarnessSkills(ctx)
  registerPrompt(ctx, source, mount)
  registerRoutes(ctx, source, mount)
  registerCommands(ctx, source, mount)
  // Optional: without DSH's workspace registry the plugin loads as before. Cordis re-runs this when the
  // service comes back; the marker file keeps it to one workspace, ever.
  ctx.inject(['workspaceRegistry'], (scoped) => {
    const registry = (scoped as unknown as { workspaceRegistry?: WorkspaceRegistryLike }).workspaceRegistry
    void bootstrapWorkspace(registry, { dataDir: resolveDataDir(config.dataDir), enabled: config.bootstrapWorkspace !== false }).then((result) => {
      if (result.status === 'created') logTo(scoped, 'info', `created the 健康 workspace at ${result.path}`)
      else if (result.status === 'error') logTo(scoped, 'warn', `workspace bootstrap failed: ${result.error}`)
    })
  })

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
