// Loads the citation tables. The playbook is the runtime copy; these files are the same rows for review.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adviceTableRows } from './playbook.ts'

export interface AdviceTableRow {
  id: string
  tier: number
  kind: string
  source: string
  say_zh: string
}

const FILES = ['supplements', 'diagnosis_first', 'prescription', 'emergencies'] as const

export function adviceDataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [join(here, '..', 'data', 'advice'), join(here, '..', '..', 'data', 'advice')]
  return candidates.find((dir) => existsSync(join(dir, 'supplements.json'))) ?? candidates[1] ?? candidates[0]
}

/** Rows from data/advice when the package is built, otherwise the in-code table. */
export function loadAdviceTables(): Record<string, AdviceTableRow[]> {
  const dir = adviceDataDir()
  const out: Record<string, AdviceTableRow[]> = {}
  for (const name of FILES) {
    const path = join(dir, `${name}.json`)
    if (!existsSync(path)) {
      out[name] = adviceTableRows().filter((item) => item.file === name).map((item) => item.row as unknown as AdviceTableRow)
      continue
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as AdviceTableRow[]
    out[name] = parsed
  }
  return out
}
