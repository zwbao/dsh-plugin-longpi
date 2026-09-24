// What the record can do right now, running every ready method in one go, and
// a report the person can hand to a doctor or coach. The report repeats only
// what tools and skills produced, with their boundaries.

import type { Catalog, SkillCard } from './catalog.ts'
import type { Config } from './config.ts'
import { runnableFrom, type MeasurementIn } from './measurements.ts'
import type { RecordSnapshot } from './records.ts'
import { runSkill } from './runner.ts'
import type { Tracking } from './tracking.ts'

export interface Readiness {
  ready: Array<{ name: string; blurb: string; domain: string }>
  near: Array<{ name: string; blurb: string; missing: string[] }>
  /** A missing measurement, and the methods it alone would complete. */
  unlock: Array<{ item: string; skills: string[] }>
  declared: number
}

function personal(card: SkillCard): boolean {
  return card.tier === 'A' && card.inputsStatus !== 'none' && Boolean(card.script) && card.inputs.length > 0
}

export function readiness(catalog: Catalog, records: RecordSnapshot, outputs: Record<string, unknown>): Readiness {
  const out: Readiness = { ready: [], near: [], unlock: [], declared: 0 }
  const unlock = new Map<string, Set<string>>()
  for (const card of catalog.cards) {
    if (!personal(card)) continue
    out.declared += 1
    const run = runnableFrom(card, records.indicators, { age: records.profile.age, sex: records.profile.sex }, outputs)
    if (run.status === 'ready') out.ready.push({ name: card.name, blurb: card.blurb, domain: card.domain })
    else if (run.status === 'partial') out.near.push({ name: card.name, blurb: card.blurb, missing: run.missing })
    if (run.missing.length === 1) {
      const item = run.missing[0] as string
      if (!unlock.has(item)) unlock.set(item, new Set())
      unlock.get(item)?.add(card.name)
    }
  }
  out.near.sort((a, b) => a.missing.length - b.missing.length || a.name.localeCompare(b.name))
  out.near = out.near.slice(0, 8)
  out.unlock = [...unlock.entries()].map(([item, skills]) => ({ item, skills: [...skills].sort() }))
    .sort((a, b) => b.skills.length - a.skills.length || a.item.localeCompare(b.item)).slice(0, 8)
  return out
}

export interface ReadyRun {
  skill: string
  ok: boolean
  excerpt: string
  outputs: Record<string, { value: number | string | null; unit: string; label_zh: string }>
  error?: string
}

/** Run every method the record already supplies (at most `limit`), with values exactly as recorded. */
export async function runReady(
  context: { config: Config; dataDir: string; skillsHome: string; catalog: Catalog; records: RecordSnapshot; outputs: Record<string, unknown> },
  limit = 8,
): Promise<ReadyRun[]> {
  const results: ReadyRun[] = []
  for (const card of context.catalog.cards) {
    if (results.length >= limit) break
    if (!personal(card) || !card.entry?.measurements_flag) continue
    const run = runnableFrom(card, context.records.indicators, { age: context.records.profile.age, sex: context.records.profile.sex }, context.outputs)
    if (run.status !== 'ready' || run.from_record.length === 0) continue
    const measurements: MeasurementIn[] = run.from_record
    const result = await runSkill({
      home: context.skillsHome, dataDir: context.dataDir, name: card.name, args: [], files: [], measurements,
      profile: { age: context.records.profile.age, sex: context.records.profile.sex }, useProfile: true,
      python: context.config.skillPython, runtimes: context.config.skillRuntimes, timeoutMs: context.config.skillTimeoutMs,
      revision: context.catalog.revision,
    })
    results.push({
      skill: card.name,
      ok: result.ok,
      excerpt: result.report_excerpt,
      outputs: result.outputs ?? {},
      ...(result.ok ? {} : { error: result.error || result.error_kind || '没有读出' }),
    })
  }
  return results
}

function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

/** A plain Markdown summary for a doctor or coach: data, not advice. */
export function buildReport(input: { name: string; today: string; records: RecordSnapshot; tracking: Tracking | null }): string {
  const lines: string[] = []
  const profile = input.records.profile
  lines.push(`# ${input.name || '个人'}长寿看板报告`, '')
  lines.push(`生成日期：${input.today}。数据来自本人的 Mirobody 记录、本人确认过的干预方案和打卡，以及 longevity-skills 技能脚本。本报告不是诊断，也不包含用药建议。`, '')
  lines.push('## 基本信息', '')
  lines.push(`- 实足年龄：${profile.age ?? '未填写'}；性别：${profile.sex === 'male' ? '男' : profile.sex === 'female' ? '女' : '未填写'}`)
  lines.push(`- 记录状态：${input.records.record_status === 'ok' ? `已接入 Mirobody（${input.records.indicators.length} 项指标）` : '未接入'}`, '')
  const tracking = input.tracking
  if (tracking) {
    const bio = tracking.bioage
    lines.push('## 表型年龄（PhenoAge，Levine 2018）', '')
    if (bio.points.length > 0) {
      lines.push('| 检查日期 | 表型年龄 | 减实足年龄 | 模型 10 年死亡风险 |', '|---|---|---|---|')
      for (const row of bio.points) lines.push(`| ${row.date} | ${fmt(row.phenoage)} 岁 | ${fmt(row.advance)} 岁 | ${fmt(row.mortality_10y_pct)}% |`)
      lines.push('')
      if (bio.band_years != null) {
        lines.push(`两次检查之间，表型年龄变化在 ±${fmt(bio.band_years)} 岁以内可能只是个体内正常波动${bio.band_missing.length > 0 ? `（未含${bio.band_missing.join('、')}，实际波动更大）` : ''}。`, '')
      }
    } else {
      lines.push(bio.note_zh, '')
    }
    if (tracking.plan) {
      lines.push(`## 干预方案（第 ${tracking.plan.version} 版，${tracking.plan.saved_at.slice(0, 10)} 保存）`, '')
      for (const item of tracking.items) {
        const adherence = item.adherence.rate != null ? `${Math.round(item.adherence.rate * 100)}%` : '未知'
        lines.push(`### ${item.title}（${item.category_zh}，${item.start} 起）`, '')
        lines.push(`执行：${adherence}（${item.adherence.note_zh}）`, '')
        for (const row of item.verdicts) {
          const change = row.baseline && row.followup
            ? `${row.baseline.date} ${row.baseline.value} → ${row.followup.date} ${row.followup.value} ${row.unit}`
            : '缺少可比较的结果'
          lines.push(`- ${row.marker}：**${row.verdict}**。${change}。${row.reason_zh}`)
          for (const note of row.confounders) lines.push(`  - 同期变化：${note}`)
        }
        lines.push('')
      }
    }
    const models = tracking.models.filter((card) => card.status !== 'unavailable')
    if (models.length > 0) {
      lines.push('## 模型估计', '')
      for (const card of models) {
        if (card.model === 'phenoage' && card.goal) {
          lines.push(`- 表型年龄：现在 ${fmt(card.now.phenoage as number)} 岁；达到方案目标时 ${fmt(card.goal.phenoage as number)} 岁（${card.measured_on} 的血检）。${card.boundary_zh}`)
          for (const lever of card.levers) lines.push(`  - ${lever.label} ${lever.from} → ${lever.to}：${fmt(lever.years)} 岁`)
        } else if (card.model === 'phenoage') {
          lines.push(`- 表型年龄：${card.note_zh}`)
        }
      }
      lines.push('')
    }
    if (tracking.suggestions.length > 0) {
      lines.push('## 下一步', '')
      for (const row of tracking.suggestions) lines.push(`- ${row.text_zh}`)
      lines.push('')
    }
  }
  lines.push('---', '', '判断依据：变化超过个体内生物变异与检测误差合成的参考变化值（RCV）才算真实变化；变异数据来自 EFLM 生物变异数据库和同行评审研究。试验效应是人群平均，不是个人预测。模型估计不是寿命预测。')
  return `${lines.join('\n')}\n`
}
