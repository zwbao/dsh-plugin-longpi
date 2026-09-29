// Library pin, versionCheck, and the fake-network installer.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const repo = dirname(root)
const mod = await import('../lib/index.js')
const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
const install = readFileSync(join(repo, 'install.sh'), 'utf8')

assert.equal(pkg.version, '0.6.3')
assert.equal(pkg.dependencies?.['longevity-skills'], undefined)
assert.equal(pkg.bin.longpi, 'bin/longpi.mjs')
assert.equal(pkg.scripts.postinstall, undefined)
assert.equal(pkg.postinstall, undefined)
assert.match(readFileSync(join(repo, 'src/tools.ts'), 'utf8'), /versionCheck\(catalog, current\.skillsVersion, 'verified'\)/)
assert.match(install, /^SKILLS_PIN_DEFAULT=$/m)
assert.ok(pkg.files.includes('install.sh'))
assert.ok(pkg.files.includes('bin'))

const catalog = { version: '2026.39.0' }
assert.equal(mod.versionCheck(catalog, '').matches, null)
assert.equal(mod.versionCheck(catalog, '').verified_allowed, true)
assert.equal(mod.versionCheck(catalog, '  ').matches, null)
assert.equal(mod.versionCheck(catalog, '', 'verified').label, 'verified')
assert.equal(mod.versionCheck(catalog, '', 'verified').refused_verified, false)
assert.equal(mod.versionCheck(catalog, 'v2026.39.0', 'verified').matches, true)
assert.equal(mod.versionCheck(catalog, 'v2026.39.0', 'verified').label, 'verified')
assert.equal(mod.versionCheck({ version: 'v2026.39.1' }, '2026.39.1').matches, true)

const refused = mod.versionCheck(catalog, '2026.39.1', 'verified')
assert.equal(refused.matches, false)
assert.equal(refused.verified_allowed, false)
assert.equal(refused.label, 'unverified-binding')
assert.equal(refused.refused_verified, true)
assert.match(refused.mismatch, /cannot be labelled verified/)
assert.match(refused.mismatch_zh, /不能把结果标成已核对/)
assert.equal(mod.versionCheck(catalog, '2026.39.1', 'evidence-only').label, 'evidence-only')
assert.equal(mod.versionCheck(catalog, '2026.39.1', 'evidence-only').refused_verified, false)
assert.equal(mod.versionCheck(catalog, '2026.39.1', 'unverified-binding').label, 'unverified-binding')
assert.equal(mod.versionCheck(catalog, '2026.39.1').label, null)

const help = spawnSync(process.execPath, [join(repo, 'bin/longpi.mjs'), '--help'], { encoding: 'utf8' })
assert.equal(help.status, 0, help.stderr)
assert.match(help.stdout, /update/)
assert.match(help.stdout, /status/)
assert.match(help.stdout, /LONGPI_PLUGIN_SHA256/)

const packRoot = mkdtempSync(join(tmpdir(), 'longpi-pack-src-'))
for (const rel of ['schema', 'skills/demo', 'registry', 'data', 'tools', 'docs']) mkdirSync(join(packRoot, rel), { recursive: true })
writeFileSync(join(packRoot, 'catalog.json'), '{"schema":"longevity-catalog/1","version":"2026.39.0","skills":[]}\n')
writeFileSync(join(packRoot, 'intents.json'), '{"intents":[]}\n')
writeFileSync(join(packRoot, 'VERSION'), '2026.39.0\n')
writeFileSync(join(packRoot, 'requirements-ci.txt'), 'pytest>=8\n')
writeFileSync(join(packRoot, 'README.md'), '# synthetic\n')
writeFileSync(join(packRoot, 'LICENSE'), 'MIT\n')
writeFileSync(join(packRoot, 'THIRD_PARTY_NOTICES.md'), 'none\n')
writeFileSync(join(packRoot, 'docs/AGENT_PROMPT.md'), 'prompt\n')
writeFileSync(join(packRoot, 'schema/skill.schema.json'), '{}\n')
writeFileSync(join(packRoot, 'skills/demo/SKILL.md'), '---\nname: demo\n---\n\n')
writeFileSync(join(packRoot, 'registry/papers.jsonl'), '')
writeFileSync(join(packRoot, 'data/effects.jsonl'), '')
writeFileSync(join(packRoot, 'tools/skillkit.py'), 'print("ok")\n')
const before = readFileSync(join(packRoot, 'VERSION'), 'utf8')
const packed = spawnSync(process.execPath, [join(repo, 'scripts/pack-longevity-skills.mjs'), packRoot, '--out', packRoot], { encoding: 'utf8' })
assert.equal(packed.status, 0, packed.stderr)
assert.equal(readFileSync(join(packRoot, 'VERSION'), 'utf8'), before)
assert.equal(readFileSync(join(packRoot, 'catalog.json'), 'utf8').includes('"name"'), false)
const tarball = packed.stdout.trim()
assert.match(tarball, /longevity-skills-2026\.39\.0\.tgz$/)
const listed = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
assert.equal(listed.status, 0, listed.stderr)
assert.match(listed.stdout, /package\/package.json/)
assert.match(listed.stdout, /package\/catalog.json/)
assert.match(listed.stdout, /package\/requirements-ci.txt/)
assert.doesNotMatch(listed.stdout, /package\.json[\s\S]*postinstall/)
const manifestText = spawnSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' })
const manifest = JSON.parse(manifestText.stdout)
assert.equal(manifest.name, 'longevity-skills')
assert.equal(manifest.version, '2026.39.0')
assert.deepEqual(manifest.dependencies, {})
assert.equal(manifest.scripts.postinstall, undefined)
assert.equal(manifest.description, '171 longevity methods: manifests, scripts, evidence claims, intents.')
rmSync(packRoot, { recursive: true, force: true })

const harness = spawnSync('bash', [join(repo, 'scripts/test-install-mirror.sh')], {
  cwd: repo,
  env: { ...process.env, SKIP_LIVE: '1', LANG: 'C', LC_ALL: 'C' },
  encoding: 'utf8',
  timeout: 180000,
})
assert.equal(harness.status, 0, `${harness.stdout}\n${harness.stderr}`)
assert.match(harness.stdout, /fake-network: \d+ cases passed/)
assert.match(harness.stdout, /ok uv-requirements/)
assert.match(harness.stdout, /ok version-match/)

console.log('packaging ok')
