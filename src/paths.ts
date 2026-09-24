import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

export function resolveDataDir(configured: string): string {
  const trimmed = configured.trim()
  if (trimmed) return resolve(trimmed)
  return join(homedir(), '.dsh', 'longpi')
}

export function clampMatches(value: number): number {
  if (!Number.isFinite(value)) return 8
  return Math.max(1, Math.min(20, Math.floor(value)))
}
