// 深度分析 tab: start a longevity-analyst run (the request goes into the composer; the person sends it),
// its stage progress, importing the result, the report in a sandboxed frame, the organ table, the question
// board and the plan read back with 接受方案.

import React from 'react'
import { getJson, postJson } from './api.ts'
import { setPendingPrompt } from './store.ts'
import { Btn, Section, type NoticeTone } from './ui.ts'

const h = React.createElement

interface Readout { id: string; label_zh: string; value: unknown; unit?: string; kind?: string; low?: number; high?: number; horizon_years?: number }
interface Stage { key: string; label_zh: string; done: boolean }
interface Run { id: string; started_at: string; stages: Stage[]; done: number; report_ready: boolean; active: boolean; state_error: string | null }
interface BoardRow { id: string; title_zh: string; verdict_zh: string; confidence: string | null; summary_zh: string | null; next_step_zh: string | null; limitations_zh?: string | null }
interface OrganRow { organ: string; label_zh: string; measured: Readout[]; indices: Readout[]; ai_age: Readout | null; ai_risks: Readout[]; overrides: Array<{ disease: string; message_zh: string }> }
interface Current {
  run_id: string; imported_at: string; plan_accepted_version: number | null
  readouts: Readout[]; organs: OrganRow[]; board: BoardRow[]
  retests: Array<{ what: string; after_weeks: number; due: string }>; boundary_zh: string
}
interface ReadBack { ok: boolean; run_id: string | null; plan_key: string | null; title: string; items: Array<{ id: string; category: string; title: string; detail: string; markers: string[] }>; warnings: string[]; errors: string[] }
interface Status { ok: boolean; runs: Run[]; current: Current | null; plan_read_back: ReadBack | null; blockers: { reply_zh: string; missing: string } | null }

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

export function AnalysisTab(props: { openChat?: () => void; onNotice?: (text: string, tone?: NoticeTone) => void }): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const [folder, setFolder] = React.useState('')
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
  const start = () => act('start', async () => {
    const res = await postJson<{ ok: boolean; prompt_zh?: string }>('/api/longpi/analysis/start', folder.trim() ? { data_folder: folder.trim() } : {})
    if (!res.prompt_zh) throw new Error('现在不能发起。')
    setPendingPrompt(res.prompt_zh)
    props.openChat?.()
    notice('已把请求放进对话输入框，发送后开始分析。', 'info')
  }, '现在不能发起。')
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
  const blocked = status.blockers

  return h('div', { className: 'lp-tab-body lp-analysis' },
    error ? h('p', { className: 'lp-muted', role: 'alert' }, error) : null,
    h(Section, {
      title: '深度分析', kicker: '多组学 · 器官 · 问题看板',
      aside: h(Btn, { onClick: () => { void start() }, disabled: Boolean(busy) || Boolean(running) || Boolean(blocked) }, running ? '分析进行中' : '发起深度分析'),
    },
    h('p', { className: 'lp-muted' }, '用你的全基因组、甲基化、肠道菌、蛋白组和体检数据，算生物学年龄、各器官状况和以后的疾病风险，提出针对你的问题并逐一查证，最后给一份能照着做的方案。分析在对话里进行，需要你确认的步骤会在对话里问你。'),
    !running && !blocked ? h('label', { className: 'lp-field' },
      h('span', { className: 'lp-label' }, '检测文件所在的文件夹（可选）'),
      h('input', {
        className: 'lp-input', type: 'text', value: folder, placeholder: '例如 ~/Documents/我的多组学报告',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFolder(e.target.value), 'aria-label': '检测文件所在的文件夹',
      }),
      h('span', { className: 'lp-muted' }, '全基因组、甲基化、肠道菌、蛋白组的原始文件不在 Mirobody 里，放在这台电脑的一个文件夹中；只会读取，不会改动。体检和手表数据从 Mirobody 读。')) : null,
    blocked ? h('div', { className: 'lp-card', role: 'status' }, h('div', { className: 'lp-label' }, '发起前还需要'), h('p', null, blocked.reply_zh)) : null,
    running ? h('div', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, `进行中：${running.done}/${running.stages.length} 步`),
      h('ol', { className: 'lp-steps' }, ...running.stages.map((s) => h('li', { key: s.key, className: s.done ? 'lp-step-done' : '' }, `${s.done ? '✓ ' : ''}${s.label_zh}`))),
      running.state_error ? h('p', { className: 'lp-muted' }, running.state_error) : null,
      h(Btn, { variant: 'outline', onClick: () => { void abandon(running.id) }, disabled: Boolean(busy) }, '放弃这次分析')) : null,
    !running && stopped ? h('div', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, `上次分析停在 ${stopped.done}/${stopped.stages.length} 步`),
      h('p', { className: 'lp-muted' }, '可以回到那段对话说「继续」，或者放弃后重新发起。'),
      h(Btn, { variant: 'outline', onClick: () => { void abandon(stopped.id) }, disabled: Boolean(busy) }, '放弃这次分析')) : null,
    ready ? h('div', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, '有一份新的分析已完成'),
      h(Btn, { onClick: () => { void doImport(ready.id) }, disabled: Boolean(busy) }, '导入结果')) : null),

    cur ? h(Section, { title: '报告', kicker: `导入于 ${t(cur.imported_at).slice(0, 10)}` },
      h('iframe', {
        key: cur.imported_at, className: 'lp-analysis-report', title: '深度分析报告', src: `/api/longpi/analysis/report?v=${encodeURIComponent(t(cur.imported_at))}`,
        sandbox: '', referrerPolicy: 'no-referrer', style: { width: '100%', height: 640, border: '1px solid var(--lp-line, #ddd)', borderRadius: 8 },
      }),
      h('p', { className: 'lp-muted' }, t(cur.boundary_zh))) : null,

    cur && cur.organs.length ? h(Section, { title: '器官体检表' },
      h('table', { className: 'lp-table' },
        h('thead', null, h('tr', null, ...['器官', '测量/公式', '年龄（AI 估计）', '疾病风险'].map((x) => h('th', { key: x }, x)))),
        h('tbody', null, ...cur.organs.map((o) => h('tr', { key: t(o.organ) },
          h('td', null, t(o.label_zh)),
          h('td', null, [...o.measured, ...o.indices].map((r) => `${t(r.label_zh)} ${fmt(r)}`).join('；') || '—'),
          h('td', null, fmt(o.ai_age)),
          h('td', null, [...o.overrides.map((x) => `${t(x.disease)}：${t(x.message_zh)}`), ...o.ai_risks.map((r) => `${t(r.label_zh)} ${fmt(r)}`)].join('；') || '—')))))) : null,

    cur && cur.board.length ? h(Section, { title: '问题看板', kicker: '每个问题由一位独立 AI 研究员查证' },
      h('table', { className: 'lp-table' },
        h('thead', null, h('tr', null, ...['问题', '结论', '把握', '下一步'].map((x) => h('th', { key: x }, x)))),
        h('tbody', null, ...cur.board.map((b) => h('tr', { key: t(b.id) },
          h('td', null, `${t(b.id)} ${t(b.title_zh)}`),
          h('td', null, t(b.verdict_zh) + (b.summary_zh ? `：${t(b.summary_zh)}` : '') + (b.limitations_zh ? `（局限：${t(b.limitations_zh)}）` : '')),
          h('td', null, Object.prototype.hasOwnProperty.call(CONF_ZH, t(b.confidence)) ? CONF_ZH[t(b.confidence)] : '—'),
          h('td', null, t(b.next_step_zh) || '—')))))) : null,

    cur && back ? h(Section, { title: '干预方案', kicker: cur.plan_accepted_version ? `已保存为第 ${t(cur.plan_accepted_version)} 版` : '确认后才生效' },
      h('ol', { className: 'lp-plan-readback' }, ...back.items.map((i) => h('li', { key: t(i.id) },
        h('strong', null, t(i.title)), i.detail ? h('div', { className: 'lp-muted' }, t(i.detail)) : null,
        i.markers.length ? h('div', { className: 'lp-muted' }, `复测看：${i.markers.map(t).join('、')}`) : null))),
      back.warnings.length ? h('ul', { className: 'lp-muted' }, ...back.warnings.map((w) => h('li', { key: t(w) }, t(w)))) : null,
      back.errors.length ? h('p', { className: 'lp-muted' }, back.errors.map(t).join('；')) : null,
      cur.plan_accepted_version ? null
        : h(Btn, { onClick: () => { void accept(back) }, disabled: Boolean(busy) || !back.ok }, '我读过了，接受方案'),
      cur.retests.length ? h('p', { className: 'lp-muted' }, '复测：' + cur.retests.map((r) => `${t(r.what)}（${t(r.after_weeks)} 周后）`).join('；')) : null) : null)
}
