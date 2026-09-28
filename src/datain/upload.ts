// A checkup file dropped in chat, or chosen on the page, goes to Mirobody's upload socket
// (the same frames as reports/ingest.py upload_pdf). Narrative sentences are kept here.
// A WeGene narrative PDF is not sent: it is summarised locally. A raw WeGene export is sent as text/plain.

import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { CoreDeps } from '../contracts/index.ts'
import { readConnection } from '../connection.ts'
import { appendJsonl, newId, readJsonl } from '../core/store.ts'
import { judgeIdentity } from './identity.ts'
import { extractGeneticsPdf, extractGeneticsText, isWeGeneNarrative, isWeGeneRaw, RAW_MARKER, storeGenetics, type GeneticsSummary } from './genetics.ts'
import { listFindings, parseNarrative, storeFindings, textFingerprint, type NarrativeFinding } from './narrative.ts'

const LAB_CAP_BYTES = 32 * 1024 * 1024
const PAGE_CAP = 40
const CHUNK = 256 * 1024

export interface IngestResult {
  ok: boolean
  forwarded: boolean
  duplicate: boolean
  wrong_person: boolean
  checkup_day: string | null
  indicators: number | null
  findings: Array<Pick<NarrativeFinding, 'id' | 'kind' | 'text_zh' | 'date' | 'grade'>>
  read_back_zh: string
  progress: string[]
  genetics_stored: boolean
  error?: string
}

interface UploadLog {
  id: string
  at: string
  filename: string
  sha256: string
  fingerprint: string
  bytes: number
  checkup_day: string | null
  forwarded: boolean
  duplicate_of?: string
  wrong_person?: boolean
}

function logPath(dataDir: string): string {
  return join(dataDir, 'datain', 'uploads.jsonl')
}

function readLog(dataDir: string): UploadLog[] {
  return readJsonl(logPath(dataDir), (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Partial<UploadLog>
    if (typeof row.id !== 'string') return null
    return row as UploadLog
  })
}

function publicFinding(row: NarrativeFinding): IngestResult['findings'][number] {
  return { id: row.id, kind: row.kind, text_zh: row.text_zh, date: row.date, ...(row.grade ? { grade: row.grade } : {}) }
}

export function contentTypeOf(filename: string): string {
  const ext = extname(filename).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.txt' || ext === '.csv') return 'text/plain'
  return 'application/octet-stream'
}

export function pdfPageCount(path: string): number | null {
  const run = spawnSync('pdfinfo', [path], { encoding: 'utf8', timeout: 15_000 })
  const match = /Pages:\s+(\d+)/.exec(run.stdout || '')
  return match ? Number(match[1]) : null
}

export function pdfText(path: string, lastPage = PAGE_CAP): string {
  const run = spawnSync('pdftotext', ['-f', '1', '-l', String(lastPage), '-layout', path, '-'], { encoding: 'utf8', timeout: 20_000, maxBuffer: 4_000_000 })
  return run.status === 0 ? run.stdout : ''
}

interface SocketLike {
  send(data: string): void
  close(): void
}

export interface SocketHandlers {
  onopen: () => void
  onmessage: (data: string) => void
  onerror: (error: unknown) => void
}

export type SocketOpener = (url: string, handlers: SocketHandlers) => SocketLike

function browserSocket(url: string, handlers: SocketHandlers): SocketLike {
  const ws = new WebSocket(url)
  ws.addEventListener('open', () => handlers.onopen())
  ws.addEventListener('message', (event) => handlers.onmessage(typeof event.data === 'string' ? event.data : ''))
  ws.addEventListener('error', () => handlers.onerror(new Error('websocket failed')))
  return { send: (data) => ws.send(data), close: () => ws.close() }
}

export interface MirobodyPush {
  events: string[]
  progress: string[]
  last: Record<string, unknown>
  indicators: number | null
  checkup_day: string | null
  failed: boolean
}

/** The upload socket Mirobody's file router speaks. `open` is injectable for tests. */
export async function pushToMirobody(opts: {
  origin: string
  token: string
  filename: string
  bytes: Buffer
  contentType: string
  note?: string
  deadlineMs?: number
  open?: SocketOpener
}): Promise<MirobodyPush> {
  const messageId = randomUUID()
  const sessionId = randomUUID()
  const total = Math.max(1, Math.ceil(opts.bytes.length / CHUNK))
  const progress: string[] = []
  const events: string[] = []
  const url = `${opts.origin.replace(/^http/, 'ws')}/ws/upload-health-report?token=${encodeURIComponent(opts.token)}`
  const deadline = opts.deadlineMs ?? 90_000
  const opener = opts.open ?? browserSocket
  return new Promise((resolve) => {
    let sock: SocketLike | null = null
    let settled = false
    const finish = (last: Record<string, unknown>, failed: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(ping)
      try { sock?.close() } catch { /* already closed */ }
      const report = typeof last.report_date === 'string' ? last.report_date.slice(0, 10) : null
      const count = typeof last.indicators_count === 'number' ? last.indicators_count : null
      resolve({
        events, progress, last, failed,
        indicators: count,
        checkup_day: report && /^\d{4}-\d{2}-\d{2}$/.test(report) ? report : null,
      })
    }
    const timer = setTimeout(() => finish({ type: 'timeout' }, false), deadline)
    const ping = setInterval(() => {
      try { sock?.send(JSON.stringify({ type: 'ping', messageId })) } catch { /* closed */ }
    }, 10_000)
    sock = opener(url, {
      onopen: () => {
        progress.push('开始上传')
        sock?.send(JSON.stringify({
          type: 'upload_start',
          messageId,
          sessionId,
          query: opts.note || 'LongPi checkup upload',
          isFirstMessage: false,
          files: [{ filename: opts.filename, contentType: opts.contentType, size: opts.bytes.length }],
        }))
        for (let index = 0; index < total; index += 1) {
          const piece = opts.bytes.subarray(index * CHUNK, (index + 1) * CHUNK)
          sock?.send(JSON.stringify({
            type: 'upload_chunk',
            messageId,
            filename: opts.filename,
            chunk: piece.toString('base64'),
            chunkIndex: index,
            totalChunks: total,
            contentType: opts.contentType,
            fileSize: opts.bytes.length,
          }))
          progress.push(`已上传 ${index + 1}/${total}`)
        }
        progress.push('文件已送出，等待解析')
      },
      onmessage: (data) => {
        let msg: Record<string, unknown> = {}
        try { msg = JSON.parse(data) as Record<string, unknown> } catch { return }
        const type = typeof msg.type === 'string' ? msg.type : ''
        if (type) events.push(type)
        if (type === 'file_progress' && typeof msg.progress === 'number') progress.push(`上传 ${Math.round(msg.progress)}%`)
        if (type === 'extraction_completed' || type === 'upload_error' || type === 'error' || type === 'close') {
          finish(msg, type === 'upload_error' || type === 'error')
        }
      },
      onerror: () => finish({ type: 'upload_error', message: '连不上 Mirobody 的上传通道' }, true),
    })
  })
}

function originOf(mcpUrl: string): string | null {
  try {
    const url = new URL(mcpUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function readBack(parts: { forwarded: boolean; connected: boolean; indicators: number | null; day: string | null; findings: NarrativeFinding[]; duplicate: boolean; wrong: string; genetics: 'narrative' | 'raw' | null }): string {
  if (parts.wrong) return parts.wrong
  if (parts.duplicate) return `这份和已经保存的一份相同${parts.day ? `（${parts.day}）` : ''}，没有重复写入。`
  const lines: string[] = []
  if (parts.genetics === 'raw' && parts.forwarded) lines.push('微基因原始数据已交给 Mirobody。位点以它保存的为准；叙述版 PDF 不必再传。')
  else if (parts.genetics) lines.push('基因叙述报告没有整本送进体检解析。关键位点记在这台电脑上，并附了消费级报告的限制。要把位点交给 Mirobody，请用微基因原始数据导出。')
  else if (!parts.connected) lines.push('报告里的叙述已经记下。还没有连上 Mirobody，文件本身没有送出。')
  else if (parts.forwarded) lines.push(`已交给 Mirobody。${parts.indicators != null ? `解析到 ${parts.indicators} 项` : '解析结果还没返回'}${parts.day ? `，日期 ${parts.day}` : ''}。`)
  else lines.push('文件没有送出。')
  const narrative = parts.findings.filter((row) => row.kind !== 'wrong_person').slice(0, 4).map((row) => row.text_zh)
  if (narrative.length > 0) lines.push(`报告里写着：${narrative.join(' ')}`)
  return lines.join('')
}

export interface IngestInput {
  filename: string
  bytes?: Buffer
  text?: string
  path?: string
  note?: string
  /** When false, keep the narrative locally and do not open the upload socket (pasted text). */
  upload?: boolean
  /** Tests inject a socket. Production uses the platform WebSocket. */
  open?: SocketOpener
}

export async function ingestDocument(deps: Pick<CoreDeps, 'config' | 'dataDir' | 'bus' | 'invalidate'>, input: IngestInput): Promise<IngestResult> {
  const dataDir = deps.dataDir()
  const filename = input.filename || 'report'
  let bytes = input.bytes
  let text = input.text ?? ''
  const filePath = input.path
  if (filePath && !bytes) {
    const stat = statSync(filePath)
    const pages = extname(filePath).toLowerCase() === '.pdf' ? pdfPageCount(filePath) : null
    const huge = stat.size > LAB_CAP_BYTES || (pages != null && pages > 80)
    if (huge && extname(filePath).toLowerCase() === '.pdf') {
      const summary = extractGeneticsPdf(filePath)
      const stored = storeGenetics(dataDir, summary)
      const finding = storeFindings(dataDir, [{
        id: newId('find'), date: stored.generated, kind: 'genetics',
        text_zh: stored.headlines_zh[0] || '已记下基因报告的限制和原始数据导出步骤。',
      }])
      return {
        ok: true, forwarded: false, duplicate: false, wrong_person: false,
        checkup_day: stored.generated || null, indicators: null,
        findings: finding.map(publicFinding),
        read_back_zh: readBack({ forwarded: false, connected: false, indicators: null, day: stored.generated || null, findings: finding, duplicate: false, wrong: '', genetics: 'narrative' }),
        progress: [`只读了 ${stored.pages_read} 页目录附近的文字，没有整本上传`],
        genetics_stored: true,
      }
    }
    bytes = readFileSync(filePath)
    if (!text && extname(filePath).toLowerCase() === '.pdf') text = pdfText(filePath)
    if (!text && contentTypeOf(filePath) === 'text/plain') text = bytes.toString('utf8')
  }
  bytes = bytes ?? Buffer.from(text, 'utf8')
  if (!text && contentTypeOf(filename) === 'text/plain') text = bytes.toString('utf8')
  const sha = createHash('sha256').update(bytes).digest('hex')
  const fingerprint = textFingerprint(text)
  const prior = readLog(dataDir).find((row) => (sha && row.sha256 === sha) || (fingerprint && row.fingerprint === fingerprint))
  if (prior) {
    const existing = listFindings(dataDir).filter((row) => row.upload_id === prior.id)
    return {
      ok: true, forwarded: false, duplicate: true, wrong_person: false,
      checkup_day: prior.checkup_day, indicators: null,
      findings: existing.map(publicFinding),
      read_back_zh: readBack({ forwarded: false, connected: true, indicators: null, day: prior.checkup_day, findings: existing, duplicate: true, wrong: '', genetics: null }),
      progress: ['这是重复的一份'],
      genetics_stored: false,
    }
  }
  if (isWeGeneRaw(text)) {
    const summary = extractGeneticsText(text, 'raw')
    return finishForward(deps, { filename, bytes, text, sha, fingerprint, contentType: 'text/plain', note: input.note, open: input.open, upload: input.upload !== false, genetics: summary, findings: [] })
  }
  if (isWeGeneNarrative(text)) {
    const summary = storeGenetics(dataDir, extractGeneticsText(text, 'text'))
    const uploadId = newId('up')
    const finding = storeFindings(dataDir, [{ id: newId('find'), date: summary.generated, kind: 'genetics', text_zh: summary.headlines_zh[0] || '已记下基因报告。' }], uploadId)
    appendJsonl(logPath(dataDir), { id: uploadId, at: new Date().toISOString(), filename, sha256: sha, fingerprint, bytes: bytes.length, checkup_day: summary.generated || null, forwarded: false } satisfies UploadLog)
    return {
      ok: true, forwarded: false, duplicate: false, wrong_person: false, checkup_day: summary.generated || null, indicators: null,
      findings: finding.map(publicFinding),
      read_back_zh: readBack({ forwarded: false, connected: false, indicators: null, day: summary.generated || null, findings: finding, duplicate: false, wrong: '', genetics: 'narrative' }),
      progress: ['叙述版基因报告没有整本上传'], genetics_stored: true,
    }
  }
  const identity = text ? judgeIdentity(text, dataDir) : { wrong_person: false, reason_zh: '', page_note_zh: '', names: [] }
  if (identity.wrong_person) {
    const row = storeFindings(dataDir, [{
      id: newId('find'), date: '', kind: 'wrong_person', text_zh: identity.reason_zh, page_note_zh: identity.page_note_zh,
    }])
    appendJsonl(logPath(dataDir), { id: newId('up'), at: new Date().toISOString(), filename, sha256: sha, fingerprint, bytes: bytes.length, checkup_day: null, forwarded: false, wrong_person: true } satisfies UploadLog)
    return {
      ok: true, forwarded: false, duplicate: false, wrong_person: true, checkup_day: null, indicators: null,
      findings: row.map((item) => ({ id: item.id, kind: item.kind, text_zh: item.text_zh, date: item.date })),
      read_back_zh: identity.reason_zh, progress: ['核对姓名后没有写入'], genetics_stored: false,
    }
  }
  const dayGuess = /(20\d{2}-\d{2}-\d{2})/.exec(text)?.[1] ?? ''
  const findings = text ? parseNarrative(text, dayGuess) : []
  return finishForward(deps, { filename, bytes, text, sha, fingerprint, contentType: contentTypeOf(filename), note: input.note, open: input.open, upload: input.upload !== false, genetics: null, findings })
}

async function finishForward(deps: Pick<CoreDeps, 'config' | 'dataDir' | 'bus' | 'invalidate'>, input: {
  filename: string
  bytes: Buffer
  text: string
  sha: string
  fingerprint: string
  contentType: string
  note?: string
  open?: SocketOpener
  upload: boolean
  genetics: GeneticsSummary | null
  findings: NarrativeFinding[]
}): Promise<IngestResult> {
  const dataDir = deps.dataDir()
  const config = deps.config()
  const saved = readConnection(dataDir)
  const mcpUrl = saved?.mcp_url || config.mcpUrl
  const token = saved?.mcp_token || config.mcpToken
  const origin = mcpUrl ? originOf(mcpUrl) : null
  const connected = Boolean(origin && token)
  let push: MirobodyPush | null = null
  if (input.upload && connected && origin && token && input.bytes.length > 0 && input.bytes.length <= LAB_CAP_BYTES) {
    push = await pushToMirobody({
      origin, token, filename: input.filename, bytes: input.bytes, contentType: input.contentType,
      note: 'LongPi checkup upload', open: input.open,
    })
  }
  const day = push?.checkup_day || /(20\d{2}-\d{2}-\d{2})/.exec(input.text)?.[1] || null
  const uploadId = newId('up')
  const stored = storeFindings(dataDir, input.findings.map((row) => ({ ...row, date: row.date || day || '' })), uploadId)
  if (input.genetics) storeGenetics(dataDir, input.genetics)
  appendJsonl(logPath(dataDir), {
    id: uploadId, at: new Date().toISOString(), filename: input.filename, sha256: input.sha, fingerprint: input.fingerprint,
    bytes: input.bytes.length, checkup_day: day, forwarded: Boolean(push && !push.failed),
  } satisfies UploadLog)
  if (push && !push.failed) {
    try { deps.invalidate() } catch { /* the file is already in Mirobody */ }
  }
  if (stored.length > 0 || (push && !push.failed)) {
    try {
      deps.bus.emit('report.arrived', {
        checkup_day: day || new Date().toISOString().slice(0, 10),
        indicators: push?.indicators ?? 0,
        narrative_findings: stored.length,
        source: 'upload',
      }, { module: 'M7', via: 'tool' })
    } catch { /* the upload still stands */ }
  }
  const shown = stored.length > 0 ? stored : input.findings
  return {
    ok: push ? !push.failed : true,
    forwarded: Boolean(push && !push.failed),
    duplicate: false,
    wrong_person: false,
    checkup_day: day,
    indicators: push?.indicators ?? null,
    findings: shown.map(publicFinding),
    read_back_zh: readBack({
      forwarded: Boolean(push && !push.failed), connected, indicators: push?.indicators ?? null, day,
      findings: shown, duplicate: false, wrong: '', genetics: input.genetics ? (input.genetics.source === 'raw' ? 'raw' : 'narrative') : null,
    }),
    progress: push?.progress ?? (connected ? [] : ['未连接 Mirobody']),
    genetics_stored: Boolean(input.genetics),
    ...(push?.failed ? { error: 'Mirobody 没有收下这份文件。' } : {}),
  }
}

export { RAW_MARKER }
