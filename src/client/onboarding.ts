// LongPi's step in DSH's first-run onboarding: four short screens in DSH's own
// modal. 告知 records informed consent (or is postponed), 建档 asks only what
// unlocks a result, 连接记录 checks Mirobody, 第一个结果 shows what the server
// computed. Nothing to do (consent given, profile complete) → complete() at once.

import React from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { errorText } from './api.ts'
import { acceptConsent, ConsentText, FirstResult, RecordsGuide } from './journey-steps.ts'
import { ProfileEditor } from './profile-editor.ts'
import { useJourney } from './store.ts'
import type { Face } from './types.ts'
import { Btn, Skeleton, useNotice } from './ui.ts'

const h = React.createElement

const TITLES = ['欢迎使用 LongPi', '建立档案', '连接体检记录', '第一个结果'] as const
const NOOP = () => {}

export interface OnboardingProps extends Partial<Face> {
  stepId?: string
  /** Opened on purpose (from settings), not at first run: start at the profile. */
  explicit?: boolean
  complete: () => void
  openSection?: (id: string) => void
  /** Preview only: open at a given step without faking server state. */
  initialStep?: number
}

function Dots(props: { step: number }): React.ReactElement {
  return h('div', { className: 'lp-onb-progress' },
    h('ol', { className: 'lp-dots', 'aria-hidden': true },
      ...TITLES.map((_, index) => h('li', { key: index, className: `lp-dot-step ${index === props.step ? 'lp-dot-now' : index < props.step ? 'lp-dot-past' : ''}` }))),
    h('span', { className: 'lp-caption' }, `第 ${props.step + 1} 步，共 ${TITLES.length} 步`))
}

/** DSH's own onboarding dialogs keep the app root inert while they are up. */
function useInertRoot(): void {
  React.useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return undefined
    const previous = root.inert
    root.inert = true
    return () => { root.inert = previous }
  }, [])
}

function useAutofocus(ref: React.RefObject<HTMLDivElement>, step: number, ready: boolean): void {
  React.useEffect(() => {
    if (!ready) return
    const node = ref.current?.querySelector<HTMLElement>('[data-modal-autofocus]') ?? ref.current?.querySelector<HTMLElement>('h2')
    node?.focus({ preventScroll: true })
  }, [step, ready])
}

export function Onboarding(props: OnboardingProps): React.ReactElement | null {
  const { journey, refresh } = useJourney()
  const [step, setStep] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [computing, setComputing] = React.useState(false)
  const [notice, notify] = useNotice()
  const decided = React.useRef(false)
  const content = React.useRef<HTMLDivElement>(null)
  const { complete } = props

  React.useEffect(() => {
    if (decided.current || !journey) return
    decided.current = true
    if (props.initialStep != null) {
      setStep(Math.max(0, Math.min(3, props.initialStep)))
      return
    }
    if (props.explicit) {
      setStep(1)
      return
    }
    if (journey.consent.accepted && journey.profile.complete) {
      complete()
      return
    }
    setStep(journey.consent.accepted ? 1 : 0)
  }, [journey, complete])

  const go = React.useCallback((next: number) => {
    setError(null)
    setStep(next)
    if (next === 3) {
      setComputing(true)
      void refresh(true).finally(() => setComputing(false))
    }
  }, [refresh])

  useAutofocus(content, step ?? -1, step != null && !!journey)
  if (step == null || !journey) return null
  return h(OnboardingModal, { title: TITLES[step] ?? TITLES[0] },
    h('div', { className: 'lp lp-onb', ref: content },
      h(Dots, { step }),
      h('h2', { className: 'lp-onb-title', tabIndex: -1 }, TITLES[step]),
      step === 0 ? h('div', { className: 'lp-onb-body' },
        h(ConsentText),
        error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { variant: 'outline', onClick: complete, disabled: busy }, '以后再说'),
          h(Btn, {
            'data-modal-autofocus': true, disabled: busy,
            onClick: () => {
              setBusy(true)
              acceptConsent()
                .then(() => go(1))
                .catch((err: unknown) => setError(`没有记下：${errorText(err, '请稍后再试')}`))
                .finally(() => setBusy(false))
            },
          }, busy ? '记录中…' : '开始'))) : null,
      step === 1 ? h('div', { className: 'lp-onb-body' },
        h('p', { className: 'lp-onb-lead' }, '只问能解锁结果的问题。每一项都可以跳过，跳过就是“不知道”，不会当作“否”。'),
        h(ProfileEditor, { journey, variant: 'onboarding', idPrefix: 'lp-onb-profile', onSaved: () => go(2), onSkip: () => go(2) })) : null,
      step === 2 ? h('div', { className: 'lp-onb-body' },
        h(RecordsGuide, { journey, onRecheck: () => refresh(true) }),
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { variant: 'outline', onClick: () => go(1) }, '上一步'),
          h(Btn, { 'data-modal-autofocus': true, onClick: () => go(3) }, journey.records.status === 'ok' ? '继续' : '先跳过'))) : null,
      step === 3 ? h('div', { className: 'lp-onb-body' },
        computing
          ? h('div', { className: 'lp-onb-computing', 'aria-busy': true },
            h(Skeleton, { height: 88 }), h('p', { className: 'lp-caption' }, '正在用你的记录计算…'))
          : h(FirstResult, { journey, onNotice: notify, idPrefix: 'lp-onb-result', showResults: true }),
        notice,
        h('p', { className: 'lp-fine' }, journey.boundary_zh),
        h('div', { className: 'lp-modal-actions' },
          h(Btn, { variant: 'outline', onClick: complete }, '完成'),
          h(Btn, {
            'data-modal-autofocus': true,
            onClick: () => { props.openPage?.(); complete() },
          }, '打开健康页'))) : null))
}

function OnboardingModal(props: { title: string; children?: React.ReactNode }): React.ReactElement {
  useInertRoot()
  // Escape and the mask do nothing: consent is given or postponed with a button, never by accident.
  return h(Modal, { open: true, title: props.title, onClose: NOOP, headless: true, className: 'lp-onb-dialog' }, props.children)
}
