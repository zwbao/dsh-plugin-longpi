// 数据连接: which Mirobody LongPi reads, set right here instead of by
// re-running the installer. The address is tested (one catalog read) before
// it is saved; a saved address overrides the installed one until cleared. The
// server only ever sends the address back masked and never sends the token.
// Shared by the settings page, onboarding step 3 and the 档案 tab.

import React from 'react'
import { deleteJson, errorText, postJson } from './api.ts'
import { chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { normalizeConnectionResult } from './normalize.ts'
import { notifyChanged, putConnection, reload, useConnection } from './store.ts'
import type { Connection, ConnectionResult, RecordsSummary } from './types.ts'
import { Btn, LoadError, Skeleton } from './ui.ts'

const h = React.createElement

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** The same rule the server applies: https, or http only on this computer. */
export function addressProblem(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return '请粘贴 Mirobody 的 MCP 地址。'
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return '这不是一个完整的网址，请从 Mirobody 复制完整地址（以 https:// 开头）。'
  }
  if (url.protocol === 'https:') return null
  if (url.protocol === 'http:' && LOOPBACK.has(url.hostname)) return null
  return url.protocol === 'http:' ? '只有本机地址（127.0.0.1 或 localhost）可以用 http://，其他地址请用 https://。' : '地址要以 https:// 开头。'
}

function month(iso: string | null): string {
  return iso ? iso.slice(0, 7) : ''
}

/** "4 次体检 · 2025-10 → 2026-08 · 血脂、血糖等 · 手环 355 天": only what the server counted. */
export function summaryParts(summary: RecordsSummary): string[] {
  const range = summary.first_date && summary.last_date
    ? summary.first_date.slice(0, 7) === summary.last_date.slice(0, 7) ? month(summary.last_date) : `${month(summary.first_date)} → ${month(summary.last_date)}`
    : ''
  const categories = summary.categories_zh.length > 3 ? `${summary.categories_zh.slice(0, 3).join('、')}等` : summary.categories_zh.join('、')
  return [
    `${summary.checkups} 次体检`,
    range,
    categories,
    summary.wearable_days > 0 ? `手环 ${summary.wearable_days} 天` : '',
  ].filter(Boolean)
}

function sourceText(connection: Connection): string {
  if (connection.source === 'saved') return '在这里保存的地址'
  if (connection.source === 'config') return '安装时配置的地址'
  return ''
}

export function ConnectionStatus(props: { connection: Connection }): React.ReactElement {
  const { connection } = props
  const ok = connection.status === 'ok'
  const bad = connection.status === 'error'
  return h('div', { className: 'lp-conn-status' },
    h('div', { className: 'lp-status' },
      h('span', { className: `lp-statusdot ${ok ? 'lp-statusdot-on' : bad ? 'lp-statusdot-bad' : ''}`, 'aria-hidden': true }),
      ok ? '已连接 Mirobody' : bad ? `连接失败：${connection.error || '没有返回原因'}` : '还没有连接 Mirobody'),
    connection.url_masked
      ? h('div', { className: 'lp-caption lp-conn-url' }, h('code', null, connection.url_masked),
        sourceText(connection) ? ` · ${sourceText(connection)}` : '', connection.token_set ? ' · 令牌已设置' : '')
      : null,
    ok && connection.summary ? h('div', { className: 'lp-caption' }, `找到：${summaryParts(connection.summary).join(' · ')}`) : null)
}

function TestOutcome(props: { result: ConnectionResult }): React.ReactElement {
  const { result } = props
  if (!result.ok) return h('p', { className: 'lp-form-error', role: 'alert' }, `连接没有成功：${result.error}`)
  const summary = result.connection?.summary
  return h('p', { className: 'lp-conn-ok', role: 'status' },
    h(Icon, { name: 'check', size: 14 }),
    summary ? `连接成功，找到 ${summaryParts(summary).join(' · ')}` : '连接成功')
}

/**
 * The form: address, optional token, 测试连接 and 保存, and 清除 for a saved
 * address. Nothing is saved unless the test inside 保存 succeeds.
 */
export function ConnectionForm(props: { connection: Connection | null; idPrefix: string; onSaved?: (connection: Connection) => void }): React.ReactElement {
  const [url, setUrl] = React.useState('')
  const [token, setToken] = React.useState('')
  const [busy, setBusy] = React.useState<'test' | 'save' | 'clear' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [outcome, setOutcome] = React.useState<ConnectionResult | null>(null)
  const saved = props.connection?.source === 'saved'

  function body(): { mcp_url: string; mcp_token?: string } | null {
    const problem = addressProblem(url)
    if (problem) {
      setError(problem)
      return null
    }
    return { mcp_url: url.trim(), ...(token.trim() ? { mcp_token: token.trim() } : {}) }
  }

  async function run(kind: 'test' | 'save'): Promise<void> {
    // 测试连接 with an empty field tests the address in use now.
    const request = kind === 'test' && !url.trim() && props.connection?.url_masked ? {} : body()
    if (!request) return
    setBusy(kind)
    setError(null)
    setOutcome(null)
    try {
      const result = normalizeConnectionResult(await postJson<unknown>(kind === 'test' ? '/api/longpi/connection/test' : '/api/longpi/connection', request))
      setOutcome(result)
      if (kind === 'save' && result.ok && result.connection) {
        putConnection(result.connection)
        setUrl('')
        setToken('')
        notifyChanged()
        props.onSaved?.(result.connection)
      }
    } catch (err) {
      setOutcome({ ok: false, error: errorText(err, '请稍后再试'), connection: null })
    } finally {
      setBusy(null)
    }
  }

  async function clear(): Promise<void> {
    setBusy('clear')
    setError(null)
    setOutcome(null)
    try {
      await deleteJson<unknown>('/api/longpi/connection')
      notifyChanged()
      await reload('connection')
    } catch (err) {
      setError(`没有清除：${errorText(err, '请稍后再试')}`)
    } finally {
      setBusy(null)
    }
  }

  return h('form', { className: 'lp-conn-form', noValidate: true, onSubmit: (event: React.FormEvent) => { event.preventDefault(); void run('save') } },
    h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: `${props.idPrefix}-url` }, 'Mirobody 地址', h('span', { className: 'lp-optional' }, '在 Mirobody 网页生成的个人 MCP 地址')),
      h('input', {
        id: `${props.idPrefix}-url`, type: 'url', className: 'lp-input', value: url, autoComplete: 'off', spellCheck: false,
        placeholder: props.connection?.url_masked ? `现在：${props.connection.url_masked}` : 'https://…/mcp/…',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setUrl(event.target.value); setError(null) },
      })),
    h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: `${props.idPrefix}-token` }, '访问令牌', h('span', { className: 'lp-optional' }, '选填：地址里已含令牌时留空')),
      h('input', {
        id: `${props.idPrefix}-token`, type: 'password', className: 'lp-input', value: token, autoComplete: 'new-password',
        placeholder: '可不填',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setToken(event.target.value),
      })),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    outcome ? h(TestOutcome, { result: outcome }) : null,
    h('div', { className: 'lp-form-actions' },
      h(Btn, { variant: 'outline', type: 'button', disabled: busy != null, onClick: () => { void run('test') } }, busy === 'test' ? '测试中…' : '测试连接'),
      h(Btn, { type: 'submit', disabled: busy != null }, busy === 'save' ? '测试并保存中…' : '保存'),
      saved ? h('button', { type: 'button', className: 'lp-linkbtn', disabled: busy != null, onClick: () => { void clear() } },
        h(Icon, { name: 'trash', size: 13 }), busy === 'clear' ? '清除中' : '清除保存的地址') : null),
    h('p', { className: 'lp-fine' }, saved
      ? '清除后改用安装时配置的地址（如果有）。'
      : '保存前会先用这个地址读一次记录目录，读到了才保存；地址和令牌只存在这台电脑上。'))
}

/** Status plus form. collapsed: when connected, the form waits behind 换一个地址 (onboarding step 3). */
export function ConnectionPanel(props: { idPrefix: string; collapsed?: boolean; onSaved?: (connection: Connection) => void }): React.ReactElement {
  const { data, loading, error } = useConnection()
  const [open, setOpen] = React.useState(false)
  if (!data && loading) return h(Skeleton, { height: 96 })
  if (!data) return h(LoadError, { what: '连接状态', error, onRetry: () => reload('connection') })
  const connected = data.status === 'ok'
  const showForm = !props.collapsed || !connected || open
  return h('div', { className: 'lp-conn' },
    h(ConnectionStatus, { connection: data }),
    showForm
      ? h(ConnectionForm, { connection: data, idPrefix: props.idPrefix, onSaved: (connection) => { setOpen(false); props.onSaved?.(connection) } })
      : h('button', { type: 'button', className: 'lp-row-link', onClick: () => setOpen(true) }, '换一个 Mirobody 地址 →'))
}

/** One line for places that only point at the connection (档案, the page header). */
export function connectionLine(connection: Connection | null): string {
  if (!connection) return ''
  if (connection.status === 'ok') {
    const summary = connection.summary
    return summary ? `Mirobody 已连接 · ${summaryParts(summary).slice(0, 2).join(' · ')}` : 'Mirobody 已连接'
  }
  return connection.status === 'error' ? `Mirobody 连接失败：${connection.error || '没有返回原因'}` : '还没有连接 Mirobody'
}

export function lastCheckupText(summary: RecordsSummary | null): string {
  return summary?.last_date ? `最近一次体检：${chineseDate(summary.last_date)}` : ''
}
