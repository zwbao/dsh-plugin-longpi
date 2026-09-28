// M6 seams (AA §3.6). C0 stubs.

import type { FactPack } from '../contracts/factpack.ts'
import type { CandidateProvider } from '../contracts/surfaces.ts'

export function engagementSummary(): FactPack['engagement'] {
  return null
}

export const engageCandidates: CandidateProvider = () => []
