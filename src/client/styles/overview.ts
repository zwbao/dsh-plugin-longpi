// overview tab: results, record changes, first-result cells, check-ins
// (overview.ts, results.ts, changes.ts, checkin.ts, journey-steps.ts).
// Page-specific layout only; base components (styles/base.ts) are never redefined here. See docs/design-system.md.

export const OVERVIEW = `
/* --- results: a .lp-grid-2 of cards; title row = title + ⓘ, tags on the next line ---------------- */
.lp-results { align-items: stretch; }
.lp-results-plan:empty { display: none; }
/* 这次的变化 (feedback/feedback-card.ts): the first row starts under the title, every line at the same measure. */
.lp-results-plan .lp-rows > .lp-row:first-child { padding-top: 0; }
.lp-results-plan .lp-row-stack > p { max-width: 40em; }
/* Rows with a leading icon: add-ons, and what can be done now in onboarding. */
.lp-row-wrap { flex-wrap: wrap; justify-content: flex-start; }
.lp-row-icon { color: var(--lp-ink-3); }
.lp-now-main .lp-inline-self { margin-top: 8px; }
.lp-result { display: flex; flex-direction: column; }
.lp-result-figure { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.lp-result-figure .lp-badge { align-self: center; }
.lp-result-wait { font-size: 17px; line-height: 24px; font-weight: 600; }
.lp-result-goal { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-result-foot { display: grid; gap: 12px; justify-items: start; padding-top: 4px; }
.lp-result-action { padding-top: 4px; }
/* Pinned to the card's floor, so side-by-side cards end on one line; .lp beats base's card spacing. */
.lp .lp-card > .lp-result-foot, .lp .lp-card > .lp-result-action, .lp .lp-card > .lp-result-note { margin-top: auto; }
.lp .lp-card > .lp-result-note { padding-top: 12px; }
.lp-result-title.lp-result-title { display: block; }
.lp-result-title .lp-info-wrap { vertical-align: -4px; }
.lp-result-self { display: grid; gap: 8px; width: 100%; }
.lp-result-foot .lp-tag { height: auto; min-height: 20px; white-space: normal; }
.lp-bignum-unit { font-size: 14px; line-height: 20px; font-weight: 400; color: var(--lp-ink-2); letter-spacing: 0; }
.lp-method-sentence { overflow-wrap: anywhere; }
.lp-method-evidence { grid-column: 1 / -1; }
.lp-bioage-gap { margin: 0; }
.lp-key-trends { display: grid; gap: 4px; }
.lp-key-trends ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px; line-height: 20px; }

/* --- record changes beyond normal fluctuation ---------------------------------------------------- */
.lp-notable { scroll-margin-top: 24px; }
.lp-notable-list { list-style: none; margin: 0; padding: 0; }
.lp-notable-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 140px; align-items: center; gap: 12px; min-height: 44px; padding: 8px 0; border-top: 1px solid var(--lp-line); font-size: 13px; line-height: 20px; }
.lp-notable-row:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-notable-row { grid-template-columns: auto minmax(0, 1fr) auto; } .lp-notable-row .lp-change-spark { display: none; } }
/* Narrow screens: the verdict on its own line, then the marker name and its values, so a long name is never a one-character column. */
@container lp-root (max-width: 480px) { .lp-notable-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; column-gap: 8px; } .lp-notable-row > .lp-badge { grid-column: 1 / -1; justify-self: start; } .lp-notable-values { white-space: normal; text-align: right; } }
.lp-notable-values { white-space: nowrap; color: var(--lp-ink-2); }
.lp-change-spark { min-width: 0; }
.lp-basis { min-width: 0; }
.lp-change-notes { display: grid; gap: 4px; }
.lp-change-source a { color: var(--lp-ink-2); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.lp-change-source a:hover { color: var(--lp-ink); }

/* --- first-run steps ------------------------------------------------------------------------------ */
.lp-step-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.lp-step-body > .lp-form-actions { margin-top: 0; }
.lp-consent { display: grid; gap: 12px; }
.lp-consent-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-consent-row p { color: var(--lp-ink); }
.lp-consent-icon { width: 24px; height: 24px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); }
.lp-first { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 480px) { .lp-first { grid-template-columns: minmax(0, 1fr); } }
.lp-first-cell { display: grid; gap: 4px; align-content: start; padding: 12px 16px; border-radius: var(--lp-radius-card); background: var(--lp-well); min-width: 0; }
.lp-first-wait { font-size: 17px; line-height: 24px; font-weight: 600; }
.lp-first-figure { font-size: 24px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-first-figure .lp-bignum-unit { margin-left: 4px; }
.lp-first-caveat { color: var(--lp-warn-ink); }

/* --- check-ins: three answers, outlined; the answer as a badge ------------------------------------ */
.lp-choices { display: inline-flex; align-items: center; gap: 8px; flex: none; }
.lp-choice {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 12px; border-radius: var(--lp-radius-ctl);
  border: 1px solid var(--lp-line-strong); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap;
  transition: background-color .15s ease;
}
.lp-choice:hover:not(:disabled) { background: var(--lp-hover); }
.lp-choice:disabled { cursor: progress; opacity: .6; }
.lp-choice-done .lp-icon { color: var(--lp-ink-2); }
.lp-choice-undo { border-color: transparent; color: var(--lp-ink-3); padding: 0 8px; }
.lp-choice-undo:hover:not(:disabled) { color: var(--lp-ink); }

/* --- 总览: today, the week, next step -------------------------------------------------------------- */
.lp-week { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--lp-line); }
.lp-week-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-week-cells { list-style: none; display: inline-flex; gap: 4px; margin: 0; padding: 0; }
.lp-week-cell { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-well); }
.lp-week-day { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-week-done { background: var(--lp-accent); }
.lp-week-done .lp-week-day { color: var(--lp-on-accent); }
.lp-week-part { background: var(--lp-band); }
.lp-week-part .lp-week-day { color: var(--lp-ink); }
.lp-week-missed { background: var(--lp-warn-wash); }
.lp-week-missed .lp-week-day { color: var(--lp-warn-ink); }
.lp-next-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.lp .lp-card.lp-next-card > * + * { margin-top: 0; }
.lp-next-text { display: grid; gap: 4px; min-width: 0; flex: 1; }
`
