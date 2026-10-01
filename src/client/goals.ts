// What the models say if the plan's goals are reached, and what to do next.
// Every figure here comes from a skill script and is labelled 模型估计. Each model goes by its plain name; its
// own name and method are behind ⓘ.

import React from 'react'
import { plainUnits } from './format.ts'
import { projectionSentence } from '../feedback/grade.ts'
import { fmt, LeverBars } from './charts.ts'
import { chineseDate } from './format.ts'
import { Icon } from './icons.ts'
import { BIOAGE_INFO, BIOAGE_LABEL, RISK_INFO, RISK_LABEL } from './terms.ts'
import type { Tracking } from './types.ts'
import { Info, Section } from './ui.ts'

const h = React.createElement

/** Negative numbers with the minus sign (−), not a hyphen. */
export function minus(text: string): string {
  return text.replace(/(^|[\s(（:：→])-(?=\d)/g, '$1−')
}

export function Goals(props: { tracking: Tracking | null }): React.ReactElement | null {
  const models = props.tracking?.models ?? []
  if (!props.tracking?.plan || models.length === 0) return null
  const pheno = models.find((card) => card.model === 'phenoage')
  const risk = models.find((card) => card.model === 'china-par')
  const leverRows = (pheno?.levers ?? []).map((row) => ({ label: row.label, detail: plainUnits(`${row.from} → ${row.to}`), value: row.years, unit: '岁' }))
  const sensitivityRows = (pheno?.sensitivity ?? []).map((row) => ({ label: row.label, detail: plainUnits(`一次真实变化约 ${row.step}`), value: -Math.abs(row.years_per_step), unit: '岁' }))
  const estimate = h('div', { className: 'lp-tags' }, h('span', { className: 'lp-tag' }, '模型估计'))
  return h(Section, { id: 'lp-goals', title: '如果达到目标' },
    h('div', { className: 'lp-grid-2 lp-grid-top' },
      pheno ? h('div', { className: 'lp-card' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, BIOAGE_LABEL, h(Info, { label: BIOAGE_LABEL }, BIOAGE_INFO))),
        estimate,
        pheno.goal
          ? h('div', { className: 'lp-plan-model-figures' },
            h('div', { className: 'lp-plan-model-figure' }, h('div', { className: 'lp-caption' }, '现在'), h('div', { className: 'lp-num-md' }, `${fmt(pheno.now?.phenoage)} 岁`)),
            h(Icon, { name: 'arrow', size: 16 }),
            h('div', { className: 'lp-plan-model-figure' }, h('div', { className: 'lp-caption' }, '达到方案目标'), h('div', { className: 'lp-num-md lp-good-ink' }, `${fmt(pheno.goal.phenoage)} 岁`)),
            h('span', { className: 'lp-badge lp-badge-good' }, `${fmt(pheno.goal.phenoage_delta)} 岁`))
          : h('p', { className: 'lp-muted lp-measure' }, pheno.note_zh ?? ''),
        leverRows.length > 0
          ? h('div', null, h('div', { className: 'lp-subhead' }, '每个目标单独的贡献'), h(LeverBars, { rows: leverRows }))
          : sensitivityRows.length > 0
            ? h('div', null, h('div', { className: 'lp-subhead' }, '对你的身体年龄影响最大的指标'), h(LeverBars, { rows: sensitivityRows }))
            : null,
        ...(pheno.levers ?? []).slice(0, 3).map((row) => h('p', { key: row.label, className: 'lp-caption lp-measure' }, minus(projectionSentence(row.label, row.to, row.years, row.from)))),
        pheno.goal && pheno.goal.phenoage_delta != null
          ? h('p', { className: 'lp-caption lp-measure' }, minus(projectionSentence('达到方案目标时的身体年龄', `${fmt(pheno.goal.phenoage)} 岁`, pheno.goal.phenoage_delta as number, pheno.now?.phenoage != null ? `${fmt(pheno.now.phenoage)} 岁` : undefined)))
          : null,
        h('p', { className: 'lp-caption lp-measure' }, `${pheno.measured_on ? `按 ${chineseDate(pheno.measured_on) || pheno.measured_on}的血检计算。` : ''}${pheno.boundary_zh ?? ''}`)) : null,
      risk ? h('div', { className: 'lp-card' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, RISK_LABEL, h(Info, { label: RISK_LABEL, align: 'end' }, RISK_INFO))),
        estimate,
        risk.status === 'unavailable'
          // Missing inputs: the count and the first three as tags, not a paragraph that lists them all.
          ? (risk.missing ?? []).length > 0
            ? h('div', { className: 'lp-plan-model-figure' },
              h('div', { className: 'lp-h2 lp-muted' }, `还差 ${(risk.missing ?? []).length} 项`),
              h('div', { className: 'lp-tags' },
                ...(risk.missing ?? []).slice(0, 3).map((name) => h('span', { key: name, className: 'lp-tag' }, name)),
                (risk.missing ?? []).length > 3 ? h('span', { className: 'lp-caption' }, `等 ${(risk.missing ?? []).length} 项`) : null))
            : h('div', { className: 'lp-plan-model-figure' },
              h('div', { className: 'lp-h2 lp-muted' }, '暂不显示'),
              risk.note_zh ? h('p', { className: 'lp-small lp-muted lp-measure' }, risk.note_zh) : null)
          : h('div', { className: 'lp-stack' },
            h('div', { className: 'lp-plan-model-figures' },
              h('div', { className: 'lp-plan-model-figure' }, h('div', { className: 'lp-caption' }, '现在'),
                h('div', { className: 'lp-num-md' }, risk.now?.risk_pct == null ? '—' : `${risk.now.risk_pct.toFixed(1)}%`),
                risk.category_zh?.now ? h('span', { className: 'lp-badge lp-badge-neutral' }, risk.category_zh.now) : null),
              risk.goal ? h(Icon, { name: 'arrow', size: 16 }) : null,
              risk.goal ? h('div', { className: 'lp-plan-model-figure' }, h('div', { className: 'lp-caption' }, '达到方案目标'),
                h('div', { className: 'lp-num-md lp-good-ink' }, risk.goal.risk_pct == null ? '—' : `${risk.goal.risk_pct.toFixed(1)}%`),
                risk.category_zh?.goal ? h('span', { className: 'lp-badge lp-badge-good' }, risk.category_zh.goal) : null) : null),
            (risk.levers ?? []).length > 0
              ? h('div', null, h('div', { className: 'lp-subhead' }, '每个目标单独的贡献'),
                h(LeverBars, { rows: (risk.levers ?? []).map((row) => ({ label: row.label, detail: `${row.from} → ${row.to}`, value: row.years, unit: '个百分点' })) }))
              : h('p', { className: 'lp-small lp-muted lp-measure' }, risk.note_zh ?? '')),
        risk.boundary_zh ? h('p', { className: 'lp-caption lp-measure' }, risk.boundary_zh) : null) : null),
    // The note on 「能多活几年」 is a section caption, not a third card beside the models.
    h('p', { className: 'lp-caption lp-measure' }, '关于「能多活几年」：没有经过验证的模型能对个人给出这个数。这里只给有依据的模型估计。试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月；能坚持的小改变，比追逐一个数字更重要。'))
}

const STEP_ICON: Record<string, string> = { retest: 'calendar', missing_marker: 'flask', adherence: 'flame', record: 'check', one_change: 'info', review: 'info', worse: 'worse', acute: 'info', lever: 'spark' }

export function NextSteps(props: { tracking: Tracking | null }): React.ReactElement | null {
  const rows = props.tracking?.suggestions ?? []
  if (rows.length === 0) return null
  return h(Section, { id: 'lp-next', title: '下一步', aside: h('span', { className: 'lp-caption' }, '按优先级') },
    h('div', { className: 'lp-card' },
      h('ol', { className: 'lp-rows' },
        ...rows.map((row, index) => h('li', { key: index, className: 'lp-row lp-plan-step' },
          h(Icon, { name: STEP_ICON[row.kind] ?? 'info', size: 14, className: 'lp-row-icon' }),
          h('span', { className: 'lp-row-main' }, row.text_zh))))))
}
