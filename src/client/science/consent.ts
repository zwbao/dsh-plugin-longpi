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

const PLAIN: Record<string, { question_zh: string; options_zh: string[] }> = {
  live: {
    question_zh: '现在会把你的检查数据发出这台电脑吗？',
    options_zh: ['会，马上就发', '不会。研究正式开始前，只保存在你的设备上', '你一点同意就会发出去'],
  },
  who: {
    question_zh: '下面谁先不参加这个走路的小试验？',
    options_zh: ['谁都可以，包括正在打胰岛素的人', '正在打胰岛素，或在吃容易让血糖过低的药的人，先不参加', '只有不满 18 岁的人可以'],
  },
}

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
    h('p', { className: 'lp-kicker' }, `${state} · ${props.study.kind === 'community_season' ? '社区赛季' : '研究'}`),
    h('h2', { className: 'lp-h2' }, props.study.title_zh),
    h('p', null, props.study.summary_zh),
    h('p', { className: 'lp-muted' }, '加入之后，研究正式开始才会把合计发出去。现在只保存在你的设备上。基因和姓名不参加。'),
    h('details', null, h('summary', null, '完整同意书'), h('p', null, props.study.text_zh)),
    ...questions.map((question) => {
      const plain = PLAIN[question.id]
      const title = plain?.question_zh ?? question.question_zh
      const options = plain?.options_zh ?? question.options_zh
      return h('fieldset', { key: question.id, className: 'lp-sci-q' },
        h('legend', null, title),
        ...options.map((option, index) => h('label', { key: option },
          h('input', { type: 'radio', name: `${props.study.id}-${question.id}`, checked: picked[question.id] === index, onChange: () => setPicked({ ...picked, [question.id]: index }) }),
          ` ${option}`)))
    }),
    h('div', { className: 'lp-actions' },
      h('button', { type: 'button', className: 'lp-btn', disabled: !ready, onClick: submit }, '加入'),
      h('button', { type: 'button', onClick: () => { void postJson('/api/longpi/science/invite', { decision: 'later' }).then(() => setNote('以后再说。本机上的功能还在。')).catch(() => setNote('以后再说。')) } }, '以后再说'),
      props.study.consented === 'granted' ? h('button', { type: 'button', onClick: withdraw }, '退出这项研究') : null,
      h('span', { className: 'lp-muted' }, '已经发出的合计不会收回。')),
    note ? h('p', { className: 'lp-muted' }, note) : null)
}
