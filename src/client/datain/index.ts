// 档案: reports, medicines and conditions kept on this computer, and a genetics summary.

import React from 'react'
import { errorText, getJson, postJson } from '../api.ts'
import { Btn } from '../ui.ts'
import { FindingsList } from './findings.ts'
import { ReportUpload } from './upload.ts'

const h = React.createElement

interface Genetics {
  sample_id?: string
  generated?: string
  variants?: Array<{ rsid: string; genotype: string; note_zh: string }>
  headlines_zh?: string[]
  caveats_zh?: string[]
  raw_export_zh?: string
  pages_read?: number
}

function GeneticsCard(): React.ReactElement {
  const [row, setRow] = React.useState<Genetics | null | undefined>(undefined)
  React.useEffect(() => {
    let gone = false
    getJson<{ genetics?: Genetics | null }>('/api/longpi/findings').then((body) => {
      if (!gone) setRow(body.genetics ?? null)
    }).catch(() => { if (!gone) setRow(null) })
    return () => { gone = true }
  }, [])
  if (!row) return h('p', { className: 'lp-muted', id: 'lp-genetics-empty' }, '还没有基因摘要。叙述版 PDF 请发到健康对话。普通体检不要选基因文件。')
  return h('div', { id: 'lp-genetics' },
    h('p', null, (row.headlines_zh ?? []).join('；') || '已记下基因报告。'),
    (row.variants ?? []).length > 0
      ? h('ul', { className: 'lp-list' }, ...(row.variants ?? []).slice(0, 12).map((item) => h('li', { key: item.rsid }, `${item.note_zh ? `${item.note_zh} ` : ''}${item.rsid} ${item.genotype}`)))
      : null,
    h('ul', { className: 'lp-list' }, ...(row.caveats_zh ?? []).map((line) => h('li', { key: line }, line))),
    row.raw_export_zh ? h('p', { className: 'lp-fine' }, row.raw_export_zh) : null,
    row.sample_id ? h('p', { className: 'lp-fine' }, `样本号存在这台电脑上，不会发给模型。`) : null)
}

function MedsForm(): React.ReactElement {
  const [name, setName] = React.useState('')
  const [dose, setDose] = React.useState('')
  const [times, setTimes] = React.useState('')
  const [lines, setLines] = React.useState<string[]>([])
  const [error, setError] = React.useState('')
  const load = React.useCallback(() => {
    getJson<{ lines?: string[] }>('/api/longpi/meds').then((body) => setLines(body.lines ?? [])).catch(() => setLines([]))
  }, [])
  React.useEffect(() => { load() }, [load])
  async function save(): Promise<void> {
    setError('')
    try {
      await postJson('/api/longpi/meds', { name, dose_text: dose, frequency_text: times })
      setName(''); setDose(''); setTimes('')
      load()
    } catch (err) {
      setError(errorText(err, '没有记下'))
    }
  }
  return h('div', { id: 'lp-meds' },
    lines.length > 0 ? h('ul', { className: 'lp-list' }, ...lines.map((line) => h('li', { key: line }, line))) : h('p', { className: 'lp-muted' }, '还没有你让 LongPi 记下的药。'),
    h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: 'lp-med-name' }, '药名'),
      h('input', { id: 'lp-med-name', className: 'lp-input', value: name, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value) })),
    h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: 'lp-med-dose' }, '用法', h('span', { className: 'lp-optional' }, '照处方抄，可不填')),
      h('input', { id: 'lp-med-dose', className: 'lp-input', value: dose, placeholder: '10 mg', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDose(event.target.value) })),
    h('div', { className: 'lp-field' },
      h('input', { id: 'lp-med-times', className: 'lp-input', value: times, placeholder: '每天早上一次', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTimes(event.target.value) })),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h(Btn, { type: 'button', size: 'sm', disabled: !name.trim(), onClick: () => { void save() } }, '记下这味药'))
}

function ConditionsForm(): React.ReactElement {
  const [name, setName] = React.useState('')
  const [rows, setRows] = React.useState<Array<{ id: string; text_zh: string }>>([])
  const [error, setError] = React.useState('')
  const load = React.useCallback(() => {
    getJson<{ conditions?: Array<{ id: string; text_zh: string }> }>('/api/longpi/conditions').then((body) => setRows(body.conditions ?? [])).catch(() => setRows([]))
  }, [])
  React.useEffect(() => { load() }, [load])
  async function save(): Promise<void> {
    setError('')
    try {
      await postJson('/api/longpi/conditions', { name_zh: name, state: 'current' })
      setName('')
      load()
    } catch (err) {
      setError(errorText(err, '没有记下'))
    }
  }
  return h('div', { id: 'lp-conditions' },
    h('p', { className: 'lp-fine' }, '诊断记在这台电脑上。体检原件那边不接收病情。'),
    rows.length > 0 ? h('ul', { className: 'lp-list' }, ...rows.map((row) => h('li', { key: row.id }, row.text_zh))) : null,
    h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: 'lp-cond-name' }, '病情或诊断'),
      h('input', { id: 'lp-cond-name', className: 'lp-input', value: name, placeholder: '脂肪肝', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value) })),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h(Btn, { type: 'button', size: 'sm', disabled: !name.trim(), onClick: () => { void save() } }, '记下'))
}

export function DataInSection(): React.ReactElement {
  const [tick, setTick] = React.useState(0)
  return h('div', { className: 'lp-grid-2 lp-grid-top', id: 'lp-datain' },
    h('div', { className: 'lp-card', id: 'lp-findings-card' },
      h('div', { className: 'lp-label' }, '报告里的叙述'),
      h(FindingsList, { reloadKey: tick }),
      h(ReportUpload, { onDone: () => setTick((value) => value + 1) })),
    h('div', { className: 'lp-card' },
      h('div', { className: 'lp-label' }, '用药'),
      h(MedsForm),
      h('div', { className: 'lp-label' }, '病情'),
      h(ConditionsForm),
      h('div', { className: 'lp-label' }, '基因'),
      h(GeneticsCard)))
}
