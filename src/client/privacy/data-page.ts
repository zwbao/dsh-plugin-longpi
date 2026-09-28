// Data-flow disclosure, session-log switch, export and delete. Settings and the 档案 tab mount this.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { Btn } from '../ui.ts'

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

function List(props: { title: string; lines: string[] }): React.ReactElement {
  return h('div', null,
    h('div', { className: 'lp-strong' }, props.title),
    h('ul', { className: 'lp-privacy' }, ...props.lines.map((line) => h('li', { key: line }, line))))
}

export function DataPage(props: { onDecided?: (decision: 'granted' | 'declined') => void } & Record<string, unknown>): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [phrase, setPhrase] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    void getJson<Status>('/api/longpi/privacy').then(setStatus).catch((err: unknown) => setError(errorText(err, '没有读到隐私说明')))
  }, [])
  React.useEffect(() => { load() }, [load])

  const act = (body: Record<string, unknown>) => {
    setError(null)
    void postJson('/api/longpi/privacy/consent', body).then(() => {
      setNote('已记下')
      if (body.scope === 'data_flow_deepseek' && (body.decision === 'granted' || body.decision === 'declined')) props.onDecided?.(body.decision)
      load()
    }).catch((err: unknown) => setError(errorText(err, '没有记下')))
  }

  const copy = status?.copy
  const flow = copy?.data_flow
  const session = status?.session_log?.upload ? '已单独打开' : '关闭（健康对话的默认）'
  return h('section', { className: 'lp', id: 'lp-privacy-data' },
    h('h2', { className: 'lp-h2' }, flow?.title ?? '数据去哪里'),
    flow ? h(React.Fragment, null,
      h(List, { title: '会发给 DeepSeek 的', lines: flow.to_deepseek ?? [] }),
      h(List, { title: '留在这台电脑的', lines: flow.stays_local ?? [] }),
      h(List, { title: '体检原件留在原来的地方', lines: flow.mirobody ?? [] }),
      h('p', null, flow.name),
      h('p', { className: 'lp-muted' }, flow.session_log)) : null,
    h('p', { className: 'lp-fine' }, `会话日志：${session}`),
    h('div', { className: 'lp-form-actions' },
      h(Btn, { onClick: () => act({ scope: 'data_flow_deepseek', decision: 'granted' }) }, copy?.buttons?.flow_grant ?? '同意把健康对话发给 DeepSeek'),
      h(Btn, { variant: 'outline', onClick: () => act({ scope: 'data_flow_deepseek', decision: 'declined' }) }, copy?.buttons?.flow_decline ?? '先不发送'),
      h(Btn, { variant: 'outline', onClick: () => act({ scope: 'session_log_upload', decision: 'declined' }) }, copy?.buttons?.session_off ?? '会话日志保持关闭'),
      h(Btn, { variant: 'outline', onClick: () => act({ scope: 'session_log_upload', decision: 'granted' }) }, copy?.buttons?.session_on ?? '单独打开会话日志')),
    h('p', { className: 'lp-muted' }, status?.minor?.ask_age ? (copy?.minor?.ask ?? '请填写年龄') : status?.minor?.minor ? (copy?.minor?.under_18 ?? '未满 18 岁') : `图鉴抽卡：${status?.minor?.codex_allowed ? '可以开' : '关闭'}`),
    status?.export?.href ? h('p', null, h('a', { href: status.export.href }, '下载这台电脑上的 LongPi 档案')) : null,
    status?.export?.mirobody_note_zh ? h('p', { className: 'lp-fine' }, status.export.mirobody_note_zh) : null,
    h('label', { className: 'lp-field' }, `输入「${copy?.delete?.phrase ?? '删除全部'}」`,
      h('input', { className: 'lp-input', value: phrase, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPhrase(event.target.value) })),
    h('div', { className: 'lp-form-actions' },
      h(Btn, { variant: 'outline', onClick: () => {
        void postJson('/api/longpi/privacy/delete', { confirm: phrase }).then(() => setNote('已删除这台电脑上的 LongPi 档案')).catch((err: unknown) => setError(errorText(err, '没有删除')))
      } }, '删除这台电脑上的 LongPi 数据')),
    copy?.delete?.note ? h('p', { className: 'lp-fine' }, copy.delete.note) : null,
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    note ? h('p', { role: 'status' }, note) : null)
}
