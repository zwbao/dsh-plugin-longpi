// The methodResults hook (L4). Until L2 records real runs, the list is whatever
// setMethodResults last stored, or the JSON file in LONGPI_METHOD_RESULTS.
// Installing the plugin does not rank methods away. This list is only results
// that already ran, with the label the binder gave them.

import { readFileSync } from 'node:fs'
import { registerLibraryHooks, type MethodResult } from '../contracts/library.ts'
import { parseMethodResults } from './method-view.ts'

let current: MethodResult[] = []

export function setMethodResults(rows: readonly MethodResult[]): void {
  current = parseMethodResults(rows)
}

export function clearMethodResults(): void {
  current = []
}

export function currentMethodResults(): MethodResult[] {
  return current.map((row) => structuredClone(row))
}

function loadConfiguredResults(): void {
  // npm test must not pick up a developer's fixture file.
  if (process.env.npm_lifecycle_event === 'test') return
  const file = process.env.LONGPI_METHOD_RESULTS
  if (!file) return
  try {
    current = parseMethodResults(JSON.parse(readFileSync(file, 'utf8')) as unknown)
  } catch (error) {
    current = []
    const message = error instanceof Error ? error.message : 'unreadable'
    console.error(`longpi method results were not loaded: ${message}`)
  }
}

loadConfiguredResults()

registerLibraryHooks({
  methodResults: () => currentMethodResults(),
})
