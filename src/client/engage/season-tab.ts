// The season: a few quests, the unlock that replaces "还差 N 项检查", and the recap.

import React from 'react'
import { CodexPanel, type CodexView } from './codex.ts'
import { StreakLine, type StreakView } from './streak.ts'
import { SEASON_INTRO } from '../../ux/plain.ts'
import { Icon } from '../icons.ts'
import { Btn } from '../ui.ts'

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
  const note = props.note ? h('p', { className: 'lp-small', role: 'status' }, props.note) : null
  if (props.view.invite?.show) {
    return h('section', { className: 'lp-card', 'aria-label': props.view.invite.title_zh },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, props.view.invite.title_zh)),
      h('p', { className: 'lp-text' }, props.view.invite.body_zh),
      props.view.subject_zh ? h('p', { className: 'lp-caption' }, `这个赛季用的是${props.view.subject_zh}的年龄和性别。`) : null,
      h('a', { className: 'lp-textbtn', href: props.view.invite.odds_path }, '概率说明'),
      h('div', { className: 'lp-actions' },
        h(Btn, { disabled: props.busy, onClick: () => props.onAction({ action: 'opt_in' }) }, '开始这个赛季'),
        h(Btn, { variant: 'outline', disabled: props.busy, onClick: () => props.onAction({ action: 'decline_invite' }) }, '先不用')),
      note)
  }
  if (props.view.pressure !== true) {
    return h('section', { className: 'lp-card', 'aria-label': '赛季' },
      h('p', { className: 'lp-small lp-muted' }, '这个赛季先不推。想开始时点下面。'),
      h('div', { className: 'lp-actions' },
        h(Btn, { variant: 'outline', disabled: props.busy, onClick: () => props.onAction({ action: 'opt_in' }) }, '开始这个赛季')),
      props.view.streak.frozen.length > 0 ? h(StreakLine, { streak: props.view.streak, onFreeze: props.onFreeze, busy: props.busy }) : null,
      note)
  }
  const shown = props.view.quests.slice(0, 5)
  const ratio = season ? Math.min(1, season.week / Math.max(1, season.weeks)) : 0
  const family = props.view.family?.available
    ? props.view.family.opted
      ? h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy, onClick: () => props.onAction({ action: 'share_recap' }) }, '把这个赛季的回看发给家人')
      : h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy, onClick: () => props.onAction({ action: 'family_on' }) }, '打开家人圈')
    : null
  return h(React.Fragment, null,
    h('section', { className: 'lp-card', 'aria-label': '本赛季' },
      season
        ? h(React.Fragment, null,
          h('div', { className: 'lp-card-head' },
            h('h3', { className: 'lp-card-title' }, season.title_zh),
            h('span', { className: 'lp-caption' }, `本赛季 · 第 ${season.week} 周 / 共 ${season.weeks} 周`)),
          h('p', { className: 'lp-text lp-muted' }, SEASON_INTRO),
          props.view.subject_zh ? h('p', { className: 'lp-caption' }, `按${props.view.subject_zh}的记录`) : null,
          h('div', {
            className: 'lp-bar', role: 'progressbar', 'aria-label': '本赛季进度',
            'aria-valuemin': 0, 'aria-valuemax': season.weeks, 'aria-valuenow': season.week, 'aria-valuetext': `第 ${season.week} 周 / 共 ${season.weeks} 周`,
          }, h('span', { style: { width: `${Math.round(ratio * 100)}%` } })),
          h('p', { className: 'lp-caption' }, season.retest_day ? `复查 ${season.retest_day}` : `${season.start} → ${season.end}`))
        : h('p', { className: 'lp-small lp-muted' }, '这一赛季还没有开始。'),
      season?.status === 'closed' || family
        ? h('div', { className: 'lp-actions' },
          season?.status === 'closed' ? h(Btn, { size: 'sm', disabled: props.busy, onClick: () => props.onAction({ action: 'next_season' }) }, '开始下一个赛季') : null,
          family)
        : null,
      h('div', { className: 'lp-card-foot' },
        h('span', { className: 'lp-caption' }, '生病或出行的这一天：不算中断，也不算完成。'),
        h('div', { className: 'lp-actions' },
          h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy, onClick: () => props.onFreeze('sick') }, '今天生病'),
          h(Btn, { size: 'sm', variant: 'outline', disabled: props.busy, onClick: () => props.onFreeze('travel') }, '今天出行')))),
    shown.length > 0
      ? h('section', { className: 'lp-card', 'aria-label': '小目标' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '小目标')),
        h('div', { className: 'lp-season-quests' },
          ...shown.map((quest) => h('button', {
            key: quest.id,
            type: 'button',
            className: 'lp-row-btn',
            disabled: props.busy,
            onClick: () => props.onAction(actionForQuest(quest.title_zh)),
          },
          h('span', { className: 'lp-row-main' }, quest.title_zh),
          quest.status === 'done'
            ? h('span', { className: 'lp-badge lp-badge-good' }, '做完了')
            : h('span', { className: 'lp-caption lp-num' }, `${quest.progress}/${quest.count}`),
          h(Icon, { name: 'chevron', size: 14 })))))
      : null,
    season?.recap_zh
      ? h('section', { className: 'lp-card', 'aria-label': '这一赛季的回看' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '这一赛季的回看')),
        h('p', { className: 'lp-text' }, season.recap_zh))
      : null,
    h(CodexPanel, { codex: props.view.codex, onDraw: props.onDraw, onOpt: props.onOpt, onRun: props.onRun, busy: props.busy, note: props.note }))
}
