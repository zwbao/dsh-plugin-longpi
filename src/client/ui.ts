import React from 'react'
import { Button, type ButtonProps } from '@deepseek-ai/dsh-client-ui-primitives'
import { api } from './api.ts'
import { Icon } from './icons.ts'

const h = React.createElement

export function Section(props: { id?: string; title: string; kicker?: string; aside?: React.ReactNode; children?: React.ReactNode; className?: string }): React.ReactElement {
  const headingId = props.id ? `${props.id}-title` : undefined
  return h('section', { className: `lp-section ${props.className ?? ''}`.trim(), id: props.id, 'aria-labelledby': headingId },
    h('div', { className: 'lp-section-head' },
      h('div', { className: 'lp-section-titles' },
        props.kicker ? h('div', { className: 'lp-kicker' }, props.kicker) : null,
        h('h2', { className: 'lp-h2', id: headingId }, props.title)),
      props.aside ?? null),
    props.children)
}

export function Skeleton(props: { height: number; width?: number | string; className?: string }): React.ReactElement {
  return h('div', { className: `lp-skeleton ${props.className ?? ''}`.trim(), style: { height: props.height, width: props.width }, 'aria-hidden': true })
}

/** DSH's own button; LongPi adds nothing but the variant it wants by default. */
export function Btn(props: ButtonProps): React.ReactElement {
  return h(Button, { variant: 'primary', size: 'md', ...props })
}

/** A download link dressed as a DSH outline button (a real <a>, so the browser saves it). */
export function LinkButton(props: { href: string; icon?: string; children?: React.ReactNode; download?: string }): React.ReactElement {
  return h('a', { className: 'lp-linkbtn', href: api(props.href), download: props.download ?? true },
    props.icon ? h(Icon, { name: props.icon, size: 14 }) : null, props.children)
}

export interface SegmentOption<V extends string> {
  value: V
  label: string
}

/** A radio group drawn as a segmented control. Nothing selected means "not answered". */
export function Segmented<V extends string>(props: {
  name: string
  label: string
  options: Array<SegmentOption<V>>
  value: V | ''
  onChange: (value: V) => void
  disabled?: boolean
  hideLabel?: boolean
}): React.ReactElement {
  const labelId = `${props.name}-label`
  return h('div', { className: 'lp-seg-wrap' },
    h('span', { id: labelId, className: props.hideLabel ? 'lp-sr' : 'lp-field-label' }, props.label),
    h('div', { className: 'lp-seg', role: 'radiogroup', 'aria-labelledby': labelId },
      ...props.options.map((option) => h('label', { key: option.value, className: `lp-seg-opt ${props.value === option.value ? 'lp-seg-on' : ''}` },
        h('input', {
          type: 'radio', name: props.name, value: option.value, checked: props.value === option.value, disabled: props.disabled,
          onChange: () => props.onChange(option.value),
        }),
        h('span', null, option.label)))))
}

export function ToggleChip(props: { pressed: boolean; onClick: () => void; children?: React.ReactNode; badge?: string }): React.ReactElement {
  return h('button', { type: 'button', className: `lp-toggle ${props.pressed ? 'lp-toggle-on' : ''}`, 'aria-pressed': props.pressed, onClick: props.onClick },
    props.badge ? h('span', { className: 'lp-toggle-badge', 'aria-hidden': true }, props.badge) : null,
    props.children)
}

export type NoticeTone = 'info' | 'good' | 'bad'

/** A short-lived status line (role=status) for saves and failures. */
export function useNotice(): [React.ReactElement | null, (text: string, tone?: NoticeTone) => void] {
  const [notice, setNotice] = React.useState<{ text: string; tone: NoticeTone; id: number } | null>(null)
  React.useEffect(() => {
    if (!notice || notice.tone === 'bad') return undefined
    const timer = window.setTimeout(() => setNotice((current) => (current?.id === notice.id ? null : current)), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])
  const show = React.useCallback((text: string, tone: NoticeTone = 'info') => setNotice({ text, tone, id: Date.now() }), [])
  const node = notice
    ? h('div', { className: `lp-notice lp-notice-${notice.tone}`, role: 'status' },
      h(Icon, { name: notice.tone === 'good' ? 'check' : notice.tone === 'bad' ? 'info' : 'info', size: 14 }),
      h('span', null, notice.text),
      h('button', { type: 'button', className: 'lp-notice-x', 'aria-label': '关闭提示', onClick: () => setNotice(null) }, h(Icon, { name: 'close', size: 12 })))
    : null
  return [node, show]
}

/** Copy text, reporting whether the browser let us. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
