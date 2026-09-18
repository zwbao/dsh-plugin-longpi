/**
 * Curated longevity / aging index — NOT a crawl of GitHub.
 * Each row is a named project or resource we actually looked at.
 *
 * Every row carries a verified `license` and an `integration` field, because licence
 * compatibility decides how a project may be used at all:
 *   - `import`  — safe to depend on from this MIT package (MIT / Apache-2.0 / BSD / MPL).
 *   - `process` — copyleft or non-standard: call as a CLI/subprocess or over HTTP, never link.
 *   - `cite`    — usable as evidence only; do not ship code or data from it.
 *   - `unknown` — no licence file or unread terms. Treat as all-rights-reserved until checked.
 * Slugs and star counts were verified against the GitHub REST API on 2026-09-17.
 */

export interface EvidenceItem {
  id: string
  name: string
  kind: 'code' | 'database' | 'review'
  url: string
  use: string
  /** SPDX id where one was verified; `custom`/`none`/`review` otherwise. */
  license: string
  /** How this repo may be used from an MIT package. */
  integration: 'import' | 'process' | 'cite' | 'unknown'
  /** Stargazers at verification time; omitted for non-code resources. */
  stars?: number
  /** Set when the last check found a problem that a caller must not ignore. */
  warning_zh?: string
}

export const EVIDENCE: EvidenceItem[] = [
  { id: 's2f', name: 's2f-agent', kind: 'code', url: 'https://github.com/JiaqiLi1024/s2f-agent', use: 'Skill-routing agent for DNA foundation models (AlphaGenome, DNABERT-2, Evo 2, SpliceAI, …)', license: 'review', integration: 'process', warning_zh: '本机对应实现是 zwbao/s2f-penguin；执行留在该仓库，LongPi 只路由与出契约。' },
  { id: 'bioage', name: 'BioAge (Kwon & Belsky)', kind: 'code', url: 'https://github.com/dayoonkwon/BioAge', use: 'KDM bioage, PhenoAge, homeostatic dysregulation from NHANES blood chemistry', license: 'GPL-3.0', integration: 'cite', stars: 191, warning_zh: 'GPL-3：不得链接进本 MIT 包。PhenoAge 常数来自论文，本仓独立实现；BioAge 只用于核对。' },
  { id: 'openage', name: 'OpenAge / Healome', kind: 'code', url: 'https://github.com/Healome/openage', use: 'Open-weight blood-based biological age models', license: 'AGPL-3.0', integration: 'process', stars: 42, warning_zh: 'AGPL-3 网络传染性：只能跨进程/HTTP 调用，绝不能 import 进本包。' },
  { id: 'pyaging', name: 'pyaging', kind: 'code', url: 'https://github.com/lucascamillomd/pyaging', use: 'Python compendium of GPU-optimized aging clocks (methylation and others)', license: 'MIT', integration: 'process', stars: 130, warning_zh: '原 slug rsinghlab/pyaging 只是 301 重定向，canonical 已改为 lucascamillomd/pyaging。' },
  { id: 'biolearn', name: 'BioLearn', kind: 'code', url: 'https://github.com/bio-learn/biolearn', use: 'Harmonized biomarkers and clocks', license: 'BSD-3-Clause', integration: 'process', stars: 91, warning_zh: '原 slug BioAgeLab/biolearn 是 404（死链），已修正为 bio-learn/biolearn。GitHub 把它的许可识别成 NOASSERTION，实际 LICENSE 正文写着 "New BSD License"（已人工核对），可用。' },
  { id: 'methylcipher', name: 'methylCIPHER', kind: 'code', url: 'https://github.com/HigginsChenLab/methylCIPHER', use: 'Widest methylation-clock coverage: PC clocks, SystemsAge, CausalAge, DunedinPACE', license: 'BSD-3-Clause', integration: 'process', stars: 25 },
  { id: 'open-genes', name: 'Open Genes', kind: 'database', url: 'https://github.com/open-genes/open-genes-api', use: 'Longevity gene database with a real Python HTTP API', license: 'MPL-2.0', integration: 'process', stars: 9 },
  { id: 'pgscatalog', name: 'PGS Catalog / pgsc_calc', kind: 'code', url: 'https://github.com/PGScatalog/pgsc_calc', use: 'Polygenic scoring; the Catalog hosts longevity PGS (PGS000906, PGS002795)', license: 'Apache-2.0', integration: 'process', stars: 177, warning_zh: '多基因分数必须声明人群适用性；跨祖源迁移会失真。' },
  { id: 'pharmcat', name: 'PharmCAT', kind: 'code', url: 'https://github.com/PharmGKB/PharmCAT', use: 'Pharmacogenomic star-allele calling + CPIC annotations', license: 'MPL-2.0', integration: 'process', stars: 191, warning_zh: '药物基因组结论直接触及用药；与本仓「不改药」守则冲突，需要单独设计后才能接。' },
  { id: 'hagr', name: 'Human Ageing Genomic Resources', kind: 'database', url: 'https://genomics.senescence.info/download.html', use: 'GenAge, CellAge, LongevityMap, DrugAge, AnAge curated gene/compound lists', license: 'review', integration: 'unknown', warning_zh: '无官方 GitHub 仓库，只有可下载数据集；条款写明「在若干条件下可自由使用」，但完整法律条款尚未逐条确认。' },
  { id: 'opentargets', name: 'Open Targets', kind: 'database', url: 'https://platform.opentargets.org/', use: 'Gene–disease evidence graphs', license: 'review', integration: 'process', warning_zh: '旧域名 www.targetvalidation.org 已失效，本版修正为 platform.opentargets.org。' },
  { id: 'clinvar', name: 'ClinVar', kind: 'database', url: 'https://www.ncbi.nlm.nih.gov/clinvar/', use: 'Clinical variant assertions (not a longevity score)', license: 'public-domain', integration: 'process', warning_zh: 'NCBI 数据无版本化许可；引用时须带访问日期。' },
  { id: 'gnomad', name: 'gnomAD', kind: 'database', url: 'https://gnomad.broadinstitute.org/', use: 'Population allele frequencies', license: 'review', integration: 'process' },
  { id: 'gtex', name: 'GTEx', kind: 'database', url: 'https://gtexportal.org/', use: 'Tissue eQTL / sQTL context', license: 'review', integration: 'process' },
  { id: 'horvath', name: 'Horvath epigenetic clock', kind: 'review', url: 'https://doi.org/10.1186/gb-2013-14-10-r115', use: 'Foundational multi-tissue DNA methylation age', license: 'n/a', integration: 'cite', warning_zh: '时钟系数存在专利与许可争议，不要直接内置。' },
  { id: 'levine', name: 'Levine PhenoAge', kind: 'review', url: 'https://doi.org/10.18632/aging.101414', use: 'Clinical-chemistry phenotypic age', license: 'n/a', integration: 'cite', warning_zh: '本仓已按该论文独立实现引擎；只用发表常数，不引第三方代码。' },
  { id: 'dunedin', name: 'DunedinPACE', kind: 'review', url: 'https://doi.org/10.7554/eLife.73420', use: 'Pace of aging from methylation', license: 'n/a', integration: 'cite' },
  { id: 'foxo3', name: 'FOXO3 longevity association', kind: 'review', url: 'https://doi.org/10.1073/pnas.0801030105', use: 'Willcox 2008 FOXO3A in human longevity', license: 'n/a', integration: 'cite', warning_zh: '人群关联 ≠ 因果，不得据此改药或下个体结论。' },
]

export function lookupEvidence(query: string): {
  demo: true
  matches: EvidenceItem[]
  license_summary: { import: number; process: number; cite: number; unknown: number }
  coverage_note_zh: string
  usage_note_zh: string
} {
  const q = query.trim().toLowerCase()
  const matches = q
    ? EVIDENCE.filter((e) => `${e.id} ${e.name} ${e.use} ${e.license}`.toLowerCase().includes(q))
    : EVIDENCE
  const summary = { import: 0, process: 0, cite: 0, unknown: 0 }
  for (const e of EVIDENCE) summary[e.integration] += 1
  return {
    demo: true,
    matches: matches.slice(0, 12),
    license_summary: summary,
    coverage_note_zh: `这是人工精选的 ${EVIDENCE.length} 条索引，不是 GitHub 抗衰仓库全量爬取，也不是「前沿研究已全部融汇」。slug、星数、许可于 2026-09-17 核对过；漏了的项目用关键词再找，没有命中就说没有，不要编。`,
    usage_note_zh: 'integration 决定能不能用：import=可直接依赖；process=只能在独立进程/HTTP 调用（AGPL/GPL 等）；cite=只能引用，不得搬运代码或数据；unknown=无许可或条款未确认，等同于保留所有权利。带 warning_zh 的条目必须在展示时一并说出警告。',
  }
}
