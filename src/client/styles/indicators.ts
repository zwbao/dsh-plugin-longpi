// labs, sleep, training, calendar, ask tabs and charts (indicators.ts, life.ts, charts.ts).
// Page-specific layout only; base components (styles/base.ts) are never redefined here. See docs/design-system.md.

export const INDICATORS = `
/* --- charts: --lp-data is the only data color, --lp-band the noise band ------------------------ */
.lp-chart { position: relative; width: 100%; }
.lp-chart svg { display: block; overflow: visible; }
.lp-chart svg:focus { outline: none; }
.lp-chart svg:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 4px; border-radius: 4px; }
.lp-chart-empty { color: var(--lp-ink-3); font-size: 13px; line-height: 20px; padding: 24px 0; }
.lp-grid { stroke: var(--lp-line); stroke-width: 1; }
.lp-axis { fill: var(--lp-ink-3); font-size: 12px; }
.lp-line { fill: none; stroke: var(--lp-data); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.lp-area { fill: var(--lp-data-wash); stroke: none; }
.lp-dot { fill: var(--lp-data); stroke: var(--lp-layer); stroke-width: 2; transition: r .15s ease; }
.lp-band { fill: var(--lp-band); }
.lp-goal { stroke: var(--lp-ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
.lp-goal-text { fill: var(--lp-ink-2); font-size: 12px; }
.lp-ref { stroke: var(--lp-line-strong); stroke-width: 1; }
.lp-cross { stroke: var(--lp-line-strong); stroke-width: 1; }
.lp-end { fill: var(--lp-ink); font-size: 12px; font-weight: 500; }
.lp-cbar { fill: var(--lp-data); }
.lp-cbar-muted { fill: var(--lp-line-strong); }
.lp-hit { fill: transparent; }
.lp-row-label { fill: var(--lp-ink); font-size: 13px; }
.lp-checkup { stroke: var(--lp-line); stroke-width: 1; }
.lp-checkup-dot { fill: var(--lp-ink-3); stroke: var(--lp-layer); stroke-width: 2; }
.lp-today { stroke: var(--lp-ink-3); stroke-width: 1; }
.lp-timeline { display: grid; gap: 8px; }
.lp-legend-inline { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-key-bar { width: 16px; height: 6px; border-radius: 3px; background: var(--lp-data); display: inline-block; }
.lp-key-dot { width: 8px; height: 8px; margin-left: 8px; border-radius: 50%; background: var(--lp-ink-3); display: inline-block; }
.lp-tip {
  position: absolute; z-index: 5; min-width: 120px; max-width: 220px; padding: 8px 12px; border-radius: 8px; background: var(--lp-layer-2);
  box-shadow: var(--lp-shadow-pop); font-size: 12px; line-height: 18px; pointer-events: none; transform: translateY(-100%);
}
.lp-tip-title { color: var(--lp-ink-3); }
.lp-tip-row { display: flex; flex-direction: column; }
.lp-tip-value { color: var(--lp-ink); font-weight: 500; font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums; }
.lp-tip-label { color: var(--lp-ink-2); }
.lp-strip { position: relative; flex: none; }
.lp-cell-done { fill: var(--lp-data); }
.lp-cell-missed { fill: var(--lp-line-strong); }
.lp-cell-unknown { fill: var(--lp-line); }
.lp-twin { margin-top: 8px; font-size: 12px; line-height: 18px; }
.lp-twin table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.lp-twin caption { text-align: left; color: var(--lp-ink-3); padding-bottom: 4px; }
.lp-twin th, .lp-twin td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--lp-line); }
.lp-twin th { color: var(--lp-ink-3); font-weight: 400; }
.lp-spark { display: block; overflow: visible; }
.lp-spark-line { fill: none; stroke: var(--lp-data); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.lp-spark-dot { fill: var(--lp-data); }

/* --- 化验 / 睡眠 / 运动: one table, header and rows share --lp-ind-cols --------------------------- */
.lp-ind-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-ind-meta { display: inline-flex; align-items: center; gap: 4px; }
.lp-ind-card {
  --lp-ind-cols: minmax(0, 1.6fr) minmax(0, 1.3fr) 88px minmax(112px, 1fr) 40px 16px;
  padding-top: 8px; padding-bottom: 8px;
}
.lp-ind-head { display: grid; grid-template-columns: var(--lp-ind-cols); align-items: center; column-gap: 12px; padding: 8px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); border-bottom: 1px solid var(--lp-line); }
.lp-ind-card > .lp-ind-group { margin-top: 4px; }
.lp-ind-group-title { margin: 0; padding: 12px 8px 4px; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--lp-ink-3); }
.lp-ind-group-title .lp-optional { margin-left: 8px; }
.lp-ind-list { list-style: none; margin: 0; padding: 0; }
.lp-ind-row + .lp-ind-row { border-top: 1px solid var(--lp-line); }
.lp-ind-btn {
  display: grid; grid-template-columns: var(--lp-ind-cols); align-items: center; column-gap: 12px;
  width: 100%; min-height: 48px; padding: 8px; margin: 0; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink); font: inherit; font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-ind-btn:hover, .lp-ind-open .lp-ind-btn { background: var(--lp-hover); }
.lp-ind-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lp-ind-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.lp-ind-value { display: flex; align-items: baseline; gap: 8px; min-width: 0; white-space: nowrap; overflow: hidden; }
.lp-ind-value .lp-num { font-weight: 500; }
.lp-ind-unit { color: var(--lp-ink-2); }
.lp-ind-error { display: inline-flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-ind-judged { display: flex; align-items: center; min-width: 0; }
.lp-ind-source { color: var(--lp-ink-2); white-space: nowrap; }
.lp-ind-chevron { color: var(--lp-ink-3); transition: transform .15s ease; }
.lp-ind-open .lp-ind-chevron { transform: rotate(90deg); }
@container lp-root (max-width: 700px) {
  .lp-ind-card { --lp-ind-cols: minmax(0, 1fr) auto 16px; }
  .lp-ind-head, .lp-ind-spark { display: none; }
  .lp-ind-btn { grid-template-areas: "name judged chev" "value value chev"; row-gap: 4px; }
  .lp-ind-name { grid-area: name; }
  .lp-ind-judged { grid-area: judged; justify-content: flex-end; }
  .lp-ind-value { grid-area: value; }
  .lp-ind-source { display: none; }
  .lp-ind-chevron { grid-area: chev; }
}
.lp-ind-panel { padding: 4px 0 16px; }
.lp-ind-detail { display: grid; gap: 12px; padding: 12px 16px; border-radius: var(--lp-radius-card); background: var(--lp-well); }
.lp-ind-detail a { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.lp-ind-skeleton { margin: 12px 0; }

/* --- 日程 / 问 LongPi ------------------------------------------------------------------------- */
.lp-ask-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-cal-row { flex-wrap: wrap; }
.lp-cal-date { flex: none; align-self: flex-start; width: 96px; color: var(--lp-ink-3); font-variant-numeric: tabular-nums; }
.lp-cal-actions { display: flex; align-items: center; gap: 8px; flex: none; }

/* --- shared with engage/season-tab.ts and results.ts (look of .lp-row-btn) -------------------- */
`
