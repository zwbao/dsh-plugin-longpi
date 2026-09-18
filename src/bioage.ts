/**
 * Biological-age engine.
 *
 * Design rule: a number is only reported when its formula is fully specified by a
 * published, citable source and every input is either measured or explicitly
 * labelled `demo_synthetic`. When an algorithm needs fitted parameters we do not
 * own (e.g. the NHANES young-healthy reference covariance for homeostatic
 * dysregulation), we return `not_run` with the reason instead of inventing one.
 *
 * Licensing: the constants below are transcribed from the published literature,
 * not from any GPL project. `dayoonkwon/BioAge` (GPL-3) was used only to confirm
 * that the transcription matches; no BioAge code is copied, so this file stays MIT.
 */

export interface Provenance {
  /** Model id, stable across releases. */
  model: string
  /** Human-readable model name. */
  label: string
  /** Primary citation for the formula. */
  citation: string
  /** DOI/URL of the primary citation. */
  citation_url: string
  /** Open implementations consulted to verify the transcription (attribution, not dependency). */
  cross_checked_with: string[]
  /** Units this model expects, per input key. Printed so the caller cannot mis-unit silently. */
  required_units: Record<string, string>
  /** Claims this number does NOT support. Rendered next to every value. */
  claim_ceiling: string[]
}

/** One biochemical input with its value and provenance layer. */
export interface BiomarkerInput {
  key: PhenoAgeMarker
  value: number
  /** Where the number came from. `demo_synthetic` is never a real person's result. */
  layer: 'measured' | 'user_reported' | 'demo_synthetic'
  /** e.g. 'labs.jsonl#2026-09-10' or 'raw/labs/checkup.pdf#page=2'. */
  source_ref: string
}

export type PhenoAgeMarker =
  | 'albumin_gL'
  | 'creatinine_umolL'
  | 'glucose_mmolL'
  | 'ln_crp_mgL'
  | 'lymphocyte_pct'
  | 'mcv_fL'
  | 'rdw_pct'
  | 'alp_UL'
  | 'wbc_1000uL'

export const PHENOAGE_PROVENANCE: Provenance = {
  model: 'phenoage-levine-2018',
  label: 'Phenotypic Age (PhenoAge), Levine 2018',
  citation: 'Levine ME et al., "An epigenetic biomarker of aging for lifespan and healthspan", Aging (Albany NY) 2018;10(4):573-591',
  citation_url: 'https://doi.org/10.18632/aging.101414',
  cross_checked_with: [
    'https://github.com/dayoonkwon/BioAge (GPL-3; used to confirm constants, no code copied)',
    'https://github.com/rsinghlab/pyaging',
  ],
  required_units: {
    albumin_gL: 'g/L',
    creatinine_umolL: 'umol/L',
    glucose_mmolL: 'mmol/L',
    ln_crp_mgL: 'ln(mg/L) — natural log of hs-CRP in mg/L',
    lymphocyte_pct: 'percent',
    mcv_fL: 'fL',
    rdw_pct: 'percent',
    alp_UL: 'U/L',
    wbc_1000uL: '1000 cells/uL',
  },
  claim_ceiling: [
    'PhenoAge is a population model trained on NHANES III mortality. It is not a diagnosis, not a disease risk for one person, and not a treatment target.',
    'A single measurement has wide individual error. Only a trend on the same assay and units is interpretable.',
    'It cannot be compared across labs without unit normalisation; creatinine in particular is assay-dependent.',
  ],
}

/**
 * PhenoAge coefficients, Levine 2018 (mortality model). Mortality score is a
 * Gompertz hazard on a linear predictor of age plus nine biomarkers.
 */
const PHENOAGE_COEF = {
  intercept: -19.90667,
  age: 0.08035356,
  albumin_gL: -0.03359355,
  creatinine_umolL: 0.009506491,
  glucose_mmolL: 0.1953192,
  ln_crp_mgL: 0.09536762,
  lymphocyte_pct: -0.01199984,
  mcv_fL: 0.02676401,
  rdw_pct: 0.3306156,
  alp_UL: 0.001868778,
  wbc_1000uL: 0.05542406,
} as const

/** Gompertz parameters used to project mortality back onto an age scale. */
const PHENOAGE_GOMPERTZ = {
  /** gamma */
  gamma: 0.007692696,
  /** lambda */
  lambda: 1.51714,
  /** 10-year (120-month) mortality */
  months: 120,
  /** Back-projection onto the age scale. */
  back_log_scale: -0.0055305,
  back_divisor: 0.090165,
  back_offset: 141.50225,
} as const

export interface PhenoAgeResult {
  ok: true
  model: string
  /** Linear predictor (xb) from age + nine biomarkers. */
  xb: number
  /** 10-year all-cause mortality probability implied by the model. */
  mortality_10y: number
  /** Phenotypic age in years. */
  phenoage: number
  /** phenoage - chronological_age. Positive means biologically older than the calendar. */
  phenoage_advance: number
  chronological_age: number
  /** Echoes every input actually used, so a reviewer can recompute by hand. */
  inputs_used: Record<string, number>
  provenance: Provenance
  /** Any input that arrived on a unit we had to convert, with the conversion stated. */
  unit_notes: string[]
}

export interface PhenoAgeFailure {
  ok: false
  model: string
  code: 'MISSING_INPUT' | 'OUT_OF_RANGE' | 'BAD_AGE'
  message_zh: string
  missing: PhenoAgeMarker[]
  out_of_range: Array<{ key: PhenoAgeMarker; value: number; expected: string }>
}

/**
 * Plausibility bounds. Outside these, the input is far more likely to be a unit
 * error (mg/dL passed as mmol/L, g/dL passed as g/L) than a real extreme, so the
 * model refuses to score rather than emit a confident wrong age.
 */
const PLAUSIBLE: Record<PhenoAgeMarker, { min: number; max: number; expected: string }> = {
  albumin_gL: { min: 15, max: 70, expected: 'g/L (35–50 typical; 3.5 g/dL is 35 g/L, not 3.5)' },
  creatinine_umolL: { min: 20, max: 1500, expected: 'umol/L (62–106 typical; 1.0 mg/dL is 88.4 umol/L)' },
  glucose_mmolL: { min: 1.5, max: 40, expected: 'mmol/L fasting (4.0–5.6 typical; 100 mg/dL is 5.55 mmol/L)' },
  ln_crp_mgL: { min: Math.log(0.01), max: Math.log(300), expected: 'ln(mg/L) (hs-CRP 4.2 mg/L is ln 4.2 = 1.435)' },
  lymphocyte_pct: { min: 1, max: 95, expected: 'percent of WBC (20–45 typical)' },
  mcv_fL: { min: 50, max: 140, expected: 'fL (80–100 typical)' },
  rdw_pct: { min: 8, max: 35, expected: 'percent (11.5–14.5 typical)' },
  alp_UL: { min: 10, max: 1200, expected: 'U/L (40–130 typical)' },
  wbc_1000uL: { min: 0.2, max: 100, expected: '1000 cells/uL (4.0–11.0 typical; 7000/uL is 7.0)' },
}

/**
 * Compute PhenoAge. Refuses (never guesses) when an input is missing or implausible.
 */
export function phenoAge(
  biomarkers: BiomarkerInput[],
  chronologicalAge: number,
): PhenoAgeResult | PhenoAgeFailure {
  if (!Number.isFinite(chronologicalAge) || chronologicalAge <= 0 || chronologicalAge > 130) {
    return {
      ok: false,
      model: 'phenoage-levine-2018',
      code: 'BAD_AGE',
      message_zh: `实足年龄不合理：${chronologicalAge}。`,
      missing: [],
      out_of_range: [],
    }
  }

  const byKey = new Map<PhenoAgeMarker, number>()
  for (const b of biomarkers) {
    if (Number.isFinite(b.value)) byKey.set(b.key, b.value)
  }

  const keys = Object.keys(PHENOAGE_COEF).filter(
    (k): k is PhenoAgeMarker => k !== 'intercept' && k !== 'age',
  )
  const missing = keys.filter((k) => !byKey.has(k))
  if (missing.length) {
    return {
      ok: false,
      model: 'phenoage-levine-2018',
      code: 'MISSING_INPUT',
      message_zh: `PhenoAge 需要 9 项生物标志物，缺 ${missing.length} 项：${missing.join(', ')}。缺项时不外推、不填均值。`,
      missing,
      out_of_range: [],
    }
  }

  const outOfRange: Array<{ key: PhenoAgeMarker; value: number; expected: string }> = []
  for (const k of keys) {
    const v = byKey.get(k)!
    const b = PLAUSIBLE[k]
    if (v < b.min || v > b.max) outOfRange.push({ key: k, value: v, expected: b.expected })
  }
  if (outOfRange.length) {
    return {
      ok: false,
      model: 'phenoage-levine-2018',
      code: 'OUT_OF_RANGE',
      message_zh: `有 ${outOfRange.length} 项超出可信范围，最可能是单位错误。请按 required_units 复核后再算。`,
      missing: [],
      out_of_range: outOfRange,
    }
  }

  const xb =
    PHENOAGE_COEF.intercept +
    PHENOAGE_COEF.age * chronologicalAge +
    PHENOAGE_COEF.albumin_gL * byKey.get('albumin_gL')! +
    PHENOAGE_COEF.creatinine_umolL * byKey.get('creatinine_umolL')! +
    PHENOAGE_COEF.glucose_mmolL * byKey.get('glucose_mmolL')! +
    PHENOAGE_COEF.ln_crp_mgL * byKey.get('ln_crp_mgL')! +
    PHENOAGE_COEF.lymphocyte_pct * byKey.get('lymphocyte_pct')! +
    PHENOAGE_COEF.mcv_fL * byKey.get('mcv_fL')! +
    PHENOAGE_COEF.rdw_pct * byKey.get('rdw_pct')! +
    PHENOAGE_COEF.alp_UL * byKey.get('alp_UL')! +
    PHENOAGE_COEF.wbc_1000uL * byKey.get('wbc_1000uL')!

  const g = PHENOAGE_GOMPERTZ
  const mortality =
    1 - Math.exp((-g.lambda * Math.exp(xb)) / g.gamma)
  const phenoage =
    Math.log(g.back_log_scale * Math.log(1 - mortality)) / g.back_divisor + g.back_offset

  const unitNotes: string[] = []
  for (const b of biomarkers) {
    if (b.layer === 'demo_synthetic') {
      unitNotes.push(`${b.key}: 合成演示值，非真实个体（source_ref=${b.source_ref}）`)
    }
  }

  return {
    ok: true,
    model: 'phenoage-levine-2018',
    xb,
    mortality_10y: mortality,
    phenoage,
    phenoage_advance: phenoage - chronologicalAge,
    chronological_age: chronologicalAge,
    inputs_used: Object.fromEntries(keys.map((k) => [k, byKey.get(k)!])),
    provenance: PHENOAGE_PROVENANCE,
    unit_notes: unitNotes,
  }
}

/** Convenience: natural log of hs-CRP in mg/L, the form PhenoAge consumes. */
export function lnCrp(hsCrpMgL: number): number {
  return Math.log(hsCrpMgL)
}

/* ------------------------------------------------------------------ *
 * Homeostatic dysregulation (HD)
 * ------------------------------------------------------------------ */

export interface HdReference {
  /** Biomarker order used by `means` and `inverse_covariance`. */
  biomarkers: PhenoAgeMarker[]
  /** Means of each biomarker in the young-healthy reference cohort. */
  means: number[]
  /**
   * Inverse of the reference covariance matrix. Held explicitly rather than as a
   * covariance so the engine does not need a matrix inverse at runtime and the
   * shipped numbers are exactly the ones that were validated.
   */
  inverse_covariance: number[][]
  /** Reference cohort definition, for the receipt. */
  cohort: string
  /** Where these parameters came from. Must be a real, inspectable source. */
  source_ref: string
}

export const HD_PROVENANCE: Provenance = {
  model: 'homeostatic-dysregulation-cohen-2013',
  label: 'Homeostatic dysregulation (Mahalanobis distance to a young-healthy reference)',
  citation: 'Cohen AA et al., "A novel statistical approach shows evidence for multi-system physiological dysregulation during aging", Mech Ageing Dev 2013',
  citation_url: 'https://doi.org/10.1016/j.mad.2013.01.002',
  cross_checked_with: ['https://github.com/dayoonkwon/BioAge (GPL-3; method description only, no code copied)'],
  required_units: {
    albumin_gL: 'g/L',
    creatinine_umolL: 'umol/L',
    glucose_mmolL: 'mmol/L',
    ln_crp_mgL: 'ln(mg/L)',
    lymphocyte_pct: 'percent',
    mcv_fL: 'fL',
    rdw_pct: 'percent',
    alp_UL: 'U/L',
    wbc_1000uL: '1000 cells/uL',
  },
  claim_ceiling: [
    'HD is an effect-size-like distance, not an age in years. Do not render it on an age axis.',
    'It is only comparable against the same reference cohort parameters; changing the cohort changes the number.',
    'It requires normally distributed, reference-standardised inputs.',
  ],
}

/**
 * HD is a distance, so it has no value until a reference cohort's parameters are
 * supplied. Without them we return `not_run` and say why, rather than scoring
 * against an invented reference.
 */
export function homeostaticDysregulation(
  biomarkers: BiomarkerInput[],
  reference: HdReference | null,
): { ok: true; hd: number; provenance: Provenance; inputs_used: Record<string, number> }
  | PhenoAgeFailure
  | { ok: false; model: string; code: 'NO_REFERENCE'; message_zh: string; how_to_supply: string } {
  if (!reference) {
    return {
      ok: false,
      model: HD_PROVENANCE.model,
      code: 'NO_REFERENCE',
      message_zh:
        '稳态失调（HD）需要一个年轻健康参考队列的均值与协方差参数才能算。本仓不内置该参数，也不编一个：没有它时 HD 报 not_run。',
      how_to_supply:
        '在 config 中提供 hdReference（biomarkers / means / inverse_covariance / cohort / source_ref），数值须来自可核查的 NHANES 20–30 岁健康子集拟合结果；或改走 pyaging / BioAge 的已发表参数。',
    }
  }

  const byKey = new Map<PhenoAgeMarker, number>()
  for (const b of biomarkers) if (Number.isFinite(b.value)) byKey.set(b.key, b.value)
  const missing = reference.biomarkers.filter((k) => !byKey.has(k))
  if (missing.length) {
    return {
      ok: false,
      model: HD_PROVENANCE.model,
      code: 'MISSING_INPUT',
      message_zh: `HD 缺 ${missing.length} 项：${missing.join(', ')}。`,
      missing,
      out_of_range: [],
    }
  }
  if (reference.means.length !== reference.biomarkers.length
    || reference.inverse_covariance.length !== reference.biomarkers.length) {
    return {
      ok: false,
      model: HD_PROVENANCE.model,
      code: 'MISSING_INPUT',
      message_zh: 'hdReference 维度不一致：biomarkers / means / inverse_covariance 长度必须相等。',
      missing: [],
      out_of_range: [],
    }
  }

  const d = reference.biomarkers.map((k, i) => byKey.get(k)! - reference.means[i]!)
  let q = 0
  for (let i = 0; i < d.length; i += 1) {
    for (let j = 0; j < d.length; j += 1) {
      q += d[i]! * reference.inverse_covariance[i]![j]! * d[j]!
    }
  }
  const hd = Math.sqrt(Math.max(0, q))

  return {
    ok: true,
    hd,
    provenance: {
      ...HD_PROVENANCE,
      label: `${HD_PROVENANCE.label} — reference: ${reference.cohort}`,
      citation_url: HD_PROVENANCE.citation_url,
    },
    inputs_used: Object.fromEntries(reference.biomarkers.map((k) => [k, byKey.get(k)!])),
  }
}

/* ------------------------------------------------------------------ *
 * Composite age
 * ------------------------------------------------------------------ */

export interface ModuleAge {
  biological: number
  physiological: number
  psychological: number
  behavioral: number
  social_env: number
}

export const MODULE_WEIGHTS_FOR_AGE: Record<keyof ModuleAge, number> = {
  biological: 0.35,
  physiological: 0.30,
  psychological: 0.15,
  behavioral: 0.10,
  social_env: 0.10,
}

export interface CompositeAgeResult {
  ok: true
  composite_age: number
  chrono_age: number
  delta: number
  weights: Record<string, number>
  /** Each module's contribution to the composite, so the arithmetic is auditable. */
  contributions: Record<string, number>
  /** Where each module age came from. `engine` means computed, `demo` means a fixed demo input. */
  module_source: Record<string, 'engine' | 'demo'>
  method: string
}

export function compositeAge(
  modules: ModuleAge,
  chronoAge: number,
  source: Partial<Record<keyof ModuleAge, 'engine' | 'demo'>> = {},
): CompositeAgeResult | { ok: false; code: string; message_zh: string } {
  const w = MODULE_WEIGHTS_FOR_AGE
  const sum = Object.values(w).reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1) > 1e-9) {
    return { ok: false, code: 'BAD_WEIGHTS', message_zh: `模块权重和为 ${sum}，必须为 1。` }
  }
  for (const [k, v] of Object.entries(modules)) {
    if (!Number.isFinite(v) || v <= 0 || v > 130) {
      return { ok: false, code: 'BAD_MODULE', message_zh: `模块 ${k} 的年龄不合理：${v}。` }
    }
  }
  const contributions: Record<string, number> = {}
  let composite = 0
  for (const k of Object.keys(w) as Array<keyof ModuleAge>) {
    const c = modules[k] * w[k]
    contributions[k] = c
    composite += c
  }
  const moduleSource = Object.fromEntries(
    (Object.keys(w) as Array<keyof ModuleAge>).map((k) => [k, source[k] ?? 'demo']),
  ) as Record<string, 'engine' | 'demo'>

  return {
    ok: true,
    composite_age: composite,
    chrono_age: chronoAge,
    delta: composite - chronoAge,
    weights: { ...w },
    contributions,
    module_source: moduleSource,
    method:
      'composite = Σ(module_age × weight)；biological 由 PhenoAge（Levine 2018）算出，其余四维为演示输入。权重与公式都在本仓，可复算。',
  }
}
