// Deterministic weekly narrative. Counts and dates only; no age claim.

import type { IsoDay } from '../contracts/common.ts'

export function weeklyText(input: {
  title: string
  week: number
  weeks: number
  status: string
  streak: number
  frozen: number
  done: number
  total: number
  open: string[]
  reminder: string | null
  retestDay: IsoDay | null
}): string {
  const lines = [
    `第 ${input.week} 周，共 ${input.weeks} 周 · ${input.title}`,
    `连续记录 ${input.streak} 天。生病或出行冻结 ${input.frozen} 天，这些天不算中断。`,
    input.open.length > 0
      ? `任务完成 ${input.done} / ${input.total}。还开着：${input.open.join('、')}。`
      : `任务完成 ${input.done} / ${input.total}。这一季的任务都做完了。`,
  ]
  if (input.reminder) lines.push(input.reminder)
  if (input.status === 'retest_window') {
    lines.push(input.retestDay ? `复测窗口开了，到 ${input.retestDay} 前做一次同样的检查，这一季就收束。` : '复测窗口开了，这一季就收束。')
  }
  lines.push('这里只讲你做了什么，不把一次检查说成身体年龄下降。')
  return lines.join('\n')
}
