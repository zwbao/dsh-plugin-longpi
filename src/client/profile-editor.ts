// The profile questions, shared by onboarding step 2 and the page's 档案 card.
// Only questions that unlock a result are asked. Every one can be skipped, and
// 不确定 is saved as unknown (the fact is cleared), never as "no".

import React from 'react'
import { errorText, postJson } from './api.ts'
import { FOCUS_FALLBACK, RISK_FACTS } from './constants.ts'
import { Icon } from './icons.ts'
import { notifyChanged } from './store.ts'
import type { Focus, Journey, JourneyQuestion, RiskFact, Sex } from './types.ts'
import { Btn, Segmented, ToggleChip } from './ui.ts'

const h = React.createElement

type Answer = 'yes' | 'no' | 'unsure' | ''

const ANSWERS: Array<{ value: Exclude<Answer, ''>; label: string }> = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
  { value: 'unsure', label: '不确定' },
]

interface Draft {
  displayName: string
  age: string
  sex: Sex
  risk: Partial<Record<RiskFact, Answer>>
  focus: Focus[]
}

function draftOf(journey: Journey | null): Draft {
  const profile = journey?.profile
  const risk: Partial<Record<RiskFact, Answer>> = {}
  for (const [key, value] of Object.entries(profile?.risk ?? {})) risk[key as RiskFact] = value ? 'yes' : 'no'
  return {
    displayName: profile?.displayName ?? '',
    age: profile?.age == null ? '' : String(profile.age),
    sex: profile?.sex ?? 'unknown',
    risk,
    focus: [...(profile?.focus ?? [])],
  }
}

function factQuestions(journey: Journey | null): JourneyQuestion[] {
  const fromServer = (journey?.profile.questions ?? []).filter((row) => row.key !== 'age' && row.key !== 'sex')
  if (fromServer.length > 0) return fromServer
  return RISK_FACTS.map((row) => ({ key: row.key, label_zh: row.zh, unlocks_zh: '心血管风险', answered: false, men_only: row.menOnly }))
}

function unlockOf(journey: Journey | null, key: 'age' | 'sex'): string {
  return journey?.profile.questions.find((row) => row.key === key)?.unlocks_zh || '身体年龄、心血管风险'
}

function parseAge(text: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, value: null }
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < 0 || value > 130) return { ok: false }
  return { ok: true, value }
}

export function ProfileEditor(props: {
  journey: Journey | null
  variant: 'onboarding' | 'page'
  idPrefix: string
  onSaved?: () => void
  onSkip?: () => void
  onNotice?: (text: string, tone?: 'info' | 'good' | 'bad') => void
}): React.ReactElement {
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(props.journey))
  const [dirty, setDirty] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const serverProfile = JSON.stringify(props.journey?.profile ?? null)

  // Follow the saved profile until the person starts editing.
  React.useEffect(() => {
    if (!dirty) setDraft(draftOf(props.journey))
  }, [serverProfile])

  const edit = (patch: Partial<Draft>) => {
    setDirty(true)
    setError(null)
    setDraft((current) => ({ ...current, ...patch }))
  }
  const ageCheck = parseAge(draft.age)
  const facts = factQuestions(props.journey)
  const focusOptions = props.journey?.focus_options?.length ? props.journey.focus_options : FOCUS_FALLBACK
  const onboarding = props.variant === 'onboarding'

  async function save(event?: React.FormEvent): Promise<void> {
    event?.preventDefault()
    if (!ageCheck.ok) {
      setError('年龄请填整数，例如 52。')
      return
    }
    setBusy(true)
    try {
      const risk = Object.fromEntries(facts.map((row) => {
        const answer = draft.risk[row.key as RiskFact] ?? ''
        return [row.key, answer === 'yes' ? true : answer === 'no' ? false : null]
      }))
      const body: Record<string, unknown> = { age: ageCheck.value, sex: draft.sex, risk, focus: draft.focus }
      if (!onboarding) body.displayName = draft.displayName.trim()
      await postJson('/api/longpi/profile', body)
      setDirty(false)
      props.onNotice?.('档案已保存。', 'good')
      notifyChanged()
      props.onSaved?.()
    } catch (err) {
      setError(`没有保存：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleFocus = (key: Focus) => {
    const has = draft.focus.includes(key)
    edit({ focus: has ? draft.focus.filter((item) => item !== key) : [...draft.focus, key] })
  }
  const female = draft.sex === 'female'
  const answeredFacts = facts.filter((row) => (draft.risk[row.key as RiskFact] ?? '') === 'yes' || draft.risk[row.key as RiskFact] === 'no').length

  return h('form', { className: `lp-profile lp-profile-${props.variant}`, onSubmit: (event: React.FormEvent) => { void save(event) }, noValidate: true },
    onboarding ? null : h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: `${props.idPrefix}-name` }, '称呼', h('span', { className: 'lp-optional' }, '选填')),
      h('input', {
        id: `${props.idPrefix}-name`, className: 'lp-input', value: draft.displayName, maxLength: 40, autoComplete: 'nickname',
        placeholder: '页面上怎么称呼你',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => edit({ displayName: event.target.value }),
      })),
    h('div', { className: 'lp-profile-basics' },
      h('div', { className: 'lp-field lp-field-age' },
        h('label', { className: 'lp-field-label', htmlFor: `${props.idPrefix}-age` }, '实足年龄'),
        h('div', { className: 'lp-input-unit' },
          h('input', {
            id: `${props.idPrefix}-age`, className: 'lp-input', inputMode: 'numeric', value: draft.age, placeholder: '例如 52',
            'aria-invalid': !ageCheck.ok, 'data-modal-autofocus': onboarding ? true : undefined,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => edit({ age: event.target.value.replace(/[^\d]/g, '').slice(0, 3) }),
          }),
          h('span', { className: 'lp-unit' }, '岁'))),
      h('div', { className: 'lp-field lp-field-sex' },
        h(Segmented<'female' | 'male'>, {
          name: `${props.idPrefix}-sex`, label: '性别',
          options: [{ value: 'female', label: '女' }, { value: 'male', label: '男' }],
          value: draft.sex === 'female' || draft.sex === 'male' ? draft.sex : '',
          onChange: (value) => edit({ sex: value }),
        }))),
    h('p', { className: 'lp-unlock' }, h(Icon, { name: 'lock', size: 12 }), `解锁：${unlockOf(props.journey, 'age')}`),
    h('fieldset', { className: 'lp-facts' },
      h('legend', { className: 'lp-facts-legend' },
        h('span', { className: 'lp-strong' }, '心血管风险还需要这 6 项'),
        h('span', { className: 'lp-caption' }, ` · 已回答 ${answeredFacts} 项，不确定就选“不确定”，不会当作“否”`)),
      ...facts.map((row) => h('div', { className: 'lp-fact', key: row.key },
        h('div', { className: 'lp-fact-text' },
          h('div', { className: 'lp-fact-label', id: `${props.idPrefix}-${row.key}-text` }, row.label_zh),
          h('div', { className: 'lp-unlock lp-unlock-inline' },
            `解锁：${row.unlocks_zh || '心血管风险'}`,
            row.men_only ? (female ? ' · 女性的公式不用这一项，可以跳过' : ' · 只用于男性的公式') : '')),
        h(Segmented<Exclude<Answer, ''>>, {
          name: `${props.idPrefix}-${row.key}`, label: row.label_zh, hideLabel: true, options: ANSWERS,
          value: draft.risk[row.key as RiskFact] ?? '',
          onChange: (value) => edit({ risk: { ...draft.risk, [row.key]: value } }),
        })))),
    h('div', { className: 'lp-focus' },
      h('div', { className: 'lp-field-label', id: `${props.idPrefix}-focus` }, '你最关心什么', h('span', { className: 'lp-optional' }, '可多选，按点选先后排序')),
      h('div', { className: 'lp-toggles', role: 'group', 'aria-labelledby': `${props.idPrefix}-focus` },
        ...focusOptions.map((option) => {
          const index = draft.focus.indexOf(option.key)
          return h(ToggleChip, { key: option.key, pressed: index >= 0, badge: index >= 0 ? String(index + 1) : undefined, onClick: () => toggleFocus(option.key) }, option.label_zh)
        }))),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: onboarding ? 'lp-modal-actions' : 'lp-form-actions' },
      onboarding ? h(Btn, { variant: 'outline', type: 'button', onClick: props.onSkip, disabled: busy }, '跳过') : null,
      h(Btn, { type: 'submit', disabled: busy || (!onboarding && !dirty) },
        busy ? '保存中…' : onboarding ? '保存并继续' : '保存档案'),
      !onboarding && !dirty && props.journey?.profile.complete ? h('span', { className: 'lp-caption' }, '已是最新') : null))
}
