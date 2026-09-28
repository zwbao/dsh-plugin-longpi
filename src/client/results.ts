// Overview results: body age and 10-year cardiovascular risk stay when the
// record has them, and every other labeled method result is drawn beside them.
// A card says 已核对, 绑定未核对 (with the source row in that sentence), or
// 仅证据 (with the species). "年轻了" is only the M4 grade on a verified result.
// When body age is older than chronological age, the card names what drives it.

import React from 'react'
import type { MethodResult, ResultLabel } from '../contracts/library.ts'
import { modelRangeNote } from '../honesty/model-range.ts'
import {
  allowsYoungerClaim, olderThanAgeSentence, overviewSlice, parseMethodResults,
  PHENO_SKILL, primaryOutput, redCellDriverNames, resultSentence, RISK_SKILL,
  speciesOf, stripYoungerClaim, titleOf,
} from '../core/method-view.ts'
import { fmt, LineChart } from './charts.ts'
import { FeedbackBlock, messagesFor } from './feedback/index.ts'
import { chineseDate, riskText } from './format.ts'
import { Icon } from './icons.ts'
import { recordConnected } from './normalize.ts'
import { InlineSelf } from './self-measure.ts'
import { BIOAGE_INFO, RISK_INFO } from './terms.ts'
import { pickKeyTrends } from '../ux/plain.ts'
import type { Addon, Journey, ModelCard, Tracking } from './types.ts'
import { Btn, Info, Skeleton } from './ui.ts'

const h = React.createElement

export type ResultTarget = 'profile' | 'records' | 'addons' | 'self'
/** More than this and the chips crowd the card; the action below lists the rest. */
const NEEDS_SHOWN = 4
type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

function EstimateTag(): React.ReactElement {
  return h('span', { className: 'lp-tag', title: '模型根据你的记录计算的估计值，不是诊断' }, '模型估计')
}

function labelText(label: ResultLabel): string {
  if (label === 'verified') return '数据对得上'
  if (label === 'unverified-binding') return '还没对上，先别当成你的结果'
  return '这是研究里的说法，不是用你的体检算的'
}

function LabelTag(props: { label: ResultLabel }): React.ReactElement {
  return h('span', { className: 'lp-tag', 'data-result-label': props.label }, labelText(props.label))
}

function CardHead(props: { label: string; info: React.ReactNode; mark?: ResultLabel | null; estimate?: boolean }): React.ReactElement {
  return h('div', { className: 'lp-result-head' },
    h('div', { className: 'lp-label' }, props.label, h(Info, { label: props.label }, props.info)),
    h('span', { className: 'lp-result-tags' },
      props.estimate === false ? null : h(EstimateTag),
      props.mark ? h(LabelTag, { label: props.mark }) : null))
}


function bioageAction(journey: Journey): { label: string; target: ResultTarget } | null {
  const bio = journey.results.bioage
  if (bio.blocker_zh.includes('方法库')) return null
  if (journey.profile.age == null) return { label: '填写年龄', target: 'profile' }
  if (!recordConnected(journey.records.status)) return { label: '连接记录', target: 'records' }
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
  if (!recordConnected(journey.records.status)) return { label: '连接记录', target: 'records' }
  if (risk.missing_labs.length > 0) return { label: '查看加测清单', target: 'addons' }
  return null
}

function riskSelfAddon(journey: Journey): Addon | undefined {
  return journey.addons.find((row) => row.self_measurable && row.self_key && row.unlocks_zh.includes('心血管'))
}

function Blocked(props: {
  journey: Journey
  label: string
  info: React.ReactNode
  blocker: string
  needs: string[]
  action: { label: string; target: ResultTarget } | null
  selfAddon?: Addon
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  idPrefix: string
}): React.ReactElement {
  const action = props.action
  return h('div', { className: 'lp-card lp-result lp-result-blocked' },
    h(CardHead, { label: props.label, info: props.info }),
    h('div', { className: 'lp-result-wait' }, '还不能计算'),
    h('p', { className: 'lp-blocker' }, props.blocker || '还缺少计算需要的信息。'),
    props.needs.length > 0 ? h('div', { className: 'lp-needs' },
      h('span', { className: 'lp-caption' }, '还需要'),
      ...props.needs.slice(0, NEEDS_SHOWN).map((need) => h('span', { className: 'lp-need', key: need }, need)),
      props.needs.length > NEEDS_SHOWN ? h('span', { className: 'lp-caption' }, `等 ${props.needs.length} 项`) : null) : null,
    props.selfAddon && props.selfAddon.self_key && action?.target !== 'profile' && action?.target !== 'records'
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
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  method?: MethodResult
}): React.ReactElement {
  const result = props.journey.results.bioage
  if (result.status !== 'ok') {
    return h(Blocked, {
      journey: props.journey, label: '身体年龄', info: BIOAGE_INFO, blocker: result.blocker_zh, needs: result.missing,
      action: bioageAction(props.journey), onAction: props.onAction, onNotice: props.onNotice, idPrefix: 'lp-bio',
    })
  }
  const bio = props.tracking?.bioage
  const points = (bio?.points ?? []).filter((row) => Number.isFinite(row.phenoage))
  const latest = points.at(-1)
  const first = points[0]
  const phenoage = latest?.phenoage ?? result.phenoage
  const band = bio?.band_years ?? result.band_years
  const date = latest?.date ?? result.date
  const count = points.length || result.checkups
  const partial = (bio?.band_missing ?? []).length > 0
  const graded = messagesFor(props.journey, props.tracking).find((row) => row.subject.kind === 'bioage')
  const verified = !props.method || props.method.label === 'verified'
  const younger = verified && allowsYoungerClaim('verified', graded?.allowed_claims)
  const drivers = redCellDriverNames(props.journey.changes ?? [])
  const older = phenoage != null && (latest?.advance ?? result.advance) != null
    ? olderThanAgeSentence({ phenoage, advance: (latest?.advance ?? result.advance) as number, drivers })
    : null
  const binding = props.method && props.method.label === 'unverified-binding'
    ? resultSentence(props.method, { youngerAllowed: false })
    : ''
  const gradedText = graded ? (younger ? graded.headline_zh : stripYoungerClaim(graded.headline_zh)) : ''
  // Older than chronological age: say what drives it. Do not lead with "one test cannot show you got younger".
  const caption = older
    ? [older, younger && graded ? graded.headline_zh : '', binding].filter(Boolean).join('')
    : [binding, gradedText].filter(Boolean).join('')
  const info = h(React.Fragment, null,
    h('span', { className: 'lp-info-line' }, BIOAGE_INFO),
    band != null ? h('span', { className: 'lp-info-line' }, `浅色带是第一次检查的个体正常波动（±${fmt(band)} 岁${partial ? `，未含${bio?.band_missing?.join('、')}` : ''}），落在带外才算真实变化。`) : null,
    date ? h('span', { className: 'lp-info-line' }, `最近一次：${chineseDate(date)}体检，共 ${count} 次完整血检。`) : null)
  return h('div', { className: 'lp-card lp-result', ...(props.method ? { 'data-result-label': props.method.label } : {}) },
    h(CardHead, { label: '身体年龄', info, mark: props.method?.label ?? null }),
    h('div', { className: 'lp-result-figure' },
      h('span', { className: 'lp-bignum' }, fmt(phenoage)),
      h('span', { className: 'lp-bignum-unit' }, '岁'),
      younger ? h('span', { className: 'lp-pill lp-pill-good' }, '真实的变化') : null),
    // Set by the server when an input of this model changed beyond normal fluctuation.
    result.caveat_zh ? h('p', { className: 'lp-caveat', role: 'note' }, h(Icon, { name: 'warn', size: 14 }), h('span', null, result.caveat_zh)) : null,
    points.length > 1 ? h(LineChart, {
      points: points.filter((row) => row.advance != null).map((row) => ({ date: row.date, value: row.advance as number })),
      unit: '岁', label: '身体年龄减周岁', height: 96, compact: true,
      band: band != null && first?.advance != null ? { low: first.advance - band, high: first.advance + band, from: first.date } : null,
      reference: { value: 0, label: '持平' },
    }) : props.tracking == null ? h(Skeleton, { height: 40 }) : null,
    caption ? h('p', { className: 'lp-caption lp-method-sentence', id: 'lp-bioage-feedback' }, caption) : null,
    h(KeyTrends, { journey: props.journey, older: (latest?.advance ?? result.advance ?? 0) > 0 }),
    h('p', { className: 'lp-fine' }, [count > 0 ? `${count} 次体检` : '', points.length > 1 && band != null ? '浅色带为正常波动（这点变化不算数）' : ''].filter(Boolean).join(' · ')))
}

function KeyTrends(props: { journey: Journey; older: boolean }): React.ReactElement | null {
  const trends = pickKeyTrends(props.journey.changes ?? [], props.older)
  if (trends.length === 0) return null
  return h('div', { className: 'lp-trends' },
    h('div', { className: 'lp-caption' }, '旁边的变化'),
    h('ul', { 'aria-label': '旁边的变化' },
    ...trends.map((row) => h('li', { key: row.label_zh },
      h('span', { className: 'lp-strong' }, row.label_zh),
      h('span', { className: 'lp-caption' }, ` ${row.text_zh}`)))))
}

function rangeCaption(age: number | null): React.ReactElement | null {
  const text = modelRangeNote('china-par', age)
  return text ? h('p', { className: 'lp-caption', id: 'lp-risk-range' }, text) : null
}

export function RiskCard(props: {
  journey: Journey
  tracking: Tracking | null
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  method?: MethodResult
}): React.ReactElement {
  const result = props.journey.results.risk
  const range = rangeCaption(props.journey.profile.age)
  if (result.status !== 'ok') {
    const needs = [...result.missing_facts, ...result.missing_labs]
    return h(React.Fragment, null,
      h(Blocked, {
        journey: props.journey, label: '10 年心血管风险', info: RISK_INFO, blocker: result.blocker_zh, needs,
        action: riskAction(props.journey), selfAddon: riskSelfAddon(props.journey), onAction: props.onAction, onNotice: props.onNotice, idPrefix: 'lp-risk',
      }),
      range)
  }
  const card: ModelCard | undefined = props.tracking?.models?.find((row) => row.model === 'china-par')
  const goal = card?.goal?.risk_pct
  const binding = props.method && props.method.label === 'unverified-binding'
    ? resultSentence(props.method, { youngerAllowed: false })
    : ''
  return h('div', { className: 'lp-card lp-result', ...(props.method ? { 'data-result-label': props.method.label } : {}) },
    h(CardHead, { label: '10 年心血管风险', info: h(React.Fragment, null, h('span', { className: 'lp-info-line' }, RISK_INFO), card?.note_zh ? h('span', { className: 'lp-info-line' }, card.note_zh) : null), mark: props.method?.label ?? null }),
    h('div', { className: 'lp-result-figure' },
      h('span', { className: 'lp-bignum' }, riskText(result.risk_pct)),
      h('span', { className: 'lp-bignum-unit' }, '%'),
      result.category_zh ? h('span', { className: 'lp-pill' }, result.category_zh) : null,
      range),
    goal != null && Number.isFinite(goal)
      ? h('div', { className: 'lp-result-goal' },
        h('span', { className: 'lp-caption' }, '达到方案目标约'),
        h('span', { className: 'lp-strong' }, `${riskText(goal)}%`),
        card?.category_zh?.goal ? h('span', { className: 'lp-pill lp-pill-good' }, card.category_zh.goal) : null)
      : null,
    binding ? h('p', { className: 'lp-method-sentence' }, binding) : null,
    h('p', { className: 'lp-caption' }, [result.date ? `按 ${chineseDate(result.date)}的记录和你的档案计算` : '', '未来 10 年发生心梗、脑卒中等的估计概率'].filter(Boolean).join(' · ')))
}

function MethodCard(props: { result: MethodResult }): React.ReactElement {
  const out = primaryOutput(props.result)
  const numeric = out != null && typeof out.value === 'number'
  const sentence = resultSentence(props.result, { youngerAllowed: false })
  return h('div', { className: 'lp-card lp-result', 'data-result-label': props.result.label },
    h(CardHead, { label: titleOf(props.result.skill), info: h('span', { className: 'lp-info-line' }, props.result.limits_zh || '模型估计，不是诊断。'), mark: props.result.label }),
    numeric
      ? h('div', { className: 'lp-result-figure' },
        h('span', { className: 'lp-bignum' }, fmt(out.value as number)),
        out.unit ? h('span', { className: 'lp-bignum-unit' }, out.unit) : null)
      : null,
    h('p', { className: 'lp-method-sentence' }, sentence))
}

function EvidenceCard(props: { result: MethodResult }): React.ReactElement {
  const species = speciesOf(props.result) ?? '未标明'
  return h('section', { className: 'lp-card lp-result lp-method-evidence', 'data-result-label': 'evidence-only' },
    h(CardHead, { label: '文献证据', info: h('span', { className: 'lp-info-line' }, props.result.limits_zh), mark: 'evidence-only', estimate: false }),
    h('p', { className: 'lp-strong' }, `物种：${species}`),
    h('p', { className: 'lp-method-sentence' }, resultSentence(props.result, { youngerAllowed: false })))
}

const METHOD_CSS = `
.lp-result-head { flex-wrap: wrap; align-items: flex-start; }
.lp-result-tags { display: inline-flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; max-width: 100%; }
.lp-method-sentence { margin: 8px 0 0; overflow-wrap: anywhere; }
.lp-method-block { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; min-width: 0; }
.lp-method-evidence { grid-column: 1 / -1; }
.lp-results .lp-card { min-width: 0; }
@container lp-root (max-width: 720px) { .lp-method-block { grid-template-columns: 1fr; } }
`

export function ResultsRow(props: {
  journey: Journey
  tracking: Tracking | null
  onAction: (target: ResultTarget) => void
  onNotice: Notify
}): React.ReactElement {
  const focus = props.journey.profile.focus
  const riskAt = focus.findIndex((key) => key === 'cardio' || key === 'weight')
  const bioAt = focus.indexOf('bioage')
  const riskFirst = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt)
  const methods = parseMethodResults(props.journey.method_results)
  const pheno = methods.find((row) => row.skill === PHENO_SKILL && row.label !== 'evidence-only')
  const riskMethod = methods.find((row) => row.skill === RISK_SKILL && row.label !== 'evidence-only')
  const hide = new Set<string>()
  if (props.journey.results.bioage.status === 'ok') hide.add(PHENO_SKILL)
  if (props.journey.results.risk.status === 'ok') hide.add(RISK_SKILL)
  const slice = overviewSlice(methods)
  const extras = slice.value.filter((row) => !hide.has(row.skill))
  const block = extras.length > 0 || slice.evidence.length > 0
    ? h('div', { key: 'methods', id: 'lp-methods', className: 'lp-method-block' },
      ...extras.map((row, index) => h(MethodCard, { key: `value-${index}`, result: row })),
      ...slice.evidence.map((row, index) => h(EvidenceCard, { key: `evidence-${index}`, result: row })))
    : null
  const bio = h(BodyAgeCard, { key: 'bio', ...props, method: pheno })
  const risk = h(RiskCard, { key: 'risk', ...props, method: riskMethod })
  const feedback = h(FeedbackBlock, { key: 'feedback', journey: props.journey, tracking: props.tracking, onNotice: props.onNotice })
  const style = h('style', { key: 'method-style' }, METHOD_CSS)
  const cards = riskFirst ? [risk, bio] : [bio, risk]
  return h('div', { className: 'lp-results', id: 'lp-results' }, style, ...cards, block, feedback)
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

