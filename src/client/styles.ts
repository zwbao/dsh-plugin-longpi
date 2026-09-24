// Board styles. Colors are tokens on .lp-root with a selected dark mode (its
// own steps, validated against its own surface), not an automatic flip. The
// person's data wears one accent (validated ≥3:1 on both surfaces); status
// colors are reserved for verdicts and always travel with an icon and a label.

const CSS = `
.lp-root {
  --lp-page: #f5f3ee;
  --lp-surface: #fdfcfa;
  --lp-surface-2: #f2f0ea;
  --lp-ink: #16140f;
  --lp-ink-2: #56524a;
  --lp-muted: #8a857a;
  --lp-hair: #e7e3da;
  --lp-axis: #cfc9bc;
  --lp-border: rgba(22, 20, 15, 0.08);
  --lp-accent: #2a78d6;
  --lp-accent-wash: rgba(42, 120, 214, 0.10);
  --lp-accent-soft: rgba(42, 120, 214, 0.18);
  --lp-band: rgba(138, 133, 122, 0.16);
  --lp-good: #0ca30c;
  --lp-good-ink: #006300;
  --lp-good-wash: rgba(12, 163, 12, 0.10);
  --lp-serious: #ec835a;
  --lp-serious-wash: rgba(236, 131, 90, 0.14);
  --lp-shadow: 0 1px 2px rgba(22, 20, 15, 0.04), 0 10px 30px rgba(22, 20, 15, 0.05);
  color-scheme: light;
  height: 100%;
  overflow: auto;
  background: var(--lp-page);
  color: var(--lp-ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .lp-root {
    --lp-page: #0e0e0d;
    --lp-surface: #1a1a19;
    --lp-surface-2: #232321;
    --lp-ink: #f4f3ef;
    --lp-ink-2: #c3c2b7;
    --lp-muted: #8f8b82;
    --lp-hair: #2c2c2a;
    --lp-axis: #3b3a37;
    --lp-border: rgba(255, 255, 255, 0.08);
    --lp-accent: #3987e5;
    --lp-accent-wash: rgba(57, 135, 229, 0.13);
    --lp-accent-soft: rgba(57, 135, 229, 0.22);
    --lp-band: rgba(195, 194, 183, 0.13);
    --lp-good-ink: #0ca30c;
    --lp-good-wash: rgba(12, 163, 12, 0.16);
    --lp-serious-wash: rgba(236, 131, 90, 0.18);
    --lp-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 10px 30px rgba(0, 0, 0, 0.28);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] .lp-root, .lp-root[data-theme="dark"] {
  --lp-page: #0e0e0d;
  --lp-surface: #1a1a19;
  --lp-surface-2: #232321;
  --lp-ink: #f4f3ef;
  --lp-ink-2: #c3c2b7;
  --lp-muted: #8f8b82;
  --lp-hair: #2c2c2a;
  --lp-axis: #3b3a37;
  --lp-border: rgba(255, 255, 255, 0.08);
  --lp-accent: #3987e5;
  --lp-accent-wash: rgba(57, 135, 229, 0.13);
  --lp-accent-soft: rgba(57, 135, 229, 0.22);
  --lp-band: rgba(195, 194, 183, 0.13);
  --lp-good-ink: #0ca30c;
  --lp-good-wash: rgba(12, 163, 12, 0.16);
  --lp-serious-wash: rgba(236, 131, 90, 0.18);
  --lp-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 10px 30px rgba(0, 0, 0, 0.28);
  color-scheme: dark;
}
.lp-page { max-width: 1180px; margin: 0 auto; padding: 36px 32px 72px; }
.lp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 26px; }
.lp-kicker { font-size: 12px; letter-spacing: 0.08em; color: var(--lp-muted); margin-bottom: 6px; }
.lp-h1 { font-size: 30px; line-height: 1.2; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; }
.lp-h2 { font-size: 18px; font-weight: 600; margin: 0; }
.lp-h3 { font-size: 16px; font-weight: 600; margin: 6px 0 2px; }
.lp-lead { margin: 0 0 12px; color: var(--lp-ink-2); font-size: 15px; max-width: 42rem; }
.lp-status { display: inline-flex; align-items: center; gap: 8px; color: var(--lp-ink-2); font-size: 13px; }
.lp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--lp-axis); display: inline-block; }
.lp-dot-on { background: var(--lp-good); box-shadow: 0 0 0 3px var(--lp-good-wash); }
.lp-actions { display: flex; gap: 8px; flex-shrink: 0; }
.lp-body { transition: opacity .2s ease; }
.lp-refreshing { opacity: .6; }
.lp-card {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 18px;
  padding: 20px 22px;
  box-shadow: var(--lp-shadow);
  animation: lp-rise .5s cubic-bezier(.2, .7, .2, 1) both;
  min-width: 0;
}
.lp-section { margin-top: 34px; }
.lp-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 14px; }
.lp-label { font-size: 13px; color: var(--lp-ink-2); font-weight: 600; margin-bottom: 10px; }
.lp-label-tight { margin-bottom: 2px; font-weight: 500; }
.lp-subhead { font-size: 13px; color: var(--lp-ink-2); margin: 14px 0 8px; }
.lp-strong { font-weight: 600; color: var(--lp-ink); }
.lp-muted { color: var(--lp-ink-2); }
.lp-muted-ink { color: var(--lp-muted); }
.lp-accent-ink { color: var(--lp-accent); }
.lp-good-ink { color: var(--lp-good-ink); }
.lp-good-ink-strong { color: var(--lp-good-ink); }
.lp-fine { font-size: 12px; color: var(--lp-muted); margin-top: 10px; line-height: 1.5; }
.lp-num { font-variant-numeric: tabular-nums; color: var(--lp-ink-2); }
.lp-icon { vertical-align: -2px; flex-shrink: 0; }

.lp-grid-hero { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 16px; }
.lp-tiles { display: grid; grid-template-rows: 1fr 1fr; gap: 16px; }
.lp-hero {
  background:
    radial-gradient(120% 90% at 0% 0%, var(--lp-accent-wash), transparent 55%),
    var(--lp-surface);
}
.lp-hero-win { box-shadow: var(--lp-shadow), 0 0 0 1px var(--lp-good-wash), 0 0 36px -8px var(--lp-good-wash); }
.lp-hero-top { display: flex; justify-content: space-between; gap: 16px; }
.lp-hero-figure { font-size: 60px; line-height: 1.02; font-weight: 600; letter-spacing: -0.02em; margin: 2px 0 10px; }
.lp-hero-unit { font-size: 20px; font-weight: 500; color: var(--lp-ink-2); margin-left: 6px; letter-spacing: 0; }
.lp-hero-meta { text-align: right; font-size: 13px; color: var(--lp-ink-2); }
.lp-hero-story { display: flex; gap: 8px; align-items: flex-start; margin: 12px 0 0; color: var(--lp-ink); font-size: 14px; }
.lp-hero-wait { font-size: 26px; font-weight: 600; margin: 4px 0 8px; }
.lp-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: var(--lp-surface-2); color: var(--lp-ink); font-size: 13px; font-weight: 600; }
.lp-pill-good { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-tile { display: flex; flex-direction: column; justify-content: space-between; }
.lp-tile-row { display: flex; align-items: center; gap: 14px; }
.lp-tile-figure { font-size: 28px; font-weight: 600; line-height: 1.15; }
.lp-small-figure { font-size: 22px; }
.lp-streak { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--lp-ink); }
.lp-streak .lp-icon { color: var(--lp-serious); }
.lp-ring-track { fill: none; stroke: var(--lp-accent-soft); }
.lp-ring-fill { fill: none; stroke: var(--lp-accent); stroke-linecap: round; transition: stroke-dasharray .8s ease; }

.lp-wins { margin-top: 16px; }
.lp-wins-empty { display: flex; gap: 12px; align-items: flex-start; }
.lp-win { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid var(--lp-hair); animation: lp-rise .5s ease both; }
.lp-win:first-of-type { border-top: 0; padding-top: 0; }
.lp-win-icon { width: 30px; height: 30px; border-radius: 50%; background: var(--lp-good-wash); color: var(--lp-good); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

.lp-grid-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 16px; }
.lp-item { display: flex; flex-direction: column; gap: 12px; }
.lp-item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.lp-cat { font-size: 11.5px; padding: 2px 8px; border-radius: 6px; background: var(--lp-surface-2); color: var(--lp-ink-2); }
.lp-item-adherence { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 12px 0; border-top: 1px solid var(--lp-hair); border-bottom: 1px solid var(--lp-hair); }
.lp-item-adherence .lp-fine { margin-top: 2px; max-width: 12rem; }
.lp-verdict { padding: 2px 0; }
.lp-verdict-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.lp-reason { margin: 6px 0 0; color: var(--lp-ink-2); font-size: 13px; }
.lp-expected summary { font-size: 12px; color: var(--lp-muted); cursor: pointer; margin-top: 6px; }
.lp-item-foot { margin-top: auto; padding-top: 4px; }

.lp-chip-v { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px 3px 7px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--lp-ink); white-space: nowrap; }
.lp-v-good { background: var(--lp-good-wash); }
.lp-v-good .lp-icon { color: var(--lp-good); }
.lp-v-within { background: var(--lp-surface-2); }
.lp-v-within .lp-icon { color: var(--lp-muted); }
.lp-v-worse { background: var(--lp-serious-wash); }
.lp-v-worse .lp-icon { color: var(--lp-serious); }
.lp-v-unknown { background: var(--lp-surface-2); color: var(--lp-ink-2); }
.lp-v-unknown .lp-icon { color: var(--lp-muted); }

.lp-grid-charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.lp-figure { margin: 0; }
.lp-figure-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
.lp-grid-goals { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.lp-model-figures { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.lp-model-note { background: var(--lp-surface-2); box-shadow: none; }
.lp-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }

.lp-steps { list-style: none; margin: 0; padding: 8px 22px; }
.lp-step { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid var(--lp-hair); }
.lp-step:first-child { border-top: 0; }
.lp-step-icon { width: 28px; height: 28px; border-radius: 8px; background: var(--lp-surface-2); color: var(--lp-ink-2); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lp-step-worse .lp-step-icon { background: var(--lp-serious-wash); color: var(--lp-serious); }
.lp-step-retest .lp-step-icon { background: var(--lp-accent-wash); color: var(--lp-accent); }

.lp-chart { position: relative; width: 100%; }
.lp-chart svg { display: block; overflow: visible; }
.lp-chart svg:focus { outline: none; }
.lp-chart svg:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 4px; border-radius: 6px; }
.lp-chart-empty { color: var(--lp-muted); font-size: 13px; padding: 24px 0; }
.lp-grid { stroke: var(--lp-hair); stroke-width: 1; }
.lp-axis { fill: var(--lp-muted); font-size: 11px; }
.lp-line { fill: none; stroke: var(--lp-accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.lp-area { fill: var(--lp-accent-wash); stroke: none; }
.lp-dot { fill: var(--lp-accent); stroke: var(--lp-surface); stroke-width: 2; transition: r .15s ease; }
.lp-band { fill: var(--lp-band); }
.lp-goal { stroke: var(--lp-ink-2); stroke-width: 1; opacity: .7; }
.lp-goal-text { fill: var(--lp-ink-2); font-size: 11px; }
.lp-ref { stroke: var(--lp-axis); stroke-width: 1; }
.lp-cross { stroke: var(--lp-axis); stroke-width: 1; }
.lp-end { fill: var(--lp-ink); font-size: 12px; font-weight: 600; }
.lp-bar { fill: var(--lp-accent); }
.lp-bar-muted { fill: var(--lp-axis); }
.lp-hit { fill: transparent; }
.lp-row-label { fill: var(--lp-ink); font-size: 12.5px; }
.lp-checkup { stroke: var(--lp-hair); stroke-width: 1; }
.lp-checkup-dot { fill: var(--lp-muted); stroke: var(--lp-surface); stroke-width: 2; }
.lp-today { stroke: var(--lp-accent); stroke-width: 1; opacity: .55; }
.lp-legend-inline { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--lp-muted); margin-top: 6px; }
.lp-key-bar { width: 16px; height: 6px; border-radius: 3px; background: var(--lp-accent); display: inline-block; }
.lp-key-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lp-muted); display: inline-block; margin-left: 10px; }
.lp-tip {
  position: absolute; z-index: 5; pointer-events: none; min-width: 120px; max-width: 220px;
  background: var(--lp-surface); border: 1px solid var(--lp-border); border-radius: 10px; box-shadow: var(--lp-shadow);
  padding: 8px 10px; font-size: 12px; transform: translateY(-100%);
}
.lp-tip-title { color: var(--lp-muted); margin-bottom: 2px; }
.lp-tip-row { display: flex; flex-direction: column; }
.lp-tip-value { color: var(--lp-ink); font-weight: 600; font-size: 13px; }
.lp-tip-label { color: var(--lp-ink-2); }
.lp-strip { position: relative; flex-shrink: 0; }
.lp-cell-done { fill: var(--lp-accent); }
.lp-cell-missed { fill: var(--lp-axis); }
.lp-cell-unknown { fill: var(--lp-hair); opacity: .6; }
.lp-twin { margin-top: 10px; font-size: 12px; }
.lp-twin summary { color: var(--lp-muted); cursor: pointer; width: fit-content; }
.lp-twin table { border-collapse: collapse; margin-top: 8px; width: 100%; font-variant-numeric: tabular-nums; }
.lp-twin caption { text-align: left; color: var(--lp-muted); padding-bottom: 4px; }
.lp-twin th, .lp-twin td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--lp-hair); }
.lp-twin th { color: var(--lp-ink-2); font-weight: 600; }

.lp-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 15px; border-radius: 999px;
  border: 1px solid transparent; background: var(--lp-ink); color: var(--lp-surface);
  font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none;
  transition: transform .12s ease, opacity .15s ease, background .2s ease;
}
.lp-btn:hover:not(:disabled) { opacity: .88; }
.lp-btn:active:not(:disabled) { transform: scale(.97); }
.lp-btn:disabled { opacity: .5; cursor: default; }
.lp-btn-ghost { background: transparent; color: var(--lp-ink); border-color: var(--lp-hair); }
.lp-btn-soft { background: var(--lp-accent-wash); color: var(--lp-ink); }
.lp-btn-soft .lp-icon { color: var(--lp-accent); }
.lp-btn-done { background: var(--lp-good-wash); color: var(--lp-good-ink); opacity: 1 !important; animation: lp-pop .35s ease; }
.lp-btn-done .lp-icon { color: var(--lp-good); }
.lp-banner { margin: 0 0 16px; padding: 10px 14px; border-radius: 12px; background: var(--lp-accent-wash); color: var(--lp-ink); font-size: 13px; cursor: pointer; }
.lp-banner-bad { background: var(--lp-serious-wash); }
.lp-empty { text-align: left; }
.lp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lp-chip { border: 1px solid var(--lp-hair); background: var(--lp-surface); color: var(--lp-ink); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 12.5px; cursor: pointer; }
.lp-chip-on { background: var(--lp-ink); color: var(--lp-surface); }
.lp-list { list-style: none; margin: 0 0 12px; padding: 0; }
.lp-list li { padding: 7px 0; border-top: 1px solid var(--lp-hair); font-size: 13px; }
.lp-list li:first-child { border-top: 0; }
.lp-run { margin-top: 12px; }
.lp-form { display: grid; grid-template-columns: 1.4fr .8fr .7fr .9fr auto; gap: 8px; }
.lp-form input, .lp-form select, .lp-search input {
  border: 1px solid var(--lp-hair); border-radius: 10px; padding: 8px 10px; font: inherit; font-size: 13px;
  background: var(--lp-surface); color: var(--lp-ink); min-width: 0;
}
.lp-search { display: flex; gap: 8px; margin-bottom: 8px; }
.lp-facts { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 14px; margin: 4px 0; }
.lp-facts-note { grid-column: 1 / -1; margin: 0; }
.lp-fact { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; color: var(--lp-ink-2); }
.lp-fact select { border: 1px solid var(--lp-hair); border-radius: 8px; padding: 4px 6px; font: inherit; font-size: 13px; background: var(--lp-surface); color: var(--lp-ink); }
.lp-search input { flex: 1; }
.lp-more { margin-top: 34px; }
.lp-more > summary { list-style: none; cursor: pointer; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.lp-more > summary::-webkit-details-marker { display: none; }
.lp-more > summary::before { content: ""; width: 7px; height: 7px; border-right: 1.6px solid var(--lp-muted); border-bottom: 1.6px solid var(--lp-muted); transform: rotate(-45deg); transition: transform .2s ease; margin-right: 4px; }
.lp-more[open] > summary::before { transform: rotate(45deg); }
.lp-more .lp-section { margin-top: 16px; }
.lp-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--lp-hair); color: var(--lp-muted); font-size: 12px; }
.lp-skeleton { border-radius: 12px; background: linear-gradient(90deg, var(--lp-surface-2), var(--lp-hair), var(--lp-surface-2)); background-size: 200% 100%; animation: lp-shimmer 1.4s ease infinite; }

.lp-dock { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 4px 0; }
.lp-dock-kicker { font-size: 12px; color: #6e6a60; margin-right: 4px; }
.lp-sidebar { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }

@keyframes lp-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) {
  .lp-card, .lp-win, .lp-btn-done, .lp-skeleton { animation: none; }
  .lp-ring-fill, .lp-body, .lp-dot { transition: none; }
}
@media (max-width: 760px) {
  .lp-page { padding: 20px 16px 48px; }
  .lp-header { flex-direction: column; }
  .lp-h1 { font-size: 24px; }
  .lp-hero-figure { font-size: 48px; }
  .lp-grid-hero { grid-template-columns: 1fr; }
  .lp-tiles { grid-template-columns: 1fr 1fr; grid-template-rows: auto; }
  .lp-grid-items, .lp-grid-charts { grid-template-columns: 1fr; }
  .lp-form { grid-template-columns: 1fr 1fr; }
  .lp-item-adherence { flex-direction: column; align-items: flex-start; }
}
`

export function injectStyles(): void {
  const id = 'dsh-plugin-longpi-style'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = CSS
  document.head.appendChild(style)
}
