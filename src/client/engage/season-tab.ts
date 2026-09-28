// The season: a few quests, the unlock that replaces "还差 N 项检查", and the recap.

import React from 'react'
import { CodexPanel, type CodexView } from './codex.ts'
import { StreakLine, type StreakView } from './streak.ts'
import { SEASON_INTRO } from '../../ux/plain.ts'

function actionForQuest(title: string): Record<string, unknown> {
  if (/简报|看过医生/.test(title)) return { action: 'care_visit', with_brief: true }
  if (/约|医生/.test(title)) return { action: 'book' }
  if (/铁蛋白/.test(title)) return { action: 'addon', key: 'ferritin' }
  if (/C 反应|CRP|超敏/.test(title)) return { action: 'addon', key: 'hscrp' }
  if (/腰围/.test(title)) return { action: 'addon', key: 'waist' }
  if (/复测|复查/.test(title)) return { action: 'retest' }
  return { action: 'book' }
}

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
  invite?: null | { show: boolean; title_zh: string; body_zh: string; odds_path: string }
  family?: { available: boolean; opted: boolean; subject_zh: string | null }
  subject_zh?: string | null
}

export function SeasonPanel(props: {
  view: SeasonView
  busy: boolean
  note: string
  onAction: (body: unknown) => void
  onDraw: () => void
  onFreeze: (reason: 'sick' | 'travel') => void
  onOpt: (on: boolean) => void
  onRun?: (cardId: string) => void
}): React.ReactElement {
  const season = props.view.season
  if (props.view.invite?.show) {
    return h('div', { className: 'lp-season-invite', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      h('h2', { style: { margin: 0, fontSize: 18 } }, props.view.invite.title_zh),
      h('p', { style: { margin: 0 } }, props.view.invite.body_zh),
      props.view.subject_zh ? h('p', { style: { margin: 0 } }, `这个赛季用的是${props.view.subject_zh}的年龄和性别。`) : null,
      h('a', { href: props.view.invite.odds_path }, '概率说明'),
      h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'opt_in' }) }, '开始这个赛季'),
        h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'decline_invite' }) }, '先不用')),
      props.note ? h('p', { style: { margin: 0 } }, props.note) : null)
  }
  if (props.view.pressure !== true) {
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      h('p', { style: { margin: 0 } }, '这个赛季先不推。想开始时点下面。'),
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'opt_in' }) }, '开始这个赛季'),
      props.view.streak.frozen.length > 0 ? h(StreakLine, { streak: props.view.streak, onFreeze: props.onFreeze, busy: props.busy }) : null,
      props.note ? h('p', { style: { margin: 0 } }, props.note) : null)
  }
  const shown = props.view.quests.slice(0, 5)
  const ratio = season ? Math.min(1, season.week / Math.max(1, season.weeks)) : 0
  return h('div', { className: 'lp-season', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    season ? h('div', null,
      h('h2', { style: { margin: 0, fontSize: 20 } }, `本赛季 · 第 ${season.week} 周 / 共 ${season.weeks} 周`),
      h('p', { className: 'lp-muted', style: { margin: '6px 0' } }, SEASON_INTRO),
      h('p', { style: { margin: '0 0 8px', fontWeight: 600 } }, season.title_zh),
      props.view.subject_zh ? h('p', { className: 'lp-caption', style: { margin: 0 } }, `按${props.view.subject_zh}的记录`) : null,
      h('div', { className: 'lp-season-bar-track', 'aria-label': `本赛季进度 ${season.week} / ${season.weeks}` },
        h('span', { style: { width: `${Math.round(ratio * 100)}%` } })),
      h('p', { className: 'lp-caption', style: { margin: '8px 0 0' } }, season.retest_day ? `复查 ${season.retest_day}` : `${season.start} → ${season.end}`)) : h('p', null, '这一赛季还没有开始。'),
    h('div', { className: 'lp-quest-grid' },
      ...shown.map((quest) => h('button', {
        key: quest.id,
        type: 'button',
        className: 'lp-quest-card',
        disabled: props.busy,
        onClick: () => props.onAction(actionForQuest(quest.title_zh)),
      },
        h('span', { className: 'lp-caption' }, quest.status === 'done' ? '做完了' : `${quest.progress}/${quest.count}`),
        h('span', { className: 'lp-strong' }, quest.title_zh)))),
    h('div', { className: 'lp-life-row' },
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onFreeze('sick') }, '今天生病'),
      h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onFreeze('travel') }, '今天出行'),
      h('span', { className: 'lp-caption' }, '生病或出行的这一天：不算中断，也不算完成。')),
    season?.status === 'closed' ? h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'next_season' }) }, '开始下一个赛季') : null,
    season?.recap_zh ? h('div', null, h('div', { style: { fontWeight: 600 } }, '这一赛季的回看'), h('p', { style: { margin: '4px 0 0' } }, season.recap_zh)) : null,
    props.view.family?.available ? h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      props.view.family.opted
        ? h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'share_recap' }) }, '把这个赛季的回看发给家人')
        : h('button', { type: 'button', style: buttonStyle, disabled: props.busy, onClick: () => props.onAction({ action: 'family_on' }) }, '打开家人圈')) : null,
    h(CodexPanel, { codex: props.view.codex, onDraw: props.onDraw, onOpt: props.onOpt, onRun: props.onRun, busy: props.busy, note: props.note }))
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--lp-line-2, rgba(0,0,0,.12))', background: 'transparent', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: 'var(--lp-ink)', font: 'inherit',
}
