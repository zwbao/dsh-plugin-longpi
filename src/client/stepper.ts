// The page's journey stepper for the first days: 建档 · 连接记录 · 第一个结果.
// The current step is open; earlier ones can be reopened to change answers.

import React from 'react'
import { Icon } from './icons.ts'
import { ConsentInline, FirstResult, RecordsGuide } from './journey-steps.ts'
import { ProfileEditor } from './profile-editor.ts'
import type { Journey, Stage } from './types.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

const STEPS = [
  { key: 'profile', title: '建档', hint: '年龄、性别和 6 个问题' },
  { key: 'records', title: '连接记录', hint: '接上你的 Mirobody' },
  { key: 'first_result', title: '第一个结果', hint: '身体年龄和心血管风险' },
] as const

export type StepKey = (typeof STEPS)[number]['key']

export function stepOf(stage: Stage): number {
  if (stage === 'consent' || stage === 'profile') return 0
  if (stage === 'records') return 1
  if (stage === 'first_result') return 2
  return 3
}

export function JourneyStepper(props: {
  journey: Journey
  open: StepKey | null
  onOpen: (key: StepKey | null) => void
  onRecheck: () => Promise<void>
  onNotice: Notify
}): React.ReactElement {
  const current = stepOf(props.journey.stage)
  const openKey = props.open ?? STEPS[Math.min(current, 2)]?.key ?? 'profile'
  const body = (key: StepKey) => {
    if (key === 'profile') {
      return props.journey.consent.accepted
        ? h('div', { className: 'lp-step-body' },
          h(ProfileEditor, { journey: props.journey, variant: 'page', idPrefix: 'lp-step-profile', onNotice: props.onNotice }))
        : h(ConsentInline, { journey: props.journey, onNotice: props.onNotice })
    }
    if (key === 'records') return h(RecordsGuide, { journey: props.journey, onRecheck: props.onRecheck })
    return h(FirstResult, { journey: props.journey, onNotice: props.onNotice, idPrefix: 'lp-step-result', showResults: false })
  }
  return h('section', { className: 'lp-card lp-stepper', id: 'lp-stepper', 'aria-labelledby': 'lp-stepper-title' },
    h('div', { className: 'lp-stepper-head' },
      h('div', null,
        h('div', { className: 'lp-kicker' }, `开始使用 · 第 ${Math.min(current, 2) + 1} 步，共 3 步`),
        h('h2', { className: 'lp-h2', id: 'lp-stepper-title' }, props.journey.next.title_zh),
        h('p', { className: 'lp-muted lp-stepper-detail' }, props.journey.next.detail_zh))),
    h('ol', { className: 'lp-steps-bar' },
      ...STEPS.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo'
        const isOpen = openKey === step.key
        return h('li', { key: step.key, className: `lp-stepbar lp-stepbar-${state} ${isOpen ? 'lp-stepbar-open' : ''}` },
          h('button', {
            type: 'button', className: 'lp-stepbar-btn', 'aria-expanded': isOpen, 'aria-controls': `lp-step-${step.key}`,
            'aria-current': state === 'current' ? 'step' : undefined,
            onClick: () => props.onOpen(step.key),
          },
          h('span', { className: 'lp-stepbar-num', 'aria-hidden': true }, state === 'done' ? h(Icon, { name: 'check', size: 14, strokeWidth: 2 }) : String(index + 1)),
          h('span', { className: 'lp-stepbar-text' },
            h('span', { className: 'lp-stepbar-title' }, step.title),
            h('span', { className: 'lp-stepbar-hint' }, state === 'done' ? '已完成' : step.hint))))
      })),
    h('div', { className: 'lp-step-panel', id: `lp-step-${openKey}`, role: 'region', 'aria-label': STEPS.find((step) => step.key === openKey)?.title }, body(openKey)))
}
