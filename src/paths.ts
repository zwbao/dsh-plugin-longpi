import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

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
  return firstExisting([
    configured,
    process.env.LONGEVITY_SKILLS_HOME ?? '',
    join(homedir(), 'Projects', 'longevity-skills'),
    join(homedir(), 'longevity-skills'),
  ], (dir) => existsSync(join(dir, 'skills')) && existsSync(join(dir, 'README.md')))
}

export function resolveMirobodyPlugin(configured: string): string {
  return firstExisting([
    configured,
    process.env.MIROBODY_PLUGIN_HOME ?? '',
    join(homedir(), 'Projects', 'dsh-plugin-mirobody'),
  ], (dir) => existsSync(join(dir, 'lib', 'index.js')) && existsSync(join(dir, 'bridge', 'dsh_bridge.py')))
}

export function resolveDataDir(configured: string): string {
  const trimmed = configured.trim()
  if (trimmed) return resolve(trimmed)
  return join(homedir(), '.dsh', 'longpi')
}

export function clampMatches(value: number): number {
  if (!Number.isFinite(value)) return 8
  return Math.max(1, Math.min(20, Math.floor(value)))
}
