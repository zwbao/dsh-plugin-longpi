// One archive of the local LongPi store, without secrets, plus a pointer to the person's Mirobody.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { readConnection } from '../connection.ts'
import { disclosureCopy } from './disclosure.ts'

const SKIP_DIR = new Set(['exports'])
const MAX_FILE = 8_000_000
const MAX_TOTAL = 30_000_000

export interface MirobodyLink {
  url: string
  note_zh: string
}

/** The Mirobody the person connected. LongPi does not download their record; this is where they export it. */
export function mirobodyExportLink(dataDir: string, fallbackUrl = ''): MirobodyLink {
  const saved = readConnection(dataDir)
  const raw = (saved?.mcp_url || fallbackUrl || '').trim()
  let url = ''
  if (raw) {
    try {
      const parsed = new URL(raw)
      url = `${parsed.protocol}//${parsed.host}/`
    } catch {
      url = raw
    }
  }
  const note_zh = url
    ? `体检和手环记录不在这个压缩包里，它们在你自己的 Mirobody。打开 ${url} 导出或删除那份记录。`
    : '还没有连接 Mirobody。体检记录不在 LongPi 的压缩包里；连接之后，在 Mirobody 网页导出。'
  return { url, note_zh }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const crc = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(file.data.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    parts.push(local, name, file.data)
    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(20, 4)
    cen.writeUInt16LE(20, 6)
    cen.writeUInt16LE(0x0800, 8)
    cen.writeUInt32LE(crc, 16)
    cen.writeUInt32LE(file.data.length, 20)
    cen.writeUInt32LE(file.data.length, 24)
    cen.writeUInt16LE(name.length, 28)
    cen.writeUInt32LE(offset, 42)
    central.push(cen, name)
    offset += local.length + name.length + file.data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, end])
}

function skip(name: string): boolean {
  if (!name || name.includes('..')) return true
  if (name.endsWith('.tmp') || name.includes('.tmp-') || name.includes('.damaged-')) return true
  const base = name.split('/').pop() ?? name
  if (SKIP_DIR.has(base) && !name.includes('/')) return true
  if (name === 'privacy/exports' || name.startsWith('privacy/exports/')) return true
  return false
}

function walk(root: string, dir: string, out: string[]): void {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    const rel = relative(root, path).split(sep).join('/')
    if (skip(rel)) continue
    let st
    try {
      st = statSync(path)
    } catch {
      continue
    }
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) {
      if (entry === 'exports' && rel === 'privacy/exports') continue
      walk(root, path, out)
    } else if (st.isFile()) out.push(rel)
  }
}

function scrub(data: Buffer, secrets: string[]): Buffer {
  let text: string | null = null
  try {
    text = data.toString('utf8')
  } catch {
    return data
  }
  if (text.includes('\u0000')) return data
  let next = text
  for (const secret of secrets) {
    if (secret.length >= 6) next = next.split(secret).join('[redacted]')
  }
  return next === text ? data : Buffer.from(next, 'utf8')
}

/** Zip of dataDir. Tokens are removed. The person's name stays: this archive is for them. */
export function buildExport(dataDir: string, fallbackMcpUrl = ''): { zip: Buffer; filename: string; link: MirobodyLink; files: string[] } {
  const link = mirobodyExportLink(dataDir, fallbackMcpUrl)
  const saved = readConnection(dataDir)
  const secrets = [saved?.mcp_token ?? ''].filter((value) => value.length >= 6)
  const names: string[] = []
  walk(dataDir, dataDir, names)
  const files: Array<{ name: string; data: Buffer }> = []
  let total = 0
  const included: string[] = []
  for (const name of names) {
    if (total >= MAX_TOTAL) break
    const path = join(dataDir, ...name.split('/'))
    let data: Buffer
    try {
      if (statSync(path).size > MAX_FILE) continue
      data = readFileSync(path)
    } catch {
      continue
    }
    if (name === 'connection.json') {
      try {
        const parsed = JSON.parse(data.toString('utf8')) as Record<string, unknown>
        if (typeof parsed.mcp_token === 'string') parsed.mcp_token = ''
        data = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
      } catch {
        data = Buffer.from('{}\n', 'utf8')
      }
    } else data = scrub(data, secrets)
    if (total + data.length > MAX_TOTAL) continue
    files.push({ name, data })
    included.push(name)
    total += data.length
  }
  const copy = disclosureCopy()
  const note = [
    'LongPi 本地档案',
    '',
    '这个压缩包是这台电脑上 ~/.dsh/longpi 的副本，已去掉连接用的令牌。',
    link.note_zh,
    '',
    copy.data_flow.name,
    copy.data_flow.session_log,
    '',
    `文件 ${included.length} 个。`,
  ].join('\n')
  files.push({ name: '说明.txt', data: Buffer.from(note, 'utf8') })
  const day = new Date().toISOString().slice(0, 10)
  return { zip: zipStore(files), filename: `longpi-${day}.zip`, link, files: [...included, '说明.txt'] }
}
