// The card on DSH's blank-session home, in the seat meant for the 34 px logo.
// It widens itself to the composer's width and wraps onto its own line; it
// renders nothing when the journey cannot be read, so the home page never breaks.

import React from 'react'
import { fmt } from './charts.ts'
import { riskText, versusAge } from './format.ts'
import { Icon, Mark } from './icons.ts'
import { useJourney } from './store.ts'
import type { Face, Journey } from './types.ts'
import { Btn } from './ui.ts'

const h = React.createElement

interface Metric { key: string; label: string; value: string; unit: string; sub: string; good?: boolean }

function metrics(journey: Journey): Metric[] {
  const { bioage, risk } = journey.results
  const body: Metric = bioage.status === 'ok'
    ? { key: 'bioage', label: '身体年龄', value: fmt(bioage.phenoage), unit: '岁', sub: versusAge(bioage.advance) || '模型估计', good: bioage.advance != null && bioage.advance < -0.5 }
    : { key: 'bioage', label: '身体年龄', value: '—', unit: '', sub: '还不能计算' }
  const heart: Metric = risk.status === 'ok'
    ? { key: 'risk', label: '心血管 10 年风险', value: riskText(risk.risk_pct), unit: '%', sub: risk.category_zh || '模型估计' }
    : { key: 'risk', label: '心血管 10 年风险', value: '—', unit: '', sub: '还不能计算' }
  const focus = journey.profile.focus
  const riskAt = focus.findIndex((key) => key === 'cardio' || key === 'weight')
  const bioAt = focus.indexOf('bioage')
  const ordered = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt) ? [heart, body] : [body, heart]
  const plan = journey.plan
  let third: Metric
  if (!plan.exists) {
    third = { key: 'plan', label: '方案', value: '还没有', unit: '', sub: '选一项开始改善' }
  } else if (plan.checkin_items.length > 0) {
    const done = plan.checkin_items.filter((row) => row.done_today).length
    third = { key: 'today', label: '今日打卡', value: `${done}/${plan.checkin_items.length}`, unit: '', sub: done === plan.checkin_items.length ? '今天都完成了' : `还有 ${plan.checkin_items.length - done} 项`, good: done === plan.checkin_items.length }
  } else {
    third = { key: 'adherence', label: '方案执行率', value: plan.adherence_pct == null ? '—' : String(plan.adherence_pct), unit: plan.adherence_pct == null ? '' : '%', sub: plan.streak > 1 ? `连续 ${plan.streak} 天` : '近 12 周' }
  }
  return [...ordered, third]
}

function Shell(props: { children?: React.ReactNode; className?: string; label: string }): React.ReactElement {
  return h('div', { className: `lp lp-home ${props.className ?? ''}`.trim(), role: 'region', 'aria-label': props.label }, props.children)
}

function Prompt(props: { title: string; detail: string; action: string; onAction: () => void; extra?: React.ReactNode }): React.ReactElement {
  return h(Shell, { label: `LongPi：${props.title}` },
    h('div', { className: 'lp-home-row' },
      h('span', { className: 'lp-home-mark' }, h(Mark, { size: 18 })),
      h('div', { className: 'lp-home-text' },
        h('div', { className: 'lp-home-title' }, props.title),
        h('div', { className: 'lp-home-detail' }, props.detail),
        props.extra ?? null),
      h(Btn, { size: 'sm', onClick: props.onAction }, props.action)))
}

export function HomeCard(props: Partial<Face>): React.ReactElement | null {
  const { journey, loading, error } = useJourney()
  const open = () => props.openPage?.()
  if (!journey) {
    if (error || !loading) return null
    return h(Shell, { className: 'lp-home-loading', label: 'LongPi 正在读取' },
      h('div', { className: 'lp-home-row' },
        h('span', { className: 'lp-home-mark lp-skeleton-mark' }),
        h('div', { className: 'lp-home-text' },
          h('div', { className: 'lp-skeleton', style: { height: 16, width: 140 } }),
          h('div', { className: 'lp-skeleton', style: { height: 12, width: 260, marginTop: 8 } }))))
  }
  const stage = journey.stage
  if (stage === 'consent' || stage === 'profile') {
    return h(Prompt, { title: '开始建档', detail: '约 2 分钟，解锁身体年龄和心血管风险', action: '开始', onAction: open })
  }
  if (stage === 'records') {
    return h(Prompt, {
      title: '连接体检记录',
      detail: journey.records.status === 'error' ? `记录读取失败：${journey.records.error || '没有返回原因'}` : '在 Mirobody 上传体检报告或连接手环，LongPi 就能算出第一个结果',
      action: '查看', onAction: open,
    })
  }
  if (stage === 'first_result') {
    const top = journey.addons.slice(0, 3)
    const unlocks = [...new Set(journey.addons.flatMap((row) => row.unlocks_zh.split('、')).filter(Boolean))]
    const home = journey.addons.filter((row) => row.self_measurable).map((row) => row.item_zh)
    return h(Prompt, {
      title: `还差 ${journey.addons.length} 项检查`,
      detail: `加测后就能算出${unlocks.join('和') || '第一个结果'}${home.length > 0 ? `；${home.join('、')}可以自己在家量` : ''}`,
      action: '查看加测清单', onAction: open,
      extra: top.length > 0 ? h('div', { className: 'lp-home-chips' },
        ...top.map((row) => h('span', { key: row.item_zh, className: 'lp-need' }, row.self_measurable ? h(Icon, { name: 'ruler', size: 12 }) : null, row.item_zh))) : null,
    })
  }
  return h(Shell, { label: 'LongPi 今日概览' },
    h('div', { className: 'lp-home-head' },
      h('span', { className: 'lp-home-brand' }, h(Mark, { size: 16 }), 'LongPi'),
      h('span', { className: 'lp-tag' }, '模型估计'),
      h('button', { type: 'button', className: 'lp-home-link', onClick: open }, '打开健康页', h(Icon, { name: 'arrow', size: 14 }))),
    h('div', { className: 'lp-home-metrics' },
      ...metrics(journey).map((row) => h('div', { key: row.key, className: 'lp-home-metric' },
        h('div', { className: 'lp-caption' }, row.label),
        h('div', { className: 'lp-home-value' }, row.value, row.unit ? h('span', { className: 'lp-home-unit' }, row.unit) : null),
        h('div', { className: `lp-home-sub ${row.good ? 'lp-good-ink' : ''}` }, row.sub)))))
}
