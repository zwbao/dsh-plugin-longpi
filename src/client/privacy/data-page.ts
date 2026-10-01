// Data-flow disclosure, the DeepSeek consent, session-log switch, export and delete. Settings (embedded, folded)
// and the 档案 tab mount this.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { Btn, LinkButton, Switch } from '../ui.ts'

const h = React.createElement

interface Status {
  copy?: {
    data_flow?: { title?: string; to_deepseek?: string[]; stays_local?: string[]; mirobody?: string[]; name?: string; session_log?: string }
    buttons?: { flow_grant?: string; flow_decline?: string; session_on?: string; session_off?: string }
    delete?: { phrase?: string; note?: string }
    minor?: { ask?: string; under_18?: string }
  }
  consents?: { data_flow_deepseek?: { decision?: string | null } }
  session_log?: { upload?: boolean; health_workspace_default?: string }
  minor?: { age?: number | null; codex_allowed?: boolean; weight_loss?: boolean; ask_age?: boolean; minor?: boolean }
  export?: { href?: string; mirobody_note_zh?: string }
  science?: { blockers_zh?: string[] }
}

function List(props: { title: string; lines: string[] }): React.ReactElement | null {
  if (props.lines.length === 0) return null
  return h('div', { className: 'lp-data-list' },
    h('div', { className: 'lp-field-label' }, props.title),
    h('ul', { className: 'lp-bullets' }, ...props.lines.map((line) => h('li', { key: line }, line))))
}

/**
 * embedded: inside the settings page's 隐私与数据 block, which has its own
 * title; the whole disclosure then waits behind one 展开 line.
 */
export function DataPage(props: { onDecided?: (decision: 'granted' | 'declined') => void; embedded?: boolean } & Record<string, unknown>): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [phrase, setPhrase] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(() => {
    void getJson<Status>('/api/longpi/privacy').then(setStatus).catch((err: unknown) => setError(errorText(err, '没有读到隐私说明')))
  }, [])
  React.useEffect(() => { load() }, [load])

  const act = (body: Record<string, unknown>) => {
    setError(null)
    setBusy(true)
    void postJson('/api/longpi/privacy/consent', body).then(() => {
      setNote('已记下')
      if (body.scope === 'data_flow_deepseek' && (body.decision === 'granted' || body.decision === 'declined')) props.onDecided?.(body.decision)
      load()
    }).catch((err: unknown) => setError(errorText(err, '没有记下'))).finally(() => setBusy(false))
  }

  const copy = status?.copy
  const flow = copy?.data_flow
  const decision = status?.consents?.data_flow_deepseek?.decision
  const sessionOn = status?.session_log?.upload === true
  const phraseText = copy?.delete?.phrase ?? '删除全部'
  // Only an age question or the under-18 limits are worth a line here; an adult sees nothing about the codex.
  const minorLine = status?.minor?.ask_age ? (copy?.minor?.ask ?? '请填写年龄') : status?.minor?.minor ? (copy?.minor?.under_18 ?? '未满 18 岁') : ''
  const title = flow?.title ?? '数据去哪里'
  const body = h('div', { className: 'lp-data' },
    flow ? h('div', { className: 'lp-data-lists' },
      h(List, { title: '会发给 DeepSeek 的', lines: flow.to_deepseek ?? [] }),
      h(List, { title: '留在这台电脑的', lines: flow.stays_local ?? [] }),
      h(List, { title: '体检原件留在原来的地方', lines: flow.mirobody ?? [] }),
      flow.name ? h('p', { className: 'lp-muted' }, flow.name) : null) : null,
    h('div', { className: 'lp-data-group' },
      h('div', { className: 'lp-field-label' }, '健康对话发给 DeepSeek'),
      // Decided: the state and one quiet way to change it. Undecided: the two choices.
      decision === 'granted' || decision === 'declined'
        ? h('div', { className: 'lp-actions' },
          h('span', { className: `lp-badge ${decision === 'granted' ? 'lp-badge-good' : 'lp-badge-neutral'}` }, decision === 'granted' ? '已同意' : '不发送'),
          h(Btn, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => act({ scope: 'data_flow_deepseek', decision: decision === 'granted' ? 'declined' : 'granted' }) }, decision === 'granted' ? '撤回' : '同意'))
        : h(React.Fragment, null,
          h('p', { className: 'lp-caption' }, '还没有选择。'),
          h('div', { className: 'lp-actions' },
            h(Btn, { size: 'sm', disabled: busy, onClick: () => act({ scope: 'data_flow_deepseek', decision: 'granted' }) }, copy?.buttons?.flow_grant ?? '同意把健康对话发给 DeepSeek'),
            h(Btn, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => act({ scope: 'data_flow_deepseek', decision: 'declined' }) }, copy?.buttons?.flow_decline ?? '先不发送')))),
    h('div', { className: 'lp-data-group' },
      h(Switch, { checked: sessionOn, busy, disabled: busy || !status, label: '上传会话日志', onChange: (next) => act({ scope: 'session_log_upload', decision: next ? 'granted' : 'declined' }) }),
      h('p', { className: 'lp-caption' }, flow?.session_log || '健康对话默认不上传会话日志。')),
    minorLine ? h('p', { className: 'lp-caption' }, minorLine) : null,
    h('div', { className: 'lp-data-group' },
      h('div', { className: 'lp-field-label' }, '导出'),
      status?.export?.href ? h(LinkButton, { href: status.export.href, icon: 'download' }, '下载这台电脑上的 LongPi 档案') : null,
      status?.export?.mirobody_note_zh ? h('p', { className: 'lp-caption' }, status.export.mirobody_note_zh) : null),
    h('div', { className: 'lp-data-group' },
      h('div', { className: 'lp-field' },
        h('label', { className: 'lp-field-label', htmlFor: 'lp-privacy-phrase' }, `删除：输入「${phraseText}」`),
        h('input', { id: 'lp-privacy-phrase', className: 'lp-input', value: phrase, autoComplete: 'off', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPhrase(event.target.value) })),
      h('div', { className: 'lp-actions' },
        h(Btn, { size: 'sm', variant: 'outline', onClick: () => {
          void postJson('/api/longpi/privacy/delete', { confirm: phrase }).then(() => setNote('已删除这台电脑上的 LongPi 档案')).catch((err: unknown) => setError(errorText(err, '没有删除')))
        } }, '删除这台电脑上的 LongPi 数据')),
      copy?.delete?.note ? h('p', { className: 'lp-caption' }, copy.delete.note) : null),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    note ? h('p', { className: 'lp-conn-ok', role: 'status' }, note) : null)
  if (props.embedded) {
    return h('details', { className: 'lp-data-fold', id: 'lp-privacy-data' }, h('summary', null, `${title}、导出和删除`), body)
  }
  return h('section', { className: 'lp lp-data-page', id: 'lp-privacy-data' },
    h('h3', { className: 'lp-h3' }, title),
    body)
}
