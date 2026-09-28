// Per-study consent: the explanation, the comprehension check, and withdraw.

import React from 'react'
import { postJson } from '../api.ts'

const h = React.createElement

export interface StudyQuestion { id: string; question_zh: string; options_zh: string[] }
export interface StudyRow {
  id: string
  title_zh: string
  summary_zh: string
  kind: string
  ethics_zh: string
  consented: 'none' | 'granted' | 'withdrawn' | 'declined'
  questions: StudyQuestion[]
  text_zh: string
}

export function ConsentPanel(props: { study: StudyRow; onChange: () => void; onError: (message: string) => void }): React.ReactElement {
  const [picked, setPicked] = React.useState<Record<string, number>>({})
  const [confirm, setConfirm] = React.useState(false)
  const [note, setNote] = React.useState('')
  const submit = () => {
    const answers = props.study.questions.map((question) => ({ id: question.id, choice: picked[question.id] ?? -1 }))
    void postJson('/api/longpi/science/consent', { confirm, study_id: props.study.id, answers, explained_by: 'page' })
      .then(() => { setNote('已记下同意。'); props.onChange() })
      .catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有记下'))
  }
  const withdraw = () => {
    void postJson('/api/longpi/science/withdraw', { study_id: props.study.id, confirm: true })
      .then(() => { setNote('已退出。'); props.onChange() })
      .catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有退出'))
  }
  const state = props.study.consented === 'granted' ? '已参加' : props.study.consented === 'withdrawn' ? '已退出' : '未参加'
  return h('article', { className: 'lp-card', id: `lp-study-${props.study.id}` },
    h('p', { className: 'lp-kicker' }, `${state} · ${props.study.kind === 'community_season' ? '社区季' : '研究'}`),
    h('h2', { className: 'lp-h2' }, props.study.title_zh),
    h('p', null, props.study.summary_zh),
    h('p', { className: 'lp-muted' }, props.study.ethics_zh),
    h('details', null, h('summary', null, '同意说明'), h('p', null, props.study.text_zh)),
    ...props.study.questions.map((question) => h('fieldset', { key: question.id, className: 'lp-sci-q' },
      h('legend', null, question.question_zh),
      ...question.options_zh.map((option, index) => h('label', { key: option },
        h('input', { type: 'radio', name: `${props.study.id}-${question.id}`, checked: picked[question.id] === index, onChange: () => setPicked({ ...picked, [question.id]: index }) }),
        ` ${option}`)))),
    h('label', { className: 'lp-sci-confirm' },
      h('input', { type: 'checkbox', checked: confirm, onChange: () => setConfirm(!confirm) }),
      ' 我看过说明，同意在这台电脑上参加'),
    h('div', { className: 'lp-actions' },
      h('button', { type: 'button', onClick: submit }, '提交同意'),
      h('button', { type: 'button', onClick: withdraw }, '退出这项研究')),
    note ? h('p', { className: 'lp-muted' }, note) : null)
}
