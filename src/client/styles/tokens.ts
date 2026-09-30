// Design tokens (docs/design-system.md §1–2). Every color maps to DSH's own --dsw-* tokens (DSH's light values as
// fallbacks), so LongPi follows the host's light and dark themes. The only colors LongPi owns are the chart color
// (--lp-data) and the semantic washes, each with a dark variant under body[data-ds-dark-theme].
// Every LongPi root carries .lp (the modal and overlays render outside the page).

export const TOKENS = `
.lp {
  --lp-bg: var(--dsw-alias-bg-base, #fff);
  --lp-layer: var(--dsw-alias-bg-layer-1, #fff);
  --lp-layer-2: var(--dsw-alias-bg-layer-2, #fff);
  --lp-ink: var(--dsw-alias-label-primary, rgb(15, 17, 21));
  --lp-ink-2: var(--dsw-alias-label-secondary, rgb(97, 102, 107));
  --lp-ink-3: var(--dsw-alias-label-tertiary, rgb(129, 133, 140));
  --lp-ink-4: var(--dsw-alias-label-caption, rgb(173, 178, 184));
  --lp-line: var(--dsw-alias-border-l2, rgba(0, 0, 0, .08));
  --lp-line-strong: var(--dsw-alias-border-l3, rgba(0, 0, 0, .14));
  /* older names, same values */
  --lp-line-1: var(--dsw-alias-border-l1, rgba(0, 0, 0, .04));
  --lp-line-2: var(--lp-line);
  --lp-line-3: var(--lp-line-strong);
  --lp-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, .06));
  --lp-press: var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, .1));
  --lp-well: rgba(38, 49, 72, .04);
  --lp-skeleton: var(--dsw-alias-bg-skeleton, rgba(0, 0, 0, .05));
  --lp-accent: var(--dsw-alias-brand-primary, rgb(15, 17, 21));
  --lp-on-accent: var(--dsw-alias-label-primary-foreground, #fff);
  --lp-brand: var(--lp-accent);
  --lp-on-brand: var(--lp-on-accent);
  --lp-focus: var(--dsw-alias-state-business-primary, rgb(65, 118, 230));
  --lp-data: #2a78d6;
  --lp-data-wash: rgba(42, 120, 214, .10);
  --lp-band: rgba(97, 102, 107, .11);
  --lp-good: var(--dsw-alias-state-success-primary, rgb(34, 197, 94));
  --lp-good-ink: #15803d;
  --lp-good-wash: rgba(34, 197, 94, .11);
  --lp-warn: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11));
  --lp-warn-ink: #b45309;
  --lp-warn-wash: rgba(245, 158, 11, .12);
  --lp-bad: var(--dsw-alias-state-error-primary, rgb(236, 19, 19));
  --lp-bad-ink: #c81e1e;
  --lp-bad-wash: rgba(236, 19, 19, .07);
  --lp-field: var(--lp-layer);
  --lp-shadow-pop: var(--dsw-shadow-lv3, 0 0 1px rgba(0, 0, 0, .2), 0 12px 32px rgba(0, 0, 0, .1));
  --lp-shadow-hover: var(--dsw-shadow-lv2, 0 4px 12px rgba(0, 0, 0, .04), 0 2px 8px rgba(0, 0, 0, .04));
  --lp-radius-card: 12px;
  --lp-radius-ctl: 8px;
  color-scheme: light;
  color: var(--lp-ink);
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
body[data-ds-dark-theme] .lp {
  --lp-well: rgba(255, 255, 255, .05);
  --lp-data: #4b93ea;
  --lp-data-wash: rgba(75, 147, 234, .16);
  --lp-band: rgba(207, 211, 214, .12);
  --lp-good-ink: #4ed17e;
  --lp-good-wash: rgba(34, 197, 94, .16);
  --lp-warn-ink: #f7ad31;
  --lp-warn-wash: rgba(245, 158, 11, .16);
  --lp-bad-ink: #f47272;
  --lp-bad-wash: rgba(242, 90, 90, .14);
  --lp-field: rgba(255, 255, 255, .03);
  color-scheme: dark;
}
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp button, .lp input, .lp select, .lp textarea { font-family: inherit; }
.lp :is(button, a, summary, [tabindex="0"]):focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 2px; }
.lp p { margin: 0; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lp-icon { flex: none; vertical-align: -3px; }

/* type scale (§2) */
.lp-h1 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.01em; }
.lp-h2 { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; }
.lp-h3 { margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; }
.lp-text { font-size: 14px; line-height: 22px; max-width: 40em; }
.lp-muted { color: var(--lp-ink-2); }
.lp-muted-ink { color: var(--lp-ink-3); }
.lp-small { font-size: 13px; line-height: 20px; }
.lp-caption { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); font-weight: 400; }
.lp-fine { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-strong { font-weight: 500; color: var(--lp-ink); }
.lp-num { font-variant-numeric: tabular-nums; }
.lp-num-lg { font-size: 36px; line-height: 44px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.lp-num-md { font-size: 24px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-unit { font-size: 14px; line-height: 20px; font-weight: 400; color: var(--lp-ink-2); }
.lp-good-ink { color: var(--lp-good-ink); }
.lp-warn-ink { color: var(--lp-warn-ink); }
.lp-bad-ink { color: var(--lp-bad-ink); }
`
