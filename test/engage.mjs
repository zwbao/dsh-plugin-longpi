// Follow-up around the season: the no-plan weekly line, the calendar file, and the desktop notification command.
// The Codex itself (长寿图鉴) is tested in codex-v3.mjs.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCalendar } from '../src/calendar.ts'
import { plainReminderOf } from '../src/engage/engine.ts'
import { decideFollowup, DEFAULT_FOLLOWUP, desktopCommand, followupSilence } from '../src/followup.ts'

const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-engage-'))
  dirs.push(dir)
  return dir
}
const at = (day, time = '10:00') => new Date(`${day}T${time}:00+08:00`)

try {
  assert.match(followupSilence({ now: at('2026-07-27', '12:00'), settings: DEFAULT_FOLLOWUP, state: null, log: [] }), /提醒已关闭/)
  assert.equal(plainReminderOf(tempDir()), null, 'the Codex sends no reminder of its own (design §2: one prompt slot only)')
  const plain = {
    stage: 'first_result', consent_at: '2026-07-01T00:00:00.000Z', next_title_zh: '补一项', next_detail_zh: '',
    plan_exists: false, checkin_items: 0, checkin_open: [], retests: [], week: { pct: null, streak: 0, next_retest: null },
    plain_reminder_zh: '量一次腰围，就能算出心血管风险',
  }
  const sunday = decideFollowup({ now: at('2026-08-02', '20:00'), settings: { ...DEFAULT_FOLLOWUP, enabled: true }, state: plain, log: [] })
  assert.ok(sunday.some((row) => row.key.startsWith('plain:')))
  assert.equal(sunday.some((row) => row.kind === 'weekly'), false)
  const ics = buildCalendar({
    today: '2026-07-27',
    plan: { exists: false, checkin_items: [] },
    addons: [{ item_zh: '腰围', unlocks_zh: '心血管风险', self_measurable: true }],
  }, { items: [] }, { now: at('2026-07-27') })
  assert.match(ics, /腰围 → 解锁心血管风险/)
  const app = tempDir()
  const binDir = join(app, 'LongPi.app', 'Contents', 'MacOS')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(binDir, 'applet'), '')
  const command = desktopCommand('darwin', 'hello', join(app, 'LongPi.app'))
  assert.equal(command.command, join(binDir, 'applet'))
  assert.deepEqual(command.args, ['hello'])
  assert.equal(desktopCommand('darwin', 'hello', null).command, 'osascript')
  console.log('engage ok (follow-up line, calendar, desktop command)')
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
