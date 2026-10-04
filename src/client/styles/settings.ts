// The LongPi section in DSH's settings panel, reminders, privacy and the data connection
// (settings-page.ts, followup.ts, privacy/*, connection.ts). docs/design-system.md §5: each block has a 15/600
// title, blocks are split by a 1px line with 20px above and below, every on/off control is a Switch and folds
// are plain <details> (base draws the chevron). Page-specific layout only; base components are never redefined.

export const SETTINGS = `
/* --- the settings section ---------------------------------------------------------------------- */
.lp-settings { container: lp-root / inline-size; display: grid; padding-bottom: 24px; }
.lp-set-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; padding-bottom: 4px; }
.lp-set-block { display: grid; gap: 12px; min-width: 0; padding: 20px 0; border-top: 1px solid var(--lp-line); }
.lp-set-head + .lp-set-block, .lp-notice-slot + .lp-set-block { border-top: 0; padding-top: 16px; }
.lp-set-titles { display: grid; gap: 4px; min-width: 0; }
.lp-set-title { margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; color: var(--lp-ink); }
.lp-set-body { display: grid; gap: 12px; min-width: 0; justify-items: start; }
.lp-set-body > .lp-kv, .lp-set-body > details, .lp-set-body > .lp-conn-status { justify-self: stretch; }
.lp-set-text { font-size: 13px; line-height: 20px; }
.lp-settings :is(p, dd, .lp-bullets), .lp-data :is(p, dd, .lp-bullets) { max-width: 40em; }
.lp-set-kv { gap: 8px 16px; }
.lp-set-kv dd { color: var(--lp-ink-2); }
.lp-set-extra { min-width: 0; }
.lp-set-version { margin: 0; padding-top: 16px; border-top: 1px solid var(--lp-line); }

/* --- 提醒 -------------------------------------------------------------------------------------------- */
.lp-followup-box { display: grid; gap: 12px; min-width: 0; }
.lp-reminder { display: grid; gap: 8px; min-width: 0; }
.lp-reminder-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-reminder .lp-kv { margin-top: 4px; }
.lp-settings .lp-switch { font-size: 13px; line-height: 20px; font-weight: 500; }
.lp-input-time { width: 128px; flex: none; font-variant-numeric: tabular-nums; }
.lp-select-wide { width: auto; min-width: 128px; }

/* the whole form, under 更多设置 */
.lp-followup { display: grid; gap: 16px; min-width: 0; }
.lp-followup > .lp-form-actions { margin-top: 0; }
.lp-followup-head { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid var(--lp-line); }
.lp-followup-grid { gap: 20px 32px; }
.lp-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 12px; align-content: start; }
.lp-followup-legend { padding: 0; margin-bottom: 12px; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--lp-ink); }
.lp-followup-times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.lp-followup-detail { display: grid; gap: 8px; padding-top: 16px; border-top: 1px solid var(--lp-line); }
.lp-followup-log .lp-subhead { margin-top: 4px; }
.lp-followup-log .lp-row-main .lp-num { color: var(--lp-ink-2); }
.lp-test-result { display: inline-flex; flex-wrap: wrap; gap: 8px; }
.lp-check-off { cursor: default; color: var(--lp-ink-3); }
.lp-check-off input { cursor: default; }
.lp-check-text { display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }

/* --- 数据连接 ------------------------------------------------------------------------------------------ */
.lp-conn { display: grid; gap: 12px; min-width: 0; }
.lp-conn-status { display: grid; gap: 4px; min-width: 0; }
.lp-conn-form { display: grid; gap: 12px; min-width: 0; }
.lp-conn-form .lp-form-actions { margin-top: 0; }
.lp-conn-login { display: grid; gap: 12px; min-width: 0; }
.lp-conn-advanced > :not(summary) + :not(summary) { margin-top: 12px; }
.lp-conn-reconnect { display: grid; gap: 6px; margin-top: 8px; }
.lp-conn-ok { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--lp-good-ink); font-size: 13px; line-height: 20px; }

/* --- 隐私与数据 (privacy/data-page.ts, privacy/consent-screen.ts) ------------------------------------------ */
.lp-data-fold { min-width: 0; }
.lp-data-page { display: grid; gap: 12px; min-width: 0; }
.lp-data { display: grid; gap: 20px; min-width: 0; }
.lp-data-lists { display: grid; gap: 12px; }
.lp-data-list { display: grid; gap: 4px; }
.lp-data-group { display: grid; gap: 8px; justify-items: start; min-width: 0; }
.lp-data-group > .lp-field { width: 100%; max-width: 320px; }
.lp-pipl { display: grid; gap: 12px; min-width: 0; }
.lp-consent-age { max-width: 160px; }

/* --- 高级：方法库 (methods.ts) ------------------------------------------------------------------------------ */
.lp-methods { display: grid; gap: 12px; }
.lp-methods .lp-run { margin: 0; }

/* A narrow settings column (a phone, or DSH's settings dialog at phone width, where the LongPi column is only
   about 110 px): every row wraps, fields take the column's width, nothing is pushed past the edge. */
@container lp-root (max-width: 360px) {
  .lp-settings > *, .lp-settings section, .lp-settings div, .lp-settings form, .lp-settings fieldset, .lp-settings label,
  .lp-settings li, .lp-settings dl, .lp-settings dt, .lp-settings dd, .lp-settings details, .lp-settings summary, .lp-settings span,
  .lp-settings p, .lp-settings h2, .lp-settings h3 { min-width: 0; max-width: 100%; }
  .lp-settings input:not([type=radio]):not([type=checkbox]), .lp-settings select, .lp-settings textarea { min-width: 0 !important; max-width: 100%; width: 100%; box-sizing: border-box; }
  .lp-settings button, .lp-settings a.lp-linkbtn { max-width: 100%; height: auto; min-height: 32px; white-space: normal; text-align: left; }
  .lp-settings .lp-set-head, .lp-settings .lp-field-label, .lp-settings .lp-input-unit, .lp-settings .lp-seg, .lp-settings .lp-status,
  .lp-settings .lp-switch, .lp-settings .lp-check, .lp-settings .lp-subhead, .lp-settings .lp-reminder-row, .lp-settings .lp-actions,
  .lp-settings .lp-form-actions, .lp-settings .lp-row, .lp-settings summary, .lp-settings .lp-check-text { flex-wrap: wrap; }
  .lp-settings .lp-grid-2, .lp-settings .lp-followup-times, .lp-settings .lp-followup-grid, .lp-settings .lp-kv { grid-template-columns: minmax(0, 1fr); }
  .lp-settings .lp-kv { gap: 0; }
  .lp-settings .lp-kv dd + dt { margin-top: 8px; }
  .lp-settings .lp-seg { width: auto; max-width: 100%; }
  .lp-settings .lp-seg-opt, .lp-settings .lp-seg-opt span { min-width: 0; height: auto; white-space: normal; }
  .lp-settings, .lp-settings * { overflow-wrap: anywhere; }
}
`
