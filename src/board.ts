import type { Catalog } from './catalog.ts'
import { domainSummary } from './match.ts'
import { matchSkills } from './match.ts'
import type { MountState } from './mirobody.ts'
import type { Receipt } from './runner.ts'
import type { RecordSnapshot } from './records.ts'
import { PRODUCT_VERSION } from './version.ts'

export function buildBoard(input: {
  catalog: Catalog
  records: RecordSnapshot
  mount: MountState
  receipts: Receipt[]
  limit: number
}) {
  const domains = domainSummary(input.catalog.cards).map((row) => ({ domain: row.domain, count: row.count }))
  const dispatch = matchSkills(
    input.catalog.cards,
    '',
    input.records.indicators.map((item) => item.name),
    input.limit,
  )
  return {
    product: 'dsh-plugin-longpi',
    version: PRODUCT_VERSION,
    profile: input.records.profile,
    estimated_age: input.records.estimated_age,
    skills: {
      home_set: Boolean(input.catalog.home),
      revision: input.catalog.revision,
      count: input.catalog.cards.length,
      error: input.catalog.error,
      domains,
    },
    mirobody: {
      mounted: input.mount.mounted,
      peer: input.mount.peer,
      error: input.mount.error,
      engine: input.records.engine,
      mcp: input.records.mcp,
    },
    records: {
      status: input.records.record_status,
      error: input.records.record_error,
      indicators: input.records.indicators.slice(0, 20),
      medications: input.records.medications.slice(0, 20),
    },
    dispatch,
    receipts: input.receipts,
    boundary: '这不是诊断，也不能改处方。技能没写出的数字不要补。紧急情况请拨打 120。',
  }
}
