// LongPi's page in DSH's settings (settings.section, id longpi): the things
// changed once in a while, out of the health page. 提醒 (one switch and its
// time, the rest under 更多设置), 数据连接 (status; the manual form waits under
// 高级), 一起研究 (one switch), 隐私与数据 (where things live and what leaves
// this computer), and 高级：方法库. Blocks follow docs/design-system.md §5:
// a 15/600 title, a 1px line between blocks, Switch for every on/off control.

import React from 'react'
import { getJson, postJson } from './api.ts'
import { ConnectionPanel, ConnectionStatus } from './connection.ts'
import { FollowupPanel } from './followup.ts'
import { MethodsSection } from './methods.ts'
import { settingsSections } from './registry.ts'
import { useBoard, useConnection, useJourney } from './store.ts'
import type { Face } from './types.ts'
import { LinkButton, Switch, useNotice } from './ui.ts'

const h = React.createElement

/** Registered settings sections this page already places itself (the note sits under 提醒; 研究 is the 一起研究 block). */
const PLACED = new Set(['season-reminder', 'science'])

function Block(props: { id: string; title: string; hint?: string; children?: React.ReactNode }): React.ReactElement {
  return h('section', { className: 'lp-set-block', id: props.id, 'aria-labelledby': `${props.id}-title` },
    h('div', { className: 'lp-set-titles' },
      h('h3', { className: 'lp-set-title', id: `${props.id}-title` }, props.title),
      props.hint ? h('p', { className: 'lp-caption' }, props.hint) : null),
    props.children)
}

function ScienceSwitch(): React.ReactElement {
  const [mode, setMode] = React.useState<'local' | 'off'>('local')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    void getJson<{ preference?: string; mode?: string }>('/api/longpi/science/invite').then((row) => {
      setMode(row.preference === 'off' || row.mode === 'off' ? 'off' : 'local')
    }).catch(() => setMode('local'))
  }, [])
  const set = (next: 'local' | 'off') => {
    setBusy(true)
    setError(null)
    void postJson('/api/longpi/science/preference', { mode: next })
      .then(() => setMode(next))
      .catch(() => setError('没有保存，请稍后再试。'))
      .finally(() => setBusy(false))
  }
  return h('div', { className: 'lp-set-body' },
    h(Switch, { id: 'lp-set-science-on', checked: mode === 'local', busy, disabled: busy, label: '在本机参与研究', onChange: (next) => set(next ? 'local' : 'off') }),
    h('p', { className: 'lp-set-text lp-muted' }, '开着时，研究页、个人小试验和本机统计都能用，数据只保存在这台电脑上。关掉后这些会停。不满 18 岁时始终关闭。'),
    error ? h('p', { className: 'lp-form-error', role: 'alert' }, error) : null,
    h('a', { className: 'lp-textbtn', href: '/api/longpi/science/community?view=page' }, '打开研究页 →'))
}

function Privacy(): React.ReactElement {
  const rows: Array<[string, string]> = [
    ['存在哪里', '档案、方案、记录、自测和提醒只保存在这台电脑上。体检和手环的原件留在原来的地方，这里只读。'],
    ['什么会发给模型', '和 LongPi 对话时，你的问题和为回答读出的档案、化验，在你同意后才会发给回答用的人工智能（默认 DeepSeek）。不对话就不发送。'],
    ['发给手机', '默认不用。只有你自己配置后才会发，提醒里不写化验数字和项目名字。'],
  ]
  return h('div', { className: 'lp-set-body' },
    h('dl', { className: 'lp-kv lp-set-kv' },
      ...rows.flatMap(([title, text]) => [h('dt', { key: `t:${title}` }, title), h('dd', { key: `d:${title}` }, text)])),
    h('div', { className: 'lp-actions' },
      h(LinkButton, { href: '/api/longpi/report', icon: 'download', download: 'longpi-report.md' }, '导出报告')))
}

function Connection(): React.ReactElement {
  const { data } = useConnection()
  return h('div', { className: 'lp-set-body' },
    data ? h(ConnectionStatus, { connection: data }) : null,
    h('details', null, h('summary', null, '高级：手动连接（一般不需要）'), h(ConnectionPanel, { idPrefix: 'lp-set-conn', hideStatus: true })))
}

function Methods(props: { onNotice: (text: string, tone?: 'info' | 'good' | 'bad') => void }): React.ReactElement {
  const board = useBoard()
  return h(MethodsSection, { board: board.data, loading: board.loading, error: board.error, onNotice: props.onNotice })
}

export interface SettingsPageProps extends Partial<Face> {
  close?: () => void
}

export function LongPiSettings(props: SettingsPageProps): React.ReactElement {
  const [notice, notify] = useNotice()
  const [advanced, setAdvanced] = React.useState(false)
  // Reads the journey the reminder pill already keeps in the store (no new endpoint); the store may refresh it if
  // stale, as it does for any surface.
  const { journey } = useJourney()
  const extra = settingsSections().filter((section) => !PLACED.has(section.id))
  return h('div', { className: 'lp lp-settings' },
    h('div', { className: 'lp-set-head' },
      h('h2', { className: 'lp-h2' }, 'LongPi'),
      props.openPage ? h('button', { type: 'button', className: 'lp-textbtn', onClick: () => { props.close?.(); props.openPage?.() } }, '打开健康页 →') : null),
    notice ? h('div', { className: 'lp-notice-slot' }, notice) : null,
    h(Block, { id: 'lp-set-followup', title: '提醒', hint: '默认关闭。这个窗口关了，就不会响。' }, h(FollowupPanel, { onNotice: notify })),
    // Paired automatically; the manual form is for whoever installs LongPi against another Mirobody.
    h(Block, { id: 'lp-set-connection', title: '数据连接' }, h(Connection)),
    h(Block, { id: 'lp-set-science', title: '一起研究' }, h(ScienceSwitch)),
    h(Block, { id: 'lp-set-privacy', title: '隐私与数据' },
      h(Privacy),
      ...extra.map((section) => h('div', { key: section.id, className: 'lp-set-extra' }, h(section.Component, { embedded: true })))),
    h('section', { className: 'lp-set-block', id: 'lp-set-methods', 'aria-label': '高级' },
      h('details', { onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => setAdvanced(event.currentTarget.open) },
        h('summary', null, '高级：方法库和安装细节'),
        // The board is read only once the section is opened: most people never need it.
        advanced ? h(Methods, { onNotice: notify }) : null)),
    journey?.version ? h('p', { className: 'lp-caption lp-set-version' }, `LongPi ${journey.version}`) : null)
}
