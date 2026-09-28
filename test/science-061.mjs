// Runs the 0.6.1 science suite as TypeScript.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const run = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', join(here, 'science-061-suite.ts')], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(run.status ?? 1)
