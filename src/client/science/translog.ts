// The transparency log, newest first. Each line says what left the machine; it does not repeat a lab value.

import React from 'react'
import { scrubVisible } from '../../ux/plain.ts'

const h = React.createElement

export interface LogRow { seq: number; at: string; kind: string; detail_zh: string }

export function TranslogPanel(props: { rows: LogRow[] }): React.ReactElement {
  return h('section', { className: 'lp-card', id: 'lp-science-log', 'aria-label': '发出记录' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '发出记录')),
    h('p', { className: 'lp-small lp-muted' }, '这里只记离开这台电脑的东西：什么时候、发给哪一项研究。'),
    props.rows.length === 0
      ? h('p', { className: 'lp-caption' }, '还没有东西离开这台电脑。')
      : h('ol', { className: 'lp-rows' }, ...props.rows.map((row) => h('li', { key: row.seq, className: 'lp-row' },
        h('span', { className: 'lp-row-main' }, scrubVisible(row.detail_zh)),
        h('span', { className: 'lp-caption lp-num' }, row.at.slice(0, 16).replace('T', ' '))))))
}
