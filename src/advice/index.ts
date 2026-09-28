// M2 seams (AA §3.6). C0 stub.

import type { AdviceTierResult } from '../contracts/advice.ts'
import type { MemoryApi } from '../contracts/memory.ts'

export function adviceFor(_subject: string, _memory: MemoryApi | null): AdviceTierResult | null {
  return null
}
