// LongPi on DSH's blank-session home. The greeting takes the headline's place
// (DSH's own "探索未至之境" is hidden by a structural rule in styles.ts while it
// shows) and one sentence says where the person stands. Nothing renders until
// the journey arrives, and nothing when it cannot be read: DSH's headline then
// shows as usual, because the hide rule depends on .lp-hero existing.

import React from 'react'
import { fmt } from './charts.ts'
import { greeting, riskText, versusAge } from './format.ts'
import { Icon } from './icons.ts'
import { useHeroShown, useJourney } from './store.ts'
import type { Face, Journey } from './types.ts'

const h = React.createElement

/** Items named in the first-result sentence; the rest are counted, not listed. */
const ADDONS_NAMED = 3

/**
 * The seat sits inside the hero's headline, a wrapping flex row meant for a
 * 34 px logo and the title. Make the row item that holds the greeting span the
 * whole row, so a long status sentence wraps inside the column instead of
 * overflowing it; put the host's styles back when the greeting goes away.
 * Found by computed style, not class names, so a markup change degrades to a
 * greeting above DSH's title rather than a broken row.
 */
function useOwnRow(ref: React.RefObject<HTMLDivElement>): void {
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    let item: HTMLElement = node
    let row = node.parentElement
    for (let depth = 0; row && depth < 4; depth += 1) {
      const style = window.getComputedStyle(row)
      if (style.display.includes('flex') && style.flexWrap === 'wrap' && !style.flexDirection.startsWith('column')) break
      item = row
      row = row.parentElement
    }
    if (!row) return undefined
    const saved = item.getAttribute('style')
    item.style.flex = '0 0 100%'
    item.style.maxWidth = '100%'
    item.style.minWidth = '0'
    if (item !== node) {
      item.style.display = 'flex'
      item.style.justifyContent = 'center'
    }
    return () => {
      if (saved == null) item.removeAttribute('style')
      else item.setAttribute('style', saved)
    }
  }, [ref])
}

function Sep(): React.ReactElement {
  return h('span', { className: 'lp-hero-sep', 'aria-hidden': true }, '·')
}

function Go(props: { label: string; onClick: () => void }): React.ReactElement {
  return h('button', { type: 'button', className: 'lp-hero-link', onClick: props.onClick }, `${props.label} →`)
}

/** What the add-ons unlock, body age first (the order the page's results use). */
function joinUnlocks(journey: Journey): string {
  const all = [...new Set(journey.addons.flatMap((row) => row.unlocks_zh.split('、')).map((text) => text.trim()).filter(Boolean))]
  const rank = (text: string) => (text.includes('身体年龄') ? 0 : text.includes('心血管') ? 1 : 2)
  return all.sort((a, b) => rank(a) - rank(b)).join('和') || '第一个结果'
}

/** Body age and cardiovascular risk in the order the person cares about; a figure that is not available is left out. */
function figures(journey: Journey): React.ReactNode[][] {
  const { bioage, risk } = journey.results
  const body: React.ReactNode[] | null = bioage.status === 'ok' && bioage.phenoage != null
    ? ['身体年龄 ', h('b', { key: 'b' }, `${fmt(bioage.phenoage)} 岁`), versusAge(bioage.advance) ? `，${versusAge(bioage.advance)}` : '']
    : null
  const heart: React.ReactNode[] | null = risk.status === 'ok' && risk.risk_pct != null
    ? ['心血管 10 年风险 ', h('b', { key: 'b' }, `${riskText(risk.risk_pct)}%`), risk.category_zh ? `（${risk.category_zh}）` : '']
    : null
  const focus = journey.profile.focus
  const riskAt = focus.findIndex((key) => key === 'cardio' || key === 'weight')
  const bioAt = focus.indexOf('bioage')
  const ordered = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt) ? [heart, body] : [body, heart]
  return ordered.filter((row): row is React.ReactNode[] => row != null)
}

function titleOf(journey: Journey): string {
  if (journey.stage === 'consent' || journey.stage === 'profile') return '你好，我是 LongPi'
  const name = journey.profile.displayName.trim()
  return `${greeting(new Date())}${name ? `，${name}` : ''}`
}

/** One sentence per stage (spec D.1). Every figure comes from the journey; nothing is estimated here. */
function Status(props: { journey: Journey; open: () => void }): React.ReactElement {
  const { journey, open } = props
  const parts: React.ReactNode[] = []
  let estimate = false
  if (journey.stage === 'consent' || journey.stage === 'profile') {
    parts.push('花 2 分钟建档，算出你的身体年龄和心血管风险', h(Sep, { key: 's' }), h(Go, { key: 'go', label: '开始建档', onClick: open }))
  } else if (journey.stage === 'records') {
    parts.push(journey.records.status === 'error' ? '体检记录读取失败，暂时算不出结果' : '连接体检记录后，就能算出你的身体年龄',
      h(Sep, { key: 's' }), h(Go, { key: 'go', label: journey.records.status === 'error' ? '查看原因' : '怎么连接', onClick: open }))
  } else if (journey.stage === 'first_result' && journey.addons.length > 0) {
    const named = journey.addons.slice(0, ADDONS_NAMED).map((row) => row.item_zh).join('、')
    const more = journey.addons.length > ADDONS_NAMED ? ' 等' : ''
    parts.push('还差 ', h('b', { key: 'n' }, `${journey.addons.length} 项检查`), `就能算出${joinUnlocks(journey)}：${named}${more}`,
      h(Sep, { key: 's' }), h(Go, { key: 'go', label: '加测清单', onClick: open }))
  } else {
    const rows = journey.stage === 'first_result' ? [] : figures(journey)
    if (rows.length > 0) {
      estimate = true
      rows.forEach((row, index) => {
        if (index > 0) parts.push(h(Sep, { key: `s${index}` }))
        parts.push(h(React.Fragment, { key: `f${index}` }, ...row))
      })
    } else {
      // Held up by something other than a checkup (usually profile answers): say what the server says.
      const detail = journey.next.detail_zh || journey.results.risk.blocker_zh || journey.results.bioage.blocker_zh || '打开健康页看看还缺什么'
      parts.push(detail, h(Sep, { key: 's' }), h(Go, { key: 'go', label: journey.next.action === 'profile' ? '去填写' : '健康页', onClick: open }))
    }
  }
  return h('p', { className: 'lp-hero-status' }, ...parts,
    estimate ? h('span', { className: 'lp-hero-est', title: '模型根据你的记录计算的估计值，不是诊断' }, '模型估计') : null)
}

function Hero(props: { journey: Journey; open: () => void }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null)
  useOwnRow(ref)
  return h('div', { ref, className: 'lp lp-hero', role: 'group', 'aria-label': 'LongPi' },
    h('div', { className: 'lp-hero-title' },
      h('span', { className: 'lp-hero-mark', 'aria-hidden': true }, h(Icon, { name: 'pulse', size: 16, strokeWidth: 1.8 })),
      h('span', null, titleOf(props.journey))),
    h(Status, { journey: props.journey, open: props.open }))
}

export function HomeHero(props: Partial<Face>): React.ReactElement | null {
  const { journey } = useJourney()
  useHeroShown(journey != null)
  if (!journey) return null
  return h(Hero, { journey, open: () => props.openPage?.() })
}
