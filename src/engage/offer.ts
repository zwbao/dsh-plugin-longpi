// A drawn method card is a door into the library, not a gate. The same binder
// the chat uses either runs it or names the missing input. Tier C stays evidence.

import { bindRecord, type BindingProfile, type RecordView } from '../bind.ts'
import { loadCatalog, type SkillCard } from '../catalog.ts'
import type { CodexCard } from '../contracts/codex.ts'
import type { ResultLabel } from '../contracts/library.ts'
import { speciesZh } from '../skills-provider.ts'

export type OfferKind = 'run' | 'unlock' | 'evidence'

export interface MethodOffer {
  kind: OfferKind
  text_zh: string
  skill: string | null
  label: ResultLabel | null
  species_zh: string
  missing: string[]
}

export interface StoredRecord {
  age: number | null
  sex: string
  indicators: Array<{ name: string; value: string; unit: string; loinc?: string; date?: string }>
}

function speciesLine(card: SkillCard | null, codex: CodexCard): string {
  const fromSkill = card ? speciesZh(card.species) : ''
  if (fromSkill) return fromSkill
  if (codex.evidence_tier === 'animal') return '动物'
  if (codex.evidence_tier === 'cell') return '细胞'
  return '非人类'
}

function tierC(card: SkillCard | null, codex: CodexCard): boolean {
  if (card?.tier === 'C' || card?.tier === 'tool') return true
  return codex.evidence_tier === 'animal' || codex.evidence_tier === 'cell'
}

export function offerForCard(codex: CodexCard, home: string, view: RecordView | null): MethodOffer {
  const skillName = codex.skill ?? codex.source.skill ?? null
  const catalog = home ? loadCatalog(home) : null
  const skill = skillName && catalog ? catalog.cards.find((item) => item.name === skillName) ?? null : null
  const species = speciesLine(skill, codex)
  if (codex.family === 'species' || tierC(skill, codex)) {
    return {
      kind: 'evidence',
      text_zh: `${species}研究证据，并非你的数据。`,
      skill: skillName,
      label: 'evidence-only',
      species_zh: species,
      missing: [],
    }
  }
  if (!skill || !view) {
    return {
      kind: 'unlock',
      text_zh: '补充该方法所需的记录即可解锁',
      skill: skillName,
      label: null,
      species_zh: '',
      missing: [],
    }
  }
  const report = bindRecord(skill, { ...view, home: view.home || home })
  if (skill.tier === 'C') {
    return {
      kind: 'evidence',
      text_zh: `${species}研究证据，并非你的数据。`,
      skill: skill.name,
      label: 'evidence-only',
      species_zh: species,
      missing: [],
    }
  }
  const used = new Set(report.inputs_used.map((row) => row.input))
  const missing = skill.inputs.filter((spec) => spec.required && !used.has(spec.key)).map((spec) => spec.label_zh)
  const runnable = report.ok && report.label !== 'evidence-only' && (report.measurements.length + report.args.length > 0)
  if (runnable) {
    return {
      kind: 'run',
      text_zh: '该方法现已可用你的记录计算',
      skill: skill.name,
      label: report.label,
      species_zh: '',
      missing: [],
    }
  }
  const names = missing.slice(0, 3)
  return {
    kind: 'unlock',
    text_zh: names.length > 0 ? `补充${names.join('、')}即可解锁` : '补充该方法所需的记录即可解锁',
    skill: skill.name,
    label: report.label,
    species_zh: '',
    missing,
  }
}

export function viewFromStored(home: string, stored: StoredRecord | null, pinnedVersion?: string): RecordView | null {
  if (!stored) return null
  const profile: BindingProfile = { age: stored.age, sex: stored.sex === 'male' || stored.sex === 'female' ? stored.sex : 'unknown' }
  return {
    home,
    profile,
    indicators: stored.indicators.map((row) => ({
      name: row.name,
      value: row.value,
      unit: row.unit,
      ...(row.loinc ? { loinc: row.loinc } : {}),
      ...(row.date ? { date: row.date } : {}),
    })),
    ...(pinnedVersion ? { pinnedVersion } : {}),
  }
}
