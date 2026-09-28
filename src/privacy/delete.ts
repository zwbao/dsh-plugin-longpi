// Delete the local LongPi store. Mirobody is the person's own service; this does not call it.

import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../core/store.ts'
import { deletePhrase } from './disclosure.ts'
import { mirobodyExportLink } from './export.ts'

export interface DeleteResult {
  ok: true
  deleted: number
  kept: 'privacy/deleted.json'
  mirobody_url: string
  mirobody_note_zh: string
}

/** True when the body is the exact confirmation phrase, with nothing added. */
export function confirmedDelete(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  return (body as { confirm?: unknown }).confirm === deletePhrase()
}

/** Remove every file under dataDir, then leave a tombstone that has no health values and no name. */
export function deleteLocalStore(dataDir: string, fallbackMcpUrl = '', now = new Date()): DeleteResult {
  const link = mirobodyExportLink(dataDir, fallbackMcpUrl)
  let deleted = 0
  if (existsSync(dataDir)) {
    for (const entry of readdirSync(dataDir)) {
      rmSync(join(dataDir, entry), { recursive: true, force: true })
      deleted += 1
    }
  }
  writeJsonAtomic(join(dataDir, 'privacy', 'deleted.json'), {
    version: 1,
    deleted_at: now.toISOString(),
    what_zh: '已删除这台电脑上的 LongPi 档案',
    mirobody_note_zh: link.note_zh,
    ...(link.url ? { mirobody_url: link.url } : {}),
  })
  return { ok: true, deleted, kept: 'privacy/deleted.json', mirobody_url: link.url, mirobody_note_zh: link.note_zh }
}
