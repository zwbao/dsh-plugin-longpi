// The plugin's routes live on the DSH web server, same origin as the page:
// DSH's own login cookie authenticates every request, so nothing is added to
// the URL. Writes send JSON (the server refuses any other content type).

async function read<T>(res: Response): Promise<T> {
  let json: (T & { error?: string; problems?: string[] }) | null = null
  try {
    json = await res.json() as T & { error?: string; problems?: string[] }
  } catch {
    json = null
  }
  if (!res.ok || json == null) {
    const problems = (json?.problems ?? []).join(' ')
    throw new Error(problems || json?.error || httpText(res.status))
  }
  return json
}

/** The status in words for the few a person can act on; the number otherwise. */
function httpText(status: number): string {
  if (status === 401) return '需要重新登录 DeepSeek Harness（HTTP 401）'
  if (status === 403) return 'DeepSeek Harness 拒绝了这个请求（HTTP 403）'
  if (status === 503) return 'LongPi 还没有准备好，稍后再试（HTTP 503）'
  return `HTTP ${status}`
}

const JSON_HEADERS = { 'content-type': 'application/json' }

export async function getJson<T>(path: string): Promise<T> {
  return read<T>(await fetch(path, { credentials: 'same-origin' }))
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return read<T>(await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  }))
}

/** DELETE carries the JSON content type too (no body): the server's write check applies to every method. */
export async function deleteJson<T>(path: string): Promise<T> {
  return read<T>(await fetch(path, { method: 'DELETE', credentials: 'same-origin', headers: JSON_HEADERS }))
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
