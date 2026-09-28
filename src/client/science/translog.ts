// The transparency log, newest first. Each line says what left the machine; it does not repeat a lab value.

import React from 'react'
import { scrubVisible } from '../../ux/plain.ts'

const h = React.createElement

export interface LogRow { seq: number; at: string; kind: string; detail_zh: string }

export function TranslogPanel(props: { rows: LogRow[] }): React.ReactElement {
  return h('section', { className: 'lp-section', id: 'lp-science-log' },
    h('h2', { className: 'lp-h2' }, '发出记录'),
    h('p', { className: 'lp-muted' }, '这里只记离开这台电脑的东西：什么时候、发给哪一项研究。'),
    props.rows.length === 0
      ? h('p', { className: 'lp-muted' }, '还没有东西离开这台电脑。')
      : h('ol', { className: 'lp-sci-log' }, ...props.rows.map((row) => h('li', { key: row.seq },
        h('span', { className: 'lp-muted' }, row.at.slice(0, 16).replace('T', ' ')),
        ` ${scrubVisible(row.detail_zh)}`))))
}
