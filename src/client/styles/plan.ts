// 方案 / 档案 / 赛季 / 研究 and the pieces they share with other screens (plan.ts, plan-draft.ts, profile-*.ts,
// self-measure.ts, goals.ts, methods.ts, datain/*, engage/*, science/*, feedback/*).
// Page-specific layout only; cards, rows, tags, forms, callouts and progress bars come from styles/base.ts.
// See docs/design-system.md.

export const PLAN = `
/* --- shared with other screens (icons.ts VerdictChip, charts.ts Ring, triage care card) --- */
.lp-ring { flex: none; }
.lp-ring-track { fill: none; stroke: var(--lp-line); }
.lp-ring-fill { fill: none; stroke: var(--lp-accent); stroke-linecap: round; transition: stroke-dasharray .8s ease; }

/* --- today's check-ins (also inside the overview's today card) --------------------------------- */
.lp-today-list { list-style: none; margin: 0; padding: 0; display: grid; }
.lp-today-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 8px 0; border-top: 1px solid var(--lp-line); }
.lp-today-row:first-child { border-top: 0; }
.lp-today-title { min-width: 0; font-size: 14px; line-height: 22px; font-weight: 400; }
.lp-today-done .lp-today-title, .lp-today-missed .lp-today-title { color: var(--lp-ink-2); }

/* --- 方案 -------------------------------------------------------------------------------------- */
.lp-plan-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-plan-tile-today { grid-column: 1 / -1; }
@container lp-root (max-width: 720px) { .lp-plan-tiles { grid-template-columns: minmax(0, 1fr); } }
/* cards are top-aligned and keep their own height; the grow wrapper only spaces the body */
.lp-plan-grow { display: grid; gap: 12px; align-content: start; min-width: 0; }
.lp-plan-figure-row { display: flex; align-items: center; gap: 16px; }
.lp-plan-streak { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; line-height: 20px; font-weight: 500; }
.lp-plan-streak .lp-icon { color: var(--lp-warn-ink); }
.lp-plan-win { display: flex; align-items: flex-start; gap: 12px; }
.lp-plan-win-icon { width: 28px; height: 28px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-plan-win-text { display: grid; gap: 2px; min-width: 0; }
.lp-plan-row { align-items: flex-start; padding: 12px 0; }
.lp-plan-row-main { display: grid; gap: 6px; }
.lp-plan-row-title { font-size: 14px; line-height: 22px; font-weight: 500; color: var(--lp-ink); }
.lp-today-done .lp-plan-row-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-plan-row-end { flex: none; display: flex; align-items: center; min-height: 22px; }
@container lp-root (max-width: 560px) { .lp-plan-row { flex-direction: column; } }
.lp-plan-verdict { display: grid; gap: 4px; }
.lp-plan-verdict-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; }
.lp-plan-verdict details > summary { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-plan-verdict details[open] > summary { margin-bottom: 4px; }
.lp-plan-chart { margin: 0; }
/* one reading measure for body text in these cards (spec: 40em at 14px) */
.lp-measure { max-width: 560px; }
.lp-plan-aside { display: inline-flex; align-items: center; gap: 4px; }
.lp-plan-model-figures { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.lp-plan-model-figures > .lp-icon { margin-bottom: 8px; color: var(--lp-ink-3); }
.lp-plan-model-figure { display: grid; gap: 4px; justify-items: start; }
.lp-plan-step .lp-row-main { color: var(--lp-ink); }

/* --- 方案草稿 and the adoption dialog (page and chat card) ------------------------------------------- */
.lp-draft-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-draft-item { display: grid; gap: 8px; min-width: 0; padding: 12px 16px; border: 1px solid var(--lp-line); border-radius: var(--lp-radius-ctl); }
.lp-draft-item-compact { padding: 12px; gap: 4px; }
.lp-draft-item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.lp-draft-item-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; font-size: 14px; line-height: 22px; font-weight: 500; }
.lp-draft-item-head > .lp-textbtn { flex: none; height: 22px; }
.lp-draft-detail { font-size: 14px; line-height: 22px; }
.lp-draft-evidence { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-draft-evidence .lp-icon { margin-top: 4px; color: var(--lp-ink-3); }
.lp-draft-item a, .lp-draft a { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.lp-draft-item details > summary { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-draft-item details[open] > summary { margin-bottom: 4px; }
.lp-draft-item details .lp-caption + .lp-caption { margin-top: 4px; }
.lp-draft-block { display: grid; gap: 12px; min-width: 0; }
.lp-draft-removed { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.lp-draft-removed .lp-toggle { height: 28px; font-size: 12px; color: var(--lp-ink-2); }
.lp-draft-priorities { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.lp-draft-priority { display: grid; gap: 4px; padding: 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); min-width: 0; }
.lp-draft-priority-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 13px; line-height: 20px; }
.lp-row-lines { display: grid; gap: 2px; }
.lp-draft-hint { display: inline-flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
.lp-draft-hint .lp-textbtn { font-size: 12px; line-height: 18px; }
.lp-draft-actions { gap: 16px; }
.lp-confirm-dialog.lp-confirm-dialog, div:has(> .lp-confirm.lp-confirm) { width: min(520px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-confirm { padding: 24px; display: grid; gap: 12px; max-height: calc(100vh - 48px); overflow-y: auto; }
.lp-confirm .lp-modal-actions { margin-top: 12px; }
.lp-confirm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.lp-confirm-list li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 40px; padding: 8px 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); font-size: 13px; line-height: 20px; }
.lp-confirm-list .lp-badge { margin-left: auto; }

/* --- 档案: profile editor, self measurements ------------------------------------------------------ */
.lp-profile { container: lp-form / inline-size; display: grid; gap: 20px; }
.lp-profile > .lp-form-actions { margin-top: 0; }
.lp-profile > .lp-modal-actions { margin-top: 4px; }
.lp-profile-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.lp-profile-side > .lp-card:last-child { flex: 1 1 auto; }
.lp-profile-group { display: grid; gap: 8px; }
.lp-profile-basics { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 24px; }
.lp-profile-age { width: 160px; }
/* the sex segment matches the 36px age input next to it */
.lp .lp-profile-basics .lp-seg-opt span { height: 32px; }
.lp-unlock { display: flex; align-items: center; gap: 4px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-facts { border: 0; margin: 0; padding: 0; min-width: 0; }
.lp-facts-legend { display: grid; gap: 2px; padding: 0; margin-bottom: 4px; }
.lp-fact { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 0; border-top: 1px solid var(--lp-line); }
.lp-facts-legend + .lp-fact { border-top: 0; }
.lp-fact-text { display: grid; gap: 2px; min-width: 0; }
.lp-fact-label { font-size: 14px; line-height: 22px; }
@container lp-form (max-width: 420px) { .lp-fact { flex-direction: column; align-items: flex-start; gap: 8px; } }
.lp-profile-focus { display: grid; gap: 8px; }
.lp-self-latest { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.lp-self-latest li { display: grid; gap: 2px; min-width: 120px; padding: 8px 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-self-value { font-size: 17px; line-height: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-self-form { container: lp-form / inline-size; display: grid; gap: 16px; }
.lp-self-form > .lp-form-actions { margin-top: 0; }
.lp-self-unit { width: auto; flex: none; }
.lp-bp { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-bp .lp-input { width: 104px; }
.lp-bp-slash { color: var(--lp-ink-3); }
.lp-inline-self { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-inline-self .lp-input { width: 96px; height: 32px; font-size: 13px; }
.lp-inline-self .lp-select { height: 32px; font-size: 13px; width: auto; }
.lp-search { display: flex; gap: 8px; align-items: center; }
.lp-search > button { flex: none; white-space: nowrap; }

/* --- 赛季 ------------------------------------------------------------------------------------------- */
.lp-season-card { display: grid; gap: 4px; }
.lp-season-quests { display: grid; gap: 8px; }
.lp-season-quests .lp-row-btn:disabled { cursor: progress; opacity: .6; }

/* --- 这次的变化 (feedback card): one size, colour and measure; the first line is only a little heavier */
.lp-fb-lead { font-weight: 500; }

/* --- 研究 ------------------------------------------------------------------------------------------- */
.lp-sci-q { border: 0; margin: 0; padding: 0; min-width: 0; }
.lp-sci-q legend { padding: 0; margin-bottom: 8px; }
/* question groups read as separate blocks: 24px between groups and above the first one */
.lp .lp-card > .lp-sci-q { margin-top: 24px; }
.lp .lp-card > .lp-sci-q + .lp-actions { margin-top: 24px; }
.lp-sci-options { display: grid; gap: 8px; }
.lp-sci-options .lp-check { align-items: center; }
.lp-sci-options .lp-check input { margin-top: 0; }
.lp-sci-count { margin-left: auto; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); font-variant-numeric: tabular-nums; }
`
