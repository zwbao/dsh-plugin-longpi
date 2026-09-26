// LongPi's page in DSH's settings (settings.section, id longpi): the things
// changed once in a while, out of the health page. 随访提醒 (one switch and
// its time, the rest under 更多设置), 数据连接 (the Mirobody address, tested
// before it is saved), 隐私与数据 (where things live and what leaves this
// computer), and 高级：方法库.

import React from 'react'
import { ConnectionPanel } from './connection.ts'
import { FollowupPanel } from './followup.ts'
import { Icon } from './icons.ts'
import { MethodsSection } from './methods.ts'
import { useBoard } from './store.ts'
import type { Face } from './types.ts'
import { LinkButton, useNotice } from './ui.ts'

const h = React.createElement

function Block(props: { id: string; title: string; hint?: string; children?: React.ReactNode }): React.ReactElement {
  return h('section', { className: 'lp-set-block', id: props.id, 'aria-labelledby': `${props.id}-title` },
    h('h3', { className: 'lp-set-title', id: `${props.id}-title` }, props.title, props.hint ? h('span', { className: 'lp-optional' }, props.hint) : null),
    props.children)
}

function Privacy(): React.ReactElement {
  const rows: Array<[string, string, string]> = [
    ['lock', '存在哪里', '档案、方案、打卡、自测和提醒设置只保存在这台电脑上（默认在 ~/.dsh/longpi，安装时可以改）。体检和手环记录在你自己的 Mirobody 中，LongPi 只读。'],
    ['send', '什么会发给模型', '和 LongPi 对话时，你的问题，以及 LongPi 工具为回答它读出的档案、指标数值和结果，会作为对话内容发给你在 DSH 里配置的模型（默认 DeepSeek）处理。不对话就不会发送。'],
    ['bell', '什么会发给 Webhook', '只在你配置了 Webhook 时发送。简要模式只发“今天还有 2 项待打卡”这类提示，不含项目名称和健康数值；详细模式会带上方案项目名称、执行率和复测指标。'],
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
    h(Block, { id: 'lp-set-followup', title: '随访提醒', hint: '默认关闭 · 只在 DSH 运行时发送' }, h(FollowupPanel, { onNotice: notify })),
    h(Block, { id: 'lp-set-connection', title: '数据连接', hint: 'Mirobody' }, h(ConnectionPanel, { idPrefix: 'lp-set-conn' })),
    h(Block, { id: 'lp-set-privacy', title: '隐私与数据' }, h(Privacy)),
    h('section', { className: 'lp-set-block', id: 'lp-set-methods' },
      h('details', { className: 'lp-more', onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => setAdvanced(event.currentTarget.open) },
        h('summary', null, h('span', { className: 'lp-set-title' }, '高级：方法库'), h('span', { className: 'lp-optional' }, '给想看方法细节的人')),
        // The board is read only once the section is opened: most people never need it.
        advanced ? h(Methods, { onNotice: notify }) : null)))
}
