window.__ModuleLoader__.load({
	id: "dsh-plugin-longpi",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/styles.ts
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
`;
		function injectStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-plugin-longpi-css")) return;
			const el = document.createElement("style");
			el.id = "dsh-plugin-longpi-css";
			el.textContent = CSS;
			document.head.appendChild(el);
		}
		//#endregion
		//#region src/client/constants.ts
		const NAMESPACE = "dsh-plugin-longpi";
		const VIEW_ID = "longpi-dashboard";
		//#endregion
		//#region src/client/prompts.ts
		const SUGGESTED = [
			{
				id: "crp",
				zh: "我的 hs-CRP 高吗？",
				en: "Is my hs-CRP high?"
			},
			{
				id: "iage",
				zh: "炎症年龄为什么比实际年龄大？",
				en: "Why is inflammatory age above chronological age?"
			},
			{
				id: "day",
				zh: "10 月 24 日当天怎么走？",
				en: "What is the Oct 24 itinerary?"
			},
			{
				id: "vo2",
				zh: "VO₂ Max 这次比上次好了吗？",
				en: "Did VO₂ Max improve versus last time?"
			},
			{
				id: "foxo3",
				zh: "我的 FOXO3 位点怎么解释？",
				en: "What does my FOXO3 genotype mean?"
			},
			{
				id: "s2f",
				zh: "用 AlphaGenome 给这个位点打分要怎么走？",
				en: "How do I score this variant with AlphaGenome?"
			}
		];
		//#endregion
		//#region src/client/radar.ts
		const ORDER = [
			"biological",
			"physiological",
			"psychological",
			"behavioral",
			"social_env"
		];
		function ModuleRadar(props) {
			const cx = 110;
			const cy = 110;
			const minAge = props.chrono - 10;
			const maxAge = props.chrono + 10;
			const point = (i, age) => {
				const t = i / ORDER.length * Math.PI * 2 - Math.PI / 2;
				const r = 28 + Math.min(1, Math.max(0, (age - minAge) / (maxAge - minAge))) * 60;
				return [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
			};
			const chronoPts = ORDER.map((_, i) => point(i, props.chrono).join(",")).join(" ");
			const modulePts = ORDER.map((key, i) => point(i, props.modules[key]?.age ?? props.chrono).join(",")).join(" ");
			return react.default.createElement("svg", {
				className: "lp-radar",
				viewBox: "0 0 220 240",
				width: 220,
				height: 240,
				"aria-hidden": true
			}, react.default.createElement("polygon", {
				points: chronoPts,
				fill: "none",
				stroke: "#C7D9D5",
				strokeDasharray: "4 4"
			}), react.default.createElement("polygon", {
				points: modulePts,
				fill: "rgba(45,95,90,0.14)",
				stroke: "#2D5F5A",
				strokeWidth: 2
			}), ...ORDER.map((key, i) => {
				const [x, y] = point(i, props.modules[key]?.age ?? props.chrono);
				const label = props.modules[key]?.label_zh ?? key;
				const lx = cx + Math.cos(i / ORDER.length * Math.PI * 2 - Math.PI / 2) * 104;
				const ly = cy + Math.sin(i / ORDER.length * Math.PI * 2 - Math.PI / 2) * 104;
				return react.default.createElement(react.default.Fragment, { key }, react.default.createElement("circle", {
					cx: x,
					cy: y,
					r: 3.5,
					fill: "#2D5F5A"
				}), react.default.createElement("text", {
					x: lx,
					y: ly,
					textAnchor: "middle",
					className: "lp-radar-label"
				}, label));
			}));
		}
		//#endregion
		//#region src/client/dashboard.ts
		function registerDashboard(ctx) {
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: VIEW_ID,
				order: 20,
				label: () => "LongPi"
			}, DashboardView));
		}
		async function copyPrompt(text) {
			try {
				await navigator.clipboard.writeText(text);
			} catch {}
		}
		function DashboardView() {
			const [data, setData] = react.default.useState(null);
			const [error, setError] = react.default.useState(null);
			const [copied, setCopied] = react.default.useState(null);
			react.default.useEffect(() => {
				let cancelled = false;
				const token = new URLSearchParams(window.location.search).get("token");
				const url = token ? `/api/longpi/dashboard?token=${encodeURIComponent(token)}` : "/api/longpi/dashboard";
				fetch(url, { credentials: "include" }).then(async (res) => {
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					return res.json();
				}).then((json) => {
					if (!cancelled) setData(json);
				}).catch((err) => {
					if (!cancelled) setError(err instanceof Error ? err.message : "load failed");
				});
				return () => {
					cancelled = true;
				};
			}, []);
			if (error) return react.default.createElement("div", { className: "lp-dash" }, react.default.createElement("p", { className: "lp-err" }, `无法加载 Dashboard：${error}`), react.default.createElement("p", { className: "lp-disc" }, "确认已安装 dsh-plugin-longpi 并重启 dsh web。"));
			if (!data) return react.default.createElement("div", { className: "lp-dash" }, react.default.createElement("p", { className: "lp-kicker" }, "加载演示面板…"));
			const delta = (data.customer.composite_age - data.customer.chrono_age).toFixed(1);
			const modules = Object.entries(data.customer.modules);
			return react.default.createElement("div", { className: "lp-dash" }, data.banner ? react.default.createElement("div", { className: "lp-banner" }, "演示数据 · 非个人病历 · DEMO DATA") : null, react.default.createElement("div", { className: "lp-kicker" }, `${data.brandName} · ${data.customer.display_name} · v${data.version ?? "1.0.1"}`), react.default.createElement("div", { className: "lp-hero" }, react.default.createElement("div", null, react.default.createElement("div", { className: "lp-north" }, react.default.createElement("div", { className: "lp-age" }, String(data.customer.composite_age)), react.default.createElement("div", { className: "lp-chrono" }, `综合生物年龄 · 实际 ${data.customer.chrono_age} 岁 · Δ ${delta}`)), react.default.createElement("p", { className: "lp-disc" }, data.customer.disclaimer_zh)), react.default.createElement(ModuleRadar, {
				chrono: data.customer.chrono_age,
				modules: data.customer.modules
			})), react.default.createElement("div", { className: "lp-modules" }, ...modules.map(([key, mod]) => react.default.createElement("div", {
				className: "lp-card",
				key
			}, react.default.createElement("h3", null, mod.label_zh), react.default.createElement("div", { className: "n" }, String(mod.age))))), react.default.createElement("div", { className: "lp-metrics" }, ...(data.metrics ?? []).map((m) => react.default.createElement("button", {
				key: m.code,
				type: "button",
				className: `lp-chip lp-chip-${m.status}`,
				onClick: () => {
					copyPrompt(`请解释我的${m.name_zh}（${m.code}），当前演示值 ${m.value} ${m.unit}。不要诊断，不要建议改药。`).then(() => setCopied(m.code));
				}
			}, `${m.name_zh} ${m.value}${m.unit}`))), copied ? react.default.createElement("p", { className: "lp-copied" }, "已复制提问，粘贴到 Chat 发送。") : react.default.createElement("p", { className: "lp-hint" }, "点击指标芯片 → 复制提问到剪贴板，在 Chat 粘贴。"), react.default.createElement("div", { className: "lp-grid" }, react.default.createElement("div", { className: "lp-card" }, react.default.createElement("h3", null, "本周洞察"), react.default.createElement("ul", null, ...data.insights.map((i) => react.default.createElement("li", { key: i.title_zh }, react.default.createElement("strong", null, i.title_zh), " — ", i.body_zh)))), react.default.createElement("div", { className: "lp-card" }, react.default.createElement("h3", null, "演示基因组 hg38"), react.default.createElement("ul", null, ...(data.genome?.variants ?? []).map((v) => react.default.createElement("li", { key: v.rsid }, react.default.createElement("strong", null, `${v.gene} ${v.rsid}`), ` ${v.gt} · ${v.hg38}`))), react.default.createElement("p", { className: "lp-hint" }, "合成面板，不是真实 WGS。问 FOXO3 / APOE 会走 annotate_variant。")), react.default.createElement("div", { className: "lp-card" }, react.default.createElement("h3", null, `${data.itinerary.date} 当日行程`), react.default.createElement("ul", null, ...data.itinerary.items.map((item) => react.default.createElement("li", { key: item.t }, react.default.createElement("span", { className: "lp-time" }, item.t), `${item.title_zh} · ${item.place_zh}`))))), react.default.createElement("div", { className: "lp-ask" }, react.default.createElement("h3", null, "问健康助手"), react.default.createElement("div", { className: "lp-ask-row" }, ...SUGGESTED.map((s) => react.default.createElement("button", {
				key: s.id,
				type: "button",
				className: "lp-ask-btn",
				onClick: () => {
					copyPrompt(s.zh).then(() => setCopied(s.id));
				}
			}, s.zh)))));
		}
		//#endregion
		//#region src/client/sidebar.ts
		function registerSidebar(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: NAMESPACE,
				order: 40
			}, SidebarMark));
		}
		function SidebarMark(props) {
			return react.default.createElement("span", {
				className: "lp-sidebar",
				title: "LongPi 健康助手"
			}, react.default.createElement("span", { className: "lp-dot" }), props.wide === false ? null : react.default.createElement("span", null, "LongPi"));
		}
		//#endregion
		//#region src/client/dock.ts
		function registerDock(ctx) {
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: NAMESPACE,
				order: 25
			}, SuggestDock));
		}
		function SuggestDock() {
			const [copied, setCopied] = react.default.useState(null);
			return react.default.createElement("div", { className: "lp-dock" }, react.default.createElement("span", { className: "lp-dock-kicker" }, "LongPi"), ...SUGGESTED.map((s) => react.default.createElement("button", {
				key: s.id,
				type: "button",
				className: copied === s.id ? "lp-dock-chip lp-dock-chip-on" : "lp-dock-chip",
				onClick: () => {
					navigator.clipboard.writeText(s.zh).then(() => setCopied(s.id)).catch(() => setCopied(s.id));
				}
			}, s.zh)));
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots"];
		function apply(ctx) {
			injectStyles();
			registerDashboard(ctx);
			registerSidebar(ctx);
			registerDock(ctx);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map