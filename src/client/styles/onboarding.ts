// onboarding dialog (onboarding.ts, datain/upload.ts), plus the first-result blocks journey-steps.ts still
// renders. Page-specific layout only; base components (styles/base.ts) are never redefined
// here. See docs/design-system.md.

export const ONBOARDING = `
/* --- the dialog (inside DSH's Modal card) ------------------------------------------------------ */
/* The Modal card is sized by className, and by what it directly holds in case the host ignores className. */
.lp-onb-dialog.lp-onb-dialog, div:has(> .lp-onb.lp-onb) { width: min(560px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-onb { display: flex; flex-direction: column; max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px; color: var(--lp-ink); font-size: 14px; line-height: 22px; }
@media (max-width: 560px) { .lp-onb { padding: 20px 16px; } }
.lp-onb-title { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; color: var(--lp-ink); outline: none; }
.lp-onb-title + .lp-onb-text { margin-top: 12px; }
.lp-onb-body { margin-top: 16px; }
.lp-onb-body > * + * { margin-top: 16px; }
.lp-onb-body > .lp-onb-text + .lp-onb-text { margin-top: 12px; }
.lp-onb-body > .lp-checkrow + .lp-caption { margin-top: 8px; }
.lp-onb-body > .lp-onb-actions, .lp-onb-actions { margin-top: 24px; }
.lp-onb-text { max-width: 36em; margin: 0; font-size: 14px; line-height: 22px; color: var(--lp-ink-2); }
.lp-onb-lead { margin: 0 0 16px; max-width: 36em; color: var(--lp-ink-2); }
.lp-onb-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-onb-actions > :last-child { margin-left: auto; }
.lp-onb-actions > button { min-width: 88px; }
.lp-onb-center { display: flex; justify-content: center; }
.lp-onb-body > .lp-upload-simple + .lp-onb-center { margin-top: 12px; }

/* stepper labels: one line each; on a narrow dialog only the current step keeps its label */
.lp-stepper-label { font-size: 13px; line-height: 20px; white-space: nowrap; }
@media (max-width: 480px) { .lp-onb .lp-stepper-item:not(.is-now) .lp-stepper-label { display: none; } }

/* --- upload (datain/upload.ts) ----------------------------------------------------------------- */
.lp-upload-icon { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--lp-well); color: var(--lp-ink-2); }
.lp-upload-simple > .lp-upload-icon { margin-bottom: 4px; }
.lp-upload-status { margin: 0; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-upload-form { display: grid; gap: 16px; max-width: 480px; }
.lp-upload-pick { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-width: 0; }
.lp-upload-chosen { min-width: 0; overflow-wrap: anywhere; }

/* --- first-result blocks (journey-steps.ts) --------------------------------- */
.lp-found { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.lp-found-tile { display: grid; gap: 4px; padding: 12px 16px; border-radius: var(--lp-radius-card); background: var(--lp-well); min-width: 0; }
.lp-found-figure { font-size: 24px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-now-block .lp-subhead { margin-top: 4px; }
`
