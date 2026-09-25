// The two first results: body age (phenotypic age) and 10-year cardiovascular
// risk (China-PAR). Both are model estimates and say so. When one cannot be
// computed the card shows the server's exact blocker and the one step that
// removes it, never a generic "wait for a blood test".

import React from 'react'
import { fmt, LineChart, TableTwin } from './charts.ts'
import { chineseDate, chineseMonth, riskText, versusAge } from './format.ts'
import { Icon } from './icons.ts'
import { InlineSelf } from './self-measure.ts'
import type { Addon, Journey, ModelCard, Tracking } from './types.ts'
import { Btn, Skeleton } from './ui.ts'

const h = React.createElement

export type ResultTarget = 'profile' | 'records' | 'addons' | 'self'
/** More than this and the chips crowd the card; the action below lists the rest. */
const NEEDS_SHOWN = 6
type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

function EstimateTag(): React.ReactElement {
  return h('span', { className: 'lp-tag', title: '模型根据你的记录计算的估计值，不是诊断' }, '模型估计')
}

function CardHead(props: { label: string }): React.ReactElement {
  return h('div', { className: 'lp-result-head' }, h('div', { className: 'lp-label' }, props.label), h(EstimateTag))
}

function bioageAction(journey: Journey): { label: string; target: ResultTarget } | null {
  const bio = journey.results.bioage
  if (bio.blocker_zh.includes('方法库')) return null
  if (journey.profile.age == null) return { label: '填写年龄', target: 'profile' }
  if (journey.records.status !== 'ok') return { label: '连接记录', target: 'records' }
  if (bio.missing.length > 0 || journey.addons.some((row) => row.unlocks_zh.includes('身体年龄'))) return { label: '查看加测清单', target: 'addons' }
  return null
}

function riskAction(journey: Journey): { label: string; target: ResultTarget } | null {
  const risk = journey.results.risk
  const profileMissing = journey.profile.age == null || (journey.profile.sex !== 'male' && journey.profile.sex !== 'female') || risk.missing_facts.length > 0
  if (profileMissing) {
    const count = Math.max(1, risk.missing_facts.length + (journey.profile.age == null ? 1 : 0) + (journey.profile.sex !== 'male' && journey.profile.sex !== 'female' ? 1 : 0))
    return { label: `回答 ${count} 个问题`, target: 'profile' }
  }
  if (journey.records.status !== 'ok') return { label: '连接记录', target: 'records' }
  if (risk.missing_labs.length > 0) return { label: '查看加测清单', target: 'addons' }
  return null
}

function riskSelfAddon(journey: Journey): Addon | undefined {
  return journey.addons.find((row) => row.self_measurable && row.self_key && row.unlocks_zh.includes('心血管'))
}

function Blocked(props: {
  journey: Journey
  label: string
  blocker: string
  needs: string[]
  action: { label: string; target: ResultTarget } | null
  selfAddon?: Addon
  canShowAddons: boolean
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  idPrefix: string
}): React.ReactElement {
  const action = props.action?.target === 'addons' && !props.canShowAddons ? null : props.action
  return h('div', { className: 'lp-card lp-result lp-result-blocked' },
    h(CardHead, { label: props.label }),
    h('div', { className: 'lp-result-wait' }, '还不能计算'),
    h('p', { className: 'lp-blocker' }, props.blocker || '还缺少计算需要的信息。'),
    props.needs.length > 0 ? h('div', { className: 'lp-needs' },
      h('span', { className: 'lp-caption' }, '还需要'),
      ...props.needs.slice(0, NEEDS_SHOWN).map((need) => h('span', { className: 'lp-need', key: need }, need)),
      props.needs.length > NEEDS_SHOWN ? h('span', { className: 'lp-caption' }, `等 ${props.needs.length} 项`) : null) : null,
    props.selfAddon && props.selfAddon.self_key && props.action?.target !== 'profile' && props.action?.target !== 'records'
      ? h('div', { className: 'lp-result-self' },
        h('div', { className: 'lp-caption' }, `${props.selfAddon.item_zh}可以自己在家量，记下就能算：`),
        h(InlineSelf, { journey: props.journey, selfKey: props.selfAddon.self_key, idPrefix: `${props.idPrefix}-self`, onNotice: props.onNotice }))
      : action ? h('div', { className: 'lp-result-action' },
        h(Btn, { size: 'sm', variant: 'outline', onClick: () => props.onAction(action.target) }, action.label, h(Icon, { name: 'arrow', size: 14 })))
        : null)
}

export function BodyAgeCard(props: {
  journey: Journey
  tracking: Tracking | null
  canShowAddons: boolean
  onAction: (target: ResultTarget) => void
  onNotice: Notify
}): React.ReactElement {
  const result = props.journey.results.bioage
  if (result.status !== 'ok') {
    return h(Blocked, {
      journey: props.journey, label: '身体年龄 · 表型年龄', blocker: result.blocker_zh, needs: result.missing,
      action: bioageAction(props.journey), canShowAddons: props.canShowAddons, onAction: props.onAction, onNotice: props.onNotice, idPrefix: 'lp-bio',
    })
  }
  const bio = props.tracking?.bioage
  const points = (bio?.points ?? []).filter((row) => Number.isFinite(row.phenoage))
  const latest = points.at(-1)
  const first = points[0]
  const phenoage = latest?.phenoage ?? result.phenoage
  const advance = latest ? latest.advance : result.advance
  const band = bio?.band_years ?? result.band_years
  const date = latest?.date ?? result.date
  const count = points.length || result.checkups
  const partial = (bio?.band_missing ?? []).length > 0
  const delta = latest?.advance != null && first?.advance != null && points.length > 1 ? latest.advance - first.advance : null
  let story = ''
  let real = false
  if (delta != null && first) {
    const moved = delta < 0 ? `年轻了 ${fmt(-delta)} 岁` : delta > 0 ? `多了 ${fmt(delta)} 岁` : '没有变化'
    story = `从 ${chineseMonth(first.date)}到现在，表型年龄相对实足年龄${moved}`
    if (band != null) {
      if (Math.abs(delta) > band) {
        real = delta < 0
        story += partial
          ? `，超过了已知的个体波动（±${fmt(band)} 岁，未含${bio?.band_missing?.join('、')}）。`
          : `，超出个体正常波动（±${fmt(band)} 岁），是真实的变化。`
      } else {
        story += `，还在个体正常波动（±${fmt(band)} 岁）以内。`
      }
    } else {
      story += '。'
    }
  }
  const versus = versusAge(advance)
  return h('div', { className: `lp-card lp-result ${real ? 'lp-result-win' : ''}` },
    h(CardHead, { label: '身体年龄 · 表型年龄' }),
    h('div', { className: 'lp-result-figure' },
      h('span', { className: 'lp-bignum' }, fmt(phenoage)),
      h('span', { className: 'lp-bignum-unit' }, '岁'),
      band != null ? h('span', { className: 'lp-band-note' }, `正常波动 ±${fmt(band)} 岁`) : null),
    h('div', { className: 'lp-result-sub' },
      versus ? h('span', { className: `lp-pill ${advance != null && advance < -0.5 ? 'lp-pill-good' : ''}` }, versus) : null,
      date ? h('span', { className: 'lp-caption' }, `${chineseDate(date)}体检 · 共 ${count} 次完整血检`) : null),
    points.length > 1 ? h(LineChart, {
      points: points.filter((row) => row.advance != null).map((row) => ({ date: row.date, value: row.advance as number })),
      unit: '岁', label: '表型年龄减实足年龄', height: 132,
      band: band != null && first?.advance != null ? { low: first.advance - band, high: first.advance + band, from: first.date } : null,
      reference: { value: 0, label: '持平' },
    }) : props.tracking == null ? h(Skeleton, { height: 60 }) : null,
    story ? h('p', { className: 'lp-story' }, real ? h(Icon, { name: 'spark', className: 'lp-good-ink' }) : null, story) : null,
    h('p', { className: 'lp-fine' }, 'Levine 2018 表型年龄：九项常规血检加实足年龄。浅色带是第一次检查的个体正常波动，落在带外才算真实变化。'),
    points.length > 1 ? h(TableTwin, {
      caption: '每次体检的表型年龄',
      head: ['日期', '表型年龄', '减实足年龄', '模型 10 年死亡风险'],
      rows: points.map((row) => [row.date, `${fmt(row.phenoage)} 岁`, `${fmt(row.advance)} 岁`, `${fmt(row.mortality_10y_pct)}%`]),
    }) : null)
}

export function RiskCard(props: {
  journey: Journey
  tracking: Tracking | null
  canShowAddons: boolean
  onAction: (target: ResultTarget) => void
  onNotice: Notify
}): React.ReactElement {
  const result = props.journey.results.risk
  if (result.status !== 'ok') {
    const needs = [...result.missing_facts, ...result.missing_labs]
    return h(Blocked, {
      journey: props.journey, label: '10 年心血管病风险 · China-PAR', blocker: result.blocker_zh, needs,
      action: riskAction(props.journey), selfAddon: riskSelfAddon(props.journey), canShowAddons: props.canShowAddons,
      onAction: props.onAction, onNotice: props.onNotice, idPrefix: 'lp-risk',
    })
  }
  const card: ModelCard | undefined = props.tracking?.models?.find((row) => row.model === 'china-par')
  const goal = card?.goal?.risk_pct
  return h('div', { className: 'lp-card lp-result' },
    h(CardHead, { label: '10 年心血管病风险 · China-PAR' }),
    h('div', { className: 'lp-result-figure' },
      h('span', { className: 'lp-bignum' }, riskText(result.risk_pct)),
      h('span', { className: 'lp-bignum-unit' }, '%')),
    h('div', { className: 'lp-result-sub' },
      result.category_zh ? h('span', { className: 'lp-pill' }, result.category_zh) : null,
      result.date ? h('span', { className: 'lp-caption' }, `按 ${chineseDate(result.date)}的记录和你的档案计算`) : null),
    goal != null && Number.isFinite(goal)
      ? h('div', { className: 'lp-result-goal' },
        h('span', { className: 'lp-caption' }, '达到方案目标时'),
        h('span', { className: 'lp-strong' }, `${riskText(goal)}%`),
        card?.category_zh?.goal ? h('span', { className: 'lp-pill lp-pill-good' }, card.category_zh.goal) : null)
      : null,
    h('p', { className: 'lp-story' }, '未来 10 年发生心梗、脑卒中等动脉粥样硬化性心血管病的估计概率。它说的是同类人群的平均，不是对你个人的预言。'),
    h('p', { className: 'lp-fine' }, `China-PAR 中国人群模型。${card?.note_zh ?? ''}这个模型没有公开的个体波动范围，所以这里不画波动带。`))
}

export function ResultsRow(props: {
  journey: Journey
  tracking: Tracking | null
  canShowAddons: boolean
  onAction: (target: ResultTarget) => void
  onNotice: Notify
}): React.ReactElement {
  const focus = props.journey.profile.focus
  const riskAt = focus.findIndex((key) => key === 'cardio' || key === 'weight')
  const bioAt = focus.indexOf('bioage')
  const riskFirst = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt)
  const bio = h(BodyAgeCard, { key: 'bio', ...props })
  const risk = h(RiskCard, { key: 'risk', ...props })
  return h('div', { className: 'lp-results', id: 'lp-results' }, ...(riskFirst ? [risk, bio] : [bio, risk]))
}

/** The next-checkup add-on list; items the person can measure at home get a field right here. */
export function AddonList(props: { journey: Journey; onNotice: Notify; idPrefix: string }): React.ReactElement {
  const addons = props.journey.addons
  if (addons.length === 0) {
    return h('p', { className: 'lp-muted' }, '没有需要加测的项目。')
  }
  return h('ul', { className: 'lp-addons', id: `${props.idPrefix}-addons` },
    ...addons.map((row) => h('li', { key: row.item_zh, className: 'lp-addon' },
      h('span', { className: 'lp-addon-box', 'aria-hidden': true }, h(Icon, { name: row.self_measurable ? 'ruler' : 'flask', size: 14 })),
      h('div', { className: 'lp-addon-text' },
        h('div', { className: 'lp-strong' }, row.item_zh),
        h('div', { className: 'lp-caption' }, `解锁：${row.unlocks_zh}${row.self_measurable ? ' · 可以自己在家量' : ' · 下次体检加测'}`)),
      row.self_measurable && row.self_key
        ? h(InlineSelf, { journey: props.journey, selfKey: row.self_key, idPrefix: `${props.idPrefix}-${row.self_key}`, onNotice: props.onNotice })
        : null)))
}

