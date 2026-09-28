// M7 seams (AA §3.6). C0 stubs.

import type { CandidateProvider } from '../contracts/surfaces.ts'

export interface NarrativeFinding { id: string; date: string; text_zh: string; kind: string }

export function narrativeFindings(): NarrativeFinding[] {
  return []
}

export const datainCandidates: CandidateProvider = () => []
