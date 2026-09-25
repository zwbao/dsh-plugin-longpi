// A fresh DeepSeek Harness has no workspace: LongPi registers <dataDir>/workspace
// as 「健康」 once, through DSH's workspace registry when it is there. A fake
// registry stands in for @deepseek-ai/dsh-workspace (create(path, title), list()).

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'

const NOW = new Date('2026-09-24T12:00:00Z')
const temp = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-workspace-${name}-`))
  temp.push(dir)
  return dir
}

function fakeRegistry(existing = [], fail = '') {
  const rows = [...existing]
  const created = []
  return {
    created,
    list: () => rows.slice(),
    create: async (path, title) => {
      if (fail) throw new Error(fail)
      created.push({ path, title })
      const row = { id: `ws-${created.length}`, path, title }
      rows.unshift(row)
      return row
    },
  }
}

function fakeHost(registry, logs) {
  const ctx = {
    tools: { register: () => () => {} },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: () => () => {} },
    commands: { register: () => {} },
    workspaceRegistry: registry,
    logger: (name) => ({ info: (message) => logs.push(['info', name, message]), warn: (message) => logs.push(['warn', name, message]) }),
    inject: (names, callback) => {
      // Like Cordis: an optional service that is not there never runs its callback.
      if (names.includes('workspaceRegistry') && !registry) return
      callback(ctx)
    },
    on: () => () => {},
    effect: (execute) => {
      disposers.push(execute())
      return () => {}
    },
  }
  const disposers = []
  return { ctx, dispose: () => disposers.splice(0).forEach((fn) => fn()) }
}

function configFor(dataDir, extra = {}) {
  return {
    mcpUrl: '', mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6, skillsVersion: '',
    bootstrapWorkspace: true, ...extra,
  }
}

async function until(check, ms = 3000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) return false
    await new Promise((resolveWait) => setTimeout(resolveWait, 20))
  }
  return true
}

try {
  assert.equal(mod.Config({}).bootstrapWorkspace, true, 'on by default')
  assert.equal(mod.Config({ bootstrapWorkspace: false }).bootstrapWorkspace, false)

  // --- 1. the function ------------------------------------------------------------
  const dataDir = tempDir('empty')
  const registry = fakeRegistry()
  const made = await mod.bootstrapWorkspace(registry, { dataDir, enabled: true, now: NOW })
  const expected = realpathSync(join(dataDir, mod.WORKSPACE_DIR))
  assert.deepEqual(made, { status: 'created', path: expected, workspace_id: 'ws-1' })
  assert.deepEqual(registry.created, [{ path: expected, title: '健康' }], 'the canonical path, titled 健康')
  assert.equal(mod.WORKSPACE_TITLE, '健康')
  const markerPath = join(dataDir, mod.WORKSPACE_MARKER)
  assert.equal(mod.WORKSPACE_MARKER, 'workspace-bootstrap.json')
  assert.deepEqual(JSON.parse(readFileSync(markerPath, 'utf8')), { created_at: NOW.toISOString(), path: expected, workspace_id: 'ws-1' })
  assert.equal(statSync(markerPath).mode & 0o777, 0o600)
  assert.ok(statSync(expected).isDirectory())

  // the person deleted it: the registry is empty again, the marker keeps it deleted
  const emptied = fakeRegistry()
  assert.deepEqual(await mod.bootstrapWorkspace(emptied, { dataDir, enabled: true }), { status: 'done_before' })
  assert.deepEqual(emptied.created, [])

  // a registry that already has a workspace is never touched
  const busyDir = tempDir('busy')
  const busy = fakeRegistry([{ id: 'mine', path: '/somewhere' }])
  assert.deepEqual(await mod.bootstrapWorkspace(busy, { dataDir: busyDir, enabled: true }), { status: 'not_empty' })
  assert.deepEqual(busy.created, [])
  assert.equal(existsSync(join(busyDir, mod.WORKSPACE_MARKER)), false)
  assert.equal(existsSync(join(busyDir, mod.WORKSPACE_DIR)), false)

  // off in the config, or no registry: nothing
  const offDir = tempDir('off')
  const off = fakeRegistry()
  assert.deepEqual(await mod.bootstrapWorkspace(off, { dataDir: offDir, enabled: false }), { status: 'disabled' })
  assert.deepEqual(off.created, [])
  assert.deepEqual(await mod.bootstrapWorkspace(undefined, { dataDir: offDir, enabled: true }), { status: 'no_registry' })
  assert.equal(existsSync(join(offDir, mod.WORKSPACE_MARKER)), false)

  // a failing registry is reported, never thrown, and leaves no marker so the next start tries again
  const failDir = tempDir('fail')
  const failing = fakeRegistry([], 'registry is read-only')
  assert.deepEqual(await mod.bootstrapWorkspace(failing, { dataDir: failDir, enabled: true }), { status: 'error', error: 'registry is read-only' })
  assert.equal(existsSync(join(failDir, mod.WORKSPACE_MARKER)), false)
  const throwingList = { list: () => { throw new Error('not ready') }, create: async () => ({ id: 'x', path: '' }) }
  assert.equal((await mod.bootstrapWorkspace(throwingList, { dataDir: failDir, enabled: true })).status, 'error')

  // --- 2. through the plugin's own apply ---------------------------------------------
  const appDir = tempDir('apply')
  const logs = []
  const appRegistry = fakeRegistry()
  const host = fakeHost(appRegistry, logs)
  await mod.apply(host.ctx, configFor(appDir))
  assert.ok(await until(() => existsSync(join(appDir, mod.WORKSPACE_MARKER))), 'apply creates the workspace')
  assert.equal(appRegistry.created.length, 1)
  assert.equal(appRegistry.created[0].title, '健康')
  assert.ok(logs.some(([level, name, message]) => level === 'info' && name === 'longpi' && message.includes('健康')))
  host.dispose()

  // a restart (the registry now lists it) creates nothing more
  const again = fakeHost(appRegistry, logs)
  await mod.apply(again.ctx, configFor(appDir))
  await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  assert.equal(appRegistry.created.length, 1)
  again.dispose()

  // off in the config
  const offApply = tempDir('apply-off')
  const offRegistry = fakeRegistry()
  const offHost = fakeHost(offRegistry, logs)
  await mod.apply(offHost.ctx, configFor(offApply, { bootstrapWorkspace: false }))
  await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  assert.deepEqual(offRegistry.created, [])
  offHost.dispose()

  // no workspace registry in this DSH: the plugin still loads
  const bare = fakeHost(undefined, logs)
  await mod.apply(bare.ctx, configFor(tempDir('bare')))
  bare.dispose()

  // a failing registry is logged as a warning
  const warnDir = tempDir('apply-warn')
  const warnHost = fakeHost(fakeRegistry([], 'disk full'), logs)
  await mod.apply(warnHost.ctx, configFor(warnDir))
  assert.ok(await until(() => logs.some(([level, , message]) => level === 'warn' && message.includes('disk full'))), 'the failure is logged')
  warnHost.dispose()

  console.log('workspace ok (created once as 健康, marker kept, busy registry untouched, failures logged)')
} finally {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
