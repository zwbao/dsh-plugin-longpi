#!/usr/bin/env node
// Build an npm tarball of longevity-skills from a library checkout.
// Does not modify the checkout. The lead publishes the tarball; this repo only packs it.
//
//   node scripts/pack-longevity-skills.mjs <library-dir> [--out dir] [--version x.y.z]
//
// The package version is the checkout's VERSION file, unless --version is set.
// Bump the plugin pin in package.json dependencies.longevity-skills and
// SKILLS_PIN_DEFAULT in install.sh together. See docs/dev/packaging.md.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const INCLUDE = [
  ['catalog.json', 'file'],
  ['intents.json', 'file'],
  ['VERSION', 'file'],
  ['requirements-ci.txt', 'file'],
  ['README.md', 'file'],
  ['LICENSE', 'file'],
  ['THIRD_PARTY_NOTICES.md', 'file'],
  ['schema', 'dir'],
  ['skills', 'dir'],
  ['registry', 'dir'],
  ['data', 'dir'],
  ['tools', 'dir'],
  ['docs/AGENT_PROMPT.md', 'file'],
]

const skipCopy = (src) => {
  const base = src.split(/[\\/]/).pop() ?? ''
  return base !== '__pycache__' && !base.endsWith('.pyc')
}

function parseArgs(argv) {
  let library = ''
  let out = ''
  let version = ''
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') out = argv[++i] ?? ''
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length)
    else if (arg === '--version') version = argv[++i] ?? ''
    else if (arg.startsWith('--version=')) version = arg.slice('--version='.length)
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write('node scripts/pack-longevity-skills.mjs <library-dir> [--out dir] [--version x.y.z]\n')
      process.exit(0)
    } else if (!arg.startsWith('-') && !library) library = arg
    else {
      process.stderr.write(`Unknown argument: ${arg}\n`)
      process.exit(2)
    }
  }
  if (!library) {
    process.stderr.write('Pass the longevity-skills checkout directory.\n')
    process.exit(2)
  }
  return { library: resolve(library), out: out ? resolve(out) : resolve(dirname(fileURLToPath(import.meta.url)), '..'), version }
}

const { library, out, version } = parseArgs(process.argv.slice(2))
for (const [rel, kind] of INCLUDE) {
  const from = join(library, rel)
  if (!existsSync(from)) {
    process.stderr.write(`Missing ${rel} in ${library}\n`)
    process.exit(1)
  }
  const info = statSync(from)
  if (kind === 'file' && !info.isFile()) {
    process.stderr.write(`${rel} is not a file\n`)
    process.exit(1)
  }
  if (kind === 'dir' && !info.isDirectory()) {
    process.stderr.write(`${rel} is not a directory\n`)
    process.exit(1)
  }
}

const fromVersion = readFileSync(join(library, 'VERSION'), 'utf8').trim()
const packageVersion = version || fromVersion
if (!packageVersion || /\s/.test(packageVersion)) {
  process.stderr.write(`VERSION is empty or has whitespace: ${JSON.stringify(packageVersion)}\n`)
  process.exit(1)
}

const stage = mkdtempSync(join(tmpdir(), 'longevity-skills-pack-'))
try {
  for (const [rel, kind] of INCLUDE) {
    const from = join(library, rel)
    const to = join(stage, rel)
    mkdirSync(dirname(to), { recursive: true })
    if (kind === 'dir') cpSync(from, to, { recursive: true, filter: skipCopy })
    else cpSync(from, to)
  }
  const manifest = {
    name: 'longevity-skills',
    version: packageVersion,
    description: '171 longevity methods: manifests, scripts, evidence claims, intents.',
    type: 'module',
    files: [
      'catalog.json',
      'intents.json',
      'VERSION',
      'requirements-ci.txt',
      'README.md',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'schema/',
      'skills/',
      'registry/',
      'data/',
      'tools/',
      'docs/AGENT_PROMPT.md',
    ],
    engines: { node: '>=18' },
    dependencies: {},
    scripts: {},
  }
  writeFileSync(join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  mkdirSync(out, { recursive: true })
  const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', out], {
    cwd: stage,
    encoding: 'utf8',
  })
  if (packed.status !== 0) {
    process.stderr.write(packed.stdout || '')
    process.stderr.write(packed.stderr || '')
    process.exit(packed.status ?? 1)
  }
  const name = (packed.stdout || '').trim().split('\n').pop()
  process.stdout.write(`${join(out, name || '')}\n`)
} finally {
  rmSync(stage, { recursive: true, force: true })
}
