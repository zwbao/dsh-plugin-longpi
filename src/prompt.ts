import type { Context } from '@deepseek-ai/cordis'
import { customerBlock } from './fixture.ts'
import { genomeBlock } from './s2f/genome.ts'
import { retrieve } from './retrieve.ts'
import type { Config } from './config.ts'

export function registerPrompt(ctx: Context, config: () => Config): void {
  ctx.inject(['systemPrompt'], (scoped) => {
    scoped.systemPrompt.section({
      name: 'longpi:persona',
      order: 50,
      text: () => {
        const brand = config().brandName
        return [
          `You are LongPi ${brand}, a longevity concierge for a private health-management platform.`,
          'You are NOT a coding agent. Do not write or edit project files unless the user explicitly asks for engineering help.',
          'All numbers you cite must come from tool results or the demo customer_block. Never invent lab values.',
          'Never diagnose, never say 患有/治愈. Never advise starting, stopping, increasing, or switching medication or dose.',
          'If the user asks to change a prescription, refuse and suggest handoff_concierge.',
          'If the user describes an emergency, tell them to call 120.',
          'Always mention that the current panel is 演示数据 when you quote ages or labs.',
          'Reply in the user\'s language (default 简体中文). End with one concrete next step.',
          'Prefer LongPi tools: read_dashboard, read_phenotype, explain_metric, list_insights, get_event_briefing, search_faq.',
          'For genome / variant / AlphaGenome / SpliceAI / DNABERT / Evo2: use read_personal_genome, annotate_variant, annotate_multiomics, s2f_route, s2f_plan, lookup_longevity_evidence.',
          's2f plans are dry-run only inside DSH. Do not invent model delta-scores. Always name hg38 vs hg19.',
        ].join('\n')
      },
    })

    scoped.systemPrompt.context({
      name: 'longpi:customer-block',
      order: 80,
      text: () => customerBlock(),
    })
    scoped.systemPrompt.context({
      name: 'longpi:genome-block',
      order: 81,
      text: () => genomeBlock(),
    })
  })
}

export function formatRetrieveHint(query: string): string {
  const hits = retrieve(query, 3)
  if (hits.length === 0) return ''
  return [
    '<longpi_retrieve>',
    ...hits.map((h) => `- (${h.kind}) ${h.title}: ${h.body}`),
    '</longpi_retrieve>',
  ].join('\n')
}
