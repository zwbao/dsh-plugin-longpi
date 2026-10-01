// 档案: what LongPi knows about the person and where it comes from. The
// profile answers, the measurements they take at home with their log, the
// tests that would unlock a result, the data connection, and the exports.

import React from 'react'
import { getJson } from './api.ts'
import { DataInSection } from './datain/index.ts'
import { ConnectionForm, ConnectionStatus, manualConnectionAllowed } from './connection.ts'
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

/** Whether the record is connected, and what was found. LongPi pairs by itself; the manual form is for installers only. */
function ConnectionCard(props: { journey: Journey }): React.ReactElement {
  const { data } = useConnection()
  const manual = manualConnectionAllowed()
  const [editing, setEditing] = React.useState(false)
  return h('div', { className: 'lp-card', id: 'lp-connection-card' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title' }, '数据连接'),
      manual ? h('button', { type: 'button', className: 'lp-textbtn', 'aria-expanded': editing, onClick: () => setEditing((current) => !current) }, editing ? '收起' : '手动连接') : null),
    data ? h(ConnectionStatus, { connection: data }) : h(RecordsStatusLine, { journey: props.journey }),
    manual && editing ? h(ConnectionForm, { connection: data, idPrefix: 'lp-profile-conn', onSaved: () => setEditing(false) }) : null)
}

/** The next-checkup add-on list, as rows. What they unlock is said once when it is the same for all of them. */
function AddonRows(props: { journey: Journey; onNotice: Notify; common: string | null }): React.ReactElement {
  return h('ul', { className: 'lp-rows', id: 'lp-profile-addons-addons' },
    ...props.journey.addons.map((row) => {
      const note = [props.common ? '' : `解锁：${row.unlocks_zh}`, row.self_measurable ? '可在家自行测量' : ''].filter(Boolean).join(' · ')
      return h('li', { key: row.item_zh, className: 'lp-row' },
        h('div', { className: 'lp-row-main lp-row-lines' },
          h('span', { className: 'lp-strong' }, row.item_zh),
          note ? h('span', { className: 'lp-caption' }, note) : null),
        row.self_measurable && row.self_key
          ? h(InlineSelf, { journey: props.journey, selfKey: row.self_key, idPrefix: 'lp-profile-addons-' + row.self_key, onNotice: props.onNotice })
          : null)
    }))
}

/** Every export in one card: the report, the calendar, and the whole archive (the link the privacy service hands out). */
function ExportCard(props: { today: string }): React.ReactElement {
  const [archive, setArchive] = React.useState<{ href?: string; note?: string } | null>(null)
  const openSettings = useSettingsOpener()
  React.useEffect(() => {
    let gone = false
    getJson<{ export?: { href?: string; mirobody_note_zh?: string } }>('/api/longpi/privacy')
      .then((body) => { if (!gone) setArchive({ href: body.export?.href, note: body.export?.mirobody_note_zh }) })
      .catch(() => { if (!gone) setArchive(null) })
    return () => { gone = true }
  }, [])
  return h('div', { className: 'lp-card', id: 'lp-export-card' },
    h('div', { className: 'lp-card-head' },
      h('h3', { className: 'lp-card-title' }, '导出'),
      openSettings ? h('button', { type: 'button', className: 'lp-textbtn', onClick: () => openSettings('longpi') }, '隐私与删除', h(Icon, { name: 'chevron', size: 12 })) : null),
    h('p', { className: 'lp-small lp-muted lp-measure' }, '报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；日历文件包含复测日期和每天的打卡提醒。'),
    h('div', { className: 'lp-actions' },
      h(LinkButton, { href: '/api/longpi/report', icon: 'download', download: `longpi-report-${props.today}.md` }, '导出报告'),
      h(LinkButton, { href: '/api/longpi/calendar.ics', icon: 'calendar', download: 'longpi.ics' }, '加入日历'),
      archive?.href ? h(LinkButton, { href: archive.href, icon: 'download' }, '下载完整档案') : null),
    archive?.note ? h('p', { className: 'lp-caption lp-measure' }, archive.note) : null,
    h('p', { className: 'lp-caption lp-plan-aside' }, h(Icon, { name: 'lock', size: 12 }), '导出的文件留在这台电脑上，LongPi 不会发给任何人。'))
}

export function ProfileTab(props: { journey: Journey; onNotice: Notify }): React.ReactElement {
  const { journey } = props
  const today = journey.today
  const unlocks = [...new Set(journey.addons.map((row) => row.unlocks_zh))]
  const common = unlocks.length === 1 && unlocks[0] ? unlocks[0] : null
  // Left: the long profile form. Right: the short cards stacked, so neither column leaves a tall gap.
  return h('div', { className: 'lp-tab-body' },
    // Both columns end on the same line: the grid stretches its rows and the side column's last card takes the slack.
    h('div', { className: 'lp-grid-2', id: 'lp-profile-section' },
      h('div', { className: 'lp-card', id: 'lp-profile-card' },
        h('div', { className: 'lp-card-head' },
          h('h3', { className: 'lp-card-title' }, '基本情况'),
          h('span', { className: 'lp-caption' }, '只保存在这台电脑上')),
        h(ProfileEditor, { journey, variant: 'page', idPrefix: 'lp-profile', onNotice: props.onNotice })),
      h('div', { className: 'lp-profile-side' },
        h('div', { className: 'lp-card', id: 'lp-self-card' },
          h('div', { className: 'lp-card-head' },
            h('h3', { className: 'lp-card-title' }, '自测'),
            h('span', { className: 'lp-caption' }, '腰围 · 家庭血压 · 体重')),
          h(SelfLatestList, { latest: journey.self.latest }),
          h(SelfMeasureForm, { journey, idPrefix: 'lp-self', onNotice: props.onNotice }),
          h('p', { className: 'lp-caption lp-measure' }, '家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。建议早晚各测一次，每次坐位休息 5 分钟后测量。'),
          h(SelfRecent, { onNotice: props.onNotice })),
        h(ConnectionCard, { journey }),
        h(ExportCard, { today }))),
    h(DataInSection),
    // The one full add-on list (总览 only links here with 查看加测清单).
    journey.addons.length > 0
      ? h('div', { className: 'lp-card', id: 'lp-addons-card' },
        h('div', { className: 'lp-card-head' },
          h('h3', { className: 'lp-card-title' }, '下次体检加测'),
          h('span', { className: 'lp-caption' }, common ? `${journey.addons.length} 项 · 解锁${common}` : `${journey.addons.length} 项，加测后可计算更多结果`)),
        h(AddonRows, { journey, onNotice: props.onNotice, common }))
      : null,
    // 数据去哪里 (privacy) lives in settings → 隐私与数据; its archive download is in the 导出 card above, so it is not repeated here.
    ...profileSections().filter((section) => section.id !== 'longpi-privacy').map((section) => h('div', { key: section.id, className: 'lp-card' },
      h(section.Component, { journey, onNotice: props.onNotice }))))
}
