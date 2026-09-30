// M13 routes: GET /api/longpi/people, POST /api/longpi/people (add a family member), POST /api/longpi/people/active
// (switch whose record the page and the chat look at), POST /api/longpi/people/remove.

import { existsSync, rmSync } from 'node:fs'
import type { CoreDeps } from '../contracts/index.ts'
import { readConnection, saveConnection, connectionUrlProblem } from '../connection.ts'
import { resolveRootDir } from '../paths.ts'
import { EMPTY_PROFILE, mergeProfile, normalizeProfile, writeProfile } from '../profile.ts'
import { createManagedMember, ensureMemberLink, holderAuth, mintMemberLink, saveMemberLink } from './mirobody.ts'
import { SELF, activePerson, addPerson, personDir, readRegistry, removePerson, setActive } from './store.ts'

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function peopleView(deps: CoreDeps) {
  const root = resolveRootDir(deps.config().dataDir)
  const reg = readRegistry(root)
  const holder = holderAuth(root)
  return {
    ok: true,
    active: reg.active,
    people: [
      { id: SELF, label_zh: '我', name: '', connected: Boolean(readConnection(root)?.mcp_url || deps.config().mcpUrl), managed: false },
      ...reg.people.map((p) => ({ id: p.id, label_zh: p.label_zh, name: p.name, sex: p.sex, birth_year: p.birth_year,
        connected: Boolean(readConnection(personDir(root, p.id))?.mcp_url), managed: Boolean(p.mirobody_user_id) })),
    ],
    can_create_in_mirobody: !('error_zh' in holder),
    create_hint_zh: 'error_zh' in holder ? holder.error_zh : '',
  }
}

export function registerPeopleRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/people', async () => peopleView(deps))

  deps.http.route('POST', '/api/longpi/people', async (_req, body) => {
    const v = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const label = text(v.label_zh, 12)
    const name = text(v.name, 30) || label
    const sex = v.sex === 'male' || v.sex === 'female' ? v.sex : null
    const year = Number(v.birth_year)
    const birthYear = Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() ? year : null
    const pasted = text(v.mcp_url, 600)
    if (!label) return { ok: false, status: 400, error: '写一个称呼，比如「爸爸」「妈妈」。' }
    if (!sex) return { ok: false, status: 400, error: '选择生理性别（很多计算按性别分别进行）。' }
    if (pasted && connectionUrlProblem(pasted)) return { ok: false, status: 400, error: connectionUrlProblem(pasted) }
    const root = resolveRootDir(deps.config().dataDir)
    const holder = holderAuth(root)
    // Mirobody first: a member that cannot be created there is not half-created here.
    let memberId = ''
    let link = pasted
    if (!pasted) {
      if ('error_zh' in holder) return { ok: false, status: 409, error: holder.error_zh }
      try {
        memberId = await createManagedMember(holder, { name, sex, birth_year: birthYear })
        link = await mintMemberLink(holder, memberId)
      } catch (error) {
        return { ok: false, status: 502, error: `在 Mirobody 为${label}建档没有成功：${error instanceof Error ? error.message : String(error)}` }
      }
    }
    const person = addPerson(root, { label_zh: label, name, sex, birth_year: birthYear, ...(memberId ? { mirobody_user_id: memberId } : {}) })
    const dir = personDir(root, person.id)
    const age = birthYear ? new Date().getFullYear() - birthYear : null
    const normalized = normalizeProfile(mergeProfile(EMPTY_PROFILE, { displayName: name, sex, ...(birthYear ? { birthYear } : {}), ...(age ? { age } : {}) }))
    if (normalized.ok) writeProfile(dir, normalized.profile)
    if (memberId) saveMemberLink(root, person, link)
    else saveConnection(dir, { mcp_url: link, mcp_token: '' })
    return { ...peopleView(deps), person: { id: person.id, label_zh: person.label_zh } }
  })

  deps.http.route('POST', '/api/longpi/people/active', async (_req, body) => {
    const v = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const id = text(v.id, 60)
    const root = resolveRootDir(deps.config().dataDir)
    if (!setActive(root, id)) return { ok: false, status: 404, error: '没有这个人。' }
    let warning = ''
    const person = activePerson(root).person
    if (person) warning = await ensureMemberLink(root, person)
    deps.invalidate()
    return { ...peopleView(deps), warning_zh: warning }
  })

  deps.http.route('POST', '/api/longpi/people/remove', async (_req, body) => {
    const v = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const id = text(v.id, 60)
    if (id === SELF) return { ok: false, status: 400, error: '不能移除你自己。' }
    const root = resolveRootDir(deps.config().dataDir)
    const removed = removePerson(root, id)
    if (!removed) return { ok: false, status: 404, error: '没有这个人。' }
    const dir = personDir(root, id)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })     // this install's copy only; Mirobody keeps their record
    deps.invalidate()
    return peopleView(deps)
  })
}
