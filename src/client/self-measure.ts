// Measurements the person takes at home: waist, blood pressure, weight. They
// are saved as stated (units converted on the server) and never estimated.

import React from 'react'
import { deleteJson, errorText, postJson } from './api.ts'
import { fmt } from './charts.ts'
import { PREFERRED_UNITS, SELF_FALLBACK } from './constants.ts'
import { chineseDate, localToday } from './format.ts'
import { Icon } from './icons.ts'
import { notifyChanged, useSelfRows } from './store.ts'
import type { Journey, SelfKey, SelfKeySpec, SelfLatest, SelfRow } from './types.ts'
import { Btn } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

function specs(journey: Journey | null): SelfKeySpec[] {
  const keys = journey?.self.keys ?? []
  return keys.length > 0 ? keys : SELF_FALLBACK.map((row) => ({ ...row }))
}

/** A short unit list: the canonical unit, then the spellings people use most. */
function unitChoices(spec: SelfKeySpec): string[] {
  const offered = spec.units.length > 0 ? spec.units : [spec.unit]
  const preferred = PREFERRED_UNITS[spec.key].filter((unit) => offered.some((item) => item.toLowerCase() === unit.toLowerCase()))
  const list = [spec.unit, ...preferred]
  return [...new Set(list)]
}

export function selfLatestText(row: SelfLatest, all: SelfLatest[]): string {
  if (row.key === 'sbp') {
    const dbp = all.find((item) => item.key === 'dbp')
    return `${fmt(row.value)}${dbp ? `/${fmt(dbp.value)}` : ''} ${row.unit}`
  }
  return `${fmt(row.value)} ${row.unit}`
}

/** Latest values as quiet stat chips; blood pressure shows as one weekly mean. */
export function SelfLatestList(props: { latest: SelfLatest[] }): React.ReactElement | null {
  const rows = props.latest.filter((row) => row.key !== 'dbp')
  if (rows.length === 0) return null
  return h('ul', { className: 'lp-self-latest' },
    ...rows.map((row) => h('li', { key: row.key },
      h('span', { className: 'lp-caption' }, row.key === 'sbp' ? '家庭血压' : row.label_zh),
      h('span', { className: 'lp-self-value' }, selfLatestText(row, props.latest)),
      h('span', { className: 'lp-caption' }, row.key === 'sbp'
        ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : '1 次读数'} · 截至 ${chineseDate(row.date)}`
        : chineseDate(row.date)))))
}

async function saveEntries(entries: Array<{ key: SelfKey; value: number; unit: string; date?: string }>): Promise<{ saved: SelfRow[]; problems: string[] }> {
  return postJson<{ ok: boolean; saved: SelfRow[]; problems: string[] }>('/api/longpi/self', { entries })
}

function numberOf(text: string): number | null {
  const trimmed = text.trim().replace(/，/g, '.').replace(/,/g, '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : Number.NaN
}

function UnitSelect(props: { id: string; spec: SelfKeySpec; value: string; onChange: (unit: string) => void; label: string }): React.ReactElement {
  const choices = unitChoices(props.spec)
  if (choices.length < 2) return h('span', { className: 'lp-unit' }, props.spec.unit)
  return h('select', {
    id: props.id, className: 'lp-select lp-unit-select', value: props.value, 'aria-label': props.label,
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => props.onChange(event.target.value),
  }, ...choices.map((unit) => h('option', { key: unit, value: unit }, unit)))
}

export function SelfMeasureForm(props: { journey: Journey | null; idPrefix: string; onNotice: Notify }): React.ReactElement {
  const all = specs(props.journey)
  const spec = (key: SelfKey) => all.find((row) => row.key === key) ?? (SELF_FALLBACK.find((row) => row.key === key) as SelfKeySpec)
  const today = props.journey?.today ?? localToday()
  const [values, setValues] = React.useState<Record<SelfKey, string>>({ waist: '', sbp: '', dbp: '', weight: '' })
  const [units, setUnits] = React.useState<Record<SelfKey, string>>({ waist: spec('waist').unit, sbp: 'mmHg', dbp: 'mmHg', weight: spec('weight').unit })
  const [date, setDate] = React.useState(today)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const set = (key: SelfKey, text: string) => {
    setError(null)
    setValues((current) => ({ ...current, [key]: text }))
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const entries: Array<{ key: SelfKey; value: number; unit: string; date: string }> = []
    for (const key of ['waist', 'sbp', 'dbp', 'weight'] as SelfKey[]) {
      const value = numberOf(values[key])
      if (value == null) continue
      if (Number.isNaN(value)) {
        setError(`${spec(key).label_zh}请填一个数字。`)
        return
      }
      entries.push({ key, value, unit: units[key], date })
    }
    if ((values.sbp.trim() === '') !== (values.dbp.trim() === '')) {
      setError('血压请同时填收缩压和舒张压（高压和低压）。')
      return
    }
    if (entries.length === 0) {
      setError('先填一项再记录。')
      return
    }
    setBusy(true)
    try {
      const result = await saveEntries(entries)
      setValues({ waist: '', sbp: '', dbp: '', weight: '' })
      props.onNotice(result.problems.length > 0 ? `已记录 ${result.saved.length} 项；${result.problems.join(' ')}` : `已记录 ${result.saved.length} 项。`, result.problems.length > 0 ? 'info' : 'good')
      notifyChanged()
    } catch (err) {
      setError(errorText(err, '没有记下，请稍后再试。'))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: SelfKey, placeholder: string) => h('div', { className: 'lp-self-field' },
    h('label', { className: 'lp-field-label', htmlFor: `${props.idPrefix}-${key}` }, spec(key).label_zh),
    h('div', { className: 'lp-input-unit' },
      h('input', {
        id: `${props.idPrefix}-${key}`, className: 'lp-input', inputMode: 'decimal', placeholder, value: values[key],
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
      }),
      h(UnitSelect, {
        id: `${props.idPrefix}-${key}-unit`, spec: spec(key), value: units[key], label: `${spec(key).label_zh}的单位`,
        onChange: (unit) => setUnits((current) => ({ ...current, [key]: unit })),
      })))

  return h('form', { className: 'lp-self-form', onSubmit: (event: React.FormEvent) => { void submit(event) }, noValidate: true },
    h('div', { className: 'lp-self-grid' },
      field('waist', '例如 86'),
      field('weight', '例如 70.5'),
      h('div', { className: 'lp-self-field lp-self-bp' },
        h('span', { className: 'lp-field-label', id: `${props.idPrefix}-bp` }, '家庭血压'),
        h('div', { className: 'lp-bp', role: 'group', 'aria-labelledby': `${props.idPrefix}-bp` },
          h('input', {
            id: `${props.idPrefix}-sbp`, className: 'lp-input', inputMode: 'numeric', placeholder: '收缩压', 'aria-label': '收缩压（高压）', value: values.sbp,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => set('sbp', event.target.value),
          }),
          h('span', { className: 'lp-bp-slash', 'aria-hidden': true }, '/'),
          h('input', {
            id: `${props.idPrefix}-dbp`, className: 'lp-input', inputMode: 'numeric', placeholder: '舒张压', 'aria-label': '舒张压（低压）', value: values.dbp,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => set('dbp', event.target.value),
          }),
          h('span', { className: 'lp-unit' }, 'mmHg'))),
      h('div', { className: 'lp-self-field' },
        h('label', { className: 'lp-field-label', htmlFor: `${props.idPrefix}-date` }, '测量日期'),
        h('input', {
          id: `${props.idPrefix}-date`, className: 'lp-input', type: 'date', value: date, max: today, min: '1990-01-01',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value || today),
        }))),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('div', { className: 'lp-form-actions' },
      h(Btn, { type: 'submit', disabled: busy }, busy ? '记录中…' : '记录'),
      h('span', { className: 'lp-caption' }, '单位可以选斤、尺或寸，会换算成 kg 和 cm。')))
}

export function SelfRecent(props: { onNotice: Notify }): React.ReactElement | null {
  const { data, loading } = useSelfRows()
  const [busy, setBusy] = React.useState<string | null>(null)
  const rows = (data?.rows ?? []).slice(0, 6)
  if (loading && !data) return null
  if (rows.length === 0) return h('p', { className: 'lp-caption lp-self-empty' }, '还没有自测记录。')
  async function remove(row: SelfRow): Promise<void> {
    setBusy(row.id)
    try {
      await deleteJson(`/api/longpi/self?id=${encodeURIComponent(row.id)}`)
      props.onNotice(`已删除 ${chineseDate(row.date)}的${labelOf(row.key)}。`, 'good')
      notifyChanged()
    } catch (err) {
      props.onNotice(`没有删除：${errorText(err, '请稍后再试')}`, 'bad')
    } finally {
      setBusy(null)
    }
  }
  return h('div', { className: 'lp-self-recent' },
    h('div', { className: 'lp-subhead' }, '最近记录'),
    h('ul', { className: 'lp-rows' },
      ...rows.map((row) => h('li', { key: row.id, className: 'lp-row' },
        h('span', { className: 'lp-row-main' },
          h('span', null, labelOf(row.key)),
          h('span', { className: 'lp-num' }, ` ${fmt(row.value)} ${row.unit}`),
          row.given ? h('span', { className: 'lp-caption' }, `（记为 ${fmt(row.given.value)} ${row.given.unit}）`) : null),
        h('span', { className: 'lp-caption' }, chineseDate(row.date)),
        h('button', {
          type: 'button', className: 'lp-iconbtn', disabled: busy === row.id,
          'aria-label': `删除 ${chineseDate(row.date)} 的${labelOf(row.key)} ${fmt(row.value)} ${row.unit}`,
          onClick: () => { void remove(row) },
        }, h(Icon, { name: 'trash', size: 14 }))))))
}

function labelOf(key: SelfKey): string {
  return SELF_FALLBACK.find((row) => row.key === key)?.label_zh ?? key
}

/** One field for an add-on the person can measure now (waist, blood pressure), right in the checklist. */
export function InlineSelf(props: { journey: Journey | null; selfKey: SelfKey; idPrefix: string; onNotice: Notify }): React.ReactElement {
  const all = specs(props.journey)
  const bp = props.selfKey === 'sbp' || props.selfKey === 'dbp'
  const spec = all.find((row) => row.key === props.selfKey) ?? (SELF_FALLBACK.find((row) => row.key === props.selfKey) as SelfKeySpec)
  const [value, setValue] = React.useState('')
  const [dbp, setDbp] = React.useState('')
  const [unit, setUnit] = React.useState(spec.unit)
  const [busy, setBusy] = React.useState(false)
  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const first = numberOf(value)
    const second = bp ? numberOf(dbp) : null
    if (first == null || Number.isNaN(first) || (bp && (second == null || Number.isNaN(second)))) {
      props.onNotice(bp ? '请填收缩压和舒张压两个数字。' : `${spec.label_zh}请填一个数字。`, 'bad')
      return
    }
    setBusy(true)
    try {
      const entries = bp
        ? [{ key: 'sbp' as SelfKey, value: first, unit: 'mmHg' }, { key: 'dbp' as SelfKey, value: second as number, unit: 'mmHg' }]
        : [{ key: props.selfKey, value: first, unit }]
      const result = await saveEntries(entries)
      setValue('')
      setDbp('')
      props.onNotice(result.problems.length > 0 ? result.problems.join(' ') : `已记录${bp ? '血压' : spec.label_zh}，正在重新计算。`, result.problems.length > 0 ? 'info' : 'good')
      notifyChanged()
    } catch (err) {
      props.onNotice(errorText(err, '没有记下，请稍后再试。'), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return h('form', { className: 'lp-inline-self', onSubmit: (event: React.FormEvent) => { void submit(event) }, noValidate: true },
    h('input', {
      className: 'lp-input', inputMode: 'decimal', value, placeholder: bp ? '收缩压' : spec.label_zh,
      'aria-label': bp ? '收缩压（高压）' : `${spec.label_zh}`, id: `${props.idPrefix}-${props.selfKey}`,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    }),
    bp ? h('span', { className: 'lp-bp-slash', 'aria-hidden': true }, '/') : null,
    bp ? h('input', {
      className: 'lp-input', inputMode: 'decimal', value: dbp, placeholder: '舒张压', 'aria-label': '舒张压（低压）',
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDbp(event.target.value),
    }) : null,
    bp ? h('span', { className: 'lp-unit' }, 'mmHg') : h(UnitSelect, { id: `${props.idPrefix}-${props.selfKey}-unit`, spec, value: unit, label: `${spec.label_zh}的单位`, onChange: setUnit }),
    h(Btn, { type: 'submit', size: 'sm', disabled: busy }, busy ? '记录中' : '记录'))
}
