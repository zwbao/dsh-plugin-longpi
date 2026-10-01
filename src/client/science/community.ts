// Progress, pulse, topic vote and contribution cards for the research tab.

import React from 'react'
import { postJson } from '../api.ts'
import { Icon } from '../icons.ts'
import { Btn } from '../ui.ts'
import { localText } from './consent.ts'

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
    void postJson('/api/longpi/science/community', { topic_id: topic }).then(() => props.onChange()).catch((error: unknown) => props.onError(error instanceof Error ? error.message : '保存失败'))
  }
  const recruiting = (props.thresholds ?? []).some((row) => row.line_zh.includes('招募中'))
  return h(React.Fragment, null,
    h('section', { className: 'lp-card', id: 'lp-science-progress', 'aria-labelledby': 'lp-science-progress-title' },
      h('div', { className: 'lp-card-head' },
        h('h3', { className: 'lp-card-title', id: 'lp-science-progress-title' }, '研究进度'),
        h('span', { className: 'lp-caption' }, `第 ${props.progress.week} 周 / 共 ${props.progress.weeks} 周`)),
      h('div', {
        className: 'lp-bar', role: 'progressbar', 'aria-label': `研究进度：${props.progress.label_zh}`,
        'aria-valuemin': 0, 'aria-valuenow': props.progress.contributed, 'aria-valuemax': props.progress.min_cohort,
      }, h('span', { style: { width: `${width}%` } })),
      h('p', { className: 'lp-small lp-muted lp-measure' }, recruiting
        ? '每项研究下方标注的是目标人数，目前正在招募。暂不显示已加入人数，人数也不代表你的结果。'
        : `这台电脑已参加 ${props.progress.studies} 项研究。发布的汇总数据至少包含 ${props.progress.min_cohort} 人。`)),
    h('section', { className: 'lp-card', id: 'lp-science-pulse', 'aria-label': '大家的结果' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '大家的结果')),
      props.pulse
        ? h(React.Fragment, null,
          h('p', { className: 'lp-text lp-strong' }, props.pulse.headline_zh),
          props.pulse.detail_zh ? h('p', { className: 'lp-small lp-muted lp-measure' }, localText(props.pulse.detail_zh)) : null)
        : h('div', { className: 'lp-empty' },
          h(Icon, { name: 'pulse', size: 20 }),
          h('p', { className: 'lp-empty-text lp-measure' }, localText(props.give_back_zh) || '暂无返回的群体结果。'))),
    h('section', { className: 'lp-card', id: 'lp-science-vote', 'aria-labelledby': 'lp-science-vote-title' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title', id: 'lp-science-vote-title' }, '下个赛季希望优先研究哪个问题')),
      h('div', { className: 'lp-sci-options', role: 'radiogroup', 'aria-labelledby': 'lp-science-vote-title' },
        ...props.voting.topics.map((item) => h('label', { key: item.id, className: 'lp-check' },
          h('input', { type: 'radio', name: 'lp-science-topic', value: item.id, checked: topic === item.id, onChange: () => setTopic(item.id) }),
          h('span', null, item.title_zh),
          h('span', { className: 'lp-sci-count', 'aria-label': `${item.votes} 票` }, String(item.votes))))),
      h('div', { className: 'lp-actions' },
        h(Btn, { variant: 'outline', onClick: vote, disabled: !topic }, '提交投票'),
        props.voting.note_zh ? h('span', { className: 'lp-caption' }, localText(props.voting.note_zh)) : null)),
    h('section', { className: 'lp-card', id: 'lp-science-cards', 'aria-label': '贡献卡' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '贡献卡')),
      props.cards.length === 0
        ? h('div', { className: 'lp-empty' },
          h(Icon, { name: 'spark', size: 20 }),
          h('p', { className: 'lp-empty-text lp-measure' }, '贡献卡记录你在这台电脑上参与研究的情况，与化验结果好坏无关。在这台电脑上完成计算后会显示在此处。'))
        : h('ul', { className: 'lp-rows' }, ...props.cards.map((card) => h('li', { key: card.id, className: 'lp-row lp-row-stack' },
          h('span', { className: 'lp-strong' }, card.title_zh),
          h('span', { className: 'lp-muted' }, card.body_zh))))))
}
