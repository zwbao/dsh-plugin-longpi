import Schema from '@deepseek-ai/schemastery'
import type { GuardScope } from './guard-scope.ts'

export interface Config {
  skillsHome: string
  mirobodyPluginHome: string
  pythonBin: string
  mirobodyHome: string
  /** The Mirobody on this computer that LongPi pairs itself with (no address shown to the person). */
  mirobodyUrl: string
  mcpUrl: string
  mcpToken: string
  member: string
  timeoutMs: number
  skillPython: string
  skillTimeoutMs: number
  dataDir: string
  maxSkillMatches: number
  skillRuntimes: Record<string, string>
  skillsVersion: string
  /** On a DSH with no workspace, register <dataDir>/workspace as 「健康对话」 once, so a session can open. */
  bootstrapWorkspace: boolean
  /** Where the safety classifier asks the model: LongPi's workspace and health talk ('health'), or every message ('all'). */
  guardScope: GuardScope
  /** Per agent profile (AA §2.3): enabled (false = always the deterministic fallback), route and deadline. */
  agents: Record<string, AgentConfig>
  /** Daily caps on LongPi's own model calls (D8); over a cap every profile falls back silently. */
  budget: { dailyInputTokens: number; dailyOutputTokens: number; maxSpawnsPerDay: number }
  surfaces: { enabled: boolean; softRegenMinutes: number; chapterTokens: number; sse: boolean }
  engage: { codex: boolean; nudgesInWorkflow: boolean }
  /** 'local' is on-device research. 'live' still needs a production feed before anything leaves (D6). */
  scienceMode: 'off' | 'local' | 'simulated' | 'live'
  /** True only after the person uses the settings switch. The old implicit default is not this. */
  scienceModeSet: boolean
}

export interface AgentConfig {
  enabled: boolean
  provider: string
  model: string
  reasoningEffort: 'off' | 'low' | 'high' | 'max'
  maxTokens: number
  deadlineMs: number
}

const agent = (reasoningEffort: AgentConfig['reasoningEffort'], maxTokens: number, deadlineMs: number, model = '') => Schema.object({
  enabled: Schema.boolean().default(true),
  provider: Schema.string().default(''),
  model: Schema.string().default(model),
  reasoningEffort: Schema.union([Schema.const('off' as const), Schema.const('low' as const), Schema.const('high' as const), Schema.const('max' as const)]).default(reasoningEffort),
  maxTokens: Schema.number().default(maxTokens),
  deadlineMs: Schema.number().default(deadlineMs),
})

/** AA §3.4 defaults. A profile left out of a user's patch keeps these. */
export const AGENT_DEFAULTS: Readonly<Record<string, AgentConfig>> = {
  coach: { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 900, deadlineMs: 15000 },
  memory_distiller: { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 400, deadlineMs: 10000 },
  triage: { enabled: true, provider: '', model: 'deepseek-v4-pro', reasoningEffort: 'low', maxTokens: 1500, deadlineMs: 30000 },
  retest_reviewer: { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 600, deadlineMs: 15000 },
  plan_codesigner: { enabled: true, provider: '', model: '', reasoningEffort: 'low', maxTokens: 2000, deadlineMs: 60000 },
  evidence_explainer: { enabled: true, provider: '', model: '', reasoningEffort: 'high', maxTokens: 2000, deadlineMs: 45000 },
  report_reader: { enabled: true, provider: '', model: '', reasoningEffort: 'low', maxTokens: 2000, deadlineMs: 60000 },
  research_coordinator: { enabled: true, provider: '', model: '', reasoningEffort: 'high', maxTokens: 2000, deadlineMs: 60000 },
}

/** The settings for one profile: the user's patch over the defaults. */
export function agentConfig(config: Partial<Pick<Config, 'agents'>> | undefined, id: string): AgentConfig {
  const base = AGENT_DEFAULTS[id] ?? { enabled: true, provider: '', model: '', reasoningEffort: 'off', maxTokens: 800, deadlineMs: 15000 }
  const own = config?.agents?.[id]
  return own && typeof own === 'object' ? { ...base, ...own } : { ...base }
}

export const BUDGET_DEFAULTS = { dailyInputTokens: 200000, dailyOutputTokens: 20000, maxSpawnsPerDay: 3 } as const
export const SURFACES_DEFAULTS = { enabled: true, softRegenMinutes: 30, chapterTokens: 150000, sse: true } as const

export const Config: Schema<Config> = Schema.object({
  skillsHome: Schema.string().default(''),
  mirobodyPluginHome: Schema.string().default(''),
  pythonBin: Schema.string().default(''),
  mirobodyHome: Schema.string().default(''),
  mirobodyUrl: Schema.string().default('http://127.0.0.1:18060'),
  mcpUrl: Schema.string().default(''),
  mcpToken: Schema.string().default(''),
  member: Schema.string().default(''),
  timeoutMs: Schema.number().default(30000),
  skillPython: Schema.string().default(''),
  skillTimeoutMs: Schema.number().default(120000),
  dataDir: Schema.string().default(''),
  maxSkillMatches: Schema.number().default(8),
  skillRuntimes: Schema.dict(Schema.string()).default({}),
  skillsVersion: Schema.string().default(''),
  bootstrapWorkspace: Schema.boolean().default(true),
  guardScope: Schema.union([Schema.const('health' as const), Schema.const('all' as const)]).default('health'),
  agents: Schema.object({
    coach: agent('off', 900, 15000),
    memory_distiller: agent('off', 400, 10000),
    triage: agent('low', 1500, 30000, 'deepseek-v4-pro'),
    retest_reviewer: agent('off', 600, 15000),
    plan_codesigner: agent('low', 2000, 60000),
    evidence_explainer: agent('high', 2000, 45000),
    report_reader: agent('low', 2000, 60000),
    research_coordinator: agent('high', 2000, 60000),
  }) as unknown as Schema<Record<string, AgentConfig>>,
  budget: Schema.object({
    dailyInputTokens: Schema.number().default(BUDGET_DEFAULTS.dailyInputTokens),
    dailyOutputTokens: Schema.number().default(BUDGET_DEFAULTS.dailyOutputTokens),
    maxSpawnsPerDay: Schema.number().default(BUDGET_DEFAULTS.maxSpawnsPerDay),
  }),
  surfaces: Schema.object({
    enabled: Schema.boolean().default(SURFACES_DEFAULTS.enabled),
    softRegenMinutes: Schema.number().default(SURFACES_DEFAULTS.softRegenMinutes),
    chapterTokens: Schema.number().default(SURFACES_DEFAULTS.chapterTokens),
    sse: Schema.boolean().default(SURFACES_DEFAULTS.sse),
  }),
  engage: Schema.object({
    codex: Schema.boolean().default(true),
    nudgesInWorkflow: Schema.boolean().default(false),
  }),
  scienceMode: Schema.union([
    Schema.const('off' as const),
    Schema.const('local' as const),
    Schema.const('simulated' as const),
    Schema.const('live' as const),
  ]).default('local'),
  scienceModeSet: Schema.boolean().default(false),
})
