import type { Context } from '@deepseek-ai/cordis'
import './host-shims.ts'
import { Config } from './config.ts'
import { registerCommands } from './commands.ts'
import { createGuard } from './guard-llm.ts'
import { registerApprovals } from './tools-approval.ts'
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
import { invalidateRecords, loadRecords } from './records.ts'
import { invalidateTracking, trackingGeneration } from './tracking.ts'
import { isoDay } from './interventions.ts'
import { resolveDataDir, resolveMirobodyPlugin, resolveSkillsHome } from './paths.ts'
import { bootstrapWorkspace, type WorkspaceRegistryLike } from './workspace.ts'
import { effectiveConfig } from './connection.ts'

export const name = 'dsh-plugin-longpi'
export const inject = ['tools']
export { asJson } from './json.ts'
export { Config }
export { preGuard, wrapGuardMessage, rememberMedications, rememberedMedications, ruleLabels, replyRuleCheck, guidanceNote, correctionNote, mentionsMedicine, LABEL_KEYS, SELF_HARM_LINE_ZH, EMERGENCY_LINE_ZH } from './guardrails.ts'
export type { GuardHit, GuardLabels, ReplyVerdict } from './guardrails.ts'
export { createGuard, classifyMessage, checkReply, parseLabels, parseVerdict, runtimeCall, routeFor, personText, turnText, countGuard, readGuardStats, CLASSIFIER_SYSTEM, JUDGE_SYSTEM, GUARD_TIMEOUT_MS, GUARD_COUNTERS } from './guard-llm.ts'
export type { Guard, GuardCall, LlmLike } from './guard-llm.ts'
export { registerApprovals, planKey, planApprovalReason, resetReadBacks, NO_READ_BACK, READ_BACK_MS } from './tools-approval.ts'
export { hasDoseAmount } from './guard-dose.ts'
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
export { briefOptionsOf, buildPlanBrief, draftPlan, acceptedPlan, expectedText, DRAFT_CATEGORIES } from './planner.ts'
export type { PlanBrief, PlanDraft, DraftItem } from './planner.ts'
export { guardRoute, isJsonRequest, CONNECTION_UNAVAILABLE } from './routes.ts'
export {
  readConnection, saveConnection, clearConnection, effectiveConfig, connectionSource, connectionKey, maskMcpUrl, connectionUrlProblem, connectionTokenProblem,
  testConnection, CONNECTION_FILE, CONNECTION_TEST_MS,
} from './connection.ts'
export type { SavedConnection, ConnectionSource, ConnectionTest } from './connection.ts'
export type { ConnectionStatus } from './routes.ts'
export { buildIndicators, indicatorDetail, recordsSummary, invalidateIndicators } from './indicators.ts'
export type { IndicatorEntry, IndicatorsResponse, IndicatorDetail, IndicatorChange, IndicatorSource, RecordsSummary } from './indicators.ts'
export { groupOf, GROUP_KEYS, GROUP_ZH } from './groups.ts'
export type { GroupKey } from './groups.ts'
export type { ConnectionGuard } from './routes.ts'
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
  // A reload with new settings (another token, another address) must not answer from reads made with the old ones.
  invalidateRecords()
  invalidateTracking()
  const pluginHome = resolveMirobodyPlugin(config.mirobodyPluginHome)
  // Every module reads the effective configuration: a Mirobody connection saved on the settings page
  // (connection.ts) overrides the configured mcpUrl and mcpToken.
  const source = () => effectiveConfig(config)
  const mount = await mountMirobody(ctx, {
    pythonBin: config.pythonBin,
    mirobodyHome: config.mirobodyHome,
    // Read on every call, so the mounted Mirobody tools follow a connection saved later.
    get mcpUrl() { return source().mcpUrl },
    get mcpToken() { return source().mcpToken },
    timeoutMs: config.timeoutMs,
  }, pluginHome)
  // What the follow-up decisions read: the journey and its tracking, within a deadline so a slow skill never stacks up.
  const followupState = async (deadlineMs: number): Promise<FollowupState> => {
    const current = source()
    const dataDir = resolveDataDir(current.dataDir)
    const skillsHome = resolveSkillsHome(current.skillsHome)
    const records = await loadRecords(current, dataDir, mount.pluginHome)
    const built = await within(buildJourneyFull({ config: current, dataDir, skillsHome, catalog: loadCatalog(skillsHome), records, today: isoDay(), mount }), deadlineMs)
    if (!('value' in built)) throw new Error('journey not ready')
    return followupStateOf(built.value.journey, built.value.tracking)
  }
  registerTools(ctx, source, mount)
  registerTrackingTools(ctx, source, mount)
  registerFollowupTools(ctx, source, () => followupState(20_000).catch(() => null))
  // The safety guard: the host model labels each new message (rules when it fails) and checks the reply
  // before a turn closes; plan saves from chat wait for the person's approval.
  const guard = createGuard(ctx, { dataDir: () => resolveDataDir(config.dataDir) })
  registerApprovals(ctx, guard)
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
      if (result.status === 'created') logTo(scoped, 'info', `created the 健康对话 workspace at ${result.path}`)
      else if (result.status === 'error') logTo(scoped, 'warn', `workspace bootstrap failed: ${result.error}`)
    })
  })

  // One guidance note after the person's words for what the guard flagged; their message is never replaced.
  // Outermost, so it runs on every step even when a listener registered earlier ends the waterfall.
  // The mounted dsh-plugin-mirobody (0.1.1 and later) has its own rule guard that appends a notice and never
  // rewrites the message. LongPi's listener runs outermost: when the host model labelled the message, it drops
  // that notice and adds its own; when the model call failed, both rule notes stay.
  ctx.on('agent/pre-step', (payload, next) => guard.preStep(payload, next), { prepend: true })

  // Before a turn closes: one correction when the reply gave a dose or advised a medicine change.
  ctx.on('agent/turn-stopping', (payload) => guard.turnStopping(payload))
}
