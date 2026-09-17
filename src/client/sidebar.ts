import React from 'react'
import { NAMESPACE } from './constants.ts'

export function registerSidebar(ctx: {
  slots: {
    inject: (name: string, factory: () => unknown) => unknown
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
}): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: NAMESPACE, order: 40 },
    SidebarMark,
  ))
}

function SidebarMark(props: { wide?: boolean }): React.ReactElement {
  return React.createElement(
    'span',
    { className: 'lp-sidebar', title: 'LongPi 健康助手' },
    React.createElement('span', { className: 'lp-dot' }),
    props.wide === false ? null : React.createElement('span', null, 'LongPi'),
  )
}
