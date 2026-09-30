// LongPi's onboarding, the one flow: four short screens in DSH's own modal.
// 欢迎 records informed consent (or is postponed) and says when chat needs a
// model key first, 建档 asks only what unlocks a result, 连接记录 shows what
// the record holds (or takes the Mirobody address right there), 第一个结果
// shows what the server computed, or what can be done now when it cannot.
// DSH mounts it at first run; the page mounts the same component (explicit)
// from its "还差 N 步" banner. Nothing to do (consent given, profile complete)
// → complete() at once. A journey that fails, or has not arrived in 45 s,
// shows a retry with 稍后再说: the step never completes silently.

import React from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { errorText, getJson } from './api.ts'
import { deepseekConsentPending } from '../privacy/pending.ts'
import { acceptConsent, ConsentText, FirstResult, RecordsStep } from './journey-steps.ts'
import { useModelStatus } from './model-status.ts'
import { recordConnected } from './normalize.ts'
import { DRAFT_PROMPT } from './plan-draft.ts'
import { ProfileEditor } from './profile-editor.ts'
import { DataPage } from './privacy/data-page.ts'
import { SensitiveConsentScreen } from './privacy/consent-screen.ts'
import { requestView, setPendingPrompt, setSettingsOpener, useJourney, useSettingsOpener } from './store.ts'
import type { Face, Stage } from './types.ts'
import { Btn, Skeleton, useNotice } from './ui.ts'
import { Icon } from './icons.ts'

const h = React.createElement

export const ONBOARDING_TITLES = ['先放进一份报告', '看看这份报告', '第一个结果', '一起研究'] as const
const NOOP = () => {}
/** A journey that has not arrived by then is shown as not read, with a retry. */
const GIVE_UP_MS = 45_000

export interface OnboardingProps extends Partial<Face> {
  stepId?: string
  /** Opened on purpose (from the page's banner), not at first run: start where the person stands. */
  explicit?: boolean
  complete: () => void
  openSection?: (id: string) => void
  /** Preview only: open at a given step without faking server state. */
  initialStep?: number
}

/** The step a stage starts at when onboarding is opened on purpose. */
export function stepOfStage(stage: Stage): number {
  if (stage === 'consent') return 0
  if (stage === 'records' || stage === 'profile') return 1
  return 2
}

function Dots(props: { step: number }): React.ReactElement {
  return h('div', { className: 'lp-onb-progress' },
    h('ol', { className: 'lp-dots', 'aria-hidden': true },
      ...ONBOARDING_TITLES.map((_, index) => h('li', { key: index, className: `lp-dot-step ${index === props.step ? 'lp-dot-now' : index < props.step ? 'lp-dot-past' : ''}` }))),
    h('span', { className: 'lp-caption' }, `第 ${props.step + 1} 步，共 ${ONBOARDING_TITLES.length} 步`))
}

/** DSH's own onboarding dialogs keep the app root inert while they are up. */
function useAutofocus(ref: React.RefObject<HTMLDivElement>, step: number, ready: boolean): void {
  React.useEffect(() => {
    if (!ready) return
    const node = ref.current?.querySelector<HTMLElement>('[data-modal-autofocus]') ?? ref.current?.querySelector<HTMLElement>('h2')
    node?.focus({ preventScroll: true })
  }, [step, ready])
}

/** DSH's complete(), guarded so it runs once however many buttons and effects reach it. */
function useCompleteOnce(complete: () => void): { done: boolean; finish: () => void } {
  const latest = React.useRef(complete)
  latest.current = complete
  const [done, setDone] = React.useState(false)
  const called = React.useRef(false)
  const finish = React.useCallback(() => {
    if (called.current) return
    called.current = true
    setDone(true)
    latest.current()
  }, [])
  return { done, finish }
}

/** Step 1: chat needs a model. Shown only when LongPi could tell no key is configured. */
function ModelHint(props: { onOpen: (() => void) | null }): React.ReactElement | null {
  const status = useModelStatus()
  if (status !== 'missing') return null
  return h('div', { className: 'lp-onb-hint', role: 'note' },
    h(Icon, { name: 'info', size: 15 }),
    h('span', null, '对话需要先在设置里填 DeepSeek API Key。'),
    props.onOpen ? h(Btn, { size: 'sm', variant: 'outline', onClick: props.onOpen }, '去设置') : h('span', { className: 'lp-caption' }, '在左下角“设置 → 模型”中填写。'))
}

/** The journey did not arrive: say so, offer a retry, and let the person move on. */
function NotRead(props: { error: string | null; onRetry: () => void; onLater: () => void; busy: boolean }): React.ReactElement {
  return h(OnboardingModal, { title: '没有读到 LongPi 的数据', onClose: props.onLater },
    h('div', { className: 'lp lp-onb' },
      h('h2', { className: 'lp-onb-title', tabIndex: -1 }, '暂时没有读到 LongPi 的数据'),
      h('p', { className: 'lp-muted' }, props.error
        ? `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。`
        : '读取比平时慢。可以再试一次，或者先去对话，稍后在健康页继续。'),
      h('div', { className: 'lp-modal-actions' },
        h(Btn, { variant: 'outline', onClick: props.onLater }, '稍后再说'),
        h(Btn, { 'data-modal-autofocus': true, onClick: props.onRetry, disabled: props.busy }, props.busy ? '读取中…' : '重试'))))
}

export function Onboarding(props: OnboardingProps): React.ReactElement | null {
  const { journey, error: loadError, loading, refresh } = useJourney()
  const [step, setStep] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [privacyOpen, setPrivacyOpen] = React.useState(false)
  /** undefined while the consent file is still loading. null means no DeepSeek decision yet. */
  const [flowDecision, setFlowDecision] = React.useState<string | null | undefined>(undefined)
  const [computing, setComputing] = React.useState(false)
  const [timedOut, setTimedOut] = React.useState(false)
  const [retrying, setRetrying] = React.useState(false)
  const [notice, notify] = useNotice()
  const decided = React.useRef(false)
  const content = React.useRef<HTMLDivElement>(null)
  const { done, finish } = useCompleteOnce(props.complete)
  const storedOpener = useSettingsOpener()
  const openSection = props.openSection ?? storedOpener

  // DSH hands openSection to onboarding only; keep it for the page and the chat.
  React.useEffect(() => { setSettingsOpener(props.openSection) }, [props.openSection])

  React.useEffect(() => {
    let live = true
    void getJson<{ consents?: { data_flow_deepseek?: { decision?: string | null } } }>('/api/longpi/privacy').then((row) => {
      if (live) setFlowDecision(row?.consents?.data_flow_deepseek?.decision ?? null)
    }).catch(() => { if (live) setFlowDecision(null) })
    return () => { live = false }
  }, [])

  React.useEffect(() => {
    if (decided.current || !journey || flowDecision === undefined) return
    decided.current = true
    if (props.initialStep != null) {
      setStep(Math.max(0, Math.min(3, props.initialStep)))
      return
    }
    // 开始 records only the product notice. A refresh must still show the DeepSeek sheet
    // until that decision exists. Health numbers do not leave before a grant.
    if (journey.consent.accepted && deepseekConsentPending(flowDecision)) {
      setPrivacyOpen(true)
      setStep(0)
      return
    }
    if (props.explicit) {
      setStep(stepOfStage(journey.stage))
      return
    }
    if (journey.consent.accepted && journey.profile.complete) {
      finish()
      return
    }
    setStep(journey.consent.accepted ? 1 : 0)
  }, [journey, finish, flowDecision, props.initialStep, props.explicit])

  React.useEffect(() => {
    if (journey || timedOut) return undefined
    const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [journey, timedOut])

  const go = React.useCallback((next: number) => {
    setError(null)
    setStep(next)
    if (next === 3) {
      setComputing(true)
      void refresh(true).finally(() => setComputing(false))
    }
  }, [refresh])

  const retry = React.useCallback(() => {
    setRetrying(true)
    setTimedOut(false)
    void refresh(true).finally(() => setRetrying(false))
  }, [refresh])

  useAutofocus(content, step ?? -1, step != null && !!journey && !done)
  if (done) return null
  if (!journey) {
    // Still loading within the grace period: show and block nothing. A retry keeps the screen, busy.
    if (!timedOut && !retrying && !(loadError && !loading)) return null
    return h(NotRead, { error: loadError, onRetry: retry, onLater: finish, busy: retrying || loading })
  }
  if (step == null) return null

  const toPage = (view: Parameters<typeof requestView>[0]) => {
    requestView(view)
    props.openPage?.()
    finish()
  }
  const toSettings = openSection ? () => { finish(); openSection('models') } : null
  const actions = {
    onDraft: () => {
      if (props.openPage || props.explicit) toPage({ tab: 'plan', id: 'lp-plan' })
      else {
        setPendingPrompt(DRAFT_PROMPT, 'hero')
        finish()
      }
    },
    onAddons: () => toPage({ tab: 'profile', id: 'lp-addons-card' }),
  }

  return h(OnboardingModal, { title: ONBOARDING_TITLES[step] ?? ONBOARDING_TITLES[0], onClose: finish },
    h('div', { className: 'lp lp-onb', ref: content },
      h(Dots, { step }),
      h('h2', { className: 'lp-onb-title', tabIndex: -1 }, ONBOARDING_TITLES[step]),
      privacyOpen ? h('div', { className: 'lp-onb-body' },
        h('p', { className: 'lp-onb-lead' }, '下面两件事分开记，都没有预先勾选，也不是刚才的产品说明。'),
        h(SensitiveConsentScreen, {}),
        h(DataPage, { onDecided: (decision: 'granted' | 'declined') => { if (decision) setFlowDecision(decision) } }),
        h('div', { className: 'lp-modal-actions' },
          h(Btn, {
            disabled: deepseekConsentPending(flowDecision),
            onClick: () => {
              if (deepseekConsentPending(flowDecision)) return
              setPrivacyOpen(false)
              go(1)
            },
          }, deepseekConsentPending(flowDecision) ? '请先选择是否发给 DeepSeek' : '继续填写档案'))) : null,
      !privacyOpen && step === 0 ? h('div', { className: 'lp-onb-body' },
        h(ModelHint, { onOpen: toSettings }),
        h(ConsentText),
        error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { variant: 'outline', onClick: finish, disabled: busy }, '以后再说'),
          h(Btn, {
            'data-modal-autofocus': true, disabled: busy,
            onClick: () => {
              setBusy(true)
              acceptConsent()
                .then(() => go(1))
                .catch((err: unknown) => setError(`没有记下：${errorText(err, '请稍后再试')}`))
                .finally(() => setBusy(false))
            },
          }, busy ? '记录中…' : '先看报告'))) : null,
      step === 1 ? h('div', { className: 'lp-onb-body' },
        h('p', { className: 'lp-onb-lead' }, '先看已经放进来的体检。缺的问题可以等结果需要时再答，不知道就跳过。'),
        h(RecordsStep, { journey, onOpenChanges: props.openPage || props.explicit ? () => toPage({ tab: 'overview', id: 'lp-changes' }) : undefined }),
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { variant: 'outline', onClick: () => go(0) }, '上一步'),
          h(Btn, { 'data-modal-autofocus': true, onClick: () => go(2) }, recordConnected(journey.records.status) ? '看第一个结果' : '先跳过'))) : null,
      step === 2 ? h('div', { className: 'lp-onb-body' },
        journey.profile.age == null || (journey.profile.sex !== 'male' && journey.profile.sex !== 'female')
          ? h(React.Fragment, null,
            h('p', { className: 'lp-onb-lead' }, '算这个结果还缺一项。不知道可以跳过，不会当成“否”。'),
            h(ProfileEditor, { journey, variant: 'onboarding', idPrefix: 'lp-onb-profile', onSaved: () => go(2), onSkip: () => go(3) }))
          : null,
        computing
          ? h('div', { className: 'lp-onb-computing', 'aria-busy': true },
            h(Skeleton, { height: 88 }), h('p', { className: 'lp-caption' }, '正在用你的记录计算…'))
          : h(FirstResult, { journey, onNotice: notify, actions }),
        notice,
        h('p', { className: 'lp-fine' }, journey.boundary_zh),
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { variant: 'outline', onClick: () => go(1) }, '上一步'),
          h(Btn, { onClick: () => go(3) }, '继续'))) : null,
      step === 3 ? h('div', { className: 'lp-onb-body' },
        h('p', { className: 'lp-onb-lead' }, 'LongPi 的用户在一起研究怎样延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。加入要你自己再点一次，没有预先勾上。'),
        h('p', { className: 'lp-caption' }, '研究正式开始后才会发出，现在只保存在你的设备上。'),
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { onClick: () => { props.openPage?.(); finish() } }, '加入'),
          h(Btn, { variant: 'outline', onClick: finish }, '以后再说'))) : null))
}

function OnboardingModal(props: { title: string; onClose: () => void; children?: React.ReactNode }): React.ReactElement {
  // Opened from the 健康 page only, and never locks DSH: Escape or a click outside puts it off (以后再说), and
  // nothing is agreed to that way.
  return h(Modal, { open: true, title: props.title, onClose: props.onClose, headless: true, className: 'lp-onb-dialog' }, props.children)
}
