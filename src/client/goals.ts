// What the models say if the plan's goals are reached, and what to do next.
// Every figure here comes from a skill script and is labelled 模型估计.

import React from 'react'
import { fmt, LeverBars } from './charts.ts'
import { Icon } from './icons.ts'
import type { Tracking } from './types.ts'
import { Section } from './ui.ts'

const h = React.createElement

export function Goals(props: { tracking: Tracking | null }): React.ReactElement | null {
  const models = props.tracking?.models ?? []
  if (!props.tracking?.plan || models.length === 0) return null
  const pheno = models.find((card) => card.model === 'phenoage')
  const risk = models.find((card) => card.model === 'china-par')
  const leverRows = (pheno?.levers ?? []).map((row) => ({ label: row.label, detail: `${row.from} → ${row.to}`, value: row.years, unit: '岁' }))
  const sensitivityRows = (pheno?.sensitivity ?? []).map((row) => ({ label: row.label, detail: `一次真实变化约 ${row.step}`, value: -Math.abs(row.years_per_step), unit: '岁' }))
  return h(Section, { id: 'lp-goals', title: '如果达到目标', kicker: '模型估计' },
    h('div', { className: 'lp-grid-goals' },
      pheno ? h('div', { className: 'lp-card lp-model' },
        h('div', { className: 'lp-label' }, '表型年龄'),
        pheno.goal
          ? h('div', { className: 'lp-model-figures' },
            h('div', null, h('div', { className: 'lp-caption' }, '现在'), h('div', { className: 'lp-tile-figure' }, `${fmt(pheno.now?.phenoage)} 岁`)),
            h(Icon, { name: 'arrow', size: 18, className: 'lp-muted-ink' }),
            h('div', null, h('div', { className: 'lp-caption' }, '达到方案目标'), h('div', { className: 'lp-tile-figure lp-good-ink' }, `${fmt(pheno.goal.phenoage)} 岁`)),
            h('span', { className: 'lp-pill lp-pill-good' }, `${fmt(pheno.goal.phenoage_delta)} 岁`))
          : h('p', { className: 'lp-muted' }, pheno.note_zh ?? ''),
        leverRows.length > 0
          ? h('div', null, h('div', { className: 'lp-subhead' }, '每个目标单独的贡献'), h(LeverBars, { rows: leverRows }))
          : sensitivityRows.length > 0
            ? h('div', null, h('div', { className: 'lp-subhead' }, '对你的表型年龄影响最大的指标'), h(LeverBars, { rows: sensitivityRows }))
            : null,
        pheno.goal && pheno.now?.mortality_10y_pct != null && pheno.goal.mortality_10y_pct != null
          ? h('p', { className: 'lp-fine' }, `同一模型的 10 年死亡风险：${(pheno.now.mortality_10y_pct as number).toFixed(1)}% → ${(pheno.goal.mortality_10y_pct as number).toFixed(1)}%。`)
          : null,
        h('p', { className: 'lp-fine' }, `${pheno.measured_on ? `按 ${pheno.measured_on} 的血检计算。` : ''}${pheno.boundary_zh ?? ''}`)) : null,
      risk ? h('div', { className: 'lp-card lp-model' },
        h('div', { className: 'lp-label' }, '10 年心血管病风险 · China-PAR'),
        risk.status === 'unavailable'
          ? h('div', null,
            h('div', { className: 'lp-tile-figure lp-muted-ink' }, (risk.missing ?? []).length > 0 ? '还差几项' : '暂不显示'),
            h('p', { className: 'lp-muted' }, risk.note_zh ?? ''))
          : h('div', null,
            h('div', { className: 'lp-model-figures' },
              h('div', null, h('div', { className: 'lp-caption' }, '现在'),
                h('div', { className: 'lp-tile-figure' }, risk.now?.risk_pct == null ? '—' : `${risk.now.risk_pct.toFixed(1)}%`),
                risk.category_zh?.now ? h('span', { className: 'lp-pill' }, risk.category_zh.now) : null),
              risk.goal ? h(Icon, { name: 'arrow', size: 18, className: 'lp-muted-ink' }) : null,
              risk.goal ? h('div', null, h('div', { className: 'lp-caption' }, '达到方案目标'),
                h('div', { className: 'lp-tile-figure lp-good-ink' }, risk.goal.risk_pct == null ? '—' : `${risk.goal.risk_pct.toFixed(1)}%`),
                risk.category_zh?.goal ? h('span', { className: 'lp-pill lp-pill-good' }, risk.category_zh.goal) : null) : null),
            (risk.levers ?? []).length > 0
              ? h('div', null, h('div', { className: 'lp-subhead' }, '每个目标单独的贡献'),
                h(LeverBars, { rows: (risk.levers ?? []).map((row) => ({ label: row.label, detail: `${row.from} → ${row.to}`, value: row.years, unit: '个百分点' })) }))
              : h('p', { className: 'lp-muted' }, risk.note_zh ?? '')),
        h('p', { className: 'lp-fine' }, risk.boundary_zh ?? '')) : null,
      h('div', { className: 'lp-card lp-model lp-model-note' },
        h('div', { className: 'lp-label' }, '关于“能多活几年”'),
        h('p', { className: 'lp-muted' }, '没有经过验证的模型能对个人给出“多活几年”。这里只给有依据的模型估计：表型年龄、同一模型的 10 年死亡风险，以及中国人群的 10 年心血管病风险。'),
        h('p', { className: 'lp-fine' }, '试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月。能坚持的小改变，比追逐一个数字更重要。'))))
}

const STEP_ICON: Record<string, string> = { retest: 'calendar', missing_marker: 'flask', adherence: 'flame', record: 'check', one_change: 'info', review: 'info', worse: 'worse', acute: 'info', lever: 'spark' }

export function NextSteps(props: { tracking: Tracking | null }): React.ReactElement | null {
  const rows = props.tracking?.suggestions ?? []
  if (rows.length === 0) return null
  return h(Section, { id: 'lp-next', title: '下一步', kicker: '按优先级' },
    h('ol', { className: 'lp-card lp-steps' },
      ...rows.map((row, index) => h('li', { key: index, className: `lp-step lp-step-${row.kind}` },
        h('span', { className: 'lp-step-icon' }, h(Icon, { name: STEP_ICON[row.kind] ?? 'info', size: 15 })),
        h('span', null, row.text_zh)))),
    h('p', { className: 'lp-fine' }, '这里不会建议开始、停止或调整任何药物和补剂，也不给剂量。'))
}
