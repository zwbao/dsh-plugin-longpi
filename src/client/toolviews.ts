// LongPi in the chat: DSH renders a tool call through tool.call.toolview,
// keyed by the tool's wire name, so the calls people meet most get a card of
// their own instead of the generic row. Each card draws the running call, a
// failed one and the settled result, and keeps the raw result one click away
// (原始结果), as DSH's own row does. Every other LongPi tool keeps the generic
// row. The model's text reply is untouched: a card sits in the tool-call slot.
//
//   draft_intervention_plan   the draft: 去掉 per item, 采用这份方案 → the same
//                             confirm dialog as the page (with the reminder box)
//   save_intervention_plan    read-back: the items; saved: 已保存为方案第 N 版
//   log_intervention_checkin  已记录：… with 撤销 for today's entries
//   run_longevity_skill       PhenoAge / China-PAR: value, band, 模型估计;
//                             other skills: name, ok or not, the report
//   read_personal_situation   one quiet row; changes for a doctor as a warning

import React from 'react'
import { errorText } from './api.ts'
import { fmt } from './charts.ts'
import { postCheckIn } from './checkin.ts'
import { localToday, riskText, versusAge } from './format.ts'
import { Icon } from './icons.ts'
import { normalizePlanDraft } from './normalize.ts'
import { acceptDraft, ConfirmModal, DraftItems, keptGoals, type DraftSource } from './plan-draft.ts'
import { requestView, useCachedBoard, useJourney } from './store.ts'
import type { CheckState, Face, PlanDraft, PlanDraftResponse } from './types.ts'
import { Btn, readPref, writePref } from './ui.ts'

const h = React.createElement

type Raw = Record<string, unknown>

/** The share of DSH's ToolCallOwnerProps a LongPi card reads (dsh-client-ui-tool). */
export interface ToolViewProps extends Partial<Face> {
  callId: string
  toolName: string
  block: unknown
}

export interface ParsedCall {
  state: 'running' | 'error' | 'settled'
  args: Raw
  /** The parsed JSON result (settled), or null. */
  result: Raw | null
  /** The result text as it came (the raw view). */
  text: string
  error: string
}

function objectOf(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {}
}

function parseArgs(raw: unknown): Raw {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    return objectOf(JSON.parse(raw))
  } catch {
    return {}
  }
}

/**
 * A running call has name and argsRaw; a settled one is a tool-result node
 * with content blocks (LongPi's tools answer with one text block of JSON),
 * isError, and the call head when it is still in the window.
 */
export function parseCall(block: unknown): ParsedCall {
  const node = objectOf(block)
  if (node.kind !== 'tool-result') return { state: 'running', args: parseArgs(node.argsRaw), result: null, text: '', error: '' }
  const call = objectOf(node.call)
  const args = parseArgs(call.argsRaw)
  const content = Array.isArray(node.content) ? node.content : []
  const text = content.map((part) => {
    const row = objectOf(part)
    return row.type === 'text' && typeof row.text === 'string' ? row.text : JSON.stringify(part, null, 2)
  }).join('\n')
  if (node.isError === true) {
    const err = objectOf(node.error)
    const code = [err.name, err.code].filter((part) => typeof part === 'string' && part).join(': ')
    return { state: 'error', args, result: null, text, error: text.split('\n')[0] || code || '工具没有完成' }
  }
  let result: Raw | null = null
  try {
    result = objectOf(JSON.parse(text))
  } catch {
    result = null
  }
  return { state: 'settled', args, result, text, error: '' }
}

function prettyRaw(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/** The frame every card shares: a head row, the body, and the raw result behind 原始结果. */
function Shell(props: { call: ParsedCall; icon: string; title: string; summary?: React.ReactNode; tone?: 'warn' | 'bad'; quiet?: boolean; action?: React.ReactNode; children?: React.ReactNode }): React.ReactElement {
  const [raw, setRaw] = React.useState(false)
  const { call } = props
  const running = call.state === 'running'
  const rawText = call.state === 'running' ? '' : prettyRaw(call.text)
  return h('div', { className: `lp lp-tool ${props.quiet ? 'lp-tool-quiet' : 'lp-tool-card'} ${call.state === 'error' ? 'lp-tool-error' : ''}`, 'data-state': call.state },
    h('div', { className: 'lp-tool-head' },
      h('span', { className: `lp-tool-icon ${running ? 'lp-tool-running' : ''}`, 'aria-hidden': true }, h(Icon, { name: running ? 'refresh' : call.state === 'error' ? 'warn' : props.icon, size: 14, className: running ? 'lp-spin' : '' })),
      h('span', { className: 'lp-tool-title' }, props.title),
      props.summary != null ? h('span', { className: `lp-tool-summary ${props.tone ? `lp-tool-${props.tone}` : ''}` }, props.summary) : null,
      props.action ?? null,
      rawText ? h('button', { type: 'button', className: 'lp-tool-raw-btn', 'aria-expanded': raw, onClick: () => setRaw((current) => !current) },
        '原始结果', h(Icon, { name: 'chevron', size: 12, className: raw ? 'lp-rot' : '' })) : null),
    props.children ? h('div', { className: 'lp-tool-body' }, props.children) : null,
    raw && rawText ? h('pre', { className: 'lp-tool-raw' }, rawText) : null)
}

// --- draft_intervention_plan --------------------------------------------------------------

const ADOPTED_KEY = 'dsh-plugin-longpi.adopted.'

interface Adopted {
  version: number
  reminder: string | null
}

/** The plan version this call's draft was adopted as, remembered per call so the card says so after a reload. */
function adoptedOf(callId: string): Adopted | null {
  const version = Number(readPref(`${ADOPTED_KEY}${callId}`))
  return Number.isFinite(version) && version > 0 ? { version, reminder: null } : null
}

function DraftCard(props: { callId: string; data: PlanDraftResponse; draft: PlanDraft; source: DraftSource; saved: Adopted | null; onSaved: (saved: Adopted) => void; openPage?: () => void }): React.ReactElement {
  const { journey } = useJourney()
  const { draft, saved } = props
  const [removed, setRemoved] = React.useState<Set<string>>(new Set())
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const kept = draft.items.filter((item) => !removed.has(item.id))
  const goals = keptGoals(draft, kept)
  const toggle = (id: string) => setRemoved((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  async function accept(remind: boolean): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const result = await acceptDraft(draft, kept, remind, props.source)
      if (!result.ok) {
        setError(`没有保存：${result.error}`)
        return
      }
      writePref(`${ADOPTED_KEY}${props.callId}`, String(result.version))
      props.onSaved({ version: result.version, reminder: result.reminder })
      setConfirming(false)
    } catch (err) {
      setError(`没有保存：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }

  const openPlan = props.openPage ? () => { requestView({ tab: 'plan', id: 'lp-plan' }); props.openPage?.() } : null
  if (saved) {
    return h('div', { className: 'lp-tool-saved' },
      h('span', { className: 'lp-chip-saved' }, h(Icon, { name: 'check', size: 12, strokeWidth: 2 }), `已保存为方案第 ${saved.version} 版`),
      saved.reminder ? h('span', { className: 'lp-caption' }, `打卡提醒没有打开：${saved.reminder}`) : null,
      openPlan ? h('button', { type: 'button', className: 'lp-row-link', onClick: openPlan }, '在健康页查看 →') : null)
  }
  return h('div', { className: 'lp-tool-draft' },
    h(DraftItems, { draft, removed, onToggle: toggle, compact: true }),
    props.data.brief.notes_zh[0] ? h('p', { className: 'lp-fine' }, props.data.brief.notes_zh[0]) : null,
    h('div', { className: 'lp-form-actions' },
      h(Btn, { size: 'sm', onClick: () => { setError(null); setConfirming(true) }, disabled: kept.length === 0 }, '采用这份方案'),
      h('span', { className: 'lp-caption' }, '每项是试验里的平均效果，个人结果会不同；补剂不给剂量，不涉及处方药。')),
    confirming ? h(ConfirmModal, {
      draft, items: kept, goals, today: journey?.today ?? localToday(), busy, error,
      onCancel: () => setConfirming(false), onConfirm: (remind) => { void accept(remind) },
    }) : null)
}

/** The draft's focus (as the brief used it) and the markers the model asked for: the accept route rebuilds that brief. */
function draftSource(args: Raw, data: PlanDraftResponse): DraftSource {
  return { focus: data.brief.focus.map(String), markers: strings(args.markers) }
}

export function DraftToolView(props: ToolViewProps): React.ReactElement {
  const call = parseCall(props.block)
  // Held here, not in the card: the head says whether the draft was adopted.
  const [saved, setSaved] = React.useState<Adopted | null>(() => adoptedOf(props.callId))
  if (call.state === 'running') return h(Shell, { call, icon: 'spark', title: '起草方案', summary: '正在按你的结果和试验证据起草…' })
  if (call.state === 'error') return h(Shell, { call, icon: 'spark', title: '起草方案', summary: `没有完成：${call.error}`, tone: 'bad' })
  let data: PlanDraftResponse | null = null
  try {
    data = call.result ? normalizePlanDraft(call.result) : null
  } catch {
    data = null
  }
  if (!data) return h(Shell, { call, icon: 'spark', title: '起草方案', summary: '结果无法显示，展开看原始结果', tone: 'warn' })
  if (!data.draft) {
    return h(Shell, { call, icon: 'spark', title: '方案草稿', summary: '现在还起草不了' },
      h('p', { className: 'lp-muted' }, data.brief.notes_zh[0] || '记录里还没有能对上研究证据的指标。'))
  }
  return h(Shell, { call, icon: 'spark', title: '方案草稿', summary: saved ? `${data.draft.items.length} 项 · 已采用` : `${data.draft.items.length} 项 · 按证据起草 · 还没有保存` },
    h(DraftCard, { callId: props.callId, data, draft: data.draft, source: draftSource(call.args, data), saved, onSaved: setSaved, openPage: props.openPage }))
}

// --- save_intervention_plan -------------------------------------------------------------

/** "饮食｜地中海饮食；2025-10-20 起；看 hs-CRP": the category and title, then the rest. */
function readBackRow(text: string): { category: string; title: string; rest: string } {
  const [head = '', ...rest] = text.split('；')
  const [category = '', title = ''] = head.includes('｜') ? head.split('｜') : ['', head]
  return { category, title: title || head, rest: rest.join(' · ') }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string' && row.length > 0) : []
}

export function SaveToolView(props: ToolViewProps): React.ReactElement {
  const call = parseCall(props.block)
  const confirm = call.args.confirm === true
  const title = confirm ? '保存方案' : '核对方案'
  if (call.state === 'running') return h(Shell, { call, icon: 'check', title, summary: confirm ? '正在保存…' : '正在核对…' })
  if (call.state === 'error') return h(Shell, { call, icon: 'check', title, summary: `没有完成：${call.error}`, tone: 'bad' })
  const result = call.result ?? {}
  const readBack = strings(result.read_back)
  const warnings = strings(result.warnings)
  const errors = strings(result.errors)
  if (result.saved === true) {
    const version = typeof result.version === 'number' ? result.version : null
    const openPlan = props.openPage ? () => { requestView({ tab: 'plan', id: 'lp-plan' }); props.openPage?.() } : null
    return h(Shell, {
      call, icon: 'check', title: '保存方案', quiet: true,
      summary: h('span', { className: 'lp-chip-saved' }, h(Icon, { name: 'check', size: 12, strokeWidth: 2 }), version != null ? `已保存为方案第 ${version} 版` : '已保存'),
      action: openPlan ? h('button', { type: 'button', className: 'lp-tool-undo', onClick: openPlan }, '在健康页查看 →') : null,
    })
  }
  return h(Shell, { call, icon: 'check', title: '方案复述', summary: errors.length > 0 ? '还缺信息，没有保存' : '还没有保存，确认后才保存', tone: errors.length > 0 ? 'warn' : undefined },
    readBack.length > 0 ? h('ul', { className: 'lp-readback' },
      ...readBack.map((text, index) => {
        const row = readBackRow(text)
        return h('li', { key: index },
          row.category ? h('span', { className: 'lp-cat' }, row.category) : null,
          h('span', { className: 'lp-strong' }, row.title),
          row.rest ? h('span', { className: 'lp-caption' }, ` ${row.rest}`) : null)
      })) : null,
    ...errors.map((text) => h('p', { key: `e:${text}`, className: 'lp-form-error' }, text)),
    ...warnings.map((text) => h('p', { key: `w:${text}`, className: 'lp-caption lp-tool-warn' }, h(Icon, { name: 'warn', size: 12 }), ` ${text}`)))
}

// --- log_intervention_checkin -----------------------------------------------------------

interface LoggedEntry {
  item: string
  title: string
  date: string
  done: CheckState
  /** The entry took that day's check-in back. */
  undo: boolean
}

const UNDONE_KEY = 'dsh-plugin-longpi.undone.'

export function CheckinToolView(props: ToolViewProps): React.ReactElement {
  const call = parseCall(props.block)
  const { journey } = useJourney()
  const [undoing, setUndoing] = React.useState(false)
  const [undone, setUndone] = React.useState(() => readPref(`${UNDONE_KEY}${props.callId}`) === '1')
  const [error, setError] = React.useState<string | null>(null)
  if (call.state === 'running') return h(Shell, { call, icon: 'check', title: '打卡', summary: '正在记录…' })
  if (call.state === 'error') return h(Shell, { call, icon: 'check', title: '打卡', summary: `没有记下：${call.error}`, tone: 'bad' })
  const result = call.result ?? {}
  const entries: LoggedEntry[] = (Array.isArray(result.entries) ? result.entries : []).map((row) => {
    const entry = objectOf(row)
    return {
      item: String(entry.item ?? ''),
      title: typeof entry.title === 'string' ? entry.title : '',
      date: String(entry.date ?? ''),
      done: entry.done === true ? true : entry.done === false ? false : null,
      undo: entry.undo === true,
    }
  }).filter((row) => row.item)
  const problems = strings(result.problems)
  // The tool names each item; an older result only has the id, which today's items may still name.
  const titleOf = (row: LoggedEntry) => row.title || journey?.plan.checkin_items.find((item) => item.id === row.item)?.title || row.item
  const today = journey?.today ?? localToday()
  const nameOf = (row: LoggedEntry, withState: boolean) => `${titleOf(row)}${withState && row.done === false ? '（没做到）' : ''}${row.date && row.date !== today ? `（${row.date.slice(5)}）` : ''}`
  // Only a 完成 or 没做到 recorded for today can be taken back here; an undo or a note alone cannot.
  const answered = entries.filter((row) => !row.undo && row.done !== null)
  const undoable = answered.filter((row) => row.date === today)
  const recorded = undone ? answered.filter((row) => row.date !== today) : answered
  const taken = [...entries.filter((row) => row.undo), ...(undone ? undoable : [])]
  const noted = entries.filter((row) => !row.undo && row.done === null)
  const parts = [
    recorded.length > 0 ? `已记录：${recorded.map((row) => nameOf(row, true)).join('、')}` : '',
    taken.length > 0 ? `已撤销：${taken.map((row) => nameOf(row, false)).join('、')}` : '',
    noted.length > 0 ? `已记下备注：${noted.map((row) => nameOf(row, false)).join('、')}` : '',
  ].filter(Boolean)
  const onlyTaken = recorded.length === 0 && noted.length === 0

  async function undo(): Promise<void> {
    setUndoing(true)
    setError(null)
    try {
      for (const row of undoable) await postCheckIn(today, row.item, null)
      writePref(`${UNDONE_KEY}${props.callId}`, '1')
      setUndone(true)
    } catch (err) {
      setError(`没有撤销：${errorText(err, '请稍后再试')}`)
    } finally {
      setUndoing(false)
    }
  }

  if (entries.length === 0) {
    return h(Shell, { call, icon: 'check', title: '打卡', summary: '没有记下', tone: 'warn', quiet: true },
      ...problems.map((text) => h('p', { key: text, className: 'lp-caption' }, text)))
  }
  return h(Shell, {
    call, icon: 'check', title: '打卡', quiet: true,
    summary: h('span', { className: `lp-chip-saved ${onlyTaken ? 'lp-chip-undone' : ''}` },
      h(Icon, { name: onlyTaken ? 'close' : 'check', size: 12, strokeWidth: 2 }), parts.join('；')),
    action: !undone && undoable.length > 0
      ? h('button', { type: 'button', className: 'lp-tool-undo', disabled: undoing, onClick: () => { void undo() }, 'aria-label': `撤销今天的打卡：${undoable.map((row) => nameOf(row, true)).join('、')}` }, undoing ? '撤销中' : '撤销')
      : null,
  },
  error ? h('p', { className: 'lp-form-error' }, error) : null,
  ...problems.map((text) => h('p', { key: text, className: 'lp-caption' }, text)))
}

// --- run_longevity_skill ----------------------------------------------------------------

const PHENOAGE_SKILL = 'accelerated-biological-aging-risk'
const RISK_SKILL = 'china-par-ascvd-risk'

function outputValue(result: Raw, key: string): number | string | null {
  const row = objectOf(objectOf(result.outputs)[key])
  const value = row.value
  return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value ? value : null
}

function numberOf(value: number | string | null): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

/** The skill in plain Chinese when the cached board knows it; its first output's label otherwise; the id last. */
function skillName(board: ReturnType<typeof useCachedBoard>, name: string, result: Raw | null): string {
  const known = [...(board?.readiness?.ready ?? []), ...(board?.dispatch?.matches ?? []), ...(board?.near ?? [])].find((row) => row.name === name)
  if (known?.blurb) return known.blurb
  const outputs = Object.values(objectOf(result?.outputs)).map((row) => objectOf(row).label_zh).find((label) => typeof label === 'string' && label)
  return typeof outputs === 'string' ? outputs : name
}

function ResultFigure(props: { figure: string; unit: string; lines: string[] }): React.ReactElement {
  return h('div', { className: 'lp-tool-result' },
    h('span', { className: 'lp-tool-figure' }, props.figure, h('span', { className: 'lp-bignum-unit' }, props.unit)),
    h('span', { className: 'lp-tag', title: '模型根据你的记录计算的估计值，不是诊断' }, '模型估计'),
    ...props.lines.filter(Boolean).map((line) => h('span', { key: line, className: 'lp-caption' }, line)))
}

export function SkillToolView(props: ToolViewProps): React.ReactElement {
  const call = parseCall(props.block)
  const board = useCachedBoard()
  const { journey } = useJourney()
  const name = typeof call.args.name === 'string' ? call.args.name : ''
  const plain = name === PHENOAGE_SKILL ? '身体年龄' : name === RISK_SKILL ? '10 年心血管风险' : skillName(board, name, call.result)
  if (call.state === 'running') return h(Shell, { call, icon: 'play', title: `计算${plain}`, summary: '正在运行方法…' })
  if (call.state === 'error') return h(Shell, { call, icon: 'play', title: plain, summary: `没有算完：${call.error}`, tone: 'bad' })
  const result = call.result ?? {}
  if (result.ok !== true) {
    const reason = typeof result.error === 'string' && result.error ? result.error : typeof result.error_kind === 'string' ? result.error_kind : '方法没有给出结果'
    return h(Shell, { call, icon: 'play', title: plain, summary: `没有算出：${reason}`, tone: 'warn' })
  }
  if (name === PHENOAGE_SKILL) {
    const phenoage = numberOf(outputValue(result, 'phenoage'))
    const advance = numberOf(outputValue(result, 'phenoage_advance'))
    const band = journey?.results.bioage.band_years
    if (phenoage != null) {
      return h(Shell, { call, icon: 'play', title: '身体年龄', summary: typeof result.measured_at === 'string' ? `按 ${result.measured_at} 的血检` : undefined },
        h(ResultFigure, { figure: fmt(phenoage), unit: '岁', lines: [versusAge(advance), band != null ? `正常波动 ±${fmt(band)} 岁` : ''] }))
    }
  }
  if (name === RISK_SKILL) {
    const risk = numberOf(outputValue(result, 'risk_10y_pct'))
    const category = outputValue(result, 'risk_category')
    if (risk != null) {
      return h(Shell, { call, icon: 'play', title: '10 年心血管风险', summary: typeof result.measured_at === 'string' ? `按 ${result.measured_at} 的记录` : undefined },
        h(ResultFigure, { figure: riskText(risk), unit: '%', lines: [typeof category === 'string' ? category : '', 'China-PAR，同类人群的平均风险'] }))
    }
  }
  const excerpt = typeof result.report_excerpt === 'string' ? result.report_excerpt.trim() : ''
  return h(Shell, { call, icon: 'play', title: plain, summary: '已算出' },
    excerpt ? h('details', { className: 'lp-tool-report' }, h('summary', null, '报告'), h('pre', null, excerpt)) : null)
}

// --- read_personal_situation ------------------------------------------------------------

export function SituationToolView(props: ToolViewProps): React.ReactElement {
  const call = parseCall(props.block)
  if (call.state === 'running') return h(Shell, { call, icon: 'user', title: '读取档案与记录', quiet: true, summary: '正在读取…' })
  if (call.state === 'error') return h(Shell, { call, icon: 'user', title: '读取档案与记录', quiet: true, summary: `没有读到：${call.error}`, tone: 'bad' })
  const result = call.result ?? {}
  const indicators = typeof result.indicator_count === 'number' ? result.indicator_count : null
  const summary = objectOf(result.records_summary)
  const checkups = typeof summary.checkups === 'number' ? summary.checkups : null
  const counts = [checkups != null ? `${checkups} 次体检` : '', indicators != null ? `${indicators} 项指标` : ''].filter(Boolean).join('，')
  const changes = (Array.isArray(result.record_changes) ? result.record_changes : []).map(objectOf).filter((row) => row.ask_doctor === true)
  const failed = result.record_status === 'error' || result.record_status === 'partial'
  return h(Shell, { call, icon: 'user', title: counts ? `已读取你的档案与记录（${counts}）` : '已读取你的档案与记录', quiet: true },
    failed ? h('p', { className: 'lp-caption lp-tool-warn' }, h(Icon, { name: 'warn', size: 12 }), ` 有一部分记录没有读到${typeof result.record_error === 'string' && result.record_error ? `：${result.record_error}` : ''}`) : null,
    changes.length > 0 ? h('p', { className: 'lp-tool-doctor' }, h(Icon, { name: 'warn', size: 13 }),
      ` ${changes.slice(0, 3).map((row) => String(row.label_zh ?? '')).filter(Boolean).join('、')}${changes.length > 3 ? ` 等 ${changes.length} 项` : ''}的变化超出正常波动。${typeof changes[0]?.advice_zh === 'string' ? changes[0].advice_zh : ''}`) : null)
}

/** The keyed views, by wire tool name. */
export const TOOL_VIEWS: Record<string, (props: ToolViewProps) => React.ReactElement> = {
  draft_intervention_plan: DraftToolView,
  save_intervention_plan: SaveToolView,
  log_intervention_checkin: CheckinToolView,
  run_longevity_skill: SkillToolView,
  read_personal_situation: SituationToolView,
}
