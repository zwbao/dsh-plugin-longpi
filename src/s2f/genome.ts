export type OmicsLayer = 'genome' | 'epigenome' | 'transcriptome' | 'proteome' | 'metabolome'

export interface DemoVariant {
  id: string
  rsid: string
  gene: string
  assembly: 'hg38'
  chrom: string
  position: number
  ref: string
  alt: string
  genotype_demo: string
  consequence: string
  gnomad_af_note: string
  clinvar: string
  longevity_note_zh: string
  citation: string
  s2f_skills: string[]
  layers: OmicsLayer[]
}

/** Synthetic 张明远 genome panel. Not a real person. */
export const DEMO_VARIANTS: DemoVariant[] = [
  {
    id: 'foxo3-rs2802292',
    rsid: 'rs2802292',
    gene: 'FOXO3',
    assembly: 'hg38',
    chrom: 'chr6',
    position: 108587315,
    ref: 'G',
    alt: 'T',
    genotype_demo: 'GT',
    consequence: 'intron_variant',
    gnomad_af_note: 'common longevity-associated allele in several cohorts; frequency population-specific',
    clinvar: 'not a Mendelian pathogenic assertion',
    longevity_note_zh: 'FOXO3 常见位点，多个人类长寿队列有关联报道。关联 ≠ 因果，不能据此改药。',
    citation: 'Willcox et al., PNAS 2008 (FOXO3A); Flachsbart et al., PNAS 2009',
    s2f_skills: ['alphagenome-api', 'gpn_msa'],
    layers: ['genome', 'transcriptome'],
  },
  {
    id: 'apoe-rs429358',
    rsid: 'rs429358',
    gene: 'APOE',
    assembly: 'hg38',
    chrom: 'chr19',
    position: 44908684,
    ref: 'T',
    alt: 'C',
    genotype_demo: 'TT',
    consequence: 'missense_variant (ε4-defining when C)',
    gnomad_af_note: 'demo genotype TT = not ε4 at this SNP',
    clinvar: 'risk allele for AD/CVD is C (ε4); demo is T/T',
    longevity_note_zh: '演示基因型 TT，不是 ε4。ε4 与 Alzheimer / 心血管风险相关文献极多；此处只报告演示等位基因，不做诊断。',
    citation: 'Corder et al., Science 1993; Belloy et al., JAMA Neurol reviews',
    s2f_skills: ['alphagenome-api', 'gpn_msa'],
    layers: ['genome', 'proteome', 'metabolome'],
  },
  {
    id: 'cetp-rs5882',
    rsid: 'rs5882',
    gene: 'CETP',
    assembly: 'hg38',
    chrom: 'chr16',
    position: 56962376,
    ref: 'A',
    alt: 'G',
    genotype_demo: 'AG',
    consequence: 'missense_variant',
    gnomad_af_note: 'common missense; lipid-trait associations',
    clinvar: 'not used as a diagnostic P/LP assertion here',
    longevity_note_zh: 'CETP 与 HDL / 长寿的观察性关联存在争议，需表型（血脂）一起看。',
    citation: 'Barzilai et al., JAMA 2003 (Ashkenazi centenarians, CETP)',
    s2f_skills: ['gpn_msa', 'alphagenome-api'],
    layers: ['genome', 'proteome', 'metabolome'],
  },
  {
    id: 'il6r-rs2228145',
    rsid: 'rs2228145',
    gene: 'IL6R',
    assembly: 'hg38',
    chrom: 'chr1',
    position: 154454494,
    ref: 'A',
    alt: 'C',
    genotype_demo: 'AC',
    consequence: 'missense_variant (Asp358Ala)',
    gnomad_af_note: 'common; IL-6 signaling / CRP association in GWAS',
    clinvar: 'trait-associated, not a rare disease diagnosis',
    longevity_note_zh: '与 IL-6 信号和循环 CRP 相关的常见错义变异。可与演示 hs-CRP 4.2 mg/L 对照讨论，但不能解释为「患有炎症病」。',
    citation: 'IL6R GWAS / IL-6R blockade Mendelian randomization literature',
    s2f_skills: ['alphagenome-api', 'borzoi-workflows'],
    layers: ['genome', 'transcriptome', 'proteome'],
  },
  {
    id: 'apoe-rs7412',
    rsid: 'rs7412',
    gene: 'APOE',
    assembly: 'hg38',
    chrom: 'chr19',
    position: 44908822,
    ref: 'C',
    alt: 'T',
    genotype_demo: 'CC',
    consequence: 'missense_variant (ε2-defining when T)',
    gnomad_af_note: 'demo CC = not ε2 at this SNP',
    clinvar: 'ε2 allele is T; demo is C/C',
    longevity_note_zh: '与 rs429358 共同定义 APOE ε2/ε3/ε4。演示不是 ε2。',
    citation: 'Corder et al., Science 1993; APOE haplotype reviews',
    s2f_skills: ['alphagenome-api', 'gpn_msa'],
    layers: ['genome', 'proteome', 'metabolome'],
  },
  {
    id: 'klotho-rs9536314',
    rsid: 'rs9536314',
    gene: 'KL',
    assembly: 'hg38',
    chrom: 'chr13',
    position: 33054001,
    ref: 'T',
    alt: 'G',
    genotype_demo: 'TT',
    consequence: 'missense_variant (KL-VS F352V when G)',
    gnomad_af_note: 'KL-VS haplotype variant; frequency ancestry-specific',
    clinvar: 'research association, not a Mendelian P/LP used here',
    longevity_note_zh: 'Klotho KL-VS 与认知/长寿的观察性报道，证据混杂。',
    citation: 'Arking et al., PNAS 2002; Dubal / Klotho literature',
    s2f_skills: ['gpn_msa', 'alphagenome-api'],
    layers: ['genome', 'proteome'],
  },
  {
    id: 'tert-rs2736100',
    rsid: 'rs2736100',
    gene: 'TERT',
    assembly: 'hg38',
    chrom: 'chr5',
    position: 1286401,
    ref: 'C',
    alt: 'A',
    genotype_demo: 'CA',
    consequence: 'intron_variant',
    gnomad_af_note: 'common TERT GWAS hit (telomere length / cancer traits)',
    clinvar: 'trait-associated',
    longevity_note_zh: '端粒酶相关常见位点。端粒长度未在本面板直接测量。',
    citation: 'Codd et al., Nat Genet telomere GWAS',
    s2f_skills: ['alphagenome-api'],
    layers: ['genome', 'epigenome'],
  },
  {
    id: 'cdkn2a-rs10757278',
    rsid: 'rs10757278',
    gene: 'CDKN2B-AS1',
    assembly: 'hg38',
    chrom: 'chr9',
    position: 22124478,
    ref: 'A',
    alt: 'G',
    genotype_demo: 'AG',
    consequence: 'intergenic_variant (9p21)',
    gnomad_af_note: 'common 9p21 CAD/aging locus',
    clinvar: 'risk locus, not a rare-disease assertion',
    longevity_note_zh: '9p21 冠心病/衰老相关 GWAS 位点。需血脂与表型一起看。',
    citation: 'McPherson / Helgadottir 9p21 CAD GWAS',
    s2f_skills: ['alphagenome-api', 'borzoi-workflows'],
    layers: ['genome', 'epigenome', 'transcriptome'],
  },
  {
    id: 'mthfr-rs1801133',
    rsid: 'rs1801133',
    gene: 'MTHFR',
    assembly: 'hg38',
    chrom: 'chr1',
    position: 11796321,
    ref: 'G',
    alt: 'A',
    genotype_demo: 'GA',
    consequence: 'missense_variant (C677T)',
    gnomad_af_note: 'very common; folate/homocysteine biochemistry',
    clinvar: 'not interpreted as a standalone disease diagnosis here',
    longevity_note_zh: '叶酸代谢常见位点。没有同型半胱氨酸化验时只做生化背景说明。',
    citation: 'Frosst et al., Nat Genet 1995',
    s2f_skills: ['gpn_msa', 'alphagenome-api'],
    layers: ['genome', 'metabolome'],
  },
  {
    id: 'sod2-rs4880',
    rsid: 'rs4880',
    gene: 'SOD2',
    assembly: 'hg38',
    chrom: 'chr6',
    position: 159692840,
    ref: 'A',
    alt: 'G',
    genotype_demo: 'AG',
    consequence: 'missense_variant (Ala16Val)',
    gnomad_af_note: 'common mitochondrial SOD2 variant',
    clinvar: 'trait-associated',
    longevity_note_zh: '线粒体抗氧化酶常见错义，文献对表型效应不一致。',
    citation: 'SOD2 Ala16Val association reviews',
    s2f_skills: ['gpn_msa', 'alphagenome-api'],
    layers: ['genome', 'proteome'],
  },
  {
    id: 'bdnf-rs6265',
    rsid: 'rs6265',
    gene: 'BDNF',
    assembly: 'hg38',
    chrom: 'chr11',
    position: 27658369,
    ref: 'C',
    alt: 'T',
    genotype_demo: 'CC',
    consequence: 'missense_variant (Val66Met when T)',
    gnomad_af_note: 'common; neuroscience trait literature',
    clinvar: 'not a diagnostic P/LP for this plugin',
    longevity_note_zh: '脑源性神经营养因子常见位点，偏认知表型，不是长寿决定因子。',
    citation: 'Egan et al., Cell 2003 (Val66Met)',
    s2f_skills: ['alphagenome-api'],
    layers: ['genome', 'transcriptome'],
  },
  {
    id: 'fto-rs9939609',
    rsid: 'rs9939609',
    gene: 'FTO',
    assembly: 'hg38',
    chrom: 'chr16',
    position: 53786615,
    ref: 'T',
    alt: 'A',
    genotype_demo: 'TA',
    consequence: 'intron_variant',
    gnomad_af_note: 'common BMI GWAS locus',
    clinvar: 'trait-associated',
    longevity_note_zh: '体重/代谢 GWAS 位点。需 BMI/代谢表型，不能单独谈寿命。',
    citation: 'Frayling et al., Science 2007',
    s2f_skills: ['alphagenome-api', 'borzoi-workflows'],
    layers: ['genome', 'metabolome'],
  },
]

export function findVariants(q: string): DemoVariant[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const exact = DEMO_VARIANTS.filter((v) => v.rsid.toLowerCase() === s || v.id === s)
  if (exact.length) return exact
  return DEMO_VARIANTS.filter((v) =>
    v.gene.toLowerCase() === s || s.includes(v.rsid.toLowerCase()) || s.includes(v.gene.toLowerCase()),
  )
}

export function findVariant(q: string): DemoVariant | undefined {
  return findVariants(q)[0]
}

export function genomeBlock(): string {
  const rows = DEMO_VARIANTS.map((v) =>
    `- ${v.gene} ${v.rsid} ${v.chrom}:${v.position} ${v.ref}/${v.alt} gt=${v.genotype_demo} (${v.consequence})`,
  )
  return ['## 演示基因组（合成，非真实测序）', ...rows, '坐标默认 hg38，1-based。'].join('\n')
}
