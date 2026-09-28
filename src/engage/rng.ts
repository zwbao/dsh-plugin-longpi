// sha256-counter draws. The seed stays on disk; the page shows only the commitment.

import { createHash } from 'node:crypto'
import type { Rarity } from '../contracts/codex.ts'

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

export function rarityRank(rarity: Rarity): number {
  return RANK[rarity]
}

export function atLeast(rolled: Rarity, floor: Rarity): Rarity {
  return RANK[rolled] >= RANK[floor] ? rolled : floor
}

/** A number in [0, 1). The same seed, counter and salt always return the same number. */
export function rollUnit(seed: Buffer, counter: number, salt: string): number {
  const hash = createHash('sha256').update(seed).update('|').update(String(counter)).update('|').update(salt).digest()
  return hash.readUInt32BE(0) / 2 ** 32
}

export function commitmentOf(seed: Buffer): string {
  return createHash('sha256').update(seed).digest('hex')
}

export function drawId(seed: Buffer, counter: number): string {
  const hex = createHash('sha256').update(seed).update('|id|').update(String(counter)).digest('hex').slice(0, 12)
  return `dr${hex}`
}
