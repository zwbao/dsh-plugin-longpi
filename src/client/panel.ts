import React from 'react'
import { SUGGESTED, VIEW_ID } from './constants.ts'

interface IndicatorRow { name?: string; value?: string; unit?: string }
interface MedicationRow { name?: string; status?: string }
interface MatchHit { name: string; blurb?: string; why?: string[]; has_script?: boolean; runnable?: { status?: string; missing?: string[] } }
interface Readout { key: string; label_zh?: string; value?: number | string | null; unit?: string; at?: string; skill?: string }
interface Board {
  version?: string
  profile?: { displayName?: string; birthYear?: number | null; age?: number | null; sex?: string }
  estimated_age?: number | null
  skills?: { count?: number; personal?: number; version?: string; revision?: string; error?: string; domains?: Array<{ domain: string; count: number }> }
  mirobody?: {
    mounted?: boolean
    error?: string
    engine?: { ok?: boolean; version?: string; error?: string }
    mcp?: { configured?: boolean; host?: string }
  }
  records?: { status?: string; error?: string; indicators?: IndicatorRow[]; medications?: MedicationRow[] }
  dispatch?: { matches?: MatchHit[]; note?: string }
  near?: MatchHit[]
  readouts?: Readout[]
  receipts?: Array<{ at?: string; skill?: string; ok?: boolean; error_kind?: string }>
  boundary?: string
}

function api(path: string): string {
  const token = new URLSearchParams(window.location.search).get('token')
  if (!token) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}token=${encodeURIComponent(token)}`
}

export function registerPanel(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    { name: 'conversation.view', id: VIEW_ID, order: 18, label: () => '健康看板' },
    PanelView,
  ))
}

function PanelView(): React.ReactElement {
  const [board, setBoard] = React.useState<Board | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [displayName, setDisplayName] = React.useState('')
  const [birthYear, setBirthYear] = React.useState('')
  const [age, setAge] = React.useState('')
  const [sex, setSex] = React.useState('unknown')
  const [question, setQuestion] = React.useState('')
  const [matches, setMatches] = React.useState<MatchHit[] | null>(null)
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(() => {
    fetch(api('/api/longpi/board'), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Board>
      })
      .then((json) => {
        setBoard(json)
        setError(null)
        setDisplayName(json.profile?.displayName ?? '')
        setBirthYear(json.profile?.birthYear ? String(json.profile.birthYear) : '')
        setAge(json.profile?.age == null ? '' : String(json.profile.age))
        setSex(json.profile?.sex || 'unknown')
        setMatches(json.dispatch?.matches ?? [])
        setNote(json.dispatch?.note ?? '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '看板没有打开'))
  }, [])

  React.useEffect(() => { load() }, [load])

  async function saveProfile(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(api('/api/longpi/profile'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName,
          birthYear: birthYear.trim() ? Number(birthYear) : null,
          age: age.trim() ? Number(age) : null,
          sex,
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '档案没有保存')
    } finally {
      setBusy(false)
    }
  }

  async function ask(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(api(`/api/longpi/match?q=${encodeURIComponent(question)}`), { credentials: 'include' })
      const json = await res.json() as { matches?: MatchHit[]; note?: string; error?: string }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setMatches(json.matches ?? [])
      setNote(json.note ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '没有匹配到技能')
    } finally {
      setBusy(false)
    }
  }

  const engine = board?.mirobody?.engine
  const engineLine = !board?.mirobody?.mounted
    ? (board?.mirobody?.error || 'Mirobody 未挂上')
    : (engine?.ok ? `引擎 ${engine.version || '就绪'}` : (engine?.error || '引擎未就绪'))
  const recordLine = board?.records?.status === 'ok'
    ? `${board.records.indicators?.length ?? 0} 项检查，${board.records.medications?.length ?? 0} 条用药`
    : (board?.records?.status === 'unconfigured' ? '还没有接上记录服务器' : (board?.records?.error || '记录没读到'))

  return React.createElement(
    'div',
    { className: 'lp-dash' },
    React.createElement('div', { className: 'lp-kicker' }, `LongPi ${board?.version ?? ''}`),
    React.createElement('h2', { className: 'lp-title' }, displayName.trim() || '个人长寿看板'),
    React.createElement('p', { className: 'lp-lead' }, '技能按你的问题和已经在档的检查来调度。公式留在技能里。这里不诊断，也不改处方。'),
    error ? React.createElement('p', { className: 'lp-bad' }, error) : null,
    React.createElement(
      'div',
      { className: 'lp-grid' },
      React.createElement('section', { className: 'lp-card' },
        React.createElement('h3', null, '技能库'),
        React.createElement('p', { className: board?.skills?.error ? 'lp-bad' : 'lp-ok' },
          board?.skills?.error || `${board?.skills?.personal ?? board?.skills?.count ?? 0} 个个人可用 · 共 ${board?.skills?.count ?? 0} 个`),
        React.createElement('p', { className: 'lp-muted' }, `版本 ${board?.skills?.version || '未发布'} · ${board?.skills?.revision || '未读到提交'}`)),
      React.createElement('section', { className: 'lp-card' },
        React.createElement('h3', null, '数据缝'),
        React.createElement('p', { className: engine?.ok ? 'lp-ok' : 'lp-bad' }, engineLine),
        React.createElement('p', null, recordLine),
        React.createElement('p', { className: 'lp-muted' }, board?.mirobody?.mcp?.configured ? (board.mirobody.mcp.host || '记录服务器已配置') : '术语工具不需要记录服务器')),
      React.createElement('section', { className: 'lp-card' },
        React.createElement('h3', null, '实足年龄'),
        React.createElement('p', null, board?.profile?.age == null ? '还没写下实足年龄' : `${board.profile.age} 岁`),
        React.createElement('p', { className: 'lp-muted' }, board?.estimated_age == null ? '出生年可用来估算，估算不会自动送进技能' : `按出生年约 ${board.estimated_age} 岁`)),
    ),
    React.createElement('section', { className: 'lp-block' },
      React.createElement('h3', null, '这个人'),
      React.createElement('form', { className: 'lp-form', onSubmit: (event: React.FormEvent) => { void saveProfile(event) } },
        React.createElement('input', { 'aria-label': '称呼', placeholder: '称呼', value: displayName, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value) }),
        React.createElement('input', { 'aria-label': '出生年', placeholder: '出生年', inputMode: 'numeric', value: birthYear, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setBirthYear(event.target.value) }),
        React.createElement('input', { 'aria-label': '实足年龄', placeholder: '实足年龄', inputMode: 'numeric', value: age, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setAge(event.target.value) }),
        React.createElement('select', { 'aria-label': '性别', value: sex, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setSex(event.target.value) },
          React.createElement('option', { value: 'unknown' }, '性别未填'),
          React.createElement('option', { value: 'female' }, '女'),
          React.createElement('option', { value: 'male' }, '男'),
          React.createElement('option', { value: 'other' }, '其他')),
        React.createElement('button', { type: 'submit', disabled: busy }, busy ? '保存中' : '保存')),
    ),
    (board?.readouts ?? []).length > 0
      ? React.createElement('section', { className: 'lp-block', style: { marginTop: 12 } },
        React.createElement('h3', null, '最近读出'),
        ...(board?.readouts ?? []).map((item) => React.createElement('div', { className: 'lp-row', key: item.key },
          React.createElement('span', null, item.label_zh || item.key),
          React.createElement('span', null, `${formatValue(item.value)}${item.unit && item.unit !== '1' ? ` ${unitLabel(item.unit)}` : ''} · ${(item.at || '').slice(0, 10)}`))))
      : null,
    (board?.near ?? []).length > 0
      ? React.createElement('section', { className: 'lp-block', style: { marginTop: 12 } },
        React.createElement('h3', null, '差一两项就能跑'),
        ...(board?.near ?? []).map((item) => React.createElement('div', { className: 'lp-skill', key: `near-${item.name}` },
          React.createElement('span', { className: 'lp-name' }, item.name),
          React.createElement('span', { className: 'lp-why' }, `还缺 ${(item.runnable?.missing ?? []).join('、')}`))))
      : null,
    React.createElement('section', { className: 'lp-block', style: { marginTop: 12 } },
      React.createElement('h3', null, '这次调度'),
      React.createElement('form', { className: 'lp-search', onSubmit: (event: React.FormEvent) => { void ask(event) } },
        React.createElement('input', { 'aria-label': '想读的方法', placeholder: '例如：我的生物年龄、甲基化、NMN 有用吗', value: question, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuestion(event.target.value) }),
        React.createElement('button', { type: 'submit', disabled: busy }, '匹配')),
      note ? React.createElement('p', { className: 'lp-muted' }, note) : null,
      ...(matches ?? []).map((item) => React.createElement('div', { className: 'lp-skill', key: item.name },
        React.createElement('span', { className: 'lp-name' }, item.name),
        React.createElement('span', { className: 'lp-why' }, (item.why ?? []).join('；') || item.blurb || ''))),
      React.createElement('div', { className: 'lp-domains' },
        ...(board?.skills?.domains ?? []).slice(0, 16).map((item) => React.createElement('span', { className: 'lp-domain', key: item.domain }, `${item.domain} ${item.count}`)))),
    React.createElement('section', { className: 'lp-block', style: { marginTop: 12 } },
      React.createElement('h3', null, '检查'),
      (board?.records?.indicators ?? []).length === 0
        ? React.createElement('p', { className: 'lp-muted' }, '没有读到检查。接上 Mirobody 之后，这里只显示记录里有的项目。')
        : (board?.records?.indicators ?? []).map((item) => React.createElement('div', { className: 'lp-row', key: item.name },
          React.createElement('span', null, item.name),
          React.createElement('span', null, [item.value, item.unit].filter(Boolean).join(' ') || '在档')))),
    React.createElement('section', { className: 'lp-block', style: { marginTop: 12 } },
      React.createElement('h3', null, '用药计划'),
      (board?.records?.medications ?? []).length === 0
        ? React.createElement('p', { className: 'lp-muted' }, '没有读到用药计划。计划不是已经服下的证据，也不能在这里改剂量。')
        : (board?.records?.medications ?? []).map((item) => React.createElement('div', { className: 'lp-row', key: item.name },
          React.createElement('span', null, item.name),
          React.createElement('span', null, item.status || '在档')))),
    (board?.receipts ?? []).length > 0
      ? React.createElement('section', { className: 'lp-block', style: { marginTop: 12 } },
        React.createElement('h3', null, '最近一次读出'),
        ...(board?.receipts ?? []).map((item) => React.createElement('div', { className: 'lp-row', key: `${item.at}-${item.skill}` },
          React.createElement('span', null, item.skill),
          React.createElement('span', null, item.ok ? '脚本跑完' : (item.error_kind === 'input_problems' || item.error_kind === 'invalid_inputs' ? '输入没有通过检查' : '脚本没有给出读出')))))
      : null,
    React.createElement('p', { className: 'lp-note' }, board?.boundary || '这不是诊断，也不能改处方。紧急情况请拨打 120。'),
  )
}

function formatValue(value: number | string | null | undefined): string {
  if (value == null) return '未计算'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return value
}

function unitLabel(unit: string): string {
  return unit === 'a' ? '岁' : unit
}

export function registerDock(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'dsh-plugin-longpi', order: 18 },
    SuggestDock,
  ))
}

function SuggestDock(): React.ReactElement {
  const [copied, setCopied] = React.useState<string | null>(null)
  return React.createElement(
    'div',
    { className: 'lp-dock' },
    React.createElement('span', { className: 'lp-dock-kicker' }, 'LongPi'),
    ...SUGGESTED.map((item) => React.createElement('button', {
      key: item.id,
      type: 'button',
      className: copied === item.id ? 'lp-chip lp-chip-on' : 'lp-chip',
      onClick: () => {
        void navigator.clipboard.writeText(item.zh).then(() => setCopied(item.id)).catch(() => setCopied(item.id))
      },
    }, item.zh)),
  )
}

export function registerSidebar(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-plugin-longpi', order: 18 },
    SidebarMark,
  ))
}

function SidebarMark(props: { wide?: boolean }): React.ReactElement {
  return React.createElement(
    'span',
    { className: 'lp-sidebar', title: 'LongPi' },
    React.createElement('span', { className: 'lp-dot' }),
    props.wide === false ? null : React.createElement('span', null, 'LongPi'),
  )
}
