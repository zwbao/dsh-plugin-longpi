// Whose store a background read or write is for, and whether it is still that same store when the read finishes.
// A page can switch members at any moment, so a handler that captured a directory must check it again before writing.

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SELF, activePerson, personDir, readRegistry } from './people/store.ts'

export interface StoreOwner { id: string; label_zh: string }

/** The member (or the holder) whose store this directory is; null when it is not a store of this install. */
export function ownerOfStore(root: string, dataDir: string): StoreOwner | null {
  if (dataDir === root) return { id: SELF, label_zh: '我' }
  const person = readRegistry(root).people.find((row) => personDir(root, row.id) === dataDir)
  return person ? { id: person.id, label_zh: person.label_zh } : null
}

/** A store's identity, so a record read for it is never applied to a store removed or replaced while it was read. */
export interface StoreIdentity { dev: number; ino: number; deleted: string }

/** The delete tombstone's content: a cleared store keeps `privacy/deleted.json`, a live one has none. */
function deletionStamp(dataDir: string): string {
  try {
    return readFileSync(join(dataDir, 'privacy', 'deleted.json'), 'utf8')
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? '' : 'unreadable'
  }
}

export function storeIdentity(dataDir: string): StoreIdentity | null {
  try {
    const stat = statSync(dataDir)
    return stat.isDirectory() ? { dev: stat.dev, ino: stat.ino, deleted: deletionStamp(dataDir) } : null
  } catch {
    return null
  }
}

export function sameStore(before: StoreIdentity, after: StoreIdentity | null): boolean {
  return after !== null && before.dev === after.dev && before.ino === after.ino && before.deleted === after.deleted
}

/** The owner is still registered under the same id and the store is still the one that was captured. */
export function storeStillTheirs(root: string, dataDir: string, before: StoreIdentity, owner: StoreOwner): boolean {
  const now = ownerOfStore(root, dataDir)
  return now !== null && now.id === owner.id && sameStore(before, storeIdentity(dataDir))
}

/** The holder's store is the install root; the active member is read from the same registry for attribution. */
export function storeIsCurrent(root: string, dataDir: string): boolean {
  const active = activePerson(root)
  return active.id === SELF ? dataDir === root : personDir(root, active.id) === dataDir
}
