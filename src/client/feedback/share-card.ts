// Copyable sentence for a change that cleared the noise band.

import React from 'react'
import { shareText, type ShareCardModel } from '../../feedback/share.ts'
import { Btn } from '../ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

export function ShareCard(props: { card: ShareCardModel; onNotice?: Notify }): React.ReactElement {
  const text = shareText(props.card)
  const copy = () => {
    const clip = navigator.clipboard
    if (!clip) {
      props.onNotice?.('请手动选择这句话', 'info')
      return
    }
    void clip.writeText(text).then(() => props.onNotice?.('已复制', 'good')).catch(() => props.onNotice?.('请手动选择这句话', 'info'))
  }
  return h('section', { className: 'lp-card', id: 'lp-share', 'aria-label': props.card.title_zh },
    h('div', { className: 'lp-label' }, props.card.title_zh),
    h('p', { className: 'lp-strong' }, props.card.headline_zh),
    ...props.card.lines_zh.map((line) => h('p', { key: line, className: 'lp-caption' }, line)),
    h('p', { className: 'lp-fine' }, props.card.footnote_zh),
    h('div', { className: 'lp-result-action' }, h(Btn, { size: 'sm', variant: 'outline', onClick: copy }, '复制这句话')))
}
