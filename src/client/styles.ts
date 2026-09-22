const CSS = `
.lp-dash {
  height: 100%;
  overflow: auto;
  padding: 28px 32px 56px;
  background: #f6f1e8;
  color: #241c16;
  font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", sans-serif;
}
.lp-kicker {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8a4b2f;
  margin-bottom: 8px;
}
.lp-title {
  font-family: "Iowan Old Style", Palatino, "Songti SC", serif;
  font-size: 34px;
  line-height: 1.1;
  margin: 0 0 8px;
}
.lp-lead {
  max-width: 40rem;
  margin: 0 0 20px;
  color: #4d433a;
  line-height: 1.5;
}
.lp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.lp-card, .lp-block {
  background: #fffdf8;
  border: 1px solid #e4d8c8;
  border-radius: 14px;
  padding: 14px 16px;
}
.lp-card h3, .lp-block h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.lp-card p, .lp-muted {
  margin: 0;
  color: #5c5148;
  font-size: 14px;
  line-height: 1.45;
}
.lp-ok { color: #1f6a45; }
.lp-bad { color: #8d3b32; }
.lp-form {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.7fr 0.9fr auto;
  gap: 8px;
  margin-bottom: 8px;
}
.lp-form input, .lp-form select, .lp-search input {
  border: 1px solid #d9cbb8;
  border-radius: 10px;
  padding: 8px 10px;
  font: inherit;
  background: #fff;
  color: inherit;
  min-width: 0;
}
.lp-form button, .lp-search button, .lp-chip {
  border: 1px solid #6e3b28;
  background: #6e3b28;
  color: #fff8f2;
  border-radius: 999px;
  padding: 8px 14px;
  font: inherit;
  cursor: pointer;
}
.lp-search {
  display: flex;
  gap: 8px;
  margin: 8px 0 12px;
}
.lp-search input { flex: 1; }
.lp-row, .lp-skill {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #efe4d6;
  font-size: 14px;
}
.lp-skill { align-items: baseline; }
.lp-name { font-weight: 600; }
.lp-why { color: #6a5e54; text-align: right; }
.lp-domains { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.lp-domain {
  background: #f3e7da;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
}
.lp-note { margin-top: 16px; color: #6a5e54; font-size: 13px; }
.lp-dock { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 4px 0; }
.lp-dock-kicker { font-size: 12px; color: #8a4b2f; margin-right: 4px; }
.lp-chip { background: transparent; color: #6e3b28; }
.lp-chip-on { background: #6e3b28; color: #fff8f2; }
.lp-sidebar { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.lp-dot { width: 8px; height: 8px; border-radius: 50%; background: #6e3b28; display: inline-block; }
@media (max-width: 800px) {
  .lp-dash { padding: 16px 14px 40px; }
  .lp-title { font-size: 28px; }
  .lp-form { grid-template-columns: 1fr 1fr; }
  .lp-row, .lp-skill { flex-direction: column; }
  .lp-why { text-align: left; }
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
