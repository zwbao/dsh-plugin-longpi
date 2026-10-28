// Approval for saving a plan from chat (claim 8d) and for starting a deep analysis.
// save_intervention_plan with confirm=true now waits for the person to approve in DSH, and only after the
// same plan was read back (confirm=false) in this process within the last 30 minutes. Opaque save tokens
// bind that read-back to its member, store and session; the tool body rechecks after asynchronous reads.

import { createHash, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { CATEGORY_ZH, isoDay, normalizePlan, type Category } from './interventions.ts'
import { COST_ZH } from './analysis/service.ts'
import { currentImport, listRuns } from './analysis/store.ts'
import { ownerOfStore, storeIdentity, storeIsCurrent, sameStore, type StoreIdentity, type StoreOwner } from './member-store.ts'
import { SELF } from './people/store.ts'
import { sessionKey } from './plan-hold.ts'

export const READ_BACK_MS = 30 * 60_000
export const NO_READ_BACK = '请先复述方案给用户确认'
const SAVE_TOOL = 'save_intervention_plan'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** The plan as it would be stored, without the generated item ids and medication links. */
function normalized(args: unknown) {
  const { confirm: _confirm, ...plan } = record(args)
  return normalizePlan(plan, { today: isoDay(), medications: [], previous: null }).plan
}

/** Same normalized plan, same key: title, source, note, each item's fields in order, and the goals. */
export function planKey(args: unknown): string {
  const plan = normalized(args)
  const canonical = {
    title: plan.title,
    source: plan.source,
    note: plan.note,
    items: plan.items.map(({ id: _id, mirobody: _mirobody, ...item }) => item),
    goals: plan.goals,
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/** What the person approves in DSH: the plan's title, then each item with its category and start date. */
export function planApprovalReason(args: unknown): string {
  const plan = normalized(args)
  const shown = plan.items.slice(0, 12).map((item, index) => `${index + 1}. ${CATEGORY_ZH[item.category as Category] ?? '其他'}·${item.title || '（未命名）'}（${item.start || '未写开始日期'} 开始）`)
  const more = plan.items.length > shown.length ? `；另有 ${plan.items.length - shown.length} 项` : ''
  const goals = plan.goals.length > 0 ? `；另有 ${plan.goals.length} 个目标值` : ''
  return `LongPi 要保存干预方案「${plan.title}」：${shown.join('；')}${more}${goals}。只有你本人确认过这份方案才同意。`
}

interface SaveContext {
  root: string; dataDir: string; owner: StoreOwner
  /** Null only for the holder's own store before it exists: the first plan may create it. */
  identity: StoreIdentity | null
  session: string; key: string; at: number; ready: boolean; runId?: string
}
const readBacks = new Map<string, SaveContext>()

/** Opaque provenance travels with the plan; never infer its owner from the page at confirmation time. */
export function issuePlanSaveToken(root: string, dataDir: string, args: unknown, session: string, runId?: string): string | null {
  const owner = ownerOfStore(root, dataDir)
  const identity = storeIdentity(dataDir)
  // The holder's own store may not exist yet (first plan on a new install); a family member's must already exist.
  if (!owner || (!identity && owner.id !== SELF)) return null
  const now = Date.now()
  for (const [token, row] of readBacks) if (now - row.at > READ_BACK_MS) readBacks.delete(token)
  const token = randomUUID()
  readBacks.set(token, { root, dataDir, owner, identity, session, key: planKey(args), at: now, ready: false, runId })
  if (readBacks.size > 200) readBacks.delete(readBacks.keys().next().value as string)
  return token
}

export function planSaveProblem(args: unknown, root: string, session: string, requireReadBack: boolean): string | null {
  const token = record(args).save_token
  const row = typeof token === 'string' ? readBacks.get(token) : undefined
  if (!row || Date.now() - row.at > READ_BACK_MS) return '方案保存凭据缺失或已过期，请重新导入分析或回读方案。'
  if (row.root !== root || row.session !== session || row.key !== planKey(args)) return '方案内容或会话已变化，请重新回读方案。'
  const ownerNow = ownerOfStore(root, row.dataDir)
  const identityNow = storeIdentity(row.dataDir)
  const storeOk = row.identity
    ? sameStore(row.identity, identityNow)
    // It did not exist when read back: still absent, or created live since; a delete tombstone refuses.
    : identityNow === null || identityNow.deleted === ''
  if (!ownerNow || ownerNow.id !== row.owner.id || !storeOk) return '方案所属档案已删除或变化，未保存。'
  if (!storeIsCurrent(root, row.dataDir)) return `该方案属于${row.owner.label_zh}，请先切换到该成员，再回读并确认保存。`
  if (row.runId && (currentImport(row.dataDir)?.meta.run_id !== row.runId || !listRuns(row.dataDir).some(run => run.id === row.runId))) return '来源分析已变化或放弃，请重新导入后确认方案。'
  return requireReadBack && !row.ready ? NO_READ_BACK : null
}

export function markPlanReadBack(token: string): void {
  const row = readBacks.get(token)
  if (row) readBacks.set(token, { ...row, ready: true })
}

export function consumePlanSaveToken(token: string): void { readBacks.delete(token) }

/** A successful save closes the whole read-back window for that plan, not only the token that confirmed it. */
export function consumePlanSaveTokensFor(token: string): void {
  const row = readBacks.get(token)
  if (!row) return
  for (const [other, candidate] of readBacks) {
    if (candidate.root === row.root && candidate.session === row.session && candidate.key === row.key) readBacks.delete(other)
  }
}

/** Tests: forget every read-back. */
export function resetReadBacks(): void {
  readBacks.clear()
}

export function registerApprovals(ctx: Context, opts: { analysisBlocked?: () => boolean; rootDir?: () => string } = {}): void {
  // After every other listener allowed it: a confirmed save needs a fresh read-back and then the person's yes.
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (decision.kind !== 'allow') return decision
    // A deep analysis the person asks for costs about half a million tokens: DSH asks them, so "member" is their yes,
    // never only the model's word. An automatic start ("ai") is allowed only with the page switch on (checked in M12).
    // A start LongPi would refuse anyway (the demo profile, no analyst, no age) is not put to them: the tool says why.
    if (exec.name === 'run_deep_analysis' && record(exec.arguments).trigger !== 'ai') {
      if (opts.analysisBlocked?.()) return decision
      return { kind: 'ask', reason: `开始一次深度分析？${COST_ZH}。` }
    }
    if (exec.name !== SAVE_TOOL || record(exec.arguments).confirm !== true) return decision
    const problem = planSaveProblem(exec.arguments, opts.rootDir?.() ?? '', sessionKey(exec.agent), true)
    if (problem) return { kind: 'deny', reason: problem }
    const owner = readBacks.get(String(record(exec.arguments).save_token))!.owner
    return { kind: 'ask', reason: `保存到${owner.label_zh}的档案。${planApprovalReason(exec.arguments)}` }
  })

  // Also consume on a successful host result; direct tool execution consumes immediately after writing.
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (exec.name !== SAVE_TOOL || result.isError) return decision
    const value = record(result.value)
    const args = record(exec.arguments)
    if (args.confirm === true && value.saved === true && typeof args.save_token === 'string') consumePlanSaveTokensFor(args.save_token)
    return decision
  })
}
