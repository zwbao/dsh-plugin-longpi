export interface IndicatorRow {
  name: string
  value: string
  unit: string
  loinc?: string
}

export interface MedicationRow {
  name: string
  status: string
  recorded_dose: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function firstText(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const text = textOf(rec[key])
    if (text) return text
  }
  return ''
}

export function summarizeIndicators(payload: unknown, max = 40): IndicatorRow[] {
  const rows: IndicatorRow[] = []
  walkIndicators(payload, rows, 0, Math.max(max * 2, 80))
  const seen = new Set<string>()
  const unique: IndicatorRow[] = []
  for (const row of rows) {
    const key = row.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(row)
    if (unique.length >= max) break
  }
  return unique
}

function walkIndicators(value: unknown, rows: IndicatorRow[], depth: number, cap: number): void {
  if (depth > 8 || rows.length >= cap) return
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        const name = item.trim()
        if (name) rows.push({ name, value: '', unit: '' })
      } else {
        walkIndicators(item, rows, depth + 1, cap)
      }
    }
    return
  }
  const rec = asRecord(value)
  if (!rec) return
  const name = firstText(rec, ['indicator', 'indicator_name', 'name', 'title'])
  const measurement = firstText(rec, ['value', 'latest', 'result', 'last_value'])
  const unit = firstText(rec, ['unit', 'ucum'])
  const loinc = firstText(rec, ['loinc', 'loinc_code', 'loincCode'])
  if (name && (measurement || unit)) rows.push(loinc ? { name, value: measurement, unit, loinc } : { name, value: measurement, unit })
  for (const [key, child] of Object.entries(rec)) {
    if (key === 'name' || key === 'value' || key === 'unit') continue
    if (child && typeof child === 'object') walkIndicators(child, rows, depth + 1, cap)
  }
}

export function summarizeMedications(payload: unknown): MedicationRow[] {
  const rows: MedicationRow[] = []
  walkMedications(payload, rows, 0)
  const seen = new Set<string>()
  const unique: MedicationRow[] = []
  for (const row of rows) {
    const key = row.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(row)
    if (unique.length >= 30) break
  }
  return unique
}

function walkMedications(value: unknown, rows: MedicationRow[], depth: number): void {
  if (depth > 8 || rows.length >= 60) return
  if (Array.isArray(value)) {
    for (const item of value) walkMedications(item, rows, depth + 1)
    return
  }
  const rec = asRecord(value)
  if (!rec) return
  const name = firstText(rec, ['drug', 'medication', 'medicine', 'name', 'title'])
  const status = firstText(rec, ['status', 'state'])
  const recorded = firstText(rec, ['dose', 'dosage', 'strength', 'recorded_dose'])
  if (name && (status || recorded || rec.dose != null || rec.status != null)) {
    rows.push({ name, status, recorded_dose: recorded })
  }
  for (const [key, child] of Object.entries(rec)) {
    if (['name', 'dose', 'status', 'drug'].includes(key)) continue
    if (child && typeof child === 'object') walkMedications(child, rows, depth + 1)
  }
}
