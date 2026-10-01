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
  if (!row) return h('p', { className: 'lp-small lp-muted lp-measure', id: 'lp-genetics-empty' }, '暂无基因摘要。叙述版 PDF 请发送到健康对话。上传普通体检报告时请勿选择基因文件。')
  return h('div', { className: 'lp-stack', id: 'lp-genetics' },
    h('p', null, (row.headlines_zh ?? []).join('；') || '已保存基因报告。'),
    (row.variants ?? []).length > 0
      ? h('ul', { className: 'lp-rows' }, ...(row.variants ?? []).slice(0, 12).map((item) => h('li', { key: item.rsid, className: 'lp-row' },
        h('span', { className: 'lp-row-main' }, item.note_zh || item.rsid),
        h('span', { className: 'lp-row-end lp-num' }, item.note_zh ? `${item.rsid} ${item.genotype}` : item.genotype))))
      : null,
    (row.caveats_zh ?? []).length > 0 ? h('ul', { className: 'lp-bullets' }, ...(row.caveats_zh ?? []).map((line) => h('li', { key: line }, line))) : null,
    row.raw_export_zh ? h('p', { className: 'lp-caption lp-measure' }, row.raw_export_zh) : null,
    row.sample_id ? h('p', { className: 'lp-caption lp-measure' }, `样本号仅保存在这台电脑上，不会发送给 DeepSeek 模型。`) : null)
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
      setError(errorText(err, '保存失败'))
    }
  }
  return h('div', { className: 'lp-stack', id: 'lp-meds' },
    lines.length > 0
      ? h('ul', { className: 'lp-rows' }, ...lines.map((line) => h('li', { key: line, className: 'lp-row' }, h('span', { className: 'lp-row-main' }, line))))
      : h('p', { className: 'lp-small lp-muted lp-measure' }, '尚未记录用药。'),
    h('div', { className: 'lp-form-grid' },
      h('div', { className: 'lp-field lp-field-full' },
        h('label', { className: 'lp-field-label', htmlFor: 'lp-med-name' }, '药名'),
        h('input', { id: 'lp-med-name', className: 'lp-input', value: name, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value) })),
      h('div', { className: 'lp-field' },
        h('label', { className: 'lp-field-label', htmlFor: 'lp-med-dose' }, '用法', h('span', { className: 'lp-optional' }, '按处方填写，选填')),
        h('input', { id: 'lp-med-dose', className: 'lp-input', value: dose, placeholder: '10 mg', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDose(event.target.value) })),
      h('div', { className: 'lp-field' },
        h('label', { className: 'lp-field-label', htmlFor: 'lp-med-times' }, '服用时间', h('span', { className: 'lp-optional' }, '选填')),
        h('input', { id: 'lp-med-times', className: 'lp-input', value: times, placeholder: '每日早晨一次', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTimes(event.target.value) }))),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-actions' },
      h(Btn, { type: 'button', disabled: !name.trim(), onClick: () => { void save() } }, '保存用药')))
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
      setError(errorText(err, '保存失败'))
    }
  }
  return h('div', { className: 'lp-stack', id: 'lp-conditions' },
    rows.length > 0
      ? h('ul', { className: 'lp-rows' }, ...rows.map((row) => h('li', { key: row.id, className: 'lp-row' }, h('span', { className: 'lp-row-main' }, row.text_zh))))
      : h('p', { className: 'lp-small lp-muted lp-measure' }, '尚未记录病情。'),
    h('div', { className: 'lp-field' },
      h('label', { className: 'lp-field-label', htmlFor: 'lp-cond-name' }, '病情或诊断'),
      h('input', { id: 'lp-cond-name', className: 'lp-input', value: name, placeholder: '脂肪肝', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value) })),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-actions' },
      h(Btn, { type: 'button', disabled: !name.trim(), onClick: () => { void save() } }, '保存')),
    h('p', { className: 'lp-caption lp-measure' }, '诊断保存在这台电脑上；健康数据服务不接收病情信息。'))
}

export function DataInSection(): React.ReactElement {
  const [tick, setTick] = React.useState(0)
  return h('div', { className: 'lp-grid-2', id: 'lp-datain' },
    h('div', { className: 'lp-card', id: 'lp-findings-card' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '报告里的叙述')),
      h(FindingsList, { reloadKey: tick }),
      h(ReportUpload, { onDone: () => setTick((value) => value + 1) })),
    h('div', { className: 'lp-card', id: 'lp-meds-card' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '用药')),
      h(MedsForm)),
    h('div', { className: 'lp-card', id: 'lp-conditions-card' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '病情')),
      h(ConditionsForm)),
    h('div', { className: 'lp-card', id: 'lp-genetics-card' },
      h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '基因')),
      h(GeneticsCard)))
}
