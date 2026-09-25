// The plugin's routes live on the DSH web server; when DSH runs with an
// access token in the page URL every request must carry it too.

export function api(path: string): string {
  const token = new URLSearchParams(window.location.search).get('token')
  if (!token) return path
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

async function read<T>(res: Response): Promise<T> {
  let json: (T & { error?: string; problems?: string[] }) | null = null
  try {
    json = await res.json() as T & { error?: string; problems?: string[] }
  } catch {
    json = null
  }
  if (!res.ok || json == null) {
    const problems = (json?.problems ?? []).join(' ')
    throw new Error(problems || json?.error || `HTTP ${res.status}`)
  }
  return json
}

export async function getJson<T>(path: string): Promise<T> {
  return read<T>(await fetch(api(path), { credentials: 'include' }))
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return read<T>(await fetch(api(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

export async function deleteJson<T>(path: string): Promise<T> {
  return read<T>(await fetch(api(path), { method: 'DELETE', credentials: 'include' }))
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
