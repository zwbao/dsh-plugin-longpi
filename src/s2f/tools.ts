import { readFileSync, statSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from '../config.ts'
import { LAYERS, annotateMultiomics, annotateVariant, listDemoGenome } from './annotate.ts'
import { appendAudit } from './audit.ts'
import { lookupEvidence } from './evidence.ts'
import { executeS2fRoute, s2fAvailable } from './execute.ts'
import { buildPlan } from './plan.ts'
import { buildOmicsReport, exportReportMarkdown } from './report.ts'
import { routeQuery } from './routing.ts'
import { setIngest } from './store.ts'
import { parseVcf } from './vcf.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function audited(tool: string, args: unknown, result: unknown) {
  appendAudit(tool, args, result)
  return result
}

export function registerS2fTools(ctx: Context, config: () => Config): void {
  ctx.tools.register(defineTool({
    name: 's2f_route',
    description: 'Route a computational-genomics question to s2f-agent skills (AlphaGenome, DNABERT-2, Evo 2, SpliceAI, Borzoi, GPN, …). Returns decision, confidence, ranked skills. Does not run GPU models.',
    parameters: {
      query: { type: 'string', required: true, description: 'Free-text genomics question' },
      task: { type: 'string', description: 'Optional task hint: variant-effect, embedding, track-prediction, fine-tuning, environment-setup, troubleshooting' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      return audited('s2f_route', args, { product_version: '1.0.0', ...routeQuery(args.query, args.task) })
    },
  }))

  ctx.tools.register(defineTool({
    name: 's2f_plan',
    description: 'Build an s2f-agent execution plan: routing + missing canonical inputs + dry-run shell steps. Never executes Evo2/AlphaGenome from DSH unless s2f_execute is explicitly enabled.',
    parameters: {
      query: { type: 'string', required: true, description: 'Genomics request, include hg38/chr/REF/ALT when scoring a variant' },
      task: { type: 'string', description: 'Optional canonical task id' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      return audited('s2f_plan', args, buildPlan(args.query, args.task))
    },
  }))

  ctx.tools.register(defineTool({
    name: 's2f_execute',
    description: 'Optional: run s2f-agent scripts/route_query.sh if s2fHome is configured and allowS2fExecute is true. Always dry-run routing only — never GPU inference.',
    parameters: {
      query: { type: 'string', required: true, description: 'Query forwarded to route_query.sh' },
      task: { type: 'string', description: 'Optional --task' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      const cfg = config()
      if (!cfg.allowS2fExecute) {
        return audited('s2f_execute', args, {
          ran: false,
          error: 'allowS2fExecute is false. Set cordis config allowS2fExecute: true and s2fHome to the s2f-agent checkout.',
        })
      }
      if (!s2fAvailable(cfg.s2fHome)) {
        return audited('s2f_execute', args, { ran: false, error: 's2fHome does not contain scripts/route_query.sh' })
      }
      const result = await executeS2fRoute({ home: cfg.s2fHome, query: args.query, task: args.task })
      return audited('s2f_execute', args, result)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_personal_genome',
    description: 'Read the LongPi 1.0 longevity gene panel plus any ingested VCF SNP hits. Demo panel is synthetic unless a VCF was ingested.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute() {
      return audited('read_personal_genome', {}, {
        ...listDemoGenome(),
        report_hint: 'Call build_omics_report for the 1.0.0 combined phenotype+genome+omics document.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'ingest_vcf',
    description: 'Ingest a VCF (path or pasted text). Keeps A/C/G/T SNPs only, caps records, assumes hg38 unless the header says otherwise. Matches the longevity panel. Does not call the network.',
    parameters: {
      path: { type: 'string', description: 'Local filesystem path to a .vcf' },
      vcf_text: { type: 'string', description: 'Raw VCF text (for tests and small pastes)' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      let text = args.vcf_text ?? ''
      let label = 'pasted'
      if (!text && args.path) {
        if (args.path.includes('..')) {
          return audited('ingest_vcf', args, { ok: false, code: 'FORBIDDEN', message_zh: '路径不允许 ..' })
        }
        try {
          const st = statSync(args.path)
          if (!st.isFile() || st.size > 8 * 1024 * 1024) {
            return audited('ingest_vcf', args, { ok: false, code: 'TOO_LARGE', message_zh: '文件不存在或超过 8MB。' })
          }
          text = readFileSync(args.path, 'utf8')
          label = args.path
        } catch {
          return audited('ingest_vcf', args, { ok: false, code: 'NOT_FOUND', message_zh: '无法读取该路径。' })
        }
      }
      const parsed = parseVcf(text, { maxVariants: config().maxVcfVariants })
      if (!parsed.ok) return audited('ingest_vcf', args, parsed)
      setIngest(parsed, label)
      return audited('ingest_vcf', args, {
        ...parsed,
        variants: parsed.variants.slice(0, 50),
        variants_omitted: Math.max(0, parsed.variants.length - 50),
        source: label,
        next: 'build_omics_report',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'annotate_variant',
    description: 'Annotate a panel variant (rsID or gene) across consequence, ClinVar note, longevity literature, and s2f skill routing. Does not invent pathogenicity for unknown variants.',
    parameters: {
      query: { type: 'string', required: true, description: 'rsID, gene symbol, or hg38 chr:pos' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      return audited('annotate_variant', args, annotateVariant(args.query))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'annotate_multiomics',
    description: 'Explain one omics layer (genome, epigenome, transcriptome, proteome, metabolome). States what is unmeasured.',
    parameters: {
      layer: {
        type: 'string',
        required: true,
        enum: LAYERS,
        description: 'Omics layer',
      },
      focus: { type: 'string', description: 'Optional gene or rsID to focus' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      return audited('annotate_multiomics', args, annotateMultiomics(args.layer, args.focus))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'build_omics_report',
    description: 'Build the LongPi 1.0.0 combined report: phenotype dashboard + genome panel/VCF hits + omics layer status + evidence index.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute() {
      return audited('build_omics_report', {}, buildOmicsReport())
    },
  }))

  ctx.tools.register(defineTool({
    name: 'export_report',
    description: 'Export the current 1.0.0 report as json or markdown.',
    parameters: {
      format: { type: 'string', enum: ['json', 'markdown'], description: 'json (default) or markdown' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      const report = buildOmicsReport()
      if (args.format === 'markdown') {
        return audited('export_report', args, { format: 'markdown', markdown: exportReportMarkdown(report) })
      }
      return audited('export_report', args, { format: 'json', report })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'lookup_longevity_evidence',
    description: 'Search a curated (not exhaustive) index of longevity code, clocks, and databases. Empty query lists the catalog.',
    parameters: {
      query: { type: 'string', description: 'Keyword such as FOXO3, methylation, BioAge, s2f' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => jsonText(v) },
    async execute(args) {
      return audited('lookup_longevity_evidence', args, lookupEvidence(args.query ?? ''))
    },
  }))
}
