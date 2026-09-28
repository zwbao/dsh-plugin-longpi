#!/usr/bin/env node
// longpi install | update | status — runs install.sh beside this package.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'install.sh')
const child = spawn('bash', [script, ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
})
