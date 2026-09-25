// The first-run steps, shared by the onboarding modal and the page's stepper:
// the notice (informed consent), the record connection guide, and the first
// results or the add-on list that would unlock them.

import React from 'react'
import { errorText, postJson } from './api.ts'
import { fmt } from './charts.ts'
import { CONSENT_SENTENCES } from './constants.ts'
import { chineseDate, riskText, versusAge } from './format.ts'
import { Icon } from './icons.ts'
import { AddonList } from './results.ts'
import { notifyChanged } from './store.ts'
import type { Journey } from './types.ts'
import { Btn, copyText } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

export const INSTALL_HINT = 'curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- --mcp-url <你的 MCP 地址>'

export async function acceptConsent(): Promise<void> {
  await postJson('/api/longpi/consent', { accept: true })
  notifyChanged()
}

const CONSENT_ICONS = ['health', 'lock', 'spark'] as const

export function ConsentText(): React.ReactElement {
  return h('div', { className: 'lp-consent' }, ...CONSENT_SENTENCES.map((text, index) => h('div', { key: index, className: 'lp-consent-row' },
    h('span', { className: 'lp-consent-icon', 'aria-hidden': true }, h(Icon, { name: CONSENT_ICONS[index] ?? 'info', size: 15 })),
    h('p', null, text))))
}

/** The notice inline on the page (the modal has its own buttons). */
export function ConsentInline(props: { journey: Journey; onNotice: Notify }): React.ReactElement {
  const [busy, setBusy] = React.useState(false)
  async function accept(): Promise<void> {
    setBusy(true)
    try {
      await acceptConsent()
      props.onNotice('已开始使用 LongPi。接下来填写档案。', 'good')
    } catch (err) {
      props.onNotice(`没有记下：${errorText(err, '请稍后再试')}`, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return h('div', { className: 'lp-step-body' },
    h(ConsentText),
    h('div', { className: 'lp-form-actions' },
      h(Btn, { onClick: () => { void accept() }, disabled: busy }, busy ? '记录中…' : '开始'),
      h('span', { className: 'lp-caption' }, `点“开始”表示你已读过以上说明（版本 ${props.journey.consent.current}）。`)))
}

export function RecordsStatusLine(props: { journey: Journey }): React.ReactElement {
  const records = props.journey.records
  if (records.status === 'ok') {
    return h('div', { className: 'lp-status' },
      h('span', { className: 'lp-statusdot lp-statusdot-on', 'aria-hidden': true }),
      `Mirobody 已连接 · ${records.indicator_count} 项指标 · ${records.full_checkups} 次完整体检`)
  }
  return h('div', { className: 'lp-status' },
    h('span', { className: `lp-statusdot ${records.status === 'error' ? 'lp-statusdot-bad' : ''}`, 'aria-hidden': true }),
    records.status === 'error' ? `记录读取失败：${records.error || '没有返回原因'}` : '还没有连接 Mirobody 记录')
}

/** Connected: what it holds. Not connected: exactly what to do in Mirobody, then check again. */
export function RecordsGuide(props: { journey: Journey; onRecheck: () => Promise<void> }): React.ReactElement {
  const [checking, setChecking] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const records = props.journey.records
  async function recheck(): Promise<void> {
    setChecking(true)
    try {
      await props.onRecheck()
    } finally {
      setChecking(false)
    }
  }
  const recheckButton = h(Btn, { variant: 'outline', size: 'sm', onClick: () => { void recheck() }, disabled: checking },
    h(Icon, { name: 'refresh', size: 14 }), checking ? '检查中…' : '重新检查')
  if (records.status === 'ok') {
    return h('div', { className: 'lp-step-body' },
      h('div', { className: 'lp-connected' },
        h('span', { className: 'lp-connected-icon', 'aria-hidden': true }, h(Icon, { name: 'check', size: 16 })),
        h('div', null,
          h('div', { className: 'lp-strong' }, `已连接 · ${records.indicator_count} 项指标 · ${records.full_checkups} 次完整体检`),
          h('div', { className: 'lp-caption' }, records.latest_checkup ? `最近一次完整体检：${chineseDate(records.latest_checkup)}` : '还没有九项血检测齐的一次体检'))),
      h(CanCompute, { journey: props.journey }),
      h('div', { className: 'lp-form-actions' }, recheckButton))
  }
  return h('div', { className: 'lp-step-body' },
    records.status === 'error'
      ? h('p', { className: 'lp-blocker lp-blocker-bad' }, `记录读取失败：${records.error || '没有返回原因'}`)
      : h('p', { className: 'lp-muted' }, 'LongPi 从你自己的 Mirobody 读取体检和可穿戴数据（只读）。三步接上：'),
    h('ol', { className: 'lp-howto' },
      h('li', null, '在 Mirobody 网页上传体检报告（PDF 或照片），或连接手环、手表。'),
      h('li', null, '在 Mirobody 生成个人 MCP 地址。'),
      h('li', null, '重新运行 LongPi 的安装命令，加上 ', h('code', null, '--mcp-url'), ' 和这个地址，然后重启 DSH。')),
    h('div', { className: 'lp-code' },
      h('code', null, INSTALL_HINT),
      h('button', {
        type: 'button', className: 'lp-iconbtn', 'aria-label': '复制安装命令',
        onClick: () => { void copyText(INSTALL_HINT).then((ok) => setCopied(ok)) },
      }, h(Icon, { name: copied ? 'check' : 'link', size: 14 }))),
    h('div', { className: 'lp-form-actions' },
      recheckButton,
      h('span', { className: 'lp-caption' }, records.mirobody_mounted ? '接好后点“重新检查”。' : 'Mirobody 插件还没有加载，重新运行安装命令会一起装好。')))
}

/** Right after connecting: what can be computed now, and which extra test unlocks the rest. */
function CanCompute(props: { journey: Journey }): React.ReactElement {
  const { bioage, risk } = props.journey.results
  const line = (label: string, ok: boolean, detail: string) => h('li', { className: 'lp-can' },
    h('span', { className: `lp-can-mark ${ok ? 'lp-can-ok' : ''}`, 'aria-hidden': true }, h(Icon, { name: ok ? 'check' : 'dot', size: 12, strokeWidth: ok ? 2 : 3 })),
    h('span', { className: 'lp-strong' }, label),
    h('span', { className: 'lp-caption' }, detail))
  return h('ul', { className: 'lp-cans' },
    line('身体年龄', bioage.status === 'ok', bioage.status === 'ok' ? '现在就能算' : bioage.blocker_zh),
    line('心血管风险', risk.status === 'ok', risk.status === 'ok' ? '现在就能算' : risk.blocker_zh))
}

/** Step 3: the results themselves (compact), or the checklist that would unlock them. */
export function FirstResult(props: { journey: Journey; onNotice: Notify; idPrefix: string; showResults: boolean }): React.ReactElement {
  const { bioage, risk } = props.journey.results
  const blocked = props.journey.addons.length
  return h('div', { className: 'lp-step-body' },
    !props.showResults && blocked === 0 ? h(CanCompute, { journey: props.journey }) : null,
    !props.showResults ? null : h('div', { className: 'lp-first' },
      h('div', { className: 'lp-first-cell' },
        h('div', { className: 'lp-caption' }, '身体年龄 · 模型估计'),
        bioage.status === 'ok'
          ? h('div', null,
            h('div', { className: 'lp-first-figure' }, fmt(bioage.phenoage), h('span', { className: 'lp-bignum-unit' }, '岁')),
            h('div', { className: 'lp-caption' }, [versusAge(bioage.advance), bioage.band_years != null ? `正常波动 ±${fmt(bioage.band_years)} 岁` : ''].filter(Boolean).join(' · ')))
          : h('div', null, h('div', { className: 'lp-first-wait' }, '还不能计算'), h('p', { className: 'lp-blocker' }, bioage.blocker_zh))),
      h('div', { className: 'lp-first-cell' },
        h('div', { className: 'lp-caption' }, '10 年心血管病风险 · 模型估计'),
        risk.status === 'ok'
          ? h('div', null,
            h('div', { className: 'lp-first-figure' }, riskText(risk.risk_pct), h('span', { className: 'lp-bignum-unit' }, '%')),
            h('div', { className: 'lp-caption' }, [risk.category_zh, 'China-PAR'].filter(Boolean).join(' · ')))
          : h('div', null, h('div', { className: 'lp-first-wait' }, '还不能计算'), h('p', { className: 'lp-blocker' }, risk.blocker_zh)))),
    blocked > 0 ? h('div', { className: 'lp-first-addons' },
      h('div', { className: 'lp-subhead' }, `还差 ${blocked} 项检查`, h('span', { className: 'lp-optional' }, '下次体检加测，或现在自己量')),
      h(AddonList, { journey: props.journey, onNotice: props.onNotice, idPrefix: props.idPrefix })) : null)
}
