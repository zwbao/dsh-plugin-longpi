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
		//#region src/client/charts.ts
		const h$1 = react.default.createElement;
		function dayNumber(iso) {
			return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 864e5);
		}
		function monthLabel(iso) {
			const [year, month] = iso.slice(0, 10).split("-");
			return `${year?.slice(2)}/${month}`;
		}
		/** Two decimals under 10, one under 100, none above: 1.26 mmol/L, 44.8 岁, 125 mmHg. */
		function fmtAuto(value) {
			if (value == null || !Number.isFinite(value)) return "—";
			const size = Math.abs(value);
			return fmt(value, size >= 100 ? 0 : size >= 10 ? 1 : 2);
		}
		function fmt(value, digits = 1) {
			if (value == null || !Number.isFinite(value)) return "—";
			return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
		}
		function linear(d0, d1, r0, r1) {
			const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
			return (value) => r0 + (value - d0) * k;
		}
		function niceStep(span, count) {
			const raw = span / Math.max(1, count);
			const power = 10 ** Math.floor(Math.log10(raw || 1));
			const scaled = raw / power;
			return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10) * power;
		}
		function ticks(min, max, count = 3) {
			if (!(max > min)) return [min];
			const step = niceStep(max - min, count);
			const out = [];
			for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) out.push(Number(value.toFixed(10)));
			return out;
		}
		/** Width of an element, kept current as the board resizes. */
		function useWidth(fallback = 320) {
			const ref = react.default.useRef(null);
			const [width, setWidth] = react.default.useState(fallback);
			react.default.useLayoutEffect(() => {
				const node = ref.current;
				if (!node) return void 0;
				const update = () => setWidth(Math.max(160, Math.floor(node.getBoundingClientRect().width)));
				update();
				if (typeof ResizeObserver === "undefined") return void 0;
				const observer = new ResizeObserver(update);
				observer.observe(node);
				return () => observer.disconnect();
			}, []);
			return [ref, width];
		}
		function Tooltip(props) {
			const tip = props.tip;
			if (!tip) return null;
			const left = Math.min(Math.max(8, tip.x + 12), props.width - 168);
			return h$1("div", {
				className: "lp-tip",
				style: {
					left,
					top: Math.max(0, tip.y - 12)
				},
				role: "status"
			}, h$1("div", { className: "lp-tip-title" }, tip.title), ...tip.rows.map((row, index) => h$1("div", {
				className: "lp-tip-row",
				key: index
			}, h$1("span", { className: "lp-tip-value" }, row.value), h$1("span", { className: "lp-tip-label" }, row.label))));
		}
		function LineChart(props) {
			const [ref, width] = useWidth();
			const [tip, setTip] = react.default.useState(null);
			const [focus, setFocus] = react.default.useState(null);
			const height = props.height ?? 150;
			const digits = props.digits ?? 1;
			const pad = {
				top: 14,
				right: props.compact ? 10 : 56,
				bottom: props.compact ? 6 : 22,
				left: props.compact ? 6 : 36
			};
			const points = props.points;
			if (points.length === 0) return h$1("div", {
				ref,
				className: "lp-chart-empty"
			}, "还没有数据");
			const values = points.map((point) => point.value);
			const extra = [
				props.band?.low,
				props.band?.high,
				props.goal ?? void 0,
				props.reference?.value
			].filter((value) => typeof value === "number");
			let min = Math.min(...values, ...extra);
			let max = Math.max(...values, ...extra);
			if (max === min) {
				max += Math.abs(max) * .1 || 1;
				min -= Math.abs(min) * .1 || 1;
			}
			const span = max - min;
			min -= span * .12;
			max += span * .12;
			const days = points.map((point) => dayNumber(point.date));
			let d0 = Math.min(...days);
			let d1 = Math.max(...days);
			if (d0 === d1) {
				d0 -= 15;
				d1 += 15;
			}
			const x = linear(d0, d1, pad.left, width - pad.right);
			const y = linear(min, max, height - pad.bottom, pad.top);
			const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(dayNumber(point.date)).toFixed(1)},${y(point.value).toFixed(1)}`).join("");
			const area = `${path}L${x(days.at(-1)).toFixed(1)},${(height - pad.bottom).toFixed(1)}L${x(days[0]).toFixed(1)},${(height - pad.bottom).toFixed(1)}Z`;
			const yTicks = props.compact ? [] : ticks(min, max, 3);
			const last = points.at(-1);
			const nearest = (clientX, bounds) => {
				const at = clientX - bounds.left;
				let best = 0;
				for (let i = 1; i < points.length; i += 1) if (Math.abs(x(days[i]) - at) < Math.abs(x(days[best]) - at)) best = i;
				return best;
			};
			const show = (index) => {
				const point = points[index];
				setFocus(index);
				setTip({
					x: x(days[index]),
					y: y(point.value),
					title: point.date,
					rows: [{
						label: props.label,
						value: `${fmt(point.value, digits)} ${props.unit}`.trim()
					}]
				});
			};
			const bandFrom = props.band ? Math.max(pad.left, x(dayNumber(props.band.from))) : 0;
			return h$1("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$1("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：${points.map((point) => `${point.date} ${fmt(point.value, digits)}${props.unit}`).join("，")}`,
				onPointerMove: (event) => show(nearest(event.clientX, event.currentTarget.getBoundingClientRect())),
				onPointerLeave: () => {
					setTip(null);
					setFocus(null);
				},
				tabIndex: 0,
				onFocus: () => show(points.length - 1),
				onBlur: () => {
					setTip(null);
					setFocus(null);
				},
				onKeyDown: (event) => {
					if (event.key === "ArrowLeft") show(Math.max(0, (focus ?? points.length - 1) - 1));
					if (event.key === "ArrowRight") show(Math.min(points.length - 1, (focus ?? 0) + 1));
				}
			}, ...yTicks.map((value) => h$1("g", { key: `g${value}` }, h$1("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(value),
				y2: y(value),
				className: "lp-grid"
			}), h$1("text", {
				x: pad.left - 6,
				y: y(value) + 3,
				className: "lp-axis",
				textAnchor: "end"
			}, fmt(value, value % 1 === 0 ? 0 : digits)))), props.band ? h$1("rect", {
				x: bandFrom,
				width: Math.max(0, width - pad.right - bandFrom),
				y: y(props.band.high),
				height: Math.max(1, y(props.band.low) - y(props.band.high)),
				className: "lp-band",
				rx: 3
			}) : null, props.reference ? h$1("g", null, h$1("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.reference.value),
				y2: y(props.reference.value),
				className: "lp-ref"
			}), props.compact ? null : h$1("text", {
				x: width - pad.right + 4,
				y: y(props.reference.value) + 3,
				className: "lp-axis"
			}, props.reference.label)) : null, props.goal != null ? h$1("g", null, h$1("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.goal),
				y2: y(props.goal),
				className: "lp-goal"
			}), props.compact ? null : h$1("text", {
				x: pad.left + 4,
				y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5),
				className: "lp-goal-text"
			}, `目标 ${fmt(props.goal, digits)}`)) : null, h$1("path", {
				d: area,
				className: "lp-area"
			}), h$1("path", {
				d: path,
				className: "lp-line"
			}), focus != null ? h$1("line", {
				x1: x(days[focus]),
				x2: x(days[focus]),
				y1: pad.top,
				y2: height - pad.bottom,
				className: "lp-cross"
			}) : null, ...points.map((point, index) => points.length > 24 && index !== points.length - 1 && index !== focus ? null : h$1("circle", {
				key: `p${index}`,
				cx: x(days[index]),
				cy: y(point.value),
				r: focus === index ? 5.5 : 4,
				className: "lp-dot"
			})), props.compact ? null : h$1("text", {
				x: x(days.at(-1)) + 8,
				y: y(last.value) + 4,
				className: "lp-end"
			}, `${fmt(last.value, digits)}`), props.compact ? null : h$1("text", {
				x: pad.left,
				y: height - 6,
				className: "lp-axis"
			}, monthLabel(points[0]?.date ?? "")), props.compact || points.length < 2 ? null : h$1("text", {
				x: width - pad.right,
				y: height - 6,
				className: "lp-axis",
				textAnchor: "end"
			}, monthLabel(last.date))), h$1(Tooltip, {
				tip,
				width
			}));
		}
		function Timeline(props) {
			const [ref, width] = useWidth(560);
			const [tip, setTip] = react.default.useState(null);
			const labelWidth = Math.min(168, Math.max(96, width * .24));
			const row = 34;
			const top = 26;
			const height = top + props.items.length * row + 8;
			const starts = props.items.map((item) => dayNumber(item.start));
			const today = dayNumber(props.today);
			const d0 = Math.min(...starts, ...props.checkups.map(dayNumber)) - 10;
			const d1 = today + 10;
			const x = linear(d0, d1, labelWidth, width - 12);
			const months = [];
			for (let day = d0; day <= d1; day += 1) {
				const iso = (/* @__PURE__ */ new Date(day * 864e5)).toISOString().slice(0, 10);
				if (iso.endsWith("-01")) months.push(iso);
			}
			const step = Math.max(1, Math.ceil(months.length / Math.max(2, Math.floor((width - labelWidth) / 64))));
			return h$1("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$1("svg", {
				width,
				height,
				role: "img",
				"aria-label": `方案时间线：${props.items.map((item) => `${item.title} ${item.start} 起`).join("，")}`
			}, ...months.filter((_, index) => index % step === 0).map((iso) => h$1("g", { key: iso }, h$1("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 20,
				y2: height - 6,
				className: "lp-grid"
			}), h$1("text", {
				x: x(dayNumber(iso)) + 3,
				y: 12,
				className: "lp-axis"
			}, monthLabel(iso)))), ...props.checkups.map((iso) => h$1("g", { key: `c${iso}` }, h$1("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 22,
				y2: height - 6,
				className: "lp-checkup"
			}), h$1("circle", {
				cx: x(dayNumber(iso)),
				cy: 22,
				r: 3,
				className: "lp-checkup-dot"
			}))), h$1("line", {
				x1: x(today),
				x2: x(today),
				y1: 16,
				y2: height - 6,
				className: "lp-today"
			}), h$1("text", {
				x: x(today) - 3,
				y: 24,
				className: "lp-axis",
				textAnchor: "end"
			}, "今天"), ...props.items.map((item, index) => {
				const y0 = top + index * row + row / 2;
				const x0 = x(dayNumber(item.start));
				const x1 = x(item.end ? Math.min(dayNumber(item.end), today) : today);
				const done = Boolean(item.end && dayNumber(item.end) < today);
				return h$1("g", {
					key: item.id,
					onPointerEnter: () => setTip({
						x: (x0 + x1) / 2,
						y: y0 - 8,
						title: item.title,
						rows: [{
							label: item.subtitle,
							value: item.headline
						}]
					}),
					onPointerLeave: () => setTip(null)
				}, h$1("text", {
					x: 0,
					y: y0 + 4,
					className: "lp-row-label"
				}, item.title.length > 12 ? `${item.title.slice(0, 11)}…` : item.title), h$1("rect", {
					x: labelWidth,
					y: y0 - 12,
					width: width - labelWidth,
					height: 24,
					className: "lp-hit"
				}), h$1("rect", {
					x: x0,
					y: y0 - 5,
					width: Math.max(6, x1 - x0),
					height: 10,
					rx: 5,
					className: done ? "lp-bar-muted" : "lp-bar"
				}));
			})), h$1("div", { className: "lp-legend-inline" }, h$1("span", { className: "lp-key-bar" }), "执行中", h$1("span", { className: "lp-key-dot" }), "体检日"), h$1(Tooltip, {
				tip,
				width
			}));
		}
		function AdherenceStrip(props) {
			const [tip, setTip] = react.default.useState(null);
			const cell = 9;
			const width = Math.ceil(props.calendar.length / 7) * 11;
			const height = 77;
			const statusZh = {
				done: "完成",
				missed: "没完成",
				unknown: "没有记录"
			};
			return h$1("div", {
				className: "lp-strip",
				style: {
					width,
					height: 79
				}
			}, h$1("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === "done").length} 天`
			}, ...props.calendar.map((day, index) => h$1("rect", {
				key: day.date,
				x: Math.floor(index / 7) * 11,
				y: index % 7 * 11,
				width: cell,
				height: cell,
				rx: 2,
				className: `lp-cell lp-cell-${day.status}`,
				onPointerEnter: () => setTip({
					x: Math.floor(index / 7) * 11,
					y: index % 7 * 11,
					title: day.date,
					rows: [{
						label: props.label,
						value: statusZh[day.status] ?? day.status
					}]
				}),
				onPointerLeave: () => setTip(null)
			}))), h$1(Tooltip, {
				tip,
				width: Math.max(width, 180)
			}));
		}
		function LeverBars(props) {
			const [ref, width] = useWidth(420);
			const max = Math.max(...props.rows.map((row) => Math.abs(row.value)), .1);
			const labelWidth = Math.min(210, width * .46);
			const barMax = width - labelWidth - 70;
			const row = 36;
			const height = props.rows.length * row;
			return h$1("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$1("svg", {
				width,
				height,
				role: "img",
				"aria-label": props.rows.map((row) => `${row.label} ${row.detail}：${fmt(row.value)}${row.unit}`).join("，")
			}, ...props.rows.map((item, index) => {
				const y0 = index * row + row / 2;
				const length = Math.max(3, Math.abs(item.value) / max * barMax);
				return h$1("g", { key: item.label }, h$1("text", {
					x: 0,
					y: y0 - 2,
					className: "lp-row-label"
				}, item.label), h$1("text", {
					x: 0,
					y: y0 + 12,
					className: "lp-axis"
				}, item.detail), h$1("path", {
					d: roundedBar(labelWidth, y0 - 6, length, 12),
					className: item.value <= 0 ? "lp-bar" : "lp-bar-muted"
				}), h$1("text", {
					x: labelWidth + length + 8,
					y: y0 + 4,
					className: "lp-end"
				}, `${item.value > 0 ? "+" : ""}${fmt(item.value)} ${item.unit}`));
			})));
		}
		/** A bar square at its baseline and rounded (4px) at its data end. */
		function roundedBar(x, y, length, thickness) {
			const r = Math.min(4, length / 2, thickness / 2);
			return `M${x},${y}H${x + length - r}Q${x + length},${y} ${x + length},${y + r}V${y + thickness - r}Q${x + length},${y + thickness} ${x + length - r},${y + thickness}H${x}Z`;
		}
		function Ring(props) {
			const size = props.size ?? 64;
			const stroke = 7;
			const radius = (size - stroke) / 2;
			const length = 2 * Math.PI * radius;
			const share = props.value == null ? 0 : Math.max(0, Math.min(1, props.value));
			return h$1("svg", {
				width: size,
				height: size,
				role: "img",
				"aria-label": `${props.label} ${props.value == null ? "未知" : `${Math.round(share * 100)}%`}`,
				className: "lp-ring"
			}, h$1("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-track",
				strokeWidth: stroke
			}), h$1("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-fill",
				strokeWidth: stroke,
				strokeDasharray: `${(share * length).toFixed(2)} ${length.toFixed(2)}`,
				transform: `rotate(-90 ${size / 2} ${size / 2})`
			}));
		}
		function TableTwin(props) {
			return h$1("details", { className: "lp-twin" }, h$1("summary", null, "表格"), h$1("table", null, h$1("caption", null, props.caption), h$1("thead", null, h$1("tr", null, ...props.head.map((cell) => h$1("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$1("tbody", null, ...props.rows.map((row, index) => h$1("tr", { key: index }, ...row.map((cell, column) => h$1("td", { key: column }, cell)))))));
		}
		//#endregion
		//#region src/client/constants.ts
		const VIEW_ID = "longpi-board";
		const SUGGESTED = [
			{
				id: "review",
				zh: "我的干预方案有没有效果？哪些有效，哪些还看不出来？"
			},
			{
				id: "plan",
				zh: "帮我保存我的干预方案，先读给我确认再保存。"
			},
			{
				id: "goal",
				zh: "如果空腹血糖降到 5.0、超敏 CRP 降到 1，表型年龄会怎样？"
			},
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
			}
		];
		/** Yes/no facts China-PAR needs that a record does not hold; the person states them. */
		const RISK_FACTS = [
			{
				key: "smoker",
				zh: "现在吸烟"
			},
			{
				key: "diabetes",
				zh: "有糖尿病"
			},
			{
				key: "bp_treated",
				zh: "两周内用过降压药"
			},
			{
				key: "north",
				zh: "住在北方（长江以北）"
			},
			{
				key: "urban",
				zh: "住在城市"
			},
			{
				key: "family_history",
				zh: "父母或兄弟姐妹有心梗或脑卒中"
			}
		];
		//#endregion
		//#region src/client/panel.ts
		const h = react.default.createElement;
		function api(path) {
			const token = new URLSearchParams(window.location.search).get("token");
			if (!token) return path;
			return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
		}
		async function getJson(path) {
			const res = await fetch(api(path), { credentials: "include" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		}
		async function postJson(path, body) {
			const res = await fetch(api(path), {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || (json.problems ?? []).join(" ") || `HTTP ${res.status}`);
			return json;
		}
		const ICONS = {
			check: "M4 8.5l2.5 2.5L12 5.5",
			within: "M3.5 6.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0M3.5 9.8c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0",
			worse: "M5 11L11 5M6 5h5v5",
			unknown: "M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6M8 11.6v.1",
			flame: "M8 2.5c.4 2-1.9 2.9-1.9 5.3a1.9 1.9 0 0 0 3.8.1c0-.7-.3-1.2-.3-1.2s1.9.8 1.9 3A3.5 3.5 0 0 1 4.5 9.8C4.5 6.3 8 5.4 8 2.5z",
			calendar: "M3 5.5h10M5 2.8v2M11 2.8v2M3.5 4h9a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5z",
			download: "M8 2.8v7M5 7l3 3 3-3M3.5 12.5h9",
			refresh: "M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.4h-2.4",
			spark: "M8 2.5l1.3 3.6 3.7 1.4-3.7 1.4L8 12.5l-1.3-3.6L3 7.5l3.7-1.4z",
			flask: "M6.5 2.5h3M7 2.5v3.8L3.8 11.8a.9.9 0 0 0 .8 1.2h6.8a.9.9 0 0 0 .8-1.2L9 6.3V2.5",
			arrow: "M3.5 8h9M9 4.5L12.5 8 9 11.5",
			play: "M5.5 4v8l6-4z",
			info: "M8 7.3v4M8 5v.1M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"
		};
		function Icon(props) {
			const size = props.size ?? 16;
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				className: `lp-icon ${props.className ?? ""}`.trim()
			}, h("path", {
				d: ICONS[props.name] ?? ICONS.info,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}));
		}
		const VERDICT_STYLE = {
			有效: {
				icon: "check",
				className: "lp-v-good",
				label: "有效"
			},
			波动内: {
				icon: "within",
				className: "lp-v-within",
				label: "波动内"
			},
			反向: {
				icon: "worse",
				className: "lp-v-worse",
				label: "反向"
			},
			无法判断: {
				icon: "unknown",
				className: "lp-v-unknown",
				label: "无法判断"
			}
		};
		function VerdictChip(props) {
			const style = VERDICT_STYLE[props.verdict] ?? VERDICT_STYLE["无法判断"];
			return h("span", { className: `lp-chip-v ${style.className}` }, h(Icon, {
				name: style.icon,
				size: 14
			}), style.label);
		}
		function greeting(now) {
			const hour = now.getHours();
			if (hour < 5) return "夜深了";
			if (hour < 11) return "早上好";
			if (hour < 13) return "中午好";
			if (hour < 18) return "下午好";
			return "晚上好";
		}
		function daysBetween(from, to) {
			return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
		}
		function chineseDate(iso) {
			const [, month, day] = iso.split("-");
			return `${Number(month)} 月 ${Number(day)} 日`;
		}
		function pct(value) {
			return `${value > 0 ? "+" : ""}${fmt(value * 100, 0)}%`;
		}
		function Section(props) {
			return h("section", {
				className: "lp-section",
				id: props.id
			}, h("div", { className: "lp-section-head" }, h("div", null, props.kicker ? h("div", { className: "lp-kicker" }, props.kicker) : null, h("h2", { className: "lp-h2" }, props.title)), props.aside ?? null), props.children);
		}
		function Skeleton(props) {
			return h("div", {
				className: "lp-skeleton",
				style: { height: props.height }
			});
		}
		function Hero(props) {
			const bio = props.tracking?.bioage;
			const points = bio?.points ?? [];
			if (props.loading && !props.tracking) return h("div", { className: "lp-card lp-hero" }, h(Skeleton, { height: 180 }));
			if (points.length === 0) return h("div", { className: "lp-card lp-hero lp-hero-empty" }, h("div", { className: "lp-label" }, "身体年龄"), h("div", { className: "lp-hero-wait" }, "等一份完整的血检"), h("p", { className: "lp-muted" }, bio?.note_zh || "接上 Mirobody、在档案里写下实足年龄后，这里会按每次体检算出表型年龄。"));
			const latest = points.at(-1);
			const first = points[0];
			const advance = latest.advance;
			const band = bio?.band_years ?? null;
			const partial = (bio?.band_missing ?? []).length > 0;
			const delta = latest.advance != null && first.advance != null && points.length > 1 ? latest.advance - first.advance : null;
			let versus = "";
			if (advance != null) versus = Math.abs(advance) < .5 ? "和实足年龄相当" : advance < 0 ? `比实足年龄年轻 ${fmt(-advance)} 岁` : `比实足年龄大 ${fmt(advance)} 岁`;
			let story = "";
			let real = false;
			if (delta != null) {
				const moved = delta < 0 ? `年轻了 ${fmt(-delta)} 岁` : delta > 0 ? `多了 ${fmt(delta)} 岁` : "没有变化";
				story = `从 ${first.date.slice(0, 7).replace("-", " 年 ")} 月到现在，表型年龄相对实足年龄${moved}`;
				if (band != null) {
					if (Math.abs(delta) > band) {
						real = delta < 0;
						story += partial ? `，超过了已知的个体波动（±${fmt(band)} 岁，未含${bio?.band_missing?.join("、")}）。` : `，超出个体正常波动（±${fmt(band)} 岁），是真实的变化。`;
					} else story += `，还在个体正常波动（±${fmt(band)} 岁）以内。`;
				} else story += "。";
			}
			return h("div", { className: `lp-card lp-hero ${real ? "lp-hero-win" : ""}` }, h("div", { className: "lp-hero-top" }, h("div", null, h("div", { className: "lp-label" }, "身体年龄 · 表型年龄"), h("div", { className: "lp-hero-figure" }, fmt(latest.phenoage), h("span", { className: "lp-hero-unit" }, "岁")), versus ? h("div", { className: `lp-pill ${advance != null && advance < 0 ? "lp-pill-good" : ""}` }, versus) : null), h("div", { className: "lp-hero-meta" }, h("div", null, `${chineseDate(latest.date)}体检`), h("div", { className: "lp-muted" }, `共 ${points.length} 次`))), points.length > 1 ? h(LineChart, {
				points: points.filter((row) => row.advance != null).map((row) => ({
					date: row.date,
					value: row.advance
				})),
				unit: "岁",
				label: "表型年龄减实足年龄",
				height: 120,
				band: band != null && first.advance != null ? {
					low: first.advance - band,
					high: first.advance + band,
					from: first.date
				} : null,
				reference: {
					value: 0,
					label: "持平"
				}
			}) : null, story ? h("p", { className: "lp-hero-story" }, real ? h(Icon, {
				name: "spark",
				className: "lp-good-ink"
			}) : null, story) : null, h("div", { className: "lp-fine" }, "模型估计：Levine 2018 表型年龄，九项常规血检加实足年龄。灰色带是第一次检查的个体正常波动范围。"), points.length > 1 ? h(TableTwin, {
				caption: "每次体检的表型年龄",
				head: [
					"日期",
					"表型年龄",
					"减实足年龄",
					"模型 10 年死亡风险"
				],
				rows: points.map((row) => [
					row.date,
					`${fmt(row.phenoage)} 岁`,
					`${fmt(row.advance)} 岁`,
					`${fmt(row.mortality_10y_pct)}%`
				])
			}) : null);
		}
		function Adherence(props) {
			const items = props.tracking?.items ?? [];
			const known = items.filter((item) => item.adherence && item.adherence.level !== "unknown" && item.adherence.rate != null);
			const rate = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null;
			const streak = Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0));
			const since = items.map((item) => item.start).sort()[0];
			const today = props.tracking?.today;
			return h("div", { className: "lp-card lp-tile" }, h("div", { className: "lp-label" }, "方案执行"), h("div", { className: "lp-tile-row" }, h(Ring, {
				value: rate,
				label: "方案平均执行率"
			}), h("div", null, h("div", { className: "lp-tile-figure" }, rate == null ? "—" : `${Math.round(rate * 100)}%`), h("div", { className: "lp-muted" }, rate == null ? "还没有执行记录" : `${known.length} 项有记录`))), streak > 1 ? h("div", { className: "lp-streak" }, h(Icon, { name: "flame" }), `连续 ${streak} 天`) : null, since && today ? h("div", { className: "lp-fine" }, `方案已进行 ${daysBetween(since, today)} 天`) : null);
		}
		function NextRetest(props) {
			const today = props.tracking?.today ?? "";
			const retests = (props.tracking?.suggestions ?? []).filter((row) => row.kind === "retest" && row.date);
			const upcoming = retests.filter((row) => row.date > today).sort((a, b) => a.date.localeCompare(b.date));
			const now = retests.filter((row) => row.date <= today);
			const first = upcoming[0];
			return h("div", { className: "lp-card lp-tile" }, h("div", { className: "lp-label" }, "下次复测"), now.length > 0 ? h("div", null, h("div", { className: "lp-tile-figure" }, "现在"), h("div", { className: "lp-muted" }, `可以复测${now.map((row) => row.marker).filter(Boolean).slice(0, 2).join("、")}`)) : first ? h("div", null, h("div", { className: "lp-tile-figure" }, `${daysBetween(today, first.date)} 天后`), h("div", { className: "lp-muted" }, `${chineseDate(first.date)}之后 · ${first.marker ?? ""}`)) : h("div", null, h("div", { className: "lp-tile-figure" }, "—"), h("div", { className: "lp-muted" }, "保存方案后按指标排复测日")), h("div", { className: "lp-fine" }, h(Icon, {
				name: "calendar",
				size: 13
			}), " 复测太早，变化多半只是波动"));
		}
		function Wins(props) {
			const items = props.tracking?.items ?? [];
			if (!props.tracking?.plan) return null;
			const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === "有效").map((row) => ({
				item,
				row
			})));
			if (wins.length === 0) return h("div", { className: "lp-card lp-wins lp-wins-empty" }, h(Icon, {
				name: "spark",
				className: "lp-accent-ink"
			}), h("div", null, h("div", { className: "lp-strong" }, "还没有超出波动的改善"), h("div", { className: "lp-muted" }, "血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。")));
			return h("div", { className: "lp-card lp-wins" }, h("div", { className: "lp-label" }, "值得庆祝"), ...wins.map(({ item, row }, index) => h("div", {
				className: "lp-win",
				key: index,
				style: { animationDelay: `${index * 80}ms` }
			}, h("span", { className: "lp-win-icon" }, h(Icon, {
				name: "check",
				size: 18
			})), h("div", null, h("div", { className: "lp-strong" }, `${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ""}`), h("div", { className: "lp-muted" }, `${item.title} · ${row.change ? pct(row.change.pct) : ""} · 超出个体正常波动`, (row.combined_with ?? []).length > 0 ? `（与${(row.combined_with ?? []).join("、")}共同作用）` : "")))));
		}
		function ItemCard(props) {
			const item = props.item;
			const adherence = item.adherence ?? {};
			const source = props.raw?.mirobody ? "mirobody" : props.raw?.target ? "wearable" : "checkin";
			const rate = adherence.rate;
			return h("article", { className: "lp-card lp-item" }, h("div", { className: "lp-item-head" }, h("div", null, h("span", { className: "lp-cat" }, item.category_zh ?? ""), h("h3", { className: "lp-h3" }, item.title), h("div", { className: "lp-muted" }, `${item.start} 起 · 第 ${item.days ?? 0} 天`)), item.headline ? h(VerdictChip, { verdict: item.headline }) : null), h("div", { className: "lp-item-adherence" }, h("div", null, h("div", { className: "lp-label lp-label-tight" }, "近 12 周执行"), h("div", { className: "lp-tile-figure lp-small-figure" }, rate == null || adherence.level === "unknown" ? "记录不足" : `${Math.round(rate * 100)}%`), h("div", { className: "lp-fine" }, adherence.note_zh ?? "")), (adherence.calendar ?? []).length > 0 ? h(AdherenceStrip, {
				calendar: adherence.calendar ?? [],
				label: item.title
			}) : null), ...(item.verdicts ?? []).map((row, index) => h("div", {
				className: "lp-verdict",
				key: index
			}, h("div", { className: "lp-verdict-head" }, h(VerdictChip, { verdict: row.verdict }), h("span", { className: "lp-strong" }, row.marker), row.baseline && row.followup ? h("span", { className: "lp-num" }, `${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ""}${row.change ? `（${pct(row.change.pct)}）` : ""}`) : null), h("p", { className: "lp-reason" }, row.reason_zh ?? ""), (row.expected ?? []).length > 0 ? h("details", { className: "lp-expected" }, h("summary", null, "试验里平均能改变多少"), ...(row.expected ?? []).map((line) => h("p", {
				key: line.id,
				className: "lp-fine"
			}, line.text_zh, line.comparison && line.comparison !== "not_comparable" ? `你的变化${{
				consistent: "与试验平均一致",
				smaller: "小于试验平均",
				larger: "大于试验平均",
				opposite: "方向与试验相反"
			}[line.comparison] ?? ""}。` : "", ` doi:${line.doi}`))) : null)), h("div", { className: "lp-item-foot" }, source === "checkin" ? h("button", {
				type: "button",
				className: `lp-btn lp-btn-soft ${props.justDone ? "lp-btn-done" : ""}`,
				disabled: props.busy || props.justDone,
				onClick: () => props.onCheckIn(item)
			}, h(Icon, {
				name: "check",
				size: 15
			}), props.justDone ? "已记下，今天完成" : "今天完成了") : h("span", { className: "lp-fine" }, source === "wearable" ? "手环自动记录，不用打卡" : "服用情况在 Mirobody 里打卡")));
		}
		function Plan(props) {
			const tracking = props.tracking;
			if (props.loading && !tracking) return h(Section, {
				title: "我的方案",
				kicker: "干预"
			}, h(Skeleton, { height: 220 }));
			if (!tracking?.plan) return h(Section, {
				title: "我的方案",
				kicker: "干预"
			}, h("div", { className: "lp-card lp-empty" }, h("div", { className: "lp-strong" }, "把你的干预方案交给我"), h("p", { className: "lp-muted" }, "在对话里说出你的方案，或者分享医生、长寿师给你的方案文件。我会整理成条目读给你确认，然后对照每次检查判断哪些有效。"), h("div", { className: "lp-chips" }, ...["帮我保存干预方案：地中海饮食、每天快走 8000 步，10 月 20 日开始", "我的方案有没有效果？"].map((text) => h("button", {
				key: text,
				type: "button",
				className: "lp-chip",
				onClick: () => {
					navigator.clipboard?.writeText(text);
				}
			}, text)))));
			const plan = tracking.plan;
			const items = tracking.items ?? [];
			const checkups = [...new Set((tracking.bioage?.points ?? []).map((row) => row.date))];
			return h(Section, {
				title: plan.title,
				kicker: `我的方案 · 第 ${plan.version} 版`,
				aside: h("span", { className: "lp-muted" }, `${items.length} 项 · ${plan.saved_at.slice(0, 10)} 保存`)
			}, h("div", { className: "lp-card" }, h(Timeline, {
				items: items.map((item) => ({
					id: item.id,
					title: item.title,
					start: item.start,
					end: item.end ?? null,
					subtitle: `${item.start} 起，第 ${item.days ?? 0} 天`,
					headline: item.headline ?? ""
				})),
				checkups,
				today: tracking.today ?? ""
			})), h("div", { className: "lp-grid-items" }, ...items.map((item) => h(ItemCard, {
				key: item.id,
				item,
				raw: plan.items.find((raw) => raw.id === item.id),
				onCheckIn: props.onCheckIn,
				busy: props.busy,
				justDone: props.done.has(item.id)
			}))));
		}
		function Markers(props) {
			const charts = props.tracking?.charts ?? [];
			if (charts.length === 0) return null;
			const verdictOf = (indicator) => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? []).find((row) => row.indicator === indicator && row.verdict !== "无法判断");
			return h(Section, {
				title: "指标变化",
				kicker: "对照正常波动"
			}, h("div", { className: "lp-grid-charts" }, ...charts.map((chart) => {
				const verdict = verdictOf(chart.indicator);
				const digits = Math.max(...chart.points.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
				return h("figure", {
					className: "lp-card lp-figure",
					key: chart.indicator
				}, h("div", { className: "lp-figure-head" }, h("figcaption", null, h("span", { className: "lp-strong" }, chart.label), h("span", { className: "lp-muted" }, ` ${chart.unit}`)), verdict ? h(VerdictChip, { verdict: verdict.verdict }) : null), h(LineChart, {
					points: chart.points,
					unit: chart.unit,
					label: chart.label,
					height: 150,
					digits,
					band: chart.band ? {
						low: chart.band.low,
						high: chart.band.high,
						from: chart.band.base_date
					} : null,
					goal: chart.goal ?? null
				}), h("div", { className: "lp-fine" }, chart.band ? `灰色带：以 ${chart.band.base_date} 的 ${fmt(chart.band.base, 2)} 为基线的正常波动范围${chart.band.verified === false ? "（变异数据待核对）" : ""}。落在带外才算真实变化。` : "缺少这项的个体变异数据，分不清真实变化和波动。"), h(TableTwin, {
					caption: `${chart.label}（${chart.unit}）`,
					head: ["日期", "数值"],
					rows: chart.points.map((point) => [point.date, fmt(point.value, digits)])
				}));
			})));
		}
		function Goals(props) {
			const models = props.tracking?.models ?? [];
			if (!props.tracking || models.length === 0) return null;
			const pheno = models.find((card) => card.model === "phenoage");
			const risk = models.find((card) => card.model === "china-par");
			const leverRows = (pheno?.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "岁"
			}));
			const sensitivityRows = (pheno?.sensitivity ?? []).map((row) => ({
				label: row.label,
				detail: `一次真实变化约 ${row.step}`,
				value: -Math.abs(row.years_per_step),
				unit: "岁"
			}));
			return h(Section, {
				title: "如果达到目标",
				kicker: "模型估计"
			}, h("div", { className: "lp-grid-goals" }, pheno ? h("div", { className: "lp-card lp-model" }, h("div", { className: "lp-label" }, "表型年龄"), pheno.goal ? h("div", { className: "lp-model-figures" }, h("div", null, h("div", { className: "lp-muted" }, "现在"), h("div", { className: "lp-tile-figure" }, `${fmt(pheno.now?.phenoage)} 岁`)), h(Icon, {
				name: "arrow",
				size: 20,
				className: "lp-muted-ink"
			}), h("div", null, h("div", { className: "lp-muted" }, "达到方案目标"), h("div", { className: "lp-tile-figure lp-good-ink-strong" }, `${fmt(pheno.goal.phenoage)} 岁`)), h("div", { className: "lp-pill lp-pill-good" }, `${fmt(pheno.goal.phenoage_delta)} 岁`)) : h("p", { className: "lp-muted" }, pheno.note_zh ?? ""), leverRows.length > 0 ? h("div", null, h("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h(LeverBars, { rows: leverRows })) : sensitivityRows.length > 0 ? h("div", null, h("div", { className: "lp-subhead" }, "对你的表型年龄影响最大的指标"), h(LeverBars, { rows: sensitivityRows })) : null, pheno.goal && pheno.now?.mortality_10y_pct != null && pheno.goal.mortality_10y_pct != null ? h("div", { className: "lp-fine" }, `同一模型的 10 年死亡风险：${pheno.now.mortality_10y_pct.toFixed(1)}% → ${pheno.goal.mortality_10y_pct.toFixed(1)}%。`) : null, h("div", { className: "lp-fine" }, `${pheno.measured_on ? `按 ${pheno.measured_on} 的血检计算。` : ""}${pheno.boundary_zh ?? ""}`)) : null, risk ? h("div", { className: "lp-card lp-model" }, h("div", { className: "lp-label" }, "10 年心血管病风险 · China-PAR"), risk.status === "unavailable" ? h("div", null, h("div", { className: "lp-tile-figure lp-muted-ink" }, (risk.missing ?? []).length > 0 ? "还差几项" : "暂不显示"), h("p", { className: "lp-muted" }, risk.note_zh ?? "")) : h("div", null, h("div", { className: "lp-model-figures" }, h("div", null, h("div", { className: "lp-muted" }, "现在"), h("div", { className: "lp-tile-figure" }, risk.now?.risk_pct == null ? "—" : `${risk.now.risk_pct.toFixed(1)}%`), risk.category_zh?.now ? h("span", { className: "lp-pill" }, risk.category_zh.now) : null), risk.goal ? h(Icon, {
				name: "arrow",
				size: 20,
				className: "lp-muted-ink"
			}) : null, risk.goal ? h("div", null, h("div", { className: "lp-muted" }, "达到方案目标"), h("div", { className: "lp-tile-figure lp-good-ink-strong" }, risk.goal.risk_pct == null ? "—" : `${risk.goal.risk_pct.toFixed(1)}%`), risk.category_zh?.goal ? h("span", { className: "lp-pill lp-pill-good" }, risk.category_zh.goal) : null) : null), (risk.levers ?? []).length > 0 ? h("div", null, h("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h(LeverBars, { rows: (risk.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "个百分点"
			})) })) : h("p", { className: "lp-muted" }, risk.note_zh ?? "")), h("div", { className: "lp-fine" }, risk.boundary_zh ?? "")) : null, h("div", { className: "lp-card lp-model lp-model-note" }, h("div", { className: "lp-label" }, "关于“能多活几年”"), h("p", { className: "lp-muted" }, "没有经过验证的模型能对个人给出“多活几年”。这里只给有依据的模型估计：表型年龄、同一模型的 10 年死亡风险，以及（校验通过后）中国人群的 10 年心血管病风险。"), h("p", { className: "lp-fine" }, "试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月。能坚持的小改变，比追逐一个数字更重要。"))));
		}
		function NextSteps(props) {
			const rows = props.tracking?.suggestions ?? [];
			if (rows.length === 0) return null;
			const icon = {
				retest: "calendar",
				missing_marker: "flask",
				adherence: "flame",
				record: "check",
				one_change: "info",
				review: "info",
				worse: "worse",
				acute: "info",
				lever: "spark"
			};
			return h(Section, {
				title: "下一步",
				kicker: "按优先级"
			}, h("ol", { className: "lp-card lp-steps" }, ...rows.map((row, index) => h("li", {
				key: index,
				className: `lp-step lp-step-${row.kind}`
			}, h("span", { className: "lp-step-icon" }, h(Icon, {
				name: icon[row.kind] ?? "info",
				size: 15
			})), h("span", null, row.text_zh)))), h("p", { className: "lp-fine" }, "这里不会建议开始、停止或调整任何药物和补剂，也不给剂量。"));
		}
		function RecordSection(props) {
			const board = props.board;
			const ready = board?.readiness?.ready ?? [];
			const unlock = board?.readiness?.unlock ?? [];
			const meds = board?.records?.medications ?? [];
			const readouts = board?.readouts ?? [];
			return h(Section, {
				title: "记录与方法",
				kicker: "数据"
			}, h("div", { className: "lp-grid-2" }, h("div", { className: "lp-card" }, h("div", { className: "lp-label" }, "你的记录现在就能算"), ready.length === 0 ? h("p", { className: "lp-muted" }, "还没有能直接计算的方法。") : h("ul", { className: "lp-list" }, ...ready.map((row) => h("li", { key: row.name }, h("span", { className: "lp-strong" }, row.domain || row.name), h("span", { className: "lp-muted" }, ` ${row.blurb ?? ""}`)))), ready.length > 0 ? h("button", {
				type: "button",
				className: "lp-btn",
				disabled: props.running,
				onClick: props.onRunReady
			}, h(Icon, {
				name: "play",
				size: 14
			}), props.running ? "正在计算…" : `一键计算 ${ready.length} 项`) : null, props.runResults ? h("ul", { className: "lp-list lp-run" }, ...props.runResults.map((row) => h("li", { key: row.skill }, h("span", { className: row.ok ? "lp-good-ink" : "lp-muted-ink" }, row.ok ? "✓ " : "· "), row.skill, h("div", { className: "lp-fine" }, row.excerpt.split("\n")[0] ?? "")))) : null), h("div", { className: "lp-card" }, h("div", { className: "lp-label" }, "再测一项就能解锁"), unlock.length === 0 ? h("p", { className: "lp-muted" }, "没有只差一项的方法。") : h("ul", { className: "lp-list" }, ...unlock.map((row) => h("li", { key: row.item }, h("span", { className: "lp-strong" }, row.item), h("span", { className: "lp-muted" }, ` → ${row.skills.length} 个方法`)))), h("div", { className: "lp-fine" }, `技能库 ${board?.skills?.version ?? ""} · ${board?.readiness?.declared ?? 0} 个个人方法声明了输入`))), h("div", { className: "lp-grid-2" }, h("div", { className: "lp-card" }, h("div", { className: "lp-label" }, "档案"), props.profileForm), h("div", { className: "lp-card" }, h("div", { className: "lp-label" }, "找方法"), props.searchForm)), h("div", { className: "lp-grid-2" }, h("div", { className: "lp-card" }, h("div", { className: "lp-label" }, "用药计划（只读，来自 Mirobody）"), meds.length === 0 ? h("p", { className: "lp-muted" }, "没有读到用药计划。") : h("ul", { className: "lp-list" }, ...meds.map((row) => h("li", { key: row.name }, row.name, h("span", { className: "lp-muted" }, ` ${row.status ?? ""}`))))), h("div", { className: "lp-card" }, h("div", { className: "lp-label" }, "最近读出"), readouts.length === 0 ? h("p", { className: "lp-muted" }, "还没有算过。") : h("ul", { className: "lp-list" }, ...readouts.slice(0, 8).map((row) => h("li", { key: row.key }, row.label_zh || row.key, h("span", { className: "lp-num" }, ` ${typeof row.value === "number" ? fmt(row.value, 2) : row.value ?? ""} ${row.unit && row.unit !== "1" ? row.unit === "a" ? "岁" : row.unit : ""}`), h("span", { className: "lp-fine" }, ` · ${(row.measured_at || row.at || "").slice(0, 10)}`)))))));
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
			const [tracking, setTracking] = react.default.useState(null);
			const [trackingLoading, setTrackingLoading] = react.default.useState(true);
			const [error, setError] = react.default.useState(null);
			const [notice, setNotice] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			const [running, setRunning] = react.default.useState(false);
			const [runResults, setRunResults] = react.default.useState(null);
			const [done, setDone] = react.default.useState(/* @__PURE__ */ new Set());
			const [displayName, setDisplayName] = react.default.useState("");
			const [birthYear, setBirthYear] = react.default.useState("");
			const [age, setAge] = react.default.useState("");
			const [sex, setSex] = react.default.useState("unknown");
			const [riskFacts, setRiskFacts] = react.default.useState({});
			const [question, setQuestion] = react.default.useState("");
			const [matches, setMatches] = react.default.useState(null);
			const [note, setNote] = react.default.useState("");
			const loadTracking = react.default.useCallback(() => {
				setTrackingLoading(true);
				getJson("/api/longpi/tracking").then((json) => setTracking(json)).catch((err) => setNotice(err instanceof Error ? `方案数据没有读到（${err.message}）` : "方案数据没有读到")).finally(() => setTrackingLoading(false));
			}, []);
			const load = react.default.useCallback((refresh = false) => {
				getJson(`/api/longpi/board${refresh ? "?refresh=1" : ""}`).then((json) => {
					setBoard(json);
					setError(null);
					setDisplayName(json.profile?.displayName ?? "");
					setBirthYear(json.profile?.birthYear ? String(json.profile.birthYear) : "");
					setAge(json.profile?.age == null ? "" : String(json.profile.age));
					setSex(json.profile?.sex || "unknown");
					setRiskFacts(Object.fromEntries(Object.entries(json.profile?.risk ?? {}).map(([key, value]) => [key, value ? "yes" : "no"])));
					setMatches(json.dispatch?.matches ?? []);
					setNote(json.dispatch?.note ?? "");
				}).catch((err) => setError(err instanceof Error ? err.message : "看板没有打开"));
				loadTracking();
			}, [loadTracking]);
			react.default.useEffect(() => {
				load();
			}, [load]);
			async function checkIn(item) {
				setBusy(true);
				try {
					await postJson("/api/longpi/checkin", {
						item: item.id,
						done: true
					});
					setDone((current) => new Set(current).add(item.id));
					setNotice(`已记下：${item.title}，今天完成。`);
					loadTracking();
				} catch (err) {
					setNotice(err instanceof Error ? err.message : "没有记下");
				} finally {
					setBusy(false);
				}
			}
			async function runReady() {
				setRunning(true);
				try {
					const json = await postJson("/api/longpi/run-ready", {});
					setRunResults(json.results);
					load();
				} catch (err) {
					setNotice(err instanceof Error ? err.message : "没有算完");
				} finally {
					setRunning(false);
				}
			}
			async function saveProfile(event) {
				event.preventDefault();
				setBusy(true);
				try {
					const risk = Object.fromEntries(RISK_FACTS.map((item) => [item.key, riskFacts[item.key] === "yes" ? true : riskFacts[item.key] === "no" ? false : null]));
					await postJson("/api/longpi/profile", {
						displayName,
						birthYear: birthYear.trim() ? Number(birthYear) : null,
						age: age.trim() ? Number(age) : null,
						sex,
						risk
					});
					setNotice("档案已保存。");
					load();
				} catch (err) {
					setNotice(err instanceof Error ? err.message : "档案没有保存");
				} finally {
					setBusy(false);
				}
			}
			async function ask(event) {
				event.preventDefault();
				setBusy(true);
				try {
					const json = await getJson(`/api/longpi/match?q=${encodeURIComponent(question)}`);
					setMatches(json.matches ?? []);
					setNote(json.note ?? "");
				} catch (err) {
					setNotice(err instanceof Error ? err.message : "没有匹配到方法");
				} finally {
					setBusy(false);
				}
			}
			const name = displayName.trim();
			const today = board?.today ?? tracking?.today ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			const connected = board?.records?.status === "ok";
			const checkupCount = tracking?.bioage?.points?.length ?? 0;
			const planDays = (tracking?.items ?? []).map((item) => item.start).sort()[0];
			const profileForm = h("form", {
				className: "lp-form",
				onSubmit: (event) => {
					saveProfile(event);
				}
			}, h("input", {
				"aria-label": "称呼",
				placeholder: "称呼",
				value: displayName,
				onChange: (event) => setDisplayName(event.target.value)
			}), h("input", {
				"aria-label": "出生年",
				placeholder: "出生年",
				inputMode: "numeric",
				value: birthYear,
				onChange: (event) => setBirthYear(event.target.value)
			}), h("input", {
				"aria-label": "实足年龄",
				placeholder: "实足年龄",
				inputMode: "numeric",
				value: age,
				onChange: (event) => setAge(event.target.value)
			}), h("select", {
				"aria-label": "性别",
				value: sex,
				onChange: (event) => setSex(event.target.value)
			}, h("option", { value: "unknown" }, "性别未填"), h("option", { value: "female" }, "女"), h("option", { value: "male" }, "男"), h("option", { value: "other" }, "其他")), h("div", { className: "lp-facts" }, h("div", { className: "lp-fine lp-facts-note" }, "心血管风险模型还需要这几项（照实填，不确定就留空）："), ...RISK_FACTS.map((item) => h("label", {
				key: item.key,
				className: "lp-fact"
			}, h("span", null, item.zh), h("select", {
				id: `lp-risk-${item.key}`,
				value: riskFacts[item.key] ?? "",
				onChange: (event) => setRiskFacts((current) => ({
					...current,
					[item.key]: event.target.value
				}))
			}, h("option", { value: "" }, "未填"), h("option", { value: "yes" }, "是"), h("option", { value: "no" }, "否"))))), h("button", {
				type: "submit",
				className: "lp-btn",
				disabled: busy
			}, busy ? "保存中" : "保存"));
			const searchForm = h("div", null, h("form", {
				className: "lp-search",
				onSubmit: (event) => {
					ask(event);
				}
			}, h("input", {
				"aria-label": "想读的方法",
				placeholder: "例如：我的生物年龄、甲基化、NMN 有用吗",
				value: question,
				onChange: (event) => setQuestion(event.target.value)
			}), h("button", {
				type: "submit",
				className: "lp-btn",
				disabled: busy
			}, "匹配")), note ? h("p", { className: "lp-fine" }, note) : null, h("ul", { className: "lp-list" }, ...(matches ?? []).slice(0, 6).map((item) => h("li", { key: item.name }, h("span", { className: "lp-strong" }, item.name), h("span", { className: "lp-muted" }, ` ${(item.why ?? []).join("；") || item.blurb || ""}`)))));
			return h("div", { className: "lp-root" }, h("div", { className: "lp-page" }, h("header", { className: "lp-header" }, h("div", null, h("div", { className: "lp-kicker" }, `LongPi ${board?.version ?? ""} · 个人长寿看板`), h("h1", { className: "lp-h1" }, `${greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`), h("p", { className: "lp-lead" }, planDays ? `你的方案已经坚持了 ${daysBetween(planDays, today)} 天。` : "把检查和方案放在一起看，才知道哪些努力真的有用。", ` 今天是 ${chineseDate(today)}。`), h("div", { className: "lp-status" }, h("span", { className: `lp-dot ${connected ? "lp-dot-on" : ""}` }), connected ? `Mirobody 已连接 · ${board?.records?.indicator_count ?? 0} 项指标${checkupCount ? ` · ${checkupCount} 次完整血检` : ""}` : board?.records?.status === "unconfigured" ? "还没有接上 Mirobody 记录" : board?.records?.error || "正在读取记录")), h("div", { className: "lp-actions" }, h("button", {
				type: "button",
				className: "lp-btn lp-btn-ghost",
				onClick: () => load(true)
			}, h(Icon, {
				name: "refresh",
				size: 15
			}), "刷新"), h("a", {
				className: "lp-btn lp-btn-ghost",
				href: api("/api/longpi/report"),
				download: `longpi-report-${today}.md`
			}, h(Icon, {
				name: "download",
				size: 15
			}), "导出报告"))), error ? h("div", { className: "lp-banner lp-banner-bad" }, `看板没有打开：${error}`) : null, notice ? h("div", {
				className: "lp-banner",
				role: "status",
				onClick: () => setNotice(null)
			}, notice) : null, h("div", { className: `lp-body ${trackingLoading && tracking ? "lp-refreshing" : ""}` }, h("div", { className: "lp-grid-hero" }, h(Hero, {
				tracking,
				loading: trackingLoading
			}), h("div", { className: "lp-tiles" }, h(Adherence, { tracking }), h(NextRetest, { tracking }))), h(Wins, { tracking }), h(Plan, {
				tracking,
				loading: trackingLoading,
				onCheckIn: (item) => {
					checkIn(item);
				},
				busy,
				done
			}), h(Markers, { tracking }), h(Goals, { tracking }), h(NextSteps, { tracking }), h("details", { className: "lp-more" }, h("summary", null, "记录、方法和档案"), h(RecordSection, {
				board,
				busy,
				running,
				runResults,
				onRunReady: () => {
					runReady();
				},
				profileForm,
				searchForm
			}))), h("footer", { className: "lp-footer" }, board?.boundary || "这不是诊断，也不能改处方。紧急情况请拨打 120。")));
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
			return h("div", { className: "lp-dock" }, h("span", { className: "lp-dock-kicker" }, "LongPi"), ...SUGGESTED.map((item) => h("button", {
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
			return h("span", {
				className: "lp-sidebar",
				title: "LongPi"
			}, h("span", { className: "lp-dot lp-dot-on" }), props.wide === false ? null : h("span", null, "LongPi"));
		}
		//#endregion
		//#region src/client/styles.ts
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