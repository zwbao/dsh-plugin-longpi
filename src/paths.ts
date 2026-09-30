import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Package root when this file is bundled to lib/index.js or loaded from src/. */
function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return basename(here) === 'lib' || basename(here) === 'src' ? resolve(here, '..') : here
}

function firstExisting(candidates: string[], marker: (dir: string) => boolean): string {
  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (!trimmed) continue
    const dir = resolve(trimmed)
    if (marker(dir)) return dir
  }
  return ''
}

export function resolveSkillsHome(configured: string): string {
  const root = packageRoot()
  return firstExisting([
    configured,
    process.env.LONGEVITY_SKILLS_HOME ?? '',
    join(root, 'node_modules', 'longevity-skills'),
    join(root, '..', 'longevity-skills'),
    join(homedir(), 'longevity-skills'),
    join(homedir(), 'Projects', 'longevity-skills'),
  ], (dir) => existsSync(join(dir, 'skills')) && existsSync(join(dir, 'README.md')))
}

/**
 * The dsh-plugin-mirobody release shipped in this package (`npm run vendor:mirobody`). Installed
 * with `dsh plugin add`, it sits inside the DSH profile, where the host's packages resolve for it.
 */
export function vendoredMirobodyPlugin(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dsh-plugin-mirobody')
}

export function resolveMirobodyPlugin(configured: string): string {
  return firstExisting([
    configured,
    process.env.MIROBODY_PLUGIN_HOME ?? '',
    vendoredMirobodyPlugin(),
  ], (dir) => existsSync(join(dir, 'lib', 'index.js')) && existsSync(join(dir, 'bridge', 'dsh_bridge.py')))
}

/** The LongPi home: the account holder's own store, and the people registry (people.json, people/<id>/). */
export function resolveRootDir(configured: string): string {
  const trimmed = (configured ?? '').trim()
  if (trimmed) return resolve(trimmed)
  return join(homedir(), '.dsh', 'longpi')
}

const PERSON_ID = /^p[a-z0-9]{6,40}$/

/**
 * The store of the person being looked at now. The holder ("self") is the LongPi home itself, so an install from
 * before people existed keeps its data; a family member is people/<id>/ under it. Every module reads its files through
 * this, so profile, connection, records, plans, check-ins, memory and deep analyses all follow the person chosen.
 */
export function resolveDataDir(configured: string): string {
  const root = resolveRootDir(configured)
  try {
    const active = (JSON.parse(readFileSync(join(root, 'people.json'), 'utf8')) as { active?: unknown }).active
    if (typeof active === 'string' && PERSON_ID.test(active) && existsSync(join(root, 'people', active))) return join(root, 'people', active)
  } catch {
    /* no registry: the holder */
  }
  return root
}

export function clampMatches(value: number): number {
  if (!Number.isFinite(value)) return 8
  return Math.max(1, Math.min(20, Math.floor(value)))
}
