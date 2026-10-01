// The LongPi page (the 健康 entry in DSH's sidebar), in four tabs by how often
// each is needed: 概览 every day (today's check-ins, the two results, the next
// step, what changed), 指标 and 方案 every few weeks, 档案 now and then.
// Settings (reminders, the data connection, the method library) live in DSH's
// settings under LongPi. While onboarding is not finished, one line under the
// header says how many steps are left and reopens it. The tab is remembered;
// other surfaces open a tab (and a section in it) through the store.

import React from 'react'
import { getJson } from './api.ts'
import { BOUNDARY_FALLBACK } from './constants.ts'
import { chineseDate, goTo, greeting, localToday, weekday } from './format.ts'
import { Icon } from './icons.ts'
import { IndicatorsTab } from './indicators.ts'
import { RecordsStatusLine } from './journey-steps.ts'
import { Onboarding, ONBOARDING_TITLES, stepsLeft } from './onboarding.ts'
import { HealthChatButton } from './health-chat.ts'
import { Overview } from './overview.ts'
import { PlanTab } from './plan.ts'
import { registerClientModules } from './modules.ts'
import { ProfileTab } from './profile-tab.ts'
import { SeasonBar } from './engage/index.ts'
import { AskTab, CalendarTab, SleepTab, TrainingTab } from './life.ts'
import { AnalysisTab } from './analysis.ts'
import { DemoInvite, PeoplePicker, PersonNotice } from './people.ts'
import { pageTabs } from './registry.ts'
import type { ResultTarget } from './results.ts'
import {
  canonTab, clearViewRequest, setPendingPrompt, useJourney, usePageShown, useTracking, useViewRequest,
  type IndicatorFilter, type PageTab, type ViewRequest,
} from './store.ts'
import type { Face, Journey, Stage } from './types.ts'
import { Btn, copyText, readPref, Skeleton, Tabs, useNotice, writePref, type TabSpec } from './ui.ts'

const h = React.createElement

const TAB_KEY = 'dsh-plugin-longpi.page-tab'
const TABS: Array<TabSpec<PageTab>> = [
  { key: 'overview', label: '总览' },
  { key: 'labs', label: '化验' },
  { key: 'sleep', label: '睡眠' },
  { key: 'training', label: '运动' },
  { key: 'calendar', label: '日程' },
  { key: 'analysis', label: '深度分析' },
  { key: 'ask', label: '问 LongPi' },
]

/** The secondary pages, reached from 更多 at the right end of the tab row. */
const SECONDARY: Array<{ key: PageTab; label: string }> = [
  { key: 'plan', label: '方案' },
  { key: 'profile', label: '档案' },
  { key: 'season', label: '赛季' },
  { key: 'science', label: '研究' },
]

registerClientModules()
/** How long a request from elsewhere waits for its section to be on screen. */
const SCROLL_WAIT_MS = 2000

function storedTab(extra: readonly string[]): PageTab {
  const saved = readPref(TAB_KEY)
  const key = saved ? canonTab(saved) : 'overview'
  if (saved && (TABS.some((tab) => tab.key === key) || extra.includes(key) || key === 'plan' || key === 'profile' || key === 'season' || key === 'science')) return key
  return 'overview'
}

/** Setup steps still open, for the banner: none once there is a first record. */
function bannerOf(journey: Journey): { left: number; title: string } | null {
  const left = stepsLeft(journey)
  if (!left) return null
  return { left, title: ONBOARDING_TITLES[ONBOARDING_TITLES.length - left] ?? '' }
}

function Header(props: { journey: Journey | null; failed: boolean; refreshing: boolean; onRefresh: () => void }): React.ReactElement {
  const journey = props.journey
  const today = journey?.today ?? localToday()
  const name = journey?.profile.displayName.trim() ?? ''
  const meta = [`${chineseDate(today)} ${weekday(today)}`, journey?.plan.exists && journey.plan.days != null ? `方案第 ${journey.plan.days} 天` : ''].filter(Boolean)
  const sep = () => h('span', { className: 'lp-header-sep', 'aria-hidden': true }, '·')
  return h('header', { className: 'lp-header' },
    h('div', { className: 'lp-header-text' },
      h('div', { className: 'lp-kicker' }, 'LongPi · 健康'),
      h('h1', { className: 'lp-h1' }, `${greeting(new Date())}${name ? `，${name}` : ''}`),
      h('div', { className: 'lp-header-meta' },
        ...meta.flatMap((text, index) => [index > 0 ? h(React.Fragment, { key: `s${index}` }, sep()) : null, h('span', { key: `m${index}` }, text)]),
        journey ? h(React.Fragment, null, sep(), h(RecordsStatusLine, { journey, inline: true }))
          : props.failed ? null : h(Skeleton, { height: 18, width: 160 }))),
    h('div', { className: 'lp-header-actions' },
      h(PeoplePicker, null,
        h(HealthChatButton),
        h('button', { type: 'button', className: 'lp-linkbtn', onClick: props.onRefresh, disabled: props.refreshing, 'aria-busy': props.refreshing },
          h(Icon, { name: 'refresh', size: 14, className: props.refreshing ? 'lp-spin' : '' }), props.refreshing ? '刷新中' : '刷新'))))
}

function Banner(props: { journey: Journey; onOpen: () => void }): React.ReactElement | null {
  const banner = bannerOf(props.journey)
  if (!banner) return null
  return h('button', { type: 'button', className: 'lp-banner', onClick: props.onOpen },
    h(Icon, { name: 'spark', size: 14 }),
    h('span', { className: 'lp-banner-text' }, `还差 ${banner.left} 步完成设置：${banner.title}`),
    h('span', { className: 'lp-banner-go' }, '继续', h(Icon, { name: 'chevron', size: 14 })))
}

/** 更多: a small menu of the secondary pages; a click elsewhere or Escape closes it. */
function MoreMenu(props: { items: Array<{ key: PageTab; label: string }>; current: PageTab; onPick: (tab: PageTab) => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  const menuId = React.useId()
  React.useEffect(() => {
    if (!open) return undefined
    wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const onDown = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const onMenuKey = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  return h('div', { className: 'lp-more', ref: wrap },
    h('button', {
      type: 'button', className: 'lp-more-btn', ref: button, 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId,
      onClick: () => setOpen((current) => !current),
    }, '更多', h(Icon, { name: 'chevron', size: 14 })),
    open ? h('div', { className: 'lp-more-pop', role: 'menu', id: menuId, 'aria-label': '更多页面', onKeyDown: onMenuKey },
      ...props.items.map((item) => h('button', {
        key: item.key, type: 'button', role: 'menuitem', className: 'lp-row-btn', 'aria-current': item.key === props.current ? 'page' : undefined,
        onClick: () => { setOpen(false); props.onPick(item.key) },
      }, item.label))) : null)
}

/**
 * The tab row: the primary tabs; while a secondary page is open, a temporary selected tab for it with × back to
 * 总览; and 更多 at the right end.
 */
function TabBar(props: { tab: PageTab; setTab: (tab: PageTab) => void; science: boolean }): React.ReactElement {
  const secondary = SECONDARY.filter((item) => item.key !== 'science' || props.science)
  const value: PageTab = props.tab === 'indicators' ? 'labs' : props.tab
  const primary = TABS.some((item) => item.key === value)
  const extra = primary ? null : secondary.find((item) => item.key === value) ?? null
  const tabs: Array<TabSpec<PageTab>> = extra ? [...TABS, { key: extra.key, label: extra.label }] : TABS
  return h('div', { className: 'lp-tabbar' },
    h(Tabs<PageTab>, { tabs, value, onChange: props.setTab, label: 'LongPi 健康页', idPrefix: 'lp-page' }),
    extra ? h('button', {
      type: 'button', className: 'lp-iconbtn lp-tab-close', 'aria-label': `关闭「${extra.label}」，回到总览`, onClick: () => props.setTab('overview'),
    }, h(Icon, { name: 'close', size: 12 })) : null,
    h(MoreMenu, { items: secondary, current: value, onPick: props.setTab }))
}

function Loading(): React.ReactElement {
  return h('div', { className: 'lp-loading', 'aria-busy': true, 'aria-label': '正在读取' },
    h(Skeleton, { height: 36, width: 320 }),
    h('div', { className: 'lp-grid-2' }, h(Skeleton, { height: 180, className: 'lp-card-skeleton' }), h(Skeleton, { height: 180, className: 'lp-card-skeleton' })),
    h(Skeleton, { height: 120, className: 'lp-card-skeleton' }))
}

function Failed(props: { error: string; onRetry: () => void }): React.ReactElement {
  return h('div', { className: 'lp-card lp-failed', role: 'alert' },
    h('div', { className: 'lp-strong' }, 'LongPi 没有读到数据'),
    h('p', { className: 'lp-muted' }, `服务返回：${props.error}。通常是刚打开，稍等几秒再试。`),
    h(Btn, { variant: 'outline', onClick: props.onRetry }, h(Icon, { name: 'refresh', size: 14 }), '重试'))
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
  const [scienceOn, setScienceOn] = React.useState(true)
  React.useEffect(() => {
    void getJson<{ mode?: string }>('/api/longpi/science/community').then((row) => {
      setScienceOn(row?.mode !== 'off')
    }).catch(() => setScienceOn(true))
  }, [])
  const registered = pageTabs().filter((item) => item.id !== 'science' || scienceOn)
  const [tab, setTabState] = React.useState<PageTab>(storedTab(registered.map((item) => item.id)))
  const [filter, setFilter] = React.useState<IndicatorFilter>('all')
  const [refreshing, setRefreshing] = React.useState(false)
  const [onboarding, setOnboarding] = React.useState(false)

  const setTab = React.useCallback((next: PageTab) => {
    const tab = canonTab(next)
    setTabState(tab)
    writePref(TAB_KEY, tab)
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

  const onConnect = () => goTab('profile', { id: 'lp-connection-card' })

  const onAction = (target: ResultTarget) => {
    if (target === 'records') goTab('profile', { id: 'lp-connection-card' }) // profile stays reachable from 总览
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
    } else if (tab === 'indicators' || tab === 'labs') {
      panel = h(IndicatorsTab, { filter, onFilter: setFilter, onConnect, area: 'labs' })
    } else if (tab === 'sleep') {
      panel = h(SleepTab as React.FC<{ onConnect?: () => void }>, { onConnect })
    } else if (tab === 'training') {
      panel = h(TrainingTab as React.FC<{ onConnect?: () => void }>, { onConnect })
    } else if (tab === 'calendar') {
      panel = h(CalendarTab, { journey })
    } else if (tab === 'ask') {
      panel = h(AskTab, { journey, openChat: props.openChat })
    } else if (tab === 'analysis') {
      panel = h(AnalysisTab, { onNotice: notify })
    } else if (tab === 'plan') {
      panel = h(PlanTab, { journey, tracking: tracking.data, loading: tracking.loading, error: tracking.error, onNotice: notify, onPrompt })
    } else if (tab === 'profile') {
      panel = h(ProfileTab, { journey, onNotice: notify })
    } else {
      const extra = registered.find((item) => item.id === tab)
      panel = extra ? h(extra.Component, { journey, onNotice: notify }) : h(ProfileTab, { journey, onNotice: notify })
    }
    body = h('div', { className: `lp-body ${refreshing ? 'lp-refreshing' : ''}` },
      h(Banner, { journey, onOpen: () => setOnboarding(true) }),
      h(TabBar, { tab, setTab, science: scienceOn }),
      h('div', { className: 'lp-tab-panel', role: 'tabpanel', id: 'lp-page-panel', 'aria-labelledby': `lp-page-tab-${tab}` }, panel))
  }

  return h('div', { className: 'lp lp-page-root', ref: root },
    h('div', { className: 'lp-page' },
      h(Header, { journey, failed: !journey && !loading, refreshing, onRefresh: () => { void doRefresh() } }),
      h(PersonNotice),
      h(DemoInvite, { empty: Boolean(journey) && (journey?.records.indicator_count ?? 0) === 0 }),
      notice ? h('div', { className: 'lp-notice-slot' }, notice) : null,
      journey ? h(SeasonBar, { onOpen: () => setTab('season') }) : null,
      body,
      // One line (#37): the boundary, then where the data stays.
      h('footer', { className: 'lp-footer' },
        h('p', { className: 'lp-caption' }, `${journey?.boundary_zh || BOUNDARY_FALLBACK} 档案和记录只保存在这台电脑上；你同意后，提问时相关健康数值才会发送给 DeepSeek 模型。`))),
    onboarding ? h(Onboarding, { explicit: true, complete: () => setOnboarding(false), openPage: () => {} }) : null)
}
