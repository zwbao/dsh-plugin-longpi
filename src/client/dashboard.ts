import React from 'react'
import { VIEW_ID } from './constants.ts'
import { SUGGESTED } from './prompts.ts'
import { ModuleRadar } from './radar.ts'

interface ModuleAge {
  age: number
  label_zh: string
}

interface Metric {
  code: string
  name_zh: string
  value: number | string
  unit: string
  status: string
}

interface DashboardPayload {
  version?: string
  demo: boolean
  banner: boolean
  brandName: string
  customer: {
    display_name: string
    chrono_age: number
    composite_age: number
    modules: Record<string, ModuleAge>
    disclaimer_zh: string
  }
  metrics: Metric[]
  insights: { title_zh: string; body_zh: string }[]
  bioage?: {
    phenoage: {
      model: string
      phenoage: number
      phenoage_advance: number
      mortality_10y: number
      citation: string
      citation_url: string
      all_inputs_synthetic: boolean
    }
    composite: {
      method: string
      weights: Record<string, number>
      module_source: Record<string, string>
    }
  }
  genome?: { variants: { rsid: string; gene: string; gt: string; hg38: string }[] }
  itinerary: { date: string; items: { t: string; title_zh: string; place_zh: string }[] }
}

export function registerDashboard(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    {
      name: 'conversation.view',
      id: VIEW_ID,
      order: 20,
      label: () => 'LongPi',
    },
    DashboardView,
  ))
}

async function copyPrompt(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* clipboard may be blocked; the chip still shows the prompt */
  }
}

function DashboardView(): React.ReactElement {
  const [data, setData] = React.useState<DashboardPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const token = new URLSearchParams(window.location.search).get('token')
    const url = token
      ? `/api/longpi/dashboard?token=${encodeURIComponent(token)}`
      : '/api/longpi/dashboard'
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<DashboardPayload>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'load failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return React.createElement('div', { className: 'lp-dash' },
      React.createElement('p', { className: 'lp-err' }, `无法加载 Dashboard：${error}`),
      React.createElement('p', { className: 'lp-disc' }, '确认已安装 dsh-plugin-longpi 并重启 dsh web。'),
    )
  }
  if (!data) {
    return React.createElement('div', { className: 'lp-dash' },
      React.createElement('p', { className: 'lp-kicker' }, '加载演示面板…'),
    )
  }

  const delta = data.customer.composite_age - data.customer.chrono_age
  const modules = Object.entries(data.customer.modules)
  const one = (n: number) => n.toFixed(1)
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`
  const pheno = data.bioage?.phenoage
  const composite = data.bioage?.composite
  const demoModules = composite
    ? Object.entries(composite.module_source).filter(([, s]) => s === 'demo').map(([k]) => k)
    : []

  return React.createElement('div', { className: 'lp-dash' },
    data.banner
      ? React.createElement('div', { className: 'lp-banner' }, '演示数据 · 非个人病历 · DEMO DATA')
      : null,
    React.createElement('div', { className: 'lp-kicker' }, `${data.brandName} · ${data.customer.display_name} · v${data.version ?? '1.0.1'}`),
    React.createElement('div', { className: 'lp-hero' },
      React.createElement('div', null,
        React.createElement('div', { className: 'lp-north' },
          React.createElement('div', { className: 'lp-age' }, one(data.customer.composite_age)),
          React.createElement('div', { className: 'lp-chrono' },
            `综合生物年龄 · 实际 ${data.customer.chrono_age} 岁 · Δ ${signed(delta)}`),
        ),
        // Provenance line: the headline is only trustworthy if the viewer can see which
        // parts were computed and which are demo inputs.
        pheno
          ? React.createElement('p', { className: 'lp-prov' },
            React.createElement('span', { className: 'lp-prov-tag' }, '引擎计算'),
            ` 生物学维 = ${pheno.model}：表型年龄 ${one(pheno.phenoage)} 岁（${signed(pheno.phenoage_advance)} 年），`
            + `10 年全因死亡概率 ${(pheno.mortality_10y * 100).toFixed(2)}%。`,
            React.createElement('br', null),
            React.createElement('span', { className: 'lp-prov-tag lp-prov-demo' }, '演示输入'),
            demoModules.length
              ? ` 其余 ${demoModules.length} 维（${demoModules.join(' / ')}）为固定演示值，不是算出来的。`
              : ' 五维均来自引擎。',
          )
          : null,
        React.createElement('p', { className: 'lp-disc' }, data.customer.disclaimer_zh),
      ),
      React.createElement(ModuleRadar, {
        chrono: data.customer.chrono_age,
        modules: data.customer.modules,
      }),
    ),
    React.createElement('div', { className: 'lp-modules' },
      ...modules.map(([key, mod]) => React.createElement('div', { className: 'lp-card', key },
        React.createElement('h3', null, mod.label_zh),
        React.createElement('div', { className: 'n' }, one(mod.age)),
        composite && composite.module_source[key] === 'engine'
          ? React.createElement('div', { className: 'lp-card-src' }, '引擎')
          : React.createElement('div', { className: 'lp-card-src lp-card-src-demo' }, '演示输入'),
      )),
    ),
    React.createElement('div', { className: 'lp-metrics' },
      ...(data.metrics ?? []).map((m) => React.createElement('button', {
        key: m.code,
        type: 'button',
        className: `lp-chip lp-chip-${m.status}`,
        onClick: () => {
          const q = `请解释我的${m.name_zh}（${m.code}），当前演示值 ${m.value} ${m.unit}。不要诊断，不要建议改药。`
          void copyPrompt(q).then(() => setCopied(m.code))
        },
      }, `${m.name_zh} ${m.value}${m.unit}`)),
    ),
    copied
      ? React.createElement('p', { className: 'lp-copied' }, '已复制提问，粘贴到 Chat 发送。')
      : React.createElement('p', { className: 'lp-hint' }, '点击指标芯片 → 复制提问到剪贴板，在 Chat 粘贴。'),
    React.createElement('div', { className: 'lp-grid' },
      React.createElement('div', { className: 'lp-card' },
        React.createElement('h3', null, '本周洞察'),
        React.createElement('ul', null,
          ...data.insights.map((i) => React.createElement('li', { key: i.title_zh },
            React.createElement('strong', null, i.title_zh),
            ' — ',
            i.body_zh,
          )),
        ),
      ),
      React.createElement('div', { className: 'lp-card' },
        React.createElement('h3', null, '演示基因组 hg38'),
        React.createElement('ul', null,
          ...(data.genome?.variants ?? []).map((v) => React.createElement('li', { key: v.rsid },
            React.createElement('strong', null, `${v.gene} ${v.rsid}`),
            ` ${v.gt} · ${v.hg38}`,
          )),
        ),
        React.createElement('p', { className: 'lp-hint' }, '合成面板，不是真实 WGS。问 FOXO3 / APOE 会走 annotate_variant。'),
      ),
      React.createElement('div', { className: 'lp-card' },
        React.createElement('h3', null, `${data.itinerary.date} 当日行程`),
        React.createElement('ul', null,
          ...data.itinerary.items.map((item) => React.createElement('li', { key: item.t },
            React.createElement('span', { className: 'lp-time' }, item.t),
            `${item.title_zh} · ${item.place_zh}`,
          )),
        ),
      ),
    ),
    React.createElement('div', { className: 'lp-ask' },
      React.createElement('h3', null, '问健康助手'),
      React.createElement('div', { className: 'lp-ask-row' },
        ...SUGGESTED.map((s) => React.createElement('button', {
          key: s.id,
          type: 'button',
          className: 'lp-ask-btn',
          onClick: () => {
            void copyPrompt(s.zh).then(() => setCopied(s.id))
          },
        }, s.zh)),
      ),
    ),
  )
}
