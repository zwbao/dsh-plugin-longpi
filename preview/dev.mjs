// Client preview from the hand-written fixtures: no Mirobody, no skills
// checkout, no DSH. Copies the built lib/client.js and preview/index.html into
// preview/out with the fixtures as DATA, then optionally serves the folder or
// takes headless Chrome screenshots of every view and stage.
//
//   npm run build && node preview/dev.mjs --serve 4173
//   npm run build && node preview/dev.mjs --shots /tmp/longpi-shots --only page-plan,home-routine
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
  const data = {
    board: read('board.json'), tracking: read('tracking.json'), journey: read('journey.json'), self: read('self.json'),
    planDraft: read('plan-draft.json'), followup: read('followup.json'), indicators: read('indicators.json'), connection: read('connection.json'),
  }
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
  // 5.1: the four tabs, the settings page, onboarding 3 and 4, the chat cards.
  ['page-overview', 'view=page&stage=routine&tab=overview', 1280, 1500],
  ['page-overview-first_result', 'view=page&stage=first_result&tab=overview', 1280, 1300],
  ['page-indicators', 'view=page&stage=routine&tab=indicators', 1280, 2000],
  ['page-indicators-empty', 'view=page&stage=records&tab=indicators', 1280, 900],
  ['page-indicators-error', 'view=page&stage=routine&tab=indicators&variant=indfail', 1280, 900],
  ['page-plan-draft', 'view=page&stage=plan&tab=plan', 1280, 2400],
  ['page-plan-trackfail', 'view=page&stage=routine&tab=plan&variant=trackfail', 1280, 1400],
  ['page-profile', 'view=page&stage=routine&tab=profile', 1280, 2200],
  ['page-banner', 'view=page&stage=profile&tab=overview', 1280, 1200],
  ['settings-longpi', 'view=settings&stage=routine', 1280, 900],
  ['settings-longpi-off', 'view=settings&stage=records', 1280, 900],
  ['onboarding-3-connected', 'view=onboarding&stage=routine&step=3', 1280, 1000],
  ['chat-draft', 'view=chat&card=draft', 1280, 1100],
  ['chat-checkin', 'view=chat&card=checkin', 1280, 700],
  ['chat-save', 'view=chat&card=save', 1280, 800],
  ['chat-skill', 'view=chat&card=skill', 1280, 900],
  ['chat-situation', 'view=chat&card=situation', 1280, 700],
  ['page-consent', 'view=page&stage=consent', 1280, 2300],
  ['page-stage-profile', 'view=page&stage=profile', 1280, 1400],
  ['page-records', 'view=page&stage=records', 1280, 2500],
  ['page-first_result', 'view=page&stage=first_result&variant=nochanges', 1280, 2700],
  ['page-first_result-changes', 'view=page&stage=first_result', 1280, 3200],
  ['page-first_result-nocheckup', 'view=page&stage=first_result&variant=nocheckup', 1280, 1000],
  ['page-first_result-noaddons', 'view=page&stage=first_result&variant=noaddons', 1280, 2700],
  ['page-records-error', 'view=page&stage=records&variant=recerror', 1280, 1400],
  ['page-plan', 'view=page&stage=routine&tab=plan', 1280, 4300],
  ['page-plan-dark', 'view=page&stage=plan&theme=dark', 1280, 4300],
  ['page-plan-nodraft', 'view=page&stage=plan&variant=nodraft', 1280, 3400],
  ['page-routine', 'view=page&stage=routine', 1280, 6400],
  ['page-routine-dark', 'view=page&stage=routine&theme=dark', 1280, 6400],
  ['page-routine-narrow', 'view=page&stage=routine', 1140, 7200],
  ['page-loading', 'view=page&loading=1', 1280, 900],
  ['page-error', 'view=page&fail=1', 1280, 900],
  ['home-consent', 'view=home&stage=consent', 1280, 760],
  ['home-profile', 'view=home&stage=profile', 1280, 760],
  ['home-records', 'view=home&stage=records', 1280, 760],
  ['home-first_result', 'view=home&stage=first_result&variant=nochanges', 1280, 760],
  ['home-first_result-changes', 'view=home&stage=first_result', 1280, 760],
  ['home-manychanges', 'view=home&stage=routine&variant=manychanges', 1280, 760],
  ['home-nosession', 'view=home&stage=first_result&session=0&tap=suggest', 1280, 760],
  ['home-nosession-picked', 'view=home&stage=first_result&session=0&tap=suggest&pick=1', 1280, 760],
  ['home-fallback', 'view=home&stage=plan&bar=0', 1280, 760],
  ['home-changes-open', 'view=home&stage=first_result&tap=changes', 1280, 900],
  ['home-first_result-noaddons', 'view=home&stage=first_result&variant=noaddons', 1280, 760],
  ['home-records-error', 'view=home&stage=records&variant=recerror', 1280, 760],
  ['home-plan', 'view=home&stage=plan', 1280, 760],
  ['home-routine', 'view=home&stage=routine', 1280, 760],
  ['home-routine-dark', 'view=home&stage=routine&theme=dark', 1280, 760],
  ['home-routine-900', 'view=home&stage=routine', 900, 700],
  ['home-plan-900', 'view=home&stage=plan', 900, 700],
  ['home-loading', 'view=home&loading=1', 1280, 760],
  ['home-error', 'view=home&fail=1', 1280, 760],
  ['onboarding-1', 'view=onboarding&stage=consent&step=1', 1280, 900],
  ['onboarding-2', 'view=onboarding&stage=profile&step=2', 1280, 1100],
  ['onboarding-3', 'view=onboarding&stage=records&step=3', 1280, 1000],
  ['onboarding-3-nocheckup', 'view=onboarding&stage=first_result&step=3&variant=nocheckup', 1280, 900],
  ['onboarding-4', 'view=onboarding&stage=plan&step=4', 1280, 900],
  ['onboarding-4-blocked', 'view=onboarding&stage=first_result&step=4', 1280, 1000],
  ['onboarding-2-dark', 'view=onboarding&stage=profile&step=2&theme=dark', 1280, 1100],
  ['onboarding-done', 'view=onboarding&stage=routine', 1280, 700],
  ['onboarding-fail', 'view=onboarding&fail=1', 1280, 700],
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
  // Exact names, comma-separated: one shot takes ~45 s, so run a couple at a time.
  const only = arg('--only')?.split(',').map((name) => name.trim()).filter(Boolean)
  if (only) {
    const unknown = only.filter((name) => !SHOTS.some(([shot]) => shot === name))
    if (unknown.length > 0) throw new Error(`unknown shot: ${unknown.join(', ')} (known: ${SHOTS.map(([shot]) => shot).join(', ')})`)
  }
  try {
    for (const [name, query, width, height] of SHOTS) {
      if (only && !only.includes(name)) continue
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
  console.log(`preview at http://127.0.0.1:${port}/?view=page (views: page, home, dock, onboarding, pill, settings, chat; ?stage=, ?tab=, ?variant=, ?theme=dark; chat: ?card=draft|checkin|save|skill|situation|all; home: ?session=0, ?bar=0, ?tap=suggest)`)
} else {
  console.log(`preview written to ${out}; serve it with --serve 4173`)
}
