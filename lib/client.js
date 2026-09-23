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
		//#region src/client/constants.ts
		const VIEW_ID = "longpi-board";
		const SUGGESTED = [
			{
				id: "dispatch",
				zh: "根据我的档案和检查，现在能跑哪些长寿方法？还差哪几项？"
			},
			{
				id: "pheno",
				zh: "用我记录里的血检算表型年龄，数值和单位按记录原样传，缺的不要补。"
			},
			{
				id: "evidence",
				zh: "NMN 和二甲双胍在收录的论文里有什么说法？分人群、动物和细胞说，不要给剂量。"
			},
			{
				id: "meds",
				zh: "我的用药计划在收录的论文里有什么说法？只读，不要建议加减量。"
			}
		];
		//#endregion
		//#region src/client/panel.ts
		function api(path) {
			const token = new URLSearchParams(window.location.search).get("token");
			if (!token) return path;
			return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
		}
		function registerPanel(ctx) {
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: VIEW_ID,
				order: 18,
				label: () => "健康看板"
			}, PanelView));
		}
		function PanelView() {
			const [board, setBoard] = react.default.useState(null);
			const [error, setError] = react.default.useState(null);
			const [displayName, setDisplayName] = react.default.useState("");
			const [birthYear, setBirthYear] = react.default.useState("");
			const [age, setAge] = react.default.useState("");
			const [sex, setSex] = react.default.useState("unknown");
			const [question, setQuestion] = react.default.useState("");
			const [matches, setMatches] = react.default.useState(null);
			const [note, setNote] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const load = react.default.useCallback(() => {
				fetch(api("/api/longpi/board"), { credentials: "include" }).then(async (res) => {
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					return res.json();
				}).then((json) => {
					setBoard(json);
					setError(null);
					setDisplayName(json.profile?.displayName ?? "");
					setBirthYear(json.profile?.birthYear ? String(json.profile.birthYear) : "");
					setAge(json.profile?.age == null ? "" : String(json.profile.age));
					setSex(json.profile?.sex || "unknown");
					setMatches(json.dispatch?.matches ?? []);
					setNote(json.dispatch?.note ?? "");
				}).catch((err) => setError(err instanceof Error ? err.message : "看板没有打开"));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			async function saveProfile(event) {
				event.preventDefault();
				setBusy(true);
				try {
					const res = await fetch(api("/api/longpi/profile"), {
						method: "POST",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							displayName,
							birthYear: birthYear.trim() ? Number(birthYear) : null,
							age: age.trim() ? Number(age) : null,
							sex
						})
					});
					const json = await res.json();
					if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
					load();
				} catch (err) {
					setError(err instanceof Error ? err.message : "档案没有保存");
				} finally {
					setBusy(false);
				}
			}
			async function ask(event) {
				event.preventDefault();
				setBusy(true);
				try {
					const res = await fetch(api(`/api/longpi/match?q=${encodeURIComponent(question)}`), { credentials: "include" });
					const json = await res.json();
					if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
					setMatches(json.matches ?? []);
					setNote(json.note ?? "");
				} catch (err) {
					setError(err instanceof Error ? err.message : "没有匹配到技能");
				} finally {
					setBusy(false);
				}
			}
			const engine = board?.mirobody?.engine;
			const engineLine = !board?.mirobody?.mounted ? board?.mirobody?.error || "Mirobody 未挂上" : engine?.ok ? `引擎 ${engine.version || "就绪"}` : engine?.error || "引擎未就绪";
			const recordLine = board?.records?.status === "ok" ? `${board.records.indicators?.length ?? 0} 项检查，${board.records.medications?.length ?? 0} 条用药` : board?.records?.status === "unconfigured" ? "还没有接上记录服务器" : board?.records?.error || "记录没读到";
			return react.default.createElement("div", { className: "lp-dash" }, react.default.createElement("div", { className: "lp-kicker" }, `LongPi ${board?.version ?? ""}`), react.default.createElement("h2", { className: "lp-title" }, displayName.trim() || "个人长寿看板"), react.default.createElement("p", { className: "lp-lead" }, "技能按你的问题和已经在档的检查来调度。公式留在技能里。这里不诊断，也不改处方。"), error ? react.default.createElement("p", { className: "lp-bad" }, error) : null, react.default.createElement("div", { className: "lp-grid" }, react.default.createElement("section", { className: "lp-card" }, react.default.createElement("h3", null, "技能库"), react.default.createElement("p", { className: board?.skills?.error ? "lp-bad" : "lp-ok" }, board?.skills?.error || `${board?.skills?.personal ?? board?.skills?.count ?? 0} 个个人可用 · 共 ${board?.skills?.count ?? 0} 个`), react.default.createElement("p", { className: "lp-muted" }, `版本 ${board?.skills?.version || "未发布"} · ${board?.skills?.revision || "未读到提交"}`)), react.default.createElement("section", { className: "lp-card" }, react.default.createElement("h3", null, "数据缝"), react.default.createElement("p", { className: engine?.ok ? "lp-ok" : "lp-bad" }, engineLine), react.default.createElement("p", null, recordLine), react.default.createElement("p", { className: "lp-muted" }, board?.mirobody?.mcp?.configured ? board.mirobody.mcp.host || "记录服务器已配置" : "术语工具不需要记录服务器")), react.default.createElement("section", { className: "lp-card" }, react.default.createElement("h3", null, "实足年龄"), react.default.createElement("p", null, board?.profile?.age == null ? "还没写下实足年龄" : `${board.profile.age} 岁`), react.default.createElement("p", { className: "lp-muted" }, board?.estimated_age == null ? "出生年可用来估算，估算不会自动送进技能" : `按出生年约 ${board.estimated_age} 岁`))), react.default.createElement("section", { className: "lp-block" }, react.default.createElement("h3", null, "这个人"), react.default.createElement("form", {
				className: "lp-form",
				onSubmit: (event) => {
					saveProfile(event);
				}
			}, react.default.createElement("input", {
				"aria-label": "称呼",
				placeholder: "称呼",
				value: displayName,
				onChange: (event) => setDisplayName(event.target.value)
			}), react.default.createElement("input", {
				"aria-label": "出生年",
				placeholder: "出生年",
				inputMode: "numeric",
				value: birthYear,
				onChange: (event) => setBirthYear(event.target.value)
			}), react.default.createElement("input", {
				"aria-label": "实足年龄",
				placeholder: "实足年龄",
				inputMode: "numeric",
				value: age,
				onChange: (event) => setAge(event.target.value)
			}), react.default.createElement("select", {
				"aria-label": "性别",
				value: sex,
				onChange: (event) => setSex(event.target.value)
			}, react.default.createElement("option", { value: "unknown" }, "性别未填"), react.default.createElement("option", { value: "female" }, "女"), react.default.createElement("option", { value: "male" }, "男"), react.default.createElement("option", { value: "other" }, "其他")), react.default.createElement("button", {
				type: "submit",
				disabled: busy
			}, busy ? "保存中" : "保存"))), (board?.readouts ?? []).length > 0 ? react.default.createElement("section", {
				className: "lp-block",
				style: { marginTop: 12 }
			}, react.default.createElement("h3", null, "最近读出"), ...(board?.readouts ?? []).map((item) => react.default.createElement("div", {
				className: "lp-row",
				key: item.key
			}, react.default.createElement("span", null, item.label_zh || item.key), react.default.createElement("span", null, `${formatValue(item.value)}${item.unit && item.unit !== "1" ? ` ${unitLabel(item.unit)}` : ""} · ${(item.at || "").slice(0, 10)}`)))) : null, (board?.near ?? []).length > 0 ? react.default.createElement("section", {
				className: "lp-block",
				style: { marginTop: 12 }
			}, react.default.createElement("h3", null, "差一两项就能跑"), ...(board?.near ?? []).map((item) => react.default.createElement("div", {
				className: "lp-skill",
				key: `near-${item.name}`
			}, react.default.createElement("span", { className: "lp-name" }, item.name), react.default.createElement("span", { className: "lp-why" }, `还缺 ${(item.runnable?.missing ?? []).join("、")}`)))) : null, react.default.createElement("section", {
				className: "lp-block",
				style: { marginTop: 12 }
			}, react.default.createElement("h3", null, "这次调度"), react.default.createElement("form", {
				className: "lp-search",
				onSubmit: (event) => {
					ask(event);
				}
			}, react.default.createElement("input", {
				"aria-label": "想读的方法",
				placeholder: "例如：我的生物年龄、甲基化、NMN 有用吗",
				value: question,
				onChange: (event) => setQuestion(event.target.value)
			}), react.default.createElement("button", {
				type: "submit",
				disabled: busy
			}, "匹配")), note ? react.default.createElement("p", { className: "lp-muted" }, note) : null, ...(matches ?? []).map((item) => react.default.createElement("div", {
				className: "lp-skill",
				key: item.name
			}, react.default.createElement("span", { className: "lp-name" }, item.name), react.default.createElement("span", { className: "lp-why" }, (item.why ?? []).join("；") || item.blurb || ""))), react.default.createElement("div", { className: "lp-domains" }, ...(board?.skills?.domains ?? []).slice(0, 16).map((item) => react.default.createElement("span", {
				className: "lp-domain",
				key: item.domain
			}, `${item.domain} ${item.count}`)))), react.default.createElement("section", {
				className: "lp-block",
				style: { marginTop: 12 }
			}, react.default.createElement("h3", null, "检查"), (board?.records?.indicators ?? []).length === 0 ? react.default.createElement("p", { className: "lp-muted" }, "没有读到检查。接上 Mirobody 之后，这里只显示记录里有的项目。") : (board?.records?.indicators ?? []).map((item) => react.default.createElement("div", {
				className: "lp-row",
				key: item.name
			}, react.default.createElement("span", null, item.name), react.default.createElement("span", null, [item.value, item.unit].filter(Boolean).join(" ") || "在档")))), react.default.createElement("section", {
				className: "lp-block",
				style: { marginTop: 12 }
			}, react.default.createElement("h3", null, "用药计划"), (board?.records?.medications ?? []).length === 0 ? react.default.createElement("p", { className: "lp-muted" }, "没有读到用药计划。计划不是已经服下的证据，也不能在这里改剂量。") : (board?.records?.medications ?? []).map((item) => react.default.createElement("div", {
				className: "lp-row",
				key: item.name
			}, react.default.createElement("span", null, item.name), react.default.createElement("span", null, item.status || "在档")))), (board?.receipts ?? []).length > 0 ? react.default.createElement("section", {
				className: "lp-block",
				style: { marginTop: 12 }
			}, react.default.createElement("h3", null, "最近一次读出"), ...(board?.receipts ?? []).map((item) => react.default.createElement("div", {
				className: "lp-row",
				key: `${item.at}-${item.skill}`
			}, react.default.createElement("span", null, item.skill), react.default.createElement("span", null, item.ok ? "脚本跑完" : item.error_kind === "input_problems" || item.error_kind === "invalid_inputs" ? "输入没有通过检查" : "脚本没有给出读出")))) : null, react.default.createElement("p", { className: "lp-note" }, board?.boundary || "这不是诊断，也不能改处方。紧急情况请拨打 120。"));
		}
		function formatValue(value) {
			if (value == null) return "未计算";
			if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
			return value;
		}
		function unitLabel(unit) {
			return unit === "a" ? "岁" : unit;
		}
		function registerDock(ctx) {
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "dsh-plugin-longpi",
				order: 18
			}, SuggestDock));
		}
		function SuggestDock() {
			const [copied, setCopied] = react.default.useState(null);
			return react.default.createElement("div", { className: "lp-dock" }, react.default.createElement("span", { className: "lp-dock-kicker" }, "LongPi"), ...SUGGESTED.map((item) => react.default.createElement("button", {
				key: item.id,
				type: "button",
				className: copied === item.id ? "lp-chip lp-chip-on" : "lp-chip",
				onClick: () => {
					navigator.clipboard.writeText(item.zh).then(() => setCopied(item.id)).catch(() => setCopied(item.id));
				}
			}, item.zh)));
		}
		function registerSidebar(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-plugin-longpi",
				order: 18
			}, SidebarMark));
		}
		function SidebarMark(props) {
			return react.default.createElement("span", {
				className: "lp-sidebar",
				title: "LongPi"
			}, react.default.createElement("span", { className: "lp-dot" }), props.wide === false ? null : react.default.createElement("span", null, "LongPi"));
		}
		//#endregion
		//#region src/client/styles.ts
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
`;
		function injectStyles() {
			const id = "dsh-plugin-longpi-style";
			if (document.getElementById(id)) return;
			const style = document.createElement("style");
			style.id = id;
			style.textContent = CSS;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots"];
		function apply(ctx) {
			injectStyles();
			registerPanel(ctx);
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