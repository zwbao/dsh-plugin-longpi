// Separate PIPL consent. The host onboarding (M7) should show this after the product notice, before the profile step.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { Btn } from '../ui.ts'

const h = React.createElement

interface Copy {
  pipl?: { title?: string; lead?: string; paragraphs?: string[] }
  buttons?: { pipl_grant?: string; pipl_decline?: string }
  minor?: { under_14?: string }
}

interface Status {
  copy?: Copy
  consents?: { pipl_sensitive?: { decision?: string | null } }
  minor?: { child?: boolean }
}

export function SensitiveConsentScreen(props: { onDone?: () => void } & Record<string, unknown>): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [guardian, setGuardian] = React.useState(false)
  const [age, setAge] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let live = true
    void getJson<Status>('/api/longpi/privacy').then((row) => { if (live) setStatus(row) }).catch((err: unknown) => { if (live) setError(errorText(err, '没有读到同意书')) })
    return () => { live = false }
  }, [])

  const send = (decision: 'granted' | 'declined') => {
    setBusy(true)
    setError(null)
    const body: Record<string, unknown> = { scope: 'pipl_sensitive', decision }
    if (age.trim()) body.age = Number(age)
    if (guardian) body.guardian = true
    void postJson<Status>('/api/longpi/privacy/consent', body)
      .then(() => props.onDone?.())
      .catch((err: unknown) => setError(errorText(err, '没有记下')))
      .finally(() => setBusy(false))
  }

  const copy = status?.copy
  const paragraphs = copy?.pipl?.paragraphs ?? []
  return h('section', { className: 'lp-consent', id: 'lp-pipl-consent' },
    h('h2', { className: 'lp-onb-title' }, copy?.pipl?.title ?? '单独同意：处理你的健康信息'),
    h('p', { className: 'lp-onb-lead' }, copy?.pipl?.lead ?? '这一页是单独的一次同意。'),
    ...paragraphs.map((line) => h('p', { key: line }, line)),
    status?.minor?.child ? h('p', { className: 'lp-fine' }, copy?.minor?.under_14) : null,
    h('label', { className: 'lp-field' }, '实足年龄',
      h('input', { className: 'lp-input', id: 'lp-pipl-age', inputMode: 'numeric', value: age, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setAge(event.target.value) })),
    h('label', { className: 'lp-check' },
      h('input', { type: 'checkbox', checked: guardian, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setGuardian(event.target.checked) }),
      '我是监护人，同意为未满 14 岁的人处理这些健康信息'),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-modal-actions' },
      h(Btn, { variant: 'outline', disabled: busy, onClick: () => send('declined') }, copy?.buttons?.pipl_decline ?? '暂不同意'),
      h(Btn, { disabled: busy, onClick: () => send('granted') }, copy?.buttons?.pipl_grant ?? '我单独同意处理我的健康信息')))
}
