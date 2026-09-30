// deep analysis tab (analysis.ts).
// Page-specific layout only; base components (styles/base.ts) are never redefined here. See docs/design-system.md.

export const ANALYSIS = `
/* report summary: four counts in a row, then the headline readouts (.lp-kv) */
.lp-an-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
@container lp-root (max-width: 560px) { .lp-an-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.lp-an-fact { display: grid; gap: 4px; min-width: 0; padding: 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-an-fact dt { margin: 0; }
.lp-an-fact-value { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; color: var(--lp-ink); }

/* organ table: measures and risks as short stacked lines, never one run-on string */
.lp-an-organs { min-width: 640px; }
.lp-an-organs th:nth-child(3), .lp-an-organs td:nth-child(3) { width: 9em; }
.lp-an-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.lp-an-list .lp-badge { margin-right: 4px; }
.lp-an-risks { display: grid; gap: 8px; }
.lp-an-risks .lp-small .lp-badge { margin-right: 4px; }

/* question board and plan */
.lp-an-more { display: grid; gap: 8px; }
.lp-an-next { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-an-next > .lp-icon { margin-top: 2px; color: var(--lp-ink-3); }
.lp-an-bullets { margin: 0; color: var(--lp-ink); }
`
