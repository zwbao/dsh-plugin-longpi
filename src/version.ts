export const PRODUCT_VERSION = '4.2.0'
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
  'save_intervention_plan',
  'log_intervention_checkin',
  'read_intervention_plan',
  'review_interventions',
  'model_intervention_goals',
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export const HARNESS_SKILLS = [
  'longpi-dispatch',
  'longpi-board',
  'longpi-boundary',
  'longpi-interventions',
] as const
