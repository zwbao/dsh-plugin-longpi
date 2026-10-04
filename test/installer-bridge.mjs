// Installer pieces added for the analyst bridge, run from install.sh itself (sourced without main):
// the LOINC bundle location for Mirobody >= 1.5.1, the home-layer session-log row, installing the skill.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readlinkSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repo = new URL('..', import.meta.url).pathname
const tmp = (p) => mkdtempSync(join(tmpdir(), `longpi-inst-${p}-`))
const fns = join(tmp('fns'), 'fns.sh')
writeFileSync(fns, readFileSync(join(repo, 'install.sh'), 'utf8').replace(/\nmain "\$@"\s*$/, '\n'))
const sh = (script, env = {}) => spawnSync('bash', ['-c', `set -eu; LOG=/dev/null; ZH=0; B= G= Y= R= N=; . "${fns}"; ${script}`], { encoding: 'utf8', env: { ...process.env, ...env } })

// LOINC: res/loinc/ when the checkout says so, res/ for an older one
{
  const newer = tmp('mb-new'); mkdirSync(join(newer, 'mirobody', 'res', 'loinc'), { recursive: true })
  const older = tmp('mb-old'); mkdirSync(join(older, 'mirobody', 'res'), { recursive: true })
  assert.equal(sh(`loinc_bundle_path "${newer}"`).stdout, `${newer}/mirobody/res/loinc/fhir_loinc_bundle.tar.gz`)
  assert.equal(sh(`loinc_bundle_path "${older}"`).stdout, `${older}/mirobody/res/fhir_loinc_bundle.tar.gz`)
  const attrs = tmp('mb-attr'); writeFileSync(join(attrs, '.gitattributes'), 'mirobody/res/loinc/*.tar.gz filter=lfs\n')
  assert.match(sh(`loinc_bundle_path "${attrs}"`).stdout, /res\/loinc\//)
}

// session log: written once, idempotent, a row the person wrote is kept
{
  const home = tmp('dsh')
  const r = sh(`ensure_session_log_off "${home}" python3`)
  assert.equal(r.status, 0, r.stderr)
  const text = readFileSync(join(home, 'cordis.patch.yml'), 'utf8')
  assert.match(text, /- id: session-log-deepseek\n {2}config:\n {4}enabled: false/)
  assert.equal(statSync(join(home, 'cordis.patch.yml')).mode & 0o777, 0o600)
  sh(`ensure_session_log_off "${home}" python3`)
  assert.equal(readFileSync(join(home, 'cordis.patch.yml'), 'utf8'), text, 'idempotent')
  const own = tmp('dsh-own')
  for (const id of ['session-log-deepseek', "'session-log-deepseek'", '"session-log-deepseek"']) {
    const mine = `- id: other\n  config: {}\n- id: ${id}\n  config:\n    enabled: true\n`
    writeFileSync(join(own, 'cordis.patch.yml'), mine)
    sh(`ensure_session_log_off "${own}" python3`)
    assert.equal(readFileSync(join(own, 'cordis.patch.yml'), 'utf8'), mine, `the person's own row is kept (${id})`)
  }
}

// the skill: cloned into the LongPi home and linked into DSH_HOME/skills
{
  const src = tmp('analyst-src')
  mkdirSync(join(src, 'skills', 'longevity-analyst'), { recursive: true })
  writeFileSync(join(src, 'skills', 'longevity-analyst', 'SKILL.md'), '---\nname: longevity-analyst\n---\n')
  const git = (args) => spawnSync('git', args, { cwd: src, encoding: 'utf8' })
  git(['init', '-q']); git(['add', '.']); git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x']); git(['tag', 'v0.7.1'])
  const home = tmp('dsh2'); const lp = tmp('lp')
  const r = sh(`longpi_home="${lp}"; install_analyst "${src}" "${home}"`)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.equal(readlinkSync(join(home, 'skills', 'longevity-analyst')), join(lp, 'longevity-analyst-skill', 'skills', 'longevity-analyst'))
  const untagged = tmp('analyst-old')
  mkdirSync(join(untagged, 'skills', 'longevity-analyst'), { recursive: true })
  writeFileSync(join(untagged, 'skills', 'longevity-analyst', 'SKILL.md'), 'x')
  spawnSync('git', ['init', '-q'], { cwd: untagged }); spawnSync('git', ['add', '.'], { cwd: untagged })
  spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: untagged })
  assert.notEqual(sh(`longpi_home="${tmp('lp3')}"; install_analyst "${untagged}" "${tmp('dsh3')}"`).status, 0, 'a source without the release tag is not installed')
  const bad = sh(`longpi_home="${tmp('lp2')}"; install_analyst "${tmp('empty')}" "${home}"`)
  assert.notEqual(bad.status, 0, 'a source without the skill fails')
}

// Pi (0.9, installed by default): the coach skill from its release tag, linked like the analyst; --without-coach
// removes only the link this installer made; the config keeps the choice so an update does not turn Pi back on
{
  const src = tmp('coach-src')
  mkdirSync(join(src, 'skills', 'longevity-coach'), { recursive: true })
  writeFileSync(join(src, 'skills', 'longevity-coach', 'SKILL.md'), '---\nname: longevity-coach\nmetadata:\n  version: "0.2.0"\n---\n')
  const git = (args) => spawnSync('git', args, { cwd: src, encoding: 'utf8' })
  git(['init', '-q']); git(['add', '.']); git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x']); git(['tag', 'v0.2.0'])
  const home = tmp('dsh-coach'); const lp = tmp('lp-coach')
  const r = sh(`longpi_home="${lp}"; install_coach "${src}" "${home}"`)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  const link = join(home, 'skills', 'longevity-coach')
  assert.equal(readlinkSync(link), join(lp, 'longevity-coach-skill', 'skills', 'longevity-coach'))
  assert.equal(sh(`longpi_home="${lp}"; remove_coach "${home}"`).status, 0)
  assert.throws(() => readlinkSync(link), 'the link is gone')
  assert.ok(statSync(join(lp, 'longevity-coach-skill')).isDirectory(), 'the checkout stays')
  // a coach skill the person put there by hand is never removed
  const mine = tmp('dsh-mine'); mkdirSync(join(mine, 'skills', 'longevity-coach'), { recursive: true })
  sh(`longpi_home="${lp}"; remove_coach "${mine}"`)
  assert.ok(statSync(join(mine, 'skills', 'longevity-coach')).isDirectory())

  const installer = readFileSync(join(repo, 'install.sh'), 'utf8')
  const writer = installer.slice(installer.indexOf("WRITE_CONFIG='") + "WRITE_CONFIG='".length, installer.indexOf("'\n\nmain \"$@\""))
  const dir = tmp('coach-cfg'); const script = join(dir, 'w.py'); writeFileSync(script, writer)
  const patch = join(dir, 'cordis.patch.yml')
  // backups are named by the second: one write per second, as an install does
  const write = (flag) => { spawnSync('sleep', ['1.05']); return spawnSync('python3', [script, patch, '/skills', '/py', '0', '', '', '', '', flag], { encoding: 'utf8' }) }
  assert.equal(write('').status, 0)
  assert.match(readFileSync(patch, 'utf8'), /\n {4}coach: true\n/, 'Pi by default')
  write('0')
  assert.match(readFileSync(patch, 'utf8'), /\n {4}coach: false\n/, '--without-coach')
  write('')
  assert.match(readFileSync(patch, 'utf8'), /\n {4}coach: false\n/, 'an update with no flag keeps the choice')
  assert.equal(sh(`read_patch_value "${patch}" coach`).stdout.trim(), 'false', 'what the installer reads back to decide')
  write('1')
  assert.match(readFileSync(patch, 'utf8'), /\n {4}coach: true\n/, '--with-coach')
}
console.log('installer-bridge ok')
