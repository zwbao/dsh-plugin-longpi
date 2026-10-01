// page header, people picker (and its add-family dialog), banners, tabs with the 更多 menu, footer
// (page.ts, people.ts, health-chat.ts, journey-steps.ts status line).
// Page-specific layout only; base components (styles/base.ts) are never redefined here. See docs/design-system.md §3, §5.

export const SHELL = `
/* --- header: kicker → h1 → one meta line; one 32px control row on the right ------------------- */
.lp-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 16px; }
.lp-header-text { display: grid; gap: 4px; min-width: 0; }
.lp-header-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-header-sep { color: var(--lp-ink-4); }
.lp-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; flex: none; max-width: 100%; }
.lp-header-end { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-healthchat-btn { flex: none; }
.lp-healthchat { display: inline-flex; align-items: center; gap: 8px; }
@container lp-root (max-width: 760px) {
  .lp-header { flex-direction: column; align-items: stretch; gap: 20px; }
  .lp-header-actions { width: 100%; justify-content: space-between; }
}

/* --- people picker ------------------------------------------------------------------------------- */
.lp-people { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.lp-people-select { min-width: 120px; max-width: 220px; }
.lp-people-error { flex-basis: 100%; text-align: right; }
.lp-people-notice { margin-bottom: 16px; }
/* The add-family dialog renders outside the page, so container queries do not reach it: size it here. */
.lp-people-modal.lp-people-modal, div:has(> .lp-people-dialog.lp-people-dialog) { width: min(560px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-people-dialog { display: grid; gap: 16px; max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px; }
.lp-people-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.lp-people-dialog .lp-modal-actions { margin-top: 8px; }
/* 性别 as a full-width control the height of the inputs, so it reads as a choice even with nothing picked (P2-10). */
.lp-people-dialog .lp-seg { display: flex; width: 100%; padding: 4px; }
.lp-people-dialog .lp-seg-opt { flex: 1; }
.lp-people-dialog .lp-seg-opt span { width: 100%; }
@media (max-width: 480px) { .lp-people-dialog { padding: 20px; } .lp-people-dialog .lp-form-grid { grid-template-columns: minmax(0, 1fr); } }

/* --- banners under the header: well, 40px, 12px radius ------------------------------------------- */
.lp-banner, .lp-season-bar {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; margin: 0 0 16px; padding: 8px 16px; border: 0;
  border-radius: var(--lp-radius-card); background: var(--lp-well); color: var(--lp-ink); font: inherit; font-size: 13px; line-height: 20px;
  text-align: left; cursor: pointer; transition: background-color .15s ease;
}
.lp-banner:hover, .lp-season-bar:hover { background: var(--lp-hover); }
.lp-banner > .lp-icon { color: var(--lp-ink-3); }
.lp-banner-text { flex: 1; min-width: 0; }
.lp-banner-go { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--lp-ink-2); white-space: nowrap; }

/* --- tabs: primary tabs, a temporary tab for a secondary page, 更多 at the right end ------------- */
.lp-tabbar { display: flex; align-items: flex-end; gap: 4px; margin: 8px 0 24px; border-bottom: 1px solid var(--lp-line); }
.lp-tabs { display: flex; gap: 4px; flex: 0 1 auto; min-width: 0; margin-bottom: -1px; overflow-x: auto; scrollbar-width: none; }
.lp-tabs::-webkit-scrollbar { display: none; }
.lp-tab {
  position: relative; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 0; background: transparent;
  color: var(--lp-ink-2); font-size: 14px; line-height: 22px; font-weight: 400; cursor: pointer; white-space: nowrap; transition: color .15s ease;
}
.lp-tab:hover { color: var(--lp-ink); }
.lp-tab-on { color: var(--lp-ink); font-weight: 600; }
.lp-tab-on::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; border-radius: 1px; background: var(--lp-accent); }
/* the first tab's text lines up with the page's left edge */
.lp-tab:first-child { padding-left: 0; }
.lp-tab:first-child.lp-tab-on::after { left: 0; }
.lp-tab-badge { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 4px; background: var(--lp-well); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400; text-align: center; }
.lp-tab-close { width: 24px; height: 24px; margin: 0 0 8px -8px; }
.lp-more { position: relative; margin: 0 0 4px auto; flex: none; }
.lp-more-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 8px 0 12px; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink-2); font-size: 14px; line-height: 22px; cursor: pointer;
}
.lp-more-btn:hover, .lp-more-btn[aria-expanded="true"] { background: var(--lp-hover); color: var(--lp-ink); }
.lp-more-btn .lp-icon { transform: rotate(90deg); color: var(--lp-ink-3); }
.lp-more-pop {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; display: grid; gap: 0; min-width: 160px; padding: 4px;
  border-radius: var(--lp-radius-card); background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); animation: lp-fade .15s ease both;
}
.lp-more-pop .lp-row-btn { border: 0; min-height: 36px; padding: 8px 12px; }
.lp-more-pop .lp-row-btn[aria-current="page"] { font-weight: 600; }

/* --- tab body and footer --------------------------------------------------------------------------- */
.lp-tab-body { display: grid; gap: 12px; min-width: 0; }
/* Sections sit 32px apart: the grid's 12px plus 20px. */
.lp-tab-body > .lp-section + .lp-section { margin-top: 20px; }
.lp-footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--lp-line); }
.lp-footer .lp-caption { max-width: none; }
`
