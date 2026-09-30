// Progress, pulse, topic vote and contribution cards for the research tab.

import React from 'react'
import { postJson } from '../api.ts'
import { Btn } from '../ui.ts'

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
  const recruiting = (props.thresholds ?? []).some((row) => row.line_zh.includes('招募中'))
  return h(React.Fragment, null,
    h('section', { className: 'lp-card', id: 'lp-science-progress', 'aria-labelledby': 'lp-science-progress-title' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title', id: 'lp-science-progress-title' }, props.progress.label_zh),
        h('span', { className: 'lp-caption' }, `第 ${props.progress.week} 周 / 共 ${props.progress.weeks} 周`)),
      h('div', {
        className: 'lp-bar', role: 'progressbar', 'aria-label': props.progress.label_zh,
        'aria-valuemin': 0, 'aria-valuenow': props.progress.contributed, 'aria-valuemax': props.progress.min_cohort,
      }, h('span', { style: { width: `${width}%` } })),
      (props.thresholds ?? []).length > 0
        ? h('ul', { className: 'lp-rows' }, ...(props.thresholds ?? []).map((row) => h('li', { key: row.study_id, className: 'lp-row' },
          h('span', { className: 'lp-row-main' }, row.title_zh), h('span', { className: 'lp-row-end' }, row.line_zh))))
        : null,
      props.early_zh ? h('p', { className: 'lp-small' }, props.early_zh) : null,
      h('p', { className: 'lp-small lp-muted' }, recruiting
        ? '上面写的是这项研究想凑齐的人数，正在招募。现在不显示已经有多少人，也不把人数当成你的结果。'
        : `本机参加了 ${props.progress.studies} 项研究。发布合计至少 ${props.progress.min_cohort} 人。`),
      h('div', { className: 'lp-actions' },
        h(Btn, {
          size: 'sm', variant: 'outline',
          onClick: () => {
            void postJson('/api/longpi/science/n-of-1', { confirm: true, design: 'abab' }).then(() => props.onChange()).catch((error: unknown) => props.onError(error instanceof Error ? error.message : '没有排好'))
          },
        }, '开始个人对照'))),
    h('section', { className: 'lp-card', id: 'lp-science-pulse', 'aria-label': '大家的结果' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '大家的结果')),
      props.pulse ? h('p', { className: 'lp-strong' }, props.pulse.headline_zh) : h('p', { className: 'lp-small lp-muted' }, '还没有大家的结果'),
      (props.pulse?.detail_zh || props.give_back_zh) ? h('p', { className: 'lp-small lp-muted' }, props.pulse?.detail_zh || props.give_back_zh) : null),
    h('section', { className: 'lp-card', id: 'lp-science-vote', 'aria-labelledby': 'lp-science-vote-title' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title', id: 'lp-science-vote-title' }, '下个赛季想先看哪一件')),
      h('div', { className: 'lp-sci-options', role: 'radiogroup', 'aria-labelledby': 'lp-science-vote-title' },
        ...props.voting.topics.map((item) => h('label', { key: item.id, className: 'lp-check' },
          h('input', { type: 'radio', name: 'lp-science-topic', value: item.id, checked: topic === item.id, onChange: () => setTopic(item.id) }),
          h('span', null, item.title_zh),
          h('span', { className: 'lp-sci-count', 'aria-label': `${item.votes} 票` }, String(item.votes))))),
      h('div', { className: 'lp-actions' },
        h(Btn, { size: 'sm', variant: 'outline', onClick: vote, disabled: !topic }, '记下我的一票'),
        props.voting.note_zh ? h('span', { className: 'lp-caption' }, props.voting.note_zh) : null)),
    h('section', { className: 'lp-card', id: 'lp-science-cards', 'aria-label': '贡献卡' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '贡献卡')),
      h('p', { className: 'lp-small lp-muted' }, '贡献卡是你在这台电脑上参加研究之后留下的一张卡。它和化验结果好坏无关。'),
      props.cards.length === 0
        ? h('p', { className: 'lp-caption' }, '完成本机计算后会出现在这里。')
        : h('ul', { className: 'lp-rows' }, ...props.cards.map((card) => h('li', { key: card.id, className: 'lp-row lp-row-stack' },
          h('span', { className: 'lp-strong' }, card.title_zh),
          h('span', { className: 'lp-muted' }, card.body_zh))))))
}
