export const PRODUCT_VERSION = '2.0.0'
export const PRODUCT_NAME = 'dsh-plugin-longpi'

export const TOOL_NAMES = [
  'read_personal_situation',
  'match_longevity_skills',
  'read_longevity_skill',
  'run_longevity_skill',
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
