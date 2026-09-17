const CSS = `
.lp-dash {
  height: 100%;
  overflow: auto;
  padding: 24px 28px 48px;
  background: #F5F1EA;
  color: #1A1F1D;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", serif;
}
.lp-banner {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #B8935A;
  margin-bottom: 12px;
}
.lp-kicker {
  font-size: 13px;
  color: #6B7370;
  margin-bottom: 6px;
}
.lp-north {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 8px;
}
.lp-age {
  font-size: 72px;
  line-height: 0.9;
  font-weight: 500;
  color: #2D5F5A;
}
.lp-chrono {
  font-size: 16px;
  color: #6B7370;
}
.lp-disc {
  font-size: 12px;
  color: #A5ABA7;
  margin: 8px 0 24px;
  max-width: 52ch;
}
.lp-modules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.lp-card {
  background: #FCFAF5;
  border: 1px solid #E6DFCF;
  border-radius: 12px;
  padding: 14px 16px;
}
.lp-card h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 500;
  color: #6B7370;
}
.lp-card .n {
  font-size: 28px;
  color: #1A1F1D;
}
.lp-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}
@media (max-width: 860px) {
  .lp-age { font-size: 56px; }
  .lp-grid { grid-template-columns: 1fr; }
}
.lp-card ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.55;
}
.lp-card li { margin: 6px 0; }
.lp-time { color: #2D5F5A; font-variant-numeric: tabular-nums; margin-right: 8px; }
.lp-err { color: #B26E5E; font-size: 14px; }
.lp-sidebar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 0;
  color: #2D5F5A;
  cursor: pointer;
  font: inherit;
  padding: 6px 8px;
}
.lp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2D5F5A;
  display: inline-block;
}
.lp-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.lp-radar-label { font-size: 11px; fill: #6B7370; }
.lp-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 4px;
}
.lp-chip {
  border: 1px solid #E6DFCF;
  background: #FFFFFF;
  border-radius: 999px;
  padding: 6px 12px;
  font: 13px/1.2 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  color: #1A1F1D;
}
.lp-chip-high { border-color: #E9CDC3; background: #FBF3F0; }
.lp-chip-optimal { border-color: #D3E1D9; background: #F3F8F5; }
.lp-chip-watch { border-color: #EED6B4; background: #FBF6EE; }
.lp-hint, .lp-copied { font-size: 12px; color: #6B7370; margin: 0 0 16px; }
.lp-copied { color: #2D5F5A; }
.lp-ask { margin-top: 20px; }
.lp-ask h3 { font-size: 13px; color: #6B7370; font-weight: 500; margin: 0 0 8px; }
.lp-ask-row { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-ask-btn, .lp-dock-chip {
  border: 1px solid #C7D9D5;
  background: #E3EDEA;
  color: #1E4441;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  font: 13px/1.3 ui-sans-serif, system-ui, sans-serif;
}
.lp-dock {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 0 0 8px;
  max-width: var(--dsh-composer-max-width, 748px);
  margin: 0 auto;
}
.lp-dock-kicker {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #B8935A;
  margin-right: 4px;
}
.lp-dock-chip-on { background: #2D5F5A; color: #FCFAF5; border-color: #2D5F5A; }
`

export function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('dsh-plugin-longpi-css')) return
  const el = document.createElement('style')
  el.id = 'dsh-plugin-longpi-css'
  el.textContent = CSS
  document.head.appendChild(el)
}
