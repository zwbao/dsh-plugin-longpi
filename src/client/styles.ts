// LongPi's styles. Surfaces, text, lines and states come from DSH's own
// design tokens (with DSH's light values as fallbacks), so LongPi follows the
// host's light and dark themes. The few colors LongPi owns (the one data
// accent, the noise band, verdict washes) get a dark variant under
// body[data-ds-dark-theme], the attribute DSH sets. Every LongPi root carries
// .lp because the modal, the home greeting and the pill render outside the page.

const CSS = `
.lp {
  --lp-bg: var(--dsw-alias-bg-base, #fff);
  --lp-layer: var(--dsw-alias-bg-layer-1, #fff);
  --lp-layer-2: var(--dsw-alias-bg-layer-2, #fff);
  --lp-ink: var(--dsw-alias-label-primary, rgb(15, 17, 21));
  --lp-ink-2: var(--dsw-alias-label-secondary, rgb(97, 102, 107));
  --lp-ink-3: var(--dsw-alias-label-tertiary, rgb(129, 133, 140));
  --lp-ink-4: var(--dsw-alias-label-caption, rgb(173, 178, 184));
  --lp-line-1: var(--dsw-alias-border-l1, rgba(0, 0, 0, .04));
  --lp-line-2: var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
  --lp-line-3: var(--dsw-alias-border-l3, rgba(0, 0, 0, .12));
  --lp-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, .06));
  --lp-press: var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, .1));
  --lp-good: var(--dsw-alias-state-success-primary, rgb(34, 197, 94));
  --lp-warn: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11));
  --lp-bad: var(--dsw-alias-state-error-primary, rgb(236, 19, 19));
  --lp-skeleton: var(--dsw-alias-bg-skeleton, rgba(0, 0, 0, .04));
  --lp-brand: var(--dsw-alias-brand-primary, rgb(15, 17, 21));
  --lp-on-brand: var(--dsw-alias-label-primary-foreground, #fff);
  --lp-focus: var(--dsw-alias-state-business-primary, rgb(65, 118, 230));
  --lp-accent: #2a78d6;
  --lp-accent-wash: rgba(42, 120, 214, .08);
  --lp-accent-soft: rgba(42, 120, 214, .16);
  --lp-band: rgba(97, 102, 107, .11);
  --lp-good-ink: #15803d;
  --lp-good-wash: rgba(34, 197, 94, .11);
  --lp-warn-ink: #b45309;
  --lp-warn-wash: rgba(245, 158, 11, .13);
  --lp-bad-wash: rgba(236, 19, 19, .07);
  --lp-well: rgba(38, 49, 72, .035);
  --lp-field: #fff;
  --lp-seg-on: #fff;
  --lp-card-shadow: 0 0 0 .5px var(--lp-line-3), 0 1px 2px rgba(0, 0, 0, .02), 0 6px 20px rgba(0, 0, 0, .03);
  --lp-lift: var(--dsw-elevation-prominent, 0 0 0 .5px rgba(0, 0, 0, .16), 0 3px 8px rgba(0, 0, 0, .04), 0 0 20px rgba(0, 0, 0, .05));
  color-scheme: light;
  color: var(--lp-ink);
  font-size: 14px;
  line-height: 22px;
  -webkit-font-smoothing: antialiased;
}
body[data-ds-dark-theme] .lp {
  --lp-accent: #3987e5;
  --lp-accent-wash: rgba(57, 135, 229, .14);
  --lp-accent-soft: rgba(57, 135, 229, .26);
  --lp-band: rgba(207, 211, 214, .12);
  --lp-good-ink: #4ed17e;
  --lp-good-wash: rgba(34, 197, 94, .16);
  --lp-warn-ink: #f7ad31;
  --lp-warn-wash: rgba(245, 158, 11, .16);
  --lp-bad-wash: rgba(242, 90, 90, .14);
  --lp-well: rgba(255, 255, 255, .04);
  --lp-field: rgba(255, 255, 255, .03);
  --lp-seg-on: rgba(255, 255, 255, .14);
  --lp-card-shadow: 0 0 0 .5px var(--lp-line-2);
  color-scheme: dark;
}
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp button, .lp input, .lp select { font-family: inherit; }
.lp :is(button, a, summary, [tabindex="0"]):focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 2px; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lp-icon { flex: none; vertical-align: -3px; }

/* --- page frame ----------------------------------------------------------------- */
.lp-page-root {
  container: lp-root / inline-size;
  height: 100%; overflow-y: auto; background: var(--lp-bg);
  padding-top: var(--dsh-frame-top-clearance, 48px);
  padding-left: var(--dsh-frame-leading-clearance, 0px);
}
.lp-page { max-width: 1040px; margin: 0 auto; padding: 12px 40px 64px; }
@container lp-root (max-width: 760px) { .lp-page { padding: 8px 20px 48px; } }
.lp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
@container lp-root (max-width: 760px) { .lp-header { flex-direction: column; gap: 16px; } }
.lp-kicker { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); margin-bottom: 6px; }
.lp-h1 { font-size: 26px; line-height: 34px; font-weight: 500; margin: 0 0 4px; letter-spacing: -.01em; }
.lp-h2 { font-size: 18px; line-height: 26px; font-weight: 500; margin: 0; }
.lp-h3 { font-size: 15px; line-height: 22px; font-weight: 500; margin: 6px 0 2px; }
.lp-lead { margin: 0 0 10px; color: var(--lp-ink-2); }
.lp-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-statusdot { width: 7px; height: 7px; border-radius: 50%; background: var(--lp-ink-4); flex: none; }
.lp-statusdot-on { background: var(--lp-good); box-shadow: 0 0 0 3px var(--lp-good-wash); }
.lp-statusdot-bad { background: var(--lp-warn); box-shadow: 0 0 0 3px var(--lp-warn-wash); }
.lp-actions { display: flex; gap: 6px; flex: none; flex-wrap: wrap; }
.lp-linkbtn {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 16px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px;
  text-decoration: none; cursor: pointer; white-space: nowrap; transition: background-color .15s ease;
}
.lp-linkbtn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-linkbtn:disabled { cursor: default; color: var(--lp-ink-3); }
.lp-linkbtn .lp-icon { color: var(--lp-ink-2); }
.lp-body { transition: opacity .2s ease; }
.lp-refreshing { opacity: .6; }
.lp-footer { margin-top: 56px; padding-top: 16px; border-top: .5px solid var(--lp-line-2); color: var(--lp-ink-3); font-size: 12px; line-height: 18px; }
.lp-footer p { margin: 0 0 4px; }
.lp-footer p:first-child { color: var(--lp-ink-2); }

/* --- building blocks ------------------------------------------------------------ */
.lp-card { background: var(--lp-layer); border-radius: 16px; padding: 20px 22px; box-shadow: var(--lp-card-shadow); min-width: 0; animation: lp-rise .45s cubic-bezier(.2, .7, .2, 1) both; }
.lp-section { margin-top: 44px; }
.lp-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.lp-label { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); font-weight: 500; margin: 0 0 12px; }
.lp-optional { font-weight: 400; font-size: 12px; color: var(--lp-ink-3); }
.lp-subhead { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); font-weight: 500; margin: 18px 0 8px; }
.lp-strong { font-weight: 500; color: var(--lp-ink); }
.lp-muted { color: var(--lp-ink-2); }
p.lp-muted { margin: 0; }
.lp-muted-ink { color: var(--lp-ink-3); }
.lp-good-ink { color: var(--lp-good-ink); }
.lp-caption { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); font-weight: 400; }
.lp-fine { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); margin: 12px 0 0; }
.lp-fine-tight { margin-top: 2px; max-width: 13rem; }
.lp-num { font-variant-numeric: tabular-nums; color: var(--lp-ink-2); }
.lp-tag { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; background: var(--lp-hover); color: var(--lp-ink-2); font-size: 11px; line-height: 16px; white-space: nowrap; font-weight: 400; }
.lp-pill { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 12px; background: var(--lp-hover); color: var(--lp-ink); font-size: 12px; line-height: 18px; font-weight: 500; white-space: nowrap; }
.lp-pill-good { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-skeleton { border-radius: 10px; background: var(--lp-skeleton); animation: lp-pulse 1.6s ease-in-out infinite; }
.lp-card-skeleton { border-radius: 16px; }
.lp-loading { display: grid; gap: 16px; }
.lp-failed { display: grid; gap: 10px; justify-items: start; }
.lp-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.lp-section-head + .lp-grid-2 { margin-top: 0; }
.lp-grid-top { align-items: start; }
.lp-grid-1 { margin-top: 16px; }
@container lp-root (max-width: 760px) { .lp-grid-2 { grid-template-columns: 1fr; } }
.lp-notice-slot { position: sticky; top: 8px; z-index: 5; height: 0; display: flex; justify-content: center; pointer-events: none; }
.lp-notice {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; max-width: min(560px, 100%);
  padding: 6px 6px 6px 14px; border-radius: 18px; background: var(--lp-layer-2); box-shadow: var(--lp-lift);
  font-size: 13px; line-height: 20px; animation: lp-rise .25s ease both;
}
.lp-onb .lp-notice { margin-top: 12px; box-shadow: 0 0 0 .5px var(--lp-line-3); }
.lp-notice > .lp-icon { color: var(--lp-ink-3); }
.lp-notice-good > .lp-icon { color: var(--lp-good-ink); }
.lp-notice-bad > .lp-icon { color: var(--lp-bad); }
.lp-notice-x, .lp-iconbtn {
  width: 28px; height: 28px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--lp-ink-3); cursor: pointer;
}
.lp-notice-x:hover, .lp-iconbtn:hover:not(:disabled) { background: var(--lp-hover); color: var(--lp-ink); }
.lp-iconbtn:disabled { opacity: .4; cursor: default; }
.lp-rows { list-style: none; margin: 0; padding: 0; }
.lp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: .5px solid var(--lp-line-2); font-size: 13px; line-height: 20px; }
.lp-row:first-child { border-top: 0; }
.lp-row-main { flex: 1; min-width: 0; }
.lp-row-stack { flex-direction: column; align-items: flex-start; gap: 0; }
.lp-row-end { display: inline-flex; align-items: baseline; gap: 8px; white-space: nowrap; }

/* --- forms ---------------------------------------------------------------------- */
.lp-field { display: grid; gap: 6px; min-width: 0; }
.lp-field-label { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-input {
  height: 36px; width: 100%; min-width: 0; padding: 0 12px; border-radius: 10px; border: .5px solid var(--lp-line-3);
  background: var(--lp-field); color: var(--lp-ink); font-size: 14px; line-height: 22px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.lp-input::placeholder { color: var(--lp-ink-4); }
.lp-input:hover { border-color: var(--lp-ink-4); }
.lp-input:focus { outline: none; border-color: var(--lp-ink-3); box-shadow: 0 0 0 3px var(--lp-hover); }
.lp-input[aria-invalid="true"] { border-color: var(--lp-bad); }
.lp-input[type="date"] { padding-right: 8px; }
.lp-input-unit { display: flex; align-items: center; gap: 8px; }
.lp-unit { color: var(--lp-ink-3); font-size: 13px; white-space: nowrap; }
.lp-select { height: 36px; flex: none; padding: 0 6px; border-radius: 10px; border: .5px solid var(--lp-line-3); background: var(--lp-field); color: var(--lp-ink); font-size: 13px; }
.lp-form-error { margin: 0; color: var(--lp-bad); font-size: 13px; line-height: 20px; }
.lp-form-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.lp-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 24px; flex-wrap: wrap; }
.lp-modal-actions > button { min-width: 96px; }
.lp-seg-wrap { display: grid; gap: 6px; }
.lp-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; background: var(--lp-hover); width: max-content; }
.lp-seg-opt { position: relative; display: inline-flex; }
.lp-seg-opt input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.lp-seg-opt span {
  display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 30px; padding: 0 12px;
  border-radius: 8px; font-size: 13px; color: var(--lp-ink-2); transition: background-color .15s ease, color .15s ease;
}
.lp-seg-opt:hover span { color: var(--lp-ink); }
.lp-seg-on span { background: var(--lp-seg-on); color: var(--lp-ink); font-weight: 500; box-shadow: 0 0 0 .5px var(--lp-line-3), 0 1px 2px rgba(0, 0, 0, .06); }
.lp-seg-opt input:focus-visible + span { outline: 2px solid var(--lp-focus); outline-offset: 1px; }
.lp-toggles { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-toggle {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 16px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 13px; cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
.lp-toggle:hover { background: var(--lp-hover); }
.lp-toggle-on, .lp-toggle-on:hover { background: var(--lp-brand); color: var(--lp-on-brand); border-color: transparent; }
.lp-toggle-badge { width: 18px; height: 18px; margin-left: -6px; border-radius: 50%; background: var(--lp-on-brand); color: var(--lp-brand); font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }

/* --- profile editor ----------------------------------------------------------------- */
.lp-profile { container: lp-form / inline-size; display: grid; gap: 18px; }
.lp-profile-basics { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 24px; }
.lp-field-age { width: 150px; }
.lp-unlock { display: flex; align-items: center; gap: 6px; margin: -10px 0 0; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-unlock-inline { display: block; margin: 2px 0 0; }
.lp-facts { border: 0; margin: 0; padding: 0; min-width: 0; }
.lp-facts-legend { padding: 0; margin-bottom: 6px; font-size: 13px; line-height: 20px; }
.lp-fact { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-top: .5px solid var(--lp-line-2); }
.lp-fact:first-of-type { border-top: 0; }
.lp-fact-text { min-width: 0; }
.lp-fact-label { font-size: 14px; line-height: 20px; }
@container lp-form (max-width: 420px) { .lp-fact { flex-direction: column; align-items: flex-start; gap: 8px; } }
.lp-focus { display: grid; gap: 8px; }

/* --- self measurements ---------------------------------------------------------------- */
.lp-self-latest { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.lp-self-latest li { display: grid; padding: 8px 12px; border-radius: 12px; background: var(--lp-well); min-width: 120px; }
.lp-self-value { font-size: 16px; line-height: 24px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-self-form { container: lp-form / inline-size; display: grid; gap: 14px; }
.lp-self-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.lp-self-bp { grid-column: 1 / -1; }
@container lp-form (max-width: 380px) { .lp-self-grid { grid-template-columns: 1fr; } }
.lp-self-field { display: grid; gap: 6px; min-width: 0; }
.lp-bp { display: flex; align-items: center; gap: 8px; }
.lp-bp .lp-input { width: 104px; }
.lp-bp-slash { color: var(--lp-ink-4); }
.lp-self-recent .lp-subhead { margin-top: 16px; }
.lp-self-empty { margin: 12px 0 0; }
.lp-inline-self { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lp-inline-self .lp-input { width: 92px; height: 32px; }
.lp-inline-self .lp-select { height: 32px; }

/* --- results --------------------------------------------------------------------------- */
.lp-results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
@container lp-root (max-width: 720px) { .lp-results { grid-template-columns: 1fr; } }
.lp-result { display: flex; flex-direction: column; }
.lp-result-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.lp-result-head .lp-label { margin: 0; }
.lp-result-figure { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.lp-bignum { font-size: 48px; line-height: 58px; font-weight: 500; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.lp-bignum-unit { font-size: 16px; line-height: 24px; color: var(--lp-ink-2); font-weight: 400; letter-spacing: 0; }
.lp-band-note { margin-left: auto; font-size: 12px; color: var(--lp-ink-3); align-self: center; }
.lp-result-sub { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 4px 0 14px; }
.lp-result-goal { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); }
.lp-story { display: flex; gap: 8px; align-items: flex-start; margin: 14px 0 0; color: var(--lp-ink); }
.lp-result-win { background: linear-gradient(180deg, var(--lp-good-wash), transparent 140px), var(--lp-layer); }
.lp-result-wait { font-size: 22px; line-height: 30px; font-weight: 500; margin: 8px 0 6px; }
.lp-blocker { margin: 0; color: var(--lp-ink-2); }
.lp-blocker-bad { color: var(--lp-ink); padding: 10px 12px; border-radius: 10px; background: var(--lp-warn-wash); }
.lp-needs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; }
.lp-need { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px; border-radius: 12px; border: 1px dashed var(--lp-line-3); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; white-space: nowrap; }
.lp-result-action { margin-top: auto; padding-top: 18px; }
/* The closing fine print sits on the card's floor, so side-by-side cards end on one line. */
.lp-result > .lp-fine:last-child { margin-top: auto; padding-top: 14px; }
.lp-result-self { margin-top: auto; padding-top: 16px; display: grid; gap: 8px; }
.lp-result-blocked .lp-result-self { border-top: .5px solid var(--lp-line-2); margin-top: 16px; }
.lp-addons { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-addon { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-addon-box { width: 30px; height: 30px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-layer); color: var(--lp-ink-2); box-shadow: 0 0 0 .5px var(--lp-line-3); }
.lp-addon-text { flex: 1; min-width: 150px; }

/* The body-age card's note when one of its inputs changed beyond normal fluctuation. */
.lp-caveat { display: flex; gap: 6px; align-items: flex-start; margin: -4px 0 14px; padding: 8px 10px; border-radius: 10px; background: var(--lp-warn-wash); font-size: 12px; line-height: 18px; color: var(--lp-ink); }
.lp-caveat .lp-icon { margin-top: 2px; color: var(--lp-warn-ink); }

/* --- record changes beyond normal fluctuation ------------------------------------------------ */
.lp-changes { margin-bottom: 16px; scroll-margin-top: 24px; }
.lp-change-group + .lp-change-group { margin-top: 18px; }
.lp-change-list { list-style: none; margin: 6px 0 0; padding: 0; }
.lp-change { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 6px 28px; align-items: center; padding: 12px 0; border-top: .5px solid var(--lp-line-2); }
.lp-change:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-change { grid-template-columns: minmax(0, 1fr); } }
.lp-change-main { min-width: 0; }
.lp-change-text { margin: 2px 0 0; color: var(--lp-ink-2); font-variant-numeric: tabular-nums; }
.lp-change-advice { display: flex; gap: 6px; align-items: flex-start; width: fit-content; max-width: 100%; margin: 10px 0 0; padding: 6px 12px; border-radius: 10px; font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-change-advice .lp-icon { margin-top: 3px; flex: none; }
.lp-change-warn { background: var(--lp-warn-wash); }
.lp-change-warn .lp-icon { color: var(--lp-warn-ink); }
.lp-change-good { background: var(--lp-good-wash); }
.lp-change-good .lp-icon { color: var(--lp-good-ink); }
.lp-change-neutral { background: var(--lp-well); }
.lp-change-neutral .lp-icon { color: var(--lp-ink-3); }
.lp-change-notes { margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--lp-line-2); display: grid; gap: 4px; }
.lp-change-notes p { margin: 0; }
.lp-change-source a { color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-change-source a:hover { text-decoration: underline; }
.lp-change-spark { min-width: 0; }

/* --- first-run steps -------------------------------------------------------------------------- */
.lp-step-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.lp-step-body > .lp-form-actions { margin-top: 0; }
.lp-consent { display: grid; gap: 12px; }
.lp-consent-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-consent-row p { margin: 0; color: var(--lp-ink); line-height: 24px; }
.lp-consent-icon { width: 28px; height: 28px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-first { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-first-cell { padding: 14px 16px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-first-cell .lp-blocker { margin-top: 2px; font-size: 13px; line-height: 20px; }
.lp-first-wait { margin-top: 6px; font-size: 18px; line-height: 26px; font-weight: 500; }
.lp-first-figure { font-size: 32px; line-height: 40px; font-weight: 500; margin-top: 2px; font-variant-numeric: tabular-nums; }
.lp-first-figure .lp-bignum-unit { margin-left: 4px; font-size: 14px; }
.lp-first-caveat { margin: 6px 0 0; color: var(--lp-warn-ink); }

/* --- plan ---------------------------------------------------------------------------------- */
.lp-tiles { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@container lp-root (max-width: 860px) { .lp-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } .lp-tile-today { grid-column: 1 / -1; } }
@container lp-root (max-width: 520px) { .lp-tiles { grid-template-columns: 1fr; } }
.lp-tile { display: flex; flex-direction: column; }
.lp-tile > .lp-fine { margin-top: auto; padding-top: 12px; }
.lp-tile-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.lp-tile-row { display: flex; align-items: center; gap: 14px; }
.lp-tile-figure { font-size: 24px; line-height: 32px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-today-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.lp-today-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0; min-height: 36px; }
.lp-today-title { font-weight: 500; }
.lp-today-done .lp-today-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-done-label { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px; background: var(--lp-good-wash); color: var(--lp-good-ink); font-size: 12px; font-weight: 500; white-space: nowrap; }
.lp-pop { animation: lp-pop .35s ease; }
.lp-streak { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 13px; font-weight: 500; }
.lp-streak .lp-icon { color: var(--lp-warn); }
.lp-streak-empty { margin-top: 14px; }
.lp-ring { flex: none; }
.lp-ring-track { fill: none; stroke: var(--lp-accent-soft); }
.lp-ring-fill { fill: none; stroke: var(--lp-accent); stroke-linecap: round; transition: stroke-dasharray .8s ease; }
.lp-plan-start { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 28px; align-items: center; }
@container lp-root (max-width: 720px) { .lp-plan-start { grid-template-columns: 1fr; gap: 16px; } }
.lp-plan-start .lp-h3 { margin-top: 0; font-size: 18px; line-height: 26px; }
.lp-plan-start .lp-muted { margin-top: 6px; }
.lp-prompts { display: grid; gap: 8px; }
.lp-prompt {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px;
  text-align: left; cursor: pointer; transition: background-color .15s ease;
}
.lp-prompt:hover { background: var(--lp-hover); }
.lp-prompt .lp-icon { color: var(--lp-ink-3); }
.lp-wins { margin-top: 16px; }
.lp-wins-empty { display: flex; gap: 12px; align-items: flex-start; }
.lp-win { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: .5px solid var(--lp-line-2); animation: lp-rise .45s ease both; }
.lp-win:first-of-type { border-top: 0; padding-top: 0; }
.lp-win-icon { width: 30px; height: 30px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-win-icon-quiet { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-timeline-card { margin-top: 16px; }
.lp-grid-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
.lp-item { display: flex; flex-direction: column; gap: 12px; }
.lp-item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.lp-cat { display: inline-block; padding: 0 8px; border-radius: 6px; background: var(--lp-hover); color: var(--lp-ink-2); font-size: 11px; line-height: 18px; }
.lp-item-adherence { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 12px 0; border-top: .5px solid var(--lp-line-2); border-bottom: .5px solid var(--lp-line-2); }
.lp-item-figure { font-size: 20px; line-height: 28px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-verdict-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.lp-reason { margin: 6px 0 0; color: var(--lp-ink-2); font-size: 13px; line-height: 20px; }
.lp-expected summary { margin-top: 6px; font-size: 12px; color: var(--lp-ink-3); cursor: pointer; width: fit-content; }
.lp-item-foot { margin-top: auto; padding-top: 4px; }
.lp-chip-v { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px 0 7px; border-radius: 12px; font-size: 12px; font-weight: 500; color: var(--lp-ink); white-space: nowrap; }
.lp-v-good { background: var(--lp-good-wash); }
.lp-v-good .lp-icon { color: var(--lp-good-ink); }
.lp-v-within { background: var(--lp-hover); }
.lp-v-within .lp-icon { color: var(--lp-ink-3); }
.lp-v-worse { background: var(--lp-warn-wash); }
.lp-v-worse .lp-icon { color: var(--lp-warn-ink); }
.lp-v-unknown { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-v-unknown .lp-icon { color: var(--lp-ink-3); }
.lp-grid-charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.lp-figure { margin: 0; }
.lp-figure-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.lp-grid-goals { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.lp-model-figures { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.lp-model-note { background: var(--lp-well); box-shadow: none; }
.lp-steps { list-style: none; margin: 0; padding: 6px 22px; }
.lp-step { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: .5px solid var(--lp-line-2); }
.lp-step:first-child { border-top: 0; }
.lp-step-icon { width: 28px; height: 28px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-step-worse .lp-step-icon { background: var(--lp-warn-wash); color: var(--lp-warn-ink); }
.lp-step-retest .lp-step-icon { background: var(--lp-accent-wash); color: var(--lp-accent); }
.lp-search { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.lp-search > button { flex: none; white-space: nowrap; }
.lp-run { margin-top: 12px; }

/* --- plan draft ---------------------------------------------------------------------------- */
.lp-draft { display: grid; gap: 4px; margin-bottom: 16px; }
.lp-draft-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.lp-draft-head .lp-kicker { margin-bottom: 2px; }
.lp-draft-title { margin-top: 0; font-size: 18px; line-height: 26px; }
.lp-draft-head .lp-muted { margin-top: 4px; }
.lp-draft-block .lp-subhead { margin-top: 20px; }
.lp-priorities { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.lp-priority { padding: 10px 12px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-priority-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.lp-draft-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.lp-draft-item { padding: 14px 16px; border-radius: 14px; box-shadow: inset 0 0 0 .5px var(--lp-line-3); display: grid; gap: 6px; min-width: 0; }
.lp-draft-item-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.lp-draft-item-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; font-size: 15px; }
.lp-draft-remove {
  flex: none; display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px;
  border: 0; background: transparent; color: var(--lp-ink-3); font-size: 12px; cursor: pointer; transition: background-color .15s ease, color .15s ease;
}
.lp-draft-remove:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-draft-detail { margin: 0; color: var(--lp-ink); }
.lp-draft-target { margin: 0; display: flex; align-items: center; gap: 4px; }
.lp-evidence { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 12px; line-height: 18px; color: var(--lp-ink-2); }
.lp-evidence .lp-icon { margin-top: 2px; color: var(--lp-ink-3); }
.lp-evidence a { display: inline-block; max-width: 100%; color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-evidence a:hover { text-decoration: underline; }
.lp-draft-warn { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 8px 10px; border-radius: 10px; background: var(--lp-warn-wash); }
.lp-warn-tag { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--lp-warn-wash); color: var(--lp-warn-ink); font-size: 12px; font-weight: 500; white-space: nowrap; }
.lp-draft-warn .lp-warn-tag { background: var(--lp-layer); box-shadow: inset 0 0 0 .5px var(--lp-warn); }
.lp-warn-text { font-size: 12px; line-height: 18px; color: var(--lp-ink); }
.lp-warn-icon { color: var(--lp-warn-ink); }
.lp-draft-removed { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.lp-draft-removed .lp-toggle { height: 28px; font-size: 12px; color: var(--lp-ink-2); }
.lp-draft-goals .lp-row { padding: 8px 0; }
.lp-draft-actions { margin-top: 20px; gap: 14px; }
.lp-draft-hint { display: inline-flex; align-items: baseline; gap: 2px; flex-wrap: wrap; }
.lp-draft-hint .lp-row-link { font-size: 12px; }
.lp-confirm-dialog.lp-confirm-dialog, div:has(> .lp-confirm.lp-confirm) { width: min(520px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-confirm { padding: 24px 28px 24px; display: grid; gap: 12px; max-height: calc(100vh - 48px); overflow-y: auto; }
.lp-confirm-lead { margin: 0; }
.lp-confirm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lp-confirm-list li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); }
.lp-confirm-list .lp-warn-tag { margin-left: auto; }
.lp-confirm-doctor { font-size: 13px; line-height: 20px; }
.lp-confirm .lp-modal-actions { margin-top: 8px; }

/* --- follow-up ------------------------------------------------------------------------------ */
.lp-followup { display: grid; gap: 4px; }
.lp-followup-head { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: .5px solid var(--lp-line-2); }
.lp-followup-grid { margin-top: 16px; gap: 20px 32px; }
.lp-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 14px; align-content: start; }
.lp-fieldset > legend { padding: 0; margin-bottom: 12px; }
.lp-followup-times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.lp-input-time { width: 128px; flex: none; font-variant-numeric: tabular-nums; }
.lp-select-wide { min-width: 132px; padding: 0 10px; }
.lp-followup-detail { display: grid; gap: 6px; margin-top: 20px; padding-top: 16px; border-top: .5px solid var(--lp-line-2); }
.lp-followup-detail .lp-caption { margin: 0; }
.lp-followup .lp-form-actions { margin-top: 16px; }
.lp-followup-log .lp-subhead { margin-top: 20px; }
.lp-followup-log .lp-row-main .lp-num { color: var(--lp-ink-2); }
.lp-sent { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 12px; white-space: nowrap; }
.lp-sent-ok { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-sent-bad { background: var(--lp-warn-wash); color: var(--lp-warn-ink); }
.lp-test-result { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.lp-check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; line-height: 22px; width: fit-content; }
.lp-check input { width: 16px; height: 16px; margin: 0; accent-color: var(--lp-brand); cursor: pointer; }
.lp-check-off { cursor: default; color: var(--lp-ink-3); }
.lp-check-off input { cursor: default; }
.lp-switch { display: inline-flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--lp-ink); font-size: 15px; font-weight: 500; line-height: 22px; cursor: pointer; }
.lp-switch:disabled { cursor: progress; }
.lp-switch-track { position: relative; width: 36px; height: 20px; flex: none; border-radius: 10px; background: var(--lp-line-3); transition: background-color .2s ease; }
.lp-switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .2s ease; }
.lp-switch-on .lp-switch-track { background: var(--lp-good); }
.lp-switch-on .lp-switch-thumb { transform: translateX(16px); }

/* --- charts ---------------------------------------------------------------------------------- */
.lp-chart { position: relative; width: 100%; }
.lp-chart svg { display: block; overflow: visible; }
.lp-chart svg:focus { outline: none; }
.lp-chart svg:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 4px; border-radius: 6px; }
.lp-chart-empty { color: var(--lp-ink-3); font-size: 13px; padding: 24px 0; }
.lp-grid { stroke: var(--lp-line-1); stroke-width: 1; }
.lp-axis { fill: var(--lp-ink-3); font-size: 11px; }
.lp-line { fill: none; stroke: var(--lp-accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.lp-area { fill: var(--lp-accent-wash); stroke: none; }
.lp-dot { fill: var(--lp-accent); stroke: var(--lp-layer); stroke-width: 2; transition: r .15s ease; }
.lp-band { fill: var(--lp-band); }
.lp-goal { stroke: var(--lp-ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
.lp-goal-text { fill: var(--lp-ink-2); font-size: 11px; }
.lp-ref { stroke: var(--lp-line-3); stroke-width: 1; }
.lp-cross { stroke: var(--lp-line-3); stroke-width: 1; }
.lp-end { fill: var(--lp-ink); font-size: 12px; font-weight: 500; }
.lp-bar { fill: var(--lp-accent); }
.lp-bar-muted { fill: var(--lp-line-3); }
.lp-hit { fill: transparent; }
.lp-row-label { fill: var(--lp-ink); font-size: 12.5px; }
.lp-checkup { stroke: var(--lp-line-2); stroke-width: 1; }
.lp-checkup-dot { fill: var(--lp-ink-3); stroke: var(--lp-layer); stroke-width: 2; }
.lp-today { stroke: var(--lp-accent); stroke-width: 1; opacity: .55; }
.lp-legend-inline { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--lp-ink-3); }
.lp-key-bar { width: 16px; height: 6px; border-radius: 3px; background: var(--lp-accent); display: inline-block; }
.lp-key-dot { width: 7px; height: 7px; margin-left: 10px; border-radius: 50%; background: var(--lp-ink-3); display: inline-block; }
.lp-tip { position: absolute; z-index: 5; min-width: 120px; max-width: 220px; padding: 8px 10px; border-radius: 10px; background: var(--lp-layer-2); box-shadow: var(--lp-lift); font-size: 12px; line-height: 18px; pointer-events: none; transform: translateY(-100%); }
.lp-tip-title { color: var(--lp-ink-3); margin-bottom: 2px; }
.lp-tip-row { display: flex; flex-direction: column; }
.lp-tip-value { color: var(--lp-ink); font-weight: 500; font-size: 13px; }
.lp-tip-label { color: var(--lp-ink-2); }
.lp-strip { position: relative; flex: none; }
.lp-cell-done { fill: var(--lp-accent); }
.lp-cell-missed { fill: var(--lp-line-3); }
.lp-cell-unknown { fill: var(--lp-line-1); }
.lp-twin { margin-top: 10px; font-size: 12px; }
.lp-twin summary { color: var(--lp-ink-3); cursor: pointer; width: fit-content; }
.lp-twin table { width: 100%; margin-top: 8px; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.lp-twin caption { text-align: left; color: var(--lp-ink-3); padding-bottom: 4px; }
.lp-twin th, .lp-twin td { text-align: left; padding: 4px 8px 4px 0; border-bottom: .5px solid var(--lp-line-2); }
.lp-twin th { color: var(--lp-ink-2); font-weight: 500; }

/* --- home greeting (in DSH's 34 px logo seat, in place of the headline) ------------------------ */
/* While the greeting shows, DSH's own title group ("探索未至之境" + Preview) is hidden. Structural on
   purpose: DSH's class names are hashed. The slot renders in a span beside the title span, wrapped in
   DSH's display:contents slot anchor, hence a descendant (not child) match. If DSH's markup changes and
   this stops matching, the greeting simply sits above DSH's title. */
div:has(> span .lp-hero) > span:not(:has(.lp-hero)) { display: none !important; }
.lp-hero {
  width: min(620px, calc(100vw - 48px)); max-width: 100%; margin: 0 auto;
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 6px;
  text-align: center; white-space: normal; letter-spacing: 0;
  animation: lp-fade .35s ease both;
}
.lp-hero-title {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px; max-width: 100%;
  font-size: 26px; line-height: 32px; font-weight: 500; color: var(--lp-ink);
}
.lp-hero-title > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.lp-hero-mark {
  width: 26px; height: 26px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(145deg, #3b82f6, #22c55e); color: #fff;
}
.lp-hero-status { margin: 0; max-width: 100%; font-size: 15px; line-height: 22px; font-weight: 400; color: var(--lp-ink-2); text-wrap: balance; }
.lp-hero-status b { color: var(--lp-ink); font-weight: 500; }
.lp-hero-sep, .lp-row-sep { color: var(--lp-ink-3); margin: 0 8px; }
.lp-row-sep { margin: 0 2px; }
.lp-hero-link, .lp-row-link {
  display: inline; padding: 0; border: 0; background: transparent; color: var(--lp-accent);
  font: inherit; cursor: pointer; white-space: nowrap; border-radius: 4px;
}
.lp-hero-link:hover, .lp-row-link:hover { text-decoration: underline; text-underline-offset: 3px; }

/* The second line: record changes a doctor should see. Quiet, but in the warning ink. */
.lp-hero-changes { margin: -2px 0 0; max-width: 100%; font-size: 13px; line-height: 20px; font-weight: 400; color: var(--lp-warn-ink); text-wrap: balance; }
.lp-hero-changes-icon { margin-right: 4px; vertical-align: -2px; }
.lp-hero-changes .lp-hero-sep { margin: 0 6px; }
.lp-hero-row { width: 100%; margin-top: 4px; }

/* --- the row under the composer (portalled in after conversation.composer.bar, only with the greeting) --- */
/* The host is the last child of DSH's hero composer stack; home.ts sets its top margin so the row sits
   12 px under the card whatever the stack's gap. Empty (no row for this stage), it takes no room. */
.lp-home-host {
  display: flex; flex-wrap: wrap; justify-content: center; width: 100%; min-width: 0;
  padding: 0 var(--dsh-composer-side-clearance, 16px);
}
.lp-home-host:empty { display: none; }
.lp-home-row {
  width: 100%; max-width: var(--dsh-composer-card-max-width, 744px); margin: 0 auto; padding: 0 8px;
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px 6px;
  font-size: 13px; line-height: 20px; color: var(--lp-ink-2); animation: lp-fade .35s ease both;
}
.lp-suggest {
  height: 32px; max-width: 100%; padding: 0 12px; border-radius: 16px; border: 1px solid var(--lp-line-2);
  background: var(--lp-bg); color: var(--lp-ink-2); font-size: 13px; line-height: 20px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background-color .15s ease, color .15s ease;
}
.lp-suggest:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-task {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 9px; border-radius: 15px;
  border: 1px solid var(--lp-line-1); background: var(--lp-hover); color: var(--lp-ink-2); font-size: 13px; line-height: 20px;
  cursor: pointer; white-space: nowrap; transition: background-color .15s ease;
}
.lp-task:hover:not(.lp-task-done) { background: var(--lp-press); color: var(--lp-ink); }
.lp-task:disabled { cursor: progress; }
.lp-task-done { cursor: default; }
.lp-task-ring {
  width: 14px; height: 14px; flex: none; border-radius: 50%; border: 1.5px solid var(--lp-ink-3);
  display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: background-color .2s ease, border-color .2s ease;
}
.lp-task-done .lp-task-ring { border-color: var(--lp-good); background: var(--lp-good); animation: lp-pop .35s ease; }
.lp-row-note { flex-basis: 100%; text-align: center; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-mark { display: inline-flex; }

/* --- reminder pill (shell overlay: click-through layer) ---------------------------------------- */
/* Bottom-right, but lifted clear of a chat's composer so it never covers the send button. */
.lp-pill-wrap {
  position: absolute; right: 20px; bottom: 136px; z-index: 1; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 2px; padding: 4px; border-radius: 20px;
  background: var(--lp-layer-2); box-shadow: var(--lp-lift); animation: lp-rise .4s ease both;
}
.lp-pill-main { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 4px; border: 0; border-radius: 16px; background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer; }
.lp-pill-main:hover { background: var(--lp-hover); }
.lp-pill-mark { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-brand); color: var(--lp-on-brand); }
.lp-pill-count { font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-pill-x { width: 28px; height: 28px; border: 0; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--lp-ink-3); cursor: pointer; }
.lp-pill-x:hover { background: var(--lp-hover); color: var(--lp-ink); }

/* --- onboarding (inside DSH's Modal card) ------------------------------------------------------ */
/* The Modal card is sized by className, and by what it directly holds in case the host ignores className. */
.lp-onb-dialog.lp-onb-dialog, div:has(> .lp-onb.lp-onb) { width: min(600px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-onb { display: flex; flex-direction: column; max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px 28px 28px; }
@media (max-width: 560px) { .lp-onb { padding: 20px; } }
.lp-onb-progress { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.lp-dots { list-style: none; display: flex; gap: 6px; margin: 0; padding: 0; }
.lp-dot-step { width: 6px; height: 6px; border-radius: 3px; background: var(--lp-line-3); transition: width .25s ease, background-color .25s ease; }
.lp-dot-now { width: 20px; background: var(--lp-brand); }
.lp-dot-past { background: var(--lp-ink-3); }
.lp-onb-title { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; outline: none; }
.lp-onb-body { margin-top: 18px; }
.lp-onb-lead { margin: 0 0 18px; color: var(--lp-ink-2); }
.lp-onb-computing { display: grid; gap: 10px; }
.lp-onb .lp-profile { gap: 16px; }

/* --- 5.1: tabs, banner, ⓘ, load errors ------------------------------------------------------ */
.lp-banner {
  display: flex; align-items: center; gap: 8px; width: 100%; margin: -12px 0 18px; padding: 10px 14px; border-radius: 12px;
  border: 0; background: var(--lp-accent-wash); color: var(--lp-ink); font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-banner .lp-icon { color: var(--lp-accent); }
.lp-banner:hover { background: var(--lp-accent-soft); }
.lp-banner-go { margin-left: auto; color: var(--lp-accent); white-space: nowrap; }
.lp-tabs { display: flex; gap: 4px; margin: 0 0 20px; border-bottom: .5px solid var(--lp-line-2); overflow-x: auto; scrollbar-width: none; }
.lp-tab {
  position: relative; display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border: 0; background: transparent;
  color: var(--lp-ink-2); font-size: 14px; line-height: 22px; cursor: pointer; white-space: nowrap; border-radius: 8px 8px 0 0;
}
.lp-tab:hover { color: var(--lp-ink); background: var(--lp-hover); }
.lp-tab-on { color: var(--lp-ink); font-weight: 500; }
.lp-tab-on::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -.5px; height: 2px; border-radius: 1px; background: var(--lp-brand); }
.lp-tab-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--lp-hover); font-size: 11px; line-height: 18px; text-align: center; }
.lp-tab-body { display: grid; gap: 16px; }
.lp-tab-body > .lp-section { margin-top: 28px; }
.lp-tab-body > .lp-section:first-child { margin-top: 0; }
.lp-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.lp-card-head .lp-label { margin: 0; }
.lp-info-wrap { position: relative; display: inline-flex; vertical-align: middle; }
.lp-info-btn {
  width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--lp-ink-3); cursor: pointer;
}
.lp-info-btn:hover, .lp-info-btn[aria-expanded="true"] { color: var(--lp-ink); background: var(--lp-hover); }
.lp-info-pop {
  position: absolute; top: calc(100% + 6px); z-index: 20; width: min(300px, 80vw); padding: 10px 12px; border-radius: 12px;
  background: var(--lp-layer-2); box-shadow: var(--lp-lift); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400;
  text-align: left; white-space: normal; display: grid; gap: 6px; animation: lp-fade .15s ease both;
}
.lp-info-start { left: -8px; }
.lp-info-end { right: -8px; }
.lp-info-line { display: block; }
.lp-loaderror { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--lp-ink); }
.lp-loaderror > .lp-icon { color: var(--lp-warn-ink); }
.lp-loaderror-text { flex: 1; min-width: 200px; }
.lp-loaderror-compact { margin-top: 12px; padding: 8px 10px; border-radius: 10px; background: var(--lp-warn-wash); font-size: 13px; line-height: 20px; }
.lp-empty { display: flex; gap: 14px; align-items: flex-start; }
.lp-empty > .lp-icon { margin-top: 3px; color: var(--lp-ink-3); }
.lp-empty .lp-muted { margin: 4px 0 12px; }
.lp-partial { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 20px; }
.lp-partial .lp-icon { margin-top: 3px; color: var(--lp-warn-ink); }
.lp-statusdot-warn { background: var(--lp-warn); box-shadow: 0 0 0 3px var(--lp-warn-wash); }
.lp-more > summary, .lp-basis > summary, .lp-draft-more > summary, .lp-evidence-more > summary, .lp-tool-report > summary {
  cursor: pointer; width: fit-content; color: var(--lp-ink-2); font-size: 13px; line-height: 20px;
}
.lp-more > summary .lp-optional { margin-left: 8px; }

/* --- 5.1: check-ins with three answers ---------------------------------------------------------- */
.lp-choices { display: inline-flex; align-items: center; gap: 6px; flex: none; }
.lp-choice {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 12px; line-height: 18px; cursor: pointer; white-space: nowrap;
}
.lp-choice:hover:not(:disabled) { background: var(--lp-hover); }
.lp-choice:disabled { cursor: progress; opacity: .6; }
.lp-choice-done { background: var(--lp-brand); color: var(--lp-on-brand); border-color: transparent; }
.lp-choice-done:hover:not(:disabled) { background: var(--lp-brand); opacity: .88; }
.lp-choice-undo { border-color: transparent; color: var(--lp-ink-3); }
.lp-choice-undo:hover:not(:disabled) { color: var(--lp-ink); }
.lp-choice-state { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 13px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.lp-choice-state-done { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-choice-state-missed { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-today-missed .lp-today-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-item-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

/* --- 5.1: 概览 ------------------------------------------------------------------------------ */
.lp-today-card .lp-today-row { border-top: .5px solid var(--lp-line-2); padding: 6px 0; }
.lp-today-card .lp-today-row:first-child { border-top: 0; }
.lp-week { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--lp-line-2); }
.lp-week-cells { list-style: none; display: inline-flex; gap: 3px; margin: 0; padding: 0; }
.lp-week-cell { width: 20px; height: 20px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-line-1); box-shadow: inset 0 0 0 .5px var(--lp-line-2); }
.lp-week-day { font-size: 10px; line-height: 12px; color: var(--lp-ink-3); }
.lp-week-done { background: var(--lp-accent); box-shadow: none; }
.lp-week-done .lp-week-day { color: #fff; }
.lp-week-part { background: var(--lp-accent-soft); box-shadow: none; }
.lp-week-missed { background: var(--lp-line-3); box-shadow: none; }
.lp-overview .lp-results .lp-card { padding: 18px 20px; }
.lp-overview .lp-bignum { font-size: 40px; line-height: 48px; }
.lp-overview .lp-result-figure { margin-bottom: 6px; }
.lp-overview .lp-result-figure .lp-pill { align-self: center; margin-left: 4px; }
.lp-overview .lp-result .lp-chart { margin: 4px 0 6px; }
.lp-overview .lp-result-goal { margin: 4px 0 8px; }
.lp-result > .lp-caption:last-child { margin-top: auto; padding-top: 8px; }
.lp-result-head .lp-label { align-items: center; gap: 4px; }
.lp-next-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.lp-next-text { min-width: 0; flex: 1; }
.lp-next-text .lp-label { margin-bottom: 4px; }
.lp-next-text .lp-muted { margin-top: 2px; }
.lp-notable { scroll-margin-top: 24px; }
.lp-notable-list { list-style: none; margin: 8px 0 0; padding: 0; }
.lp-notable-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 140px; align-items: center; gap: 12px; padding: 8px 0; border-top: .5px solid var(--lp-line-2); }
.lp-notable-row:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-notable-row { grid-template-columns: auto minmax(0, 1fr) auto; } .lp-notable-row .lp-change-spark { display: none; } }
.lp-notable-values { white-space: nowrap; }
.lp-basis { margin-top: 12px; }
.lp-basis .lp-change-notes { margin-top: 8px; }
.lp-chip-c { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px 0 6px; border-radius: 11px; font-size: 12px; font-weight: 500; color: var(--lp-ink); white-space: nowrap; }
.lp-chip-c-good { background: var(--lp-good-wash); }
.lp-chip-c-good .lp-icon { color: var(--lp-good-ink); }
.lp-chip-c-warn { background: var(--lp-warn-wash); }
.lp-chip-c-warn .lp-icon { color: var(--lp-warn-ink); }
.lp-chip-c-neutral, .lp-chip-c-within { background: var(--lp-hover); }
.lp-chip-c-neutral .lp-icon, .lp-chip-c-within .lp-icon { color: var(--lp-ink-3); }
.lp-chip-c-unjudged { background: transparent; color: var(--lp-ink-3); font-weight: 400; box-shadow: inset 0 0 0 .5px var(--lp-line-3); padding: 0 8px; }

/* --- 5.1: 指标 ------------------------------------------------------------------------------ */
.lp-ind-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-ind-toolbar > .lp-caption { display: inline-flex; align-items: center; gap: 6px; }
.lp-ind-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.lp-ind-filters .lp-toggle { height: 30px; padding: 0 12px; }
.lp-toggle-count { font-size: 11px; color: inherit; opacity: .65; font-variant-numeric: tabular-nums; }
.lp-ind-card { padding: 8px 22px 12px; }
.lp-ind-head, .lp-ind-btn { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) 96px 120px 44px 16px; align-items: center; gap: 12px; }
.lp-ind-head { padding: 8px 0; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); border-bottom: .5px solid var(--lp-line-2); }
.lp-ind-head > span:last-child { grid-column: 5 / 7; }
@container lp-root (max-width: 700px) {
  .lp-ind-head { display: none; }
  .lp-ind-btn { grid-template-columns: minmax(0, 1fr) auto 16px; row-gap: 4px; }
  .lp-ind-spark, .lp-ind-source { display: none; }
  .lp-ind-value { grid-column: 1; grid-row: 2; }
  .lp-ind-judged { grid-column: 2; grid-row: 1 / 3; }
  .lp-ind-chevron { grid-column: 3; grid-row: 1 / 3; }
}
.lp-ind-group-title { display: flex; align-items: baseline; gap: 8px; margin: 18px 0 2px; font-size: 13px; line-height: 20px; font-weight: 500; color: var(--lp-ink-2); }
.lp-ind-list { list-style: none; margin: 0; padding: 0; }
.lp-ind-row { border-top: .5px solid var(--lp-line-1); }
.lp-ind-row:first-child { border-top: 0; }
.lp-ind-btn { width: 100%; min-height: 44px; padding: 6px 8px; margin: 0 -8px; width: calc(100% + 16px); border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.lp-ind-btn:hover, .lp-ind-open .lp-ind-btn { background: var(--lp-hover); }
.lp-ind-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.lp-ind-name .lp-strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-tag-plan { height: 18px; padding: 0 6px; background: var(--lp-accent-wash); color: var(--lp-accent); }
.lp-ind-value { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lp-ind-value .lp-num { color: var(--lp-ink); font-weight: 500; }
.lp-ind-date { margin-left: 8px; }
.lp-ind-error { display: inline-flex; align-items: center; gap: 4px; min-width: 0; grid-column: 2 / 4; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-ind-failed .lp-ind-spark { display: none; }
.lp-ind-source { text-align: left; }
.lp-ind-chevron { color: var(--lp-ink-3); transition: transform .15s ease; }
.lp-ind-open .lp-ind-chevron { transform: rotate(90deg); }
.lp-spark { display: block; overflow: visible; }
.lp-spark-line { fill: none; stroke: var(--lp-accent); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.lp-spark-dot { fill: var(--lp-accent); }
.lp-spark-none { font-size: 11px; color: var(--lp-ink-4); }
.lp-ind-panel { padding: 8px 0 16px; }
.lp-ind-detail { display: grid; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-ind-detail p { margin: 0; }
.lp-ind-detail a { color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-ind-table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.lp-ind-table th, .lp-ind-table td { text-align: left; padding: 4px 8px 4px 0; border-bottom: .5px solid var(--lp-line-2); }
.lp-ind-table th { color: var(--lp-ink-2); font-weight: 500; }
.lp-ind-skeleton { margin: 10px 0; }

/* --- 5.1: data connection ------------------------------------------------------------------- */
.lp-conn { display: grid; gap: 12px; }
.lp-conn-status { display: grid; gap: 4px; }
.lp-conn-url code { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 12px; overflow-wrap: anywhere; }
.lp-conn-form { display: grid; gap: 12px; }
.lp-conn-form .lp-form-actions { margin-top: 0; }
.lp-conn-form .lp-fine { margin-top: 0; }
.lp-conn-ok { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--lp-good-ink); font-size: 13px; line-height: 20px; }

/* --- 5.1: onboarding steps 1, 3, 4 ------------------------------------------------------------ */
.lp-onb-hint { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 10px 12px; border-radius: 12px; background: var(--lp-warn-wash); font-size: 13px; line-height: 20px; }
.lp-onb-hint > .lp-icon { color: var(--lp-warn-ink); }
.lp-onb-hint > span { flex: 1; min-width: 180px; }
.lp-found { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.lp-found-tile { display: grid; gap: 2px; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-found-figure { font-size: 26px; line-height: 34px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-found-figure .lp-bignum-unit { margin-left: 3px; font-size: 13px; }
.lp-found-changes { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-found-changes .lp-icon { margin-top: 3px; color: var(--lp-ink-3); }
.lp-found-changes-warn { background: var(--lp-warn-wash); }
.lp-found-changes-warn .lp-icon { color: var(--lp-warn-ink); }
.lp-now-block .lp-subhead { margin-top: 4px; }
.lp-nows { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-now { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-now-icon { width: 30px; height: 30px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-layer); color: var(--lp-ink-2); box-shadow: 0 0 0 .5px var(--lp-line-3); }
.lp-now-text { flex: 1; min-width: 180px; display: grid; gap: 2px; }
.lp-now-text .lp-inline-self { margin-top: 6px; }

/* --- 5.1: plan draft, confirm, reminders -------------------------------------------------------- */
.lp-draft-more { margin-top: 14px; }
.lp-draft-more .lp-priorities, .lp-draft-more .lp-rows { margin-top: 8px; }
.lp-evidence-more > summary { font-size: 12px; color: var(--lp-ink-3); }
.lp-evidence-more .lp-caption { margin: 4px 0 0; }
.lp-evidence-more a { color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-draft-item-compact { padding: 10px 12px; gap: 4px; }
.lp-draft-item-compact .lp-draft-item-title { font-size: 14px; }
.lp-confirm-remind { margin-top: 4px; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); width: 100%; }
.lp-followup-panel { display: grid; gap: 12px; }
.lp-remind { display: grid; gap: 6px; }
.lp-remind .lp-caption { margin: 0; }
.lp-remind-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-more .lp-followup { margin-top: 12px; }

/* --- 5.1: settings page (inside DSH's settings panel) --------------------------------------------- */
.lp-settings { container: lp-root / inline-size; display: grid; gap: 4px; padding-bottom: 24px; }
.lp-set-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.lp-set-block { padding: 18px 0; border-top: .5px solid var(--lp-line-2); }
.lp-set-head + .lp-set-block, .lp-notice-slot + .lp-set-block { border-top: 0; }
.lp-set-title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 12px; font-size: 15px; line-height: 22px; font-weight: 500; }
.lp-set-block .lp-more > summary .lp-set-title { display: inline-flex; margin: 0; }
.lp-privacy { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 12px; }
.lp-privacy-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-privacy-row .lp-muted { margin: 2px 0 0; font-size: 13px; line-height: 20px; }
.lp-methods { display: grid; gap: 4px; margin-top: 12px; }
.lp-methods .lp-card { padding: 16px 18px; }

/* --- 5.1: home check-in pills with a popover ------------------------------------------------------ */
.lp-task-wrap { position: relative; display: inline-flex; }
.lp-task-missed .lp-task-ring { border-color: var(--lp-ink-3); background: var(--lp-ink-3); }
.lp-task-done, .lp-task-missed { cursor: pointer; }
.lp-task-menu {
  position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 30; display: flex; gap: 2px; padding: 4px;
  border-radius: 14px; background: var(--lp-layer-2); box-shadow: var(--lp-lift); animation: lp-fade .12s ease both;
}
.lp-task-choice { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: var(--lp-ink); font-size: 13px; cursor: pointer; white-space: nowrap; }
.lp-task-choice:hover:not(:disabled) { background: var(--lp-hover); }
.lp-task-choice:disabled { color: var(--lp-ink-4); cursor: default; }
.lp-task-undo { color: var(--lp-ink-2); }

/* --- 5.1: chat cards (tool.call.toolview) ------------------------------------------------------ */
.lp-tool { container: lp-root / inline-size; font-size: 13px; line-height: 20px; margin: 2px 0; }
.lp-tool-card { border-radius: 14px; padding: 10px 14px 12px; box-shadow: inset 0 0 0 .5px var(--lp-line-3); background: var(--lp-layer); max-width: 680px; }
.lp-tool-quiet { padding: 0; }
.lp-tool-error.lp-tool-card { box-shadow: inset 0 0 0 .5px var(--lp-warn); }
.lp-tool-head { display: flex; align-items: center; gap: 6px; min-height: 24px; min-width: 0; flex-wrap: wrap; }
.lp-tool-icon { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); flex: none; }
.lp-tool-title { color: var(--lp-ink-2); font-weight: 500; white-space: nowrap; }
.lp-tool-quiet .lp-tool-title { font-weight: 400; }
.lp-tool-summary { color: var(--lp-ink-3); min-width: 0; }
.lp-tool-summary::before { content: "·"; margin: 0 6px 0 2px; color: var(--lp-ink-4); }
.lp-tool-warn { color: var(--lp-warn-ink); }
.lp-tool-bad { color: var(--lp-bad); }
.lp-tool-raw-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; height: 22px; padding: 0 6px; border: 0; border-radius: 6px; background: transparent; color: var(--lp-ink-3); font-size: 12px; cursor: pointer; }
.lp-tool-raw-btn:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-rot { transform: rotate(90deg); }
.lp-tool-body { display: grid; gap: 8px; margin-top: 8px; }
.lp-tool-quiet .lp-tool-body { margin: 2px 0 0 22px; }
.lp-tool-raw {
  margin: 8px 0 0; max-height: 240px; overflow: auto; padding: 10px 12px; border-radius: 10px; background: var(--lp-well);
  box-shadow: inset 0 0 0 .5px var(--lp-line-2); font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 11.5px; line-height: 17px; color: var(--lp-ink-2); white-space: pre-wrap; word-break: break-word;
}
.lp-chip-saved { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--lp-good-wash); color: var(--lp-good-ink); font-size: 12px; font-weight: 500; white-space: normal; }
.lp-tool-summary .lp-chip-saved::before, .lp-tool-summary:has(.lp-chip-saved)::before { content: none; }
.lp-chip-undone { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-tool-saved { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.lp-tool-draft { display: grid; gap: 8px; }
.lp-tool-draft .lp-draft-block { margin: 0; }
.lp-tool-draft .lp-form-actions { margin-top: 4px; }
.lp-readback { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.lp-readback li { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; padding: 6px 10px; border-radius: 10px; background: var(--lp-well); }
.lp-tool-result { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.lp-tool-figure { font-size: 28px; line-height: 36px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-tool-figure .lp-bignum-unit { margin-left: 3px; font-size: 13px; }
.lp-tool-report pre { margin: 6px 0 0; max-height: 240px; overflow: auto; white-space: pre-wrap; font-size: 12px; line-height: 18px; color: var(--lp-ink-2); }
.lp-tool-doctor { display: flex; gap: 4px; align-items: flex-start; margin: 0; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-tool-doctor .lp-icon { margin-top: 2px; flex: none; }
.lp-tool .lp-caption { margin: 0; }

.lp-spin { animation: lp-spin 1s linear infinite; }
@keyframes lp-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-pulse { 50% { opacity: .45; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .lp-card, .lp-win, .lp-pop, .lp-skeleton, .lp-hero, .lp-home-row, .lp-task-ring, .lp-pill-wrap, .lp-notice, .lp-spin, .lp-info-pop, .lp-task-menu { animation: none; }
  .lp-ring-fill, .lp-body, .lp-dot, .lp-dot-step, .lp-switch-track, .lp-switch-thumb { transition: none; }
}
`

export function injectStyles(): void {
  const id = 'dsh-plugin-longpi-style'
  const existing = document.getElementById(id)
  // A plugin reload brings new CSS; replace the old sheet instead of keeping it.
  if (existing) {
    existing.textContent = CSS
    return
  }
  const style = document.createElement('style')
  style.id = id
  style.textContent = CSS
  document.head.appendChild(style)
}
