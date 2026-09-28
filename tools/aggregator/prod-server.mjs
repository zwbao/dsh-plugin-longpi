// Launch the production aggregator skeleton from a config file.
// The example config refuses to listen: TLS materials and the offline root are not in git.
// node --experimental-transform-types tools/aggregator/prod-server.mjs --config=path

import { readFileSync } from 'node:fs'
import { createPrivateKey } from 'node:crypto'
import { createProdAggregator } from '../../src/science/prod-aggregator.ts'

const configPath = process.argv.find((arg) => arg.startsWith('--config='))?.slice('--config='.length)
if (!configPath) {
  console.error('usage: node --experimental-transform-types tools/aggregator/prod-server.mjs --config=tools/aggregator/config.example.json')
  process.exit(2)
}
const config = JSON.parse(readFileSync(configPath, 'utf8'))
if (config.accept_dev_key === true || String(config.root_public_b64 ?? '').startsWith('REPLACE') || !config.feed_private_pem) {
  console.error(config.icp_note_zh || 'aggregator is not ready')
  process.exit(2)
}
const feedPrivateKey = createPrivateKey(readFileSync(config.feed_private_pem))
if (config.tls?.cert_path) config.tls.cert_pem = readFileSync(config.tls.cert_path)
if (config.tls?.key_path) config.tls.key_pem = readFileSync(config.tls.key_path)
const app = createProdAggregator({ config, feedPrivateKey })
const url = await app.listen(config.port)
console.log(`longpi aggregator skeleton on ${url} (live stays off)`)
