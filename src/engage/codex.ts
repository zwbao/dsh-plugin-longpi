// Who may draw, and the card pack on disk. Rarity is never a function of a lab value.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CodexCard, DropTable } from '../contracts/codex.ts'
import { auditCodex } from './droptable.ts'

export type CodexBlock = 'minor' | 'age_unknown' | 'opt_out' | 'config' | null

export function codexBlock(input: { age: number | null; minorFlag: boolean; optOut: boolean; configOn: boolean }): CodexBlock {
  if (!input.configOn) return 'config'
  if (input.minorFlag || (input.age != null && input.age < 18)) return 'minor'
  if (input.age == null) return 'age_unknown'
  if (input.optOut) return 'opt_out'
  return null
}

export function codexBlockZh(block: CodexBlock): string {
  switch (block) {
    case 'minor': return '图鉴对未满 18 岁的人不开放。'
    case 'age_unknown': return '先在档案里填写年龄。未满 18 岁不开放图鉴。'
    case 'opt_out': return '图鉴已关闭。想打开时再说一声。'
    case 'config': return '图鉴没有打开。'
    default: return ''
  }
}

export interface CodexPack { cards: CodexCard[]; table: DropTable }

let cached: CodexPack | null = null

function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let hop = 0; hop < 6; hop += 1) {
    const pkg = join(dir, 'package.json')
    if (existsSync(pkg)) {
      try {
        const json = JSON.parse(readFileSync(pkg, 'utf8')) as { name?: string }
        if (json.name === 'dsh-plugin-longpi') return dir
      } catch {
        // keep walking
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return dirname(fileURLToPath(import.meta.url))
}

export function loadCodexPack(): CodexPack {
  if (cached) return cached
  const root = packageRoot()
  const cardsFile = JSON.parse(readFileSync(join(root, 'data', 'codex', 'cards.json'), 'utf8')) as { cards: CodexCard[] }
  const table = JSON.parse(readFileSync(join(root, 'data', 'codex', 'droptable.json'), 'utf8')) as DropTable
  const errors = auditCodex(table, cardsFile.cards)
  if (errors.length > 0) throw new Error(`codex pack: ${errors.join('; ')}`)
  cached = { cards: cardsFile.cards, table }
  return cached
}

export function cardById(pack: CodexPack, id: string): CodexCard | null {
  return pack.cards.find((card) => card.id === id) ?? null
}
