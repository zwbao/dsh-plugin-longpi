// 长寿图鉴 (docs/codex-design.md §5): pixel style, only inside the .lp-codex container, always dark. A deliberate
// exception to the quiet DSH look (docs/design-system.md), so every colour lives in the --lp-codex-* variables
// below and nothing here reaches outside the container. Card faces are rasters (engage/art.ts); this file places
// text on the pixel grid (--u = one card pixel) and adds the motion. Type sizes: 12, 24 and 36 px only.

export const CODEX = `
.lp-codex {
  --lp-codex-ink: #0d0f12;
  --lp-codex-bg: #0c2226;
  --lp-codex-panel: #26343a;
  --lp-codex-panel-2: #1c272c;
  --lp-codex-panel-hi: #3b4f57;
  --lp-codex-panel-in: #2f3e44;
  --lp-codex-cream: #f4ead5;
  --lp-codex-cream-ink: #2a241b;
  --lp-codex-text: #f4ead5;
  --lp-codex-text-2: #b4c4c7;
  --lp-codex-text-3: #93a7ac;
  --lp-codex-white: #fff6e0;
  --lp-codex-orange: #ef8a2a;
  --lp-codex-orange-d: #a35210;
  --lp-codex-blue: #2f8fe6;
  --lp-codex-blue-d: #1a5a9c;
  --lp-codex-red: #e5484d;
  --lp-codex-red-d: #9c2a2e;
  --lp-codex-green: #35b37e;
  --lp-codex-green-d: #1f7a52;
  --lp-codex-teal: #2a9d8f;
  --lp-codex-teal-l: #6fd3c4;
  --lp-codex-teal-d: #1b6159;
  --lp-codex-gold: #f2b53a;
  --lp-codex-gold-d: #a86b14;
  --lp-codex-gold-ink: #2a1c05;
  --lp-codex-violet: #8a5cd6;
  --lp-codex-violet-d: #4a2c86;
  --lp-codex-silver: #7d8a96;
  --lp-codex-silver-d: #5b6974;
  --lp-codex-copper: #c8703a;
  --lp-codex-copper-d: #7f3f1d;
  --lp-codex-kraft: #c9925a;
  --lp-codex-kraft-d: #7a4f26;
  --lp-codex-night: #3a372f;
  --lp-codex-night-d: #15140f;
  --lp-codex-grey: #4b5d64;
  --lp-codex-grey-d: #26343a;
  --lp-codex-k-gold: #f2b53a;
  --lp-codex-k-violet: #b892ff;
  --lp-codex-k-silver: #d4dde4;
  --lp-codex-k-copper: #f0a06a;
  --lp-codex-k-blue: #6db8ff;
  --lp-codex-k-red: #ff7a7e;
  --lp-codex-k-green: #6fe0a8;
  --lp-codex-k-teal: #7fe3d6;
  --lp-codex-paper-no: #6b5a44;
  --lp-codex-paper-label: #5b4a36;
  --lp-codex-night-no: #8d98ad;
  --lp-codex-night-label: #9aa6ba;
  --lp-codex-desc-k: #8a4a04;
  --lp-codex-desc-ks: #3f5875;
  --lp-codex-desc-kn: #2253a8;
  --lp-codex-note-bg: #33282a;
  --lp-codex-note-ink: #ffd0c4;
  --lp-codex-foil-1: #ff5e5e;
  --lp-codex-foil-2: #ffd166;
  --lp-codex-foil-3: #5eead4;
  --lp-codex-foil-4: #60a5fa;
  --lp-codex-foil-5: #c084fc;
  --lp-codex-shade: rgba(0, 0, 0, .45);
  --lp-codex-shade-2: rgba(0, 0, 0, .35);
  --lp-codex-shade-3: rgba(0, 0, 0, .16);
  --lp-codex-veil: rgba(6, 14, 16, .92);
  --lp-codex-gleam: rgba(255, 255, 255, .38);
  --lp-codex-px: "LpCodexPixel", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace;
  position: relative;
  overflow: clip;
  container-type: inline-size;
  container-name: lp-codex;
  min-height: 560px;
  background: var(--lp-codex-bg);
  color: var(--lp-codex-text);
  color-scheme: dark;
  font: 12px/20px var(--lp-codex-px);
  letter-spacing: .02em;
  -webkit-font-smoothing: none;
  isolation: isolate;
}
.lp-codex::after { content: ""; position: absolute; inset: 0; z-index: 40; pointer-events: none; background: repeating-linear-gradient(0deg, var(--lp-codex-shade-3) 0 1px, transparent 1px 3px); }
.lp-codex img { image-rendering: pixelated; }
.lp-codex :is(b, strong, summary, h1, h2, h3, h4, h5, th, label) { font-weight: 400; }
.lp-codex button { font: inherit; color: inherit; letter-spacing: inherit; }
.lp-codex p { margin: 0; }
.lp-codex :is(button, a, summary, input, [tabindex="0"]):focus-visible { outline: 3px solid var(--lp-codex-gold); outline-offset: 3px; }

/* ---- background: the swirl stays on screen while the page scrolls (sticky inside the container) ---- */
.lp-codex .lp-codex-bgwrap { position: absolute; inset: 0; z-index: 0; overflow: clip; pointer-events: none; }
.lp-codex .lp-codex-bgview { position: sticky; top: 0; height: 100vh; max-height: 100%; min-height: 360px; }
.lp-codex .lp-codex-bg { display: block; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
.lp-codex .lp-codex-bgview::after { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, var(--lp-codex-shade) 100%); }

/* ---- chrome ------------------------------------------------------------------ */
.lp-codex .lp-codex-body { position: relative; z-index: 1; max-width: 1160px; margin: 0 auto; padding: 20px 24px 48px; display: grid; gap: 20px; }
.lp-codex .lp-codex-head { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; }
.lp-codex .lp-codex-logo { display: flex; align-items: center; gap: 16px; min-width: 0; }
.lp-codex .lp-codex-logo img { width: 50px; height: 70px; flex: none; transform: rotate(-6deg); filter: drop-shadow(0 4px 0 var(--lp-codex-shade)); }
.lp-codex .lp-codex-h1 { margin: 0; font-size: 36px; line-height: 40px; font-weight: 400; color: var(--lp-codex-cream); text-shadow: 0 3px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-meta { color: var(--lp-codex-text-2); margin-top: 4px; }
.lp-codex .lp-codex-meta b { color: var(--lp-codex-gold); font-weight: 400; }
.lp-codex .lp-codex-head-side { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-codex .lp-codex-box { background: var(--lp-codex-panel); margin: 4px; padding: 16px; position: relative; min-width: 0;
  box-shadow: 0 -4px 0 0 var(--lp-codex-ink), 0 4px 0 0 var(--lp-codex-ink), -4px 0 0 0 var(--lp-codex-ink), 4px 0 0 0 var(--lp-codex-ink), 0 10px 0 0 var(--lp-codex-shade-2), inset 0 4px 0 0 var(--lp-codex-panel-hi); }
.lp-codex .lp-codex-box.lp-codex-dim { background: var(--lp-codex-panel-2); box-shadow: 0 -4px 0 0 var(--lp-codex-ink), 0 4px 0 0 var(--lp-codex-ink), -4px 0 0 0 var(--lp-codex-ink), 4px 0 0 0 var(--lp-codex-ink), 0 10px 0 0 var(--lp-codex-shade-2); }
.lp-codex .lp-codex-box.lp-codex-cream { background: var(--lp-codex-cream); color: var(--lp-codex-cream-ink); box-shadow: 0 -4px 0 0 var(--lp-codex-ink), 0 4px 0 0 var(--lp-codex-ink), -4px 0 0 0 var(--lp-codex-ink), 4px 0 0 0 var(--lp-codex-ink), 0 10px 0 0 var(--lp-codex-shade-2); }
.lp-codex .lp-codex-h2 { margin: 0 0 12px; font-size: 24px; line-height: 28px; font-weight: 400; color: var(--lp-codex-cream); text-shadow: 0 2px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-h3 { margin: 0 0 8px; font-size: 12px; line-height: 20px; font-weight: 400; color: var(--lp-codex-gold); }
.lp-codex .lp-codex-lead { color: var(--lp-codex-text-2); max-width: 60em; }
.lp-codex .lp-codex-cap { color: var(--lp-codex-text-3); }
.lp-codex .lp-codex-big { font-size: 24px; line-height: 32px; color: var(--lp-codex-cream); text-shadow: 0 2px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-stack { display: grid; gap: 12px; align-content: start; min-width: 0; }
.lp-codex .lp-codex-section { display: grid; gap: 14px; }
.lp-codex .lp-codex-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.lp-codex .lp-codex-k-gold { color: var(--lp-codex-k-gold); }
.lp-codex .lp-codex-k-violet { color: var(--lp-codex-k-violet); }
.lp-codex .lp-codex-k-silver { color: var(--lp-codex-k-silver); }
.lp-codex .lp-codex-k-copper { color: var(--lp-codex-k-copper); }
.lp-codex .lp-codex-k-blue { color: var(--lp-codex-k-blue); }
.lp-codex .lp-codex-k-red { color: var(--lp-codex-k-red); }
.lp-codex .lp-codex-k-green { color: var(--lp-codex-k-green); }
.lp-codex .lp-codex-k-teal { color: var(--lp-codex-k-teal); }
.lp-codex .lp-codex-status { padding: 10px 14px; background: var(--lp-codex-panel-2); color: var(--lp-codex-text); display: flex; gap: 12px; align-items: center; justify-content: space-between;
  box-shadow: 0 -4px 0 0 var(--lp-codex-ink), 0 4px 0 0 var(--lp-codex-ink), -4px 0 0 0 var(--lp-codex-ink), 4px 0 0 0 var(--lp-codex-ink); margin: 4px; }
.lp-codex .lp-codex-status b { color: var(--lp-codex-gold); font-weight: 400; }

/* ---- buttons: coloured by purpose, 4 px sill ------------------------------------------------- */
.lp-codex .lp-codex-btn { appearance: none; border: 0; cursor: pointer; height: 32px; padding: 0 14px; border-radius: 6px; background: var(--c, var(--lp-codex-orange)); color: var(--lp-codex-white);
  box-shadow: 0 4px 0 var(--cd, var(--lp-codex-orange-d)), 0 4px 0 2px var(--lp-codex-ink), 0 0 0 2px var(--lp-codex-ink); text-shadow: 0 2px 0 var(--lp-codex-shade-2); margin-bottom: 4px; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.lp-codex .lp-codex-btn:hover:not(:disabled) { filter: brightness(1.1); }
.lp-codex .lp-codex-btn:active:not(:disabled), .lp-codex .lp-codex-btn[aria-pressed="true"] { transform: translateY(4px); box-shadow: 0 0 0 var(--cd), 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-btn:disabled { filter: grayscale(.8) brightness(.7); cursor: default; }
.lp-codex .lp-codex-btn-blue { --c: var(--lp-codex-blue); --cd: var(--lp-codex-blue-d); }
.lp-codex .lp-codex-btn-red { --c: var(--lp-codex-red); --cd: var(--lp-codex-red-d); }
.lp-codex .lp-codex-btn-green { --c: var(--lp-codex-green); --cd: var(--lp-codex-green-d); }
.lp-codex .lp-codex-btn-teal { --c: var(--lp-codex-teal); --cd: var(--lp-codex-teal-d); }
.lp-codex .lp-codex-btn-violet { --c: var(--lp-codex-violet); --cd: var(--lp-codex-violet-d); }
.lp-codex .lp-codex-btn-grey { --c: var(--lp-codex-grey); --cd: var(--lp-codex-grey-d); }
.lp-codex .lp-codex-btn-gold { --c: var(--lp-codex-gold); --cd: var(--lp-codex-gold-d); color: var(--lp-codex-gold-ink); text-shadow: none; }
.lp-codex .lp-codex-btn-sm { height: 26px; padding: 0 10px; }
.lp-codex .lp-codex-tabs { display: flex; gap: 12px; margin: 0 4px; flex-wrap: wrap; }
.lp-codex .lp-codex-tab { --c: var(--lp-codex-panel-hi); --cd: var(--lp-codex-panel-2); }
.lp-codex .lp-codex-tab[aria-selected="true"] { --c: var(--lp-codex-red); --cd: var(--lp-codex-red-d); transform: translateY(4px); box-shadow: 0 0 0 var(--cd), 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-tab-n { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 3px; background: var(--lp-codex-gold); color: var(--lp-codex-gold-ink); text-shadow: none; }
.lp-codex .lp-codex-link { appearance: none; border: 0; background: none; padding: 0; color: var(--lp-codex-k-blue); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.lp-codex a.lp-codex-link { word-break: break-all; }

/* pixel switch (role=switch) */
.lp-codex .lp-codex-switch { appearance: none; border: 0; background: none; padding: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; color: var(--lp-codex-text); text-align: left; }
.lp-codex .lp-codex-switch-track { position: relative; width: 44px; height: 20px; flex: none; background: var(--lp-codex-panel-2); box-shadow: 0 0 0 2px var(--lp-codex-ink), inset 0 2px 0 var(--lp-codex-shade); }
.lp-codex .lp-codex-switch-thumb { position: absolute; left: 2px; top: 2px; width: 16px; height: 16px; background: var(--lp-codex-grey); box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-switch[aria-checked="true"] .lp-codex-switch-track { background: var(--lp-codex-teal-d); }
.lp-codex .lp-codex-switch[aria-checked="true"] .lp-codex-switch-thumb { left: 26px; background: var(--lp-codex-teal-l); }
.lp-codex .lp-codex-switch-state { color: var(--lp-codex-text-3); min-width: 2em; }
.lp-codex .lp-codex-choice { display: inline-flex; gap: 8px; flex-wrap: wrap; }
.lp-codex .lp-codex-field { display: grid; gap: 6px; }
.lp-codex .lp-codex-field > span { color: var(--lp-codex-text-2); }
.lp-codex .lp-codex-time { appearance: none; height: 32px; padding: 0 8px; border: 0; border-radius: 4px; background: var(--lp-codex-panel-2); color: var(--lp-codex-text); font: inherit; box-shadow: 0 0 0 2px var(--lp-codex-ink), inset 0 2px 0 var(--lp-codex-shade); }
.lp-codex .lp-codex-times { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* chips */
.lp-codex .lp-codex-chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: 4px; background: var(--c, var(--lp-codex-panel-hi)); color: var(--lp-codex-white); box-shadow: 0 2px 0 var(--cd, var(--lp-codex-panel-2)); text-shadow: 0 1px 0 var(--lp-codex-shade-2); white-space: nowrap; }
.lp-codex .lp-codex-chip img { width: 11px; height: 11px; }
.lp-codex .lp-codex-chip-cell { --c: var(--lp-codex-copper); --cd: var(--lp-codex-copper-d); }
.lp-codex .lp-codex-chip-animal { --c: var(--lp-codex-silver); --cd: var(--lp-codex-silver-d); }
.lp-codex .lp-codex-chip-human { --c: var(--lp-codex-violet); --cd: var(--lp-codex-violet-d); }
.lp-codex .lp-codex-chip-trial { --c: var(--lp-codex-gold); --cd: var(--lp-codex-gold-d); color: var(--lp-codex-gold-ink); text-shadow: none; }
.lp-codex .lp-codex-chip-exp { --c: var(--lp-codex-teal); --cd: var(--lp-codex-teal-d); }
.lp-codex .lp-codex-chip-species { --c: var(--lp-codex-night); --cd: var(--lp-codex-night-d); }
.lp-codex .lp-codex-chip-kraft { --c: var(--lp-codex-kraft); --cd: var(--lp-codex-kraft-d); }
.lp-codex .lp-codex-chip-orange { --c: var(--lp-codex-orange); --cd: var(--lp-codex-orange-d); }
.lp-codex .lp-codex-chip-blue { --c: var(--lp-codex-blue); --cd: var(--lp-codex-blue-d); }
.lp-codex .lp-codex-chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.lp-codex .lp-codex-filter { appearance: none; border: 0; cursor: pointer; height: 26px; padding: 0 10px; border-radius: 4px; background: var(--c, var(--lp-codex-panel-hi)); color: var(--lp-codex-white); box-shadow: 0 3px 0 var(--cd, var(--lp-codex-panel-2)), 0 0 0 2px var(--lp-codex-ink); margin-bottom: 3px; }
.lp-codex .lp-codex-filter-off { filter: saturate(.25) brightness(.8); }
.lp-codex .lp-codex-filter[aria-pressed="true"] { transform: translateY(3px); box-shadow: 0 0 0 var(--cd), 0 0 0 2px var(--lp-codex-gold); }
.lp-codex .lp-codex-filter.lp-codex-chip-trial { color: var(--lp-codex-gold-ink); }

/* ---- card -------------------------------------------------------------------------- */
.lp-codex .lp-codex-pc { --u: 4px; --rx: 0deg; --ry: 0deg; --ty: 0px; --mx: 50%; --my: 50%; position: relative; width: calc(var(--u) * 50); height: calc(var(--u) * 70); flex: none; perspective: 700px; }
.lp-codex .lp-codex-s2 { --u: 2px; }
.lp-codex .lp-codex-s3 { --u: 3px; }
.lp-codex .lp-codex-s6 { --u: 6px; }
.lp-codex .lp-codex-tilt { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateX(var(--rx)) rotateY(var(--ry)) translateY(var(--ty)); transition: transform .38s cubic-bezier(.2, 1.4, .4, 1); filter: drop-shadow(0 calc(var(--u) * 1.5) 0 var(--lp-codex-shade)); }
.lp-codex .lp-codex-flipped .lp-codex-tilt { transform: rotateY(180deg) rotateX(var(--rx)) translateY(var(--ty)); }
.lp-codex .lp-codex-side { position: absolute; inset: 0; backface-visibility: hidden; }
.lp-codex .lp-codex-front { transform: rotateY(0deg); }
.lp-codex .lp-codex-back { transform: rotateY(180deg); }
.lp-codex .lp-codex-face { position: absolute; inset: 0; width: 100%; height: 100%; }
.lp-codex .lp-codex-t { position: absolute; display: flex; align-items: center; white-space: nowrap; overflow: hidden; }
.lp-codex .lp-codex-no { left: calc(var(--u) * 6); top: calc(var(--u) * 5); height: calc(var(--u) * 5); color: var(--lp-codex-paper-no); }
.lp-codex .lp-codex-gem { position: absolute; left: calc(var(--u) * 37); top: calc(var(--u) * 2); width: calc(var(--u) * 9); height: calc(var(--u) * 9); }
.lp-codex .lp-codex-tier { left: calc(var(--u) * 21); top: calc(var(--u) * 44.5); height: calc(var(--u) * 5); color: var(--lp-codex-paper-label); }
.lp-codex .lp-codex-tier-r { left: auto; right: calc(var(--u) * 5); }
.lp-codex .lp-codex-name { left: calc(var(--u) * 6); right: calc(var(--u) * 6); top: calc(var(--u) * 51); height: calc(var(--u) * 9); display: block; line-height: calc(var(--u) * 9); text-align: center; text-overflow: ellipsis; color: var(--lp-codex-white); text-shadow: 0 1px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-sub { left: calc(var(--u) * 6); right: calc(var(--u) * 6); top: calc(var(--u) * 61.5); height: calc(var(--u) * 4.5); justify-content: space-between; color: var(--lp-codex-paper-no); gap: 6px; }
.lp-codex .lp-codex-sub > span { overflow: hidden; text-overflow: ellipsis; }
.lp-codex .lp-codex-pc[data-family="species"] .lp-codex-no, .lp-codex .lp-codex-pc[data-family="species"] .lp-codex-sub { color: var(--lp-codex-night-no); }
.lp-codex .lp-codex-s6 .lp-codex-name { font-size: 24px; }
.lp-codex .lp-codex-s6 .lp-codex-name.lp-codex-long { font-size: 12px; }
.lp-codex .lp-codex-s3 .lp-codex-tier, .lp-codex .lp-codex-s2 .lp-codex-t, .lp-codex .lp-codex-s2 .lp-codex-gem { display: none; }
.lp-codex .lp-codex-s3 .lp-codex-name { top: calc(var(--u) * 50.5); }
.lp-codex .lp-codex-s3 .lp-codex-name.lp-codex-two { display: flex; align-items: center; justify-content: center; white-space: normal; line-height: 13px; overflow-wrap: anywhere; padding: 0 2px; }
.lp-codex .lp-codex-s3 .lp-codex-sub { top: calc(var(--u) * 61); height: calc(var(--u) * 5); }
.lp-codex .lp-codex-shine { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .2s; background: radial-gradient(circle at var(--mx) var(--my), var(--lp-codex-gleam), transparent 42%); mix-blend-mode: soft-light; }
.lp-codex .lp-codex-live { cursor: pointer; }
.lp-codex .lp-codex-live:hover .lp-codex-shine { opacity: 1; }
.lp-codex .lp-codex-live:hover { --ty: calc(var(--u) * -2); z-index: 5; }
.lp-codex .lp-codex-pc:focus-visible { outline: 3px solid var(--lp-codex-gold); outline-offset: 6px; }
.lp-codex .lp-codex-seal { position: absolute; z-index: 2; left: calc(var(--u) * 3); top: calc(var(--u) * 33); width: calc(var(--u) * 11); height: calc(var(--u) * 11); }
.lp-codex .lp-codex-lockq { position: absolute; left: 0; right: 0; top: calc(var(--u) * 50); height: calc(var(--u) * 11); display: grid; place-items: center; color: var(--lp-codex-teal-l); text-shadow: 0 2px 0 var(--lp-codex-ink); }
/* the 镭射 layer: only for an experiment whose primary result was outside the usual variation */
.lp-codex .lp-codex-holo { position: absolute; inset: calc(var(--u) * 1); pointer-events: none; mix-blend-mode: color; opacity: .42; animation: lp-codex-holo 5s steps(20) infinite;
  background: repeating-linear-gradient(120deg, var(--lp-codex-foil-1) 0, var(--lp-codex-foil-2) 6%, var(--lp-codex-foil-3) 12%, var(--lp-codex-foil-4) 18%, var(--lp-codex-foil-5) 24%, var(--lp-codex-foil-1) 30%); background-size: 200% 200%; }
@keyframes lp-codex-holo { to { background-position: 200% 200%; } }
.lp-codex .lp-codex-stamp { position: absolute; z-index: 2; left: calc(var(--u) * 8); right: calc(var(--u) * 8); top: calc(var(--u) * 34); height: calc(var(--u) * 7); display: grid; place-items: center; background: var(--lp-codex-red); color: var(--lp-codex-white); white-space: nowrap; box-shadow: 0 0 0 2px var(--lp-codex-ink), 0 3px 0 2px var(--lp-codex-ink); transform: rotate(-6deg); text-shadow: 0 1px 0 var(--lp-codex-shade); }
.lp-codex .lp-codex-s6 .lp-codex-stamp { font-size: 24px; }
.lp-codex .lp-codex-stamp.lp-codex-calm { background: var(--lp-codex-grey); transform: none; }
.lp-codex .lp-codex-bob { animation: lp-codex-bob 3s ease-in-out infinite; animation-delay: var(--d, 0s); }
@keyframes lp-codex-bob { 0%, 100% { transform: translateY(0) rotate(-.6deg); } 50% { transform: translateY(-4px) rotate(.6deg); } }

/* card with its text beside it */
.lp-codex .lp-codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(164px, 1fr)); gap: 20px 12px; justify-items: center; }
.lp-codex .lp-codex-hand { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
.lp-codex .lp-codex-pair { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: start; }
.lp-codex .lp-codex-duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 12px 16px; align-items: stretch; }
.lp-codex .lp-codex-pairs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); gap: 20px; }

/* ---- info box (hover and detail) -------------------------------------------- */
.lp-codex .lp-codex-tip { position: absolute; z-index: 25; width: 268px; pointer-events: none; }
.lp-codex .lp-codex-info { background: var(--lp-codex-panel-2); padding: 12px; display: grid; gap: 10px; text-align: center; min-width: 0;
  box-shadow: 0 -4px 0 0 var(--lp-codex-ink), 0 4px 0 0 var(--lp-codex-ink), -4px 0 0 0 var(--lp-codex-ink), 4px 0 0 0 var(--lp-codex-ink), 0 10px 0 0 var(--lp-codex-shade), inset 0 3px 0 0 var(--lp-codex-panel-in); }
.lp-codex .lp-codex-info-h { margin: 0; font-size: 24px; line-height: 28px; font-weight: 400; color: var(--lp-codex-white); text-shadow: 0 2px 0 var(--lp-codex-ink); overflow-wrap: anywhere; }
.lp-codex .lp-codex-info-h.lp-codex-long { font-size: 12px; line-height: 20px; }
.lp-codex .lp-codex-desc { background: var(--lp-codex-cream); color: var(--lp-codex-cream-ink); padding: 8px 10px; text-align: left; border-radius: 4px; box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-hl-k { color: var(--lp-codex-desc-k); }
.lp-codex .lp-codex-hl-s { color: var(--lp-codex-desc-ks); }
.lp-codex .lp-codex-hl-n { color: var(--lp-codex-desc-kn); }
.lp-codex .lp-codex-pills { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.lp-codex .lp-codex-more { text-align: left; color: var(--lp-codex-text-2); display: grid; gap: 10px; }
.lp-codex .lp-codex-more b { color: var(--lp-codex-gold); font-weight: 400; display: block; }
.lp-codex .lp-codex-mine { background: var(--lp-codex-teal-d); color: var(--lp-codex-white); padding: 8px 10px; text-align: left; box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-mine b { color: var(--lp-codex-teal-l); font-weight: 400; display: block; }
.lp-codex .lp-codex-src { color: var(--lp-codex-text-3); text-align: left; overflow-wrap: anywhere; display: grid; gap: 4px; }
.lp-codex .lp-codex-coi { color: var(--lp-codex-note-ink); background: var(--lp-codex-note-bg); padding: 6px 8px; box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-readmark { display: inline-flex; align-items: center; gap: 6px; color: var(--lp-codex-k-blue); }
.lp-codex .lp-codex-readmark img { width: 22px; height: 22px; }

/* ---- packs --------------------------------------------------------------------------- */
.lp-codex .lp-codex-shelf { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-end; }
.lp-codex .lp-codex-pack { appearance: none; border: 0; background: none; padding: 0; cursor: pointer; display: grid; justify-items: center; gap: 8px; color: var(--lp-codex-text); max-width: 200px; text-align: center; }
.lp-codex .lp-codex-pack img { width: 120px; height: 168px; filter: drop-shadow(0 6px 0 var(--lp-codex-shade)); }
.lp-codex .lp-codex-pack:hover img { filter: drop-shadow(0 6px 0 var(--lp-codex-shade)) brightness(1.08); }
.lp-codex .lp-codex-pname { font-size: 24px; line-height: 28px; color: var(--lp-codex-white); text-shadow: 0 2px 0 var(--lp-codex-ink); }

/* ---- overlay: covers the container; the stage sits where the person is looking -------------- */
.lp-codex .lp-codex-ov { position: absolute; inset: 0; z-index: 20; background: var(--lp-codex-veil); }
.lp-codex .lp-codex-stage { position: absolute; left: 0; right: 0; display: grid; justify-items: center; gap: 16px; padding: 16px; }
.lp-codex .lp-codex-stage:focus { outline: none; }
.lp-codex .lp-codex-ov-close { position: absolute; right: 16px; top: 0; }
.lp-codex .lp-codex-ov-line { color: var(--lp-codex-text); text-align: center; max-width: 560px; text-shadow: 0 2px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-ov-line.lp-codex-big { font-size: 24px; line-height: 30px; }
.lp-codex .lp-codex-ov-row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; justify-content: center; width: 100%; }
.lp-codex .lp-codex-ov-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.lp-codex .lp-codex-ov-side { width: min(340px, 100%); display: grid; gap: 14px; }
.lp-codex .lp-codex-ovpack { appearance: none; border: 0; background: none; padding: 0; cursor: pointer; }
.lp-codex .lp-codex-ovpack img { width: 180px; height: 252px; filter: drop-shadow(0 8px 0 var(--lp-codex-shade)); }
.lp-codex .lp-codex-idle img { animation: lp-codex-idle 1.4s ease-in-out infinite; }
@keyframes lp-codex-idle { 50% { transform: translateY(-6px) rotate(2deg); } }
.lp-codex .lp-codex-shake img { animation: lp-codex-shake .5s steps(10) forwards; }
@keyframes lp-codex-shake { 10% { transform: rotate(-6deg); } 20% { transform: rotate(6deg); } 30% { transform: rotate(-8deg) scale(1.04); } 40% { transform: rotate(8deg) scale(1.04); } 50% { transform: rotate(-10deg) scale(1.08); } 60% { transform: rotate(10deg) scale(1.08); } 70% { transform: rotate(-6deg) scale(1.12); } 80% { transform: rotate(6deg) scale(1.12); } 100% { transform: scale(1.2); opacity: 0; } }
.lp-codex .lp-codex-deal { animation: lp-codex-deal .55s cubic-bezier(.2, 1.5, .4, 1) both; animation-delay: var(--d, 0s); }
@keyframes lp-codex-deal { from { transform: translateY(160px) scale(.5) rotate(-12deg); opacity: 0; } }
.lp-codex .lp-codex-pop { animation: lp-codex-pop .45s cubic-bezier(.2, 1.9, .4, 1) both; animation-delay: var(--d, 0s); }
@keyframes lp-codex-pop { from { transform: scale(.6); opacity: 0; } }
.lp-codex .lp-codex-shards { position: absolute; inset: 0; z-index: 30; pointer-events: none; overflow: clip; }
.lp-codex .lp-codex-shard { position: absolute; width: 8px; height: 8px; background: var(--c, var(--lp-codex-white)); box-shadow: 0 0 0 2px var(--lp-codex-ink); animation: lp-codex-burst .8s cubic-bezier(.1, .8, .3, 1) forwards; }
@keyframes lp-codex-burst { to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }
.lp-codex .lp-codex-slot { appearance: none; border: 0; background: none; padding: 0; color: inherit; text-align: left; cursor: pointer; display: grid; gap: 12px; justify-items: center; width: 220px; transition: transform .25s steps(5), opacity .25s steps(5); }
.lp-codex .lp-codex-slot.lp-codex-out { opacity: .3; transform: translateY(12px) scale(.92); }
.lp-codex .lp-codex-slot.lp-codex-picked { width: auto; }
.lp-codex .lp-codex-slot-sm { width: auto; }
.lp-codex .lp-codex-ov-rest { align-items: center; }
.lp-codex .lp-codex-rest-note { flex-basis: 100%; text-align: center; }
.lp-codex .lp-codex-slot.lp-codex-gone { opacity: 0; transform: translate(-80px, 120px) scale(.5); }
.lp-codex .lp-codex-slot-text { display: grid; gap: 4px; width: 100%; color: var(--lp-codex-text-2); }
.lp-codex .lp-codex-slot-text b { color: var(--lp-codex-gold); font-weight: 400; }
.lp-codex .lp-codex-ask { display: grid; gap: 8px; }
.lp-codex .lp-codex-ask-q { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lp-codex .lp-codex-confirm { width: min(420px, 100%); display: grid; gap: 14px; }

/* ---- experiments ---------------------------------------------------------------- */
.lp-codex .lp-codex-run-day { font-size: 24px; line-height: 28px; color: var(--lp-codex-white); text-shadow: 0 2px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-today { display: inline-flex; padding: 2px 8px; background: var(--lp-codex-teal-d); color: var(--lp-codex-white); box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-fold { color: var(--lp-codex-text-2); }
.lp-codex .lp-codex-fold > summary { cursor: pointer; color: var(--lp-codex-k-blue); list-style: none; display: inline-flex; gap: 6px; margin: 0; font-size: 12px; line-height: 20px; }
.lp-codex .lp-codex-fold > summary:hover { color: var(--lp-codex-white); }
.lp-codex .lp-codex-fold > summary::-webkit-details-marker { display: none; }
.lp-codex .lp-codex-fold > summary::before, .lp-codex .lp-codex-fold[open] > summary::before { content: "▸"; width: auto; height: auto; border: 0; margin: 0; transform: none; transition: none; }
.lp-codex .lp-codex-fold[open] > summary::before { content: "▾"; }
.lp-codex .lp-codex-fold > p { margin-top: 6px; }
.lp-codex .lp-codex-result { display: grid; gap: 10px; text-align: left; }
.lp-codex .lp-codex-result-main { font-size: 24px; line-height: 32px; color: var(--lp-codex-white); text-shadow: 0 2px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-praise { padding: 8px 10px; background: var(--lp-codex-green-d); color: var(--lp-codex-white); box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-also { color: var(--lp-codex-text-2); }
.lp-codex .lp-codex-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.lp-codex .lp-codex-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px 12px; background: var(--lp-codex-panel-2); box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-item img { width: 50px; height: 70px; }
.lp-codex .lp-codex-item-main { display: grid; gap: 2px; min-width: 0; }
.lp-codex .lp-codex-item-main b { color: var(--lp-codex-white); font-weight: 400; }
.lp-codex .lp-codex-item-btn { appearance: none; border: 0; background: var(--lp-codex-panel-2); color: inherit; padding: 10px 12px; text-align: left; cursor: pointer; width: 100%; }
.lp-codex .lp-codex-item-btn:hover { background: var(--lp-codex-panel); }
.lp-codex .lp-codex-item img.lp-codex-gemi { width: 18px; height: 18px; flex: none; }
.lp-codex .lp-codex-empty { color: var(--lp-codex-text-2); padding: 12px 0; }

/* ---- library ------------------------------------------------------------------------ */
.lp-codex .lp-codex-chapters { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.lp-codex .lp-codex-chapter { appearance: none; border: 0; text-align: left; cursor: pointer; display: grid; gap: 6px; padding: 10px; background: var(--lp-codex-panel); color: var(--lp-codex-text); margin: 2px;
  box-shadow: 0 -2px 0 0 var(--lp-codex-ink), 0 2px 0 0 var(--lp-codex-ink), -2px 0 0 0 var(--lp-codex-ink), 2px 0 0 0 var(--lp-codex-ink), 0 5px 0 0 var(--lp-codex-shade-2); }
.lp-codex .lp-codex-chapter[aria-pressed="true"] { background: var(--lp-codex-panel-hi); box-shadow: 0 -2px 0 0 var(--lp-codex-gold), 0 2px 0 0 var(--lp-codex-gold), -2px 0 0 0 var(--lp-codex-gold), 2px 0 0 0 var(--lp-codex-gold), 0 5px 0 0 var(--lp-codex-shade-2); }
.lp-codex .lp-codex-chapter-t { display: flex; align-items: center; gap: 6px; }
.lp-codex .lp-codex-chapter-t img { width: 22px; height: 22px; }
.lp-codex .lp-codex-chapter-c { display: flex; justify-content: space-between; color: var(--lp-codex-text-3); }
.lp-codex .lp-codex-bar { height: 8px; background: var(--lp-codex-ink); box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-bar > span { display: block; height: 100%; background: var(--c, var(--lp-codex-blue)); }

/* ---- species log -------------------------------------------------------------------------- */
.lp-codex .lp-codex-latin { font-style: italic; color: var(--lp-codex-text-3); }
.lp-codex .lp-codex-entry { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; align-items: start; padding: 12px; background: var(--lp-codex-panel-2); box-shadow: 0 0 0 2px var(--lp-codex-ink); }
.lp-codex .lp-codex-entry-h { font-size: 24px; line-height: 28px; color: var(--lp-codex-white); text-shadow: 0 2px 0 var(--lp-codex-ink); }
.lp-codex .lp-codex-entries { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 16px; }

/* ---- settings ---------------------------------------------------------------------------- */
.lp-codex .lp-codex-set { display: grid; gap: 18px; }
.lp-codex .lp-codex-set-row { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 8px 20px; align-items: start; }
.lp-codex .lp-codex-set-row > span { color: var(--lp-codex-text-2); padding-top: 4px; }
.lp-codex .lp-codex-rules { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; color: var(--lp-codex-text-2); }
.lp-codex .lp-codex-rules li::before { content: "■ "; color: var(--lp-codex-teal-l); }

/* ---- 简洁模式 and narrow panes -------------------------------------------------------------- */
.lp-codex.lp-codex-simple .lp-codex-bob, .lp-codex.lp-codex-simple .lp-codex-deal { animation: none; }
@container lp-codex (max-width: 720px) {
.lp-codex .lp-codex-body { padding: 16px 12px 40px; gap: 16px; }
.lp-codex .lp-codex-h1 { font-size: 24px; line-height: 28px; }
.lp-codex .lp-codex-set-row { grid-template-columns: minmax(0, 1fr); }
.lp-codex .lp-codex-tabs { gap: 8px; }
.lp-codex .lp-codex-tabs .lp-codex-btn { padding: 0 10px; }
.lp-codex .lp-codex-grid { grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 16px 8px; }
.lp-codex .lp-codex-chapters { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.lp-codex .lp-codex-shelf { gap: 16px; }
.lp-codex .lp-codex-box { padding: 12px; }
}
@container lp-codex (max-width: 540px) {
.lp-codex .lp-codex-pair { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.lp-codex .lp-codex-pair > .lp-codex-stack { justify-self: stretch; }
.lp-codex .lp-codex-entry { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.lp-codex .lp-codex-entry > .lp-codex-stack { justify-self: stretch; }
}

/* ---- motion: reduced motion keeps only the end state of a flip; 演示模式 plays nothing ----------------- */
@media (prefers-reduced-motion: reduce) {
.lp-codex .lp-codex-bob, .lp-codex .lp-codex-deal, .lp-codex .lp-codex-pop, .lp-codex .lp-codex-idle img, .lp-codex .lp-codex-shake img { animation: none !important; }
.lp-codex .lp-codex-tilt, .lp-codex .lp-codex-slot, .lp-codex .lp-codex-shine { transition: none !important; }
.lp-codex .lp-codex-holo, .lp-codex .lp-codex-shard, .lp-codex .lp-codex-shine { display: none; }
}
.lp-codex.lp-codex-still *, .lp-codex.lp-codex-still *::before, .lp-codex.lp-codex-still *::after { animation: none !important; transition: none !important; }
.lp-codex.lp-codex-still .lp-codex-shard, .lp-codex.lp-codex-still .lp-codex-shine { display: none; }
`
