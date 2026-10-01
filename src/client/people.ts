// Whose record the page shows: the account holder (我) or a family member added here. Switching reloads the page,
// so every section, and the chat's next turn, reads the chosen person's store.

import React from 'react'
import { getJson, postJson, setShownPerson } from './api.ts'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Icon } from './icons.ts'
import { Btn, Segmented } from './ui.ts'

const h = React.createElement

interface PersonRow { id: string; label_zh: string; name: string; connected: boolean; managed: boolean; link_error_zh?: string }
interface PeopleView { ok: boolean; active: string; people: PersonRow[]; can_create_in_mirobody: boolean; create_hint_zh: string; warning_zh?: string }

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

// The picker and the notice under the header read the same list: fetch it once per page load.
let peopleLoad: Promise<PeopleView> | null = null
function loadPeople(): Promise<PeopleView> {
  peopleLoad ??= getJson<PeopleView>('/api/longpi/people').then((v) => { setShownPerson(v.active); return v })
  peopleLoad.catch(() => { peopleLoad = null })
  return peopleLoad
}

function usePeople(): PeopleView | null {
  const [view, setView] = React.useState<PeopleView | null>(null)
  React.useEffect(() => {
    let live = true
    void loadPeople().then((v) => { if (live) setView(v) }).catch(() => { if (live) setView(null) })
    return () => { live = false }
  }, [])
  return view
}

/**
 * An option's text. The account holder's records connect by themselves, so 我 carries no connection suffix (#11);
 * a family member gets one only when their link needs renewing.
 */
function optionText(p: PersonRow): string {
  const name = p.id !== 'self' && p.name && p.name !== p.label_zh ? `（${p.name}）` : ''
  const suffix = p.id !== 'self' && p.link_error_zh ? ' · 链接待续期' : ''
  return `${p.label_zh}${name}${suffix}`
}

type SexValue = 'male' | 'female'

function AddPersonDialog(props: { view: PeopleView; onClose: () => void }): React.ReactElement {
  const { view } = props
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState({ label_zh: '', name: '', sex: '' as SexValue | '', birth_year: '', mcp_url: '' })
  const ready = form.label_zh.trim() !== '' && form.name.trim().length >= 2 && form.sex !== ''
  const add = async () => {
    if (!ready) return
    setBusy(true); setError('')
    try {
      const res = await postJson<PeopleView & { person?: { id: string } }>('/api/longpi/people', {
        label_zh: form.label_zh, name: form.name, sex: form.sex, birth_year: form.birth_year ? Number(form.birth_year) : null,
        ...(form.mcp_url.trim() ? { mcp_url: form.mcp_url.trim() } : {}),
      })
      if (res.person) await postJson('/api/longpi/people/active', { id: res.person.id })
      window.location.reload()
    } catch (e) {
      setError(errText(e, '添加失败，请稍后再试')); setBusy(false)
    }
  }
  const input = (key: 'label_zh' | 'name' | 'birth_year' | 'mcp_url', label: string, extra: Record<string, unknown> = {}, hint = '', full = false) => {
    const id = 'lp-person-' + key
    return h('div', { className: `lp-field ${full ? 'lp-field-full' : ''}`.trim(), key },
      h('label', { className: 'lp-field-label', htmlFor: id }, label),
      h('input', {
        id, className: 'lp-input', value: form[key], disabled: busy,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
        ...(hint ? { 'aria-describedby': `${id}-hint` } : {}), ...extra,
      }),
      hint ? h('span', { className: 'lp-caption', id: `${id}-hint` }, hint) : null)
  }
  return h(Modal, { open: true, title: '添加家人', onClose: props.onClose, headless: true, className: 'lp-people-modal' },
    h('form', {
      className: 'lp lp-people-dialog', noValidate: true,
      onSubmit: (e: React.FormEvent) => { e.preventDefault(); void add() },
    },
      h('div', { className: 'lp-people-dialog-head' },
        h('h2', { className: 'lp-h2' }, '添加家人'),
        h('button', { type: 'button', className: 'lp-iconbtn', 'aria-label': '关闭', onClick: props.onClose }, h(Icon, { name: 'close', size: 18 }))),
      h('p', { className: 'lp-muted lp-small' }, view.can_create_in_mirobody
        ? '会在你的 Mirobody 账号下为家人建一份独立的档案（家人不需要自己的账号）。家人的体检、方案和深度分析都和你的分开。'
        : /个人链接/.test(view.create_hint_zh) ? view.create_hint_zh.trim() : `${view.create_hint_zh.trim().replace(/[。.]?$/, '。')}或者粘贴家人自己的 Mirobody 个人链接。`),
      h('div', { className: 'lp-form-grid' },
        input('label_zh', '称呼', { placeholder: '如 爸爸、妈妈', autoFocus: true }),
        input('birth_year', '出生年份', { inputMode: 'numeric', placeholder: '例如 1960' }),
        // Full width, so the hint under it does not break into a one-character line (P2-10).
        input('name', '姓名', { autoComplete: 'off' }, '报告上的真实名字，用来核对上传的报告是不是本人的', true),
        h('div', { className: 'lp-field lp-field-full', key: 'sex' },
          h(Segmented<SexValue>, {
            name: 'lp-person-sex', label: '生理性别', value: form.sex, disabled: busy,
            options: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }],
            onChange: (sex) => setForm({ ...form, sex }),
          })),
        view.can_create_in_mirobody ? null : input('mcp_url', '家人的 Mirobody 个人链接（可选）', {}, '', true)),
      error ? h('div', { className: 'lp-callout lp-callout-warn', role: 'alert' },
        h(Icon, { name: 'warn', size: 14 }), h('span', { className: 'lp-callout-body' }, error)) : null,
      h('div', { className: 'lp-modal-actions' },
        h(Btn, { type: 'button', variant: 'outline', onClick: props.onClose, disabled: busy }, '取消'),
        h(Btn, { type: 'submit', disabled: busy || !ready }, busy ? '添加中' : '添加'))))
}

/**
 * Whose record the page shows, in the header's control row: the person picker, 添加家人, then the rest of the
 * row (`children`: 去健康对话, 刷新). Narrow, the picker stays left and the actions go right.
 */
export function PeoplePicker(props: { children?: React.ReactNode }): React.ReactElement {
  const view = usePeople()
  const [adding, setAdding] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const choose = async (id: string) => {
    if (!view || id === view.active) return
    setBusy(true); setError('')
    try {
      await postJson<PeopleView>('/api/longpi/people/active', { id })
      window.location.reload()                      // a renewal problem shows under the header after the reload
    } catch (e) {
      setError(errText(e, '切换失败')); setBusy(false)
    }
  }

  return h(React.Fragment, null,
    view ? h('span', { className: 'lp-people' },
      h('label', { className: 'lp-sr', htmlFor: 'lp-people-select' }, '在看谁的记录'),
      h('select', {
        id: 'lp-people-select', className: 'lp-select lp-select-sm lp-people-select', value: view.active, disabled: busy,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { void choose(e.target.value) },
      }, ...view.people.map((p) => h('option', { key: p.id, value: p.id }, optionText(p))))) : null,
    h('span', { className: 'lp-header-end' },
      view ? h('button', { type: 'button', className: 'lp-linkbtn', onClick: () => setAdding(true), disabled: busy },
        h(Icon, { name: 'plus', size: 14 }), '添加家人') : null,
      props.children),
    error ? h('p', { className: 'lp-form-error lp-people-error', role: 'alert' }, error) : null,
    view && adding ? h(AddPersonDialog, { view, onClose: () => setAdding(false) }) : null)
}

/** The shown family member's link problem, said once under the header (the picker only says 链接待续期). */
export function PersonNotice(): React.ReactElement | null {
  const view = usePeople()
  const shown = view?.people.find((p) => p.id === view.active)
  if (!shown || shown.id === 'self' || !shown.link_error_zh) return null
  return h('div', { className: 'lp-callout lp-callout-warn lp-people-notice', role: 'alert' },
    h(Icon, { name: 'warn', size: 14 }),
    h('span', { className: 'lp-callout-body' }, shown.link_error_zh))
}
