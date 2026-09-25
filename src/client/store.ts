// One cache for every LongPi surface. The page, the home greeting, the row
// under the composer, the settings page, the chat cards and the reminder pill
// all read the same journey, so opening DSH costs one request, not four. Data
// is kept while it refreshes (the UI never blanks on a refetch), refreshed on
// window focus when older than a minute, every ten minutes while something
// shows it, and right after any save: a save supersedes any request already in
// flight, whose late answer is then dropped by its sequence number. The store
// also carries the few hand-offs between surfaces: a prompt waiting for the
// composer, the note about it, the page view (tab and section) to open, and
// DSH's openSection when onboarding has handed it over.

import React from 'react'
import { errorText, getJson } from './api.ts'
import { normalizeConnection, normalizeFollowup, normalizeIndicators, normalizeJourney, normalizePlanDraft } from './normalize.ts'
import type { Board, Connection, FollowupResponse, IndicatorsResponse, Journey, PlanDraftResponse, SelfRow, Tracking } from './types.ts'

export type Key = 'journey' | 'board' | 'tracking' | 'self' | 'planDraft' | 'followup' | 'indicators' | 'connection'
/** Where a waiting prompt came from: a pill on the home, or a button on the page. */
export type PromptOrigin = 'hero' | 'page'

const PATHS: Record<Key, string> = {
  journey: '/api/longpi/journey',
  board: '/api/longpi/board',
  tracking: '/api/longpi/tracking',
  self: '/api/longpi/self',
  planDraft: '/api/longpi/plan-draft',
  followup: '/api/longpi/followup',
  indicators: '/api/longpi/indicators',
  connection: '/api/longpi/connection',
}
/** Contract shapes are read through one normalizer each, so every surface can rely on them. */
const SHAPE: Partial<Record<Key, (raw: unknown) => unknown>> = {
  journey: normalizeJourney, planDraft: normalizePlanDraft, followup: normalizeFollowup, indicators: normalizeIndicators, connection: normalizeConnection,
}
/** Routes that accept ?refresh=1 (drop the server's record and tracking caches first). */
const REFRESHABLE: Key[] = ['journey', 'board']
const STALE_MS = 60_000
const POLL_MS = 10 * 60_000

interface Entry {
  data: unknown
  error: string | null
  loading: boolean
  at: number
  seq: number
  inflight: Promise<void> | null
  users: number
}

function blank(): Entry {
  return { data: null, error: null, loading: false, at: 0, seq: 0, inflight: null, users: 0 }
}

const entries: Record<Key, Entry> = {
  journey: blank(), board: blank(), tracking: blank(), self: blank(), planDraft: blank(), followup: blank(), indicators: blank(), connection: blank(),
}
const listeners = new Set<() => void>()
let version = 0
let timersOn = false
let pageUsers = 0
let bridges = 0
let heroUsers = 0
let pending: { text: string; at: number; origin: PromptOrigin } | null = null
let promptNote: { text: string; id: number } | null = null
let viewRequest: ViewRequest | null = null
let settingsOpener: ((id: string) => void) | null = null

export type PageTab = 'overview' | 'indicators' | 'plan' | 'profile'
export type IndicatorFilter = 'all' | 'changed' | 'plan' | 'device'

/** What another surface asks the page to show: a tab, a section in it, an indicator filter. */
export interface ViewRequest {
  tab?: PageTab
  id?: string
  filter?: IndicatorFilter
}

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * reuse: join a request in flight. fresh: always a new request; one in flight
 * is superseded and its answer dropped. refresh: fresh, and the server re-reads
 * Mirobody first (routes that accept ?refresh=1).
 */
type Mode = 'reuse' | 'fresh' | 'refresh'

function load(key: Key, mode: Mode = 'reuse'): Promise<void> {
  const entry = entries[key]
  if (entry.inflight && mode === 'reuse') return entry.inflight
  entry.seq += 1
  const seq = entry.seq
  entry.loading = true
  const path = mode === 'refresh' && REFRESHABLE.includes(key) ? `${PATHS[key]}?refresh=1` : PATHS[key]
  const run = getJson<unknown>(path)
    .then((raw) => {
      if (seq !== entry.seq) return
      entry.data = SHAPE[key] ? (SHAPE[key] as (raw: unknown) => unknown)(raw) : raw
      entry.error = null
      // Only an answer counts as fetched: a failed read keeps the old time, so an answer given since
      // (a check-in mark) still shows, and the next focus reads again.
      entry.at = Date.now()
    })
    .catch((error: unknown) => {
      if (seq !== entry.seq) return
      entry.error = errorText(error, '没有读到')
    })
    .finally(() => {
      if (seq !== entry.seq) return
      entry.loading = false
      entry.inflight = null
      emit()
    })
  entry.inflight = run
  emit()
  return run
}

function inUse(): Key[] {
  return (Object.keys(entries) as Key[]).filter((key) => entries[key].users > 0)
}

function stale(key: Key): boolean {
  return Date.now() - entries[key].at > STALE_MS
}

function startTimers(): void {
  if (timersOn || typeof window === 'undefined') return
  timersOn = true
  const revive = () => {
    if (document.visibilityState === 'hidden') return
    for (const key of inUse()) if (stale(key)) void load(key)
  }
  window.addEventListener('focus', revive)
  document.addEventListener('visibilitychange', revive)
  window.setInterval(() => { for (const key of inUse()) void load(key) }, POLL_MS)
}

/**
 * Reload what is on screen. With force the journey goes first with
 * ?refresh=1 so the server re-reads Mirobody once, then the rest follow.
 */
export async function refreshAll(force = false): Promise<void> {
  const keys = inUse()
  if (force) {
    await load('journey', 'refresh')
    await Promise.all(keys.filter((key) => key !== 'journey').map((key) => load(key, 'fresh')))
    return
  }
  await Promise.all(keys.map((key) => load(key)))
}

/**
 * Call after any save: every surface refetches what it shows, with a new
 * request. A request started before the save may answer with the state before
 * it, so it is superseded (its seq no longer matches) instead of joined.
 */
export function notifyChanged(): void {
  const shown = new Set(inUse())
  for (const key of Object.keys(entries) as Key[]) {
    const entry = entries[key]
    entry.at = 0
    if (shown.has(key)) continue
    if (entry.inflight) {
      // Nothing shows it now: drop the stale answer; the next surface to use it loads anew.
      entry.seq += 1
      entry.inflight = null
      entry.loading = false
    }
  }
  for (const key of shown) void load(key, 'fresh')
  emit()
}

interface Resource<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useResource<T>(key: Key): Resource<T> {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  React.useEffect(() => {
    const entry = entries[key]
    entry.users += 1
    startTimers()
    if ((entry.data == null && !entry.inflight) || stale(key)) void load(key)
    return () => { entry.users -= 1 }
  }, [key])
  const entry = entries[key]
  return { data: entry.data as T | null, loading: entry.loading || (entry.data == null && entry.error == null), error: entry.error }
}

export function useJourney(): { journey: Journey | null; loading: boolean; error: string | null; refresh: (force?: boolean) => Promise<void> } {
  const resource = useResource<Journey>('journey')
  const refresh = React.useCallback((force = false) => refreshAll(force), [])
  return { journey: resource.data, loading: resource.loading, error: resource.error, refresh }
}

export function useBoard(): Resource<Board> {
  return useResource<Board>('board')
}

export function useTracking(): Resource<Tracking> {
  return useResource<Tracking>('tracking')
}

export function useSelfRows(): Resource<{ rows: SelfRow[] }> {
  return useResource<{ rows: SelfRow[] }>('self')
}

export function usePlanDraft(): Resource<PlanDraftResponse> {
  return useResource<PlanDraftResponse>('planDraft')
}

export function useFollowup(): Resource<FollowupResponse> {
  return useResource<FollowupResponse>('followup')
}

export function useIndicators(): Resource<IndicatorsResponse> {
  return useResource<IndicatorsResponse>('indicators')
}

export function useConnection(): Resource<Connection> {
  return useResource<Connection>('connection')
}

/** The cached board, without asking for it: the chat cards only borrow skill names when it is there. */
export function useCachedBoard(): Board | null {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return entries.board.data as Board | null
}

/** Fetch one resource again now (a retry, or a test send that only adds a log row). */
export function reload(key: Key): Promise<void> {
  return load(key, 'fresh')
}

/** A connection route answered with the connection's new state: take it as is. */
export function putConnection(value: Connection): void {
  const entry = entries.connection
  entry.seq += 1
  entry.data = value
  entry.error = null
  entry.loading = false
  entry.inflight = null
  entry.at = Date.now()
  emit()
}

/** A route that answers a save with the resource's new state: take it as is, no second request. */
export function putFollowup(raw: unknown): void {
  const entry = entries.followup
  entry.seq += 1
  entry.data = normalizeFollowup(raw)
  entry.error = null
  entry.loading = false
  entry.inflight = null
  entry.at = Date.now()
  emit()
}

/**
 * The reminder pill hides while the LongPi page is on screen. On screen, not
 * mounted: a host that keeps a hidden panel mounted must not silence the pill.
 */
export function usePageShown(ref: React.RefObject<HTMLElement>): void {
  React.useEffect(() => {
    const node = ref.current
    let shown = false
    const set = (next: boolean) => {
      if (next === shown) return
      shown = next
      pageUsers += next ? 1 : -1
      emit()
    }
    if (!node || typeof IntersectionObserver === 'undefined') {
      set(true)
      return () => set(false)
    }
    const observer = new IntersectionObserver((seen) => set(seen.some((entry) => entry.isIntersecting)))
    observer.observe(node)
    return () => {
      observer.disconnect()
      set(false)
    }
  }, [ref])
}

/** The home greeting counts itself while mounted: its row already lists today's check-ins, so the pill stays away. */
export function useHeroShown(): void {
  React.useEffect(() => {
    heroUsers += 1
    emit()
    return () => {
      heroUsers -= 1
      emit()
    }
  }, [])
}

export function useHeroShowing(): boolean {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return heroUsers > 0
}

export function usePageShowing(): boolean {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return pageUsers > 0
}

/**
 * A prompt waiting for the composer. PromptBridge (in conversation.input.dock,
 * which DSH renders only while a session exists) takes it and inserts it.
 * While no session exists every prompt waits, a pill's or the page's, because
 * the note below the home row tells the person it will be put in once they
 * pick a workspace. Once a composer is there, a page prompt it did not take is
 * dropped after 30 s so a later chat is not surprised by it.
 */
const PAGE_PROMPT_MS = 30_000

function livePending(): typeof pending {
  if (pending && pending.origin === 'page' && bridges > 0 && Date.now() - pending.at > PAGE_PROMPT_MS) pending = null
  return pending
}

export function setPendingPrompt(text: string, origin: PromptOrigin = 'page'): void {
  pending = { text, at: Date.now(), origin }
  emit()
}

export function takePendingPrompt(): string | null {
  const current = livePending()
  pending = null
  return current ? current.text : null
}

export function hasPendingPrompt(): boolean {
  return livePending() != null
}

export function usePendingVersion(): number {
  return React.useSyncExternalStore(subscribe, () => version, () => version)
}

/** PromptBridge counts itself while mounted: that is how the home knows a session (and a composer to write into) exists. */
export function useBridgeMounted(): void {
  React.useEffect(() => {
    // A prompt that waited for a session gets its 30 s from when the first composer appears.
    if (bridges === 0 && pending) pending = { ...pending, at: Date.now() }
    bridges += 1
    emit()
    return () => {
      bridges -= 1
      emit()
    }
  }, [])
}

export function useComposerReady(): boolean {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return bridges > 0
}

/** The bridge renders nothing, so what it has to say (the clipboard fallback) shows under the home row. */
export function setPromptNote(text: string | null): void {
  if (!text && !promptNote) return
  promptNote = text ? { text, id: Date.now() } : null
  emit()
  if (!text) return
  const id = promptNote?.id
  window.setTimeout(() => {
    if (promptNote?.id !== id) return
    promptNote = null
    emit()
  }, 4000)
}

export function usePromptNote(): string | null {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return promptNote?.text ?? null
}

/** Open the page at a tab (and a section in it): the page switches and scrolls once it shows them. */
export function requestView(request: ViewRequest): void {
  viewRequest = { ...request }
  emit()
}

/** Open the page at a section of the tab it is on. */
export function requestScroll(id: string): void {
  requestView({ id })
}

export function useViewRequest(): ViewRequest | null {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return viewRequest
}

export function clearViewRequest(request: ViewRequest): void {
  if (viewRequest === request) viewRequest = null
}

/**
 * DSH hands openSection only to an onboarding step. The step keeps it here, so
 * the page and the chat can open settings later in the same visit; until it
 * has, they say where to find the setting instead.
 */
export function setSettingsOpener(open: ((id: string) => void) | null | undefined): void {
  if (!open || open === settingsOpener) return
  settingsOpener = open
  emit()
}

export function useSettingsOpener(): ((id: string) => void) | null {
  React.useSyncExternalStore(subscribe, () => version, () => version)
  return settingsOpener
}

/** Re-render on any store change (for state kept outside the resources, such as check-in marks). */
export function useStoreVersion(): number {
  return React.useSyncExternalStore(subscribe, () => version, () => version)
}

export function bumpStore(): void {
  emit()
}

/** When the journey on screen was fetched (0 before the first answer). */
export function journeyFetchedAt(): number {
  return entries.journey.at
}
