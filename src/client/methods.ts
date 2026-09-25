// Methods and records: what the record can run now, what one more test would
// unlock, the medication plan as Mirobody holds it, recent readouts, and a
// search over the method library.

import React from 'react'
import { errorText, getJson, postJson } from './api.ts'
import { fmt } from './charts.ts'
import { Icon } from './icons.ts'
import { notifyChanged } from './store.ts'
import type { Board, MatchHit } from './types.ts'
import { Btn, Section, Skeleton } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void
type RunResult = { skill: string; ok: boolean; excerpt: string }

function RunReady(props: { board: Board; onNotice: Notify }): React.ReactElement {
  const ready = props.board.readiness?.ready ?? []
  const [running, setRunning] = React.useState(false)
  const [results, setResults] = React.useState<RunResult[] | null>(null)
  async function run(): Promise<void> {
    setRunning(true)
    try {
      const json = await postJson<{ results: RunResult[] }>('/api/longpi/run-ready', {})
      setResults(json.results)
      notifyChanged()
    } catch (err) {
      props.onNotice(`没有算完：${errorText(err, '请稍后再试')}`, 'bad')
    } finally {
      setRunning(false)
    }
  }
  return h('div', { className: 'lp-card' },
    h('div', { className: 'lp-label' }, '你的记录现在就能算'),
    ready.length === 0
      ? h('p', { className: 'lp-muted' }, '还没有能直接计算的方法。')
      : h('ul', { className: 'lp-rows' }, ...ready.slice(0, 8).map((row) => h('li', { key: row.name, className: 'lp-row lp-row-stack' },
        // Several methods share a domain, so the blurb (what it computes) is the title and the domain the caption.
        h('span', { className: 'lp-strong' }, row.blurb || row.name), h('span', { className: 'lp-caption' }, row.domain || row.name)))),
    ready.length > 8 ? h('p', { className: 'lp-caption' }, `另有 ${ready.length - 8} 项`) : null,
    ready.length > 0 ? h('div', { className: 'lp-form-actions' },
      h(Btn, { size: 'sm', disabled: running, onClick: () => { void run() } }, h(Icon, { name: 'play', size: 13 }), running ? '正在计算…' : `一键计算 ${ready.length} 项`)) : null,
    results ? h('ul', { className: 'lp-rows lp-run' }, ...results.map((row) => h('li', { key: row.skill, className: 'lp-row lp-row-stack' },
      h('span', null, h('span', { className: row.ok ? 'lp-good-ink' : 'lp-muted-ink' }, row.ok ? '✓ ' : '· '), row.skill),
      h('span', { className: 'lp-caption' }, row.excerpt.split('\n')[0] ?? '')))) : null)
}

function Search(props: { board: Board }): React.ReactElement {
  const [question, setQuestion] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [matches, setMatches] = React.useState<MatchHit[] | null>(null)
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const shown = matches ?? props.board.dispatch?.matches ?? []
  async function ask(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!question.trim()) return
    setBusy(true)
    setError(null)
    try {
      const json = await getJson<{ matches?: MatchHit[]; note?: string }>(`/api/longpi/match?q=${encodeURIComponent(question.trim())}`)
      setMatches(json.matches ?? [])
      setNote(json.note ?? '')
    } catch (err) {
      setError(`没有匹配到：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }
  return h('div', { className: 'lp-card' },
    h('label', { className: 'lp-label', htmlFor: 'lp-method-q' }, '找方法'),
    h('form', { className: 'lp-search', onSubmit: (event: React.FormEvent) => { void ask(event) } },
      h('input', {
        id: 'lp-method-q', className: 'lp-input', placeholder: '例如：生物年龄、甲基化、NMN 有用吗', value: question,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuestion(event.target.value),
      }),
      h(Btn, { type: 'submit', size: 'sm', variant: 'outline', disabled: busy || !question.trim() }, busy ? '匹配中' : '匹配')),
    error ? h('p', { className: 'lp-form-error' }, error) : null,
    note ? h('p', { className: 'lp-fine' }, note) : null,
    shown.length > 0 ? h('ul', { className: 'lp-rows' }, ...shown.slice(0, 6).map((item) => h('li', { key: item.name, className: 'lp-row lp-row-stack' },
      h('span', { className: 'lp-strong' }, item.name), h('span', { className: 'lp-caption' }, (item.why ?? []).join('；') || item.blurb || '')))) : null)
}

export function MethodsSection(props: { board: Board | null; loading: boolean; error: string | null; onNotice: Notify }): React.ReactElement {
  const board = props.board
  if (!board) {
    return h(Section, { id: 'lp-methods', title: '记录与方法', kicker: '数据' },
      props.loading ? h(Skeleton, { height: 160 }) : h('div', { className: 'lp-card' }, h('p', { className: 'lp-muted' }, `方法和记录没有读到${props.error ? `（${props.error}）` : ''}。点右上角的刷新再试一次。`)))
  }
  const unlock = board.readiness?.unlock ?? []
  const meds = board.records?.medications ?? []
  const readouts = board.readouts ?? []
  return h(Section, { id: 'lp-methods', title: '记录与方法', kicker: '数据', aside: h('span', { className: 'lp-caption' }, `方法库 ${board.skills?.version ?? ''} · ${board.readiness?.declared ?? 0} 个个人方法`) },
    h('div', { className: 'lp-grid-2' },
      h(RunReady, { board, onNotice: props.onNotice }),
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '再测一项就能解锁'),
        unlock.length === 0
          ? h('p', { className: 'lp-muted' }, '没有只差一项的方法。')
          : h('ul', { className: 'lp-rows' }, ...unlock.slice(0, 8).map((row) => h('li', { key: row.item, className: 'lp-row' },
            h('span', { className: 'lp-strong' }, row.item), h('span', { className: 'lp-caption' }, `解锁 ${row.skills.length} 个方法`)))))),
    h('div', { className: 'lp-grid-2' },
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '用药计划', h('span', { className: 'lp-optional' }, '只读，来自 Mirobody')),
        meds.length === 0
          ? h('p', { className: 'lp-muted' }, '没有读到用药计划。')
          : h('ul', { className: 'lp-rows' }, ...meds.map((row) => h('li', { key: row.name, className: 'lp-row' }, h('span', null, row.name), h('span', { className: 'lp-caption' }, row.status ?? ''))))),
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '最近读出'),
        readouts.length === 0
          ? h('p', { className: 'lp-muted' }, '还没有算过。')
          : h('ul', { className: 'lp-rows' }, ...readouts.slice(0, 8).map((row) => h('li', { key: row.key, className: 'lp-row' },
            h('span', null, row.label_zh || row.key),
            h('span', { className: 'lp-row-end' },
              h('span', { className: 'lp-num' }, `${typeof row.value === 'number' ? fmt(row.value, 2) : row.value ?? ''} ${row.unit && row.unit !== '1' ? (row.unit === 'a' ? '岁' : row.unit) : ''}`),
              h('span', { className: 'lp-caption' }, (row.measured_at || row.at || '').slice(0, 10)))))))),
    h('div', { className: 'lp-grid-1' }, h(Search, { board })))
}
