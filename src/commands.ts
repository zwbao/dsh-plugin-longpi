import type { Context } from '@deepseek-ai/cordis'
import { CUSTOMER, INSIGHTS } from './fixture.ts'
import { exportReportMarkdown, buildOmicsReport, PRODUCT_VERSION } from './s2f/report.ts'
import { getStore } from './store.ts'

interface CommandsLike {
  register(definition: {
    name: string
    description: string
    handler: (invocation: { rawInput: string }) => { kind: 'success' | 'error'; text?: string }
  }): unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    commands: CommandsLike
  }
}

export function registerCommands(ctx: Context): void {
  ctx.inject(['commands'], (scoped) => {
    scoped.commands.register({
      name: 'longpi',
      description: '打印 LongPi 演示 Dashboard 摘要（综合生物年龄 / 洞察 / 预约）。',
      handler: () => {
        const store = getStore()
        const lines = [
          `演示客户 ${CUSTOMER.display_name}`,
          `综合生物年龄 ${CUSTOMER.composite_age}（实际 ${CUSTOMER.chrono_age}）`,
          ...Object.entries(CUSTOMER.modules).map(([k, v]) => `  ${v.label_zh} ${v.age}`),
          `洞察：${INSIGHTS.map((i) => i.title_zh).join('；')}`,
          `预约意向 ${store.appointments.length} · 转接 ${store.handoffs.length}`,
          CUSTOMER.disclaimer_zh,
        ]
        return { kind: 'success', text: lines.join('\n') }
      },
    })
    scoped.commands.register({
      name: 'longpi-report',
      description: '导出 LongPi 1.0.0 多组学报告（Markdown）。',
      handler: () => ({ kind: 'success', text: exportReportMarkdown(buildOmicsReport()) }),
    })
    scoped.commands.register({
      name: 'longpi-version',
      description: '打印 dsh-plugin-longpi 版本。',
      handler: () => ({ kind: 'success', text: `dsh-plugin-longpi ${PRODUCT_VERSION}` }),
    })
  })
}
