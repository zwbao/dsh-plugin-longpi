import Schema from '@deepseek-ai/schemastery'

export interface Config {
  skillsHome: string
  mirobodyPluginHome: string
  pythonBin: string
  mirobodyHome: string
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
  /** On a DSH with no workspace, register <dataDir>/workspace as 「健康」 once, so a session can open. */
  bootstrapWorkspace: boolean
}

export const Config: Schema<Config> = Schema.object({
  skillsHome: Schema.string().default(''),
  mirobodyPluginHome: Schema.string().default(''),
  pythonBin: Schema.string().default(''),
  mirobodyHome: Schema.string().default(''),
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
})
