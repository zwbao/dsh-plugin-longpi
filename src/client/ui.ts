import React from 'react'
import { Button, type ButtonProps } from '@deepseek-ai/dsh-client-ui-primitives'
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
  return h('a', { className: 'lp-linkbtn', href: props.href, download: props.download ?? true },
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

/** An on/off switch: a real button with role=switch, labelled by its visible text. */
export function Switch(props: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; busy?: boolean; id?: string }): React.ReactElement {
  return h('button', {
    type: 'button', role: 'switch', id: props.id, 'aria-checked': props.checked, 'aria-busy': props.busy || undefined, disabled: props.disabled,
    className: `lp-switch ${props.checked ? 'lp-switch-on' : ''}`, onClick: () => props.onChange(!props.checked),
  },
  h('span', { className: 'lp-switch-track', 'aria-hidden': true }, h('span', { className: 'lp-switch-thumb' })),
  h('span', { className: 'lp-switch-label' }, props.label))
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

/**
 * ⓘ: the method, model name and source behind a plain-words headline. A
 * button that opens a small note under it; Escape or a click elsewhere closes it.
 */
export function Info(props: { label: string; children?: React.ReactNode; align?: 'start' | 'end' }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLSpanElement>(null)
  const id = React.useId()
  React.useEffect(() => {
    if (!open) return undefined
    const onDown = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return h('span', { className: 'lp-info-wrap', ref: wrap },
    h('button', {
      type: 'button', className: 'lp-info-btn', 'aria-label': `${props.label}：说明`, 'aria-expanded': open, 'aria-controls': id,
      onClick: () => setOpen((current) => !current),
    }, h(Icon, { name: 'info', size: 14 })),
    open ? h('span', { className: `lp-info-pop lp-info-${props.align ?? 'start'}`, id, role: 'note' }, props.children) : null)
}

export interface TabSpec<K extends string> {
  key: K
  label: string
  badge?: string
}

/** A tab list (role=tablist) with arrow-key movement; the panel is the caller's, labelled by the tab. */
export function Tabs<K extends string>(props: { tabs: Array<TabSpec<K>>; value: K; onChange: (key: K) => void; label: string; idPrefix: string }): React.ReactElement {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  const move = (index: number) => {
    const next = props.tabs[(index + props.tabs.length) % props.tabs.length]
    if (!next) return
    props.onChange(next.key)
    refs.current[(index + props.tabs.length) % props.tabs.length]?.focus()
  }
  return h('div', { className: 'lp-tabs', role: 'tablist', 'aria-label': props.label },
    ...props.tabs.map((tab, index) => h('button', {
      key: tab.key, type: 'button', role: 'tab', id: `${props.idPrefix}-tab-${tab.key}`,
      ref: (node: HTMLButtonElement | null) => { refs.current[index] = node },
      className: `lp-tab ${tab.key === props.value ? 'lp-tab-on' : ''}`,
      'aria-selected': tab.key === props.value, 'aria-controls': `${props.idPrefix}-panel`, tabIndex: tab.key === props.value ? 0 : -1,
      onClick: () => props.onChange(tab.key),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowRight') move(index + 1)
        if (event.key === 'ArrowLeft') move(index - 1)
      },
    }, tab.label, tab.badge ? h('span', { className: 'lp-tab-badge' }, tab.badge) : null)))
}

/** An error in place of content that did not load, with a retry: never an empty state. */
export function LoadError(props: { what: string; error: string | null; onRetry: () => void | Promise<void>; compact?: boolean }): React.ReactElement {
  const [busy, setBusy] = React.useState(false)
  return h('div', { className: `lp-loaderror ${props.compact ? 'lp-loaderror-compact' : 'lp-card'}`, role: 'alert' },
    h(Icon, { name: 'warn', size: 14 }),
    h('span', { className: 'lp-loaderror-text' }, `没有读到${props.what}${props.error ? `：${props.error}` : ''}。`),
    h('button', {
      type: 'button', className: 'lp-linkbtn', disabled: busy,
      onClick: () => {
        setBusy(true)
        Promise.resolve(props.onRetry()).finally(() => setBusy(false))
      },
    }, h(Icon, { name: 'refresh', size: 13, className: busy ? 'lp-spin' : '' }), busy ? '重试中' : '重试'))
}

/** localStorage for one small preference; blocked storage just means it is not remembered. */
export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the choice lasts this visit only.
  }
}
