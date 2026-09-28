// A hypoglycaemia message must be answered before any plan draft. The guard sets
// this for a few minutes; draft_intervention_plan returns the first-aid line
// instead of building a plan, so the turn cannot sit on "正在起草方案".

let until = 0

export function holdPlanDraft(ms = 10 * 60_000, now = Date.now()): void {
  until = now + ms
}

export function releasePlanDraft(): void {
  until = 0
}

export function planDraftHeld(now = Date.now()): boolean {
  return now < until
}
