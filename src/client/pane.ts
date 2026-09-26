// 健康 as a tab in DSH's right column, next to the chat (sidebar.right.pane.tab): the 概览 tab narrowed to the
// column — today's check-ins, the two results, the next step and what changed — with the full page one click
// away. It reads the page's store, so a check-in made here shows on the page, the home row and the chat at
// once. The tab type is a page (no addresses); DSH's guide page for the column offers it, and the turn's quick
// actions open it (setPaneOpener, from index.ts, while DSH's right column is there).

import React from 'react'
import { BOUNDARY_FALLBACK } from './constants.ts'
import { Icon } from './icons.ts'
import { Overview } from './overview.ts'
import type { ResultTarget } from './results.ts'
import { requestView, useJourney, useTracking, type PageTab, type ViewRequest } from './store.ts'
import type { Face } from './types.ts'
import { Btn, Skeleton, useNotice } from './ui.ts'

const h = React.createElement

/** The tab type's identity in DSH's registry, and the key its body registers under. */
export const PANE_ID = 'dsh-plugin-longpi.health'
/** What openTab names. */
export const PANE_KIND = 'longpi-health'
export const PANE_TITLE = '健康'

let opener: (() => void) | null = null
const listeners = new Set<() => void>()

/** Set by index.ts while DSH's right column exists: opens (or reveals) the 健康 tab. */
export function setPaneOpener(open: (() => void) | null): void {
  opener = open
  for (const listener of listeners) listener()
}

export function usePaneOpener(): (() => void) | null {
  return React.useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => opener, () => opener)
}

/** DSH's SidebarRightTabDefinition for the 健康 tab: a page type, offered on the column's guide page. */
export function paneDefinition(icon: (props: { size?: number }) => React.ReactElement) {
  return {
    id: PANE_ID,
    kind: PANE_KIND,
    priority: 'extension' as const,
    title: () => PANE_TITLE,
    guide: [{ order: 20, title: () => PANE_TITLE, description: () => '今天的打卡、身体年龄、心血管风险和值得注意的变化', icon }],
  }
}

export function HealthPane(props: Partial<Face>): React.ReactElement {
  const { journey, loading, error, refresh } = useJourney()
  const tracking = useTracking()
  const [notice, notify] = useNotice()
  // Everything that needs more room than the column opens the page there.
  const toPage = (tab: PageTab, request?: Omit<ViewRequest, 'tab'>) => {
    requestView({ tab, ...request })
    props.openPage?.()
  }
  const onAction = (target: ResultTarget) => toPage('profile', {
    id: target === 'records' ? 'lp-connection-card' : target === 'addons' ? 'lp-addons-card' : target === 'self' ? 'lp-self-card' : 'lp-profile-card',
  })
  let body: React.ReactNode
  if (!journey && loading) {
    body = h('div', { className: 'lp-pane-loading', 'aria-busy': true, 'aria-label': '正在读取' },
      h(Skeleton, { height: 120, className: 'lp-card-skeleton' }), h(Skeleton, { height: 160, className: 'lp-card-skeleton' }))
  } else if (!journey) {
    body = h('div', { className: 'lp-card lp-failed', role: 'alert' },
      h('p', { className: 'lp-muted' }, `没有读到数据：${error ?? '没有返回'}。`),
      h(Btn, { variant: 'outline', size: 'sm', onClick: () => { void refresh(true) } }, h(Icon, { name: 'refresh', size: 14 }), '重试'))
  } else {
    body = h(Overview, { journey, tracking: tracking.data, onNotice: notify, onAction, goTab: toPage, openOnboarding: () => toPage('overview') })
  }
  return h('div', { className: 'lp lp-pane' },
    h('div', { className: 'lp-pane-head' },
      h('span', { className: 'lp-label' }, h(Icon, { name: 'health', size: 14 }), PANE_TITLE),
      props.openPage ? h('button', { type: 'button', className: 'lp-row-link', onClick: props.openPage }, '打开健康页 →') : null),
    notice ? h('div', { className: 'lp-notice-slot' }, notice) : null,
    body,
    h('p', { className: 'lp-fine lp-pane-foot' }, journey?.boundary_zh || BOUNDARY_FALLBACK))
}
