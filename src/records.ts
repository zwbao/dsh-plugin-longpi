import type { Config } from './config.ts'
import { discoverPython, runBridgeStatus, type BridgeStatus } from './bridge.ts'
import { callMcpTool, mcpHost, redact, type McpCallResult } from './mcp.ts'
import { readProfile, estimatedAge, type Profile } from './profile.ts'
import { summarizeIndicators, summarizeMedications, type IndicatorRow, type MedicationRow } from './situation.ts'

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
  snapshot.indicators = summarizeIndicators(payloadOf(catalogue))
  const names = snapshot.indicators.map((item) => item.name).filter(Boolean).slice(0, 12)
  if (names.length > 0 && snapshot.indicators.every((item) => !item.value)) {
    const latest = await callMcpTool({
      url: config.mcpUrl,
      token: config.mcpToken,
      name: 'query_health_indicators',
      args: { ...memberArgs(config.member), indicators: names, aggregate: 'latest' },
      timeoutMs: config.timeoutMs,
    })
    if (latest.success !== false) {
      const rows = summarizeIndicators(payloadOf(latest))
      if (rows.some((item) => item.value)) snapshot.indicators = rows
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
  }
  return snapshot
}
