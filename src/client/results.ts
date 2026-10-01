// Overview results: body age and 10-year cardiovascular risk stay when the
// record has them, and every other labeled method result is drawn beside them.
// A card says 已核对, 绑定未核对 (with the source row in that sentence), or
// 仅证据 (with the species). "年轻了" is only the M4 grade on a verified result.
// When body age is older than chronological age, the card names what drives it.

import React from 'react'
import type { MethodResult, ResultLabel } from '../contracts/library.ts'
import { modelRangeNote } from '../honesty/model-range.ts'
import {
  allowsYoungerClaim, facingUnit, measuresBodyAge, olderThanAgeSentence, overviewSlice, parseMethodResults,
  PHENO_SKILL, primaryOutput, redCellDriverNames, resultSentence, RISK_SKILL,
  speciesOf, stripYoungerClaim, titleOf, versusCalendarAge,
} from '../core/method-view.ts'
import { isCovered, notableRows, NOTHING_COVERED, type Covered } from './overview-facts.ts'
import { fmt, LineChart } from './charts.ts'
import { FeedbackBlock, messagesFor } from './feedback/index.ts'
import { chineseDate, plainUnits, riskText } from './format.ts'
import { Icon } from './icons.ts'
import { recordConnected } from './normalize.ts'
import { InlineSelf } from './self-measure.ts'
import { BIOAGE_INFO, RISK_INFO } from './terms.ts'
import { pickKeyTrends } from '../ux/plain.ts'
import type { Addon, Journey, ModelCard, Tracking } from './types.ts'
import { Btn, Info, Skeleton } from './ui.ts'

const h = React.createElement

export type ResultTarget = 'profile' | 'records' | 'addons' | 'self'
/** More than this and the tags crowd the card; the action below lists the rest. */
const NEEDS_SHOWN = 3
type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

function EstimateTag(): React.ReactElement {
  return h('span', { className: 'lp-tag', title: '模型根据你的记录计算的估计值，不是诊断' }, '模型估计')
}

function labelText(label: ResultLabel): string {
  if (label === 'verified') return '数据已核对'
  if (label === 'unverified-binding') return '尚未核对，暂不能视为你的结果'
  return '这是研究中的结论，并非根据你的体检计算'
}

function LabelTag(props: { label: ResultLabel }): React.ReactElement {
  return h('span', { className: 'lp-tag', 'data-result-label': props.label }, labelText(props.label))
}

/**
 * The title row holds the title and ⓘ only (ⓘ follows the last word when the title wraps); the tags sit on the
 * next line (#16). An unmatched result is not a tag: the grid says so once above, the card keeps its source line.
 */
function CardHead(props: { label: string; info: React.ReactNode; mark?: ResultLabel | null; estimate?: boolean }): React.ReactElement {
  const tags = [
    props.estimate === false ? null : h(EstimateTag, { key: 'estimate' }),
    props.mark && props.mark !== 'unverified-binding' ? h(LabelTag, { key: 'mark', label: props.mark }) : null,
  ].filter(Boolean)
  return h(React.Fragment, null,
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title lp-result-title' }, props.label, ' ', h(Info, { label: props.label }, props.info))),
    tags.length > 0 ? h('div', { className: 'lp-tags' }, ...tags) : null)
}

/** A result's number as the method sentence prints it (formatMeasure's rounding) with its unit. */
function shownOf(result: MethodResult): string {
  const out = primaryOutput(result)
  if (!out || out.value == null || out.value === '') return ''
  const figure = typeof out.value === 'number' ? String(Number(out.value.toFixed(2))) : String(out.value).trim()
  const unit = out.unit ? plainUnits(facingUnit(out.unit, out.key)) : ''
  return `${figure}${unit ? (unit === '%' ? '%' : ` ${unit}`) : ''}`
}

/** The one line above the result grid when any card is not matched to the person yet (P1-6): the cards keep only their source. */
/** The model's own age and sex facts are the profile's 年龄 / 性别 questions: never listed twice. */
function riskFacts(facts: readonly string[]): string[] {
  return facts.filter((fact) => !/^(实足)?年龄$|^性别/.test(fact.trim()))
}

export const UNMATCHED_NOTE_ZH = '标有「来源」的结果尚未与你的记录核对，暂不能视为你的结果。'

/** An unmatched result's caption: only its source (来源：肌酐(Cr) 84 μmol/L。), or nothing. */
function bindingCaption(result: MethodResult): string {
  const out = primaryOutput(result)
  const rest = restOfSentence(resultSentence(result, { youngerAllowed: false }), titleOf(result.skill, result.title_zh, out?.key ?? ''), shownOf(result))
    .replace(/^(?:还没对上|尚未核对)[，,。]?/, '').trim()
  return rest && rest !== '。' ? rest : ''
}

/** The measured value in a source line (来源：睡眠时长 5.6 小时。 → 5.6 小时), for word results (P2-20). */
function measuredOf(source: string): string {
  if (!source.startsWith('来源')) return ''
  const match = /(−?\d+(?:\.\d+)?\s*[^\s，,。；;、\d()（）]*)\s*。?$/.exec(source)
  return match?.[1]?.trim() ?? ''
}

/** A one-character word result reads as a judgement: 短 → 偏短. */
function judgementWord(word: string): string {
  return /^[短长高低]$/.test(word) ? `偏${word}` : word
}

/** A method sentence without what the card already shows: its title, and the value when the figure is on the card. */
function restOfSentence(sentence: string, title: string, shown: string): string {
  let text = plainUnits(sentence)
  if (text.startsWith(`${title}是 `)) text = text.slice(title.length + 2)
  const value = plainUnits(shown)
  if (value && text.startsWith(value)) text = text.slice(value.length).trim()
  // What is left of "（还没对上，来源：…）。" reads as a sentence of its own.
  const wrapped = /^[（(]([^（）()]*(?:[（(][^（）()]*[）)][^（）()]*)*)[）)]。?(.*)$/.exec(text)
  if (wrapped) text = `${wrapped[1] ?? ''}。${wrapped[2] ?? ''}`
  return text.replace(/^[，,。\s]+/, '').trim()
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
    const count = Math.max(1, riskFacts(risk.missing_facts).length + (journey.profile.age == null ? 1 : 0) + (journey.profile.sex !== 'male' && journey.profile.sex !== 'female' ? 1 : 0))
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
  /** What the person can answer (年龄, 性别, the risk model's facts): the 回答/填写 button's items. */
  questions: string[]
  /** Report values still missing: the add-on list's items. */
  labs: string[]
  action: { label: string; target: ResultTarget } | null
  selfAddon?: Addon
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  idPrefix: string
  /** A caption under the reason (the risk model's age range). */
  note?: React.ReactNode
}): React.ReactElement {
  const action = props.action
  const self = props.selfAddon && props.selfAddon.self_key && action?.target !== 'profile' && action?.target !== 'records' ? props.selfAddon : null
  // What is missing is said once (N23): as tags when the server lists the items, else as the server's sentence.
  // The count names the same kinds the button acts on, questions first, as the button does (new user: 还差 9 项 vs 填写年龄).
  const all = [...props.questions, ...props.labs]
  const count = [props.questions.length > 0 ? `${props.questions.length} 个问题` : '', props.labs.length > 0 ? `${props.labs.length} 项指标` : ''].filter(Boolean).join('、')
  const needs = all.length > 0
    ? h('div', { className: 'lp-tags lp-result-needs' },
      h('span', { className: 'lp-caption' }, `还差 ${count}`),
      ...all.slice(0, NEEDS_SHOWN).map((need) => h('span', { className: 'lp-tag', key: need }, need)),
      all.length > NEEDS_SHOWN ? h('span', { className: 'lp-caption' }, '…') : null)
    : h('p', { className: 'lp-blocker' }, props.blocker ? `还缺：${props.blocker.replace(/^记录里还缺|^档案里还缺|^还缺/, '').replace(/^[：:]/, '')}` : '缺少计算所需的数据。')
  // What to do about it sits on the card's floor (#39).
  return h('div', { className: 'lp-card lp-result' },
    h(CardHead, { label: props.label, info: props.info }),
    h('div', { className: 'lp-result-wait' }, '暂时无法计算'),
    needs,
    props.note ?? null,
    self?.self_key
      ? h('div', { className: 'lp-result-foot' },
        h('div', { className: 'lp-result-self' },
          h('div', { className: 'lp-caption' }, `${self.item_zh}可在家自行测量，记录后即可计算：`),
          h(InlineSelf, { journey: props.journey, selfKey: self.self_key, idPrefix: `${props.idPrefix}-self`, onNotice: props.onNotice })))
      : action ? h('div', { className: 'lp-result-foot' }, h(Btn, { variant: 'outline', onClick: () => props.onAction(action.target) }, action.label)) : null)
}

export function BodyAgeCard(props: {
  journey: Journey
  tracking: Tracking | null
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  method?: MethodResult
  covered?: Covered
}): React.ReactElement {
  const result = props.journey.results.bioage
  if (result.status !== 'ok') {
    return h(Blocked, {
      journey: props.journey, label: '身体年龄', info: BIOAGE_INFO, blocker: result.blocker_zh,
      questions: props.journey.profile.age == null ? ['年龄'] : [], labs: result.missing,
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
  const concernLine = /不一定是好事/.test(result.headline_zh ?? '') || /不一定是好事/.test(graded?.headline_zh ?? '')
  const younger = !concernLine && verified && allowsYoungerClaim('verified', graded?.allowed_claims)
  const drivers = redCellDriverNames(props.journey.changes ?? [])
  const older = phenoage != null && (latest?.advance ?? result.advance) != null
    ? olderThanAgeSentence({ phenoage, advance: (latest?.advance ?? result.advance) as number, drivers })
    : null
  const binding = props.method && props.method.label === 'unverified-binding' ? bindingCaption(props.method) : ''
  const gradedText = concernLine
    ? (result.headline_zh || graded?.headline_zh || '')
    : graded ? (younger ? graded.headline_zh : stripYoungerClaim(graded.headline_zh)) : ''
  // Older than chronological age: say what drives it. Do not lead with "one test cannot show you got younger".
  const caption = older
    ? [older, younger && graded ? graded.headline_zh : '', binding].filter(Boolean).join('')
    : [binding, gradedText].filter(Boolean).join('')
  const info = h(React.Fragment, null,
    h('span', { className: 'lp-info-line' }, BIOAGE_INFO),
    band != null ? h('span', { className: 'lp-info-line' }, `浅色带表示首次检查的个体正常波动范围（±${fmt(band)} 岁${partial ? `，未含${bio?.band_missing?.join('、')}` : ''}），落在带外才视为真实变化。`) : null,
    date ? h('span', { className: 'lp-info-line' }, `最近一次：${chineseDate(date)}体检，共 ${count} 次完整血检。`) : null)
  return h('div', { className: 'lp-card lp-result', ...(props.method ? { 'data-result-label': props.method.label } : {}) },
    h(CardHead, { label: '身体年龄', info, mark: props.method?.label ?? null }),
    h('div', { className: 'lp-result-figure' },
      // Not yet matched to the record: a medium figure, not the headline size of a confirmed result.
      h('span', { className: props.method?.label === 'unverified-binding' ? 'lp-num-md' : 'lp-num-lg' }, plainUnits(fmt(phenoage))),
      h('span', { className: 'lp-bignum-unit' }, '岁'),
      younger ? h('span', { className: 'lp-badge lp-badge-good' }, '真实变化') : null),
    // The method results that measure body age are folded in here as one line in glossary words (INT062 fix 7):
    // the page's own gap, never a second big number. One draw has no gap (advance is null).
    !older && versusCalendarAge(result.advance) ? h('p', { className: 'lp-caption lp-bioage-gap' }, versusCalendarAge(result.advance)) : null,
    // Set by the server when an input of this model changed beyond normal fluctuation.
    result.caveat_zh && !concernLine ? h('div', { className: 'lp-callout lp-callout-warn', role: 'note' }, h(Icon, { name: 'warn', size: 14 }), h('span', null, plainUnits(result.caveat_zh))) : null,
    points.length > 1 ? h(LineChart, {
      points: points.filter((row) => row.advance != null).map((row) => ({ date: row.date, value: row.advance as number })),
      unit: '岁', label: '身体年龄减周岁', height: 96, compact: true,
      band: band != null && first?.advance != null ? { low: first.advance - band, high: first.advance + band, from: first.date } : null,
      reference: { value: 0, label: '持平' },
    }) : props.tracking == null ? h(Skeleton, { height: 40 }) : null,
    caption ? h('p', { className: 'lp-caption lp-method-sentence', id: 'lp-bioage-feedback' }, plainUnits(caption)) : null,
    h(KeyTrends, { journey: props.journey, older: (latest?.advance ?? result.advance ?? 0) > 0, covered: props.covered }),
    h('p', { className: 'lp-fine lp-result-note' }, [count > 0 ? `${count} 次体检` : '', points.length > 1 && band != null ? '浅色带为正常波动范围' : ''].filter(Boolean).join(' · ')))
}

function KeyTrends(props: { journey: Journey; older: boolean; covered?: Covered }): React.ReactElement | null {
  // Values 最重要的一步 is already about are not listed again beside body age (INT062 fix 7).
  // Nor are the rows 值得注意的变化 lists further down: each change is said once on 总览.
  const covered = props.covered ?? NOTHING_COVERED
  const changes = props.journey.changes ?? []
  const below = new Set(notableRows(changes, covered).map((row) => row.key))
  const trends = pickKeyTrends(changes.filter((row) => !isCovered(covered, row) && !below.has(row.key)), props.older)
  if (trends.length === 0) return null
  return h('div', { className: 'lp-key-trends' },
    h('div', { className: 'lp-caption' }, '相关变化'),
    h('ul', { 'aria-label': '相关变化' },
    ...trends.map((row) => h('li', { key: row.label_zh },
      h('span', { className: 'lp-strong' }, row.label_zh),
      h('span', { className: 'lp-caption' }, ` ${plainUnits(row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() : row.text_zh)}`)))))
}

function rangeCaption(age: number | null): React.ReactElement | null {
  const text = modelRangeNote('china-par', age)
  return text ? h('p', { className: 'lp-caption', id: 'lp-risk-range' }, text) : null
}

/** The library run the risk card shows: an unmatched run only when it gives the card's own number. */
function riskCardMethod(journey: Journey, method?: MethodResult): MethodResult | undefined {
  const risk = journey.results.risk
  const out = method ? primaryOutput(method) : null
  const same = out != null && typeof out.value === 'number' && risk.risk_pct != null && Math.abs(out.value - risk.risk_pct) < 0.05
  return method && (method.label !== 'unverified-binding' || same) ? method : undefined
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
    const profile = props.journey.profile
    const questions = [...(profile.age == null ? ['年龄'] : []), ...(profile.sex !== 'male' && profile.sex !== 'female' ? ['性别'] : []), ...riskFacts(result.missing_facts)]
    return h(Blocked, {
      journey: props.journey, label: '10 年心血管风险', info: RISK_INFO, blocker: result.blocker_zh, questions, labs: result.missing_labs, note: range,
      action: riskAction(props.journey), selfAddon: riskSelfAddon(props.journey), onAction: props.onAction, onNotice: props.onNotice, idPrefix: 'lp-risk',
    })
  }
  const card: ModelCard | undefined = props.tracking?.models?.find((row) => row.model === 'china-par')
  const goal = card?.goal?.risk_pct
  // The card has its own number (INT062 fix 7). A library run that is still unmatched and gives another number is not
  // shown on the card, neither as a sentence nor as the card's label; the chat can still explain it.
  const method = riskCardMethod(props.journey, props.method)
  const binding = method && method.label === 'unverified-binding' ? bindingCaption(method) : ''
  return h('div', { className: 'lp-card lp-result', ...(method ? { 'data-result-label': method.label } : {}) },
    h(CardHead, { label: '10 年心血管风险', info: h(React.Fragment, null, h('span', { className: 'lp-info-line' }, RISK_INFO), card?.note_zh ? h('span', { className: 'lp-info-line' }, card.note_zh) : null), mark: method?.label ?? null }),
    h('div', { className: 'lp-result-figure' },
      h('span', { className: 'lp-num-lg' }, riskText(result.risk_pct)),
      h('span', { className: 'lp-bignum-unit' }, '%'),
      result.category_zh ? h('span', { className: 'lp-badge lp-badge-neutral' }, result.category_zh) : null),
    range,
    goal != null && Number.isFinite(goal)
      ? h('div', { className: 'lp-result-goal' },
        h('span', { className: 'lp-caption' }, '达到方案目标约'),
        h('span', { className: 'lp-strong' }, `${riskText(goal)}%`),
        card?.category_zh?.goal ? h('span', { className: 'lp-badge lp-badge-good' }, card.category_zh.goal) : null)
      : null,
    binding ? h('p', { className: 'lp-caption lp-method-sentence' }, binding) : null,
    h('p', { className: 'lp-caption lp-result-note' }, [result.date ? `按 ${chineseDate(result.date)}的记录和你的档案计算` : '', '未来 10 年发生心梗、脑卒中等的估计概率'].filter(Boolean).join(' · ')))
}

function MethodCard(props: { result: MethodResult }): React.ReactElement {
  const out = primaryOutput(props.result)
  const numeric = out != null && typeof out.value === 'number'
  const title = titleOf(props.result.skill, props.result.title_zh, out?.key ?? '')
  // The figure keeps the sentence's precision (0.56, not 0.6: the same rounding as formatMeasure); the sentence then
  // drops the title and value the card shows. A word result (短, 50 多岁) is the medium size, not the big number.
  const figure = numeric ? String(Number((out.value as number).toFixed(2))) : out && typeof out.value === 'string' ? out.value.trim() : ''
  const unit = out?.unit ? plainUnits(facingUnit(out.unit, out.key)) : ''
  const unmatched = props.result.label === 'unverified-binding'
  const sentence = unmatched ? bindingCaption(props.result)
    : figure ? restOfSentence(resultSentence(props.result, { youngerAllowed: false }), title, shownOf(props.result))
      : plainUnits(resultSentence(props.result, { youngerAllowed: false }))
  return h('div', { className: 'lp-card lp-result', 'data-result-label': props.result.label },
    h(CardHead, { label: title, info: h('span', { className: 'lp-info-line' }, props.result.limits_zh || '模型估计，不是诊断。'), mark: props.result.label }),
    numeric
      ? h('div', { className: 'lp-result-figure' },
        h('span', { className: unmatched ? 'lp-num-md' : 'lp-num-lg' }, plainUnits(figure)),
        unit ? h('span', { className: 'lp-bignum-unit' }, unit) : null)
      : figure ? h('div', { className: 'lp-result-figure' }, h('span', { className: 'lp-num-md' },
        [unmatched ? measuredOf(sentence) : '', judgementWord(plainUnits(figure))].filter(Boolean).join(' · '))) : null,
    sentence ? h('p', { className: `${unmatched ? 'lp-caption' : 'lp-muted'} lp-method-sentence` }, sentence) : null)
}

function EvidenceCard(props: { result: MethodResult }): React.ReactElement {
  const species = speciesOf(props.result) ?? '未标明'
  return h('section', { className: 'lp-card lp-result lp-method-evidence', 'data-result-label': 'evidence-only' },
    h(CardHead, { label: '文献证据', info: h('span', { className: 'lp-info-line' }, props.result.limits_zh), mark: 'evidence-only', estimate: false }),
    h('p', { className: 'lp-strong' }, `物种：${species}`),
    h('p', { className: 'lp-method-sentence' }, plainUnits(resultSentence(props.result, { youngerAllowed: false }))))
}


export function ResultsRow(props: {
  journey: Journey
  tracking: Tracking | null
  onAction: (target: ResultTarget) => void
  onNotice: Notify
  covered?: Covered
}): React.ReactElement {
  const focus = props.journey.profile.focus
  const riskAt = focus.findIndex((key) => key === 'cardio' || key === 'weight')
  const bioAt = focus.indexOf('bioage')
  const riskFirst = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt)
  const methods = parseMethodResults(props.journey.method_results)
  // Every result that measures body age belongs to the one body-age card (INT062 fix 7); its label is the card's.
  const bodyRows = methods.filter((row) => measuresBodyAge(row))
  const pheno = methods.find((row) => row.skill === PHENO_SKILL && row.label !== 'evidence-only')
    ?? bodyRows.find((row) => row.label === 'verified') ?? bodyRows[0]
  const riskMethod = methods.find((row) => row.skill === RISK_SKILL && row.label !== 'evidence-only')
  const hide = new Set<string>()
  if (props.journey.results.bioage.status === 'ok') hide.add(PHENO_SKILL)
  if (props.journey.results.risk.status === 'ok') hide.add(RISK_SKILL)
  const slice = overviewSlice(methods)
  const extras = slice.value.filter((row) => !hide.has(row.skill) && !(props.journey.results.bioage.status === 'ok' && measuresBodyAge(row)))
  const values = extras.map((row, index) => h(MethodCard, { key: `value-${index}`, result: row }))
  const evidence = slice.evidence.map((row, index) => h(EvidenceCard, { key: `evidence-${index}`, result: row }))
  const bio = h(BodyAgeCard, { key: 'bio', ...props, method: pheno })
  const risk = h(RiskCard, { key: 'risk', ...props, method: riskMethod })
  // Record changes are on 值得注意的变化 (or 最重要的一步); 这次的变化 keeps the plan's own results, check-ins and targets.
  const feedback = h(FeedbackBlock, { key: 'feedback', journey: props.journey, tracking: props.tracking, onNotice: props.onNotice, recordChanges: false })
  const cards = riskFirst ? [risk, bio] : [bio, risk]
  // 还没对上 is said once above the grid (P1-6); each unmatched card keeps only its source line.
  const shownMethods = [
    props.journey.results.bioage.status === 'ok' ? pheno : undefined,
    props.journey.results.risk.status === 'ok' ? riskCardMethod(props.journey, riskMethod) : undefined,
    ...extras,
  ]
  const unmatchedCount = shownMethods.filter((row) => row?.label === 'unverified-binding').length
  const unmatched = unmatchedCount > 0
  // One grid of result cards (a lone last card spans the row), the evidence cards full width, then the plan's own
  // results in a grid of their own, so 这次的变化 is never a half-width card on its own (#17).
  return h('div', { className: 'lp-stack', id: 'lp-results' },
    unmatched ? h('p', { className: 'lp-caption' }, unmatchedCount === shownMethods.filter(Boolean).length
      ? '以下结果均未与你的记录逐项核对（各卡已注明所用数值），暂不能视为你的结果。'
      : `其中 ${unmatchedCount} 项结果未与你的记录逐项核对（卡片已注明所用数值），暂不能视为你的结果。`) : null,
    h('div', { className: 'lp-grid-2 lp-results' }, ...cards, ...values),
    evidence.length > 0 ? h('div', { className: 'lp-stack', id: 'lp-methods' }, ...evidence) : null,
    h('div', { className: 'lp-grid-2 lp-results lp-results-plan' }, feedback))
}

/** The next-checkup add-on list; items the person can measure at home get a field right here. */
export function AddonList(props: { journey: Journey; onNotice: Notify; idPrefix: string }): React.ReactElement {
  const addons = props.journey.addons
  if (addons.length === 0) {
    return h('p', { className: 'lp-muted' }, '没有需要加测的项目。')
  }
  return h('ul', { className: 'lp-rows', id: `${props.idPrefix}-addons` },
    ...addons.map((row) => h('li', { key: row.item_zh, className: 'lp-row lp-row-wrap' },
      h(Icon, { name: row.self_measurable ? 'ruler' : 'flask', size: 16, className: 'lp-row-icon' }),
      h('div', { className: 'lp-row-main' },
        h('div', { className: 'lp-strong' }, row.item_zh),
        h('div', { className: 'lp-caption' }, `解锁：${row.unlocks_zh}${row.self_measurable ? ' · 可在家自行测量' : ' · 下次体检加测'}`)),
      row.self_measurable && row.self_key
        ? h(InlineSelf, { journey: props.journey, selfKey: row.self_key, idPrefix: `${props.idPrefix}-${row.self_key}`, onNotice: props.onNotice })
        : null)))
}
