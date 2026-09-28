// Runs the science suite as TypeScript. run-all.mjs only executes .mjs files.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const run = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', join(here, 'science-suite.ts')], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(run.status ?? 1)
