import type { Config } from './config.ts'
import { discoverPython, runBridgeStatus, type BridgeStatus } from './bridge.ts'
import { callMcpTool, mcpHost, redact, type McpCallResult } from './mcp.ts'
import { readProfile, estimatedAge, type Profile } from './profile.ts'
import { rememberMedications } from './guardrails.ts'
import { summarizeIndicators, summarizeMedications, type IndicatorRow, type MedicationRow } from './situation.ts'
import { cellNumber, tableOf } from './compact.ts'

const MAX_INDICATORS = 400
const LATEST_CHUNK = 50
/** One conversation turn calls several tools that each need the record; read it once. */
const CACHE_TTL_MS = 60_000
const SERIES_CHUNK = 12
const LOG_WINDOW_DAYS = 90

export interface RecordSnapshot {
  profile: Profile
  estimated_age: number | null
  engine: BridgeStatus
  mcp: { configured: boolean; host: string; token_set: boolean }
  indicators: IndicatorRow[]
  medications: MedicationRow[]
  record_status: 'unconfigured' | 'ok' | 'error'
  record_error: string
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

const cache = new Map<string, { at: number; value: Promise<unknown> }>()

function cacheKey(config: Config, kind: string, extra = ''): string {
  return [kind, config.mcpUrl.trim(), config.member.trim(), config.mirobodyHome, config.pythonBin, extra].join('\u0000')
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value as Promise<T>
  const value = load()
  cache.set(key, { at: now, value })
  value.catch(() => cache.delete(key))
  for (const [name, entry] of cache) if (now - entry.at >= CACHE_TTL_MS) cache.delete(name)
  return value
}

/** Forget cached record reads, after a change the next read must see. */
export function invalidateRecords(): void {
  cache.clear()
}

export async function loadRecords(config: Config, dataDir: string, pluginHome: string): Promise<RecordSnapshot> {
  const profile = readProfile(dataDir)
  const remote = await cached(cacheKey(config, 'records', pluginHome), () => loadRemote(config, pluginHome))
  return {
    profile,
    estimated_age: estimatedAge(profile.birthYear, new Date().getFullYear()),
    ...remote,
    indicators: remote.indicators.map((row) => ({ ...row })),
    medications: remote.medications.map((row) => ({ ...row })),
  }
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
  const refused = tableOf(payloadOf(catalogue))?.error
  if (refused) {
    snapshot.record_status = 'error'
    snapshot.record_error = redact(`${refused.kind}: ${refused.message}`, secrets)
    return snapshot
  }
  snapshot.indicators = summarizeIndicators(payloadOf(catalogue), MAX_INDICATORS)
  const names = snapshot.indicators.filter((item) => !item.value).map((item) => item.name).filter(Boolean)
  if (names.length > 0) {
    const filled = new Map<string, IndicatorRow>()
    for (let start = 0; start < names.length; start += LATEST_CHUNK) {
      const latest = await callMcpTool({
        url: config.mcpUrl,
        token: config.mcpToken,
        name: 'query_health_indicators',
        args: { ...memberArgs(config.member), indicators: names.slice(start, start + LATEST_CHUNK), aggregate: 'latest' },
        timeoutMs: config.timeoutMs,
      })
      if (latest.success === false) break
      for (const row of summarizeIndicators(payloadOf(latest), MAX_INDICATORS)) {
        if (row.value) filled.set(row.name.toLowerCase(), row)
      }
    }
    if (filled.size > 0) {
      snapshot.indicators = snapshot.indicators.map((item) => {
        const hit = filled.get(item.name.toLowerCase())
        return hit ? { ...item, ...hit, loinc: hit.loinc ?? item.loinc } : item
      })
    }
  }
  const meds = await callMcpTool({
    url: config.mcpUrl,
    token: config.mcpToken,
    name: 'query_medications',
    args: { ...memberArgs(config.member), view: 'plan' },
    timeoutMs: config.timeoutMs,
  })
  if (meds.success === false) {
    snapshot.record_error = redact(meds.error || 'medication read failed', secrets)
  } else {
    snapshot.medications = summarizeMedications(payloadOf(meds))
    rememberMedications(snapshot.medications.map((item) => item.name))
  }
  return snapshot
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
  error?: string
  truncated: boolean
}

/**
 * Dated values of named indicators, oldest first. resolution raw returns every
 * reading (labs); day returns one daily mean per indicator (wearables). Values
 * that are not numbers ("Positive", "<0.5") are left out, never guessed.
 */
export async function loadSeries(
  config: Config,
  names: readonly string[],
  options: { start: string; end: string; resolution: 'raw' | 'day' },
): Promise<SeriesResult> {
  const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (wanted.length === 0 || !config.mcpUrl.trim()) return { series: {}, truncated: false, ...(config.mcpUrl.trim() ? {} : { error: 'mcpUrl is not set' }) }
  const key = cacheKey(config, 'series', JSON.stringify([wanted, options]))
  return cached(key, async () => {
    const out: SeriesResult = { series: {}, truncated: false }
    const secrets = [config.mcpToken, config.mcpUrl]
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
      if (options.resolution === 'raw') args.limit = 500
      const call = await callMcpTool({ url: config.mcpUrl, token: config.mcpToken, name: 'query_health_indicators', args, timeoutMs: config.timeoutMs })
      if (call.success === false) {
        out.error = redact(call.error || 'series read failed', secrets)
        break
      }
      const table = tableOf(payloadOf(call))
      if (!table) continue
      if (table.error) {
        out.error = redact(`${table.error.kind}: ${table.error.message}`, secrets)
        continue
      }
      if (table.meta.truncated) out.truncated = true
      for (const row of table.rows) {
        const indicator = (row.indicator ?? '').trim()
        if (!indicator) continue
        const value = cellNumber(options.resolution === 'raw' ? row.value : row.avg)
        const date = options.resolution === 'raw' ? (row.date || (row.time ?? '').slice(0, 10)) : (row.period ?? '').slice(0, 10)
        if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        const series = out.series[indicator] ?? (out.series[indicator] = { indicator, unit: (row.unit ?? '').trim(), points: [] })
        if (row.name && row.name !== indicator && !series.label) series.label = row.name
        if ((row.system ?? '').toLowerCase() === 'loinc' && row.code && !series.loinc) series.loinc = row.code
        series.points.push({ date, time: row.time ?? date, value, unit: (row.unit ?? series.unit).trim(), ...(row.file ? { file: row.file } : {}) })
      }
    }
    for (const series of Object.values(out.series)) series.points.sort((a, b) => a.time.localeCompare(b.time))
    return out
  })
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
  })
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
  })
}
