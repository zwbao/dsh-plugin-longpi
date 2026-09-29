// A spoken yes to a plan that was already read to the person saves it (0.6.3). In 0.6.2 the three-part reply
// turned that yes into another read-back and a request to type 「保存」 again, and no plan was saved from chat.
// The model is told to save in the same turn (confirm=false, then confirm=true, one approval in DSH). When it
// still stops after the read-back, the guard sends one correction that asks for the confirm=true call.

import type { TurnTool } from './advice/complete.ts'

const SAVE_WORD = /保存|存下来|存起来|存下|存好|存上/
const NOT_YET = /(?:先别|不要|别|暂时不|暂不|不用|先不|还不|不想|没让你)[^，。,.！!？?]{0,4}(?:保存|存)/
const NEW_DRAFT = /起草|重新|再改|改一下|修改|换成|换一份|加上|去掉|删掉|读给我听/
const YES = /可以|好的|好吧|行|就按|就这样|就这么|确认|同意|没问题|嗯|对|保存吧|存吧|帮我保存|请保存/
const PLAN_WORD = /方案|计划|这份|那份|这个|那个|草稿|吧/

/** The person agrees to save a plan (可以，就按这份方案保存吧), and is not asking for a new draft or to hold off. */
export function isSaveConsent(text: string): boolean {
  const said = String(text ?? '').normalize('NFKC').trim()
  if (!said || !SAVE_WORD.test(said) || NOT_YET.test(said) || NEW_DRAFT.test(said)) return false
  if (/^(?:请)?(?:确认)?(?:保存|存)(?:吧|下来|起来)?[。.!！]?$/.test(said)) return true
  return YES.test(said) && (PLAN_WORD.test(said) || said.length <= 12)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/**
 * The confirm=false read-back this turn produced, when the person's message already agreed to save and no
 * confirm=true call followed. Null otherwise: no consent, no successful read-back, or a confirm=true call was
 * already made (saved, denied or refused), which is never retried from here.
 */
export function pendingConfirmedSave(userText: string, tools: readonly TurnTool[]): TurnTool | null {
  if (!isSaveConsent(userText)) return null
  const saves = tools.filter((tool) => tool.name === 'save_intervention_plan')
  if (saves.some((tool) => tool.args.confirm === true)) return null
  const readBack = [...saves].reverse().find((tool) => {
    const result = record(tool.result)
    return tool.args.confirm !== true && result.ok === true && result.saved === false
  })
  return readBack ?? null
}

export const SAVE_NOW_NOTE = [
  '[LongPi check: added by the plugin, not written by the person.]',
  'In their message this turn they already agreed to save the plan they heard. That is their confirmation.',
  'Call save_intervention_plan now with exactly the same arguments as the read-back above and confirm=true. DeepSeek Harness asks them to approve once.',
  'After it is saved, say in one short line that it is saved (第 N 版) and name the items. Do not read the plan back again and do not ask them to say 保存 again.',
].join('\n')
