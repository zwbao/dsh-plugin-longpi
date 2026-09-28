// The transparency log, newest first. Each line says what left the machine; it does not repeat a lab value.

import React from 'react'

const h = React.createElement

export interface LogRow { seq: number; at: string; kind: string; detail_zh: string }

export function TranslogPanel(props: { rows: LogRow[] }): React.ReactElement {
  return h('section', { className: 'lp-section', id: 'lp-science-log' },
    h('h2', { className: 'lp-h2' }, '透明记录'),
    props.rows.length === 0
      ? h('p', { className: 'lp-muted' }, '还没有记录。同意、计算和发布都会写在这里。')
      : h('ol', { className: 'lp-sci-log' }, ...props.rows.map((row) => h('li', { key: row.seq },
        h('span', { className: 'lp-muted' }, row.at.slice(0, 16).replace('T', ' ')),
        ` ${row.detail_zh}`))))
}
