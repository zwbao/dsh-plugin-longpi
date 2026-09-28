// Narrative lines from uploaded reports. The lab table does not keep TI-RADS / BI-RADS, so this list does.

import React from 'react'
import { errorText, getJson } from '../api.ts'

const h = React.createElement

interface FindingRow {
  id: string
  date: string
  kind: string
  text_zh: string
  grade?: string
  page_note_zh?: string
}

const KIND_ZH: Record<string, string> = {
  'ti-rads': '甲状腺超声',
  'bi-rads': '乳腺超声',
  nodule: '结节',
  ultrasound: '超声',
  conclusion: '结论',
  advice: '医师建议',
  wrong_person: '不是这份档案',
  genetics: '基因报告',
}

export function FindingsList(props: { reloadKey?: number }): React.ReactElement {
  const [rows, setRows] = React.useState<FindingRow[] | null>(null)
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    let gone = false
    getJson<{ findings?: FindingRow[] }>('/api/longpi/findings').then((body) => {
      if (!gone) setRows(Array.isArray(body.findings) ? body.findings : [])
    }).catch((err: unknown) => {
      if (!gone) setError(errorText(err, '没有读到报告叙述'))
    })
    return () => { gone = true }
  }, [props.reloadKey])
  if (error) return h('p', { className: 'lp-form-error', role: 'alert' }, error)
  if (!rows) return h('p', { className: 'lp-muted' }, '正在读取报告叙述…')
  if (rows.length === 0) return h('p', { className: 'lp-muted', id: 'lp-findings-empty' }, '还没有从报告里记下超声、总检或医师建议。已经在 Mirobody 里的报告，打开健康页后会读到超声分级；也可以把 PDF 发到健康对话。')
  return h('ul', { className: 'lp-list', id: 'lp-findings' },
    ...rows.map((row) => h('li', { key: row.id, className: row.kind === 'wrong_person' ? 'lp-found-changes-warn' : '' },
      h('div', { className: 'lp-label' }, `${KIND_ZH[row.kind] ?? '报告'} ${row.date || ''}`.trim()),
      h('div', null, row.page_note_zh || row.text_zh))))
}
