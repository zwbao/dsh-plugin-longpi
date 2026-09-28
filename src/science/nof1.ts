// Personal N-of-1: design an ABAB or crossover on this person's own wearable series, and explain it here.
// Nothing in this file is sent to an aggregator.

import type { Point } from './stats.ts'
import { mean, pairedT, round } from './stats.ts'

export type DesignKind = 'abab' | 'crossover'

export interface WearableDay { day: string; steps: number | null; resting_hr: number | null }

export interface NOf1Result {
  design: DesignKind
  title_zh: string
  protocol_zh: string
  schedule: Array<{ arm: string; label_zh: string; from: string; to: string }>
  result_zh: string
  numbers: Array<{ key: string; text: string }>
  claim: 'none' | 'describe'
}

const BANNED = /证明|治愈|患有|确诊|年轻了|变年轻/

export function wordingProblem(text: string): string | null {
  const hit = BANNED.exec(text)
  return hit ? `不能写「${hit[0]}」` : null
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function schedule(kind: DesignKind, start: string): NOf1Result['schedule'] {
  if (kind === 'crossover') {
    return [
      { arm: 'morning', label_zh: '早晨走 20 分钟', from: start, to: addDays(start, 13) },
      { arm: 'after_dinner', label_zh: '晚饭后走 20 分钟', from: addDays(start, 14), to: addDays(start, 27) },
      { arm: 'after_dinner', label_zh: '晚饭后走 20 分钟', from: addDays(start, 28), to: addDays(start, 41) },
      { arm: 'morning', label_zh: '早晨走 20 分钟', from: addDays(start, 42), to: addDays(start, 55) },
    ]
  }
  const blocks: NOf1Result['schedule'] = []
  const order = ['morning', 'after_dinner', 'morning', 'after_dinner']
  order.forEach((arm, index) => {
    const from = addDays(start, index * 7)
    blocks.push({ arm, label_zh: arm === 'morning' ? '早晨走 20 分钟' : '晚饭后走 20 分钟', from, to: addDays(from, 6) })
  })
  return blocks
}

interface Contrast { n: number; mean_a: number; mean_b: number; diff: number; t: number | null }

function contrast(a: number[], b: number[]): Contrast | null {
  if (a.length < 2 || b.length < 2) return null
  const meanA = mean(a)
  const meanB = mean(b)
  if (meanA == null || meanB == null) return null
  const paired = pairedT(a, b)
  return { n: Math.min(a.length, b.length), mean_a: meanA, mean_b: meanB, diff: meanB - meanA, t: paired && Number.isFinite(paired[0]) ? paired[0] : null }
}

function explainContrast(labelA: string, labelB: string, row: Contrast, unit: string): string {
  const t = row.t == null ? '' : `配对 t 大约 ${round(row.t)}。`
  const enough = row.n >= 4
  const head = `${labelA}平均 ${round(row.mean_a)} ${unit}，${labelB}平均 ${round(row.mean_b)} ${unit}，相差 ${round(row.diff)} ${unit}（${labelB}减${labelA}）。${t}`
  return enough
    ? `${head}这是你自己这 ${row.n} 对记录里的差别，只留在这台电脑上，不能当成治疗结论。`
    : `${head}现在只有 ${row.n} 对，次数还少，先不要下结论，按协议继续记。`
}

/** Descriptive split of the watch series: high-step days versus low-step days. Not a randomised trial. */
export function wearableContrast(days: readonly WearableDay[]): { low: number[]; high: number[] } | null {
  const usable = days.filter((row) => row.steps != null && row.resting_hr != null)
  if (usable.length < 8) return null
  const ordered = [...usable].sort((a, b) => (a.steps ?? 0) - (b.steps ?? 0))
  const half = Math.floor(ordered.length / 2)
  const low = ordered.slice(0, half).map((row) => row.resting_hr ?? 0)
  const high = ordered.slice(ordered.length - half).map((row) => row.resting_hr ?? 0)
  return { low, high }
}

export function designNOf1(opts: {
  today: string
  design?: DesignKind
  question_zh?: string
  wearable?: readonly WearableDay[]
  /** Arm-labelled glucose the person already logged. */
  glucose?: { morning: number[]; after_dinner: number[] }
}): NOf1Result {
  const design: DesignKind = opts.design ?? (opts.question_zh && /交叉|对调/.test(opts.question_zh) ? 'crossover' : 'abab')
  const blocks = schedule(design, opts.today)
  const protocol = design === 'abab'
    ? 'ABAB：早晨走一周，晚饭后走一周，再各重复一次。每次 20 分钟。第二天早上记空腹血糖；手表继续记静息心率。两条手臂都记满再比较。'
    : '交叉：先连续两周早晨走，再连续两周晚饭后走，然后对调重复。每次 20 分钟。比的是你自己记下的血糖，不是别人的。'
  const numbers: NOf1Result['numbers'] = []
  let result = '手表的每日步数没有区分早晨和晚饭后，所以现有记录还不能比较这两种走法。从今天起按上面的安排走，并把血糖记下来，记在这台电脑上。'
  const glucose = opts.glucose
  if (glucose && glucose.morning.length >= 2 && glucose.after_dinner.length >= 2) {
    const row = contrast(glucose.morning, glucose.after_dinner)
    if (row) {
      result = explainContrast('早晨走', '晚饭后走', row, 'mmol/L')
      numbers.push(
        { key: 'morning.mean', text: round(row.mean_a) },
        { key: 'after_dinner.mean', text: round(row.mean_b) },
        { key: 'diff', text: round(row.diff) },
      )
    }
  } else {
    const split = wearableContrast(opts.wearable ?? [])
    if (split) {
      const row = contrast(split.low, split.high)
      if (row) {
        result = `现有手表记录不能区分早晨和晚饭后。作为本机的描述（不是随机对照）：步数较低的日子静息心率平均 ${round(row.mean_a)} 次/分，步数较高的日子平均 ${round(row.mean_b)} 次/分，相差 ${round(row.diff)}。${row.n < 4 ? '天数还少。' : ''}这不能说明走路方式改变了血糖。`
        numbers.push({ key: 'hr.low_steps', text: round(row.mean_a) }, { key: 'hr.high_steps', text: round(row.mean_b) })
      }
    }
  }
  const built: NOf1Result = {
    design,
    title_zh: design === 'abab' ? '个人 ABAB：早晨走和晚饭后走' : '个人交叉：早晨走和晚饭后走',
    protocol_zh: protocol,
    schedule: blocks,
    result_zh: result,
    numbers,
    claim: 'describe',
  }
  const problem = wordingProblem(`${built.protocol_zh} ${built.result_zh}`)
  if (problem) built.result_zh = '这次对照只留在本机，次数或记录还不够比较。'
  return built
}
