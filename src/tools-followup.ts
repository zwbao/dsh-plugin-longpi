// Tools for follow-up reminders the person opted into: change the settings
// (only on their word), and send a message the model wrote through the same
// channels, for DSH scheduled follow-ups they agreed to. Never a dose; with
// minimal detail, never a health value.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from './config.ts'
import { followupResponse, readFollowup, sendNow, writeFollowup, WEBHOOK_KINDS, type FollowupState } from './followup.ts'
import { asJson } from './json.ts'
import { resolveDataDir } from './paths.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

const TEXT_MAX = 300
// An amount of a medicine or supplement (mg, 粒, 片…); a concentration such as mmol/L is not one.
const DOSE = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|μg|ug|iu|g|ml|毫克|微克|国际单位|克|毫升|粒|片|颗|支|滴|袋|勺)(?!\s*\/\s*(?:d?l|ml)\b)|[一二两三四五六七八九十半]+\s*(?:粒|片|颗|支|滴|袋|勺)|剂量/i
// A health value: a number with a clinical unit (mmHg, mmol/L, kg, cm, %, 岁…).
const HEALTH_VALUE = /\d+(?:\.\d+)?\s*(?:mmhg|mmol|umol|μmol|mg\/|g\/l|kg|公斤|斤|cm|厘米|%|％|岁|bpm|次\/分)/i

/** The model's text is refused, with the reason, when it names a dose or (with minimal detail) a health value. */
export function followupTextProblem(text: string, detail: 'minimal' | 'full'): string {
  if (!text) return '没有内容。'
  if ([...text].length > TEXT_MAX) return `超过 ${TEXT_MAX} 字。`
  if (DOSE.test(text)) return '随访消息不能包含剂量。'
  if (detail === 'minimal' && HEALTH_VALUE.test(text)) return '随访设置为“简要”，消息里不能有健康数值（血压、血脂、体重、百分比等）。'
  return ''
}

export function registerFollowupTools(ctx: Context, config: () => Config, state: () => Promise<FollowupState | null>): void {
  const dataDir = () => resolveDataDir(config().dataDir)

  ctx.tools.register(defineTool({
    name: 'set_followup',
    description: 'Change follow-up reminders LongPi sends by itself while DeepSeek Harness runs: a check-in reminder at checkin_time when plan items are not ticked, a reminder at retest_time on retest days, a weekly summary, and one nudge when the first steps stall. Channels: a desktop notification and/or one webhook (feishu, wecom, dingtalk, bark, or generic: the person\'s own https endpoint). Pass only what the person just asked to change. Set enabled only when the person asked for follow-up (true) or to stop it (false). detail minimal (default) sends no health value or item name; full sends item names and adherence. Returns the settings (the webhook URL masked, the secret only as set or not) and the next planned times.',
    parameters: {
      enabled: { type: 'boolean', description: 'true only when the person asked for reminders; false when they want them off.' },
      checkin_time: { type: 'string', description: 'HH:MM local, default 21:00.' },
      retest_time: { type: 'string', description: 'HH:MM local, default 09:00.' },
      weekly: {
        oneOf: [
          { type: 'object', additionalProperties: false, properties: { day: { type: 'integer', description: 'ISO weekday: Monday 1 … Sunday 7.' }, time: { type: 'string', description: 'HH:MM.' } } },
          { type: 'null' },
        ],
        description: 'Weekly summary day and time (default Sunday 20:00); null turns it off.',
      },
      desktop: { type: 'boolean', description: 'Desktop notifications on this computer (macOS or Linux).' },
      webhook: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: [...WEBHOOK_KINDS] },
              url: { type: 'string', description: 'The bot or push URL the person gave (https). Omit to keep the saved one.' },
              secret: { type: 'string', description: 'The signing secret they gave (Feishu, DingTalk). Omit to keep; empty string clears it.' },
            },
          },
          { type: 'null' },
        ],
        description: 'One webhook channel; null removes it.',
      },
      detail: { type: 'string', enum: ['minimal', 'full'], description: 'minimal: no health values or item names leave the machine (default). full: item names and adherence are sent.' },
      quiet: {
        oneOf: [
          { type: 'object', additionalProperties: false, properties: { start: { type: 'string' }, end: { type: 'string' } } },
          { type: 'null' },
        ],
        description: 'Quiet hours HH:MM–HH:MM (may wrap midnight, e.g. 22:30–08:00) with no sends; null for none.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const update = Object.fromEntries(Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== undefined))
      const written = writeFollowup(dataDir(), update)
      if (!written.ok) return asJson({ ok: false, error: written.error })
      const response = followupResponse(dataDir(), await state().catch(() => null))
      return asJson({
        ok: true,
        settings: response.settings,
        next: response.next,
        platform_desktop: response.platform_desktop,
        note: 'Tell the person what will be sent, when and where, and that reminders go out only while DeepSeek Harness runs. The settings page (健康 → 随访提醒) has a test button.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'send_followup_message',
    description: 'Send one short follow-up message the person agreed to (for example from a DSH scheduled follow-up) through their follow-up channels. Only works when follow-up is on; refused otherwise, and at most 6 messages a day in all. Never include a dose. With detail minimal, include no health values (no blood pressure, lipid, weight or percent figures). Chinese, at most 300 characters.',
    parameters: {
      text: { type: 'string', required: true, description: 'The message, at most 300 characters.' },
      kind: { type: 'string', enum: ['checkin', 'weekly', 'custom'], description: 'What it is about; default custom.' },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const settings = readFollowup(dataDir())
      if (!settings.enabled) {
        return asJson({ ok: false, error: '随访提醒没有打开。只有本人要求后，才用 set_followup 打开。', sent: false })
      }
      const text = typeof args.text === 'string' ? args.text.trim() : ''
      const problem = followupTextProblem(text, settings.detail)
      if (problem) return asJson({ ok: false, error: problem, sent: false })
      const kind = args.kind === 'checkin' || args.kind === 'weekly' ? args.kind : 'custom'
      const result = await sendNow(dataDir(), text, kind)
      return asJson({ ...result, sent: Object.keys(result.channels).length > 0 })
    },
  }))
}
