// First-run discovery: after installing LongPi, someone should notice that something new arrived, without LongPi
// taking over DSH. Three quiet signals, each shown once per install and gone as soon as the 健康 page is opened or
// the welcome is dismissed:
//   - a dot on the sidebar's 健康 icon,
//   - a small welcome card in the shell's click-through overlay, pointing at that entry (no mask, nothing locked),
//   - on the first visit to the 健康 page, the onboarding dialog opens by itself (page.ts).
// "Seen" lives in the holder's LongPi home (GET/POST /api/longpi/intro), so wiping LongPi's data shows it again.

import React from 'react'
import { getJson, postJson } from './api.ts'
import { Icon, Mark } from './icons.ts'
import { PANEL_ID } from './constants.ts'
import { usePageShowing } from './store.ts'
import type { Face } from './types.ts'
import { Btn } from './ui.ts'

const h = React.createElement

let seen: boolean | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const fn of listeners) fn() }

function load(): void {
  if (loading) return
  loading = getJson<{ seen: boolean }>('/api/longpi/intro')
    .then((v) => { seen = Boolean(v.seen) })
    .catch(() => { seen = true })           // unknown: stay quiet rather than nag
    .finally(emit)
}

/** null while unknown, then whether this install's welcome was already seen. */
export function useIntroSeen(): boolean | null {
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    listeners.add(tick)
    load()
    return () => { listeners.delete(tick) }
  }, [])
  return seen
}

export function markIntroSeen(): void {
  if (seen === true) return
  seen = true
  emit()
  void postJson('/api/longpi/intro', {}).catch(() => undefined)
}

/** The sidebar icon with a dot while the welcome has not been seen. */
export function IntroDot(props: { children: React.ReactNode }): React.ReactElement {
  const isSeen = useIntroSeen()
  return h('span', { className: 'lp lp-intro-icon' }, props.children, isSeen === false ? h('span', { className: 'lp-intro-dot', 'aria-label': '新' }) : null)
}

type PanelInfoHook = (select: (info: { activePanelId: string | null }) => boolean) => boolean

function Card(props: Partial<Face> & { pageShowing: boolean }): React.ReactElement | null {
  const isSeen = useIntroSeen()
  if (isSeen !== false || props.pageShowing) return null
  return h('div', { className: 'lp lp-intro-card', role: 'dialog', 'aria-modal': false, 'aria-labelledby': 'lp-intro-title' },
    h('div', { className: 'lp-intro-head' },
      h('span', { className: 'lp-pill-mark' }, h(Mark, { size: 14 })),
      h('p', { className: 'lp-intro-title', id: 'lp-intro-title' }, '已安装 LongPi 健康'),
      h('button', { type: 'button', className: 'lp-iconbtn lp-intro-x', 'aria-label': '关闭', onClick: markIntroSeen }, h(Icon, { name: 'close', size: 14 }))),
    h('p', { className: 'lp-intro-text' }, '左侧新增了「健康」入口：上传体检报告后，可以查看身体年龄、心血管风险和各项指标的变化，并制定改善方案。'),
    h('p', { className: 'lp-caption' }, '也可以先打开示例档案，了解档案完整后的效果。'),
    h('div', { className: 'lp-intro-actions' },
      h(Btn, { variant: 'outline', size: 'sm', onClick: markIntroSeen }, '知道了'),
      // 打开健康页: the page marks the welcome seen and opens onboarding itself.
      h(Btn, { size: 'sm', onClick: () => props.openPage?.() }, '打开健康页')))
}

function WithPanelInfo(props: Partial<Face> & { usePanelInfo: PanelInfoHook }): React.ReactElement | null {
  const active = props.usePanelInfo((info) => info.activePanelId === PANEL_ID)
  const showing = usePageShowing()
  return h(Card, { ...props, pageShowing: active || showing })
}

function WithoutPanelInfo(props: Partial<Face>): React.ReactElement | null {
  return h(Card, { ...props, pageShowing: usePageShowing() })
}

/** The one-time welcome card in the shell overlay. */
export function IntroCard(props: Partial<Face> & { usePanelInfo?: PanelInfoHook }): React.ReactElement | null {
  return typeof props.usePanelInfo === 'function'
    ? h(WithPanelInfo, { ...props, usePanelInfo: props.usePanelInfo })
    : h(WithoutPanelInfo, props)
}
