// Base components (docs/design-system.md §3–4): the only definitions of the page frame, cards, sections, buttons,
// tags, rows, tables, form controls, callouts, empty states, progress and the onboarding stepper. Page modules
// lay out their own screens with these and never redefine them.

export const BASE = `
/* --- frame ----------------------------------------------------------------------------- */
.lp-page-root {
  container: lp-root / inline-size;
  width: 100%; max-width: 100%; height: 100%; overflow-x: hidden; overflow-y: auto; background: var(--lp-bg);
  padding-top: var(--dsh-frame-top-clearance, 48px);
  padding-left: var(--dsh-frame-leading-clearance, 0px);
}
.lp-page { width: 100%; max-width: 1040px; margin: 0 auto; padding: 16px 40px 48px; }
@container lp-root (max-width: 760px) { .lp-page { padding: 12px 20px 40px; } }
.lp-body { transition: opacity .2s ease; }
.lp-refreshing { opacity: .6; }
.lp-stack { display: grid; gap: 12px; min-width: 0; }
.lp-stack-lg { display: grid; gap: 32px; min-width: 0; }
.lp-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-grid-2 > :last-child:nth-child(odd) { grid-column: 1 / -1; }
.lp-grid-top { align-items: start; }
.lp-grid-1 { display: grid; gap: 12px; }
@container lp-root (max-width: 720px) { .lp-grid-2 { grid-template-columns: minmax(0, 1fr); } }

/* --- section and card ------------------------------------------------------------------- */
.lp-section { display: grid; gap: 12px; min-width: 0; }
.lp-section + .lp-section { margin-top: 32px; }
.lp-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.lp-section-titles { display: grid; gap: 2px; min-width: 0; }
.lp-kicker { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-card {
  min-width: 0; max-width: 100%; padding: 20px; border-radius: var(--lp-radius-card);
  background: var(--lp-layer); border: 1px solid var(--lp-line);
}
@container lp-root (max-width: 560px) { .lp-card { padding: 16px; } }
/* content spacing inside a card: stronger than .lp p / list resets, weaker than an explicit page rule with .lp */
.lp .lp-card > * + * { margin-top: 12px; }
.lp .lp-card > .lp-card-head + * { margin-top: 0; }
.lp .lp-card > .lp-card-foot { margin-top: 16px; }
.lp-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; min-height: 22px; }
.lp-card-title, .lp-label { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; color: var(--lp-ink); }
.lp-card-title .lp-caption, .lp-label .lp-caption, .lp-label .lp-optional { font-weight: 400; }
.lp-optional { font-size: 12px; line-height: 18px; font-weight: 400; color: var(--lp-ink-3); }
.lp-subhead { display: flex; align-items: baseline; gap: 8px; margin: 16px 0 8px; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--lp-ink); }
.lp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--lp-line); }
.lp-card-skeleton { border-radius: var(--lp-radius-card); }
.lp-divider { height: 1px; border: 0; margin: 16px 0; background: var(--lp-line); }

/* --- buttons: DSH Btn (with .lp-btn) and .lp-linkbtn share one shape -------------------- */
.lp .lp-btn.lp-btn { height: 32px; padding: 0 12px; border-radius: var(--lp-radius-ctl); font-size: 13px; line-height: 20px; font-weight: 500; gap: 6px; }
.lp .lp-btn.lp-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
/* disabled: the same button, faded — never a solid grey block louder than an enabled outline button */
.lp .lp-btn.lp-btn:disabled { opacity: .4; cursor: default; }
.lp-linkbtn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: var(--lp-radius-ctl); border: 1px solid var(--lp-line-strong); background: transparent; color: var(--lp-ink);
  font-size: 13px; line-height: 20px; font-weight: 400; text-decoration: none; cursor: pointer; white-space: nowrap;
  transition: background-color .15s ease;
}
.lp-linkbtn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-linkbtn:disabled { cursor: default; color: var(--lp-ink-3); }
.lp-linkbtn .lp-icon { color: var(--lp-ink-2); }
.lp-linkbtn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
.lp-btn-primary { background: var(--lp-accent); color: var(--lp-on-accent); border-color: transparent; }
.lp-btn-primary:hover:not(:disabled) { background: var(--lp-accent); opacity: .88; }
.lp-btn-primary .lp-icon { color: inherit; }
.lp-textbtn {
  display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: var(--lp-ink-2);
  font-size: 13px; line-height: 20px; cursor: pointer; text-decoration: none; width: fit-content;
}
.lp-textbtn:hover:not(:disabled) { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; }
.lp-textbtn:disabled { color: var(--lp-ink-3); cursor: default; }
.lp-iconbtn, .lp-notice-x {
  width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; padding: 0;
  border: 0; border-radius: var(--lp-radius-ctl); background: transparent; color: var(--lp-ink-2); cursor: pointer;
}
.lp-notice-x { width: 24px; height: 24px; border-radius: 6px; color: var(--lp-ink-3); }
.lp-iconbtn:hover:not(:disabled), .lp-notice-x:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-iconbtn:disabled { opacity: .4; cursor: default; }
.lp-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.lp-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
.lp-modal-actions > button { min-width: 88px; }

/* --- tags and badges --------------------------------------------------------------------- */
.lp-tag {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: 4px; background: var(--lp-well);
  color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400; white-space: nowrap; vertical-align: middle;
}
.lp-badge, .lp-pill {
  display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--lp-well);
  color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 500; white-space: nowrap; vertical-align: middle;
}
.lp-badge-good, .lp-pill-good { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-badge-warn { background: var(--lp-warn-wash); color: var(--lp-warn-ink); }
.lp-badge-bad { background: var(--lp-bad-wash); color: var(--lp-bad-ink); }
.lp-badge-neutral { background: var(--lp-well); color: var(--lp-ink-2); }
.lp-badge-accent { background: var(--lp-accent); color: var(--lp-on-accent); }
.lp-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

/* --- status line ------------------------------------------------------------------------- */
.lp-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); min-width: 0; }
.lp-statusdot { width: 7px; height: 7px; border-radius: 50%; background: var(--lp-ink-4); flex: none; }
.lp-statusdot-on { background: var(--lp-good); box-shadow: 0 0 0 3px var(--lp-good-wash); }
.lp-statusdot-warn { background: var(--lp-warn); box-shadow: 0 0 0 3px var(--lp-warn-wash); }
.lp-statusdot-bad { background: var(--lp-bad); box-shadow: 0 0 0 3px var(--lp-bad-wash); }

/* --- rows, lists, tables ----------------------------------------------------------------- */
.lp-rows { list-style: none; margin: 0; padding: 0; }
.lp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 10px 0; border-top: 1px solid var(--lp-line); font-size: 13px; line-height: 20px; }
.lp-row:first-child { border-top: 0; }
.lp-row-main { flex: 1; min-width: 0; }
.lp-row-stack { flex-direction: column; align-items: flex-start; gap: 2px; }
.lp-row-end { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; color: var(--lp-ink-2); }
.lp-row-btn {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 10px 12px; margin: 0; border: 1px solid var(--lp-line);
  border-radius: var(--lp-radius-ctl); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-row-btn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-row-btn > .lp-icon:last-child { margin-left: auto; color: var(--lp-ink-3); }
.lp-bullets { margin: 4px 0 0; padding-left: 1.2em; display: grid; gap: 4px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-bullets li::marker { color: var(--lp-ink-3); }
.lp-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 16px; margin: 0; font-size: 13px; line-height: 20px; }
.lp-kv dt { color: var(--lp-ink-3); }
.lp-kv dd { margin: 0; min-width: 0; }
.lp-table-wrap { width: 100%; overflow-x: auto; }
.lp-table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 20px; }
.lp-table th { padding: 8px 12px; text-align: left; vertical-align: bottom; font-size: 12px; line-height: 18px; font-weight: 400; color: var(--lp-ink-3); border-bottom: 1px solid var(--lp-line); white-space: nowrap; }
.lp-table td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--lp-line); }
.lp-table tr:last-child td { border-bottom: 0; }
.lp-table th:first-child, .lp-table td:first-child { padding-left: 0; }
.lp-table th:last-child, .lp-table td:last-child { padding-right: 0; }
.lp-table td:first-child { white-space: nowrap; min-width: 5em; font-weight: 500; }
.lp-table .lp-td-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* --- forms ----------------------------------------------------------------------------------- */
.lp-field { display: grid; gap: 6px; min-width: 0; align-content: start; }
.lp-field-full { grid-column: 1 / -1; }
.lp-field-label { display: flex; align-items: baseline; gap: 6px; font-size: 13px; line-height: 20px; font-weight: 500; color: var(--lp-ink); }
.lp-field-label .lp-caption { font-weight: 400; }
.lp-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@container lp-root (max-width: 420px) { .lp-form-grid { grid-template-columns: minmax(0, 1fr); } }
.lp-onb .lp-form-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.lp-input, .lp-select {
  height: 36px; width: 100%; min-width: 0; padding: 0 12px; border-radius: var(--lp-radius-ctl); border: 1px solid var(--lp-line-strong);
  background: var(--lp-field); color: var(--lp-ink); font-size: 14px; line-height: 22px; transition: border-color .15s ease, box-shadow .15s ease;
}
.lp-select, select.lp-input {
  appearance: none; -webkit-appearance: none; padding-right: 32px; cursor: pointer;
  background-image: var(--lp-chevron-down); background-position: calc(100% - 10px) 50%; background-size: 14px 14px; background-repeat: no-repeat;
}
.lp-select-sm { height: 32px; font-size: 13px; width: auto; }
.lp-input::placeholder { color: var(--lp-ink-4); }
.lp-input:hover, .lp-select:hover { border-color: var(--lp-ink-4); }
.lp-input:focus, .lp-select:focus { outline: none; border-color: var(--lp-ink-3); box-shadow: 0 0 0 3px var(--lp-hover); }
.lp-input[aria-invalid="true"] { border-color: var(--lp-bad); }
.lp-input:disabled, .lp-select:disabled { opacity: .6; cursor: default; }
textarea.lp-input { height: auto; min-height: 80px; padding: 8px 12px; resize: vertical; }
.lp-input[type="date"] { padding-right: 8px; }
.lp-input[type="file"] { height: auto; padding: 6px; font-size: 13px; }
.lp-input-unit { display: flex; align-items: center; gap: 8px; }
.lp-form-error { margin: 0; color: var(--lp-bad-ink); font-size: 12px; line-height: 18px; }
.lp .lp-check, .lp-checkrow { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 20px; color: var(--lp-ink); cursor: pointer; }
.lp-checkrow { padding: 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp input[type="checkbox"], .lp input[type="radio"] { width: 16px; height: 16px; margin: 2px 0 0; flex: none; accent-color: var(--lp-accent); cursor: pointer; }
.lp-seg-wrap { display: grid; gap: 6px; }
.lp-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); width: max-content; max-width: 100%; flex-wrap: wrap; }
.lp-seg-opt { position: relative; display: inline-flex; }
.lp-seg-opt input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.lp-seg-opt span, .lp-seg-item {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 44px; height: 28px; padding: 0 12px; border: 0;
  border-radius: 6px; background: transparent; font: inherit; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
.lp-seg-opt:hover span, .lp-seg-item:hover:not(:disabled) { color: var(--lp-ink); }
.lp-seg-on span, .lp-seg-item.is-on { background: var(--lp-layer); color: var(--lp-ink); font-weight: 500; box-shadow: 0 0 0 1px var(--lp-line), 0 1px 2px rgba(0, 0, 0, .05); }
.lp-seg-item:disabled { color: var(--lp-ink-4); cursor: default; }
body[data-ds-dark-theme] .lp .lp-seg-on span, body[data-ds-dark-theme] .lp .lp-seg-item.is-on { background: var(--lp-press); box-shadow: 0 0 0 1px var(--lp-line-strong); }
.lp-seg-count { font-size: 12px; color: var(--lp-ink-3); font-weight: 400; font-variant-numeric: tabular-nums; }
.lp-seg-opt input:focus-visible + span { outline: 2px solid var(--lp-focus); outline-offset: 1px; }
.lp-toggles { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-toggle {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: var(--lp-radius-ctl);
  border: 1px solid var(--lp-line-strong); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
.lp-toggle:hover { background: var(--lp-hover); }
.lp-toggle-on, .lp-toggle-on:hover { background: var(--lp-accent); color: var(--lp-on-accent); border-color: transparent; }
.lp-toggle-badge { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--lp-on-accent); color: var(--lp-accent); font-size: 12px; line-height: 18px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
.lp-switch { display: inline-flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--lp-ink); font-size: 13px; font-weight: 500; line-height: 22px; cursor: pointer; text-align: left; }
.lp-switch:disabled { cursor: progress; opacity: .7; }
.lp-switch-track { position: relative; width: 36px; height: 20px; flex: none; border-radius: 10px; background: var(--lp-line-strong); transition: background-color .2s ease; }
.lp-switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--lp-layer); box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .2s ease; }
.lp-switch-on .lp-switch-track { background: var(--lp-accent); }
/* the thumb contrasts with the track in both themes (the dark accent is near white) */
.lp-switch-on .lp-switch-thumb { background: var(--lp-on-accent); }
.lp-switch-on .lp-switch-thumb { transform: translateX(16px); }
.lp-switch-label { min-width: 0; }

/* --- callouts, notices, empty states, errors --------------------------------------------- */
.lp-callout { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--lp-well); font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-callout > .lp-icon { margin-top: 2px; color: var(--lp-ink-3); }
.lp-callout-body { display: grid; gap: 4px; min-width: 0; flex: 1; }
.lp-callout-title { font-size: 13px; line-height: 20px; font-weight: 600; }
.lp-callout-info > .lp-icon { color: var(--lp-ink-3); }
.lp-callout-warn { background: var(--lp-warn-wash); }
.lp-callout-warn > .lp-icon { color: var(--lp-warn-ink); }
.lp-callout-good { background: var(--lp-good-wash); }
.lp-callout-good > .lp-icon { color: var(--lp-good-ink); }
.lp-callout-bad { background: var(--lp-bad-wash); }
.lp-callout-bad > .lp-icon { color: var(--lp-bad-ink); }
.lp-empty { display: grid; justify-items: start; gap: 4px; padding: 8px 0; }
.lp-empty > .lp-icon { color: var(--lp-ink-3); margin-bottom: 4px; }
.lp-empty-title { font-size: 14px; line-height: 22px; font-weight: 500; }
.lp-empty .lp-muted, .lp-empty-text { font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-empty > .lp-linkbtn, .lp-empty > button { margin-top: 8px; }
.lp-loaderror { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--lp-ink); font-size: 13px; line-height: 20px; }
.lp-loaderror > .lp-icon { color: var(--lp-warn-ink); }
.lp-loaderror-text { flex: 1; min-width: 200px; }
.lp-loaderror-compact { padding: 8px 12px; border-radius: 10px; background: var(--lp-warn-wash); }
.lp-partial { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 20px; }
.lp-partial .lp-icon { margin-top: 2px; color: var(--lp-warn-ink); }
.lp-blocker { font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-blocker-bad { color: var(--lp-bad-ink); }
.lp-notice-slot { position: sticky; top: 8px; z-index: 5; height: 0; display: flex; justify-content: center; pointer-events: none; }
.lp-notice {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; max-width: min(560px, 100%); padding: 6px 6px 6px 12px;
  border-radius: 10px; background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); font-size: 13px; line-height: 20px; animation: lp-fade .2s ease both;
}
.lp-onb .lp-notice { margin-top: 12px; box-shadow: 0 0 0 1px var(--lp-line); }
.lp-notice > .lp-icon { color: var(--lp-ink-3); }
.lp-notice-good > .lp-icon { color: var(--lp-good-ink); }
.lp-notice-bad > .lp-icon { color: var(--lp-bad-ink); }
.lp-skeleton { border-radius: var(--lp-radius-ctl); background: var(--lp-skeleton); animation: lp-pulse 1.6s ease-in-out infinite; }
.lp-loading { display: grid; gap: 12px; }
.lp-failed { display: grid; gap: 12px; justify-items: start; }

/* --- ⓘ and disclosure ------------------------------------------------------------------------- */
.lp-info-wrap { position: relative; display: inline-flex; vertical-align: middle; }
.lp-info-btn { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--lp-ink-3); cursor: pointer; }
.lp-info-btn:hover, .lp-info-btn[aria-expanded="true"] { color: var(--lp-ink); background: var(--lp-hover); }
.lp-info-pop {
  position: absolute; top: calc(100% + 6px); z-index: 20; width: min(300px, 80vw); padding: 10px 12px; border-radius: 10px;
  background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400;
  text-align: left; white-space: normal; display: grid; gap: 6px; animation: lp-fade .15s ease both;
}
.lp-info-start { left: -8px; }
.lp-info-end { right: -8px; }
.lp-info-line { display: block; }
@container lp-root (max-width: 480px) { .lp-info-pop { position: fixed; left: 12px; right: 12px; top: auto; width: auto; max-width: none; margin-top: 28px; } }
.lp details > summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; width: fit-content; color: var(--lp-ink-2); font-size: 13px; line-height: 20px; }
.lp details > summary::-webkit-details-marker { display: none; }
.lp details > summary::before { content: ""; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .15s ease; margin-right: 2px; }
.lp details[open] > summary::before { transform: rotate(45deg); }
.lp details > summary:hover { color: var(--lp-ink); }
.lp details[open] > summary { margin-bottom: 12px; }

/* --- progress ----------------------------------------------------------------------------------- */
.lp-bar { position: relative; height: 6px; border-radius: 3px; background: var(--lp-line); overflow: hidden; }
.lp-bar > span { display: block; height: 100%; border-radius: 3px; background: var(--lp-accent); transition: width .3s ease; }
.lp-progress-steps { list-style: none; margin: 0; padding: 0; display: grid; }
.lp-progress-step { position: relative; display: flex; align-items: center; gap: 12px; min-height: 32px; font-size: 13px; line-height: 20px; color: var(--lp-ink-3); }
.lp-progress-step::before { content: ""; position: absolute; left: 7.5px; top: 24px; bottom: -8px; width: 1px; background: var(--lp-line-strong); }
.lp-progress-step:last-child::before { display: none; }
.lp-progress-dot { position: relative; z-index: 1; width: 16px; height: 16px; flex: none; border-radius: 50%; border: 1.5px solid var(--lp-line-strong); background: var(--lp-layer); display: inline-flex; align-items: center; justify-content: center; color: var(--lp-on-accent); }
.lp-progress-step.is-done { color: var(--lp-ink-2); }
.lp-progress-step.is-done .lp-progress-dot { background: var(--lp-accent); border-color: var(--lp-accent); }
.lp-progress-step.is-now { color: var(--lp-ink); font-weight: 500; }
.lp-progress-step.is-now .lp-progress-dot { border: 2px solid var(--lp-accent); border-right-color: transparent; animation: lp-spin 1s linear infinite; }

/* --- onboarding stepper and upload ------------------------------------------------------------- */
.lp-stepper { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 20px; padding: 0; list-style: none; }
.lp-stepper-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; line-height: 20px; color: var(--lp-ink-3); }
.lp-stepper-item + .lp-stepper-item::before { content: ""; width: 24px; height: 1px; background: var(--lp-line); margin-right: 2px; }
.lp-stepper-dot { width: 20px; height: 20px; flex: none; border-radius: 50%; border: 1px solid var(--lp-line-strong); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-stepper-item.is-now { color: var(--lp-ink); font-weight: 500; }
.lp-stepper-item.is-now .lp-stepper-dot { background: var(--lp-accent); border-color: var(--lp-accent); color: var(--lp-on-accent); }
.lp-stepper-item.is-done .lp-stepper-dot { background: var(--lp-good-wash); border-color: transparent; color: var(--lp-good-ink); }
.lp-upload-simple { display: grid; justify-items: center; gap: 8px; padding: 24px; border: 1px dashed var(--lp-line-strong); border-radius: var(--lp-radius-card); text-align: center; }
.lp-upload-simple .lp-upload-status { max-width: 36em; }
.lp-upload-simple .lp-form-error { max-width: 36em; }

/* --- motion and overflow safety -------------------------------------------------------------- */
.lp-spin { animation: lp-spin 1s linear infinite; }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-pulse { 50% { opacity: .45; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
.lp-card p, .lp-muted, .lp-caption, .lp-callout, .lp-row-main { overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) {
  .lp *, .lp *::before, .lp *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`
