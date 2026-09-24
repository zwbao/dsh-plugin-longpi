// Mirobody answers MCP calls with a compact pipe table, not JSON rows
// (mirobody/agent/tools/_render.py, render_compact):
//
//   (constants: unit=mmol/L, system=loinc)   columns equal on every row, hoisted
//   indicator|time|value|code                 header of the columns that vary
//   hs-CRP|2026-08-26 08:30:00|1.5|30522-7    one line per row
//
//   (window=…, tz=…, rows=N[, of M][, truncated])
//   notes: …
//
// A table whose every column is constant has no header at all: the constants
// line is the one row. "(no rows)" is an empty answer and "error (kind): …" a
// refusal. Cells are never quoted, so a "|" inside a free-text cell spills into
// the next column; the overflow is folded back into the last column.

export interface CompactMeta {
  window: string
  tz: string
  resolution: string
  aggregate: string
  rows: number | null
  total: number | null
  truncated: boolean
}

export interface CompactTable {
  rows: Array<Record<string, string>>
  meta: CompactMeta
  notes: string[]
  error?: { kind: string; message: string }
}

const META_LINE = /^\((?:window|resolution|aggregate|rows)=/
const CONSTANTS = '(constants: '

function emptyMeta(): CompactMeta {
  return { window: '', tz: '', resolution: '', aggregate: '', rows: null, total: null, truncated: false }
}

/** Split "k=v, k=v" where a value may itself contain ", " — a pair only starts at ", name=". */
function parsePairs(body: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const starts: Array<{ at: number; key: string; value: number }> = []
  const pattern = /(?:^|, )([a-z_][a-z0-9_]*)=/g
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    starts.push({ at: match.index, key: match[1] ?? '', value: match.index + match[0].length })
  }
  for (let i = 0; i < starts.length; i += 1) {
    const here = starts[i]
    if (!here) continue
    const end = starts[i + 1]?.at ?? body.length
    pairs.push([here.key, body.slice(here.value, end)])
  }
  return pairs
}

function parseMeta(line: string): CompactMeta {
  const meta = emptyMeta()
  const inner = line.slice(1, line.endsWith(')') ? -1 : undefined)
  for (const part of inner.split(', ')) {
    const eq = part.indexOf('=')
    if (eq < 0) {
      if (part === 'truncated') meta.truncated = true
      const of = /^of (\d+)$/.exec(part)
      if (of) meta.total = Number(of[1])
      continue
    }
    const key = part.slice(0, eq)
    const value = part.slice(eq + 1)
    if (key === 'window') meta.window = value
    else if (key === 'tz') meta.tz = value
    else if (key === 'resolution') meta.resolution = value
    else if (key === 'aggregate') meta.aggregate = value
    else if (key === 'rows') meta.rows = Number(value)
  }
  return meta
}

export function parseCompact(text: string): CompactTable {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const first = (lines.find((line) => line.trim()) ?? '').trim()
  const refusal = /^error \(([a-z_]+)\): ?(.*)$/.exec(first)
  if (refusal) return { rows: [], meta: emptyMeta(), notes: [], error: { kind: refusal[1] ?? 'internal', message: refusal[2] ?? '' } }

  // The body ends at the blank line before the meta line; search from the end so a
  // row that happens to start with "(" is never taken for the meta line.
  let metaAt = -1
  for (let i = lines.length - 1; i > 0; i -= 1) {
    if (lines[i - 1] === '' && META_LINE.test(lines[i] ?? '')) {
      metaAt = i
      break
    }
  }
  const body = metaAt >= 0 ? lines.slice(0, metaAt - 1) : lines.filter((line) => line.trim())
  const meta = metaAt >= 0 ? parseMeta(lines[metaAt] ?? '') : emptyMeta()
  const notes = metaAt >= 0 ? lines.slice(metaAt + 1).filter((line) => line.trim()) : []

  let at = 0
  const constants: Record<string, string> = {}
  const head = body[0] ?? ''
  if (head.startsWith(CONSTANTS) && head.endsWith(')')) {
    for (const [key, value] of parsePairs(head.slice(CONSTANTS.length, -1))) constants[key] = value
    at = 1
  }
  const rest = body.slice(at).filter((line) => !line.startsWith('… cut at'))
  if (rest[0] === '(no rows)' || (rest.length === 0 && Object.keys(constants).length === 0)) {
    return { rows: [], meta, notes }
  }
  if (rest.length === 0) return { rows: [{ ...constants }], meta, notes }

  const header = (rest[0] ?? '').split('|')
  const rows: Array<Record<string, string>> = []
  for (const line of rest.slice(1)) {
    const cells = line.split('|')
    if (cells.length > header.length) {
      const keep = cells.slice(0, header.length - 1)
      keep.push(cells.slice(header.length - 1).join('|'))
      cells.splice(0, cells.length, ...keep)
    }
    const row: Record<string, string> = { ...constants }
    header.forEach((column, i) => { row[column] = cells[i] ?? '' })
    rows.push(row)
  }
  return { rows, meta, notes }
}

/**
 * The table inside one MCP tool payload. Mirobody wraps it as {result: "<table>",
 * status, row_count, truncated}; a transport may hand over the bare text. Returns
 * null when the payload is not a compact table (an older JSON shape).
 */
export function tableOf(payload: unknown): CompactTable | null {
  if (typeof payload === 'string') return looksCompact(payload) ? parseCompact(payload) : null
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const result = (payload as { result?: unknown }).result
  if (typeof result === 'string' && looksCompact(result)) return parseCompact(result)
  return null
}

function looksCompact(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  return trimmed.includes('|') || trimmed.startsWith(CONSTANTS) || trimmed.startsWith('(no rows)')
    || trimmed.startsWith('error (') || /\n\((?:window|rows)=/.test(trimmed)
}

/** A cell as a number, or null for an empty or non-numeric cell ("Positive", "<0.5"). */
export function cellNumber(value: string | undefined): number | null {
  if (value == null) return null
  const text = value.trim()
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(text)) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}
