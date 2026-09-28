// M11 seams (AA §3.6). C0 stub.

import type { ConsentRecord } from '../contracts/science.ts'

export function consentGranted(_scope: ConsentRecord['scope']): boolean {
  return false
}
