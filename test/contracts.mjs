// C0 contract invariants (AA §3.3): reserved names, the NBA and validator registries, the claim and odds rules,
// the config defaults, and the ban on custom durable session events.

import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'

const root = dirname(fileURLToPath(import.meta.url))

// Reserved tool names are unique and never collide with a registered one they are not meant to become.
const reserved = Object.values(mod.RESERVED_TOOL_NAMES).flat()
assert.equal(new Set(reserved).size, reserved.length, 'reserved tool names are unique')
for (const name of reserved) assert.match(name, /^[a-z][a-z0-9_]+$/)
const routes = Object.values(mod.RESERVED_ROUTES).flat()
assert.equal(new Set(routes).size, routes.length, 'reserved routes are unique')
for (const route of routes) assert.match(route, /^(GET|POST|DELETE) \/api\/longpi\//)
assert.deepEqual(mod.PROMPT_SECTIONS.orchestrator, { name: 'longpi:orchestrator', order: 20 })
assert.equal(mod.PROMPT_SECTIONS.safety.order, 21)
for (const skill of mod.RESERVED_SKILLS) assert.ok(!mod.HARNESS_SKILLS.includes(skill), skill)

// Every event type has exactly one owner.
assert.ok(Object.keys(mod.EVENT_OWNERS).length >= 34)
assert.equal(mod.EVENT_OWNERS['triage.opened'], 'M1')
assert.equal(mod.EVENT_OWNERS['memory.changed'], 'M0')

// Only M1 and M2 may mark an action mandatory.
const action = (id, mandatory) => ({ id, kind: 'see_doctor', provider: 'M5', priority: 90, mandatory, reason_codes: [], fact_ids: [], target: { surface: 'page' }, title_zh: id, detail_zh: '' })
const offA = mod.registerCandidates('M5', () => [action('from-m5', true)])
const offB = mod.registerCandidates('M1', () => [action('from-m1', true)])
const offC = mod.registerCandidates('M3', () => { throw new Error('boom') })
const got = mod.collectCandidates({})
assert.equal(got.find((row) => row.id === 'from-m5').mandatory, false, 'M5 cannot set mandatory')
assert.equal(got.find((row) => row.id === 'from-m1').mandatory, true)
assert.equal(got.find((row) => row.id === 'from-m1').provider, 'M1')
assert.equal(got.length, 2, 'a throwing provider adds nothing')
offA(); offB(); offC()
assert.equal(mod.collectCandidates({}).length, 0)

// Validators apply by kind; a throwing rule fails the card.
const offV = mod.registerValidator({ id: 'test.no-x', owner: 'M0', applies: ['status'], check: (text) => (text.includes('X') ? 'has X' : null) })
const offW = mod.registerValidator({ id: 'test.throws', owner: 'M0', applies: ['greeting'], check: () => { throw new Error('bad') } })
assert.deepEqual(mod.runRegistered('status', 'aXb', { fact_ids: [], number_keys: [] }, {}), [{ rule: 'test.no-x', detail: 'has X' }])
assert.deepEqual(mod.runRegistered('status', 'ab', { fact_ids: [], number_keys: [] }, {}), [])
assert.deepEqual(mod.runRegistered('suggestion', 'X', { fact_ids: [], number_keys: [] }, {}), [])
assert.match(mod.runRegistered('greeting', 'hi', { fact_ids: [], number_keys: [] }, {})[0].detail, /rule threw/)
offV(); offW()

// 'younger' only beyond the band, verified, after the minimum interval, same lab.
const younger = (over = {}) => mod.youngerAllowed({ subject: { kind: 'bioage' }, grade: 'beyond_band_better', delta: { value: -3, unit: '岁', band: [-2, 2], band_verified: true, interval_days: 90, min_interval_days: 28, same_lab: true }, ...over })
assert.equal(younger(), true)
assert.equal(younger({ grade: 'first_draw' }), false)
assert.equal(younger({ grade: 'within_band_improving' }), false)
assert.equal(younger({ delta: { value: -3, unit: '岁', band: [-2, 2], band_verified: false, interval_days: 90, min_interval_days: 28, same_lab: true } }), false)
assert.equal(younger({ delta: { value: -3, unit: '岁', band: [-2, 2], band_verified: true, interval_days: 20, min_interval_days: 28, same_lab: true } }), false)
assert.equal(younger({ delta: { value: -3, unit: '岁', band: [-2, 2], band_verified: true, interval_days: 90, min_interval_days: 28, same_lab: false } }), false)
assert.equal(younger({ subject: { kind: 'risk' } }), false)

assert.equal(mod.oddsSumToOne({ odds: { common: 0.7, rare: 0.22, epic: 0.07, legendary: 0.01 } }), true)
assert.equal(mod.oddsSumToOne({ odds: { common: 0.7, rare: 0.2, epic: 0.07, legendary: 0.01 } }), false)

// Config defaults (AA §3.4); a user's partial row keeps the rest.
assert.equal(mod.agentConfig({}, 'coach').maxTokens, 900)
assert.equal(mod.agentConfig({}, 'triage').model, 'deepseek-v4-pro')
assert.equal(mod.agentConfig({ agents: { coach: { enabled: false } } }, 'coach').enabled, false)
assert.equal(mod.agentConfig({ agents: { coach: { enabled: false } } }, 'coach').deadlineMs, 15000)
assert.deepEqual(mod.BUDGET_DEFAULTS, { dailyInputTokens: 200000, dailyOutputTokens: 20000, maxSpawnsPerDay: 3 })
const parsed = mod.Config({})
assert.equal(parsed.scienceMode, 'local')
assert.equal(parsed.scienceModeSet, false)
assert.equal(parsed.budget.dailyInputTokens, 200000)
assert.equal(parsed.agents.coach.reasoningEffort, 'off')
assert.equal(parsed.agents.memory_distiller.maxTokens, 400)
assert.equal(parsed.surfaces.chapterTokens, 150000)
assert.equal(parsed.engage.nudgesInWorkflow, false)
assert.equal(mod.AGENT_PROFILE_IDS.length, 7)
assert.ok(!mod.AGENT_PROFILE_IDS.includes('evidence_explainer'), 'the answer-card explainer left with the guard (0.8.0)')
for (const id of mod.AGENT_PROFILE_IDS) assert.ok(mod.AGENT_DEFAULTS[id], id)

// Modules register in the §3.7 order and a failing one is logged, not fatal.
assert.deepEqual(mod.MODULES.map(([id]) => id), ['M9', 'M1', 'M3', 'M7', 'M4', 'M5', 'M6', 'M11', 'M8', 'M12', 'M13'])

// R7: no custom durable session events.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
  })
}
for (const file of walk(join(root, '..', 'src'))) assert.doesNotMatch(readFileSync(file, 'utf8'), /session\.append\(/, `${file} appends a session event`)

// 0.6.0: L2 registers the catalog index and the binding check. L3 registers
// readStore when the data-in module mounts, so it still throws here. L4
// registers methodResults; with nothing recorded the list is empty.
assert.ok(Array.isArray(mod.listSkillIndex()))
const unknownSkill = mod.validateBinding({ skill: 'not-a-real-skill', inputs: {} })
assert.equal(unknownSkill.ok, false)
assert.throws(() => mod.readStore('methylation'), /not implemented in C1/)
assert.deepEqual(mod.methodResults(), [])
assert.deepEqual(mod.registeredMethodResults(), [])
const offRead = mod.registerLibraryHooks({
  readStore: (kind) => (kind === 'conditions' ? [{ code: 'E55', system: 'ICD-10', display: '维生素 D 缺乏', onset: null, source: 'fixture' }] : []),
})
assert.equal(mod.readStore('conditions')[0].code, 'E55')
assert.ok(Array.isArray(mod.listSkillIndex()), 'registering readStore leaves the skill index in place')
offRead()
assert.throws(() => mod.readStore('conditions'), /not implemented in C1/)
let mounted = 0
const offMount = mod.registerLibraryMount(() => { mounted += 1 })
mod.mountLibraryLanes({ skills: {} })
assert.equal(mounted, 1)
offMount()
mod.mountLibraryLanes({ skills: {} })
assert.equal(mounted, 1)

console.log('contracts ok')
