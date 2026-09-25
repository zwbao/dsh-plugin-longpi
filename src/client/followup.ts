// 随访提醒: LongPi's own follow-up, sent from the plugin process while DSH
// runs (DSH itself cannot push). Off until the person turns it on. Webhook
// addresses and secrets never come back from the server in full: the URL shows
// masked, a stored secret shows as 已设置, and an empty field keeps what is
// stored. Minimal detail keeps health values and item names on this machine.

import React from 'react'
import { errorText, postJson } from './api.ts'
import { chineseDate, localToday } from './format.ts'
import { Icon } from './icons.ts'
import { notifyChanged, putFollowup, reload, useFollowup } from './store.ts'
import type { FollowupKind, FollowupLogRow, FollowupResponse, FollowupSettings, FollowupTestResponse, FollowupUpdate, WebhookKind, Weekday } from './types.ts'
import { Btn, Section, Segmented, Skeleton, Switch } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

export const FOLLOWUP_NOTE = '提醒只在 DeepSeek Harness 运行时发送；详细模式会把方案名称和数值发到你配置的渠道。'

const KIND_ZH: Record<WebhookKind, string> = { feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉', bark: 'Bark', generic: '通用 Webhook' }
const KIND_URL: Record<WebhookKind, string> = {
  feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/…',
  wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…',
  dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=…',
  bark: 'https://api.day.app/你的 key',
  generic: 'https://…（局域网内可用 http://）',
}
/** Kinds whose robots sign requests with a shared secret. */
const SIGNED: WebhookKind[] = ['feishu', 'dingtalk']
const LOG_ZH: Record<FollowupKind, string> = { checkin: '打卡提醒', retest: '复测提醒', weekly: '每周小结', nudge: '进度提醒', custom: 'AI 随访', test: '测试' }
const DAYS = ['每周一', '每周二', '每周三', '每周四', '每周五', '每周六', '每周日']

interface Form {
  checkin_time: string
  retest_time: string
  weeklyDay: string
  weeklyTime: string
  desktop: boolean
  kind: WebhookKind | ''
  url: string
  secret: string
  clearSecret: boolean
  detail: 'minimal' | 'full'
  quietOn: boolean
  quietStart: string
  quietEnd: string
}

function formOf(settings: FollowupSettings): Form {
  return {
    checkin_time: settings.checkin_time,
    retest_time: settings.retest_time,
    weeklyDay: settings.weekly ? String(settings.weekly.day) : '0',
    weeklyTime: settings.weekly?.time ?? '20:00',
    desktop: settings.desktop,
    kind: settings.webhook?.kind ?? '',
    url: '',
    secret: '',
    clearSecret: false,
    detail: settings.detail,
    quietOn: settings.quiet != null,
    quietStart: settings.quiet?.start ?? '22:30',
    quietEnd: settings.quiet?.end ?? '08:00',
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Only what changed goes to the server; an empty URL or secret field means "keep the stored one". */
function updateOf(form: Form, settings: FollowupSettings): FollowupUpdate {
  const body: FollowupUpdate = {}
  if (form.checkin_time !== settings.checkin_time) body.checkin_time = form.checkin_time
  if (form.retest_time !== settings.retest_time) body.retest_time = form.retest_time
  const weekly = form.weeklyDay === '0' ? null : { day: Number(form.weeklyDay) as Weekday, time: form.weeklyTime }
  if (!same(weekly, settings.weekly)) body.weekly = weekly
  if (form.desktop !== settings.desktop) body.desktop = form.desktop
  if (form.detail !== settings.detail) body.detail = form.detail
  const quiet = form.quietOn ? { start: form.quietStart, end: form.quietEnd } : null
  if (!same(quiet, settings.quiet)) body.quiet = quiet
  if (form.kind === '') {
    if (settings.webhook) body.webhook = null
  } else {
    const url = form.url.trim()
    const secret = SIGNED.includes(form.kind) ? (form.secret || (form.clearSecret ? '' : undefined)) : undefined
    if (!settings.webhook || settings.webhook.kind !== form.kind || url || secret !== undefined) {
      body.webhook = { kind: form.kind, ...(url ? { url } : {}), ...(secret !== undefined ? { secret } : {}) }
    }
  }
  return body
}

function problemOf(form: Form, settings: FollowupSettings): string | null {
  if (form.kind === '') return null
  const url = form.url.trim()
  const stored = settings.webhook?.kind === form.kind
  if (!url && !stored) return `请填写${KIND_ZH[form.kind]}的 Webhook 地址。`
  if (url && !/^https?:\/\//i.test(url)) return 'Webhook 地址要以 https:// 开头。'
  if (url && /^http:\/\//i.test(url) && form.kind !== 'generic') return `${KIND_ZH[form.kind]}的地址要用 https://。`
  if (form.secret.length > 200) return '签名密钥太长（最多 200 个字符）。'
  return null
}

/** "2026-09-24T21:00:00" (local, as the server sends it) → 今天 21:00. */
export function whenText(iso: string | null, today = localToday()): string {
  if (!iso) return ''
  let date = iso.slice(0, 10)
  let time = iso.slice(11, 16)
  if (/(Z|[+-]\d\d:?\d\d)$/.test(iso)) {
    const at = new Date(iso)
    if (!Number.isNaN(at.getTime())) {
      const pad = (value: number) => String(value).padStart(2, '0')
      date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
      time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
    }
  }
  const tomorrow = new Date(`${today}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const label = date === today ? '今天' : date === tomorrow.toISOString().slice(0, 10) ? '明天' : chineseDate(date)
  return `${label} ${time}`.trim()
}

function nextLine(data: FollowupResponse): string {
  const parts = [
    data.next.checkin ? `打卡 ${whenText(data.next.checkin)}` : '',
    data.next.retest ? `复测 ${whenText(data.next.retest)}` : '',
    data.next.weekly ? `小结 ${whenText(data.next.weekly)}` : '',
  ].filter(Boolean)
  return parts.length > 0 ? `下次：${parts.join(' · ')}` : '近期没有要发的提醒'
}

function TimeField(props: { id: string; label: string; value: string; onChange: (value: string) => void; hint?: string }): React.ReactElement {
  return h('div', { className: 'lp-field' },
    h('label', { className: 'lp-field-label', htmlFor: props.id }, props.label, props.hint ? h('span', { className: 'lp-optional' }, props.hint) : null),
    h('input', {
      id: props.id, type: 'time', className: 'lp-input lp-input-time', value: props.value, required: true,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.value) props.onChange(event.target.value) },
    }))
}

function Check(props: { id: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children?: React.ReactNode }): React.ReactElement {
  return h('label', { className: `lp-check ${props.disabled ? 'lp-check-off' : ''}`, htmlFor: props.id },
    h('input', {
      id: props.id, type: 'checkbox', checked: props.checked, disabled: props.disabled,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange(event.target.checked),
    }),
    h('span', null, props.children))
}

function channelsText(row: FollowupLogRow): string {
  const out: string[] = []
  if (row.channels.desktop != null) out.push(`桌面${row.channels.desktop ? '' : ' 失败'}`)
  if (row.channels.webhook != null) out.push(`Webhook${row.channels.webhook ? '' : ' 失败'}`)
  return out.join('、')
}

function Log(props: { rows: FollowupLogRow[] }): React.ReactElement {
  const rows = [...props.rows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  return h('div', { className: 'lp-followup-log' },
    h('div', { className: 'lp-subhead' }, '最近发送', h('span', { className: 'lp-optional' }, rows.length > 0 ? `最近 ${rows.length} 条` : '')),
    rows.length === 0
      ? h('p', { className: 'lp-caption' }, '还没有发过提醒。')
      : h('ul', { className: 'lp-rows' },
        ...rows.map((row, index) => h('li', { key: `${row.at}-${index}`, className: 'lp-row' },
          h('span', { className: 'lp-row-main' },
            h('span', { className: 'lp-num' }, whenText(row.at)), '  ',
            h('span', null, LOG_ZH[row.kind] ?? row.kind),
            row.error ? h('span', { className: 'lp-caption' }, `  ${row.error}`) : null),
          h('span', { className: 'lp-row-end' },
            channelsText(row) ? h('span', { className: 'lp-caption' }, channelsText(row)) : null,
            h('span', { className: `lp-sent ${row.ok ? 'lp-sent-ok' : 'lp-sent-bad'}` },
              h(Icon, { name: row.ok ? 'check' : 'close', size: 12, strokeWidth: 2 }),
              row.ok ? '已发送' : Object.values(row.channels).some(Boolean) ? '部分失败' : '失败'))))))
}

function TestResult(props: { result: FollowupTestResponse; kind: WebhookKind | null }): React.ReactElement {
  const rows: Array<{ name: string; ok: boolean; error?: string }> = []
  if (props.result.channels.desktop) rows.push({ name: '桌面通知', ...props.result.channels.desktop })
  if (props.result.channels.webhook) rows.push({ name: props.kind ? KIND_ZH[props.kind] : 'Webhook', ...props.result.channels.webhook })
  if (rows.length === 0) return h('span', { className: 'lp-caption', role: 'status' }, '没有可用的渠道：打开桌面通知或填写 Webhook 后再试。')
  return h('span', { className: 'lp-test-result', role: 'status' },
    ...rows.map((row) => h('span', { key: row.name, className: `lp-sent ${row.ok ? 'lp-sent-ok' : 'lp-sent-bad'}` },
      h(Icon, { name: row.ok ? 'check' : 'close', size: 12, strokeWidth: 2 }),
      `${row.name}：${row.ok ? '已发送' : `失败${row.error ? `（${row.error}）` : ''}`}`)))
}

function Settings(props: { data: FollowupResponse; onNotice: Notify }): React.ReactElement {
  const { data } = props
  const settings = data.settings
  const signature = JSON.stringify(settings)
  const [form, setForm] = React.useState<Form>(() => formOf(settings))
  const [saving, setSaving] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [test, setTest] = React.useState<FollowupTestResponse | null>(null)
  // Saved on the server (here or elsewhere, e.g. by the set_followup tool): start from what is stored.
  React.useEffect(() => { setForm(formOf(settings)) }, [signature])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))
  const update = updateOf(form, settings)
  const dirty = Object.keys(update).length > 0
  const hasChannel = (settings.desktop && data.platform_desktop) || settings.webhook != null

  async function post(body: FollowupUpdate): Promise<boolean> {
    const result = await postJson<{ ok: boolean; error?: string } & Partial<FollowupResponse>>('/api/longpi/followup', body)
    if (!result.ok) throw new Error(result.error || '没有保存')
    if (result.settings) putFollowup(result)
    notifyChanged()
    return true
  }

  async function toggle(next: boolean): Promise<void> {
    setSwitching(true)
    setError(null)
    try {
      await post({ enabled: next })
      props.onNotice(next ? '随访提醒已开启。' : '随访提醒已关闭。', 'good')
    } catch (err) {
      setError(`没有保存：${errorText(err, '请稍后再试')}`)
    } finally {
      setSwitching(false)
    }
  }

  async function save(): Promise<void> {
    const problem = problemOf(form, settings)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await post(update)
      props.onNotice('随访设置已保存。', 'good')
    } catch (err) {
      setError(`没有保存：${errorText(err, '请稍后再试')}`)
    } finally {
      setSaving(false)
    }
  }

  async function sendTest(): Promise<void> {
    setTesting(true)
    setTest(null)
    setError(null)
    try {
      setTest(await postJson<FollowupTestResponse>('/api/longpi/followup/test', {}))
      void reload('followup')
    } catch (err) {
      setError(`测试没有发出：${errorText(err, '请稍后再试')}`)
    } finally {
      setTesting(false)
    }
  }

  const kind = form.kind === '' ? null : form.kind
  const storedSame = kind != null && settings.webhook?.kind === kind
  return h('div', { className: 'lp-card lp-followup' },
    h('div', { className: 'lp-followup-head' },
      h(Switch, { id: 'lp-followup-on', checked: settings.enabled, busy: switching, disabled: switching, label: '开启随访提醒', onChange: (next) => { void toggle(next) } }),
      h('span', { className: 'lp-caption' }, settings.enabled
        ? hasChannel ? nextLine(data) : '已开启，但还没有可用的渠道：打开桌面通知或填写 Webhook。'
        : '关闭时不会发送任何提醒。开启后按下面的时间提醒打卡、到期复测和每周小结。')),
    h('div', { className: 'lp-grid-2 lp-followup-grid' },
      h('fieldset', { className: 'lp-fieldset' },
        h('legend', { className: 'lp-label' }, '什么时候'),
        h('div', { className: 'lp-followup-times' },
          h(TimeField, { id: 'lp-fu-checkin', label: '打卡提醒', hint: '当天还有未完成时', value: form.checkin_time, onChange: (value) => set('checkin_time', value) }),
          h(TimeField, { id: 'lp-fu-retest', label: '复测提醒', hint: '到期当天', value: form.retest_time, onChange: (value) => set('retest_time', value) })),
        h('div', { className: 'lp-field' },
          h('label', { className: 'lp-field-label', htmlFor: 'lp-fu-weekly' }, '每周小结'),
          h('div', { className: 'lp-input-unit' },
            h('select', {
              id: 'lp-fu-weekly', className: 'lp-select lp-select-wide', value: form.weeklyDay,
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => set('weeklyDay', event.target.value),
            }, h('option', { value: '0' }, '不发送'), ...DAYS.map((label, index) => h('option', { key: label, value: String(index + 1) }, label))),
            form.weeklyDay !== '0' ? h('input', {
              type: 'time', className: 'lp-input lp-input-time', value: form.weeklyTime, 'aria-label': '每周小结的时间',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.value) set('weeklyTime', event.target.value) },
            }) : null)),
        h('div', { className: 'lp-field' },
          h(Check, { id: 'lp-fu-quiet', checked: form.quietOn, onChange: (checked) => set('quietOn', checked) }, '免打扰时段'),
          form.quietOn ? h('div', { className: 'lp-input-unit' },
            h('input', { type: 'time', className: 'lp-input lp-input-time', value: form.quietStart, 'aria-label': '免打扰开始', onChange: (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.value) set('quietStart', event.target.value) } }),
            h('span', { className: 'lp-unit' }, '至'),
            h('input', { type: 'time', className: 'lp-input lp-input-time', value: form.quietEnd, 'aria-label': '免打扰结束', onChange: (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.value) set('quietEnd', event.target.value) } })) : null)),
      h('fieldset', { className: 'lp-fieldset' },
        h('legend', { className: 'lp-label' }, '发到哪里'),
        h(Check, { id: 'lp-fu-desktop', checked: form.desktop && data.platform_desktop, disabled: !data.platform_desktop, onChange: (checked) => set('desktop', checked) },
          '桌面通知', h('span', { className: 'lp-caption' }, data.platform_desktop ? '  这台电脑的系统通知' : '  这台电脑的系统不支持')),
        h('div', { className: 'lp-field' },
          h('label', { className: 'lp-field-label', htmlFor: 'lp-fu-kind' }, 'Webhook 渠道', h('span', { className: 'lp-optional' }, '可选：发到手机上的群机器人或 App')),
          h('select', {
            id: 'lp-fu-kind', className: 'lp-select lp-select-wide', value: form.kind,
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setForm((current) => ({ ...current, kind: event.target.value as WebhookKind | '', url: '', secret: '', clearSecret: false })),
          }, h('option', { value: '' }, '不使用'), ...(Object.keys(KIND_ZH) as WebhookKind[]).map((key) => h('option', { key, value: key }, KIND_ZH[key])))),
        kind ? h('div', { className: 'lp-field' },
          h('label', { className: 'lp-field-label', htmlFor: 'lp-fu-url' }, '地址', storedSame ? h('span', { className: 'lp-optional' }, `已设置：${settings.webhook?.url_masked}`) : null),
          h('input', {
            id: 'lp-fu-url', type: 'url', className: 'lp-input', value: form.url, autoComplete: 'off', spellCheck: false,
            placeholder: storedSame ? '留空保持不变；填写则替换' : KIND_URL[kind],
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => set('url', event.target.value),
          })) : null,
        kind && SIGNED.includes(kind) ? h('div', { className: 'lp-field' },
          h('label', { className: 'lp-field-label', htmlFor: 'lp-fu-secret' }, '签名密钥', h('span', { className: 'lp-optional' }, '机器人开了“加签”才需要')),
          h('div', { className: 'lp-input-unit' },
            h('input', {
              id: 'lp-fu-secret', type: 'password', className: 'lp-input', value: form.secret, autoComplete: 'new-password',
              placeholder: storedSame && settings.webhook?.secret_set ? (form.clearSecret ? '保存后清除' : '已设置（留空保持不变）') : '可不填',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, secret: event.target.value, clearSecret: false })),
            }),
            storedSame && settings.webhook?.secret_set && !form.clearSecret && !form.secret
              ? h('button', { type: 'button', className: 'lp-linkbtn', onClick: () => set('clearSecret', true) }, '清除')
              : null)) : null)),
    h('div', { className: 'lp-followup-detail' },
      h(Segmented<'minimal' | 'full'>, {
        name: 'lp-fu-detail', label: '内容', value: form.detail, onChange: (value) => set('detail', value),
        options: [{ value: 'minimal', label: '简要：不含健康数值' }, { value: 'full', label: '详细' }],
      }),
      h('p', { className: 'lp-caption' }, form.detail === 'minimal'
        ? '只发“今天还有 2 项待打卡”这类提示，不含项目名称和健康数值。'
        : '会带上方案项目名称、执行率和复测指标，发到你配置的渠道。')),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-form-actions' },
      h(Btn, { onClick: () => { void save() }, disabled: !dirty || saving }, saving ? '保存中…' : '保存设置'),
      h(Btn, { variant: 'outline', onClick: () => { void sendTest() }, disabled: testing || dirty, title: dirty ? '先保存设置再测试' : undefined },
        h(Icon, { name: 'send', size: 14 }), testing ? '发送中…' : '发送测试'),
      dirty ? h('span', { className: 'lp-caption' }, '有未保存的更改') : test ? h(TestResult, { result: test, kind: settings.webhook?.kind ?? null }) : null),
    h('p', { className: 'lp-fine' }, FOLLOWUP_NOTE),
    h(Log, { rows: data.log }))
}

export function FollowupSection(props: { onNotice: Notify }): React.ReactElement {
  const { data, loading, error } = useFollowup()
  let body: React.ReactNode
  if (!data && loading) body = h(Skeleton, { height: 220, className: 'lp-card-skeleton' })
  else if (!data) body = h('div', { className: 'lp-card' }, h('p', { className: 'lp-muted' }, `随访设置没有读到：${error ?? '没有返回'}。LongPi 插件可能需要更新。`))
  else body = h(Settings, { data, onNotice: props.onNotice })
  return h(Section, { id: 'lp-followup-section', title: '随访提醒', kicker: '默认关闭 · 只在 DSH 运行时发送' }, body)
}

/** Onboarding step 4: one opt-in row. Nothing is sent unless the person ticks it. */
export function FollowupOptIn(): React.ReactElement | null {
  const { data } = useFollowup()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  if (!data) return null
  const settings = data.settings
  const checked = settings.enabled && settings.desktop
  async function change(next: boolean): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const body: FollowupUpdate = next ? { enabled: true, desktop: true } : { enabled: false }
      const result = await postJson<{ ok: boolean; error?: string } & Partial<FollowupResponse>>('/api/longpi/followup', body)
      if (!result.ok) throw new Error(result.error || '没有保存')
      if (result.settings) putFollowup(result)
      notifyChanged()
    } catch (err) {
      setError(`没有保存：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(false)
    }
  }
  return h('div', { className: 'lp-optin' },
    h(Check, { id: 'lp-onb-followup', checked: checked && data.platform_desktop, disabled: busy || !data.platform_desktop, onChange: (next) => { void change(next) } },
      `每天${Number(settings.checkin_time.slice(0, 2)) >= 17 ? '晚上' : ''} ${settings.checkin_time} 提醒我打卡（桌面通知）`),
    h('span', { className: 'lp-caption' }, data.platform_desktop
      ? '只在 DSH 运行时提醒，不含健康数值；随时可以在健康页的“随访提醒”里关闭或改时间。'
      : '这台电脑的系统不支持桌面通知；可以在健康页的“随访提醒”里设置 Webhook。'),
    error ? h('span', { className: 'lp-form-error', role: 'alert' }, error) : null)
}
