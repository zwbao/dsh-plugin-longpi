// The plan draft (方案草稿): what LongPi proposes from the person's own results
// and the collected trial evidence, before anything is saved. Each item shows
// what to do and one line of evidence (the trial average); the population, DOI
// and the goals open on request. Where it applies an item says 需先与医生确认;
// supplements never carry a dose, and no prescription medicine ever appears.
// The person drops items, then adopts the rest after a confirmation that lists
// exactly what will be saved and asks, in the same dialog, whether to remind
// them each evening. The page and the chat card share all of it.

import React from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { errorText, postJson } from './api.ts'
import { fmt } from './charts.ts'
import { behaviorOf, chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { notifyChanged, putFollowup, putPlanDraft, useFollowup, usePlanDraft } from './store.ts'
import type { AcceptResponse, DraftGoal, DraftItem, FollowupResponse, FollowupUpdate, Journey, PlanDraft, PlanDraftResponse } from './types.ts'
import { Btn, Skeleton } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

export const DRAFT_PROMPT = '帮我制定一份改善方案'

const METRIC_ZH: Record<string, string> = { dailySteps: '每日步数', dailyTotalSleepTime: '每晚睡眠' }
const UNIT_ZH: Record<string, string> = { count: '步', hours: '小时' }

/** Values as the server stated them (up to two decimals): what is shown is what gets saved. */
const num = (value: number) => fmt(value, 2)


function targetText(target: NonNullable<DraftItem['target']>): string {
  return `手环自动记录：${METRIC_ZH[target.metric] ?? target.metric} ${target.op === '>=' ? '≥' : '≤'} ${num(target.value)} ${UNIT_ZH[target.unit] ?? target.unit}`
}

function covers(items: DraftItem[], goal: DraftGoal): boolean {
  return items.some((item) => item.markers.includes(goal.marker))
}

/**
 * A goal is the latest value plus one item's trial effect. When the person
 * drops the item it came from, the goal goes too, even if another kept item
 * covers the marker: the server would base it on that item's effect, a value
 * the person never saw, so it is not saved. Older servers do not say which
 * item a goal came from: then it goes with the last item covering its marker.
 */
export function keptGoals(draft: PlanDraft, kept: DraftItem[]): DraftGoal[] {
  return draft.goals.filter((goal) => goal.basis_item_id
    ? kept.some((item) => item.id === goal.basis_item_id)
    : !covers(draft.items, goal) || covers(kept, goal))
}

/** The evidence behind one item, opened on request: population, DOI, whether the figure was checked. */
function EvidenceMore(props: { item: DraftItem }): React.ReactElement | null {
  const { evidence, target } = props.item
  if (!evidence.population && !evidence.doi && !target) return null
  return h('details', null,
    h('summary', null, '证据'),
    evidence.population ? h('p', { className: 'lp-caption lp-measure' }, `试验人群：${evidence.population}`) : null,
    evidence.doi ? h('p', { className: 'lp-caption lp-measure' }, '文献：', h('a', { href: `https://doi.org/${evidence.doi}`, target: '_blank', rel: 'noreferrer' }, `doi:${evidence.doi}`), evidence.verified ? '' : '（数据待核对）') : null,
    target ? h('p', { className: 'lp-caption lp-measure' }, targetText(target)) : null,
    h('p', { className: 'lp-caption lp-measure' }, '这是试验里的平均效果，个人结果会不同。'))
}

/** One line: what the trials found on average. */
function EvidenceLine(props: { item: DraftItem }): React.ReactElement {
  return h('p', { className: 'lp-draft-evidence' },
    h(Icon, { name: 'flask', size: 13 }),
    h('span', null, props.item.evidence.expected_zh || '有研究证据支持'))
}

export function DraftItemCard(props: { item: DraftItem; onRemove: () => void; compact?: boolean }): React.ReactElement {
  const item = props.item
  return h('li', { className: `lp-draft-item ${props.compact ? 'lp-draft-item-compact' : ''}` },
    h('div', { className: 'lp-draft-item-head' },
      h('div', { className: 'lp-draft-item-title' },
        item.category_zh ? h('span', { className: 'lp-tag' }, item.category_zh) : null,
        h('span', null, item.title),
        item.needs_doctor ? h('span', { className: 'lp-badge lp-badge-warn' }, h(Icon, { name: 'warn', size: 12 }), '需先与医生确认') : null),
      h('button', { type: 'button', className: 'lp-textbtn', onClick: props.onRemove, 'aria-label': `移除「${item.title}」` },
        h(Icon, { name: 'close', size: 12 }), '移除')),
    behaviorOf(item) ? h('p', { className: 'lp-draft-detail' }, behaviorOf(item)) : null,
    h(EvidenceLine, { item }),
    item.cautions_zh.length > 0 ? h('div', { className: 'lp-callout lp-callout-warn' },
      h(Icon, { name: 'warn', size: 14 }),
      h('div', { className: 'lp-callout-body' }, ...item.cautions_zh.map((text) => h('p', { key: text }, text)))) : null,
    h(EvidenceMore, { item }))
}

/**
 * The kept items with 去掉, and the dropped ones as chips to put back. saved: items the server already took
 * out (the page's 去掉 is saved, so they are no longer in the draft); their chips put them back the same way.
 */
export function DraftItems(props: { draft: PlanDraft; removed: Set<string>; onToggle: (id: string) => void; compact?: boolean; saved?: Array<{ id: string; title: string }>; busy?: boolean }): React.ReactElement {
  const kept = props.draft.items.filter((item) => !props.removed.has(item.id))
  const local = props.draft.items.filter((item) => props.removed.has(item.id)).map((item) => ({ id: item.id, title: item.title }))
  const gone = [...local, ...(props.saved ?? []).filter((row) => !local.some((item) => item.id === row.id) && !kept.some((item) => item.id === row.id))]
  return h('div', { className: 'lp-draft-block' },
    kept.length > 0
      ? h('ul', { className: 'lp-draft-items' }, ...kept.map((item) => h(DraftItemCard, { key: item.id, item, compact: props.compact, onRemove: () => props.onToggle(item.id) })))
      : h('p', { className: 'lp-small lp-muted lp-measure' }, '所有项目均已移除。可恢复其中一项，或在对话中说明希望如何调整。'),
    gone.length > 0 ? h('div', { className: 'lp-draft-removed' },
      h('span', { className: 'lp-caption' }, '已移除：'),
      ...gone.map((item) => h('button', { key: `${item.id}|${item.title}`, type: 'button', className: 'lp-toggle', disabled: props.busy, onClick: () => props.onToggle(item.id || item.title), 'aria-label': `恢复「${item.title}」` },
        h(Icon, { name: 'plus', size: 12 }), item.title))) : null)
}

/**
 * The page's 去掉 and 恢复: saved on the server (/api/longpi/plan-draft/exclude), so a removed item stays out
 * of every later draft, after a reload and in chat too. Answers with the draft as it now is.
 */
export async function setDraftItemExcluded(item: { id: string; title: string }, excluded: boolean): Promise<{ ok: true; data: PlanDraftResponse } | { ok: false; error: string }> {
  try {
    const result = await postJson<Record<string, unknown>>('/api/longpi/plan-draft/exclude', { id: item.id, title: item.title, excluded })
    if (result.ok !== true) return { ok: false, error: String(result.error ?? '保存失败') }
    putPlanDraft(result)
    notifyChanged()
    return { ok: true, data: result as unknown as PlanDraftResponse }
  } catch (err) {
    return { ok: false, error: errorText(err, '保存失败') }
  }
}

function Priorities(props: { brief: PlanDraftResponse['brief']; open?: boolean }): React.ReactElement | null {
  const rows = props.brief.priorities
  if (rows.length === 0) return null
  return h('details', { open: props.open },
    h('summary', null, '为什么是这几项'),
    h('ol', { className: 'lp-draft-priorities' },
      ...rows.map((row, index) => h('li', { key: `${row.marker_key}-${index}`, className: 'lp-draft-priority' },
        h('div', { className: 'lp-draft-priority-head' },
          h('span', { className: 'lp-strong' }, row.label_zh),
          row.value != null ? h('span', { className: 'lp-num' }, `${num(row.value)} ${row.unit}`) : null),
        h('div', { className: 'lp-caption' }, [row.why_zh, row.date ? `${chineseDate(row.date)}的记录` : ''].filter(Boolean).join(' · '))))))
}

export function DraftGoals(props: { goals: DraftGoal[]; dropped: number }): React.ReactElement | null {
  if (props.goals.length === 0 && props.dropped === 0) return null
  return h('details', null,
    h('summary', null, `目标（${props.goals.length} 个，按试验平均效应估算）`),
    props.goals.length > 0 ? h('ul', { className: 'lp-rows' },
      ...props.goals.map((goal) => h('li', { key: goal.marker, className: 'lp-row' },
        h('span', { className: 'lp-row-main lp-row-lines' }, h('span', { className: 'lp-strong' }, goal.marker), goal.basis_zh ? h('span', { className: 'lp-caption' }, goal.basis_zh) : null),
        h('span', { className: 'lp-row-end lp-num' }, `${num(goal.value)} ${goal.unit}`)))) : null,
    props.dropped > 0 ? h('p', { className: 'lp-caption lp-measure' }, `已移除项目对应的 ${props.dropped} 个目标也不会保存。`) : null)
}

/** The follow-up the adoption dialog turns on: desktop only, no health values (9b). */
export const REMIND_BODY: FollowupUpdate = { enabled: true, desktop: true, detail: 'minimal' }

/**
 * Whether to ask about the evening reminder, and at what time: not when it is
 * already on, nor where desktop notifications cannot be shown.
 */
function reminderOffer(data: FollowupResponse | null): { time: string } | null {
  if (data && !data.platform_desktop) return null
  if (data && data.settings.enabled && (data.settings.desktop || data.settings.webhook)) return null
  return { time: data?.settings.checkin_time ?? '21:00' }
}

export function ConfirmModal(props: {
  draft: PlanDraft
  items: DraftItem[]
  goals: DraftGoal[]
  today: string
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (remind: boolean) => void
}): React.ReactElement {
  const doctor = props.items.filter((item) => item.needs_doctor)
  const followup = useFollowup()
  const offer = reminderOffer(followup.data)
  const [remind, setRemind] = React.useState(true)
  return h(Modal, { open: true, title: '采用这份方案', onClose: props.busy ? () => {} : props.onCancel, headless: true, className: 'lp-confirm-dialog' },
    h('div', { className: 'lp lp-confirm' },
      h('h2', { className: 'lp-h2' }, '采用这份方案？'),
      h('p', { className: 'lp-muted lp-measure' }, `保存为你的方案「${props.draft.title || '改善方案'}」，从今天（${chineseDate(props.today)}）开始。此后按项目打卡，并按各项指标安排复测；如需调整，可随时在对话中提出。`),
      h('ul', { className: 'lp-confirm-list' },
        ...props.items.map((item) => h('li', { key: item.id },
          item.category_zh ? h('span', { className: 'lp-tag' }, item.category_zh) : null,
          h('span', null, item.title),
          item.needs_doctor ? h('span', { className: 'lp-badge lp-badge-warn' }, '需先与医生确认') : null))),
      props.goals.length > 0
        ? h('p', { className: 'lp-caption lp-measure' }, `目标：${props.goals.map((goal) => `${goal.marker} ${num(goal.value)} ${goal.unit}`).join('、')}（按试验平均效应估算，不是个人预测）`)
        : null,
      doctor.length > 0
        ? h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'warn', size: 14 }),
          h('p', { className: 'lp-callout-body' }, `${doctor.map((item) => `「${item.title}」`).join('')}需先与医生确认后再开始。方案里不含任何剂量。`))
        : null,
      offer ? h('label', { className: 'lp-checkrow', htmlFor: 'lp-confirm-remind' },
        h('input', { id: 'lp-confirm-remind', type: 'checkbox', checked: remind, disabled: props.busy, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRemind(event.target.checked) }),
        h('span', null, `每晚 ${offer.time} 提醒我打卡（不含健康数值）`)) : null,
      props.error ? h('p', { className: 'lp-form-error', role: 'alert' }, props.error) : null,
      h('div', { className: 'lp-modal-actions' },
        h(Btn, { variant: 'outline', onClick: props.onCancel, disabled: props.busy }, '暂不采用'),
        h(Btn, { 'data-modal-autofocus': true, onClick: () => props.onConfirm(offer != null && remind), disabled: props.busy }, props.busy ? '保存中…' : '确认采用'))))
}

/** The focus and markers a chat draft was made for, so the server rebuilds the same brief. */
export interface DraftSource {
  focus?: string[]
  markers?: string[]
}

/**
 * Save the kept items (and the goals that still have their item), then turn
 * the reminder on when the person left the box ticked. Unticked sends nothing.
 */
export async function acceptDraft(draft: PlanDraft, kept: DraftItem[], remind: boolean, source: DraftSource = {}): Promise<{ ok: true; version: number; items: number; reminder: string | null } | { ok: false; error: string }> {
  const goals = keptGoals(draft, kept)
  const result = await postJson<AcceptResponse>('/api/longpi/plan-draft/accept', {
    draft: { ...draft, items: kept, goals },
    ...(source.focus?.length ? { focus: source.focus } : {}),
    ...(source.markers?.length ? { markers: source.markers } : {}),
  })
  if (!result.ok) return { ok: false, error: (result.problems ?? []).join(' ') || result.error || '请稍后再试' }
  let reminder: string | null = null
  if (remind) {
    try {
      const saved = await postJson<{ ok: boolean; error?: string } & Partial<FollowupResponse>>('/api/longpi/followup', REMIND_BODY)
      if (!saved.ok) reminder = saved.error || '未能开启'
      else if (saved.settings) putFollowup(saved)
    } catch (err) {
      reminder = errorText(err, '未能开启')
    }
  }
  notifyChanged()
  return { ok: true, version: result.plan.version, items: result.plan.items, reminder }
}

function Hint(props: { onPrompt: (text: string) => void }): React.ReactElement {
  return h('span', { className: 'lp-caption lp-draft-hint' },
    '如需调整，请在对话中提出',
    h('button', { type: 'button', className: 'lp-textbtn', onClick: () => props.onPrompt(DRAFT_PROMPT) }, `「${DRAFT_PROMPT}」`))
}

function Draft(props: { data: PlanDraftResponse; draft: PlanDraft; journey: Journey; onNotice: Notify; onPrompt: (text: string) => void }): React.ReactElement {
  const { draft, data } = props
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // 0.5.3: 去掉 and 恢复 are saved on the server; the draft that comes back is what shows.
  const removed = React.useMemo(() => new Set<string>(), [])
  const kept = draft.items
  const goals = keptGoals(draft, kept)
  const toggle = (key: string) => {
    const inDraft = draft.items.find((item) => item.id === key)
    const saved = data.removed_items.find((row) => row.id === key || (!row.id && row.title === key))
    const target = inDraft ? { id: inDraft.id, title: inDraft.title } : saved
    if (!target) return
    setBusy(true)
    setError(null)
    void setDraftItemExcluded(target, Boolean(inDraft)).then((result) => {
      if (!result.ok) setError(`保存失败：${result.error}`)
      else props.onNotice(inDraft ? `已移除「${target.title}」，后续草稿不会再加入此项。` : `已恢复「${target.title}」。`, 'good')
    }).finally(() => setBusy(false))
  }

  async function accept(remind: boolean): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const result = await acceptDraft(draft, kept, remind)
      if (!result.ok) {
        setError(`保存失败：${result.error}`)
        return
      }
      setConfirming(false)
      props.onNotice(`已保存为方案第 ${result.version} 版，共 ${result.items} 项。${result.reminder ? `打卡提醒没有打开：${result.reminder}` : remind ? '每晚会提醒你打卡。' : ''}`, result.reminder ? 'info' : 'good')
    } catch (err) {
      setError(`保存失败：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }

  return h('div', { className: 'lp-card lp-draft' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title' }, draft.title || '改善方案'),
      h('span', { className: 'lp-caption' }, `方案草稿 · ${kept.length} 项 · 还没有保存`)),
    h('p', { className: 'lp-text lp-muted' }, '按你的检查结果和试验证据起草。每项注明试验里的平均效果，个人结果会不同；你确认后才保存。'),
    h(DraftItems, { draft, removed, onToggle: toggle, saved: data.removed_items, busy }),
    error && !confirming ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h(DraftGoals, { goals, dropped: draft.goals.length - goals.length }),
    h(Priorities, { brief: data.brief }),
    ...draft.notes_zh.map((text) => h('p', { key: text, className: 'lp-caption' }, text)),
    h('div', { className: 'lp-actions lp-draft-actions' },
      h(Btn, { onClick: () => { setError(null); setConfirming(true) }, disabled: kept.length === 0 }, '采用这份方案'),
      h(Hint, { onPrompt: props.onPrompt })),
    h('p', { className: 'lp-caption lp-measure' }, data.brief.boundary_zh || '只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。'),
    confirming ? h(ConfirmModal, {
      draft, items: kept, goals, today: props.journey.today, busy, error,
      onCancel: () => setConfirming(false), onConfirm: (remind) => { void accept(remind) },
    }) : null)
}

/** Items taken out on the page when no draft is left: each can be put back. */
function RestoreRow(props: { items: Array<{ id: string; title: string }>; onNotice: Notify }): React.ReactElement {
  const [busy, setBusy] = React.useState(false)
  return h('div', { className: 'lp-draft-removed' },
    h('span', { className: 'lp-caption' }, '已移除：'),
    ...props.items.map((item) => h('button', {
      key: `${item.id}|${item.title}`, type: 'button', className: 'lp-toggle', disabled: busy, 'aria-label': `恢复「${item.title}」`,
      onClick: () => {
        setBusy(true)
        void setDraftItemExcluded(item, false).then((result) => {
          props.onNotice(result.ok ? `已恢复「${item.title}」。` : `恢复失败：${result.error}`, result.ok ? 'good' : 'info')
        }).finally(() => setBusy(false))
      },
    }, h(Icon, { name: 'plus', size: 12 }), item.title)))
}

/** The plan section's empty state: the draft, or why there is none yet. */
export function PlanDraftCard(props: { journey: Journey; onNotice: Notify; onPrompt: (text: string) => void }): React.ReactElement {
  const { data, loading, error } = usePlanDraft()
  if (!data && loading) {
    return h('div', { className: 'lp-card lp-draft', 'aria-busy': true },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title' }, '方案草稿'),
        h('span', { className: 'lp-caption' }, '正在按你的结果和研究证据起草…')),
      h(Skeleton, { height: 72 }), h(Skeleton, { height: 72 }))
  }
  if (!data) {
    return h('div', { className: 'lp-card lp-draft' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '方案草稿')),
      h('p', { className: 'lp-small lp-muted lp-measure' }, `未能读取方案草稿：${error ?? '未返回数据'}。`),
      h(Hint, { onPrompt: props.onPrompt }))
  }
  if (!data.draft) {
    // The reasons first (no evidence for a focus, a change to show a doctor); the medication screen is fine print.
    const stop = data.brief.safety.stop_zh ?? ''
    const reasons = stop ? [stop, ...data.brief.notes_zh.filter((text) => text !== stop)] : data.brief.notes_zh
    const fine = stop ? [data.brief.boundary_zh].filter(Boolean) : [...new Set([...reasons.slice(1), ...data.brief.safety.notes_zh, data.brief.boundary_zh].filter(Boolean))]
    return h('div', { className: 'lp-card lp-draft' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title' }, stop ? '请先去看医生，再做方案' : '暂时无法起草方案'),
        h('span', { className: 'lp-caption' }, '方案草稿')),
      stop
        ? h('div', { className: 'lp-callout lp-callout-warn' }, h(Icon, { name: 'warn', size: 14 }), h('p', { className: 'lp-callout-body' }, reasons[0]))
        : h('p', { className: 'lp-text lp-muted' }, reasons[0] || '你的记录中暂无与研究证据匹配的指标。'),
      ...fine.map((text) => h('p', { key: text, className: 'lp-caption' }, text)),
      stop ? null : h(Priorities, { brief: data.brief, open: true }),
      !stop && data.removed_items.length > 0 ? h(RestoreRow, { items: data.removed_items, onNotice: props.onNotice }) : null,
      stop ? null : h(Hint, { onPrompt: props.onPrompt }))
  }
  return h(Draft, { data, draft: data.draft, journey: props.journey, onNotice: props.onNotice, onPrompt: props.onPrompt })
}
