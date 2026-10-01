// Drop-table maths. Odds are the rarity odds shown on the page. A card is then
// chosen uniformly inside that rarity. Nothing in here reads a biomarker.

import type { CodexCard, DropTable, DrawResult, Rarity } from '../contracts/codex.ts'
import { oddsSumToOne } from '../contracts/codex.ts'
import { atLeast, commitmentOf, drawId, RARITY_ORDER, rarityRank, rollUnit } from './rng.ts'

const RARITY_ZH: Record<Rarity, string> = { common: '铜', rare: '银', epic: '紫', legendary: '金' }

export function rarityZh(rarity: Rarity): string {
  return RARITY_ZH[rarity]
}

export function pickRarity(unit: number, odds: Record<Rarity, number>): Rarity {
  // Hundredths of a basis point. 0.52+0.28+0.16 is the legendary boundary (0.96),
  // but the float sum sits just above 0.96 and would otherwise leave that unit in epic.
  const scale = 10000
  const unitBp = Math.round(unit * scale)
  let cursor = 0
  for (const rarity of RARITY_ORDER) {
    cursor += odds[rarity] ?? 0
    if (unitBp < Math.round(cursor * scale)) return rarity
  }
  return 'legendary'
}

export function pickIndex(unit: number, size: number): number {
  if (size <= 0) return 0
  return Math.min(size - 1, Math.floor(unit * size))
}

/** Problems in a table or its cards. Empty means it matches the published rules. */
export function auditCodex(table: DropTable, cards: readonly CodexCard[]): string[] {
  const errors: string[] = []
  if (!oddsSumToOne(table)) errors.push('odds do not sum to 1')
  if (table.money !== 'none') errors.push('money')
  if (table.trading !== 'none') errors.push('trading')
  if (table.biomarker_linked_rarity !== false) errors.push('biomarker-linked rarity')
  if (table.care_guarantee !== 'rare') errors.push('care guarantee')
  if (!(table.daily_cap >= 1)) errors.push('daily cap')
  if (!(table.pity.after_draws >= 1)) errors.push('pity')
  const byId = new Map(cards.map((card) => [card.id, card]))
  for (const rarity of RARITY_ORDER) {
    const pool = table.pools[rarity] ?? []
    if (pool.length === 0) errors.push(`empty ${rarity}`)
    for (const id of pool) {
      const card = byId.get(id)
      if (!card) errors.push(`missing ${id}`)
      else if (card.rarity !== rarity) errors.push(`pool mismatch ${id}`)
    }
  }
  for (const card of cards) {
    if (card.family !== 'method' || !card.evidence_tier) continue
    const expect: Rarity = card.evidence_tier === 'human_rct' ? 'legendary'
      : card.evidence_tier === 'human_obs' ? 'epic'
        : card.evidence_tier === 'animal' ? 'rare'
          : 'common'
    if (card.rarity !== expect) errors.push(`evidence ${card.id}`)
  }
  return errors
}

/**
 * Season-0 odds are the RS table (common/rare/epic/legendary 0.52/0.28/0.16/0.04),
 * not the earlier 0.50/0.30/0.15/0.05 draft. Pity is 10 draws then at least rare.
 * Daily cap is 3. Care actions redraw from rare upward. Utility cards (a freeze,
 * the doctor brief, a deep dive) are not in the pools.
 */
/** The sentence the page shows. It is built from the table, so it cannot drift from the roll. */
export function oddsDisclosure(table: DropTable, cards: readonly CodexCard[]): string {
  const pct = (rarity: Rarity) => String(Math.round((table.odds[rarity] ?? 0) * 100))
  const byId = new Map(cards.map((card) => [card.id, card]))
  const legendary = (table.pools.legendary ?? []).map((id) => byId.get(id)).filter((card): card is CodexCard => Boolean(card))
  const rct = legendary.filter((card) => card.family === 'method').length
  const species = legendary.filter((card) => card.family === 'species').length
  return [
    `每次抽取的概率：铜 ${pct('common')}%（细胞实验），银 ${pct('rare')}%（动物实验），紫 ${pct('epic')}%（人体观察性研究），金 ${pct('legendary')}%（人体随机对照 ${rct} 张，比较生物学隐藏物种 ${species} 张；抽到之前物种卡不显示）。`,
    `连续 ${table.pity.after_draws} 次没有银或以上时，下一次至少是银。每天最多抽 ${table.daily_cap} 次。`,
    '携带简报就诊、加测缺失项目，或在复测窗口内完成复测，可保证至少获得一张银卡。',
    '没有付费，不能交易。稀有度按研究证据固定，不由指标好坏决定。',
  ].join('')
}

export interface DrawOnceInput {
  table: DropTable
  cards: readonly CodexCard[]
  seed: Buffer
  counter: number
  pityBefore: number
  /** Care actions pass the table's care guarantee. Ordinary draws pass null. */
  guarantee: Rarity | null
  owned: ReadonlySet<string>
  /** Insight cards added to their own rarity pool once the person has enough days of records. */
  extraIds?: readonly string[]
  at: string
  grantId: string
  /** Test seam. Production draws leave this unset and use the hash. */
  units?: { rarity: number; card: number }
}

function poolIds(table: DropTable, cards: readonly CodexCard[], rarity: Rarity, extraIds: readonly string[]): string[] {
  const ids = [...(table.pools[rarity] ?? [])]
  const byId = new Map(cards.map((card) => [card.id, card]))
  for (const id of extraIds) {
    const card = byId.get(id)
    if (card && card.rarity === rarity && !ids.includes(id)) ids.push(id)
  }
  return ids
}

function pickCard(input: DrawOnceInput, rarity: Rarity): CodexCard {
  const byId = new Map(input.cards.map((card) => [card.id, card]))
  const higher = RARITY_ORDER.filter((item) => rarityRank(item) > rarityRank(rarity))
  const lower = [...RARITY_ORDER].reverse().filter((item) => rarityRank(item) < rarityRank(rarity))
  for (const bucket of [rarity, ...higher, ...lower]) {
    const pool = poolIds(input.table, input.cards, bucket, input.extraIds ?? [])
    if (pool.length === 0) continue
    const unit = input.units?.card ?? rollUnit(input.seed, input.counter, `card:${bucket}`)
    const id = pool[pickIndex(unit, pool.length)] ?? pool[0]
    const card = id ? byId.get(id) : undefined
    if (card) return card
  }
  throw new Error('drop table has no cards')
}

export function drawOnce(input: DrawOnceInput): { result: DrawResult; card: CodexCard; pityAfter: number } {
  const rarityUnit = input.units?.rarity ?? rollUnit(input.seed, input.counter, 'rarity')
  let rarity = pickRarity(rarityUnit, input.table.odds)
  if (input.pityBefore >= input.table.pity.after_draws) rarity = atLeast(rarity, input.table.pity.min_rarity)
  if (input.guarantee) rarity = atLeast(rarity, input.guarantee)
  const card = pickCard(input, rarity)
  const pityAfter = rarityRank(card.rarity) >= rarityRank(input.table.pity.min_rarity) ? 0 : input.pityBefore + 1
  const result: DrawResult = {
    id: drawId(input.seed, input.counter),
    grant_id: input.grantId,
    card_id: card.id,
    rarity: card.rarity,
    duplicate: input.owned.has(card.id),
    pity_before: input.pityBefore,
    rng: { algo: 'sha256-counter', seed_commitment: commitmentOf(input.seed), counter: input.counter },
    at: input.at,
  }
  return { result, card, pityAfter }
}
