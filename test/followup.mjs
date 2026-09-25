// Follow-up reminders: settings validation and masking, the scheduler's
// decisions on an injected clock (check-in, retest, weekly, nudge, quiet hours,
// dedup across restarts, 6 a day), webhook payloads and signatures, the desktop
// command (no shell), and the tools and routes. The desktop runner and fetch
// are injected before anything runs: no test calls osascript, notify-send or
// the network. Times are local (no Z), so the test holds in any time zone.

import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as mod from '../lib/index.js'

const commands = []
const requests = []
let fetchAnswer = () => ({ ok: true, status: 200, text: async () => '{"code":0,"msg":"success"}' })
const restore = mod.setFollowupDeps({
  platform: 'darwin',
  run: async (command, args, timeoutMs) => {
    commands.push({ command, args, timeoutMs })
    return { ok: true }
  },
  fetch: async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) })
    return fetchAnswer(url, init)
  },
})

const temp = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-followup-${name}-`))
  temp.push(dir)
  return dir
}
const at = (day, time) => new Date(`${day}T${time}:00`)
const FEISHU = 'https://open.feishu.cn/open-apis/bot/v2/hook/2c0ffee0-token-abcdef'

function state(extra = {}) {
  return {
    stage: 'routine',
    consent_at: '2026-09-01T09:00:00.000Z',
    next_title_zh: '今天的打卡',
    next_detail_zh: '还有 2 项待完成',
    plan_exists: true,
    checkin_items: 2,
    checkin_open: ['快走', '减盐'],
    retests: [{ marker: '甘油三酯', date: '2026-09-24', first_due: '2026-09-24' }, { marker: '超敏C反应蛋白', date: '2026-09-29', first_due: '2026-09-29' }],
    week: { pct: 80, streak: 5, next_retest: { marker: '超敏C反应蛋白', date: '2026-09-29' } },
    ...extra,
  }
}

const on = (extra = {}) => ({ ...mod.DEFAULT_FOLLOWUP, enabled: true, ...extra })
const row = (kind, key, when) => ({ at: when.toISOString(), kind, key, channels: { desktop: true }, ok: true })

try {
  // --- 1. settings: defaults, validation, storage, masking -------------------------------
  const dir = tempDir('settings')
  assert.deepEqual(mod.readFollowup(dir), mod.DEFAULT_FOLLOWUP, 'off by default, 21:00 / 09:00 / Sunday 20:00, desktop, minimal')
  assert.deepEqual(mod.DEFAULT_FOLLOWUP, {
    enabled: false, checkin_time: '21:00', retest_time: '09:00', weekly: { day: 7, time: '20:00' }, desktop: true, webhook: null, detail: 'minimal', quiet: null,
  })
  for (const [update, pattern] of [
    [{ checkin_time: '25:00' }, /checkin_time/],
    [{ retest_time: '9am' }, /retest_time/],
    [{ weekly: { day: 8, time: '20:00' } }, /weekly/],
    [{ quiet: { start: '22:00', end: '22:00' } }, /quiet/],
    [{ detail: 'verbose' }, /detail/],
    [{ enabled: 'yes' }, /enabled/],
    [{ volume: 3 }, /unknown field volume/],
    [{ webhook: { kind: 'slack', url: 'https://hooks.slack.com/x' } }, /webhook.kind/],
    [{ webhook: { kind: 'feishu', url: 'http://open.feishu.cn/hook/x' } }, /https/],
    [{ webhook: { kind: 'generic', url: 'http://example.com/hook' } }, /https/],
    [{ webhook: { kind: 'bark', url: 'https://user:pw@api.day.app/k' } }, /user name/],
    [{ webhook: { kind: 'feishu', url: FEISHU, secret: 'x'.repeat(201) } }, /200/],
    [{ webhook: { kind: 'wecom' } }, /url is required/],
    // quiet hours that wrap midnight and start at or before a send time: that send could never go out
    [{ quiet: { start: '21:00', end: '07:00' } }, /checkin_time 21:00 falls in the quiet hours/],
    [{ quiet: { start: '19:30', end: '08:00' } }, /checkin_time 21:00/],
    [{ checkin_time: '19:00', quiet: { start: '19:30', end: '08:00' } }, /weekly.time 20:00/],
  ]) {
    const result = mod.writeFollowup(dir, update)
    assert.equal(result.ok, false, JSON.stringify(update))
    assert.match(result.error, pattern)
  }
  assert.equal(existsSync(join(dir, 'followup.json')), false, 'nothing is written when an update is refused')
  let saved = mod.writeFollowup(dir, { enabled: true, checkin_time: '9:05', weekly: { day: 3 }, webhook: { kind: 'feishu', url: FEISHU, secret: 'sekrit' } })
  assert.equal(saved.ok, true, saved.error)
  assert.equal(saved.settings.checkin_time, '09:05', 'H:MM is normalized')
  assert.deepEqual(saved.settings.weekly, { day: 3, time: '20:00' }, 'a partial weekly keeps the other field')
  assert.equal(statSync(join(dir, 'followup.json')).mode & 0o777, 0o600)
  saved = mod.writeFollowup(dir, { webhook: { kind: 'feishu' } })
  assert.deepEqual(saved.settings.webhook, { kind: 'feishu', url: FEISHU, secret: 'sekrit' }, 'url and secret omitted keep the stored ones')
  saved = mod.writeFollowup(dir, { webhook: { kind: 'generic', secret: '' } })
  assert.deepEqual(saved.settings.webhook, { kind: 'generic', url: FEISHU, secret: '' }, "secret '' clears it; the kind can change")
  assert.equal(mod.writeFollowup(dir, { webhook: { kind: 'generic', url: 'https://192.168.1.20:8443/longpi' } }).ok, true, 'generic may be https on the local network')
  assert.equal(mod.writeFollowup(dir, { webhook: { kind: 'generic', url: 'http://192.168.1.20:8080/longpi' } }).ok, false, 'never plain http, even on the local network')
  assert.equal(mod.writeFollowup(dir, { webhook: { kind: 'generic', url: 'https://localhost:9000/x' } }).ok, false, 'never this machine')
  assert.equal(mod.writeFollowup(dir, { webhook: null }).settings.webhook, null, 'null removes the channel')
  assert.equal(statSync(join(dir, 'followup.json')).mode & 0o777, 0o600, 'rewritten, still private')
  writeFileSync(join(dir, 'followup.json'), '{"enabled": true, "checkin_time": "99:99", "detail": "loud"}')
  assert.deepEqual(mod.readFollowup(dir), { ...mod.DEFAULT_FOLLOWUP, enabled: true }, 'a bad stored field falls back to its default')

  const secretSettings = on({ webhook: { kind: 'feishu', url: FEISHU, secret: 'sekrit' } })
  const shown = mod.publicFollowup(secretSettings)
  assert.deepEqual(shown.webhook, { kind: 'feishu', url_masked: 'https://open.feishu.cn/…', secret_set: true })
  assert.doesNotMatch(JSON.stringify(shown), /token|sekrit|hook\//, 'neither the URL path nor the secret is shown')
  assert.equal(mod.publicFollowup(on({ webhook: { kind: 'bark', url: 'https://api.day.app/KEY', secret: '' } })).webhook.secret_set, false)
  assert.equal(mod.maskUrl('not a url'), '…')

  // --- 2. decisions on an injected clock --------------------------------------------------
  const decide = (now, settings = on(), s = state(), log = []) => mod.decideFollowup({ now, settings, state: s, log })
  const kinds = (sends) => sends.map((send) => send.kind)
  assert.deepEqual(decide(at('2026-09-24', '08:59')), [], 'nothing before any time')
  assert.deepEqual(decide(at('2026-09-24', '21:05'), on({ enabled: false })), [], 'nothing while off')
  let sends = decide(at('2026-09-24', '21:05'))
  const checkin = sends.find((send) => send.kind === 'checkin')
  assert.deepEqual(checkin, { kind: 'checkin', key: 'checkin:2026-09-24', text: 'LongPi：今天还有 2 项方案待打卡。' }, 'minimal: no item names')
  assert.equal(decide(at('2026-09-24', '21:05'), on({ detail: 'full' })).find((send) => send.kind === 'checkin').text, 'LongPi：今天还有 2 项方案待打卡：快走、减盐。')
  assert.equal(kinds(decide(at('2026-09-24', '20:59'))).includes('checkin'), false, 'not due before check-in time')
  assert.equal(kinds(decide(at('2026-09-24', '21:05'), on(), state({ checkin_open: [] }))).includes('checkin'), false, 'all done: no reminder')
  assert.equal(kinds(decide(at('2026-09-24', '21:05'), on(), state(), [row('checkin', 'checkin:2026-09-24', at('2026-09-24', '21:00'))])).includes('checkin'), false, 'once a day')

  sends = decide(at('2026-09-24', '09:00'))
  assert.deepEqual(sends, [{ kind: 'retest', key: 'retest:甘油三酯:2026-09-24', text: 'LongPi：今天有一项复测到期。' }], 'only the retest dated today, minimal')
  assert.equal(decide(at('2026-09-24', '09:00'), on({ detail: 'full' }))[0].text, 'LongPi：今天可以复测甘油三酯了。')
  const twoDue = state({ retests: [{ marker: '甘油三酯', date: '2026-09-24', first_due: '2026-09-24' }, { marker: '空腹血糖', date: '2026-09-24', first_due: '2026-09-20' }] })
  assert.deepEqual(decide(at('2026-09-24', '09:30'), on(), twoDue).map((send) => [send.key, send.text]), [['retest:甘油三酯:2026-09-24|retest:空腹血糖:2026-09-20', 'LongPi：今天有 2 项复测到期。']])
  // an overdue retest keeps moving to today; it is reminded once, keyed by the day it first became due
  const overdue = state({ retests: [{ marker: '空腹血糖', date: '2026-09-25', first_due: '2026-09-20' }] })
  assert.deepEqual(decide(at('2026-09-25', '09:30'), on(), overdue, [row('retest', 'retest:甘油三酯:2026-09-24|retest:空腹血糖:2026-09-20', at('2026-09-24', '09:30'))]), [])

  // weekly: on the day and after the time, once per ISO week, never for a past week
  assert.equal(mod.isoWeekday(at('2026-09-27', '12:00')), 7)
  assert.equal(mod.isoWeek(at('2026-09-27', '12:00')), '2026-W39')
  assert.equal(mod.isoWeek(at('2026-09-28', '12:00')), '2026-W40')
  assert.equal(mod.isoWeek(at('2021-01-03', '12:00')), '2020-W53', 'ISO week-numbering year')
  const sunday = at('2026-09-27', '20:00')
  const weekly = decide(sunday, on(), state({ checkin_open: [] })).find((send) => send.kind === 'weekly')
  assert.deepEqual(weekly, { kind: 'weekly', key: 'weekly:2026-W39', text: 'LongPi 本周小结已更新，打开健康页查看。' })
  assert.equal(decide(sunday, on({ detail: 'full' }), state({ checkin_open: [] })).find((send) => send.kind === 'weekly').text, 'LongPi：本周方案执行率 80%，连续 5 天；下次复测：超敏C反应蛋白 9 月 29 日。')
  assert.equal(kinds(decide(at('2026-09-27', '21:30'), on(), state(), [row('weekly', 'weekly:2026-W39', sunday)])).includes('weekly'), false, 'once per week')
  assert.equal(kinds(decide(at('2026-09-28', '21:30'))).includes('weekly'), false, 'Monday does not back-fill Sunday')
  assert.equal(kinds(decide(at('2026-09-27', '19:59'))).includes('weekly'), false)
  assert.equal(kinds(decide(sunday, on({ weekly: null }))).includes('weekly'), false)
  assert.equal(kinds(decide(sunday, on(), state({ plan_exists: false }))).includes('weekly'), false, 'no plan, no weekly summary')

  // quiet hours hold everything; a window may wrap midnight
  const quiet = on({ quiet: { start: '20:00', end: '22:00' } })
  assert.deepEqual(decide(at('2026-09-24', '21:05'), quiet), [])
  assert.ok(kinds(decide(at('2026-09-24', '22:00'), quiet)).includes('checkin'), 'sent when the quiet hours end, the same day')
  const night = { start: '22:30', end: '08:00' }
  assert.equal(mod.inQuiet(night, at('2026-09-24', '23:00')), true)
  assert.equal(mod.inQuiet(night, at('2026-09-24', '07:59')), true)
  assert.equal(mod.inQuiet(night, at('2026-09-24', '08:00')), false)
  assert.equal(mod.inQuiet(night, at('2026-09-24', '22:29')), false)

  // the nudge: an early stage for 3 days after consent, once in 7 days, at check-in time
  const stuck = state({ stage: 'records', plan_exists: false, checkin_items: 0, checkin_open: [], retests: [], next_title_zh: '连接体检记录', next_detail_zh: '在 Mirobody 中生成个人 MCP 地址。', consent_at: at('2026-09-21', '10:00').toISOString() })
  assert.deepEqual(decide(at('2026-09-24', '21:00'), on(), stuck), [{ kind: 'nudge', key: 'nudge:records:2026-09-24', text: 'LongPi：下一步「连接体检记录」，打开健康页继续。' }])
  assert.deepEqual(decide(at('2026-09-23', '21:00'), on(), stuck), [], 'not before 3 days')
  assert.deepEqual(decide(at('2026-09-24', '20:00'), on(), stuck), [], 'not before check-in time')
  assert.deepEqual(decide(at('2026-09-24', '21:00'), on(), stuck, [row('nudge', 'nudge:records:2026-09-18', at('2026-09-18', '21:00'))]), [], 'not twice in 7 days')
  assert.equal(decide(at('2026-09-25', '21:00'), on(), stuck, [row('nudge', 'nudge:records:2026-09-18', at('2026-09-18', '21:00'))]).length, 1, 'again after 7 days')
  assert.deepEqual(decide(at('2026-09-24', '21:00'), on(), { ...stuck, consent_at: null }), [], 'no consent, no nudge')
  assert.deepEqual(decide(at('2026-09-24', '21:00'), on(), { ...stuck, stage: 'plan' }), [], 'only the stages before a first result')

  // next planned times
  assert.deepEqual(mod.nextTimes(on({ enabled: false }), state(), at('2026-09-24', '10:00'), []), { checkin: null, retest: null, weekly: null })
  assert.deepEqual(mod.nextTimes(on(), state(), at('2026-09-24', '10:00'), []), { checkin: '2026-09-24T21:00:00', retest: '2026-09-29T09:00:00', weekly: '2026-09-27T20:00:00' })
  assert.deepEqual(mod.nextTimes(on(), state(), at('2026-09-24', '08:00'), []).retest, '2026-09-24T09:00:00')
  assert.equal(mod.nextTimes(on(), state(), at('2026-09-24', '22:00'), []).checkin, '2026-09-25T21:00:00')
  assert.equal(mod.nextTimes(on(), state(), at('2026-09-27', '20:30'), [row('weekly', 'weekly:2026-W39', sunday)]).weekly, '2026-10-04T20:00:00')
  assert.deepEqual(mod.nextTimes(on(), null, at('2026-09-24', '10:00'), []), { checkin: null, retest: null, weekly: null }, 'nothing planned without a plan')
  // quiet hours: a time inside them is planned for when they end; one in the part before midnight never goes out
  assert.equal(mod.heldUntil('21:00', { start: '20:00', end: '22:00' }), '22:00')
  assert.equal(mod.heldUntil('07:00', { start: '22:30', end: '08:00' }), '08:00')
  assert.equal(mod.heldUntil('23:00', { start: '22:30', end: '08:00' }), null)
  assert.equal(mod.heldUntil('21:00', { start: '22:30', end: '08:00' }), '21:00')
  assert.equal(mod.nextTimes(on({ quiet: { start: '20:00', end: '22:00' } }), state(), at('2026-09-24', '21:30'), []).checkin, '2026-09-24T22:00:00', 'held until 22:00 the same day, as decideFollowup sends it')
  assert.ok(kinds(decide(at('2026-09-24', '22:00'), on({ quiet: { start: '20:00', end: '22:00' } }))).includes('checkin'))
  const lostNight = on({ checkin_time: '23:00', quiet: { start: '22:30', end: '08:00' } })
  assert.equal(mod.nextTimes(lostNight, state(), at('2026-09-24', '12:00'), []).checkin, null, 'a stored time that can never go out is not promised')
  assert.equal(mod.nextTimes(on({ retest_time: '07:00', quiet: { start: '22:30', end: '08:00' } }), state(), at('2026-09-24', '06:00'), []).retest, '2026-09-24T08:00:00')

  // --- 3. the tick: sends, the log, restarts, the daily limit --------------------------------
  const tickDir = tempDir('tick')
  mod.writeFollowup(tickDir, { enabled: true, desktop: true })
  let reads = 0
  const getState = async () => {
    reads += 1
    return state()
  }
  assert.deepEqual(await mod.followupTick({ dataDir: tickDir, now: at('2026-09-24', '08:00'), getState }), [])
  assert.equal(reads, 0, 'the journey is not read while nothing can be due')
  commands.length = 0
  let rows = await mod.followupTick({ dataDir: tickDir, now: at('2026-09-24', '23:30'), getState })
  assert.deepEqual(rows.map((item) => [item.kind, item.key, item.ok, item.channels]), [
    ['checkin', 'checkin:2026-09-24', true, { desktop: true }],
    ['retest', 'retest:甘油三酯:2026-09-24', true, { desktop: true }],
  ], 'a check-in missed at 21:00 (host off) goes out at the next tick of the same day')
  assert.deepEqual(commands.map((item) => item.command), ['osascript', 'osascript'])
  assert.equal(commands[0].timeoutMs, 10_000)
  assert.equal(statSync(join(tickDir, 'followup_log.jsonl')).mode & 0o777, 0o600)
  // a restart: nothing in memory, the log file decides
  assert.deepEqual(await mod.followupTick({ dataDir: tickDir, now: at('2026-09-24', '23:31'), getState }), [], 'no second send after a restart')
  rows = await mod.followupTick({ dataDir: tickDir, now: at('2026-09-25', '08:00'), getState })
  assert.deepEqual(rows, [], "yesterday's reminders are never back-filled")
  assert.equal(mod.readFollowupLog(tickDir).length, 2)

  // at most 6 a day, every kind counted
  const limitDir = tempDir('limit')
  mod.writeFollowup(limitDir, { enabled: true })
  for (let i = 0; i < 5; i += 1) mod.appendFollowupLog(limitDir, row('custom', `custom:${i}`, at('2026-09-24', `10:0${i}`)))
  mod.appendFollowupLog(limitDir, row('test', 'test:x', at('2026-09-23', '10:00')))
  assert.equal(mod.sentToday(mod.readFollowupLog(limitDir), at('2026-09-24', '21:00')), 5, "yesterday's send does not count")
  rows = await mod.followupTick({ dataDir: limitDir, now: at('2026-09-24', '21:05'), getState })
  assert.deepEqual(rows.map((item) => item.kind), ['checkin'], 'the sixth send goes out, the seventh does not')
  assert.equal(mod.followupArmed(mod.readFollowup(limitDir), mod.readFollowupLog(limitDir), at('2026-09-24', '21:30')), false)
  const refused = await mod.sendNow(limitDir, '你好', 'custom', at('2026-09-24', '21:40'))
  assert.equal(refused.ok, false)
  assert.match(refused.error, /上限/)
  assert.equal(mod.readFollowupLog(limitDir).length, 7, 'a refused send is not logged')

  // --- 4. channels: webhook payloads and signatures, the desktop command ------------------------
  const now = at('2026-09-24', '21:00')
  const feishu = mod.webhookRequest({ kind: 'feishu', url: FEISHU, secret: 'sekrit' }, 'LongPi：今天还有 1 项方案待打卡。', 'checkin', now)
  const seconds = String(Math.floor(now.getTime() / 1000))
  assert.equal(feishu.url, FEISHU)
  assert.deepEqual(feishu.body, {
    msg_type: 'text', content: { text: 'LongPi：今天还有 1 项方案待打卡。' }, timestamp: seconds,
    sign: createHmac('sha256', `${seconds}\nsekrit`).update('').digest('base64'),
  })
  assert.deepEqual(mod.webhookRequest({ kind: 'feishu', url: FEISHU, secret: '' }, 'hi', 'custom', now).body, { msg_type: 'text', content: { text: 'hi' } }, 'no secret, no signature')
  const DING = 'https://oapi.dingtalk.com/robot/send?access_token=abc'
  const ding = mod.webhookRequest({ kind: 'dingtalk', url: DING, secret: 'SECabc' }, 'hi', 'custom', now)
  const millis = String(now.getTime())
  assert.equal(ding.url, `${DING}&timestamp=${millis}&sign=${encodeURIComponent(createHmac('sha256', 'SECabc').update(`${millis}\nSECabc`).digest('base64'))}`)
  assert.deepEqual(ding.body, { msgtype: 'text', text: { content: 'hi' } })
  assert.deepEqual(mod.webhookRequest({ kind: 'wecom', url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=k', secret: '' }, 'hi', 'custom', now).body, { msgtype: 'text', text: { content: 'hi' } })
  assert.deepEqual(mod.webhookRequest({ kind: 'bark', url: 'https://api.day.app/KEY', secret: '' }, 'LongPi：今天有一项复测到期。', 'retest', now).body, { title: 'LongPi', body: '今天有一项复测到期。', group: 'LongPi' })
  assert.deepEqual(mod.webhookRequest({ kind: 'generic', url: 'https://example.org/in', secret: '' }, 'hi', 'weekly', now).body, { title: 'LongPi', text: 'hi', kind: 'weekly', sent_at: now.toISOString() })
  assert.deepEqual(mod.webhookAnswer('feishu', 200, '{"code":19021,"msg":"sign match fail or timestamp is not within one hour from current time"}').ok, false)
  assert.deepEqual(mod.webhookAnswer('feishu', 200, '{"StatusCode":0}'), { ok: true })
  assert.equal(mod.webhookAnswer('dingtalk', 200, '{"errcode":310000,"errmsg":"sign not match"}').ok, false)
  assert.deepEqual(mod.webhookAnswer('wecom', 200, '{"errcode":0,"errmsg":"ok"}'), { ok: true })
  assert.deepEqual(mod.webhookAnswer('bark', 200, '{"code":200}'), { ok: true })
  assert.deepEqual(mod.webhookAnswer('generic', 500, 'boom'), { ok: false, error: 'HTTP 500' })

  const tricky = 'LongPi：a "quoted" \\ back\nslash'
  assert.deepEqual(mod.desktopCommand('darwin', tricky), { command: 'osascript', args: ['-e', 'display notification "a \\"quoted\\" \\\\ back slash" with title "LongPi"'] }, 'quotes and backslashes escaped, one argument, no shell')
  assert.deepEqual(mod.desktopCommand('linux', '-u critical'), { command: 'notify-send', args: ['--', 'LongPi', '-u critical'] }, 'a body is never read as an option')
  assert.equal(mod.desktopCommand('win32', 'hi'), null)
  assert.equal(mod.desktopSupported('win32'), false)

  commands.length = 0
  requests.length = 0
  let sent = await mod.sendFollowup(on({ webhook: { kind: 'feishu', url: FEISHU, secret: 'sekrit' } }), 'LongPi：hi', { kind: 'custom', now })
  assert.deepEqual(sent, { ok: true, channels: { desktop: { ok: true }, webhook: { ok: true } } })
  assert.deepEqual(commands[0].args, ['-e', 'display notification "hi" with title "LongPi"'])
  assert.equal(requests[0].url, FEISHU)
  assert.equal(requests[0].init.method, 'POST')
  assert.equal(requests[0].init.redirect, 'manual', 'a redirect is a failed send, never a message forwarded elsewhere')
  assert.equal(requests[0].body.sign, feishu.body.sign)
  fetchAnswer = () => {
    const error = new Error(`request to ${FEISHU} failed`)
    throw error
  }
  sent = await mod.sendFollowup(on({ desktop: false, webhook: { kind: 'feishu', url: FEISHU, secret: '' } }), 'hi', { now })
  assert.equal(sent.ok, false)
  assert.doesNotMatch(sent.channels.webhook.error, /token/, 'the webhook URL never enters an error')
  fetchAnswer = () => {
    const error = new Error('aborted')
    error.name = 'TimeoutError'
    throw error
  }
  sent = await mod.sendFollowup(on({ desktop: false, webhook: { kind: 'bark', url: 'https://api.day.app/KEY', secret: '' } }), 'hi', { now })
  assert.deepEqual(sent.channels.webhook, { ok: false, error: 'timeout' })
  fetchAnswer = () => ({ ok: true, status: 200, text: async () => '{"code":0}' })
  sent = await mod.sendFollowup(on({ desktop: false }), 'hi', { now })
  assert.deepEqual(sent, { ok: false, channels: {} }, 'no channel, nothing sent')
  const restoreLinux = mod.setFollowupDeps({ platform: 'win32' })
  sent = await mod.sendFollowup(on(), 'hi', { now })
  assert.deepEqual(sent.channels, {}, 'desktop is skipped where there is no notifier')
  restoreLinux()

  // --- 5. tools and routes, through the plugin's own apply ---------------------------------------
  const routeDir = tempDir('routes')
  const host = fakeHost()
  await mod.apply(host.ctx, {
    mcpUrl: '', mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir: routeDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6, skillsVersion: '',
  })
  assert.equal(host.effects.length, 1, 'the scheduler is one Cordis effect')
  assert.ok(mod.TOOL_NAMES.includes('set_followup') && mod.TOOL_NAMES.includes('send_followup_message'))
  const message = host.tools.get('send_followup_message')
  let answer = await message.execute({ text: '这周做得不错，继续坚持快走。' })
  assert.equal(answer.ok, false, 'refused while follow-up is off')
  assert.match(answer.error, /没有打开/)
  assert.equal(mod.readFollowupLog(routeDir).length, 0)

  let res = await call(host, 'GET', '/api/longpi/followup')
  assert.equal(res.status, 200)
  let body = res.json()
  assert.deepEqual(Object.keys(body).sort(), ['log', 'next', 'platform_desktop', 'settings'])
  assert.equal(body.settings.enabled, false)
  assert.deepEqual(body.next, { checkin: null, retest: null, weekly: null })
  assert.equal(body.platform_desktop, true)
  res = await call(host, 'POST', '/api/longpi/followup', { checkin_time: '31:00' })
  assert.equal(res.status, 400)
  assert.equal(res.json().ok, false)
  res = await call(host, 'POST', '/api/longpi/followup', { enabled: true, quiet: { start: '22:30', end: '08:00' }, webhook: { kind: 'dingtalk', url: DING, secret: 'SECabc' } })
  assert.equal(res.status, 200, res.text)
  body = res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.settings.webhook, { kind: 'dingtalk', url_masked: 'https://oapi.dingtalk.com/…', secret_set: true })
  assert.deepEqual(body.settings.quiet, { start: '22:30', end: '08:00' })
  assert.doesNotMatch(res.text, /access_token|SECabc/)
  res = await call(host, 'POST', '/api/longpi/followup', { webhook: { kind: 'dingtalk', secret: '' } })
  assert.equal(res.json().settings.webhook.secret_set, false, 'the page can clear the secret and keep the URL')
  assert.equal(mod.readFollowup(routeDir).webhook.url, DING)

  requests.length = 0
  commands.length = 0
  res = await call(host, 'POST', '/api/longpi/followup/test')
  assert.equal(res.status, 200)
  assert.deepEqual(res.json(), { ok: true, channels: { desktop: { ok: true }, webhook: { ok: true } } })
  assert.equal(requests[0].body.text.content, '这是一条 LongPi 测试提醒。')
  assert.deepEqual(commands[0].args, ['-e', 'display notification "这是一条 LongPi 测试提醒。" with title "LongPi"'])
  const logged = mod.readFollowupLog(routeDir)
  assert.equal(logged.at(-1).kind, 'test')
  assert.match(logged.at(-1).key, /^test:/, 'a test never stands in for a scheduled key')
  res = await call(host, 'GET', '/api/longpi/followup')
  assert.equal(res.json().log[0].kind, 'test', 'newest first')

  const setTool = host.tools.get('set_followup')
  answer = await setTool.execute({ checkin_time: '20:30', detail: 'full', weekly: null })
  assert.equal(answer.ok, true)
  assert.equal(answer.settings.checkin_time, '20:30')
  assert.equal(answer.settings.weekly, null)
  assert.equal(answer.settings.webhook.url_masked, 'https://oapi.dingtalk.com/…')
  assert.deepEqual(Object.keys(answer.next).sort(), ['checkin', 'retest', 'weekly'])
  assert.equal((await setTool.execute({ webhook: { kind: 'feishu', url: 'http://insecure' } })).ok, false)

  // turning follow-up on, full detail and a webhook address wait for the person's approval in DSH
  assert.equal(host.preExecute.length, 1, 'one tools/pre-execute listener')
  const gate = (name, args, before = { kind: 'allow' }) => host.preExecute[0]({ name, arguments: args }, async () => before)
  assert.deepEqual(await gate('set_followup', { enabled: true }), { kind: 'ask', reason: 'LongPi 要开启随访提醒。只有你本人要求过才同意。' })
  assert.match((await gate('set_followup', { detail: 'full', webhook: { kind: 'generic', url: 'https://attacker.example/x?token=1' } })).reason, /完整.*https:\/\/attacker\.example\/…/)
  assert.doesNotMatch((await gate('set_followup', { webhook: { kind: 'generic', url: 'https://attacker.example/x?token=1' } })).reason, /token/, 'the reason shows the host, not the secret path')
  assert.deepEqual(await gate('set_followup', { checkin_time: '20:30', quiet: null }), { kind: 'allow' }, 'times need no approval')
  assert.deepEqual(await gate('set_followup', { enabled: false, webhook: null, detail: 'minimal' }), { kind: 'allow' }, 'turning things off needs none')
  assert.deepEqual(await gate('send_followup_message', { text: 'x' }), { kind: 'allow' })
  assert.deepEqual(await gate('set_followup', { enabled: true }, { kind: 'deny', reason: 'policy' }), { kind: 'deny', reason: 'policy' }, 'another listener\'s denial stands')

  // quiet hours hold model-written messages too (the page's test button is the only exception)
  const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const clock = new Date()
  mod.writeFollowup(routeDir, { quiet: { start: hhmm(new Date(clock.getTime() - 3_600_000)), end: hhmm(new Date(clock.getTime() + 3_600_000)) }, checkin_time: hhmm(new Date(clock.getTime() + 7_200_000)), retest_time: hhmm(new Date(clock.getTime() + 7_200_000)) })
  const logBefore = mod.readFollowupLog(routeDir).length
  answer = await message.execute({ text: '这周做得不错，继续坚持。' })
  assert.equal(answer.ok, false)
  assert.match(answer.error, /免打扰/)
  assert.equal(mod.readFollowupLog(routeDir).length, logBefore, 'nothing sent or logged')
  mod.writeFollowup(routeDir, { quiet: null, checkin_time: '20:30', retest_time: '09:00' })

  answer = await message.execute({ text: '这周做得不错，继续坚持快走。', kind: 'weekly' })
  assert.equal(answer.ok, true, JSON.stringify(answer))
  assert.equal(mod.readFollowupLog(routeDir).at(-1).kind, 'weekly')
  assert.match((await message.execute({ text: '记得每天吃 2 粒鱼油。' })).error, /剂量/, 'never a dose')
  answer = await message.execute({ text: '本周血压平均 128 mmHg，继续保持。' })
  assert.equal(answer.ok, true, 'with full detail a value may go out')
  mod.writeFollowup(routeDir, { detail: 'minimal' })
  assert.match((await message.execute({ text: '本周血压平均 128 mmHg。' })).error, /简要/)
  assert.match((await message.execute({ text: 'x'.repeat(301) })).error, /300/)
  assert.equal(mod.followupTextProblem('今天也记得快走哦', 'minimal'), '')
  // minimal detail: a number may only be a date, a time or a count; unit-less values, Chinese units and full-width digits are values too
  for (const text of ['LongPi：你今天的血压 150/95，记得晚上复测。', '体重72.5，比上周降了', '空腹血糖 6.8，偏高', '体重 72 千克', '血压150/95毫米汞柱',
    '低密度脂蛋白 4.1，比上次高', '空腹血糖 7.2 毫摩尔/升', 'LDL-C 3.8 → 3.2', 'hs-CRP 由 4.1 降至 2.3', '糖化血红蛋白 6.5', '空腹血糖 ６.８', 'HbA1c 7', '本周执行率 80%', '降了三公斤']) {
    assert.match(mod.followupTextProblem(text, 'minimal'), /简要/, text)
  }
  for (const text of ['LongPi：今天还有 2 项方案待打卡。', '这周坚持了 5 天，打开健康页看看小结。', '9 月 29 日可以复测了，晚上 8 点前记得打卡。', '2026-09-29 复测，21:00 前打卡']) {
    assert.equal(mod.followupTextProblem(text, 'minimal'), '', text)
  }
  // ...and no plan item or marker name
  assert.match(mod.followupTextProblem('这周坚持了减盐和快走', 'minimal', ['减盐', '收缩压']), /「减盐」/)
  assert.equal(mod.followupTextProblem('这周坚持了减盐和快走', 'full', ['减盐']), '', 'full detail names items')
  // never a dose, however it is written
  for (const text of ['每天吃一百毫克阿司匹林', '鱼油每天两克', '维生素D 每天 1000 单位', '每天 2 胶囊鱼油', '鱼油 ２ｇ', '每天一千单位维生素D']) {
    assert.match(mod.followupTextProblem(text, 'full'), /剂量/, text)
  }
  assert.equal(mod.followupTextProblem('体重 72 千克，继续保持', 'full'), '', '千克 is a weight, not a dose')

  // journey.followup and /longpi
  mod.setConsent(routeDir, true)
  res = await call(host, 'GET', '/api/longpi/journey')
  assert.deepEqual(res.json().followup, { enabled: true, channels: ['desktop', 'webhook'], next_at: null }, 'no plan: nothing planned yet')
  assert.match(host.commands.get('longpi').handler({ rawInput: '/longpi' }).text, /^followup on$/m)
  assert.deepEqual(mod.followupSummary(routeDir, state(), at('2026-09-24', '10:00')), { enabled: true, channels: ['desktop', 'webhook'], next_at: '2026-09-24T20:30:00' })

  // the scheduler: an effect that ticks, reads the journey only when due, and stops on dispose
  const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))
  const scheduleDir = tempDir('schedule')
  mod.writeFollowup(scheduleDir, { enabled: true })
  let ticks = 0
  const effects = []
  mod.startFollowup({ effect: (execute) => { effects.push(execute()); return effects.at(-1) } }, () => ({
    dataDir: scheduleDir,
    getState: async () => {
      ticks += 1
      return state()
    },
    generation: mod.trackingGeneration,
  }), { tickMs: 10, now: () => at('2026-09-24', '21:05') })
  for (let i = 0; i < 50 && mod.readFollowupLog(scheduleDir).length < 2; i += 1) await wait(10)
  await wait(40)
  assert.equal(mod.readFollowupLog(scheduleDir).length, 2, 'the check-in and the retest went out once each')
  assert.equal(ticks, 1, 'one journey read, reused while nothing changed')
  // a check-in (or any save) invalidates tracking: the next tick reads the journey again
  mod.invalidateTracking()
  for (let i = 0; i < 50 && ticks < 2; i += 1) await wait(10)
  assert.equal(ticks, 2, 'a change forces a fresh read, so a reminder never counts items already ticked')
  effects.forEach((dispose) => dispose())
  const settled = mod.readFollowupLog(scheduleDir).length
  assert.equal(settled, 2)
  await wait(50)
  assert.equal(mod.readFollowupLog(scheduleDir).length, settled, 'nothing after dispose')
  assert.equal(ticks, 2)

  // the tool reads the plan's names itself
  mod.savePlan(routeDir, mod.normalizePlan({ items: [{ category: 'diet', title: '减盐', detail: '', start: '2026-09-01', markers: ['收缩压'] }] }, { today: '2026-09-24', medications: [], previous: null }).plan)
  assert.match((await message.execute({ text: '这周减盐坚持得很好。' })).error, /「减盐」/)
  assert.match((await message.execute({ text: '记得关注收缩压。' })).error, /「收缩压」/)

  host.dispose()
  console.log(`followup ok (${mod.readFollowupLog(routeDir).length} sends logged in the route test; no osascript, no network)`)
} finally {
  restore()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}

function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const commands = new Map()
  const effects = []
  const preExecute = []
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: (command) => { commands.set(command.name, command) } },
    inject: (_names, callback) => callback(ctx),
    on: (name, listener) => {
      if (name === 'tools/pre-execute') preExecute.push(listener)
      return () => {}
    },
    effect: (execute) => {
      const dispose = execute()
      effects.push(dispose)
      return dispose
    },
  }
  return { ctx, tools, routes, commands, effects, preExecute, dispose: () => effects.splice(0).forEach((fn) => fn()) }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolveCall) => {
    const headers = {}
    const res = {
      statusCode: 200,
      writableEnded: false,
      setHeader: (key, value) => { headers[key.toLowerCase()] = value },
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, headers, text: raw, json: () => JSON.parse(raw) })
      },
    }
    handler(req, res)
  })
}
