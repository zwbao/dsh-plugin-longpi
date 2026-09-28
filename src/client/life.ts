// Sleep, training, the calendar, the question list, today's insight, and the mixed timeline.

import React from 'react'
import { errorText, getJson, postJson } from './api.ts'
import { IndicatorsTab } from './indicators.ts'
import { setPendingPrompt, type PageTab } from './store.ts'
import type { Journey } from './types.ts'
import { Btn } from './ui.ts'
import { insightSentence, SCIENCE_INTRO, SEASON_INTRO, suggestedQuestions, buildTimeline, OUTBOX_ZH } from '../ux/plain.ts'

const h = React.createElement

export function SleepTab(): React.ReactElement {
  return h(IndicatorsTab, { filter: 'all', onFilter: () => {}, onConnect: () => {}, area: 'sleep' })
}

export function TrainingTab(): React.ReactElement {
  return h(IndicatorsTab, { filter: 'all', onFilter: () => {}, onConnect: () => {}, area: 'training' })
}

export function AskTab(props: { journey: Journey; openChat?: () => void }): React.ReactElement {
  const names = (props.journey.changes ?? []).slice(0, 2).map((row) => row.label_zh)
  const visit = props.journey.reminders.find((row) => row.kind === 'retest')?.date ?? null
  const questions = suggestedQuestions({ changes: names, visit })
  const ask = (text: string) => {
    setPendingPrompt(text)
    props.openChat?.()
  }
  return h('div', { className: 'lp-tab-body lp-ask' },
    h('section', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, '问 LongPi'),
      h('p', { className: 'lp-muted' }, '想问就问，不用攒着。回答通常分三小段：我看到的、数据说明不了的、下一步。'),
      h('ul', { className: 'lp-ask-list' },
        ...questions.map((text) => h('li', { key: text },
          h('button', { type: 'button', className: 'lp-ask-q', onClick: () => ask(text) }, text))))))
}

interface ScheduleRow {
  id: string
  date: string
  title_zh: string
  brief_zh: string
  questions_zh: string[]
  confirmed: boolean
  kind: string
}

export function CalendarTab(props: { journey: Journey }): React.ReactElement {
  const [suggestions, setSuggestions] = React.useState<ScheduleRow[]>([])
  const [events, setEvents] = React.useState<ScheduleRow[]>([])
  const [note, setNote] = React.useState('')
  const load = React.useCallback(() => {
    void getJson<{ suggestions?: ScheduleRow[]; events?: ScheduleRow[] }>('/api/longpi/schedule').then((row) => {
      setSuggestions(row.suggestions ?? [])
      setEvents(row.events ?? [])
    }).catch(() => { /* the season dates below still show */ })
  }, [])
  React.useEffect(() => { load() }, [load])
  const retests = props.journey.reminders.filter((row) => row.kind === 'retest' && row.date)
  const confirm = (row: { date: string; title_zh: string; brief_zh: string; questions_zh: string[]; kind: string }) => {
    void postJson('/api/longpi/schedule', { ...row, confirm: true }).then(() => { setNote('已放进日程。'); load() }).catch((error: unknown) => setNote(errorText(error, '没有放进去')))
  }
  return h('div', { className: 'lp-tab-body lp-calendar' },
    h('section', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, '日程'),
      h('p', { className: 'lp-muted' }, '复查、看医生、稍后要做的事。LongPi 的建议要你点一下才写上日期。'),
      events.length === 0 && retests.length === 0
        ? h('p', null, '还没有写上的日期。')
        : h('ul', { className: 'lp-cal-list' },
          ...events.map((row) => h('li', { key: row.id },
            h('div', { className: 'lp-strong' }, `${row.date} · ${row.title_zh}`),
            row.brief_zh ? h('p', { className: 'lp-muted' }, row.brief_zh) : null,
            row.questions_zh.length > 0 ? h('p', { className: 'lp-caption' }, `可以问：${row.questions_zh.join('；')}`) : null)),
          ...retests.map((row) => h('li', { key: row.text_zh },
            h('div', { className: 'lp-strong' }, `${row.date} · ${row.text_zh}`))))),
    h('section', { className: 'lp-card', id: 'lp-cal-suggest' },
      h('div', { className: 'lp-label' }, '建议，还没写上'),
      suggestions.length === 0 && retests[0]
        ? h('div', { className: 'lp-cal-suggest' },
          h('p', null, `${retests[0].date} ${retests[0].text_zh}`),
          h('p', { className: 'lp-caption' }, '带着上次的简报和你想问的问题。'),
          h(Btn, { size: 'sm', onClick: () => confirm({ date: retests[0].date ?? '', title_zh: retests[0].text_zh, brief_zh: '带着简报和问题。', questions_zh: suggestedQuestions({ visit: retests[0].date }).slice(0, 2), kind: 'retest' }) }, '放进日程'),
          h(Btn, { size: 'sm', variant: 'outline', onClick: () => setNote('先不写上。') }, '先不用'))
        : suggestions.map((row) => h('div', { key: row.id, className: 'lp-cal-suggest' },
          h('p', null, `${row.date} ${row.title_zh}`),
          h(Btn, { size: 'sm', onClick: () => confirm(row) }, '放进日程'))),
      note ? h('p', { className: 'lp-caption' }, note) : null),
    h(Timeline, { journey: props.journey }))
}

export function Timeline(props: { journey: Journey }): React.ReactElement {
  const [wearables, setWearables] = React.useState<Array<{ date: string; label_zh: string; value_zh: string }>>([])
  React.useEffect(() => {
    void getJson<{ groups?: Array<{ indicators?: Array<{ label_zh?: string; source?: string; latest?: { date?: string; value?: number | null; text?: string } }> }> }>('/api/longpi/indicators').then((data) => {
      const rows: Array<{ date: string; label_zh: string; value_zh: string }> = []
      for (const group of data.groups ?? []) {
        for (const row of group.indicators ?? []) {
          if (row.source !== 'device' || !row.latest?.date || !row.label_zh) continue
          if (!/睡眠|步数/.test(row.label_zh)) continue
          const value = row.latest.text ?? (row.latest.value == null ? '' : String(row.latest.value))
          rows.push({ date: row.latest.date, label_zh: row.label_zh, value_zh: value })
        }
      }
      setWearables(rows.slice(0, 6))
    }).catch(() => setWearables([]))
  }, [props.journey.today])
  const checkups = [...new Set((props.journey.changes ?? []).flatMap((row) => [row.compare?.from_date, row.compare?.to_date].filter((date): date is string => Boolean(date))))]
    .map((date) => ({ date, note: '化验' }))
  const items = buildTimeline({
    checkups,
    wearables,
    life: props.journey.reminders.filter((row) => row.kind === 'retest' && row.date).map((row) => ({ date: row.date as string, kind: 'visit' as const, note: row.text_zh })),
  })
  return h('section', { className: 'lp-card', id: 'lp-timeline' },
    h('div', { className: 'lp-label' }, '同一条时间'),
    h('p', { className: 'lp-muted' }, '化验、手环和生活上的事放在一起，才看得出比如复查前生过病。'),
    items.length === 0
      ? h('p', { className: 'lp-caption' }, '还没有可以排在一起的日期。')
      : h('ol', { className: 'lp-timeline' },
        ...items.slice(-8).map((item) => h('li', { key: `${item.kind}-${item.date}-${item.title_zh}` },
          h('span', { className: 'lp-timeline-date' }, item.date),
          h('span', null, `${item.title_zh} · ${item.detail_zh}`)))))
}

export function InsightCard(props: { journey: Journey }): React.ReactElement | null {
  const [text, setText] = React.useState<string | null>(null)
  React.useEffect(() => {
    let live = true
    void getJson<{ pressure?: boolean }>('/api/longpi/season').then(async (season) => {
      if (!live) return
      if (season.pressure !== true) { setText(null); return }
      const indicators = await getJson<{ groups?: Array<{ indicators?: Array<{ label_zh?: string; source?: string; latest?: { value?: number | null } }> }> }>('/api/longpi/indicators').catch(() => null)
      let sleep: number | null = null
      let steps: number | null = null
      for (const group of indicators?.groups ?? []) {
        for (const row of group.indicators ?? []) {
          if (row.source !== 'device' || row.latest?.value == null) continue
          if (/睡眠/.test(row.label_zh ?? '')) sleep = row.latest.value
          if (/步数/.test(row.label_zh ?? '')) steps = row.latest.value
        }
      }
      const concern = /不一定是好事/.test(props.journey.results.bioage.headline_zh ?? '')
      const lab = concern ? undefined : (props.journey.changes ?? []).find((row) => row.ask_doctor)
      const labNote = lab ? `${lab.label_zh}最近的变化比平常大。睡眠或步数说明不了这个化验，复查时再看。` : null
      setText(insightSentence({ sleepHours: sleep, steps, labNote }))
    }).catch(() => { if (live) setText(null) })
    return () => { live = false }
  }, [props.journey.today])
  if (!text) return null
  return h('section', { className: 'lp-card lp-insight', id: 'lp-insight' },
    h('div', { className: 'lp-label' }, '今日洞察'),
    h('p', null, text))
}

export function ScienceIntro(props: { goTab: (tab: PageTab) => void }): React.ReactElement | null {
  const [show, setShow] = React.useState(false)
  const [waiting, setWaiting] = React.useState(OUTBOX_ZH)
  const load = React.useCallback(() => {
    void getJson<{ show?: boolean; waiting_zh?: string }>('/api/longpi/science/invite').then((row) => {
      setShow(row.show === true)
      if (row.waiting_zh) setWaiting(row.waiting_zh)
    }).catch(() => setShow(false))
  }, [])
  React.useEffect(() => { load() }, [load])
  if (!show) return null
  const later = () => { void postJson('/api/longpi/science/invite', { decision: 'later' }).then(() => setShow(false)).catch(() => setShow(false)) }
  return h('section', { className: 'lp-card lp-science-invite', id: 'lp-science-invite' },
    h('div', { className: 'lp-label' }, '一起研究'),
    h('p', null, SCIENCE_INTRO),
    h('p', { className: 'lp-caption' }, waiting),
    h('div', { className: 'lp-form-actions' },
      h(Btn, { size: 'sm', onClick: () => props.goTab('science') }, '加入'),
      h(Btn, { size: 'sm', variant: 'outline', onClick: later }, '以后再说')))
}

export function SeasonLink(props: { onOpen: () => void }): React.ReactElement {
  return h('button', { type: 'button', className: 'lp-row-link', onClick: props.onOpen }, `赛季 · ${SEASON_INTRO}`)
}

export function Subnav(props: { onTab: (tab: PageTab) => void; science: boolean; current: PageTab }): React.ReactElement {
  const items: Array<[PageTab, string]> = [
    ['plan', '方案'],
    ['profile', '档案'],
    ['season', '赛季'],
    ...(props.science ? [['science', '研究'] as [PageTab, string]] : []),
  ]
  return h('div', { className: 'lp-subnav', role: 'navigation', 'aria-label': '更多' },
    ...items.map(([key, label]) => h('button', {
      key, type: 'button', className: `lp-subnav-btn ${props.current === key ? 'lp-subnav-on' : ''}`, onClick: () => props.onTab(key),
    }, label)))
}
