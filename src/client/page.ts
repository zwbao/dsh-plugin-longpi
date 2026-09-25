// The LongPi page (the 健康 entry in DSH's sidebar). In the first days it
// leads with the journey stepper; after that with the two results, the plan
// and what changed. Profile and self measurements are always one scroll away.

import React from 'react'
import { BOUNDARY_FALLBACK } from './constants.ts'
import { chineseDate, goTo, greeting, localToday, weekday } from './format.ts'
import { Goals, NextSteps } from './goals.ts'
import { Icon } from './icons.ts'
import { RecordsStatusLine } from './journey-steps.ts'
import { MethodsSection } from './methods.ts'
import { Markers, PlanSection } from './plan.ts'
import { ProfileEditor } from './profile-editor.ts'
import { ResultsRow, type ResultTarget } from './results.ts'
import { SelfLatestList, SelfMeasureForm, SelfRecent } from './self-measure.ts'
import { JourneyStepper, openStepOf, stepOf, type StepKey } from './stepper.ts'
import { setPendingPrompt, useBoard, useJourney, usePageShown, useTracking } from './store.ts'
import type { Face, Journey } from './types.ts'
import { Btn, copyText, LinkButton, Section, Skeleton, useNotice } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

function Header(props: { journey: Journey | null; failed: boolean; refreshing: boolean; onRefresh: () => void }): React.ReactElement {
  const journey = props.journey
  const today = journey?.today ?? localToday()
  const name = journey?.profile.displayName.trim() ?? ''
  const late = journey && (journey.stage === 'plan' || journey.stage === 'routine')
  return h('header', { className: 'lp-header' },
    h('div', { className: 'lp-header-text' },
      h('div', { className: 'lp-kicker' }, `LongPi${journey?.version ? ` ${journey.version}` : ''} · 健康`),
      h('h1', { className: 'lp-h1' }, `${greeting(new Date())}${name ? `，${name}` : ''}`),
      h('p', { className: 'lp-lead' },
        `${chineseDate(today)} ${weekday(today)}`,
        late && journey ? ` · ${journey.next.detail_zh}` : ''),
      journey ? h(RecordsStatusLine, { journey }) : props.failed ? null : h(Skeleton, { height: 18, width: 240 })),
    h('div', { className: 'lp-actions' },
      h('button', { type: 'button', className: 'lp-linkbtn', onClick: props.onRefresh, disabled: props.refreshing, 'aria-busy': props.refreshing },
        h(Icon, { name: 'refresh', size: 14, className: props.refreshing ? 'lp-spin' : '' }), props.refreshing ? '刷新中' : '刷新'),
      h(LinkButton, { href: '/api/longpi/report', icon: 'download', download: `longpi-report-${today}.md` }, '导出报告'),
      h(LinkButton, { href: '/api/longpi/calendar.ics', icon: 'calendar', download: 'longpi.ics' }, '加入日历')))
}

function Loading(): React.ReactElement {
  return h('div', { className: 'lp-loading', 'aria-busy': true, 'aria-label': '正在读取' },
    h('div', { className: 'lp-results' }, h(Skeleton, { height: 260, className: 'lp-card-skeleton' }), h(Skeleton, { height: 260, className: 'lp-card-skeleton' })),
    h(Skeleton, { height: 180, className: 'lp-card-skeleton' }))
}

function Failed(props: { error: string; onRetry: () => void }): React.ReactElement {
  return h('div', { className: 'lp-card lp-failed', role: 'alert' },
    h('div', { className: 'lp-strong' }, 'LongPi 没有读到数据'),
    h('p', { className: 'lp-muted' }, `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。`),
    h(Btn, { variant: 'outline', size: 'sm', onClick: props.onRetry }, h(Icon, { name: 'refresh', size: 14 }), '重试'))
}

function ProfileAndSelf(props: { journey: Journey; profileInStepper: boolean; onNotice: Notify; onOpenProfileStep: () => void }): React.ReactElement {
  // One profile form on screen at a time: while the stepper shows 建档, this card points there.
  return h(Section, { id: 'lp-profile-section', title: '档案与自测', kicker: '只保存在这台电脑上' },
    h('div', { className: 'lp-grid-2 lp-grid-top' },
      h('div', { className: 'lp-card', id: 'lp-profile-card' },
        h('div', { className: 'lp-label' }, '档案'),
        props.profileInStepper
          ? h('div', { className: 'lp-pointer' },
            h('p', { className: 'lp-muted' }, props.journey.consent.accepted ? '档案正在上方“建档”这一步填写，填好年龄和性别就能算身体年龄。' : '先在上方读一下说明并点“开始”，然后在同一处填写档案。'),
            h(Btn, { size: 'sm', variant: 'outline', onClick: props.onOpenProfileStep }, '去填写', h(Icon, { name: 'arrow', size: 14 })))
          : h(ProfileEditor, { journey: props.journey, variant: 'page', idPrefix: 'lp-profile', onNotice: props.onNotice })),
      h('div', { className: 'lp-card', id: 'lp-self-card' },
        h('div', { className: 'lp-label' }, '自测', h('span', { className: 'lp-optional' }, '腰围 · 家庭血压 · 体重')),
        h(SelfLatestList, { latest: props.journey.self.latest }),
        h(SelfMeasureForm, { journey: props.journey, idPrefix: 'lp-self', onNotice: props.onNotice }),
        h('p', { className: 'lp-fine' }, '家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。早晚各量一次、每次坐着休息 5 分钟后再量。'),
        h(SelfRecent, { onNotice: props.onNotice }))))
}

export function LongPiPage(props: Partial<Face>): React.ReactElement {
  const root = React.useRef<HTMLDivElement>(null)
  usePageShown(root)
  const { journey, loading, error, refresh } = useJourney()
  const board = useBoard()
  const tracking = useTracking()
  const [notice, notify] = useNotice()
  const [openStep, setOpenStep] = React.useState<StepKey | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const stage = journey?.stage
  const early = stage != null && stepOf(stage) < 3

  React.useEffect(() => { setOpenStep(null) }, [stage])

  const doRefresh = React.useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh(true)
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  const onAction = (target: ResultTarget) => {
    if (early && (target === 'profile' || target === 'records' || target === 'addons')) {
      setOpenStep(target === 'addons' ? 'first_result' : target)
      goTo('lp-stepper')
      return
    }
    goTo(target === 'self' ? 'lp-self-card' : target === 'profile' ? 'lp-profile-card' : 'lp-results')
  }

  // The chat's composer dock picks the prompt up and inserts it; the clipboard
  // copy is the fallback when no composer is on screen to take it.
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
    const trackingData = tracking.data
    const showPlan = journey.plan.exists || stage === 'plan' || stage === 'routine'
    body = h('div', { className: `lp-body ${refreshing ? 'lp-refreshing' : ''}` },
      early ? h(JourneyStepper, { journey, open: openStep, onOpen: setOpenStep, onRecheck: doRefresh, onNotice: notify }) : null,
      h(ResultsRow, { journey, tracking: trackingData, canShowAddons: early, onAction, onNotice: notify }),
      showPlan ? h(PlanSection, { journey, tracking: trackingData, loading: tracking.loading, onNotice: notify, onPrompt }) : null,
      showPlan ? h(Markers, { tracking: trackingData }) : null,
      showPlan ? h(Goals, { tracking: trackingData }) : null,
      showPlan ? h(NextSteps, { tracking: trackingData }) : null,
      h(ProfileAndSelf, { journey, profileInStepper: early && openStepOf(journey, openStep) === 'profile', onNotice: notify, onOpenProfileStep: () => { setOpenStep('profile'); goTo('lp-stepper') } }),
      h(MethodsSection, { board: board.data, loading: board.loading, error: board.error, onNotice: notify }))
  }

  return h('div', { className: 'lp lp-page-root', ref: root },
    h('div', { className: 'lp-page' },
      h(Header, { journey, failed: !journey && !loading, refreshing, onRefresh: () => { void doRefresh() } }),
      notice ? h('div', { className: 'lp-notice-slot' }, notice) : null,
      body,
      h('footer', { className: 'lp-footer' },
        h('p', null, journey?.boundary_zh || BOUNDARY_FALLBACK),
        h('p', { className: 'lp-caption' }, '档案、方案、打卡和自测只保存在这台电脑上，病历在你自己的 Mirobody 中；只有对话内容会发送给 DeepSeek 模型处理。'))))
}
