// Sleep, training, the calendar, the question list, today's insight, and the mixed timeline.

import React from 'react'
import { errorText, getJson, postJson } from './api.ts'
import { cleanLabel, IndicatorsTab } from './indicators.ts'
import { Icon } from './icons.ts'
import { setPendingPrompt, type IndicatorFilter, type PageTab } from './store.ts'
import type { Journey } from './types.ts'
import { isCovered, type Covered } from './overview-facts.ts'
import { Btn } from './ui.ts'
import { dateZh, fmtAuto } from './charts.ts'
import { prettyUnits } from './changes.ts'
import { insightSentence, SCIENCE_INTRO, SEASON_INTRO, suggestedQuestions, buildTimeline, OUTBOX_ZH } from '../ux/plain.ts'

const h = React.createElement

/** Sleep and training reuse the labs table; the filter lives here because the page keeps only the labs filter. */
function AreaTab(props: { area: 'sleep' | 'training'; onConnect?: () => void }): React.ReactElement {
  const [filter, setFilter] = React.useState<IndicatorFilter>('all')
  return h(IndicatorsTab, { filter, onFilter: setFilter, onConnect: props.onConnect, area: props.area })
}

export function SleepTab(props: { onConnect?: () => void } = {}): React.ReactElement {
  return h(AreaTab, { area: 'sleep', onConnect: props.onConnect })
}

export function TrainingTab(props: { onConnect?: () => void } = {}): React.ReactElement {
  return h(AreaTab, { area: 'training', onConnect: props.onConnect })
}

export function AskTab(props: { journey: Journey; openChat?: () => void }): React.ReactElement {
  const names = (props.journey.changes ?? []).slice(0, 2).map((row) => row.label_zh)
  const visit = props.journey.reminders.find((row) => row.kind === 'retest')?.date ?? null
  const questions = suggestedQuestions({ changes: names, visit })
  const ask = (text: string) => {
    setPendingPrompt(text)
    props.openChat?.()
  }
  return h('div', { className: 'lp-tab-body' },
    h('section', { className: 'lp-card', 'aria-labelledby': 'lp-ask-title' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title', id: 'lp-ask-title' }, '可以这样问')),
      h('p', { className: 'lp-muted lp-text' }, '想问就问，不用攒着。问吃药、补剂、饮食、检查或身体不舒服，会先直接回答，再把该知道的说全；问记录的变化和进度，回答分三小段：我看到的、数据说明不了的、下一步。'),
      h('ul', { className: 'lp-ask-list' },
        ...questions.map((text) => h('li', { key: text },
          h('button', { type: 'button', className: 'lp-ask-btn', onClick: () => ask(text) },
            h('span', { className: 'lp-row-main' }, text),
            h(Icon, { name: 'chevron', size: 14 })))))))
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

function EmptyLine(props: { icon: string; title: string; text: string }): React.ReactElement {
  return h('div', { className: 'lp-empty' },
    h(Icon, { name: props.icon, size: 20 }),
    h('div', { className: 'lp-empty-title' }, props.title),
    h('p', { className: 'lp-empty-text' }, props.text))
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
  const fallback = suggestions.length === 0 ? retests[0] : undefined
  const suggestionRows = suggestions.length > 0
    ? suggestions.map((row) => h('li', { key: row.id, className: 'lp-row lp-cal-row' },
      h('span', { className: 'lp-cal-date' }, dateZh(row.date ?? '')),
      h('div', { className: 'lp-row-main' }, row.title_zh),
      h('div', { className: 'lp-cal-actions' }, h(Btn, { size: 'sm', onClick: () => confirm(row) }, '放进日程'))))
    : fallback
      ? [h('li', { key: 'retest', className: 'lp-row lp-cal-row' },
        h('span', { className: 'lp-cal-date' }, dateZh(fallback.date ?? '')),
        h('div', { className: 'lp-row-main' },
          h('div', null, fallback.text_zh),
          h('div', { className: 'lp-caption' }, '带着上次的简报和你想问的问题。')),
        h('div', { className: 'lp-cal-actions' },
          h(Btn, { size: 'sm', onClick: () => confirm({ date: fallback.date ?? '', title_zh: fallback.text_zh, brief_zh: '带着简报和问题。', questions_zh: suggestedQuestions({ visit: fallback.date }).slice(0, 2), kind: 'retest' }) }, '放进日程'),
          h(Btn, { size: 'sm', variant: 'outline', onClick: () => setNote('先不写上。') }, '先不用')))]
      : []
  return h('div', { className: 'lp-tab-body' },
    events.length === 0 && retests.length === 0
      // Empty: the empty state's title is the card's only title.
      ? h('section', { className: 'lp-card', 'aria-label': '已写上的日期' },
        h(EmptyLine, { icon: 'calendar', title: '还没有写上的日期', text: '复查、看医生、稍后要做的事。LongPi 的建议要你点一下才写上日期。' }),
        suggestionRows.length === 0 && note ? h('p', { className: 'lp-caption', role: 'status' }, note) : null)
      : h('section', { className: 'lp-card', 'aria-labelledby': 'lp-cal-title' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title', id: 'lp-cal-title' }, '已写上的日期')),
        h('ul', { className: 'lp-rows' },
          ...events.map((row) => h('li', { key: row.id, className: 'lp-row lp-cal-line' },
            h('span', { className: 'lp-cal-date' }, dateZh(row.date ?? '')),
            h('div', { className: 'lp-row-main' },
              h('div', { className: 'lp-strong' }, row.title_zh),
              row.brief_zh ? h('div', { className: 'lp-muted' }, row.brief_zh) : null,
              row.questions_zh.length > 0 ? h('div', { className: 'lp-caption' }, `可以问：${row.questions_zh.join('；')}`) : null))),
          ...retests.map((row) => h('li', { key: row.text_zh, className: 'lp-row lp-cal-line' },
            h('span', { className: 'lp-cal-date' }, dateZh(row.date ?? '')),
            h('div', { className: 'lp-row-main lp-strong' }, row.text_zh)))),
        suggestionRows.length === 0 && note ? h('p', { className: 'lp-caption', role: 'status' }, note) : null),
    suggestionRows.length > 0
      ? h('section', { className: 'lp-card', id: 'lp-cal-suggest', 'aria-labelledby': 'lp-cal-suggest-title' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title', id: 'lp-cal-suggest-title' }, '建议，还没写上')),
        h('ul', { className: 'lp-rows' }, ...suggestionRows),
        note ? h('p', { className: 'lp-caption', role: 'status' }, note) : null)
      : null,
    h(Timeline, { journey: props.journey }))
}

export function Timeline(props: { journey: Journey }): React.ReactElement {
  const [wearables, setWearables] = React.useState<Array<{ date: string; label_zh: string; value_zh: string }>>([])
  React.useEffect(() => {
    void getJson<{ groups?: Array<{ indicators?: Array<{ label_zh?: string; source?: string; unit?: string; latest?: { date?: string; value?: number | null; text?: string } }> }> }>('/api/longpi/indicators').then((data) => {
      const rows: Array<{ date: string; label_zh: string; value_zh: string }> = []
      for (const group of data.groups ?? []) {
        for (const row of group.indicators ?? []) {
          if (row.source !== 'device' || !row.latest?.date || !row.label_zh) continue
          if (!/睡眠|步数/.test(row.label_zh)) continue
          const unit = prettyUnits(row.unit ?? '')
          const number = row.latest.text ?? (row.latest.value == null ? '' : fmtAuto(row.latest.value))
          const value = !number || !unit ? number : unit.startsWith('%') ? `${number}${unit}` : `${number} ${unit}`
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
  if (items.length === 0) {
    return h('section', { className: 'lp-card', id: 'lp-timeline', 'aria-label': '按日期排' },
      h(EmptyLine, { icon: 'calendar', title: '还没有可以按日期排的事', text: '化验、手环和生活上的事放在一起，才看得出比如复查前生过病。' }))
  }
  return h('section', { className: 'lp-card', id: 'lp-timeline', 'aria-labelledby': 'lp-timeline-title' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title', id: 'lp-timeline-title' }, '按日期排')),
    h(React.Fragment, null,
        h('p', { className: 'lp-muted' }, '化验、手环和生活上的事放在一起，才看得出比如复查前生过病。'),
        h('ol', { className: 'lp-rows' },
          // A day's date is written once, on its first row.
          ...items.slice(-8).map((item, index, shown) => h('li', { key: `${item.kind}-${item.date}-${item.title_zh}`, className: 'lp-row lp-cal-line' },
            h('span', { className: 'lp-cal-date' }, index > 0 && shown[index - 1]?.date === item.date ? '' : dateZh(item.date)),
            h('span', { className: 'lp-row-main' }, cleanLabel(`${item.title_zh} · ${item.detail_zh}`)))))))
}

export function InsightCard(props: { journey: Journey; covered?: Covered }): React.ReactElement | null {
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
      const lab = concern ? undefined : (props.journey.changes ?? []).find((row) => row.ask_doctor && !(props.covered && isCovered(props.covered, row)))
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
      h(Btn, { onClick: () => props.goTab('science') }, '加入'),
      h(Btn, { variant: 'outline', onClick: later }, '以后再说')))
}

export function SeasonLink(props: { onOpen: () => void }): React.ReactElement {
  return h('button', { type: 'button', className: 'lp-textbtn', onClick: props.onOpen }, `赛季 · ${SEASON_INTRO}`)
}
