// LongPi's page in DSH's settings (settings.section, id longpi): the things
// changed once in a while, out of the health page. 随访提醒 (one switch and
// its time, the rest under 更多设置), 数据连接 (the Mirobody address, tested
// before it is saved), 隐私与数据 (where things live and what leaves this
// computer), and 高级：方法库.

import React from 'react'
import { getJson, postJson } from './api.ts'
import { ConnectionPanel } from './connection.ts'
import { FollowupPanel } from './followup.ts'
import { Icon } from './icons.ts'
import { MethodsSection } from './methods.ts'
import { settingsSections } from './registry.ts'
import { useBoard } from './store.ts'
import type { Face } from './types.ts'
import { LinkButton, useNotice } from './ui.ts'

const h = React.createElement

function Block(props: { id: string; title: string; hint?: string; children?: React.ReactNode }): React.ReactElement {
  return h('section', { className: 'lp-set-block', id: props.id, 'aria-labelledby': `${props.id}-title` },
    h('h3', { className: 'lp-set-title', id: `${props.id}-title` }, props.title, props.hint ? h('span', { className: 'lp-optional' }, props.hint) : null),
    props.children)
}

function ScienceSwitch(): React.ReactElement {
  const [mode, setMode] = React.useState<'local' | 'off'>('local')
  React.useEffect(() => {
    void getJson<{ preference?: string; mode?: string }>('/api/longpi/science/invite').then((row) => {
      setMode(row.preference === 'off' || row.mode === 'off' ? 'off' : 'local')
    }).catch(() => setMode('local'))
  }, [])
  const set = (next: 'local' | 'off') => {
    void postJson('/api/longpi/science/preference', { mode: next }).then(() => setMode(next)).catch(() => {})
  }
  return h('div', null,
    h('p', { className: 'lp-muted' }, '本机上的研究默认开着：研究页、个人小试验和本机统计都不用另做设置。关掉之后这些会停。不满 18 岁本来就是关的。'),
    h('div', { className: 'lp-form-actions' },
      h('button', { type: 'button', className: mode === 'local' ? 'lp-toggle lp-toggle-on' : 'lp-toggle', onClick: () => set('local') }, '开着'),
      h('button', { type: 'button', className: mode === 'off' ? 'lp-toggle lp-toggle-on' : 'lp-toggle', onClick: () => set('off') }, '关掉')))
}

function Privacy(): React.ReactElement {
  const rows: Array<[string, string, string]> = [
    ['lock', '存在哪里', '档案、方案、记录、自测和提醒只保存在这台电脑上。体检和手环的原件留在你原来放报告的地方，这里只读。'],
    ['send', '什么会发给模型', '和 LongPi 对话时，你的问题，以及为回答而读出的档案和化验，在你同意之后才会发给用来回答的人工智能（默认 DeepSeek）。不对话就不会发送。'],
    ['bell', '发给手机', '默认不使用。只有你自己配了之后才会发。提醒里不写化验数字，也不写项目名字。'],
  ]
  return h('div', null,
    h('ul', { className: 'lp-privacy' },
      ...rows.map(([icon, title, text]) => h('li', { key: title, className: 'lp-privacy-row' },
        h('span', { className: 'lp-consent-icon', 'aria-hidden': true }, h(Icon, { name: icon, size: 15 })),
        h('div', null, h('div', { className: 'lp-strong' }, title), h('p', { className: 'lp-muted' }, text))))),
    h('div', { className: 'lp-form-actions' },
      h(LinkButton, { href: '/api/longpi/report', icon: 'download', download: 'longpi-report.md' }, '导出报告')))
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
  return h('div', { className: 'lp lp-settings' },
    h('div', { className: 'lp-set-head' },
      h('h2', { className: 'lp-h2' }, 'LongPi'),
      props.openPage ? h('button', { type: 'button', className: 'lp-row-link', onClick: () => { props.close?.(); props.openPage?.() } }, '打开健康页 →') : null),
    notice ? h('div', { className: 'lp-notice-slot' }, notice) : null,
    h(Block, { id: 'lp-set-followup', title: '提醒', hint: '默认关。这个窗口关了，就不会响。' }, h(FollowupPanel, { onNotice: notify })),
    h(Block, { id: 'lp-set-connection', title: '数据连接' }, h(ConnectionPanel, { idPrefix: 'lp-set-conn' })),
    h(Block, { id: 'lp-set-science', title: '一起研究' }, h(ScienceSwitch)),
    h(Block, { id: 'lp-set-privacy', title: '隐私与数据' }, h(Privacy), ...settingsSections().map((section) => h(section.Component, { key: section.id }))),
    h('section', { className: 'lp-set-block', id: 'lp-set-methods' },
      h('details', { className: 'lp-more', onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => setAdvanced(event.currentTarget.open) },
        h('summary', null, h('span', { className: 'lp-set-title' }, '高级：方法库'), h('span', { className: 'lp-optional' }, '给想看方法细节的人')),
        // The board is read only once the section is opened: most people never need it.
        advanced ? h(Methods, { onNotice: notify }) : null)))
}
