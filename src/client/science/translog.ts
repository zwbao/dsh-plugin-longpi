// The transparency log, newest first. Each line says what left the machine; it does not repeat a lab value.

import React from 'react'
import { scrubVisible } from '../../ux/plain.ts'
import { chineseDate } from '../format.ts'
import { Icon } from '../icons.ts'

const h = React.createElement

export interface LogRow { seq: number; at: string; kind: string; detail_zh: string }

export function TranslogPanel(props: { rows: LogRow[] }): React.ReactElement {
  return h('section', { className: 'lp-card', id: 'lp-science-log', 'aria-label': '发出记录' },
    h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '发出记录')),
    props.rows.length === 0
      ? h('div', { className: 'lp-empty' },
        h(Icon, { name: 'send', size: 20 }),
        h('p', { className: 'lp-empty-text lp-measure' }, '还没有东西离开这台电脑。这里只记离开的东西：什么时候、发给哪一项研究。'))
      : h(React.Fragment, null,
        h('p', { className: 'lp-small lp-muted lp-measure' }, '这里只记离开这台电脑的东西：什么时候、发给哪一项研究。'),
        h('ol', { className: 'lp-rows' }, ...props.rows.map((row) => h('li', { key: row.seq, className: 'lp-row' },
        h('span', { className: 'lp-row-main' }, scrubVisible(row.detail_zh)),
        h('span', { className: 'lp-caption lp-num' }, `${chineseDate(row.at)} ${row.at.slice(11, 16)}`.trim()))))))
}
