// The 长寿图鉴 page tab (docs/codex-design.md 1.2). The prompt slot, the page's in-flow line and 演示模式 live in slot.ts.

import React from 'react'
import { registerPageTab } from '../registry.ts'
import { CodexPage } from './codex-page.ts'

const h = React.createElement

function CodexTab(props: Record<string, unknown>): React.ReactElement {
  return h(CodexPage, { onNotice: typeof props.onNotice === 'function' ? props.onNotice as (text: string) => void : undefined })
}

registerPageTab({ id: 'codex', label_zh: '长寿图鉴', order: 35, Component: CodexTab })
