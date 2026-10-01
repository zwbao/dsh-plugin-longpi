// LongPi's onboarding (copy v2, docs/onboarding-copy-v2.md): three short screens, written for someone who has
// nothing yet. 欢迎使用 LongPi says what LongPi is and records one consent (the product notice, the health-data
// consent and the data flow to DeepSeek, with one checkbox that is never pre-ticked); 填写基本信息 asks age and
// sex; 添加第一份资料 uploads a checkup report, or says what can be done without one.
//
// Opened from the 健康 page only (never from DSH's own first run) and never locks DSH: Escape or a click
// outside puts it off, and nothing is agreed to that way. The connection to the health-data service is made by
// the plugin itself, so no address, email or password appears here.

import React from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { errorText, postJson } from './api.ts'
import { ReportUpload } from './datain/upload.ts'
import { acceptConsent } from './journey-steps.ts'
import { useModelStatus } from './model-status.ts'
import { recordConnected } from './normalize.ts'
import { notifyChanged, setSettingsOpener, useJourney, useSettingsOpener } from './store.ts'
import type { Face, Journey, Stage } from './types.ts'
import { Btn } from './ui.ts'
import { Icon } from './icons.ts'

const h = React.createElement

export const ONBOARDING_TITLES = ['欢迎使用 LongPi', '填写基本信息', '添加第一份资料'] as const
/** Short names for the stepper, so step 1 does not repeat the dialog title. */
const STEP_NAMES = ['开始', '基本信息', '第一份资料'] as const
/** A journey that has not arrived by then is shown as not read, with a retry. */
const GIVE_UP_MS = 45_000

export interface OnboardingProps extends Partial<Face> {
  stepId?: string
  /** Opened from the page's banner: start where the person stands. */
  explicit?: boolean
  complete: () => void
  openSection?: (id: string) => void
  /** Preview only: open at a given step without faking server state. */
  initialStep?: number
}

/** The step a stage starts at. */
export function stepOfStage(stage: Stage): number {
  if (stage === 'consent') return 0
  if (stage === 'profile') return 1
  return 2
}

/** Steps still open, for the page banner (none once a record exists). */
export function stepsLeft(journey: Journey): number {
  if (!journey.consent.accepted) return 3
  if (!journey.profile.complete) return 2
  return recordConnected(journey.records.status) && journey.records.indicator_count > 0 ? 0 : 1
}

function Progress(props: { step: number }): React.ReactElement {
  return h('div', { className: 'lp-stepper', 'aria-label': `第 ${props.step + 1} 步，共 ${ONBOARDING_TITLES.length} 步` },
    ...STEP_NAMES.map((title, index) => h('div', {
      key: index,
      className: `lp-stepper-item${index === props.step ? ' is-now' : index < props.step ? ' is-done' : ''}`,
    },
    h('span', { className: 'lp-stepper-dot' }, index < props.step ? h(Icon, { name: 'check', size: 12 }) : String(index + 1)),
    h('span', { className: 'lp-stepper-label' }, title))))
}

/** Chat needs a model key: said only when LongPi could tell none is configured. */
function ModelHint(props: { onOpen: (() => void) | null }): React.ReactElement | null {
  const status = useModelStatus()
  if (status !== 'missing') return null
  return h('div', { className: 'lp-callout lp-callout-info', role: 'note' },
    h(Icon, { name: 'info', size: 16 }),
    h('div', { className: 'lp-callout-body' },
      h('p', null, '对话功能需要先在 DSH 设置里填写模型的 API Key。'),
      props.onOpen ? h(Btn, { size: 'sm', variant: 'outline', onClick: props.onOpen }, '去设置') : h('p', { className: 'lp-caption' }, '在左下角「设置 → 模型」中填写。')))
}

function NotRead(props: { onRetry: () => void; onLater: () => void; busy: boolean }): React.ReactElement {
  return h(OnboardingModal, { title: '数据暂时没有加载出来', onClose: props.onLater },
    h('div', { className: 'lp lp-onb' },
      h('h2', { className: 'lp-onb-title', tabIndex: -1 }, '数据暂时没有加载出来'),
      h('p', { className: 'lp-onb-text' }, '可能是刚启动，稍等几秒后点「重试」。'),
      h('div', { className: 'lp-onb-actions' },
        h(Btn, { variant: 'outline', onClick: props.onLater }, '稍后再说'),
        h(Btn, { 'data-modal-autofocus': true, onClick: props.onRetry, disabled: props.busy }, props.busy ? '加载中…' : '重试'))))
}

/** One consent covers the notice, the health-data act and the flow to DeepSeek (owner decision, copy v2). */
async function agreeAll(): Promise<void> {
  await acceptConsent()
  await postJson('/api/longpi/privacy/consent', { scope: 'pipl_sensitive', decision: 'granted' })
  await postJson('/api/longpi/privacy/consent', { scope: 'data_flow_deepseek', decision: 'granted' })
  notifyChanged()
}

function Welcome(props: { onDone: () => void; onLater: () => void; openSettings: (() => void) | null }): React.ReactElement {
  const [agreed, setAgreed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  return h('div', { className: 'lp-onb-body' },
    h(ModelHint, { onOpen: props.openSettings }),
    h('p', { className: 'lp-onb-text' }, 'LongPi 帮你管理自己的健康数据：根据体检结果估算身体年龄和 10 年心血管风险，并跟踪你的改善计划执行得怎么样。'),
    h('p', { className: 'lp-onb-text' }, '它只提供健康管理参考，不做诊断，不开处方，也不给出用药剂量。'),
    h('p', { className: 'lp-onb-text' }, '你的档案和记录只保存在这台电脑上。你提问时，回答所需的健康数值会发送给 DeepSeek 模型处理，不包含你的姓名。'),
    h('label', { className: 'lp-checkrow', htmlFor: 'lp-onb-agree' },
      h('input', { id: 'lp-onb-agree', type: 'checkbox', checked: agreed, disabled: busy, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAgreed(e.target.checked) }),
      h('span', null, '我同意 LongPi 按上述方式使用我的体检、化验、血压、血糖、体重和用药等健康信息。')),
    h('p', { className: 'lp-caption' }, '可以随时在「设置 → LongPi → 数据与隐私」中撤回。'),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-onb-actions' },
      h(Btn, { variant: 'outline', onClick: props.onLater, disabled: busy }, '以后再说'),
      h(Btn, {
        'data-modal-autofocus': true, disabled: !agreed || busy,
        onClick: () => {
          setBusy(true)
          setError('')
          agreeAll().then(props.onDone).catch((err: unknown) => setError(`没有保存成功：${errorText(err, '请稍后再试')}`)).finally(() => setBusy(false))
        },
      }, busy ? '正在保存…' : '同意并开始')))
}

function BasicInfo(props: { journey: Journey; onDone: () => void; onSkip: () => void }): React.ReactElement {
  const [age, setAge] = React.useState(props.journey.profile.age != null ? String(props.journey.profile.age) : '')
  const [sex, setSex] = React.useState<'male' | 'female' | ''>(props.journey.profile.sex === 'male' || props.journey.profile.sex === 'female' ? props.journey.profile.sex : '')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const ageNum = Number(age)
  const ageOk = /^\d{1,3}$/.test(age.trim()) && ageNum >= 1 && ageNum <= 120
  return h('div', { className: 'lp-onb-body' },
    h('p', { className: 'lp-onb-text' }, '计算身体年龄需要你的年龄和性别。'),
    h('div', { className: 'lp-form-grid' },
      h('label', { className: 'lp-field' },
        h('span', { className: 'lp-field-label' }, '年龄（周岁）'),
        h('input', {
          className: 'lp-input', inputMode: 'numeric', placeholder: '例如 45', value: age, disabled: busy, 'data-modal-autofocus': true,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 3)),
        })),
      h('div', { className: 'lp-field' },
        h('span', { className: 'lp-field-label', id: 'lp-onb-sex' }, '性别'),
        h('div', { className: 'lp-seg', role: 'radiogroup', 'aria-labelledby': 'lp-onb-sex' },
          ...(['male', 'female'] as const).map((value) => h('button', {
            key: value, type: 'button', role: 'radio', 'aria-checked': sex === value, disabled: busy,
            className: `lp-seg-item${sex === value ? ' is-on' : ''}`, onClick: () => setSex(value),
          }, value === 'male' ? '男' : '女'))))),
    h('p', { className: 'lp-caption' }, '其他问题（如是否吸烟、有无糖尿病）会在计算心血管风险需要时再问。'),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-onb-actions' },
      h(Btn, { variant: 'outline', onClick: props.onSkip, disabled: busy }, '跳过'),
      h(Btn, {
        disabled: !ageOk || !sex || busy,
        onClick: () => {
          setBusy(true)
          setError('')
          postJson('/api/longpi/profile', { age: ageNum, sex })
            .then(() => { notifyChanged(); props.onDone() })
            .catch((err: unknown) => setError(`没有保存成功：${errorText(err, '请稍后再试')}`))
            .finally(() => setBusy(false))
        },
      }, busy ? '正在保存…' : '下一步')))
}

function FirstData(props: { onFinish: () => void; openChat: () => void }): React.ReactElement {
  const [none, setNone] = React.useState(false)
  const [read, setRead] = React.useState('')
  return h('div', { className: 'lp-onb-body' },
    h('p', { className: 'lp-onb-text' }, '上传一份体检或化验报告，LongPi 会读取其中的指标，算出你的第一个结果。'),
    h(ReportUpload, { simple: true, onDone: (text: string) => { setRead(text || '已读取这份报告。'); notifyChanged() } }),
    !read && !none ? h('div', { className: 'lp-onb-center' }, h('button', { type: 'button', className: 'lp-textbtn', onClick: () => setNone(true) }, '我现在没有报告')) : null,
    none && !read ? h('div', { className: 'lp-callout lp-callout-info' },
      h(Icon, { name: 'info', size: 16 }),
      h('div', { className: 'lp-callout-body' },
        h('p', { className: 'lp-callout-title' }, '没有报告也可以先开始：'),
        h('ul', { className: 'lp-bullets' },
          h('li', null, '记录一次血压或腰围'),
          h('li', null, '在健康对话里说说你想改善什么（睡眠、体重、血糖……）')),
        h('p', { className: 'lp-caption' }, '以后拿到体检报告，随时在「健康」页上传。'))) : null,
    h('div', { className: 'lp-onb-actions' },
      none && !read ? h(Btn, { variant: 'outline', onClick: props.openChat }, '去健康对话') : null,
      h(Btn, { onClick: props.onFinish }, '完成')))
}

export function Onboarding(props: OnboardingProps): React.ReactElement | null {
  const { journey, error: loadError, loading, refresh } = useJourney()
  const [step, setStep] = React.useState<number | null>(null)
  const [timedOut, setTimedOut] = React.useState(false)
  const [retrying, setRetrying] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const content = React.useRef<HTMLDivElement>(null)
  const storedOpener = useSettingsOpener()
  const openSection = props.openSection ?? storedOpener
  React.useEffect(() => { if (props.openSection) setSettingsOpener(props.openSection) }, [props.openSection])

  const finish = React.useCallback(() => {
    setDone(true)
    props.complete()
  }, [props])

  React.useEffect(() => {
    if (step != null || !journey) return
    if (props.initialStep != null) setStep(Math.max(0, Math.min(2, props.initialStep)))
    else setStep(ONBOARDING_TITLES.length - Math.max(1, stepsLeft(journey)))
  }, [journey, step, props.initialStep])

  React.useEffect(() => {
    if (journey || timedOut) return undefined
    const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [journey, timedOut])

  React.useEffect(() => {
    const node = content.current?.querySelector<HTMLElement>('[data-modal-autofocus]') ?? content.current?.querySelector<HTMLElement>('h2')
    node?.focus({ preventScroll: true })
  }, [step])

  if (done) return null
  if (!journey) {
    if (!timedOut && !retrying && !(loadError && !loading)) return null
    return h(NotRead, {
      onRetry: () => { setRetrying(true); setTimedOut(false); void refresh(true).finally(() => setRetrying(false)) },
      onLater: finish,
      busy: retrying || loading,
    })
  }
  if (step == null) return null
  const openSettings = openSection ? () => { finish(); openSection('models') } : null
  const openChat = () => {
    finish()
    document.querySelector<HTMLButtonElement>('.lp-healthchat-btn')?.click()
  }

  return h(OnboardingModal, { title: ONBOARDING_TITLES[step] ?? ONBOARDING_TITLES[0], onClose: finish },
    h('div', { className: 'lp lp-onb', ref: content },
      h(Progress, { step }),
      h('h2', { className: 'lp-onb-title', tabIndex: -1 }, ONBOARDING_TITLES[step]),
      step === 0 ? h(Welcome, { onDone: () => setStep(1), onLater: finish, openSettings }) : null,
      step === 1 ? h(BasicInfo, { journey, onDone: () => setStep(2), onSkip: () => setStep(2) }) : null,
      step === 2 ? h(FirstData, { onFinish: finish, openChat }) : null))
}

function OnboardingModal(props: { title: string; onClose: () => void; children?: React.ReactNode }): React.ReactElement {
  return h(Modal, { open: true, title: props.title, onClose: props.onClose, headless: true, className: 'lp-onb-dialog' }, props.children)
}
