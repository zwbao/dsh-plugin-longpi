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
const t = (v: unknown): string => (typeof v === 'string' ? tidy(v) : typeof v === 'number' && Number.isFinite(v) ? num(v) : '')

/** Pipeline text, put into the house style: no doubled 岁, 「1/7」 without spaces, the minus sign, 「」 quotes. */
function tidy(text: string): string {
  return text
    .replace(/岁\s*岁/g, '岁')
    .replace(/\.{3,}|。{3,}/g, '…')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1/$2')
    .replace(/(^|[\s（(：:，,；;=≈<>])-(?=\d)/g, '$1−')
    .replace(/[“"]([^“”"]*)[”"]/g, '「$1」')
    .replace(/‘([^‘’]*)’/g, '「$1」')
}
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

/** Numbers by the spec rule: whole numbers as they are, below 10 two decimals, 10 and above one decimal. */
function num(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return t(v) || '—'
  const a = Math.abs(v)
  const text = Number.isInteger(v) ? String(a) : String(Number(a.toFixed(a < 10 ? 2 : 1)))   // 4.5 not 4.50
  return v < 0 && Number(text) !== 0 ? `−${text}` : text   // the minus sign, not a hyphen
}

const isProb = (r: Readout) => r.unit === '概率'
/** A number with its unit: 岁 for years, % glued to the number, other units after a space. */
function withUnit(r: Readout, v: unknown): string {
  if (isProb(r)) return typeof v === 'number' && Number.isFinite(v) ? `${num(Math.round(v * 10000) / 100)}%` : '—'
  const n = num(v)
  if (r.unit === 'a' || (r.kind === 'llm_estimate' && !r.unit)) return `${n} 岁`
  if (r.unit === '%') return `${n}%`
  return r.unit ? `${n} ${t(r.unit)}` : n
}

/** The value alone (the table header says what kind of estimate it is). */
function valueText(r: Readout | null | undefined): string {
  return r ? withUnit(r, r.value) : '—'
}

/** An estimate's range, with its horizon when it is not the 10 years the column header states. */
function rangeText(r: Readout): string {
  if (typeof r.low !== 'number' || typeof r.high !== 'number') return ''
  const lo = isProb(r) ? withUnit(r, r.low).replace(/%$/, '') : num(r.low)
  const hi = withUnit(r, r.high)
  return `${lo}–${hi}${r.horizon_years && r.horizon_years !== 10 ? `，${t(r.horizon_years)} 年` : ''}`
}

/** Full text for places without a column header. */
function fmt(r: Readout | null | undefined): string {
  if (!r) return '—'
  if (r.kind !== 'llm_estimate') return valueText(r)
  const range = rangeText(r)
  return `${valueText(r)}（AI 估计${range ? `，${range}` : ''}${isProb(r) && r.horizon_years === 10 ? '，10 年' : ''}）`
}

/** Labels written by the pipeline repeat「（10 年，AI 估计）」; the column header says it once. */
const cleanLabel = (label: string) => label.replace(/\s*[（(][^（）()]*(?:AI 估计|年)[^（）()]*[）)]\s*$/, '').trim() || label

/** A measured value; a worded one keeps its short verdict on the line and its explanation on a caption line below. */
function measureValue(r: Readout): React.ReactNode[] {
  if (typeof r.value === 'number') return [h('span', { key: 'v', className: 'lp-num lp-an-val' }, valueText(r))]
  const text = valueText(r)
  const m = /^([^（(]+?)\s*[（(](.+)[）)]$/.exec(text)
  if (!m) return [h('span', { key: 'v', className: 'lp-an-valtext' }, text)]
  return [h('span', { key: 'v', className: 'lp-an-val' }, m[1]), h('span', { key: 'n', className: 'lp-caption lp-an-note' }, m[2])]
}

/** The report's boundary note minus what the page footer already says (reference only, not a diagnosis). */
function pageBoundary(text: string): string {
  return text.split(/[；;]/).map((x) => x.trim().replace(/。$/, '')).filter((x) => x && !/不是诊断|不做诊断|健康管理参考/.test(x)).join('；')
}

/** 「9 月 30 日」, with the year when it is not this year. */
function dateZh(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
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
    notice(on ? '已开启自动深度分析：有新数据时，LongPi 将自动开始分析。' : '已关闭自动深度分析：仅在关键时间点征求你的意见。', 'info')
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
    h('section', { className: 'lp-section', 'aria-label': '深度分析状态' },
      h('div', { className: 'lp-card lp-an-prose' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, '关于深度分析')),
        h('p', { className: 'lp-text lp-muted' }, '根据全基因组、甲基化、肠道菌、蛋白组和体检数据，估算生物学年龄、各器官状况和未来的疾病风险，提出针对性问题并逐一查证，最后给出一份可执行的方案。分析在对话中进行；也可随时在对话中直接发起。'),
        h(Switch, { checked: Boolean(status.readiness?.auto_on), onChange: (on: boolean) => { void toggle(on) }, label: '自动深度分析', disabled, busy: busy === 'auto', describedBy: 'lp-auto-cost' }),
        h('div', { className: 'lp-callout lp-callout-warn', id: 'lp-auto-cost', role: 'note' },
          h(Icon, { name: 'warn', size: 16 }),
          h('div', { className: 'lp-callout-body' }, `注意：${t(status.cost_zh)}，会消耗大量 token。开启后，有新的体检、化验或检测文件时，LongPi 会自动判断并开始分析（同一人两次自动分析至少间隔 30 天）；关闭时（默认），仅在关键时间点征求你的意见，经你同意后才开始。此开关对你和家人均生效。`))),
      h(StatusCard, { status, running, stopped, ready, disabled, onAbandon: (id: string) => { void abandon(id) }, onImport: (id: string) => { void doImport(id) } })),

    cur ? h(Section, { title: '报告', aside: cur.imported_at ? h('span', { className: 'lp-caption' }, `导入于 ${dateZh(t(cur.imported_at))}`) : undefined }, h(ReportCard, { cur, planItems: back?.items.length ?? 0 })) : null,

    cur && cur.organs.length ? h(Section, { title: '器官体检表' },
      h('div', { className: 'lp-card' },
        h('p', { className: 'lp-caption lp-an-narrow-note' }, '年龄与疾病风险均为 AI 估计，风险为 10 年。'),
        h('div', { className: 'lp-table-wrap' },
          h('table', { className: 'lp-table lp-an-organs' },
            h('thead', null, h('tr', null, ...['器官', '测量和公式', '年龄 · AI 估计', '疾病风险 · 10 年 · AI 估计'].map((x) => h('th', { key: x, scope: 'col' }, x)))),
            h('tbody', null, ...cur.organs.map((o) => {
              const measures = [...o.measured, ...o.indices]
              return h('tr', { key: t(o.organ) },
                h('td', { className: 'lp-an-organ' }, t(o.label_zh)),
                h('td', { className: measures.length ? undefined : 'lp-an-none', 'data-label': '测量和公式' }, measures.length
                  ? h('ul', { className: 'lp-an-list' }, ...measures.map((r, i) => h('li', { key: `${t(r.id)}-${i}` },
                    h('span', { className: 'lp-muted' }, t(r.label_zh)), ' ', ...measureValue(r))))
                  : '—'),
                h('td', { className: o.ai_age ? undefined : 'lp-an-none', 'data-label': '年龄' }, o.ai_age
                  ? h('div', { className: 'lp-an-est' }, h('span', { className: 'lp-num lp-an-val' }, valueText(o.ai_age)),
                    rangeText(o.ai_age) ? h('span', { className: 'lp-caption lp-num' }, rangeText(o.ai_age)) : null)
                  : '—'),
                h('td', { className: o.ai_risks.length || o.overrides.length ? undefined : 'lp-an-none', 'data-label': '疾病风险' }, o.ai_risks.length || o.overrides.length
                  ? h('ul', { className: 'lp-an-list' },
                    ...o.ai_risks.map((r, i) => h('li', { key: `${t(r.id)}-${i}`, className: 'lp-an-est' },
                      h('span', null, cleanLabel(t(r.label_zh)), ' ', h('span', { className: 'lp-num lp-an-val' }, valueText(r))),
                      rangeText(r) ? h('span', { className: 'lp-caption lp-num' }, rangeText(r)) : null)),
                    ...o.overrides.map((x, i) => h('li', { key: `o-${i}`, className: 'lp-an-est' },
                      h('span', { className: 'lp-strong' }, t(x.disease)), h('span', { className: 'lp-caption lp-warn-ink' }, t(x.message_zh)))))
                  : '—'))
            })))))) : null,

    cur && cur.board.length ? h(Section, { title: '问题看板', aside: h('span', { className: 'lp-caption' }, '每个问题由一位独立 AI 研究员查证') },
      h('div', { className: 'lp-stack' }, ...cur.board.map((b) => h(QuestionCard, { key: t(b.id), row: b })))) : null,

    cur && back ? h(Section, { title: '干预方案' },
      h('div', { className: 'lp-card' },
        back.items.length ? h('ul', { className: 'lp-rows' }, ...back.items.map((i) => h('li', { key: t(i.id), className: 'lp-row lp-row-stack' },
          h('span', { className: 'lp-strong' }, t(i.title)),
          i.detail ? h('span', { className: 'lp-muted' }, t(i.detail)) : null,
          i.markers.length ? h('span', { className: 'lp-caption' }, `复测指标：${i.markers.map(t).join('、')}`) : null)))
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
            : h(Btn, { onClick: () => { void accept(back) }, disabled: disabled || !back.ok }, '我已阅读，接受方案')))) : null)
}

/** One card for where things stand: a run in progress, a stopped run, a finished run to import, or why not yet. */
function StatusCard(props: {
  status: Status; running: Run | null; stopped: Run | null; ready: Run | null; disabled: boolean
  onAbandon: (id: string) => void; onImport: (id: string) => void
}): React.ReactElement | null {
  const { status, running, stopped, ready, disabled } = props
  const run = running ?? stopped
  const [showSteps, setShowSteps] = React.useState(false)

  if (run) {
    const total = run.stages.length
    const now = running ? run.stages.findIndex((s) => !s.done) : -1
    // A live run that has made progress shows every step; a stalled or not-yet-started one folds them into a line.
    const folded = !running || run.done === 0
    const firstOpen = run.stages.findIndex((s) => !s.done)
    const at = firstOpen < 0 ? Math.max(total - 1, 0) : firstOpen
    const nowLabel = run.stages[at]?.label_zh ?? ''
    const summary = running
      ? `正在进行第 1 步${nowLabel ? `「${t(nowLabel)}」` : ''} · 共 ${total} 步`
      : `停在第 ${at + 1} 步${nowLabel ? `「${t(nowLabel)}」` : ''} · 共 ${total} 步`
    return h('div', { className: 'lp-card lp-an-prose' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-h3' }, running ? '分析进行中' : '上次分析未完成'),
        // folded, the line below already says where it stands
        folded ? null : h('span', { className: 'lp-caption lp-num', role: 'status', 'aria-label': `已完成 ${run.done} 步，共 ${total} 步` }, `${run.done}/${total}`)),
      h('div', { className: 'lp-bar', role: 'progressbar', 'aria-label': '分析进度', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': run.done },
        h('span', { style: { width: `${total ? Math.round((run.done / total) * 100) : 0}%` } })),
      folded ? h('div', { className: 'lp-an-fold' },
        h('span', { className: 'lp-small' }, summary),
        h('button', { type: 'button', className: 'lp-textbtn', 'aria-expanded': showSteps, 'aria-controls': 'lp-an-steps', onClick: () => setShowSteps((v) => !v) }, showSteps ? '收起步骤' : '展开步骤')) : null,
      folded && !showSteps ? null : h('ol', { className: 'lp-progress-steps', id: 'lp-an-steps' }, ...run.stages.map((s, i) => h('li', {
        key: s.key, className: `lp-progress-step${s.done ? ' is-done' : i === now ? ' is-now' : ''}`, 'aria-current': i === now ? 'step' : undefined,
      },
      h('span', { className: 'lp-progress-dot', 'aria-hidden': true }, s.done ? h(Icon, { name: 'check', size: 12, strokeWidth: 2 }) : null),
      h('span', null, s.label_zh, s.done ? h('span', { className: 'lp-sr' }, '（已完成）') : null)))),
      running && run.reason_zh ? h('p', { className: 'lp-small lp-muted' }, `${run.trigger === 'ai' ? 'LongPi 发起' : '你发起'}：${t(run.reason_zh)}`) : null,
      running ? null : h('p', { className: 'lp-small lp-muted' }, '可回到原对话输入「继续」，或放弃后重新发起。'),
      run.state_error ? h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'warn', size: 16 }), h('div', { className: 'lp-callout-body' }, t(run.state_error))) : null,
      ready ? h('div', { className: 'lp-callout lp-callout-good' }, h(Icon, { name: 'check', size: 16 }),
        h('div', { className: 'lp-callout-body' }, '另有一份分析已完成，可以先导入。', h('div', null, h(Btn, { onClick: () => props.onImport(ready.id), disabled }, '导入结果')))) : null,
      h('div', { className: 'lp-card-foot' },
        h('span', { className: 'lp-caption' }, running ? '每 15 秒自动刷新' : ''),
        h(Btn, { variant: 'outline', onClick: () => props.onAbandon(run.id), disabled }, '放弃这次分析')))
  }

  if (ready) {
    return h('div', { className: 'lp-card lp-an-prose', role: 'status' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, '有一份新的分析已完成')),
      h('p', { className: 'lp-text lp-muted' }, '导入后可在此查看报告、器官体检表和方案。'),
      h('div', { className: 'lp-card-foot' },
        h('span', { className: 'lp-caption' }, '导入后，报告和问题看板会显示在下面。'),
        h(Btn, { onClick: () => props.onImport(ready.id), disabled }, '导入结果')))
  }

  const blocked = status.blockers
  if (blocked) {
    return h('div', { className: 'lp-card lp-an-prose', role: 'status' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, '暂时无法进行')),
      h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'info', size: 16 }), h('div', { className: 'lp-callout-body' }, t(blocked.reply_zh))))
  }

  const readiness = status.readiness
  if (!readiness) return null
  return h('div', { className: 'lp-card lp-an-prose', role: 'status' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-h3' }, readiness.auto_on ? 'LongPi 的判断' : '当前状态')),
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
  const facts: Array<[string, number, string]> = [
    ['器官', cur.organs.length, '个'],
    ['问题', cur.board.length, '个'],
    ['方案', props.planItems, '项'],
    ['复测', cur.retests.length, '项'],
  ]
  return h('div', { className: 'lp-card' },
    h('dl', { className: 'lp-an-facts' }, ...facts.map(([label, value, unit]) => h('div', { key: label, className: 'lp-an-fact' },
      h('dt', { className: 'lp-caption' }, label), h('dd', { className: 'lp-an-fact-value' }, h('span', { className: 'lp-num-md' }, String(value)), h('span', { className: 'lp-unit' }, unit))))),
    headline.length ? h('dl', { className: 'lp-kv' }, ...headline.flatMap((r, i) => [
      h('dt', { key: `k${i}` }, t(r.label_zh)), h('dd', { key: `v${i}`, className: 'lp-num' }, fmt(r))])) : null,
    pageBoundary(t(cur.boundary_zh)) ? h('p', { className: 'lp-caption' }, pageBoundary(t(cur.boundary_zh))) : null,
    h('div', { className: 'lp-card-foot' },
      h('span', { className: 'lp-caption' }, '完整报告在新标签页打开'),
      h('a', { className: 'lp-linkbtn lp-btn-primary', href, target: '_blank', rel: 'noopener noreferrer' }, '打开完整报告', h(Icon, { name: 'chevron', size: 14 }))))
}

/** First sentence of a conclusion, cut to about two lines at a clause break; the whole text then goes under the fold. */
const LEAD_MAX = 80
function splitFirst(text: string): [string, string] {
  const m = /^[\s\S]*?[。！？!?](?=\s*\S)/.exec(text)
  const [first, rest] = m ? [m[0], text.slice(m[0].length).trim()] : [text, '']
  if (first.length <= LEAD_MAX) return [first, rest]
  const head = first.slice(0, LEAD_MAX)
  const cut = Math.max(head.lastIndexOf('；'), head.lastIndexOf('，'), head.lastIndexOf('：'))
  return [`${cut > 20 ? head.slice(0, cut) : head}…`, text]
}

function QuestionCard(props: { row: BoardRow }): React.ReactElement {
  const b = props.row
  const conf = Object.prototype.hasOwnProperty.call(CONF_ZH, t(b.confidence)) ? CONF_ZH[t(b.confidence)] : ''
  const verdict = t(b.verdict_zh)
  const summary = t(b.summary_zh)
  const [lead, more] = splitFirst(verdict && summary ? `${verdict}：${summary}` : verdict || summary)
  const limits = t(b.limitations_zh)
  const next = t(b.next_step_zh)
  return h('article', { className: 'lp-card lp-an-prose' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-h3' }, `${t(b.id)} ${t(b.title_zh)}`.trim()),
      conf ? h('span', { className: `lp-badge ${conf === '低' ? 'lp-badge-warn' : 'lp-badge-neutral'}` }, `可信度：${conf}`) : null),
    h('p', { className: 'lp-text' }, lead || '暂无结论。'),
    more || limits ? h('details', null,
      h('summary', null, limits ? '证据与局限' : '证据'),
      h('div', { className: 'lp-an-more' },
        more ? h('p', { className: 'lp-text lp-muted' }, more) : null,
        limits ? h('p', { className: 'lp-text lp-muted' }, `局限：${limits}`) : null)) : null,
    next ? h('p', { className: 'lp-an-next' }, h('span', { className: 'lp-muted' }, '下一步：'), next) : null)
}
