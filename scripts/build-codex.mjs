// Build data/codex/cards.json and droptable.json from the longevity-skills catalog.
// Rarity follows evidence, never a biomarker: human RCT = 金, human observational = 紫,
// animal = 银, cell = 铜. Comparative-biology species are extra hidden 金 cards.
// Greenland shark is not in the 171-method library, so no card is invented for it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = dirname(here)
const catalogPath = join(process.env.LONGEVITY_SKILLS_HOME || join(repo, '..', 'longevity-skills'), 'catalog.json')
const skillsRoot = dirname(catalogPath)
const outDir = join(repo, 'data', 'codex')

const ID_RE = /^[a-z0-9][a-z0-9-]{5,63}$/
const SPECIES_TITLE = {
  'bowhead-whale-dna-repair': '弓头鲸',
  'butterfly-longevity-slowed-ageing': '热带蝴蝶',
  'epigenetic-aging-naked-mole': '裸鼹鼠',
  'gompertz-celegans-decrepitude': '秀丽隐杆线虫',
  'mammal-cancer-risk-lifespan': '哺乳动物与癌症',
  'mammal-somatic-mutation-lifespan': '哺乳动物的突变率',
  'naked-mole-ovarian-reserve': '裸鼹鼠的卵巢储备',
  'naked-mole-queen-methylation-clock': '裸鼹鼠蚁后',
  'neuron-aging-clocks': '线虫的神经元',
}

function evidenceOf(skill) {
  const ev = skill.evidence
  if (ev === 'rct') return { evidence_tier: 'human_rct', rarity: 'legendary' }
  if (ev === 'animal') return { evidence_tier: 'animal', rarity: 'rare' }
  if (ev === 'in_vitro') return { evidence_tier: 'cell', rarity: 'common' }
  return { evidence_tier: 'human_obs', rarity: 'epic' }
}

function paperOf(name) {
  const path = join(skillsRoot, 'skills', name, 'skill.json')
  if (!existsSync(path)) return {}
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'))
    const paper = json.paper && typeof json.paper === 'object' ? json.paper : {}
    return {
      doi: typeof paper.doi === 'string' ? paper.doi : undefined,
      title_zh: typeof paper.title_zh === 'string' ? paper.title_zh : undefined,
    }
  } catch {
    return {}
  }
}

function clip(text, max) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
if (!Array.isArray(catalog.skills) || catalog.skills.length < 100) {
  throw new Error(`catalog at ${catalogPath} does not look like the 171-method library`)
}

const cards = []
for (const skill of [...catalog.skills].sort((a, b) => a.name.localeCompare(b.name))) {
  const mapped = evidenceOf(skill)
  const paper = paperOf(skill.name)
  const id = `m-${skill.name}`
  if (!ID_RE.test(id)) throw new Error(`bad method card id ${id}`)
  const title = clip(paper.title_zh || skill.blurb_zh || skill.name, 40)
  const blurb = clip(skill.blurb_zh || paper.title_zh || skill.name, 120)
  cards.push({
    id,
    family: 'method',
    title_zh: title,
    body_zh: `${blurb} 这张卡讲的是研究方法，不是你的检查结果。`,
    rarity: mapped.rarity,
    evidence_tier: mapped.evidence_tier,
    skill: skill.name,
    hidden: false,
    set_id: 'set-library',
    source: { ...(paper.doi ? { doi: paper.doi } : {}), skill: skill.name },
  })
  if ((skill.domains ?? []).includes('比较生物学')) {
    const hid = `h-${skill.name}`
    if (!ID_RE.test(hid)) throw new Error(`bad species card id ${hid}`)
    const species = (skill.species ?? []).find((name) => name !== 'human' && name !== 'cell_line') ?? 'multi_species'
    cards.push({
      id: hid,
      family: 'species',
      title_zh: SPECIES_TITLE[skill.name] ?? clip(skill.blurb_zh || skill.name, 20),
      body_zh: `隐藏物种卡。${blurb} 抽到之前不出现在图鉴里。`,
      rarity: 'legendary',
      skill: skill.name,
      species,
      hidden: true,
      set_id: 'set-species',
      source: { ...(paper.doi ? { doi: paper.doi } : {}), skill: skill.name },
    })
  }
}

cards.push(
  {
    id: 'u-streak-freeze',
    family: 'utility',
    title_zh: '安心休息',
    body_zh: '生病或出行的日子记一笔，这几天的提醒会放轻；累计的天数本来就不会减少。不能买卖。',
    rarity: 'rare',
    utility: 'streak_freeze',
    hidden: false,
    set_id: 'set-utility',
    source: {},
  },
  {
    id: 'u-doctor-questions',
    family: 'utility',
    title_zh: '要问医生的问题',
    body_zh: '展开一张问题清单：这次最该问医生的三件事。不代替就诊，也不按指标结果分稀有度。',
    rarity: 'rare',
    utility: 'doctor_questions',
    hidden: false,
    set_id: 'set-utility',
    source: {},
  },
  {
    id: 'u-deep-dive',
    family: 'utility',
    title_zh: '把一张方法卡读完',
    body_zh: '从已经抽到的方法卡里挑一张，打开它的说明。不新增结论，也不按指标结果分稀有度。',
    rarity: 'rare',
    utility: 'deep_dive',
    hidden: false,
    set_id: 'set-utility',
    source: {},
  },
  {
    id: 'i-three-weeks',
    family: 'insight',
    title_zh: '累计三周的记录',
    body_zh: '你已经累计至少 21 天自己记下的测量、打卡或就诊。这张卡只说明记录在继续，不说明任何指标变好或变差。',
    rarity: 'rare',
    insight: { min_days_of_data: 21 },
    hidden: true,
    set_id: 'set-insight',
    source: {},
  },
  {
    id: 'i-four-weeks',
    family: 'insight',
    title_zh: '满四周的记录',
    body_zh: '你已经有至少 28 天自己的记录。这张卡只说明时间够长，可以开始讲进展，不按数值高低分稀有度。',
    rarity: 'rare',
    insight: { min_days_of_data: 28 },
    hidden: true,
    set_id: 'set-insight',
    source: {},
  },
)

const pools = { common: [], rare: [], epic: [], legendary: [] }
for (const card of cards) {
  if (card.family === 'insight' || card.family === 'utility') continue
  pools[card.rarity].push(card.id)
}
for (const rarity of Object.keys(pools)) {
  pools[rarity].sort()
  if (pools[rarity].length === 0) throw new Error(`empty pool ${rarity}`)
}

const table = {
  id: 'drop-codex-v1',
  version: 1,
  season_id: null,
  odds: { common: 0.5, rare: 0.3, epic: 0.15, legendary: 0.05 },
  pity: { after_draws: 10, min_rarity: 'rare' },
  daily_cap: 3,
  care_guarantee: 'rare',
  pools,
  money: 'none',
  trading: 'none',
  biomarker_linked_rarity: false,
}
const sum = Object.values(table.odds).reduce((total, value) => total + value, 0)
if (Math.abs(sum - 1) > 1e-9) throw new Error(`odds sum ${sum}`)

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'cards.json'), `${JSON.stringify({ version: 1, cards }, null, 2)}\n`)
writeFileSync(join(outDir, 'droptable.json'), `${JSON.stringify(table, null, 2)}\n`)

const by = {}
for (const card of cards) by[`${card.family}:${card.rarity}`] = (by[`${card.family}:${card.rarity}`] ?? 0) + 1
console.log(`cards ${cards.length} from ${catalog.skills.length} skills`)
console.log(by)
console.log('pools', Object.fromEntries(Object.entries(pools).map(([key, ids]) => [key, ids.length])))
