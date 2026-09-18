import { CUSTOMER, INSIGHTS, METRICS } from '../fixture.ts'
import { LAYERS, annotateMultiomics } from './annotate.ts'
import { lookupEvidence } from './evidence.ts'
import { DEMO_VARIANTS, type OmicsLayer } from './genome.ts'
import { getGenomeStore } from './store.ts'
import { normalizeChrom, type ParsedVariant } from './vcf.ts'

/**
 * The single source of truth for the product version in code.
 *
 * `package.json` carries the release version and `test/smoke.mjs` asserts the two
 * agree, so they cannot drift apart unnoticed. Do not hardcode a version string
 * anywhere else: import this constant, or reference it in prose from the README.
 */
export const PRODUCT_VERSION = '1.1.0'

function matchPanel(v: ParsedVariant) {
  return DEMO_VARIANTS.find((p) => {
    if (p.rsid === v.rsid) return true
    return p.chrom === normalizeChrom(v.chrom) && p.position === v.position && p.ref === v.ref && p.alt === v.alt
  })
}

export function buildOmicsReport() {
  const genome = getGenomeStore()
  const ingested = genome.ingest
  const matched = ingested
    ? ingested.variants.map((v) => ({ parsed: v, panel: matchPanel(v) })).filter((x) => x.panel)
    : DEMO_VARIANTS.map((panel) => ({
      parsed: {
        chrom: panel.chrom,
        position: panel.position,
        rsid: panel.rsid,
        ref: panel.ref,
        alt: panel.alt,
        genotype: panel.genotype_demo,
        filter: 'DEMO',
      } satisfies ParsedVariant,
      panel,
    }))

  const layers = LAYERS.map((layer: OmicsLayer) => {
    const ann = annotateMultiomics(layer)
    const measured = layer === 'genome'
      ? (ingested ? 'vcf' : 'demo_panel')
      : 'unmeasured'
    return {
      layer,
      status: measured,
      ...(typeof ann === 'object' ? ann : {}),
    }
  })

  return {
    product: 'dsh-plugin-longpi',
    version: PRODUCT_VERSION,
    generated_at: new Date().toISOString(),
    member: {
      display_name: CUSTOMER.display_name,
      chrono_age: CUSTOMER.chrono_age,
      composite_age: CUSTOMER.composite_age,
      modules: CUSTOMER.modules,
    },
    phenotype: {
      metrics: METRICS.map((m) => ({ code: m.code, name_zh: m.name_zh, value: m.value, unit: m.unit, status: m.status })),
      insights: INSIGHTS.map((i) => i.title_zh),
    },
    genome: {
      source: ingested ? 'ingested_vcf' : 'demo_panel',
      assembly: 'hg38',
      vcf_stats: ingested
        ? { n_kept: ingested.n_kept, n_dropped_nonsnp: ingested.n_dropped_nonsnp, truncated: ingested.n_truncated }
        : null,
      panel_hits: matched.map((x) => ({
        rsid: x.panel!.rsid,
        gene: x.panel!.gene,
        genotype: x.parsed.genotype ?? x.panel!.genotype_demo,
        hg38: `${x.panel!.chrom}:${x.panel!.position}`,
        note_zh: x.panel!.longevity_note_zh,
        citation: x.panel!.citation,
      })),
    },
    omics: layers,
    evidence_index: lookupEvidence('').matches.map((e) => ({ id: e.id, name: e.name, url: e.url })),
    next_steps: [
      'Review panel hits with a clinician; do not change medication from this report.',
      'For model scoring, emit s2f_batch_request then run s2f-penguin `s2f batch` (constraint=gpn_msa table; never live GPN on human variants).',
      'Methylation clocks (pyaging / BioAge) are listed as unmeasured unless you ingest those assays separately.',
    ],
    disclaimer_zh: `LongPi ${PRODUCT_VERSION} 正式报告：表型为演示面板；基因组为演示或本地 VCF SNP 与长寿面板的交集。不是医疗器械，不是诊断，不替代医师。人类变异禁止 GPN live forward。`,
  }
}

export function exportReportMarkdown(report: ReturnType<typeof buildOmicsReport>): string {
  const hits = report.genome.panel_hits.map((h) => `- ${h.gene} ${h.rsid} ${h.genotype} (${h.hg38})`).join('\n')
  return [
    `# LongPi 多组学报告 ${report.version}`,
    '',
    `${report.member.display_name} · 综合生物年龄 ${report.member.composite_age}（实际 ${report.member.chrono_age}）`,
    '',
    `## 基因组（${report.genome.source} · ${report.genome.assembly}）`,
    hits || '- （无面板命中）',
    '',
    '## 组学层状态',
    ...report.omics.map((l) => `- ${l.layer}: ${l.status}`),
    '',
    report.disclaimer_zh,
  ].join('\n')
}
