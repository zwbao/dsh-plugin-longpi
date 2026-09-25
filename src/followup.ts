// Follow-up the person opted into: a check-in reminder in the evening, a
// reminder on retest days, a weekly summary, and one gentle nudge when the
// first steps stall. DSH cannot push notifications, so the plugin process
// sends them itself, through a desktop notification or a webhook the person
// set up (Feishu, WeCom, DingTalk, Bark, or their own endpoint). With the
// default 'minimal' detail no health value or item name leaves the machine.
// Everything is local: settings and a send log in dataDir. Sends happen only
// while DeepSeek Harness runs; a missed one goes out at the next tick of the
// same day, never for a past day. Decisions are pure functions of the clock,
// the settings, the log and the journey, so tests inject all four; the
// desktop runner and fetch are injected too, so no test calls osascript or
// the network.

import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { addDays, daysBetween, isoDay } from './interventions.ts'

export const WEBHOOK_KINDS = ['feishu', 'wecom', 'dingtalk', 'bark', 'generic'] as const
export type WebhookKind = (typeof WEBHOOK_KINDS)[number]
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface FollowupSettings {
  enabled: boolean
  checkin_time: string
  retest_time: string
  weekly: { day: Weekday; time: string } | null
  desktop: boolean
  webhook: { kind: WebhookKind; url: string; secret: string } | null
  detail: 'minimal' | 'full'
  quiet: { start: string; end: string } | null
}

export interface PublicFollowup extends Omit<FollowupSettings, 'webhook'> {
  webhook: { kind: WebhookKind; url_masked: string; secret_set: boolean } | null
}

export type FollowupKind = 'checkin' | 'retest' | 'weekly' | 'nudge' | 'custom' | 'test'

export interface FollowupLogRow {
  at: string
  kind: FollowupKind
  key: string
  channels: { desktop?: boolean; webhook?: boolean }
  ok: boolean
  error?: string
}

export interface ChannelResult { ok: boolean; error?: string }
export interface SendResult { ok: boolean; channels: { desktop?: ChannelResult; webhook?: ChannelResult } }

/** What the decisions need from the journey and tracking (journey.ts builds it). */
export interface FollowupState {
  stage: string
  /** When the person accepted the notice (ISO), or null. */
  consent_at: string | null
  next_title_zh: string
  next_detail_zh: string
  plan_exists: boolean
  /** How many plan items are ticked by hand (check-in items), done or not. */
  checkin_items: number
  /** Titles of check-in items not done today. */
  checkin_open: string[]
  /** Retest dates from the plan's verdicts: date moves with today once due, first_due does not. */
  retests: Array<{ marker: string; date: string; first_due: string }>
  week: { pct: number | null; streak: number; next_retest: { marker: string; date: string } | null }
}

export interface FollowupDeps {
  platform: string
  /** Run a command without a shell; resolves, never rejects. */
  run: (command: string, args: string[], timeoutMs: number) => Promise<ChannelResult>
  fetch: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
}

export const DEFAULT_FOLLOWUP: FollowupSettings = {
  enabled: false,
  checkin_time: '21:00',
  retest_time: '09:00',
  weekly: { day: 7, time: '20:00' },
  desktop: true,
  webhook: null,
  detail: 'minimal',
  quiet: null,
}

/** At most this many sends per local day, across kinds, model-written and test ones included. */
export const FOLLOWUP_MAX_PER_DAY = 6
export const FOLLOWUP_TEST_TEXT = '这是一条 LongPi 测试提醒。'
const SETTINGS_FILE = 'followup.json'
const LOG_FILE = 'followup_log.jsonl'
const TICK_MS = 60_000
const SEND_TIMEOUT_MS = 10_000
/** The scheduler reuses one journey read this long while nothing changed, so a minute tick does not re-read the record. */
const STATE_REUSE_MS = 60 * 60_000
const NUDGE_AFTER_DAYS = 3
const NUDGE_EVERY_DAYS = 7
const NUDGE_STAGES = ['profile', 'records', 'first_result']
const SECRET_MAX = 200
const URL_MAX = 1000
const TIME = /^(\d{1,2}):(\d{2})$/
const KEYS = ['enabled', 'checkin_time', 'retest_time', 'weekly', 'desktop', 'detail', 'quiet', 'webhook']

// --- settings ------------------------------------------------------------------

function settingsPath(dataDir: string): string {
  return join(dataDir, SETTINGS_FILE)
}

function logPath(dataDir: string): string {
  return join(dataDir, LOG_FILE)
}

function timeOf(value: unknown): string | null {
  const match = typeof value === 'string' ? value.trim().match(TIME) : null
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function weekdayOf(value: unknown): Weekday | null {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 7 ? number as Weekday : null
}

const LAN_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)$/i

/** https for every kind; the generic kind may also be http to this machine or the local network. */
export function webhookUrlProblem(kind: WebhookKind, url: string): string {
  if (!url || url.length > URL_MAX) return 'webhook.url must be a URL of at most 1000 characters'
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'webhook.url is not a URL'
  }
  if (parsed.username || parsed.password) return 'webhook.url must not carry a user name or password'
  if (parsed.protocol === 'https:') return ''
  if (parsed.protocol === 'http:' && kind === 'generic' && LAN_HOST.test(parsed.hostname)) return ''
  return kind === 'generic' ? 'webhook.url must be https, or http to localhost or the local network' : 'webhook.url must be https'
}

/** The saved settings, with defaults for anything missing or unreadable. */
export function readFollowup(dataDir: string): FollowupSettings {
  const path = settingsPath(dataDir)
  if (!existsSync(path)) return structuredClone(DEFAULT_FOLLOWUP)
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const merged = applyUpdate(structuredClone(DEFAULT_FOLLOWUP), isRecord(raw) ? pick(raw) : {}, true)
    return merged.ok ? merged.settings : structuredClone(DEFAULT_FOLLOWUP)
  } catch {
    return structuredClone(DEFAULT_FOLLOWUP)
  }
}

function pick(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([key]) => KEYS.includes(key)))
}

/**
 * Apply a partial update. webhook: null removes the channel; url omitted keeps the stored url, secret
 * omitted keeps it and '' clears it. Stored files are read leniently (a bad field falls back); updates
 * are checked strictly.
 */
function applyUpdate(current: FollowupSettings, update: Record<string, unknown>, lenient = false): { ok: true; settings: FollowupSettings } | { ok: false; error: string } {
  const next: FollowupSettings = structuredClone(current)
  const fail = (error: string) => ({ ok: false as const, error })
  for (const key of Object.keys(update)) if (!KEYS.includes(key)) return fail(`unknown field ${key}`)
  for (const key of ['enabled', 'desktop'] as const) {
    if (!(key in update)) continue
    if (typeof update[key] !== 'boolean') { if (!lenient) return fail(`${key} must be true or false`); continue }
    next[key] = update[key] as boolean
  }
  for (const key of ['checkin_time', 'retest_time'] as const) {
    if (!(key in update)) continue
    const time = timeOf(update[key])
    if (!time) { if (!lenient) return fail(`${key} must be HH:MM`); continue }
    next[key] = time
  }
  if ('detail' in update) {
    if (update.detail === 'minimal' || update.detail === 'full') next.detail = update.detail
    else if (!lenient) return fail('detail must be minimal or full')
  }
  if ('weekly' in update) {
    const weekly = update.weekly
    if (weekly === null) next.weekly = null
    else if (isRecord(weekly)) {
      const day = 'day' in weekly ? weekdayOf(weekly.day) : (next.weekly?.day ?? DEFAULT_FOLLOWUP.weekly?.day ?? 7)
      const time = 'time' in weekly ? timeOf(weekly.time) : (next.weekly?.time ?? DEFAULT_FOLLOWUP.weekly?.time ?? '20:00')
      if (!day || !time) { if (!lenient) return fail('weekly must be {day: 1–7 (Monday = 1), time: HH:MM} or null') } else next.weekly = { day, time }
    } else if (!lenient) return fail('weekly must be {day, time} or null')
  }
  if ('quiet' in update) {
    const quiet = update.quiet
    if (quiet === null) next.quiet = null
    else if (isRecord(quiet) && timeOf(quiet.start) && timeOf(quiet.end) && timeOf(quiet.start) !== timeOf(quiet.end)) {
      next.quiet = { start: timeOf(quiet.start) as string, end: timeOf(quiet.end) as string }
    } else if (!lenient) return fail('quiet must be {start: HH:MM, end: HH:MM} (different times) or null')
  }
  if ('webhook' in update) {
    const hook = update.webhook
    if (hook === null) next.webhook = null
    else if (isRecord(hook)) {
      const kind = hook.kind
      if (!(WEBHOOK_KINDS as readonly string[]).includes(String(kind))) {
        if (!lenient) return fail(`webhook.kind must be one of ${WEBHOOK_KINDS.join(', ')}`)
      } else {
        const url = typeof hook.url === 'string' ? hook.url.trim() : (current.webhook?.url ?? '')
        if ('url' in hook && typeof hook.url !== 'string' && !lenient) return fail('webhook.url must be a string')
        let secret = current.webhook?.secret ?? ''
        if ('secret' in hook) {
          if (typeof hook.secret !== 'string') { if (!lenient) return fail('webhook.secret must be a string') } else secret = hook.secret.trim()
        }
        const problem = url ? webhookUrlProblem(kind as WebhookKind, url) : 'webhook.url is required'
        if (problem) { if (!lenient) return fail(problem) } else if (secret.length > SECRET_MAX) { if (!lenient) return fail(`webhook.secret is longer than ${SECRET_MAX} characters`) } else {
          next.webhook = { kind: kind as WebhookKind, url, secret }
        }
      }
    } else if (!lenient) return fail('webhook must be {kind, url, secret} or null')
  }
  return { ok: true, settings: next }
}

/** Check and save a partial update from the page or a tool. The file is private to the person (0600). */
export function writeFollowup(dataDir: string, update: unknown): { ok: true; settings: FollowupSettings } | { ok: false; error: string } {
  if (!isRecord(update)) return { ok: false, error: 'settings must be an object' }
  const result = applyUpdate(readFollowup(dataDir), update)
  if (!result.ok) return result
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  writeFileSync(settingsPath(dataDir), `${JSON.stringify(result.settings, null, 2)}\n`, { mode: 0o600 })
  // mode only applies when the file is created.
  chmodSync(settingsPath(dataDir), 0o600)
  return result
}

/** scheme://host/… only: the rest of a webhook URL is its secret token. */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}/…`
  } catch {
    return '…'
  }
}

/** Settings as the page and the model see them: never the full webhook URL or the secret. */
export function publicFollowup(settings: FollowupSettings): PublicFollowup {
  return {
    ...settings,
    weekly: settings.weekly ? { ...settings.weekly } : null,
    quiet: settings.quiet ? { ...settings.quiet } : null,
    webhook: settings.webhook ? { kind: settings.webhook.kind, url_masked: maskUrl(settings.webhook.url), secret_set: Boolean(settings.webhook.secret) } : null,
  }
}

// --- the log ------------------------------------------------------------------------

export function readFollowupLog(dataDir: string): FollowupLogRow[] {
  const path = logPath(dataDir)
  if (!existsSync(path)) return []
  const rows: FollowupLogRow[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line) as FollowupLogRow
      if (row && typeof row.at === 'string' && typeof row.key === 'string' && typeof row.kind === 'string') rows.push(row)
    } catch {
      /* skip a torn line */
    }
  }
  return rows
}

export function appendFollowupLog(dataDir: string, row: FollowupLogRow): void {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  appendFileSync(logPath(dataDir), `${JSON.stringify(row)}\n`, { mode: 0o600 })
}

/** Sends attempted on the local day of `now` (every kind counts, failed ones too). */
export function sentToday(log: readonly FollowupLogRow[], now: Date): number {
  const today = isoDay(now)
  return log.filter((row) => isoDay(new Date(row.at)) === today).length
}

// --- the clock ------------------------------------------------------------------------

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

function localMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes()
}

/** ISO weekday of a local time: Monday = 1 … Sunday = 7. */
export function isoWeekday(now: Date): Weekday {
  return (((now.getDay() + 6) % 7) + 1) as Weekday
}

/** ISO week of a local date, as 2026-W39. */
export function isoWeek(now: Date): string {
  const day = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  day.setUTCDate(day.getUTCDate() + 4 - (((day.getUTCDay() + 6) % 7) + 1))
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Inside quiet hours; a window whose start is after its end wraps midnight (22:30–08:00). */
export function inQuiet(quiet: FollowupSettings['quiet'], now: Date): boolean {
  if (!quiet) return false
  const minutes = localMinutes(now)
  const start = minutesOf(quiet.start)
  const end = minutesOf(quiet.end)
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

function localIso(day: string, time: string): string {
  return `${day}T${time}:00`
}

function sentKeys(log: readonly FollowupLogRow[]): Set<string> {
  // One send may cover several retests: its key joins theirs with '|'.
  return new Set(log.flatMap((row) => row.key.split('|')))
}

function retestKey(row: { marker: string; first_due: string }): string {
  return `retest:${row.marker}:${row.first_due}`
}

function monthDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)} 月 ${Number(day)} 日`
}

// --- decisions -----------------------------------------------------------------------

export interface FollowupSend { kind: FollowupKind; key: string; text: string }

/**
 * What is due at `now`. Keys: checkin:<date>, retest:<marker>:<first due date> (so an overdue retest is
 * reminded once, not every day), weekly:<ISO week>, nudge:<stage>:<date>. A kind is due at or after its
 * time on its day and only while not in the log, so a send missed while the host was off goes out at the
 * next tick of the same day and never for a past day. The nudge shares the check-in time. Quiet hours
 * hold everything; a time inside them is not sent that day.
 */
export function decideFollowup(input: { now: Date; settings: FollowupSettings; state: FollowupState; log: readonly FollowupLogRow[] }): FollowupSend[] {
  const { now, settings, state, log } = input
  if (!settings.enabled || inQuiet(settings.quiet, now)) return []
  const today = isoDay(now)
  const minutes = localMinutes(now)
  const sent = sentKeys(log)
  const full = settings.detail === 'full'
  const out: FollowupSend[] = []
  if (minutes >= minutesOf(settings.checkin_time) && state.checkin_open.length > 0 && !sent.has(`checkin:${today}`)) {
    const count = state.checkin_open.length
    out.push({
      kind: 'checkin',
      key: `checkin:${today}`,
      text: full ? `LongPi：今天还有 ${count} 项方案待打卡：${state.checkin_open.join('、')}。` : `LongPi：今天还有 ${count} 项方案待打卡。`,
    })
  }
  if (minutes >= minutesOf(settings.retest_time)) {
    const due = state.retests.filter((row) => row.date === today && !sent.has(retestKey(row)))
    if (due.length > 0) {
      out.push({
        kind: 'retest',
        key: due.map(retestKey).join('|'),
        text: full
          ? `LongPi：今天可以复测${due.map((row) => row.marker).join('、')}了。`
          : due.length === 1 ? 'LongPi：今天有一项复测到期。' : `LongPi：今天有 ${due.length} 项复测到期。`,
      })
    }
  }
  const weekly = settings.weekly
  if (weekly && state.plan_exists && isoWeekday(now) === weekly.day && minutes >= minutesOf(weekly.time) && !sent.has(`weekly:${isoWeek(now)}`)) {
    const next = state.week.next_retest
    out.push({
      kind: 'weekly',
      key: `weekly:${isoWeek(now)}`,
      text: full
        ? `LongPi：${state.week.pct == null ? '本周还没有执行记录' : `本周方案执行率 ${state.week.pct}%`}，连续 ${state.week.streak} 天；下次复测：${next ? `${next.marker} ${monthDay(next.date)}` : '暂无'}。`
        : 'LongPi 本周小结已更新，打开健康页查看。',
    })
  }
  const consentDay = state.consent_at ? isoDay(new Date(state.consent_at)) : null
  const recentNudge = log.some((row) => row.kind === 'nudge' && daysBetween(isoDay(new Date(row.at)), today) < NUDGE_EVERY_DAYS)
  if (NUDGE_STAGES.includes(state.stage) && consentDay && daysBetween(consentDay, today) >= NUDGE_AFTER_DAYS
    && minutes >= minutesOf(settings.checkin_time) && !recentNudge && state.next_title_zh) {
    out.push({
      kind: 'nudge',
      key: `nudge:${state.stage}:${today}`,
      text: full && state.next_detail_zh
        ? `LongPi：下一步「${state.next_title_zh}」：${state.next_detail_zh}`
        : `LongPi：下一步「${state.next_title_zh}」，打开健康页继续。`,
    })
  }
  return out
}

/** Whether anything could be due now, from the clock, the settings and the log alone: the journey is read only then. */
export function followupArmed(settings: FollowupSettings, log: readonly FollowupLogRow[], now: Date): boolean {
  if (!settings.enabled || inQuiet(settings.quiet, now)) return false
  if (sentToday(log, now) >= FOLLOWUP_MAX_PER_DAY) return false
  const minutes = localMinutes(now)
  const sent = sentKeys(log)
  const today = isoDay(now)
  if (minutes >= minutesOf(settings.retest_time)) return true
  if (minutes >= minutesOf(settings.checkin_time) && !sent.has(`checkin:${today}`)) return true
  if (minutes >= minutesOf(settings.checkin_time) && !log.some((row) => row.kind === 'nudge' && daysBetween(isoDay(new Date(row.at)), today) < NUDGE_EVERY_DAYS)) return true
  const weekly = settings.weekly
  return Boolean(weekly && isoWeekday(now) === weekly.day && minutes >= minutesOf(weekly.time) && !sent.has(`weekly:${isoWeek(now)}`))
}

/** The next time each kind is planned (local ISO, no zone), or null: none while follow-up is off. */
export function nextTimes(settings: FollowupSettings, state: FollowupState | null, now: Date, log: readonly FollowupLogRow[]): { checkin: string | null; retest: string | null; weekly: string | null } {
  if (!settings.enabled) return { checkin: null, retest: null, weekly: null }
  const today = isoDay(now)
  const minutes = localMinutes(now)
  const sent = sentKeys(log)
  let checkin: string | null = null
  if (state && state.checkin_items > 0) {
    const later = minutes < minutesOf(settings.checkin_time) && !sent.has(`checkin:${today}`)
    checkin = localIso(later ? today : addDays(today, 1), settings.checkin_time)
  }
  let retest: string | null = null
  for (const row of state?.retests ?? []) {
    if (sent.has(retestKey(row))) continue
    const day = row.date > today ? row.date : today
    if (day === today && minutes >= minutesOf(settings.retest_time)) continue
    const at = localIso(day, settings.retest_time)
    if (!retest || at < retest) retest = at
  }
  let weekly: string | null = null
  if (settings.weekly && state?.plan_exists) {
    const offset = (settings.weekly.day - isoWeekday(now) + 7) % 7
    const thisWeek = offset > 0 || (minutes < minutesOf(settings.weekly.time) && !sent.has(`weekly:${isoWeek(now)}`))
    weekly = localIso(addDays(today, thisWeek ? offset : offset + 7), settings.weekly.time)
  }
  return { checkin, retest, weekly }
}

// --- channels ------------------------------------------------------------------------

function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
}

/** The body under a 'LongPi' title: the message without its own LongPi prefix. */
function bodyOf(text: string): string {
  return clean(text).replace(/^LongPi\s*[：:]\s*/, '') || clean(text)
}

/** The notification command for this platform, run without a shell; null where there is none. */
export function desktopCommand(platform: string, text: string): { command: string; args: string[] } | null {
  const body = bodyOf(text)
  if (platform === 'darwin') {
    const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return { command: 'osascript', args: ['-e', `display notification "${escaped}" with title "LongPi"`] }
  }
  // '--' so a body that starts with '-' is never read as an option.
  if (platform === 'linux') return { command: 'notify-send', args: ['--', 'LongPi', body] }
  return null
}

export function desktopSupported(platform: string): boolean {
  return platform === 'darwin' || platform === 'linux'
}

/** The request a webhook channel sends: URL (DingTalk signs in the query) and JSON body (Feishu signs in the body). */
export function webhookRequest(webhook: NonNullable<FollowupSettings['webhook']>, text: string, kind: FollowupKind, now: Date): { url: string; body: Record<string, unknown> } {
  const message = clean(text)
  switch (webhook.kind) {
    case 'feishu': {
      const body: Record<string, unknown> = { msg_type: 'text', content: { text: message } }
      if (webhook.secret) {
        const timestamp = String(Math.floor(now.getTime() / 1000))
        body.timestamp = timestamp
        body.sign = createHmac('sha256', `${timestamp}\n${webhook.secret}`).update('').digest('base64')
      }
      return { url: webhook.url, body }
    }
    case 'wecom':
      return { url: webhook.url, body: { msgtype: 'text', text: { content: message } } }
    case 'dingtalk': {
      let url = webhook.url
      if (webhook.secret) {
        const timestamp = String(now.getTime())
        const sign = createHmac('sha256', webhook.secret).update(`${timestamp}\n${webhook.secret}`).digest('base64')
        url = `${url}${url.includes('?') ? '&' : '?'}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
      }
      return { url, body: { msgtype: 'text', text: { content: message } } }
    }
    case 'bark':
      return { url: webhook.url, body: { title: 'LongPi', body: bodyOf(message), group: 'LongPi' } }
    default:
      return { url: webhook.url, body: { title: 'LongPi', text: message, kind, sent_at: now.toISOString() } }
  }
}

/** Whether a webhook answer means delivered: HTTP 2xx, and the service's own code when it sends one. */
export function webhookAnswer(kind: WebhookKind, status: number, text: string): ChannelResult {
  if (status < 200 || status >= 300) return { ok: false, error: `HTTP ${status}` }
  let json: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(text) as unknown
    json = isRecord(parsed) ? parsed : null
  } catch {
    json = null
  }
  if (!json) return { ok: true }
  const message = String(json.msg ?? json.errmsg ?? json.message ?? '').slice(0, 200)
  if (kind === 'feishu') {
    const code = json.code ?? json.StatusCode
    return code == null || code === 0 ? { ok: true } : { ok: false, error: `飞书返回 ${String(code)}${message ? `：${message}` : ''}` }
  }
  if (kind === 'wecom' || kind === 'dingtalk') {
    return json.errcode == null || json.errcode === 0 ? { ok: true } : { ok: false, error: `返回 ${String(json.errcode)}${message ? `：${message}` : ''}` }
  }
  if (kind === 'bark') return json.code == null || json.code === 200 ? { ok: true } : { ok: false, error: `Bark 返回 ${String(json.code)}${message ? `：${message}` : ''}` }
  return { ok: true }
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<ChannelResult> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: ChannelResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, args, { stdio: 'ignore', shell: false })
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'spawn failed' })
      return
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ ok: false, error: 'timeout' })
    }, timeoutMs)
    child.on('error', (error) => finish({ ok: false, error: error.message.slice(0, 200) }))
    child.on('close', (code) => finish(code === 0 ? { ok: true } : { ok: false, error: `exit ${String(code)}` }))
  })
}

function defaultDeps(): FollowupDeps {
  return {
    platform: process.platform,
    run: runCommand,
    fetch: (url, init) => globalThis.fetch(url, init),
  }
}

let deps: FollowupDeps = defaultDeps()

/** Swap the platform, the command runner or fetch (tests); returns a function that restores the previous ones. */
export function setFollowupDeps(partial: Partial<FollowupDeps>): () => void {
  const previous = deps
  deps = { ...deps, ...partial }
  return () => {
    deps = previous
  }
}

export function followupDeps(): FollowupDeps {
  return deps
}

/** Send one message through every configured channel. Each has a 10 s limit; errors are recorded, never thrown. */
export async function sendFollowup(settings: FollowupSettings, message: string, options: { kind?: FollowupKind; now?: Date; deps?: FollowupDeps } = {}): Promise<SendResult> {
  const use = options.deps ?? deps
  const now = options.now ?? new Date()
  const channels: SendResult['channels'] = {}
  const command = settings.desktop ? desktopCommand(use.platform, message) : null
  if (command) {
    try {
      channels.desktop = await use.run(command.command, command.args, SEND_TIMEOUT_MS)
    } catch (error) {
      channels.desktop = { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'desktop failed' }
    }
  }
  if (settings.webhook) {
    const request = webhookRequest(settings.webhook, message, options.kind ?? 'custom', now)
    try {
      const response = await use.fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      })
      channels.webhook = webhookAnswer(settings.webhook.kind, response.status, await response.text().catch(() => ''))
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      const text = error instanceof Error ? error.message : 'webhook failed'
      // The URL is the webhook's secret; never let it into a log line.
      channels.webhook = { ok: false, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : text.split(settings.webhook.url).join('…').slice(0, 200) }
    }
  }
  const results = Object.values(channels)
  return { ok: results.length > 0 && results.every((row) => row.ok), channels }
}

function logRow(kind: FollowupKind, key: string, result: SendResult, now: Date): FollowupLogRow {
  const errors = Object.entries(result.channels).filter(([, row]) => !row.ok).map(([name, row]) => `${name}: ${row.error ?? 'failed'}`)
  return {
    at: now.toISOString(),
    kind,
    key,
    channels: Object.fromEntries(Object.entries(result.channels).map(([name, row]) => [name, row.ok])),
    ok: result.ok,
    ...(Object.keys(result.channels).length === 0 ? { error: 'no channel: turn on desktop notifications or add a webhook' } : errors.length > 0 ? { error: errors.join('; ') } : {}),
  }
}

/**
 * Send a message outside the schedule (the model's own follow-up, or the page's test): never
 * deduplicated against the scheduled kinds (key custom:<time> or test:<time>), but counted in the
 * daily limit and logged.
 */
export async function sendNow(dataDir: string, text: string, kind: FollowupKind, now: Date = new Date()): Promise<SendResult & { error?: string }> {
  const settings = readFollowup(dataDir)
  if (sentToday(readFollowupLog(dataDir), now) >= FOLLOWUP_MAX_PER_DAY) {
    return { ok: false, channels: {}, error: `今天已经发送了 ${FOLLOWUP_MAX_PER_DAY} 条提醒，达到上限，明天再试。` }
  }
  const result = await sendFollowup(settings, text, { kind, now })
  const row = logRow(kind, `${kind}:${now.toISOString()}`, result, now)
  appendFollowupLog(dataDir, row)
  return { ...result, ...(row.error ? { error: row.error } : {}) }
}

// --- the scheduler ------------------------------------------------------------------

/** One tick: read the settings and the log, and only if something may be due, the journey; then send and log. */
export async function followupTick(input: { dataDir: string; now: Date; getState: () => Promise<FollowupState>; deps?: FollowupDeps }): Promise<FollowupLogRow[]> {
  const settings = readFollowup(input.dataDir)
  const log = readFollowupLog(input.dataDir)
  if (!followupArmed(settings, log, input.now)) return []
  const state = await input.getState()
  const rows: FollowupLogRow[] = []
  for (const send of decideFollowup({ now: input.now, settings, state, log })) {
    if (sentToday([...log, ...rows], input.now) >= FOLLOWUP_MAX_PER_DAY) break
    const result = await sendFollowup(settings, send.text, { kind: send.kind, now: input.now, ...(input.deps ? { deps: input.deps } : {}) })
    const row = logRow(send.kind, send.key, result, input.now)
    appendFollowupLog(input.dataDir, row)
    rows.push(row)
  }
  return rows
}

export interface FollowupContext {
  dataDir: string
  getState: () => Promise<FollowupState>
  /** Changes whenever something the state is built from changed (trackingGeneration); a change forces a fresh read. */
  generation?: () => number
}

/**
 * Tick every 60 s in the host's local time zone, as a Cordis effect: the interval is cleared when the
 * plugin is disposed, is unref'd so it never keeps the process alive, and never overlaps itself. One
 * journey read is reused the same day for up to an hour, and never after a check-in, a plan or profile
 * save or a self measurement (the generation changes), so a reminder never counts items already ticked.
 */
export function startFollowup(ctx: Context, getContext: () => FollowupContext, options: { tickMs?: number; now?: () => Date } = {}): void {
  ctx.effect(() => {
    let running = false
    let cache: { at: number; day: string; generation: number; state: FollowupState } | null = null
    const timer = setInterval(() => {
      if (running) return
      running = true
      const now = options.now?.() ?? new Date()
      const context = getContext()
      const getState = async () => {
        const generation = context.generation?.() ?? 0
        if (cache && cache.day === isoDay(now) && cache.generation === generation && now.getTime() - cache.at < STATE_REUSE_MS) return cache.state
        const state = await context.getState()
        cache = { at: now.getTime(), day: isoDay(now), generation, state }
        return state
      }
      void followupTick({ dataDir: context.dataDir, now, getState })
        .catch(() => undefined)
        .finally(() => {
          running = false
        })
    }, options.tickMs ?? TICK_MS)
    timer.unref?.()
    return () => clearInterval(timer)
  }, 'longpi:followup')
}

/** The GET /api/longpi/followup answer (also the POST one, after ok: true). */
export function followupResponse(dataDir: string, state: FollowupState | null, now: Date = new Date()) {
  const settings = readFollowup(dataDir)
  const log = readFollowupLog(dataDir)
  return {
    settings: publicFollowup(settings),
    next: nextTimes(settings, state, now, log),
    log: log.slice(-20).reverse().map((row) => ({ at: row.at, kind: row.kind, key: row.key, ok: row.ok, channels: row.channels, ...(row.error ? { error: row.error } : {}) })),
    platform_desktop: desktopSupported(deps.platform),
  }
}

/** journey.followup: whether it is on, the channels it uses, and the next planned send. */
export function followupSummary(dataDir: string, state: FollowupState | null, now: Date = new Date()): { enabled: boolean; channels: Array<'desktop' | 'webhook'>; next_at: string | null } {
  const settings = readFollowup(dataDir)
  if (!settings.enabled) return { enabled: false, channels: [], next_at: null }
  const channels: Array<'desktop' | 'webhook'> = []
  if (settings.desktop && desktopSupported(deps.platform)) channels.push('desktop')
  if (settings.webhook) channels.push('webhook')
  const next = nextTimes(settings, state, now, readFollowupLog(dataDir))
  const times = [next.checkin, next.retest, next.weekly].filter((time): time is string => Boolean(time)).sort()
  return { enabled: true, channels, next_at: times[0] ?? null }
}
