// DSH has no push notifications, so due reminders show as a small pill in the
// shell's click-through overlay layer, bottom-right. It hides while the LongPi
// page or the home greeting (whose row lists the same things) is on screen,
// and × hides it until tomorrow.

import React from 'react'
import { PANEL_ID } from './constants.ts'
import { localToday } from './format.ts'
import { Icon, Mark } from './icons.ts'
import { useHeroShowing, useJourney, usePageShowing } from './store.ts'
import type { Face } from './types.ts'

const h = React.createElement

const HIDE_KEY = 'dsh-plugin-longpi.pill-hidden-on'

type PanelInfoHook = (select: (info: { activePanelId: string | null }) => boolean) => boolean

interface PillProps extends Partial<Face> {
  usePanelInfo?: PanelInfoHook
}

function hiddenOn(): string | null {
  try {
    return window.localStorage.getItem(HIDE_KEY)
  } catch {
    return null
  }
}

function hideFor(day: string): void {
  try {
    window.localStorage.setItem(HIDE_KEY, day)
  } catch {
    // Private mode or blocked storage: the pill just comes back next render.
  }
}

function Pill(props: PillProps & { pageShowing: boolean }): React.ReactElement | null {
  const { journey } = useJourney()
  const today = journey?.today ?? localToday()
  const [dismissed, setDismissed] = React.useState(() => hiddenOn() === today)
  React.useEffect(() => { setDismissed(hiddenOn() === today) }, [today])
  const heroShowing = useHeroShowing()
  const due = (journey?.reminders ?? []).filter((row) => row.due)
  // Count things to do, not reminder rows: one check-in reminder can stand for several unticked items.
  const open = journey ? journey.plan.checkin_items.filter((item) => !item.done_today).length : 0
  const count = (due.some((row) => row.kind === 'checkin') ? open : 0) + due.filter((row) => row.kind === 'retest').length
  if (!journey || count === 0 || dismissed || props.pageShowing || heroShowing) return null
  const summary = due.map((row) => row.text_zh).join('；')
  return h('div', { className: 'lp lp-pill-wrap', role: 'status' },
    h('button', { type: 'button', className: 'lp-pill-main', onClick: () => props.openPage?.(), title: summary, 'aria-label': `LongPi 今天 ${count} 项待办：${summary}。打开健康页` },
      h('span', { className: 'lp-pill-mark' }, h(Mark, { size: 14 })),
      h('span', null, 'LongPi · 今天 ', h('span', { className: 'lp-pill-count' }, count), ' 项待办')),
    h('button', {
      type: 'button', className: 'lp-pill-x', 'aria-label': '今天不再提醒',
      onClick: () => { hideFor(today); setDismissed(true) },
    }, h(Icon, { name: 'close', size: 12 })))
}

function WithPanelInfo(props: PillProps & { usePanelInfo: PanelInfoHook }): React.ReactElement | null {
  const active = props.usePanelInfo((info) => info.activePanelId === PANEL_ID)
  return h(Pill, { ...props, pageShowing: active })
}

function WithoutPanelInfo(props: PillProps): React.ReactElement | null {
  const showing = usePageShowing()
  return h(Pill, { ...props, pageShowing: showing })
}

export function ReminderPill(props: PillProps): React.ReactElement | null {
  // Two components so the hook call order never depends on a prop at render time.
  return typeof props.usePanelInfo === 'function'
    ? h(WithPanelInfo, { ...props, usePanelInfo: props.usePanelInfo })
    : h(WithoutPanelInfo, props)
}
