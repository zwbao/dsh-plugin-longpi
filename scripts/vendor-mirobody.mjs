// Copy the runtime files of a tagged dsh-plugin-mirobody release into vendor/.
//
// LongPi mounts that plugin inside its own process. Shipping the files in this
// package keeps `dsh plugin add` to one install, and the copy sits inside the
// DSH profile, where the host's @deepseek-ai packages resolve for it. (A git
// dependency would do the same, but npm cannot match DSH's 0.1.x-rc versions
// against a peer range, so the dev checkout would not install.)
//
//   node scripts/vendor-mirobody.mjs            # the tag recorded in vendor/.../VENDORED.json
//   node scripts/vendor-mirobody.mjs v0.1.1     # another release tag
//   node scripts/vendor-mirobody.mjs ../dsh-plugin-mirobody   # a local checkout, for testing

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'zwbao/dsh-plugin-mirobody'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'vendor', 'dsh-plugin-mirobody')
const recordPath = join(target, 'VENDORED.json')
const FILES = ['package.json', 'LICENSE', 'NOTICE', 'lib/index.js', 'bridge/dsh_bridge.py', 'skills']

function recordedTag() {
  if (!existsSync(recordPath)) return 'v0.1.1'
  return JSON.parse(readFileSync(recordPath, 'utf8')).tag
}

async function download(tag) {
  const url = `https://codeload.github.com/${REPO}/tar.gz/refs/tags/${tag}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const work = mkdtempSync(join(tmpdir(), 'mirobody-vendor-'))
  const archive = join(work, 'release.tar.gz')
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()))
  const untar = spawnSync('tar', ['-xzf', archive, '-C', work], { encoding: 'utf8' })
  if (untar.status !== 0) throw new Error(`tar failed: ${untar.stderr}`)
  const top = readdirSync(work).find((name) => name.startsWith('dsh-plugin-mirobody-'))
  if (!top) throw new Error('unexpected archive layout')
  return { dir: join(work, top), cleanup: () => rmSync(work, { recursive: true, force: true }), source: url }
}

const arg = process.argv[2] ?? recordedTag()
const local = existsSync(resolve(arg)) ? resolve(arg) : ''
const fetched = local ? { dir: local, cleanup: () => {}, source: local } : await download(arg)
try {
  for (const file of FILES) {
    if (!existsSync(join(fetched.dir, file))) throw new Error(`${file} is missing from ${fetched.source}; build and tag the release first`)
  }
  rmSync(target, { recursive: true, force: true })
  for (const file of FILES) {
    mkdirSync(dirname(join(target, file)), { recursive: true })
    cpSync(join(fetched.dir, file), join(target, file), { recursive: true })
  }
  const version = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).version
  const record = { repo: `https://github.com/${REPO}`, tag: local ? null : arg, version, files: FILES }
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
  console.log(`vendored dsh-plugin-mirobody ${version} from ${fetched.source}`)
} finally {
  fetched.cleanup()
}
