import { createHash } from 'node:crypto'

export interface AuditReceipt {
  ts: string
  tool: string
  arg_sha256: string
  result_sha256: string
  prev_sha256: string
  sha256: string
}

const chain: AuditReceipt[] = []

function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function appendAudit(tool: string, args: unknown, result: unknown): AuditReceipt {
  const prev = chain.at(-1)?.sha256 ?? '0'.repeat(64)
  const arg_sha256 = sha(JSON.stringify(args))
  const result_sha256 = sha(JSON.stringify(result))
  const ts = new Date().toISOString()
  const sha256 = sha([ts, tool, arg_sha256, result_sha256, prev].join('|'))
  const row: AuditReceipt = { ts, tool, arg_sha256, result_sha256, prev_sha256: prev, sha256 }
  chain.push(row)
  return row
}

export function listAudit(): AuditReceipt[] {
  return [...chain]
}
