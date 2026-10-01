// The 研究 tab: studies, consent, the community season and the transparency log.

import React from 'react'
import { errorText, getJson } from '../api.ts'
import { Icon } from '../icons.ts'
import { CommunityPanel } from './community.ts'
import { ConsentPanel, type StudyRow } from './consent.ts'
import { TranslogPanel, type LogRow } from './translog.ts'
import type { ScienceCard, VoteTopic } from './community.ts'

const h = React.createElement

interface Payload {
  mode: 'off' | 'local' | 'simulated' | 'live'
  reason_zh?: string
  studies?: StudyRow[]
  progress?: { label_zh: string; contributed: number; studies: number; min_cohort: number; week: number; weeks: number }
  pulse?: { headline_zh: string; detail_zh: string } | null
  voting?: { topics: VoteTopic[]; mine: string | null; note_zh: string }
  give_back_zh?: string
  cards?: ScienceCard[]
  translog?: LogRow[]
  thresholds?: Array<{ study_id: string; title_zh: string; line_zh: string; early: boolean }>
  early_zh?: string
  release_stays_zh?: string
}

export function StudiesTab(): React.ReactElement {
  const [data, setData] = React.useState<Payload | null>(null)
  const [error, setError] = React.useState('')
  const load = React.useCallback(() => {
    void getJson<Payload>('/api/longpi/science/community').then(setData).catch((reason: unknown) => setError(errorText(reason, '没有读到研究')))
  }, [])
  React.useEffect(() => { load() }, [load])
  if (!data) {
    return h('div', { className: 'lp-tab-body' },
      error
        ? h('div', { className: 'lp-callout lp-callout-warn', role: 'alert' }, h(Icon, { name: 'warn', size: 14 }), h('p', { className: 'lp-callout-body' }, error),
          h('button', { type: 'button', className: 'lp-textbtn', onClick: () => { setError(''); load() } }, '重试'))
        : h('p', { className: 'lp-small lp-muted lp-measure' }, '正在读取研究…'))
  }
  if (data.mode === 'off') {
    return h('div', { className: 'lp-tab-body' },
      h('section', { className: 'lp-card', 'aria-label': '研究没有打开' },
        h('div', { className: 'lp-empty' },
          h('div', { className: 'lp-empty-title' }, '研究没有打开'),
          h('p', { className: 'lp-empty-text' }, data.reason_zh || '可以在设置里再打开。不满 18 岁不参加研究。'))))
  }
  return h('div', { className: 'lp-tab-body' },
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    data.reason_zh ? h('div', { className: 'lp-callout lp-callout-info' }, h(Icon, { name: 'info', size: 14 }), h('p', { className: 'lp-callout-body' }, data.reason_zh)) : null,
    data.progress && data.voting ? h(CommunityPanel, {
      progress: data.progress,
      pulse: data.pulse ?? null,
      give_back_zh: data.give_back_zh ?? '',
      voting: data.voting,
      cards: data.cards ?? [],
      thresholds: data.thresholds,
      early_zh: data.early_zh,
      release_stays_zh: data.release_stays_zh,
      onChange: load,
      onError: setError,
    }) : null,
    ...(data.studies ?? []).map((study) => h(ConsentPanel, { key: study.id, study, threshold: data.thresholds?.find((row) => row.study_id === study.id)?.line_zh, onChange: load, onError: setError })),
    h(TranslogPanel, { rows: data.translog ?? [] }))
}
