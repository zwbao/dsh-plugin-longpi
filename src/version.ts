export const PRODUCT_VERSION = '3.0.0'
export const PRODUCT_NAME = 'dsh-plugin-longpi'

export const TOOL_NAMES = [
  'read_personal_situation',
  'list_longevity_intents',
  'match_longevity_skills',
  'read_longevity_skill',
  'run_longevity_skill',
  'query_longevity_evidence',
  'list_longevity_domains',
  'save_personal_profile',
  'longpi_status',
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export const HARNESS_SKILLS = [
  'longpi-dispatch',
  'longpi-board',
  'longpi-boundary',
] as const
