import type { Config } from './config.ts'
import { discoverPython, runBridgeStatus, type BridgeStatus } from './bridge.ts'
import { callMcpTool, mcpHost, redact, type McpCallResult } from './mcp.ts'
import { readProfile, estimatedAge, type Profile } from './profile.ts'
import { rememberMedications } from './guardrails.ts'
import { summarizeIndicators, summarizeMedications, type IndicatorRow, type MedicationRow } from './situation.ts'

const MAX_INDICATORS = 400
const LATEST_CHUNK = 50

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

export async function loadRecords(config: Config, dataDir: string, pluginHome: string): Promise<RecordSnapshot> {
  const profile = readProfile(dataDir)
  const python = discoverPython(config.pythonBin, pluginHome)
  const engine = runBridgeStatus(pluginHome, python, config.mirobodyHome, config.timeoutMs)
  const configured = Boolean(config.mcpUrl.trim())
  const snapshot: RecordSnapshot = {
    profile,
    estimated_age: estimatedAge(profile.birthYear, new Date().getFullYear()),
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
      snapshot.indicators = snapshot.indicators.map((item) => filled.get(item.name.toLowerCase()) ?? item)
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
