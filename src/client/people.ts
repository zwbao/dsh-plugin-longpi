// Whose record the page shows: the account holder (我) or a family member added here. Switching reloads the page,
// so every section, and the chat's next turn, reads the chosen person's store.

import React from 'react'
import { getJson, postJson } from './api.ts'
import { Btn } from './ui.ts'

const h = React.createElement

interface PersonRow { id: string; label_zh: string; name: string; connected: boolean; managed: boolean }
interface PeopleView { ok: boolean; active: string; people: PersonRow[]; can_create_in_mirobody: boolean; create_hint_zh: string; warning_zh?: string }

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export function PeoplePicker(): React.ReactElement | null {
  const [view, setView] = React.useState<PeopleView | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState({ label_zh: '', name: '', sex: '', birth_year: '', mcp_url: '' })
  React.useEffect(() => { void getJson<PeopleView>('/api/longpi/people').then(setView).catch(() => setView(null)) }, [])
  if (!view) return null

  const choose = async (id: string) => {
    if (id === view.active) return
    setBusy(true); setError('')
    try {
      const res = await postJson<PeopleView>('/api/longpi/people/active', { id })
      if (res.warning_zh) window.alert?.(res.warning_zh)
      window.location.reload()
    } catch (e) {
      setError(errText(e, '切换失败')); setBusy(false)
    }
  }
  const add = async () => {
    setBusy(true); setError('')
    try {
      const res = await postJson<PeopleView & { person?: { id: string } }>('/api/longpi/people', {
        label_zh: form.label_zh, name: form.name, sex: form.sex, birth_year: form.birth_year ? Number(form.birth_year) : null,
        ...(form.mcp_url.trim() ? { mcp_url: form.mcp_url.trim() } : {}),
      })
      if (res.person) await postJson('/api/longpi/people/active', { id: res.person.id })
      window.location.reload()
    } catch (e) {
      setError(errText(e, '添加失败')); setBusy(false)
    }
  }
  const field = (key: keyof typeof form, label: string, extra: Record<string, unknown> = {}) =>
    h('label', { className: 'lp-field', key },
      h('span', { className: 'lp-label' }, label),
      h('input', { className: 'lp-input', value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }), 'aria-label': label, ...extra }))

  return h('div', { className: 'lp-people' },
    h('label', { className: 'lp-people-pick' },
      h('span', { className: 'lp-label' }, '在看'),
      h('select', {
        className: 'lp-input', value: view.active, disabled: busy, 'aria-label': '在看谁的记录',
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { void choose(e.target.value) },
      }, ...view.people.map((p) => h('option', { key: p.id, value: p.id }, `${p.label_zh}${p.id !== 'self' && p.name && p.name !== p.label_zh ? `（${p.name}）` : ''}${p.connected ? '' : ' · 未连接'}`)))),
    h('button', { type: 'button', className: 'lp-linkbtn', onClick: () => setAdding(!adding), disabled: busy }, adding ? '取消' : '添加家人'),
    adding ? h('div', { className: 'lp-card lp-people-add' },
      h('p', { className: 'lp-muted' }, view.can_create_in_mirobody
        ? '会在你的 Mirobody 账号下为家人建一份独立的档案（家人不需要自己的账号）。家人的体检、方案和深度分析都和你的分开。'
        : `${view.create_hint_zh} 或者粘贴家人自己的 Mirobody 个人链接。`),
      field('label_zh', '称呼（如 爸爸、妈妈）'),
      field('name', '姓名（报告上的名字，用来核对上传的报告是不是本人的）'),
      h('label', { className: 'lp-field' }, h('span', { className: 'lp-label' }, '生理性别'),
        h('select', { className: 'lp-input', value: form.sex, 'aria-label': '生理性别', onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, sex: e.target.value }) },
          h('option', { value: '' }, '请选择'), h('option', { value: 'male' }, '男'), h('option', { value: 'female' }, '女'))),
      field('birth_year', '出生年份', { inputMode: 'numeric', placeholder: '例如 1960' }),
      view.can_create_in_mirobody ? null : field('mcp_url', '家人的 Mirobody 个人链接（可选）'),
      error ? h('p', { className: 'lp-muted', role: 'alert' }, error) : null,
      h(Btn, { onClick: () => { void add() }, disabled: busy || !form.label_zh.trim() || !form.sex }, '添加')) : null,
    !adding && error ? h('p', { className: 'lp-muted', role: 'alert' }, error) : null)
}
