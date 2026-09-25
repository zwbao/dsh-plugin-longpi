// The fake Mirobody with failures on demand, for the read tests: an HTTP 500,
// a JSON-RPC error, an MCP result marked isError, a refusal table, a payload
// that is not a table, or a table Mirobody marked cut. `fail(name, args)`
// decides per tools/call; null answers normally. It wraps the same renderers
// as fake-mirobody.mjs, so a healthy answer is byte-identical to it.

import { createServer } from 'node:http'
import { loadRecord, queryIndicators, queryMedications } from './fake-mirobody.mjs'

/** A catalogue or readings payload re-rendered as cut: the meta line and the flag say so. */
export function markCut(payload, total) {
  const result = payload.result.replace(/\(([^()]*rows=\d+)(, of \d+)?\)\s*$/m, (_match, head) => `(${head}${total ? `, of ${total}` : ''}, truncated)`)
  return { ...payload, result, truncated: true }
}

export async function startFlakyMirobody(options = {}) {
  const record = options.record ?? loadRecord()
  const fail = options.fail ?? (() => null)
  const calls = []
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      res.setHeader('mcp-session-id', 'flaky-session')
      res.setHeader('content-type', 'application/json')
      if (body.method === 'initialize') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'flaky-mirobody', version: '1.5.0' } } }))
        return
      }
      if (body.method !== 'tools/call') {
        res.statusCode = 202
        res.end()
        return
      }
      const name = body.params?.name
      const args = body.params?.arguments ?? {}
      calls.push({ name, args, token: req.headers.authorization ?? '' })
      const healthy = () => name === 'query_medications' ? queryMedications(record, args) : queryIndicators(record, args)
      const how = fail(name, args)
      const send = (result) => res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } }))
      if (how === 'http500') {
        res.statusCode = 500
        res.setHeader('content-type', 'text/plain')
        res.end('internal server error')
      } else if (how === 'rpc') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32603, message: 'database timeout' } }))
      } else if (how === 'isError') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: 'query failed: database timeout' }], isError: true } }))
      } else if (how === 'refuse') {
        send({ result: 'error (internal): the lookup could not complete. Fix the arguments and try once more.', status: 'error', row_count: 0, truncated: false })
      } else if (how === 'text') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: 'service warming up' }] } }))
      } else if (how && typeof how === 'object' && how.cut) {
        send(markCut(healthy(), how.total))
      } else {
        send(healthy())
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return { url: `http://127.0.0.1:${port}/mcp`, calls, close: () => new Promise((resolve) => server.close(resolve)) }
}
