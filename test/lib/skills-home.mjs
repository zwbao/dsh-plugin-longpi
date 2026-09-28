// Library directory for tests. LONGEVITY_SKILLS_HOME wins. Otherwise the sibling
// checkout named longevity-skills (the directory GitHub CI places next to the
// repo). No home-directory path: an unset env and a missing sibling skip.
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sibling = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'longevity-skills')

export function skillsHome(marker) {
  const env = (process.env.LONGEVITY_SKILLS_HOME || '').trim()
  for (const dir of [env, sibling]) {
    if (!dir) continue
    if (existsSync(join(dir, 'skills')) && existsSync(join(dir, 'README.md')) && existsSync(join(dir, marker))) return dir
  }
  return ''
}
