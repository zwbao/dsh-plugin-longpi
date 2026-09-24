// Client preview from the hand-written fixtures: no Mirobody, no skills
// checkout, no DSH. Copies the built lib/client.js and preview/index.html into
// preview/out with the fixtures as DATA, then optionally serves the folder or
// takes headless Chrome screenshots of every view and stage.
//
//   npm run build && node preview/dev.mjs --serve 4173
//   npm run build && node preview/dev.mjs --shots /tmp/longpi-shots
//
// preview/build.mjs (real plugin code against the fake Mirobody) writes the
// same folder with real DATA; index.html falls back to these fixtures for any
// part that build leaves out.

import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
const fixtures = join(here, 'fixtures')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function arg(name) {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : undefined
}

function write() {
  mkdirSync(out, { recursive: true })
  const client = join(here, '..', 'lib', 'client.js')
  if (!existsSync(client)) throw new Error('lib/client.js is missing: run npm run build first')
  copyFileSync(client, join(out, 'client.js'))
  if (existsSync(`${client}.map`)) copyFileSync(`${client}.map`, join(out, 'client.js.map'))
  cpSync(fixtures, join(out, 'fixtures'), { recursive: true })
  const read = (name) => JSON.parse(readFileSync(join(fixtures, name), 'utf8'))
  const data = { board: read('board.json'), tracking: read('tracking.json'), journey: read('journey.json'), self: read('self.json') }
  const template = readFileSync(join(here, 'index.html'), 'utf8')
  const payload = JSON.stringify(data).replace(/</g, '\\u003c')
  writeFileSync(join(out, 'index.html'), template.replace('/*__DATA__*/null', payload))
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json' }

function serve(port) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname)).replace(/^(\.\.[/\\])+/, '')
    const file = join(out, path === '/' ? 'index.html' : path)
    if (!file.startsWith(out) || !existsSync(file)) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

// name, query, width, height
const SHOTS = [
  ['page-consent', 'view=page&stage=consent', 1280, 2300],
  ['page-profile', 'view=page&stage=profile', 1280, 2900],
  ['page-records', 'view=page&stage=records', 1280, 2500],
  ['page-first_result', 'view=page&stage=first_result', 1280, 2700],
  ['page-plan', 'view=page&stage=plan', 1280, 3200],
  ['page-routine', 'view=page&stage=routine', 1280, 5600],
  ['page-routine-dark', 'view=page&stage=routine&theme=dark', 1280, 5600],
  ['page-routine-narrow', 'view=page&stage=routine', 1140, 6400],
  ['page-loading', 'view=page&loading=1', 1280, 900],
  ['page-error', 'view=page&fail=1', 1280, 900],
  ['home-consent', 'view=home&stage=consent', 1280, 860],
  ['home-first_result', 'view=home&stage=first_result', 1280, 860],
  ['home-routine', 'view=home&stage=routine', 1280, 860],
  ['home-routine-dark', 'view=home&stage=routine&theme=dark', 1280, 860],
  ['home-routine-narrow', 'view=home&stage=routine', 900, 860],
  ['onboarding-1', 'view=onboarding&stage=consent&step=1', 1280, 900],
  ['onboarding-2', 'view=onboarding&stage=profile&step=2', 1280, 1100],
  ['onboarding-3', 'view=onboarding&stage=records&step=3', 1280, 900],
  ['onboarding-4', 'view=onboarding&stage=plan&step=4', 1280, 900],
  ['onboarding-4-blocked', 'view=onboarding&stage=first_result&step=4', 1280, 900],
  ['onboarding-2-dark', 'view=onboarding&stage=profile&step=2&theme=dark', 1280, 1100],
  ['dock', 'view=dock&stage=routine', 1280, 800],
  ['dock-first_result', 'view=dock&stage=first_result', 1280, 800],
  ['pill', 'view=pill&stage=routine', 1280, 800],
]

// Chrome loads the written page from disk: spawnSync blocks this process, so an
// in-process server could never answer it.
async function shots(dir) {
  mkdirSync(dir, { recursive: true })
  const page = pathToFileURL(join(out, 'index.html')).href
  const profile = mkdtempSync(join(tmpdir(), 'longpi-chrome-'))
  const only = arg('--only')
  try {
    for (const [name, query, width, height] of SHOTS) {
      if (only && !name.includes(only)) continue
      const file = join(dir, `${name}.png`)
      rmSync(file, { force: true })
      const result = spawnSync(CHROME, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files',
        `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--virtual-time-budget=5000',
        `--screenshot=${file}`, `${page}?${query}`,
      ], { encoding: 'utf8', timeout: 45_000 })
      console.log(result.status === 0 && existsSync(file) ? `ok   ${file}` : `FAIL ${name}: ${result.error?.message ?? ''} ${result.stderr?.split('\n').slice(-3).join(' ')}`)
    }
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
}

write()
const shotDir = arg('--shots')
const port = arg('--serve')
if (shotDir) await shots(shotDir)
else if (port) {
  await serve(Number(port))
  console.log(`preview at http://127.0.0.1:${port}/?view=page (views: page, home, dock, onboarding, pill; ?stage=, ?theme=dark)`)
} else {
  console.log(`preview written to ${out}; serve it with --serve 4173`)
}
