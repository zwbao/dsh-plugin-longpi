// A family member's record in Mirobody: a managed member of the holder's care circle, read through a personal MCP link
// minted for that member. The holder's account token is used only to create the member, to mint (and renew) the
// link, and to upload a report into the member's record; it is never sent with the member's reads, because Mirobody
// answers a request carrying an account token as that account, whatever link it came through.

import { readConnection, saveConnection } from '../connection.ts'
import { personDir, updatePerson, type Person } from './store.ts'

/** Links live ten days on Mirobody; renew a little before. */
export const RENEW_AFTER_MS = 7 * 24 * 3600 * 1000

export interface HolderAuth { base: string; token: string }

export function holderAuth(root: string): HolderAuth | { error_zh: string } {
  const saved = readConnection(root)
  if (!saved?.mcp_token || !saved.mcp_url) {
    return { error_zh: '要为家人在 Mirobody 建档，先在设置页的 LongPi 里用你自己的 Mirobody 账号登录（邮箱和密码），不要只粘贴链接。' }
  }
  try {
    const url = new URL(saved.mcp_url)
    return { base: `${url.protocol}//${url.host}`, token: saved.mcp_token }
  } catch {
    return { error_zh: '你保存的 Mirobody 地址读不出来，请在设置页重新登录。' }
  }
}

async function post(base: string, path: string, token: string, body: unknown, fetchImpl: typeof fetch): Promise<{ code?: number; msg?: string; data?: Record<string, unknown> }> {
  const res = await fetchImpl(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({})) as { code?: number; msg?: string; data?: Record<string, unknown> }
  if (!res.ok || json.code !== 0) throw new Error(String(json.msg ?? `HTTP ${res.status}`).slice(0, 160))
  return json
}

export async function createManagedMember(auth: HolderAuth, input: { name: string; sex: 'male' | 'female'; birth_year: number | null }, fetchImpl: typeof fetch = fetch): Promise<string> {
  const json = await post(auth.base, '/user/virtual', auth.token, {
    name: input.name, gender: input.sex, ...(input.birth_year ? { birth: `${input.birth_year}-01-01` } : {}),
  }, fetchImpl)
  const id = String(json.data?.id ?? '')
  if (!/^\d+$/.test(id)) throw new Error('Mirobody 没有返回家人的编号')
  return id
}

export async function mintMemberLink(auth: HolderAuth, memberId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const json = await post(auth.base, '/personal/mcp', auth.token, { user_id: memberId }, fetchImpl)
  const url = String(json.data?.url ?? '')
  if (!/^https?:\/\//.test(url)) throw new Error('Mirobody 没有返回家人的链接')
  return url
}

/** Save the member's link in their own store, with no token (see the header). */
export function saveMemberLink(root: string, person: Person, url: string, now = new Date()): void {
  saveConnection(personDir(root, person.id), { mcp_url: url, mcp_token: '' }, now)
  updatePerson(root, person.id, { link_minted_at: now.toISOString() })
}

/** Renew a member's link when it is old or missing. Returns an error to show, or '' when the link is fine. */
export async function ensureMemberLink(root: string, person: Person, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<string> {
  if (!person.mirobody_user_id) return ''
  const minted = Date.parse(person.link_minted_at ?? '')
  const saved = readConnection(personDir(root, person.id))
  if (saved?.mcp_url && Number.isFinite(minted) && now.getTime() - minted < RENEW_AFTER_MS) return ''
  const auth = holderAuth(root)
  if ('error_zh' in auth) return `${person.label_zh}的链接需要续期：${auth.error_zh}`
  try {
    saveMemberLink(root, person, await mintMemberLink(auth, person.mirobody_user_id, fetchImpl), now)
    return ''
  } catch (error) {
    return `${person.label_zh}的链接续期失败：${error instanceof Error ? error.message : String(error)}。请在设置页重新登录你的 Mirobody 账号。`
  }
}
