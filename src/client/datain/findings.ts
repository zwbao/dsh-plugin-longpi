// Narrative lines from uploaded reports. The lab table does not keep TI-RADS / BI-RADS, so this list does.

import React from 'react'
import { errorText, getJson } from '../api.ts'
import { chineseDate } from '../format.ts'

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
  wrong_person: '不属于本档案',
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
      if (!gone) setError(errorText(err, '未能读取报告叙述'))
    })
    return () => { gone = true }
  }, [props.reloadKey])
  if (error) return h('p', { className: 'lp-form-error', role: 'alert' }, error)
  if (!rows) return h('p', { className: 'lp-small lp-muted lp-measure' }, '正在读取报告叙述…')
  if (rows.length === 0) return h('p', { className: 'lp-small lp-muted lp-measure', id: 'lp-findings-empty' }, '尚未从报告中读取超声、总检或医师建议。已上传的报告会在打开健康页时读取超声分级；也可以将 PDF 发送到健康对话。')
  return h('ul', { className: 'lp-rows', id: 'lp-findings' },
    ...rows.map((row) => h('li', { key: row.id, className: 'lp-row lp-row-stack' },
      row.kind === 'wrong_person'
        ? h('span', { className: 'lp-tags' }, h('span', { className: 'lp-badge lp-badge-warn' }, KIND_ZH[row.kind]), row.date ? h('span', { className: 'lp-caption' }, chineseDate(row.date) || row.date) : null)
        : h('span', { className: 'lp-caption' }, `${KIND_ZH[row.kind] ?? '报告'} ${chineseDate(row.date) || row.date || ''}`.trim()),
      h('span', null, row.page_note_zh || row.text_zh))))
}
