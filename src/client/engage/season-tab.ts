// The season: a few quests, the unlock that replaces "还差 N 项检查", and the recap.

import React from 'react'
import { CodexPanel, type CodexView } from './codex.ts'
import { StreakLine, type StreakView } from './streak.ts'

const h = React.createElement

export interface SeasonView {
  needs_consent?: boolean
  /** False until they opt in. The panel then does not push quests. */
  pressure?: boolean
  season: null | {
    title_zh: string
    status: string
    week: number
    weeks: number
    start: string
    end: string
    retest_day: string | null
    chapters: Array<{ week: number; title_zh: string }>
    recap_zh: string | null
  }
  quests: Array<{ id: string; title_zh: string; status: string; progress: number; count: number; reward_zh: string }>
  unlocks: Array<{ key: string; teaser_zh: string; status: string }>
  streak: StreakView
  codex: CodexView
  weekly_zh: string | null
  reminder_zh: string | null
  nudge?: { offer: boolean; enabled: boolean }
}

const STATUS: Record<string, string> = { active: '进行中', retest_window: '复测窗口', closed: '已结束', upcoming: '还没开始' }

export function SeasonPanel(props: {
  view: SeasonView
  busy: boolean
  note: string
  onAction: (body: unknown) => void
  onDraw: () => void
  onFreeze: (reason: 'sick' | 'travel') => void
  onOpt: (on: boolean) => void
}): React.ReactElement {
  const season = props.view.season
  if (props.view.pressure !== true) {
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      h('p', { style: { margin: 0 } }, '这一季先不推。想开始时点下面。'),
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'opt_in' }) }, '开始这一季'),
      props.view.streak.frozen.length > 0 ? h(StreakLine, { streak: props.view.streak, onFreeze: props.onFreeze, busy: props.busy }) : null,
      props.note ? h('p', { style: { margin: 0 } }, props.note) : null)
  }
  const chapter = season?.chapters.find((row) => row.week === season.week)
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    season ? h('div', null,
      h('div', { style: { fontWeight: 600 } }, season.title_zh),
      h('div', { style: { opacity: 0.75 } }, `第 ${season.week} / ${season.weeks} 周 · ${STATUS[season.status] ?? season.status}${chapter ? ` · ${chapter.title_zh}` : ''}`),
      h('div', { style: { opacity: 0.75 } }, `${season.start} → ${season.end}${season.retest_day ? ` · 复测 ${season.retest_day}` : ''}`)) : h('p', null, '这一季还没有开始。'),
    props.view.reminder_zh ? h('p', { style: { margin: 0 } }, props.view.reminder_zh) : null,
    h('div', null, props.view.unlocks.map((unlock) => h('div', { key: unlock.key }, unlock.status === 'unlocked' ? `已解锁：${unlock.teaser_zh}` : unlock.teaser_zh))),
    h('ul', { style: { margin: 0, paddingLeft: 18 } }, props.view.quests.map((quest) =>
      h('li', { key: quest.id }, `${quest.status === 'done' ? '完成' : '未完成'} ${quest.progress}/${quest.count} · ${quest.title_zh}`))),
    h(StreakLine, { streak: props.view.streak, onFreeze: props.onFreeze, busy: props.busy }),
    h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'care_visit', with_brief: true }) }, '我带着简报看过医生了'),
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'addon', key: 'hscrp' }) }, '已加测 hs-CRP'),
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'retest' }) }, '做了复测'),
      season?.status === 'closed' ? h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'next_season' }) }, '开始下一季') : null),
    props.view.weekly_zh ? h('pre', { style: { whiteSpace: 'pre-wrap', font: 'inherit', margin: 0 } }, props.view.weekly_zh) : null,
    season?.recap_zh ? h('div', null, h('div', { style: { fontWeight: 600 } }, '这一季的回看'), h('p', { style: { margin: '4px 0 0' } }, season.recap_zh)) : null,
    h(CodexPanel, { codex: props.view.codex, onDraw: props.onDraw, onOpt: props.onOpt, busy: props.busy, note: props.note }))
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--lp-line-2, rgba(0,0,0,.12))', background: 'transparent', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: 'var(--lp-ink)', font: 'inherit',
}
