// 长寿图鉴 (docs/codex-design.md 1.2): the whole Codex in one dark, pixel-style container. The main line is a
// two-week personal experiment (three to choose from → do it → turn the card); the library is free to read; a
// retest brings a pack of new result cards; what the person did is kept as footprint cards. Every overlay sits
// inside the container (absolute in a relative box), never fixed to the window.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { CODEX_INTRO, SEASON_INTRO } from '../../ux/plain.ts'
import type { ActResult, CodexAction, CodexView, ExperimentOption, RunView } from '../../engage/engine.ts'
import type { ChapterInfo, Footprint, ResultCard, RunResult, SpeciesInfo, StudyCard } from '../../contracts/codex.ts'
import {
  cardBack, emblem, experimentFace, footprintFace, gem, pack as packSprite, PACK_SHARDS, resultFace, seal, speciesFace, startSwirl,
  studyFace, toDataURL, type CellState, type Raster,
} from './art.ts'
import { CODEX_FONT_CSS } from './font.ts'

const h = React.createElement

type Pack = CodexView['packs'][number]
type LibStudy = StudyCard & { read: boolean; relation_zh: string | null }
type LibSpecies = SpeciesInfo & { met: boolean }
interface LibraryView { ok: boolean; revision: string | null; note_zh: string; chapters: ChapterInfo[]; species: LibSpecies[]; pending: number; studies: LibStudy[] }
type TabKey = 'exp' | 'library' | 'deck' | 'species' | 'footprints' | 'settings'
type Tier = StudyCard['tier']
type Size = 's2' | 's3' | 's4' | 's6'

const PATH = '/api/longpi/codex'

// ---- the bodies this page posts (test/codex-client.mjs runs each through parseAction) ---------------------------

export const codexBodies = {
  start: (myDay: { start: string; end: string }, seasonMode: '8w' | 'retest', standup: boolean): CodexAction => ({ action: 'start', my_day: myDay, season_mode: seasonMode, standup }),
  prefs: (prefs: { simple?: boolean; presentation?: boolean; my_day?: { start: string; end: string }; season_mode?: '8w' | 'retest'; standup?: boolean; codex?: boolean }): CodexAction => ({ action: 'prefs', ...prefs }),
  openPack: (packId: string): CodexAction => ({ action: 'open_pack', pack_id: packId }),
  begin: (experimentId: string, packId: string | null, answers: Record<string, boolean>, randomized: boolean): CodexAction => ({
    action: 'begin', experiment_id: experimentId, ...(packId ? { pack_id: packId } : {}), answers, randomized,
  }),
  checkin: (runId: string, done: boolean): CodexAction => ({ action: 'checkin', run_id: runId, done }),
  reveal: (runId: string): CodexAction => ({ action: 'reveal', run_id: runId }),
  stop: (runId: string): CodexAction => ({ action: 'stop', run_id: runId }),
  read: (cardId: string): CodexAction => ({ action: 'read', card_id: cardId }),
  nextSeason: (): CodexAction => ({ action: 'next_season' }),
}

// ---- words ----------------------------------------------------------------------------------------------------

const TIERS: Record<Tier, { metal: string; label: string; key: string }> = {
  cell: { metal: '铜', label: '细胞实验', key: 'lp-codex-k-copper' },
  animal: { metal: '银', label: '动物实验', key: 'lp-codex-k-silver' },
  human: { metal: '紫', label: '人群研究', key: 'lp-codex-k-violet' },
  trial: { metal: '金', label: '人体随机试验', key: 'lp-codex-k-gold' },
}
const TIER_ORDER: Tier[] = ['cell', 'animal', 'human', 'trial']
const OUTCOME_STAMP = { outside: '超出波动', inside: '波动内', insufficient: '数据不够' } as const
const OBJECT_ZH: Record<string, string> = { human: '人', cell_line: '细胞', multi_species: '多种动物', other: '其他动物' }
const SHARD_GOLD = ['#f2b53a', '#ffe896', '#ffffff']
const SHARD_FOIL = ['#ff5e5e', '#ffd166', '#5eead4', '#60a5fa', '#c084fc']

/** Display width: Latin letters, digits and spaces count half. */
function widthOf(text: string): number {
  let width = 0
  for (const char of text) width += /[\u0000-ɏ -⁯]/.test(char) ? 0.5 : 1
  return width
}

function dayZh(day: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '')
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ''
}

const cx = (...names: Array<string | false | null | undefined>): string => names.filter(Boolean).join(' ')

function isView(value: unknown): value is CodexView {
  return Boolean(value) && typeof value === 'object' && 'started' in (value as Record<string, unknown>) && 'intro' in (value as Record<string, unknown>)
}

function isLibrary(value: unknown): value is LibraryView {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as LibraryView).studies) && Array.isArray((value as LibraryView).chapters)
}

const HIGHLIGHT = /(小鼠|大鼠|线虫|果蝇|绿松石鳉|鳉鱼|斑马鱼|涡虫|裸鼹鼠|弓头鲸|袖蝶|猕猴|狨猴|哺乳动物|蝴蝶|酵母)|(随机对照试验|随机试验|随机)|(\d[\d.,]*(?:万|%)?)/g

/** Species names, numbers and 「随机」 coloured inside the cream description box (design §5.2). */
function highlight(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(HIGHLIGHT)) {
    const index = m.index ?? 0
    if (index > at) out.push(text.slice(at, index))
    const cls = m[1] ? 'lp-codex-hl-s' : m[2] ? 'lp-codex-hl-k' : 'lp-codex-hl-n'
    out.push(h('span', { key: `${index}`, className: cls }, m[0]))
    at = index + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

// ---- motion -----------------------------------------------------------------------------------------------------

function motionQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(() => Boolean(motionQuery()?.matches))
  React.useEffect(() => {
    const query = motionQuery()
    if (!query) return undefined
    const on = () => setReduce(query.matches)
    query.addEventListener?.('change', on)
    return () => query.removeEventListener?.('change', on)
  }, [])
  return reduce
}

let fontInjected = false
function injectFont(): void {
  if (fontInjected || typeof document === 'undefined') return
  fontInjected = true
  const id = 'lp-codex-font'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = CODEX_FONT_CSS
  document.head.appendChild(style)
}

/** How far down the container the visible part starts (the page scrolls inside DSH's panel). */
function visibleTop(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  let top = Math.max(0, -rect.top)
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = window.getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      top = Math.max(top, node.getBoundingClientRect().top - rect.top)
      break
    }
  }
  return Math.max(0, Math.min(top, rect.height - 200))
}

// ---- one card ----------------------------------------------------------------------------------------------------

interface CardProps {
  face: Raster
  size?: Size
  family: 'study' | 'species' | 'experiment' | 'footprint' | 'result' | 'back'
  label: string
  live?: boolean
  flipped?: boolean
  bob?: boolean
  delay?: number
  tilt?: boolean
  className?: string
  onOpen?: () => void
  onHover?: (el: HTMLElement | null) => void
  children?: React.ReactNode
}

function Card(props: CardProps): React.ReactElement {
  const size = props.size ?? 's4'
  const live = Boolean(props.live && props.onOpen)
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!props.tilt) return
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.setProperty('--rx', `${((0.5 - py) * 18).toFixed(1)}deg`)
    el.style.setProperty('--ry', `${((px - 0.5) * 22).toFixed(1)}deg`)
    el.style.setProperty('--mx', `${Math.round(px * 100)}%`)
    el.style.setProperty('--my', `${Math.round(py * 100)}%`)
  }
  const leave = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    for (const name of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(name)
    props.onHover?.(null)
  }
  return h('div', {
    className: cx('lp-codex-pc', `lp-codex-${size}`, live && 'lp-codex-live', props.flipped && 'lp-codex-flipped', props.bob && 'lp-codex-bob', props.className),
    'data-family': props.family,
    style: props.delay != null ? ({ '--d': `${props.delay}s` } as React.CSSProperties) : undefined,
    role: live ? 'button' : undefined,
    tabIndex: live ? 0 : undefined,
    'aria-label': live ? props.label : undefined,
    onClick: live ? props.onOpen : undefined,
    onKeyDown: live ? (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onOpen?.() }
    } : undefined,
    onPointerEnter: props.onHover ? (event: React.PointerEvent<HTMLDivElement>) => props.onHover?.(event.currentTarget) : undefined,
    onPointerMove: props.tilt ? move : undefined,
    onPointerLeave: props.tilt || props.onHover ? leave : undefined,
  },
  h('div', { className: 'lp-codex-tilt' },
    h('div', { className: 'lp-codex-side lp-codex-front' },
      h('img', { className: 'lp-codex-face', src: toDataURL(props.face), alt: live ? '' : props.label, draggable: false }),
      props.children,
      h('div', { className: 'lp-codex-shine' })),
    h('div', { className: 'lp-codex-side lp-codex-back' },
      h('img', { className: 'lp-codex-face', src: toDataURL(cardBack()), alt: props.flipped ? '卡背' : '', draggable: false }))))
}

function nameClass(title: string, size: Size): string {
  const w = widthOf(title)
  if (size === 's6') return w > 9 ? 'lp-codex-t lp-codex-name lp-codex-long' : 'lp-codex-t lp-codex-name'
  if (size === 's3') return w > 9 ? 'lp-codex-t lp-codex-name lp-codex-two' : 'lp-codex-t lp-codex-name'
  return 'lp-codex-t lp-codex-name'
}

function objectOf(card: StudyCard, speciesName: (key: string) => string): string {
  if (card.tier === 'cell') return '细胞'
  if (card.tier === 'human' || card.tier === 'trial') return '人'
  const animal = card.species.find((key) => key !== 'human' && key !== 'cell_line')
  return animal ? speciesName(animal) : '动物'
}

function StudyText(props: { card: LibStudy; size: Size; speciesName: (key: string) => string }): React.ReactElement {
  const { card, size } = props
  return h(React.Fragment, null,
    h('span', { className: 'lp-codex-t lp-codex-no' }, `No.${card.no}`),
    h('img', { className: 'lp-codex-gem', src: toDataURL(gem(card.tier)), alt: '' }),
    h('span', { className: 'lp-codex-t lp-codex-tier' }, TIERS[card.tier].label),
    h('span', { className: nameClass(card.title_zh, size) }, card.title_zh),
    h('span', { className: 'lp-codex-t lp-codex-sub' }, h('span', null, objectOf(card, props.speciesName)), h('span', null, card.source.year ?? '')),
    card.read ? h('img', { className: 'lp-codex-seal', src: toDataURL(seal('read')), alt: '已读' }) : null)
}

function studyLabel(card: LibStudy): string {
  return `研究卡 No.${card.no}「${card.title_zh}」，${TIERS[card.tier].metal} · ${TIERS[card.tier].label}${card.read ? '，已读' : ''}`
}

interface ExpCardInfo { id: string; icon: string; title: string; days: number; cells: CellState[]; status: string; right: string; result: RunResult | null; waiting?: boolean }

function ExpCard(props: { info: ExpCardInfo; size?: Size; live?: boolean; flipped?: boolean; foil?: boolean; bob?: boolean; delay?: number; tilt?: boolean; className?: string; onOpen?: () => void }): React.ReactElement {
  const { info } = props
  const size = props.size ?? 's4'
  const outcome = info.result?.outcome
  const label = `实验卡「${info.title}」，${info.status}${outcome ? `，${OUTCOME_STAMP[outcome]}` : ''}`
  return h(Card, { face: experimentFace({ id: info.id, icon: info.icon }, info.cells), size, family: 'experiment', label, live: props.live, flipped: props.flipped, bob: props.bob, delay: props.delay, tilt: props.tilt, className: props.className, onOpen: props.onOpen },
    h('span', { className: 'lp-codex-t lp-codex-no' }, '实验'),
    h('span', { className: 'lp-codex-t lp-codex-tier lp-codex-tier-r' }, `${info.days} 天`),
    h('span', { className: nameClass(info.title, size) }, info.title),
    h('span', { className: 'lp-codex-t lp-codex-sub' }, h('span', null, info.status), h('span', null, info.right)),
    outcome === 'outside' && props.foil ? h('div', { className: 'lp-codex-holo', 'aria-hidden': true }) : null,
    outcome ? h('span', { className: cx('lp-codex-stamp', outcome !== 'outside' && 'lp-codex-calm') }, OUTCOME_STAMP[outcome]) : null,
    info.waiting ? h('span', { className: 'lp-codex-stamp lp-codex-calm' }, '等复查') : null)
}

function optionInfo(option: ExperimentOption): ExpCardInfo {
  return { id: option.id, icon: option.icon, title: option.title_zh, days: option.days, cells: [], status: '可选', right: option.randomizable ? '可选随机版' : '', result: null }
}

function runInfo(run: RunView): ExpCardInfo {
  const result = run.result
  const status = run.status === 'revealed' && result ? `做到 ${result.done_days}/${result.window_days} 天`
    : run.status === 'retest_wait' ? '等复查'
      : run.status === 'ready' ? '可以翻了'
        : `第 ${run.day}/${run.days} 天`
  return { id: run.experiment_id, icon: run.icon, title: run.title_zh, days: run.days, cells: run.cells, status, right: run.randomized ? '随机版' : '', result: run.status === 'revealed' ? result : null, waiting: run.status === 'retest_wait' }
}

function resultCardFace(card: ResultCard): React.ReactElement[] {
  const short = card.title_zh.replace(/（[^）]*）/g, '').trim()
  return [
    h('span', { key: 'no', className: 'lp-codex-t lp-codex-no' }, '复查'),
    h('img', { key: 'gem', className: 'lp-codex-gem', src: toDataURL(gem(card.tier)), alt: '' }),
    h('span', { key: 'name', className: nameClass(short, 's4') }, short),
    h('span', { key: 'sub', className: 'lp-codex-t lp-codex-sub' }, h('span', null, card.value_zh ?? '没有算'), h('span', null, card.outcome ? OUTCOME_STAMP[card.outcome] : '')),
  ]
}

// ---- info boxes ----------------------------------------------------------------------------------------------

function TierChip(props: { tier: Tier }): React.ReactElement {
  return h('span', { className: `lp-codex-chip lp-codex-chip-${props.tier}` }, `${TIERS[props.tier].metal} · ${TIERS[props.tier].label}`)
}

function ChapterChip(props: { chapter: ChapterInfo | undefined }): React.ReactElement | null {
  if (!props.chapter) return null
  return h('span', { className: 'lp-codex-chip' }, h('img', { src: toDataURL(emblem(props.chapter.motif)), alt: '' }), props.chapter.title_zh)
}

function SourceLine(props: { source: StudyCard['source'] }): React.ReactElement {
  const s = props.source
  const head = [`${s.first_author}${s.et_al ? ' 等' : ''}`, s.journal, s.year ? String(s.year) : '', s.preprint ? '预印本' : ''].filter(Boolean).join(' · ')
  return h('div', { className: 'lp-codex-src' },
    h('p', null, `出处：${head}`),
    s.doi ? h('p', null, h('a', { className: 'lp-codex-link', href: `https://doi.org/${s.doi}`, target: '_blank', rel: 'noopener noreferrer' }, `DOI ${s.doi}`)) : null,
    s.coi_zh ? h('p', { className: 'lp-codex-coi' }, s.coi_zh) : null)
}

function StudyInfo(props: { card: LibStudy; chapter: ChapterInfo | undefined; full?: boolean; met?: string[]; speciesName: (key: string) => string; metFace?: (key: string) => Raster | null }): React.ReactElement {
  const { card } = props
  const tier = TIERS[card.tier]
  return h('div', { className: 'lp-codex-info' },
    h('h3', { className: cx('lp-codex-info-h', widthOf(card.title_zh) > 10 && 'lp-codex-long') }, card.title_zh),
    h('p', { className: 'lp-codex-desc' }, ...highlight(card.line_zh)),
    h('div', { className: 'lp-codex-pills' }, h(TierChip, { tier: card.tier }), h(ChapterChip, { chapter: props.chapter })),
    props.full ? h('div', { className: 'lp-codex-more' },
      h('p', null, h('b', null, '这项研究'), card.about_zh),
      card.relation_zh ? h('p', { className: 'lp-codex-mine' }, h('b', null, '和你的关系'), card.relation_zh) : null,
      h('p', null, h('b', null, `为什么是${tier.metal}色`), `${tier.metal} · ${tier.label}：${card.tier_reason_zh}`),
      h(SourceLine, { source: card.source }),
      h('p', { className: 'lp-codex-readmark' }, h('img', { src: toDataURL(seal('read')), alt: '' }), '已读'),
      ...(props.met ?? []).map((key) => h('div', { key, className: 'lp-codex-status lp-codex-pop', style: { '--d': '.3s' } as React.CSSProperties },
        props.metFace?.(key) ? h(Card, { face: props.metFace(key) as Raster, size: 's2', family: 'species', label: props.speciesName(key) }) : null,
        h('span', null, h('b', null, `遇见了 ${props.speciesName(key)}`), h('br'), '已放进物种志。')))) : null)
}

function ResultInfo(props: { run: RunView; result: RunResult }): React.ReactElement {
  const { run, result } = props
  return h('div', { className: 'lp-codex-info lp-codex-result' },
    h('h3', { className: cx('lp-codex-info-h', widthOf(run.title_zh) > 10 && 'lp-codex-long') }, run.title_zh),
    h('p', { className: 'lp-codex-result-main' }, result.primary.text_zh),
    result.praise_zh ? h('p', { className: 'lp-codex-praise' }, result.praise_zh) : null,
    ...result.also.map((row) => h('p', { key: row.key, className: 'lp-codex-also' }, row.text_zh)),
    h('p', null, `${result.window_days} 天里做到了 ${result.done_days} 天。`),
    run.randomized ? h('p', { className: 'lp-codex-cap' }, '这是随机版：比较的是做的日子和不做的日子。') : null,
    h('details', { className: 'lp-codex-fold' }, h('summary', null, '怎么算的'), h('p', null, result.how_zh)),
    null)
}

function OptionText(props: { option: ExperimentOption }): React.ReactElement {
  const o = props.option
  return h('div', { className: 'lp-codex-slot-text' },
    h('p', null, h('b', null, '做什么　'), o.do_zh),
    h('p', null, h('b', null, '看什么　'), o.primary_zh),
    o.also_zh.length > 0 ? h('p', null, h('b', null, '顺便看　'), o.also_zh.join('、')) : null,
    h('div', { className: 'lp-codex-chips' },
      h('span', { className: 'lp-codex-chip lp-codex-chip-exp' }, `${o.days} 天`),
      o.randomizable ? h('span', { className: 'lp-codex-chip lp-codex-chip-blue' }, '可选随机版') : null,
      o.needs_retest ? h('span', { className: 'lp-codex-chip lp-codex-chip-human' }, '等复查揭晓') : null))
}

// ---- small controls ------------------------------------------------------------------------------------------

function Btn(props: { tone?: 'orange' | 'blue' | 'red' | 'green' | 'teal' | 'violet' | 'grey' | 'gold'; small?: boolean; onClick?: () => void; disabled?: boolean; pressed?: boolean; children?: React.ReactNode; label?: string; className?: string }): React.ReactElement {
  return h('button', {
    type: 'button',
    className: cx('lp-codex-btn', props.tone && props.tone !== 'orange' && `lp-codex-btn-${props.tone}`, props.small && 'lp-codex-btn-sm', props.className),
    onClick: props.onClick, disabled: props.disabled, 'aria-pressed': props.pressed, 'aria-label': props.label,
  }, props.children)
}

function PixelSwitch(props: { checked: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean }): React.ReactElement {
  return h('button', { type: 'button', role: 'switch', 'aria-checked': props.checked, disabled: props.disabled, className: 'lp-codex-switch', onClick: () => props.onChange(!props.checked) },
    h('span', { className: 'lp-codex-switch-track', 'aria-hidden': true }, h('span', { className: 'lp-codex-switch-thumb' })),
    h('span', null, props.label),
    h('span', { className: 'lp-codex-switch-state' }, props.checked ? '开' : '关'))
}

function Choice<V extends string>(props: { value: V; options: Array<[V, string]>; onChange: (value: V) => void; label: string; disabled?: boolean }): React.ReactElement {
  return h('div', { className: 'lp-codex-choice', role: 'group', 'aria-label': props.label },
    ...props.options.map(([value, text]) => h(Btn, { key: value, small: true, tone: props.value === value ? 'teal' : 'grey', pressed: props.value === value, disabled: props.disabled, onClick: () => props.onChange(value) }, text)))
}

function MyDayFields(props: { value: { start: string; end: string }; onChange: (next: { start: string; end: string }) => void }): React.ReactElement {
  return h('div', { className: 'lp-codex-times' },
    h('label', { className: 'lp-codex-field' }, h('span', null, '开始'), h('input', { className: 'lp-codex-time', type: 'time', value: props.value.start, onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange({ ...props.value, start: event.target.value }) })),
    h('span', { 'aria-hidden': true }, '—'),
    h('label', { className: 'lp-codex-field' }, h('span', null, '结束'), h('input', { className: 'lp-codex-time', type: 'time', value: props.value.end, onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange({ ...props.value, end: event.target.value }) })))
}

// ---- overlays --------------------------------------------------------------------------------------------------

type Overlay =
  | { kind: 'pack'; pack: Pack; phase: 'idle' | 'shake' | 'cards' | 'empty'; options: ExperimentOption[]; results: ResultCard[]; flipped: boolean[]; dealt: boolean; chosen: string | null; leaving: boolean; note: string }
  | { kind: 'choose'; option: ExperimentOption }
  | { kind: 'reveal'; run: RunView; phase: 'back' | 'turning' | 'done' }
  | { kind: 'result'; run: RunView }
  | { kind: 'study'; id: string; met: string[] }
  | { kind: 'confirm'; text: string; ok: string; tone: 'red' | 'orange'; run: () => void }

function ChoosePanel(props: { option: ExperimentOption; busy: boolean; onStart: (answers: Record<string, boolean>, randomized: boolean) => void; onBack?: () => void }): React.ReactElement {
  const o = props.option
  const [answers, setAnswers] = React.useState<Record<string, boolean>>({})
  const [randomized, setRandomized] = React.useState(false)
  const unanswered = o.questions.some((q) => answers[q.id] == null)
  return h('div', { className: 'lp-codex-box lp-codex-stack lp-codex-pop' },
    h('h3', { className: 'lp-codex-h2' }, o.title_zh),
    h(OptionText, { option: o }),
    h('p', { className: 'lp-codex-cap' }, `来源：${o.source_zh}`),
    o.needs_retest ? h('p', { className: 'lp-codex-cap' }, '这个实验的结果要靠化验，等下次复查时在复查包里揭晓。') : null,
    o.questions.length > 0 ? h('div', { className: 'lp-codex-ask' },
      h('p', { className: 'lp-codex-h3' }, '开始前问一句'),
      ...o.questions.map((q) => h('div', { key: q.id, className: 'lp-codex-ask-q' },
        h('span', null, q.text_zh),
        h(Choice<'yes' | 'no'>, {
          label: q.text_zh, value: answers[q.id] === true ? 'yes' : answers[q.id] === false ? 'no' : ('' as 'yes'),
          options: [['yes', '是'], ['no', '不是']], onChange: (value) => setAnswers((all) => ({ ...all, [q.id]: value === 'yes' })),
        })))) : null,
    o.randomizable ? h('div', { className: 'lp-codex-stack' },
      h(PixelSwitch, { checked: randomized, label: '用随机版', onChange: setRandomized }),
      h('p', { className: 'lp-codex-cap' }, '随机版：每天早上由 LongPi 随机定今天做还是不做，两种日子各 7 天，最后比较两种日子。比前后比较更能排除天气和忙闲的影响。')) : null,
    h('div', { className: 'lp-codex-row' },
      h(Btn, { tone: 'green', disabled: props.busy || unanswered, onClick: () => props.onStart(answers, randomized) }, '开始这个实验'),
      props.onBack ? h(Btn, { tone: 'grey', onClick: props.onBack }, '回到三张') : null),
    unanswered ? h('p', { className: 'lp-codex-cap' }, '先回答上面的问题。') : null)
}

// ---- the page --------------------------------------------------------------------------------------------------

export function CodexPage(props: { onNotice?: (text: string) => void }): React.ReactElement {
  const [view, setView] = React.useState<CodexView | null>(null)
  const [lib, setLib] = React.useState<LibraryView | null>(null)
  const [libFailed, setLibFailed] = React.useState('')
  const [failed, setFailed] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [tab, setTab] = React.useState<TabKey>('exp')
  const [ov, setOv] = React.useState<Overlay | null>(null)
  const [stageTop, setStageTop] = React.useState(16)
  const [minHeight, setMinHeight] = React.useState<number | null>(null)
  const [notice, setNotice] = React.useState<{ text: string; id: number } | null>(null)
  const [tip, setTip] = React.useState<{ id: string; left: number; top: number } | null>(null)
  const [filterTier, setFilterTier] = React.useState<Tier | null>(null)
  const [filterChapter, setFilterChapter] = React.useState<string | null>(null)
  const [myDay, setMyDay] = React.useState<{ start: string; end: string } | null>(null)
  const [intro, setIntro] = React.useState<{ my_day: { start: string; end: string }; season_mode: '8w' | 'retest'; standup: boolean } | null>(null)
  const root = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const shards = React.useRef<HTMLDivElement>(null)
  const stage = React.useRef<HTMLDivElement>(null)
  const tipBox = React.useRef<HTMLDivElement>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>())
  const reduce = useReducedMotion()

  const still = Boolean(view?.prefs.presentation)
  const simple = Boolean(view?.prefs.simple)
  const anim = !still && !reduce && !simple
  const flipAnim = !still && !simple

  const later = React.useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(() => { timers.current.delete(id); fn() }, ms)
    timers.current.add(id)
  }, [])
  const wait = React.useCallback((ms: number) => new Promise<void>((resolve) => { if (ms <= 0) resolve(); else later(ms, resolve) }), [later])
  React.useEffect(() => () => { for (const id of timers.current) clearTimeout(id); timers.current.clear() }, [])

  const say = React.useCallback((text: string) => {
    if (!text) return
    setNotice({ text, id: Date.now() })
    props.onNotice?.(text)
  }, [props.onNotice])
  React.useEffect(() => {
    if (!notice) return undefined
    const id = setTimeout(() => setNotice((now) => (now?.id === notice.id ? null : now)), 7000)
    return () => clearTimeout(id)
  }, [notice])

  const load = React.useCallback(async () => {
    try {
      const next = await getJson<CodexView>(PATH)
      if (!isView(next)) throw new Error('长寿图鉴的回答看不懂。')
      setView(next)
      setFailed('')
    } catch (error) {
      setFailed(errorText(error, '没能打开长寿图鉴'))
    }
  }, [])
  const loadLibrary = React.useCallback(async () => {
    try {
      const next = await getJson<LibraryView>(`${PATH}/library`)
      if (!isLibrary(next)) throw new Error('图书馆的回答看不懂。')
      setLib(next)
      setLibFailed('')
    } catch (error) {
      setLibFailed(errorText(error, '没能打开图书馆'))
    }
  }, [])
  React.useEffect(() => { injectFont(); void load(); void loadLibrary() }, [load, loadLibrary])

  // The swirl: still under 演示模式 and reduced motion; the disposer clears its timer.
  React.useEffect(() => {
    if (!canvas.current) return undefined
    return startSwirl(canvas.current, { still: still || simple })
  }, [still, simple])

  async function act(body: CodexAction): Promise<ActResult | null> {
    setBusy(true)
    try {
      const res = await postJson<ActResult>(PATH, body)
      if (isView(res.view)) setView(res.view)
      if (!res.ok) { say(res.error || '没有做成，请再试一次。'); return null }
      if (res.note_zh) say(res.note_zh)
      return res
    } catch (error) {
      say(errorText(error, '没有做成，请再试一次。'))
      void load()
      return null
    } finally {
      setBusy(false)
    }
  }

  // ---- overlay plumbing ----
  const openOverlay = (next: Overlay) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setTip(null)
    if (root.current) setStageTop(visibleTop(root.current) + 16)
    setOv(next)
  }
  const closeOverlay = React.useCallback(() => {
    setOv(null)
    setMinHeight(null)
    const back = opener.current
    opener.current = null
    if (back && document.contains(back)) back.focus()
  }, [])
  const ovKind = ov?.kind ?? null
  React.useEffect(() => {
    if (!ovKind) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeOverlay() } }
    document.addEventListener('keydown', onKey)
    // Focus moves into the dialog (Tab goes on from there); Esc closes it.
    stage.current?.focus({ preventScroll: true })
    return () => document.removeEventListener('keydown', onKey)
  }, [ovKind, closeOverlay])
  // Keep the container tall enough for whatever the stage shows.
  React.useLayoutEffect(() => {
    if (!ov || !stage.current) return undefined
    const el = stage.current
    const fit = () => setMinHeight(stageTop + el.offsetHeight + 24)
    fit()
    if (typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [ov, stageTop])

  /** Pixel shards from the middle of an element, inside the container. */
  const burst = (el: Element | null, colors: string[], n: number) => {
    if (!anim || !el || !root.current || !shards.current) return
    const base = root.current.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const x = rect.left - base.left + rect.width / 2
    const y = rect.top - base.top + rect.height / 2
    for (let i = 0; i < n; i += 1) {
      const node = document.createElement('i')
      node.className = 'lp-codex-shard'
      const a = Math.random() * Math.PI * 2
      const d = 60 + Math.random() * 160
      node.style.left = `${Math.round(x - 4)}px`
      node.style.top = `${Math.round(y - 4)}px`
      node.style.setProperty('--dx', `${Math.round(Math.cos(a) * d)}px`)
      node.style.setProperty('--dy', `${Math.round(Math.sin(a) * d)}px`)
      node.style.setProperty('--c', colors[i % colors.length] as string)
      shards.current.appendChild(node)
      later(900, () => node.remove())
    }
  }

  // ---- packs ----
  const openPack = (pack: Pack) => {
    const opened = pack.kind === 'experiment' && Boolean(pack.opened) && pack.options.length > 0
    openOverlay({ kind: 'pack', pack, phase: opened ? 'cards' : 'idle', options: opened ? pack.options : [], results: [], flipped: [false, false, false], dealt: opened, chosen: null, leaving: false, note: '' })
  }
  const tearPack = async () => {
    if (!ov || ov.kind !== 'pack' || ov.phase !== 'idle') return
    const pack = ov.pack
    setOv({ ...ov, phase: 'shake' })
    const [res] = await Promise.all([act(codexBodies.openPack(pack.id)), wait(anim ? 500 : 0)])
    if (!res) { setOv((now) => (now && now.kind === 'pack' ? { ...now, phase: 'idle' } : now)); return }
    burst(stage.current?.querySelector('.lp-codex-ovpack') ?? null, PACK_SHARDS[pack.kind], 26)
    if (pack.kind === 'experiment') {
      const options = res.view.packs.find((row) => row.id === pack.id)?.options ?? []
      if (options.length === 0) { setOv((now) => (now && now.kind === 'pack' ? { ...now, phase: 'empty', note: res.note_zh || '现在没有适合你的实验。包会一直留着。' } : now)); return }
      dealCards(options.length, { options, results: [] })
    } else {
      dealCards(res.pack?.results.length ?? 0, { options: [], results: res.pack?.results ?? [] })
    }
  }
  const dealCards = (count: number, content: { options: ExperimentOption[]; results: ResultCard[] }) => {
    const flipped = Array.from({ length: count }, () => flipAnim)
    setOv((now) => (now && now.kind === 'pack' ? { ...now, phase: 'cards', ...content, flipped, dealt: !flipAnim } : now))
    if (!flipAnim) return
    later((anim ? 450 : 60) + count * 160 + 700, () => setOv((now) => (now && now.kind === 'pack' ? { ...now, dealt: true } : now)))
    for (let i = 0; i < count; i += 1) {
      later((anim ? 450 : 60) + i * 160, () => {
        setOv((now) => {
          if (!now || now.kind !== 'pack') return now
          const next = [...now.flipped]
          next[i] = false
          return { ...now, flipped: next }
        })
        const card = content.results[i]
        if (card && !card.plain) later(200, () => burst(stage.current?.querySelector(`[data-slot="${i}"] .lp-codex-pc`) ?? null, SHARD_GOLD, 14))
      })
    }
  }
  const beginRun = async (option: ExperimentOption, packId: string | null, answers: Record<string, boolean>, randomized: boolean) => {
    const res = await act(codexBodies.begin(option.id, packId, answers, randomized))
    if (!res) return
    if (!res.note_zh) say(`开始了「${res.run?.title_zh ?? option.title_zh}」。从今天算第 1 天。`)
    if (packId) {
      setOv((now) => (now && now.kind === 'pack' ? { ...now, leaving: true } : now))
      await wait(anim ? 420 : 0)
    }
    setTab('exp')
    closeOverlay()
  }

  // ---- reveal ----
  const turn = async () => {
    if (!ov || ov.kind !== 'reveal' || ov.phase !== 'back') return
    const res = await act(codexBodies.reveal(ov.run.id))
    if (!res) return
    const run = res.run ?? res.view.deck[0] ?? ov.run
    setOv({ kind: 'reveal', run, phase: 'turning' })
    await wait(flipAnim ? 380 : 0)
    setOv((now) => (now && now.kind === 'reveal' ? { ...now, phase: 'done' } : now))
    if (run.result?.outcome === 'outside') later(40, () => burst(stage.current?.querySelector('.lp-codex-pc') ?? null, SHARD_FOIL, 34))
  }

  // ---- library ----
  const speciesName = React.useCallback((key: string) => lib?.species.find((row) => row.key === key)?.name_zh ?? OBJECT_ZH[key] ?? key, [lib])
  const speciesRaster = React.useCallback((key: string) => {
    const row = lib?.species.find((item) => item.key === key)
    return row ? speciesFace(row, false) : null
  }, [lib])
  const openStudy = async (card: LibStudy) => {
    openOverlay({ kind: 'study', id: card.id, met: [] })
    const res = await act(codexBodies.read(card.id))
    if (!res) return
    const met = res.met ?? []
    setLib((now) => now ? {
      ...now,
      studies: now.studies.map((row) => (row.id === card.id ? { ...row, read: true } : row)),
      species: now.species.map((row) => (met.includes(row.key) ? { ...row, met: true } : row)),
    } : now)
    if (met.length > 0) {
      setOv((now) => (now && now.kind === 'study' && now.id === card.id ? { ...now, met } : now))
      say(`遇见了 ${met.map(speciesName).join('、')}，已放进物种志。`)
    }
  }
  const hoverStudy = (id: string) => (el: HTMLElement | null) => {
    if (!el || !root.current || simple) { setTip(null); return }
    const base = root.current.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const width = 268
    const right = rect.right - base.left + 16
    const left = rect.left - base.left - width - 16
    const x = right + width <= base.width - 8 ? right : left >= 8 ? left : null
    if (x == null) { setTip(null); return }
    setTip({ id, left: Math.round(x), top: Math.round(rect.top - base.top) })
  }
  React.useLayoutEffect(() => {
    if (!tip || !tipBox.current || !root.current) return
    const max = root.current.offsetHeight - tipBox.current.offsetHeight - 12
    if (tip.top > max) tipBox.current.style.top = `${Math.max(8, max)}px`
  }, [tip])

  // ---- rendering ----
  const packsWaiting = view ? view.packs.length : 0
  const containerClass = cx('lp lp-codex', still && 'lp-codex-still', simple && 'lp-codex-simple')
  const shell = (...children: React.ReactNode[]) => h('div', { className: containerClass, ref: root, style: minHeight ? { minHeight } : undefined, role: 'region', 'aria-label': '长寿图鉴' },
    h('div', { className: 'lp-codex-bgwrap', 'aria-hidden': true }, h('div', { className: 'lp-codex-bgview' }, h('canvas', { className: 'lp-codex-bg', ref: canvas }))),
    h('div', { className: 'lp-codex-body' }, ...children),
    tip && lib && !ov ? tipNode(tip) : null,
    ov ? overlayNode(ov) : null,
    h('div', { className: 'lp-codex-shards', ref: shards, 'aria-hidden': true }))

  const header = (side?: React.ReactNode) => h('header', { className: 'lp-codex-head' },
    h('div', { className: 'lp-codex-logo' },
      h('img', { src: toDataURL(cardBack()), alt: '' }),
      h('div', null,
        h('h2', { className: 'lp-codex-h1' }, '长寿图鉴'),
        h('p', { className: 'lp-codex-meta' }, ...seasonLine()))),
    side ?? null)

  function seasonLine(): React.ReactNode[] {
    const season = view?.season
    if (!view || !view.enabled || !view.started || !season) return ['读研究，做两周的小实验，翻开看自己的结果。']
    if (season.status === 'closed') return [h('b', { key: 'end' }, '赛季已结束'), '。做过的实验都在牌组里。']
    const mode = season.mode === 'retest' ? '到下次复查为止' : `共 ${season.weeks} 周`
    const out: React.ReactNode[] = [h('b', { key: 'wk' }, `赛季 · 第 ${season.week} 周`), ` / ${mode}`]
    if (packsWaiting > 0) out.push(` · ${packsWaiting} 个包等你拆开`)
    if (view.ready.length > 0) out.push(` · ${view.ready.length} 张实验卡可以翻了`)
    return out
  }

  const status = notice ? h('div', { className: 'lp-codex-status', role: 'status' }, h('span', null, notice.text), h(Btn, { small: true, tone: 'grey', label: '关闭提示', onClick: () => setNotice(null) }, '知道了')) : null
  const memberLine = view?.member ? h('p', { className: 'lp-codex-box lp-codex-cream' }, view.member.note_zh) : null

  if (!view) {
    return shell(header(),
      failed
        ? h('div', { className: 'lp-codex-box lp-codex-stack', role: 'alert' }, h('p', null, `没能打开长寿图鉴：${failed}`), h('div', null, h(Btn, { onClick: () => { void load() } }, '再试一次')))
        : h('p', { className: 'lp-codex-box' }, '正在打开长寿图鉴…'))
  }

  if (!view.enabled) {
    const closed = view.reason === 'opt_out'
    return shell(header(), memberLine,
      h('div', { className: 'lp-codex-box lp-codex-stack' },
        h('p', { className: 'lp-codex-big' }, view.reason_zh || '长寿图鉴没有打开。'),
        closed ? h('div', null, h(Btn, { tone: 'green', disabled: busy, onClick: () => { void act(codexBodies.prefs({ codex: true })) } }, '重新打开')) : null),
      status)
  }

  if (!view.started) return shell(header(), memberLine, firstOpen(), status)

  const tabs: Array<[TabKey, string, string]> = [
    ['exp', '实验', String(view.packs.length + view.ready.length || '')],
    ['library', '图书馆', ''],
    ['deck', '牌组', view.deck.length ? String(view.deck.length) : ''],
    ['species', '物种志', `${view.species.met}/${view.species.total}`],
    ['footprints', '足迹', ''],
    ['settings', '设置', ''],
  ]
  const closedSeason = view.season?.status === 'closed'
  return shell(
    header(closedSeason ? h('div', { className: 'lp-codex-head-side' }, h(Btn, { tone: 'green', disabled: busy, onClick: () => { void act(codexBodies.nextSeason()) } }, '开始下一个赛季')) : null),
    memberLine,
    status,
    h('nav', { className: 'lp-codex-tabs', role: 'tablist', 'aria-label': '长寿图鉴' },
      ...tabs.map(([key, label, badge]) => h('button', {
        key, type: 'button', role: 'tab', id: `lp-codex-tab-${key}`, 'aria-selected': tab === key, 'aria-controls': 'lp-codex-panel',
        className: 'lp-codex-btn lp-codex-tab', onClick: () => { setTab(key); setTip(null) },
      }, label, badge ? h('span', { className: 'lp-codex-tab-n' }, badge) : null))),
    h('div', { id: 'lp-codex-panel', role: 'tabpanel', 'aria-labelledby': `lp-codex-tab-${tab}`, className: 'lp-codex-stack' },
      tab === 'exp' ? experimentsTab()
        : tab === 'library' ? libraryTab()
          : tab === 'deck' ? deckTab()
            : tab === 'species' ? speciesTab()
              : tab === 'footprints' ? footprintsTab()
                : settingsTab()))

  // ---- first open ----
  function firstOpen(): React.ReactNode {
    const v = view as CodexView
    const form = intro ?? { my_day: v.intro.my_day, season_mode: v.intro.season_mode, standup: v.intro.standup }
    const set = (patch: Partial<typeof form>) => setIntro({ ...form, ...patch })
    return h('div', { className: 'lp-codex-box lp-codex-set' },
      h('div', { className: 'lp-codex-pair' },
        h('div', { className: 'lp-codex-hand', 'aria-hidden': true },
          h('img', { src: toDataURL(packSprite('experiment')), alt: '', width: 90, height: 126, className: 'lp-codex-bob' })),
        h('div', { className: 'lp-codex-stack' },
          h('h3', { className: 'lp-codex-h2' }, '第一次打开长寿图鉴'),
          h('p', null, CODEX_INTRO),
          h('p', { className: 'lp-codex-lead' }, SEASON_INTRO))),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '你通常几点开始、几点结束一天的工作？'),
        h('div', { className: 'lp-codex-stack' },
          h(MyDayFields, { value: form.my_day, onChange: (next) => set({ my_day: next }) }),
          h('p', { className: 'lp-codex-cap' }, '可以跨过午夜，比如 13:00 到 02:00。LongPi 只在这段时间里提醒你。'))),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '一个赛季多长？'),
        h(Choice<'8w' | 'retest'>, { label: '赛季长度', value: form.season_mode, options: [['8w', '8 周'], ['retest', '到下次复查为止']], onChange: (value) => set({ season_mode: value }) })),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '起身提醒'),
        v.intro.wristband
          ? h('div', { className: 'lp-codex-stack' },
            h(PixelSwitch, { checked: form.standup, label: '坐太久时提醒我起来走两分钟', onChange: (value) => set({ standup: value }) }),
            h('p', { className: 'lp-codex-cap' }, '你在 DSH 前已经坐了 90 分钟、又正好在等 agent 跑任务时，健康栏会出现一行小字。点「好」后手环记到你走动才算一次。每天最多两次，不发奖励。'))
          : h('p', null, '没有手环时，不会出现起身提醒。')),
      h('div', null, h(Btn, { tone: 'green', disabled: busy, onClick: () => { void act(codexBodies.start(form.my_day, form.season_mode, v.intro.wristband ? form.standup : false)) } }, '开始')))
  }

  // ---- 实验 ----
  function experimentsTab(): React.ReactNode {
    const v = view as CodexView
    const parts: React.ReactNode[] = []
    const top: React.ReactNode[] = []
    if (v.ready.length > 0) {
      top.push(h('section', { key: 'ready', className: 'lp-codex-box lp-codex-section' },
        h('h3', { className: 'lp-codex-h2' }, '可以翻了'),
        ...v.ready.map((run, i) => h('div', { key: run.id, className: 'lp-codex-pair' },
          h(Card, { face: cardBack(), size: simple ? 's3' : 's4', family: 'back', label: `「${run.title_zh}」做完了，翻开看结果`, live: true, bob: anim, delay: -i * 0.7, onOpen: () => openOverlay({ kind: 'reveal', run, phase: 'back' }) }),
          h('div', { className: 'lp-codex-stack' },
            h('p', { className: 'lp-codex-big' }, `「${run.title_zh}」做完了`),
            h('p', null, `${run.days} 天里做到了 ${run.done_count} 天。`),
            h('p', { className: 'lp-codex-lead' }, `翻开看主要结果：${run.primary_zh}，有没有超出你的平时波动。`),
            h('div', null, h(Btn, { tone: 'gold', onClick: () => openOverlay({ kind: 'reveal', run, phase: 'back' }) }, '翻开')))))))
    }
    if (v.packs.length > 0) {
      top.push(h('section', { key: 'packs', className: 'lp-codex-box lp-codex-section' },
        h('h3', { className: 'lp-codex-h2' }, '等你拆开的包'),
        h('p', { className: 'lp-codex-lead' }, '实验包里有三个小实验（多数是两周），选一个开始；复查包里是这次体检能算出的结果卡。包会一直留着。'),
        h('div', { className: 'lp-codex-shelf' }, ...v.packs.map((pack, i) => h('button', { key: pack.id, type: 'button', className: 'lp-codex-pack', onClick: () => openPack(pack), 'aria-label': `${pack.kind === 'experiment' ? '实验包' : '复查包'}：${pack.source_zh}，点开拆` },
          h('img', { src: toDataURL(packSprite(pack.kind)), alt: '', className: anim ? 'lp-codex-bob' : undefined, style: { '--d': `${-i * 0.9}s` } as React.CSSProperties }),
          h('span', { className: 'lp-codex-pname' }, pack.kind === 'experiment' ? '实验包' : '复查包'),
          h('span', { className: 'lp-codex-cap' }, pack.source_zh),
          h('span', { className: 'lp-codex-k-gold' }, pack.empty_zh ?? (pack.opened ? '拆开了，还没选' : '点开拆')))))))
    }
    if (top.length > 0) parts.push(h('div', { key: 'top', className: 'lp-codex-duo' }, ...top))
    parts.push(h('section', { key: 'running', className: 'lp-codex-box lp-codex-section' },
      h('h3', { className: 'lp-codex-h2' }, '进行中'),
      v.running.length === 0
        ? h('p', { className: 'lp-codex-empty' }, v.packs.some((pack) => pack.kind === 'experiment') ? '现在没有进行中的实验。拆开上面的实验包，选一个开始。' : '现在没有进行中的实验。做完一个实验、或者新赛季开始时，会有新的实验包。')
        : h('div', { className: 'lp-codex-stack' }, ...v.running.map((run) => runBlock(run))),
      v.running.length > 0 ? h('p', { className: 'lp-codex-cap' }, '底部 14 格是 14 天：亮的是做到的日子，暗的是断掉的日子，浅色是还没到的日子。断几天没关系，有 10 天的数据就能揭晓。') : null))
    if (v.reserve.length > 0) {
      parts.push(h('section', { key: 'reserve', className: 'lp-codex-box lp-codex-section' },
        h('h3', { className: 'lp-codex-h2' }, '待选'),
        h('p', { className: 'lp-codex-lead' }, '之前没选的实验放在这里，下次可以直接开始。'),
        h('ul', { className: 'lp-codex-list' }, ...v.reserve.map((option) => h('li', { key: option.id, className: 'lp-codex-item' },
          h('img', { src: toDataURL(experimentFace({ id: option.id, icon: option.icon }, [])), alt: '' }),
          h('div', { className: 'lp-codex-item-main' },
            h('b', null, option.title_zh),
            h('span', null, option.do_zh),
            h('span', { className: 'lp-codex-cap' }, `看什么：${option.primary_zh} · ${option.days} 天${option.randomizable ? ' · 可选随机版' : ''}${option.needs_retest ? ' · 等复查揭晓' : ''}`)),
          h(Btn, { tone: 'teal', small: true, onClick: () => openOverlay({ kind: 'choose', option }) }, '开始'))))))
    }
    return h(React.Fragment, null, ...parts)
  }

  function runBlock(run: RunView): React.ReactElement {
    const info = runInfo(run)
    const canTick = run.status === 'running' && Boolean(run.checkin_zh)
    return h('div', { key: run.id, className: 'lp-codex-pair' },
      h(ExpCard, { info, size: simple ? 's3' : 's4' }),
      h('div', { className: 'lp-codex-stack' },
        h('h4', { className: 'lp-codex-h2' }, run.title_zh),
        h('p', { className: 'lp-codex-run-day' }, run.status === 'retest_wait' ? '等复查' : `第 ${run.day}/${run.days} 天`),
        run.today_zh ? h('p', null, h('span', { className: 'lp-codex-today' }, run.today_zh)) : null,
        h('p', null, h('span', { className: 'lp-codex-k-gold' }, '做什么　'), run.do_zh),
        h('p', null, h('span', { className: 'lp-codex-k-gold' }, '看什么　'), run.primary_zh),
        run.status === 'retest_wait' ? h('p', { className: 'lp-codex-lead' }, '这个实验的结果靠化验。下次复查的结果进了档案，会在复查包里揭晓。') : null,
        canTick ? h('div', { className: 'lp-codex-row' },
          h(Btn, { tone: run.done_today ? 'teal' : 'green', pressed: run.done_today, disabled: busy, onClick: () => { void act(codexBodies.checkin(run.id, !run.done_today)) } }, run.done_today ? `今天已记：${run.checkin_zh.replace(/^今天/, '')}` : run.checkin_zh),
          run.done_today ? h('span', { className: 'lp-codex-cap' }, '记错了就再点一下。') : null) : null,
        run.status === 'running' && !run.checkin_zh ? h('p', { className: 'lp-codex-cap' }, '这个实验不用你记，手环或血压计会自动记上。') : null,
        h('details', { className: 'lp-codex-fold' }, h('summary', null, '怎么判定'), h('p', null, run.threshold_zh)),
        h('div', null, h(Btn, { tone: 'grey', small: true, disabled: busy, onClick: () => openOverlay({
          kind: 'confirm', text: `停下「${run.title_zh}」？停下不算失败，也不扣任何东西。`, ok: '停下', tone: 'red', run: () => { void act(codexBodies.stop(run.id)) },
        }) }, '停下'))))
  }

  // ---- 图书馆 ----
  function libraryTab(): React.ReactNode {
    if (!lib) {
      return h('div', { className: 'lp-codex-box lp-codex-stack' }, libFailed
        ? [h('p', { key: 'e' }, `没能打开图书馆：${libFailed}`), h('div', { key: 'b' }, h(Btn, { onClick: () => { void loadLibrary() } }, '再试一次'))]
        : h('p', null, '正在打开图书馆…'))
    }
    const chapters = [...lib.chapters].sort((a, b) => a.no - b.no)
    const order = new Map(chapters.map((row) => [row.id, row.no]))
    const read = lib.studies.filter((row) => row.read).length
    const pending = lib.pending > 0 ? h('p', { className: 'lp-codex-cap' }, `还有 ${lib.pending} 张卡在审核，审核通过后上架。`) : null
    if (lib.studies.length === 0) {
      return h('div', { className: 'lp-codex-box lp-codex-stack' }, h('h3', { className: 'lp-codex-h2' }, '图书馆'), h('p', null, '图书馆里还没有上架的研究卡。'), pending)
    }
    const shown = lib.studies.filter((row) => (!filterTier || row.tier === filterTier) && (!filterChapter || row.chapter === filterChapter))
      .sort((a, b) => Number(Boolean(b.relation_zh)) - Number(Boolean(a.relation_zh)) || (order.get(a.chapter) ?? 99) - (order.get(b.chapter) ?? 99) || a.no.localeCompare(b.no))
    const mine = shown.filter((row) => row.relation_zh)
    const groups: Array<{ key: string; title: string; cards: LibStudy[] }> = []
    if (mine.length > 0) groups.push({ key: 'mine', title: '和你有关', cards: mine })
    for (const chapter of chapters) {
      const cards = shown.filter((row) => !row.relation_zh && row.chapter === chapter.id)
      if (cards.length > 0) groups.push({ key: chapter.id, title: `第 ${chapter.no} 章 · ${chapter.title_zh}`, cards })
    }
    const tierCount = (tier: Tier) => lib.studies.filter((row) => row.tier === tier && (!filterChapter || row.chapter === filterChapter)).length
    return h(React.Fragment, null,
      h('section', { className: 'lp-codex-box lp-codex-section' },
        h('h3', { className: 'lp-codex-h2' }, '图书馆'),
        h('p', { className: 'lp-codex-lead' }, `${lib.studies.length} 张研究卡，随时可以读。读过 ${read} 张；读过的卡角上有蓝色的「已读」章。`),
        pending,
        h('div', { className: 'lp-codex-chapters' }, ...chapters.map((chapter) => {
          const size = lib.studies.filter((row) => row.chapter === chapter.id).length
          const done = lib.studies.filter((row) => row.chapter === chapter.id && row.read).length
          return h('button', { key: chapter.id, type: 'button', className: 'lp-codex-chapter', 'aria-pressed': filterChapter === chapter.id, onClick: () => setFilterChapter(filterChapter === chapter.id ? null : chapter.id) },
            h('span', { className: 'lp-codex-chapter-t' }, h('img', { src: toDataURL(emblem(chapter.motif)), alt: '' }), chapter.title_zh),
            h('span', { className: 'lp-codex-bar', 'aria-hidden': true }, h('span', { style: { width: `${size ? (done / size) * 100 : 0}%` } })),
            h('span', { className: 'lp-codex-chapter-c' }, h('span', null, `读过 ${done}/${size}`), h('span', null, `第 ${chapter.no} 章`)))
        })),
        h('div', { className: 'lp-codex-chips', role: 'group', 'aria-label': '按证据颜色筛选' },
          h('button', { type: 'button', className: 'lp-codex-filter', 'aria-pressed': filterTier == null, onClick: () => setFilterTier(null) }, '全部颜色'),
          ...TIER_ORDER.map((tier) => h('button', { key: tier, type: 'button', className: cx('lp-codex-filter', `lp-codex-chip-${tier}`, filterTier && filterTier !== tier && 'lp-codex-filter-off'), 'aria-pressed': filterTier === tier, onClick: () => setFilterTier(filterTier === tier ? null : tier) },
            `${TIERS[tier].metal} ${TIERS[tier].label} ${tierCount(tier)}`))),
        h('p', { className: 'lp-codex-cap' }, lib.note_zh)),
      shown.length === 0 ? h('p', { className: 'lp-codex-box' }, '这个筛选下没有卡。') : null,
      ...groups.map((group) => h('section', { key: group.key, className: 'lp-codex-box lp-codex-section' },
        h('h3', { className: 'lp-codex-h3' }, `${group.title} · ${group.cards.length} 张`),
        simple
          ? h('ul', { className: 'lp-codex-list' }, ...group.cards.map((card) => h('li', { key: card.id },
            h('button', { type: 'button', className: 'lp-codex-item-btn lp-codex-item', onClick: () => { void openStudy(card) } },
              h('img', { className: 'lp-codex-gemi', src: toDataURL(gem(card.tier)), alt: '' }),
              h('span', { className: 'lp-codex-item-main' }, h('b', null, `No.${card.no} ${card.title_zh}`), h('span', null, card.line_zh)),
              h('span', { className: TIERS[card.tier].key }, `${TIERS[card.tier].metal} · ${TIERS[card.tier].label}${card.read ? ' · 已读' : ''}`)))))
          : h('div', { className: 'lp-codex-grid' }, ...group.cards.map((card) => h(Card, {
            key: card.id, face: studyFace(card), size: 's3', family: 'study', label: studyLabel(card), live: true, tilt: anim,
            onOpen: () => { void openStudy(card) }, onHover: hoverStudy(card.id),
          }, h(StudyText, { card, size: 's3', speciesName }))))),
      ))
  }

  function tipNode(at: { id: string; left: number; top: number }): React.ReactNode {
    const card = lib?.studies.find((row) => row.id === at.id)
    if (!card) return null
    return h('div', { className: 'lp-codex-tip', ref: tipBox, style: { left: at.left, top: at.top }, 'aria-hidden': true },
      h(StudyInfo, { card, chapter: lib?.chapters.find((row) => row.id === card.chapter), speciesName }))
  }

  // ---- 牌组 ----
  function deckTab(): React.ReactNode {
    const v = view as CodexView
    if (v.deck.length === 0) return h('div', { className: 'lp-codex-box lp-codex-stack' }, h('h3', { className: 'lp-codex-h2' }, '牌组'), h('p', null, '做完的实验翻开后会收进这里，每做一次留一张。'))
    return h('section', { className: 'lp-codex-box lp-codex-section' },
      h('h3', { className: 'lp-codex-h2' }, '牌组'),
      h('p', { className: 'lp-codex-lead' }, '每做完一个实验留一张卡。主要结果超出你的平时波动时，卡是镭射版。点开看结果。'),
      simple
        ? h('ul', { className: 'lp-codex-list' }, ...v.deck.map((run) => h('li', { key: run.id },
          h('button', { type: 'button', className: 'lp-codex-item-btn lp-codex-item', onClick: () => openOverlay({ kind: 'result', run }) },
            h('img', { src: toDataURL(experimentFace({ id: run.experiment_id, icon: run.icon }, run.cells)), alt: '' }),
            h('span', { className: 'lp-codex-item-main' }, h('b', null, run.title_zh), h('span', null, run.result?.primary.text_zh ?? ''), h('span', { className: 'lp-codex-cap' }, `${dayZh(run.start)}–${dayZh(run.end)}`)),
            h('span', { className: run.result?.outcome === 'outside' ? 'lp-codex-k-red' : 'lp-codex-cap' }, run.result ? OUTCOME_STAMP[run.result.outcome] : '')))))
        : h('div', { className: 'lp-codex-hand' }, ...v.deck.map((run) => h('div', { key: run.id, className: 'lp-codex-stack' },
          h(ExpCard, { info: runInfo(run), live: true, foil: true, tilt: anim, onOpen: () => openOverlay({ kind: 'result', run }) }),
          h('p', { className: 'lp-codex-cap' }, `${dayZh(run.start)}–${dayZh(run.end)}${run.randomized ? ' · 随机版' : ''}`)))))
  }

  // ---- 物种志 ----
  function speciesTab(): React.ReactNode {
    if (!lib) return h('p', { className: 'lp-codex-box' }, libFailed ? `没能打开物种志：${libFailed}` : '正在打开物种志…')
    const met = lib.species.filter((row) => row.met).length
    return h('section', { className: 'lp-codex-box lp-codex-section' },
      h('h3', { className: 'lp-codex-h2' }, `物种志 · 遇见了 ${met}/${lib.species.length} 种`),
      h('p', { className: 'lp-codex-lead' }, '第一次读到用到某种动物的研究卡时，就遇见了它。卡下方是寿命尺：从一周到三百年，金点是这种动物，白线是人。'),
      h('div', { className: 'lp-codex-entries' }, ...lib.species.map((row) => {
        const count = row.studies.length
        return h('div', { key: row.key, className: 'lp-codex-entry' },
          h(Card, { face: speciesFace(row, !row.met), size: 's3', family: 'species', label: row.met ? `${row.name_zh}，寿命 ${row.lifespan_zh}` : '还没遇见的物种' },
            h('span', { className: 'lp-codex-t lp-codex-no' }, `No.${row.no}`),
            h('span', { className: 'lp-codex-t lp-codex-name' }, row.met ? row.name_zh : '？？？'),
            h('span', { className: 'lp-codex-t lp-codex-sub' }, h('span', null, row.met ? row.lifespan_zh : '还没遇见'))),
          row.met
            ? h('div', { className: 'lp-codex-stack' },
              h('p', { className: 'lp-codex-entry-h' }, row.name_zh),
              h('p', { className: 'lp-codex-latin' }, row.latin),
              h('div', { className: 'lp-codex-chips' }, h('span', { className: 'lp-codex-chip lp-codex-chip-species' }, `寿命 ${row.lifespan_zh}`), h('span', { className: 'lp-codex-chip' }, `${count} 张研究卡`)),
              h('p', { className: 'lp-codex-k-gold' }, row.hook_zh),
              h('p', null, row.body_zh))
            : h('div', { className: 'lp-codex-stack' },
              h('p', { className: 'lp-codex-entry-h' }, '？？？'),
              h('p', { className: 'lp-codex-lead' }, count > 0 ? `图书馆里有 ${count} 张研究卡用到它。读到其中一张，就会遇见它。` : '图书馆里暂时还没有用到它的研究卡。')))
      })))
  }

  // ---- 足迹 ----
  function footprintsTab(): React.ReactNode {
    const v = view as CodexView
    return h('section', { className: 'lp-codex-box lp-codex-section' },
      h('h3', { className: 'lp-codex-h2' }, '足迹'),
      h('p', { className: 'lp-codex-lead' }, v.footprints_note_zh),
      v.footprints.length === 0
        ? h('p', { className: 'lp-codex-empty' }, '还没有足迹。带着简报去看医生、按时复查、做完一个实验，都会记在这里。')
        : h('div', { className: 'lp-codex-entries' }, ...v.footprints.map((row: Footprint) => h('div', { key: row.id, className: 'lp-codex-entry' },
          h(Card, { face: footprintFace(row.kind), size: 's3', family: 'footprint', label: `足迹卡「${row.title_zh}」，${dayZh(row.day)}` },
            h('span', { className: 'lp-codex-t lp-codex-no' }, '足迹'),
            h('span', { className: nameClass(row.title_zh, 's3') }, row.title_zh),
            h('span', { className: 'lp-codex-t lp-codex-sub' }, h('span', null, dayZh(row.day)))),
          h('div', { className: 'lp-codex-stack' },
            h('p', { className: 'lp-codex-entry-h' }, row.title_zh),
            h('p', { className: 'lp-codex-k-gold' }, dayZh(row.day)),
            h('p', null, row.text_zh))))))
  }

  // ---- 设置 ----
  function settingsTab(): React.ReactNode {
    const v = view as CodexView
    const day = myDay ?? v.prefs.my_day
    const changed = day.start !== v.prefs.my_day.start || day.end !== v.prefs.my_day.end
    return h('section', { className: 'lp-codex-box lp-codex-set' },
      h('h3', { className: 'lp-codex-h2' }, '设置'),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '简洁模式'),
        h('div', { className: 'lp-codex-stack' },
          h(PixelSwitch, { checked: v.prefs.simple, label: '用列表显示', disabled: busy, onChange: (next) => { void act(codexBodies.prefs({ simple: next })) } }),
          h('p', { className: 'lp-codex-cap' }, '打开后用列表显示，不翻牌、不放镭射和碎片，内容不变。'))),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '演示模式'),
        h('div', { className: 'lp-codex-stack' },
          h(PixelSwitch, { checked: v.prefs.presentation, label: '投屏或开会时打开', disabled: busy, onChange: (next) => { void act(codexBodies.prefs({ presentation: next })) } }),
          h('p', { className: 'lp-codex-cap' }, '打开后，LongPi 不出现任何提示，图鉴里也不播放动画。'))),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '我的白天'),
        h('div', { className: 'lp-codex-stack' },
          h(MyDayFields, { value: day, onChange: setMyDay }),
          h('p', { className: 'lp-codex-cap' }, '提醒只在这段时间里出现。可以跨过午夜，比如 13:00 到 02:00。'),
          changed ? h('div', null, h(Btn, { small: true, tone: 'teal', disabled: busy, onClick: () => { void act(codexBodies.prefs({ my_day: day })).then((res) => { if (res) { setMyDay(null); say('我的白天已保存。') } }) } }, '保存')) : null)),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '起身提醒'),
        v.devices.wristband
          ? h('div', { className: 'lp-codex-stack' },
            h(PixelSwitch, { checked: v.prefs.standup, label: '坐太久时提醒我起来走两分钟', disabled: busy, onChange: (next) => { void act(codexBodies.prefs({ standup: next })) } }),
            h('p', { className: 'lp-codex-cap' }, '每天最多两次，不发奖励。点「好」之后手环看到你起身走动，才记一次起身。'))
          : h('p', null, '没有手环时，不会出现起身提醒。')),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '赛季长度'),
        h('div', { className: 'lp-codex-stack' },
          h(Choice<'8w' | 'retest'>, { label: '赛季长度', value: v.prefs.season_mode, disabled: busy, options: [['8w', '8 周'], ['retest', '到下次复查为止']], onChange: (value) => { void act(codexBodies.prefs({ season_mode: value })) } }),
          h('p', { className: 'lp-codex-cap' }, '从下一个赛季开始算。'))),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '规则'),
        h('ul', { className: 'lp-codex-rules' }, ...v.rules_zh.map((line) => h('li', { key: line }, line)))),
      h('div', { className: 'lp-codex-set-row' },
        h('span', null, '关闭'),
        h('div', { className: 'lp-codex-stack' },
          h('div', null, h(Btn, { tone: 'red', disabled: busy, onClick: () => openOverlay({
            kind: 'confirm', text: '关闭长寿图鉴？已经读过的卡、做过的实验和足迹都会留着，随时可以重新打开。', ok: '关闭', tone: 'red', run: () => { void act(codexBodies.prefs({ codex: false })) },
          }) }, '关闭长寿图鉴')))))
  }

  // ---- overlays ----
  function overlayNode(o: Overlay): React.ReactElement {
    const label = o.kind === 'pack' ? (o.pack.kind === 'experiment' ? '拆实验包' : '拆复查包') : o.kind === 'choose' ? '开始一个实验' : o.kind === 'reveal' ? '翻开实验卡' : o.kind === 'result' ? '实验结果' : o.kind === 'study' ? '研究卡' : '确认'
    return h('div', { className: 'lp-codex-ov', onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget && o.kind !== 'pack') closeOverlay() } },
      h('div', { className: 'lp-codex-stage', ref: stage, role: 'dialog', 'aria-modal': true, 'aria-label': label, tabIndex: -1, style: { top: stageTop } },
        o.kind === 'pack' ? packStage(o)
          : o.kind === 'choose' ? h('div', { className: 'lp-codex-ov-row' },
            h(ExpCard, { info: optionInfo(o.option) }),
            h('div', { className: 'lp-codex-ov-side' }, h(ChoosePanel, { option: o.option, busy, onStart: (answers, randomized) => { void beginRun(o.option, null, answers, randomized) }, onBack: closeOverlay })))
            : o.kind === 'reveal' ? revealStage(o)
              : o.kind === 'result' ? resultStage(o.run)
                : o.kind === 'study' ? studyStage(o)
                  : h('div', { className: 'lp-codex-box lp-codex-confirm' },
                    h('p', { className: 'lp-codex-big' }, o.text),
                    h('div', { className: 'lp-codex-row' },
                      h(Btn, { tone: o.tone, onClick: () => { closeOverlay(); o.run() } }, o.ok),
                      h(Btn, { tone: 'grey', onClick: closeOverlay }, '再想想'))),
        h(Btn, { tone: 'grey', small: true, className: 'lp-codex-ov-close', label: '关闭', onClick: closeOverlay }, '关闭 ×')))
  }

  function packStage(o: Extract<Overlay, { kind: 'pack' }>): React.ReactNode {
    const name = o.pack.kind === 'experiment' ? '实验包' : '复查包'
    if (o.phase === 'idle' || o.phase === 'shake') {
      return h(React.Fragment, null,
        h('p', { className: 'lp-codex-ov-line lp-codex-big' }, name),
        h('button', { type: 'button', className: cx('lp-codex-ovpack', o.phase === 'idle' && anim && 'lp-codex-idle', o.phase === 'shake' && anim && 'lp-codex-shake'), disabled: o.phase === 'shake' || busy, onClick: () => { void tearPack() }, 'aria-label': `拆开${name}` },
          h('img', { src: toDataURL(packSprite(o.pack.kind)), alt: '' })),
        h('p', { className: 'lp-codex-ov-line' }, o.pack.source_zh, h('br'), h('span', { className: 'lp-codex-cap' }, '点一下拆开')))
    }
    if (o.phase === 'empty') {
      return h('div', { className: 'lp-codex-box lp-codex-confirm' }, h('p', null, o.note), h('div', null, h(Btn, { tone: 'grey', onClick: closeOverlay }, '好')))
    }
    if (o.pack.kind === 'retest') {
      return h(React.Fragment, null,
        h('p', { className: 'lp-codex-ov-line lp-codex-big' }, '这次复查能算出的结果'),
        h('p', { className: 'lp-codex-ov-line' }, '每张写明和上次相比，有没有超出平时波动。需要先看医生的结果不放在这里，在健康页上单独说。'),
        o.results.length === 0 ? h('p', { className: 'lp-codex-box' }, '这次复查没有能算出的新结果。') : null,
        h('div', { className: 'lp-codex-ov-row' }, ...o.results.map((card, i) => h('div', { key: card.id, className: cx('lp-codex-slot', !o.dealt && 'lp-codex-deal'), 'data-slot': i, style: { '--d': `${i * 0.12}s` } as React.CSSProperties },
          h(Card, { face: resultFace(card), family: 'result', label: `结果卡「${card.title_zh}」`, flipped: o.flipped[i] }, ...resultCardFace(card)),
          h('div', { className: 'lp-codex-slot-text' },
            h('b', null, card.title_zh),
            card.value_zh ? h('p', { className: 'lp-codex-big' }, card.value_zh) : null,
            h('p', null, card.compare_zh),
            card.note_zh && card.note_zh !== card.compare_zh ? h('p', { className: 'lp-codex-cap' }, card.note_zh) : null)))),
        h('div', { className: 'lp-codex-ov-actions' }, h(Btn, { tone: 'green', onClick: closeOverlay }, '收好')))
    }
    const chosen = o.options.find((row) => row.id === o.chosen) ?? null
    const pick = (id: string) => setOv({ ...o, chosen: o.chosen === id ? null : id })
    if (chosen) {
      // The chosen card with its questions; the other two step back, on their way to 待选.
      const rest = o.options.filter((row) => row.id !== chosen.id)
      return h(React.Fragment, null,
        h('p', { className: 'lp-codex-ov-line lp-codex-big' }, '选这张？'),
        h('div', { className: 'lp-codex-ov-row' },
          h('div', { key: chosen.id, className: 'lp-codex-slot lp-codex-picked' },
            h(ExpCard, { info: optionInfo(chosen), live: true, onOpen: () => pick(chosen.id) })),
          h('div', { className: 'lp-codex-ov-side' }, h(ChoosePanel, { key: chosen.id, option: chosen, busy, onStart: (answers, randomized) => { void beginRun(chosen, o.pack.id, answers, randomized) }, onBack: () => pick(chosen.id) }))),
        h('div', { className: 'lp-codex-ov-row lp-codex-ov-rest' },
          ...rest.map((option) => h('div', { key: option.id, className: cx('lp-codex-slot', 'lp-codex-slot-sm', o.leaving ? 'lp-codex-gone' : 'lp-codex-out') },
            h(ExpCard, { info: optionInfo(option), size: 's3', live: true, onOpen: () => pick(option.id) }))),
          h('p', { className: 'lp-codex-cap lp-codex-rest-note' }, '另外两个会放进「待选」，下次可以直接开始。')))
    }
    return h(React.Fragment, null,
      h('p', { className: 'lp-codex-ov-line lp-codex-big' }, '三选一'),
      h('p', { className: 'lp-codex-ov-line' }, '三个小实验，都是按你的数据和方案挑的。点一张看详情；都不想做也可以，包会留着。'),
      h('div', { className: 'lp-codex-ov-row' }, ...o.options.map((option, i) => h('div', {
        key: option.id, 'data-slot': i, className: cx('lp-codex-slot', !o.dealt && 'lp-codex-deal'), style: { '--d': `${i * 0.12}s` } as React.CSSProperties,
      },
      h(ExpCard, { info: optionInfo(option), live: true, flipped: o.flipped[i], tilt: anim, onOpen: () => pick(option.id) }),
      h(OptionText, { option })))),
      h('div', { className: 'lp-codex-ov-actions' }, h(Btn, { tone: 'grey', onClick: closeOverlay }, '先不选，包留着')))
  }

  function revealStage(o: Extract<Overlay, { kind: 'reveal' }>): React.ReactNode {
    const result = o.run.result
    const done = o.phase === 'done' && result
    return h('div', { className: 'lp-codex-ov-row' },
      h('div', { className: 'lp-codex-stack' },
        h(ExpCard, { info: runInfo({ ...o.run, status: result ? 'revealed' : o.run.status }), size: 's6', flipped: o.phase === 'back', foil: Boolean(done) && !simple })),
      h('div', { className: 'lp-codex-ov-side' },
        done
          ? h('div', { className: 'lp-codex-stack lp-codex-pop' },
            h(ResultInfo, { run: o.run, result }),
            h('div', { className: 'lp-codex-row' }, h(Btn, { tone: 'green', onClick: () => { closeOverlay(); setTab('deck') } }, '收进牌组')))
          : h('div', { className: 'lp-codex-box lp-codex-stack' },
            h('p', { className: 'lp-codex-big' }, `「${o.run.title_zh}」做完了`),
            h('p', null, '翻开看看：主要结果有没有超出你的平时波动。'),
            h('div', null, h(Btn, { tone: 'gold', disabled: busy || o.phase !== 'back', onClick: () => { void turn() } }, '翻开')))))
  }

  function resultStage(run: RunView): React.ReactNode {
    return h('div', { className: 'lp-codex-ov-row' },
      h(ExpCard, { info: runInfo(run), size: 's6', foil: !simple }),
      h('div', { className: 'lp-codex-ov-side' }, run.result ? h(ResultInfo, { run, result: run.result }) : h('p', { className: 'lp-codex-box' }, '这张卡还没有结果。')))
  }

  function studyStage(o: Extract<Overlay, { kind: 'study' }>): React.ReactNode {
    const card = lib?.studies.find((row) => row.id === o.id)
    if (!card) return h('p', { className: 'lp-codex-box' }, '这张卡不在图书馆里了。')
    const chapter = lib?.chapters.find((row) => row.id === card.chapter)
    return h('div', { className: 'lp-codex-ov-row' },
      simple ? null : h(Card, { face: studyFace(card), size: 's6', family: 'study', label: studyLabel(card) }, h(StudyText, { card, size: 's6', speciesName })),
      h('div', { className: 'lp-codex-ov-side' }, h(StudyInfo, { card, chapter, full: true, met: o.met, speciesName, metFace: speciesRaster })))
  }
}
