// Outputs of past skill runs (out/result.json), kept locally so a later skill
// can use them (fasting-mimicking-diet takes two phenotypic ages) and the board
// can show before and after. Values stay in dataDir; nothing is uploaded.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface OutputValue {
  value: number | string | null
  unit: string
  label_zh: string
}

export interface HistoryRow {
  at: string
  skill: string
  revision: string
  outputs: Record<string, OutputValue>
}

export interface LatestOutput extends OutputValue {
  at: string
  skill: string
}

function historyPath(dataDir: string): string {
  return join(dataDir, 'history.jsonl')
}

export function readResultFile(path: string): Record<string, OutputValue> {
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { schema?: string; outputs?: Record<string, OutputValue> }
    if (parsed.schema !== 'longevity-result/1' || !parsed.outputs) return {}
    return parsed.outputs
  } catch {
    return {}
  }
}

export function recordOutputs(dataDir: string, row: HistoryRow): void {
  const kept = Object.fromEntries(Object.entries(row.outputs).filter(([, item]) => item && item.value != null))
  if (Object.keys(kept).length === 0) return
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  appendFileSync(historyPath(dataDir), `${JSON.stringify({ ...row, outputs: kept })}\n`, { mode: 0o600 })
}

export function readHistory(dataDir: string, limit = 200): HistoryRow[] {
  const path = historyPath(dataDir)
  if (!existsSync(path)) return []
  const rows: HistoryRow[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).slice(-limit)) {
    try {
      const item = JSON.parse(line) as HistoryRow
      if (item && typeof item.skill === 'string' && item.outputs) rows.push(item)
    } catch {
      /* skip a torn line */
    }
  }
  return rows
}

/** The most recent non-null value of each output key. */
export function latestOutputs(dataDir: string): Record<string, LatestOutput> {
  const latest: Record<string, LatestOutput> = {}
  for (const row of readHistory(dataDir)) {
    for (const [key, item] of Object.entries(row.outputs)) {
      if (item.value == null) continue
      latest[key] = { ...item, at: row.at, skill: row.skill }
    }
  }
  return latest
}

/** Every recorded value of one output key, oldest first, for before-and-after readings. */
export function seriesOf(dataDir: string, key: string): Array<{ at: string; value: number | string; skill: string }> {
  const out: Array<{ at: string; value: number | string; skill: string }> = []
  for (const row of readHistory(dataDir, 1000)) {
    const item = row.outputs[key]
    if (item && item.value != null) out.push({ at: row.at, value: item.value, skill: row.skill })
  }
  return out
}
