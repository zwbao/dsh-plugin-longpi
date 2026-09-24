import React from 'react'
import { AdherenceStrip, fmt, fmtAuto, LeverBars, LineChart, Ring, TableTwin, Timeline } from './charts.ts'
import { SUGGESTED, VIEW_ID } from './constants.ts'

const h = React.createElement

// --- data shapes (the server's JSON; every field optional on purpose) ------------------

interface IndicatorRow { name?: string; value?: string; unit?: string; label?: string; date?: string }
interface MedicationRow { name?: string; status?: string }
interface MatchHit { name: string; blurb?: string; why?: string[]; has_script?: boolean; runnable?: { status?: string; missing?: string[] } }
interface Readout { key: string; label_zh?: string; value?: number | string | null; unit?: string; at?: string; measured_at?: string; skill?: string }
interface Readiness {
  ready?: Array<{ name: string; blurb?: string; domain?: string }>
  near?: Array<{ name: string; blurb?: string; missing?: string[] }>
  unlock?: Array<{ item: string; skills: string[] }>
  declared?: number
}
interface Board {
  version?: string
  today?: string
  profile?: { displayName?: string; birthYear?: number | null; age?: number | null; sex?: string }
  estimated_age?: number | null
  skills?: { count?: number; personal?: number; version?: string; revision?: string; error?: string; domains?: Array<{ domain: string; count: number }> }
  mirobody?: { mounted?: boolean; error?: string; engine?: { ok?: boolean; version?: string; error?: string }; mcp?: { configured?: boolean; host?: string } }
  records?: { status?: string; error?: string; indicator_count?: number; indicators?: IndicatorRow[]; medications?: MedicationRow[] }
  dispatch?: { matches?: MatchHit[]; note?: string }
  near?: MatchHit[]
  readouts?: Readout[]
  receipts?: Array<{ at?: string; skill?: string; ok?: boolean; error_kind?: string }>
  readiness?: Readiness
  boundary?: string
}
interface Adherence {
  source?: string; rate?: number | null; coverage?: number; level?: string; streak?: number; note_zh?: string
  calendar?: Array<{ date: string; status: string }>
}
interface Verdict {
  item?: string; marker: string; indicator?: string | null; unit?: string; verdict: string; reason_zh?: string
  baseline?: { date: string; value: number } | null; followup?: { date: string; value: number } | null
  change?: { abs: number; pct: number } | null; band?: { up_pct: number; down_pct: number; verified?: boolean } | null
  combined_with?: string[]; confounders?: string[]; next_retest?: string | null
  expected?: Array<{ id: string; text_zh: string; doi: string; verified?: boolean; comparison?: string }>
}
interface Item {
  id: string; title: string; category?: string; category_zh?: string; start: string; end?: string | null; days?: number
  adherence?: Adherence; verdicts?: Verdict[]; headline?: string
}
interface PlanItemRaw { id: string; mirobody?: { medication: string } | null; target?: { metric: string } | null }
interface Chart {
  key: string; label: string; indicator: string; unit: string; better?: string; points: Array<{ date: string; value: number }>
  band?: { base: number; base_date: string; low: number; high: number; verified?: boolean } | null; goal?: number | null; items?: string[]
}
interface ModelCard {
  model: string; title_zh?: string; status?: string; note_zh?: string; measured_on?: string | null
  now?: Record<string, number | null>; goal?: Record<string, number | null> | null
  levers?: Array<{ label: string; from: string; to: string; years: number }>
  sensitivity?: Array<{ label: string; unit: string; years_per_step: number; step: string }>
  boundary_zh?: string
}
interface Tracking {
  status?: string; today?: string
  plan?: { version: number; saved_at: string; title: string; items: PlanItemRaw[]; goals?: Array<{ marker: string; value: number; unit: string }> } | null
  items?: Item[]; suggestions?: Array<{ kind: string; text_zh: string; date?: string; marker?: string }>
  charts?: Chart[]
  bioage?: { status?: string; note_zh?: string; points?: Array<{ date: string; phenoage: number; advance: number | null; mortality_10y_pct: number | null }>; band_years?: number | null; band_missing?: string[] }
  models?: ModelCard[]
  reference?: { biovar_markers?: number; effects?: number }
  errors?: string[]
}

function api(path: string): string {
  const token = new URLSearchParams(window.location.search).get('token')
  if (!token) return path
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(api(path), { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(api(path), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json() as T & { error?: string; problems?: string[] }
  if (!res.ok) throw new Error(json.error || (json.problems ?? []).join(' ') || `HTTP ${res.status}`)
  return json
}

// --- icons (16px strokes; color from currentColor) ---------------------------------------

const ICONS: Record<string, string> = {
  check: 'M4 8.5l2.5 2.5L12 5.5',
  within: 'M3.5 6.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0M3.5 9.8c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0',
  worse: 'M5 11L11 5M6 5h5v5',
  unknown: 'M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6M8 11.6v.1',
  flame: 'M8 2.5c.4 2-1.9 2.9-1.9 5.3a1.9 1.9 0 0 0 3.8.1c0-.7-.3-1.2-.3-1.2s1.9.8 1.9 3A3.5 3.5 0 0 1 4.5 9.8C4.5 6.3 8 5.4 8 2.5z',
  calendar: 'M3 5.5h10M5 2.8v2M11 2.8v2M3.5 4h9a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5z',
  download: 'M8 2.8v7M5 7l3 3 3-3M3.5 12.5h9',
  refresh: 'M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.4h-2.4',
  spark: 'M8 2.5l1.3 3.6 3.7 1.4-3.7 1.4L8 12.5l-1.3-3.6L3 7.5l3.7-1.4z',
  flask: 'M6.5 2.5h3M7 2.5v3.8L3.8 11.8a.9.9 0 0 0 .8 1.2h6.8a.9.9 0 0 0 .8-1.2L9 6.3V2.5',
  arrow: 'M3.5 8h9M9 4.5L12.5 8 9 11.5',
  play: 'M5.5 4v8l6-4z',
  info: 'M8 7.3v4M8 5v.1M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z',
}

function Icon(props: { name: string; size?: number; className?: string }): React.ReactElement {
  const size = props.size ?? 16
  return h('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, className: `lp-icon ${props.className ?? ''}`.trim() },
    h('path', { d: ICONS[props.name] ?? ICONS.info, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }))
}

const VERDICT_STYLE: Record<string, { icon: string; className: string; label: string }> = {
  有效: { icon: 'check', className: 'lp-v-good', label: '有效' },
  波动内: { icon: 'within', className: 'lp-v-within', label: '波动内' },
  反向: { icon: 'worse', className: 'lp-v-worse', label: '反向' },
  无法判断: { icon: 'unknown', className: 'lp-v-unknown', label: '无法判断' },
}

function VerdictChip(props: { verdict: string }): React.ReactElement {
  const style = VERDICT_STYLE[props.verdict] ?? VERDICT_STYLE['无法判断'] as { icon: string; className: string; label: string }
  return h('span', { className: `lp-chip-v ${style.className}` }, h(Icon, { name: style.icon, size: 14 }), style.label)
}

// --- helpers -----------------------------------------------------------------------------

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function chineseDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${Number(month)} 月 ${Number(day)} 日`
}

function pct(value: number): string {
  return `${value > 0 ? '+' : ''}${fmt(value * 100, 0)}%`
}

function Section(props: { title: string; kicker?: string; aside?: React.ReactNode; children?: React.ReactNode; id?: string }): React.ReactElement {
  return h('section', { className: 'lp-section', id: props.id },
    h('div', { className: 'lp-section-head' },
      h('div', null,
        props.kicker ? h('div', { className: 'lp-kicker' }, props.kicker) : null,
        h('h2', { className: 'lp-h2' }, props.title)),
      props.aside ?? null),
    props.children)
}

function Skeleton(props: { height: number }): React.ReactElement {
  return h('div', { className: 'lp-skeleton', style: { height: props.height } })
}

// --- hero: body age -------------------------------------------------------------------

function Hero(props: { tracking: Tracking | null; loading: boolean }): React.ReactElement {
  const bio = props.tracking?.bioage
  const points = bio?.points ?? []
  if (props.loading && !props.tracking) return h('div', { className: 'lp-card lp-hero' }, h(Skeleton, { height: 180 }))
  if (points.length === 0) {
    return h('div', { className: 'lp-card lp-hero lp-hero-empty' },
      h('div', { className: 'lp-label' }, '身体年龄'),
      h('div', { className: 'lp-hero-wait' }, '等一份完整的血检'),
      h('p', { className: 'lp-muted' }, bio?.note_zh || '接上 Mirobody、在档案里写下实足年龄后，这里会按每次体检算出表型年龄。'))
  }
  const latest = points.at(-1) as NonNullable<typeof points[number]>
  const first = points[0] as NonNullable<typeof points[number]>
  const advance = latest.advance
  const band = bio?.band_years ?? null
  const partial = (bio?.band_missing ?? []).length > 0
  const delta = latest.advance != null && first.advance != null && points.length > 1 ? latest.advance - first.advance : null
  let versus = ''
  if (advance != null) {
    versus = Math.abs(advance) < 0.5 ? '和实足年龄相当' : advance < 0 ? `比实足年龄年轻 ${fmt(-advance)} 岁` : `比实足年龄大 ${fmt(advance)} 岁`
  }
  let story = ''
  let real = false
  if (delta != null) {
    const moved = delta < 0 ? `年轻了 ${fmt(-delta)} 岁` : delta > 0 ? `多了 ${fmt(delta)} 岁` : '没有变化'
    story = `从 ${first.date.slice(0, 7).replace('-', ' 年 ')} 月到现在，表型年龄相对实足年龄${moved}`
    if (band != null) {
      if (Math.abs(delta) > band) {
        real = delta < 0
        story += partial ? `，超过了已知的个体波动（±${fmt(band)} 岁，未含${bio?.band_missing?.join('、')}）。` : `，超出个体正常波动（±${fmt(band)} 岁），是真实的变化。`
      } else {
        story += `，还在个体正常波动（±${fmt(band)} 岁）以内。`
      }
    } else {
      story += '。'
    }
  }
  return h('div', { className: `lp-card lp-hero ${real ? 'lp-hero-win' : ''}` },
    h('div', { className: 'lp-hero-top' },
      h('div', null,
        h('div', { className: 'lp-label' }, '身体年龄 · 表型年龄'),
        h('div', { className: 'lp-hero-figure' }, fmt(latest.phenoage), h('span', { className: 'lp-hero-unit' }, '岁')),
        versus ? h('div', { className: `lp-pill ${advance != null && advance < 0 ? 'lp-pill-good' : ''}` }, versus) : null),
      h('div', { className: 'lp-hero-meta' },
        h('div', null, `${chineseDate(latest.date)}体检`),
        h('div', { className: 'lp-muted' }, `共 ${points.length} 次`))),
    points.length > 1 ? h(LineChart, {
      points: points.filter((row) => row.advance != null).map((row) => ({ date: row.date, value: row.advance as number })),
      unit: '岁', label: '表型年龄减实足年龄', height: 120,
      band: band != null && first.advance != null ? { low: first.advance - band, high: first.advance + band, from: first.date } : null,
      reference: { value: 0, label: '持平' },
    }) : null,
    story ? h('p', { className: 'lp-hero-story' }, real ? h(Icon, { name: 'spark', className: 'lp-good-ink' }) : null, story) : null,
    h('div', { className: 'lp-fine' }, '模型估计：Levine 2018 表型年龄，九项常规血检加实足年龄。灰色带是第一次检查的个体正常波动范围。'),
    points.length > 1 ? h(TableTwin, {
      caption: '每次体检的表型年龄',
      head: ['日期', '表型年龄', '减实足年龄', '模型 10 年死亡风险'],
      rows: points.map((row) => [row.date, `${fmt(row.phenoage)} 岁`, `${fmt(row.advance)} 岁`, `${fmt(row.mortality_10y_pct)}%`]),
    }) : null)
}

function Adherence(props: { tracking: Tracking | null }): React.ReactElement {
  const items = props.tracking?.items ?? []
  const known = items.filter((item) => item.adherence && item.adherence.level !== 'unknown' && item.adherence.rate != null)
  const rate = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null
  const streak = Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0))
  const since = items.map((item) => item.start).sort()[0]
  const today = props.tracking?.today
  return h('div', { className: 'lp-card lp-tile' },
    h('div', { className: 'lp-label' }, '方案执行'),
    h('div', { className: 'lp-tile-row' },
      h(Ring, { value: rate, label: '方案平均执行率' }),
      h('div', null,
        h('div', { className: 'lp-tile-figure' }, rate == null ? '—' : `${Math.round(rate * 100)}%`),
        h('div', { className: 'lp-muted' }, rate == null ? '还没有执行记录' : `${known.length} 项有记录`))),
    streak > 1 ? h('div', { className: 'lp-streak' }, h(Icon, { name: 'flame' }), `连续 ${streak} 天`) : null,
    since && today ? h('div', { className: 'lp-fine' }, `方案已进行 ${daysBetween(since, today)} 天`) : null)
}

function NextRetest(props: { tracking: Tracking | null }): React.ReactElement {
  const today = props.tracking?.today ?? ''
  const retests = (props.tracking?.suggestions ?? []).filter((row) => row.kind === 'retest' && row.date)
  const upcoming = retests.filter((row) => (row.date as string) > today).sort((a, b) => (a.date as string).localeCompare(b.date as string))
  const now = retests.filter((row) => (row.date as string) <= today)
  const first = upcoming[0]
  return h('div', { className: 'lp-card lp-tile' },
    h('div', { className: 'lp-label' }, '下次复测'),
    now.length > 0
      ? h('div', null, h('div', { className: 'lp-tile-figure' }, '现在'), h('div', { className: 'lp-muted' }, `可以复测${now.map((row) => row.marker).filter(Boolean).slice(0, 2).join('、')}`))
      : first
        ? h('div', null, h('div', { className: 'lp-tile-figure' }, `${daysBetween(today, first.date as string)} 天后`), h('div', { className: 'lp-muted' }, `${chineseDate(first.date as string)}之后 · ${first.marker ?? ''}`))
        : h('div', null, h('div', { className: 'lp-tile-figure' }, '—'), h('div', { className: 'lp-muted' }, '保存方案后按指标排复测日')),
    h('div', { className: 'lp-fine' }, h(Icon, { name: 'calendar', size: 13 }), ' 复测太早，变化多半只是波动'))
}

// --- wins ----------------------------------------------------------------------------------

function Wins(props: { tracking: Tracking | null }): React.ReactElement | null {
  const items = props.tracking?.items ?? []
  if (!props.tracking?.plan) return null
  const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === '有效').map((row) => ({ item, row })))
  if (wins.length === 0) {
    return h('div', { className: 'lp-card lp-wins lp-wins-empty' },
      h(Icon, { name: 'spark', className: 'lp-accent-ink' }),
      h('div', null,
        h('div', { className: 'lp-strong' }, '还没有超出波动的改善'),
        h('div', { className: 'lp-muted' }, '血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。')))
  }
  return h('div', { className: 'lp-card lp-wins' },
    h('div', { className: 'lp-label' }, '值得庆祝'),
    ...wins.map(({ item, row }, index) => h('div', { className: 'lp-win', key: index, style: { animationDelay: `${index * 80}ms` } },
      h('span', { className: 'lp-win-icon' }, h(Icon, { name: 'check', size: 18 })),
      h('div', null,
        h('div', { className: 'lp-strong' }, `${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ''}`),
        h('div', { className: 'lp-muted' },
          `${item.title} · ${row.change ? pct(row.change.pct) : ''} · 超出个体正常波动`,
          (row.combined_with ?? []).length > 0 ? `（与${(row.combined_with ?? []).join('、')}共同作用）` : '')))))
}

// --- the plan ------------------------------------------------------------------------------

function ItemCard(props: { item: Item; raw?: PlanItemRaw; onCheckIn: (item: Item) => void; busy: boolean; justDone: boolean }): React.ReactElement {
  const item = props.item
  const adherence = item.adherence ?? {}
  const source = props.raw?.mirobody ? 'mirobody' : props.raw?.target ? 'wearable' : 'checkin'
  const rate = adherence.rate
  return h('article', { className: 'lp-card lp-item' },
    h('div', { className: 'lp-item-head' },
      h('div', null,
        h('span', { className: 'lp-cat' }, item.category_zh ?? ''),
        h('h3', { className: 'lp-h3' }, item.title),
        h('div', { className: 'lp-muted' }, `${item.start} 起 · 第 ${item.days ?? 0} 天`)),
      item.headline ? h(VerdictChip, { verdict: item.headline }) : null),
    h('div', { className: 'lp-item-adherence' },
      h('div', null,
        h('div', { className: 'lp-label lp-label-tight' }, '近 12 周执行'),
        h('div', { className: 'lp-tile-figure lp-small-figure' }, rate == null || adherence.level === 'unknown' ? '记录不足' : `${Math.round(rate * 100)}%`),
        h('div', { className: 'lp-fine' }, adherence.note_zh ?? '')),
      (adherence.calendar ?? []).length > 0 ? h(AdherenceStrip, { calendar: adherence.calendar ?? [], label: item.title }) : null),
    ...(item.verdicts ?? []).map((row, index) => h('div', { className: 'lp-verdict', key: index },
      h('div', { className: 'lp-verdict-head' },
        h(VerdictChip, { verdict: row.verdict }),
        h('span', { className: 'lp-strong' }, row.marker),
        row.baseline && row.followup ? h('span', { className: 'lp-num' }, `${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ''}${row.change ? `（${pct(row.change.pct)}）` : ''}`) : null),
      h('p', { className: 'lp-reason' }, row.reason_zh ?? ''),
      (row.expected ?? []).length > 0 ? h('details', { className: 'lp-expected' },
        h('summary', null, '试验里平均能改变多少'),
        ...(row.expected ?? []).map((line) => h('p', { key: line.id, className: 'lp-fine' },
          line.text_zh,
          line.comparison && line.comparison !== 'not_comparable' ? `你的变化${({ consistent: '与试验平均一致', smaller: '小于试验平均', larger: '大于试验平均', opposite: '方向与试验相反' } as Record<string, string>)[line.comparison] ?? ''}。` : '',
          ` doi:${line.doi}`))) : null)),
    h('div', { className: 'lp-item-foot' },
      source === 'checkin'
        ? h('button', { type: 'button', className: `lp-btn lp-btn-soft ${props.justDone ? 'lp-btn-done' : ''}`, disabled: props.busy || props.justDone, onClick: () => props.onCheckIn(item) },
          h(Icon, { name: 'check', size: 15 }), props.justDone ? '已记下，今天完成' : '今天完成了')
        : h('span', { className: 'lp-fine' }, source === 'wearable' ? '手环自动记录，不用打卡' : '服用情况在 Mirobody 里打卡')))
}

function Plan(props: { tracking: Tracking | null; loading: boolean; onCheckIn: (item: Item) => void; busy: boolean; done: Set<string> }): React.ReactElement {
  const tracking = props.tracking
  if (props.loading && !tracking) return h(Section, { title: '我的方案', kicker: '干预' }, h(Skeleton, { height: 220 }))
  if (!tracking?.plan) {
    return h(Section, { title: '我的方案', kicker: '干预' },
      h('div', { className: 'lp-card lp-empty' },
        h('div', { className: 'lp-strong' }, '把你的干预方案交给我'),
        h('p', { className: 'lp-muted' }, '在对话里说出你的方案，或者分享医生、长寿师给你的方案文件。我会整理成条目读给你确认，然后对照每次检查判断哪些有效。'),
        h('div', { className: 'lp-chips' },
          ...['帮我保存干预方案：地中海饮食、每天快走 8000 步，10 月 20 日开始', '我的方案有没有效果？'].map((text) => h('button', {
            key: text, type: 'button', className: 'lp-chip',
            onClick: () => { void navigator.clipboard?.writeText(text) },
          }, text)))))
  }
  const plan = tracking.plan
  const items = tracking.items ?? []
  const checkups = [...new Set((tracking.bioage?.points ?? []).map((row) => row.date))]
  return h(Section, {
    title: plan.title, kicker: `我的方案 · 第 ${plan.version} 版`,
    aside: h('span', { className: 'lp-muted' }, `${items.length} 项 · ${plan.saved_at.slice(0, 10)} 保存`),
  },
  h('div', { className: 'lp-card' },
    h(Timeline, {
      items: items.map((item) => ({ id: item.id, title: item.title, start: item.start, end: item.end ?? null, subtitle: `${item.start} 起，第 ${item.days ?? 0} 天`, headline: item.headline ?? '' })),
      checkups, today: tracking.today ?? '',
    })),
  h('div', { className: 'lp-grid-items' },
    ...items.map((item) => h(ItemCard, {
      key: item.id, item, raw: plan.items.find((raw) => raw.id === item.id), onCheckIn: props.onCheckIn, busy: props.busy, justDone: props.done.has(item.id),
    }))))
}

// --- markers --------------------------------------------------------------------------------

function Markers(props: { tracking: Tracking | null }): React.ReactElement | null {
  const charts = props.tracking?.charts ?? []
  if (charts.length === 0) return null
  const verdictOf = (indicator: string): Verdict | undefined => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? [])
    .find((row) => row.indicator === indicator && row.verdict !== '无法判断')
  return h(Section, { title: '指标变化', kicker: '对照正常波动' },
    h('div', { className: 'lp-grid-charts' },
      ...charts.map((chart) => {
        const verdict = verdictOf(chart.indicator)
        const digits = Math.max(...chart.points.map((point) => (String(point.value).split('.')[1] ?? '').length), 0) > 1 ? 2 : 1
        return h('figure', { className: 'lp-card lp-figure', key: chart.indicator },
          h('div', { className: 'lp-figure-head' },
            h('figcaption', null, h('span', { className: 'lp-strong' }, chart.label), h('span', { className: 'lp-muted' }, ` ${chart.unit}`)),
            verdict ? h(VerdictChip, { verdict: verdict.verdict }) : null),
          h(LineChart, {
            points: chart.points, unit: chart.unit, label: chart.label, height: 150, digits,
            band: chart.band ? { low: chart.band.low, high: chart.band.high, from: chart.band.base_date } : null,
            goal: chart.goal ?? null,
          }),
          h('div', { className: 'lp-fine' }, chart.band
            ? `灰色带：以 ${chart.band.base_date} 的 ${fmt(chart.band.base, 2)} 为基线的正常波动范围${chart.band.verified === false ? '（变异数据待核对）' : ''}。落在带外才算真实变化。`
            : '缺少这项的个体变异数据，分不清真实变化和波动。'),
          h(TableTwin, { caption: `${chart.label}（${chart.unit}）`, head: ['日期', '数值'], rows: chart.points.map((point) => [point.date, fmt(point.value, digits)]) }))
      })))
}

// --- goals: model estimates ------------------------------------------------------------------

function Goals(props: { tracking: Tracking | null }): React.ReactElement | null {
  const models = props.tracking?.models ?? []
  if (!props.tracking || models.length === 0) return null
  const pheno = models.find((card) => card.model === 'phenoage')
  const risk = models.find((card) => card.model === 'china-par')
  const leverRows = (pheno?.levers ?? []).map((row) => ({ label: row.label, detail: `${row.from} → ${row.to}`, value: row.years, unit: '岁' }))
  const sensitivityRows = (pheno?.sensitivity ?? []).map((row) => ({ label: row.label, detail: `一次真实变化约 ${row.step}`, value: -Math.abs(row.years_per_step), unit: '岁' }))
  return h(Section, { title: '如果达到目标', kicker: '模型估计' },
    h('div', { className: 'lp-grid-goals' },
      pheno ? h('div', { className: 'lp-card lp-model' },
        h('div', { className: 'lp-label' }, '表型年龄'),
        pheno.goal
          ? h('div', { className: 'lp-model-figures' },
            h('div', null, h('div', { className: 'lp-muted' }, '现在'), h('div', { className: 'lp-tile-figure' }, `${fmt(pheno.now?.phenoage)} 岁`)),
            h(Icon, { name: 'arrow', size: 20, className: 'lp-muted-ink' }),
            h('div', null, h('div', { className: 'lp-muted' }, '达到方案目标'), h('div', { className: 'lp-tile-figure lp-good-ink-strong' }, `${fmt(pheno.goal.phenoage)} 岁`)),
            h('div', { className: 'lp-pill lp-pill-good' }, `${fmt(pheno.goal.phenoage_delta)} 岁`))
          : h('p', { className: 'lp-muted' }, pheno.note_zh ?? ''),
        leverRows.length > 0
          ? h('div', null, h('div', { className: 'lp-subhead' }, '每个目标单独的贡献'), h(LeverBars, { rows: leverRows }))
          : sensitivityRows.length > 0
            ? h('div', null, h('div', { className: 'lp-subhead' }, '对你的表型年龄影响最大的指标'), h(LeverBars, { rows: sensitivityRows }))
            : null,
        pheno.goal && pheno.now?.mortality_10y_pct != null && pheno.goal.mortality_10y_pct != null
          ? h('div', { className: 'lp-fine' }, `同一模型的 10 年死亡风险：${(pheno.now.mortality_10y_pct as number).toFixed(1)}% → ${(pheno.goal.mortality_10y_pct as number).toFixed(1)}%。`)
          : null,
        h('div', { className: 'lp-fine' }, `${pheno.measured_on ? `按 ${pheno.measured_on} 的血检计算。` : ''}${pheno.boundary_zh ?? ''}`)) : null,
      risk ? h('div', { className: 'lp-card lp-model' },
        h('div', { className: 'lp-label' }, '10 年心血管病风险 · China-PAR'),
        risk.status === 'unavailable'
          ? h('div', null, h('div', { className: 'lp-tile-figure lp-muted-ink' }, '待系数校验'), h('p', { className: 'lp-muted' }, risk.note_zh ?? ''))
          : h('div', { className: 'lp-model-figures' },
            h('div', null, h('div', { className: 'lp-muted' }, '现在'), h('div', { className: 'lp-tile-figure' }, `${fmt(risk.now?.risk_pct)}%`)),
            risk.goal ? h(Icon, { name: 'arrow', size: 20, className: 'lp-muted-ink' }) : null,
            risk.goal ? h('div', null, h('div', { className: 'lp-muted' }, '达到目标'), h('div', { className: 'lp-tile-figure' }, `${fmt(risk.goal.risk_pct)}%`)) : null),
        h('div', { className: 'lp-fine' }, risk.boundary_zh ?? '')) : null,
      h('div', { className: 'lp-card lp-model lp-model-note' },
        h('div', { className: 'lp-label' }, '关于“能多活几年”'),
        h('p', { className: 'lp-muted' }, '没有经过验证的模型能对个人给出“多活几年”。这里只给有依据的模型估计：表型年龄、同一模型的 10 年死亡风险，以及（校验通过后）中国人群的 10 年心血管病风险。'),
        h('p', { className: 'lp-fine' }, '试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月。能坚持的小改变，比追逐一个数字更重要。'))))
}

// --- next steps -------------------------------------------------------------------------------

function NextSteps(props: { tracking: Tracking | null }): React.ReactElement | null {
  const rows = props.tracking?.suggestions ?? []
  if (rows.length === 0) return null
  const icon: Record<string, string> = { retest: 'calendar', missing_marker: 'flask', adherence: 'flame', record: 'check', one_change: 'info', review: 'info', worse: 'worse', acute: 'info', lever: 'spark' }
  return h(Section, { title: '下一步', kicker: '按优先级' },
    h('ol', { className: 'lp-card lp-steps' },
      ...rows.map((row, index) => h('li', { key: index, className: `lp-step lp-step-${row.kind}` },
        h('span', { className: 'lp-step-icon' }, h(Icon, { name: icon[row.kind] ?? 'info', size: 15 })),
        h('span', null, row.text_zh)))),
    h('p', { className: 'lp-fine' }, '这里不会建议开始、停止或调整任何药物和补剂，也不给剂量。'))
}

// --- record and methods ---------------------------------------------------------------------

function RecordSection(props: {
  board: Board | null
  busy: boolean
  running: boolean
  runResults: Array<{ skill: string; ok: boolean; excerpt: string }> | null
  onRunReady: () => void
  profileForm: React.ReactNode
  searchForm: React.ReactNode
}): React.ReactElement {
  const board = props.board
  const ready = board?.readiness?.ready ?? []
  const unlock = board?.readiness?.unlock ?? []
  const meds = board?.records?.medications ?? []
  const readouts = board?.readouts ?? []
  return h(Section, { title: '记录与方法', kicker: '数据' },
    h('div', { className: 'lp-grid-2' },
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '你的记录现在就能算'),
        ready.length === 0
          ? h('p', { className: 'lp-muted' }, '还没有能直接计算的方法。')
          : h('ul', { className: 'lp-list' }, ...ready.map((row) => h('li', { key: row.name }, h('span', { className: 'lp-strong' }, row.domain || row.name), h('span', { className: 'lp-muted' }, ` ${row.blurb ?? ''}`)))),
        ready.length > 0 ? h('button', { type: 'button', className: 'lp-btn', disabled: props.running, onClick: props.onRunReady },
          h(Icon, { name: 'play', size: 14 }), props.running ? '正在计算…' : `一键计算 ${ready.length} 项`) : null,
        props.runResults ? h('ul', { className: 'lp-list lp-run' }, ...props.runResults.map((row) => h('li', { key: row.skill },
          h('span', { className: row.ok ? 'lp-good-ink' : 'lp-muted-ink' }, row.ok ? '✓ ' : '· '), row.skill, h('div', { className: 'lp-fine' }, row.excerpt.split('\n')[0] ?? '')))) : null),
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '再测一项就能解锁'),
        unlock.length === 0
          ? h('p', { className: 'lp-muted' }, '没有只差一项的方法。')
          : h('ul', { className: 'lp-list' }, ...unlock.map((row) => h('li', { key: row.item },
            h('span', { className: 'lp-strong' }, row.item), h('span', { className: 'lp-muted' }, ` → ${row.skills.length} 个方法`)))),
        h('div', { className: 'lp-fine' }, `技能库 ${board?.skills?.version ?? ''} · ${board?.readiness?.declared ?? 0} 个个人方法声明了输入`))),
    h('div', { className: 'lp-grid-2' },
      h('div', { className: 'lp-card' }, h('div', { className: 'lp-label' }, '档案'), props.profileForm),
      h('div', { className: 'lp-card' }, h('div', { className: 'lp-label' }, '找方法'), props.searchForm)),
    h('div', { className: 'lp-grid-2' },
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '用药计划（只读，来自 Mirobody）'),
        meds.length === 0 ? h('p', { className: 'lp-muted' }, '没有读到用药计划。') : h('ul', { className: 'lp-list' }, ...meds.map((row) => h('li', { key: row.name }, row.name, h('span', { className: 'lp-muted' }, ` ${row.status ?? ''}`))))),
      h('div', { className: 'lp-card' },
        h('div', { className: 'lp-label' }, '最近读出'),
        readouts.length === 0 ? h('p', { className: 'lp-muted' }, '还没有算过。') : h('ul', { className: 'lp-list' }, ...readouts.slice(0, 8).map((row) => h('li', { key: row.key },
          row.label_zh || row.key, h('span', { className: 'lp-num' }, ` ${typeof row.value === 'number' ? fmt(row.value, 2) : row.value ?? ''} ${row.unit && row.unit !== '1' ? (row.unit === 'a' ? '岁' : row.unit) : ''}`),
          h('span', { className: 'lp-fine' }, ` · ${(row.measured_at || row.at || '').slice(0, 10)}`)))))))
}

// --- the board ----------------------------------------------------------------------------------

export function registerPanel(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    { name: 'conversation.view', id: VIEW_ID, order: 18, label: () => '健康看板' },
    PanelView,
  ))
}

export function PanelView(): React.ReactElement {
  const [board, setBoard] = React.useState<Board | null>(null)
  const [tracking, setTracking] = React.useState<Tracking | null>(null)
  const [trackingLoading, setTrackingLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const [runResults, setRunResults] = React.useState<Array<{ skill: string; ok: boolean; excerpt: string }> | null>(null)
  const [done, setDone] = React.useState<Set<string>>(new Set())
  const [displayName, setDisplayName] = React.useState('')
  const [birthYear, setBirthYear] = React.useState('')
  const [age, setAge] = React.useState('')
  const [sex, setSex] = React.useState('unknown')
  const [question, setQuestion] = React.useState('')
  const [matches, setMatches] = React.useState<MatchHit[] | null>(null)
  const [note, setNote] = React.useState('')

  const loadTracking = React.useCallback(() => {
    setTrackingLoading(true)
    getJson<Tracking>('/api/longpi/tracking')
      .then((json) => setTracking(json))
      .catch((err: unknown) => setNotice(err instanceof Error ? `方案数据没有读到（${err.message}）` : '方案数据没有读到'))
      .finally(() => setTrackingLoading(false))
  }, [])

  const load = React.useCallback((refresh = false) => {
    getJson<Board>(`/api/longpi/board${refresh ? '?refresh=1' : ''}`)
      .then((json) => {
        setBoard(json)
        setError(null)
        setDisplayName(json.profile?.displayName ?? '')
        setBirthYear(json.profile?.birthYear ? String(json.profile.birthYear) : '')
        setAge(json.profile?.age == null ? '' : String(json.profile.age))
        setSex(json.profile?.sex || 'unknown')
        setMatches(json.dispatch?.matches ?? [])
        setNote(json.dispatch?.note ?? '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '看板没有打开'))
    loadTracking()
  }, [loadTracking])

  React.useEffect(() => { load() }, [load])

  async function checkIn(item: Item): Promise<void> {
    setBusy(true)
    try {
      await postJson('/api/longpi/checkin', { item: item.id, done: true })
      setDone((current) => new Set(current).add(item.id))
      setNotice(`已记下：${item.title}，今天完成。`)
      loadTracking()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '没有记下')
    } finally {
      setBusy(false)
    }
  }

  async function runReady(): Promise<void> {
    setRunning(true)
    try {
      const json = await postJson<{ results: Array<{ skill: string; ok: boolean; excerpt: string }> }>('/api/longpi/run-ready', {})
      setRunResults(json.results)
      load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '没有算完')
    } finally {
      setRunning(false)
    }
  }

  async function saveProfile(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    try {
      await postJson('/api/longpi/profile', { displayName, birthYear: birthYear.trim() ? Number(birthYear) : null, age: age.trim() ? Number(age) : null, sex })
      setNotice('档案已保存。')
      load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '档案没有保存')
    } finally {
      setBusy(false)
    }
  }

  async function ask(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    try {
      const json = await getJson<{ matches?: MatchHit[]; note?: string }>(`/api/longpi/match?q=${encodeURIComponent(question)}`)
      setMatches(json.matches ?? [])
      setNote(json.note ?? '')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '没有匹配到方法')
    } finally {
      setBusy(false)
    }
  }

  const name = displayName.trim()
  const today = board?.today ?? tracking?.today ?? new Date().toISOString().slice(0, 10)
  const connected = board?.records?.status === 'ok'
  const checkupCount = tracking?.bioage?.points?.length ?? 0
  const planDays = (tracking?.items ?? []).map((item) => item.start).sort()[0]

  const profileForm = h('form', { className: 'lp-form', onSubmit: (event: React.FormEvent) => { void saveProfile(event) } },
    h('input', { 'aria-label': '称呼', placeholder: '称呼', value: displayName, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value) }),
    h('input', { 'aria-label': '出生年', placeholder: '出生年', inputMode: 'numeric', value: birthYear, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setBirthYear(event.target.value) }),
    h('input', { 'aria-label': '实足年龄', placeholder: '实足年龄', inputMode: 'numeric', value: age, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setAge(event.target.value) }),
    h('select', { 'aria-label': '性别', value: sex, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setSex(event.target.value) },
      h('option', { value: 'unknown' }, '性别未填'), h('option', { value: 'female' }, '女'), h('option', { value: 'male' }, '男'), h('option', { value: 'other' }, '其他')),
    h('button', { type: 'submit', className: 'lp-btn', disabled: busy }, busy ? '保存中' : '保存'))

  const searchForm = h('div', null,
    h('form', { className: 'lp-search', onSubmit: (event: React.FormEvent) => { void ask(event) } },
      h('input', { 'aria-label': '想读的方法', placeholder: '例如：我的生物年龄、甲基化、NMN 有用吗', value: question, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuestion(event.target.value) }),
      h('button', { type: 'submit', className: 'lp-btn', disabled: busy }, '匹配')),
    note ? h('p', { className: 'lp-fine' }, note) : null,
    h('ul', { className: 'lp-list' }, ...(matches ?? []).slice(0, 6).map((item) => h('li', { key: item.name },
      h('span', { className: 'lp-strong' }, item.name), h('span', { className: 'lp-muted' }, ` ${(item.why ?? []).join('；') || item.blurb || ''}`)))))

  return h('div', { className: 'lp-root' },
    h('div', { className: 'lp-page' },
      h('header', { className: 'lp-header' },
        h('div', null,
          h('div', { className: 'lp-kicker' }, `LongPi ${board?.version ?? ''} · 个人长寿看板`),
          h('h1', { className: 'lp-h1' }, `${greeting(new Date())}${name ? `，${name}` : ''}`),
          h('p', { className: 'lp-lead' },
            planDays ? `你的方案已经坚持了 ${daysBetween(planDays, today)} 天。` : '把检查和方案放在一起看，才知道哪些努力真的有用。',
            ` 今天是 ${chineseDate(today)}。`),
          h('div', { className: 'lp-status' },
            h('span', { className: `lp-dot ${connected ? 'lp-dot-on' : ''}` }),
            connected ? `Mirobody 已连接 · ${board?.records?.indicator_count ?? 0} 项指标${checkupCount ? ` · ${checkupCount} 次完整血检` : ''}` : (board?.records?.status === 'unconfigured' ? '还没有接上 Mirobody 记录' : (board?.records?.error || '正在读取记录')))),
        h('div', { className: 'lp-actions' },
          h('button', { type: 'button', className: 'lp-btn lp-btn-ghost', onClick: () => load(true) }, h(Icon, { name: 'refresh', size: 15 }), '刷新'),
          h('a', { className: 'lp-btn lp-btn-ghost', href: api('/api/longpi/report'), download: `longpi-report-${today}.md` }, h(Icon, { name: 'download', size: 15 }), '导出报告'))),
      error ? h('div', { className: 'lp-banner lp-banner-bad' }, `看板没有打开：${error}`) : null,
      notice ? h('div', { className: 'lp-banner', role: 'status', onClick: () => setNotice(null) }, notice) : null,
      h('div', { className: `lp-body ${trackingLoading && tracking ? 'lp-refreshing' : ''}` },
        h('div', { className: 'lp-grid-hero' },
          h(Hero, { tracking, loading: trackingLoading }),
          h('div', { className: 'lp-tiles' }, h(Adherence, { tracking }), h(NextRetest, { tracking }))),
        h(Wins, { tracking }),
        h(Plan, { tracking, loading: trackingLoading, onCheckIn: (item: Item) => { void checkIn(item) }, busy, done }),
        h(Markers, { tracking }),
        h(Goals, { tracking }),
        h(NextSteps, { tracking }),
        h('details', { className: 'lp-more' },
          h('summary', null, '记录、方法和档案'),
          h(RecordSection, { board, busy, running, runResults, onRunReady: () => { void runReady() }, profileForm, searchForm }))),
      h('footer', { className: 'lp-footer' }, board?.boundary || '这不是诊断，也不能改处方。紧急情况请拨打 120。')))
}

export function registerDock(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'dsh-plugin-longpi', order: 18 },
    SuggestDock,
  ))
}

function SuggestDock(): React.ReactElement {
  const [copied, setCopied] = React.useState<string | null>(null)
  return h('div', { className: 'lp-dock' },
    h('span', { className: 'lp-dock-kicker' }, 'LongPi'),
    ...SUGGESTED.map((item) => h('button', {
      key: item.id,
      type: 'button',
      className: copied === item.id ? 'lp-chip lp-chip-on' : 'lp-chip',
      onClick: () => {
        void navigator.clipboard.writeText(item.zh).then(() => setCopied(item.id)).catch(() => setCopied(item.id))
      },
    }, item.zh)))
}

export function registerSidebar(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-plugin-longpi', order: 18 },
    SidebarMark,
  ))
}

function SidebarMark(props: { wide?: boolean }): React.ReactElement {
  return h('span', { className: 'lp-sidebar', title: 'LongPi' },
    h('span', { className: 'lp-dot lp-dot-on' }),
    props.wide === false ? null : h('span', null, 'LongPi'))
}
