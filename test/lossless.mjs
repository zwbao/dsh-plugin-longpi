// Every tool result must pass DeepSeek Harness's own lossless-JSON check (dsh-util-values isJsonValue). DSH refuses
// the whole tool call otherwise ("value is not lossless JSON"), and JSON.stringify in the other tests hides the
// cases that trip it: an undefined property, -0, NaN, a hole in an array. A wearable indicator without a LOINC
// code once made read_personal_situation fail in a real chat. This runs the tools against the fake Mirobody with a
// profile, a plan, check-ins and self measurements on file, and checks each result with DSH's function.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { startFakeMirobody } from './fake-mirobody.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'data', 'biological_variation.json')) ? sibling : '')
if (!home || !existsSync(join(home, 'data', 'biological_variation.json'))) {
  console.log('lossless skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

let isJsonValue
try {
  ;({ isJsonValue } = await import('@deepseek-ai/dsh-util-values'))
} catch {
  console.log('lossless skipped (@deepseek-ai/dsh-util-values not installed)')
  process.exit(0)
}

/** The first path DSH would refuse, for the assertion message. */
function firstLoss(value, path = '$') {
  if (value === undefined) return `${path} is undefined`
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return ''
  if (typeof value === 'number') return !Number.isFinite(value) || Object.is(value, -0) ? `${path} = ${Object.is(value, -0) ? '-0' : value}` : ''
  if (typeof value !== 'object') return `${path} is a ${typeof value}`
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) return `${path}[${index}] is a hole`
      const found = firstLoss(value[index], `${path}[${index}]`)
      if (found) return found
    }
    return ''
  }
  for (const [key, item] of Object.entries(value)) {
    const found = firstLoss(item, `${path}.${key}`)
    if (found) return found
  }
  return ''
}

function assertLossless(name, value) {
  assert.ok(isJsonValue(value), `${name}: DSH would refuse this result (${firstLoss(value) || 'non-plain object'})`)
}

// --- asJson itself ------------------------------------------------------------------
const dirty = { keep: 1, gone: undefined, zero: -0, nan: Number.NaN, inf: Infinity, list: [1, undefined, 3], when: new Date(0), deep: { gone: undefined, ok: 'x' } }
// eslint-disable-next-line no-sparse-arrays
dirty.holes = [1, , 3]
const cleaned = mod.asJson(dirty)
assertLossless('asJson', cleaned)
assert.deepEqual(cleaned, { keep: 1, zero: 0, nan: null, inf: null, list: [1, null, 3], when: '1970-01-01T00:00:00.000Z', deep: { ok: 'x' }, holes: [1, null, 3] })
assert.ok(!Object.is(cleaned.zero, -0), '-0 becomes 0')
const loop = { name: 'loop' }
loop.self = loop
assert.deepEqual(mod.asJson(loop), { name: 'loop', self: null }, 'a cycle ends in null instead of throwing')

// --- every tool, against the fake Mirobody ----------------------------------------------
const TODAY = new Date().toISOString().slice(0, 10)
const dataDir = mkdtempSync(join(tmpdir(), 'longpi-lossless-'))
const server = await startFakeMirobody()
const tools = new Map()
const ctx = {
  tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
  skills: { register: () => () => {} },
  systemPrompt: { section: () => {} },
  webServer: { register: () => () => {} },
  connection: { requestRejection: () => undefined },
  commands: { register: () => {} },
  inject: (_names, callback) => callback(ctx),
  on: () => () => {},
  effect: (execute) => execute(),
}
try {
  mod.writeProfile(dataDir, {
    displayName: '测试', age: 53, sex: 'male', focus: ['bioage', 'cardio'],
    risk: { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false },
    consent: { version: mod.CONSENT_VERSION, accepted_at: new Date().toISOString() },
  })
  const config = {
    mcpUrl: server.url, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '', bootstrapWorkspace: false,
  }
  mod.invalidateRecords()
  mod.invalidateTracking()
  await mod.apply(ctx, config)
  const run = async (name, args) => {
    const tool = tools.get(name)
    assert.ok(tool, `${name} is registered`)
    const value = await tool.execute(args)
    assertLossless(name, value)
    return value
  }
  // Read before anything is saved, then again with a plan, check-ins and self measurements on file.
  await run('read_personal_situation', {})
  await run('longpi_status', {})
  await run('list_longevity_intents', {})
  await run('list_longevity_domains', {})
  await run('match_longevity_skills', { question: '用我的血检算一下表型年龄' })
  await run('read_longevity_skill', { name: 'accelerated-biological-aging-risk' })
  await run('query_longevity_evidence', { query: 'metformin' })
  const draft = await run('draft_intervention_plan', {})
  await run('save_self_measurement', { entries: [{ key: 'waist', value: 88, unit: 'cm', date: TODAY }, { key: 'sbp', value: 128, unit: 'mmHg', date: TODAY }, { key: 'dbp', value: 82, unit: 'mmHg', date: TODAY }] })
  const items = (draft.draft?.items ?? []).map((item) => ({ category: item.category, title: item.title, detail: item.detail, start: TODAY, markers: item.markers }))
  assert.ok(items.length > 0, 'the fixture drafts a plan')
  await run('save_intervention_plan', { title: '测试方案', items })
  mod.resetReadBacks?.()
  await run('read_intervention_plan', {})
  await run('review_interventions', {})
  await run('model_intervention_goals', { goals: [{ marker: '收缩压', value: 120, unit: 'mmHg' }] })
  await run('read_personal_situation', {})
  await run('longpi_status', {})
  console.log(`lossless ok (asJson; ${tools.size} tools registered, ${13} results checked with DSH's isJsonValue)`)
} finally {
  await server.close()
  rmSync(dataDir, { recursive: true, force: true })
}
