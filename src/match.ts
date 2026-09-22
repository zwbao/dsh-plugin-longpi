import type { SkillCard } from './catalog.ts'

export interface MatchHit {
  name: string
  domain: string
  blurb: string
  score: number
  why: string[]
  has_script: boolean
}

export interface DomainRow {
  domain: string
  count: number
  names: string[]
}

const WEAK = new Set([
  'age', 'aging', 'ageing', 'aged', 'biological', 'blood', 'human', 'cell', 'cells',
  'gene', 'genes', 'protein', 'risk', 'health', 'study', 'paper', 'user', 'when',
  '年龄', '血液', '指标', '检查', '个人', '这个', '一个', '什么', '怎么', '可以',
  '记录', '技能', '方法', '实足', '没有', '不是',
])

const ORGANISMS: Array<{ id: string; re: RegExp }> = [
  { id: 'mouse', re: /小鼠|mouse|mice/i },
  { id: 'worm', re: /线虫|elegans/i },
  { id: 'fly', re: /果蝇|drosophila/i },
  { id: 'mole', re: /裸鼹鼠|naked mole/i },
  { id: 'planarian', re: /涡虫|planarian/i },
  { id: 'butterfly', re: /蝴蝶|butterfly|helicon/i },
  { id: 'whale', re: /弓头鲸|bowhead/i },
  { id: 'fish', re: /青鳉|killifish|斑马鱼|zebrafish/i },
]

const SIGNALS: Array<{ skill: string; needles: string[]; need: number; why: string }> = [
  {
    skill: 'accelerated-biological-aging-risk',
    needles: ['albumin', '白蛋白', 'creatinine', '肌酐', 'glucose', '血糖', 'crp', 'c-reactive', 'c反应', 'lymph', '淋巴', 'mcv', 'rdw', 'alp', '碱性磷酸酶', 'wbc', '白细胞'],
    need: 3,
    why: '检查名里出现了表型年龄会用到的指标',
  },
  {
    skill: 'leukocyte-telomere-length',
    needles: ['telomere', '端粒'],
    need: 1,
    why: '记录里有端粒',
  },
  {
    skill: 'digital-telomere-measurement-sequencing',
    needles: ['telomere', '端粒'],
    need: 1,
    why: '记录里有端粒',
  },
  {
    skill: 'sleep-chart-biological-ageing',
    needles: ['sleep duration', '睡眠'],
    need: 1,
    why: '记录里有睡眠',
  },
]

export function domainSummary(cards: readonly SkillCard[]): DomainRow[] {
  const map = new Map<string, string[]>()
  for (const card of cards) {
    const names = map.get(card.domain) ?? []
    names.push(card.name)
    map.set(card.domain, names)
  }
  return [...map.entries()].map(([domain, names]) => ({
    domain,
    count: names.length,
    names,
  }))
}

function englishTerms(query: string): string[] {
  const found = new Set<string>()
  for (const match of query.toLowerCase().matchAll(/[a-z0-9][a-z0-9-]{2,}/g)) {
    if (match[0]) found.add(match[0])
  }
  return [...found]
}

function cjkGrams(query: string): string[] {
  const found = new Set<string>()
  for (const match of query.matchAll(/[\u4e00-\u9fff]{2,}/g)) {
    const run = match[0] ?? ''
    const max = Math.min(run.length, 8)
    for (let size = 2; size <= max; size += 1) {
      for (let index = 0; index + size <= run.length; index += 1) {
        found.add(run.slice(index, index + size))
      }
    }
  }
  return [...found]
}

function organismOf(card: SkillCard): { id: string; re: RegExp } | null {
  const hay = `${card.name} ${card.domain} ${card.blurb}`
  return ORGANISMS.find((item) => item.re.test(hay)) ?? null
}

function signalWhy(skill: string, indicatorHay: string): string {
  if (!indicatorHay) return ''
  const rule = SIGNALS.find((item) => item.skill === skill)
  if (!rule) return ''
  const hits = rule.needles.filter((needle) => indicatorHay.includes(needle.toLowerCase()))
  return hits.length >= rule.need ? rule.why : ''
}

export function matchSkills(
  cards: readonly SkillCard[],
  query: string,
  indicatorNames: readonly string[],
  limit: number,
): { matches: MatchHit[]; note: string } {
  const asked = query.trim()
  const terms = englishTerms(asked)
  const grams = cjkGrams(asked)
  const indicatorHay = indicatorNames.join('\n').toLowerCase()
  const hits: MatchHit[] = []
  for (const card of cards) {
    const why: string[] = []
    let score = 0
    let specific = 0
    const hay = `${card.name}\n${card.description}\n${card.blurb}\n${card.lead}`.toLowerCase()
    if (asked) {
      if (terms.some((term) => term === card.name || card.name.includes(term))) {
        score += 8
        specific += 1
        why.push('名字对上了问题')
      }
      for (const term of terms) {
        if (term === card.name || card.name.includes(term)) continue
        if (!hay.includes(term.toLowerCase())) continue
        if (WEAK.has(term)) {
          score += 1
        } else {
          score += 3
          specific += 1
          why.push(`说明里有「${term}」`)
        }
      }
      for (const gram of grams) {
        if (!hay.includes(gram)) continue
        if (WEAK.has(gram)) {
          score += 1
          continue
        }
        score += gram.length >= 4 ? 4 : gram.length === 3 ? 3 : 2
        specific += 1
        if (gram.length >= 3) why.push(`说明里有「${gram}」`)
      }
    }
    const signal = signalWhy(card.name, indicatorHay)
    if (signal) {
      score += 6
      specific += 1
      why.push(signal)
    }
    const organism = organismOf(card)
    if (organism && !organism.re.test(asked)) score -= 8
    if (organism && organism.re.test(asked)) {
      score += 4
      specific += 1
      why.push('问题点了这个模式生物')
    }
    if (asked && specific === 0) score = Math.min(score, 2)
    if (score <= 0) continue
    hits.push({
      name: card.name,
      domain: card.domain,
      blurb: card.blurb,
      score,
      why: why.slice(0, 4),
      has_script: Boolean(card.script),
    })
  }
  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const matches = hits.slice(0, limit)
  let note = '按问题和个人记录排序。名单以外的技能这次不调度。'
  if (matches.length === 0 && asked) note = '没有技能的说明对上这个问题。可以先看领域目录，换一种说法。'
  if (matches.length === 0 && !asked) note = '还没有问题，记录里也没有对上已知指标。先说出要读的方法，或接上检查。'
  return { matches, note }
}
