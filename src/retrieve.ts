import { FAQ, TERMS } from './fixture.ts'

export interface RetrieveHit {
  kind: 'faq' | 'term'
  title: string
  body: string
  score: number
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,，。？?、/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 1)
}

export function retrieve(query: string, limit = 5): RetrieveHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []
  const hits: RetrieveHit[] = []
  for (const faq of FAQ) {
    const hay = `${faq.question} ${faq.answer} ${faq.tags.join(' ')}`.toLowerCase()
    const score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
    if (score > 0) hits.push({ kind: 'faq', title: faq.question, body: faq.answer, score })
  }
  for (const term of TERMS) {
    const hay = `${term.term_zh} ${term.definition_zh} ${term.code}`.toLowerCase()
    const score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
    if (score > 0) hits.push({ kind: 'term', title: term.term_zh, body: term.definition_zh, score })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
