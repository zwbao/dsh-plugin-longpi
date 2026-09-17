/**
 * Curated longevity / aging index — NOT a crawl of GitHub.
 * Each row is a named project or resource we actually looked at.
 */

export interface EvidenceItem {
  id: string
  name: string
  kind: 'code' | 'database' | 'review'
  url: string
  use: string
}

export const EVIDENCE: EvidenceItem[] = [
  { id: 's2f', name: 's2f-agent', kind: 'code', url: 'https://github.com/JiaqiLi1024/s2f-agent', use: 'Skill-routing agent for DNA foundation models (AlphaGenome, DNABERT-2, Evo 2, SpliceAI, …)' },
  { id: 'bioage', name: 'BioAge (Kwon & Belsky)', kind: 'code', url: 'https://github.com/dayoonkwon/BioAge', use: 'KDM bioage, PhenoAge, homeostatic dysregulation from NHANES blood chemistry' },
  { id: 'openage', name: 'OpenAge / Healome', kind: 'code', url: 'https://github.com/Healome/openage', use: 'Open-weight blood-based biological age models' },
  { id: 'pyaging', name: 'pyaging', kind: 'code', url: 'https://github.com/rsinghlab/pyaging', use: 'Python library of aging clocks (methylation and others)' },
  { id: 'biolearn', name: 'Biolearn', kind: 'code', url: 'https://github.com/BioAgeLab/biolearn', use: 'Harmonized biomarkers and clocks' },
  { id: 'hagr', name: 'Human Ageing Genomic Resources', kind: 'database', url: 'https://genomics.senescence.info/', use: 'GenAge, CellAge, LongevityMap curated gene lists' },
  { id: 'opentargets', name: 'Open Targets', kind: 'database', url: 'https://www.targetvalidation.org/', use: 'Gene–disease evidence graphs' },
  { id: 'clinvar', name: 'ClinVar', kind: 'database', url: 'https://www.ncbi.nlm.nih.gov/clinvar/', use: 'Clinical variant assertions (not a longevity score)' },
  { id: 'gnomad', name: 'gnomAD', kind: 'database', url: 'https://gnomad.broadinstitute.org/', use: 'Population allele frequencies' },
  { id: 'gtex', name: 'GTEx', kind: 'database', url: 'https://gtexportal.org/', use: 'Tissue eQTL / sQTL context' },
  { id: 'horvath', name: 'Horvath epigenetic clock', kind: 'review', url: 'https://doi.org/10.1186/gb-2013-14-10-r115', use: 'Foundational multi-tissue DNA methylation age' },
  { id: 'levine', name: 'Levine PhenoAge', kind: 'review', url: 'https://doi.org/10.18632/aging.101414', use: 'Clinical-chemistry phenotypic age' },
  { id: 'dunedin', name: 'DunedinPACE', kind: 'review', url: 'https://doi.org/10.7554/eLife.73420', use: 'Pace of aging from methylation' },
  { id: 'foxo3', name: 'FOXO3 longevity association', kind: 'review', url: 'https://doi.org/10.1073/pnas.0801030105', use: 'Willcox 2008 FOXO3A in human longevity' },
]

export function lookupEvidence(query: string): { demo: true; matches: EvidenceItem[]; coverage_note_zh: string } {
  const q = query.trim().toLowerCase()
  const matches = q
    ? EVIDENCE.filter((e) => `${e.id} ${e.name} ${e.use}`.toLowerCase().includes(q))
    : EVIDENCE
  return {
    demo: true,
    matches: matches.slice(0, 12),
    coverage_note_zh: '这是人工精选的约 14 条索引，不是 GitHub 抗衰仓库全量爬取，也不是「前沿研究已全部融汇」。漏了的项目用 lookup 关键词再找；没有命中就说没有，不要编。',
  }
}
