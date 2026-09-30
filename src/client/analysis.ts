// 深度分析 tab: the automatic-analysis switch, one status card (what LongPi sees now, or a run's stage progress),
// importing the result, a report summary that opens the full report in a new browser tab, the organ table, the
// question board (one card per question, long text folded) and the plan read back with 接受方案.

import React from 'react'
import { getJson, postJson } from './api.ts'
import { Btn, Section, Switch, type NoticeTone } from './ui.ts'
import { Icon } from './icons.ts'

const h = React.createElement

interface Readout { id: string; label_zh: string; value: unknown; unit?: string; kind?: string; low?: number; high?: number; horizon_years?: number }
interface Stage { key: string; label_zh: string; done: boolean }
interface Run { id: string; started_at: string; stages: Stage[]; done: number; report_ready: boolean; active: boolean; state_error: string | null; trigger: 'ai' | 'member'; reason_zh: string }
interface Readiness { why_zh: string; auto_on: boolean; auto_allowed: boolean; last_analysis: string | null; newest_record: string | null; newest_file: string | null; folder: string | null }
interface BoardRow { id: string; title_zh: string; verdict_zh: string; confidence: string | null; summary_zh: string | null; next_step_zh: string | null; limitations_zh?: string | null }
interface OrganRow { organ: string; label_zh: string; measured: Readout[]; indices: Readout[]; ai_age: Readout | null; ai_risks: Readout[]; overrides: Array<{ disease: string; message_zh: string }> }
interface Current {
  run_id: string; imported_at: string; plan_accepted_version: number | null
  readouts: Readout[]; organs: OrganRow[]; board: BoardRow[]
  retests: Array<{ what: string; after_weeks: number; due: string }>; boundary_zh: string
}
interface ReadBack { ok: boolean; run_id: string | null; plan_key: string | null; title: string; items: Array<{ id: string; category: string; title: string; detail: string; markers: string[] }>; warnings: string[]; errors: string[] }
interface Status { ok: boolean; runs: Run[]; current: Current | null; plan_read_back: ReadBack | null; blockers: { reply_zh: string; missing: string } | null; readiness: Readiness | null; cost_zh: string }

const CONF_ZH: Record<string, string> = { low: '低', moderate: '中' }

/** Anything shown comes from a file a pipeline wrote: shown as text, never as an object. */
const t = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

function pct(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 1000) / 10}%` : '—'
}

function fmt(r: Readout | null | undefined): string {
  if (!r) return '—'
  const v = typeof r.value === 'number' ? String(Number(r.value.toPrecision(4))) : t(r.value)
  if (r.kind === 'llm_estimate') {
    if (r.unit === '概率') return `${pct(r.value)}（AI 估计，${pct(r.low)}–${pct(r.high)}${r.horizon_years ? `，${t(r.horizon_years)} 年` : ''}）`
    return `${v} 岁（AI 估计，${t(r.low)}–${t(r.high)} 岁）`
  }
  const unit = r.unit === 'a' ? ' 岁' : r.unit ? ` ${t(r.unit)}` : ''
  return `${v}${unit}`
}

export function AnalysisTab(props: { onNotice?: (text: string, tone?: NoticeTone) => void }): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const load = React.useCallback(() => {
    void getJson<Status>('/api/longpi/analysis').then((s) => { setStatus(s); setError('') })
      .catch((e: unknown) => setError(errText(e, '读取深度分析状态失败')))
  }, [])
  React.useEffect(() => { load() }, [load])
  const running = status?.runs.find((r) => r.active) ?? null
  React.useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(load, 15_000)                 // stage progress while a run is going
    return () => clearInterval(timer)
  }, [running?.id, load])

  const notice = (text: string, tone: NoticeTone = 'info') => props.onNotice?.(text, tone)
  const act = async (name: string, fn: () => Promise<void>, fallback: string) => {
    setBusy(name)
    try {
      await fn()
    } catch (e) {
      notice(errText(e, fallback), 'bad')
    } finally {
      setBusy('')
      load()
    }
  }
  const toggle = (on: boolean) => act('auto', async () => {
    await postJson('/api/longpi/analysis/settings', { auto: on })
    notice(on ? '已打开自动深度分析：有新数据时 LongPi 会自己开始。' : '已关闭自动深度分析：只在关键时间点问你要不要做。', 'info')
  }, '设置失败')
  const doImport = (runId: string) => act('import', async () => {
    await postJson('/api/longpi/analysis/import', { run_id: runId })
    notice('结果已导入。', 'good')
  }, '导入失败')
  const abandon = (runId: string) => act('abandon', async () => {
    await postJson('/api/longpi/analysis/abandon', { run_id: runId })
    notice('已放弃这次分析。', 'info')
  }, '操作失败')
  const accept = (back: ReadBack) => act('accept', async () => {
    const res = await postJson<{ version?: number }>('/api/longpi/analysis/plan-accept', { run_id: back.run_id, plan_key: back.plan_key })
    notice(`方案已保存（第 ${t(res.version)} 版），复测提醒会按方案里的指标安排。`, 'good')
  }, '保存失败')

  if (!status) return h('div', { className: 'lp-tab-body' }, h('p', { className: 'lp-muted', role: error ? 'alert' : undefined }, error || '读取中…'))
  const cur = status.current
  const ready = status.runs.find((r) => r.report_ready && r.id !== cur?.run_id) ?? null
  const stopped = status.runs.find((r) => !r.active && !r.report_ready) ?? null
  const back = status.plan_read_back
  const disabled = Boolean(busy)

  return h('div', { className: 'lp-tab-body' },
    error ? h('div', { className: 'lp-callout lp-callout-bad', role: 'alert' }, h(Icon, { name: 'warn', size: 16 }), h('div', { className: 'lp-callout-body' }, error)) : null,
    h('div', { className: 'lp-stack' },
      h('div', { className: 'lp-card' },
        h('p', { className: 'lp-text lp-muted' }, '用全基因组、甲基化、肠道菌、蛋白组和体检数据，算生物学年龄、各器官状况和以后的疾病风险，提出针对性的问题并逐一查证，最后给一份能照着做的方案。分析在对话里进行；也可以随时在对话里直接要求做一次。'),
        h(Switch, { checked: Boolean(status.readiness?.auto_on), onChange: (on: boolean) => { void toggle(on) }, label: '自动深度分析', disabled, busy: busy === 'auto', describedBy: 'lp-auto-cost' }),
        h('div', { className: 'lp-callout lp-callout-warn', id: 'lp-auto-cost', role: 'note' },
          h(Icon, { name: 'warn', size: 16 }),
          h('div', { className: 'lp-callout-body' }, `注意：${t(status.cost_zh)}，会消耗大量 token。打开后，有新的体检、化验或检测文件时，LongPi 会自己判断并开始分析（每个人两次自动分析至少间隔 30 天）；关闭时（默认），只在关键时间点问你要不要做，你同意才开始。这个开关对你和家人都生效。`))),
      h(StatusCard, { status, running, stopped, ready, disabled, onAbandon: (id: string) => { void abandon(id) }, onImport: (id: string) => { void doImport(id) } })),

    cur ? h(Section, { title: '报告', aside: cur.imported_at ? h('span', { className: 'lp-caption' }, `导入于 ${t(cur.imported_at).slice(0, 10)}`) : undefined }, h(ReportCard, { cur, planItems: back?.items.length ?? 0 })) : null,

    cur && cur.organs.length ? h(Section, { title: '器官体检表' },
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-table-wrap' },
          h('table', { className: 'lp-table lp-an-organs' },
            h('thead', null, h('tr', null, ...['器官', '测量和公式', '年龄（AI 估计）', '疾病风险'].map((x) => h('th', { key: x, scope: 'col' }, x)))),
            h('tbody', null, ...cur.organs.map((o) => h('tr', { key: t(o.organ) },
              h('td', null, t(o.label_zh)),
              h('td', null, o.measured.length || o.indices.length
                ? h('ul', { className: 'lp-an-list' }, ...[...o.measured, ...o.indices].map((r, i) => h('li', { key: `${t(r.id)}-${i}` },
                  h('span', { className: 'lp-muted' }, t(r.label_zh)), ' ', h('span', { className: 'lp-num' }, fmt(r)))))
                : '—'),
              h('td', null, fmt(o.ai_age)),
              h('td', null, o.ai_risks.length || o.overrides.length
                ? h('div', { className: 'lp-an-risks' },
                  o.ai_risks.length ? h('ul', { className: 'lp-an-list' }, ...o.ai_risks.map((r, i) => h('li', { key: `${t(r.id)}-${i}` },
                    h('span', { className: 'lp-badge lp-badge-neutral' }, t(r.label_zh)), ' ', h('span', { className: 'lp-num' }, fmt(r))))) : null,
                  ...o.overrides.map((x, i) => h('p', { key: `o-${i}`, className: 'lp-small' },
                    h('span', { className: 'lp-badge lp-badge-warn' }, t(x.disease)), ' ', t(x.message_zh))))
                : '—')))))))) : null,

    cur && cur.board.length ? h(Section, { title: '问题看板', aside: h('span', { className: 'lp-caption' }, '每个问题由一位独立 AI 研究员查证') },
      h('div', { className: 'lp-stack' }, ...cur.board.map((b) => h(QuestionCard, { key: t(b.id), row: b })))) : null,

    cur && back ? h(Section, { title: '干预方案' },
      h('div', { className: 'lp-card' },
        back.items.length ? h('ul', { className: 'lp-rows' }, ...back.items.map((i) => h('li', { key: t(i.id), className: 'lp-row lp-row-stack' },
          h('span', { className: 'lp-strong' }, t(i.title)),
          i.detail ? h('span', { className: 'lp-muted' }, t(i.detail)) : null,
          i.markers.length ? h('span', { className: 'lp-caption' }, `复测看：${i.markers.map(t).join('、')}`) : null)))
          : h('p', { className: 'lp-muted' }, '这份方案里没有条目。'),
        back.warnings.length ? h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'warn', size: 16 }),
          h('div', { className: 'lp-callout-body' }, h('ul', { className: 'lp-bullets lp-an-bullets' }, ...back.warnings.map((w, i) => h('li', { key: i }, t(w)))))) : null,
        back.errors.length ? h('div', { className: 'lp-callout lp-callout-bad', role: 'alert' }, h(Icon, { name: 'warn', size: 16 }),
          h('div', { className: 'lp-callout-body' }, back.errors.map(t).join('；'))) : null,
        cur.retests.length ? h('p', { className: 'lp-small lp-muted' }, '复测：' + cur.retests.map((r) => `${t(r.what)}（${t(r.after_weeks)} 周后）`).join('；')) : null,
        h('div', { className: 'lp-card-foot' },
          cur.plan_accepted_version
            ? h('span', { className: 'lp-badge lp-badge-good' }, h(Icon, { name: 'check', size: 12 }), `已保存为第 ${t(cur.plan_accepted_version)} 版`)
            : h('span', { className: 'lp-caption' }, '确认后才生效'),
          cur.plan_accepted_version ? null
            : h(Btn, { onClick: () => { void accept(back) }, disabled: disabled || !back.ok }, '我读过了，接受方案')))) : null)
}

/** One card for where things stand: a run in progress, a stopped run, a finished run to import, or why not yet. */
function StatusCard(props: {
  status: Status; running: Run | null; stopped: Run | null; ready: Run | null; disabled: boolean
  onAbandon: (id: string) => void; onImport: (id: string) => void
}): React.ReactElement | null {
  const { status, running, stopped, ready, disabled } = props
  const run = running ?? stopped

  if (run) {
    const total = run.stages.length
    const now = running ? run.stages.findIndex((s) => !s.done) : -1
    return h('div', { className: 'lp-card' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-h3' }, running ? '分析进行中' : '上次分析没有完成'),
        h('span', { className: 'lp-caption lp-num', role: 'status', 'aria-label': `已完成 ${run.done} 步，共 ${total} 步` }, `${run.done}/${total}`)),
      h('div', { className: 'lp-bar', role: 'progressbar', 'aria-label': '分析进度', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': run.done },
        h('span', { style: { width: `${total ? Math.round((run.done / total) * 100) : 0}%` } })),
      h('ol', { className: 'lp-progress-steps' }, ...run.stages.map((s, i) => h('li', {
        key: s.key, className: `lp-progress-step${s.done ? ' is-done' : i === now ? ' is-now' : ''}`, 'aria-current': i === now ? 'step' : undefined,
      },
      h('span', { className: 'lp-progress-dot', 'aria-hidden': true }, s.done ? h(Icon, { name: 'check', size: 12, strokeWidth: 2 }) : null),
      h('span', null, s.label_zh, s.done ? h('span', { className: 'lp-sr' }, '（已完成）') : null)))),
      running && run.reason_zh ? h('p', { className: 'lp-small lp-muted' }, `${run.trigger === 'ai' ? 'LongPi 发起' : '你要求的'}：${t(run.reason_zh)}`) : null,
      running ? null : h('p', { className: 'lp-small lp-muted' }, '可以回到那段对话说「继续」，或者放弃后重新发起。'),
      run.state_error ? h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'warn', size: 16 }), h('div', { className: 'lp-callout-body' }, t(run.state_error))) : null,
      ready ? h('div', { className: 'lp-callout lp-callout-good' }, h(Icon, { name: 'check', size: 16 }),
        h('div', { className: 'lp-callout-body' }, '另有一份分析已完成，可以先导入。', h('div', null, h(Btn, { size: 'sm', onClick: () => props.onImport(ready.id), disabled }, '导入结果')))) : null,
      h('div', { className: 'lp-card-foot' },
        h('span', { className: 'lp-caption' }, running ? '每 15 秒自动刷新' : ''),
        h(Btn, { variant: 'outline', size: 'sm', onClick: () => props.onAbandon(run.id), disabled }, '放弃这次分析')))
  }

  if (ready) {
    return h('div', { className: 'lp-card', role: 'status' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, '有一份新的分析已完成')),
      h('p', { className: 'lp-text lp-muted' }, '导入后就能在这里看到报告、器官体检表和方案。'),
      h('div', { className: 'lp-card-foot' },
        h('span', { className: 'lp-caption' }, '导入后，报告和问题看板会显示在下面。'),
        h(Btn, { onClick: () => props.onImport(ready.id), disabled }, '导入结果')))
  }

  const blocked = status.blockers
  if (blocked) {
    return h('div', { className: 'lp-card', role: 'status' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, '现在还不能做')),
      h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'info', size: 16 }), h('div', { className: 'lp-callout-body' }, t(blocked.reply_zh))))
  }

  const readiness = status.readiness
  if (!readiness) return null
  return h('div', { className: 'lp-card', role: 'status' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, readiness.auto_on ? 'LongPi 的判断' : '现在的情况')),
    h('p', { className: 'lp-text' }, t(readiness.why_zh) || '现在没有进行中的分析。'),
    readiness.folder ? h('p', { className: 'lp-caption' }, `检测文件夹：${t(readiness.folder)}（只读）`) : null)
}

/** The report as a summary; the full report opens in a new browser tab (it is sandboxed there by its own CSP). */
function ReportCard(props: { cur: Current; planItems: number }): React.ReactElement {
  const { cur } = props
  const href = `/api/longpi/analysis/report?v=${encodeURIComponent(t(cur.imported_at))}`
  // Headline readouts first: ages, then AI estimates, then the rest; at most four.
  const rank = (r: Readout) => (r.unit === 'a' ? 0 : r.kind === 'llm_estimate' ? 1 : 2)
  const headline = cur.readouts.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).slice(0, 4).map((x) => x.r)
  const facts: Array<[string, string]> = [
    ['器官', `${cur.organs.length} 个`],
    ['问题', `${cur.board.length} 个`],
    ['方案', `${props.planItems} 项`],
    ['复测', `${cur.retests.length} 项`],
  ]
  return h('div', { className: 'lp-card' },
    h('dl', { className: 'lp-an-facts' }, ...facts.map(([label, value]) => h('div', { key: label, className: 'lp-an-fact' },
      h('dt', { className: 'lp-caption' }, label), h('dd', { className: 'lp-an-fact-value lp-num' }, value)))),
    headline.length ? h('dl', { className: 'lp-kv' }, ...headline.flatMap((r, i) => [
      h('dt', { key: `k${i}` }, t(r.label_zh)), h('dd', { key: `v${i}`, className: 'lp-num' }, fmt(r))])) : null,
    cur.boundary_zh ? h('p', { className: 'lp-caption' }, t(cur.boundary_zh)) : null,
    h('div', { className: 'lp-card-foot' },
      h('span', { className: 'lp-caption' }, '完整报告在新标签页打开'),
      h('a', { className: 'lp-linkbtn lp-btn-primary', href, target: '_blank', rel: 'noopener noreferrer' }, '打开完整报告', h(Icon, { name: 'arrow', size: 14 }))))
}

/** First sentence of a conclusion; the rest goes under 证据与局限. */
function splitFirst(text: string): [string, string] {
  const m = /^[\s\S]*?[。！？!?](?=\s*\S)/.exec(text)
  return m ? [m[0], text.slice(m[0].length).trim()] : [text, '']
}

function QuestionCard(props: { row: BoardRow }): React.ReactElement {
  const b = props.row
  const conf = Object.prototype.hasOwnProperty.call(CONF_ZH, t(b.confidence)) ? CONF_ZH[t(b.confidence)] : ''
  const verdict = t(b.verdict_zh)
  const summary = t(b.summary_zh)
  const [lead, more] = splitFirst(verdict && summary ? `${verdict}：${summary}` : verdict || summary)
  const limits = t(b.limitations_zh)
  const next = t(b.next_step_zh)
  return h('article', { className: 'lp-card' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-h3' }, `${t(b.id)} ${t(b.title_zh)}`.trim()),
      conf ? h('span', { className: `lp-badge ${conf === '低' ? 'lp-badge-warn' : 'lp-badge-neutral'}` }, `把握：${conf}`) : null),
    h('p', { className: 'lp-text' }, lead || '还没有结论。'),
    more || limits ? h('details', null,
      h('summary', null, limits ? '证据与局限' : '证据'),
      h('div', { className: 'lp-an-more' },
        more ? h('p', { className: 'lp-text lp-muted' }, more) : null,
        limits ? h('p', { className: 'lp-text lp-muted' }, `局限：${limits}`) : null)) : null,
    next ? h('p', { className: 'lp-an-next' }, h(Icon, { name: 'arrow', size: 14 }), h('span', null, h('span', { className: 'lp-muted' }, '下一步：'), next)) : null)
}
