// A home blood pressure the person just asked to record. The health-data consent
// is offered in the same reply; the numbers are stored on this computer either way.

import type { GuidanceNote } from './guardrails.ts'
import { addSelf, readSelf } from './selfmeasure.ts'

export const INLINE_CONSENT_ZH = '单独同意：健康信息是敏感个人信息。处理它们需要你单独同意。你可以回复「我单独同意处理我的健康信息」，或在健康页点同一句。不同意也可以，这次血压仍然先记在这台电脑上。'
export const CONSENT_GRANT_ZH = '我单独同意处理我的健康信息'

export function statedHomePressure(text: string): { sbp: number; dbp: number } | null {
  const raw = String(text ?? '').normalize('NFKC')
  if (!/血压|收缩压|舒张压/.test(raw)) return null
  if (!/记录|记下|记一下|帮我记/.test(raw)) return null
  const pair = raw.match(/(\d{2,3})\s*[/／]\s*(\d{2,3})/)
  if (!pair) return null
  const sbp = Number(pair[1])
  const dbp = Number(pair[2])
  if (!Number.isFinite(sbp) || !Number.isFinite(dbp)) return null
  if (sbp < 70 || sbp > 260 || dbp < 40 || dbp > 150 || sbp <= dbp) return null
  return { sbp, dbp }
}

export function replyConfirmsHomeBp(reply: string, bp: { sbp: number; dbp: number }): boolean {
  const text = String(reply ?? '')
  if (/没能存|没有存下|无法保存|不能存|这次没|未能存|没有记下|没记下/.test(text)) return false
  return text.includes(String(bp.sbp)) && text.includes(String(bp.dbp))
}

/** Store the pair once for this day. A second call with the same numbers does not append. */
export function ensureHomeBp(dataDir: string, bp: { sbp: number; dbp: number }, today: string): boolean {
  const rows = readSelf(dataDir)
  const has = (key: 'sbp' | 'dbp', value: number) => rows.some((row) => row.key === key && row.date === today && row.value === value)
  const entries: Array<{ key: 'sbp' | 'dbp'; value: number; unit: string; date: string }> = []
  if (!has('sbp', bp.sbp)) entries.push({ key: 'sbp', value: bp.sbp, unit: 'mmHg', date: today })
  if (!has('dbp', bp.dbp)) entries.push({ key: 'dbp', value: bp.dbp, unit: 'mmHg', date: today })
  if (entries.length === 0) return false
  return addSelf(dataDir, entries, { today }).saved.length > 0
}

export function homeBpNote(bp: { sbp: number; dbp: number }): GuidanceNote {
  return {
    summary: 'LongPi：先出示同意，再记下血压',
    text: [
      '[LongPi safety note: added by the plugin, not written by the person. Follow it; never quote it as their words.]',
      'They asked to record a home blood pressure before granting the health-data consent. Save it in this turn. Do not refuse and do not say it could not be saved.',
      `Call save_self_measurement now with systolic ${bp.sbp} mmHg and diastolic ${bp.dbp} mmHg.`,
      'Then reply in Chinese, in this order:',
      `1. The consent offer, verbatim: 「${INLINE_CONSENT_ZH}」`,
      `2. 已记下收缩压 ${bp.sbp} mmHg、舒张压 ${bp.dbp} mmHg（保存在这台电脑）。`,
      '3. One line: one reading is not a diagnosis; home blood pressure is judged as the mean of about 7 days.',
    ].join('\n'),
  }
}

export function homeBpCorrection(bp: { sbp: number; dbp: number }): GuidanceNote {
  return {
    summary: 'LongPi 安全检查：血压要记下',
    text: [
      '[LongPi safety check: added by the plugin, not written by the person.]',
      'The home blood pressure they just stated is already saved on this computer. Send one short message now. Do not say the save failed.',
      `The message is these sentences and nothing else: 「${INLINE_CONSENT_ZH}」 「已记下收缩压 ${bp.sbp} mmHg、舒张压 ${bp.dbp} mmHg（保存在这台电脑）。单次读数不是诊断；家庭血压按大约 7 天的平均值来看。」`,
    ].join('\n'),
  }
}

/** Attach the consent offer to a successful self-measurement result instead of hiding the save. */
export function withConsentOffer(payload: unknown, offer: string = INLINE_CONSENT_ZH): Array<{ type: 'text'; text: string }> {
  let text = ''
  if (typeof payload === 'string') text = payload
  else if (Array.isArray(payload)) text = payload.map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')).join('\n')
  else text = JSON.stringify(payload ?? {})
  let parsed: Record<string, unknown> | null = null
  try {
    const row = JSON.parse(text) as unknown
    parsed = row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : null
  } catch {
    parsed = null
  }
  if (parsed) {
    parsed.consent_pending = true
    parsed.consent_offer_zh = offer
    parsed.note = `${offer} 读回 saved 里的每一项，并说明已经记下。不要说没存下来。`
    return [{ type: 'text', text: JSON.stringify(parsed) }]
  }
  return [{ type: 'text', text: `${text}\n${offer}` }]
}
