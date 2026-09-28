// Each fact once on 总览 (INT062 fix 7). When 最重要的一步 sends the person to a doctor about some values, those
// values belong to that card. The other cards on 总览 leave them out, or say so in one short line.

import type { Journey } from './types.ts'

/** Red-cell and iron markers: one doctor finding, whichever of them the record flagged. */
const RED_CELL = ['hb', 'hgb', 'hct', 'mcv', 'mch', 'mchc', 'rbc', 'rdw', 'rdw_cv', 'rdwcv', 'ferritin', 'iron']
// 糖化血红蛋白 (HbA1c) is a glucose marker, not a red-cell one.
const RED_CELL_LABEL = /(?<!糖化)血红蛋白|红细胞|血色素|铁蛋白|血清铁|MCV|MCH|RDW/i

export interface Covered {
  keys: Set<string>
  labels: Set<string>
  /** The values the doctor card names, for a one-line pointer elsewhere. */
  redCell: boolean
}

export const NOTHING_COVERED: Covered = { keys: new Set(), labels: new Set(), redCell: false }

/** The markers 最重要的一步 already covers, when that card is on screen. */
export function coveredByCare(journey: Journey): Covered {
  if (journey.next.action !== 'doctor') return NOTHING_COVERED
  const hits = journey.doctor_first?.hits ?? []
  const keys = new Set(hits.map((hit) => hit.key))
  // A hit's short line starts with its label: 「血红蛋白 114 g/L 偏低」.
  const labels = new Set(hits.map((hit) => hit.short_zh.split(/\s/)[0] ?? '').filter(Boolean))
  const redCell = hits.some((hit) => RED_CELL.includes(hit.key)) || /(?<!糖化)血红蛋白|红细胞|贫血|铁蛋白/.test(`${journey.next.title_zh}${journey.next.detail_zh}`)
  if (redCell) for (const key of RED_CELL) keys.add(key)
  return { keys, labels, redCell }
}

export function isCovered(covered: Covered, row: { key?: string; label_zh?: string }): boolean {
  if (row.key && covered.keys.has(row.key)) return true
  const label = row.label_zh ?? ''
  if (label && covered.labels.has(label)) return true
  return covered.redCell && RED_CELL_LABEL.test(label)
}

/** Rows 值得注意的变化 shows on 总览: the first three the doctor card does not already cover. */
export const NOTABLE_ON_OVERVIEW = 3

export function notableRows<T extends { key?: string; label_zh?: string }>(rows: readonly T[], covered: Covered): T[] {
  return rows.filter((row) => !isCovered(covered, row)).slice(0, NOTABLE_ON_OVERVIEW)
}

/** The doctor card's detail without the title it repeats: the values once, then what to do. */
export function careDetail(title: string, detail: string): string {
  if (!detail || detail === title) return ''
  const lead = /^请先去看医生：/.test(title)
  return lead ? detail.replace(/^请先去看医生：/, '').replace(/请先去看医生。/g, '').replace(/\s{2,}/g, ' ').trim() : detail
}
