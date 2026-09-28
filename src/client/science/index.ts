// Register the research tab, the consent tool card and the settings note. The page renders them once it reads the client registry.

import React from 'react'
import { registerPageTab, registerSettingsSection, registerToolView } from '../registry.ts'
import { parseCall } from '../toolviews.ts'
import { StudiesTab } from './studies-tab.ts'

const h = React.createElement

function ScienceToolCard(props: { block?: unknown; toolName?: string }): React.ReactElement {
  const call = parseCall(props.block)
  const result = call.result
  const title = props.toolName === 'record_study_consent' ? '研究同意' : props.toolName === 'design_n_of_1' ? '个人对照' : '研究'
  const text = typeof result?.say_zh === 'string' ? result.say_zh : typeof result?.result_zh === 'string' ? result.result_zh : call.state === 'running' ? '正在读取…' : call.error || '完成'
  return h('div', { className: 'lp lp-tool lp-tool-card' },
    h('div', { className: 'lp-tool-head' }, h('span', { className: 'lp-tool-title' }, title)),
    h('p', null, text))
}

function ScienceSettings(): React.ReactElement {
  return h('section', { className: 'lp-section' },
    h('h2', { className: 'lp-h2' }, '研究'),
    h('p', null, '研究正式开始后才会发出，现在只保存在你的设备上。'),
    h('p', null, h('a', { href: '/api/longpi/science/community?view=page' }, '打开研究页')))
}

/** Call from client/modules.ts. Safe to call once. */
export function registerScienceClient(): void {
  registerPageTab({ id: 'science', label_zh: '研究', order: 60, Component: StudiesTab as React.ComponentType<Record<string, unknown>> })
  registerSettingsSection({ id: 'science', order: 40, Component: ScienceSettings as React.ComponentType<Record<string, unknown>> })
  for (const tool of ['list_studies', 'explain_study', 'design_n_of_1', 'record_study_consent', 'withdraw_from_study']) {
    registerToolView({ tool, Component: ScienceToolCard as React.ComponentType<Record<string, unknown>> })
  }
}
