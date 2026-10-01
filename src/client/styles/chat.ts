// Chat surfaces: tool cards (toolviews.ts, science/index.ts), the turn's quick actions (turn-tail.ts), the 健康 tab
// in DSH's right column (pane.ts), the evening reminder pill (pill.ts) and the doctor-first card (triage/care-card.ts).
// Same components and scale as the page (docs/design-system.md): buttons are base .lp-linkbtn (primary = accent, the
// DSH brand), saved states are base .lp-badge. Page-specific layout only; base components are never redefined here.

export const CHAT = `
/* --- shared text link ("健康页 →"; other pages use it too) ------------------------------------ */
.lp-row-link {
  display: inline; padding: 0; border: 0; background: transparent; color: var(--lp-ink-2);
  font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap;
}
.lp-row-link:hover { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; }
.lp-mark { display: inline-flex; }

/* --- chat cards (tool.call.toolview) --------------------------------------------------------------- */
.lp-tool { container: lp-root / inline-size; margin: 4px 0; font-size: 13px; line-height: 20px; }
.lp-tool-card { max-width: 680px; padding: 12px 16px; border-radius: var(--lp-radius-card); border: 1px solid var(--lp-line); background: var(--lp-layer); }
.lp-tool-quiet { padding: 0; }
.lp-tool-card.lp-tool-error { border-color: var(--lp-warn); }
.lp-tool-head { display: flex; align-items: center; gap: 8px; min-height: 24px; min-width: 0; flex-wrap: wrap; }
.lp-tool-icon { width: 16px; height: 16px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); }
.lp-tool-title { color: var(--lp-ink); font-weight: 500; white-space: nowrap; }
.lp-tool-quiet .lp-tool-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-tool-summary { min-width: 0; color: var(--lp-ink-3); }
.lp-tool-summary::before { content: "·"; margin-right: 8px; color: var(--lp-ink-4); }
.lp-tool-summary:has(> .lp-badge)::before { content: none; }
.lp-tool-warn { color: var(--lp-warn-ink); }
.lp-tool-bad { color: var(--lp-bad-ink); }
.lp-tool-raw-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border: 0; border-radius: 6px;
  background: transparent; color: var(--lp-ink-3); font-size: 12px; line-height: 18px; cursor: pointer;
}
.lp-tool-raw-btn:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-rot { transform: rotate(90deg); }
.lp-tool-undo {
  height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--lp-ink);
  font-size: 12px; line-height: 18px; font-weight: 500; cursor: pointer;
}
.lp-tool-undo:hover:not(:disabled) { background: var(--lp-hover); }
.lp-tool-undo:disabled { color: var(--lp-ink-3); cursor: progress; }
.lp-tool-body { display: grid; gap: 8px; margin-top: 8px; }
.lp-tool-quiet .lp-tool-body { margin: 4px 0 0 24px; }
.lp-tool-raw {
  margin: 8px 0 0; max-height: 240px; overflow: auto; padding: 8px 12px; border-radius: var(--lp-radius-ctl);
  border: 1px solid var(--lp-line); background: var(--lp-well); color: var(--lp-ink-2);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 12px; line-height: 18px; white-space: pre-wrap; word-break: break-word;
}
.lp-tool-saved { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-tool-draft { display: grid; gap: 8px; }
.lp-tool-draft .lp-draft-block { margin: 0; }
.lp-tool-draft .lp-form-actions { margin-top: 4px; }
.lp-readback { list-style: none; margin: 0; padding: 0; display: grid; }
.lp-readback li { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding: 8px 0; border-top: 1px solid var(--lp-line); }
.lp-readback li:first-child { border-top: 0; padding-top: 0; }
.lp-tool-result { display: flex; align-items: baseline; gap: 8px 12px; flex-wrap: wrap; }
.lp-tool-figure .lp-unit { margin-left: 4px; }
.lp-tool-report pre { margin: 0; max-height: 240px; overflow: auto; white-space: pre-wrap; font-size: 12px; line-height: 18px; color: var(--lp-ink-2); }
.lp-tool-doctor { display: flex; gap: 4px; align-items: flex-start; margin: 0; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-tool-doctor .lp-icon { margin-top: 2px; }
.lp-tool .lp-caption { margin: 0; }

/* --- quick actions under a finished turn: one quiet row, wrapping in a narrow chat -------------------- */
.lp-turn-tail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0; font-size: 13px; line-height: 20px; }
.lp-tail-group { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-tail-links { display: inline-flex; align-items: center; gap: 12px; margin-left: auto; }
.lp-turn-tail .lp-form-error { margin: 0; }

/* --- the 健康 tab in DSH's right column (the 概览 tab, narrowed by the lp-root queries) ------------------ */
.lp-pane { container: lp-root / inline-size; display: grid; gap: 12px; padding: 12px 16px 24px; }
.lp-pane-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
.lp-pane-title { display: inline-flex; align-items: center; gap: 8px; }
.lp-pane-title .lp-icon { color: var(--lp-ink-3); }
.lp-pane .lp-card { padding: 16px; }
.lp-pane .lp-overview { gap: 12px; }
.lp-pane-loading { display: grid; gap: 12px; }
.lp-pane-foot { margin: 4px 0 0; }

/* --- reminder pill (shell overlay: click-through layer) --------------------------------------------- */
/* Bottom-right, lifted clear of a chat's composer so it never covers the send button. */
.lp-pill-wrap {
  position: absolute; right: 20px; bottom: 136px; z-index: 1; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: var(--lp-radius-card);
  background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); animation: lp-fade .2s ease both;
}
.lp-pill-main {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 4px; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer;
}
.lp-pill-main:hover { background: var(--lp-hover); }
.lp-pill-mark { width: 24px; height: 24px; flex: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-accent); color: var(--lp-on-accent); }
.lp-pill-count { font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-pill-x {
  width: 28px; height: 28px; flex: none; border: 0; border-radius: var(--lp-radius-ctl); display: inline-flex; align-items: center; justify-content: center;
  background: transparent; color: var(--lp-ink-3); cursor: pointer;
}
.lp-pill-x:hover { background: var(--lp-hover); color: var(--lp-ink); }

/* --- first-run welcome (shell overlay) and the sidebar dot ------------------------------------------- */
/* Next to the sidebar's 健康 entry; no mask, the rest of DSH stays usable. */
.lp-intro-card {
  position: absolute; left: 284px; top: 112px; z-index: 2; pointer-events: auto; width: min(340px, calc(100vw - 300px));
  display: grid; gap: 8px; padding: 16px; border-radius: var(--lp-radius-card); background: var(--lp-layer-2);
  box-shadow: var(--lp-shadow-pop); animation: lp-fade .2s ease both;
}
.lp-intro-card::before { content: ""; position: absolute; left: -6px; top: 22px; width: 12px; height: 12px; background: var(--lp-layer-2); transform: rotate(45deg); box-shadow: -1px 1px 0 0 var(--lp-line); }
.lp-intro-head { display: flex; align-items: center; gap: 8px; }
.lp-intro-title { margin: 0; flex: 1; font-size: 15px; line-height: 22px; font-weight: 600; }
.lp-intro-x { width: 28px; height: 28px; }
.lp-intro-text { margin: 0; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-intro-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.lp-intro-icon { position: relative; display: inline-flex; color: inherit; font-size: inherit; line-height: inherit; }
.lp-intro-dot { position: absolute; top: -2px; right: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--lp-bad); box-shadow: 0 0 0 2px var(--lp-bg); }

/* --- the doctor-first card on 概览 and its one-page brief (triage/care-card.ts) ------------------------ */
.lp-care-box { min-width: 0; }
.lp-care-title { display: inline-flex; align-items: center; gap: 8px; }
.lp-care-title .lp-icon { color: var(--lp-warn-ink); }
.lp-care-text { display: grid; gap: 4px; min-width: 0; }
.lp-care-box p, .lp-tool-body p { max-width: 40em; }
.lp-care-visit { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--lp-line); }
.lp-care-visit-form { display: grid; gap: 12px; max-width: 480px; }
.lp-care-date { max-width: 200px; }
.lp-brief-dialog.lp-brief-dialog, div:has(> .lp-brief-modal.lp-brief-modal) { width: min(640px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-brief-modal { display: grid; gap: 12px; padding: 24px; max-height: calc(100vh - 48px); overflow-y: auto; }
.lp-brief-modal .lp-modal-actions { margin-top: 8px; }
.lp-brief-pre {
  margin: 0; max-height: 55vh; overflow: auto; padding: 12px 16px; border-radius: var(--lp-radius-ctl); border: 1px solid var(--lp-line);
  background: var(--lp-well); color: var(--lp-ink); font-family: inherit; font-size: 13px; line-height: 20px; white-space: pre-wrap;
}
`
