import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { CUSTOMER, DEFAULT_ITINERARY, INSIGHTS, METRICS } from './fixture.ts'
import { listDemoGenome } from './s2f/annotate.ts'
import { buildOmicsReport, PRODUCT_VERSION } from './s2f/report.ts'
import { getGenomeStore } from './s2f/store.ts'
import { getStore } from './store.ts'
import type { Config } from './config.ts'

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(text)
}

export function registerRoutes(ctx: Context, config: () => Config): void {
  ctx.inject(['webServer'], (scoped) => {
    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/dashboard',
      handler: (_req: IncomingMessage, res: ServerResponse) => {
        sendJson(res, 200, {
          version: PRODUCT_VERSION,
          demo: true,
          banner: config().demoBanner,
          brandName: config().brandName,
          customer: CUSTOMER,
          metrics: METRICS,
          insights: INSIGHTS,
          genome: listDemoGenome(),
          vcf: getGenomeStore().ingest
            ? { n_kept: getGenomeStore().ingest!.n_kept, source: getGenomeStore().source_label }
            : null,
          itinerary: { date: config().itineraryDate, items: DEFAULT_ITINERARY },
          appointments: getStore().appointments,
          handoffs: getStore().handoffs,
        })
      },
    })
    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/report',
      handler: (_req, res) => sendJson(res, 200, buildOmicsReport()),
    })
    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/version',
      handler: (_req, res) => sendJson(res, 200, { product: 'dsh-plugin-longpi', version: PRODUCT_VERSION }),
    })
  })
}
