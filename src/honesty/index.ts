// M9 seams (AA §3.6). C0 stubs.

import type { NumberRef } from '../contracts/common.ts'

export function formatNumber(ref: Pick<NumberRef, 'value' | 'unit'>): string {
  return `${String(ref.value)}${ref.unit ? ` ${ref.unit}` : ''}`
}

export function modelRangeNote(_model: string, _age: number | null): string | null {
  return null
}
