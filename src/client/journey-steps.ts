// The onboarding steps' content: the notice (informed consent), what LongPi
// found in the record (or the connection form when there is none yet), and the
// first results, or what can be done now when they cannot be computed yet.

import React from 'react'
import { postJson } from './api.ts'
import { fmt } from './charts.ts'
import { ConnectionPanel } from './connection.ts'
import { CONSENT_SENTENCES } from './constants.ts'
import { chineseDate, riskText, versusAge } from './format.ts'
import { Icon } from './icons.ts'
import { recordConnected } from './normalize.ts'
import { InlineSelf } from './self-measure.ts'
import { notifyChanged } from './store.ts'
import type { Journey } from './types.ts'
import { Btn } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

export async function acceptConsent(): Promise<void> {
  await postJson('/api/longpi/consent', { accept: true })
  notifyChanged()
}

const CONSENT_ICONS = ['health', 'lock', 'spark'] as const

export function ConsentText(): React.ReactElement {
  return h('div', { className: 'lp-consent' }, ...CONSENT_SENTENCES.map((text, index) => h('div', { key: index, className: 'lp-consent-row' },
    h('span', { className: 'lp-consent-icon', 'aria-hidden': true }, h(Icon, { name: CONSENT_ICONS[index] ?? 'info', size: 15 })),
    h('p', null, text))))
}

/** '· N 次完整体检', left out at 0: "0 次完整体检" reads as a fault. */
function checkupsText(count: number): string {
  return count > 0 ? ` · ${count} 次完整体检` : ''
}

export function RecordsStatusLine(props: { journey: Journey }): React.ReactElement {
  const records = props.journey.records
  if (recordConnected(records.status)) {
    const partial = records.status === 'partial'
    return h('div', { className: 'lp-status' },
      h('span', { className: `lp-statusdot ${partial ? 'lp-statusdot-warn' : 'lp-statusdot-on'}`, 'aria-hidden': true }),
      `Mirobody 已连接 · ${records.indicator_count} 项指标${checkupsText(records.full_checkups)}${partial ? ' · 部分没有读到' : ''}`)
  }
  return h('div', { className: 'lp-status' },
    h('span', { className: `lp-statusdot ${records.status === 'error' ? 'lp-statusdot-bad' : ''}`, 'aria-hidden': true }),
    records.status === 'error' ? `记录读取失败：${records.error || '没有返回原因'}` : '还没有连接 Mirobody 记录')
}

function month(iso: string | null): string {
  return iso ? `${iso.slice(0, 4)}-${iso.slice(5, 7)}` : ''
}

/** Three tiles: checkups and their date range, lab categories, wearable days. Only counts the server gave. */
function FoundTiles(props: { journey: Journey }): React.ReactElement {
  const records = props.journey.records
  const summary = records.summary
  const tiles: Array<{ label: string; figure: string; unit: string; caption: string }> = []
  if (summary) {
    const range = summary.first_date && summary.last_date && summary.first_date !== summary.last_date
      ? `${month(summary.first_date)} → ${month(summary.last_date)}` : summary.last_date ? chineseDate(summary.last_date) : ''
    tiles.push({ label: '体检', figure: String(summary.checkups), unit: '次', caption: range })
    tiles.push({
      label: '化验指标', figure: String(records.indicator_count), unit: '项',
      caption: summary.categories_zh.length > 0 ? `${summary.categories_zh.slice(0, 3).join(' · ')}${summary.categories_zh.length > 3 ? '…' : ''}` : '',
    })
    tiles.push({ label: '手环', figure: String(summary.wearable_days), unit: '天', caption: summary.wearable_days > 0 ? '近一年有记录的天数' : '没有手环数据' })
  } else {
    // An older server: the two counts it has.
    tiles.push({ label: '化验指标', figure: String(records.indicator_count), unit: '项', caption: '' })
    tiles.push({ label: '完整体检', figure: String(records.full_checkups), unit: '次', caption: records.latest_checkup ? `最近 ${chineseDate(records.latest_checkup)}` : '九项血检还没有在同一天测齐' })
  }
  return h('ul', { className: 'lp-found' },
    ...tiles.map((tile) => h('li', { key: tile.label, className: 'lp-found-tile' },
      h('span', { className: 'lp-caption' }, tile.label),
      h('span', { className: 'lp-found-figure' }, tile.figure, h('span', { className: 'lp-bignum-unit' }, tile.unit)),
      tile.caption ? h('span', { className: 'lp-caption' }, tile.caption) : null)))
}

/** One line on changes beyond normal fluctuation, when the record has any. */
function ChangesLine(props: { journey: Journey; onOpenChanges?: () => void }): React.ReactElement | null {
  const rows = props.journey.changes
  if (rows.length === 0) return null
  const names = rows.slice(0, 3).map((row) => row.label_zh).join('、')
  const doctor = rows.some((row) => row.ask_doctor)
  return h('p', { className: `lp-found-changes ${doctor ? 'lp-found-changes-warn' : ''}` },
    h(Icon, { name: doctor ? 'warn' : 'info', size: 14 }),
    h('span', null,
      h('span', { className: 'lp-strong' }, `值得注意：${rows.length} 项指标的变化超出正常波动`),
      ` · ${names}${rows.length > 3 ? ' 等' : ''}`,
      props.onOpenChanges ? h(React.Fragment, null, ' · ', h('button', { type: 'button', className: 'lp-row-link', onClick: props.onOpenChanges }, '在健康页查看')) : null))
}

/** Step 3: what LongPi found, or the connection form (no installer needed). */
export function RecordsStep(props: { journey: Journey; onOpenChanges?: () => void }): React.ReactElement {
  const records = props.journey.records
  const connected = recordConnected(records.status)
  return h('div', { className: 'lp-step-body' },
    connected
      ? h(React.Fragment, null,
        h('p', { className: 'lp-muted' }, '我们在 Mirobody 里看到了这些（只读）：'),
        h(FoundTiles, { journey: props.journey }),
        records.status === 'partial' ? h('p', { className: 'lp-blocker lp-blocker-bad' }, `有一部分记录这次没有读到${records.read_errors[0] ? `：${records.read_errors[0]}` : ''}。它们不是“没测”，稍后在健康页刷新。`) : null,
        h(ChangesLine, props))
      : h(React.Fragment, null,
        records.status === 'error'
          ? h('p', { className: 'lp-blocker lp-blocker-bad' }, `记录读取失败：${records.error || '没有返回原因'}`)
          : h('p', { className: 'lp-muted' }, 'LongPi 从你自己的 Mirobody 读取体检和可穿戴数据（只读）。在 Mirobody 网页生成个人 MCP 地址，粘贴到这里：')),
    h(ConnectionPanel, { idPrefix: 'lp-onb-conn', collapsed: connected }))
}

/** The two results, compact: a figure, or 还不能计算 with the server's reason. */
function ResultFigures(props: { journey: Journey }): React.ReactElement {
  const { bioage, risk } = props.journey.results
  return h('div', { className: 'lp-first' },
    h('div', { className: 'lp-first-cell' },
      h('div', { className: 'lp-caption' }, '身体年龄 · 模型估计'),
      bioage.status === 'ok'
        ? h('div', null,
          h('div', { className: 'lp-first-figure' }, fmt(bioage.phenoage), h('span', { className: 'lp-bignum-unit' }, '岁')),
          h('div', { className: 'lp-caption' }, versusAge(bioage.advance)),
          bioage.caveat_zh ? h('p', { className: 'lp-caption lp-first-caveat', role: 'note' }, bioage.caveat_zh) : null)
        : h('div', null, h('div', { className: 'lp-first-wait' }, '还不能计算'), h('p', { className: 'lp-blocker' }, bioage.blocker_zh))),
    h('div', { className: 'lp-first-cell' },
      h('div', { className: 'lp-caption' }, '10 年心血管风险 · 模型估计'),
      risk.status === 'ok'
        ? h('div', null,
          h('div', { className: 'lp-first-figure' }, riskText(risk.risk_pct), h('span', { className: 'lp-bignum-unit' }, '%')),
          h('div', { className: 'lp-caption' }, risk.category_zh))
        : h('div', null, h('div', { className: 'lp-first-wait' }, '还不能计算'), h('p', { className: 'lp-blocker' }, risk.blocker_zh))))
}

export interface NowActions {
  /** Open the page's 方案 tab (or put the draft prompt in the composer). */
  onDraft: () => void
  /** Open the page's add-on list. */
  onAddons: () => void
}

/**
 * Step 4 when a result is blocked: what can be done right now. A waist
 * measurement when it unlocks the risk, a plan draft, and the add-on tests.
 */
function NowList(props: { journey: Journey; onNotice: Notify; actions: NowActions }): React.ReactElement {
  const { journey } = props
  const waist = journey.addons.find((row) => row.self_measurable && row.self_key && row.unlocks_zh.includes('心血管'))
  const lab = journey.addons.filter((row) => !row.self_measurable)
  const rows: React.ReactNode[] = []
  if (waist?.self_key) {
    rows.push(h('li', { key: 'self', className: 'lp-now' },
      h('span', { className: 'lp-now-icon', 'aria-hidden': true }, h(Icon, { name: 'ruler', size: 15 })),
      h('div', { className: 'lp-now-text' },
        h('div', { className: 'lp-strong' }, `量一下${waist.item_zh}`),
        h('div', { className: 'lp-caption' }, `填上就能算出${waist.unlocks_zh}`),
        h(InlineSelf, { journey, selfKey: waist.self_key, idPrefix: 'lp-onb-now', onNotice: props.onNotice }))))
  }
  rows.push(h('li', { key: 'plan', className: 'lp-now' },
    h('span', { className: 'lp-now-icon', 'aria-hidden': true }, h(Icon, { name: 'spark', size: 15 })),
    h('div', { className: 'lp-now-text' },
      h('div', { className: 'lp-strong' }, '先制定一份改善方案'),
      h('div', { className: 'lp-caption' }, '按你关心的方面，从收录的试验证据里起草；你确认后才保存。')),
    h(Btn, { size: 'sm', variant: 'outline', onClick: props.actions.onDraft }, '起草方案')))
  if (lab.length > 0) {
    rows.push(h('li', { key: 'lab', className: 'lp-now' },
      h('span', { className: 'lp-now-icon', 'aria-hidden': true }, h(Icon, { name: 'flask', size: 15 })),
      h('div', { className: 'lp-now-text' },
        h('div', { className: 'lp-strong' }, `下次体检加测${lab.slice(0, 2).map((row) => row.item_zh).join('、')}${lab.length > 2 ? ' 等' : ''}`),
        h('div', { className: 'lp-caption' }, `加上就能算${[...new Set(lab.map((row) => row.unlocks_zh))].join('、')}`)),
      h(Btn, { size: 'sm', variant: 'outline', onClick: props.actions.onAddons }, '加测清单')))
  }
  return h('div', { className: 'lp-now-block' },
    h('div', { className: 'lp-subhead' }, '现在就能做的事'),
    h('ul', { className: 'lp-nows' }, ...rows))
}

/** Step 4: the results; when one is blocked, what can be done now instead of an empty card. */
export function FirstResult(props: { journey: Journey; onNotice: Notify; actions: NowActions }): React.ReactElement {
  const { bioage, risk } = props.journey.results
  const blocked = bioage.status !== 'ok' || risk.status !== 'ok'
  return h('div', { className: 'lp-step-body' },
    h(ResultFigures, { journey: props.journey }),
    blocked ? h(NowList, props) : null)
}
