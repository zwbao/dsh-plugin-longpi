// What only the browser can see for the prompt slot (docs/codex-design.md §2): how long DSH has been in
// continuous use (all workspaces together, shared across tabs), whether the person typed in the last 10 s,
// and how long an agent turn has been running. Nothing here leaves the browser.

const KEY = 'dsh-plugin-longpi.activity'
/** A pause this long counts as having got up. */
export const BREAK_MS = 5 * 60_000

interface Shared { since: number; last: number }

let state: Shared = { since: Date.now(), last: Date.now() }
let lastKey = 0
let turnSince: number | null = null
let installed = false

function readShared(): Shared | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Shared | null
    return raw && Number.isFinite(raw.since) && Number.isFinite(raw.last) ? raw : null
  } catch {
    return null
  }
}

function writeShared(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: this tab only */ }
}

/** One input event: a long enough pause before it starts a new sitting. Exported for tests. */
export function noteInput(now: number, prev: Shared): Shared {
  if (now - prev.last >= BREAK_MS) return { since: now, last: now }
  return { since: prev.since, last: now }
}

function onInput(event: Event): void {
  const now = Date.now()
  const shared = readShared()
  if (shared && shared.last > state.last) state = shared
  state = noteInput(now, state)
  if (event.type === 'keydown') lastKey = now
  writeShared()
}

let moveAt = 0
function onMove(event: Event): void {
  const now = Date.now()
  if (now - moveAt < 15_000) return
  moveAt = now
  onInput(event)
}

/** Listen once; returns a disposer. */
export function installActivity(): () => void {
  if (installed || typeof document === 'undefined') return () => {}
  installed = true
  const shared = readShared()
  if (shared && Date.now() - shared.last < BREAK_MS) state = shared
  document.addEventListener('keydown', onInput, true)
  document.addEventListener('pointerdown', onInput, true)
  document.addEventListener('pointermove', onMove, true)
  document.addEventListener('wheel', onMove, true)
  return () => {
    installed = false
    document.removeEventListener('keydown', onInput, true)
    document.removeEventListener('pointerdown', onInput, true)
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('wheel', onMove, true)
  }
}

/** Minutes of continuous use; 0 after a pause of 5 minutes or more. */
export function sittingMinutes(now: number = Date.now()): number {
  const shared = readShared()
  const row = shared && shared.last > state.last ? shared : state
  if (now - row.last >= BREAK_MS) return 0
  return (now - row.since) / 60_000
}

export function typedWithin(ms: number, now: number = Date.now()): boolean {
  return now - lastKey < ms
}

/** Feed whether some agent turn is running now; the time it started is kept. */
export function noteTurnRunning(running: boolean, now: number = Date.now()): void {
  if (running && turnSince == null) turnSince = now
  if (!running) turnSince = null
}

export function turnRunningMs(now: number = Date.now()): number {
  return turnSince == null ? 0 : now - turnSince
}

/** DOM fallback when the host's session hooks are absent: a stop button or a streaming node is on screen. */
export function turnBusy(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-streaming="true"], button[aria-label="停止"], button[aria-label="停止生成"], button[aria-label="Stop"]'))
}
