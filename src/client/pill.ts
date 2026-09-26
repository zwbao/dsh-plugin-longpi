// DSH has no push notifications, and its sidebar entry takes no badge or count
// (SidebarPanelIconOwnerProps is only size and active), so a small pill in the
// shell's click-through overlay, bottom-right, says that today's check-ins
// are still open. It stays out of the way: only from 18:00, only while an item
// has no answer yet, never while the LongPi page or the home greeting (whose
// row lists the same items) is on screen, and × hides it until tomorrow.

import React from 'react'
import { checkStateOf } from './checkin.ts'
import { PANEL_ID } from './constants.ts'
import { localToday } from './format.ts'
import { Icon, Mark } from './icons.ts'
import { useHeroShowing, useJourney, usePageShowing, useStoreVersion } from './store.ts'
import type { Face } from './types.ts'
import { readPref, writePref } from './ui.ts'

const h = React.createElement

const HIDE_KEY = 'dsh-plugin-longpi.pill-hidden-on'
/** Local hour from which open check-ins are worth a nudge. */
const EVENING_HOUR = 18

type PanelInfoHook = (select: (info: { activePanelId: string | null }) => boolean) => boolean

interface PillProps extends Partial<Face> {
  usePanelInfo?: PanelInfoHook
}

/** Whether it is evening now, checked again every few minutes. */
function useEvening(): boolean {
  const [evening, setEvening] = React.useState(() => new Date().getHours() >= EVENING_HOUR)
  React.useEffect(() => {
    const timer = window.setInterval(() => setEvening(new Date().getHours() >= EVENING_HOUR), 5 * 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return evening
}

function Pill(props: PillProps & { pageShowing: boolean }): React.ReactElement | null {
  const { journey } = useJourney()
  useStoreVersion()
  const today = journey?.today ?? localToday()
  const [dismissed, setDismissed] = React.useState(() => readPref(HIDE_KEY) === today)
  React.useEffect(() => { setDismissed(readPref(HIDE_KEY) === today) }, [today])
  const heroShowing = useHeroShowing()
  const evening = useEvening()
  const open = journey ? journey.plan.checkin_items.filter((item) => checkStateOf(journey, item.id) === null) : []
  if (!journey || open.length === 0 || !evening || dismissed || props.pageShowing || heroShowing) return null
  const summary = open.map((item) => item.title).join('、')
  return h('div', { className: 'lp lp-pill-wrap', role: 'status' },
    h('button', { type: 'button', className: 'lp-pill-main', onClick: () => props.openPage?.(), title: summary, 'aria-label': `LongPi：今天还有 ${open.length} 项没有打卡：${summary}。打开健康页` },
      h('span', { className: 'lp-pill-mark' }, h(Mark, { size: 14 })),
      h('span', null, 'LongPi · 今天还有 ', h('span', { className: 'lp-pill-count' }, open.length), ' 项没打卡')),
    h('button', {
      type: 'button', className: 'lp-pill-x', 'aria-label': '今天不再提醒',
      onClick: () => { writePref(HIDE_KEY, today); setDismissed(true) },
    }, h(Icon, { name: 'close', size: 12 })))
}

function WithPanelInfo(props: PillProps & { usePanelInfo: PanelInfoHook }): React.ReactElement | null {
  const active = props.usePanelInfo((info) => info.activePanelId === PANEL_ID)
  const showing = usePageShowing()
  return h(Pill, { ...props, pageShowing: active || showing })
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
