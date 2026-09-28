// Runs every test/*.mjs (not test/replay/, not the helper modules) in its own process, in a stable order:
// the pre-C0 order first, then new files alphabetically. Exits non-zero when any fails.

import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
export const HELPERS = new Set(['run-all.mjs', 'fake-mirobody.mjs', 'flaky-mirobody.mjs'])
export const ORDER = ['smoke', 'auth', 'connection', 'indicators', 'units', 'guard', 'v2', 'dispatch', 'mirobody-format', 'wearable-day', 'interventions', 'journey', 'planner', 'plan-safety', 'followup', 'changes', 'readiness', 'workspace', 'lossless']

export function testFiles() {
  const all = readdirSync(root).filter((name) => name.endsWith('.mjs') && !HELPERS.has(name))
  const known = ORDER.map((name) => `${name}.mjs`).filter((name) => all.includes(name))
  return [...known, ...all.filter((name) => !known.includes(name)).sort()]
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const only = process.argv.slice(2)
  const failed = []
  for (const name of testFiles().filter((file) => only.length === 0 || only.some((part) => file.includes(part)))) {
    const started = Date.now()
    // M7's medication mirror imports core/store.ts, which uses TypeScript parameter
    // properties. Node's strip-only loader cannot load those, so every file runs
    // with the transform flag (M8's science suite needs the same thing).
    const run = spawnSync(process.execPath, ['--experimental-transform-types', join(root, name)], { stdio: 'inherit', env: process.env })
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    if (run.status !== 0) {
      failed.push(name)
      console.error(`FAIL ${name} (${seconds} s)`)
    } else {
      console.log(`ok   ${name} (${seconds} s)`)
    }
  }
  if (failed.length > 0) {
    console.error(`${failed.length} test file(s) failed: ${failed.join(', ')}`)
    process.exit(1)
  }
}
