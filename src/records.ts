import { createHash } from 'node:crypto'
import type { Config } from './config.ts'
import { discoverPython, runBridgeStatus, type BridgeStatus } from './bridge.ts'
import { callMcpTool, mcpHost, redact, type McpCallResult } from './mcp.ts'
import { readProfile, estimatedAge, type Profile } from './profile.ts'
import { rememberMedications } from './guardrails.ts'
import { summarizeIndicators, summarizeMedications, type IndicatorRow, type MedicationRow } from './situation.ts'
import { cellNumber, tableOf } from './compact.ts'
import { readSelf, selfIndicators, selfKeyOf, SELF_ALIASES, SELF_DEVICE_NAMES, SELF_KEYS, SELF_SPEC, SELF_SUFFIX, type SelfKey } from './selfmeasure.ts'
import { foldName, nameVariants } from './units.ts'

const MAX_INDICATORS = 400
/** Mirobody's own cap on catalogue names (its tool description: "200 catalogue names"). */
const MIROBODY_CATALOG_CAP = 200
const LATEST_CHUNK = 50
/** One conversation turn calls several tools that each need the record; read it once. */
const CACHE_TTL_MS = 60_000
/** A read that failed, in part or whole, is kept only long enough for one turn: the next one tries again. */
const FAILED_TTL_MS = 10_000
const SERIES_CHUNK = 12
/** Raw readings per indicator asked of Mirobody; a series that fills it was cut. */
const RAW_LIMIT = 500
const LOG_WINDOW_DAYS = 90

export interface RecordSnapshot {
  profile: Profile
  estimated_age: number | null
  engine: BridgeStatus
  mcp: { configured: boolean; host: string; token_set: boolean }
  indicators: IndicatorRow[]
  medications: MedicationRow[]
  /** partial: the record was read, but some reads failed or came back cut (read_errors says which). */
  record_status: 'unconfigured' | 'ok' | 'partial' | 'error'
  record_error: string
  /** Each read that failed or was cut, in Chinese; empty when every read succeeded. */
  read_errors: string[]
  /** Catalogue names whose latest value was not read because the read failed: unknown, never "not measured". */
  missing_reads: string[]
  /** The catalogue itself was cut, so an indicator missing from it may simply not have been read. */
  catalog_truncated: boolean
}

/** Whether the record was read, whole or in part: the reads that worked are used, the failed ones named. */
export function recordReadable(records: Pick<RecordSnapshot, 'record_status'>): boolean {
  return records.record_status === 'ok' || records.record_status === 'partial'
}

function memberArgs(member: string): Record<string, unknown> {
  const trimmed = member.trim()
  return trimmed ? { member: trimmed } : {}
}

function payloadOf(result: McpCallResult): unknown {
  if (result.success === false) return null
  return result.result ?? result.text ?? null
}

type Remote = Omit<RecordSnapshot, 'profile' | 'estimated_age'>

const cache = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>()

/**
 * The account a read is for, without the token itself: another token on the same address is another account.
 * connection.ts re-exports it as connectionKey.
 */
export function tokenKey(config: Pick<Config, 'mcpToken'>): string {
  const token = config.mcpToken.trim()
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 16) : ''
}

function cacheKey(config: Config, kind: string, extra = ''): string {
  return [kind, config.mcpUrl.trim(), tokenKey(config), config.member.trim(), config.mirobodyHome, config.pythonBin, extra].join('\u0000')
}

async function cached<T>(key: string, load: () => Promise<T>, failed: (value: T) => boolean = () => false): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < hit.ttl) return hit.value as Promise<T>
  const value = load()
  const entry = { at: now, ttl: CACHE_TTL_MS, value }
  cache.set(key, entry)
  value.then((result) => {
    if (failed(result)) entry.ttl = FAILED_TTL_MS
  }, () => {
    if (cache.get(key) === entry) cache.delete(key)
  })
  for (const [name, other] of cache) if (now - other.at >= other.ttl) cache.delete(name)
  return value
}

/** Forget cached record reads, after a change the next read must see. */
export function invalidateRecords(): void {
  cache.clear()
}

export async function loadRecords(config: Config, dataDir: string, pluginHome: string): Promise<RecordSnapshot> {
  const profile = readProfile(dataDir)
  const remote = await cached(cacheKey(config, 'records', pluginHome), () => loadRemote(config, pluginHome), (value) => value.record_status === 'error' || value.record_status === 'partial')
  return {
    profile,
    estimated_age: estimatedAge(profile.birthYear, new Date().getFullYear()),
    ...remote,
    indicators: mergeSelf(remote.indicators.map((row) => ({ ...row })), selfIndicators(readSelf(dataDir))),
    medications: remote.medications.map((row) => ({ ...row })),
    read_errors: [...remote.read_errors],
    missing_reads: [...remote.missing_reads],
  }
}

/**
 * Add the person's own measurements to the record rows. A self row joins only
 * when it is newer than every record row measuring the same thing (same LOINC,
 * the wearable's blood-pressure and weight rows, or a row named or labelled
 * like it: 腰围, waist, 体重…), so a newer checkup always wins. It goes last:
 * indicatorFor keeps the last row per LOINC code.
 */
export function mergeSelf(remote: IndicatorRow[], self: readonly IndicatorRow[]): IndicatorRow[] {
  const out = [...remote]
  for (const row of self) {
    const key = selfKeyOf(row.name) ?? SELF_KEYS.find((item) => SELF_SPEC[item].loinc === row.loinc)
    const same = remote.filter((other) => other.value && other.source !== 'self' && ((row.loinc && other.loinc === row.loinc) || (key ? sameMeasure(key, other) : false)))
    const newer = same.every((other) => (row.date ?? '') > (other.date || other.last_date || ''))
    if (newer) out.push(row)
  }
  return out
}

/** Whether a record row measures the same thing as a self key, by LOINC, device name, or report name. */
export function sameMeasure(key: SelfKey, row: Pick<IndicatorRow, 'name' | 'label' | 'loinc'>): boolean {
  if (row.loinc && SELF_ALIASES[key].loinc.includes(row.loinc)) return true
  if ((SELF_DEVICE_NAMES[key] ?? []).includes(row.name)) return true
  const names = new Set(SELF_ALIASES[key].names.map((name) => foldName(name)))
  return [row.name, row.label ?? ''].filter(Boolean).some((text) => nameVariants(text).some((variant) => names.has(variant)))
}

async function loadRemote(config: Config, pluginHome: string): Promise<Remote> {
  const python = discoverPython(config.pythonBin, pluginHome)
  const engine = runBridgeStatus(pluginHome, python, config.mirobodyHome, config.timeoutMs)
  const configured = Boolean(config.mcpUrl.trim())
  const snapshot: Remote = {
    engine,
    mcp: {
      configured,
      host: mcpHost(config.mcpUrl),
      token_set: Boolean(config.mcpToken.trim()),
    },
    indicators: [],
    medications: [],
    record_status: configured ? 'ok' : 'unconfigured',
    record_error: '',
    read_errors: [],
    missing_reads: [],
    catalog_truncated: false,
  }
  if (!configured) return snapshot

  const secrets = [config.mcpToken, config.mcpUrl]
  const catalogue = await callMcpTool({
    url: config.mcpUrl,
    token: config.mcpToken,
    name: 'query_health_indicators',
    args: memberArgs(config.member),
    timeoutMs: config.timeoutMs,
  })
  if (catalogue.success === false) {
    snapshot.record_status = 'error'
    snapshot.record_error = redact(catalogue.error || 'record read failed', secrets)
    return snapshot
  }
  const table = tableOf(payloadOf(catalogue))
  if (table?.error) {
    snapshot.record_status = 'error'
    snapshot.record_error = redact(`${table.error.kind}: ${table.error.message}`, secrets)
    return snapshot
  }
  const listed = summarizeIndicators(payloadOf(catalogue), MAX_INDICATORS + 1)
  snapshot.indicators = listed.slice(0, MAX_INDICATORS)
  // Mirobody cannot page its catalogue (no offset or cursor), so a cut catalogue is read as far as it goes and said so.
  const cut = catalogueCut(payloadOf(catalogue), table, listed.length)
  if (cut) {
    snapshot.catalog_truncated = true
    snapshot.read_errors.push(cut)
  }
  const names = snapshot.indicators.filter((item) => !item.value).map((item) => item.name).filter(Boolean)
  if (names.length > 0) {
    const filled = new Map<string, IndicatorRow>()
    const unread: string[] = []
    for (let start = 0; start < names.length; start += LATEST_CHUNK) {
      const chunk = names.slice(start, start + LATEST_CHUNK)
      const latest = await callMcpTool({
        url: config.mcpUrl,
        token: config.mcpToken,
        name: 'query_health_indicators',
        args: { ...memberArgs(config.member), indicators: chunk, aggregate: 'latest' },
        timeoutMs: config.timeoutMs,
      })
      const problem = latest.success === false ? latest.error || 'read failed' : batchProblem(payloadOf(latest))
      if (problem) {
        snapshot.read_errors.push(`${chunk.length} 项指标的最新值读取失败：${redact(problem, secrets)}`)
        unread.push(...chunk)
        // Mirobody is down or refuses this account: the other batches would fail the same way, each after a timeout.
        if (latest.success === false && (latest.error_kind === 'unavailable' || latest.error_kind === 'denied')) {
          unread.push(...names.slice(start + LATEST_CHUNK))
          if (start + LATEST_CHUNK < names.length) snapshot.read_errors.push(`其余 ${names.length - start - LATEST_CHUNK} 项没有再读。`)
          break
        }
        continue
      }
      const got = new Set<string>()
      for (const row of summarizeIndicators(payloadOf(latest), MAX_INDICATORS)) {
        got.add(row.name.toLowerCase())
        if (row.value) filled.set(row.name.toLowerCase(), row)
      }
      // A name the catalogue lists but the answer left out was not read either.
      const absent = chunk.filter((name) => !got.has(name.toLowerCase()))
      if (absent.length > 0) {
        snapshot.read_errors.push(`${absent.length} 项指标没有返回最新值。`)
        unread.push(...absent)
      }
    }
    if (filled.size > 0) {
      snapshot.indicators = snapshot.indicators.map((item) => {
        const hit = filled.get(item.name.toLowerCase())
        if (!hit) return item
        // A wearable series has no LOINC code: leave the key out rather than setting it to undefined.
        const merged = { ...item, ...hit, loinc: hit.loinc ?? item.loinc }
        if (!merged.loinc) delete merged.loinc
        return merged
      })
    }
    snapshot.missing_reads = [...new Set(unread)]
  }
  const meds = await callMcpTool({
    url: config.mcpUrl,
    token: config.mcpToken,
    name: 'query_medications',
    args: { ...memberArgs(config.member), view: 'plan' },
    timeoutMs: config.timeoutMs,
  })
  const medsProblem = meds.success === false ? meds.error || 'medication read failed' : tableOf(payloadOf(meds))?.error?.message ?? ''
  if (medsProblem) {
    snapshot.read_errors.push(`用药计划读取失败：${redact(medsProblem, secrets)}`)
  } else {
    snapshot.medications = summarizeMedications(payloadOf(meds))
    rememberMedications(snapshot.medications.map((item) => item.name))
  }
  if (snapshot.read_errors.length > 0) {
    snapshot.record_status = 'partial'
    snapshot.record_error = snapshot.read_errors.join('；').slice(0, 500)
  }
  return snapshot
}

/** Why a catalogue came back cut, or '' when it is whole: Mirobody's own marker, its cap, or ours. */
function catalogueCut(payload: unknown, table: ReturnType<typeof tableOf>, listed: number): string {
  const flagged = Boolean(payload && typeof payload === 'object' && (payload as { truncated?: unknown }).truncated === true)
  const rows = table?.meta.rows ?? table?.rows.length ?? listed
  const total = table?.meta.total ?? null
  if (table?.meta.truncated || flagged || (total != null && total > rows)) {
    return `指标目录被截断：Mirobody 只返回了 ${rows} 项${total != null ? `（共 ${total} 项）` : ''}，其余指标没有读到（目录不能分页）。`
  }
  // No "of N" to go by: a catalogue exactly at Mirobody's cap was most likely cut there.
  if (table && total == null && table.rows.length >= MIROBODY_CATALOG_CAP) {
    return `指标目录返回了 ${table.rows.length} 项，正好是 Mirobody 的上限，可能还有指标没有读到。`
  }
  if (listed > MAX_INDICATORS) return `指标目录超过 ${MAX_INDICATORS} 项，只读取了前 ${MAX_INDICATORS} 项。`
  return ''
}

/** Why a latest-value answer is not one, or '': a refusal, or a payload that is no indicator table. */
function batchProblem(payload: unknown): string {
  const table = tableOf(payload)
  if (table?.error) return `${table.error.kind}: ${table.error.message}`
  if (!table && summarizeIndicators(payload, 1).length === 0) return '返回的不是指标表'
  return ''
}

export interface SeriesPoint {
  date: string
  time: string
  value: number
  unit: string
  file?: string
}

export interface Series {
  indicator: string
  label?: string
  loinc?: string
  unit: string
  points: SeriesPoint[]
}

export interface SeriesResult {
  series: Record<string, Series>
  /** The first failure, redacted; set whenever any name was not read. */
  error?: string
  truncated: boolean
  /** Names whose read failed: their series is unknown, never empty. */
  failed: string[]
  /** Names whose readings came back cut (a series that filled the row limit, or a table Mirobody marked cut). */
  cut: string[]
}

/**
 * Dated values of named indicators, oldest first. resolution raw returns every
 * reading (labs); day returns one daily mean per indicator (wearables). Values
 * that are not numbers ("Positive", "<0.5") are left out, never guessed. A
 * batch that fails does not stop the others (unless Mirobody is down or refuses
 * the account); its names are listed in failed.
 */
export async function loadSeries(
  config: Config,
  names: readonly string[],
  options: { start: string; end: string; resolution: 'raw' | 'day' },
): Promise<SeriesResult> {
  // Self measurements live in dataDir; their names mean nothing to Mirobody.
  const wanted = [...new Set(names.map((name) => name.trim()).filter((name) => name && !name.endsWith(SELF_SUFFIX)))]
  if (wanted.length === 0) return { series: {}, truncated: false, failed: [], cut: [] }
  if (!config.mcpUrl.trim()) return { series: {}, truncated: false, error: 'mcpUrl is not set', failed: wanted, cut: [] }
  const key = cacheKey(config, 'series', JSON.stringify([wanted, options]))
  return cached(key, async () => {
    const out: SeriesResult = { series: {}, truncated: false, failed: [], cut: [] }
    const secrets = [config.mcpToken, config.mcpUrl]
    const fail = (chunk: string[], problem: string) => {
      out.error ??= redact(problem, secrets)
      out.failed.push(...chunk)
    }
    for (let start = 0; start < wanted.length; start += SERIES_CHUNK) {
      const chunk = wanted.slice(start, start + SERIES_CHUNK)
      const args: Record<string, unknown> = {
        ...memberArgs(config.member),
        indicators: chunk,
        start: options.start,
        end: options.end,
        resolution: options.resolution,
        aggregate: 'none',
      }
      if (options.resolution === 'raw') args.limit = RAW_LIMIT
      const call = await callMcpTool({ url: config.mcpUrl, token: config.mcpToken, name: 'query_health_indicators', args, timeoutMs: config.timeoutMs })
      if (call.success === false) {
        fail(chunk, call.error || 'series read failed')
        // Down or refused: the other batches would fail the same way, each after a timeout.
        if (call.error_kind === 'unavailable' || call.error_kind === 'denied') {
          out.failed.push(...wanted.slice(start + SERIES_CHUNK))
          break
        }
        continue
      }
      const payload = payloadOf(call)
      const table = tableOf(payload)
      if (!table) {
        fail(chunk, '返回的不是指标表')
        continue
      }
      if (table.error) {
        fail(chunk, `${table.error.kind}: ${table.error.message}`)
        continue
      }
      const counts = new Map<string, number>()
      for (const row of table.rows) {
        const indicator = (row.indicator ?? '').trim()
        if (!indicator) continue
        counts.set(indicator, (counts.get(indicator) ?? 0) + 1)
        const value = cellNumber(options.resolution === 'raw' ? row.value : row.avg)
        const date = options.resolution === 'raw' ? (row.date || (row.time ?? '').slice(0, 10)) : (row.period ?? '').slice(0, 10)
        if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        const series = out.series[indicator] ?? (out.series[indicator] = { indicator, unit: (row.unit ?? '').trim(), points: [] })
        if (row.name && row.name !== indicator && !series.label) series.label = row.name
        if ((row.system ?? '').toLowerCase() === 'loinc' && row.code && !series.loinc) series.loinc = row.code
        series.points.push({ date, time: row.time ?? date, value, unit: (row.unit ?? series.unit).trim(), ...(row.file ? { file: row.file } : {}) })
      }
      // Cut: a series that filled the row limit, or a table Mirobody marked cut (by its limit or its text cap)
      // with no series to pin it on.
      const full = options.resolution === 'raw' ? chunk.filter((name) => (counts.get(name) ?? 0) >= RAW_LIMIT) : []
      const marked = table.meta.truncated || (payload && typeof payload === 'object' && (payload as { truncated?: unknown }).truncated === true)
        || textOf(payload).includes('\n… cut at ')
      out.cut.push(...(full.length > 0 ? full : marked ? chunk : []))
    }
    out.failed = [...new Set(out.failed)]
    out.cut = [...new Set(out.cut)].filter((name) => !out.failed.includes(name))
    out.truncated = out.cut.length > 0
    for (const series of Object.values(out.series)) series.points.sort((a, b) => a.time.localeCompare(b.time))
    return out
  }, (value) => value.failed.length > 0)
}

function textOf(payload: unknown): string {
  if (typeof payload === 'string') return payload
  const result = payload && typeof payload === 'object' ? (payload as { result?: unknown }).result : undefined
  return typeof result === 'string' ? result : ''
}

export interface DoseRow {
  date: string
  medication: string
  status: string
  plan_id: string
}

export interface CourseRow {
  medication: string
  start: string
  end: string
  closed_by: string
  plan_id: string
}

function addDays(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

/** Doses recorded taken or skipped for one medication, read in windows under Mirobody's row cap. */
export async function loadDoseLog(config: Config, medication: string, start: string, end: string): Promise<{ rows: DoseRow[]; error?: string }> {
  if (!config.mcpUrl.trim()) return { rows: [], error: 'mcpUrl is not set' }
  return cached(cacheKey(config, 'doses', JSON.stringify([medication, start, end])), async () => {
    const rows: DoseRow[] = []
    let from = start
    while (from <= end) {
      const to = [addDays(from, LOG_WINDOW_DAYS - 1), end].sort()[0] ?? end
      const call = await callMcpTool({
        url: config.mcpUrl,
        token: config.mcpToken,
        name: 'query_medications',
        args: { ...memberArgs(config.member), view: 'log', keywords: [medication], start: from, end: to },
        timeoutMs: config.timeoutMs,
      })
      if (call.success === false) return { rows, error: redact(call.error || 'dose log read failed', [config.mcpToken, config.mcpUrl]) }
      const table = tableOf(payloadOf(call))
      if (table?.error) return { rows, error: `${table.error.kind}: ${table.error.message}` }
      for (const row of table?.rows ?? []) {
        if (!row.date || !row.medication) continue
        rows.push({ date: row.date, medication: row.medication, status: (row.status ?? '').trim(), plan_id: row.plan_id ?? '' })
      }
      from = addDays(to, 1)
    }
    return { rows }
  }, (value) => Boolean(value.error))
}

/** Medication courses with their start and end dates: the dates a change could confound a lab. */
export async function loadCourses(config: Config): Promise<{ rows: CourseRow[]; error?: string }> {
  if (!config.mcpUrl.trim()) return { rows: [], error: 'mcpUrl is not set' }
  return cached(cacheKey(config, 'courses'), async () => {
    const call = await callMcpTool({
      url: config.mcpUrl,
      token: config.mcpToken,
      name: 'query_medications',
      args: { ...memberArgs(config.member), view: 'history' },
      timeoutMs: config.timeoutMs,
    })
    if (call.success === false) return { rows: [], error: redact(call.error || 'course history read failed', [config.mcpToken, config.mcpUrl]) }
    const table = tableOf(payloadOf(call))
    if (table?.error) return { rows: [], error: `${table.error.kind}: ${table.error.message}` }
    return {
      rows: (table?.rows ?? []).filter((row) => row.medication).map((row) => ({
        medication: row.medication ?? '',
        start: row.start ?? '',
        end: row.end ?? '',
        closed_by: row.closed_by ?? '',
        plan_id: row.plan_id ?? '',
      })),
    }
  }, (value) => Boolean(value.error))
}
