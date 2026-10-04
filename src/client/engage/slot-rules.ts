// The prompt slot's client-side rules (docs/codex-design.md §2), pure for tests: ≥90 min of continuous DSH use, an agent
// turn running ≥60 s, no typing in the last 10 s; the reveal notice first; nothing in presentation mode.

export const SITTING_MIN = 90
export const TURN_MS = 60_000
export const TYPING_MS = 10_000
/** A stand-up line nobody answered folds away after this; it still counted as shown. */
export const STANDUP_VISIBLE_MS = 3 * 60_000

export function sittingZh(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (hours === 0) return `${rest} 分钟`
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`
}

export type Prompt = { kind: 'standup'; text: string; at: number } | { kind: 'reveal'; ref: string; text: string; at: number }

/** Decide, at most every few seconds, whether a prompt should appear now. Pure apart from the shared clocks. */
export function nextPrompt(input: { enabled: boolean; presentation: boolean; standup: boolean; reveal: null | { ref: string; text_zh: string }; sitting: number; turnMs: number; typing: boolean; now: number }): Prompt | null {
  if (!input.enabled || input.presentation || input.typing) return null
  if (input.reveal) return { kind: 'reveal', ref: input.reveal.ref, text: input.reveal.text_zh, at: input.now }
  if (input.standup && input.sitting >= SITTING_MIN && input.turnMs >= TURN_MS) {
    return { kind: 'standup', text: `已经坐了 ${sittingZh(input.sitting)}。起来走两分钟？`, at: input.now }
  }
  return null
}

