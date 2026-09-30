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
interface Run { id: string; started_at: string; stages: Stage[]; done: number; report_ready: boolean; state_error: string | null }
interface BoardRow { id: string; title_zh: string; verdict_zh: string; confidence: string | null; summary_zh: string | null; next_step_zh: string | null }
interface OrganRow { organ: string; label_zh: string; measured: Readout[]; indices: Readout[]; ai_age: Readout | null; ai_risks: Readout[] }
interface Current {
  run_id: string; imported_at: string; plan_accepted_version: number | null
  readouts: Readout[]; organs: OrganRow[]; board: BoardRow[]
  retests: Array<{ what: string; after_weeks: number; due: string }>; boundary_zh: string
}
interface ReadBack { ok: boolean; title: string; items: Array<{ id: string; category: string; title: string; detail: string; markers: string[] }>; warnings: string[]; errors: string[] }
interface Status { ok: boolean; runs: Run[]; current: Current | null; plan_read_back: ReadBack | null }

const CONF_ZH: Record<string, string> = { low: '低', moderate: '中' }

function fmt(r: Readout | null | undefined): string {
  if (!r) return '—'
  const v = typeof r.value === 'number' ? Number(r.value.toPrecision(4)) : r.value
  if (r.kind === 'llm_estimate') {
    if (r.unit === '概率') return `${Math.round(Number(r.value) * 1000) / 10}%（AI 估计，${Math.round(Number(r.low) * 1000) / 10}%–${Math.round(Number(r.high) * 1000) / 10}%${r.horizon_years ? `，${r.horizon_years} 年` : ''}）`
    return `${String(v)} 岁（AI 估计，${r.low}–${r.high} 岁）`
  }
  const unit = r.unit === 'a' ? ' 岁' : r.unit ? ` ${r.unit}` : ''
  return `${String(v)}${unit}`
}

export function AnalysisTab(props: { openChat?: () => void; onNotice?: (text: string, tone?: NoticeTone) => void }): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const load = React.useCallback(() => {
    void getJson<Status>('/api/longpi/analysis').then(setStatus).catch(() => setError('读取深度分析状态失败'))
  }, [])
  React.useEffect(() => { load() }, [load])
  const running = status?.runs.find((r) => !r.report_ready && r.done < r.stages.length) ?? null
  React.useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(load, 15_000)                 // stage progress while a run is going
    return () => clearInterval(timer)
  }, [running?.id, load])

  const notice = (text: string, tone: NoticeTone = 'info') => props.onNotice?.(text, tone)
  const start = async () => {
    setBusy('start')
    try {
      const res = await postJson<{ ok: boolean; prompt_zh?: string; error?: string }>('/api/longpi/analysis/start', {})
      if (!res.ok || !res.prompt_zh) { notice(res.error ?? '现在不能发起。', 'bad'); return }
      setPendingPrompt(res.prompt_zh)
      props.openChat?.()
      notice('已把请求放进对话输入框，发送后开始分析。', 'info')
      load()
    } finally { setBusy('') }
  }
  const doImport = async (runId: string) => {
    setBusy('import')
    try {
      const res = await postJson<{ ok: boolean; error?: string; problems?: string[] }>('/api/longpi/analysis/import', { run_id: runId })
      if (!res.ok) notice(`${res.error ?? '导入失败'}${res.problems?.length ? `（${res.problems.slice(0, 2).join('；')}）` : ''}`, 'bad')
      else notice('结果已导入。', 'info')
      load()
    } finally { setBusy('') }
  }
  const accept = async () => {
    setBusy('accept')
    try {
      const res = await postJson<{ ok: boolean; version?: number; error?: string }>('/api/longpi/analysis/plan-accept', {})
      notice(res.ok ? `方案已保存（第 ${res.version} 版），复测提醒会按方案里的指标安排。` : res.error ?? '保存失败', res.ok ? 'info' : 'bad')
      load()
    } finally { setBusy('') }
  }

  if (!status) return h('div', { className: 'lp-tab-body' }, h('p', { className: 'lp-muted' }, error || '读取中…'))
  const cur = status.current
  const ready = status.runs.find((r) => r.report_ready && r.id !== cur?.run_id) ?? null
  const back = status.plan_read_back

  return h('div', { className: 'lp-tab-body lp-analysis' },
    h(Section, {
      title: '深度分析', kicker: '多组学 · 器官 · 问题看板',
      aside: h(Btn, { onClick: () => { void start() }, disabled: Boolean(busy) || Boolean(running) }, running ? '分析进行中' : '发起深度分析'),
    },
    h('p', { className: 'lp-muted' }, '用你的全基因组、甲基化、肠道菌、蛋白组和体检数据，算生物学年龄、各器官状况和以后的疾病风险，提出针对你的问题并逐一查证，最后给一份能照着做的方案。分析在对话里进行，需要你确认的步骤会在对话里问你。'),
    running ? h('div', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, `进行中：${running.done}/${running.stages.length} 步`),
      h('ol', { className: 'lp-steps' }, ...running.stages.map((s) => h('li', { key: s.key, className: s.done ? 'lp-step-done' : '' }, `${s.done ? '✓ ' : ''}${s.label_zh}`))),
      running.state_error ? h('p', { className: 'lp-muted' }, running.state_error) : null) : null,
    ready ? h('div', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, '有一份新的分析已完成'),
      h(Btn, { onClick: () => { void doImport(ready.id) }, disabled: Boolean(busy) }, '导入结果')) : null),

    cur ? h(Section, { title: '报告', kicker: `导入于 ${cur.imported_at.slice(0, 10)}` },
      h('iframe', {
        className: 'lp-analysis-report', title: '深度分析报告', src: '/api/longpi/analysis/report',
        sandbox: '', referrerPolicy: 'no-referrer', style: { width: '100%', height: 640, border: '1px solid var(--lp-line, #ddd)', borderRadius: 8 },
      }),
      h('p', { className: 'lp-muted' }, cur.boundary_zh)) : null,

    cur && cur.organs.length ? h(Section, { title: '器官体检表' },
      h('table', { className: 'lp-table' },
        h('thead', null, h('tr', null, ...['器官', '测量/公式', '年龄（AI 估计）', '疾病风险（AI 估计）'].map((t) => h('th', { key: t }, t)))),
        h('tbody', null, ...cur.organs.map((o) => h('tr', { key: o.organ },
          h('td', null, o.label_zh),
          h('td', null, [...o.measured, ...o.indices].map((r) => `${r.label_zh} ${fmt(r)}`).join('；') || '—'),
          h('td', null, fmt(o.ai_age)),
          h('td', null, o.ai_risks.map((r) => `${r.label_zh} ${fmt(r)}`).join('；') || '—')))))) : null,

    cur && cur.board.length ? h(Section, { title: '问题看板', kicker: '每个问题由一位独立 AI 研究员查证' },
      h('table', { className: 'lp-table' },
        h('thead', null, h('tr', null, ...['问题', '结论', '把握', '下一步'].map((t) => h('th', { key: t }, t)))),
        h('tbody', null, ...cur.board.map((b) => h('tr', { key: b.id },
          h('td', null, `${b.id} ${b.title_zh}`),
          h('td', null, b.verdict_zh + (b.summary_zh ? `：${b.summary_zh}` : '')),
          h('td', null, b.confidence ? CONF_ZH[b.confidence] ?? b.confidence : '—'),
          h('td', null, b.next_step_zh ?? '—')))))) : null,

    cur && back ? h(Section, { title: '干预方案', kicker: cur.plan_accepted_version ? `已保存为第 ${cur.plan_accepted_version} 版` : '确认后才生效' },
      h('ol', { className: 'lp-plan-readback' }, ...back.items.map((i) => h('li', { key: i.id },
        h('strong', null, i.title), i.detail ? h('div', { className: 'lp-muted' }, i.detail) : null,
        i.markers.length ? h('div', { className: 'lp-muted' }, `复测看：${i.markers.join('、')}`) : null))),
      back.warnings.length ? h('ul', { className: 'lp-muted' }, ...back.warnings.map((w) => h('li', { key: w }, w))) : null,
      back.errors.length ? h('p', { className: 'lp-muted' }, back.errors.join('；')) : null,
      cur.plan_accepted_version ? null
        : h(Btn, { onClick: () => { void accept() }, disabled: Boolean(busy) || !back.ok }, '我读过了，接受方案'),
      cur.retests.length ? h('p', { className: 'lp-muted' }, '复测：' + cur.retests.map((r) => `${r.what}（${r.after_weeks} 周后，约 ${r.due}）`).join('；')) : null) : null)
}
