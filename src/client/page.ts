// The LongPi page (the 健康 entry in DSH's sidebar), in four tabs by how often
// each is needed: 概览 every day (today's check-ins, the two results, the next
// step, what changed), 指标 and 方案 every few weeks, 档案 now and then.
// Settings (reminders, the data connection, the method library) live in DSH's
// settings under LongPi. While onboarding is not finished, one line under the
// header says how many steps are left and reopens it. The tab is remembered;
// other surfaces open a tab (and a section in it) through the store.

import React from 'react'
import { BOUNDARY_FALLBACK } from './constants.ts'
import { chineseDate, goTo, greeting, localToday, weekday } from './format.ts'
import { Icon } from './icons.ts'
import { IndicatorsTab } from './indicators.ts'
import { RecordsStatusLine } from './journey-steps.ts'
import { Onboarding, ONBOARDING_TITLES, stepOfStage } from './onboarding.ts'
import { Overview } from './overview.ts'
import { PlanTab } from './plan.ts'
import { ProfileTab } from './profile-tab.ts'
import type { ResultTarget } from './results.ts'
import {
  clearViewRequest, setPendingPrompt, useJourney, usePageShown, useTracking, useViewRequest,
  type IndicatorFilter, type PageTab, type ViewRequest,
} from './store.ts'
import type { Face, Journey, Stage } from './types.ts'
import { Btn, copyText, readPref, Skeleton, Tabs, useNotice, writePref, type TabSpec } from './ui.ts'

const h = React.createElement

const TAB_KEY = 'dsh-plugin-longpi.page-tab'
const TABS: Array<TabSpec<PageTab>> = [
  { key: 'overview', label: '概览' },
  { key: 'indicators', label: '指标' },
  { key: 'plan', label: '方案' },
  { key: 'profile', label: '档案' },
]
/** How long a request from elsewhere waits for its section to be on screen. */
const SCROLL_WAIT_MS = 2000

function storedTab(): PageTab {
  const saved = readPref(TAB_KEY)
  return TABS.some((tab) => tab.key === saved) ? saved as PageTab : 'overview'
}

/** Onboarding steps still open, for the banner: none once the record is connected. */
const OPEN_STAGES: Stage[] = ['consent', 'profile', 'records']

function bannerOf(journey: Journey): { left: number; title: string } | null {
  if (!OPEN_STAGES.includes(journey.stage)) return null
  const index = stepOfStage(journey.stage)
  return { left: OPEN_STAGES.length - index, title: ONBOARDING_TITLES[index] ?? '' }
}

function Header(props: { journey: Journey | null; failed: boolean; refreshing: boolean; onRefresh: () => void }): React.ReactElement {
  const journey = props.journey
  const today = journey?.today ?? localToday()
  const name = journey?.profile.displayName.trim() ?? ''
  const plan = journey?.plan.exists && journey.plan.days != null ? ` · 方案第 ${journey.plan.days} 天` : ''
  return h('header', { className: 'lp-header' },
    h('div', { className: 'lp-header-text' },
      h('div', { className: 'lp-kicker' }, `LongPi${journey?.version ? ` ${journey.version}` : ''} · 健康`),
      h('h1', { className: 'lp-h1' }, `${greeting(new Date())}${name ? `，${name}` : ''}`),
      h('p', { className: 'lp-lead' }, `${chineseDate(today)} ${weekday(today)}${plan}`),
      journey ? h(RecordsStatusLine, { journey }) : props.failed ? null : h(Skeleton, { height: 18, width: 240 })),
    h('div', { className: 'lp-actions' },
      h('button', { type: 'button', className: 'lp-linkbtn', onClick: props.onRefresh, disabled: props.refreshing, 'aria-busy': props.refreshing },
        h(Icon, { name: 'refresh', size: 14, className: props.refreshing ? 'lp-spin' : '' }), props.refreshing ? '刷新中' : '刷新')))
}

function Banner(props: { journey: Journey; onOpen: () => void }): React.ReactElement | null {
  const banner = bannerOf(props.journey)
  if (!banner) return null
  return h('button', { type: 'button', className: 'lp-banner', onClick: props.onOpen },
    h(Icon, { name: 'spark', size: 14 }),
    h('span', null, `还差 ${banner.left} 步：${banner.title}`),
    h('span', { className: 'lp-banner-go' }, '继续 →'))
}

function Loading(): React.ReactElement {
  return h('div', { className: 'lp-loading', 'aria-busy': true, 'aria-label': '正在读取' },
    h(Skeleton, { height: 36, width: 320 }),
    h('div', { className: 'lp-results' }, h(Skeleton, { height: 180, className: 'lp-card-skeleton' }), h(Skeleton, { height: 180, className: 'lp-card-skeleton' })),
    h(Skeleton, { height: 120, className: 'lp-card-skeleton' }))
}

function Failed(props: { error: string; onRetry: () => void }): React.ReactElement {
  return h('div', { className: 'lp-card lp-failed', role: 'alert' },
    h('div', { className: 'lp-strong' }, 'LongPi 没有读到数据'),
    h('p', { className: 'lp-muted' }, `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。`),
    h(Btn, { variant: 'outline', size: 'sm', onClick: props.onRetry }, h(Icon, { name: 'refresh', size: 14 }), '重试'))
}

/**
 * Take a request from elsewhere (the home, onboarding, a chat card): switch to
 * its tab, apply its filter, then scroll to its section once it is laid out.
 */
function useViewRequests(ready: boolean, setTab: (tab: PageTab) => void, setFilter: (filter: IndicatorFilter) => void): void {
  const request = useViewRequest()
  React.useEffect(() => {
    if (!request || !ready) return undefined
    if (request.tab) setTab(request.tab)
    if (request.filter) setFilter(request.filter)
    const target = request.id
    if (!target) {
      clearViewRequest(request)
      return undefined
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      const node = document.getElementById(target)
      const shown = node != null && node.getClientRects().length > 0
      if (!shown && Date.now() - started < SCROLL_WAIT_MS) return
      window.clearInterval(timer)
      clearViewRequest(request)
      if (shown) goTo(target)
    }, 100)
    return () => window.clearInterval(timer)
  }, [request, ready])
}

export function LongPiPage(props: Partial<Face>): React.ReactElement {
  const root = React.useRef<HTMLDivElement>(null)
  usePageShown(root)
  const { journey, loading, error, refresh } = useJourney()
  const tracking = useTracking()
  const [notice, notify] = useNotice()
  const [tab, setTabState] = React.useState<PageTab>(storedTab)
  const [filter, setFilter] = React.useState<IndicatorFilter>('all')
  const [refreshing, setRefreshing] = React.useState(false)
  const [onboarding, setOnboarding] = React.useState(false)

  const setTab = React.useCallback((next: PageTab) => {
    setTabState(next)
    writePref(TAB_KEY, next)
  }, [])
  useViewRequests(journey != null, setTab, setFilter)

  const goTab = React.useCallback((next: PageTab, request?: Omit<ViewRequest, 'tab'>) => {
    setTab(next)
    if (request?.filter) setFilter(request.filter)
    if (request?.id) {
      const id = request.id
      window.setTimeout(() => goTo(id), 60)
    }
  }, [setTab])

  const doRefresh = React.useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh(true)
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  const onAction = (target: ResultTarget) => {
    if (target === 'records') goTab('profile', { id: 'lp-connection-card' })
    else if (target === 'addons') goTab('profile', { id: 'lp-addons-card' })
    else if (target === 'self') goTab('profile', { id: 'lp-self-card' })
    else goTab('profile', { id: 'lp-profile-card' })
  }

  // The prompt bridge in the chat's input dock picks the prompt up and inserts
  // it; the clipboard copy is the fallback when no composer is on screen to take it.
  const onPrompt = (text: string) => {
    setPendingPrompt(text)
    const copying = copyText(text)
    if (props.openChat) {
      props.openChat()
      return
    }
    void copying.then((copied) => notify(copied ? '已复制，粘贴到对话里发送即可。' : text, 'info'))
  }

  let body: React.ReactNode
  if (!journey && loading) body = h(Loading)
  else if (!journey) body = h(Failed, { error: error ?? '没有返回', onRetry: () => { void doRefresh() } })
  else {
    let panel: React.ReactNode
    if (tab === 'overview') {
      panel = h(Overview, { journey, tracking: tracking.data, onNotice: notify, onAction, goTab, openOnboarding: () => setOnboarding(true) })
    } else if (tab === 'indicators') {
      panel = h(IndicatorsTab, { filter, onFilter: setFilter, onConnect: () => goTab('profile', { id: 'lp-connection-card' }) })
    } else if (tab === 'plan') {
      panel = h(PlanTab, { journey, tracking: tracking.data, loading: tracking.loading, error: tracking.error, onNotice: notify, onPrompt })
    } else {
      panel = h(ProfileTab, { journey, onNotice: notify })
    }
    body = h('div', { className: `lp-body ${refreshing ? 'lp-refreshing' : ''}` },
      h(Banner, { journey, onOpen: () => setOnboarding(true) }),
      h(Tabs<PageTab>, { tabs: TABS, value: tab, onChange: setTab, label: 'LongPi 健康页', idPrefix: 'lp-page' }),
      h('div', { className: 'lp-tab-panel', role: 'tabpanel', id: 'lp-page-panel', 'aria-labelledby': `lp-page-tab-${tab}` }, panel))
  }

  return h('div', { className: 'lp lp-page-root', ref: root },
    h('div', { className: 'lp-page' },
      h(Header, { journey, failed: !journey && !loading, refreshing, onRefresh: () => { void doRefresh() } }),
      notice ? h('div', { className: 'lp-notice-slot' }, notice) : null,
      body,
      h('footer', { className: 'lp-footer' },
        h('p', null, journey?.boundary_zh || BOUNDARY_FALLBACK),
        h('p', { className: 'lp-caption' }, '档案、方案、打卡和自测只保存在这台电脑上，病历在你自己的 Mirobody 中；对话内容会发送给 DSH 里配置的模型处理。'))),
    onboarding ? h(Onboarding, { explicit: true, complete: () => setOnboarding(false), openPage: () => {} }) : null)
}
