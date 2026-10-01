// deep analysis tab (analysis.ts).
// Page-specific layout only; base components (styles/base.ts) are never redefined here. See docs/design-system.md.

export const ANALYSIS = `
/* cards that are mostly prose: every text block shares one line length (40em at 14px) */
.lp-an-prose > .lp-callout, .lp-an-prose > details, .lp-an-prose > .lp-an-next { max-width: 560px; }

/* report summary: four counts in a row, then the headline readouts (.lp-kv) */
.lp-an-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
@container lp-root (max-width: 560px) { .lp-an-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.lp-an-fact { display: grid; gap: 4px; min-width: 0; padding: 12px 16px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-an-fact dt { margin: 0; }
.lp-an-fact-value { display: flex; align-items: baseline; gap: 4px; margin: 0; color: var(--lp-ink); }

/* organ table: value first, the estimate's range on a 12px line under it */
.lp-an-organs .lp-an-organ { white-space: nowrap; }
/* measurements .9 : age 7em : risks 1.1 — the risk column is the widest so disease names stay on one line */
.lp-an-organs th:nth-child(2) { width: 38%; }
.lp-an-organs th:nth-child(3) { width: 7em; }
.lp-an-organs th:nth-child(4) { width: 44%; white-space: normal; }
.lp-an-valtext { color: var(--lp-ink); }
.lp-an-narrow-note { display: none; }
.lp-card > .lp-an-narrow-note + .lp-table-wrap { margin-top: 0; }
.lp-an-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-an-est { display: grid; gap: 2px; }
.lp-an-val { white-space: nowrap; color: var(--lp-ink); }

/* ≤760px: one block per organ (organ → measurements → age → risks) instead of a squeezed table */
@container lp-root (max-width: 760px) {
  .lp-table.lp-an-organs, .lp-an-organs tbody, .lp-an-organs tr, .lp-an-organs td { display: block; width: auto; }
  .lp-an-organs thead { display: none; }
  .lp-card > .lp-an-narrow-note { display: block; }
  .lp-card > .lp-an-narrow-note + .lp-table-wrap { margin-top: 12px; }
  .lp-an-organs tr { padding: 12px 0; border-bottom: 1px solid var(--lp-line); }
  .lp-an-organs tr:first-child { padding-top: 0; }
  .lp-an-organs tr:last-child { padding-bottom: 0; border-bottom: 0; }
  .lp-table.lp-an-organs td { padding: 0; border: 0; }
  .lp-table.lp-an-organs td + td { margin-top: 8px; }
  .lp-table.lp-an-organs .lp-an-organ { font-size: 14px; line-height: 22px; font-weight: 600; }
  .lp-an-organs td[data-label]::before { content: attr(data-label); display: block; margin-bottom: 4px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
  .lp-table.lp-an-organs td.lp-an-none { display: none; }
}

/* question board and plan */
.lp-an-more { display: grid; gap: 8px; }
.lp-an-next { font-size: 13px; line-height: 20px; color: var(--lp-ink); }

/* a stalled or not-started run: one line instead of eleven empty steps */
.lp-an-fold { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lp-an-bullets { margin: 0; color: var(--lp-ink); }
`
