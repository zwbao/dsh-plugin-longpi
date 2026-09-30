// People managed on one install: the account holder ("self", the LongPi home) and family members, each with their own
// store under people/<id>/. The registry and the pointer to the person being looked at live in the LongPi home.

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../core/store.ts'
import { resolveRootDir } from '../paths.ts'

export const SELF = 'self'

export interface Person {
  id: string
  /** How the holder calls them: 爸爸, 妈妈. */
  label_zh: string
  name: string
  sex: 'male' | 'female'
  birth_year: number | null
  /** The Mirobody managed member, when LongPi created or linked one. */
  mirobody_user_id?: string
  /** When the member's personal MCP link was minted (it expires after ten days). */
  link_minted_at?: string
  created_at: string
}

export interface Registry {
  active: string
  people: Person[]
}

export function rootDir(configured: string): string {
  return resolveRootDir(configured)
}

export function readRegistry(root: string): Registry {
  try {
    const raw = JSON.parse(readFileSync(join(root, 'people.json'), 'utf8')) as Partial<Registry>
    const people = Array.isArray(raw.people) ? raw.people.filter((p): p is Person => Boolean(p) && typeof p.id === 'string' && typeof p.label_zh === 'string') : []
    const active = typeof raw.active === 'string' && (raw.active === SELF || people.some((p) => p.id === raw.active)) ? raw.active : SELF
    return { active, people }
  } catch {
    return { active: SELF, people: [] }
  }
}

function writeRegistry(root: string, reg: Registry): void {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeJsonAtomic(join(root, 'people.json'), reg)
}

export function personDir(root: string, id: string): string {
  return id === SELF ? root : join(root, 'people', id)
}

export function addPerson(root: string, input: Omit<Person, 'id' | 'created_at'>): Person {
  const reg = readRegistry(root)
  const person: Person = { ...input, id: `p${randomBytes(5).toString('hex')}`, created_at: new Date().toISOString() }
  mkdirSync(personDir(root, person.id), { recursive: true, mode: 0o700 })
  writeRegistry(root, { ...reg, people: [...reg.people, person] })
  return person
}

export function updatePerson(root: string, id: string, patch: Partial<Person>): Person | null {
  const reg = readRegistry(root)
  const at = reg.people.findIndex((p) => p.id === id)
  if (at < 0) return null
  const next = { ...reg.people[at], ...patch, id } as Person
  const people = [...reg.people]
  people[at] = next
  writeRegistry(root, { ...reg, people })
  return next
}

export function setActive(root: string, id: string): boolean {
  const reg = readRegistry(root)
  if (id !== SELF && !reg.people.some((p) => p.id === id && existsSync(personDir(root, p.id)))) return false
  writeRegistry(root, { ...reg, active: id })
  return true
}

/** Remove a family member from this install (their local store goes; their Mirobody record is not touched). */
export function removePerson(root: string, id: string): Person | null {
  const reg = readRegistry(root)
  const person = reg.people.find((p) => p.id === id)
  if (!person) return null
  writeRegistry(root, { active: reg.active === id ? SELF : reg.active, people: reg.people.filter((p) => p.id !== id) })
  return person
}

export function activePerson(root: string): { id: string; label_zh: string; person: Person | null } {
  const reg = readRegistry(root)
  const person = reg.people.find((p) => p.id === reg.active) ?? null
  return { id: person ? person.id : SELF, label_zh: person ? person.label_zh : '我', person }
}
