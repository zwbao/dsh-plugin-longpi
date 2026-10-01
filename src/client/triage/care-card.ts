// M1 on the page: the doctor-first card at the top of 概览 — the values and who to see, the one-page
// brief (open, print, save as a file), and "是否已预约？医生意见如何？" answered in place (saved to memory).

import React from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { errorText, postJson } from '../api.ts'
import { Icon } from '../icons.ts'
import { chineseDate } from '../format.ts'
import { notifyChanged } from '../store.ts'
import type { Journey } from '../types.ts'
import { Btn, LinkButton } from '../ui.ts'
import { careDetail } from '../overview-facts.ts'

const h = React.createElement
type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

interface BriefAnswer { ok: boolean; error?: string; markdown?: string; brief?: { id: string; created: string } }

function localToday(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function printText(title: string, text: string): void {
  const view = window.open('', '_blank', 'noopener=no,width=800,height=900')
  if (!view) return
  const doc = view.document
  doc.title = title
  const pre = doc.createElement('pre')
  pre.style.cssText = 'white-space:pre-wrap;font:14px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif;margin:24px'
  pre.textContent = text
  doc.body.appendChild(pre)
  view.focus()
  view.print()
}

function BriefModal(props: { answer: BriefAnswer; onClose: () => void }): React.ReactElement {
  const { answer } = props
  const id = answer.brief?.id ?? ''
  return h(Modal, { open: true, title: '给医生的一页简报', onClose: props.onClose, headless: true, className: 'lp-brief-dialog' },
    h('div', { className: 'lp lp-brief-modal' },
      h('h2', { className: 'lp-h2' }, '给医生的一页简报'),
      h('p', { className: 'lp-caption' }, '数字来自你的体检记录；姓名一栏留空，打印后手写。这不是诊断。'),
      h('pre', { className: 'lp-brief-pre', tabIndex: 0 }, answer.markdown ?? ''),
      h('div', { className: 'lp-modal-actions' },
        id ? h(LinkButton, { href: `/api/longpi/brief?id=${encodeURIComponent(id)}&format=md&download=1`, icon: 'download', download: `longpi-doctor-brief-${answer.brief?.created ?? ''}.md` }, '保存为文件') : null,
        h(Btn, { variant: 'outline', onClick: () => printText('给医生的一页简报', answer.markdown ?? '') }, '打印'),
        h(Btn, { 'data-modal-autofocus': true, onClick: props.onClose }, '关闭'))))
}

type Step = 'none' | 'booked' | 'visited'

function VisitForm(props: { journey: Journey; onNotice: Notify }): React.ReactElement {
  const [step, setStep] = React.useState<Step>('none')
  const [date, setDate] = React.useState(localToday())
  const [outcome, setOutcome] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const last = props.journey.triage.care.at(-1)
  const send = async (status: 'booked' | 'visited' | 'declined') => {
    setBusy(true)
    try {
      const result = await postJson<{ ok: boolean; error?: string }>('/api/longpi/care-visit', { status, ...(status !== 'declined' ? { visit_date: date } : {}), ...(status === 'visited' && outcome.trim() ? { outcome_zh: outcome.trim() } : {}) })
      if (!result.ok) throw new Error(result.error || '保存失败')
      props.onNotice(status === 'visited' ? '已记录医生结论，下一步建议和方案将相应调整。' : status === 'booked' ? `已记录：${chineseDate(date)}就诊。就诊前可打印简报。` : '已记录。需要就诊时，可随时打印简报。', 'good')
      setStep('none')
      notifyChanged()
    } catch (err) {
      props.onNotice(`保存失败：${errorText(err, '请稍后再试')}`, 'bad')
    } finally {
      setBusy(false)
    }
  }
  const lastText = last ? (last.care_status === 'booked' ? `已预约 ${chineseDate(last.visit_date)}`.trim() : last.care_status === 'declined' ? '暂不就诊' : last.care_status === 'visited' ? `已就诊 ${chineseDate(last.visit_date)}`.trim() : '') : ''
  return h('div', { className: 'lp-care-visit' },
    h('p', { className: 'lp-small lp-muted' }, lastText ? `是否已预约？医生意见如何？（上次：${lastText}）` : '是否已预约？医生意见如何？'),
    step === 'none' ? h('div', { className: 'lp-actions' },
      h(Btn, { variant: 'outline', disabled: busy, onClick: () => setStep('booked') }, '已预约'),
      h(Btn, { variant: 'outline', disabled: busy, onClick: () => setStep('visited') }, '已就诊'),
      h(Btn, { variant: 'ghost', disabled: busy, onClick: () => { void send('declined') } }, '暂不就诊')) : null,
    step !== 'none' ? h('div', { className: 'lp-care-visit-form' },
      h('div', { className: 'lp-field lp-care-date' },
        h('label', { className: 'lp-field-label', htmlFor: 'lp-care-visit-date' }, step === 'booked' ? '就诊日期' : '就诊日期'),
        h('input', { id: 'lp-care-visit-date', type: 'date', className: 'lp-input', value: date, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value) })),
      step === 'visited' ? h('div', { className: 'lp-field' },
        h('label', { className: 'lp-field-label', htmlFor: 'lp-care-visit-outcome' }, '医生意见'),
        h('textarea', { id: 'lp-care-visit-outcome', className: 'lp-input', rows: 2, placeholder: '例如：缺铁，已开药，3 个月后复查', value: outcome, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setOutcome(event.target.value) })) : null,
      h('div', { className: 'lp-actions' },
        h(Btn, { disabled: busy || !date, onClick: () => { void send(step) } }, busy ? '保存中…' : '保存'),
        h(Btn, { variant: 'ghost', disabled: busy, onClick: () => setStep('none') }, '取消'))) : null)
}

/** The doctor-first card: title, the values, the brief and the visit answers. */
export function CareCard(props: { journey: Journey; onNotice: Notify; onIndicators: () => void; onProfile: () => void }): React.ReactElement | null {
  const { journey } = props
  const [brief, setBrief] = React.useState<BriefAnswer | null>(null)
  const [busy, setBusy] = React.useState(false)
  if (journey.next.action !== 'doctor') return null
  const openBrief = async () => {
    setBusy(true)
    try {
      const answer = await postJson<BriefAnswer>('/api/longpi/brief', {})
      if (!answer.ok) throw new Error(answer.error || '生成失败')
      setBrief(answer)
    } catch (err) {
      props.onNotice(`简报生成失败：${errorText(err, '请稍后再试')}`, 'bad')
    } finally {
      setBusy(false)
    }
  }
  const detail = careDetail(journey.next.title_zh, journey.next.detail_zh)
  return h('section', { className: 'lp-card lp-care-box', 'aria-label': '请先去看医生', id: 'lp-care' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-h3 lp-care-title' }, h(Icon, { name: 'warn', size: 16 }), '最重要的一步')),
    h('div', { className: 'lp-care-text' },
      h('p', { className: 'lp-strong' }, journey.next.title_zh),
      detail ? h('p', { className: 'lp-muted' }, detail) : null),
    h('div', { className: 'lp-actions' },
      h(Btn, { disabled: busy, onClick: () => { void openBrief() } }, busy ? '正在整理…' : '医生简报（可打印）'),
      h(Btn, { variant: 'outline', onClick: props.onIndicators }, '查看这些指标'),
      journey.triage.needs_sex ? h(Btn, { variant: 'outline', onClick: props.onProfile }, '填写性别') : null),
    h(VisitForm, { journey, onNotice: props.onNotice }),
    brief ? h(BriefModal, { answer: brief, onClose: () => setBrief(null) }) : null)
}
