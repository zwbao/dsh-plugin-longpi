// 档案: what LongPi knows about the person and where it comes from. The
// profile answers, the measurements they take at home with their log, the
// tests that would unlock a result, the data connection, and the exports.

import React from 'react'
import { DataInSection } from './datain/index.ts'
import { ConnectionForm, ConnectionStatus } from './connection.ts'
import { Icon } from './icons.ts'
import { RecordsStatusLine } from './journey-steps.ts'
import { ProfileEditor } from './profile-editor.ts'
import { InlineSelf, SelfLatestList, SelfMeasureForm, SelfRecent } from './self-measure.ts'
import { profileSections } from './registry.ts'
import { useConnection, useSettingsOpener } from './store.ts'
import type { Journey } from './types.ts'
import { LinkButton } from './ui.ts'

const h = React.createElement

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

/** Where the connection is set: the LongPi page in DSH's settings, or here when settings cannot be opened from the page. */
function ConnectionCard(props: { journey: Journey }): React.ReactElement {
  const { data } = useConnection()
  const openSettings = useSettingsOpener()
  const [editing, setEditing] = React.useState(false)
  return h('div', { className: 'lp-card', id: 'lp-connection-card' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title' }, '数据连接'),
      openSettings
        ? h('button', { type: 'button', className: 'lp-textbtn', onClick: () => openSettings('longpi') }, '在设置中修改', h(Icon, { name: 'chevron', size: 12 }))
        : h('button', { type: 'button', className: 'lp-textbtn', 'aria-expanded': editing, onClick: () => setEditing((current) => !current) }, editing ? '收起' : '修改连接')),
    data ? h(ConnectionStatus, { connection: data }) : h(RecordsStatusLine, { journey: props.journey }),
    editing && !openSettings ? h(ConnectionForm, { connection: data, idPrefix: 'lp-profile-conn', onSaved: () => setEditing(false) }) : null,
    openSettings ? null : h('p', { className: 'lp-caption lp-measure' }, '也可以在 DSH 左下角的「设置 → LongPi」中修改。'))
}

/** The next-checkup add-on list, as rows; items the person can measure at home get a field right in the row. */
function AddonRows(props: { journey: Journey; onNotice: Notify }): React.ReactElement {
  return h('ul', { className: 'lp-rows', id: 'lp-profile-addons-addons' },
    ...props.journey.addons.map((row) => h('li', { key: row.item_zh, className: 'lp-row' },
      h('div', { className: 'lp-row-main lp-row-lines' },
        h('span', { className: 'lp-strong' }, row.item_zh),
        h('span', { className: 'lp-caption' }, `解锁：${row.unlocks_zh}${row.self_measurable ? ' · 可以自己在家量' : ''}`)),
      row.self_measurable && row.self_key
        ? h(InlineSelf, { journey: props.journey, selfKey: row.self_key, idPrefix: 'lp-profile-addons-' + row.self_key, onNotice: props.onNotice })
        : null)))
}

export function ProfileTab(props: { journey: Journey; onNotice: Notify }): React.ReactElement {
  const { journey } = props
  const today = journey.today
  // Left: the long profile form. Right: the short cards stacked, so neither column leaves a tall gap.
  return h('div', { className: 'lp-tab-body' },
    h('div', { className: 'lp-grid-2 lp-grid-top', id: 'lp-profile-section' },
      h('div', { className: 'lp-card', id: 'lp-profile-card' },
        h('div', { className: 'lp-card-head' },
          h('h3', { className: 'lp-card-title' }, '基本情况'),
          h('span', { className: 'lp-caption' }, '只保存在这台电脑上')),
        h(ProfileEditor, { journey, variant: 'page', idPrefix: 'lp-profile', onNotice: props.onNotice })),
      h('div', { className: 'lp-stack' },
        h('div', { className: 'lp-card', id: 'lp-self-card' },
          h('div', { className: 'lp-card-head' },
            h('h3', { className: 'lp-card-title' }, '自测'),
            h('span', { className: 'lp-caption' }, '腰围 · 家庭血压 · 体重')),
          h(SelfLatestList, { latest: journey.self.latest }),
          h(SelfMeasureForm, { journey, idPrefix: 'lp-self', onNotice: props.onNotice }),
          h('p', { className: 'lp-caption lp-measure' }, '家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。早晚各量一次、每次坐着休息 5 分钟后再量。'),
          h(SelfRecent, { onNotice: props.onNotice })),
        h(ConnectionCard, { journey }),
        h('div', { className: 'lp-card', id: 'lp-export-card' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, '导出')),
          h('p', { className: 'lp-small lp-muted lp-measure' }, '报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；日历文件包含复测日期和每天的打卡提醒。'),
          h('div', { className: 'lp-actions' },
            h(LinkButton, { href: '/api/longpi/report', icon: 'download', download: `longpi-report-${today}.md` }, '导出报告'),
            h(LinkButton, { href: '/api/longpi/calendar.ics', icon: 'calendar', download: 'longpi.ics' }, '加入日历')),
          h('p', { className: 'lp-caption lp-plan-aside' }, h(Icon, { name: 'lock', size: 12 }), '导出的文件留在你的电脑上，LongPi 不会发给任何人。')))),
    h(DataInSection),
    // The one full add-on list (总览 only links here with 查看加测清单).
    journey.addons.length > 0
      ? h('div', { className: 'lp-card', id: 'lp-addons-card' },
        h('div', { className: 'lp-card-head' },
          h('h3', { className: 'lp-card-title' }, '下次体检加测'),
          h('span', { className: 'lp-caption' }, `${journey.addons.length} 项，加上就能算出更多结果`)),
        h(AddonRows, { journey, onNotice: props.onNotice }))
      : null,
    // Registered sections (数据去哪里) sit in a card like the rest of the page.
    ...profileSections().map((section) => h('div', { key: section.id, className: 'lp-card' },
      h(section.Component, { journey, onNotice: props.onNotice }))))
}
