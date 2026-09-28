// M4 seams (AA §3.6). C0 stub.

import type { FeedbackMessage } from '../contracts/feedback.ts'
import type { MemoryApi } from '../contracts/memory.ts'
import type { Tracking } from '../tracking.ts'

export function feedbackFor(_tracking: Tracking, _memory: MemoryApi | null): FeedbackMessage[] {
  return []
}
