// Per-study consent: the explanation, the comprehension check, and withdraw.

import React from 'react'
import { postJson } from '../api.ts'
import { Btn } from '../ui.ts'
import { PLAIN_QUESTIONS } from '../../science/plain-copy.ts'

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

const PLAIN = PLAIN_QUESTIONS

export function ConsentPanel(props: { study: StudyRow; onChange: () => void; onError: (message: string) => void }): React.ReactElement {
  const questions = props.study.questions.slice(0, 2)
  const [picked, setPicked] = React.useState<Record<string, number>>({})
  const [note, setNote] = React.useState('')
  const ready = questions.every((question) => typeof picked[question.id] === 'number')
  const submit = () => {
    const answers = questions.map((question) => ({ id: question.id, choice: picked[question.id] ?? -1 }))
    void postJson('/api/longpi/science/consent', { confirm: true, plain: true, bundled_with_product: false, study_id: props.study.id, answers, explained_by: 'page' })
      .then(() => { setNote('已记下。研究正式开始后才会发出，现在只保存在你的设备上。'); props.onChange() })
      .catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有记下'))
  }
  const withdraw = () => {
    void postJson('/api/longpi/science/withdraw', { study_id: props.study.id, confirm: true })
      .then(() => { setNote('已退出。'); props.onChange() })
      .catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有退出'))
  }
  const state = props.study.consented === 'granted' ? '已参加' : props.study.consented === 'withdrawn' ? '已退出' : '未参加'
  return h('article', { className: 'lp-card', id: `lp-study-${props.study.id}` },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, props.study.title_zh)),
    h('div', { className: 'lp-tags' },
      h('span', { className: `lp-badge ${props.study.consented === 'granted' ? 'lp-badge-good' : 'lp-badge-neutral'}` }, state),
      h('span', { className: 'lp-tag' }, props.study.kind === 'community_season' ? '社区赛季' : '研究')),
    h('p', { className: 'lp-text' }, props.study.summary_zh),
    h('p', { className: 'lp-small lp-muted' }, '加入之后，研究正式开始才会把合计发出去。现在只保存在你的设备上。基因和姓名不参加。'),
    h('details', null, h('summary', null, '完整同意书'), h('p', { className: 'lp-small lp-muted' }, props.study.text_zh)),
    ...questions.map((question) => {
      const plain = PLAIN[question.id]
      const title = plain?.question_zh ?? question.question_zh
      const options = plain?.options_zh ?? question.options_zh
      return h('fieldset', { key: question.id, className: 'lp-sci-q' },
        h('legend', { className: 'lp-field-label' }, title),
        h('div', { className: 'lp-sci-options' },
          ...options.map((option, index) => h('label', { key: option, className: 'lp-check' },
            h('input', { type: 'radio', name: `${props.study.id}-${question.id}`, checked: picked[question.id] === index, onChange: () => setPicked({ ...picked, [question.id]: index }) }),
            h('span', null, option)))))
    }),
    h('div', { className: 'lp-actions' },
      h(Btn, { size: 'sm', disabled: !ready, onClick: submit }, '加入'),
      h(Btn, { size: 'sm', variant: 'outline', onClick: () => { void postJson('/api/longpi/science/invite', { decision: 'later' }).then(() => setNote('以后再说。本机上的功能还在。')).catch(() => setNote('以后再说。')) } }, '以后再说'),
      props.study.consented === 'granted' ? h(Btn, { size: 'sm', variant: 'outline', onClick: withdraw }, '退出这项研究') : null),
    h('p', { className: 'lp-caption' }, '已经发出的合计不会收回。'),
    note ? h('p', { className: 'lp-small', role: 'status' }, note) : null)
}
