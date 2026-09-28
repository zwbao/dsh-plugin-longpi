import type { Context } from '@deepseek-ai/cordis'
import './host-shims.ts'
import { Config } from './config.ts'
import { registerCommands } from './commands.ts'
import { createGuard } from './guard-llm.ts'
import { registerApprovals } from './tools-approval.ts'
import { registerHarnessSkills } from './harness-skills.ts'
import { mountMirobody } from './mirobody.ts'
import { createBus, setBus } from './core/bus.ts'
import { createHttp } from './core/http.ts'
import { memoryFor } from './core/memory.ts'
import { registerMemoryRoutes, registerMemoryTools } from './core/memory-tools.ts'
import { registerEmitHooks } from './core/emit-hooks.ts'
import { startTick } from './core/tick.ts'
import { registerCandidates } from './core/nba-registry.ts'
import { registerValidator } from './core/validate.ts'
import { registerModules } from './modules.ts'
import { registerOrchestrator, type SnapshotInput } from './agents/orchestrator.ts'
import { currentSurfaces, pageStateOf } from './surfaces/service.ts'
import { setCoach } from './surfaces/coach-service.ts'
import { createBudget } from './core/budget.ts'
import { createLlmCall } from './core/llm-call.ts'
import { createSse } from './core/sse.ts'
import { DISTILL_PREFILTER, distillerProfile } from './agents/memory_distiller.ts'
import { lastPersonText } from './core/turn-text.ts'
import { sessionKey } from './plan-hold.ts'
import { agentConfig } from './config.ts'
import type { HealthEventType } from './contracts/events.ts'
import { addDays } from './interventions.ts'
import type { CoreDeps } from './contracts/index.ts'
import type { MemoryApi } from './contracts/memory.ts'
import type { FactPack } from './contracts/factpack.ts'
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
import { healthWorkspacePaths, type WorkspaceLike } from './guard-scope.ts'
import { effectiveConfig } from './connection.ts'

export const name = 'dsh-plugin-longpi'
export const inject = ['tools']
export { asJson } from './json.ts'
export { Config }
export { preGuard, wrapGuardMessage, rememberMedications, rememberedMedications, ruleLabels, replyRuleCheck, guidanceNote, correctionNote, hypoCorrectionNote, isMedicationRecordRequest, mentionsMedicine, LABEL_KEYS, SELF_HARM_LINE_ZH, EMERGENCY_LINE_ZH } from './guardrails.ts'
export type { GuardHit, GuardLabels, ReplyVerdict } from './guardrails.ts'
export { createGuard, classifyMessage, checkReply, parseLabels, parseVerdict, runtimeCall, routeFor, personText, turnText, countGuard, readGuardStats, CLASSIFIER_SYSTEM, JUDGE_SYSTEM, GUARD_TIMEOUT_MS, GUARD_COUNTERS } from './guard-llm.ts'
export type { Guard, GuardCall, LlmLike } from './guard-llm.ts'
export { registerApprovals, planKey, planApprovalReason, resetReadBacks, NO_READ_BACK, READ_BACK_MS } from './tools-approval.ts'
export { touchesHealth, healthWorkspacePaths, insideWorkspace, HealthSessions, GUARD_SCOPES } from './guard-scope.ts'
export type { GuardScope, WorkspaceLike } from './guard-scope.ts'
export { hasDoseAmount } from './guard-dose.ts'
export { PRODUCT_VERSION, TOOL_NAMES, HARNESS_SKILLS } from './version.ts'
export { parseFrontmatter, loadCatalog, parseReadme, commandExcerpt, supplementFieldInputs } from './catalog.ts'
export { matchSkills, domainSummary, organismsAsked, organismOf } from './match.ts'
export { detectIntents, mentionedEntities, loadEvidenceLexicon } from './intents.ts'
export { normalizeUnit, foldName, nameVariants, parseNumber } from './units.ts'
export { stageMeasurements, runnableFrom, unitFactor } from './measurements.ts'
export { recordOutputs, readHistory, latestOutputs, seriesOf, readResultFile } from './history.ts'
export { buildStats, writeStats } from './stats.ts'
export { manifestSummary, versionCheck } from './tools.ts'
export { normalizeProfile, mergeProfile, readProfile, writeProfile, setConsent, EMPTY_PROFILE, estimatedAge, RISK_FACTS, RISK_FACT_ZH, FOCUS, FOCUS_ZH, CONSENT_VERSION, PROFILE_DAMAGED } from './profile.ts'
export type { Profile, Focus, Consent, RiskFact } from './profile.ts'
export { summarizeIndicators, summarizeMedications, indicatorsFromTable } from './situation.ts'
export { parseCompact, tableOf, cellNumber } from './compact.ts'
export { loadRecords, loadSeries, loadDoseLog, loadCourses, invalidateRecords, mergeSelf, sameMeasure } from './records.ts'
export type { RecordStatus, RecordSnapshot } from './records.ts'
export { readSelf, addSelf, deleteSelf, latestSelf, selfIndicators, selfSeries, SELF_KEYS, SELF_SPEC, SELF_ALIASES } from './selfmeasure.ts'
export type { SelfKey, SelfRow } from './selfmeasure.ts'
export { runSkill, reportExcerpt, readReceipts } from './runner.ts'
export { resolveSkillsHome, resolveMirobodyPlugin, resolveDataDir } from './paths.ts'
export { buildBoard } from './board.ts'
export { readiness, runReady, buildReport } from './overview.ts'
export { normalizePlan, savePlan, currentPlan, readPlans, addCheckIns, readCheckIns, isoDay, addDays, daysBetween, CIVIL_TZ } from './interventions.ts'
export { adherenceFor, evaluateMarker, evaluatePlan, resolveMarkers, suggestNext } from './evaluate.ts'
export { loadReference, markerFor, checkupMarkerFor, rcvBand, effectsFor, markerGroupKeys, expandMarkerNames } from './reference.ts'
export { buildTracking, invalidateTracking, trackingGeneration, modelGoals, homeBloodPressure, readFailed, PHENOAGE_SKILL, RISK_SKILL } from './tracking.ts'
export { buildJourney, buildJourneyFull, followupStateOf, retestsOf, stageNow, profileComplete, unansweredOf, within } from './journey.ts'
export type { Journey, Stage, RecordChange } from './journey.ts'
export { buildChanges, CHANGES_NOTE_ZH } from './changes.ts'
export { buildCalendar, escapeText, foldLine, retestDay } from './calendar.ts'
export {
  readFollowup, writeFollowup, publicFollowup, maskUrl, webhookUrlProblem, readFollowupLog, appendFollowupLog, sentToday, isoWeek, isoWeekday, inQuiet,
  decideFollowup, followupArmed, nextTimes, heldUntil, desktopCommand, desktopSupported, webhookRequest, webhookAnswer, sendFollowup, sendNow, setFollowupDeps,
  followupTick, startFollowup, followupResponse, followupSummary, DEFAULT_FOLLOWUP, FOLLOWUP_MAX_PER_DAY, FOLLOWUP_TEST_TEXT, FOLLOWUP_DAMAGED, WEBHOOK_KINDS,
} from './followup.ts'
export type { FollowupSettings, FollowupState, FollowupLogRow, FollowupDeps, SendResult } from './followup.ts'
export { followupTextProblem, followupApprovalReason } from './tools-followup.ts'
export { briefOptionsOf, buildPlanBrief, draftPlan, softHoldDraft, settleDraft, replyForDraft, acceptedPlan, expectedText, DRAFT_CATEGORIES } from './planner.ts'
export { clinicalStop, hypoglycaemiaNow, leadsWithHypoFirstStep, exclusionsFromText, medicationClasses, HYPO_AWAKE_ZH, HYPO_UNCONSCIOUS_ZH, FISH_OIL_CAUTION, type StopResult, type StopHit } from './plan-safety.ts'
export { buildDoctorFirst } from './doctor-first.ts'
export { planDraftHeld, holdPlanDraft, releasePlanDraft } from './plan-hold.ts'
export { readPlanPrefs, setPlanExclusion, rememberExclusions } from './plan-prefs.ts'
export { presentMedications, fixScheduleText, readStatements } from './meds-stated.ts'
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
export { candidatesFor, indicatorFor, matchesInputName } from './measurements.ts'
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
  // DSH's workspace registry, read through the context that injected it (gone with the service).
  let registryLookup: (() => unknown) | null = null
  const workspaces = (): WorkspaceLike[] => {
    try {
      const registry = registryLookup?.() as { list?: () => ReadonlyArray<{ path?: unknown; title?: unknown }> } | undefined
      return typeof registry?.list === 'function' ? registry.list().map((row) => ({ path: String(row.path ?? ''), title: typeof row.title === 'string' ? row.title : '' })) : []
    } catch {
      return []
    }
  }
  // The safety guard: the host model labels each new message in LongPi's workspace, and elsewhere each one that
  // touches health (rules otherwise, and when it fails); it checks the reply before a turn closes; plan saves
  // from chat wait for the person's approval.
  const guard = createGuard(ctx, {
    dataDir: () => resolveDataDir(config.dataDir),
    scope: () => (config.guardScope === 'all' ? 'all' : 'health'),
    healthWorkspaces: () => healthWorkspacePaths(resolveDataDir(config.dataDir), workspaces()),
  })
  registerApprovals(ctx, guard)
  startFollowup(ctx, () => ({ dataDir: resolveDataDir(config.dataDir), getState: () => followupState(60_000), generation: trackingGeneration }))
  registerHarnessSkills(ctx)
  registerRoutes(ctx, source, mount)
  registerCommands(ctx, source, mount)
  // Optional: without DSH's workspace registry the plugin loads as before. Cordis re-runs this when the
  // service comes back; the marker file keeps it to one workspace, ever.
  ctx.inject(['workspaceRegistry'], (scoped) => {
    const registry = (scoped as unknown as { workspaceRegistry?: WorkspaceRegistryLike }).workspaceRegistry
    registryLookup = () => (scoped as unknown as { workspaceRegistry?: unknown }).workspaceRegistry
    void bootstrapWorkspace(registry, { dataDir: resolveDataDir(config.dataDir), enabled: config.bootstrapWorkspace !== false }).then((result) => {
      if (result.status === 'created') logTo(scoped, 'info', `created the 健康对话 workspace at ${result.path}`)
      else if (result.status === 'error') logTo(scoped, 'warn', `workspace bootstrap failed: ${result.error}`)
    })
  })

  // --- 0.5.3 agent core (AA step 1): bus, memory, fact pack and surfaces, modules, scoped orchestrator ---
  const dataDirNow = () => resolveDataDir(source().dataDir)
  const bus = createBus({ dataDir: dataDirNow, ctx, log: (message) => logTo(ctx, 'warn', `bus: ${message}`) })
  setBus(bus)
  const http = createHttp(ctx)
  const journeyContext = async () => {
    const current = source()
    const dataDir = resolveDataDir(current.dataDir)
    const skillsHome = resolveSkillsHome(current.skillsHome)
    const records = await loadRecords(current, dataDir, mount.pluginHome)
    return { config: current, dataDir, skillsHome, catalog: loadCatalog(skillsHome), records, today: isoDay(), mount }
  }
  const memory: MemoryApi = {
    read: () => memoryFor(dataDirNow()).read(),
    active: (kind) => memoryFor(dataDirNow()).active(kind),
    apply: (ops, by) => memoryFor(dataDirNow()).apply(ops, by),
    digest: (opts) => memoryFor(dataDirNow()).digest(opts),
    safetyFlags: () => memoryFor(dataDirNow()).safetyFlags(),
  }
  // Step 2: one-shot model calls with a daily budget (D8), and the model service read at call time.
  const budget = createBudget(source, dataDirNow)
  const llmService = () => {
    try {
      return (ctx as unknown as { get?: (name: string) => unknown }).get?.('llm') as { stream?: unknown } | undefined
    } catch {
      return undefined
    }
  }
  const llmCall = createLlmCall(ctx, { config: source, budget, log: (message) => logTo(ctx, 'warn', message) })
  const packNow = async (): Promise<FactPack> => {
    await buildJourneyFull(await journeyContext())
    const row = currentSurfaces(dataDirNow())
    if (!row) throw new Error('fact pack not ready')
    return row.pack
  }
  const deps: CoreDeps = {
    config: source,
    bus,
    memory,
    factpack: { build: async (opts) => { if (opts?.refresh) { invalidateRecords(); invalidateTracking() } return packNow() }, cached: () => currentSurfaces(dataDirNow())?.pack ?? null },
    llm: llmCall,
    specialists: { consult: async () => { throw new Error('consult_longpi_specialist is reserved (not in 0.5.3)') } },
    budget,
    http,
    nba: { register: registerCandidates },
    validators: { register: registerValidator },
    mount,
    context: journeyContext,
    dataDir: dataDirNow,
    invalidate: () => { invalidateRecords(); invalidateTracking() },
  }
  registerMemoryTools(ctx, deps)
  registerMemoryRoutes(deps)
  const sse = createSse(http, bus)
  // The coach writes the surfaces when a model is there and the profile is on; the floor otherwise.
  setCoach({
    llm: llmCall,
    enabled: () => source().surfaces?.enabled !== false && agentConfig(source(), 'coach').enabled && typeof llmService()?.stream === 'function',
    softRegenMinutes: () => source().surfaces?.softRegenMinutes ?? 30,
    publish: (type, data) => sse.publish(type, data),
    log: (message) => logTo(ctx, 'warn', message),
  })
  // Hard invalidations rebuild the pack at once (debounced), so the coach and the page catch up without a click.
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null
  const HARD: HealthEventType[] = ['triage.opened', 'triage.resolved', 'report.arrived', 'record.changed', 'memory.changed', 'profile.changed', 'consent.changed', 'care.visit_logged', 'plan.saved']
  bus.on(HARD, () => {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null
      invalidateTracking()
      void journeyContext().then((context) => buildJourneyFull(context)).then(() => sse.publish('changed', {})).catch(() => {})
    }, 2_000)
    rebuildTimer.unref?.()
  }, 'rebuild')
  http.route('GET', '/api/longpi/usage', async () => ({ ok: true, today: budget.today(), remaining: budget.remaining(), caps: source().budget }))
  registerModules(ctx, deps, (message) => logTo(ctx, 'warn', message))
  registerEmitHooks(ctx, bus)
  startTick(ctx, bus, dataDirNow)
  // The persona only in health sessions, write tools hidden elsewhere (D5), and the page snapshot at step 1.
  const snapshotNow = async (deadlineMs: number): Promise<SnapshotInput | null> => {
    const dataDir = dataDirNow()
    // A cached page state answers at once after a short wait for a fresher one; only a first turn with
    // nothing cached waits up to the deadline.
    const wait = currentSurfaces(dataDir) ? Math.min(1_500, deadlineMs) : deadlineMs
    await within(journeyContext().then((context) => buildJourneyFull(context)), wait).catch(() => null)
    const row = currentSurfaces(dataDir)
    if (!row) return null
    const today = isoDay()
    const care = row.pack.triage.care.at(-1)
    const open = row.pack.triage.findings.some((finding) => finding.status !== 'visited')
    let careDue = ''
    if (care?.care_status === 'booked' && care.visit_date && care.visit_date < today) careDue = `约的 ${care.visit_date} 看医生已经过了：先问一句「看完医生了吗？医生怎么说？」`
    else if (care?.care_status === 'booked' && care.visit_date) careDue = `已约 ${care.visit_date} 看医生；可以提醒带上医生简报。`
    else if (open && (!care || ((care.care_status === 'advised' || care.care_status === 'declined') && addDays(care.updated.slice(0, 10), 14) <= today))) careDue = '建议看医生，还没有就医记录：说完最重要的事后，问一句「约了吗？」；看过的话问「医生怎么说？」'
    const since = Date.now() - 24 * 3_600_000
    const noted = memoryFor(dataDir).read().items.filter((item) => item.status === 'active' && !item.confirmed && item.provenance.kind === 'model_extracted' && Date.parse(item.updated) >= since).map((item) => item.text_zh)
    return { page: pageStateOf(row.set, row.pack), memory_zh: memoryFor(dataDir).digest({ purpose: 'chat', maxChars: 500 }), care_due_zh: careDue, noted_zh: noted.slice(0, 4).join('；') }
  }
  const orchestrator = registerOrchestrator(ctx, {
    mount,
    healthWorkspaces: () => healthWorkspacePaths(resolveDataDir(config.dataDir), workspaces()),
    snapshot: snapshotNow,
    log: (message) => logTo(ctx, 'warn', message),
  })
  // After a health turn whose words hint at something to keep: the memory distiller, in the background.
  ctx.on('agent/turn-stopping', (payload) => {
    try {
      const agent = (payload as unknown as { agent?: unknown }).agent
      const session = sessionKey(agent)
      const health = orchestrator.isHealth(agent)
      const text = lastPersonText(session)
      const hit = health && DISTILL_PREFILTER.test(text)
      bus.emit('chat.turn_ended', { session_id: session, turn: Number((payload as unknown as { turn?: unknown }).turn ?? 0), health, prefilter_hit: hit }, { module: 'M0', via: 'hook', session_id: session })
      if (!hit) return
      const pack = currentSurfaces(dataDirNow())?.pack
      if (!pack) return
      void llmCall.structured({ profile: distillerProfile, pack, extra: { message: text, session_id: session, today: isoDay() } }).then(({ value }) => {
        if (value.length > 0) memoryFor(dataDirNow()).apply(value, 'M0')
      }).catch(() => {})
    } catch {
      // the turn closes regardless
    }
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
// C0 contracts (AA §3): reserved names, registries and invariants shared by the modules.
export { RESERVED_TOOL_NAMES, RESERVED_ROUTES, RESERVED_SKILLS, PROMPT_SECTIONS } from './version.ts'
export { AGENT_DEFAULTS, BUDGET_DEFAULTS, SURFACES_DEFAULTS, agentConfig } from './config.ts'
export type { AgentConfig } from './config.ts'
export { registerCandidates, collectCandidates, candidateProviders } from './core/nba-registry.ts'
export { registerValidator, runValidators, validatorRules } from './core/validate.ts'
export { DATA_FILES } from './core/files.ts'
export { EVENT_OWNERS } from './contracts/events.ts'
export { MANDATORY_PROVIDERS } from './contracts/surfaces.ts'
export { MEMORY_VERSION, SAFETY_DRUG_CLASSES, SAFETY_CONDITION_FLAGS } from './contracts/memory.ts'
export { FACT_PRIORITY_RANK } from './contracts/factpack.ts'
export { AGENT_PROFILE_IDS } from './contracts/agents.ts'
export { youngerAllowed } from './contracts/feedback.ts'
export { oddsSumToOne } from './contracts/codex.ts'
export { MODULES, registerModules } from './modules.ts'
export type * from './contracts/index.ts'
// 0.5.3 agent core (AA step 1–2, M1): memory, bus, fact pack, surfaces, triage and care.
export { createBus, setBus, currentBus } from './core/bus.ts'
export { createMemory, memoryFor, migrateLegacy, drugClassesOf, conditionFlagsOf, computeSafety } from './core/memory.ts'
export { readJson, writeJsonAtomic, appendJsonl, readJsonl } from './core/store.ts'
export { rankTopFacts } from './core/topfacts.ts'
export { packFrom, packFp } from './core/factpack.ts'
export { fallbackSurfaces, greetingZh, numberKeysIn } from './surfaces/fallback.ts'
export { rankActions } from './surfaces/nba.ts'
export { journeyCandidates } from './surfaces/providers.ts'
export { readPageState, currentSurfaces, recordSurfaces, pageStateOf } from './surfaces/service.ts'
export { triageCandidates, triageFindings, DOCTOR_PROMPT_ZH, BRIEF_PROMPT_ZH, VISIT_PROMPT_ZH } from './triage/index.ts'
export { findingsFrom, patterns, statusLine, hitRefs } from './triage/rules.ts'
export { careState, careFor, careItems, logCareVisit, seenNotes } from './triage/care.ts'
export { drinkingFromText, setDrinking, forgetExclusion } from './plan-prefs.ts'
export { sessionKey } from './plan-hold.ts'
export { orchestratorPrompt, snapshotText, registerOrchestrator, pluginMessage, WRITE_TOOLS, ORCHESTRATOR_RULES } from './agents/orchestrator.ts'
export { personaLines } from './prompt.ts'
export { buildBrief, readBrief } from './triage/brief.ts'
export { createHttp } from './core/http.ts'
export { rememberPersonText, lastPersonText, quoteIn } from './core/turn-text.ts'
export { itemFrom } from './core/memory-tools.ts'
export { checkDay } from './core/tick.ts'
export { rangeFlag } from './changes.ts'
// 0.5.3 step 2: model calls, validators, coach, distiller, SSE.
export { createLlmCall, firstJsonObject } from './core/llm-call.ts'
export { createBudget } from './core/budget.ts'
export { BASE_RULES, allowedNumbers, runRegistered } from './core/validate.ts'
export { coachProfile, validateCoach, coachInput, coachFallback, anchorOf, COACH_SCHEMA } from './agents/coach.ts'
export { COACH_PROMPT } from './agents/prompts/coach.ts'
export { distillerProfile, validateDistilled, DISTILL_PREFILTER } from './agents/memory_distiller.ts'
export { setCoach, chooseSurfaces, regenerate, resetCoachCache, hardKeyOf, coachInflight } from './surfaces/coach-service.ts'
export { createSse } from './core/sse.ts'
export { rememberFromWords } from './core/remember-rules.ts'
export { screeningTopics } from './triage/screening.ts'
