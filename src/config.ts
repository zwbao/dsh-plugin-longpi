import Schema from '@deepseek-ai/schemastery'

export interface Config {
  brandName: string
  demoBanner: boolean
  itineraryDate: string
  s2fHome: string
  maxVcfVariants: number
  allowS2fExecute: boolean
}

export const Config: Schema<Config> = Schema.object({
  brandName: Schema.string().default('健康助手'),
  demoBanner: Schema.boolean().default(true),
  itineraryDate: Schema.string().default('2026-10-24'),
  s2fHome: Schema.string().default(''),
  maxVcfVariants: Schema.number().default(5000),
  allowS2fExecute: Schema.boolean().default(false),
})
