// Progress, pulse, topic vote and contribution cards for the research tab.

import React from 'react'
import { postJson } from '../api.ts'

const h = React.createElement

export interface VoteTopic { id: string; title_zh: string; votes: number }
export interface ScienceCard { id: string; title_zh: string; body_zh: string }

export function CommunityPanel(props: {
  progress: { label_zh: string; contributed: number; studies: number; min_cohort: number; week: number; weeks: number }
  pulse: { headline_zh: string; detail_zh: string } | null
  give_back_zh: string
  voting: { topics: VoteTopic[]; mine: string | null; note_zh: string }
  cards: ScienceCard[]
  thresholds?: Array<{ study_id: string; title_zh: string; line_zh: string }>
  early_zh?: string
  release_stays_zh?: string
  onChange: () => void
  onError: (message: string) => void
}): React.ReactElement {
  const [topic, setTopic] = React.useState(props.voting.mine ?? '')
  const width = props.progress.min_cohort > 0 ? Math.min(100, Math.round(100 * props.progress.contributed / props.progress.min_cohort)) : 0
  const vote = () => {
    void postJson('/api/longpi/science/community', { topic_id: topic }).then(() => props.onChange()).catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有记下'))
  }
  return h('div', null,
    h('section', { className: 'lp-section', id: 'lp-science-progress' },
      h('p', { className: 'lp-kicker' }, `研究进度 · 第 ${props.progress.week} 周 / 共 ${props.progress.weeks} 周`),
      h('h2', { className: 'lp-h2' }, props.progress.label_zh),
      h('div', { className: 'lp-sci-bar', role: 'progressbar', 'aria-valuenow': props.progress.contributed, 'aria-valuemax': props.progress.min_cohort },
        h('span', { style: { width: `${width}%` } })),
      ...(props.thresholds ?? []).map((row) => h('p', { key: row.study_id, className: 'lp-threshold' }, `${row.title_zh} ${row.line_zh}`)),
      props.early_zh ? h('p', null, props.early_zh) : null,
      (props.thresholds ?? []).some((row) => row.line_zh.includes('招募中'))
        ? h('p', null, '上面写的是这项研究想凑齐的人数，正在招募。现在不显示已经有多少人，也不把人数当成你的结果。')
        : h('p', null, `本机参加了 ${props.progress.studies} 项研究。发布合计至少 ${props.progress.min_cohort} 人。`),
      h('button', {
        type: 'button', className: 'lp-linkbtn',
        onClick: () => {
          void postJson('/api/longpi/science/n-of-1', { confirm: true, design: 'abab' }).then(() => props.onChange()).catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有排好'))
        },
      }, '开始个人对照')),
    h('section', { className: 'lp-section', id: 'lp-science-pulse' },
      h('p', { className: 'lp-kicker' }, '大家的结果'),
      props.pulse ? h('h2', { className: 'lp-h2' }, props.pulse.headline_zh) : h('h2', { className: 'lp-h2' }, '还没有大家的结果'),
      h('p', null, props.pulse?.detail_zh || props.give_back_zh)),
    h('section', { className: 'lp-section', id: 'lp-science-vote' },
      h('h2', { className: 'lp-h2' }, '下一季想先看哪一件'),
      h('div', { role: 'radiogroup', 'aria-label': '下一季题目' },
        ...props.voting.topics.map((item) => h('label', { key: item.id, className: 'lp-sci-topic' },
          h('input', { type: 'radio', name: 'lp-science-topic', value: item.id, checked: topic === item.id, onChange: () => setTopic(item.id) }),
          ` ${item.title_zh}`,
          h('span', { className: 'lp-muted' }, ` ${item.votes}`)))),
      h('button', { type: 'button', className: 'lp-linkbtn', onClick: vote, disabled: !topic }, '记下我的一票'),
      h('p', { className: 'lp-muted' }, props.voting.note_zh)),
    h('section', { className: 'lp-section', id: 'lp-science-cards' },
      h('h2', { className: 'lp-h2' }, '贡献卡'),
      h('p', { className: 'lp-muted' }, '贡献卡是你在这台电脑上参加研究之后留下的一张卡。它和化验结果好坏无关。'),
      props.cards.length === 0 ? h('p', { className: 'lp-muted' }, '完成本机计算后会出现在这里。')
        : props.cards.map((card) => h('article', { key: card.id, className: 'lp-card' }, h('h3', null, card.title_zh), h('p', null, card.body_zh)))))
}
