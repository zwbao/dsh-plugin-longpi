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
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/constants.ts
		/** The main-panel key and the sidebar entry id; DSH requires them to match. */
		const PANEL_ID = "longpi";
		/** Used only when the server sent no question list (the journey carries the real labels). */
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
				zh: "住在城市",
				menOnly: true
			},
			{
				key: "family_history",
				zh: "父母或兄弟姐妹有心梗或脑卒中",
				menOnly: true
			}
		];
		const FOCUS_FALLBACK = [
			{
				key: "bioage",
				label_zh: "身体年龄"
			},
			{
				key: "cardio",
				label_zh: "心血管"
			},
			{
				key: "glucose",
				label_zh: "血糖"
			},
			{
				key: "weight",
				label_zh: "体重"
			},
			{
				key: "sleep",
				label_zh: "睡眠"
			},
			{
				key: "plan",
				label_zh: "看方案有没有用"
			}
		];
		/** Units offered first in the self-measurement form; the server accepts more spellings. */
		const PREFERRED_UNITS = {
			waist: [
				"cm",
				"尺",
				"寸",
				"in"
			],
			sbp: ["mmHg"],
			dbp: ["mmHg"],
			weight: [
				"kg",
				"斤",
				"lb"
			]
		};
		const SELF_FALLBACK = [
			{
				key: "waist",
				label_zh: "腰围",
				unit: "cm",
				units: PREFERRED_UNITS.waist
			},
			{
				key: "sbp",
				label_zh: "收缩压",
				unit: "mmHg",
				units: PREFERRED_UNITS.sbp
			},
			{
				key: "dbp",
				label_zh: "舒张压",
				unit: "mmHg",
				units: PREFERRED_UNITS.dbp
			},
			{
				key: "weight",
				label_zh: "体重",
				unit: "kg",
				units: PREFERRED_UNITS.weight
			}
		];
		const CONSENT_SENTENCES = [
			"LongPi 用你自己的体检和手环数据计算身体年龄、10 年心血管风险，并记下生活上的小计划做得怎么样。它不能证明某件事有效，也不做诊断，不开处方，不给用药剂量。",
			"体检存在你原来放报告的地方。档案、方案和记录只在这台电脑上。对话在你同意之后，才会发给用来回答的人工智能。",
			"每个数字都写明从哪来，并标出正常波动的范围（这点变化算不算数）。"
		];
		//#endregion
		//#region src/client/charts.ts
		const h$48 = react.default.createElement;
		function dayNumber(iso) {
			return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 864e5);
		}
		function monthLabel(iso) {
			const [year, month] = iso.slice(0, 10).split("-");
			return `${year?.slice(2)}/${month}`;
		}
		/**
		* Two decimals under 10, one from 10 up: 1.26 mmol/L, 44.8 岁, 138.7 mmHg. A
		* whole number stays whole (125 mmHg): fmt drops trailing zeros.
		*/
		function fmtAuto(value) {
			if (value == null || !Number.isFinite(value)) return "—";
			return fmt(value, Math.abs(value) >= 10 ? 1 : 2);
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
			return h$48("div", {
				className: "lp-tip",
				style: {
					left,
					top: Math.max(0, tip.y - 12)
				},
				role: "status"
			}, h$48("div", { className: "lp-tip-title" }, tip.title), ...tip.rows.map((row, index) => h$48("div", {
				className: "lp-tip-row",
				key: index
			}, h$48("span", { className: "lp-tip-value" }, row.value), h$48("span", { className: "lp-tip-label" }, row.label))));
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
			if (points.length === 0) return h$48("div", {
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
			return h$48("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$48("svg", {
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
			}, ...yTicks.map((value) => h$48("g", { key: `g${value}` }, h$48("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(value),
				y2: y(value),
				className: "lp-grid"
			}), h$48("text", {
				x: pad.left - 6,
				y: y(value) + 3,
				className: "lp-axis",
				textAnchor: "end"
			}, fmt(value, value % 1 === 0 ? 0 : digits)))), props.band ? h$48("rect", {
				x: bandFrom,
				width: Math.max(0, width - pad.right - bandFrom),
				y: y(props.band.high),
				height: Math.max(1, y(props.band.low) - y(props.band.high)),
				className: "lp-band",
				rx: 3
			}) : null, props.reference ? h$48("g", null, h$48("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.reference.value),
				y2: y(props.reference.value),
				className: "lp-ref"
			}), props.compact ? null : h$48("text", {
				x: width - pad.right + 4,
				y: y(props.reference.value) + 3,
				className: "lp-axis"
			}, props.reference.label)) : null, props.goal != null ? h$48("g", null, h$48("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.goal),
				y2: y(props.goal),
				className: "lp-goal"
			}), props.compact ? null : h$48("text", {
				x: pad.left + 4,
				y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5),
				className: "lp-goal-text"
			}, `目标 ${fmt(props.goal, digits)}`)) : null, h$48("path", {
				d: area,
				className: "lp-area"
			}), h$48("path", {
				d: path,
				className: "lp-line"
			}), focus != null ? h$48("line", {
				x1: x(days[focus]),
				x2: x(days[focus]),
				y1: pad.top,
				y2: height - pad.bottom,
				className: "lp-cross"
			}) : null, ...points.map((point, index) => points.length > 24 && index !== points.length - 1 && index !== focus ? null : h$48("circle", {
				key: `p${index}`,
				cx: x(days[index]),
				cy: y(point.value),
				r: focus === index ? 5.5 : 4,
				className: "lp-dot"
			})), props.compact ? null : h$48("text", {
				x: x(days.at(-1)) + 8,
				y: y(last.value) + 4,
				className: "lp-end"
			}, `${fmt(last.value, digits)}`), props.compact ? null : h$48("text", {
				x: pad.left,
				y: height - 6,
				className: "lp-axis"
			}, monthLabel(points[0]?.date ?? "")), props.compact || points.length < 2 ? null : h$48("text", {
				x: width - pad.right,
				y: height - 6,
				className: "lp-axis",
				textAnchor: "end"
			}, monthLabel(last.date))), h$48(Tooltip, {
				tip,
				width
			}));
		}
		function Timeline$1(props) {
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
			return h$48("div", { className: "lp-timeline" }, h$48("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$48("svg", {
				width,
				height,
				role: "img",
				"aria-label": `方案时间线：${props.items.map((item) => `${item.title} ${item.start} 起`).join("，")}`
			}, ...months.filter((_, index) => index % step === 0).map((iso) => h$48("g", { key: iso }, h$48("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 20,
				y2: height - 6,
				className: "lp-grid"
			}), h$48("text", {
				x: x(dayNumber(iso)) + 3,
				y: 12,
				className: "lp-axis"
			}, monthLabel(iso)))), ...props.checkups.map((iso) => h$48("g", { key: `c${iso}` }, h$48("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 22,
				y2: height - 6,
				className: "lp-checkup"
			}), h$48("circle", {
				cx: x(dayNumber(iso)),
				cy: 22,
				r: 3,
				className: "lp-checkup-dot"
			}))), h$48("line", {
				x1: x(today),
				x2: x(today),
				y1: 16,
				y2: height - 6,
				className: "lp-today"
			}), h$48("text", {
				x: x(today) - 3,
				y: 24,
				className: "lp-axis",
				textAnchor: "end"
			}, "今天"), ...props.items.map((item, index) => {
				const y0 = top + index * row + row / 2;
				const x0 = x(dayNumber(item.start));
				const x1 = x(item.end ? Math.min(dayNumber(item.end), today) : today);
				const done = Boolean(item.end && dayNumber(item.end) < today);
				return h$48("g", {
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
				}, h$48("text", {
					x: 0,
					y: y0 + 4,
					className: "lp-row-label"
				}, item.title.length > 12 ? `${item.title.slice(0, 11)}…` : item.title), h$48("rect", {
					x: labelWidth,
					y: y0 - 12,
					width: width - labelWidth,
					height: 24,
					className: "lp-hit"
				}), h$48("rect", {
					x: x0,
					y: y0 - 5,
					width: Math.max(6, x1 - x0),
					height: 10,
					rx: 5,
					className: done ? "lp-bar-muted" : "lp-bar"
				}));
			})), h$48(Tooltip, {
				tip,
				width
			})), h$48("div", { className: "lp-legend-inline" }, h$48("span", { className: "lp-key-bar" }), "执行中", h$48("span", { className: "lp-key-dot" }), "体检日"));
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
			return h$48("div", {
				className: "lp-strip",
				style: {
					width,
					height: 79
				}
			}, h$48("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === "done").length} 天`
			}, ...props.calendar.map((day, index) => h$48("rect", {
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
			}))), h$48(Tooltip, {
				tip,
				width: Math.max(width, 180)
			}));
		}
		/** One row per lever: the label and its from → to on one line, the bar and its value under it (fits a narrow card). */
		function LeverBars(props) {
			const [ref, width] = useWidth(420);
			const max = Math.max(...props.rows.map((row) => Math.abs(row.value)), .1);
			const barMax = Math.max(40, width - 104);
			const row = 46;
			const height = props.rows.length * row;
			return h$48("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$48("svg", {
				width,
				height,
				role: "img",
				"aria-label": props.rows.map((row) => `${row.label} ${row.detail}：${fmt(row.value)}${row.unit}`).join("，")
			}, ...props.rows.map((item, index) => {
				const y0 = index * row;
				const length = Math.max(3, Math.abs(item.value) / max * barMax);
				return h$48("g", { key: item.label }, h$48("text", {
					x: 0,
					y: y0 + 14,
					className: "lp-row-label"
				}, item.label, item.detail ? h$48("tspan", {
					dx: 8,
					className: "lp-axis"
				}, item.detail) : null), h$48("path", {
					d: roundedBar(0, y0 + 22, length, 10),
					className: item.value <= 0 ? "lp-bar" : "lp-bar-muted"
				}), h$48("text", {
					x: length + 8,
					y: y0 + 31,
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
			return h$48("svg", {
				width: size,
				height: size,
				role: "img",
				"aria-label": `${props.label} ${props.value == null ? "未知" : `${Math.round(share * 100)}%`}`,
				className: "lp-ring"
			}, h$48("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-track",
				strokeWidth: stroke
			}), h$48("circle", {
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
			return h$48("details", { className: "lp-twin" }, h$48("summary", null, "表格"), h$48("table", null, h$48("caption", null, props.caption), h$48("thead", null, h$48("tr", null, ...props.head.map((cell) => h$48("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$48("tbody", null, ...props.rows.map((row, index) => h$48("tr", { key: index }, ...row.map((cell, column) => h$48("td", { key: column }, cell)))))));
		}
		//#endregion
		//#region src/client/format.ts
		const WEEKDAYS = [
			"星期日",
			"星期一",
			"星期二",
			"星期三",
			"星期四",
			"星期五",
			"星期六"
		];
		function greeting(now) {
			const hour = now.getHours();
			if (hour < 5) return "夜深了";
			if (hour < 11) return "早上好";
			if (hour < 13) return "中午好";
			if (hour < 18) return "下午好";
			return "晚上好";
		}
		function daysBetween$1(from, to) {
			return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 864e5);
		}
		function chineseDate(iso) {
			if (!iso) return "";
			const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
			if (!match) return "";
			const month = Number(match[2]);
			const day = Number(match[3]);
			if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return "";
			return `${month} 月 ${day} 日`;
		}
		function weekday(iso) {
			return WEEKDAYS[(/* @__PURE__ */ new Date(`${iso.slice(0, 10)}T12:00:00Z`)).getUTCDay()] ?? "";
		}
		function localToday$1() {
			const now = /* @__PURE__ */ new Date();
			const pad = (value) => String(value).padStart(2, "0");
			return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		}
		/**
		* A fraction as a signed percentage: one decimal below 10 % (+0.4%, −3.2%),
		* none above (+18%). A change that rounds to nothing is 0%, never +0% or -0%.
		*/
		function pct(value) {
			const percent = value * 100;
			const text = fmt(percent, Math.abs(percent) < 10 ? 1 : 0);
			if (text === "—") return text;
			if (Number(text) === 0) return "0%";
			return `${percent > 0 ? "+" : ""}${text}%`;
		}
		/** How the body age compares with the calendar age, in words. */
		/**
		* Body age against the calendar. A single blood draw is never presented as "younger" (PLAN §B5, FINDINGS 54):
		* it is a model estimate from one draw, said as such; "younger" needs at least two complete checkups.
		*/
		function versusAge(advance, checkups = 2) {
			if (advance == null || !Number.isFinite(advance)) return "";
			if (Math.abs(advance) < .5) return "和实足年龄相当";
			if (advance < 0 && (checkups ?? 0) < 2) return `一次检查算出来的数（模型估计，不是诊断），比周岁小 ${fmt(-advance)} 岁。一次检查不能说明你变年轻了`;
			return advance < 0 ? `比实足年龄年轻 ${fmt(-advance)} 岁` : `比实足年龄大 ${fmt(advance)} 岁`;
		}
		function riskText(value) {
			return value == null || !Number.isFinite(value) ? "—" : value.toFixed(1);
		}
		/** Scroll a page section into view and put the cursor in its first field. */
		function goTo(id) {
			const node = document.getElementById(id);
			if (!node) return;
			node.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
			const field = node.querySelector("input:not([type=hidden]), select, textarea, button");
			window.setTimeout(() => field?.focus({ preventScroll: true }), 350);
		}
		/**
		* What to do, without what the card already shows: the server starts a detail with the category and title
		* (饮食：减盐。) and ends it with the evidence (证据：<trial average>，DOI ….个人效果因人而异。), which the card
		* shows on its own line, under 证据 and in its caption.
		*/
		function behaviorOf(item) {
			const evidence = item.evidence.expected_zh;
			let text = item.detail;
			const tail = evidence ? text.lastIndexOf(`证据：${evidence}`) : -1;
			if (tail >= 0) text = text.slice(0, tail);
			else if (evidence && text.includes(evidence)) text = text.replace(evidence, "");
			const head = item.category_zh ? `${item.category_zh}：${item.title}` : "";
			if (head && text.startsWith(head)) text = text.slice(head.length).replace(/^[，,。；;\s]+/, "");
			return text.replace(/\s*(证据|依据)[:：]\s*$/, "").replace(/[\s，,；;]+$/, "").trim();
		}
		//#endregion
		//#region src/client/api.ts
		async function read(res) {
			let json = null;
			try {
				json = await res.json();
			} catch {
				json = null;
			}
			if (!res.ok || json == null) {
				const problems = (json?.problems ?? []).join(" ");
				throw new Error(problems || json?.error || httpText(res.status));
			}
			return json;
		}
		/** The status in words for the few a person can act on; the number otherwise. */
		function httpText(status) {
			if (status === 401) return "需要重新登录 DeepSeek Harness（HTTP 401）";
			if (status === 403) return "DeepSeek Harness 拒绝了这个请求（HTTP 403）";
			if (status === 503) return "LongPi 还没有准备好，稍后再试（HTTP 503）";
			return `HTTP ${status}`;
		}
		const JSON_HEADERS = { "content-type": "application/json" };
		async function getJson(path) {
			return read(await fetch(path, { credentials: "same-origin" }));
		}
		async function postJson(path, body) {
			return read(await fetch(path, {
				method: "POST",
				credentials: "same-origin",
				headers: JSON_HEADERS,
				body: JSON.stringify(body)
			}));
		}
		/** DELETE carries the JSON content type too (no body): the server's write check applies to every method. */
		async function deleteJson(path) {
			return read(await fetch(path, {
				method: "DELETE",
				credentials: "same-origin",
				headers: JSON_HEADERS
			}));
		}
		function errorText(error, fallback) {
			return error instanceof Error && error.message ? error.message : fallback;
		}
		//#endregion
		//#region src/client/icons.ts
		const h$47 = react.default.createElement;
		const ICONS = {
			health: "M8 13.4S2.4 10.2 2.4 6.2A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.6 1.2c0 1-.4 2-1 2.8M3.6 8.6h2.2l1-1.5 1.5 3 1-1.5h1.2",
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
			info: "M8 7.3v4M8 5v.1M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z",
			close: "M4.5 4.5l7 7M11.5 4.5l-7 7",
			plus: "M8 3.5v9M3.5 8h9",
			link: "M6.8 9.2l2.4-2.4M7.3 4.9l.9-.9a2.4 2.4 0 0 1 3.4 3.4l-.9.9M8.7 11.1l-.9.9a2.4 2.4 0 0 1-3.4-3.4l.9-.9",
			user: "M8 7.6a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM3.5 13c.6-2.2 2.4-3.4 4.5-3.4s3.9 1.2 4.5 3.4",
			ruler: "M2.8 10.6l7.8-7.8 2.6 2.6-7.8 7.8zM5 8.4l1.2 1.2M6.8 6.6l1.2 1.2M8.6 4.8l1.2 1.2",
			trash: "M3.5 4.5h9M6.5 4.5V3.3h3v1.2M4.8 4.5l.5 8.2h5.4l.5-8.2",
			lock: "M4.5 7.3h7v5.2h-7zM5.8 7.3V5.6a2.2 2.2 0 0 1 4.4 0v1.7",
			chevron: "M6 4l4 4-4 4",
			dot: "M8 8.01v-.02",
			pulse: "M2 8.5h2.5l1.5-3 2.5 6 1.5-3H14",
			warn: "M8 2.9l5.4 9.4H2.6zM8 6.8v2.5M8 10.9v.1",
			bell: "M4.6 10.9V7.4a3.4 3.4 0 0 1 6.8 0v3.5l1 1.1H3.6zM6.9 13.4a1.2 1.2 0 0 0 2.2 0",
			send: "M13.3 2.7L2.7 7.1l4.4 1.8 1.8 4.4zM7.1 8.9l6.2-6.2"
		};
		function Icon(props) {
			const size = props.size ?? 16;
			return h$47("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: `lp-icon ${props.className ?? ""}`.trim()
			}, h$47("path", {
				d: ICONS[props.name] ?? ICONS.info,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: props.strokeWidth ?? 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}));
		}
		/** The LongPi mark: the same glyph as the 健康 entry in the sidebar. */
		function Mark(props) {
			return h$47("span", {
				className: "lp-mark",
				"aria-hidden": true
			}, h$47(Icon, {
				name: "health",
				size: props.size ?? 16
			}));
		}
		const VERDICT_STYLE = {
			有效: {
				icon: "check",
				className: "lp-v-good"
			},
			波动内: {
				icon: "within",
				className: "lp-v-within"
			},
			反向: {
				icon: "worse",
				className: "lp-v-worse"
			},
			无法判断: {
				icon: "unknown",
				className: "lp-v-unknown"
			}
		};
		/** Verdicts always travel with an icon and a label, never color alone. */
		function VerdictChip(props) {
			const label = VERDICT_STYLE[props.verdict] ? props.verdict : "无法判断";
			const style = VERDICT_STYLE[label];
			return h$47("span", { className: `lp-chip-v ${style.className}` }, h$47(Icon, {
				name: style.icon,
				size: 14
			}), label);
		}
		//#endregion
		//#region src/core/method-view.ts
		const PHENO_SKILL = "accelerated-biological-aging-risk";
		const RISK_SKILL$1 = "china-par-ascvd-risk";
		const LABELS = /* @__PURE__ */ new Set([
			"verified",
			"unverified-binding",
			"evidence-only"
		]);
		const PROVENANCE = /* @__PURE__ */ new Set([
			"blood_clock",
			"methylation_clock",
			"abdominal_ct",
			"coronary_ct",
			"routine_lab",
			"wearable",
			"questionnaire",
			"profile",
			"output_of"
		]);
		const TITLES = {
			[PHENO_SKILL]: "身体年龄",
			[RISK_SKILL$1]: "10 年心血管风险",
			"sleep-chart-biological-ageing": "睡眠时长",
			"retinal-aging-biomarkers-longitudinal": "视网膜年龄差",
			"aging-biomarker-framework": "甲基化时钟偏差",
			"epigenetic-frailty-risk-score": "表观衰弱分数",
			"testis-transcriptomic-atlas-lifespan": "年龄分段"
		};
		const RED_KEY = /^(hb|hgb|mcv|mch|rdw|rdwcv|rdw_cv)$/i;
		const RED_LABEL = /血红蛋白|平均红细胞体积|红细胞分布宽度|平均红细胞血红蛋白/;
		/** A positive "you are younger" claim. A negation such as 不能说明你变年轻了 does not match. */
		const YOUNGER_CLAIM = /你确实年轻了|比实足年龄年轻|你变年轻了|更年轻了|年轻了\s*\d+(?:\.\d+)?|逆龄/g;
		function facingUnit(unit, key = "") {
			const raw = unit.trim();
			if (!raw || raw === "1") return "";
			const folded = raw.toLowerCase();
			if (folded === "a" || folded === "yr" || folded === "yrs" || folded === "year" || folded === "years" || folded === "y") return /hour|时间|时长|随访/.test(key) ? "年" : "岁";
			if (folded === "h" || folded === "hr" || folded === "hour" || folded === "hours") return "小时";
			if (folded === "d" || folded === "day" || folded === "days") return "天";
			if (folded === "min" || folded === "minute" || folded === "minutes") return "分钟";
			return raw;
		}
		const TITLE_BY_OUTPUT = {
			blood_phenoage_age_deviation: "血检身体年龄减周岁",
			phenoage_gap: "身体年龄减周岁"
		};
		function titleOf$1(skill, titleZh = "", outputKey = "") {
			if (skill !== "accelerated-biological-aging-risk" && skill !== "china-par-ascvd-risk" && TITLE_BY_OUTPUT[outputKey]) return TITLE_BY_OUTPUT[outputKey];
			if (TITLES[skill]) return TITLES[skill];
			const named = titleZh.trim().replace(/。$/, "");
			if (named && /[\u4e00-\u9fff]/.test(named) && !/[A-Za-z]{4,}/.test(named)) return named.length > 22 ? named.slice(0, 22) : named;
			return "这项检查";
		}
		function formatMeasure(value, unit, key = "") {
			const shownUnit = facingUnit(unit, key);
			if (typeof value === "string") {
				const text = value.trim();
				if (!text) return "";
				return shownUnit && !text.includes(shownUnit) ? `${text} ${shownUnit}`.trim() : text;
			}
			if (!Number.isFinite(value)) return "";
			const shown = String(Number(value.toFixed(2)));
			if (!shownUnit) return shown;
			if (shownUnit === "%") return `${shown}%`;
			return `${shown} ${shownUnit}`;
		}
		function speciesOf(row) {
			return /物种[:：]\s*([^。；\n]+)/.exec(row.limits_zh)?.[1]?.trim() || null;
		}
		function primaryOutput(row) {
			const numeric = row.outputs.find((item) => typeof item.value === "number" && Number.isFinite(item.value));
			if (numeric) return numeric;
			return row.outputs.find((item) => typeof item.value === "string" && item.value.trim() !== "") ?? null;
		}
		function allowsYoungerClaim(label, allowedClaims) {
			return label === "verified" && (allowedClaims ?? []).includes("younger");
		}
		const NEGATED_BEFORE = /(?:不|别|没有|无需|不要|避免|先不|还不能|不能说明)$/;
		/** Replace one phrase, leaving a copy that sits in a negation. */
		function replaceClaim(text, phrase, next) {
			let out = "";
			let at = 0;
			while (at <= text.length) {
				const found = text.indexOf(phrase, at);
				if (found < 0) return out + text.slice(at);
				const before = text.slice(Math.max(0, found - 8), found);
				out += text.slice(at, found);
				out += NEGATED_BEFORE.test(before) ? phrase : next;
				at = found + phrase.length;
			}
			return out;
		}
		/** Drop a positive younger claim. Negations such as 不能说明你变年轻了 stay. */
		function stripYoungerClaim(text) {
			let out = replaceClaim(text, "你确实年轻了", "有变化");
			out = replaceClaim(out, "比实足年龄年轻", "比实足年龄低");
			out = replaceClaim(out, "你变年轻了", "数字有变化");
			out = replaceClaim(out, "更年轻了", "数字更低");
			out = out.replace(/年轻了\s*(\d+(?:\.\d+)?)/g, (match, digits, offset, whole) => {
				const before = whole.slice(Math.max(0, offset - 8), offset);
				return NEGATED_BEFORE.test(before) ? match : `变化了 ${digits}`;
			});
			return replaceClaim(out, "逆龄", "变化");
		}
		function evidenceSentence(row) {
			const species = speciesOf(row) ?? "未标明";
			const rest = row.limits_zh.replace(/物种[:：]\s*[^。；\n]+[。；]?/g, "").trim();
			return `仅证据（物种：${species}）。${rest ? rest.endsWith("。") ? rest : `${rest}。` : ""}${/不是你的/.test(rest) ? "" : "这不是你的个人数字。"}`;
		}
		const SOURCE_ZH$1 = [
			[/systolic blood pressure/i, "收缩压（高压）"],
			[/diastolic blood pressure/i, "舒张压（低压）"],
			[/fasting (?:blood )?glucose|blood glucose/i, "空腹血糖"],
			[/hs-?crp|c-reactive protein/i, "超敏 C 反应蛋白"],
			[/mean corpuscular volume|\bmcv\b/i, "平均红细胞体积"],
			[/white blood cell/i, "白细胞"],
			[/haemoglobin|hemoglobin/i, "血红蛋白"]
		];
		/** A source line a person can read. English lab names become the Chinese name plus the number. */
		function plainSource(quote) {
			const text = quote.trim();
			if (!text) return "";
			for (const [pattern, label] of SOURCE_ZH$1) if (pattern.test(text)) {
				const num = text.match(/-?\d+(?:\.\d+)?/);
				return num ? `${label}${num[0]}` : label;
			}
			if (/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){2,}/.test(text)) {
				const num = text.match(/-?\d+(?:\.\d+)?/);
				return num ? num[0] : "";
			}
			return text.replace(/\b[A-Z]\d{2}\.\d+\b/g, "").replace(/\s{2,}/g, " ").trim();
		}
		/**
		* The sentence under a result. An unverified binding names the source row in
		* that same sentence. A younger claim is removed unless M4 already allowed it
		* and the label is verified.
		*/
		function resultSentence(row, opts) {
			if (row.label === "evidence-only") return evidenceSentence(row);
			const out = primaryOutput(row);
			const shown = out && out.value != null && out.value !== "" ? formatMeasure(out.value, out.unit, out.key) : "没有个人数字";
			const title = titleOf$1(row.skill, row.title_zh, out?.key ?? "");
			let text;
			if (row.label === "unverified-binding") {
				const quote = plainSource(row.inputs_used.map((item) => item.quote.trim()).find(Boolean) ?? "");
				text = quote ? `${title}是 ${shown}（还没对上，来源：${quote}）。` : `${title}是 ${shown}（还没对上）。`;
			} else {
				const limits = row.limits_zh.trim();
				text = `${title}是 ${shown}（已核对）。${limits ? limits.endsWith("。") ? limits : `${limits}。` : ""}`;
			}
			if (!opts.youngerAllowed && YOUNGER_CLAIM.test(text)) text = stripYoungerClaim(text);
			YOUNGER_CLAIM.lastIndex = 0;
			return text;
		}
		/** Outputs that are the blood PhenoAge gap (body age minus calendar age), whichever method printed them. */
		const BODY_AGE_GAP_KEYS = /* @__PURE__ */ new Set([
			"phenoage_advance",
			"blood_phenoage_age_deviation",
			"phenoage_gap"
		]);
		function isBodyAgeOutput(skill, key) {
			if (skill === "accelerated-biological-aging-risk" && key === "phenoage") return "age";
			return BODY_AGE_GAP_KEYS.has(key) ? "gap" : null;
		}
		/** A personal result the page folds into the one body-age card: PhenoAge itself, or a blood PhenoAge gap. */
		function measuresBodyAge(row) {
			if (row.label === "evidence-only") return false;
			if (row.skill === "accelerated-biological-aging-risk") return true;
			const out = primaryOutput(row);
			return out != null && isBodyAgeOutput(row.skill, out.key) != null;
		}
		function years(value) {
			return String(Number(Math.abs(value).toFixed(1)));
		}
		/** 「比周岁小 3.2 岁」, 「比周岁大 1.5 岁」, 「和周岁差不多」 (the glossary wording). */
		function versusCalendarAge(advance) {
			if (advance == null || !Number.isFinite(advance)) return "";
			if (Math.abs(advance) < .5) return "和周岁差不多";
			return advance < 0 ? `比周岁小 ${years(advance)} 岁` : `比周岁大 ${years(advance)} 岁`;
		}
		function redCellDriverNames(rows) {
			const names = [];
			for (const row of rows) {
				const label = (row.label_zh ?? "").trim();
				const key = (row.key ?? "").trim();
				if (!RED_KEY.test(key) && !RED_LABEL.test(label)) continue;
				const name = label || key;
				if (name && !names.includes(name)) names.push(name);
			}
			return names.slice(0, 4);
		}
		/**
		* Body age above chronological age: name the red-cell drivers when the record
		* has them, and say that treating the cause may bring the number down.
		* Returns null when the result is not older.
		*/
		function olderThanAgeSentence(input) {
			if (!Number.isFinite(input.phenoage) || !Number.isFinite(input.advance) || input.advance <= 0) return null;
			const high = `这次身体年龄 ${formatMeasure(input.phenoage, "岁")}，比实足年龄高 ${formatMeasure(input.advance, "岁")}。`;
			const names = input.drivers.map((name) => name.trim()).filter(Boolean).slice(0, 4);
			return `${high}${names.length >= 2 ? `${names.join("、")}这些红细胞指标把这个数抬高了。和贫血这类原因有关时，先请医生看清原因；原因处理之后，这个数可能会降下来。` : names.length === 1 ? `${names[0]}把这个数抬高了。先请医生看清原因；原因处理之后，这个数可能会降下来。` : "是哪几项检查把这个数抬高的，要对照化验看。先请医生看清原因；原因处理之后，这个数可能会降下来。"}`;
		}
		function pin(skill) {
			if (skill === "accelerated-biological-aging-risk") return 0;
			if (skill === "china-par-ascvd-risk") return 1;
			return 2;
		}
		function byLabel(a, b) {
			const rank = {
				verified: 0,
				"unverified-binding": 1,
				"evidence-only": 2
			};
			return rank[a.label] - rank[b.label] || pin(a.skill) - pin(b.skill) || a.skill.localeCompare(b.skill);
		}
		function hasPersonalOutput(row) {
			return row.outputs.some((item) => item.value != null && item.value !== "");
		}
		/** Personal results first (PhenoAge and China-PAR stay in the slice), then evidence rows. */
		function overviewSlice(results) {
			const value = results.filter((row) => row.label !== "evidence-only" && hasPersonalOutput(row)).sort(byLabel);
			const evidence = results.filter((row) => row.label === "evidence-only").sort(byLabel);
			const pinned = value.filter((row) => row.skill === "accelerated-biological-aging-risk" || row.skill === "china-par-ascvd-risk");
			const rest = value.filter((row) => row.skill !== "accelerated-biological-aging-risk" && row.skill !== "china-par-ascvd-risk");
			const cap = Math.max(4, pinned.length);
			return {
				value: [...pinned, ...rest].slice(0, cap),
				evidence: evidence.slice(0, 4)
			};
		}
		function parseMethodResults(value) {
			if (!Array.isArray(value)) return [];
			const out = [];
			for (const item of value) {
				if (!item || typeof item !== "object") continue;
				const raw = item;
				const skill = typeof raw.skill === "string" ? raw.skill.trim() : "";
				const label = raw.label;
				if (!skill || typeof label !== "string" || !LABELS.has(label)) continue;
				const outputs = Array.isArray(raw.outputs) ? raw.outputs.flatMap((row) => {
					if (!row || typeof row !== "object") return [];
					const cell = row;
					const key = typeof cell.key === "string" ? cell.key : "";
					const unit = typeof cell.unit === "string" ? cell.unit : "";
					const rawValue = cell.value;
					const parsed = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : typeof rawValue === "string" ? rawValue : rawValue === null ? null : void 0;
					if (!key || parsed === void 0) return [];
					return [{
						key,
						value: parsed,
						unit
					}];
				}) : [];
				const inputs_used = Array.isArray(raw.inputs_used) ? raw.inputs_used.flatMap((row) => {
					if (!row || typeof row !== "object") return [];
					const cell = row;
					const input = typeof cell.input === "string" ? cell.input : "";
					const source = typeof cell.source_row_id === "string" ? cell.source_row_id : "";
					const provenance = cell.provenance;
					const quote = typeof cell.quote === "string" ? cell.quote : "";
					const rawValue = cell.value;
					const parsed = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : typeof rawValue === "string" ? rawValue : void 0;
					const unit = typeof cell.unit === "string" ? cell.unit : "";
					if (!input || !source || parsed === void 0 || typeof provenance !== "string" || !PROVENANCE.has(provenance)) return [];
					return [{
						input,
						source_row_id: source,
						value: parsed,
						unit,
						provenance,
						quote
					}];
				}) : [];
				const ran_at = typeof raw.ran_at === "string" ? raw.ran_at : "";
				const catalog_version = typeof raw.catalog_version === "string" ? raw.catalog_version : "";
				if (!ran_at || !catalog_version) continue;
				out.push({
					skill,
					label,
					outputs,
					inputs_used,
					catalog_version,
					ran_at,
					limits_zh: typeof raw.limits_zh === "string" ? raw.limits_zh : "",
					...typeof raw.title_zh === "string" && /[\u4e00-\u9fff]/.test(raw.title_zh) ? { title_zh: raw.title_zh.trim() } : {}
				});
			}
			return out;
		}
		//#endregion
		//#region src/client/normalize.ts
		const STAGES = [
			"consent",
			"profile",
			"records",
			"first_result",
			"plan",
			"routine"
		];
		const ACTIONS = [
			"consent",
			"profile",
			"records",
			"addons",
			"plan",
			"checkin",
			"review",
			"open",
			"doctor"
		];
		const SEXES = [
			"female",
			"male",
			"other",
			"unknown"
		];
		const SELF_KEYS = [
			"waist",
			"sbp",
			"dbp",
			"weight"
		];
		const FOCUS = [
			"bioage",
			"cardio",
			"glucose",
			"weight",
			"sleep",
			"plan"
		];
		const VERDICTS = [
			"better",
			"worse",
			"unclear"
		];
		function obj(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function objects(value) {
			return Array.isArray(value) ? value.filter((row) => !!row && typeof row === "object" && !Array.isArray(row)) : [];
		}
		function str(value, fallback = "") {
			return typeof value === "string" ? value : fallback;
		}
		function strOrNull(value) {
			return typeof value === "string" && value ? value : null;
		}
		function num$1(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : null;
		}
		function strings$2(value) {
			return Array.isArray(value) ? value.filter((row) => typeof row === "string" && row.length > 0) : [];
		}
		function oneOf(value, allowed, fallback) {
			return allowed.includes(value) ? value : fallback;
		}
		function profileOf(raw) {
			const risk = {};
			for (const [key, value] of Object.entries(obj(raw.risk))) if (typeof value === "boolean") risk[key] = value;
			const riskUnknown = strings$2(raw.riskUnknown).filter((key) => [
				"smoker",
				"diabetes",
				"bp_treated",
				"north",
				"urban",
				"family_history"
			].includes(key));
			const age = num$1(raw.age);
			const sex = oneOf(raw.sex, SEXES, "unknown");
			const questions = objects(raw.questions).filter((row) => typeof row.key === "string").map((row) => ({
				key: row.key,
				label_zh: str(row.label_zh),
				unlocks_zh: str(row.unlocks_zh),
				answered: row.answered === true,
				...row.men_only === true ? { men_only: true } : {}
			}));
			return {
				displayName: str(raw.displayName),
				birthYear: num$1(raw.birthYear),
				age,
				sex,
				risk,
				...riskUnknown.length > 0 ? { riskUnknown } : {},
				focus: strings$2(raw.focus).filter((key) => FOCUS.includes(key)),
				complete: typeof raw.complete === "boolean" ? raw.complete : age != null && (sex === "male" || sex === "female"),
				questions
			};
		}
		function resultsOf(raw) {
			const bio = obj(raw.bioage);
			const risk = obj(raw.risk);
			const phenoage = num$1(bio.phenoage);
			const riskPct = num$1(risk.risk_pct);
			return {
				bioage: {
					status: bio.status === "ok" && phenoage != null ? "ok" : "blocked",
					phenoage,
					advance: num$1(bio.advance),
					date: strOrNull(bio.date),
					checkups: num$1(bio.checkups) ?? 0,
					band_years: num$1(bio.band_years),
					blocker_zh: str(bio.blocker_zh),
					missing: strings$2(bio.missing),
					...str(bio.caveat_zh) ? { caveat_zh: str(bio.caveat_zh) } : {},
					...str(bio.headline_zh) ? { headline_zh: str(bio.headline_zh) } : {},
					...bio.allows_younger === true ? { allows_younger: true } : {}
				},
				risk: {
					status: risk.status === "ok" && riskPct != null ? "ok" : "blocked",
					risk_pct: riskPct,
					category_zh: str(risk.category_zh),
					date: strOrNull(risk.date),
					blocker_zh: str(risk.blocker_zh),
					missing_labs: strings$2(risk.missing_labs),
					missing_facts: strings$2(risk.missing_facts)
				}
			};
		}
		/** Numeric points only, oldest first (the server already keeps one per day). */
		function pointsOf(value) {
			return objects(value).filter((row) => str(row.date) && num$1(row.value) != null).map((row) => ({
				date: str(row.date),
				value: num$1(row.value)
			})).sort((a, b) => a.date.localeCompare(b.date));
		}
		/**
		* A change row is shown only with its comparison and its band: without them
		* the sentence has nothing behind it. A row the server did not mark as good
		* news is treated as one for the doctor, whatever its flag says.
		*/
		function changeOf(row) {
			const compare = obj(row.compare);
			const band = obj(row.band_pct);
			const from = num$1(compare.from);
			const to = num$1(compare.to);
			const pct = num$1(compare.pct);
			const up = num$1(band.up);
			const down = num$1(band.down);
			const key = str(row.key);
			const label = str(row.label_zh);
			const text = str(row.text_zh);
			if (!key || !label || !text || from == null || to == null || pct == null || up == null || down == null) return null;
			const verdict = oneOf(row.verdict, VERDICTS, "unclear");
			const source = obj(row.source);
			return {
				key,
				label_zh: label,
				unit: str(row.unit),
				points: pointsOf(row.points),
				compare: {
					from_date: str(compare.from_date),
					from,
					to_date: str(compare.to_date),
					to,
					pct
				},
				band_pct: {
					up,
					down
				},
				direction: oneOf(row.direction, ["up", "down"], pct < 0 ? "down" : "up"),
				verdict,
				ask_doctor: row.ask_doctor === true || verdict === "worse",
				text_zh: text,
				advice_zh: str(row.advice_zh),
				...str(row.caveat_zh) ? { caveat_zh: str(row.caveat_zh) } : {},
				...row.range_flag === "low" || row.range_flag === "high" ? { range_flag: row.range_flag } : {},
				source: {
					title: str(source.title),
					url: str(source.url),
					...str(source.doi) ? { doi: str(source.doi) } : {}
				},
				verified: row.verified === true
			};
		}
		function changesOf(value) {
			const rows = objects(value).map(changeOf).filter((row) => row != null);
			return [...rows.filter((row) => row.ask_doctor), ...rows.filter((row) => !row.ask_doctor)];
		}
		function addonsOf(value) {
			return objects(value).filter((row) => str(row.item_zh)).map((row) => {
				const key = SELF_KEYS.includes(row.self_key) ? row.self_key : void 0;
				return {
					item_zh: str(row.item_zh),
					unlocks_zh: str(row.unlocks_zh),
					self_measurable: row.self_measurable === true && key != null,
					...key ? { self_key: key } : {}
				};
			});
		}
		function selfOf(raw) {
			return {
				latest: objects(raw.latest).filter((row) => SELF_KEYS.includes(row.key) && num$1(row.value) != null).map((row) => ({
					key: row.key,
					label_zh: str(row.label_zh),
					value: num$1(row.value),
					unit: str(row.unit),
					date: str(row.date),
					n: num$1(row.n) ?? 1
				})),
				keys: objects(raw.keys).filter((row) => SELF_KEYS.includes(row.key)).map((row) => ({
					key: row.key,
					label_zh: str(row.label_zh),
					unit: str(row.unit),
					units: strings$2(row.units)
				}))
			};
		}
		/**
		* Before 5.1 a journey said done_today: false for an item not ticked yet; from
		* 5.1 false is an explicit miss (没做到) and null means no record. A server that
		* names an older version gets its false read as null.
		*/
		function checkStateOf$1(value, legacy) {
			if (value === true) return true;
			if (value === false) return legacy ? null : false;
			return null;
		}
		/**
		* True for a server that predates the tri-state check-in. The journey route arrived in the release first numbered
		* 5.0.0 (now 0.5.0), so only 5.0.x and 0.x below 0.5.1 need the old reading; a later 1.x or anything unknown is current.
		*/
		function beforeTriState(version) {
			const match = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim());
			if (!match) return false;
			const major = Number(match[1]);
			const minor = Number(match[2]);
			const patch = Number(match[3] ?? 0);
			if (major === 0) return minor < 5 || minor === 5 && patch < 1;
			return major === 5 && minor === 0;
		}
		function planOf(raw, legacy) {
			return {
				exists: raw.exists === true,
				title: str(raw.title),
				version: num$1(raw.version),
				items: num$1(raw.items) ?? 0,
				started: strOrNull(raw.started),
				days: num$1(raw.days),
				checkin_items: objects(raw.checkin_items).filter((row) => typeof row.id === "string").map((row) => ({
					id: row.id,
					title: str(row.title, row.id),
					done_today: checkStateOf$1(row.done_today, legacy)
				})),
				streak: num$1(raw.streak) ?? 0,
				adherence_pct: num$1(raw.adherence_pct)
			};
		}
		function remindersOf(value) {
			return objects(value).filter((row) => str(row.text_zh)).map((row) => ({
				kind: row.kind === "retest" ? "retest" : "checkin",
				text_zh: str(row.text_zh),
				date: strOrNull(row.date),
				due: row.due === true
			}));
		}
		/** A record that answered, fully or in part: some reads failing is not "not connected". */
		function recordConnected(status) {
			return status === "ok" || status === "partial";
		}
		/** The same order the server uses, for a journey that arrives without a stage. */
		function stageOf(journey) {
			if (!journey.consent.accepted) return "consent";
			if (!journey.profile.complete) return "profile";
			if (!recordConnected(journey.records.status)) return "records";
			if (journey.results.bioage.status !== "ok" && journey.results.risk.status !== "ok") return "first_result";
			return journey.plan.exists ? "routine" : "plan";
		}
		function normalizeJourney(input) {
			const raw = obj(input);
			if (!("stage" in raw) && !("consent" in raw) && !("profile" in raw)) throw new Error("返回的不是 LongPi 的进度数据");
			const consent = obj(raw.consent);
			const records = obj(raw.records);
			const version = str(raw.version);
			const body = {
				version,
				today: str(raw.today) || localToday$1(),
				consent: {
					accepted: consent.accepted === true,
					version: str(consent.version),
					accepted_at: strOrNull(consent.accepted_at),
					current: str(consent.current, str(consent.version))
				},
				profile: profileOf(obj(raw.profile)),
				focus_options: objects(raw.focus_options).filter((row) => FOCUS.includes(row.key)).map((row) => ({
					key: row.key,
					label_zh: str(row.label_zh, row.key)
				})),
				records: {
					status: oneOf(records.status, [
						"unconfigured",
						"ok",
						"partial",
						"error"
					], "unconfigured"),
					error: str(records.error),
					indicator_count: num$1(records.indicator_count) ?? 0,
					full_checkups: num$1(records.full_checkups) ?? 0,
					latest_checkup: strOrNull(records.latest_checkup),
					mirobody_mounted: records.mirobody_mounted !== false,
					read_errors: strings$2(records.read_errors),
					missing_reads: strings$2(records.missing_reads),
					summary: summaryOf(records.summary)
				},
				results: resultsOf(obj(raw.results)),
				addons: addonsOf(raw.addons),
				self: selfOf(obj(raw.self)),
				plan: planOf(obj(raw.plan), beforeTriState(version)),
				reminders: remindersOf(raw.reminders),
				boundary_zh: str(raw.boundary_zh) || "模型估计，不是诊断，也不是用药建议，也不是你能活多久。紧急情况请拨打 120。"
			};
			const stage = oneOf(raw.stage, STAGES, stageOf(body));
			const next = obj(raw.next);
			return {
				...body,
				stage,
				next: {
					stage: oneOf(next.stage, STAGES, stage),
					title_zh: str(next.title_zh),
					detail_zh: str(next.detail_zh),
					action: oneOf(next.action, ACTIONS, "open")
				},
				suggestions: objects(raw.suggestions).filter((row) => str(row.text_zh)).map((row, index) => ({
					id: str(row.id) || `s${index}`,
					text_zh: str(row.text_zh)
				})),
				followup: journeyFollowupOf(obj(raw.followup)),
				changes: changesOf(raw.changes),
				changes_note_zh: str(raw.changes_note_zh),
				changes_unjudged: objects(raw.changes_unjudged).filter((row) => str(row.label_zh)).map((row) => ({
					label_zh: str(row.label_zh),
					reason_zh: str(row.reason_zh)
				})),
				surfaces: surfacesOf(raw.surfaces),
				triage: triageOf(obj(raw.triage)),
				method_results: parseMethodResults(raw.method_results),
				doctor_first: {
					stop: obj(raw.doctor_first).stop === true,
					hits: objects(obj(raw.doctor_first).hits).map((row) => ({
						key: str(row.key),
						short_zh: str(row.short_zh)
					})).filter((row) => row.key)
				}
			};
		}
		function cardOf(value) {
			const raw = obj(value);
			return {
				id: str(raw.id),
				text_zh: str(raw.text_zh),
				detail_zh: str(raw.detail_zh),
				fact_ids: strings$2(raw.fact_ids),
				tone: str(raw.tone),
				source: str(raw.source),
				prompt_zh: str(raw.prompt_zh)
			};
		}
		/** The surfaces the server ranked (0.5.3); null from an older server. */
		function surfacesOf(value) {
			if (!value || typeof value !== "object" || Array.isArray(value)) return null;
			const raw = value;
			const next = obj(raw.next);
			const action = obj(next.action);
			return {
				source: str(raw.source),
				greeting: cardOf(raw.greeting),
				status: cardOf(raw.status),
				next: {
					kind: str(action.kind),
					mandatory: action.mandatory === true,
					card: cardOf(next.card)
				},
				suggestions: objects(raw.suggestions).map(cardOf).filter((row) => row.text_zh)
			};
		}
		function triageOf(raw) {
			return {
				findings: objects(raw.findings).map((row) => ({
					id: str(row.id),
					title_zh: str(row.title_zh),
					department_zh: str(row.department_zh),
					status: str(row.status)
				})).filter((row) => row.id),
				care: objects(raw.care).map((row) => ({
					finding_id: str(row.finding_id),
					care_status: str(row.care_status),
					visit_date: strOrNull(row.visit_date),
					outcome_zh: strOrNull(row.outcome_zh)
				})),
				needs_sex: raw.needs_sex === true
			};
		}
		/** records.summary (A1 §J): counts are never guessed, so a summary without its counts is none. */
		function summaryOf(value) {
			if (!value || typeof value !== "object" || Array.isArray(value)) return null;
			const raw = value;
			const checkups = num$1(raw.checkups);
			if (checkups == null) return null;
			return {
				checkups,
				first_date: strOrNull(raw.first_date),
				last_date: strOrNull(raw.last_date),
				categories_zh: strings$2(raw.categories_zh),
				wearable_days: num$1(raw.wearable_days) ?? 0
			};
		}
		function journeyFollowupOf(raw) {
			return {
				enabled: raw.enabled === true,
				channels: strings$2(raw.channels).filter((row) => row === "desktop" || row === "webhook"),
				next_at: strOrNull(raw.next_at)
			};
		}
		const CATEGORIES = [
			"diet",
			"exercise",
			"sleep",
			"weight",
			"behavior",
			"supplement"
		];
		const SOURCES = [
			"phenoage_levers",
			"china_par_levers",
			"focus"
		];
		function draftItemOf(row, index) {
			const title = str(row.title);
			const category = row.category;
			if (!title || !CATEGORIES.includes(category)) return null;
			const evidence = obj(row.evidence);
			const target = obj(row.target);
			const value = num$1(target.value);
			return {
				id: str(row.id) || `item${index}`,
				category,
				category_zh: str(row.category_zh),
				title,
				detail: str(row.detail),
				start: str(row.start),
				markers: strings$2(row.markers),
				target: str(target.metric) && value != null && (target.op === ">=" || target.op === "<=") ? {
					metric: str(target.metric),
					op: target.op,
					value,
					unit: str(target.unit)
				} : null,
				evidence: {
					effect_id: str(evidence.effect_id, str(row.id)),
					expected_zh: str(evidence.expected_zh),
					doi: str(evidence.doi),
					verified: evidence.verified === true,
					population: str(evidence.population)
				},
				needs_doctor: row.needs_doctor === true || category === "supplement",
				cautions_zh: strings$2(row.cautions_zh)
			};
		}
		function briefOf(raw) {
			const safety = obj(raw.safety);
			return {
				today: str(raw.today) || localToday$1(),
				focus: strings$2(raw.focus).filter((key) => FOCUS.includes(key)),
				priorities: objects(raw.priorities).filter((row) => str(row.label_zh)).map((row) => ({
					marker_key: str(row.marker_key),
					label_zh: str(row.label_zh),
					value: num$1(row.value),
					unit: str(row.unit),
					date: strOrNull(row.date),
					why_zh: str(row.why_zh),
					source: oneOf(row.source, SOURCES, "focus")
				})),
				candidates: objects(raw.candidates).filter((row) => str(row.intervention_zh) && row.category !== "drug").map((row) => {
					const effect = obj(row.effect);
					return {
						id: str(row.id),
						intervention_zh: str(row.intervention_zh),
						category: str(row.category),
						marker_key: str(row.marker_key),
						label_zh: str(row.label_zh),
						effect: {
							value: num$1(effect.value) ?? 0,
							unit: str(effect.unit),
							...typeof effect.kind === "string" ? { kind: effect.kind } : {}
						},
						duration_weeks: num$1(row.duration_weeks),
						population: str(row.population),
						design: str(row.design),
						doi: str(row.doi),
						verified: row.verified === true,
						expected_zh: str(row.expected_zh),
						needs_doctor: row.needs_doctor === true || row.category === "supplement",
						cautions_zh: strings$2(row.cautions_zh)
					};
				}),
				safety: {
					medications: strings$2(safety.medications),
					notes_zh: strings$2(safety.notes_zh),
					...str(safety.stop_zh) ? { stop_zh: str(safety.stop_zh) } : {}
				},
				past_items: objects(raw.past_items).filter((row) => str(row.title)).map((row) => ({
					title: str(row.title),
					category: str(row.category),
					verdicts: strings$2(row.verdicts),
					adherence_pct: num$1(row.adherence_pct)
				})),
				notes_zh: strings$2(raw.notes_zh),
				boundary_zh: str(raw.boundary_zh)
			};
		}
		function normalizePlanDraft(input) {
			const raw = obj(input);
			if (!("brief" in raw) && !("draft" in raw)) throw new Error("返回的不是方案草稿");
			const draft = raw.draft == null ? null : obj(raw.draft);
			const items = draft ? objects(draft.items).map(draftItemOf).filter((row) => row != null) : [];
			const goals = draft ? objects(draft.goals).filter((row) => str(row.marker) && num$1(row.value) != null).map((row) => ({
				marker: str(row.marker),
				value: num$1(row.value),
				unit: str(row.unit),
				basis_zh: str(row.basis_zh),
				...str(row.basis_item_id) ? { basis_item_id: str(row.basis_item_id) } : {}
			})) : [];
			return {
				brief: briefOf(obj(raw.brief)),
				draft: draft && items.length > 0 ? {
					title: str(draft.title),
					items,
					goals,
					notes_zh: strings$2(draft.notes_zh)
				} : null,
				removed_items: objects(raw.removed_items).map((row) => ({
					id: str(row.id),
					title: str(row.title)
				})).filter((row) => row.id || row.title)
			};
		}
		const KINDS = [
			"feishu",
			"wecom",
			"dingtalk",
			"bark",
			"generic"
		];
		const LOG_KINDS = [
			"checkin",
			"retest",
			"weekly",
			"nudge",
			"custom",
			"test"
		];
		const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
		function time(value, fallback) {
			return typeof value === "string" && HHMM.test(value) ? value : fallback;
		}
		function settingsOf(raw) {
			const weekly = raw.weekly == null ? null : obj(raw.weekly);
			const webhook = raw.webhook == null ? null : obj(raw.webhook);
			const quiet = raw.quiet == null ? null : obj(raw.quiet);
			const day = num$1(weekly?.day);
			return {
				enabled: raw.enabled === true,
				checkin_time: time(raw.checkin_time, "21:00"),
				retest_time: time(raw.retest_time, "09:00"),
				weekly: weekly && day != null && day >= 1 && day <= 7 ? {
					day,
					time: time(weekly.time, "20:00")
				} : null,
				desktop: raw.desktop !== false,
				webhook: webhook && KINDS.includes(webhook.kind) ? {
					kind: webhook.kind,
					url_masked: str(webhook.url_masked),
					secret_set: webhook.secret_set === true
				} : null,
				detail: raw.detail === "full" ? "full" : "minimal",
				quiet: quiet && HHMM.test(str(quiet.start)) && HHMM.test(str(quiet.end)) ? {
					start: str(quiet.start),
					end: str(quiet.end)
				} : null
			};
		}
		function normalizeFollowup(input) {
			const raw = obj(input);
			if (!("settings" in raw)) throw new Error("返回的不是随访设置");
			const next = obj(raw.next);
			const log = objects(raw.log).filter((row) => str(row.at)).map((row) => {
				const channels = obj(row.channels);
				return {
					at: str(row.at),
					kind: oneOf(row.kind, LOG_KINDS, "custom"),
					key: str(row.key),
					ok: row.ok === true,
					channels: {
						...typeof channels.desktop === "boolean" ? { desktop: channels.desktop } : {},
						...typeof channels.webhook === "boolean" ? { webhook: channels.webhook } : {}
					},
					...str(row.error) ? { error: str(row.error) } : {}
				};
			});
			return {
				settings: settingsOf(obj(raw.settings)),
				next: {
					checkin: strOrNull(next.checkin),
					retest: strOrNull(next.retest),
					weekly: strOrNull(next.weekly)
				},
				log,
				platform_desktop: raw.platform_desktop === true
			};
		}
		const CONNECTION_SOURCES = [
			"saved",
			"config",
			"none"
		];
		const CONNECTION_STATES = [
			"ok",
			"error",
			"none"
		];
		function normalizeConnection(input) {
			const raw = obj(input);
			if (!("source" in raw) && !("status" in raw) && !("url_masked" in raw)) throw new Error("返回的不是连接状态");
			return {
				source: oneOf(raw.source, CONNECTION_SOURCES, "none"),
				url_masked: str(raw.url_masked),
				token_set: raw.token_set === true,
				status: oneOf(raw.status, CONNECTION_STATES, "none"),
				error: str(raw.error),
				summary: summaryOf(raw.summary)
			};
		}
		/** A save or test answer: ok with the connection's new state, or ok:false with the reason. */
		function normalizeConnectionResult(input) {
			const raw = obj(input);
			const error = str(raw.error);
			let connection = null;
			try {
				connection = normalizeConnection(raw);
			} catch {
				connection = null;
			}
			const ok = raw.ok === false ? false : raw.ok === true || connection != null && connection.status === "ok";
			return {
				ok,
				error: ok ? "" : error || connection?.error || "连接没有成功",
				connection
			};
		}
		const GROUP_KEYS = [
			"lipids",
			"glucose",
			"inflammation",
			"blood",
			"liver",
			"kidney",
			"thyroid",
			"body",
			"wearable",
			"other"
		];
		const INDICATOR_SOURCES = [
			"checkup",
			"device",
			"self"
		];
		const JUDGED = [
			"changed",
			"within",
			"unjudged"
		];
		function indicatorChangeOf(value) {
			if (!value || typeof value !== "object") return null;
			const raw = value;
			const band = obj(raw.band_pct);
			const pct = num$1(raw.pct);
			const up = num$1(band.up);
			const down = num$1(band.down);
			if (pct == null || up == null || down == null) return null;
			const verdict = oneOf(raw.verdict, VERDICTS, "unclear");
			return {
				verdict,
				ask_doctor: raw.ask_doctor === true || verdict === "worse",
				pct,
				band_pct: {
					up,
					down
				},
				text_zh: str(raw.text_zh)
			};
		}
		function indicatorRowOf(raw) {
			const id = str(raw.id);
			const label = str(raw.label_zh);
			if (!id || !label) return null;
			const latestRaw = raw.latest == null ? null : obj(raw.latest);
			const latestText = latestRaw ? str(latestRaw.text) : "";
			const latestValue = latestRaw ? num$1(latestRaw.value) : null;
			const latest = latestRaw && str(latestRaw.date) && (latestValue != null || latestText) ? {
				date: str(latestRaw.date),
				value: latestValue,
				...latestText ? { text: latestText } : {}
			} : null;
			const change = indicatorChangeOf(raw.change);
			const readError = str(raw.read_error);
			const judged = readError ? "unjudged" : oneOf(raw.judged, JUDGED, "unjudged");
			return {
				id,
				label_zh: label,
				unit: str(raw.unit),
				source: oneOf(raw.source, INDICATOR_SOURCES, "checkup"),
				latest,
				points: pointsOf(raw.points),
				change: judged === "changed" ? change : null,
				judged: judged === "changed" && !change ? "unjudged" : judged,
				plan_marker: raw.plan_marker === true,
				...readError ? { read_error: readError } : {},
				...raw.gate === "too_early" || raw.gate === "not_comparable" ? { gate: raw.gate } : {},
				...str(raw.reason_zh) ? { reason_zh: str(raw.reason_zh) } : {},
				...raw.range_flag === "low" || raw.range_flag === "high" ? {
					range_flag: raw.range_flag,
					...str(raw.range_zh) ? { range_zh: str(raw.range_zh) } : {}
				} : {}
			};
		}
		function normalizeIndicators(input) {
			const raw = obj(input);
			if (!("groups" in raw) && !("record" in raw)) throw new Error("返回的不是指标数据");
			const record = obj(raw.record);
			const groups = objects(raw.groups).map((group) => {
				const key = oneOf(group.key, GROUP_KEYS, "other");
				const indicators = objects(group.indicators).map(indicatorRowOf).filter((row) => row != null);
				return {
					key,
					label_zh: str(group.label_zh) || key,
					indicators
				};
			}).filter((group) => group.indicators.length > 0);
			return {
				record: {
					status: oneOf(record.status, [
						"ok",
						"partial",
						"error",
						"none"
					], groups.length > 0 ? "ok" : "none"),
					error: str(record.error)
				},
				updated_at: str(raw.updated_at),
				groups
			};
		}
		function normalizeIndicatorDetail(input) {
			const raw = obj(input);
			const row = indicatorRowOf(obj(raw.row));
			if (!row) throw new Error("返回的不是指标详情");
			const biovar = raw.biovar == null ? null : obj(raw.biovar);
			const band = obj(biovar?.band_pct);
			const cvi = num$1(biovar?.cvi_pct);
			const up = num$1(band.up);
			const down = num$1(band.down);
			const source = obj(biovar?.source);
			return {
				row,
				all_points: objects(raw.all_points).filter((point) => str(point.date) && (num$1(point.value) != null || str(point.text))).slice(0, 200).map((point) => ({
					date: str(point.date),
					value: num$1(point.value),
					...str(point.text) ? { text: str(point.text) } : {},
					...str(point.file) ? { file: str(point.file) } : {},
					unit: str(point.unit, row.unit)
				})).sort((a, b) => a.date.localeCompare(b.date)),
				biovar: biovar && cvi != null && up != null && down != null ? {
					cvi_pct: cvi,
					band_pct: {
						up,
						down
					},
					source: {
						title: str(source.title),
						url: str(source.url),
						...str(source.doi) ? { doi: str(source.doi) } : {}
					},
					...str(biovar.caveat_zh) ? { caveat_zh: str(biovar.caveat_zh) } : {}
				} : null
			};
		}
		//#endregion
		//#region src/client/store.ts
		const PATHS = {
			journey: "/api/longpi/journey",
			board: "/api/longpi/board",
			tracking: "/api/longpi/tracking",
			self: "/api/longpi/self",
			planDraft: "/api/longpi/plan-draft",
			followup: "/api/longpi/followup",
			indicators: "/api/longpi/indicators",
			connection: "/api/longpi/connection"
		};
		/** Contract shapes are read through one normalizer each, so every surface can rely on them. */
		const SHAPE = {
			journey: normalizeJourney,
			planDraft: normalizePlanDraft,
			followup: normalizeFollowup,
			indicators: normalizeIndicators,
			connection: normalizeConnection
		};
		/** Routes that accept ?refresh=1 (drop the server's record and tracking caches first). */
		const REFRESHABLE = ["journey", "board"];
		const STALE_MS = 6e4;
		const POLL_MS = 6e5;
		function blank() {
			return {
				data: null,
				error: null,
				loading: false,
				at: 0,
				seq: 0,
				inflight: null,
				users: 0
			};
		}
		const entries = {
			journey: blank(),
			board: blank(),
			tracking: blank(),
			self: blank(),
			planDraft: blank(),
			followup: blank(),
			indicators: blank(),
			connection: blank()
		};
		const listeners$3 = /* @__PURE__ */ new Set();
		let version$1 = 0;
		let timersOn = false;
		let pageUsers = 0;
		let bridges = 0;
		let heroUsers = 0;
		let pending = null;
		let promptNote = null;
		let viewRequest = null;
		let settingsOpener = null;
		function canonTab(tab) {
			if (tab === "indicators") return "labs";
			return tab;
		}
		function emit() {
			version$1 += 1;
			for (const listener of listeners$3) listener();
		}
		function subscribe(listener) {
			listeners$3.add(listener);
			return () => {
				listeners$3.delete(listener);
			};
		}
		function load(key, mode = "reuse") {
			const entry = entries[key];
			if (entry.inflight && mode === "reuse") return entry.inflight;
			entry.seq += 1;
			const seq = entry.seq;
			entry.loading = true;
			const run = getJson(mode === "refresh" && REFRESHABLE.includes(key) ? `${PATHS[key]}?refresh=1` : PATHS[key]).then((raw) => {
				if (seq !== entry.seq) return;
				entry.data = SHAPE[key] ? SHAPE[key](raw) : raw;
				entry.error = null;
				entry.at = Date.now();
			}).catch((error) => {
				if (seq !== entry.seq) return;
				entry.error = errorText(error, "没有读到");
			}).finally(() => {
				if (seq !== entry.seq) return;
				entry.loading = false;
				entry.inflight = null;
				emit();
			});
			entry.inflight = run;
			emit();
			return run;
		}
		function inUse() {
			return Object.keys(entries).filter((key) => entries[key].users > 0);
		}
		function stale(key) {
			return Date.now() - entries[key].at > STALE_MS;
		}
		function startTimers() {
			if (timersOn || typeof window === "undefined") return;
			timersOn = true;
			const revive = () => {
				if (document.visibilityState === "hidden") return;
				for (const key of inUse()) if (stale(key)) load(key);
			};
			window.addEventListener("focus", revive);
			document.addEventListener("visibilitychange", revive);
			window.setInterval(() => {
				for (const key of inUse()) load(key);
			}, POLL_MS);
			listenForChanges();
		}
		/**
		* 0.5.3: the server says when something changed (a chat turn saved a check-in, the coach wrote new
		* surfaces, a visit was logged): what is on screen loads again at once. The 10-minute poll stays.
		*/
		function listenForChanges() {
			if (typeof EventSource === "undefined") return;
			let source = null;
			const open = () => {
				try {
					source = new EventSource("/api/longpi/events");
					const reload = () => {
						for (const key of inUse()) load(key, "fresh");
					};
					for (const type of [
						"surfaces",
						"memory",
						"triage",
						"changed"
					]) source.addEventListener(type, reload);
					source.onerror = () => {
						if (source && source.readyState === EventSource.CLOSED) source = null;
					};
				} catch {
					source = null;
				}
			};
			open();
		}
		/**
		* Reload what is on screen. With force the journey goes first with
		* ?refresh=1 so the server re-reads Mirobody once, then the rest follow.
		*/
		async function refreshAll(force = false) {
			const keys = inUse();
			if (force) {
				await load("journey", "refresh");
				await Promise.all(keys.filter((key) => key !== "journey").map((key) => load(key, "fresh")));
				return;
			}
			await Promise.all(keys.map((key) => load(key)));
		}
		/**
		* Call after any save: every surface refetches what it shows, with a new
		* request. A request started before the save may answer with the state before
		* it, so it is superseded (its seq no longer matches) instead of joined.
		*/
		function notifyChanged() {
			const shown = new Set(inUse());
			for (const key of Object.keys(entries)) {
				const entry = entries[key];
				entry.at = 0;
				if (shown.has(key)) continue;
				if (entry.inflight) {
					entry.seq += 1;
					entry.inflight = null;
					entry.loading = false;
				}
			}
			for (const key of shown) load(key, "fresh");
			emit();
		}
		function useResource(key) {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			react.default.useEffect(() => {
				const entry = entries[key];
				entry.users += 1;
				startTimers();
				if (entry.data == null && !entry.inflight || stale(key)) load(key);
				return () => {
					entry.users -= 1;
				};
			}, [key]);
			const entry = entries[key];
			return {
				data: entry.data,
				loading: entry.loading || entry.data == null && entry.error == null,
				error: entry.error
			};
		}
		function useJourney() {
			const resource = useResource("journey");
			const refresh = react.default.useCallback((force = false) => refreshAll(force), []);
			return {
				journey: resource.data,
				loading: resource.loading,
				error: resource.error,
				refresh
			};
		}
		function useBoard() {
			return useResource("board");
		}
		function useTracking() {
			return useResource("tracking");
		}
		function useSelfRows() {
			return useResource("self");
		}
		function usePlanDraft() {
			return useResource("planDraft");
		}
		function useFollowup() {
			return useResource("followup");
		}
		function useIndicators() {
			return useResource("indicators");
		}
		function useConnection() {
			return useResource("connection");
		}
		/** The cached board, without asking for it: the chat cards only borrow skill names when it is there. */
		function useCachedBoard() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return entries.board.data;
		}
		/** Fetch one resource again now (a retry, or a test send that only adds a log row). */
		function reload(key) {
			return load(key, "fresh");
		}
		/** A connection route answered with the connection's new state: take it as is. */
		function putConnection(value) {
			const entry = entries.connection;
			entry.seq += 1;
			entry.data = value;
			entry.error = null;
			entry.loading = false;
			entry.inflight = null;
			entry.at = Date.now();
			emit();
		}
		/** The exclude route answers with the draft as it now is: take it as is. */
		function putPlanDraft(raw) {
			const entry = entries.planDraft;
			entry.seq += 1;
			entry.data = normalizePlanDraft(raw);
			entry.error = null;
			entry.loading = false;
			entry.inflight = null;
			entry.at = Date.now();
			emit();
		}
		/** A route that answers a save with the resource's new state: take it as is, no second request. */
		function putFollowup(raw) {
			const entry = entries.followup;
			entry.seq += 1;
			entry.data = normalizeFollowup(raw);
			entry.error = null;
			entry.loading = false;
			entry.inflight = null;
			entry.at = Date.now();
			emit();
		}
		/**
		* The reminder pill hides while the LongPi page is on screen. On screen, not
		* mounted: a host that keeps a hidden panel mounted must not silence the pill.
		*/
		function usePageShown(ref) {
			react.default.useEffect(() => {
				const node = ref.current;
				let shown = false;
				const set = (next) => {
					if (next === shown) return;
					shown = next;
					pageUsers += next ? 1 : -1;
					emit();
				};
				if (!node || typeof IntersectionObserver === "undefined") {
					set(true);
					return () => set(false);
				}
				const observer = new IntersectionObserver((seen) => set(seen.some((entry) => entry.isIntersecting)));
				observer.observe(node);
				return () => {
					observer.disconnect();
					set(false);
				};
			}, [ref]);
		}
		/** The home greeting counts itself while mounted: its row already lists today's check-ins, so the pill stays away. */
		function useHeroShown() {
			react.default.useEffect(() => {
				heroUsers += 1;
				emit();
				return () => {
					heroUsers -= 1;
					emit();
				};
			}, []);
		}
		function useHeroShowing() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return heroUsers > 0;
		}
		function usePageShowing() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return pageUsers > 0;
		}
		/**
		* A prompt waiting for the composer. PromptBridge (in conversation.input.dock,
		* which DSH renders only while a session exists) takes it and inserts it.
		* While no session exists every prompt waits, a pill's or the page's, because
		* the note below the home row tells the person it will be put in once they
		* pick a workspace. Once a composer is there, a page prompt it did not take is
		* dropped after 30 s so a later chat is not surprised by it.
		*/
		const PAGE_PROMPT_MS = 3e4;
		function livePending() {
			if (pending && pending.origin === "page" && bridges > 0 && Date.now() - pending.at > PAGE_PROMPT_MS) pending = null;
			return pending;
		}
		function setPendingPrompt(text, origin = "page") {
			pending = {
				text,
				at: Date.now(),
				origin
			};
			emit();
		}
		function takePendingPrompt() {
			const current = livePending();
			pending = null;
			return current ? current.text : null;
		}
		function hasPendingPrompt() {
			return livePending() != null;
		}
		function usePendingVersion() {
			return react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
		}
		/** PromptBridge counts itself while mounted: that is how the home knows a session (and a composer to write into) exists. */
		function useBridgeMounted() {
			react.default.useEffect(() => {
				if (bridges === 0 && pending) pending = {
					...pending,
					at: Date.now()
				};
				bridges += 1;
				emit();
				return () => {
					bridges -= 1;
					emit();
				};
			}, []);
		}
		function useComposerReady() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return bridges > 0;
		}
		/** The bridge renders nothing, so what it has to say (the clipboard fallback) shows under the home row. */
		function setPromptNote(text) {
			if (!text && !promptNote) return;
			promptNote = text ? {
				text,
				id: Date.now()
			} : null;
			emit();
			if (!text) return;
			const id = promptNote?.id;
			window.setTimeout(() => {
				if (promptNote?.id !== id) return;
				promptNote = null;
				emit();
			}, 4e3);
		}
		function usePromptNote() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return promptNote?.text ?? null;
		}
		/** Open the page at a tab (and a section in it): the page switches and scrolls once it shows them. */
		function requestView(request) {
			viewRequest = { ...request };
			emit();
		}
		function useViewRequest() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return viewRequest;
		}
		function clearViewRequest(request) {
			if (viewRequest === request) viewRequest = null;
		}
		/**
		* DSH hands openSection only to an onboarding step. The step keeps it here, so
		* the page and the chat can open settings later in the same visit; until it
		* has, they say where to find the setting instead.
		*/
		function setSettingsOpener(open) {
			if (!open || open === settingsOpener) return;
			settingsOpener = open;
			emit();
		}
		function useSettingsOpener() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return settingsOpener;
		}
		/** Re-render on any store change (for state kept outside the resources, such as check-in marks). */
		function useStoreVersion() {
			return react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
		}
		function bumpStore() {
			emit();
		}
		/** When the journey on screen was fetched (0 before the first answer). */
		function journeyFetchedAt() {
			return entries.journey.at;
		}
		//#endregion
		//#region src/client/checkin.ts
		const marks = /* @__PURE__ */ new Map();
		function keyOf(day, id) {
			return `${day}|${id}`;
		}
		/** The item's state today: a fresh local answer, else what the server says. */
		function checkStateOf(journey, id) {
			const mark = marks.get(keyOf(journey.today, id));
			if (mark && mark.at >= journeyFetchedAt()) return mark.state;
			return journey.plan.checkin_items.find((row) => row.id === id)?.done_today ?? null;
		}
		/** Post one answer for today. Resolves true when the server kept it. */
		async function postCheckIn(day, id, state) {
			await postJson("/api/longpi/checkin", {
				item: id,
				done: state
			});
			marks.set(keyOf(day, id), {
				state,
				at: Date.now()
			});
			bumpStore();
			notifyChanged();
		}
		const SAID = {
			true: "今天完成",
			false: "今天没做到",
			null: "已撤销今天的记录"
		};
		function saidText(title, state) {
			return state === null ? `「${title}」${SAID.null}。` : `已记下：${title}，${SAID[String(state)]}。`;
		}
		function useCheckIns(journey, onNotice) {
			useStoreVersion();
			const [busy, setBusy] = react.default.useState(null);
			const [error, setError] = react.default.useState(null);
			const today = journey.today;
			return {
				stateOf: (id) => checkStateOf(journey, id),
				busy,
				error,
				answer: react.default.useCallback((id, title, state) => {
					setBusy(id);
					setError(null);
					postCheckIn(today, id, state).then(() => onNotice?.(saidText(title, state), "good")).catch((err) => {
						const text = `没有记下「${title}」：${errorText(err, "请稍后再试")}`;
						setError(text);
						onNotice?.(text, "bad");
					}).finally(() => setBusy(null));
				}, [today, onNotice])
			};
		}
		/** How many of today's items have an answer, and how many are done. */
		function todayCounts(journey) {
			const items = journey.plan.checkin_items;
			let done = 0;
			let answered = 0;
			for (const row of items) {
				const state = checkStateOf(journey, row.id);
				if (state === true) done += 1;
				if (state !== null) answered += 1;
			}
			return {
				done,
				answered,
				total: items.length
			};
		}
		const h$46 = react.default.createElement;
		/**
		* The answer controls for one item: 完成 and 没做到 while unanswered; the
		* answer and 撤销 once given. Every state carries words, never color alone.
		*/
		function CheckChoices(props) {
			const { state, busy } = props;
			if (state === null) return h$46("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$46("button", {
				type: "button",
				className: "lp-choice lp-choice-done",
				disabled: busy,
				onClick: () => props.onAnswer(true)
			}, h$46(Icon, {
				name: "check",
				size: 13,
				strokeWidth: 2
			}), busy ? "记录中" : "完成"), h$46("button", {
				type: "button",
				className: "lp-choice",
				disabled: busy,
				onClick: () => props.onAnswer(false)
			}, "没做到"));
			return h$46("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$46("span", { className: `lp-choice-state ${state ? "lp-choice-state-done" : "lp-choice-state-missed"}` }, h$46(Icon, {
				name: state ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), state ? "已完成" : "没做到"), h$46("button", {
				type: "button",
				className: "lp-choice lp-choice-undo",
				disabled: busy,
				onClick: () => props.onAnswer(null),
				"aria-label": `撤销「${props.title}」今天的记录`
			}, busy ? "撤销中" : "撤销"));
		}
		//#endregion
		//#region src/contracts/feedback.ts
		/** The rule behind allowed_claims 'younger' (contract invariant). */
		function youngerAllowed(message) {
			const delta = message.delta;
			return message.subject.kind === "bioage" && message.grade === "beyond_band_better" && delta != null && delta.band_verified && delta.interval_days >= delta.min_interval_days && delta.same_lab !== false;
		}
		//#endregion
		//#region src/feedback/retest-timing.ts
		const LIPIDS = /* @__PURE__ */ new Set([
			"tc",
			"ldl",
			"hdl",
			"tg",
			"non_hdl",
			"nonhdl",
			"cholesterol",
			"ldl_c",
			"hdl_c",
			"ldlc",
			"hdlc"
		]);
		function addDays$1(iso, days) {
			const at = /* @__PURE__ */ new Date(`${iso.slice(0, 10)}T00:00:00Z`);
			at.setUTCDate(at.getUTCDate() + days);
			return at.toISOString().slice(0, 10);
		}
		function daysBetween(from, to) {
			const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
			const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
			if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
			return Math.round((end - start) / 864e5);
		}
		function retestAdvice(key) {
			const k = key.trim().toLowerCase();
			if (k === "hba1c" || k.includes("hba1c") || k.includes("a1c")) return {
				minDays: 90,
				earliestDays: 90,
				recommendedDays: 90,
				family: "hba1c",
				why_zh: "糖化血红蛋白反映近 3 个月的平均血糖，两次至少要隔 90 天。"
			};
			if (k === "phenoage" || k === "bioage" || k === "bodyage") return {
				minDays: 90,
				earliestDays: 90,
				recommendedDays: 180,
				family: "bioage",
				why_zh: "身体年龄的测量波动大约有两三岁。隔 3 到 6 个月、在同一家实验室再测，才分得清是不是真实变化。"
			};
			if (k === "vitd" || k === "vitamin_d" || k === "25ohd" || k.includes("vitd")) return {
				minDays: 90,
				earliestDays: 90,
				recommendedDays: 90,
				family: "vitamin_d",
				why_zh: "维生素 D 至少隔 90 天再测，更早的起伏多半是波动。"
			};
			if (LIPIDS.has(k)) return {
				minDays: 56,
				earliestDays: 56,
				recommendedDays: 84,
				family: "lipids",
				why_zh: "血脂的真实变化通常要 8–12 周才看得出来。"
			};
			if (k === "glucose" || k === "fpg" || k === "fasting_glucose") return {
				minDays: 56,
				earliestDays: 56,
				recommendedDays: 84,
				family: "glucose",
				why_zh: "空腹血糖的真实变化通常要 8–12 周才看得出来。"
			};
			if (k === "weight" || k === "bmi" || k === "bodymass") return {
				minDays: 56,
				earliestDays: 56,
				recommendedDays: 84,
				family: "weight",
				why_zh: "体重的真实变化通常要 8–12 周才看得出来。"
			};
			return {
				minDays: 28,
				earliestDays: 28,
				recommendedDays: 56,
				family: "other",
				why_zh: "这项至少隔 4 周再测，才分得清波动和真实变化。"
			};
		}
		/**
		* Dates to show. `waitedDays` is how long the person has already waited (plan days, or the gap between the two draws).
		* `completedOn` is the date of a draw that already happened. The window stays anchored to that draw: it does not
		* slide forward with today, and a draw inside the minimum interval is the retest, not a reason to open the next one.
		*/
		function retestDates$1(today, advice, waitedDays, anchor, completedOn = null) {
			const done = completedOn && /^\d{4}-\d{2}-\d{2}/.test(completedOn) ? completedOn.slice(0, 10) : "";
			if (done && daysBetween(done, today) >= 0 && daysBetween(done, today) < advice.minDays) return {
				earliest: done,
				recommended: done,
				why_zh: `复测已在 ${done} 完成。`
			};
			const base = (anchor && /^\d{4}-\d{2}-\d{2}/.test(anchor) ? anchor : today).slice(0, 10);
			const waited = waitedDays ?? 0;
			if (waited < advice.minDays) {
				const earliest = addDays$1(today, advice.minDays - waited);
				return {
					earliest,
					recommended: addDays$1(earliest, Math.max(0, advice.recommendedDays - advice.minDays)),
					why_zh: advice.why_zh
				};
			}
			return {
				earliest: addDays$1(base, advice.earliestDays),
				recommended: addDays$1(base, advice.recommendedDays),
				why_zh: advice.why_zh
			};
		}
		//#endregion
		//#region src/feedback/grade.ts
		/**
		* The body-age sentence the tracking step already chose (see ux/body-age.ts), for the graded message.
		* The page, the chat and the share card all read this one sentence.
		*/
		function bioAgeStory(headline, allowsYounger) {
			const text = (headline ?? "").trim();
			if (!/你确实年轻了|算出来小了/.test(text)) return {};
			return {
				story_zh: text,
				story_younger: allowsYounger === true && !/不一定是好事/.test(text)
			};
		}
		const DEATH_RISK = /10\s*年死亡风险/;
		const BARE = /^无法判断[。.!！]?$/;
		function mentionsDeathRisk(text) {
			return DEATH_RISK.test(text);
		}
		/** A positive "you got younger" claim. A sentence that says we cannot call it that does not count. */
		function announcesYounger(text) {
			return text.split(/[。！？]/).some((sentence) => /你确实年轻了|比实足年龄年轻|你变年轻了|年轻了\s*\d/.test(sentence) && !/不能|不是|先不|不要|别/.test(sentence));
		}
		function showNum(value) {
			if (!Number.isFinite(value)) return "—";
			const abs = Math.abs(value);
			const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
			return String(Number(value.toFixed(digits)));
		}
		function showYears(value) {
			if (!Number.isFinite(value)) return "—";
			return String(Math.round(value * 10) / 10);
		}
		function projectionSentence(label, target, years, from) {
			const targetNum = Number.parseFloat(target);
			const fromNum = from == null ? NaN : Number.parseFloat(from);
			return `模型估计：${label}${Number.isFinite(targetNum) && Number.isFinite(fromNum) && targetNum < fromNum ? "降到" : "到"} ${target}${years == null || !Number.isFinite(years) ? "" : years < -.05 ? `，身体年龄约年轻 ${showYears(-years)} 岁` : years > .05 ? `，身体年龄约增加 ${showYears(years)} 岁` : "，身体年龄几乎不动"}。`;
		}
		function refOf(key, label, value, unit, date, source) {
			return {
				key,
				label_zh: label,
				value,
				unit,
				date,
				source,
				text: unit === "%" ? `${showNum(value)}%` : unit === "岁" ? `${showNum(value)} 岁` : `${showNum(value)} ${unit}`.trim()
			};
		}
		function slug(prefix, key) {
			const clean = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
			const id = `${prefix}-${clean}`;
			return id.length >= 6 ? id.slice(0, 64) : `${prefix}-item-${clean}`.slice(0, 64);
		}
		function listZh(names, max = 4) {
			const shown = names.filter(Boolean).slice(0, max);
			if (shown.length === 0) return "";
			const more = names.length > shown.length ? "等" : "";
			if (shown.length === 1) return `${shown[0]}${more}`;
			if (shown.length === 2) return `${shown[0]}和${shown[1]}${more}`;
			return `${shown.slice(0, -1).join("、")}和${shown[shown.length - 1]}${more}`;
		}
		/** Direction the literature gives a common marker, when the plan row does not. */
		function knownBetter(key, label) {
			const text = `${key} ${label}`.toLowerCase();
			if (/hdl|高密度/.test(text) && !/非高密度|non-?hdl/.test(text)) return "higher";
			if (/体重|腰围|bmi|\bweight\b/.test(text)) return "none";
			if (/ldl|低密度|总胆固醇|甘油三酯|空腹血糖|血糖|糖化|hba1c|crp|反应蛋白|收缩压|舒张压|\btc\b|\btg\b|\bsbp\b|\bdbp\b|glucose/.test(text)) return "lower";
			return null;
		}
		function towardBetter(better, deltaPct) {
			if (deltaPct == null || !Number.isFinite(deltaPct) || Math.abs(deltaPct) < .05) return "flat";
			if (better === "lower") return deltaPct < 0 ? "improving" : "worse";
			if (better === "higher") return deltaPct > 0 ? "improving" : "worse";
			return "flat";
		}
		function isBeyond(marker) {
			if (marker.delta_pct == null || marker.band_down_pct == null || marker.band_up_pct == null) return false;
			return marker.delta_pct > marker.band_up_pct || marker.delta_pct < marker.band_down_pct;
		}
		function waitedOf(marker) {
			if (marker.waited_days != null && Number.isFinite(marker.waited_days)) return marker.waited_days;
			if (marker.from_date && marker.to_date) return daysBetween(marker.from_date, marker.to_date);
			return null;
		}
		function classifyMarker(marker) {
			const blocked = marker.blocked_by ?? "";
			if (/too soon|太早|还不到/.test(blocked)) return "too_early";
			if (/home mean|one office|诊室|家庭血压/.test(blocked)) return "not_judgeable";
			if (/no direction|没有方向|没有单一/.test(blocked)) return "not_judgeable";
			if (/not comparable|无法换算|不同实验室|不可比/.test(blocked)) return "not_comparable";
			if (/glucose fall/.test(blocked)) return "not_judgeable";
			if (marker.verdict === "working") return "beyond_band_better";
			if (marker.verdict === "wrong way") return "beyond_band_worse";
			if (marker.verdict === "within noise") return withinGrade(marker);
			if (marker.verdict === "cannot tell") {
				if (/beyond band|超出/.test(blocked) && !/within noise|正常波动/.test(blocked)) return towardBetter(marker.better, marker.delta_pct) === "worse" ? "beyond_band_worse" : "beyond_band_better";
				if (/within noise|正常波动|adherence|执行/.test(blocked) || !isBeyond(marker)) return withinGrade(marker);
				return "not_judgeable";
			}
			const advice = retestAdvice(marker.key);
			const waited = waitedOf(marker);
			if (waited != null && waited < advice.minDays && marker.from != null && marker.to != null) return "too_early";
			if (marker.same_lab === false) return "not_comparable";
			if (marker.better === "none" && isBeyond(marker)) return "not_judgeable";
			if (isBeyond(marker)) return towardBetter(marker.better, marker.delta_pct) === "worse" ? "beyond_band_worse" : "beyond_band_better";
			if (marker.from == null || marker.to == null) return "not_judgeable";
			return withinGrade(marker);
		}
		function withinGrade(marker) {
			const way = towardBetter(marker.better, marker.delta_pct);
			if (way === "improving") return "within_band_improving";
			if (way === "worse") return "within_band_worse";
			return "within_band_flat";
		}
		function movePhrase(marker) {
			if (marker.from == null || marker.to == null) return marker.label_zh;
			const from = refOf(`${marker.key}@from`, marker.label_zh, marker.from, marker.unit, marker.from_date, "record");
			const to = refOf(`${marker.key}@to`, marker.label_zh, marker.to, marker.unit, marker.to_date, "record");
			const verb = marker.to < marker.from ? "降到" : marker.to > marker.from ? "升到" : "仍是";
			return `${marker.label_zh}从 ${from.text} ${verb} ${to.text}`;
		}
		function claimsFor(grade, kind, askDoctor) {
			if (grade === "behaviour_done") return ["affirm"];
			if (grade === "projection") return ["target"];
			if (grade === "first_draw") return ["progress_story", "retest_when"];
			if (grade === "too_early" || grade === "not_comparable" || grade === "not_judgeable") return ["retest_when", "progress_story"];
			if (grade === "beyond_band_worse") return askDoctor ? ["see_doctor", "retest_when"] : ["see_doctor", "retest_when"];
			if (grade === "beyond_band_better") {
				const claims = [
					"celebrate",
					"improved",
					"retest_when"
				];
				if (askDoctor) return [
					"see_doctor",
					"improved",
					"retest_when"
				];
				if (kind === "bioage") claims.push("younger");
				return claims;
			}
			return ["progress_story", "retest_when"];
		}
		function toneFor(grade, askDoctor) {
			if (askDoctor || grade === "beyond_band_worse") return "care";
			if (grade === "beyond_band_better" || grade === "behaviour_done") return "celebrate";
			if (grade === "within_band_improving" || grade === "projection") return "encourage";
			return "neutral";
		}
		function numbersOf(marker) {
			const out = [];
			if (marker.from != null) out.push(refOf(`${marker.key}@${marker.from_date ?? "base"}`, marker.label_zh, marker.from, marker.unit, marker.from_date, "record"));
			if (marker.to != null) out.push(refOf(`${marker.key}@${marker.to_date ?? "now"}`, marker.label_zh, marker.to, marker.unit, marker.to_date, "record"));
			if (marker.delta_pct != null) out.push(refOf(`${marker.key}.delta_pct`, `${marker.label_zh}变化`, marker.delta_pct, "%", marker.to_date, "derived"));
			return out;
		}
		function deltaOf(marker, advice) {
			const interval = waitedOf(marker) ?? 0;
			return {
				value: marker.delta_pct ?? 0,
				unit: "%",
				band: marker.band_down_pct != null && marker.band_up_pct != null ? [marker.band_down_pct, marker.band_up_pct] : null,
				band_verified: marker.band_verified,
				interval_days: interval,
				min_interval_days: advice.minDays,
				same_lab: marker.same_lab ?? null
			};
		}
		function caveat(marker, grade) {
			const blocked = marker.blocked_by ?? "";
			const parts = [];
			if (/adherence|执行/.test(blocked)) parts.push(grade === "beyond_band_better" || grade === "beyond_band_worse" ? "执行记录还不够，这次不能把变化算成方案的效果。" : "执行记录还不够，这次不评价方案本身。");
			if (marker.confounders && marker.confounders.length > 0) parts.push(`同期还有其他变化（${marker.confounders.slice(0, 2).join("；")}），不能把变化算成某一项单独的效果。`);
			if (marker.ask_doctor) parts.push("这项要先给医生看，不要自己当成进步。");
			return parts.join("");
		}
		function schedule(marker, advice, today, grade) {
			const waited = waitedOf(marker);
			const comparable = grade === "within_band_improving" || grade === "within_band_flat" || grade === "within_band_worse" || grade === "beyond_band_better" || grade === "beyond_band_worse";
			const anchor = comparable ? marker.to_date ?? today : today;
			const completed = comparable ? marker.to_date ?? null : null;
			const dates = retestDates$1(today, advice, grade === "too_early" ? waited : waited != null && waited >= advice.minDays ? advice.minDays : waited, anchor, completed);
			return {
				earliest: dates.earliest,
				recommended: dates.recommended,
				why_zh: dates.why_zh
			};
		}
		function gradeMarker(marker, today) {
			const grade = classifyMarker(marker);
			const advice = retestAdvice(marker.key);
			const ask = marker.ask_doctor === true;
			const extra = caveat(marker, grade);
			let headline = "";
			let body = "";
			if (/home mean|one office|诊室/.test(marker.blocked_by ?? "")) {
				headline = `${marker.label_zh}只有一次诊室读数，还不能比较。请连续 7 天在家测量后再看方向。`;
				body = "一次诊室血压落在波动里或外面，都不能下结论。";
			} else if (/no direction|没有方向/.test(marker.blocked_by ?? "") && marker.range_flag && ask && marker.from != null && marker.to != null) headline = `${movePhrase(marker)}，变化超出了波动，而且已经${marker.range_flag === "low" ? "低于" : "高于"}参考范围。建议带着这几次体检报告问医生。`;
			else if (/no direction|没有方向/.test(marker.blocked_by ?? "")) headline = marker.from != null && marker.to != null ? `${movePhrase(marker)}，变化${isBeyond(marker) ? "超出了波动" : "还不大"}，但${marker.label_zh}没有单一的好坏方向，所以先不说变好或变差。` : `${marker.label_zh}没有单一的好坏方向，所以先不说变好或变差。`;
			else if (/glucose fall/.test(marker.blocked_by ?? "")) headline = `${movePhrase(marker)}。血糖下降不一定是好事，先对照参考范围，不把它说成进步。`;
			else if (grade === "too_early") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${marker.label_zh}还不到能下结论的时间。${advice.why_zh}最早 ${dates?.earliest} 再测。`;
				body = "这次先不下结论。";
			} else if (grade === "not_comparable") headline = `${marker.label_zh}这两次不能直接比（单位或实验室对不上）。先复查一次再下结论。`;
			else if (grade === "beyond_band_better") {
				headline = `${movePhrase(marker)}，超出了测量波动，是真实的变化。`;
				body = extra;
			} else if (grade === "beyond_band_worse") {
				headline = `${movePhrase(marker)}，超出了测量波动，方向不好。建议复查，并和医生讨论。`;
				body = extra;
			} else if (grade === "within_band_improving") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${movePhrase(marker)}，方向是对的，但还在测量波动里。${dates?.why_zh ?? ""}最早 ${dates?.earliest} 再测，才能确定是不是真实变化。`;
				body = extra;
			} else if (grade === "within_band_worse") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${movePhrase(marker)}，在波动里略偏反方向，还没有超出测量波动。先不下结论。${dates?.why_zh ?? ""}`;
				body = extra;
			} else if (grade === "within_band_flat") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${marker.label_zh}几乎没动，还在测量波动里。${dates?.why_zh ?? ""}最早 ${dates?.earliest} 再测。`;
				body = extra;
			} else {
				headline = marker.from == null ? `${marker.label_zh}还没有可以对比的基线。补上一次结果之后再看，不是没有变化。` : `${marker.label_zh}这次先不下结论：${marker.blocked_by || "还缺一个能对比的结果"}。`;
				body = "缺的是可比的复测或记录，不是“没有变化”。";
			}
			headline = headline.replace(/。。+/g, "。");
			if (BARE.test(headline) || headline.length < 8) headline = `${marker.label_zh}这次先不下结论，补上可比的结果后再看。`;
			const claims = claimsFor(grade, "marker", ask).filter((claim) => claim !== "younger");
			return {
				id: slug("fb-m", marker.key),
				subject: {
					kind: "marker",
					key: marker.key,
					label_zh: marker.label_zh
				},
				grade,
				allowed_claims: claims,
				numbers: numbersOf(marker),
				delta: deltaOf(marker, advice),
				retest: schedule(marker, advice, today, grade),
				headline_zh: headline,
				...body ? { body_zh: body } : {},
				tone: toneFor(grade, ask),
				source: "template"
			};
		}
		function gradeBioAge(input, today) {
			const advice = retestAdvice("bioage");
			const points = [...input.points].filter((row) => Number.isFinite(row.phenoage)).sort((a, b) => a.date.localeCompare(b.date));
			const draws = Math.max(points.length, input.draws);
			const latest = points.at(-1);
			const first = points[0];
			const pheno = latest?.phenoage ?? input.phenoage;
			const advance = latest?.advance ?? input.advance;
			const date = latest?.date ?? input.date;
			const numbers = [];
			if (pheno != null) numbers.push(refOf("phenoage.latest", "身体年龄", pheno, "岁", date, "skill"));
			if (advance != null) numbers.push(refOf("phenoage.advance", "身体年龄与实足年龄之差", advance, "岁", date, "skill"));
			if (input.age != null) numbers.push(refOf("age", "实足年龄", input.age, "岁", today, "derived"));
			const base = {
				id: "fb-bioage",
				subject: {
					kind: "bioage",
					key: "phenoage",
					label_zh: "身体年龄"
				},
				numbers,
				source: "template"
			};
			if (points.length < 2) {
				if (draws > 1) {
					const dates = retestDates$1(today, advice, 0, today);
					return {
						...base,
						grade: "not_judgeable",
						allowed_claims: ["progress_story", "retest_when"],
						retest: {
							earliest: dates.earliest,
							recommended: dates.recommended,
							why_zh: advice.why_zh
						},
						headline_zh: "几次身体年龄还没有对齐，先不说变年轻。对上同一天的九项血检后再比。",
						tone: "neutral"
					};
				}
				const low = advance != null && pheno != null ? advance < -.05 ? `这次算出 ${showNum(pheno)} 岁，比实足年龄低 ${showNum(-advance)} 岁。` : advance > .05 ? `这次算出 ${showNum(pheno)} 岁，比实足年龄高 ${showNum(advance)} 岁。` : `这次算出 ${showNum(pheno)} 岁，和实足年龄相当。` : pheno != null ? `这次算出 ${showNum(pheno)} 岁。` : "";
				const dates = retestDates$1(today, advice, 0, today);
				const headline = `${low}这是第一次身体年龄，一次检查不能说明你变年轻了。${advice.why_zh}最早 ${dates.earliest} 再测。`;
				return {
					...base,
					grade: "first_draw",
					allowed_claims: ["progress_story", "retest_when"],
					retest: {
						earliest: dates.earliest,
						recommended: dates.recommended,
						why_zh: advice.why_zh
					},
					headline_zh: headline,
					tone: "neutral"
				};
			}
			const span = daysBetween(first?.date ?? today, latest?.date ?? today);
			const deltaYears = first?.advance != null && latest?.advance != null ? latest.advance - first.advance : latest && first ? latest.phenoage - first.phenoage : null;
			if (deltaYears != null) numbers.push(refOf("phenoage.delta", "身体年龄变化", deltaYears, "岁", date, "derived"));
			const band = input.band_years;
			const delta = {
				value: deltaYears ?? 0,
				unit: "岁",
				band: band != null ? [-Math.abs(band), Math.abs(band)] : null,
				band_verified: input.band_verified,
				interval_days: span,
				min_interval_days: advice.minDays,
				same_lab: input.same_lab
			};
			const dates = retestDates$1(today, advice, span, latest?.date ?? today);
			if (input.same_lab === false) return {
				...base,
				numbers,
				grade: "not_comparable",
				allowed_claims: ["retest_when", "progress_story"],
				delta,
				retest: {
					earliest: dates.earliest,
					recommended: dates.recommended,
					why_zh: "两次不是同一家实验室，身体年龄不能直接比。"
				},
				headline_zh: "两次身体年龄不是同一家实验室，数字不能直接比，先不说变年轻。用同一家实验室再测一次。",
				tone: "neutral"
			};
			if (span < advice.minDays) {
				const early = retestDates$1(today, advice, span, today);
				const moved = deltaYears != null ? `两次相差 ${showYears(Math.abs(deltaYears))} 岁，` : "";
				return {
					...base,
					numbers,
					grade: "too_early",
					allowed_claims: ["retest_when", "progress_story"],
					delta,
					retest: {
						earliest: early.earliest,
						recommended: early.recommended,
						why_zh: advice.why_zh
					},
					headline_zh: `${moved}但只隔了 ${span} 天，不到 3 个月，还不能说变年轻。最早 ${early.earliest} 再测。`,
					tone: "neutral"
				};
			}
			const beyond = band != null && deltaYears != null && Math.abs(deltaYears) > Math.abs(band);
			const younger = beyond && deltaYears != null && deltaYears < 0 && input.band_verified;
			if (input.story_zh && input.story_younger === false && /算出来小了|不一定是好事/.test(input.story_zh)) return {
				...base,
				numbers,
				grade: "beyond_band_worse",
				allowed_claims: ["see_doctor", "retest_when"],
				delta,
				retest: {
					earliest: dates.earliest,
					recommended: dates.recommended,
					why_zh: advice.why_zh
				},
				headline_zh: input.story_zh,
				tone: "care"
			};
			if (younger && deltaYears != null) {
				const headline = input.story_zh && input.story_younger !== false ? input.story_zh : `你确实年轻了 ${showYears(Math.abs(deltaYears))} 岁（模型估计，超出了测量波动，是真实的变化）。`;
				const message = {
					...base,
					numbers,
					grade: "beyond_band_better",
					allowed_claims: [
						"younger",
						"celebrate",
						"improved",
						"retest_when"
					],
					delta,
					retest: {
						earliest: dates.earliest,
						recommended: dates.recommended,
						why_zh: advice.why_zh
					},
					headline_zh: headline,
					tone: "celebrate"
				};
				if (!youngerAllowed(message)) message.allowed_claims = message.allowed_claims.filter((claim) => claim !== "younger");
				return message;
			}
			if (beyond && deltaYears != null && deltaYears > 0) return {
				...base,
				numbers,
				grade: "beyond_band_worse",
				allowed_claims: ["see_doctor", "retest_when"],
				delta,
				retest: {
					earliest: dates.earliest,
					recommended: dates.recommended,
					why_zh: advice.why_zh
				},
				headline_zh: `身体年龄高了 ${showYears(deltaYears)} 岁，超出了测量波动。这不是“变年轻”。建议和医生看一看是哪项指标带上去的。`,
				tone: "care"
			};
			if (beyond && !input.band_verified && deltaYears != null && deltaYears < 0) return {
				...base,
				numbers,
				grade: "beyond_band_better",
				allowed_claims: [
					"celebrate",
					"improved",
					"retest_when"
				],
				delta,
				retest: {
					earliest: dates.earliest,
					recommended: dates.recommended,
					why_zh: advice.why_zh
				},
				headline_zh: `身体年龄低了 ${showYears(Math.abs(deltaYears))} 岁，超出了给出的波动范围。波动数据的来源还没核对，所以先不说你变年轻了。`,
				body_zh: advice.why_zh,
				tone: "encourage"
			};
			const way = deltaYears == null ? "flat" : deltaYears < -.05 ? "improving" : deltaYears > .05 ? "worse" : "flat";
			const grade = way === "improving" ? "within_band_improving" : way === "worse" ? "within_band_worse" : "within_band_flat";
			const bandText = band != null ? `测量波动大约 ±${showYears(band)} 岁。` : "";
			const moved = deltaYears != null && Math.abs(deltaYears) >= .05 ? `身体年龄变化 ${showYears(Math.abs(deltaYears))} 岁，还在波动里。` : "身体年龄几乎没动，还在测量波动里。";
			return {
				...base,
				numbers,
				grade,
				allowed_claims: ["progress_story", "retest_when"],
				delta,
				retest: {
					earliest: dates.earliest,
					recommended: dates.recommended,
					why_zh: advice.why_zh
				},
				headline_zh: `${moved}${bandText}还不能说变年轻。${advice.why_zh}`,
				tone: way === "improving" ? "encourage" : "neutral"
			};
		}
		function judged(grade) {
			return grade === "beyond_band_better" || grade === "beyond_band_worse" || grade.startsWith("within_band");
		}
		/** A change the row already called past the band, including one with no good/bad direction. */
		function movedPastBand(row) {
			if (/超出了(测量)?波动|超出正常波动/.test(row.headline_zh)) return true;
			const band = row.delta?.band;
			const value = row.delta?.value;
			if (!band || value == null) return false;
			return value > band[1] || value < band[0];
		}
		function progressStory(markers, today) {
			const comparable = markers.filter((row) => judged(row.grade));
			const better = markers.filter((row) => row.grade === "beyond_band_better" && row.tone !== "care");
			const worse = markers.filter((row) => row.grade === "beyond_band_worse");
			const improving = markers.filter((row) => row.grade === "within_band_improving" || row.grade === "beyond_band_better" && row.tone !== "care");
			const withinNames = listZh(markers.filter((row) => row.grade === "within_band_improving").map((row) => row.subject.label_zh));
			const n = comparable.length;
			const k = improving.length;
			const advice = retestAdvice("ldl");
			const drawn = [...new Set(markers.flatMap((row) => row.numbers.map((item) => item.date ?? "")).filter((day) => /^\d{4}-\d{2}-\d{2}/.test(day)))].sort();
			const latestDraw = drawn.at(-1) ?? null;
			const completedDraw = drawn.length >= 2 ? latestDraw : null;
			let grade = "not_judgeable";
			let headline = "这次先不下结论：还没有可以对比的结果。补上复测后再看，不是没有变化。";
			let tone = "neutral";
			if (better.length > 0) {
				grade = "beyond_band_better";
				tone = "celebrate";
				headline = `${listZh(better.map((row) => row.subject.label_zh))}超出了测量波动，是真实的变化。`;
				if (n > better.length) headline += `${n} 项里 ${k} 项在变好${withinNames ? `，波动里往好走的有${withinNames}` : ""}。再隔 8–12 周复查，才能给其余项一个确切答案。`;
			} else if (worse.length > 0 && k === 0) {
				grade = "beyond_band_worse";
				tone = "care";
				headline = `${listZh(worse.map((row) => row.subject.label_zh))}超出了测量波动，方向不好。建议复查，并和医生讨论。`;
			} else if (k > 0) {
				grade = "within_band_improving";
				tone = "encourage";
				headline = `方向对了：${n} 项里 ${k} 项在变好${withinNames ? `（${withinNames}）` : ""}。还在测量波动里，再隔 8–12 周复查，才看得出是不是确切变化。`;
			} else if (markers.some((row) => row.grade === "within_band_worse")) {
				grade = "within_band_worse";
				tone = "neutral";
				headline = `${n} 项都还在测量波动里，有的略偏反方向。先不下结论。再隔 8–12 周复查。`;
			} else if (markers.some((row) => row.grade === "within_band_flat")) {
				grade = "within_band_flat";
				tone = "neutral";
				headline = `这 ${n} 项都还在测量波动里，没有一项已经超出。再隔 8–12 周复查，才能确定有没有确切变化。`;
			} else if (markers.some((row) => movedPastBand(row))) {
				tone = "care";
				headline = `${listZh(markers.filter((row) => movedPastBand(row)).map((row) => row.subject.label_zh))}的变化超出了正常波动。先不说变好或变差。`;
			} else if (markers.some((row) => row.grade === "too_early")) {
				grade = "too_early";
				headline = "这几项还不到能下结论的时间。按每项自己的间隔再测，糖化血红蛋白至少要满 90 天。";
			}
			const dates = retestDates$1(today, advice, advice.minDays, latestDraw, grade === "too_early" ? null : completedDraw);
			const claims = claimsFor(grade, "marker", false).filter((claim) => claim !== "younger");
			return {
				id: "fb-summary",
				subject: {
					kind: "marker",
					key: "panel",
					label_zh: "这次的变化"
				},
				grade,
				allowed_claims: claims,
				numbers: markers.flatMap((row) => row.numbers).slice(0, 12),
				retest: {
					earliest: dates.earliest,
					recommended: dates.recommended,
					why_zh: dates.why_zh
				},
				headline_zh: headline,
				body_zh: bodyOf(markers),
				tone,
				source: "template"
			};
		}
		function bodyOf(markers) {
			const wait = markers.filter((row) => row.grade === "too_early").map((row) => row.subject.label_zh);
			const hold = markers.filter((row) => row.grade === "not_judgeable" || row.grade === "not_comparable");
			const parts = [];
			if (wait.length > 0) parts.push(`${listZh(wait)}还要等到间隔够了再测，糖化血红蛋白和维生素 D 至少 90 天。`);
			if (hold.length > 0) parts.push(hold.slice(0, 3).map((row) => row.headline_zh).join(""));
			return parts.join("");
		}
		function gradeBehaviours(rows, today) {
			const done = rows.filter((row) => row.date === today && row.title_zh.trim());
			if (done.length === 0) return null;
			const names = listZh(done.map((row) => row.title_zh));
			return {
				id: "fb-behaviour",
				subject: {
					kind: "behaviour",
					key: "checkin",
					label_zh: "今天做到的"
				},
				grade: "behaviour_done",
				allowed_claims: ["affirm"],
				numbers: [],
				headline_zh: done.length === 1 ? `今天的「${done[0]?.title_zh}」完成了，先把这一步记下来。` : `今天完成了${names}，这些都算数。`,
				tone: "celebrate",
				source: "template"
			};
		}
		function gradeProjection(rows) {
			const usable = rows.filter((row) => row.label_zh && row.target_zh);
			if (usable.length === 0) return null;
			const lines = usable.map((row) => projectionSentence(row.label_zh, row.target_zh, row.years, row.from_zh));
			return {
				id: "fb-projection",
				subject: {
					kind: "goal",
					key: "projection",
					label_zh: "如果达到目标"
				},
				grade: "projection",
				allowed_claims: ["target"],
				numbers: usable.flatMap((row) => {
					const years = row.years;
					return years == null ? [] : [refOf(`goal.${row.label_zh}`, row.label_zh, years, "岁", null, "skill")];
				}),
				headline_zh: lines[0] ?? "",
				...lines.length > 1 ? { body_zh: lines.slice(1).join("") } : {},
				tone: "encourage",
				source: "template"
			};
		}
		function buildFeedback(input) {
			const markerMessages = input.markers.map((marker) => gradeMarker(marker, input.today));
			const summary = markerMessages.length > 0 ? progressStory(markerMessages, input.today) : null;
			const notable = markerMessages.filter((row) => row.grade === "beyond_band_better" || row.grade === "beyond_band_worse" || row.grade === "too_early");
			const bio = input.bioage ? gradeBioAge(input.bioage, input.today) : null;
			const behaviour = gradeBehaviours(input.behaviours, input.today);
			const projection = gradeProjection(input.projections);
			const out = [
				summary,
				bio,
				...notable,
				behaviour,
				projection
			].filter((row) => row != null);
			for (const message of out) {
				if (mentionsDeathRisk(message.headline_zh) || mentionsDeathRisk(message.body_zh ?? "")) {
					message.headline_zh = message.headline_zh.replace(DEATH_RISK, "模型估计");
					if (message.body_zh) message.body_zh = message.body_zh.replace(DEATH_RISK, "模型估计");
				}
				if (message.allowed_claims.includes("younger") && !youngerAllowed(message)) message.allowed_claims = message.allowed_claims.filter((claim) => claim !== "younger");
				if (!message.allowed_claims.includes("younger") && announcesYounger(message.headline_zh)) message.headline_zh = message.headline_zh.replace(/你确实年轻了/g, "变化了").replace(/比实足年龄年轻/g, "比实足年龄低");
			}
			return out;
		}
		function markerFromChange(row) {
			const glucoseFall = (row.key === "glucose" || row.key === "hba1c") && row.direction === "down" && row.verdict === "unclear";
			let verdict = row.verdict === "better" ? "working" : row.verdict === "worse" ? "wrong way" : "cannot tell";
			let blocked = null;
			if (glucoseFall) blocked = "glucose fall not called improvement";
			else if (row.verdict === "unclear") blocked = "no direction (none)";
			if (row.ask_doctor && row.verdict === "worse") verdict = "wrong way";
			return {
				key: row.key,
				label_zh: row.label_zh,
				unit: row.unit,
				from: row.compare.from,
				to: row.compare.to,
				from_date: row.compare.from_date,
				to_date: row.compare.to_date,
				delta_pct: row.compare.pct,
				band_down_pct: row.band_pct.down,
				band_up_pct: row.band_pct.up,
				band_verified: row.verified,
				better: row.verdict === "better" ? row.direction === "down" ? "lower" : "higher" : row.verdict === "worse" ? row.direction === "down" ? "higher" : "lower" : "none",
				verdict,
				blocked_by: blocked,
				ask_doctor: row.ask_doctor,
				same_lab: null,
				...row.range_flag ? { range_flag: row.range_flag } : {}
			};
		}
		function blockedFromReason(reason) {
			if (/至少要隔|太早|复测才有意义/.test(reason)) {
				const need = reason.match(/(\d+)\s*天/);
				const waited = reason.match(/开始才\s*(\d+)\s*天/);
				if (need) return `too soon (${waited?.[1] ?? "0"}d < ${need[1]}d)`;
				return "too soon";
			}
			if (/家庭血压|连续\s*\d+\s*天/.test(reason)) return "needs 7-day home mean; one office reading";
			if (/无法换算|单位是/.test(reason)) return "not comparable";
			if (/没有执行|执行率|执行记录/.test(reason)) return /超出正常波动/.test(reason) ? "adherence low; marker itself beyond band" : "adherence low; marker itself within noise";
			if (/没有基线|还没有/.test(reason)) return reason.slice(0, 80);
			return null;
		}
		/** A plan-engine verdict row (evaluate.ts) into the grader's input. `change.pct` is a fraction, not a percent. */
		function markerFromEngine(row, key) {
			let blocked = blockedFromReason(row.reason_zh ?? "");
			let verdict = normalizeVerdict(row.verdict);
			if (blocked?.includes("beyond band")) verdict = row.direction === "worse" ? "wrong way" : "working";
			const looked = knownBetter(key, row.marker);
			const pct = row.change?.pct;
			const better = row.direction === "improved" ? pct != null && pct > 0 ? "higher" : "lower" : row.direction === "worse" ? pct != null && pct > 0 ? "lower" : "higher" : looked;
			return {
				key: key || row.indicator || row.marker,
				label_zh: row.marker,
				unit: row.unit ?? "",
				from: row.baseline?.value ?? null,
				to: row.followup?.value ?? null,
				from_date: row.baseline?.date ?? null,
				to_date: row.followup?.date ?? null,
				delta_pct: row.change ? row.change.pct * 100 : null,
				band_down_pct: row.band?.down_pct ?? null,
				band_up_pct: row.band?.up_pct ?? null,
				band_verified: row.band?.verified ?? false,
				better,
				verdict,
				blocked_by: blocked,
				confounders: row.confounders,
				same_lab: null
			};
		}
		function normalizeVerdict(raw) {
			if (raw === "有效" || raw === "working") return "working";
			if (raw === "波动内" || raw === "within noise") return "within noise";
			if (raw === "反向" || raw === "wrong way") return "wrong way";
			if (raw === "无法判断" || raw === "cannot tell") return "cannot tell";
			return null;
		}
		//#endregion
		//#region src/client/terms.ts
		const BIOAGE_LABEL = "身体年龄";
		const RISK_LABEL = "10 年心血管风险";
		const BIOAGE_INFO = "身体年龄是用九项常规血检和周岁算出来的数（模型估计，不是诊断，也不是你能活多久）。论文里叫表型年龄。";
		const RISK_INFO = "10 年心血管风险：和你情况相近的人里，未来 10 年出现心梗或中风的比例（模型估计）。这个模型没有公开的个人起伏范围。年龄不在 35–74 岁时，更不确定。论文里叫 China-PAR。";
		//#endregion
		//#region src/client/ui.ts
		const h$45 = react.default.createElement;
		function Section(props) {
			const headingId = props.id ? `${props.id}-title` : void 0;
			return h$45("section", {
				className: `lp-section ${props.className ?? ""}`.trim(),
				id: props.id,
				"aria-labelledby": headingId
			}, h$45("div", { className: "lp-section-head" }, h$45("div", { className: "lp-section-titles" }, props.kicker ? h$45("div", { className: "lp-kicker" }, props.kicker) : null, h$45("h2", {
				className: "lp-h2",
				id: headingId
			}, props.title)), props.aside ?? null), props.children);
		}
		function Skeleton(props) {
			return h$45("div", {
				className: `lp-skeleton ${props.className ?? ""}`.trim(),
				style: {
					height: props.height,
					width: props.width
				},
				"aria-hidden": true
			});
		}
		/** DSH's own button; LongPi adds nothing but the variant it wants by default. */
		function Btn(props) {
			return h$45(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				size: "md",
				...props
			});
		}
		/** A download link dressed as a DSH outline button (a real <a>, so the browser saves it). */
		function LinkButton(props) {
			return h$45("a", {
				className: "lp-linkbtn",
				href: props.href,
				download: props.download ?? true
			}, props.icon ? h$45(Icon, {
				name: props.icon,
				size: 14
			}) : null, props.children);
		}
		/** A radio group drawn as a segmented control. Nothing selected means "not answered". */
		function Segmented(props) {
			const labelId = `${props.name}-label`;
			return h$45("div", { className: "lp-seg-wrap" }, h$45("span", {
				id: labelId,
				className: props.hideLabel ? "lp-sr" : "lp-field-label"
			}, props.label), h$45("div", {
				className: "lp-seg",
				role: "radiogroup",
				"aria-labelledby": labelId
			}, ...props.options.map((option) => h$45("label", {
				key: option.value,
				className: `lp-seg-opt ${props.value === option.value ? "lp-seg-on" : ""}`
			}, h$45("input", {
				type: "radio",
				name: props.name,
				value: option.value,
				checked: props.value === option.value,
				disabled: props.disabled,
				onChange: () => props.onChange(option.value)
			}), h$45("span", null, option.label)))));
		}
		function ToggleChip(props) {
			return h$45("button", {
				type: "button",
				className: `lp-toggle ${props.pressed ? "lp-toggle-on" : ""}`,
				"aria-pressed": props.pressed,
				onClick: props.onClick
			}, props.badge ? h$45("span", {
				className: "lp-toggle-badge",
				"aria-hidden": true
			}, props.badge) : null, props.children);
		}
		/** An on/off switch: a real button with role=switch, labelled by its visible text. */
		function Switch(props) {
			return h$45("button", {
				type: "button",
				role: "switch",
				id: props.id,
				"aria-checked": props.checked,
				"aria-busy": props.busy || void 0,
				disabled: props.disabled,
				className: `lp-switch ${props.checked ? "lp-switch-on" : ""}`,
				onClick: () => props.onChange(!props.checked)
			}, h$45("span", {
				className: "lp-switch-track",
				"aria-hidden": true
			}, h$45("span", { className: "lp-switch-thumb" })), h$45("span", { className: "lp-switch-label" }, props.label));
		}
		/** A short-lived status line (role=status) for saves and failures. */
		function useNotice() {
			const [notice, setNotice] = react.default.useState(null);
			react.default.useEffect(() => {
				if (!notice || notice.tone === "bad") return void 0;
				const timer = window.setTimeout(() => setNotice((current) => current?.id === notice.id ? null : current), 5e3);
				return () => window.clearTimeout(timer);
			}, [notice]);
			const show = react.default.useCallback((text, tone = "info") => setNotice({
				text,
				tone,
				id: Date.now()
			}), []);
			return [notice ? h$45("div", {
				className: `lp-notice lp-notice-${notice.tone}`,
				role: "status"
			}, h$45(Icon, {
				name: notice.tone === "good" ? "check" : notice.tone === "bad" ? "info" : "info",
				size: 14
			}), h$45("span", null, notice.text), h$45("button", {
				type: "button",
				className: "lp-notice-x",
				"aria-label": "关闭提示",
				onClick: () => setNotice(null)
			}, h$45(Icon, {
				name: "close",
				size: 12
			}))) : null, show];
		}
		/** Copy text, reporting whether the browser let us. */
		async function copyText(text) {
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch {
				return false;
			}
		}
		/**
		* ⓘ: the method, model name and source behind a plain-words headline. A
		* button that opens a small note under it; Escape or a click elsewhere closes it.
		*/
		function Info(props) {
			const [open, setOpen] = react.default.useState(false);
			const wrap = react.default.useRef(null);
			const id = react.default.useId();
			react.default.useEffect(() => {
				if (!open) return void 0;
				const onDown = (event) => {
					if (!wrap.current?.contains(event.target)) setOpen(false);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onDown);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("pointerdown", onDown);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			return h$45("span", {
				className: "lp-info-wrap",
				ref: wrap
			}, h$45("button", {
				type: "button",
				className: "lp-info-btn",
				"aria-label": `${props.label}：说明`,
				"aria-expanded": open,
				"aria-controls": id,
				onClick: () => setOpen((current) => !current)
			}, h$45(Icon, {
				name: "info",
				size: 14
			})), open ? h$45("span", {
				className: `lp-info-pop lp-info-${props.align ?? "start"}`,
				id,
				role: "note"
			}, props.children) : null);
		}
		/** A tab list (role=tablist) with arrow-key movement; the panel is the caller's, labelled by the tab. */
		function Tabs(props) {
			const refs = react.default.useRef([]);
			const move = (index) => {
				const next = props.tabs[(index + props.tabs.length) % props.tabs.length];
				if (!next) return;
				props.onChange(next.key);
				refs.current[(index + props.tabs.length) % props.tabs.length]?.focus();
			};
			return h$45("div", {
				className: "lp-tabs",
				role: "tablist",
				"aria-label": props.label
			}, ...props.tabs.map((tab, index) => h$45("button", {
				key: tab.key,
				type: "button",
				role: "tab",
				id: `${props.idPrefix}-tab-${tab.key}`,
				ref: (node) => {
					refs.current[index] = node;
				},
				className: `lp-tab ${tab.key === props.value ? "lp-tab-on" : ""}`,
				"aria-selected": tab.key === props.value,
				"aria-controls": `${props.idPrefix}-panel`,
				tabIndex: tab.key === props.value ? 0 : -1,
				onClick: () => props.onChange(tab.key),
				onKeyDown: (event) => {
					if (event.key === "ArrowRight") move(index + 1);
					if (event.key === "ArrowLeft") move(index - 1);
				}
			}, tab.label, tab.badge ? h$45("span", { className: "lp-tab-badge" }, tab.badge) : null)));
		}
		/** An error in place of content that did not load, with a retry: never an empty state. */
		function LoadError(props) {
			const [busy, setBusy] = react.default.useState(false);
			return h$45("div", {
				className: `lp-loaderror ${props.compact ? "lp-loaderror-compact" : "lp-card"}`,
				role: "alert"
			}, h$45(Icon, {
				name: "warn",
				size: 14
			}), h$45("span", { className: "lp-loaderror-text" }, `没有读到${props.what}${props.error ? `：${props.error}` : ""}。`), h$45("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy,
				onClick: () => {
					setBusy(true);
					Promise.resolve(props.onRetry()).finally(() => setBusy(false));
				}
			}, h$45(Icon, {
				name: "refresh",
				size: 13,
				className: busy ? "lp-spin" : ""
			}), busy ? "重试中" : "重试"));
		}
		/** localStorage for one small preference; blocked storage just means it is not remembered. */
		function readPref(key) {
			try {
				return window.localStorage.getItem(key);
			} catch {
				return null;
			}
		}
		function writePref(key, value) {
			try {
				window.localStorage.setItem(key, value);
			} catch {}
		}
		//#endregion
		//#region src/client/goals.ts
		const h$44 = react.default.createElement;
		function Goals(props) {
			const models = props.tracking?.models ?? [];
			if (!props.tracking?.plan || models.length === 0) return null;
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
			return h$44(Section, {
				id: "lp-goals",
				title: "如果达到目标",
				kicker: "模型估计"
			}, h$44("div", { className: "lp-grid-goals" }, pheno ? h$44("div", { className: "lp-card lp-model" }, h$44("div", { className: "lp-label" }, BIOAGE_LABEL, h$44(Info, { label: BIOAGE_LABEL }, BIOAGE_INFO)), pheno.goal ? h$44("div", { className: "lp-model-figures" }, h$44("div", null, h$44("div", { className: "lp-caption" }, "现在"), h$44("div", { className: "lp-tile-figure" }, `${fmt(pheno.now?.phenoage)} 岁`)), h$44(Icon, {
				name: "arrow",
				size: 18,
				className: "lp-muted-ink"
			}), h$44("div", null, h$44("div", { className: "lp-caption" }, "达到方案目标"), h$44("div", { className: "lp-tile-figure lp-good-ink" }, `${fmt(pheno.goal.phenoage)} 岁`)), h$44("span", { className: "lp-pill lp-pill-good" }, `${fmt(pheno.goal.phenoage_delta)} 岁`)) : h$44("p", { className: "lp-muted" }, pheno.note_zh ?? ""), leverRows.length > 0 ? h$44("div", null, h$44("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$44(LeverBars, { rows: leverRows })) : sensitivityRows.length > 0 ? h$44("div", null, h$44("div", { className: "lp-subhead" }, "对你的身体年龄影响最大的指标"), h$44(LeverBars, { rows: sensitivityRows })) : null, ...(pheno.levers ?? []).slice(0, 3).map((row) => h$44("p", {
				key: row.label,
				className: "lp-fine"
			}, projectionSentence(row.label, row.to, row.years, row.from))), pheno.goal && pheno.goal.phenoage_delta != null ? h$44("p", { className: "lp-fine" }, projectionSentence("达到方案目标时的身体年龄", `${fmt(pheno.goal.phenoage)} 岁`, pheno.goal.phenoage_delta, pheno.now?.phenoage != null ? `${fmt(pheno.now.phenoage)} 岁` : void 0)) : null, h$44("p", { className: "lp-fine" }, `${pheno.measured_on ? `按 ${pheno.measured_on} 的血检计算。` : ""}${pheno.boundary_zh ?? ""}`)) : null, risk ? h$44("div", { className: "lp-card lp-model" }, h$44("div", { className: "lp-label" }, RISK_LABEL, h$44(Info, {
				label: RISK_LABEL,
				align: "end"
			}, RISK_INFO)), risk.status === "unavailable" ? h$44("div", null, h$44("div", { className: "lp-tile-figure lp-muted-ink" }, (risk.missing ?? []).length > 0 ? "还差几项" : "暂不显示"), h$44("p", { className: "lp-muted" }, risk.note_zh ?? "")) : h$44("div", null, h$44("div", { className: "lp-model-figures" }, h$44("div", null, h$44("div", { className: "lp-caption" }, "现在"), h$44("div", { className: "lp-tile-figure" }, risk.now?.risk_pct == null ? "—" : `${risk.now.risk_pct.toFixed(1)}%`), risk.category_zh?.now ? h$44("span", { className: "lp-pill" }, risk.category_zh.now) : null), risk.goal ? h$44(Icon, {
				name: "arrow",
				size: 18,
				className: "lp-muted-ink"
			}) : null, risk.goal ? h$44("div", null, h$44("div", { className: "lp-caption" }, "达到方案目标"), h$44("div", { className: "lp-tile-figure lp-good-ink" }, risk.goal.risk_pct == null ? "—" : `${risk.goal.risk_pct.toFixed(1)}%`), risk.category_zh?.goal ? h$44("span", { className: "lp-pill lp-pill-good" }, risk.category_zh.goal) : null) : null), (risk.levers ?? []).length > 0 ? h$44("div", null, h$44("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$44(LeverBars, { rows: (risk.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "个百分点"
			})) })) : h$44("p", { className: "lp-muted" }, risk.note_zh ?? "")), h$44("p", { className: "lp-fine" }, risk.boundary_zh ?? "")) : null, h$44("div", { className: "lp-card lp-model lp-model-note" }, h$44("div", { className: "lp-label" }, "关于“能多活几年”"), h$44("p", { className: "lp-muted" }, "没有经过验证的模型能对个人给出“多活几年”。这里只给有依据的模型估计：达到目标时身体年龄大概会怎样，以及中国人群的 10 年心血管风险。"), h$44("p", { className: "lp-fine" }, "试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月。能坚持的小改变，比追逐一个数字更重要。"))));
		}
		const STEP_ICON = {
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
		function NextSteps(props) {
			const rows = props.tracking?.suggestions ?? [];
			if (rows.length === 0) return null;
			return h$44(Section, {
				id: "lp-next",
				title: "下一步",
				kicker: "按优先级"
			}, h$44("ol", { className: "lp-card lp-steps" }, ...rows.map((row, index) => h$44("li", {
				key: index,
				className: `lp-step lp-step-${row.kind}`
			}, h$44("span", { className: "lp-step-icon" }, h$44(Icon, {
				name: STEP_ICON[row.kind] ?? "info",
				size: 15
			})), h$44("span", null, row.text_zh)))), h$44("p", { className: "lp-fine" }, "这里不会建议开始、停止或调整任何药物和补剂，也不给剂量。"));
		}
		//#endregion
		//#region src/client/plan-draft.ts
		const h$43 = react.default.createElement;
		const DRAFT_PROMPT = "帮我制定一份改善方案";
		const METRIC_ZH = {
			dailySteps: "每日步数",
			dailyTotalSleepTime: "每晚睡眠"
		};
		const UNIT_ZH = {
			count: "步",
			hours: "小时"
		};
		/** Values as the server stated them (up to two decimals): what is shown is what gets saved. */
		const num = (value) => fmt(value, 2);
		function targetText(target) {
			return `手环自动记录：${METRIC_ZH[target.metric] ?? target.metric} ${target.op === ">=" ? "≥" : "≤"} ${num(target.value)} ${UNIT_ZH[target.unit] ?? target.unit}`;
		}
		function covers(items, goal) {
			return items.some((item) => item.markers.includes(goal.marker));
		}
		/**
		* A goal is the latest value plus one item's trial effect. When the person
		* drops the item it came from, the goal goes too, even if another kept item
		* covers the marker: the server would base it on that item's effect, a value
		* the person never saw, so it is not saved. Older servers do not say which
		* item a goal came from: then it goes with the last item covering its marker.
		*/
		function keptGoals(draft, kept) {
			return draft.goals.filter((goal) => goal.basis_item_id ? kept.some((item) => item.id === goal.basis_item_id) : !covers(draft.items, goal) || covers(kept, goal));
		}
		/** The evidence behind one item, opened on request: population, DOI, whether the figure was checked. */
		function EvidenceMore(props) {
			const { evidence, target } = props.item;
			if (!evidence.population && !evidence.doi && !target) return null;
			return h$43("details", { className: "lp-evidence-more" }, h$43("summary", null, "证据"), evidence.population ? h$43("p", { className: "lp-caption" }, `试验人群：${evidence.population}`) : null, evidence.doi ? h$43("p", { className: "lp-caption" }, "文献：", h$43("a", {
				href: `https://doi.org/${evidence.doi}`,
				target: "_blank",
				rel: "noreferrer"
			}, `doi:${evidence.doi}`), evidence.verified ? "" : "（数据待核对）") : null, target ? h$43("p", { className: "lp-caption" }, targetText(target)) : null, h$43("p", { className: "lp-caption" }, "这是试验里的平均效果，个人结果会不同。"));
		}
		/** One line: what the trials found on average. */
		function EvidenceLine(props) {
			return h$43("p", { className: "lp-evidence" }, h$43(Icon, {
				name: "flask",
				size: 13
			}), h$43("span", null, props.item.evidence.expected_zh || "有研究证据支持"));
		}
		function DraftItemCard(props) {
			const item = props.item;
			return h$43("li", { className: `lp-draft-item ${props.compact ? "lp-draft-item-compact" : ""}` }, h$43("div", { className: "lp-draft-item-head" }, h$43("div", { className: "lp-draft-item-title" }, item.category_zh ? h$43("span", { className: "lp-cat" }, item.category_zh) : null, h$43("span", { className: "lp-strong" }, item.title), item.needs_doctor ? h$43("span", { className: "lp-warn-tag" }, h$43(Icon, {
				name: "warn",
				size: 12
			}), "需先与医生确认") : null), h$43("button", {
				type: "button",
				className: "lp-draft-remove",
				onClick: props.onRemove,
				"aria-label": `去掉「${item.title}」`
			}, h$43(Icon, {
				name: "close",
				size: 12
			}), "去掉")), behaviorOf(item) ? h$43("p", { className: "lp-draft-detail" }, behaviorOf(item)) : null, h$43(EvidenceLine, { item }), item.cautions_zh.length > 0 ? h$43("div", { className: "lp-draft-warn" }, h$43(Icon, {
				name: "warn",
				size: 14,
				className: "lp-warn-icon"
			}), ...item.cautions_zh.map((text) => h$43("span", {
				key: text,
				className: "lp-warn-text"
			}, text))) : null, h$43(EvidenceMore, { item }));
		}
		/**
		* The kept items with 去掉, and the dropped ones as chips to put back. saved: items the server already took
		* out (the page's 去掉 is saved, so they are no longer in the draft); their chips put them back the same way.
		*/
		function DraftItems(props) {
			const kept = props.draft.items.filter((item) => !props.removed.has(item.id));
			const local = props.draft.items.filter((item) => props.removed.has(item.id)).map((item) => ({
				id: item.id,
				title: item.title
			}));
			const gone = [...local, ...(props.saved ?? []).filter((row) => !local.some((item) => item.id === row.id) && !kept.some((item) => item.id === row.id))];
			return h$43("div", { className: "lp-draft-block" }, kept.length > 0 ? h$43("ul", { className: "lp-draft-items" }, ...kept.map((item) => h$43(DraftItemCard, {
				key: item.id,
				item,
				compact: props.compact,
				onRemove: () => props.onToggle(item.id)
			}))) : h$43("p", { className: "lp-muted" }, "所有项目都去掉了。恢复一项，或在对话里说说你想怎么调整。"), gone.length > 0 ? h$43("div", { className: "lp-draft-removed" }, h$43("span", { className: "lp-caption" }, "已去掉："), ...gone.map((item) => h$43("button", {
				key: `${item.id}|${item.title}`,
				type: "button",
				className: "lp-toggle",
				disabled: props.busy,
				onClick: () => props.onToggle(item.id || item.title),
				"aria-label": `恢复「${item.title}」`
			}, h$43(Icon, {
				name: "plus",
				size: 12
			}), item.title))) : null);
		}
		/**
		* The page's 去掉 and 恢复: saved on the server (/api/longpi/plan-draft/exclude), so a removed item stays out
		* of every later draft, after a reload and in chat too. Answers with the draft as it now is.
		*/
		async function setDraftItemExcluded(item, excluded) {
			try {
				const result = await postJson("/api/longpi/plan-draft/exclude", {
					id: item.id,
					title: item.title,
					excluded
				});
				if (result.ok !== true) return {
					ok: false,
					error: String(result.error ?? "没有保存")
				};
				putPlanDraft(result);
				notifyChanged();
				return {
					ok: true,
					data: result
				};
			} catch (err) {
				return {
					ok: false,
					error: errorText(err, "没有保存")
				};
			}
		}
		function Priorities(props) {
			const rows = props.brief.priorities;
			if (rows.length === 0) return null;
			return h$43("details", {
				className: "lp-draft-more",
				open: props.open
			}, h$43("summary", null, "为什么是这几项"), h$43("ol", { className: "lp-priorities" }, ...rows.map((row, index) => h$43("li", {
				key: `${row.marker_key}-${index}`,
				className: "lp-priority"
			}, h$43("div", { className: "lp-priority-head" }, h$43("span", { className: "lp-strong" }, row.label_zh), row.value != null ? h$43("span", { className: "lp-num" }, `${num(row.value)} ${row.unit}`) : null), h$43("div", { className: "lp-caption" }, [row.why_zh, row.date ? `${chineseDate(row.date)}的记录` : ""].filter(Boolean).join(" · "))))));
		}
		function DraftGoals(props) {
			if (props.goals.length === 0 && props.dropped === 0) return null;
			return h$43("details", { className: "lp-draft-more" }, h$43("summary", null, `目标（${props.goals.length} 个，按试验平均效应估算）`), props.goals.length > 0 ? h$43("ul", { className: "lp-rows lp-draft-goals" }, ...props.goals.map((goal) => h$43("li", {
				key: goal.marker,
				className: "lp-row"
			}, h$43("span", { className: "lp-row-main" }, h$43("span", { className: "lp-strong" }, goal.marker), h$43("span", { className: "lp-caption" }, `  ${goal.basis_zh}`)), h$43("span", { className: "lp-row-end lp-num" }, `${num(goal.value)} ${goal.unit}`)))) : null, props.dropped > 0 ? h$43("p", { className: "lp-fine" }, `去掉的项目对应的 ${props.dropped} 个目标也不会保存。`) : null);
		}
		/** The follow-up the adoption dialog turns on: desktop only, no health values (9b). */
		const REMIND_BODY = {
			enabled: true,
			desktop: true,
			detail: "minimal"
		};
		/**
		* Whether to ask about the evening reminder, and at what time: not when it is
		* already on, nor where desktop notifications cannot be shown.
		*/
		function reminderOffer(data) {
			if (data && !data.platform_desktop) return null;
			if (data && data.settings.enabled && (data.settings.desktop || data.settings.webhook)) return null;
			return { time: data?.settings.checkin_time ?? "21:00" };
		}
		function ConfirmModal(props) {
			const doctor = props.items.filter((item) => item.needs_doctor);
			const offer = reminderOffer(useFollowup().data);
			const [remind, setRemind] = react.default.useState(true);
			return h$43(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "采用这份方案",
				onClose: props.busy ? () => {} : props.onCancel,
				headless: true,
				className: "lp-confirm-dialog"
			}, h$43("div", { className: "lp lp-confirm" }, h$43("h2", { className: "lp-onb-title" }, "采用这份方案？"), h$43("p", { className: "lp-muted lp-confirm-lead" }, `保存为你的方案「${props.draft.title || "改善方案"}」，从今天（${chineseDate(props.today)}）开始。之后按项目打卡，并按每个指标安排复测；想调整随时在对话里说。`), h$43("ul", { className: "lp-confirm-list" }, ...props.items.map((item) => h$43("li", { key: item.id }, item.category_zh ? h$43("span", { className: "lp-cat" }, item.category_zh) : null, h$43("span", null, item.title), item.needs_doctor ? h$43("span", { className: "lp-warn-tag" }, "需先与医生确认") : null))), props.goals.length > 0 ? h$43("p", { className: "lp-caption" }, `目标：${props.goals.map((goal) => `${goal.marker} ${num(goal.value)} ${goal.unit}`).join("、")}（按试验平均效应估算，不是个人预测）`) : null, doctor.length > 0 ? h$43("p", { className: "lp-blocker lp-blocker-bad lp-confirm-doctor" }, `${doctor.map((item) => `「${item.title}」`).join("")}需先与医生确认后再开始。方案里不含任何剂量。`) : null, offer ? h$43("label", {
				className: "lp-check lp-confirm-remind",
				htmlFor: "lp-confirm-remind"
			}, h$43("input", {
				id: "lp-confirm-remind",
				type: "checkbox",
				checked: remind,
				disabled: props.busy,
				onChange: (event) => setRemind(event.target.checked)
			}), h$43("span", null, `每晚 ${offer.time} 提醒我打卡（不含健康数值）`)) : null, props.error ? h$43("p", {
				className: "lp-form-error",
				role: "alert"
			}, props.error) : null, h$43("div", { className: "lp-modal-actions" }, h$43(Btn, {
				variant: "outline",
				onClick: props.onCancel,
				disabled: props.busy
			}, "再想想"), h$43(Btn, {
				"data-modal-autofocus": true,
				onClick: () => props.onConfirm(offer != null && remind),
				disabled: props.busy
			}, props.busy ? "保存中…" : "确认采用"))));
		}
		/**
		* Save the kept items (and the goals that still have their item), then turn
		* the reminder on when the person left the box ticked. Unticked sends nothing.
		*/
		async function acceptDraft(draft, kept, remind, source = {}) {
			const goals = keptGoals(draft, kept);
			const result = await postJson("/api/longpi/plan-draft/accept", {
				draft: {
					...draft,
					items: kept,
					goals
				},
				...source.focus?.length ? { focus: source.focus } : {},
				...source.markers?.length ? { markers: source.markers } : {}
			});
			if (!result.ok) return {
				ok: false,
				error: (result.problems ?? []).join(" ") || result.error || "请稍后再试"
			};
			let reminder = null;
			if (remind) try {
				const saved = await postJson("/api/longpi/followup", REMIND_BODY);
				if (!saved.ok) reminder = saved.error || "没有打开";
				else if (saved.settings) putFollowup(saved);
			} catch (err) {
				reminder = errorText(err, "没有打开");
			}
			notifyChanged();
			return {
				ok: true,
				version: result.plan.version,
				items: result.plan.items,
				reminder
			};
		}
		function Hint(props) {
			return h$43("span", { className: "lp-caption lp-draft-hint" }, "想调整？在对话中说", h$43("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => props.onPrompt(DRAFT_PROMPT)
			}, `“${DRAFT_PROMPT}”`));
		}
		function Draft(props) {
			const { draft, data } = props;
			const [confirming, setConfirming] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const removed = react.default.useMemo(() => /* @__PURE__ */ new Set(), []);
			const kept = draft.items;
			const goals = keptGoals(draft, kept);
			const toggle = (key) => {
				const inDraft = draft.items.find((item) => item.id === key);
				const saved = data.removed_items.find((row) => row.id === key || !row.id && row.title === key);
				const target = inDraft ? {
					id: inDraft.id,
					title: inDraft.title
				} : saved;
				if (!target) return;
				setBusy(true);
				setError(null);
				setDraftItemExcluded(target, Boolean(inDraft)).then((result) => {
					if (!result.ok) setError(`没有保存：${result.error}`);
					else props.onNotice(inDraft ? `已去掉「${target.title}」，之后的草稿也不会再加它。` : `已恢复「${target.title}」。`, "good");
				}).finally(() => setBusy(false));
			};
			async function accept(remind) {
				setBusy(true);
				setError(null);
				try {
					const result = await acceptDraft(draft, kept, remind);
					if (!result.ok) {
						setError(`没有保存：${result.error}`);
						return;
					}
					setConfirming(false);
					props.onNotice(`已保存为方案第 ${result.version} 版，共 ${result.items} 项。${result.reminder ? `打卡提醒没有打开：${result.reminder}` : remind ? "每晚会提醒你打卡。" : ""}`, result.reminder ? "info" : "good");
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$43("div", { className: "lp-card lp-draft" }, h$43("div", { className: "lp-draft-head" }, h$43("div", null, h$43("div", { className: "lp-kicker" }, `方案草稿 · ${kept.length} 项 · 还没有保存`), h$43("h3", { className: "lp-h3 lp-draft-title" }, draft.title || "改善方案"), h$43("p", { className: "lp-muted" }, "按你的检查结果和试验证据起草。每项注明试验里的平均效果，个人结果会不同；你确认后才保存。")), h$43("span", { className: "lp-tag" }, "草稿")), h$43(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				saved: data.removed_items,
				busy
			}), error && !confirming ? h$43("p", {
				className: "lp-fine",
				role: "alert"
			}, error) : null, h$43(DraftGoals, {
				goals,
				dropped: draft.goals.length - goals.length
			}), h$43(Priorities, { brief: data.brief }), ...draft.notes_zh.map((text) => h$43("p", {
				key: text,
				className: "lp-fine"
			}, text)), h$43("div", { className: "lp-form-actions lp-draft-actions" }, h$43(Btn, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$43(Hint, { onPrompt: props.onPrompt })), h$43("p", { className: "lp-fine" }, data.brief.boundary_zh || "只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。"), confirming ? h$43(ConfirmModal, {
				draft,
				items: kept,
				goals,
				today: props.journey.today,
				busy,
				error,
				onCancel: () => setConfirming(false),
				onConfirm: (remind) => {
					accept(remind);
				}
			}) : null);
		}
		/** Items taken out on the page when no draft is left: each can be put back. */
		function RestoreRow(props) {
			const [busy, setBusy] = react.default.useState(false);
			return h$43("div", { className: "lp-draft-removed" }, h$43("span", { className: "lp-caption" }, "已去掉："), ...props.items.map((item) => h$43("button", {
				key: `${item.id}|${item.title}`,
				type: "button",
				className: "lp-toggle",
				disabled: busy,
				"aria-label": `恢复「${item.title}」`,
				onClick: () => {
					setBusy(true);
					setDraftItemExcluded(item, false).then((result) => {
						props.onNotice(result.ok ? `已恢复「${item.title}」。` : `没有恢复：${result.error}`, result.ok ? "good" : "info");
					}).finally(() => setBusy(false));
				}
			}, h$43(Icon, {
				name: "plus",
				size: 12
			}), item.title)));
		}
		/** The plan section's empty state: the draft, or why there is none yet. */
		function PlanDraftCard(props) {
			const { data, loading, error } = usePlanDraft();
			if (!data && loading) return h$43("div", {
				className: "lp-card lp-draft",
				"aria-busy": true
			}, h$43("div", { className: "lp-kicker" }, "方案草稿"), h$43("p", { className: "lp-caption" }, "正在按你的结果和研究证据起草…"), h$43(Skeleton, { height: 72 }), h$43("div", { style: { height: 10 } }), h$43(Skeleton, { height: 72 }));
			if (!data) return h$43("div", { className: "lp-card lp-draft" }, h$43("div", { className: "lp-kicker" }, "方案草稿"), h$43("p", { className: "lp-muted" }, `没能读到方案草稿：${error ?? "没有返回"}。`), h$43("div", { className: "lp-form-actions" }, h$43(Hint, { onPrompt: props.onPrompt })));
			if (!data.draft) {
				const stop = data.brief.safety.stop_zh ?? "";
				const reasons = stop ? [stop, ...data.brief.notes_zh.filter((text) => text !== stop)] : data.brief.notes_zh;
				const fine = stop ? [data.brief.boundary_zh].filter(Boolean) : [...new Set([
					...reasons.slice(1),
					...data.brief.safety.notes_zh,
					data.brief.boundary_zh
				].filter(Boolean))];
				return h$43("div", { className: "lp-card lp-draft" }, h$43("div", { className: "lp-kicker" }, "方案草稿"), h$43("h3", { className: "lp-h3 lp-draft-title" }, stop ? "请先去看医生，再做方案" : "现在还起草不了方案"), h$43("p", { className: "lp-muted" }, reasons[0] || "你的记录里还没有能对上研究证据的指标。"), ...fine.map((text) => h$43("p", {
					key: text,
					className: "lp-fine"
				}, text)), stop ? null : h$43(Priorities, {
					brief: data.brief,
					open: true
				}), !stop && data.removed_items.length > 0 ? h$43(RestoreRow, {
					items: data.removed_items,
					onNotice: props.onNotice
				}) : null, stop ? null : h$43("div", { className: "lp-form-actions lp-draft-actions" }, h$43(Hint, { onPrompt: props.onPrompt })));
			}
			return h$43(Draft, {
				data,
				draft: data.draft,
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			});
		}
		//#endregion
		//#region src/client/plan.ts
		const h$42 = react.default.createElement;
		/** Today's items with their three answers; also the 概览 tab's today card. */
		function TodayList(props) {
			const items = props.journey.plan.checkin_items;
			if (items.length === 0) return h$42("p", { className: "lp-muted" }, "今天没有需要亲手记的项目。手环和已经记下的服药会自动算进去。");
			return h$42("ul", { className: "lp-today-list" }, ...items.map((row) => {
				const state = props.stateOf(row.id);
				return h$42("li", {
					key: row.id,
					className: `lp-today-row ${state === true ? "lp-today-done" : state === false ? "lp-today-missed" : ""}`
				}, h$42("span", { className: "lp-today-title" }, row.title), h$42(CheckChoices, {
					title: row.title,
					state,
					busy: props.busy === row.id,
					onAnswer: (next) => props.onAnswer(row.id, row.title, next)
				}));
			}));
		}
		function TodayTile(props) {
			const counts = todayCounts(props.journey);
			return h$42("div", { className: "lp-card lp-tile lp-tile-today" }, h$42("div", { className: "lp-tile-head" }, h$42("div", { className: "lp-label" }, "今天"), counts.total > 0 ? h$42("span", { className: "lp-caption" }, `${counts.done}/${counts.total} 完成`) : null), h$42(TodayList, props), h$42("p", { className: "lp-fine" }, "点错了可以撤销；没做到也记一下，执行率才真实。"));
		}
		function AdherenceTile(props) {
			const items = props.tracking?.items ?? [];
			const known = items.filter((item) => item.adherence && item.adherence.level !== "unknown" && item.adherence.rate != null);
			const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null;
			const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback;
			const streak = props.journey.plan.streak || Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0));
			return h$42("div", { className: "lp-card lp-tile" }, h$42("div", { className: "lp-label" }, "方案执行"), h$42("div", { className: "lp-tile-row" }, h$42(Ring, {
				value: rate,
				label: "方案平均执行率",
				size: 56
			}), h$42("div", null, h$42("div", { className: "lp-tile-figure" }, rate == null ? "—" : `${Math.round(rate * 100)}%`), h$42("div", { className: "lp-caption" }, rate == null ? "还没有执行记录" : "近 12 周平均"))), streak > 1 ? h$42("div", { className: "lp-streak" }, h$42(Icon, {
				name: "flame",
				size: 15
			}), `连续 ${streak} 天`) : h$42("div", { className: "lp-caption lp-streak-empty" }, "连续完成两天以上会在这里显示"));
		}
		/** Retest dates as the reminders see them: the earliest date each verdict gives per marker. */
		function retestDates(tracking) {
			const earliest = /* @__PURE__ */ new Map();
			for (const item of tracking?.items ?? []) for (const row of item.verdicts ?? []) {
				if (!row.next_retest) continue;
				const seen = earliest.get(row.marker);
				if (!seen || row.next_retest < seen) earliest.set(row.marker, row.next_retest);
			}
			if (earliest.size === 0) {
				for (const row of tracking?.suggestions ?? []) if (row.kind === "retest" && row.date && row.marker && !earliest.has(row.marker)) earliest.set(row.marker, row.date);
			}
			return [...earliest.entries()].map(([marker, date]) => ({
				marker,
				date
			})).sort((a, b) => a.date.localeCompare(b.date));
		}
		function RetestTile(props) {
			const retests = retestDates(props.tracking);
			const upcoming = retests.filter((row) => row.date > props.today);
			const now = retests.filter((row) => row.date <= props.today);
			const first = upcoming[0];
			return h$42("div", { className: "lp-card lp-tile" }, h$42("div", { className: "lp-label" }, "下次复测"), now.length > 0 ? h$42("div", null, h$42("div", { className: "lp-tile-figure" }, "现在"), h$42("div", { className: "lp-caption" }, `可以复测${now.map((row) => row.marker).slice(0, 3).join("、")}`)) : first ? h$42("div", null, h$42("div", { className: "lp-tile-figure" }, `${daysBetween$1(props.today, first.date)} 天后`), h$42("div", { className: "lp-caption" }, `${chineseDate(first.date)}之后 · ${first.marker}`)) : h$42("div", null, h$42("div", { className: "lp-tile-figure lp-muted-ink" }, "—"), h$42("div", { className: "lp-caption" }, props.failed ? "复测日期没有读到" : "方案里的指标还没有排出复测日")), h$42("p", { className: "lp-fine" }, h$42(Icon, {
				name: "calendar",
				size: 13
			}), " 复测太早，变化多半只是波动。"));
		}
		/**
		* Markers that moved toward the goal beyond normal fluctuation. The words never
		* credit an item with the change: several items may run at once, and a change
		* in step with a plan is not proof the plan caused it.
		*/
		function Wins(props) {
			const items = props.tracking?.items ?? [];
			if (!props.tracking?.plan) return null;
			const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === "有效").map((row) => ({
				item,
				row
			})));
			if (wins.length === 0) return h$42("div", { className: "lp-card lp-wins lp-wins-empty" }, h$42("span", { className: "lp-win-icon lp-win-icon-quiet" }, h$42(Icon, {
				name: "spark",
				size: 16
			})), h$42("div", null, h$42("div", { className: "lp-strong" }, "还没有超出正常波动的变化"), h$42("div", { className: "lp-muted" }, "血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。")));
			return h$42("div", { className: "lp-card lp-wins" }, h$42("div", { className: "lp-label" }, "朝目标方向、超出正常波动的变化"), ...wins.map(({ item, row }, index) => h$42("div", {
				className: "lp-win",
				key: index,
				style: { animationDelay: `${index * 80}ms` }
			}, h$42("span", { className: "lp-win-icon" }, h$42(Icon, {
				name: "check",
				size: 16
			})), h$42("div", null, h$42("div", { className: "lp-strong" }, `${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ""}`), h$42("div", { className: "lp-muted" }, [
				`执行「${item.title}」期间`,
				row.change ? pct(row.change.pct) : "",
				"超出个体正常波动"
			].filter(Boolean).join(" · "), (row.combined_with ?? []).length > 0 ? `；同期还在执行${(row.combined_with ?? []).map((name) => `「${name}」`).join("")}，无法区分各自的作用` : "")))));
		}
		/** Check-in items not running today (not started, or ended) get no button, as the server leaves them out of today's list. */
		function checkinFoot(item, today) {
			if (item.start > today) return `${chineseDate(item.start)}开始，到时再打卡`;
			if (item.end && item.end < today) return "已结束，不用再打卡";
			return null;
		}
		function ItemCard(props) {
			const item = props.item;
			const adherence = item.adherence ?? {};
			const source = props.raw?.mirobody ? "mirobody" : props.raw?.target ? "wearable" : "checkin";
			const idle = source === "checkin" ? checkinFoot(item, props.today) : null;
			const rate = adherence.rate;
			return h$42("article", { className: "lp-card lp-item" }, h$42("div", { className: "lp-item-head" }, h$42("div", null, item.category_zh ? h$42("span", { className: "lp-cat" }, item.category_zh) : null, h$42("h3", { className: "lp-h3" }, item.title), h$42("div", { className: "lp-caption" }, `${item.start} 起 · 第 ${item.days ?? 0} 天`)), item.headline ? h$42(VerdictChip, { verdict: item.headline }) : null), h$42("div", { className: "lp-item-adherence" }, h$42("div", null, h$42("div", { className: "lp-caption" }, "近 12 周执行"), h$42("div", { className: "lp-item-figure" }, rate == null || adherence.level === "unknown" ? "记录不足" : `${Math.round(rate * 100)}%`), adherence.note_zh ? h$42("div", { className: "lp-fine lp-fine-tight" }, adherence.note_zh) : null), (adherence.calendar ?? []).length > 0 ? h$42(AdherenceStrip, {
				calendar: adherence.calendar ?? [],
				label: item.title
			}) : null), ...(item.verdicts ?? []).map((row, index) => h$42("div", {
				className: "lp-verdict",
				key: index
			}, h$42("div", { className: "lp-verdict-head" }, h$42(VerdictChip, { verdict: row.verdict }), h$42("span", { className: "lp-strong" }, row.marker), row.baseline && row.followup ? h$42("span", { className: "lp-num" }, `${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ""}${row.change ? `（${pct(row.change.pct)}）` : ""}`) : null), h$42("p", { className: "lp-reason" }, row.reason_zh ?? ""), (row.expected ?? []).length > 0 ? h$42("details", { className: "lp-expected" }, h$42("summary", null, "试验里平均能改变多少"), ...(row.expected ?? []).map((line) => h$42("p", {
				key: line.id,
				className: "lp-fine"
			}, line.text_zh, line.comparison && line.comparison !== "not_comparable" ? `你的变化${{
				consistent: "与试验平均一致",
				smaller: "小于试验平均",
				larger: "大于试验平均",
				opposite: "方向与试验相反"
			}[line.comparison] ?? ""}。` : "", ` doi:${line.doi}`))) : null)), h$42("div", { className: "lp-item-foot" }, idle ? h$42("span", { className: "lp-caption" }, idle) : source === "checkin" ? props.checkable ? h$42(react.default.Fragment, null, h$42("span", { className: "lp-caption" }, "今天"), h$42(CheckChoices, {
				title: item.title,
				state: props.state,
				busy: props.busy,
				onAnswer: (next) => props.onAnswer(item.id, item.title, next)
			})) : h$42("span", { className: "lp-caption" }, "今天不用打卡") : h$42("span", { className: "lp-caption" }, source === "wearable" ? "手环自动记录，不用亲手记" : "服用情况在原来的用药记录里")));
		}
		/** Stage plan, next to the draft: the person may bring their own plan instead. */
		function PlanStart(props) {
			return h$42("div", { className: "lp-card lp-plan-start" }, h$42("div", { className: "lp-plan-start-text" }, h$42("h3", { className: "lp-h3" }, "已经有自己的方案？"), h$42("p", { className: "lp-muted" }, "说出你的方案，或上传医生、长寿师给的方案。LongPi 会读给你确认后保存，再按每个指标安排复测日，并算出达到目标时的模型估计。"), h$42("p", { className: "lp-fine" }, "LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。")), h$42("div", { className: "lp-prompts" }, ...props.journey.suggestions.map((row) => h$42("button", {
				key: row.id,
				type: "button",
				className: "lp-prompt",
				onClick: () => props.onPrompt(row.text_zh)
			}, h$42("span", null, row.text_zh), h$42(Icon, {
				name: "arrow",
				size: 14
			})))));
		}
		function PlanSection(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const tracking = props.tracking;
			const today = props.journey.today;
			if (!props.journey.plan.exists && !tracking?.plan) return h$42(Section, {
				id: "lp-plan",
				title: "我的方案",
				kicker: "草稿"
			}, h$42(PlanDraftCard, {
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			}), h$42(PlanStart, {
				journey: props.journey,
				onPrompt: props.onPrompt
			}));
			if (props.loading && !tracking) return h$42(Section, {
				id: "lp-plan",
				title: props.journey.plan.title || "我的方案",
				kicker: "我的方案"
			}, h$42(Skeleton, { height: 260 }));
			const failed = !tracking && props.error != null;
			const plan = tracking?.plan;
			const items = tracking?.items ?? [];
			const checkups = [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))];
			const todayIds = new Set(props.journey.plan.checkin_items.map((row) => row.id));
			const days = props.journey.plan.days;
			return h$42(Section, {
				id: "lp-plan",
				title: plan?.title || props.journey.plan.title,
				kicker: `我的方案 · 第 ${plan?.version ?? props.journey.plan.version ?? 1} 版`,
				aside: h$42("span", { className: "lp-caption" }, [
					`${items.length || props.journey.plan.items} 项`,
					props.journey.plan.started ? `${chineseDate(props.journey.plan.started)}起` : "",
					days != null ? `第 ${days} 天` : ""
				].filter(Boolean).join(" · "))
			}, failed ? h$42(LoadError, {
				what: "方案的执行记录和评判",
				error: props.error,
				onRetry: () => reload("tracking")
			}) : null, h$42("div", { className: "lp-tiles" }, h$42(TodayTile, {
				journey: props.journey,
				stateOf,
				busy,
				onAnswer: answer
			}), h$42(AdherenceTile, {
				journey: props.journey,
				tracking
			}), h$42(RetestTile, {
				tracking,
				today,
				failed
			})), h$42(Wins, { tracking }), items.length > 0 ? h$42("div", { className: "lp-card lp-timeline-card" }, h$42("div", { className: "lp-label" }, "时间线"), h$42(Timeline$1, {
				items: items.map((item) => ({
					id: item.id,
					title: item.title,
					start: item.start,
					end: item.end ?? null,
					subtitle: `${item.start} 起，第 ${item.days ?? 0} 天`,
					headline: item.headline ?? ""
				})),
				checkups,
				today
			})) : null, items.length > 0 ? h$42("div", { className: "lp-grid-items" }, ...items.map((item) => h$42(ItemCard, {
				key: item.id,
				item,
				raw: plan?.items.find((raw) => raw.id === item.id),
				today,
				onAnswer: answer,
				busy: busy === item.id,
				state: stateOf(item.id),
				checkable: todayIds.has(item.id)
			}))) : null);
		}
		/** The whole 方案 tab. */
		function PlanTab(props) {
			return h$42("div", { className: "lp-tab-body" }, h$42(PlanSection, props), h$42(Markers, { tracking: props.tracking }), h$42(Goals, { tracking: props.tracking }), h$42(NextSteps, { tracking: props.tracking }));
		}
		function Markers(props) {
			const charts = props.tracking?.charts ?? [];
			if (charts.length === 0) return null;
			const verdictOf = (indicator) => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? []).find((row) => row.indicator === indicator && row.verdict !== "无法判断");
			return h$42(Section, {
				id: "lp-markers",
				title: "方案相关的指标",
				kicker: "和正常波动比",
				aside: h$42(Info, {
					label: "和正常波动比",
					align: "end"
				}, "浅色带是以基线为中心的平常起伏。落在带外才值得注意；带里的起伏多半不算数。")
			}, h$42("div", { className: "lp-grid-charts" }, ...charts.map((chart) => {
				const verdict = verdictOf(chart.indicator);
				const digits = Math.max(...chart.points.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
				return h$42("figure", {
					className: "lp-card lp-figure",
					key: chart.indicator
				}, h$42("div", { className: "lp-figure-head" }, h$42("figcaption", null, h$42("span", { className: "lp-strong" }, chart.label), h$42("span", { className: "lp-caption" }, ` ${chart.unit}`)), verdict ? h$42(VerdictChip, { verdict: verdict.verdict }) : null), h$42(LineChart, {
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
				}), h$42("p", { className: "lp-fine" }, chart.band ? `浅色带：以 ${chart.band.base_date} 的 ${fmt(chart.band.base, 2)} 为基线的正常波动${chart.band.verified === false ? "（变异数据待核对）" : ""}。` : "缺少这项的个体变异数据，分不清真实变化和波动。"), h$42(TableTwin, {
					caption: `${chart.label}（${chart.unit}）`,
					head: ["日期", "数值"],
					rows: chart.points.map((point) => [point.date, fmt(point.value, digits)])
				}));
			})));
		}
		//#endregion
		//#region src/client/home-actions.ts
		const h$41 = react.default.createElement;
		function insertInto(props, text) {
			const actions = props.inputActions;
			try {
				if (actions?.captureInsertion && actions.insertText) return actions.insertText(text, actions.captureInsertion()) === true;
				if (actions?.setDraft) {
					const draft = (props.input?.draft ?? "").replace(/\s+$/, "");
					actions.setDraft(draft ? `${draft} ${text}` : text);
					return true;
				}
			} catch {
				return false;
			}
			return false;
		}
		/**
		* Registered in conversation.input.dock; renders nothing. A queued prompt is
		* inserted as soon as the bridge sees it: at once for a pill on the home, and
		* when the chat shows for a prompt chosen on the page.
		*/
		function PromptBridge(props) {
			useBridgeMounted();
			const pending = usePendingVersion();
			const latest = react.default.useRef(props);
			latest.current = props;
			react.default.useEffect(() => {
				if (!hasPendingPrompt()) return void 0;
				const timer = window.setTimeout(() => {
					const text = takePendingPrompt();
					if (!text) return;
					if (insertInto(latest.current, text)) {
						setPromptNote(null);
						return;
					}
					copyText(text).then((copied) => setPromptNote(copied ? "没能放进输入框，已复制，粘贴即可" : "没能放进输入框，请手动输入"));
				}, 0);
				return () => window.clearTimeout(timer);
			}, [pending]);
			return null;
		}
		function Sep$1() {
			return h$41("span", {
				className: "lp-row-sep",
				"aria-hidden": true
			}, "·");
		}
		function retestText(date, what, today) {
			return date <= today ? `可以${what}了` : `${chineseDate(date)}可${what}`;
		}
		/** The retest part of the row, with the separators around it (the page link always follows). */
		function RetestPart(props) {
			if (!props.text) return props.before ? h$41(Sep$1) : null;
			return h$41(react.default.Fragment, null, props.before ? h$41(Sep$1) : null, h$41("span", null, props.text), h$41(Sep$1));
		}
		/** Retest dates beyond the journey's 7-day reminder window live only in tracking; read it just for this line. */
		function LaterRetest(props) {
			const next = retestDates(useTracking().data)[0];
			return h$41(RetestPart, {
				text: next ? retestText(next.date, `复测${next.marker}`, props.today) : null,
				before: props.before
			});
		}
		function Note(props) {
			return props.text ? h$41("span", {
				className: "lp-row-note",
				role: "status"
			}, props.text) : null;
		}
		/**
		* A check-in pill's three answers in a small popover under it: 完成, 没做到,
		* and 撤销 once there is an answer. Escape or a click elsewhere closes it.
		*/
		function CheckPill(props) {
			const [open, setOpen] = react.default.useState(false);
			const wrap = react.default.useRef(null);
			const menuId = `lp-pill-menu-${props.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
			react.default.useEffect(() => {
				if (!open) return void 0;
				const onDown = (event) => {
					if (!wrap.current?.contains(event.target)) setOpen(false);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onDown);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("pointerdown", onDown);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			const choose = (state) => {
				setOpen(false);
				props.onAnswer(state);
			};
			const { state } = props;
			const label = state === true ? "今天已完成" : state === false ? "今天没做到" : "今天还没记录";
			return h$41("span", {
				className: "lp-task-wrap",
				ref: wrap
			}, h$41("button", {
				type: "button",
				className: `lp-task ${state === true ? "lp-task-done" : state === false ? "lp-task-missed" : ""}`,
				"aria-haspopup": "menu",
				"aria-expanded": open,
				"aria-controls": menuId,
				disabled: props.busy,
				title: `${label}，点一下记录`,
				"aria-label": `${props.title}：${label}`,
				onClick: () => setOpen((current) => !current)
			}, h$41("span", {
				className: "lp-task-ring",
				"aria-hidden": true
			}, state === true ? h$41(Icon, {
				name: "check",
				size: 10,
				strokeWidth: 2.4
			}) : state === false ? h$41(Icon, {
				name: "close",
				size: 9,
				strokeWidth: 2.4
			}) : null), props.title), open ? h$41("span", {
				className: "lp-task-menu",
				id: menuId,
				role: "menu",
				"aria-label": `${props.title}：今天`
			}, h$41("button", {
				type: "button",
				role: "menuitem",
				className: "lp-task-choice",
				disabled: state === true,
				onClick: () => choose(true)
			}, h$41(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), "完成"), h$41("button", {
				type: "button",
				role: "menuitem",
				className: "lp-task-choice",
				disabled: state === false,
				onClick: () => choose(false)
			}, "没做到"), state !== null ? h$41("button", {
				type: "button",
				role: "menuitem",
				className: "lp-task-choice lp-task-undo",
				onClick: () => choose(null)
			}, "撤销") : null) : null);
		}
		function RoutineRow(props) {
			const { journey } = props;
			const { stateOf, busy, error, answer } = useCheckIns(journey);
			const items = journey.plan.checkin_items;
			const reminder = journey.reminders.filter((row) => row.kind === "retest" && row.date).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0];
			const lead = items.map((row) => h$41(CheckPill, {
				key: row.id,
				id: row.id,
				title: row.title,
				state: stateOf(row.id),
				busy: busy === row.id,
				onAnswer: (state) => answer(row.id, row.title, state)
			}));
			if (items.length === 0 && journey.next.detail_zh) lead.push(h$41("span", { key: "next" }, journey.next.detail_zh));
			return h$41("div", {
				className: "lp lp-home-row",
				role: "group",
				"aria-label": "LongPi 今天"
			}, ...lead, reminder?.date ? h$41(RetestPart, {
				text: retestText(reminder.date, reminder.text_zh, journey.today),
				before: lead.length > 0
			}) : h$41(LaterRetest, {
				today: journey.today,
				before: lead.length > 0
			}), h$41("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.openPage
			}, "健康页 →"), h$41(Note, { text: error ?? props.note }));
		}
		/** The row itself; null when the stage has nothing for it (then the host stays empty and takes no room). */
		function HomeRow(props) {
			const { journey } = props;
			const ready = useComposerReady();
			const bridgeNote = usePromptNote();
			usePendingVersion();
			const note = bridgeNote ?? (!ready && hasPendingPrompt() ? "先在输入框上方选择一个工作区，选好后会自动放进输入框" : null);
			if (journey.stage === "routine") return h$41(RoutineRow, {
				journey,
				openPage: props.openPage,
				note
			});
			const suggestions = journey.suggestions.slice(0, 2);
			if (suggestions.length === 0) return null;
			return h$41("div", {
				className: "lp lp-home-row",
				role: "group",
				"aria-label": "LongPi 建议的问题"
			}, ...suggestions.map((row) => h$41("button", {
				key: row.id,
				type: "button",
				className: "lp-suggest",
				title: "放进输入框",
				onClick: () => setPendingPrompt(row.text_zh, "hero")
			}, row.text_zh)), h$41(Note, { text: note }));
		}
		//#endregion
		//#region src/client/home.ts
		const h$40 = react.default.createElement;
		/**
		* The approved home line (spec D.1) carries no visible 模型估计 tag; the figures
		* say it on hover, and the page and onboarding label them in full.
		*/
		const ESTIMATE = "模型估计：由你的记录计算，不是诊断";
		/**
		* The seat sits inside the hero's headline, a wrapping flex row meant for a
		* 34 px logo and the title. Make the row item that holds the greeting span the
		* whole row, so a long status sentence wraps inside the column instead of
		* overflowing it; put the host's styles back when the greeting goes away.
		* Found by computed style, not class names, so a markup change degrades to a
		* greeting above DSH's title rather than a broken row.
		*/
		function useOwnRow(ref) {
			react.default.useLayoutEffect(() => {
				const node = ref.current;
				if (!node) return void 0;
				let item = node;
				let row = node.parentElement;
				let found = false;
				for (let depth = 0; row && depth < 4; depth += 1) {
					const style = window.getComputedStyle(row);
					if (style.display.includes("flex") && style.flexWrap === "wrap" && !style.flexDirection.startsWith("column")) {
						found = true;
						break;
					}
					item = row;
					row = row.parentElement;
				}
				if (!found) return void 0;
				const saved = item.getAttribute("style");
				item.style.flex = "0 0 100%";
				item.style.maxWidth = "100%";
				item.style.minWidth = "0";
				if (item !== node) {
					item.style.display = "flex";
					item.style.justifyContent = "center";
				}
				return () => {
					if (saved == null) item.removeAttribute("style");
					else item.setAttribute("style", saved);
				};
			}, [ref]);
		}
		/** DSH's composer wrapper on the home (display: contents; the composer card is its child). */
		const BAR = "[data-slot=\"conversation.composer.bar\"]";
		/** How long DSH gets to mount the composer beside the hero before the row falls back into the hero. */
		const ANCHOR_WAIT_MS = 1e3;
		/** The approved mockups put the row 12 px under the composer card. */
		const ROW_GAP_PX = 12;
		/** Changes named on the home before the rest are counted. */
		const CHANGES_NAMED = 2;
		/**
		* The host for the row: a div inserted right after the composer wrapper, in
		* the wrapper's own parent (the hero's composer stack), found by walking up
		* from the greeting. It is kept the parent's last child when React adds a
		* sibling after it, and removed when the greeting goes. When no composer shows
		* up within about a second, inline is set and the row renders in the greeting.
		*/
		function useRowHost(ref) {
			const [state, setState] = react.default.useState({
				host: null,
				inline: false
			});
			react.default.useLayoutEffect(() => {
				const node = ref.current;
				if (!node) return void 0;
				let host = null;
				let observer = null;
				let poll = 0;
				const attach = () => {
					let bar = null;
					for (let up = node.parentElement; up && !bar; up = up.parentElement) bar = up.querySelector(BAR);
					const parent = bar?.parentElement;
					if (!bar || !parent) return false;
					const made = document.createElement("div");
					made.className = "lp lp-home-host";
					made.setAttribute("data-longpi", "home-row");
					const style = window.getComputedStyle(parent);
					const gap = /flex|grid/.test(style.display) ? Number.parseFloat(style.rowGap) || 0 : 0;
					made.style.marginTop = `${Math.max(0, ROW_GAP_PX - gap)}px`;
					bar.after(made);
					host = made;
					observer = new MutationObserver(() => {
						if (parent.lastElementChild !== made) parent.appendChild(made);
					});
					observer.observe(parent, { childList: true });
					setState({
						host: made,
						inline: false
					});
					return true;
				};
				if (!attach()) {
					const started = Date.now();
					poll = window.setInterval(() => {
						if (attach()) window.clearInterval(poll);
						else if (Date.now() - started >= ANCHOR_WAIT_MS) {
							window.clearInterval(poll);
							setState({
								host: null,
								inline: true
							});
						}
					}, 100);
				}
				return () => {
					window.clearInterval(poll);
					observer?.disconnect();
					host?.remove();
				};
			}, [ref]);
			return state;
		}
		function Sep() {
			return h$40("span", {
				className: "lp-hero-sep",
				"aria-hidden": true
			}, "·");
		}
		function Go(props) {
			return h$40("button", {
				type: "button",
				className: "lp-hero-link",
				onClick: props.onClick
			}, `${props.label} →`);
		}
		/** Body age and cardiovascular risk in the order the person cares about; a figure that is not available is left out. */
		function figures(journey) {
			const { bioage, risk } = journey.results;
			const body = bioage.status === "ok" && bioage.phenoage != null ? [
				"身体年龄 ",
				h$40("b", {
					key: "b",
					title: ESTIMATE
				}, `${fmt(bioage.phenoage)} 岁`),
				bioage.headline_zh ? `。${bioage.headline_zh}` : bioage.allows_younger ? `，${versusAge(bioage.advance, bioage.checkups)}` : ""
			] : null;
			const heart = risk.status === "ok" && risk.risk_pct != null ? [
				"心血管 10 年风险 ",
				h$40("b", {
					key: "b",
					title: ESTIMATE
				}, `${riskText(risk.risk_pct)}%`),
				risk.category_zh ? `（${risk.category_zh}）` : ""
			] : null;
			const focus = journey.profile.focus;
			const riskAt = focus.findIndex((key) => key === "cardio" || key === "weight");
			const bioAt = focus.indexOf("bioage");
			return (riskAt >= 0 && (bioAt < 0 || riskAt < bioAt) ? [heart, body] : [body, heart]).filter((row) => row != null);
		}
		function titleOf(journey) {
			if (journey.stage === "consent" || journey.stage === "profile") return "你好，我是 LongPi";
			const name = journey.profile.displayName.trim();
			return `${(journey.surfaces?.greeting.source === "model" ? journey.surfaces.greeting.text_zh.replace(/[，,。！!]+$/, "") : "") || greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`;
		}
		/** One sentence per stage (spec D.1). Every figure comes from the journey; nothing is estimated here. */
		function Status(props) {
			const { journey, open } = props;
			const parts = [];
			const status = journey.surfaces?.status;
			if (status && status.fact_ids.length > 0 && status.text_zh && journey.stage !== "consent") {
				parts.push(h$40("span", {
					key: "t",
					className: status.tone === "care" ? "lp-hero-care" : void 0
				}, status.text_zh), h$40(Sep, { key: "s" }), h$40(Go, {
					key: "go",
					label: journey.next.action === "doctor" ? "看怎么准备" : "健康页",
					onClick: open
				}));
				return h$40("p", { className: "lp-hero-status" }, ...parts);
			}
			if (journey.stage === "consent" || journey.stage === "profile") parts.push("花 2 分钟建档，算出你的身体年龄和心血管风险", h$40(Sep, { key: "s" }), h$40(Go, {
				key: "go",
				label: "开始建档",
				onClick: open
			}));
			else if (journey.stage === "records") parts.push(journey.records.status === "error" ? "体检记录读取失败，暂时算不出结果" : "连接体检记录后，就能算出你的身体年龄", h$40(Sep, { key: "s" }), h$40(Go, {
				key: "go",
				label: journey.records.status === "error" ? "查看原因" : "怎么连接",
				onClick: open
			}));
			else if (journey.stage === "first_result" && journey.addons.length > 0) parts.push(journey.next.title_zh || "量一次腰围", h$40(Sep, { key: "s" }), h$40(Go, {
				key: "go",
				label: "去做",
				onClick: open
			}));
			else {
				const rows = journey.stage === "first_result" ? [] : figures(journey);
				if (rows.length > 0) rows.forEach((row, index) => {
					if (index > 0) parts.push(h$40(Sep, { key: `s${index}` }));
					parts.push(h$40(react.default.Fragment, { key: `f${index}` }, ...row));
				});
				else {
					const detail = journey.next.detail_zh || journey.results.risk.blocker_zh || journey.results.bioage.blocker_zh || "打开健康页看看还缺什么";
					if (journey.stage === "routine") parts.push(detail);
					else parts.push(detail, h$40(Sep, { key: "s" }), h$40(Go, {
						key: "go",
						label: journey.next.action === "profile" ? "去填写" : "健康页",
						onClick: open
					}));
				}
			}
			return h$40("p", { className: "lp-hero-status" }, ...parts);
		}
		/**
		* Changes beyond normal fluctuation that a doctor should see (spec A.2): the
		* first two by name, the rest counted. Good news waits on the page.
		*/
		function ChangesLine$1(props) {
			const rows = props.journey.changes.filter((row) => row.ask_doctor);
			if (rows.length === 0) return null;
			const named = rows.slice(0, CHANGES_NAMED).map((row) => row.label_zh).join("、");
			const subject = rows.length > CHANGES_NAMED ? `${named}等 ${rows.length} 项` : named;
			return h$40("p", { className: "lp-hero-changes" }, h$40(Icon, {
				name: "warn",
				size: 14,
				className: "lp-hero-changes-icon"
			}), `${subject}的变化超出正常波动`, h$40(Sep), h$40(Go, {
				label: "查看",
				onClick: () => props.openAt("lp-changes")
			}));
		}
		function Hero(props) {
			const ref = react.default.useRef(null);
			useHeroShown();
			useOwnRow(ref);
			const { host, inline } = useRowHost(ref);
			const row = h$40(HomeRow, {
				journey: props.journey,
				openPage: props.open
			});
			return h$40("div", {
				ref,
				className: "lp lp-hero",
				role: "group",
				"aria-label": "LongPi"
			}, h$40("div", { className: "lp-hero-title" }, h$40("span", {
				className: "lp-hero-mark",
				"aria-hidden": true
			}, h$40(Icon, {
				name: "pulse",
				size: 16,
				strokeWidth: 1.8
			})), h$40("span", null, titleOf(props.journey))), h$40(Status, {
				journey: props.journey,
				open: props.open
			}), h$40(ChangesLine$1, {
				journey: props.journey,
				openAt: props.openAt
			}), inline ? h$40("div", { className: "lp-hero-row" }, row) : null, host ? (0, react_dom.createPortal)(row, host) : null);
		}
		function HomeHero(props) {
			const { journey } = useJourney();
			if (!journey) return null;
			return h$40(Hero, {
				journey,
				open: () => props.openPage?.(),
				openAt: (id) => {
					requestView({
						tab: "overview",
						id
					});
					props.openPage?.();
				}
			});
		}
		//#endregion
		//#region src/client/model-status.ts
		/** The official DeepSeek route, its settings namespace and the key reference it defaults to (dsh-llm-deepseek). */
		const DEEPSEEK_ROUTE = "deepseek-official";
		const DEEPSEEK_NS = "llm-deepseek";
		const DEEPSEEK_KEY = "DEEPSEEK_API_KEY";
		let probe = null;
		let settings$1 = null;
		let status = "unknown";
		const listeners$2 = /* @__PURE__ */ new Set();
		function set(next) {
			if (next === status) return;
			status = next;
			for (const listener of listeners$2) listener();
		}
		/** The key reference the DeepSeek route reads, as its settings say; null when they cannot be read. */
		async function keyRefOf(face) {
			if (!face) return null;
			try {
				await face.ensure?.();
				const namespace = face.getSnapshot?.()?.view?.namespaces?.find((row) => row.ns === DEEPSEEK_NS);
				if (!namespace) return null;
				const ref = namespace.value && typeof namespace.value === "object" ? namespace.value.apiKeyEnv : void 0;
				return typeof ref === "string" && ref ? ref : DEEPSEEK_KEY;
			} catch {
				return null;
			}
		}
		async function readModelStatus(remote, face = null) {
			try {
				const providers = await remote.llm?.listProviders?.();
				if (!providers?.ok) return "unknown";
				const ids = providers.value.map((row) => String(row.id ?? ""));
				if (!ids.includes(DEEPSEEK_ROUTE) || ids.some((id) => id !== DEEPSEEK_ROUTE)) return "unknown";
				const ref = await keyRefOf(face);
				const name = ref ?? DEEPSEEK_KEY;
				const described = await remote.credentials?.describe?.([name]);
				if (!described?.ok) return "unknown";
				const key = described.value[name];
				if (!key) return "unknown";
				if (key.configured === true) return "ready";
				return ref ? "missing" : "unknown";
			} catch {
				return "unknown";
			}
		}
		/** Called from apply() inside ctx.inject: the probe lives as long as those services do. */
		function setModelProbe(remote) {
			probe = remote ? () => readModelStatus(remote, settings$1) : null;
			if (!remote) set("unknown");
		}
		/** The settings mirror, when DSH has one: it names the key reference the route really reads. */
		function setModelSettings(face) {
			settings$1 = face;
			recheckModel();
		}
		function recheckModel() {
			if (!probe) return;
			probe().then(set);
		}
		/** The status, checked again each time a surface that shows it mounts. */
		function useModelStatus() {
			react.default.useEffect(() => {
				recheckModel();
			}, []);
			return react.default.useSyncExternalStore((listener) => {
				listeners$2.add(listener);
				return () => {
					listeners$2.delete(listener);
				};
			}, () => status, () => status);
		}
		//#endregion
		//#region src/privacy/pending.ts
		/** True until the person has granted or declined sending health chat to DeepSeek. A missing decision is still required. */
		function deepseekConsentPending(decision) {
			return decision == null || decision === "";
		}
		//#endregion
		//#region src/client/connection.ts
		const h$39 = react.default.createElement;
		const LOOPBACK = /* @__PURE__ */ new Set([
			"127.0.0.1",
			"localhost",
			"[::1]"
		]);
		/** The same rule the server applies: https, or http only on this computer. */
		function addressProblem(text) {
			const trimmed = text.trim();
			if (!trimmed) return "请先展开给安装的人的那一栏，再粘贴连接地址。";
			let url;
			try {
				url = new URL(trimmed);
			} catch {
				return "这不是一个完整的网址，请复制以 https:// 开头的完整地址。";
			}
			if (url.protocol === "https:") return null;
			if (url.protocol === "http:" && LOOPBACK.has(url.hostname)) return null;
			return url.protocol === "http:" ? "只有这台电脑上的地址可以用 http，其他地址请用 https。" : "地址要以 https:// 开头。";
		}
		function month$1(iso) {
			return iso ? iso.slice(0, 7) : "";
		}
		/** "4 次体检 · 2025-10 → 2026-08 · 血脂、血糖等 · 手环 355 天": only what the server counted. */
		function summaryParts(summary) {
			const range = summary.first_date && summary.last_date ? summary.first_date.slice(0, 7) === summary.last_date.slice(0, 7) ? month$1(summary.last_date) : `${month$1(summary.first_date)} → ${month$1(summary.last_date)}` : "";
			const categories = summary.categories_zh.length > 3 ? `${summary.categories_zh.slice(0, 3).join("、")}等` : summary.categories_zh.join("、");
			return [
				`${summary.checkups} 次体检`,
				range,
				categories,
				summary.wearable_days > 0 ? `手环 ${summary.wearable_days} 天` : ""
			].filter(Boolean);
		}
		/** brief: without the summary line, where the found counts are already on screen (onboarding step 3). */
		function ConnectionStatus(props) {
			const { connection } = props;
			const ok = connection.status === "ok";
			const bad = connection.status === "error";
			return h$39("div", { className: "lp-conn-status" }, h$39("div", { className: "lp-status" }, h$39("span", {
				className: `lp-statusdot ${ok ? "lp-statusdot-on" : bad ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), ok ? "已连上" : bad ? `连接失败：${connection.error || "没有返回原因"}` : "还没有连上"), null, ok && connection.summary && !props.brief ? h$39("div", { className: "lp-caption" }, `找到：${summaryParts(connection.summary).join(" · ")}`) : null);
		}
		function TestOutcome(props) {
			const { result } = props;
			if (!result.ok) return h$39("p", {
				className: "lp-form-error",
				role: "alert"
			}, `连接没有成功：${result.error}`);
			const summary = result.connection?.summary;
			return h$39("p", {
				className: "lp-conn-ok",
				role: "status"
			}, h$39(Icon, {
				name: "check",
				size: 14
			}), summary ? `连接成功，找到 ${summaryParts(summary).join(" · ")}` : "连接成功");
		}
		/**
		* The form: address, optional token, 测试连接 and 保存, and 清除 for a saved
		* address. Nothing is saved unless the test inside 保存 succeeds.
		*/
		function MirobodyLogin(props) {
			const [base, setBase] = react.default.useState("http://127.0.0.1:18060");
			const [email, setEmail] = react.default.useState("");
			const [password, setPassword] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState("");
			const [done, setDone] = react.default.useState("");
			async function login() {
				const problem = addressProblem(base);
				if (problem) {
					setError(problem);
					return;
				}
				setBusy(true);
				setError("");
				setDone("");
				try {
					const result = await postJson("/api/longpi/mirobody/login", {
						base_url: base.trim(),
						email: email.trim(),
						password
					});
					setPassword("");
					setDone(`已登录并连上${typeof result.indicators === "number" ? `，读到 ${result.indicators} 项` : ""}。`);
					notifyChanged();
					await reload("connection");
					props.onSaved?.();
				} catch (err) {
					setError(errorText(err, "没有登录成功"));
				} finally {
					setBusy(false);
				}
			}
			return h$39("div", {
				className: "lp-conn-login",
				id: `${props.idPrefix}-login`
			}, h$39("p", { className: "lp-muted" }, "用邮箱和密码登录并连接。"), h$39("details", { className: "lp-more" }, h$39("summary", null, "高级（给安装的人）"), h$39("div", { className: "lp-field" }, h$39("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-base`
			}, "服务地址"), h$39("input", {
				id: `${props.idPrefix}-base`,
				className: "lp-input",
				value: base,
				autoComplete: "off",
				spellCheck: false,
				onChange: (event) => setBase(event.target.value)
			}))), h$39("div", { className: "lp-field" }, h$39("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-email`
			}, "邮箱"), h$39("input", {
				id: `${props.idPrefix}-email`,
				type: "email",
				className: "lp-input",
				value: email,
				autoComplete: "username",
				onChange: (event) => setEmail(event.target.value)
			})), h$39("div", { className: "lp-field" }, h$39("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-password`
			}, "密码"), h$39("input", {
				id: `${props.idPrefix}-password`,
				type: "password",
				className: "lp-input",
				value: password,
				autoComplete: "current-password",
				onChange: (event) => setPassword(event.target.value)
			})), error ? h$39("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, done ? h$39("p", {
				className: "lp-conn-ok",
				role: "status"
			}, done) : null, h$39("div", { className: "lp-form-actions" }, h$39(Btn, {
				type: "button",
				disabled: busy || !email.trim() || password.length < 8,
				onClick: () => {
					login();
				}
			}, busy ? "正在登录…" : "登录并连接")));
		}
		function ConnectionForm(props) {
			const [url, setUrl] = react.default.useState("");
			const [token, setToken] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(null);
			const [error, setError] = react.default.useState(null);
			const [outcome, setOutcome] = react.default.useState(null);
			const saved = props.connection?.source === "saved";
			function body() {
				const problem = addressProblem(url);
				if (problem) {
					setError(problem);
					return null;
				}
				return {
					mcp_url: url.trim(),
					...token.trim() ? { mcp_token: token.trim() } : {}
				};
			}
			async function run(kind) {
				const request = kind === "test" && !url.trim() && props.connection?.url_masked ? {} : body();
				if (!request) return;
				setBusy(kind);
				setError(null);
				setOutcome(null);
				try {
					const result = normalizeConnectionResult(await postJson(kind === "test" ? "/api/longpi/connection/test" : "/api/longpi/connection", request));
					setOutcome(result);
					if (kind === "save" && result.ok && result.connection) {
						putConnection(result.connection);
						setUrl("");
						setToken("");
						notifyChanged();
						props.onSaved?.(result.connection);
					}
				} catch (err) {
					setOutcome({
						ok: false,
						error: errorText(err, "请稍后再试"),
						connection: null
					});
				} finally {
					setBusy(null);
				}
			}
			async function clear() {
				setBusy("clear");
				setError(null);
				setOutcome(null);
				try {
					await deleteJson("/api/longpi/connection");
					notifyChanged();
					await reload("connection");
				} catch (err) {
					setError(`没有清除：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(null);
				}
			}
			return h$39("form", {
				className: "lp-conn-form",
				noValidate: true,
				onSubmit: (event) => {
					event.preventDefault();
					run("save");
				}
			}, h$39(MirobodyLogin, { idPrefix: props.idPrefix }), h$39("details", { className: "lp-more" }, h$39("summary", null, "高级（给安装的人）"), props.connection?.url_masked ? h$39("p", { className: "lp-caption" }, `当前地址 ${props.connection.url_masked}`) : null, h$39("p", { className: "lp-caption" }, "安装的人如果已经拿到连接地址，再展开填写。平时不用看。"), h$39("div", { className: "lp-field" }, h$39("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-url`
			}, "连接地址"), h$39("input", {
				id: `${props.idPrefix}-url`,
				type: "url",
				className: "lp-input",
				value: url,
				autoComplete: "off",
				spellCheck: false,
				placeholder: "https://…",
				onChange: (event) => {
					setUrl(event.target.value);
					setError(null);
				}
			})), h$39("div", { className: "lp-field" }, h$39("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-token`
			}, "访问口令", h$39("span", { className: "lp-optional" }, "地址里已经带了就留空")), h$39("input", {
				id: `${props.idPrefix}-token`,
				type: "password",
				className: "lp-input",
				value: token,
				autoComplete: "new-password",
				placeholder: "可不填",
				onChange: (event) => setToken(event.target.value)
			}))), error ? h$39("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, outcome ? h$39(TestOutcome, { result: outcome }) : null, h$39("div", { className: "lp-form-actions" }, h$39(Btn, {
				variant: "outline",
				type: "button",
				disabled: busy != null,
				onClick: () => {
					run("test");
				}
			}, busy === "test" ? "测试中…" : "测试连接"), h$39(Btn, {
				type: "submit",
				disabled: busy != null
			}, busy === "save" ? "测试并保存中…" : "保存"), saved ? h$39("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy != null,
				onClick: () => {
					clear();
				}
			}, h$39(Icon, {
				name: "trash",
				size: 13
			}), busy === "clear" ? "清除中" : "清除保存的地址") : null), h$39("p", { className: "lp-fine" }, saved ? "清除后改用安装时配置的地址（如果有）。" : "保存前会先用这个地址读一次记录目录，读到了才保存；地址和令牌只存在这台电脑上。"));
		}
		/** Status plus form. collapsed: when connected, the form waits behind 换一个地址 (onboarding step 3). */
		function ConnectionPanel(props) {
			const { data, loading, error } = useConnection();
			const [open, setOpen] = react.default.useState(false);
			if (!data && loading) return h$39(Skeleton, { height: 96 });
			if (!data) return h$39(LoadError, {
				what: "连接状态",
				error,
				onRetry: () => reload("connection")
			});
			const connected = data.status === "ok";
			const showForm = !props.collapsed || !connected || open;
			return h$39("div", { className: "lp-conn" }, h$39(ConnectionStatus, {
				connection: data,
				brief: props.collapsed
			}), showForm ? h$39(ConnectionForm, {
				connection: data,
				idPrefix: props.idPrefix,
				onSaved: (connection) => {
					setOpen(false);
					props.onSaved?.(connection);
				}
			}) : h$39("button", {
				type: "button",
				className: "lp-row-link lp-conn-change",
				onClick: () => setOpen(true)
			}, "换一个连接 →"));
		}
		//#endregion
		//#region src/client/self-measure.ts
		const h$38 = react.default.createElement;
		function specs(journey) {
			const keys = journey?.self.keys ?? [];
			return keys.length > 0 ? keys : SELF_FALLBACK.map((row) => ({ ...row }));
		}
		/** A short unit list: the canonical unit, then the spellings people use most. */
		function unitChoices(spec) {
			const offered = spec.units.length > 0 ? spec.units : [spec.unit];
			const preferred = PREFERRED_UNITS[spec.key].filter((unit) => offered.some((item) => item.toLowerCase() === unit.toLowerCase()));
			const list = [spec.unit, ...preferred];
			return [...new Set(list)];
		}
		function selfLatestText(row, all) {
			if (row.key === "sbp") {
				const dbp = all.find((item) => item.key === "dbp");
				return `${fmt(row.value)}${dbp ? `/${fmt(dbp.value)}` : ""} ${row.unit}`;
			}
			return `${fmt(row.value)} ${row.unit}`;
		}
		/** Latest values as quiet stat chips; blood pressure shows as one weekly mean. */
		function SelfLatestList(props) {
			const rows = props.latest.filter((row) => row.key !== "dbp");
			if (rows.length === 0) return null;
			return h$38("ul", { className: "lp-self-latest" }, ...rows.map((row) => h$38("li", { key: row.key }, h$38("span", { className: "lp-caption" }, row.key === "sbp" ? "家庭血压" : row.label_zh), h$38("span", { className: "lp-self-value" }, selfLatestText(row, props.latest)), h$38("span", { className: "lp-caption" }, row.key === "sbp" ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : "1 次读数"} · 截至 ${chineseDate(row.date)}` : chineseDate(row.date)))));
		}
		async function saveEntries(entries) {
			return postJson("/api/longpi/self", { entries });
		}
		function numberOf$1(text) {
			const trimmed = text.trim().replace(/，/g, ".").replace(/,/g, ".");
			if (!trimmed) return null;
			const value = Number(trimmed);
			return Number.isFinite(value) && value > 0 ? value : NaN;
		}
		function UnitSelect(props) {
			const choices = unitChoices(props.spec);
			if (choices.length < 2) return h$38("span", { className: "lp-unit" }, props.spec.unit);
			return h$38("select", {
				id: props.id,
				className: "lp-select lp-unit-select",
				value: props.value,
				"aria-label": props.label,
				onChange: (event) => props.onChange(event.target.value)
			}, ...choices.map((unit) => h$38("option", {
				key: unit,
				value: unit
			}, unit)));
		}
		function SelfMeasureForm(props) {
			const all = specs(props.journey);
			const spec = (key) => all.find((row) => row.key === key) ?? SELF_FALLBACK.find((row) => row.key === key);
			const today = props.journey?.today ?? localToday$1();
			const [values, setValues] = react.default.useState({
				waist: "",
				sbp: "",
				dbp: "",
				weight: ""
			});
			const [units, setUnits] = react.default.useState({
				waist: spec("waist").unit,
				sbp: "mmHg",
				dbp: "mmHg",
				weight: spec("weight").unit
			});
			const [date, setDate] = react.default.useState(today);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const set = (key, text) => {
				setError(null);
				setValues((current) => ({
					...current,
					[key]: text
				}));
			};
			async function submit(event) {
				event.preventDefault();
				const entries = [];
				for (const key of [
					"waist",
					"sbp",
					"dbp",
					"weight"
				]) {
					const value = numberOf$1(values[key]);
					if (value == null) continue;
					if (Number.isNaN(value)) {
						setError(`${spec(key).label_zh}请填一个数字。`);
						return;
					}
					entries.push({
						key,
						value,
						unit: units[key],
						date
					});
				}
				if (values.sbp.trim() === "" !== (values.dbp.trim() === "")) {
					setError("血压请同时填收缩压和舒张压（高压和低压）。");
					return;
				}
				if (entries.length === 0) {
					setError("先填一项再记录。");
					return;
				}
				setBusy(true);
				try {
					const result = await saveEntries(entries);
					setValues({
						waist: "",
						sbp: "",
						dbp: "",
						weight: ""
					});
					props.onNotice(result.problems.length > 0 ? `已记录 ${result.saved.length} 项；${result.problems.join(" ")}` : `已记录 ${result.saved.length} 项。`, result.problems.length > 0 ? "info" : "good");
					notifyChanged();
				} catch (err) {
					setError(errorText(err, "没有记下，请稍后再试。"));
				} finally {
					setBusy(false);
				}
			}
			const field = (key, placeholder) => h$38("div", { className: "lp-self-field" }, h$38("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-${key}`
			}, spec(key).label_zh), h$38("div", { className: "lp-input-unit" }, h$38("input", {
				id: `${props.idPrefix}-${key}`,
				className: "lp-input",
				inputMode: "decimal",
				placeholder,
				value: values[key],
				onChange: (event) => set(key, event.target.value)
			}), h$38(UnitSelect, {
				id: `${props.idPrefix}-${key}-unit`,
				spec: spec(key),
				value: units[key],
				label: `${spec(key).label_zh}的单位`,
				onChange: (unit) => setUnits((current) => ({
					...current,
					[key]: unit
				}))
			})));
			return h$38("form", {
				className: "lp-self-form",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$38("div", { className: "lp-self-grid" }, field("waist", "例如 86"), field("weight", "例如 70.5"), h$38("div", { className: "lp-self-field lp-self-bp" }, h$38("span", {
				className: "lp-field-label",
				id: `${props.idPrefix}-bp`
			}, "家庭血压"), h$38("div", {
				className: "lp-bp",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-bp`
			}, h$38("input", {
				id: `${props.idPrefix}-sbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "收缩压",
				"aria-label": "收缩压（高压）",
				value: values.sbp,
				onChange: (event) => set("sbp", event.target.value)
			}), h$38("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/"), h$38("input", {
				id: `${props.idPrefix}-dbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				value: values.dbp,
				onChange: (event) => set("dbp", event.target.value)
			}), h$38("span", { className: "lp-unit" }, "mmHg"))), h$38("div", { className: "lp-self-field" }, h$38("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-date`
			}, "测量日期"), h$38("input", {
				id: `${props.idPrefix}-date`,
				className: "lp-input",
				type: "date",
				value: date,
				max: today,
				min: "1990-01-01",
				onChange: (event) => setDate(event.target.value || today)
			}))), error ? h$38("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$38("div", { className: "lp-form-actions" }, h$38(Btn, {
				type: "submit",
				disabled: busy
			}, busy ? "记录中…" : "记录"), h$38("span", { className: "lp-caption" }, "单位可以选斤、尺或寸，会换算成 kg 和 cm。")));
		}
		function SelfRecent(props) {
			const { data, loading, error } = useSelfRows();
			const [busy, setBusy] = react.default.useState(null);
			const rows = (data?.rows ?? []).slice(0, 6);
			if (loading && !data) return null;
			if (!data && error) return h$38(LoadError, {
				what: "自测记录",
				error,
				compact: true,
				onRetry: () => reload("self")
			});
			if (rows.length === 0) return h$38("p", { className: "lp-caption lp-self-empty" }, "还没有自测记录。");
			async function remove(row) {
				setBusy(row.id);
				try {
					await deleteJson(`/api/longpi/self?id=${encodeURIComponent(row.id)}`);
					props.onNotice(`已删除 ${chineseDate(row.date)}的${labelOf(row.key)}。`, "good");
					notifyChanged();
				} catch (err) {
					props.onNotice(`没有删除：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(null);
				}
			}
			return h$38("div", { className: "lp-self-recent" }, h$38("div", { className: "lp-subhead" }, "最近记录"), h$38("ul", { className: "lp-rows" }, ...rows.map((row) => h$38("li", {
				key: row.id,
				className: "lp-row"
			}, h$38("span", { className: "lp-row-main" }, h$38("span", null, labelOf(row.key)), h$38("span", { className: "lp-num" }, ` ${fmt(row.value)} ${row.unit}`), row.given ? h$38("span", { className: "lp-caption" }, `（记为 ${fmt(row.given.value)} ${row.given.unit}）`) : null), h$38("span", { className: "lp-caption" }, chineseDate(row.date)), h$38("button", {
				type: "button",
				className: "lp-iconbtn",
				disabled: busy === row.id,
				"aria-label": `删除 ${chineseDate(row.date)} 的${labelOf(row.key)} ${fmt(row.value)} ${row.unit}`,
				onClick: () => {
					remove(row);
				}
			}, h$38(Icon, {
				name: "trash",
				size: 14
			}))))));
		}
		function labelOf(key) {
			return SELF_FALLBACK.find((row) => row.key === key)?.label_zh ?? key;
		}
		/** One field for an add-on the person can measure now (waist, blood pressure), right in the checklist. */
		function InlineSelf(props) {
			const all = specs(props.journey);
			const bp = props.selfKey === "sbp" || props.selfKey === "dbp";
			const spec = all.find((row) => row.key === props.selfKey) ?? SELF_FALLBACK.find((row) => row.key === props.selfKey);
			const [value, setValue] = react.default.useState("");
			const [dbp, setDbp] = react.default.useState("");
			const [unit, setUnit] = react.default.useState(spec.unit);
			const [busy, setBusy] = react.default.useState(false);
			async function submit(event) {
				event.preventDefault();
				const first = numberOf$1(value);
				const second = bp ? numberOf$1(dbp) : null;
				if (first == null || Number.isNaN(first) || bp && (second == null || Number.isNaN(second))) {
					props.onNotice(bp ? "请填收缩压和舒张压两个数字。" : `${spec.label_zh}请填一个数字。`, "bad");
					return;
				}
				setBusy(true);
				try {
					const result = await saveEntries(bp ? [{
						key: "sbp",
						value: first,
						unit: "mmHg"
					}, {
						key: "dbp",
						value: second,
						unit: "mmHg"
					}] : [{
						key: props.selfKey,
						value: first,
						unit
					}]);
					setValue("");
					setDbp("");
					props.onNotice(result.problems.length > 0 ? result.problems.join(" ") : `已记录${bp ? "血压" : spec.label_zh}，正在重新计算。`, result.problems.length > 0 ? "info" : "good");
					notifyChanged();
				} catch (err) {
					props.onNotice(errorText(err, "没有记下，请稍后再试。"), "bad");
				} finally {
					setBusy(false);
				}
			}
			return h$38("form", {
				className: "lp-inline-self",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$38("input", {
				className: "lp-input",
				inputMode: "decimal",
				value,
				placeholder: bp ? "收缩压" : spec.label_zh,
				"aria-label": bp ? "收缩压（高压）" : `${spec.label_zh}`,
				id: `${props.idPrefix}-${props.selfKey}`,
				onChange: (event) => setValue(event.target.value)
			}), bp ? h$38("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/") : null, bp ? h$38("input", {
				className: "lp-input",
				inputMode: "decimal",
				value: dbp,
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				onChange: (event) => setDbp(event.target.value)
			}) : null, bp ? h$38("span", { className: "lp-unit" }, "mmHg") : h$38(UnitSelect, {
				id: `${props.idPrefix}-${props.selfKey}-unit`,
				spec,
				value: unit,
				label: `${spec.label_zh}的单位`,
				onChange: setUnit
			}), h$38(Btn, {
				type: "submit",
				size: "sm",
				disabled: busy
			}, busy ? "记录中" : "记录"));
		}
		//#endregion
		//#region src/client/journey-steps.ts
		const h$37 = react.default.createElement;
		async function acceptConsent() {
			await postJson("/api/longpi/consent", { accept: true });
			notifyChanged();
		}
		const CONSENT_ICONS = [
			"health",
			"lock",
			"spark"
		];
		function ConsentText() {
			return h$37("div", { className: "lp-consent" }, ...CONSENT_SENTENCES.map((text, index) => h$37("div", {
				key: index,
				className: "lp-consent-row"
			}, h$37("span", {
				className: "lp-consent-icon",
				"aria-hidden": true
			}, h$37(Icon, {
				name: CONSENT_ICONS[index] ?? "info",
				size: 15
			})), h$37("p", null, text))));
		}
		/** '· N 次完整体检', left out at 0: "0 次完整体检" reads as a fault. */
		function checkupsText(count) {
			return count > 0 ? ` · ${count} 次完整体检` : "";
		}
		function RecordsStatusLine(props) {
			const records = props.journey.records;
			if (recordConnected(records.status)) {
				const partial = records.status === "partial";
				return h$37("div", { className: "lp-status" }, h$37("span", {
					className: `lp-statusdot ${partial ? "lp-statusdot-warn" : "lp-statusdot-on"}`,
					"aria-hidden": true
				}), `已连上 · ${records.indicator_count} 项检查${checkupsText(records.full_checkups)}${partial ? " · 有的这次没读到，不是没测" : ""}`);
			}
			return h$37("div", { className: "lp-status" }, h$37("span", {
				className: `lp-statusdot ${records.status === "error" ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), records.status === "error" ? `记录读取失败：${records.error || "没有返回原因"}` : "还没有读到体检");
		}
		function month(iso) {
			return iso ? `${iso.slice(0, 4)}-${iso.slice(5, 7)}` : "";
		}
		/** Three tiles: checkups and their date range, lab categories, wearable days. Only counts the server gave. */
		function FoundTiles(props) {
			const records = props.journey.records;
			const summary = records.summary;
			const tiles = [];
			if (summary) {
				const range = summary.first_date && summary.last_date && summary.first_date !== summary.last_date ? `${month(summary.first_date)} → ${month(summary.last_date)}` : summary.last_date ? chineseDate(summary.last_date) : "";
				tiles.push({
					label: "体检",
					figure: String(summary.checkups),
					unit: "次",
					caption: range
				});
				tiles.push({
					label: "指标",
					figure: String(records.indicator_count),
					unit: "项",
					caption: summary.categories_zh.length > 0 ? `${summary.categories_zh.slice(0, 3).join(" · ")}${summary.categories_zh.length > 3 ? "…" : ""}` : ""
				});
				tiles.push({
					label: "手环",
					figure: String(summary.wearable_days),
					unit: "天",
					caption: summary.wearable_days > 0 ? "近一年有记录的天数" : "没有手环数据"
				});
			} else {
				tiles.push({
					label: "指标",
					figure: String(records.indicator_count),
					unit: "项",
					caption: ""
				});
				tiles.push({
					label: "完整体检",
					figure: String(records.full_checkups),
					unit: "次",
					caption: records.latest_checkup ? `最近 ${chineseDate(records.latest_checkup)}` : "九项血检还没有在同一天测齐"
				});
			}
			return h$37("ul", { className: "lp-found" }, ...tiles.map((tile) => h$37("li", {
				key: tile.label,
				className: "lp-found-tile"
			}, h$37("span", { className: "lp-caption" }, tile.label), h$37("span", { className: "lp-found-figure" }, tile.figure, h$37("span", { className: "lp-bignum-unit" }, tile.unit)), tile.caption ? h$37("span", { className: "lp-caption" }, tile.caption) : null)));
		}
		/** One line on changes beyond normal fluctuation, when the record has any. */
		function ChangesLine(props) {
			const rows = props.journey.changes;
			if (rows.length === 0) return null;
			const names = rows.slice(0, 3).map((row) => row.label_zh).join("、");
			const doctor = rows.some((row) => row.ask_doctor);
			return h$37("p", { className: `lp-found-changes ${doctor ? "lp-found-changes-warn" : ""}` }, h$37(Icon, {
				name: doctor ? "warn" : "info",
				size: 14
			}), h$37("span", null, h$37("span", { className: "lp-strong" }, `值得注意：${rows.length} 项指标的变化超出正常波动`), ` · ${names}${rows.length > 3 ? " 等" : ""}`, props.onOpenChanges ? h$37(react.default.Fragment, null, " · ", h$37("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.onOpenChanges
			}, "在健康页查看")) : null));
		}
		/** Step 3: what LongPi found, or the connection form (no installer needed). */
		function RecordsStep(props) {
			const records = props.journey.records;
			const connected = recordConnected(records.status);
			return h$37("div", { className: "lp-step-body" }, connected ? h$37(react.default.Fragment, null, h$37("p", { className: "lp-muted" }, "已经放进来的体检（只读）："), h$37(FoundTiles, { journey: props.journey }), records.status === "partial" ? h$37("p", { className: "lp-blocker lp-blocker-bad" }, `有一部分记录这次没有读到${records.read_errors[0] ? `：${records.read_errors[0]}` : ""}。它们不是“没测”，稍后在健康页刷新。`) : null, h$37(ChangesLine, props)) : h$37(react.default.Fragment, null, records.status === "error" ? h$37("p", { className: "lp-blocker lp-blocker-bad" }, `记录读取失败：${records.error || "没有返回原因"}`) : h$37("p", { className: "lp-muted" }, "用邮箱和密码登录并连接。平时不用看地址。")), h$37(ConnectionPanel, {
				idPrefix: "lp-onb-conn",
				collapsed: connected
			}));
		}
		/** The two results, compact: a figure, or 还不能计算 with the server's reason. */
		function ResultFigures(props) {
			const { bioage, risk } = props.journey.results;
			return h$37("div", { className: "lp-first" }, h$37("div", { className: "lp-first-cell" }, h$37("div", { className: "lp-caption" }, "身体年龄 · 模型估计"), bioage.status === "ok" ? h$37("div", null, h$37("div", { className: "lp-first-figure" }, fmt(bioage.phenoage), h$37("span", { className: "lp-bignum-unit" }, "岁")), h$37("div", { className: "lp-caption" }, bioage.headline_zh ? bioage.headline_zh : bioage.allows_younger ? versusAge(bioage.advance, bioage.checkups) : ""), bioage.caveat_zh ? h$37("p", {
				className: "lp-caption lp-first-caveat",
				role: "note"
			}, bioage.caveat_zh) : null) : h$37("div", null, h$37("div", { className: "lp-first-wait" }, "还不能计算"), h$37("p", { className: "lp-blocker" }, bioage.blocker_zh))), h$37("div", { className: "lp-first-cell" }, h$37("div", { className: "lp-caption" }, "10 年心血管风险 · 模型估计"), risk.status === "ok" ? h$37("div", null, h$37("div", { className: "lp-first-figure" }, riskText(risk.risk_pct), h$37("span", { className: "lp-bignum-unit" }, "%")), h$37("div", { className: "lp-caption" }, risk.category_zh)) : h$37("div", null, h$37("div", { className: "lp-first-wait" }, "还不能计算"), h$37("p", { className: "lp-blocker" }, risk.blocker_zh))));
		}
		/**
		* Step 4 when a result is blocked: what can be done right now. A waist
		* measurement when it unlocks the risk, a plan draft, and the add-on tests.
		*/
		function NowList(props) {
			const { journey } = props;
			const waist = journey.addons.find((row) => row.self_measurable && row.self_key && row.unlocks_zh.includes("心血管"));
			const lab = journey.addons.filter((row) => !row.self_measurable);
			const rows = [];
			if (waist?.self_key) rows.push(h$37("li", {
				key: "self",
				className: "lp-now"
			}, h$37("span", {
				className: "lp-now-icon",
				"aria-hidden": true
			}, h$37(Icon, {
				name: "ruler",
				size: 15
			})), h$37("div", { className: "lp-now-text" }, h$37("div", { className: "lp-strong" }, `量一下${waist.item_zh}`), h$37("div", { className: "lp-caption" }, `填上就能算出${waist.unlocks_zh}`), h$37(InlineSelf, {
				journey,
				selfKey: waist.self_key,
				idPrefix: "lp-onb-now",
				onNotice: props.onNotice
			}))));
			rows.push(h$37("li", {
				key: "plan",
				className: "lp-now"
			}, h$37("span", {
				className: "lp-now-icon",
				"aria-hidden": true
			}, h$37(Icon, {
				name: "spark",
				size: 15
			})), h$37("div", { className: "lp-now-text" }, h$37("div", { className: "lp-strong" }, "先制定一份改善方案"), h$37("div", { className: "lp-caption" }, "按你关心的方面，从收录的试验证据里起草；你确认后才保存。")), h$37(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.actions.onDraft
			}, "起草方案")));
			if (lab.length > 0) rows.push(h$37("li", {
				key: "lab",
				className: "lp-now"
			}, h$37("span", {
				className: "lp-now-icon",
				"aria-hidden": true
			}, h$37(Icon, {
				name: "flask",
				size: 15
			})), h$37("div", { className: "lp-now-text" }, h$37("div", { className: "lp-strong" }, `下次体检加测${lab.slice(0, 2).map((row) => row.item_zh).join("、")}${lab.length > 2 ? " 等" : ""}`), h$37("div", { className: "lp-caption" }, `加上就能算${[...new Set(lab.map((row) => row.unlocks_zh))].join("、")}`)), h$37(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.actions.onAddons
			}, "加测清单")));
			return h$37("div", { className: "lp-now-block" }, h$37("div", { className: "lp-subhead" }, "现在就能做的事"), h$37("ul", { className: "lp-nows" }, ...rows));
		}
		/** Step 4: the results; when one is blocked, what can be done now instead of an empty card. */
		function FirstResult(props) {
			const { bioage, risk } = props.journey.results;
			const blocked = bioage.status !== "ok" || risk.status !== "ok";
			return h$37("div", { className: "lp-step-body" }, h$37(ResultFigures, { journey: props.journey }), blocked ? h$37(NowList, props) : null);
		}
		//#endregion
		//#region src/client/profile-editor.ts
		const h$36 = react.default.createElement;
		const ANSWERS = [
			{
				value: "yes",
				label: "是"
			},
			{
				value: "no",
				label: "否"
			},
			{
				value: "unsure",
				label: "不确定"
			}
		];
		function draftOf(journey) {
			const profile = journey?.profile;
			const risk = {};
			for (const key of profile?.riskUnknown ?? []) risk[key] = "unsure";
			for (const [key, value] of Object.entries(profile?.risk ?? {})) risk[key] = value ? "yes" : "no";
			return {
				displayName: profile?.displayName ?? "",
				age: profile?.age == null ? "" : String(profile.age),
				sex: profile?.sex ?? "unknown",
				risk,
				focus: [...profile?.focus ?? []]
			};
		}
		function factQuestions(journey) {
			const fromServer = (journey?.profile.questions ?? []).filter((row) => row.key !== "age" && row.key !== "sex");
			if (fromServer.length > 0) return fromServer;
			return RISK_FACTS.map((row) => ({
				key: row.key,
				label_zh: row.zh,
				unlocks_zh: "心血管风险",
				answered: false,
				men_only: row.menOnly
			}));
		}
		function unlockOf(journey, key) {
			return journey?.profile.questions.find((row) => row.key === key)?.unlocks_zh || "身体年龄、心血管风险";
		}
		function parseAge(text) {
			const trimmed = text.trim();
			if (!trimmed) return {
				ok: true,
				value: null
			};
			const value = Number(trimmed);
			if (!Number.isInteger(value) || value < 0 || value > 130) return { ok: false };
			return {
				ok: true,
				value
			};
		}
		function ProfileEditor(props) {
			const [draft, setDraft] = react.default.useState(() => draftOf(props.journey));
			const [dirty, setDirty] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const serverProfile = JSON.stringify(props.journey?.profile ?? null);
			react.default.useEffect(() => {
				if (!dirty) setDraft(draftOf(props.journey));
			}, [serverProfile]);
			const edit = (patch) => {
				setDirty(true);
				setError(null);
				setDraft((current) => ({
					...current,
					...patch
				}));
			};
			const ageCheck = parseAge(draft.age);
			const facts = factQuestions(props.journey);
			const focusOptions = props.journey?.focus_options?.length ? props.journey.focus_options : FOCUS_FALLBACK;
			const onboarding = props.variant === "onboarding";
			async function save(event) {
				event?.preventDefault();
				if (!ageCheck.ok) {
					setError("年龄请填整数，例如 52。");
					return;
				}
				setBusy(true);
				try {
					const risk = {};
					for (const row of facts) {
						const answer = draft.risk[row.key] ?? "";
						if (answer === "") continue;
						risk[row.key] = answer === "yes" ? true : answer === "no" ? false : null;
					}
					const body = {
						age: ageCheck.value,
						sex: draft.sex,
						risk,
						focus: draft.focus
					};
					if (!onboarding) body.displayName = draft.displayName.trim();
					await postJson("/api/longpi/profile", body);
					setDirty(false);
					props.onNotice?.("档案已保存。", "good");
					notifyChanged();
					props.onSaved?.();
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			const toggleFocus = (key) => {
				const has = draft.focus.includes(key);
				edit({ focus: has ? draft.focus.filter((item) => item !== key) : [...draft.focus, key] });
			};
			const female = draft.sex === "female";
			const answeredFacts = facts.filter((row) => {
				const answer = draft.risk[row.key] ?? "";
				return answer === "yes" || answer === "no" || answer === "unsure";
			}).length;
			return h$36("form", {
				className: `lp-profile lp-profile-${props.variant}`,
				onSubmit: (event) => {
					save(event);
				},
				noValidate: true
			}, onboarding ? null : h$36("div", { className: "lp-field" }, h$36("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-name`
			}, "称呼", h$36("span", { className: "lp-optional" }, "选填")), h$36("input", {
				id: `${props.idPrefix}-name`,
				className: "lp-input",
				value: draft.displayName,
				maxLength: 40,
				autoComplete: "nickname",
				placeholder: "页面上怎么称呼你",
				onChange: (event) => edit({ displayName: event.target.value })
			})), h$36("div", { className: "lp-profile-basics" }, h$36("div", { className: "lp-field lp-field-age" }, h$36("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-age`
			}, "实足年龄"), h$36("div", { className: "lp-input-unit" }, h$36("input", {
				id: `${props.idPrefix}-age`,
				className: "lp-input",
				inputMode: "numeric",
				value: draft.age,
				placeholder: "例如 52",
				"aria-invalid": !ageCheck.ok,
				"data-modal-autofocus": onboarding ? true : void 0,
				onChange: (event) => edit({ age: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })
			}), h$36("span", { className: "lp-unit" }, "岁"))), h$36("div", { className: "lp-field lp-field-sex" }, h$36(Segmented, {
				name: `${props.idPrefix}-sex`,
				label: "性别",
				options: [{
					value: "female",
					label: "女"
				}, {
					value: "male",
					label: "男"
				}],
				value: draft.sex === "female" || draft.sex === "male" ? draft.sex : "",
				onChange: (value) => edit({ sex: value })
			}))), h$36("p", { className: "lp-unlock" }, h$36(Icon, {
				name: "lock",
				size: 12
			}), `解锁：${unlockOf(props.journey, "age")}`), h$36("fieldset", { className: "lp-facts" }, h$36("legend", { className: "lp-facts-legend" }, h$36("span", { className: "lp-strong" }, "心血管风险还需要这 6 项"), h$36("span", { className: "lp-caption" }, ` · 已回答 ${answeredFacts} 项，不确定就选“不确定”，不会当作“否”`)), ...facts.map((row) => h$36("div", {
				className: "lp-fact",
				key: row.key
			}, h$36("div", { className: "lp-fact-text" }, h$36("div", {
				className: "lp-fact-label",
				id: `${props.idPrefix}-${row.key}-text`
			}, row.label_zh), h$36("div", { className: "lp-unlock lp-unlock-inline" }, `解锁：${row.unlocks_zh || "心血管风险"}`, row.men_only ? female ? " · 女性的公式不用这一项，可以跳过" : " · 只用于男性的公式" : "")), h$36(Segmented, {
				name: `${props.idPrefix}-${row.key}`,
				label: row.label_zh,
				hideLabel: true,
				options: ANSWERS,
				value: draft.risk[row.key] ?? "",
				onChange: (value) => edit({ risk: {
					...draft.risk,
					[row.key]: value
				} })
			})))), h$36("div", { className: "lp-focus" }, h$36("div", {
				className: "lp-field-label",
				id: `${props.idPrefix}-focus`
			}, "你最关心什么", h$36("span", { className: "lp-optional" }, "可多选，按点选先后排序")), h$36("div", {
				className: "lp-toggles",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-focus`
			}, ...focusOptions.map((option) => {
				const index = draft.focus.indexOf(option.key);
				return h$36(ToggleChip, {
					key: option.key,
					pressed: index >= 0,
					badge: index >= 0 ? String(index + 1) : void 0,
					onClick: () => toggleFocus(option.key)
				}, option.label_zh);
			}))), error ? h$36("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$36("div", { className: onboarding ? "lp-modal-actions" : "lp-form-actions" }, onboarding ? h$36(Btn, {
				variant: "outline",
				type: "button",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过") : null, h$36(Btn, {
				type: "submit",
				disabled: busy || !onboarding && !dirty
			}, busy ? "保存中…" : onboarding ? "保存并继续" : "保存档案"), !onboarding && !dirty && props.journey?.profile.complete ? h$36("span", { className: "lp-caption" }, "已是最新") : null));
		}
		//#endregion
		//#region src/client/privacy/data-page.ts
		const h$35 = react.default.createElement;
		function List(props) {
			return h$35("div", null, h$35("div", { className: "lp-strong" }, props.title), h$35("ul", { className: "lp-privacy" }, ...props.lines.map((line) => h$35("li", { key: line }, line))));
		}
		function DataPage(props) {
			const [status, setStatus] = react.default.useState(null);
			const [phrase, setPhrase] = react.default.useState("");
			const [error, setError] = react.default.useState(null);
			const [note, setNote] = react.default.useState(null);
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/privacy").then(setStatus).catch((err) => setError(errorText(err, "没有读到隐私说明")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const act = (body) => {
				setError(null);
				postJson("/api/longpi/privacy/consent", body).then(() => {
					setNote("已记下");
					if (body.scope === "data_flow_deepseek" && (body.decision === "granted" || body.decision === "declined")) props.onDecided?.(body.decision);
					load();
				}).catch((err) => setError(errorText(err, "没有记下")));
			};
			const copy = status?.copy;
			const flow = copy?.data_flow;
			const session = status?.session_log?.upload ? "已单独打开" : "关闭（健康对话的默认）";
			return h$35("section", {
				className: "lp",
				id: "lp-privacy-data"
			}, h$35("h2", { className: "lp-h2" }, flow?.title ?? "数据去哪里"), flow ? h$35(react.default.Fragment, null, h$35(List, {
				title: "会发给 DeepSeek 的",
				lines: flow.to_deepseek ?? []
			}), h$35(List, {
				title: "留在这台电脑的",
				lines: flow.stays_local ?? []
			}), h$35(List, {
				title: "体检原件留在原来的地方",
				lines: flow.mirobody ?? []
			}), h$35("p", null, flow.name), h$35("p", { className: "lp-muted" }, flow.session_log)) : null, h$35("p", { className: "lp-fine" }, `会话日志：${session}`), h$35("div", { className: "lp-form-actions" }, h$35(Btn, { onClick: () => act({
				scope: "data_flow_deepseek",
				decision: "granted"
			}) }, copy?.buttons?.flow_grant ?? "同意把健康对话发给 DeepSeek"), h$35(Btn, {
				variant: "outline",
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: "declined"
				})
			}, copy?.buttons?.flow_decline ?? "先不发送"), h$35(Btn, {
				variant: "outline",
				onClick: () => act({
					scope: "session_log_upload",
					decision: "declined"
				})
			}, copy?.buttons?.session_off ?? "会话日志保持关闭"), h$35(Btn, {
				variant: "outline",
				onClick: () => act({
					scope: "session_log_upload",
					decision: "granted"
				})
			}, copy?.buttons?.session_on ?? "单独打开会话日志")), h$35("p", { className: "lp-muted" }, status?.minor?.ask_age ? copy?.minor?.ask ?? "请填写年龄" : status?.minor?.minor ? copy?.minor?.under_18 ?? "未满 18 岁" : `图鉴抽卡：${status?.minor?.codex_allowed ? "可以开" : "关闭"}`), status?.export?.href ? h$35("p", null, h$35("a", { href: status.export.href }, "下载这台电脑上的 LongPi 档案")) : null, status?.export?.mirobody_note_zh ? h$35("p", { className: "lp-fine" }, status.export.mirobody_note_zh) : null, h$35("label", { className: "lp-field" }, `输入「${copy?.delete?.phrase ?? "删除全部"}」`, h$35("input", {
				className: "lp-input",
				value: phrase,
				onChange: (event) => setPhrase(event.target.value)
			})), h$35("div", { className: "lp-form-actions" }, h$35(Btn, {
				variant: "outline",
				onClick: () => {
					postJson("/api/longpi/privacy/delete", { confirm: phrase }).then(() => setNote("已删除这台电脑上的 LongPi 档案")).catch((err) => setError(errorText(err, "没有删除")));
				}
			}, "删除这台电脑上的 LongPi 数据")), copy?.delete?.note ? h$35("p", { className: "lp-fine" }, copy.delete.note) : null, error ? h$35("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, note ? h$35("p", { role: "status" }, note) : null);
		}
		//#endregion
		//#region src/client/privacy/consent-screen.ts
		const h$34 = react.default.createElement;
		function SensitiveConsentScreen(props) {
			const [status, setStatus] = react.default.useState(null);
			const [guardian, setGuardian] = react.default.useState(false);
			const [age, setAge] = react.default.useState("");
			const [error, setError] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			react.default.useEffect(() => {
				let live = true;
				getJson("/api/longpi/privacy").then((row) => {
					if (live) setStatus(row);
				}).catch((err) => {
					if (live) setError(errorText(err, "没有读到同意书"));
				});
				return () => {
					live = false;
				};
			}, []);
			const send = (decision) => {
				setBusy(true);
				setError(null);
				const body = {
					scope: "pipl_sensitive",
					decision
				};
				if (age.trim()) body.age = Number(age);
				if (guardian) body.guardian = true;
				postJson("/api/longpi/privacy/consent", body).then(() => props.onDone?.()).catch((err) => setError(errorText(err, "没有记下"))).finally(() => setBusy(false));
			};
			const copy = status?.copy;
			const paragraphs = copy?.pipl?.paragraphs ?? [];
			return h$34("section", {
				className: "lp-consent",
				id: "lp-pipl-consent"
			}, h$34("h2", { className: "lp-onb-title" }, copy?.pipl?.title ?? "单独同意：处理你的健康信息"), h$34("p", { className: "lp-onb-lead" }, copy?.pipl?.lead ?? "这一页是单独的一次同意。"), ...paragraphs.map((line) => h$34("p", { key: line }, line)), status?.minor?.child ? h$34("p", { className: "lp-fine" }, copy?.minor?.under_14) : null, h$34("label", { className: "lp-field" }, "实足年龄", h$34("input", {
				className: "lp-input",
				id: "lp-pipl-age",
				inputMode: "numeric",
				value: age,
				onChange: (event) => setAge(event.target.value)
			})), h$34("label", { className: "lp-check" }, h$34("input", {
				type: "checkbox",
				checked: guardian,
				onChange: (event) => setGuardian(event.target.checked)
			}), "我是监护人，同意为未满 14 岁的人处理这些健康信息"), error ? h$34("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$34("div", { className: "lp-modal-actions" }, h$34(Btn, {
				variant: "outline",
				disabled: busy,
				onClick: () => send("declined")
			}, copy?.buttons?.pipl_decline ?? "暂不同意"), h$34(Btn, {
				disabled: busy,
				onClick: () => send("granted")
			}, copy?.buttons?.pipl_grant ?? "我单独同意处理我的健康信息")));
		}
		//#endregion
		//#region src/client/onboarding.ts
		const h$33 = react.default.createElement;
		const ONBOARDING_TITLES = [
			"先放进一份报告",
			"看看这份报告",
			"第一个结果",
			"一起研究"
		];
		const NOOP = () => {};
		/** A journey that has not arrived by then is shown as not read, with a retry. */
		const GIVE_UP_MS = 45e3;
		/** The step a stage starts at when onboarding is opened on purpose. */
		function stepOfStage(stage) {
			if (stage === "consent") return 0;
			if (stage === "records" || stage === "profile") return 1;
			return 2;
		}
		function Dots(props) {
			return h$33("div", { className: "lp-onb-progress" }, h$33("ol", {
				className: "lp-dots",
				"aria-hidden": true
			}, ...ONBOARDING_TITLES.map((_, index) => h$33("li", {
				key: index,
				className: `lp-dot-step ${index === props.step ? "lp-dot-now" : index < props.step ? "lp-dot-past" : ""}`
			}))), h$33("span", { className: "lp-caption" }, `第 ${props.step + 1} 步，共 ${ONBOARDING_TITLES.length} 步`));
		}
		/** DSH's own onboarding dialogs keep the app root inert while they are up. */
		function useInertRoot() {
			react.default.useEffect(() => {
				const root = document.getElementById("root");
				if (!root) return void 0;
				const previous = root.inert;
				root.inert = true;
				return () => {
					root.inert = previous;
				};
			}, []);
		}
		function useAutofocus(ref, step, ready) {
			react.default.useEffect(() => {
				if (!ready) return;
				(ref.current?.querySelector("[data-modal-autofocus]") ?? ref.current?.querySelector("h2"))?.focus({ preventScroll: true });
			}, [step, ready]);
		}
		/** DSH's complete(), guarded so it runs once however many buttons and effects reach it. */
		function useCompleteOnce(complete) {
			const latest = react.default.useRef(complete);
			latest.current = complete;
			const [done, setDone] = react.default.useState(false);
			const called = react.default.useRef(false);
			return {
				done,
				finish: react.default.useCallback(() => {
					if (called.current) return;
					called.current = true;
					setDone(true);
					latest.current();
				}, [])
			};
		}
		/** Step 1: chat needs a model. Shown only when LongPi could tell no key is configured. */
		function ModelHint(props) {
			if (useModelStatus() !== "missing") return null;
			return h$33("div", {
				className: "lp-onb-hint",
				role: "note"
			}, h$33(Icon, {
				name: "info",
				size: 15
			}), h$33("span", null, "对话需要先在设置里填 DeepSeek API Key。"), props.onOpen ? h$33(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.onOpen
			}, "去设置") : h$33("span", { className: "lp-caption" }, "在左下角“设置 → 模型”中填写。"));
		}
		/** The journey did not arrive: say so, offer a retry, and let the person move on. */
		function NotRead(props) {
			return h$33(OnboardingModal, { title: "没有读到 LongPi 的数据" }, h$33("div", { className: "lp lp-onb" }, h$33("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, "暂时没有读到 LongPi 的数据"), h$33("p", { className: "lp-muted" }, props.error ? `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。` : "读取比平时慢。可以再试一次，或者先去对话，稍后在健康页继续。"), h$33("div", { className: "lp-modal-actions" }, h$33(Btn, {
				variant: "outline",
				onClick: props.onLater
			}, "稍后再说"), h$33(Btn, {
				"data-modal-autofocus": true,
				onClick: props.onRetry,
				disabled: props.busy
			}, props.busy ? "读取中…" : "重试"))));
		}
		function Onboarding(props) {
			const { journey, error: loadError, loading, refresh } = useJourney();
			const [step, setStep] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const [privacyOpen, setPrivacyOpen] = react.default.useState(false);
			/** undefined while the consent file is still loading. null means no DeepSeek decision yet. */
			const [flowDecision, setFlowDecision] = react.default.useState(void 0);
			const [computing, setComputing] = react.default.useState(false);
			const [timedOut, setTimedOut] = react.default.useState(false);
			const [retrying, setRetrying] = react.default.useState(false);
			const [notice, notify] = useNotice();
			const decided = react.default.useRef(false);
			const content = react.default.useRef(null);
			const { done, finish } = useCompleteOnce(props.complete);
			const storedOpener = useSettingsOpener();
			const openSection = props.openSection ?? storedOpener;
			react.default.useEffect(() => {
				setSettingsOpener(props.openSection);
			}, [props.openSection]);
			react.default.useEffect(() => {
				let live = true;
				getJson("/api/longpi/privacy").then((row) => {
					if (live) setFlowDecision(row?.consents?.data_flow_deepseek?.decision ?? null);
				}).catch(() => {
					if (live) setFlowDecision(null);
				});
				return () => {
					live = false;
				};
			}, []);
			react.default.useEffect(() => {
				if (decided.current || !journey || flowDecision === void 0) return;
				decided.current = true;
				if (props.initialStep != null) {
					setStep(Math.max(0, Math.min(3, props.initialStep)));
					return;
				}
				if (journey.consent.accepted && deepseekConsentPending(flowDecision)) {
					setPrivacyOpen(true);
					setStep(0);
					return;
				}
				if (props.explicit) {
					setStep(stepOfStage(journey.stage));
					return;
				}
				if (journey.consent.accepted && journey.profile.complete) {
					finish();
					return;
				}
				setStep(journey.consent.accepted ? 1 : 0);
			}, [
				journey,
				finish,
				flowDecision,
				props.initialStep,
				props.explicit
			]);
			react.default.useEffect(() => {
				if (journey || timedOut) return void 0;
				const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS);
				return () => window.clearTimeout(timer);
			}, [journey, timedOut]);
			const go = react.default.useCallback((next) => {
				setError(null);
				setStep(next);
				if (next === 3) {
					setComputing(true);
					refresh(true).finally(() => setComputing(false));
				}
			}, [refresh]);
			const retry = react.default.useCallback(() => {
				setRetrying(true);
				setTimedOut(false);
				refresh(true).finally(() => setRetrying(false));
			}, [refresh]);
			useAutofocus(content, step ?? -1, step != null && !!journey && !done);
			if (done) return null;
			if (!journey) {
				if (!timedOut && !retrying && !(loadError && !loading)) return null;
				return h$33(NotRead, {
					error: loadError,
					onRetry: retry,
					onLater: finish,
					busy: retrying || loading
				});
			}
			if (step == null) return null;
			const toPage = (view) => {
				requestView(view);
				props.openPage?.();
				finish();
			};
			const toSettings = openSection ? () => {
				finish();
				openSection("models");
			} : null;
			return h$33(OnboardingModal, { title: ONBOARDING_TITLES[step] ?? ONBOARDING_TITLES[0] }, h$33("div", {
				className: "lp lp-onb",
				ref: content
			}, h$33(Dots, { step }), h$33("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, ONBOARDING_TITLES[step]), privacyOpen ? h$33("div", { className: "lp-onb-body" }, h$33("p", { className: "lp-onb-lead" }, "下面两件事分开记，都没有预先勾选，也不是刚才的产品说明。"), h$33(SensitiveConsentScreen, {}), h$33(DataPage, { onDecided: (decision) => {
				if (decision) setFlowDecision(decision);
			} }), h$33("div", { className: "lp-modal-actions" }, h$33(Btn, {
				disabled: deepseekConsentPending(flowDecision),
				onClick: () => {
					if (deepseekConsentPending(flowDecision)) return;
					setPrivacyOpen(false);
					go(1);
				}
			}, deepseekConsentPending(flowDecision) ? "请先选择是否发给 DeepSeek" : "继续填写档案"))) : null, !privacyOpen && step === 0 ? h$33("div", { className: "lp-onb-body" }, h$33(ModelHint, { onOpen: toSettings }), h$33(ConsentText), error ? h$33("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$33("div", { className: "lp-modal-actions" }, h$33(Btn, {
				variant: "outline",
				onClick: finish,
				disabled: busy
			}, "以后再说"), h$33(Btn, {
				"data-modal-autofocus": true,
				disabled: busy,
				onClick: () => {
					setBusy(true);
					acceptConsent().then(() => go(1)).catch((err) => setError(`没有记下：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
				}
			}, busy ? "记录中…" : "先看报告"))) : null, step === 1 ? h$33("div", { className: "lp-onb-body" }, h$33("p", { className: "lp-onb-lead" }, "先看已经放进来的体检。缺的问题可以等结果需要时再答，不知道就跳过。"), h$33(RecordsStep, {
				journey,
				onOpenChanges: props.openPage || props.explicit ? () => toPage({
					tab: "overview",
					id: "lp-changes"
				}) : void 0
			}), h$33("div", { className: "lp-modal-actions" }, h$33(Btn, {
				variant: "outline",
				onClick: () => go(0)
			}, "上一步"), h$33(Btn, {
				"data-modal-autofocus": true,
				onClick: () => go(2)
			}, recordConnected(journey.records.status) ? "看第一个结果" : "先跳过"))) : null, step === 2 ? h$33("div", { className: "lp-onb-body" }, journey.profile.age == null || journey.profile.sex !== "male" && journey.profile.sex !== "female" ? h$33(react.default.Fragment, null, h$33("p", { className: "lp-onb-lead" }, "算这个结果还缺一项。不知道可以跳过，不会当成“否”。"), h$33(ProfileEditor, {
				journey,
				variant: "onboarding",
				idPrefix: "lp-onb-profile",
				onSaved: () => go(2),
				onSkip: () => go(3)
			})) : null, computing ? h$33("div", {
				className: "lp-onb-computing",
				"aria-busy": true
			}, h$33(Skeleton, { height: 88 }), h$33("p", { className: "lp-caption" }, "正在用你的记录计算…")) : h$33(FirstResult, {
				journey,
				onNotice: notify,
				actions: {
					onDraft: () => {
						if (props.openPage || props.explicit) toPage({
							tab: "plan",
							id: "lp-plan"
						});
						else {
							setPendingPrompt(DRAFT_PROMPT, "hero");
							finish();
						}
					},
					onAddons: () => toPage({
						tab: "profile",
						id: "lp-addons-card"
					})
				}
			}), notice, h$33("p", { className: "lp-fine" }, journey.boundary_zh), h$33("div", { className: "lp-modal-actions" }, h$33(Btn, {
				variant: "outline",
				onClick: () => go(1)
			}, "上一步"), h$33(Btn, { onClick: () => go(3) }, "继续"))) : null, step === 3 ? h$33("div", { className: "lp-onb-body" }, h$33("p", { className: "lp-onb-lead" }, "LongPi 的用户在一起研究怎样延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。加入要你自己再点一次，没有预先勾上。"), h$33("p", { className: "lp-caption" }, "研究正式开始后才会发出，现在只保存在你的设备上。"), h$33("div", { className: "lp-modal-actions" }, h$33(Btn, { onClick: () => {
				props.openPage?.();
				finish();
			} }, "加入"), h$33(Btn, {
				variant: "outline",
				onClick: finish
			}, "以后再说"))) : null));
		}
		function OnboardingModal(props) {
			useInertRoot();
			return h$33(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: props.title,
				onClose: NOOP,
				headless: true,
				className: "lp-onb-dialog"
			}, props.children);
		}
		//#endregion
		//#region src/ux/plain.ts
		const SEASON_INTRO = "一个赛季大约 8–12 周，从现在到你下次复查。这段时间里有几个小目标，复查那天一起看看成绩，然后开始下一个赛季。";
		const CODEX_INTRO = "做完一件对健康有用的事（比如看医生、复查、量腰围），就能得到一张长寿图鉴卡。每张卡讲一个长寿研究或一种长寿动物，有的还能直接用你的数据算一算。";
		const SCIENCE_INTRO = "LongPi 的用户在一起研究怎样延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。";
		const OUTBOX_ZH = "研究正式开始后才会发出，现在只保存在你的设备上。";
		const JUDGEMENT = {
			beyond: "超出正常波动（比你平常的起伏更大，值得问医生。不是急症。）",
			within: "在正常波动范围内（这点变化不算数）",
			too_early: "太早（离上次太近，现在的变化多半只是起伏）",
			not_comparable: "不可比（两次不是同一家机构测的，不好直接比）",
			unjudged: "还不能下结论（看缺的是哪一步）"
		};
		/** Short chip, then the one-sentence meaning the first time that word appears. */
		function judgementText(kind, first) {
			const full = JUDGEMENT[kind];
			if (first) return full;
			return full.split("（")[0] ?? full;
		}
		function judgementKind(input) {
			const reason = input.reason ?? "";
			if (input.gate === "too_early" || reason.startsWith("太早")) return "too_early";
			if (input.gate === "not_comparable" || reason.startsWith("不可比")) return "not_comparable";
			if (input.judged === "changed") return "beyond";
			if (input.judged === "within") return "within";
			return "unjudged";
		}
		function trimNum(value) {
			if (!Number.isFinite(value)) return "—";
			const abs = Math.abs(value);
			const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
			return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
		}
		/** The card's first line: from → to, percent, how many results, and the date span. */
		function movementOf(points, unit) {
			const rows = points.filter((point) => Number.isFinite(point.value) && point.date);
			if (rows.length === 0) return null;
			const first = rows[0];
			const last = rows[rows.length - 1];
			const unitText = unit ? ` ${unit}` : "";
			if (rows.length === 1) return {
				from: first.value,
				to: first.value,
				pct: null,
				n: 1,
				start: first.date,
				end: first.date,
				lead: `${trimNum(first.value)}${unitText} · 1 次 · ${first.date}`
			};
			const pct = first.value === 0 ? null : (last.value - first.value) / Math.abs(first.value) * 100;
			const pctText = pct == null ? "" : ` · ${pct > 0 ? "+" : pct < 0 ? "−" : ""}${trimNum(Math.abs(pct))}%`;
			return {
				from: first.value,
				to: last.value,
				pct,
				n: rows.length,
				start: first.date,
				end: last.date,
				lead: `${trimNum(first.value)} → ${trimNum(last.value)}${unitText}${pctText} · ${rows.length} 次 · ${first.date}–${last.date}`
			};
		}
		/** Two to four changes beside body age. A falling red-cell marker leads when body age is high. */
		function pickKeyTrends(changes, bodyOlder = false) {
			const rows = [...changes];
			rows.sort((a, b) => {
				const ah = bodyOlder && /血红蛋白|红细胞|红细胞平均|MCV|MCH/.test(a.label_zh) ? 2 : a.ask_doctor ? 1 : 0;
				return (bodyOlder && /血红蛋白|红细胞|红细胞平均|MCV|MCH/.test(b.label_zh) ? 2 : b.ask_doctor ? 1 : 0) - ah;
			});
			if (rows.length <= 4) return rows;
			return rows.slice(0, 4);
		}
		function insightSentence(input) {
			const sleep = input.sleepHours;
			const steps = input.steps;
			if ((sleep == null || !Number.isFinite(sleep)) && (steps == null || !Number.isFinite(steps))) return null;
			const bits = [];
			if (sleep != null && Number.isFinite(sleep)) bits.push(`昨晚睡了 ${trimNum(sleep)} 小时`);
			if (steps != null && Number.isFinite(steps)) bits.push(`今天走了 ${trimNum(steps)} 步`);
			const lab = input.labNote ? `和化验放在一起看：${input.labNote}` : "手环是这一两天的情况，化验要隔几周才测一次，两件事先分开看。";
			return `${bits.join("，")}。${lab}`;
		}
		/** Questions in the person's own voice, about what changed and the next visit. */
		function suggestedQuestions(input) {
			const names = (input.changes ?? []).filter(Boolean).slice(0, 2);
			return [
				names.length > 0 ? `${names.join("、")}跟上次比，变了多少？` : "和上次比，哪一项变了？",
				input.visit ? `下次 ${input.visit} 看医生，我要问哪几件？` : "下次看医生，我要问哪几件？",
				"现在我先做哪一件？"
			];
		}
		function lifeAreaOf(label) {
			if (/睡眠|入睡|深睡|清醒时间|心率变异/.test(label)) return "sleep";
			if (/步数|运动|活动量|锻炼|卡路里|训练负荷|步行/.test(label)) return "training";
			return "labs";
		}
		function buildTimeline(input) {
			const items = [];
			for (const row of input.checkups ?? []) items.push({
				date: row.date,
				kind: "lab",
				title_zh: "体检",
				detail_zh: row.note || "这一天有化验"
			});
			for (const row of input.wearables ?? []) items.push({
				date: row.date,
				kind: "wearable",
				title_zh: row.label_zh,
				detail_zh: row.value_zh
			});
			const lifeTitle = {
				sick: "今天生病",
				travel: "今天出行",
				visit: "看医生",
				plan: "计划有变动"
			};
			for (const row of input.life ?? []) items.push({
				date: row.date,
				kind: "life",
				title_zh: lifeTitle[row.kind],
				detail_zh: row.note || lifeTitle[row.kind]
			});
			return items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
		}
		const SCRUB = [
			[/Mirobody/gi, "体检记录"],
			[/longevity-skills/gi, ""],
			[/\bMCP\b/g, ""],
			[/\/mcp\/\S*/g, ""],
			[/\bDSH\b/g, ""],
			[/HARNESS/gi, ""],
			[/\bLOINC\b/g, ""],
			[/\bRCV\b/g, "正常波动"],
			[/\bCVI\b/g, "个体起伏"],
			[/ChiCTR/g, ""],
			[/签署密钥/g, ""],
			[/参考变化值/g, "平常的起伏"],
			[/加了噪声/g, ""],
			[/\blive\b/g, ""],
			[/record_status/g, ""],
			[/~\/\.dsh\/longpi/g, "这台电脑"],
			[/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\S*/g, ""],
			[/\b(?:127\.0\.0\.1|localhost)\b/g, ""],
			[/(?:(?<=\s)|^):\d{2,5}\b/g, ""],
			[/\b[A-Z]\d{2}\.\d+\b/g, ""],
			[/\b(?:NaN|undefined|null)\b/g, ""],
			[/\b\d[\d,]*\s*tok(?:\/s)?\b/gi, ""],
			[/User says[:：][^\n]*/gi, ""],
			[/\bTHE PATTERN\b/g, "我看到的"],
			[/\bWHAT WE DON'T KNOW\b/g, "数据说明不了的"],
			[/[A-Za-z]+(?:[ \t]+[A-Za-z]+){2,}/g, ""]
		];
		const ICD_DOTTED = /\b[A-Z]\d{2}\.\d{1,2}\b/;
		const ICD_TAIL = /(?:^|[\s（(])[A-Z]\d{2}(?=[）)]?\s*$)/;
		const NOT_DIAGNOSIS = /维生素|vitamin/i;
		/** A catalogue row that is a diagnosis (it carries a disease code) is not an indicator. */
		function isDiagnosisName(name) {
			if (NOT_DIAGNOSIS.test(name)) return false;
			return ICD_DOTTED.test(name) || ICD_TAIL.test(name.trim());
		}
		/**
		* A paper as a person reads it: first author and year (Coskun 等，2020 年的研究). The English title stays behind the link.
		* A Chinese title is kept as it is.
		*/
		function sourceLabel(title) {
			const text = title.trim();
			if (!text) return "收录的研究";
			if (/[\u4e00-\u9fff]/.test(text) && !/[A-Za-z]{4,}(?:\s+[A-Za-z]{2,}){2,}/.test(text)) return text;
			const author = /^([A-Z][A-Za-z'’-]+)/.exec(text)?.[1] ?? "";
			const year = /\b(19\d{2}|20\d{2})\b/.exec(text)?.[1] ?? "";
			if (author && year) return `${author} 等，${year} 年的研究`;
			if (year) return `${year} 年的研究`;
			return author ? `${author} 等的研究` : "收录的研究";
		}
		/** Drop backend names from a sentence a person will read. */
		function scrubVisible(text) {
			let out = text;
			for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement);
			return out.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").trim();
		}
		JUDGEMENT.beyond, JUDGEMENT.within, JUDGEMENT.too_early, JUDGEMENT.not_comparable, JUDGEMENT.unjudged;
		//#endregion
		//#region src/client/overview-facts.ts
		/** Red-cell and iron markers: one doctor finding, whichever of them the record flagged. */
		const RED_CELL = [
			"hb",
			"hgb",
			"hct",
			"mcv",
			"mch",
			"mchc",
			"rbc",
			"rdw",
			"rdw_cv",
			"rdwcv",
			"ferritin",
			"iron"
		];
		const RED_CELL_LABEL = /(?<!糖化)血红蛋白|红细胞|血色素|铁蛋白|血清铁|MCV|MCH|RDW/i;
		const NOTHING_COVERED = {
			keys: /* @__PURE__ */ new Set(),
			labels: /* @__PURE__ */ new Set(),
			redCell: false
		};
		/** The markers 最重要的一步 already covers, when that card is on screen. */
		function coveredByCare(journey) {
			if (journey.next.action !== "doctor") return NOTHING_COVERED;
			const hits = journey.doctor_first?.hits ?? [];
			const keys = new Set(hits.map((hit) => hit.key));
			const labels = new Set(hits.map((hit) => hit.short_zh.split(/\s/)[0] ?? "").filter(Boolean));
			const redCell = hits.some((hit) => RED_CELL.includes(hit.key)) || /(?<!糖化)血红蛋白|红细胞|贫血|铁蛋白/.test(`${journey.next.title_zh}${journey.next.detail_zh}`);
			if (redCell) for (const key of RED_CELL) keys.add(key);
			return {
				keys,
				labels,
				redCell
			};
		}
		function isCovered(covered, row) {
			if (row.key && covered.keys.has(row.key)) return true;
			const label = row.label_zh ?? "";
			if (label && covered.labels.has(label)) return true;
			return covered.redCell && RED_CELL_LABEL.test(label);
		}
		//#endregion
		//#region src/client/changes.ts
		const h$32 = react.default.createElement;
		/** The trend, with the RCV band around the value it was compared from: points outside the band are the change. */
		function Spark(props) {
			const { row } = props;
			if (row.points.length < 2) return null;
			const base = row.compare.from;
			const dated = row.compare.from_date !== "";
			return h$32("div", { className: "lp-change-spark" }, h$32(LineChart, {
				points: row.points,
				unit: row.unit,
				label: row.label_zh,
				height: 56,
				compact: true,
				digits: 2,
				band: dated ? {
					low: base * (1 + row.band_pct.down / 100),
					high: base * (1 + row.band_pct.up / 100),
					from: row.compare.from_date
				} : null
			}));
		}
		const SUPERSCRIPT = {
			0: "⁰",
			1: "¹",
			2: "²",
			3: "³",
			4: "⁴",
			5: "⁵",
			6: "⁶",
			7: "⁷",
			8: "⁸",
			9: "⁹"
		};
		/** Count units as labs print them: 10^12/L → ×10¹²/L. */
		function prettyUnits(text) {
			return text.replace(/(×)?10\^(\d+)\/L/g, (_, _times, power) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join("")}/L`);
		}
		function toneOf(row) {
			return row.ask_doctor ? "warn" : row.verdict === "better" ? "good" : "neutral";
		}
		function groupsOf(rows) {
			const groups = [];
			for (const row of rows) {
				const found = groups.find((group) => group.advice === row.advice_zh && group.tone === toneOf(row));
				if (found) found.rows.push(row);
				else groups.push({
					advice: row.advice_zh,
					tone: toneOf(row),
					rows: [row]
				});
			}
			return groups;
		}
		function distinct(items, keyOf) {
			const seen = /* @__PURE__ */ new Set();
			return items.filter((item) => {
				const key = keyOf(item);
				if (!key || seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		}
		/** Rows shown on 概览; the rest are one tap away on 指标. */
		const NOTABLE = 3;
		const VERDICT_ZH = {
			better: "变好",
			worse: "变差",
			unclear: "需结合参考范围"
		};
		function ChangeChip(props) {
			const tone = props.verdict === "better" && !props.askDoctor ? "good" : props.verdict === "worse" || props.askDoctor ? "warn" : "neutral";
			return h$32("span", { className: `lp-chip-c lp-chip-c-${tone}` }, h$32(Icon, {
				name: tone === "good" ? "check" : tone === "warn" ? "warn" : "info",
				size: 12
			}), VERDICT_ZH[props.verdict]);
		}
		function decimals(value) {
			return (String(value).split(".")[1] ?? "").length;
		}
		/** Both ends with the same decimals, as a lab prints them: 4.2 → 3.0, not 4.2 → 3. */
		function pairText(from, to) {
			const digits = Math.min(2, Math.max(decimals(from), decimals(to)));
			return `${from.toFixed(digits)} → ${to.toFixed(digits)}`;
		}
		function NotableRow(props) {
			const { row } = props;
			return h$32("li", { className: "lp-notable-row" }, h$32(ChangeChip, {
				verdict: row.verdict,
				askDoctor: row.ask_doctor
			}), h$32("span", { className: "lp-strong" }, row.label_zh), h$32("span", { className: "lp-num lp-notable-values" }, `${row.compare.from === row.compare.to ? `${row.compare.to} ${prettyUnits(row.unit)}`.trim() : `${pairText(row.compare.from, row.compare.to)} ${prettyUnits(row.unit)}`.trim()}`), h$32(Spark, { row }));
		}
		/** The one plain sentence behind 判断依据 (INT062 fix 7): what "超出正常波动" means, and what it is not. */
		const BASIS_ZH = "“超出正常波动”是说两次结果的差别，比同一个人平常的起伏更大。不同医院、不同仪器之间的差别没有算进去，这也不是诊断。";
		/**
		* 判断依据: one plain sentence and where the fluctuation data comes from. Method notes (CV scales, instrument
		* error, how wide a band may be) are for the chat's tool text, not for this fold.
		*/
		function Basis(props) {
			const { rows } = props;
			const unjudged = props.journey.changes_unjudged;
			if (rows.length === 0 && unjudged.length === 0) return null;
			const sources = distinct(rows.map((row) => row.source), (source) => source.url || source.title);
			return h$32("details", { className: "lp-basis" }, h$32("summary", null, "判断依据"), h$32("div", { className: "lp-change-notes" }, h$32("p", { className: "lp-caption" }, BASIS_ZH), unjudged.length > 0 ? h$32("p", { className: "lp-caption" }, `这几项这次没有读全，先不判断：${unjudged.map((row) => row.label_zh).join("、")}。`) : null, sources.length > 0 ? h$32("p", { className: "lp-caption lp-change-source" }, "数据来源：", ...sources.flatMap((source, index) => [index > 0 ? "；" : null, source.url ? h$32("a", {
				key: source.url,
				href: source.url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: source.title || void 0
			}, sourceLabel(source.title)) : sourceLabel(source.title)])) : null));
		}
		/**
		* 值得注意的变化 on 概览: at most three rows (a doctor's first), the advice
		* said once per group, and a link to 指标 for the rest. The server decides
		* which rows qualify and writes every sentence; nothing here names a cause.
		*/
		function NotableChanges(props) {
			const rows = props.journey.changes;
			if (rows.length === 0 && props.journey.changes_unjudged.length === 0) return null;
			const covered = props.covered ?? NOTHING_COVERED;
			const onCard = rows.filter((row) => isCovered(covered, row));
			const shown = rows.filter((row) => !isCovered(covered, row)).slice(0, NOTABLE);
			const advice = groupsOf(shown).filter((group) => group.advice && group.tone === "warn");
			const pointer = onCard.length > 0 ? `${onCard[0]?.label_zh ?? ""}${onCard.length > 1 ? `等 ${onCard.length} 项` : ""}的变化，就是上面「最重要的一步」说的那件事。` : "";
			return h$32("section", {
				className: "lp-card lp-notable",
				id: "lp-changes",
				"aria-labelledby": "lp-changes-title"
			}, h$32("div", { className: "lp-card-head" }, h$32("div", {
				className: "lp-label",
				id: "lp-changes-title"
			}, "值得注意的变化", rows.length > 0 ? h$32("span", { className: "lp-optional" }, `${rows.length} 项超出正常波动`) : null), h$32("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.onOpenIndicators
			}, "在「化验」里看全部 →")), pointer ? h$32("p", { className: "lp-caption lp-notable-pointer" }, pointer) : null, ...advice.map((group) => h$32("p", {
				key: group.advice,
				className: "lp-change-advice lp-change-warn"
			}, h$32(Icon, {
				name: "warn",
				size: 14
			}), h$32("span", null, group.advice))), shown.length > 0 ? h$32("ul", { className: "lp-notable-list" }, ...shown.map((row) => h$32(NotableRow, {
				key: row.key,
				row
			}))) : pointer ? null : h$32("p", { className: "lp-muted" }, "没有超出正常波动的变化。"), h$32(Basis, {
				journey: props.journey,
				rows
			}));
		}
		//#endregion
		//#region src/client/indicators.ts
		const h$31 = react.default.createElement;
		const SOURCE_ZH = {
			checkup: "体检",
			device: "手环",
			self: "自测"
		};
		/** The chip already says 太早. The caption keeps the rest of the sentence once, never a second 太早 or a noise line. */
		function reasonBesideChip(gate, reason) {
			const text = (reason ?? "").trim();
			if (!text) return "";
			if (gate === "too_early" || text.startsWith("太早")) return text.replace(/^太早[：:]?\s*/, "");
			return text;
		}
		function noiseSentence(detail) {
			const { row, biovar } = detail;
			if (!biovar) return null;
			const tooEarly = row.gate === "too_early" || (row.reason_zh ?? "").startsWith("太早");
			const beyond = row.judged === "changed";
			if (tooEarly || beyond) return null;
			return `正常波动：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（个体内变异 ${fmt(biovar.cvi_pct, 1)}%）。两次结果之差在这个范围内，多半是测量和生理波动。`;
		}
		const FILTERS = [
			{
				key: "all",
				label: "全部",
				test: () => true
			},
			{
				key: "changed",
				label: "有变化",
				test: (row) => row.judged === "changed"
			},
			{
				key: "plan",
				label: "方案相关",
				test: (row) => row.plan_marker
			},
			{
				key: "device",
				label: "手环",
				test: (row) => row.source === "device"
			}
		];
		/** A trend in 88 × 24: the line and the latest point, no axes (the panel has the full chart). */
		function Sparkline(props) {
			const points = props.points;
			if (points.length < 2) return h$31("span", {
				className: "lp-spark-none",
				"aria-hidden": true
			}, points.length === 1 ? "仅 1 次" : "");
			const width = 88;
			const height = 24;
			const values = points.map((point) => point.value);
			const min = Math.min(...values);
			const max = Math.max(...values);
			const span = max - min || Math.abs(max) * .1 || 1;
			const x = (index) => 3 + index / (points.length - 1) * 82;
			const y = (value) => 21 - (value - min) / span * 18;
			const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join("");
			const last = points.at(-1);
			return h$31("svg", {
				width,
				height,
				className: "lp-spark",
				role: "img",
				"aria-label": `${props.label}趋势：${points.map((point) => `${point.date} ${fmtAuto(point.value)}`).join("，")}`
			}, h$31("path", {
				d: path,
				className: "lp-spark-line"
			}), h$31("circle", {
				cx: x(points.length - 1),
				cy: y(last.value),
				r: 2.5,
				className: "lp-spark-dot"
			}));
		}
		function latestText(row) {
			if (!row.latest) return "—";
			if (row.latest.text) return row.latest.text;
			return row.latest.value == null ? "—" : fmtAuto(row.latest.value);
		}
		function IndicatorLine(props) {
			const { row } = props;
			const panelId = `lp-ind-panel-${row.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
			const move = movementOf(row.points, prettyUnits(row.unit));
			const kind = judgementKind({
				gate: props.gate,
				judged: row.judged,
				reason: props.reason
			});
			const missed = row.read_error ? scrubVisible(row.read_error).replace(/没有在 \d+ 秒内返回这一项/, "这次没有读到，稍后刷新再看") : "";
			const lead = missed ? `没有读到：${missed}` : move?.lead ?? (row.latest ? `${latestText(row)} ${prettyUnits(row.unit)}` : "还没有数值");
			return h$31("li", { className: `lp-ind-row ${props.open ? "lp-ind-open" : ""} ${row.read_error ? "lp-ind-failed" : ""}` }, h$31("button", {
				type: "button",
				className: "lp-ind-btn lp-move-btn",
				"aria-expanded": props.open,
				"aria-controls": panelId,
				onClick: props.onToggle
			}, h$31("span", { className: "lp-move" }, h$31("span", { className: "lp-ind-name" }, h$31("span", { className: "lp-strong" }, row.label_zh), row.plan_marker ? h$31("span", { className: "lp-tag lp-tag-plan" }, "方案") : null, h$31("span", { className: "lp-caption" }, SOURCE_ZH[row.source])), h$31("span", { className: "lp-move-lead" }, lead), h$31("span", { className: "lp-move-second" }, judgementText(kind, props.explain)), row.range_zh ? h$31("span", { className: "lp-caption" }, `化验单上的范围：${row.range_zh}`) : null), row.read_error ? null : h$31("span", { className: "lp-ind-spark" }, h$31(Sparkline, {
				points: row.points,
				label: row.label_zh
			})), h$31(Icon, {
				name: "chevron",
				size: 14,
				className: "lp-ind-chevron"
			})), props.open ? h$31(DetailPanel, {
				row,
				id: panelId
			}) : null);
		}
		function DetailPanel(props) {
			const [state, setState] = react.default.useState({
				detail: null,
				error: null,
				loading: true
			});
			const [attempt, setAttempt] = react.default.useState(0);
			react.default.useEffect(() => {
				let live = true;
				setState((current) => ({
					...current,
					loading: true,
					error: null
				}));
				getJson(`/api/longpi/indicators/detail?id=${encodeURIComponent(props.row.id)}`).then((raw) => {
					if (live) setState({
						detail: normalizeIndicatorDetail(raw),
						error: null,
						loading: false
					});
				}).catch((err) => {
					if (live) setState({
						detail: null,
						error: errorText(err, "请稍后再试"),
						loading: false
					});
				});
				return () => {
					live = false;
				};
			}, [props.row.id, attempt]);
			const body = state.loading && !state.detail ? h$31(Skeleton, { height: 120 }) : !state.detail ? h$31(LoadError, {
				what: `${props.row.label_zh}的历次数值`,
				error: state.error,
				compact: true,
				onRetry: () => setAttempt((count) => count + 1)
			}) : h$31(DetailBody, { detail: state.detail });
			return h$31("div", {
				className: "lp-ind-panel",
				id: props.id,
				role: "region",
				"aria-label": `${props.row.label_zh}详情`
			}, body);
		}
		function DetailBody(props) {
			const { row, all_points: points, biovar } = props.detail;
			const numeric = points.filter((point) => point.value != null);
			const digits = Math.max(...numeric.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
			const units = [...new Set(points.map((point) => point.unit).filter(Boolean))];
			return h$31("div", { className: "lp-ind-detail" }, row.read_error ? h$31("p", { className: "lp-blocker lp-blocker-bad" }, `这项这次没有读到：${row.read_error}。下面是能读到的部分。`) : null, row.change?.text_zh ? h$31("p", { className: "lp-muted" }, prettyUnits(row.change.text_zh)) : null, numeric.length > 1 && units.length <= 1 ? h$31(LineChart, {
				points: numeric.map((point) => ({
					date: point.date,
					value: point.value
				})),
				unit: prettyUnits(units[0] ?? row.unit),
				label: row.label_zh,
				height: 150,
				digits
			}) : null, row.range_zh ? h$31("p", { className: "lp-caption" }, row.range_zh) : null, noiseSentence(props.detail) ? h$31("p", { className: "lp-caption" }, noiseSentence(props.detail), biovar?.source.url ? h$31(react.default.Fragment, null, " 来源：", h$31("a", {
				href: biovar.source.url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: biovar.source.title || void 0
			}, sourceLabel(biovar.source.title))) : biovar?.source.title ? ` 来源：${sourceLabel(biovar.source.title)}` : "", biovar?.source.doi ? ` · doi:${biovar.source.doi}` : "") : biovar && (row.gate === "too_early" || (row.reason_zh ?? "").startsWith("太早")) ? h$31("p", { className: "lp-caption" }, reasonBesideChip(row.gate, row.reason_zh) || "间隔还没到这项的最短复测时间。") : biovar && row.judged === "changed" ? h$31("p", { className: "lp-caption" }, "两次结果之差超出了上面的正常波动范围。") : h$31("p", { className: "lp-caption" }, row.range_zh ? "这项没有用来比较两次变化的波动数据。上面按参考范围标了偏低或偏高。" : row.source === "checkup" ? "这项没有收录个体正常波动数据，分不清真实变化和波动，所以不作判断。" : "手环和自测数据按周均值或日值显示趋势，不作正常波动判断。"), biovar ? h$31("p", { className: "lp-caption" }, `研究里用来判断变化的范围：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（来源：${sourceLabel(biovar.source.title)}）`) : null, biovar?.caveat_zh && !row.gate ? h$31("p", { className: "lp-caption" }, biovar.caveat_zh) : null, points.length > 0 ? h$31("table", { className: "lp-ind-table" }, h$31("caption", { className: "lp-sr" }, `${row.label_zh}历次数值`), h$31("thead", null, h$31("tr", null, ...[
				"日期",
				"数值",
				"单位",
				"来自"
			].map((cell) => h$31("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$31("tbody", null, ...[...points].reverse().map((point, index) => h$31("tr", { key: `${point.date}-${index}` }, h$31("td", null, point.date), h$31("td", { className: "lp-num" }, point.text ?? (point.value == null ? "—" : fmt(point.value, digits))), h$31("td", null, prettyUnits(point.unit)), h$31("td", { className: "lp-caption" }, point.file ?? SOURCE_ZH[row.source]))))) : h$31("p", { className: "lp-muted" }, "没有可显示的数值。"), numeric.length > 1 && units.length > 1 ? h$31(TableTwin, {
				caption: row.label_zh,
				head: ["日期", "数值"],
				rows: numeric.map((point) => [point.date, `${fmt(point.value, digits)} ${point.unit}`])
			}) : null);
		}
		function Loading$1() {
			return h$31("div", {
				className: "lp-tab-body",
				"aria-busy": true,
				"aria-label": "正在读取指标"
			}, h$31(Skeleton, {
				height: 32,
				width: 320
			}), h$31("div", { className: "lp-card" }, ...[
				0,
				1,
				2,
				3,
				4
			].map((index) => h$31(Skeleton, {
				key: index,
				height: 28,
				className: "lp-ind-skeleton"
			}))));
		}
		function Empty(props) {
			const none = props.data.record.status === "none";
			return h$31("div", { className: "lp-card lp-empty" }, h$31(Icon, {
				name: "flask",
				size: 18
			}), h$31("div", null, h$31("div", { className: "lp-strong" }, none ? "还没有连接体检记录" : "记录里还没有指标"), h$31("p", { className: "lp-muted" }, none ? "把体检报告放进来之后，这里会列出每一次化验和手环数据，先看变化，再看这点变化算不算数。" : "已经连上了，但还没有读到体检或手环数据。放进报告后，点右上角的刷新。"), none ? h$31(Btn, {
				size: "sm",
				onClick: props.onConnect
			}, "连接记录") : null));
		}
		function lastCheckup(data) {
			let last = null;
			for (const group of data.groups) for (const row of group.indicators) if (row.source === "checkup" && row.latest && (!last || row.latest.date > last)) last = row.latest.date;
			return last;
		}
		/** gate and reason_zh are not in the normalised row; the page reads them from the same response. */
		function useGates(stamp) {
			const [gates, setGates] = react.default.useState({});
			react.default.useEffect(() => {
				let live = true;
				getJson("/api/longpi/indicators").then((raw) => {
					if (!live || !raw || typeof raw !== "object") return;
					const groups = raw.groups;
					if (!Array.isArray(groups)) return;
					const next = {};
					for (const group of groups) {
						const indicators = group && typeof group === "object" ? group.indicators : void 0;
						if (!Array.isArray(indicators)) continue;
						for (const row of indicators) {
							if (!row || typeof row !== "object") continue;
							const item = row;
							if (typeof item.id !== "string") continue;
							if (typeof item.gate === "string" || typeof item.reason_zh === "string") next[item.id] = {
								...typeof item.gate === "string" ? { gate: item.gate } : {},
								...typeof item.reason_zh === "string" ? { reason: item.reason_zh } : {}
							};
						}
					}
					setGates(next);
				}).catch(() => {
					if (live) setGates({});
				});
				return () => {
					live = false;
				};
			}, [stamp]);
			return gates;
		}
		function IndicatorsTab(props) {
			const { data, loading, error } = useIndicators();
			const gates = useGates(data?.updated_at);
			const [open, setOpen] = react.default.useState(null);
			if (!data && loading) return h$31(Loading$1);
			if (!data) return h$31("div", { className: "lp-tab-body" }, h$31(LoadError, {
				what: "指标",
				error,
				onRetry: () => reload("indicators")
			}));
			if (data.groups.length === 0) {
				if (data.record.status === "error") return h$31("div", { className: "lp-tab-body" }, h$31(LoadError, {
					what: "体检记录",
					error: data.record.error || null,
					onRetry: () => reload("indicators")
				}));
				return h$31("div", { className: "lp-tab-body" }, h$31(Empty, {
					data,
					onConnect: props.onConnect
				}));
			}
			const area = props.area ?? "labs";
			const all = data.groups.flatMap((group) => group.indicators).filter((row) => lifeAreaOf(row.label_zh) === area || area === "labs" && row.source !== "device");
			const explained = /* @__PURE__ */ new Set();
			const filter = FILTERS.find((row) => row.key === props.filter) ?? FILTERS[0];
			const groups = data.groups.map((group) => ({
				...group,
				indicators: group.indicators.filter((row) => all.includes(row)).filter(filter.test)
			})).filter((group) => group.indicators.length > 0);
			const failed = all.filter((row) => row.read_error).length;
			const checkup = lastCheckup(data);
			return h$31("div", { className: "lp-tab-body lp-indicators" }, data.record.status === "partial" || data.record.status === "error" ? h$31("p", {
				className: "lp-blocker lp-blocker-bad lp-partial",
				role: "note"
			}, h$31(Icon, {
				name: "warn",
				size: 14
			}), h$31("span", null, `有一部分记录这次没有读到${data.record.error ? `：${data.record.error}` : failed > 0 ? `（${failed} 项）` : ""}。标着“没有读到”的指标不是没测，稍后刷新再读。`)) : null, h$31("div", { className: "lp-ind-toolbar" }, h$31("div", {
				className: "lp-ind-filters",
				role: "group",
				"aria-label": "筛选指标"
			}, ...FILTERS.map((row) => {
				const count = all.filter(row.test).length;
				return h$31("button", {
					key: row.key,
					type: "button",
					className: `lp-toggle ${props.filter === row.key ? "lp-toggle-on" : ""}`,
					"aria-pressed": props.filter === row.key,
					onClick: () => props.onFilter(row.key)
				}, row.label, h$31("span", { className: "lp-toggle-count" }, String(count)));
			})), h$31("span", { className: "lp-caption" }, (() => {
				const when = checkup ? chineseDate(checkup) : "";
				return when ? `最近一次体检 ${when}` : "";
			})(), h$31(Info, {
				label: "和正常波动比",
				align: "end"
			}, "超出正常波动：比你平常的起伏更大，值得问医生，不是急症。在正常波动范围内：这点变化不算数。太早：离上次太近。不可比：两次不是同一家机构。还不能下结论：看缺的是哪一步。"))), groups.length === 0 ? h$31("div", { className: "lp-card lp-empty" }, h$31("p", { className: "lp-muted" }, `没有“${filter.label}”的指标。`), h$31("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => props.onFilter("all")
			}, "看全部 →")) : h$31("div", { className: "lp-card lp-ind-card" }, h$31("div", {
				className: "lp-ind-head",
				"aria-hidden": true
			}, h$31("span", null, "指标"), h$31("span", null, "最近一次"), h$31("span", null, "趋势"), h$31("span", null, "和正常波动比"), h$31("span", null, "来源")), ...groups.map((group) => h$31("section", {
				key: group.key,
				className: "lp-ind-group",
				"aria-label": group.label_zh
			}, h$31("h3", { className: "lp-ind-group-title" }, group.label_zh, h$31("span", { className: "lp-optional" }, `${group.indicators.length} 项`)), h$31("ul", { className: "lp-ind-list" }, ...group.indicators.map((row) => {
				const kind = judgementKind({
					gate: row.gate ?? gates[row.id]?.gate,
					judged: row.judged,
					reason: row.reason_zh ?? gates[row.id]?.reason
				});
				const explain = !explained.has(kind);
				explained.add(kind);
				return h$31(IndicatorLine, {
					key: row.id,
					row,
					open: open === row.id,
					gate: row.gate ?? gates[row.id]?.gate,
					reason: row.reason_zh ?? gates[row.id]?.reason,
					explain,
					onToggle: () => setOpen((current) => current === row.id ? null : row.id)
				});
			}))))), h$31("p", { className: "lp-fine" }, "点任一行看历次数值、单位、来自哪份报告，以及正常波动的依据。这里只列出记录里的数值，不做诊断。"));
		}
		//#endregion
		//#region src/honesty/format.ts
		function trimZeros(text) {
			if (!text.includes(".")) return text;
			return text.replace(/\.?0+$/, "");
		}
		/** Digits for a magnitude: percentages stay short; labs keep the decimals a report would print. */
		function digitsFor(value, unit) {
			const abs = Math.abs(value);
			if (unit === "%" || unit === "％") return abs >= 10 ? 0 : 1;
			if (unit === "岁" || unit === "年") return Number.isInteger(value) ? 0 : 1;
			if (abs >= 100) return abs >= 1e3 || Number.isInteger(value) ? 0 : 1;
			if (abs >= 10) return 1;
			return 2;
		}
		/**
		* The formatted form of one number, with its unit when it has one.
		* 6.58 mmol/L stays 6.58; 0.096373…% becomes 0.1%; 40.8 岁 stays 40.8 岁.
		*/
		function formatNumber(ref) {
			const value = ref.value;
			if (typeof value !== "number" || !Number.isFinite(value)) return "";
			const unit = (ref.unit ?? "").trim();
			const text = trimZeros(value.toFixed(digitsFor(value, unit)));
			return unit ? `${text} ${unit}` : text;
		}
		//#endregion
		//#region src/honesty/model-range.ts
		/** Keys the risk card, the skill name and the short model id all hit. */
		const RANGES = {
			"china-par": {
				low: 35,
				high: 74,
				name: "China-PAR"
			},
			china_par: {
				low: 35,
				high: 74,
				name: "China-PAR"
			},
			"china-par-ascvd-risk": {
				low: 35,
				high: 74,
				name: "China-PAR"
			}
		};
		/**
		* A sentence when `age` is outside the model's derivation range, or null when
		* the age is inside it (or the model has no published range here).
		*/
		function modelRangeNote(model, age) {
			if (age == null || !Number.isFinite(age)) return null;
			const row = RANGES[model.trim().toLowerCase()];
			if (!row) return null;
			if (age >= row.low && age <= row.high) return null;
			const years = formatNumber({
				value: age,
				unit: "岁"
			});
			return `${row.name} 由 ${row.low}–${row.high} 岁人群推导，${years}在这个范围之外，结果更不确定。`;
		}
		//#endregion
		//#region src/client/registry.ts
		const tabs = [];
		const overview = [];
		const toolViews = [];
		const settings = [];
		const profile = [];
		function add(list, row) {
			list.push(row);
			return () => {
				const at = list.indexOf(row);
				if (at >= 0) list.splice(at, 1);
			};
		}
		const byOrder = (list) => [...list].sort((a, b) => a.order - b.order);
		const registerPageTab = (tab) => add(tabs, tab);
		const registerOverviewCard = (card) => add(overview, card);
		const registerToolView = (view) => add(toolViews, view);
		const registerSettingsSection = (section) => add(settings, section);
		const registerProfileSection = (section) => add(profile, section);
		const pageTabs = () => byOrder(tabs);
		const toolViewList = () => [...toolViews];
		const settingsSections = () => byOrder(settings);
		const profileSections = () => byOrder(profile);
		//#endregion
		//#region src/feedback/share.ts
		function shareCard(messages) {
			const bio = messages.find((row) => row.subject.kind === "bioage" && row.allowed_claims.includes("younger"));
			const wins = messages.filter((row) => row.grade === "beyond_band_better" && row.tone === "celebrate" && row.subject.kind === "marker" && row.subject.key !== "panel");
			if (!bio && wins.length === 0) return null;
			const lines = wins.map((row) => row.headline_zh);
			if (bio) return {
				id: "fb-share",
				title_zh: "可以分享的一句话",
				headline_zh: bio.headline_zh,
				lines_zh: lines,
				footnote_zh: "超出了测量波动，是真实的变化。同一家实验室、间隔够了才这么说。这不是诊断。"
			};
			return {
				id: "fb-share",
				title_zh: "可以分享的一句话",
				headline_zh: messages.find((row) => row.id === "fb-summary" && row.grade === "beyond_band_better")?.headline_zh ?? wins[0]?.headline_zh ?? "",
				lines_zh: lines,
				footnote_zh: "超出了测量波动，是真实的变化。这不是诊断，也不是“多活几年”。"
			};
		}
		function shareText(card) {
			return [
				card.headline_zh,
				...card.lines_zh,
				card.footnote_zh
			].filter(Boolean).join("\n");
		}
		//#endregion
		//#region src/client/feedback/feedback-card.ts
		const h$30 = react.default.createElement;
		function retestLine(retest) {
			if (retest.why_zh.includes("复测已在")) return retest.why_zh;
			return `建议复测：${retest.earliest} 至 ${retest.recommended}。${retest.why_zh}`;
		}
		function FeedbackCard(props) {
			if (props.messages.length === 0) return null;
			return h$30("section", {
				className: "lp-card",
				id: "lp-feedback",
				"aria-label": "这次的变化"
			}, h$30("div", { className: "lp-label" }, "这次的变化"), ...props.messages.map((row) => h$30("div", { key: row.id }, h$30("p", { className: row.tone === "celebrate" ? "lp-strong" : "lp-muted" }, row.headline_zh), row.body_zh ? h$30("p", { className: "lp-caption" }, row.body_zh) : null, row.retest ? h$30("p", { className: "lp-fine" }, retestLine(row.retest)) : null)));
		}
		//#endregion
		//#region src/client/feedback/share-card.ts
		const h$29 = react.default.createElement;
		function ShareCard(props) {
			const text = shareText(props.card);
			const copy = () => {
				const clip = navigator.clipboard;
				if (!clip) {
					props.onNotice?.("请手动选择这句话", "info");
					return;
				}
				clip.writeText(text).then(() => props.onNotice?.("已复制", "good")).catch(() => props.onNotice?.("请手动选择这句话", "info"));
			};
			return h$29("section", {
				className: "lp-card",
				id: "lp-share",
				"aria-label": props.card.title_zh
			}, h$29("div", { className: "lp-label" }, props.card.title_zh), h$29("p", { className: "lp-strong" }, props.card.headline_zh), ...props.card.lines_zh.map((line) => h$29("p", {
				key: line,
				className: "lp-caption"
			}, line)), h$29("p", { className: "lp-fine" }, props.card.footnote_zh), h$29("div", { className: "lp-result-action" }, h$29(Btn, {
				size: "sm",
				variant: "outline",
				onClick: copy
			}, "复制这句话")));
		}
		//#endregion
		//#region src/client/feedback/index.ts
		const h$28 = react.default.createElement;
		/** recordChanges false: leave out markers that only come from record changes (总览 shows those once, elsewhere). */
		function feedbackInputOf(journey, tracking, opts = {}) {
			const markers = [];
			const seen = /* @__PURE__ */ new Set();
			for (const item of tracking?.items ?? []) for (const verdict of item.verdicts ?? []) {
				const row = markerFromEngine(verdict, verdict.indicator || verdict.marker);
				if (seen.has(row.label_zh)) continue;
				seen.add(row.label_zh);
				markers.push(row);
			}
			for (const change of opts.recordChanges === false ? [] : journey.changes ?? []) {
				if (seen.has(change.label_zh) || seen.has(change.key)) continue;
				seen.add(change.label_zh);
				markers.push(markerFromChange(change));
			}
			const loose = tracking?.bioage;
			const points = loose?.points ?? [];
			const result = journey.results.bioage;
			const bio = {
				points,
				band_years: loose?.band_years ?? result.band_years,
				band_verified: loose?.band_verified === true,
				age: journey.profile.age,
				phenoage: points.at(-1)?.phenoage ?? result.phenoage,
				advance: points.at(-1)?.advance ?? result.advance,
				date: points.at(-1)?.date ?? result.date,
				draws: points.length > 0 ? points.length : result.checkups,
				same_lab: null,
				...bioAgeStory(result.headline_zh, result.allows_younger)
			};
			const behaviours = (journey.plan.checkin_items ?? []).filter((item) => item.done_today === true).map((item) => ({
				key: item.id,
				title_zh: item.title,
				date: journey.today
			}));
			const projections = ((tracking?.models?.find((card) => card.model === "phenoage"))?.levers ?? []).slice(0, 4).map((row) => ({
				label_zh: row.label,
				from_zh: row.from,
				target_zh: row.to,
				years: row.years
			}));
			return {
				today: journey.today,
				markers,
				bioage: result.status === "ok" || points.length > 0 ? bio : null,
				behaviours,
				projections
			};
		}
		function messagesFor(journey, tracking, opts = {}) {
			return buildFeedback(feedbackInputOf(journey, tracking, opts));
		}
		function FeedbackBlock(props) {
			if (!props.journey) return null;
			const messages = messagesFor(props.journey, props.tracking ?? null, { recordChanges: props.recordChanges });
			const summary = messages.find((row) => row.id === "fb-summary");
			const behaviour = messages.find((row) => row.grade === "behaviour_done");
			const projection = messages.find((row) => row.grade === "projection");
			const share = shareCard(messages);
			const shown = [
				summary,
				behaviour,
				projection
			].filter((row) => row != null);
			if (shown.length === 0 && !share) return null;
			return h$28(react.default.Fragment, null, shown.length > 0 ? h$28(FeedbackCard, { messages: shown }) : null, share ? h$28(ShareCard, {
				card: share,
				onNotice: props.onNotice
			}) : null);
		}
		registerOverviewCard({
			id: "feedback",
			order: 25,
			Component: FeedbackBlock
		});
		//#endregion
		//#region src/client/results.ts
		const h$27 = react.default.createElement;
		/** More than this and the chips crowd the card; the action below lists the rest. */
		const NEEDS_SHOWN = 4;
		function EstimateTag() {
			return h$27("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计");
		}
		function labelText(label) {
			if (label === "verified") return "数据对得上";
			if (label === "unverified-binding") return "还没对上，先别当成你的结果";
			return "这是研究里的说法，不是用你的体检算的";
		}
		function LabelTag(props) {
			return h$27("span", {
				className: "lp-tag",
				"data-result-label": props.label
			}, labelText(props.label));
		}
		function CardHead(props) {
			return h$27("div", { className: "lp-result-head" }, h$27("div", { className: "lp-label" }, props.label, h$27(Info, { label: props.label }, props.info)), h$27("span", { className: "lp-result-tags" }, props.estimate === false ? null : h$27(EstimateTag), props.mark ? h$27(LabelTag, { label: props.mark }) : null));
		}
		function bioageAction(journey) {
			const bio = journey.results.bioage;
			if (bio.blocker_zh.includes("方法库")) return null;
			if (journey.profile.age == null) return {
				label: "填写年龄",
				target: "profile"
			};
			if (!recordConnected(journey.records.status)) return {
				label: "连接记录",
				target: "records"
			};
			if (bio.missing.length > 0 || journey.addons.some((row) => row.unlocks_zh.includes("身体年龄"))) return {
				label: "查看加测清单",
				target: "addons"
			};
			return null;
		}
		function riskAction(journey) {
			const risk = journey.results.risk;
			if (journey.profile.age == null || journey.profile.sex !== "male" && journey.profile.sex !== "female" || risk.missing_facts.length > 0) return {
				label: `回答 ${Math.max(1, risk.missing_facts.length + (journey.profile.age == null ? 1 : 0) + (journey.profile.sex !== "male" && journey.profile.sex !== "female" ? 1 : 0))} 个问题`,
				target: "profile"
			};
			if (!recordConnected(journey.records.status)) return {
				label: "连接记录",
				target: "records"
			};
			if (risk.missing_labs.length > 0) return {
				label: "查看加测清单",
				target: "addons"
			};
			return null;
		}
		function riskSelfAddon(journey) {
			return journey.addons.find((row) => row.self_measurable && row.self_key && row.unlocks_zh.includes("心血管"));
		}
		function Blocked(props) {
			const action = props.action;
			return h$27("div", { className: "lp-card lp-result lp-result-blocked" }, h$27(CardHead, {
				label: props.label,
				info: props.info
			}), h$27("div", { className: "lp-result-wait" }, "还不能计算"), h$27("p", { className: "lp-blocker" }, props.blocker || "还缺少计算需要的信息。"), props.needs.length > 0 ? h$27("div", { className: "lp-needs" }, h$27("span", { className: "lp-caption" }, "还需要"), ...props.needs.slice(0, NEEDS_SHOWN).map((need) => h$27("span", {
				className: "lp-need",
				key: need
			}, need)), props.needs.length > NEEDS_SHOWN ? h$27("span", { className: "lp-caption" }, `等 ${props.needs.length} 项`) : null) : null, props.selfAddon && props.selfAddon.self_key && action?.target !== "profile" && action?.target !== "records" ? h$27("div", { className: "lp-result-self" }, h$27("div", { className: "lp-caption" }, `${props.selfAddon.item_zh}可以自己在家量，记下就能算：`), h$27(InlineSelf, {
				journey: props.journey,
				selfKey: props.selfAddon.self_key,
				idPrefix: `${props.idPrefix}-self`,
				onNotice: props.onNotice
			})) : action ? h$27("div", { className: "lp-result-action" }, h$27(Btn, {
				size: "sm",
				variant: "outline",
				onClick: () => props.onAction(action.target)
			}, action.label, h$27(Icon, {
				name: "arrow",
				size: 14
			}))) : null);
		}
		function BodyAgeCard(props) {
			const result = props.journey.results.bioage;
			if (result.status !== "ok") return h$27(Blocked, {
				journey: props.journey,
				label: "身体年龄",
				info: BIOAGE_INFO,
				blocker: result.blocker_zh,
				needs: result.missing,
				action: bioageAction(props.journey),
				onAction: props.onAction,
				onNotice: props.onNotice,
				idPrefix: "lp-bio"
			});
			const bio = props.tracking?.bioage;
			const points = (bio?.points ?? []).filter((row) => Number.isFinite(row.phenoage));
			const latest = points.at(-1);
			const first = points[0];
			const phenoage = latest?.phenoage ?? result.phenoage;
			const band = bio?.band_years ?? result.band_years;
			const date = latest?.date ?? result.date;
			const count = points.length || result.checkups;
			const partial = (bio?.band_missing ?? []).length > 0;
			const graded = messagesFor(props.journey, props.tracking).find((row) => row.subject.kind === "bioage");
			const verified = !props.method || props.method.label === "verified";
			const concernLine = /不一定是好事/.test(result.headline_zh ?? "") || /不一定是好事/.test(graded?.headline_zh ?? "");
			const younger = !concernLine && verified && allowsYoungerClaim("verified", graded?.allowed_claims);
			const drivers = redCellDriverNames(props.journey.changes ?? []);
			const older = phenoage != null && (latest?.advance ?? result.advance) != null ? olderThanAgeSentence({
				phenoage,
				advance: latest?.advance ?? result.advance,
				drivers
			}) : null;
			const binding = props.method && props.method.label === "unverified-binding" ? resultSentence(props.method, { youngerAllowed: false }) : "";
			const gradedText = concernLine ? result.headline_zh || graded?.headline_zh || "" : graded ? younger ? graded.headline_zh : stripYoungerClaim(graded.headline_zh) : "";
			const caption = older ? [
				older,
				younger && graded ? graded.headline_zh : "",
				binding
			].filter(Boolean).join("") : [binding, gradedText].filter(Boolean).join("");
			const info = h$27(react.default.Fragment, null, h$27("span", { className: "lp-info-line" }, BIOAGE_INFO), band != null ? h$27("span", { className: "lp-info-line" }, `浅色带是第一次检查的个体正常波动（±${fmt(band)} 岁${partial ? `，未含${bio?.band_missing?.join("、")}` : ""}），落在带外才算真实变化。`) : null, date ? h$27("span", { className: "lp-info-line" }, `最近一次：${chineseDate(date)}体检，共 ${count} 次完整血检。`) : null);
			return h$27("div", {
				className: "lp-card lp-result",
				...props.method ? { "data-result-label": props.method.label } : {}
			}, h$27(CardHead, {
				label: "身体年龄",
				info,
				mark: props.method?.label ?? null
			}), h$27("div", { className: "lp-result-figure" }, h$27("span", { className: "lp-bignum" }, fmt(phenoage)), h$27("span", { className: "lp-bignum-unit" }, "岁"), younger ? h$27("span", { className: "lp-pill lp-pill-good" }, "真实的变化") : null), !older && versusCalendarAge(result.advance) ? h$27("p", { className: "lp-caption lp-bioage-gap" }, versusCalendarAge(result.advance)) : null, result.caveat_zh && !concernLine ? h$27("p", {
				className: "lp-caveat",
				role: "note"
			}, h$27(Icon, {
				name: "warn",
				size: 14
			}), h$27("span", null, result.caveat_zh)) : null, points.length > 1 ? h$27(LineChart, {
				points: points.filter((row) => row.advance != null).map((row) => ({
					date: row.date,
					value: row.advance
				})),
				unit: "岁",
				label: "身体年龄减周岁",
				height: 96,
				compact: true,
				band: band != null && first?.advance != null ? {
					low: first.advance - band,
					high: first.advance + band,
					from: first.date
				} : null,
				reference: {
					value: 0,
					label: "持平"
				}
			}) : props.tracking == null ? h$27(Skeleton, { height: 40 }) : null, caption ? h$27("p", {
				className: "lp-caption lp-method-sentence",
				id: "lp-bioage-feedback"
			}, caption) : null, h$27(KeyTrends, {
				journey: props.journey,
				older: (latest?.advance ?? result.advance ?? 0) > 0,
				covered: props.covered
			}), h$27("p", { className: "lp-fine" }, [count > 0 ? `${count} 次体检` : "", points.length > 1 && band != null ? "浅色带为正常波动（这点变化不算数）" : ""].filter(Boolean).join(" · ")));
		}
		function KeyTrends(props) {
			const covered = props.covered ?? NOTHING_COVERED;
			const trends = pickKeyTrends((props.journey.changes ?? []).filter((row) => !isCovered(covered, row)), props.older);
			if (trends.length === 0) return null;
			return h$27("div", { className: "lp-trends" }, h$27("div", { className: "lp-caption" }, "旁边的变化"), h$27("ul", { "aria-label": "旁边的变化" }, ...trends.map((row) => h$27("li", { key: row.label_zh }, h$27("span", { className: "lp-strong" }, row.label_zh), h$27("span", { className: "lp-caption" }, ` ${row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() : row.text_zh}`)))));
		}
		function rangeCaption(age) {
			const text = modelRangeNote("china-par", age);
			return text ? h$27("p", {
				className: "lp-caption",
				id: "lp-risk-range"
			}, text) : null;
		}
		function RiskCard(props) {
			const result = props.journey.results.risk;
			const range = rangeCaption(props.journey.profile.age);
			if (result.status !== "ok") {
				const needs = [...result.missing_facts, ...result.missing_labs];
				return h$27(react.default.Fragment, null, h$27(Blocked, {
					journey: props.journey,
					label: "10 年心血管风险",
					info: RISK_INFO,
					blocker: result.blocker_zh,
					needs,
					action: riskAction(props.journey),
					selfAddon: riskSelfAddon(props.journey),
					onAction: props.onAction,
					onNotice: props.onNotice,
					idPrefix: "lp-risk"
				}), range);
			}
			const card = props.tracking?.models?.find((row) => row.model === "china-par");
			const goal = card?.goal?.risk_pct;
			const out = props.method ? primaryOutput(props.method) : null;
			const same = out != null && typeof out.value === "number" && result.risk_pct != null && Math.abs(out.value - result.risk_pct) < .05;
			const method = props.method && (props.method.label !== "unverified-binding" || same) ? props.method : void 0;
			const binding = method && method.label === "unverified-binding" ? resultSentence(method, { youngerAllowed: false }) : "";
			return h$27("div", {
				className: "lp-card lp-result",
				...method ? { "data-result-label": method.label } : {}
			}, h$27(CardHead, {
				label: "10 年心血管风险",
				info: h$27(react.default.Fragment, null, h$27("span", { className: "lp-info-line" }, RISK_INFO), card?.note_zh ? h$27("span", { className: "lp-info-line" }, card.note_zh) : null),
				mark: method?.label ?? null
			}), h$27("div", { className: "lp-result-figure" }, h$27("span", { className: "lp-bignum" }, riskText(result.risk_pct)), h$27("span", { className: "lp-bignum-unit" }, "%"), result.category_zh ? h$27("span", { className: "lp-pill" }, result.category_zh) : null, range), goal != null && Number.isFinite(goal) ? h$27("div", { className: "lp-result-goal" }, h$27("span", { className: "lp-caption" }, "达到方案目标约"), h$27("span", { className: "lp-strong" }, `${riskText(goal)}%`), card?.category_zh?.goal ? h$27("span", { className: "lp-pill lp-pill-good" }, card.category_zh.goal) : null) : null, binding ? h$27("p", { className: "lp-method-sentence" }, binding) : null, h$27("p", { className: "lp-caption" }, [result.date ? `按 ${chineseDate(result.date)}的记录和你的档案计算` : "", "未来 10 年发生心梗、脑卒中等的估计概率"].filter(Boolean).join(" · ")));
		}
		function MethodCard(props) {
			const out = primaryOutput(props.result);
			const numeric = out != null && typeof out.value === "number";
			const sentence = resultSentence(props.result, { youngerAllowed: false });
			return h$27("div", {
				className: "lp-card lp-result",
				"data-result-label": props.result.label
			}, h$27(CardHead, {
				label: titleOf$1(props.result.skill, props.result.title_zh, out?.key ?? ""),
				info: h$27("span", { className: "lp-info-line" }, props.result.limits_zh || "模型估计，不是诊断。"),
				mark: props.result.label
			}), numeric ? h$27("div", { className: "lp-result-figure" }, h$27("span", { className: "lp-bignum" }, fmt(out.value)), out.unit ? h$27("span", { className: "lp-bignum-unit" }, facingUnit(out.unit, out.key)) : null) : null, h$27("p", { className: "lp-method-sentence" }, sentence));
		}
		function EvidenceCard(props) {
			const species = speciesOf(props.result) ?? "未标明";
			return h$27("section", {
				className: "lp-card lp-result lp-method-evidence",
				"data-result-label": "evidence-only"
			}, h$27(CardHead, {
				label: "文献证据",
				info: h$27("span", { className: "lp-info-line" }, props.result.limits_zh),
				mark: "evidence-only",
				estimate: false
			}), h$27("p", { className: "lp-strong" }, `物种：${species}`), h$27("p", { className: "lp-method-sentence" }, resultSentence(props.result, { youngerAllowed: false })));
		}
		const METHOD_CSS = `
.lp-result-head { flex-wrap: wrap; align-items: flex-start; }
.lp-result-tags { display: inline-flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; max-width: 100%; }
.lp-method-sentence { margin: 8px 0 0; overflow-wrap: anywhere; }
.lp-method-block { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; min-width: 0; }
.lp-method-evidence { grid-column: 1 / -1; }
.lp-results .lp-card { min-width: 0; }
@container lp-root (max-width: 720px) { .lp-method-block { grid-template-columns: 1fr; } }
`;
		function ResultsRow(props) {
			const focus = props.journey.profile.focus;
			const riskAt = focus.findIndex((key) => key === "cardio" || key === "weight");
			const bioAt = focus.indexOf("bioage");
			const riskFirst = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt);
			const methods = parseMethodResults(props.journey.method_results);
			const bodyRows = methods.filter((row) => measuresBodyAge(row));
			const pheno = methods.find((row) => row.skill === "accelerated-biological-aging-risk" && row.label !== "evidence-only") ?? bodyRows.find((row) => row.label === "verified") ?? bodyRows[0];
			const riskMethod = methods.find((row) => row.skill === "china-par-ascvd-risk" && row.label !== "evidence-only");
			const hide = /* @__PURE__ */ new Set();
			if (props.journey.results.bioage.status === "ok") hide.add(PHENO_SKILL);
			if (props.journey.results.risk.status === "ok") hide.add(RISK_SKILL$1);
			const slice = overviewSlice(methods);
			const extras = slice.value.filter((row) => !hide.has(row.skill) && !(props.journey.results.bioage.status === "ok" && measuresBodyAge(row)));
			const block = extras.length > 0 || slice.evidence.length > 0 ? h$27("div", {
				key: "methods",
				id: "lp-methods",
				className: "lp-method-block"
			}, ...extras.map((row, index) => h$27(MethodCard, {
				key: `value-${index}`,
				result: row
			})), ...slice.evidence.map((row, index) => h$27(EvidenceCard, {
				key: `evidence-${index}`,
				result: row
			}))) : null;
			const bio = h$27(BodyAgeCard, {
				key: "bio",
				...props,
				method: pheno
			});
			const risk = h$27(RiskCard, {
				key: "risk",
				...props,
				method: riskMethod
			});
			const feedback = h$27(FeedbackBlock, {
				key: "feedback",
				journey: props.journey,
				tracking: props.tracking,
				onNotice: props.onNotice,
				recordChanges: false
			});
			const style = h$27("style", { key: "method-style" }, METHOD_CSS);
			return h$27("div", {
				className: "lp-results",
				id: "lp-results"
			}, style, ...riskFirst ? [risk, bio] : [bio, risk], block, feedback);
		}
		/** The next-checkup add-on list; items the person can measure at home get a field right here. */
		function AddonList(props) {
			const addons = props.journey.addons;
			if (addons.length === 0) return h$27("p", { className: "lp-muted" }, "没有需要加测的项目。");
			return h$27("ul", {
				className: "lp-addons",
				id: `${props.idPrefix}-addons`
			}, ...addons.map((row) => h$27("li", {
				key: row.item_zh,
				className: "lp-addon"
			}, h$27("span", {
				className: "lp-addon-box",
				"aria-hidden": true
			}, h$27(Icon, {
				name: row.self_measurable ? "ruler" : "flask",
				size: 14
			})), h$27("div", { className: "lp-addon-text" }, h$27("div", { className: "lp-strong" }, row.item_zh), h$27("div", { className: "lp-caption" }, `解锁：${row.unlocks_zh}${row.self_measurable ? " · 可以自己在家量" : " · 下次体检加测"}`)), row.self_measurable && row.self_key ? h$27(InlineSelf, {
				journey: props.journey,
				selfKey: row.self_key,
				idPrefix: `${props.idPrefix}-${row.self_key}`,
				onNotice: props.onNotice
			}) : null)));
		}
		//#endregion
		//#region src/client/triage/care-card.ts
		const h$26 = react.default.createElement;
		function localToday() {
			const now = /* @__PURE__ */ new Date();
			const pad = (value) => String(value).padStart(2, "0");
			return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		}
		function printText(title, text) {
			const view = window.open("", "_blank", "noopener=no,width=800,height=900");
			if (!view) return;
			const doc = view.document;
			doc.title = title;
			const pre = doc.createElement("pre");
			pre.style.cssText = "white-space:pre-wrap;font:14px/1.6 system-ui,-apple-system,\"PingFang SC\",sans-serif;margin:24px";
			pre.textContent = text;
			doc.body.appendChild(pre);
			view.focus();
			view.print();
		}
		function BriefModal(props) {
			const { answer } = props;
			const id = answer.brief?.id ?? "";
			return h$26(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "给医生的一页简报",
				onClose: props.onClose,
				headless: true,
				className: "lp-confirm-dialog"
			}, h$26("div", { className: "lp lp-confirm lp-brief" }, h$26("h2", { className: "lp-onb-title" }, "给医生的一页简报"), h$26("p", { className: "lp-caption" }, "数字来自你的体检记录；姓名一栏留空，打印后手写。这不是诊断。"), h$26("pre", {
				className: "lp-brief-text",
				tabIndex: 0
			}, answer.markdown ?? ""), h$26("div", { className: "lp-modal-actions" }, id ? h$26(LinkButton, {
				href: `/api/longpi/brief?id=${encodeURIComponent(id)}&format=md&download=1`,
				icon: "download",
				download: `longpi-doctor-brief-${answer.brief?.created ?? ""}.md`
			}, "存成文件") : null, h$26(Btn, {
				variant: "outline",
				onClick: () => printText("给医生的一页简报", answer.markdown ?? "")
			}, "打印"), h$26(Btn, {
				"data-modal-autofocus": true,
				onClick: props.onClose
			}, "关闭"))));
		}
		function VisitForm(props) {
			const [step, setStep] = react.default.useState("none");
			const [date, setDate] = react.default.useState(localToday());
			const [outcome, setOutcome] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const last = props.journey.triage.care.at(-1);
			const send = async (status) => {
				setBusy(true);
				try {
					const result = await postJson("/api/longpi/care-visit", {
						status,
						...status !== "declined" ? { visit_date: date } : {},
						...status === "visited" && outcome.trim() ? { outcome_zh: outcome.trim() } : {}
					});
					if (!result.ok) throw new Error(result.error || "没有保存");
					props.onNotice(status === "visited" ? "记下了医生的结论。下一步和方案会跟着调整。" : status === "booked" ? `记下了：${date} 看医生。去之前可以打印简报。` : "记下了。想去的时候，简报随时可以打印。", "good");
					setStep("none");
					notifyChanged();
				} catch (err) {
					props.onNotice(`没有保存：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(false);
				}
			};
			const lastText = last ? last.care_status === "booked" ? `已约 ${last.visit_date ?? ""}` : last.care_status === "declined" ? "你说暂时不去" : last.care_status === "visited" ? `已看过 ${last.visit_date ?? ""}` : "" : "";
			return h$26("div", { className: "lp-visit" }, h$26("div", { className: "lp-caption" }, lastText ? `约了吗？医生怎么说？（上次：${lastText}）` : "约了吗？医生怎么说？"), step === "none" ? h$26("div", { className: "lp-form-actions" }, h$26(Btn, {
				size: "sm",
				variant: "outline",
				disabled: busy,
				onClick: () => setStep("booked")
			}, "已预约"), h$26(Btn, {
				size: "sm",
				variant: "outline",
				disabled: busy,
				onClick: () => setStep("visited")
			}, "看完了"), h$26(Btn, {
				size: "sm",
				variant: "ghost",
				disabled: busy,
				onClick: () => {
					send("declined");
				}
			}, "暂时不去")) : null, step !== "none" ? h$26("div", { className: "lp-visit-form" }, h$26("label", { className: "lp-caption" }, step === "booked" ? "就诊日期 " : "看医生的日期 ", h$26("input", {
				type: "date",
				value: date,
				onChange: (event) => setDate(event.target.value)
			})), step === "visited" ? h$26("textarea", {
				className: "lp-visit-outcome",
				rows: 2,
				placeholder: "医生怎么说？（例如：缺铁，开了药，3 个月后复查）",
				value: outcome,
				onChange: (event) => setOutcome(event.target.value)
			}) : null, h$26("div", { className: "lp-form-actions" }, h$26(Btn, {
				size: "sm",
				disabled: busy || !date,
				onClick: () => {
					send(step);
				}
			}, busy ? "保存中…" : "保存"), h$26(Btn, {
				size: "sm",
				variant: "ghost",
				disabled: busy,
				onClick: () => setStep("none")
			}, "取消"))) : null);
		}
		/** The doctor-first card: title, the values, the brief and the visit answers. */
		function CareCard(props) {
			const { journey } = props;
			const [brief, setBrief] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			if (journey.next.action !== "doctor") return null;
			const openBrief = async () => {
				setBusy(true);
				try {
					const answer = await postJson("/api/longpi/brief", {});
					if (!answer.ok) throw new Error(answer.error || "没有生成");
					setBrief(answer);
				} catch (err) {
					props.onNotice(`简报没有生成：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(false);
				}
			};
			return h$26("section", {
				className: "lp-card lp-next-card lp-care-card",
				"aria-label": "请先去看医生",
				id: "lp-care"
			}, h$26("div", { className: "lp-next-text" }, h$26("div", { className: "lp-label" }, h$26(Icon, {
				name: "warn",
				size: 14
			}), " 最重要的一步"), h$26("div", { className: "lp-strong" }, journey.next.title_zh), journey.next.detail_zh && journey.next.detail_zh !== journey.next.title_zh ? h$26("p", { className: "lp-muted" }, journey.next.detail_zh) : null), h$26("div", { className: "lp-form-actions" }, h$26(Btn, {
				size: "sm",
				disabled: busy,
				onClick: () => {
					openBrief();
				}
			}, busy ? "正在整理…" : "医生简报（可打印）"), h$26(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.onIndicators
			}, "看这些指标"), journey.triage.needs_sex ? h$26(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.onProfile
			}, "填写性别") : null), h$26(VisitForm, {
				journey,
				onNotice: props.onNotice
			}), brief ? h$26(BriefModal, {
				answer: brief,
				onClose: () => setBrief(null)
			}) : null);
		}
		//#endregion
		//#region src/client/life.ts
		const h$25 = react.default.createElement;
		function SleepTab() {
			return h$25(IndicatorsTab, {
				filter: "all",
				onFilter: () => {},
				onConnect: () => {},
				area: "sleep"
			});
		}
		function TrainingTab() {
			return h$25(IndicatorsTab, {
				filter: "all",
				onFilter: () => {},
				onConnect: () => {},
				area: "training"
			});
		}
		function AskTab(props) {
			const questions = suggestedQuestions({
				changes: (props.journey.changes ?? []).slice(0, 2).map((row) => row.label_zh),
				visit: props.journey.reminders.find((row) => row.kind === "retest")?.date ?? null
			});
			const ask = (text) => {
				setPendingPrompt(text);
				props.openChat?.();
			};
			return h$25("div", { className: "lp-tab-body lp-ask" }, h$25("section", { className: "lp-card" }, h$25("div", { className: "lp-label" }, "问 LongPi"), h$25("p", { className: "lp-muted" }, "想问就问，不用攒着。回答通常分三小段：我看到的、数据说明不了的、下一步。"), h$25("ul", { className: "lp-ask-list" }, ...questions.map((text) => h$25("li", { key: text }, h$25("button", {
				type: "button",
				className: "lp-ask-q",
				onClick: () => ask(text)
			}, text))))));
		}
		function CalendarTab(props) {
			const [suggestions, setSuggestions] = react.default.useState([]);
			const [events, setEvents] = react.default.useState([]);
			const [note, setNote] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/schedule").then((row) => {
					setSuggestions(row.suggestions ?? []);
					setEvents(row.events ?? []);
				}).catch(() => {});
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const retests = props.journey.reminders.filter((row) => row.kind === "retest" && row.date);
			const confirm = (row) => {
				postJson("/api/longpi/schedule", {
					...row,
					confirm: true
				}).then(() => {
					setNote("已放进日程。");
					load();
				}).catch((error) => setNote(errorText(error, "没有放进去")));
			};
			return h$25("div", { className: "lp-tab-body lp-calendar" }, h$25("section", { className: "lp-card" }, h$25("div", { className: "lp-label" }, "日程"), h$25("p", { className: "lp-muted" }, "复查、看医生、稍后要做的事。LongPi 的建议要你点一下才写上日期。"), events.length === 0 && retests.length === 0 ? h$25("p", null, "还没有写上的日期。") : h$25("ul", { className: "lp-cal-list" }, ...events.map((row) => h$25("li", { key: row.id }, h$25("div", { className: "lp-strong" }, `${row.date} · ${row.title_zh}`), row.brief_zh ? h$25("p", { className: "lp-muted" }, row.brief_zh) : null, row.questions_zh.length > 0 ? h$25("p", { className: "lp-caption" }, `可以问：${row.questions_zh.join("；")}`) : null)), ...retests.map((row) => h$25("li", { key: row.text_zh }, h$25("div", { className: "lp-strong" }, `${row.date} · ${row.text_zh}`))))), h$25("section", {
				className: "lp-card",
				id: "lp-cal-suggest"
			}, h$25("div", { className: "lp-label" }, "建议，还没写上"), suggestions.length === 0 && retests[0] ? h$25("div", { className: "lp-cal-suggest" }, h$25("p", null, `${retests[0].date} ${retests[0].text_zh}`), h$25("p", { className: "lp-caption" }, "带着上次的简报和你想问的问题。"), h$25(Btn, {
				size: "sm",
				onClick: () => confirm({
					date: retests[0].date ?? "",
					title_zh: retests[0].text_zh,
					brief_zh: "带着简报和问题。",
					questions_zh: suggestedQuestions({ visit: retests[0].date }).slice(0, 2),
					kind: "retest"
				})
			}, "放进日程"), h$25(Btn, {
				size: "sm",
				variant: "outline",
				onClick: () => setNote("先不写上。")
			}, "先不用")) : suggestions.map((row) => h$25("div", {
				key: row.id,
				className: "lp-cal-suggest"
			}, h$25("p", null, `${row.date} ${row.title_zh}`), h$25(Btn, {
				size: "sm",
				onClick: () => confirm(row)
			}, "放进日程"))), note ? h$25("p", { className: "lp-caption" }, note) : null), h$25(Timeline, { journey: props.journey }));
		}
		function Timeline(props) {
			const [wearables, setWearables] = react.default.useState([]);
			react.default.useEffect(() => {
				getJson("/api/longpi/indicators").then((data) => {
					const rows = [];
					for (const group of data.groups ?? []) for (const row of group.indicators ?? []) {
						if (row.source !== "device" || !row.latest?.date || !row.label_zh) continue;
						if (!/睡眠|步数/.test(row.label_zh)) continue;
						const value = row.latest.text ?? (row.latest.value == null ? "" : String(row.latest.value));
						rows.push({
							date: row.latest.date,
							label_zh: row.label_zh,
							value_zh: value
						});
					}
					setWearables(rows.slice(0, 6));
				}).catch(() => setWearables([]));
			}, [props.journey.today]);
			const items = buildTimeline({
				checkups: [...new Set((props.journey.changes ?? []).flatMap((row) => [row.compare?.from_date, row.compare?.to_date].filter((date) => Boolean(date))))].map((date) => ({
					date,
					note: "化验"
				})),
				wearables,
				life: props.journey.reminders.filter((row) => row.kind === "retest" && row.date).map((row) => ({
					date: row.date,
					kind: "visit",
					note: row.text_zh
				}))
			});
			return h$25("section", {
				className: "lp-card",
				id: "lp-timeline"
			}, h$25("div", { className: "lp-label" }, "同一条时间"), h$25("p", { className: "lp-muted" }, "化验、手环和生活上的事放在一起，才看得出比如复查前生过病。"), items.length === 0 ? h$25("p", { className: "lp-caption" }, "还没有可以排在一起的日期。") : h$25("ol", { className: "lp-timeline" }, ...items.slice(-8).map((item) => h$25("li", { key: `${item.kind}-${item.date}-${item.title_zh}` }, h$25("span", { className: "lp-timeline-date" }, item.date), h$25("span", null, `${item.title_zh} · ${item.detail_zh}`)))));
		}
		function InsightCard(props) {
			const [text, setText] = react.default.useState(null);
			react.default.useEffect(() => {
				let live = true;
				getJson("/api/longpi/season").then(async (season) => {
					if (!live) return;
					if (season.pressure !== true) {
						setText(null);
						return;
					}
					const indicators = await getJson("/api/longpi/indicators").catch(() => null);
					let sleep = null;
					let steps = null;
					for (const group of indicators?.groups ?? []) for (const row of group.indicators ?? []) {
						if (row.source !== "device" || row.latest?.value == null) continue;
						if (/睡眠/.test(row.label_zh ?? "")) sleep = row.latest.value;
						if (/步数/.test(row.label_zh ?? "")) steps = row.latest.value;
					}
					const lab = /不一定是好事/.test(props.journey.results.bioage.headline_zh ?? "") ? void 0 : (props.journey.changes ?? []).find((row) => row.ask_doctor && !(props.covered && isCovered(props.covered, row)));
					const labNote = lab ? `${lab.label_zh}最近的变化比平常大。睡眠或步数说明不了这个化验，复查时再看。` : null;
					setText(insightSentence({
						sleepHours: sleep,
						steps,
						labNote
					}));
				}).catch(() => {
					if (live) setText(null);
				});
				return () => {
					live = false;
				};
			}, [props.journey.today]);
			if (!text) return null;
			return h$25("section", {
				className: "lp-card lp-insight",
				id: "lp-insight"
			}, h$25("div", { className: "lp-label" }, "今日洞察"), h$25("p", null, text));
		}
		function ScienceIntro(props) {
			const [show, setShow] = react.default.useState(false);
			const [waiting, setWaiting] = react.default.useState(OUTBOX_ZH);
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/science/invite").then((row) => {
					setShow(row.show === true);
					if (row.waiting_zh) setWaiting(row.waiting_zh);
				}).catch(() => setShow(false));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			if (!show) return null;
			const later = () => {
				postJson("/api/longpi/science/invite", { decision: "later" }).then(() => setShow(false)).catch(() => setShow(false));
			};
			return h$25("section", {
				className: "lp-card lp-science-invite",
				id: "lp-science-invite"
			}, h$25("div", { className: "lp-label" }, "一起研究"), h$25("p", null, SCIENCE_INTRO), h$25("p", { className: "lp-caption" }, waiting), h$25("div", { className: "lp-form-actions" }, h$25(Btn, {
				size: "sm",
				onClick: () => props.goTab("science")
			}, "加入"), h$25(Btn, {
				size: "sm",
				variant: "outline",
				onClick: later
			}, "以后再说")));
		}
		function Subnav(props) {
			const items = [
				["plan", "方案"],
				["profile", "档案"],
				["season", "赛季"],
				...props.science ? [["science", "研究"]] : []
			];
			return h$25("div", {
				className: "lp-subnav",
				role: "navigation",
				"aria-label": "更多"
			}, ...items.map(([key, label]) => h$25("button", {
				key,
				type: "button",
				className: `lp-subnav-btn ${props.current === key ? "lp-subnav-on" : ""}`,
				onClick: () => props.onTab(key)
			}, label)));
		}
		//#endregion
		//#region src/client/overview.ts
		const h$24 = react.default.createElement;
		const WEEK_ZH = [
			"日",
			"一",
			"二",
			"三",
			"四",
			"五",
			"六"
		];
		function addDays(iso, days) {
			const at = /* @__PURE__ */ new Date(`${iso.slice(0, 10)}T12:00:00Z`);
			at.setUTCDate(at.getUTCDate() + days);
			return at.toISOString().slice(0, 10);
		}
		/** The last seven days of the plan's check-ins, pooled over items: all done, some, none, or no record. */
		function weekOf(tracking, today) {
			return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)).map((date) => {
				const statuses = (tracking?.items ?? []).flatMap((item) => (item.adherence?.calendar ?? []).filter((day) => day.date === date).map((day) => day.status));
				const done = statuses.filter((status) => status === "done").length;
				const missed = statuses.filter((status) => status === "missed").length;
				return {
					date,
					state: done > 0 && done === statuses.length ? "done" : done > 0 ? "part" : missed > 0 ? "missed" : "unknown"
				};
			});
		}
		const DAY_ZH = {
			done: "都完成",
			part: "部分完成",
			missed: "没做到",
			unknown: "没有记录"
		};
		function WeekStrip(props) {
			if (!props.tracking) return null;
			const week = weekOf(props.tracking, props.today);
			const retest = retestDates(props.tracking)[0];
			const retestText = retest ? retest.date <= props.today ? `现在可以复测${retest.marker}` : `${chineseDate(retest.date)}可复测${retest.marker}` : "";
			return h$24("div", { className: "lp-week" }, h$24("span", { className: "lp-caption" }, "本周"), h$24("ol", {
				className: "lp-week-cells",
				"aria-label": `近 7 天：${week.map((day) => `${chineseDate(day.date)}${DAY_ZH[day.state]}`).join("，")}`
			}, ...week.map((day) => h$24("li", {
				key: day.date,
				className: `lp-week-cell lp-week-${day.state}`,
				title: `${chineseDate(day.date)} ${DAY_ZH[day.state]}`
			}, h$24("span", {
				className: "lp-week-day",
				"aria-hidden": true
			}, WEEK_ZH[(/* @__PURE__ */ new Date(`${day.date}T12:00:00Z`)).getUTCDay()])))), retestText ? h$24("span", { className: "lp-caption" }, `· ${retestText}`) : null);
		}
		function TodayCard(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const counts = todayCounts(props.journey);
			return h$24("section", {
				className: "lp-card lp-today-card",
				id: "lp-today",
				"aria-labelledby": "lp-today-title"
			}, h$24("div", { className: "lp-card-head" }, h$24("div", {
				className: "lp-label",
				id: "lp-today-title"
			}, "今天", counts.total > 0 ? h$24("span", { className: "lp-optional" }, `${counts.done} / ${counts.total}`) : null), props.journey.plan.days != null ? h$24("span", { className: "lp-caption" }, `方案第 ${props.journey.plan.days} 天`) : null), h$24(TodayList, {
				journey: props.journey,
				stateOf,
				busy,
				onAnswer: answer
			}), h$24(WeekStrip, {
				tracking: props.tracking,
				today: props.journey.today
			}));
		}
		function ctaOf(action, props) {
			switch (action) {
				case "consent":
				case "profile":
				case "records": return {
					label: "继续",
					run: props.openOnboarding
				};
				case "addons": return {
					label: "查看加测清单",
					run: () => props.onAction("addons")
				};
				case "plan": return {
					label: "起草方案",
					run: () => props.goTab("plan")
				};
				case "checkin": return {
					label: "记录今天",
					run: () => props.goTab("overview", { id: "lp-today" })
				};
				case "review": return {
					label: "看方案效果",
					run: () => props.goTab("plan")
				};
				case "doctor": return {
					label: "看这些指标",
					run: () => props.goTab("indicators")
				};
				default: return null;
			}
		}
		function NextCard(props) {
			const next = props.journey.next;
			if (!next.title_zh && !next.detail_zh) return null;
			const cta = ctaOf(next.action, props);
			return h$24("section", {
				className: "lp-card lp-next-card",
				"aria-label": "下一步"
			}, h$24("div", { className: "lp-next-text" }, h$24("div", { className: "lp-label" }, "下一步"), h$24("div", { className: "lp-strong" }, next.title_zh), next.detail_zh && next.detail_zh !== next.title_zh ? h$24("p", { className: "lp-muted" }, next.detail_zh) : null), cta ? h$24(Btn, {
				size: "sm",
				onClick: cta.run
			}, cta.label, h$24(Icon, {
				name: "arrow",
				size: 14
			})) : null);
		}
		/** Some reads failed: the missing values are unknown, not "not measured". */
		function PartialNote(props) {
			const records = props.journey.records;
			if (records.status !== "partial") return null;
			const missing = records.missing_reads.filter((name) => name && !isDiagnosisName(name)).map((name) => scrubVisible(name)).filter(Boolean);
			const errors = records.read_errors.map((line) => scrubVisible(line)).filter(Boolean);
			return h$24("p", {
				className: "lp-blocker lp-blocker-bad lp-partial",
				role: "note"
			}, h$24(Icon, {
				name: "warn",
				size: 14
			}), h$24("span", null, `有一部分记录这次没有读到${errors.length > 0 ? `（${errors.slice(0, 2).join("；")}）` : ""}。`, missing.length > 0 ? `没读到的指标：${missing.slice(0, 6).join("、")}${missing.length > 6 ? ` 等 ${missing.length} 项` : ""}。` : "", "它们不是“没测”，稍后点右上角的刷新再读一次。"));
		}
		function Overview(props) {
			const { journey } = props;
			const doctor = journey.next.action === "doctor";
			const covered = coveredByCare(journey);
			return h$24("div", { className: "lp-tab-body lp-overview" }, h$24(PartialNote, { journey }), doctor ? h$24(CareCard, {
				journey,
				onNotice: props.onNotice,
				onIndicators: () => props.goTab("indicators", { filter: "changed" }),
				onProfile: props.openOnboarding
			}) : null, h$24(InsightCard, {
				journey,
				covered
			}), journey.plan.exists ? h$24(TodayCard, {
				journey,
				tracking: props.tracking,
				onNotice: props.onNotice
			}) : null, h$24(ResultsRow, {
				journey,
				tracking: props.tracking,
				onAction: props.onAction,
				onNotice: props.onNotice,
				covered
			}), doctor ? null : h$24(NextCard, props), h$24(NotableChanges, {
				journey,
				covered,
				onOpenIndicators: () => props.goTab("indicators", { filter: "changed" })
			}), h$24(ScienceIntro, { goTab: props.goTab }));
		}
		//#endregion
		//#region src/client/advice/advice-card.ts
		const h$23 = react.default.createElement;
		function AdviceCard({ advice }) {
			const lines = advice?.tier4?.first_aid_zh ?? advice?.person?.notes_zh ?? [];
			const title = advice?.tier ? `第 ${advice.tier} 层` : "建议";
			return h$23("div", { className: "longpi-advice" }, h$23("div", { className: "longpi-advice-title" }, `${title}${advice?.subject?.name_zh ? ` · ${advice.subject.name_zh}` : ""}`), ...lines.slice(0, 4).map((line, index) => h$23("p", { key: index }, line)));
		}
		//#endregion
		//#region src/client/advice/index.ts
		/** The chat card for advise_on_substance. Client modules.ts does not call this until the integrator does. */
		function registerAdviceCard() {
			registerToolView({
				tool: "advise_on_substance",
				Component: AdviceCard
			});
		}
		//#endregion
		//#region src/client/privacy/index.ts
		function registerPrivacyClient() {
			registerSettingsSection({
				id: "longpi-privacy",
				order: 35,
				Component: DataPage
			});
			registerProfileSection({
				id: "longpi-privacy",
				order: 80,
				Component: DataPage
			});
		}
		//#endregion
		//#region src/client/call-state.ts
		const ADOPTED_KEY = "dsh-plugin-longpi.adopted.";
		const UNDONE_KEY = "dsh-plugin-longpi.undone.";
		let version = 0;
		const listeners$1 = /* @__PURE__ */ new Set();
		function changed() {
			version += 1;
			for (const listener of listeners$1) listener();
		}
		/** The plan version this call's draft was adopted as, or null. */
		function adoptedVersion(callId) {
			const value = Number(readPref(`${ADOPTED_KEY}${callId}`));
			return Number.isFinite(value) && value > 0 ? value : null;
		}
		function setAdopted(callId, plan) {
			writePref(`${ADOPTED_KEY}${callId}`, String(plan));
			changed();
		}
		/** Whether this call's check-ins for today were taken back. */
		function isUndone(callId) {
			return readPref(`${UNDONE_KEY}${callId}`) === "1";
		}
		function setUndone(callId) {
			writePref(`${UNDONE_KEY}${callId}`, "1");
			changed();
		}
		/** Re-render when any call's outcome changes. */
		function useCallState() {
			return react.default.useSyncExternalStore((listener) => {
				listeners$1.add(listener);
				return () => {
					listeners$1.delete(listener);
				};
			}, () => version, () => version);
		}
		//#endregion
		//#region src/client/toolviews.ts
		const h$22 = react.default.createElement;
		function objectOf$2(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function parseArgs(raw) {
			if (typeof raw !== "string" || !raw.trim()) return {};
			try {
				return objectOf$2(JSON.parse(raw));
			} catch {
				return {};
			}
		}
		/**
		* A running call has name and argsRaw; a settled one is a tool-result node
		* with content blocks (LongPi's tools answer with one text block of JSON),
		* isError, and the call head when it is still in the window.
		*/
		function parseCall(block) {
			const node = objectOf$2(block);
			if (node.kind !== "tool-result") return {
				state: "running",
				args: parseArgs(node.argsRaw),
				result: null,
				text: "",
				error: ""
			};
			const args = parseArgs(objectOf$2(node.call).argsRaw);
			const text = (Array.isArray(node.content) ? node.content : []).map((part) => {
				const row = objectOf$2(part);
				return row.type === "text" && typeof row.text === "string" ? row.text : JSON.stringify(part, null, 2);
			}).join("\n");
			if (node.isError === true) {
				const err = objectOf$2(node.error);
				const code = [err.name, err.code].filter((part) => typeof part === "string" && part).join(": ");
				return {
					state: "error",
					args,
					result: null,
					text,
					error: text.split("\n")[0] || code || "工具没有完成"
				};
			}
			let result = null;
			try {
				result = objectOf$2(JSON.parse(text));
			} catch {
				result = null;
			}
			return {
				state: "settled",
				args,
				result,
				text,
				error: ""
			};
		}
		function prettyRaw(text) {
			try {
				return JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				return text;
			}
		}
		/** The frame every card shares: a head row, the body, and the raw result behind 原始结果. */
		function Shell(props) {
			const [raw, setRaw] = react.default.useState(false);
			const { call } = props;
			const running = call.state === "running";
			const rawText = call.state === "running" ? "" : prettyRaw(call.text);
			return h$22("div", {
				className: `lp lp-tool ${props.quiet ? "lp-tool-quiet" : "lp-tool-card"} ${call.state === "error" ? "lp-tool-error" : ""}`,
				"data-state": call.state
			}, h$22("div", { className: "lp-tool-head" }, h$22("span", {
				className: `lp-tool-icon ${running ? "lp-tool-running" : ""}`,
				"aria-hidden": true
			}, h$22(Icon, {
				name: running ? "refresh" : call.state === "error" ? "warn" : props.icon,
				size: 14,
				className: running ? "lp-spin" : ""
			})), h$22("span", { className: "lp-tool-title" }, props.title), props.summary != null ? h$22("span", { className: `lp-tool-summary ${props.tone ? `lp-tool-${props.tone}` : ""}` }, props.summary) : null, props.action ?? null, rawText ? h$22("button", {
				type: "button",
				className: "lp-tool-raw-btn",
				"aria-expanded": raw,
				onClick: () => setRaw((current) => !current)
			}, "原始结果", h$22(Icon, {
				name: "chevron",
				size: 12,
				className: raw ? "lp-rot" : ""
			})) : null), props.children ? h$22("div", { className: "lp-tool-body" }, props.children) : null, raw && rawText ? h$22("pre", { className: "lp-tool-raw" }, rawText) : null);
		}
		function DraftCard(props) {
			const { journey } = useJourney();
			const { draft, saved } = props;
			const [removed, setRemoved] = react.default.useState(/* @__PURE__ */ new Set());
			const [confirming, setConfirming] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const kept = draft.items.filter((item) => !removed.has(item.id));
			const goals = keptGoals(draft, kept);
			const toggle = (id) => setRemoved((current) => {
				const next = new Set(current);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
			async function accept(remind) {
				setBusy(true);
				setError(null);
				try {
					const result = await acceptDraft(draft, kept, remind, props.source);
					if (!result.ok) {
						setError(`没有保存：${result.error}`);
						return;
					}
					setAdopted(props.callId, result.version);
					props.onSaved({
						version: result.version,
						reminder: result.reminder
					});
					setConfirming(false);
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			const openPlan = props.openPage ? () => {
				requestView({
					tab: "plan",
					id: "lp-plan"
				});
				props.openPage?.();
			} : null;
			if (saved) return h$22("div", { className: "lp-tool-saved" }, h$22("span", { className: "lp-chip-saved" }, h$22(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已保存为方案第 ${saved.version} 版`), saved.reminder ? h$22("span", { className: "lp-caption" }, `打卡提醒没有打开：${saved.reminder}`) : null, openPlan ? h$22("button", {
				type: "button",
				className: "lp-row-link",
				onClick: openPlan
			}, "在健康页查看 →") : null);
			return h$22("div", { className: "lp-tool-draft" }, h$22(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				compact: true
			}), props.data.brief.notes_zh[0] ? h$22("p", { className: "lp-fine" }, props.data.brief.notes_zh[0]) : null, h$22("div", { className: "lp-form-actions" }, h$22(Btn, {
				size: "sm",
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$22("span", { className: "lp-caption" }, "每项是试验里的平均效果，个人结果会不同；补剂不给剂量，不涉及处方药。")), confirming ? h$22(ConfirmModal, {
				draft,
				items: kept,
				goals,
				today: journey?.today ?? localToday$1(),
				busy,
				error,
				onCancel: () => setConfirming(false),
				onConfirm: (remind) => {
					accept(remind);
				}
			}) : null);
		}
		/** The draft's focus (as the brief used it) and the markers the model asked for: the accept route rebuilds that brief. */
		function draftSource(args, data) {
			return {
				focus: data.brief.focus.map(String),
				markers: strings$1(args.markers)
			};
		}
		function DraftToolView(props) {
			const call = parseCall(props.block);
			useCallState();
			const [local, setSaved] = react.default.useState(null);
			const adopted = adoptedVersion(props.callId);
			const saved = local ?? (adopted != null ? {
				version: adopted,
				reminder: null
			} : null);
			if (call.state === "running") return h$22(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "正在按你的结果和试验证据起草…"
			});
			if (call.state === "error") return h$22(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: `没有完成：${call.error}`,
				tone: "bad"
			});
			let data = null;
			try {
				data = call.result ? normalizePlanDraft(call.result) : null;
			} catch {
				data = null;
			}
			if (!data) return h$22(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "结果无法显示，展开看原始结果",
				tone: "warn"
			});
			if (!data.draft) return h$22(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: "现在还起草不了"
			}, h$22("p", { className: "lp-muted" }, data.brief.notes_zh[0] || "记录里还没有能对上研究证据的指标。"));
			return h$22(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: saved ? `${data.draft.items.length} 项 · 已采用` : `${data.draft.items.length} 项 · 按证据起草 · 还没有保存`
			}, h$22(DraftCard, {
				callId: props.callId,
				data,
				draft: data.draft,
				source: draftSource(call.args, data),
				saved,
				onSaved: setSaved,
				openPage: props.openPage
			}));
		}
		/** "饮食｜地中海饮食；2025-10-20 起；看 hs-CRP": the category and title, then the rest. */
		function readBackRow(text) {
			const [head = "", ...rest] = text.split("；");
			const [category = "", title = ""] = head.includes("｜") ? head.split("｜") : ["", head];
			return {
				category,
				title: title || head,
				rest: rest.join(" · ")
			};
		}
		function strings$1(value) {
			return Array.isArray(value) ? value.filter((row) => typeof row === "string" && row.length > 0) : [];
		}
		function SaveToolView(props) {
			const call = parseCall(props.block);
			const confirm = call.args.confirm === true;
			const title = confirm ? "保存方案" : "核对方案";
			if (call.state === "running") return h$22(Shell, {
				call,
				icon: "check",
				title,
				summary: confirm ? "正在保存…" : "正在核对…"
			});
			if (call.state === "error") return h$22(Shell, {
				call,
				icon: "check",
				title,
				summary: `没有完成：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const readBack = strings$1(result.read_back);
			const warnings = strings$1(result.warnings);
			const errors = strings$1(result.errors);
			if (result.saved === true) {
				const version = typeof result.version === "number" ? result.version : null;
				const openPlan = props.openPage ? () => {
					requestView({
						tab: "plan",
						id: "lp-plan"
					});
					props.openPage?.();
				} : null;
				return h$22(Shell, {
					call,
					icon: "check",
					title: "保存方案",
					quiet: true,
					summary: h$22("span", { className: "lp-chip-saved" }, h$22(Icon, {
						name: "check",
						size: 12,
						strokeWidth: 2
					}), version != null ? `已保存为方案第 ${version} 版` : "已保存"),
					action: openPlan ? h$22("button", {
						type: "button",
						className: "lp-tool-undo",
						onClick: openPlan
					}, "在健康页查看 →") : null
				});
			}
			return h$22(Shell, {
				call,
				icon: "check",
				title: "方案复述",
				summary: errors.length > 0 ? "还缺信息，没有保存" : "还没有保存，确认后才保存",
				tone: errors.length > 0 ? "warn" : void 0
			}, readBack.length > 0 ? h$22("ul", { className: "lp-readback" }, ...readBack.map((text, index) => {
				const row = readBackRow(text);
				return h$22("li", { key: index }, row.category ? h$22("span", { className: "lp-cat" }, row.category) : null, h$22("span", { className: "lp-strong" }, row.title), row.rest ? h$22("span", { className: "lp-caption" }, ` ${row.rest}`) : null);
			})) : null, ...errors.map((text) => h$22("p", {
				key: `e:${text}`,
				className: "lp-form-error"
			}, text)), ...warnings.map((text) => h$22("p", {
				key: `w:${text}`,
				className: "lp-caption lp-tool-warn"
			}, h$22(Icon, {
				name: "warn",
				size: 12
			}), ` ${text}`)));
		}
		function CheckinToolView(props) {
			const call = parseCall(props.block);
			const { journey } = useJourney();
			const [undoing, setUndoing] = react.default.useState(false);
			useCallState();
			const undone = isUndone(props.callId);
			const [error, setError] = react.default.useState(null);
			if (call.state === "running") return h$22(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "正在记录…"
			});
			if (call.state === "error") return h$22(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: `没有记下：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const entries = (Array.isArray(result.entries) ? result.entries : []).map((row) => {
				const entry = objectOf$2(row);
				return {
					item: String(entry.item ?? ""),
					title: typeof entry.title === "string" ? entry.title : "",
					date: String(entry.date ?? ""),
					done: entry.done === true ? true : entry.done === false ? false : null,
					undo: entry.undo === true
				};
			}).filter((row) => row.item);
			const problems = strings$1(result.problems);
			const titleOf = (row) => row.title || journey?.plan.checkin_items.find((item) => item.id === row.item)?.title || row.item;
			const today = journey?.today ?? localToday$1();
			const nameOf = (row, withState) => `${titleOf(row)}${withState && row.done === false ? "（没做到）" : ""}${row.date && row.date !== today ? `（${row.date.slice(5)}）` : ""}`;
			const answered = entries.filter((row) => !row.undo && row.done !== null);
			const undoable = answered.filter((row) => row.date === today);
			const recorded = undone ? answered.filter((row) => row.date !== today) : answered;
			const taken = [...entries.filter((row) => row.undo), ...undone ? undoable : []];
			const noted = entries.filter((row) => !row.undo && row.done === null);
			const parts = [
				recorded.length > 0 ? `已记录：${recorded.map((row) => nameOf(row, true)).join("、")}` : "",
				taken.length > 0 ? `已撤销：${taken.map((row) => nameOf(row, false)).join("、")}` : "",
				noted.length > 0 ? `已记下备注：${noted.map((row) => nameOf(row, false)).join("、")}` : ""
			].filter(Boolean);
			const onlyTaken = recorded.length === 0 && noted.length === 0;
			async function undo() {
				setUndoing(true);
				setError(null);
				try {
					for (const row of undoable) await postCheckIn(today, row.item, null);
					setUndone(props.callId);
				} catch (err) {
					setError(`没有撤销：${errorText(err, "请稍后再试")}`);
				} finally {
					setUndoing(false);
				}
			}
			if (entries.length === 0) return h$22(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "没有记下",
				tone: "warn",
				quiet: true
			}, ...problems.map((text) => h$22("p", {
				key: text,
				className: "lp-caption"
			}, text)));
			return h$22(Shell, {
				call,
				icon: "check",
				title: "打卡",
				quiet: true,
				summary: h$22("span", { className: `lp-chip-saved ${onlyTaken ? "lp-chip-undone" : ""}` }, h$22(Icon, {
					name: onlyTaken ? "close" : "check",
					size: 12,
					strokeWidth: 2
				}), parts.join("；")),
				action: !undone && undoable.length > 0 ? h$22("button", {
					type: "button",
					className: "lp-tool-undo",
					disabled: undoing,
					onClick: () => {
						undo();
					},
					"aria-label": `撤销今天的打卡：${undoable.map((row) => nameOf(row, true)).join("、")}`
				}, undoing ? "撤销中" : "撤销") : null
			}, error ? h$22("p", { className: "lp-form-error" }, error) : null, ...problems.map((text) => h$22("p", {
				key: text,
				className: "lp-caption"
			}, text)));
		}
		const PHENOAGE_SKILL = "accelerated-biological-aging-risk";
		const RISK_SKILL = "china-par-ascvd-risk";
		function outputValue(result, key) {
			const value = objectOf$2(objectOf$2(result.outputs)[key]).value;
			return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value ? value : null;
		}
		function numberOf(value) {
			if (typeof value === "number") return value;
			if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
			return null;
		}
		/** The skill in plain Chinese when the cached board knows it; its first output's label otherwise; the id last. */
		function skillName(board, name, result) {
			const known = [
				...board?.readiness?.ready ?? [],
				...board?.dispatch?.matches ?? [],
				...board?.near ?? []
			].find((row) => row.name === name);
			if (known?.blurb) return known.blurb;
			const outputs = Object.values(objectOf$2(result?.outputs)).map((row) => objectOf$2(row).label_zh).find((label) => typeof label === "string" && label);
			return typeof outputs === "string" ? outputs : name;
		}
		function ResultFigure(props) {
			return h$22("div", { className: "lp-tool-result" }, h$22("span", { className: "lp-tool-figure" }, props.figure, h$22("span", { className: "lp-bignum-unit" }, props.unit)), h$22("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计"), h$22(Info, { label: props.label }, props.info), ...props.lines.filter(Boolean).map((line) => h$22("span", {
				key: line,
				className: "lp-caption"
			}, line)));
		}
		function SkillToolView(props) {
			const call = parseCall(props.block);
			const board = useCachedBoard();
			const { journey } = useJourney();
			const name = typeof call.args.name === "string" ? call.args.name : "";
			const plain = name === PHENOAGE_SKILL ? BIOAGE_LABEL : name === RISK_SKILL ? RISK_LABEL : skillName(board, name, call.result);
			if (call.state === "running") return h$22(Shell, {
				call,
				icon: "play",
				title: `计算${plain}`,
				summary: "正在运行方法…"
			});
			if (call.state === "error") return h$22(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: `没有算完：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			if (result.ok !== true) {
				const reason = typeof result.error === "string" && result.error ? result.error : typeof result.error_kind === "string" ? result.error_kind : "方法没有给出结果";
				return h$22(Shell, {
					call,
					icon: "play",
					title: plain,
					summary: `没有算出：${reason}`,
					tone: "warn"
				});
			}
			if (name === PHENOAGE_SKILL) {
				const phenoage = numberOf(outputValue(result, "phenoage"));
				const advance = numberOf(outputValue(result, "phenoage_advance"));
				const band = journey?.results.bioage.band_years;
				if (phenoage != null) return h$22(Shell, {
					call,
					icon: "play",
					title: BIOAGE_LABEL,
					summary: typeof result.measured_at === "string" ? `按 ${result.measured_at} 的血检` : void 0
				}, h$22(ResultFigure, {
					figure: fmt(phenoage),
					unit: "岁",
					lines: [journey?.results.bioage.headline_zh ? journey.results.bioage.headline_zh : journey?.results.bioage.allows_younger ? versusAge(advance, journey.results.bioage.checkups) : "", band != null ? `正常波动 ±${fmt(band)} 岁` : ""],
					label: BIOAGE_LABEL,
					info: BIOAGE_INFO
				}));
			}
			if (name === RISK_SKILL) {
				const risk = numberOf(outputValue(result, "risk_10y_pct"));
				const category = outputValue(result, "risk_category");
				if (risk != null) return h$22(Shell, {
					call,
					icon: "play",
					title: RISK_LABEL,
					summary: typeof result.measured_at === "string" ? `按 ${result.measured_at} 的记录` : void 0
				}, h$22(ResultFigure, {
					figure: riskText(risk),
					unit: "%",
					lines: [typeof category === "string" ? category : "", "同类人群的平均风险"],
					label: RISK_LABEL,
					info: RISK_INFO
				}));
			}
			const excerpt = typeof result.report_excerpt === "string" ? result.report_excerpt.trim() : "";
			return h$22(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: "已算出"
			}, excerpt ? h$22("details", { className: "lp-tool-report" }, h$22("summary", null, "报告"), h$22("pre", null, excerpt)) : null);
		}
		function SituationToolView(props) {
			const call = parseCall(props.block);
			if (call.state === "running") return h$22(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: "正在读取…"
			});
			if (call.state === "error") return h$22(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: `没有读到：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const indicators = typeof result.indicator_count === "number" ? result.indicator_count : null;
			const summary = objectOf$2(result.records_summary);
			const checkups = typeof summary.checkups === "number" ? summary.checkups : null;
			const counts = [checkups != null ? `${checkups} 次体检` : "", indicators != null ? `${indicators} 项指标` : ""].filter(Boolean).join("，");
			const changes = (Array.isArray(result.record_changes) ? result.record_changes : []).map(objectOf$2).filter((row) => row.ask_doctor === true);
			const failed = result.record_status === "error" || result.record_status === "partial";
			return h$22(Shell, {
				call,
				icon: "user",
				title: counts ? `已读取你的档案与记录（${counts}）` : "已读取你的档案与记录",
				quiet: true
			}, failed ? h$22("p", { className: "lp-caption lp-tool-warn" }, h$22(Icon, {
				name: "warn",
				size: 12
			}), ` 有一部分记录没有读到${typeof result.record_error === "string" && result.record_error ? `：${result.record_error}` : ""}`) : null, changes.length > 0 ? h$22("p", { className: "lp-tool-doctor" }, h$22(Icon, {
				name: "warn",
				size: 13
			}), ` ${changes.slice(0, 3).map((row) => String(row.label_zh ?? "")).filter(Boolean).join("、")}${changes.length > 3 ? ` 等 ${changes.length} 项` : ""}的变化超出正常波动。${typeof changes[0]?.advice_zh === "string" ? changes[0].advice_zh : ""}`) : null);
		}
		/** The keyed views, by wire tool name. */
		const TOOL_VIEWS = {
			draft_intervention_plan: DraftToolView,
			save_intervention_plan: SaveToolView,
			log_intervention_checkin: CheckinToolView,
			run_longevity_skill: SkillToolView,
			read_personal_situation: SituationToolView
		};
		//#endregion
		//#region src/client/science/community.ts
		const h$21 = react.default.createElement;
		function CommunityPanel(props) {
			const [topic, setTopic] = react.default.useState(props.voting.mine ?? "");
			const width = props.progress.min_cohort > 0 ? Math.min(100, Math.round(100 * props.progress.contributed / props.progress.min_cohort)) : 0;
			const vote = () => {
				postJson("/api/longpi/science/community", { topic_id: topic }).then(() => props.onChange()).catch((error) => props.onError(error instanceof Error ? error.message : "没有记下"));
			};
			return h$21("div", null, h$21("section", {
				className: "lp-section",
				id: "lp-science-progress"
			}, h$21("p", { className: "lp-kicker" }, `研究进度 · 第 ${props.progress.week} 周 / 共 ${props.progress.weeks} 周`), h$21("h2", { className: "lp-h2" }, props.progress.label_zh), h$21("div", {
				className: "lp-sci-bar",
				role: "progressbar",
				"aria-valuenow": props.progress.contributed,
				"aria-valuemax": props.progress.min_cohort
			}, h$21("span", { style: { width: `${width}%` } })), ...(props.thresholds ?? []).map((row) => h$21("p", {
				key: row.study_id,
				className: "lp-threshold"
			}, `${row.title_zh} ${row.line_zh}`)), props.early_zh ? h$21("p", null, props.early_zh) : null, (props.thresholds ?? []).some((row) => row.line_zh.includes("招募中")) ? h$21("p", null, "上面写的是这项研究想凑齐的人数，正在招募。现在不显示已经有多少人，也不把人数当成你的结果。") : h$21("p", null, `本机参加了 ${props.progress.studies} 项研究。发布合计至少 ${props.progress.min_cohort} 人。`), h$21("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: () => {
					postJson("/api/longpi/science/n-of-1", {
						confirm: true,
						design: "abab"
					}).then(() => props.onChange()).catch((error) => props.onError(error instanceof Error ? error.message : "没有排好"));
				}
			}, "开始个人对照")), h$21("section", {
				className: "lp-section",
				id: "lp-science-pulse"
			}, h$21("p", { className: "lp-kicker" }, "大家的结果"), props.pulse ? h$21("h2", { className: "lp-h2" }, props.pulse.headline_zh) : h$21("h2", { className: "lp-h2" }, "还没有大家的结果"), h$21("p", null, props.pulse?.detail_zh || props.give_back_zh)), h$21("section", {
				className: "lp-section",
				id: "lp-science-vote"
			}, h$21("h2", { className: "lp-h2" }, "下个赛季想先看哪一件"), h$21("div", {
				role: "radiogroup",
				"aria-label": "下个赛季的题目"
			}, ...props.voting.topics.map((item) => h$21("label", {
				key: item.id,
				className: "lp-sci-topic"
			}, h$21("input", {
				type: "radio",
				name: "lp-science-topic",
				value: item.id,
				checked: topic === item.id,
				onChange: () => setTopic(item.id)
			}), ` ${item.title_zh}`, h$21("span", { className: "lp-muted" }, ` ${item.votes}`)))), h$21("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: vote,
				disabled: !topic
			}, "记下我的一票"), h$21("p", { className: "lp-muted" }, props.voting.note_zh)), h$21("section", {
				className: "lp-section",
				id: "lp-science-cards"
			}, h$21("h2", { className: "lp-h2" }, "贡献卡"), h$21("p", { className: "lp-muted" }, "贡献卡是你在这台电脑上参加研究之后留下的一张卡。它和化验结果好坏无关。"), props.cards.length === 0 ? h$21("p", { className: "lp-muted" }, "完成本机计算后会出现在这里。") : props.cards.map((card) => h$21("article", {
				key: card.id,
				className: "lp-card"
			}, h$21("h3", null, card.title_zh), h$21("p", null, card.body_zh)))));
		}
		//#endregion
		//#region src/science/plain-copy.ts
		const PLAIN_QUESTIONS = {
			live: {
				question_zh: "现在会把你的检查数据发出这台电脑吗？",
				options_zh: [
					"会，马上就发",
					"不会。研究正式开始前，只保存在你的设备上",
					"你一点同意就会发出去"
				]
			},
			who: {
				question_zh: "下面谁先不参加这个走路的小试验？",
				options_zh: [
					"谁都可以，包括正在打胰岛素的人",
					"正在打胰岛素，或在吃容易让血糖过低的药的人，先不参加",
					"只有不满 18 岁的人可以"
				]
			},
			claim: {
				question_zh: "结果会怎么说？",
				options_zh: [
					"说走路治好了血糖",
					"只说两种走法之后血糖差多少，以及这个差别靠不靠得住",
					"建议你把药停了"
				]
			},
			leave: {
				question_zh: "离开这台电脑的是什么？",
				options_zh: [
					"你的原始化验单",
					"只有看不出是谁的合计数字，不是原始化验单",
					"你的基因数据"
				]
			},
			quit: {
				question_zh: "想退出时怎么办？",
				options_zh: [
					"退不出来",
					"随时可以退出。还没发出的那一份会删掉，已经发出的合计不会收回",
					"要等研究结束才能退"
				]
			},
			dx: {
				question_zh: "这个结果能当作诊断吗？",
				options_zh: [
					"能，它可以下诊断",
					"不能。它只说明起伏有多大，看病还是找医生",
					"可以代替看医生"
				]
			}
		};
		//#endregion
		//#region src/client/science/consent.ts
		const h$20 = react.default.createElement;
		const PLAIN = PLAIN_QUESTIONS;
		function ConsentPanel(props) {
			const questions = props.study.questions.slice(0, 2);
			const [picked, setPicked] = react.default.useState({});
			const [note, setNote] = react.default.useState("");
			const ready = questions.every((question) => typeof picked[question.id] === "number");
			const submit = () => {
				const answers = questions.map((question) => ({
					id: question.id,
					choice: picked[question.id] ?? -1
				}));
				postJson("/api/longpi/science/consent", {
					confirm: true,
					plain: true,
					bundled_with_product: false,
					study_id: props.study.id,
					answers,
					explained_by: "page"
				}).then(() => {
					setNote("已记下。研究正式开始后才会发出，现在只保存在你的设备上。");
					props.onChange();
				}).catch((error) => props.onError(error instanceof Error ? error.message : "没有记下"));
			};
			const withdraw = () => {
				postJson("/api/longpi/science/withdraw", {
					study_id: props.study.id,
					confirm: true
				}).then(() => {
					setNote("已退出。");
					props.onChange();
				}).catch((error) => props.onError(error instanceof Error ? error.message : "没有退出"));
			};
			const state = props.study.consented === "granted" ? "已参加" : props.study.consented === "withdrawn" ? "已退出" : "未参加";
			return h$20("article", {
				className: "lp-card",
				id: `lp-study-${props.study.id}`
			}, h$20("p", { className: "lp-kicker" }, `${state} · ${props.study.kind === "community_season" ? "社区赛季" : "研究"}`), h$20("h2", { className: "lp-h2" }, props.study.title_zh), h$20("p", null, props.study.summary_zh), h$20("p", { className: "lp-muted" }, "加入之后，研究正式开始才会把合计发出去。现在只保存在你的设备上。基因和姓名不参加。"), h$20("details", null, h$20("summary", null, "完整同意书"), h$20("p", null, props.study.text_zh)), ...questions.map((question) => {
				const plain = PLAIN[question.id];
				const title = plain?.question_zh ?? question.question_zh;
				const options = plain?.options_zh ?? question.options_zh;
				return h$20("fieldset", {
					key: question.id,
					className: "lp-sci-q"
				}, h$20("legend", null, title), ...options.map((option, index) => h$20("label", { key: option }, h$20("input", {
					type: "radio",
					name: `${props.study.id}-${question.id}`,
					checked: picked[question.id] === index,
					onChange: () => setPicked({
						...picked,
						[question.id]: index
					})
				}), ` ${option}`)));
			}), h$20("div", { className: "lp-actions" }, h$20("button", {
				type: "button",
				className: "lp-btn",
				disabled: !ready,
				onClick: submit
			}, "加入"), h$20("button", {
				type: "button",
				onClick: () => {
					postJson("/api/longpi/science/invite", { decision: "later" }).then(() => setNote("以后再说。本机上的功能还在。")).catch(() => setNote("以后再说。"));
				}
			}, "以后再说"), props.study.consented === "granted" ? h$20("button", {
				type: "button",
				onClick: withdraw
			}, "退出这项研究") : null, h$20("span", { className: "lp-muted" }, "已经发出的合计不会收回。")), note ? h$20("p", { className: "lp-muted" }, note) : null);
		}
		//#endregion
		//#region src/client/science/translog.ts
		const h$19 = react.default.createElement;
		function TranslogPanel(props) {
			return h$19("section", {
				className: "lp-section",
				id: "lp-science-log"
			}, h$19("h2", { className: "lp-h2" }, "发出记录"), h$19("p", { className: "lp-muted" }, "这里只记离开这台电脑的东西：什么时候、发给哪一项研究。"), props.rows.length === 0 ? h$19("p", { className: "lp-muted" }, "还没有东西离开这台电脑。") : h$19("ol", { className: "lp-sci-log" }, ...props.rows.map((row) => h$19("li", { key: row.seq }, h$19("span", { className: "lp-muted" }, row.at.slice(0, 16).replace("T", " ")), ` ${scrubVisible(row.detail_zh)}`))));
		}
		//#endregion
		//#region src/client/science/studies-tab.ts
		const h$18 = react.default.createElement;
		const CSS$1 = `
.lp-sci-bar { height: 10px; background: var(--lp-line-2, #e6eaf0); border-radius: 99px; overflow: hidden; }
.lp-sci-bar > span { display: block; height: 100%; background: var(--lp-accent, #1f6feb); }
.lp-sci-topic, .lp-sci-q label, .lp-sci-confirm { display: block; margin: 6px 0; }
.lp-sci-log { padding-left: 18px; }
`;
		function StudiesTab() {
			const [data, setData] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/science/community").then(setData).catch((reason) => setError(errorText(reason, "没有读到研究")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			if (!data) return h$18("p", { className: "lp-muted" }, error || "正在读取研究…");
			if (data.mode === "off") return h$18("section", { className: "lp-section" }, h$18("h2", { className: "lp-h2" }, "研究没有打开"), h$18("p", null, data.reason_zh || "可以在设置里再打开。不满 18 岁不参加研究。"));
			return h$18("div", { className: "lp-science" }, h$18("style", null, CSS$1), error ? h$18("p", { role: "alert" }, error) : null, h$18("p", { className: "lp-banner" }, data.reason_zh), data.progress && data.voting ? h$18(CommunityPanel, {
				progress: data.progress,
				pulse: data.pulse ?? null,
				give_back_zh: data.give_back_zh ?? "",
				voting: data.voting,
				cards: data.cards ?? [],
				thresholds: data.thresholds,
				early_zh: data.early_zh,
				release_stays_zh: data.release_stays_zh,
				onChange: load,
				onError: setError
			}) : null, ...(data.studies ?? []).map((study) => h$18(ConsentPanel, {
				key: study.id,
				study,
				onChange: load,
				onError: setError
			})), h$18(TranslogPanel, { rows: data.translog ?? [] }));
		}
		//#endregion
		//#region src/client/science/index.ts
		const h$17 = react.default.createElement;
		function ScienceToolCard(props) {
			const call = parseCall(props.block);
			const result = call.result;
			const title = props.toolName === "record_study_consent" ? "研究同意" : props.toolName === "design_n_of_1" ? "个人对照" : "研究";
			const text = typeof result?.say_zh === "string" ? result.say_zh : typeof result?.result_zh === "string" ? result.result_zh : call.state === "running" ? "正在读取…" : call.error || "完成";
			return h$17("div", { className: "lp lp-tool lp-tool-card" }, h$17("div", { className: "lp-tool-head" }, h$17("span", { className: "lp-tool-title" }, title)), h$17("p", null, text));
		}
		function ScienceSettings() {
			return h$17("section", { className: "lp-section" }, h$17("h2", { className: "lp-h2" }, "研究"), h$17("p", null, "研究正式开始后才会发出，现在只保存在你的设备上。"), h$17("p", null, h$17("a", { href: "/api/longpi/science/community?view=page" }, "打开研究页")));
		}
		/** Call from client/modules.ts. Safe to call once. */
		function registerScienceClient() {
			registerPageTab({
				id: "science",
				label_zh: "研究",
				order: 60,
				Component: StudiesTab
			});
			registerSettingsSection({
				id: "science",
				order: 40,
				Component: ScienceSettings
			});
			for (const tool of [
				"list_studies",
				"explain_study",
				"design_n_of_1",
				"record_study_consent",
				"withdraw_from_study"
			]) registerToolView({
				tool,
				Component: ScienceToolCard
			});
		}
		//#endregion
		//#region src/client/modules.ts
		let once = false;
		function registerClientModules() {
			if (once) return;
			once = true;
			registerAdviceCard();
			registerPrivacyClient();
			registerScienceClient();
		}
		//#endregion
		//#region src/client/datain/findings.ts
		const h$16 = react.default.createElement;
		const KIND_ZH$1 = {
			"ti-rads": "甲状腺超声",
			"bi-rads": "乳腺超声",
			nodule: "结节",
			ultrasound: "超声",
			conclusion: "结论",
			advice: "医师建议",
			wrong_person: "不是这份档案",
			genetics: "基因报告"
		};
		function FindingsList(props) {
			const [rows, setRows] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			react.default.useEffect(() => {
				let gone = false;
				getJson("/api/longpi/findings").then((body) => {
					if (!gone) setRows(Array.isArray(body.findings) ? body.findings : []);
				}).catch((err) => {
					if (!gone) setError(errorText(err, "没有读到报告叙述"));
				});
				return () => {
					gone = true;
				};
			}, [props.reloadKey]);
			if (error) return h$16("p", {
				className: "lp-form-error",
				role: "alert"
			}, error);
			if (!rows) return h$16("p", { className: "lp-muted" }, "正在读取报告叙述…");
			if (rows.length === 0) return h$16("p", {
				className: "lp-muted",
				id: "lp-findings-empty"
			}, "还没有从报告里记下超声、总检或医师建议。已经放进来的报告，打开健康页后会读到超声分级；也可以把 PDF 发到健康对话。");
			return h$16("ul", {
				className: "lp-list",
				id: "lp-findings"
			}, ...rows.map((row) => h$16("li", {
				key: row.id,
				className: row.kind === "wrong_person" ? "lp-found-changes-warn" : ""
			}, h$16("div", { className: "lp-label" }, `${KIND_ZH$1[row.kind] ?? "报告"} ${row.date || ""}`.trim()), h$16("div", null, row.page_note_zh || row.text_zh))));
		}
		//#endregion
		//#region src/client/datain/upload.ts
		const h$15 = react.default.createElement;
		const PIECE = 24576;
		function fileToBuffer(file) {
			return file.arrayBuffer();
		}
		function ReportUpload(props) {
			const [busy, setBusy] = react.default.useState(false);
			const [status, setStatus] = react.default.useState("");
			const [error, setError] = react.default.useState("");
			const [kind, setKind] = react.default.useState("");
			const [confirmStore, setConfirmStore] = react.default.useState(false);
			async function send(file) {
				if (file.size > 33554432) {
					setError("超过 32 MB。叙述版基因报告请发到健康对话，不要从这里整本上传。");
					return;
				}
				if (kind && !confirmStore) {
					setError("请先确认：这份表只留在这台电脑上，不送进体检记录。");
					return;
				}
				setBusy(true);
				setError("");
				setStatus("正在准备…");
				try {
					const bytes = new Uint8Array(await fileToBuffer(file));
					const started = await postJson("/api/longpi/upload", {
						op: "start",
						filename: file.name,
						content_type: file.type || "application/octet-stream",
						size: bytes.length,
						...kind ? {
							type: kind,
							confirm: true
						} : {}
					});
					const id = started.id;
					const total = started.total ?? 1;
					if (!id) throw new Error("没有开始上传");
					for (let index = 0; index < total; index += 1) {
						const slice = bytes.subarray(index * PIECE, (index + 1) * PIECE);
						let binary = "";
						for (const byte of slice) binary += String.fromCharCode(byte);
						setStatus(`正在上传 ${index + 1}/${total}`);
						await postJson("/api/longpi/upload", {
							op: "chunk",
							id,
							index,
							b64: btoa(binary)
						});
					}
					setStatus("正在读这份报告…");
					const done = await postJson("/api/longpi/upload", {
						op: "finish",
						id
					});
					setStatus(done.read_back_zh || "已处理");
					props.onDone?.();
				} catch (err) {
					setError(errorText(err, "没有传上去"));
					setStatus("");
				} finally {
					setBusy(false);
				}
			}
			return h$15("div", { id: "lp-report-upload" }, h$15("label", {
				className: "lp-fine",
				htmlFor: "lp-upload-kind"
			}, "文件类型"), h$15("select", {
				id: "lp-upload-kind",
				className: "lp-input",
				value: kind,
				disabled: busy,
				onChange: (event) => setKind(event.target.value)
			}, h$15("option", { value: "" }, "体检报告（PDF 或照片）"), h$15("option", { value: "methylation" }, "甲基化位点表"), h$15("option", { value: "taxa" }, "菌群表"), h$15("option", { value: "proteins" }, "蛋白表"), h$15("option", { value: "conditions" }, "诊断编码")), kind ? h$15("label", {
				className: "lp-check",
				htmlFor: "lp-upload-confirm"
			}, h$15("input", {
				id: "lp-upload-confirm",
				type: "checkbox",
				checked: confirmStore,
				disabled: busy,
				onChange: (event) => setConfirmStore(event.target.checked)
			}), "确认后记在这台电脑上，不送进体检记录") : null, h$15("input", {
				id: "lp-report-file",
				type: "file",
				className: "lp-input",
				accept: "application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,.csv,.tsv,.txt,.json",
				disabled: busy,
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file) send(file);
				}
			}), status ? h$15("p", {
				className: "lp-muted",
				role: "status",
				id: "lp-upload-status"
			}, status) : null, error ? h$15("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$15("p", { className: "lp-fine" }, "也可以直接把 PDF 或照片发到健康对话。"));
		}
		//#endregion
		//#region src/client/datain/index.ts
		const h$14 = react.default.createElement;
		function GeneticsCard() {
			const [row, setRow] = react.default.useState(void 0);
			react.default.useEffect(() => {
				let gone = false;
				getJson("/api/longpi/findings").then((body) => {
					if (!gone) setRow(body.genetics ?? null);
				}).catch(() => {
					if (!gone) setRow(null);
				});
				return () => {
					gone = true;
				};
			}, []);
			if (!row) return h$14("p", {
				className: "lp-muted",
				id: "lp-genetics-empty"
			}, "还没有基因摘要。叙述版 PDF 请发到健康对话。普通体检不要选基因文件。");
			return h$14("div", { id: "lp-genetics" }, h$14("p", null, (row.headlines_zh ?? []).join("；") || "已记下基因报告。"), (row.variants ?? []).length > 0 ? h$14("ul", { className: "lp-list" }, ...(row.variants ?? []).slice(0, 12).map((item) => h$14("li", { key: item.rsid }, `${item.note_zh ? `${item.note_zh} ` : ""}${item.rsid} ${item.genotype}`))) : null, h$14("ul", { className: "lp-list" }, ...(row.caveats_zh ?? []).map((line) => h$14("li", { key: line }, line))), row.raw_export_zh ? h$14("p", { className: "lp-fine" }, row.raw_export_zh) : null, row.sample_id ? h$14("p", { className: "lp-fine" }, `样本号存在这台电脑上，不会发给模型。`) : null);
		}
		function MedsForm() {
			const [name, setName] = react.default.useState("");
			const [dose, setDose] = react.default.useState("");
			const [times, setTimes] = react.default.useState("");
			const [lines, setLines] = react.default.useState([]);
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/meds").then((body) => setLines(body.lines ?? [])).catch(() => setLines([]));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			async function save() {
				setError("");
				try {
					await postJson("/api/longpi/meds", {
						name,
						dose_text: dose,
						frequency_text: times
					});
					setName("");
					setDose("");
					setTimes("");
					load();
				} catch (err) {
					setError(errorText(err, "没有记下"));
				}
			}
			return h$14("div", { id: "lp-meds" }, lines.length > 0 ? h$14("ul", { className: "lp-list" }, ...lines.map((line) => h$14("li", { key: line }, line))) : h$14("p", { className: "lp-muted" }, "还没有你让 LongPi 记下的药。"), h$14("div", { className: "lp-field" }, h$14("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-name"
			}, "药名"), h$14("input", {
				id: "lp-med-name",
				className: "lp-input",
				value: name,
				onChange: (event) => setName(event.target.value)
			})), h$14("div", { className: "lp-field" }, h$14("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-dose"
			}, "用法", h$14("span", { className: "lp-optional" }, "照处方抄，可不填")), h$14("input", {
				id: "lp-med-dose",
				className: "lp-input",
				value: dose,
				placeholder: "10 mg",
				onChange: (event) => setDose(event.target.value)
			})), h$14("div", { className: "lp-field" }, h$14("input", {
				id: "lp-med-times",
				className: "lp-input",
				value: times,
				placeholder: "每天早上一次",
				onChange: (event) => setTimes(event.target.value)
			})), error ? h$14("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$14(Btn, {
				type: "button",
				size: "sm",
				disabled: !name.trim(),
				onClick: () => {
					save();
				}
			}, "记下这味药"));
		}
		function ConditionsForm() {
			const [name, setName] = react.default.useState("");
			const [rows, setRows] = react.default.useState([]);
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/conditions").then((body) => setRows(body.conditions ?? [])).catch(() => setRows([]));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			async function save() {
				setError("");
				try {
					await postJson("/api/longpi/conditions", {
						name_zh: name,
						state: "current"
					});
					setName("");
					load();
				} catch (err) {
					setError(errorText(err, "没有记下"));
				}
			}
			return h$14("div", { id: "lp-conditions" }, h$14("p", { className: "lp-fine" }, "诊断记在这台电脑上。体检原件那边不接收病情。"), rows.length > 0 ? h$14("ul", { className: "lp-list" }, ...rows.map((row) => h$14("li", { key: row.id }, row.text_zh))) : null, h$14("div", { className: "lp-field" }, h$14("label", {
				className: "lp-field-label",
				htmlFor: "lp-cond-name"
			}, "病情或诊断"), h$14("input", {
				id: "lp-cond-name",
				className: "lp-input",
				value: name,
				placeholder: "脂肪肝",
				onChange: (event) => setName(event.target.value)
			})), error ? h$14("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$14(Btn, {
				type: "button",
				size: "sm",
				disabled: !name.trim(),
				onClick: () => {
					save();
				}
			}, "记下"));
		}
		function DataInSection() {
			const [tick, setTick] = react.default.useState(0);
			return h$14("div", {
				className: "lp-grid-2 lp-grid-top",
				id: "lp-datain"
			}, h$14("div", {
				className: "lp-card",
				id: "lp-findings-card"
			}, h$14("div", { className: "lp-label" }, "报告里的叙述"), h$14(FindingsList, { reloadKey: tick }), h$14(ReportUpload, { onDone: () => setTick((value) => value + 1) })), h$14("div", { className: "lp-card" }, h$14("div", { className: "lp-label" }, "用药"), h$14(MedsForm), h$14("div", { className: "lp-label" }, "病情"), h$14(ConditionsForm), h$14("div", { className: "lp-label" }, "基因"), h$14(GeneticsCard)));
		}
		//#endregion
		//#region src/client/profile-tab.ts
		const h$13 = react.default.createElement;
		/** Where the connection is set: the LongPi page in DSH's settings, or here when settings cannot be opened from the page. */
		function ConnectionCard(props) {
			const { data } = useConnection();
			const openSettings = useSettingsOpener();
			const [editing, setEditing] = react.default.useState(false);
			return h$13("div", {
				className: "lp-card",
				id: "lp-connection-card"
			}, h$13("div", { className: "lp-card-head" }, h$13("div", { className: "lp-label" }, "数据连接"), openSettings ? h$13("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => openSettings("longpi")
			}, "在设置中修改 →") : h$13("button", {
				type: "button",
				className: "lp-row-link",
				"aria-expanded": editing,
				onClick: () => setEditing((current) => !current)
			}, editing ? "收起" : "修改连接")), data ? h$13(ConnectionStatus, { connection: data }) : h$13(RecordsStatusLine, { journey: props.journey }), editing && !openSettings ? h$13(ConnectionForm, {
				connection: data,
				idPrefix: "lp-profile-conn",
				onSaved: () => setEditing(false)
			}) : null, openSettings ? null : h$13("p", { className: "lp-fine" }, "也可以在 DSH 左下角的“设置 → LongPi”中修改。"));
		}
		function ProfileTab(props) {
			const { journey } = props;
			const today = journey.today;
			return h$13("div", { className: "lp-tab-body" }, h$13(Section, {
				id: "lp-profile-section",
				title: "档案与自测",
				kicker: "只保存在这台电脑上"
			}, h$13("div", { className: "lp-grid-2 lp-grid-top" }, h$13("div", {
				className: "lp-card",
				id: "lp-profile-card"
			}, h$13("div", { className: "lp-label" }, "档案"), h$13(ProfileEditor, {
				journey,
				variant: "page",
				idPrefix: "lp-profile",
				onNotice: props.onNotice
			})), h$13("div", {
				className: "lp-card",
				id: "lp-self-card"
			}, h$13("div", { className: "lp-label" }, "自测", h$13("span", { className: "lp-optional" }, "腰围 · 家庭血压 · 体重")), h$13(SelfLatestList, { latest: journey.self.latest }), h$13(SelfMeasureForm, {
				journey,
				idPrefix: "lp-self",
				onNotice: props.onNotice
			}), h$13("p", { className: "lp-fine" }, "家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。早晚各量一次、每次坐着休息 5 分钟后再量。"), h$13(SelfRecent, { onNotice: props.onNotice })))), h$13(DataInSection), journey.addons.length > 0 ? h$13("div", {
				className: "lp-card",
				id: "lp-addons-card"
			}, h$13("div", { className: "lp-label" }, "下次体检加测", h$13("span", { className: "lp-optional" }, `${journey.addons.length} 项，加上就能算出更多结果`)), h$13(AddonList, {
				journey,
				onNotice: props.onNotice,
				idPrefix: "lp-profile-addons"
			})) : null, h$13("div", { className: "lp-grid-2 lp-grid-top" }, h$13(ConnectionCard, { journey }), h$13("div", {
				className: "lp-card",
				id: "lp-export-card"
			}, h$13("div", { className: "lp-label" }, "导出"), h$13("p", { className: "lp-muted" }, "报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；日历文件包含复测日期和每天的打卡提醒。"), h$13("div", { className: "lp-form-actions" }, h$13(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: `longpi-report-${today}.md`
			}, "导出报告"), h$13(LinkButton, {
				href: "/api/longpi/calendar.ics",
				icon: "calendar",
				download: "longpi.ics"
			}, "加入日历")), h$13("p", { className: "lp-fine" }, h$13(Icon, {
				name: "lock",
				size: 12
			}), " 导出的文件留在你的电脑上，LongPi 不会发给任何人。"))), ...profileSections().map((section) => h$13(section.Component, {
				key: section.id,
				journey,
				onNotice: props.onNotice
			})));
		}
		//#endregion
		//#region src/client/engage/nudge-pill.ts
		const h$12 = react.default.createElement;
		function turnBusy() {
			if (typeof document === "undefined") return false;
			return Boolean(document.querySelector("[data-streaming=\"true\"], button[aria-label=\"停止\"], button[aria-label=\"停止生成\"], button[aria-label=\"Stop\"]"));
		}
		function NudgeOffer(props) {
			const [busy, setBusy] = react.default.useState(false);
			react.default.useEffect(() => {
				if (!props.offer) return void 0;
				const timer = window.setInterval(() => setBusy(turnBusy()), 1e3);
				return () => window.clearInterval(timer);
			}, [props.offer]);
			if (!props.offer || busy || turnBusy()) return null;
			return h$12("div", {
				className: "lp",
				role: "status",
				style: {
					position: "static",
					marginTop: 8,
					maxWidth: "100%",
					padding: "8px 10px",
					borderRadius: 12,
					background: "var(--lp-layer-2)",
					color: "var(--lp-ink)",
					fontSize: 13,
					lineHeight: "18px"
				}
			}, h$12("div", null, "要不要在别的对话里，偶尔看到一句这个赛季的事？默认关闭。"), h$12("div", { style: {
				display: "flex",
				gap: 8,
				marginTop: 6
			} }, h$12("button", {
				type: "button",
				onClick: props.onAccept,
				style: buttonStyle$3
			}, "偶尔一句"), h$12("button", {
				type: "button",
				onClick: props.onDismiss,
				style: buttonStyle$3
			}, "不用")));
		}
		const buttonStyle$3 = {
			border: "1px solid var(--lp-line, #ddd)",
			background: "transparent",
			borderRadius: 999,
			padding: "2px 8px",
			cursor: "pointer",
			color: "inherit",
			font: "inherit"
		};
		//#endregion
		//#region src/client/engage/codex.ts
		const h$11 = react.default.createElement;
		function CodexPanel(props) {
			const codex = props.codex;
			if (!codex) return null;
			if (codex.hidden) return h$11("section", null, h$11("h3", { style: {
				margin: "8px 0 4px",
				fontSize: 14
			} }, "长寿图鉴"), h$11("p", { style: { margin: 0 } }, codex.reason_zh || "图鉴没有打开。"), codex.reason_zh.includes("已关闭") ? h$11("button", {
				type: "button",
				onClick: () => props.onOpt(true),
				style: buttonStyle$2
			}, "重新打开") : null);
			return h$11("section", null, h$11("h3", { style: {
				margin: "8px 0 4px",
				fontSize: 14
			} }, "长寿图鉴"), h$11("p", { style: {
				margin: "0 0 8px",
				lineHeight: 1.5
			} }, CODEX_INTRO), h$11("details", null, h$11("summary", null, "概率说明"), h$11("ul", { style: {
				margin: "8px 0",
				paddingLeft: 18,
				lineHeight: 1.5
			} }, h$11("li", null, "铜：细胞实验。"), h$11("li", null, "银：动物实验。"), h$11("li", null, "紫：观察人群。"), h$11("li", null, "金：分组做的人体试验，和几种长寿动物。"), h$11("li", null, "颜色不代表身体好坏。"), h$11("li", null, "连续 10 次里，至少有一次是银或更好。这不是指标变好了。"), codex.odds_zh ? h$11("li", null, codex.odds_zh) : null)), h$11("p", { style: { margin: "0 0 8px" } }, `可抽 ${codex.draws_available} 次 · 今天已抽 ${codex.draws_today} / ${codex.daily_cap}`), h$11("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, h$11("button", {
				type: "button",
				onClick: props.onDraw,
				disabled: props.busy || codex.draws_available < 1,
				style: buttonStyle$2
			}, "抽一张"), h$11("button", {
				type: "button",
				onClick: () => props.onOpt(false),
				style: buttonStyle$2
			}, "关闭图鉴")), props.note ? h$11("p", { style: { margin: "8px 0 0" } }, props.note) : null, codex.owned.length === 0 ? h$11("p", { style: { opacity: .7 } }, "还没有抽到卡。次数只从测量、记录、就诊或复测来。") : h$11("ul", { style: {
				paddingLeft: 18,
				margin: "8px 0"
			} }, codex.owned.slice(0, 12).map((card) => h$11("li", { key: card.id }, h$11("div", null, `${card.rarity_zh} · ${card.title_zh}`), card.family === "insight" ? h$11("div", null, card.body_zh) : null, card.offer ? h$11("div", null, card.offer.text_zh) : null, card.offer?.kind === "run" && props.onRun ? h$11("button", {
				type: "button",
				style: buttonStyle$2,
				disabled: props.busy,
				onClick: () => props.onRun?.(card.id)
			}, "用我的记录算") : null))));
		}
		const buttonStyle$2 = {
			border: "1px solid var(--lp-line-2, rgba(0,0,0,.12))",
			background: "transparent",
			borderRadius: 999,
			padding: "4px 10px",
			cursor: "pointer",
			color: "var(--lp-ink)",
			font: "inherit"
		};
		//#endregion
		//#region src/client/engage/streak.ts
		const h$10 = react.default.createElement;
		function StreakLine(props) {
			const streak = props.streak;
			if (!streak) return null;
			const frozen = streak.frozen.length;
			return h$10("div", { style: {
				display: "flex",
				flexWrap: "wrap",
				gap: 8,
				alignItems: "center"
			} }, h$10("span", null, `连续 ${streak.current} 天`), h$10("span", { style: { opacity: .7 } }, `最好 ${streak.best} 天`), h$10("span", { style: { opacity: .7 } }, frozen > 0 ? `冻结 ${frozen} 天` : `还可冻结 ${streak.freezes_available} 天`), h$10("button", {
				type: "button",
				onClick: () => props.onFreeze("sick"),
				disabled: props.busy,
				style: buttonStyle$1
			}, "今天生病"), h$10("button", {
				type: "button",
				onClick: () => props.onFreeze("travel"),
				disabled: props.busy,
				style: buttonStyle$1
			}, "今天出行"));
		}
		const buttonStyle$1 = {
			border: "1px solid var(--lp-line-2, rgba(0,0,0,.12))",
			background: "transparent",
			borderRadius: 999,
			padding: "4px 10px",
			cursor: "pointer",
			color: "var(--lp-ink)",
			font: "inherit"
		};
		//#endregion
		//#region src/client/engage/season-tab.ts
		function actionForQuest(title) {
			if (/简报|看过医生/.test(title)) return {
				action: "care_visit",
				with_brief: true
			};
			if (/约|医生/.test(title)) return { action: "book" };
			if (/铁蛋白/.test(title)) return {
				action: "addon",
				key: "ferritin"
			};
			if (/C 反应|CRP|超敏/.test(title)) return {
				action: "addon",
				key: "hscrp"
			};
			if (/腰围/.test(title)) return {
				action: "addon",
				key: "waist"
			};
			if (/复测|复查/.test(title)) return { action: "retest" };
			return { action: "book" };
		}
		const h$9 = react.default.createElement;
		function SeasonPanel(props) {
			const season = props.view.season;
			if (props.view.invite?.show) return h$9("div", {
				className: "lp-season-invite",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 8
				}
			}, h$9("h2", { style: {
				margin: 0,
				fontSize: 18
			} }, props.view.invite.title_zh), h$9("p", { style: { margin: 0 } }, props.view.invite.body_zh), props.view.subject_zh ? h$9("p", { style: { margin: 0 } }, `这个赛季用的是${props.view.subject_zh}的年龄和性别。`) : null, h$9("a", { href: props.view.invite.odds_path }, "概率说明"), h$9("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onAction({ action: "opt_in" })
			}, "开始这个赛季"), h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onAction({ action: "decline_invite" })
			}, "先不用")), props.note ? h$9("p", { style: { margin: 0 } }, props.note) : null);
			if (props.view.pressure !== true) return h$9("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 8
			} }, h$9("p", { style: { margin: 0 } }, "这个赛季先不推。想开始时点下面。"), h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onAction({ action: "opt_in" })
			}, "开始这个赛季"), props.view.streak.frozen.length > 0 ? h$9(StreakLine, {
				streak: props.view.streak,
				onFreeze: props.onFreeze,
				busy: props.busy
			}) : null, props.note ? h$9("p", { style: { margin: 0 } }, props.note) : null);
			const shown = props.view.quests.slice(0, 5);
			const ratio = season ? Math.min(1, season.week / Math.max(1, season.weeks)) : 0;
			return h$9("div", {
				className: "lp-season",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 12
				}
			}, season ? h$9("div", null, h$9("h2", { style: {
				margin: 0,
				fontSize: 20
			} }, `本赛季 · 第 ${season.week} 周 / 共 ${season.weeks} 周`), h$9("p", {
				className: "lp-muted",
				style: { margin: "6px 0" }
			}, SEASON_INTRO), h$9("p", { style: {
				margin: "0 0 8px",
				fontWeight: 600
			} }, season.title_zh), props.view.subject_zh ? h$9("p", {
				className: "lp-caption",
				style: { margin: 0 }
			}, `按${props.view.subject_zh}的记录`) : null, h$9("div", {
				className: "lp-season-bar-track",
				"aria-label": `本赛季进度 ${season.week} / ${season.weeks}`
			}, h$9("span", { style: { width: `${Math.round(ratio * 100)}%` } })), h$9("p", {
				className: "lp-caption",
				style: { margin: "8px 0 0" }
			}, season.retest_day ? `复查 ${season.retest_day}` : `${season.start} → ${season.end}`)) : h$9("p", null, "这一赛季还没有开始。"), h$9("div", { className: "lp-quest-grid" }, ...shown.map((quest) => h$9("button", {
				key: quest.id,
				type: "button",
				className: "lp-quest-card",
				disabled: props.busy,
				onClick: () => props.onAction(actionForQuest(quest.title_zh))
			}, h$9("span", { className: "lp-caption" }, quest.status === "done" ? "做完了" : `${quest.progress}/${quest.count}`), h$9("span", { className: "lp-strong" }, quest.title_zh)))), h$9("div", { className: "lp-life-row" }, h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onFreeze("sick")
			}, "今天生病"), h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onFreeze("travel")
			}, "今天出行"), h$9("span", { className: "lp-caption" }, "生病或出行的这一天：不算中断，也不算完成。")), season?.status === "closed" ? h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onAction({ action: "next_season" })
			}, "开始下一个赛季") : null, season?.recap_zh ? h$9("div", null, h$9("div", { style: { fontWeight: 600 } }, "这一赛季的回看"), h$9("p", { style: { margin: "4px 0 0" } }, season.recap_zh)) : null, props.view.family?.available ? h$9("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, props.view.family.opted ? h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onAction({ action: "share_recap" })
			}, "把这个赛季的回看发给家人") : h$9("button", {
				type: "button",
				style: buttonStyle,
				disabled: props.busy,
				onClick: () => props.onAction({ action: "family_on" })
			}, "打开家人圈")) : null, h$9(CodexPanel, {
				codex: props.view.codex,
				onDraw: props.onDraw,
				onOpt: props.onOpt,
				onRun: props.onRun,
				busy: props.busy,
				note: props.note
			}));
		}
		const buttonStyle = {
			border: "1px solid var(--lp-line-2, rgba(0,0,0,.12))",
			background: "transparent",
			borderRadius: 999,
			padding: "4px 10px",
			cursor: "pointer",
			color: "var(--lp-ink)",
			font: "inherit"
		};
		//#endregion
		//#region src/client/engage/index.ts
		const h$8 = react.default.createElement;
		function isView(value) {
			return Boolean(value) && typeof value === "object" && "quests" in value;
		}
		function shanghaiDay() {
			return new Intl.DateTimeFormat("en-CA", {
				timeZone: "Asia/Shanghai",
				year: "numeric",
				month: "2-digit",
				day: "2-digit"
			}).format(/* @__PURE__ */ new Date());
		}
		function EngageDock(props = {}) {
			const [view, setView] = react.default.useState(null);
			const [note, setNote] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const [failed, setFailed] = react.default.useState("");
			const load = react.default.useCallback(async () => {
				try {
					const next = await getJson("/api/longpi/season");
					if (!isView(next)) return;
					setView(next);
					setFailed("");
				} catch (error) {
					setFailed(errorText(error, "赛季没有读到"));
				}
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			async function run(path, body) {
				setBusy(true);
				setNote("");
				try {
					const result = await postJson(path, body);
					if (isView(result)) setView(result);
					else if (isView(result.view)) setView(result.view);
					const card = result.card;
					const extra = result.note || result.error || "";
					const drawn = card ? `抽到${card.rarity_zh ?? ""}「${card.title_zh ?? ""}」${card.duplicate ? "（重复）" : ""}` : "";
					const questions = Array.isArray(result.questions_zh) ? result.questions_zh.join(" ") : "";
					setNote([
						drawn,
						questions,
						extra
					].filter(Boolean).join(" "));
					if (!isView(result) && !isView(result.view)) await load();
				} catch (error) {
					setNote(errorText(error, "没有完成"));
				} finally {
					setBusy(false);
				}
			}
			if (!view && !failed) return null;
			const page = props?.variant === "page";
			const panel = view ? h$8(SeasonPanel, {
				view,
				busy,
				note,
				onAction: (body) => {
					run("/api/longpi/season", body);
				},
				onDraw: () => {
					run("/api/longpi/codex/draw", {});
				},
				onRun: (cardId) => {
					run("/api/longpi/codex/run", { card_id: cardId });
				},
				onFreeze: (reason) => {
					const day = shanghaiDay();
					run("/api/longpi/streak-freeze", {
						reason,
						from: day,
						to: day
					});
				},
				onOpt: (on) => {
					run("/api/longpi/nudges", { codex_enabled: on });
				}
			}) : null;
			if (page) return h$8("div", {
				className: "lp lp-season-page",
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 8
				}
			}, failed ? h$8("p", null, failed) : null, panel ?? h$8("p", { className: "lp-muted" }, "赛季正在读取。"), view?.nudge?.offer ? h$8(NudgeOffer, {
				offer: true,
				onAccept: () => {
					run("/api/longpi/nudges", {
						nudge_in_workflow: true,
						offer_seen: true
					});
				},
				onDismiss: () => {
					run("/api/longpi/nudges", {
						dismiss: true,
						offer_seen: true
					});
				}
			}) : null);
			return null;
		}
		/** In-flow season title. Hidden until the person opts in, so it never covers the page. */
		function SeasonBar(props) {
			const [text, setText] = react.default.useState("");
			react.default.useEffect(() => {
				getJson("/api/longpi/season").then((view) => {
					const header = view.header;
					setText(header?.show && header.text_zh ? header.text_zh : "");
				}).catch(() => setText(""));
			}, []);
			if (!text) return null;
			return h$8("button", {
				type: "button",
				className: "lp-season-bar",
				onClick: () => props.onOpen?.()
			}, text);
		}
		function EngageSettingsNote(_props) {
			const [line, setLine] = react.default.useState("没有方案时，有待补的检查或本赛季的小目标，才会每周提醒一次；都没有就不发。");
			react.default.useEffect(() => {
				getJson("/api/longpi/season").then((view) => {
					if (view.reminder_zh) setLine(view.reminder_zh);
					else if (view.needs_consent) setLine("还没有同意使用说明，所以赛季和提醒都还没开始。");
				}).catch(() => {});
			}, []);
			return h$8("p", {
				className: "lp-caption",
				style: { marginTop: 8 }
			}, line);
		}
		function SeasonPage(_props) {
			return EngageDock({ variant: "page" });
		}
		registerPageTab({
			id: "season",
			label_zh: "本季",
			order: 35,
			Component: SeasonPage
		});
		registerSettingsSection({
			id: "season-reminder",
			order: 30,
			Component: EngageSettingsNote
		});
		//#endregion
		//#region src/client/page.ts
		const h$7 = react.default.createElement;
		const TAB_KEY = "dsh-plugin-longpi.page-tab";
		const TABS = [
			{
				key: "overview",
				label: "总览"
			},
			{
				key: "labs",
				label: "化验"
			},
			{
				key: "sleep",
				label: "睡眠"
			},
			{
				key: "training",
				label: "运动"
			},
			{
				key: "calendar",
				label: "日程"
			},
			{
				key: "ask",
				label: "问 LongPi"
			}
		];
		registerClientModules();
		/** How long a request from elsewhere waits for its section to be on screen. */
		const SCROLL_WAIT_MS = 2e3;
		function storedTab(extra) {
			const saved = readPref(TAB_KEY);
			const key = saved ? canonTab(saved) : "overview";
			if (saved && (TABS.some((tab) => tab.key === key) || extra.includes(key) || key === "plan" || key === "profile" || key === "season" || key === "science")) return key;
			return "overview";
		}
		/** Onboarding steps still open, for the banner: none once the record is connected. */
		const OPEN_STAGES = [
			"consent",
			"profile",
			"records"
		];
		function bannerOf(journey) {
			if (!OPEN_STAGES.includes(journey.stage)) return null;
			const index = stepOfStage(journey.stage);
			return {
				left: OPEN_STAGES.length - index,
				title: ONBOARDING_TITLES[index] ?? ""
			};
		}
		function Header(props) {
			const journey = props.journey;
			const today = journey?.today ?? localToday$1();
			const name = journey?.profile.displayName.trim() ?? "";
			const plan = journey?.plan.exists && journey.plan.days != null ? ` · 方案第 ${journey.plan.days} 天` : "";
			return h$7("header", { className: "lp-header" }, h$7("div", { className: "lp-header-text" }, h$7("div", { className: "lp-kicker" }, `LongPi${journey?.version ? ` ${journey.version}` : ""} · 健康`), h$7("h1", { className: "lp-h1" }, `${greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`), h$7("p", { className: "lp-lead" }, `${chineseDate(today)} ${weekday(today)}${plan}`), journey ? h$7(RecordsStatusLine, { journey }) : props.failed ? null : h$7(Skeleton, {
				height: 18,
				width: 240
			})), h$7("div", { className: "lp-actions" }, h$7("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: props.onRefresh,
				disabled: props.refreshing,
				"aria-busy": props.refreshing
			}, h$7(Icon, {
				name: "refresh",
				size: 14,
				className: props.refreshing ? "lp-spin" : ""
			}), props.refreshing ? "刷新中" : "刷新")));
		}
		function Banner(props) {
			const banner = bannerOf(props.journey);
			if (!banner) return null;
			return h$7("button", {
				type: "button",
				className: "lp-banner",
				onClick: props.onOpen
			}, h$7(Icon, {
				name: "spark",
				size: 14
			}), h$7("span", null, `还差 ${banner.left} 步：${banner.title}`), h$7("span", { className: "lp-banner-go" }, "继续 →"));
		}
		function Loading() {
			return h$7("div", {
				className: "lp-loading",
				"aria-busy": true,
				"aria-label": "正在读取"
			}, h$7(Skeleton, {
				height: 36,
				width: 320
			}), h$7("div", { className: "lp-results" }, h$7(Skeleton, {
				height: 180,
				className: "lp-card-skeleton"
			}), h$7(Skeleton, {
				height: 180,
				className: "lp-card-skeleton"
			})), h$7(Skeleton, {
				height: 120,
				className: "lp-card-skeleton"
			}));
		}
		function Failed(props) {
			return h$7("div", {
				className: "lp-card lp-failed",
				role: "alert"
			}, h$7("div", { className: "lp-strong" }, "LongPi 没有读到数据"), h$7("p", { className: "lp-muted" }, `服务返回：${props.error}。通常是刚打开，稍等几秒再试。`), h$7(Btn, {
				variant: "outline",
				size: "sm",
				onClick: props.onRetry
			}, h$7(Icon, {
				name: "refresh",
				size: 14
			}), "重试"));
		}
		/**
		* Take a request from elsewhere (the home, onboarding, a chat card): switch to
		* its tab, apply its filter, then scroll to its section once it is laid out.
		*/
		function useViewRequests(ready, setTab, setFilter) {
			const request = useViewRequest();
			react.default.useEffect(() => {
				if (!request || !ready) return void 0;
				if (request.tab) setTab(request.tab);
				if (request.filter) setFilter(request.filter);
				const target = request.id;
				if (!target) {
					clearViewRequest(request);
					return;
				}
				const started = Date.now();
				const timer = window.setInterval(() => {
					const node = document.getElementById(target);
					const shown = node != null && node.getClientRects().length > 0;
					if (!shown && Date.now() - started < SCROLL_WAIT_MS) return;
					window.clearInterval(timer);
					clearViewRequest(request);
					if (shown) goTo(target);
				}, 100);
				return () => window.clearInterval(timer);
			}, [request, ready]);
		}
		function LongPiPage(props) {
			const root = react.default.useRef(null);
			usePageShown(root);
			const { journey, loading, error, refresh } = useJourney();
			const tracking = useTracking();
			const [notice, notify] = useNotice();
			const [scienceOn, setScienceOn] = react.default.useState(true);
			react.default.useEffect(() => {
				getJson("/api/longpi/science/community").then((row) => {
					setScienceOn(row?.mode !== "off");
				}).catch(() => setScienceOn(true));
			}, []);
			const registered = pageTabs().filter((item) => item.id !== "science" || scienceOn);
			const tabs = TABS;
			const [tab, setTabState] = react.default.useState(storedTab(registered.map((item) => item.id)));
			const [filter, setFilter] = react.default.useState("all");
			const [refreshing, setRefreshing] = react.default.useState(false);
			const [onboarding, setOnboarding] = react.default.useState(false);
			const setTab = react.default.useCallback((next) => {
				const tab = canonTab(next);
				setTabState(tab);
				writePref(TAB_KEY, tab);
			}, []);
			useViewRequests(journey != null, setTab, setFilter);
			const goTab = react.default.useCallback((next, request) => {
				setTab(next);
				if (request?.filter) setFilter(request.filter);
				if (request?.id) {
					const id = request.id;
					window.setTimeout(() => goTo(id), 60);
				}
			}, [setTab]);
			const doRefresh = react.default.useCallback(async () => {
				setRefreshing(true);
				try {
					await refresh(true);
				} finally {
					setRefreshing(false);
				}
			}, [refresh]);
			const onAction = (target) => {
				if (target === "records") goTab("profile", { id: "lp-connection-card" });
				else if (target === "addons") goTab("profile", { id: "lp-addons-card" });
				else if (target === "self") goTab("profile", { id: "lp-self-card" });
				else goTab("profile", { id: "lp-profile-card" });
			};
			const onPrompt = (text) => {
				setPendingPrompt(text);
				const copying = copyText(text);
				if (props.openChat) {
					props.openChat();
					return;
				}
				copying.then((copied) => notify(copied ? "已复制，粘贴到对话里发送即可。" : text, "info"));
			};
			let body;
			if (!journey && loading) body = h$7(Loading);
			else if (!journey) body = h$7(Failed, {
				error: error ?? "没有返回",
				onRetry: () => {
					doRefresh();
				}
			});
			else {
				let panel;
				if (tab === "overview") panel = h$7(Overview, {
					journey,
					tracking: tracking.data,
					onNotice: notify,
					onAction,
					goTab,
					openOnboarding: () => setOnboarding(true)
				});
				else if (tab === "indicators" || tab === "labs") panel = h$7(IndicatorsTab, {
					filter,
					onFilter: setFilter,
					onConnect: () => goTab("profile", { id: "lp-connection-card" }),
					area: "labs"
				});
				else if (tab === "sleep") panel = h$7(SleepTab);
				else if (tab === "training") panel = h$7(TrainingTab);
				else if (tab === "calendar") panel = h$7(CalendarTab, { journey });
				else if (tab === "ask") panel = h$7(AskTab, {
					journey,
					openChat: props.openChat
				});
				else if (tab === "plan") panel = h$7(PlanTab, {
					journey,
					tracking: tracking.data,
					loading: tracking.loading,
					error: tracking.error,
					onNotice: notify,
					onPrompt
				});
				else if (tab === "profile") panel = h$7(ProfileTab, {
					journey,
					onNotice: notify
				});
				else {
					const extra = registered.find((item) => item.id === tab);
					panel = extra ? h$7(extra.Component, {
						journey,
						onNotice: notify
					}) : h$7(ProfileTab, {
						journey,
						onNotice: notify
					});
				}
				body = h$7("div", { className: `lp-body ${refreshing ? "lp-refreshing" : ""}` }, h$7(Banner, {
					journey,
					onOpen: () => setOnboarding(true)
				}), h$7(Tabs, {
					tabs,
					value: tab === "indicators" ? "labs" : tab,
					onChange: setTab,
					label: "LongPi 健康页",
					idPrefix: "lp-page"
				}), h$7(Subnav, {
					onTab: setTab,
					science: scienceOn,
					current: tab
				}), h$7("div", {
					className: "lp-tab-panel",
					role: "tabpanel",
					id: "lp-page-panel",
					"aria-labelledby": `lp-page-tab-${tab}`
				}, panel));
			}
			return h$7("div", {
				className: "lp lp-page-root",
				ref: root
			}, h$7("div", { className: "lp-page" }, h$7(Header, {
				journey,
				failed: !journey && !loading,
				refreshing,
				onRefresh: () => {
					doRefresh();
				}
			}), notice ? h$7("div", { className: "lp-notice-slot" }, notice) : null, journey ? h$7(SeasonBar, { onOpen: () => setTab("season") }) : null, body, h$7("footer", { className: "lp-footer" }, h$7("p", null, journey?.boundary_zh || "模型估计，不是诊断，也不是用药建议，也不是你能活多久。紧急情况请拨打 120。"), h$7("p", { className: "lp-caption" }, "档案、方案和记录只保存在这台电脑上。体检原件留在你原来放报告的地方。对话在你同意之后，才会发给用来回答的人工智能。"))), onboarding ? h$7(Onboarding, {
				explicit: true,
				complete: () => setOnboarding(false),
				openPage: () => {}
			}) : null);
		}
		//#endregion
		//#region src/client/pane.ts
		const h$6 = react.default.createElement;
		/** The tab type's identity in DSH's registry, and the key its body registers under. */
		const PANE_ID = "dsh-plugin-longpi.health";
		/** What openTab names. */
		const PANE_KIND = "longpi-health";
		const PANE_TITLE = "健康";
		let opener = null;
		const listeners = /* @__PURE__ */ new Set();
		/** Set by index.ts while DSH's right column exists: opens (or reveals) the 健康 tab. */
		function setPaneOpener(open) {
			opener = open;
			for (const listener of listeners) listener();
		}
		function usePaneOpener() {
			return react.default.useSyncExternalStore((listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			}, () => opener, () => opener);
		}
		/** DSH's SidebarRightTabDefinition for the 健康 tab: a page type, offered on the column's guide page. */
		function paneDefinition(icon) {
			return {
				id: PANE_ID,
				kind: PANE_KIND,
				priority: "extension",
				title: () => PANE_TITLE,
				guide: [{
					order: 20,
					title: () => PANE_TITLE,
					description: () => "今天的打卡、身体年龄、心血管风险和值得注意的变化",
					icon
				}]
			};
		}
		function HealthPane(props) {
			const { journey, loading, error, refresh } = useJourney();
			const tracking = useTracking();
			const [notice, notify] = useNotice();
			const toPage = (tab, request) => {
				requestView({
					tab,
					...request
				});
				props.openPage?.();
			};
			const onAction = (target) => toPage("profile", { id: target === "records" ? "lp-connection-card" : target === "addons" ? "lp-addons-card" : target === "self" ? "lp-self-card" : "lp-profile-card" });
			let body;
			if (!journey && loading) body = h$6("div", {
				className: "lp-pane-loading",
				"aria-busy": true,
				"aria-label": "正在读取"
			}, h$6(Skeleton, {
				height: 120,
				className: "lp-card-skeleton"
			}), h$6(Skeleton, {
				height: 160,
				className: "lp-card-skeleton"
			}));
			else if (!journey) body = h$6("div", {
				className: "lp-card lp-failed",
				role: "alert"
			}, h$6("p", { className: "lp-muted" }, `没有读到数据：${error ?? "没有返回"}。`), h$6(Btn, {
				variant: "outline",
				size: "sm",
				onClick: () => {
					refresh(true);
				}
			}, h$6(Icon, {
				name: "refresh",
				size: 14
			}), "重试"));
			else body = h$6(Overview, {
				journey,
				tracking: tracking.data,
				onNotice: notify,
				onAction,
				goTab: toPage,
				openOnboarding: () => toPage("overview")
			});
			return h$6("div", { className: "lp lp-pane" }, h$6("div", { className: "lp-pane-head" }, h$6("span", { className: "lp-label" }, h$6(Icon, {
				name: "health",
				size: 14
			}), PANE_TITLE), props.openPage ? h$6("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.openPage
			}, "打开健康页 →") : null), notice ? h$6("div", { className: "lp-notice-slot" }, notice) : null, body, h$6("p", { className: "lp-fine lp-pane-foot" }, journey?.boundary_zh || "模型估计，不是诊断，也不是用药建议，也不是你能活多久。紧急情况请拨打 120。"));
		}
		//#endregion
		//#region src/client/pill.ts
		const h$5 = react.default.createElement;
		const HIDE_KEY = "dsh-plugin-longpi.pill-hidden-on";
		/** Local hour from which open check-ins are worth a nudge. */
		const EVENING_HOUR = 18;
		/** Whether it is evening now, checked again every few minutes. */
		function useEvening() {
			const [evening, setEvening] = react.default.useState(() => (/* @__PURE__ */ new Date()).getHours() >= EVENING_HOUR);
			react.default.useEffect(() => {
				const timer = window.setInterval(() => setEvening((/* @__PURE__ */ new Date()).getHours() >= EVENING_HOUR), 3e5);
				return () => window.clearInterval(timer);
			}, []);
			return evening;
		}
		function Pill(props) {
			const { journey } = useJourney();
			useStoreVersion();
			const today = journey?.today ?? localToday$1();
			const [dismissed, setDismissed] = react.default.useState(() => readPref(HIDE_KEY) === today);
			react.default.useEffect(() => {
				setDismissed(readPref(HIDE_KEY) === today);
			}, [today]);
			const heroShowing = useHeroShowing();
			const evening = useEvening();
			const open = journey ? journey.plan.checkin_items.filter((item) => checkStateOf(journey, item.id) === null) : [];
			if (!journey || open.length === 0 || !evening || dismissed || props.pageShowing || heroShowing) return null;
			const summary = open.map((item) => item.title).join("、");
			return h$5("div", {
				className: "lp lp-pill-wrap",
				role: "status"
			}, h$5("button", {
				type: "button",
				className: "lp-pill-main",
				onClick: () => props.openPage?.(),
				title: summary,
				"aria-label": `LongPi：今天还有 ${open.length} 项没有打卡：${summary}。打开健康页`
			}, h$5("span", { className: "lp-pill-mark" }, h$5(Mark, { size: 14 })), h$5("span", null, "LongPi · 今天还有 ", h$5("span", { className: "lp-pill-count" }, open.length), " 项没打卡")), h$5("button", {
				type: "button",
				className: "lp-pill-x",
				"aria-label": "今天不再提醒",
				onClick: () => {
					writePref(HIDE_KEY, today);
					setDismissed(true);
				}
			}, h$5(Icon, {
				name: "close",
				size: 12
			})));
		}
		function WithPanelInfo(props) {
			const active = props.usePanelInfo((info) => info.activePanelId === PANEL_ID);
			const showing = usePageShowing();
			return h$5(Pill, {
				...props,
				pageShowing: active || showing
			});
		}
		function WithoutPanelInfo(props) {
			const showing = usePageShowing();
			return h$5(Pill, {
				...props,
				pageShowing: showing
			});
		}
		function ReminderPill(props) {
			return typeof props.usePanelInfo === "function" ? h$5(WithPanelInfo, {
				...props,
				usePanelInfo: props.usePanelInfo
			}) : h$5(WithoutPanelInfo, props);
		}
		//#endregion
		//#region src/client/followup.ts
		const h$4 = react.default.createElement;
		const FOLLOWUP_NOTE = "提醒只在 DeepSeek Harness 运行时发送；详细模式会把方案名称和数值发到你配置的渠道。";
		const KIND_ZH = {
			feishu: "飞书",
			wecom: "企业微信",
			dingtalk: "钉钉",
			bark: "Bark",
			generic: "通用 Webhook"
		};
		const KIND_URL = {
			feishu: "https://open.feishu.cn/open-apis/bot/v2/hook/…",
			wecom: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
			dingtalk: "https://oapi.dingtalk.com/robot/send?access_token=…",
			bark: "https://api.day.app/你的 key",
			generic: "https://…（局域网内可用 http://）"
		};
		/** Kinds whose robots sign requests with a shared secret. */
		const SIGNED = ["feishu", "dingtalk"];
		const LOG_ZH = {
			checkin: "打卡提醒",
			retest: "复测提醒",
			weekly: "每周小结",
			nudge: "进度提醒",
			custom: "AI 随访",
			test: "测试"
		};
		const DAYS = [
			"每周一",
			"每周二",
			"每周三",
			"每周四",
			"每周五",
			"每周六",
			"每周日"
		];
		function formOf(settings) {
			return {
				checkin_time: settings.checkin_time,
				retest_time: settings.retest_time,
				weeklyDay: settings.weekly ? String(settings.weekly.day) : "0",
				weeklyTime: settings.weekly?.time ?? "20:00",
				desktop: settings.desktop,
				kind: settings.webhook?.kind ?? "",
				url: "",
				secret: "",
				clearSecret: false,
				detail: settings.detail,
				quietOn: settings.quiet != null,
				quietStart: settings.quiet?.start ?? "22:30",
				quietEnd: settings.quiet?.end ?? "08:00"
			};
		}
		const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
		/** Only what changed goes to the server; an empty URL or secret field means "keep the stored one". */
		function updateOf(form, settings) {
			const body = {};
			if (form.checkin_time !== settings.checkin_time) body.checkin_time = form.checkin_time;
			if (form.retest_time !== settings.retest_time) body.retest_time = form.retest_time;
			const weekly = form.weeklyDay === "0" ? null : {
				day: Number(form.weeklyDay),
				time: form.weeklyTime
			};
			if (!same(weekly, settings.weekly)) body.weekly = weekly;
			if (form.desktop !== settings.desktop) body.desktop = form.desktop;
			if (form.detail !== settings.detail) body.detail = form.detail;
			const quiet = form.quietOn ? {
				start: form.quietStart,
				end: form.quietEnd
			} : null;
			if (!same(quiet, settings.quiet)) body.quiet = quiet;
			if (form.kind === "") {
				if (settings.webhook) body.webhook = null;
			} else {
				const url = form.url.trim();
				const secret = SIGNED.includes(form.kind) ? form.secret || (form.clearSecret ? "" : void 0) : void 0;
				if (!settings.webhook || settings.webhook.kind !== form.kind || url || secret !== void 0) body.webhook = {
					kind: form.kind,
					...url ? { url } : {},
					...secret !== void 0 ? { secret } : {}
				};
			}
			return body;
		}
		const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
		/** A time in the part of a quiet window that runs to midnight is never sent (the server refuses it too). */
		function lostInQuiet(form) {
			if (!form.quietOn || form.quietStart <= form.quietEnd) return null;
			const start = minutesOf(form.quietStart);
			const times = [["打卡提醒", form.checkin_time], ["复测提醒", form.retest_time]];
			if (form.weeklyDay !== "0") times.push(["每周小结", form.weeklyTime]);
			const hit = times.find(([, time]) => minutesOf(time) >= start);
			return hit ? `${hit[0]}的时间 ${hit[1]} 在免打扰时段（${form.quietStart}–${form.quietEnd}）的午夜前部分，当天就发不出去了；请调整时间或免打扰时段。` : null;
		}
		function problemOf(form, settings) {
			const quiet = lostInQuiet(form);
			if (quiet) return quiet;
			if (form.kind === "") return null;
			const url = form.url.trim();
			const stored = settings.webhook?.kind === form.kind;
			if (!url && !stored) return `请填写${KIND_ZH[form.kind]}的 Webhook 地址。`;
			if (url && !/^https?:\/\//i.test(url)) return "Webhook 地址要以 https:// 开头。";
			if (url && /^http:\/\//i.test(url) && form.kind !== "generic") return `${KIND_ZH[form.kind]}的地址要用 https://。`;
			if (form.secret.length > 200) return "签名密钥太长（最多 200 个字符）。";
			return null;
		}
		/** "2026-09-24T21:00:00" (local, as the server sends it) → 今天 21:00. */
		function whenText(iso, today = localToday$1()) {
			if (!iso) return "";
			let date = iso.slice(0, 10);
			let time = iso.slice(11, 16);
			if (/(Z|[+-]\d\d:?\d\d)$/.test(iso)) {
				const at = new Date(iso);
				if (!Number.isNaN(at.getTime())) {
					const pad = (value) => String(value).padStart(2, "0");
					date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
					time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
				}
			}
			const tomorrow = /* @__PURE__ */ new Date(`${today}T12:00:00Z`);
			tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
			return `${date === today ? "今天" : date === tomorrow.toISOString().slice(0, 10) ? "明天" : chineseDate(date)} ${time}`.trim();
		}
		function nextLine(data) {
			const parts = [
				data.next.checkin ? `打卡 ${whenText(data.next.checkin)}` : "",
				data.next.retest ? `复测 ${whenText(data.next.retest)}` : "",
				data.next.weekly ? `小结 ${whenText(data.next.weekly)}` : ""
			].filter(Boolean);
			return parts.length > 0 ? `下次：${parts.join(" · ")}` : "近期没有要发的提醒";
		}
		function TimeField(props) {
			return h$4("div", { className: "lp-field" }, h$4("label", {
				className: "lp-field-label",
				htmlFor: props.id
			}, props.label, props.hint ? h$4("span", { className: "lp-optional" }, props.hint) : null), h$4("input", {
				id: props.id,
				type: "time",
				className: "lp-input lp-input-time",
				value: props.value,
				required: true,
				onChange: (event) => {
					if (event.target.value) props.onChange(event.target.value);
				}
			}));
		}
		function Check(props) {
			return h$4("label", {
				className: `lp-check ${props.disabled ? "lp-check-off" : ""}`,
				htmlFor: props.id
			}, h$4("input", {
				id: props.id,
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled,
				onChange: (event) => props.onChange(event.target.checked)
			}), h$4("span", null, props.children));
		}
		function channelsText(row) {
			const out = [];
			if (row.channels.desktop != null) out.push(`桌面${row.channels.desktop ? "" : " 失败"}`);
			if (row.channels.webhook != null) out.push(`Webhook${row.channels.webhook ? "" : " 失败"}`);
			return out.join("、");
		}
		function Log(props) {
			const rows = [...props.rows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
			return h$4("div", { className: "lp-followup-log" }, h$4("div", { className: "lp-subhead" }, "最近发送", h$4("span", { className: "lp-optional" }, rows.length > 0 ? `最近 ${rows.length} 条` : "")), rows.length === 0 ? h$4("p", { className: "lp-caption" }, "还没有发过提醒。") : h$4("ul", { className: "lp-rows" }, ...rows.map((row, index) => h$4("li", {
				key: `${row.at}-${index}`,
				className: "lp-row"
			}, h$4("span", { className: "lp-row-main" }, h$4("span", { className: "lp-num" }, whenText(row.at)), "  ", h$4("span", null, LOG_ZH[row.kind] ?? row.kind), row.error ? h$4("span", { className: "lp-caption" }, `  ${row.error}`) : null), h$4("span", { className: "lp-row-end" }, channelsText(row) ? h$4("span", { className: "lp-caption" }, channelsText(row)) : null, h$4("span", { className: `lp-sent ${row.ok ? "lp-sent-ok" : "lp-sent-bad"}` }, h$4(Icon, {
				name: row.ok ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), row.ok ? "已发送" : Object.values(row.channels).some(Boolean) ? "部分失败" : "失败"))))));
		}
		function TestResult(props) {
			const rows = [];
			if (props.result.channels.desktop) rows.push({
				name: "桌面通知",
				...props.result.channels.desktop
			});
			if (props.result.channels.webhook) rows.push({
				name: props.kind ? KIND_ZH[props.kind] : "Webhook",
				...props.result.channels.webhook
			});
			if (rows.length === 0) return h$4("span", {
				className: "lp-caption",
				role: "status"
			}, "没有可用的渠道：打开桌面通知或填写 Webhook 后再试。");
			return h$4("span", {
				className: "lp-test-result",
				role: "status"
			}, ...rows.map((row) => h$4("span", {
				key: row.name,
				className: `lp-sent ${row.ok ? "lp-sent-ok" : "lp-sent-bad"}`
			}, h$4(Icon, {
				name: row.ok ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), `${row.name}：${row.ok ? "已发送" : `失败${row.error ? `（${row.error}）` : ""}`}`)));
		}
		function Settings(props) {
			const { data } = props;
			const settings = data.settings;
			const { enabled: _enabled, ...formSettings } = settings;
			const signature = JSON.stringify(formSettings);
			const [form, setForm] = react.default.useState(() => formOf(settings));
			const [saving, setSaving] = react.default.useState(false);
			const [switching, setSwitching] = react.default.useState(false);
			const [testing, setTesting] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const [test, setTest] = react.default.useState(null);
			react.default.useEffect(() => {
				setForm(formOf(settings));
			}, [signature]);
			const set = (key, value) => setForm((current) => ({
				...current,
				[key]: value
			}));
			const update = updateOf(form, settings);
			const dirty = Object.keys(update).length > 0;
			const hasChannel = settings.desktop && data.platform_desktop || settings.webhook != null;
			async function post(body) {
				const result = await postJson("/api/longpi/followup", body);
				if (!result.ok) throw new Error(result.error || "没有保存");
				if (result.settings) putFollowup(result);
				notifyChanged();
				return true;
			}
			async function toggle(next) {
				setSwitching(true);
				setError(null);
				try {
					await post({ enabled: next });
					props.onNotice(next ? "随访提醒已开启。" : "随访提醒已关闭。", "good");
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setSwitching(false);
				}
			}
			async function save() {
				const problem = problemOf(form, settings);
				if (problem) {
					setError(problem);
					return;
				}
				setSaving(true);
				setError(null);
				try {
					await post(update);
					props.onNotice("随访设置已保存。", "good");
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setSaving(false);
				}
			}
			async function sendTest() {
				setTesting(true);
				setTest(null);
				setError(null);
				try {
					setTest(await postJson("/api/longpi/followup/test", {}));
					reload("followup");
				} catch (err) {
					setError(`测试没有发出：${errorText(err, "请稍后再试")}`);
				} finally {
					setTesting(false);
				}
			}
			const kind = form.kind === "" ? null : form.kind;
			const storedSame = kind != null && settings.webhook?.kind === kind;
			return h$4("div", { className: `lp-followup ${props.hideSwitch ? "" : "lp-card"}` }, props.hideSwitch ? null : h$4("div", { className: "lp-followup-head" }, h$4(Switch, {
				id: "lp-followup-on",
				checked: settings.enabled,
				busy: switching,
				disabled: switching,
				label: "开启随访提醒",
				onChange: (next) => {
					toggle(next);
				}
			}), h$4("span", { className: "lp-caption" }, settings.enabled ? hasChannel ? nextLine(data) : "已开启，但还没有可用的渠道：打开桌面通知或填写 Webhook。" : "关闭时不会发送任何提醒。开启后按下面的时间提醒打卡、到期复测和每周小结。")), h$4("div", { className: "lp-grid-2 lp-followup-grid" }, h$4("fieldset", { className: "lp-fieldset" }, h$4("legend", { className: "lp-label" }, "什么时候"), h$4("div", { className: "lp-followup-times" }, h$4(TimeField, {
				id: "lp-fu-checkin",
				label: "打卡提醒",
				hint: "当天还有未完成时",
				value: form.checkin_time,
				onChange: (value) => set("checkin_time", value)
			}), h$4(TimeField, {
				id: "lp-fu-retest",
				label: "复测提醒",
				hint: "到期当天",
				value: form.retest_time,
				onChange: (value) => set("retest_time", value)
			})), h$4("div", { className: "lp-field" }, h$4("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-weekly"
			}, "每周小结"), h$4("div", { className: "lp-input-unit" }, h$4("select", {
				id: "lp-fu-weekly",
				className: "lp-select lp-select-wide",
				value: form.weeklyDay,
				onChange: (event) => set("weeklyDay", event.target.value)
			}, h$4("option", { value: "0" }, "不发送"), ...DAYS.map((label, index) => h$4("option", {
				key: label,
				value: String(index + 1)
			}, label))), form.weeklyDay !== "0" ? h$4("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: form.weeklyTime,
				"aria-label": "每周小结的时间",
				onChange: (event) => {
					if (event.target.value) set("weeklyTime", event.target.value);
				}
			}) : null)), h$4("div", { className: "lp-field" }, h$4(Check, {
				id: "lp-fu-quiet",
				checked: form.quietOn,
				onChange: (checked) => set("quietOn", checked)
			}, "免打扰时段"), form.quietOn ? h$4("div", { className: "lp-input-unit" }, h$4("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: form.quietStart,
				"aria-label": "免打扰开始",
				onChange: (event) => {
					if (event.target.value) set("quietStart", event.target.value);
				}
			}), h$4("span", { className: "lp-unit" }, "至"), h$4("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: form.quietEnd,
				"aria-label": "免打扰结束",
				onChange: (event) => {
					if (event.target.value) set("quietEnd", event.target.value);
				}
			})) : null)), h$4("fieldset", { className: "lp-fieldset" }, h$4("legend", { className: "lp-label" }, "发到哪里"), h$4(Check, {
				id: "lp-fu-desktop",
				checked: form.desktop && data.platform_desktop,
				disabled: !data.platform_desktop,
				onChange: (checked) => set("desktop", checked)
			}, "桌面通知", h$4("span", { className: "lp-caption" }, data.platform_desktop ? "  这台电脑的系统通知" : "  这台电脑的系统不支持")), h$4("div", { className: "lp-field" }, h$4("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-kind"
			}, "Webhook 渠道", h$4("span", { className: "lp-optional" }, "可选：发到手机上的群机器人或 App")), h$4("select", {
				id: "lp-fu-kind",
				className: "lp-select lp-select-wide",
				value: form.kind,
				onChange: (event) => setForm((current) => ({
					...current,
					kind: event.target.value,
					url: "",
					secret: "",
					clearSecret: false
				}))
			}, h$4("option", { value: "" }, "不使用"), ...Object.keys(KIND_ZH).map((key) => h$4("option", {
				key,
				value: key
			}, KIND_ZH[key])))), kind ? h$4("div", { className: "lp-field" }, h$4("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-url"
			}, "地址", storedSame ? h$4("span", { className: "lp-optional" }, `已设置：${settings.webhook?.url_masked}`) : null), h$4("input", {
				id: "lp-fu-url",
				type: "url",
				className: "lp-input",
				value: form.url,
				autoComplete: "off",
				spellCheck: false,
				placeholder: storedSame ? "留空保持不变；填写则替换" : KIND_URL[kind],
				onChange: (event) => set("url", event.target.value)
			})) : null, kind && SIGNED.includes(kind) ? h$4("div", { className: "lp-field" }, h$4("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-secret"
			}, "签名密钥", h$4("span", { className: "lp-optional" }, "机器人开了“加签”才需要")), h$4("div", { className: "lp-input-unit" }, h$4("input", {
				id: "lp-fu-secret",
				type: "password",
				className: "lp-input",
				value: form.secret,
				autoComplete: "new-password",
				placeholder: storedSame && settings.webhook?.secret_set ? form.clearSecret ? "保存后清除" : "已设置（留空保持不变）" : "可不填",
				onChange: (event) => setForm((current) => ({
					...current,
					secret: event.target.value,
					clearSecret: false
				}))
			}), storedSame && settings.webhook?.secret_set && !form.clearSecret && !form.secret ? h$4("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: () => set("clearSecret", true)
			}, "清除") : null)) : null)), h$4("div", { className: "lp-followup-detail" }, h$4(Segmented, {
				name: "lp-fu-detail",
				label: "内容",
				value: form.detail,
				onChange: (value) => set("detail", value),
				options: [{
					value: "minimal",
					label: "简要：不含健康数值"
				}, {
					value: "full",
					label: "详细"
				}]
			}), h$4("p", { className: "lp-caption" }, form.detail === "minimal" ? "只发“今天还有 2 项待打卡”这类提示，不含项目名称和健康数值。" : "会带上方案项目名称、执行率和复测指标，发到你配置的渠道。")), error ? h$4("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$4("div", { className: "lp-form-actions" }, h$4(Btn, {
				onClick: () => {
					save();
				},
				disabled: !dirty || saving
			}, saving ? "保存中…" : "保存设置"), h$4(Btn, {
				variant: "outline",
				onClick: () => {
					sendTest();
				},
				disabled: testing || dirty,
				title: dirty ? "先保存设置再测试" : void 0
			}, h$4(Icon, {
				name: "send",
				size: 14
			}), testing ? "发送中…" : "发送测试"), dirty ? h$4("span", { className: "lp-caption" }, "有未保存的更改") : test ? h$4(TestResult, {
				result: test,
				kind: settings.webhook?.kind ?? null
			}) : null), h$4("p", { className: "lp-fine" }, FOLLOWUP_NOTE), h$4(Log, { rows: data.log }));
		}
		/** "还有没打的卡时，21:00 发桌面通知；不含健康数值": what the switch does, from what is stored. */
		function switchCaption(data) {
			const settings = data.settings;
			const channels = [settings.desktop && data.platform_desktop ? "桌面通知" : "", settings.webhook ? "手机（Webhook）" : ""].filter(Boolean);
			const where = channels.length > 0 ? channels.join("和") : data.platform_desktop ? "桌面通知" : "（还没有可用的渠道，在“更多设置”里填写 Webhook）";
			const what = settings.detail === "minimal" ? "不含健康数值" : "含方案项目名称和执行率";
			return `还有没打的卡时，${settings.checkin_time} 发${where}；${what}。`;
		}
		/**
		* The one switch: 每晚提醒我打卡, with its time. Turning it on adds desktop
		* notifications when no channel is set; the detail level stays as chosen.
		*/
		function ReminderSwitch(props) {
			const { data } = props;
			const settings = data.settings;
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const [time, setTime] = react.default.useState(settings.checkin_time);
			react.default.useEffect(() => {
				setTime(settings.checkin_time);
			}, [settings.checkin_time]);
			const hasChannel = settings.desktop && data.platform_desktop || settings.webhook != null;
			async function post(body, done) {
				setBusy(true);
				setError(null);
				try {
					const result = await postJson("/api/longpi/followup", body);
					if (!result.ok) throw new Error(result.error || "没有保存");
					if (result.settings) putFollowup(result);
					notifyChanged();
					props.onNotice(done, "good");
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$4("div", { className: "lp-remind" }, h$4("div", { className: "lp-remind-row" }, h$4(Switch, {
				id: "lp-remind-on",
				checked: settings.enabled,
				busy,
				disabled: busy,
				label: "每晚提醒我打卡",
				onChange: (next) => {
					post(next ? {
						enabled: true,
						...hasChannel ? {} : { desktop: true }
					} : { enabled: false }, next ? "打卡提醒已开启。" : "提醒已关闭。");
				}
			}), h$4("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: time,
				"aria-label": "提醒时间",
				disabled: busy,
				onChange: (event) => {
					if (event.target.value) setTime(event.target.value);
				},
				onBlur: () => {
					if (time !== settings.checkin_time) post({ checkin_time: time }, `提醒时间改为 ${time}。`);
				}
			})), h$4("p", { className: "lp-caption" }, settings.enabled ? `${switchCaption(data)}${hasChannel ? ` ${nextLine(data)}` : ""}` : `关闭时不会发送任何提醒。开启后：${switchCaption(data)}`), error ? h$4("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
		}
		/** 随访提醒 on the settings page: the switch, then 更多设置 with the whole form and the log. */
		function FollowupPanel(props) {
			const { data, loading, error } = useFollowup();
			if (!data && loading) return h$4(Skeleton, { height: 88 });
			if (!data) return h$4(LoadError, {
				what: "随访设置",
				error,
				onRetry: () => reload("followup")
			});
			return h$4("div", { className: "lp-followup-panel" }, h$4(ReminderSwitch, {
				data,
				onNotice: props.onNotice
			}), h$4(EngageSettingsNote), h$4("details", { className: "lp-more" }, h$4("summary", null, "更多设置", h$4("span", { className: "lp-optional" }, "复测提醒、每周小结、免打扰、发到飞书或手机、内容详略")), h$4(Settings, {
				data,
				onNotice: props.onNotice,
				hideSwitch: true
			})));
		}
		//#endregion
		//#region src/client/methods.ts
		const h$3 = react.default.createElement;
		function RunReady(props) {
			const ready = props.board.readiness?.ready ?? [];
			const [running, setRunning] = react.default.useState(false);
			const [results, setResults] = react.default.useState(null);
			async function run() {
				setRunning(true);
				try {
					const json = await postJson("/api/longpi/run-ready", {});
					setResults(json.results);
					notifyChanged();
				} catch (err) {
					props.onNotice(`没有算完：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setRunning(false);
				}
			}
			return h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-label" }, "你的记录现在就能算"), ready.length === 0 ? h$3("p", { className: "lp-muted" }, "还没有能直接计算的方法。") : h$3("ul", { className: "lp-rows" }, ...ready.slice(0, 8).map((row) => h$3("li", {
				key: row.name,
				className: "lp-row lp-row-stack"
			}, h$3("span", { className: "lp-strong" }, row.blurb || row.name), h$3("span", { className: "lp-caption" }, row.domain || row.name)))), ready.length > 8 ? h$3("p", { className: "lp-caption" }, `另有 ${ready.length - 8} 项`) : null, ready.length > 0 ? h$3("div", { className: "lp-form-actions" }, h$3(Btn, {
				size: "sm",
				disabled: running,
				onClick: () => {
					run();
				}
			}, h$3(Icon, {
				name: "play",
				size: 13
			}), running ? "正在计算…" : `一键计算 ${ready.length} 项`)) : null, results ? h$3("ul", { className: "lp-rows lp-run" }, ...results.map((row) => h$3("li", {
				key: row.skill,
				className: "lp-row lp-row-stack"
			}, h$3("span", null, h$3("span", { className: row.ok ? "lp-good-ink" : "lp-muted-ink" }, row.ok ? "✓ " : "· "), row.skill), h$3("span", { className: "lp-caption" }, row.excerpt.split("\n")[0] ?? "")))) : null);
		}
		function Search(props) {
			const [question, setQuestion] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const [matches, setMatches] = react.default.useState(null);
			const [note, setNote] = react.default.useState("");
			const [error, setError] = react.default.useState(null);
			const shown = matches ?? props.board.dispatch?.matches ?? [];
			async function ask(event) {
				event.preventDefault();
				if (!question.trim()) return;
				setBusy(true);
				setError(null);
				try {
					const json = await getJson(`/api/longpi/match?q=${encodeURIComponent(question.trim())}`);
					setMatches(json.matches ?? []);
					setNote(json.note ?? "");
				} catch (err) {
					setError(`没有匹配到：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$3("div", { className: "lp-card" }, h$3("label", {
				className: "lp-label",
				htmlFor: "lp-method-q"
			}, "找方法"), h$3("form", {
				className: "lp-search",
				onSubmit: (event) => {
					ask(event);
				}
			}, h$3("input", {
				id: "lp-method-q",
				className: "lp-input",
				placeholder: "例如：生物年龄、甲基化、NMN 有用吗",
				value: question,
				onChange: (event) => setQuestion(event.target.value)
			}), h$3(Btn, {
				type: "submit",
				size: "sm",
				variant: "outline",
				disabled: busy || !question.trim()
			}, busy ? "匹配中" : "匹配")), error ? h$3("p", { className: "lp-form-error" }, error) : null, note ? h$3("p", { className: "lp-fine" }, note) : null, shown.length > 0 ? h$3("ul", { className: "lp-rows" }, ...shown.slice(0, 6).map((item) => h$3("li", {
				key: item.name,
				className: "lp-row lp-row-stack"
			}, h$3("span", { className: "lp-strong" }, item.name), h$3("span", { className: "lp-caption" }, (item.why ?? []).join("；") || item.blurb || "")))) : null);
		}
		/** The method library, for those who want it: now on the settings page under 高级. */
		function MethodsSection(props) {
			const board = props.board;
			if (!board) return props.loading ? h$3(Skeleton, { height: 160 }) : h$3(LoadError, {
				what: "方法库",
				error: props.error,
				onRetry: () => reload("board")
			});
			const unlock = board.readiness?.unlock ?? [];
			const meds = board.records?.medications ?? [];
			const readouts = board.readouts ?? [];
			return h$3("div", {
				className: "lp-methods",
				id: "lp-methods"
			}, h$3("p", { className: "lp-caption" }, `方法库 ${board.skills?.version ?? ""} · ${board.readiness?.declared ?? 0} 个个人方法。对话里照常可用。`), h$3("div", { className: "lp-grid-2" }, h$3(RunReady, {
				board,
				onNotice: props.onNotice
			}), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-label" }, "再测一项就能解锁"), unlock.length === 0 ? h$3("p", { className: "lp-muted" }, "没有只差一项的方法。") : h$3("ul", { className: "lp-rows" }, ...unlock.slice(0, 8).map((row) => h$3("li", {
				key: row.item,
				className: "lp-row"
			}, h$3("span", { className: "lp-strong" }, row.item), h$3("span", { className: "lp-caption" }, `解锁 ${row.skills.length} 个方法`)))))), h$3("div", { className: "lp-grid-2" }, h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-label" }, "用药计划", h$3("span", { className: "lp-optional" }, "只读，来自原来的用药记录")), meds.length === 0 ? h$3("p", { className: "lp-muted" }, "没有读到用药计划。") : h$3("ul", { className: "lp-rows" }, ...meds.map((row) => h$3("li", {
				key: row.name,
				className: "lp-row"
			}, h$3("span", null, row.name), h$3("span", { className: "lp-caption" }, row.status ?? ""))))), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-label" }, "最近读出"), readouts.length === 0 ? h$3("p", { className: "lp-muted" }, "还没有算过。") : h$3("ul", { className: "lp-rows" }, ...readouts.slice(0, 8).map((row) => h$3("li", {
				key: row.key,
				className: "lp-row"
			}, h$3("span", null, row.label_zh || row.key), h$3("span", { className: "lp-row-end" }, h$3("span", { className: "lp-num" }, `${typeof row.value === "number" ? fmt(row.value, 2) : row.value ?? ""} ${row.unit && row.unit !== "1" ? row.unit === "a" || row.unit === "yr" ? "岁" : row.unit : ""}`), h$3("span", { className: "lp-caption" }, (row.measured_at || row.at || "").slice(0, 10)))))))), h$3("div", { className: "lp-grid-1" }, h$3(Search, { board })));
		}
		//#endregion
		//#region src/client/settings-page.ts
		const h$2 = react.default.createElement;
		function Block(props) {
			return h$2("section", {
				className: "lp-set-block",
				id: props.id,
				"aria-labelledby": `${props.id}-title`
			}, h$2("h3", {
				className: "lp-set-title",
				id: `${props.id}-title`
			}, props.title, props.hint ? h$2("span", { className: "lp-optional" }, props.hint) : null), props.children);
		}
		function ScienceSwitch() {
			const [mode, setMode] = react.default.useState("local");
			react.default.useEffect(() => {
				getJson("/api/longpi/science/invite").then((row) => {
					setMode(row.preference === "off" || row.mode === "off" ? "off" : "local");
				}).catch(() => setMode("local"));
			}, []);
			const set = (next) => {
				postJson("/api/longpi/science/preference", { mode: next }).then(() => setMode(next)).catch(() => {});
			};
			return h$2("div", null, h$2("p", { className: "lp-muted" }, "本机上的研究默认开着：研究页、个人小试验和本机统计都不用另做设置。关掉之后这些会停。不满 18 岁本来就是关的。"), h$2("div", { className: "lp-form-actions" }, h$2("button", {
				type: "button",
				className: mode === "local" ? "lp-toggle lp-toggle-on" : "lp-toggle",
				onClick: () => set("local")
			}, "开着"), h$2("button", {
				type: "button",
				className: mode === "off" ? "lp-toggle lp-toggle-on" : "lp-toggle",
				onClick: () => set("off")
			}, "关掉")));
		}
		function Privacy() {
			return h$2("div", null, h$2("ul", { className: "lp-privacy" }, ...[
				[
					"lock",
					"存在哪里",
					"档案、方案、记录、自测和提醒只保存在这台电脑上。体检和手环的原件留在你原来放报告的地方，这里只读。"
				],
				[
					"send",
					"什么会发给模型",
					"和 LongPi 对话时，你的问题，以及为回答而读出的档案和化验，在你同意之后才会发给用来回答的人工智能（默认 DeepSeek）。不对话就不会发送。"
				],
				[
					"bell",
					"发给手机",
					"默认不使用。只有你自己配了之后才会发。提醒里不写化验数字，也不写项目名字。"
				]
			].map(([icon, title, text]) => h$2("li", {
				key: title,
				className: "lp-privacy-row"
			}, h$2("span", {
				className: "lp-consent-icon",
				"aria-hidden": true
			}, h$2(Icon, {
				name: icon,
				size: 15
			})), h$2("div", null, h$2("div", { className: "lp-strong" }, title), h$2("p", { className: "lp-muted" }, text))))), h$2("div", { className: "lp-form-actions" }, h$2(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: "longpi-report.md"
			}, "导出报告")));
		}
		function Methods(props) {
			const board = useBoard();
			return h$2(MethodsSection, {
				board: board.data,
				loading: board.loading,
				error: board.error,
				onNotice: props.onNotice
			});
		}
		function LongPiSettings(props) {
			const [notice, notify] = useNotice();
			const [advanced, setAdvanced] = react.default.useState(false);
			return h$2("div", { className: "lp lp-settings" }, h$2("div", { className: "lp-set-head" }, h$2("h2", { className: "lp-h2" }, "LongPi"), props.openPage ? h$2("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => {
					props.close?.();
					props.openPage?.();
				}
			}, "打开健康页 →") : null), notice ? h$2("div", { className: "lp-notice-slot" }, notice) : null, h$2(Block, {
				id: "lp-set-followup",
				title: "提醒",
				hint: "默认关。这个窗口关了，就不会响。"
			}, h$2(FollowupPanel, { onNotice: notify })), h$2(Block, {
				id: "lp-set-connection",
				title: "数据连接"
			}, h$2(ConnectionPanel, { idPrefix: "lp-set-conn" })), h$2(Block, {
				id: "lp-set-science",
				title: "一起研究"
			}, h$2(ScienceSwitch)), h$2(Block, {
				id: "lp-set-privacy",
				title: "隐私与数据"
			}, h$2(Privacy), ...settingsSections().map((section) => h$2(section.Component, { key: section.id }))), h$2("section", {
				className: "lp-set-block",
				id: "lp-set-methods"
			}, h$2("details", {
				className: "lp-more",
				onToggle: (event) => setAdvanced(event.currentTarget.open)
			}, h$2("summary", null, h$2("span", { className: "lp-set-title" }, "高级（给安装的人）"), h$2("span", { className: "lp-optional" }, "方法库和安装细节")), advanced ? h$2(Methods, { onNotice: notify }) : null)));
		}
		//#endregion
		//#region src/client/styles.ts
		const CSS = `
.lp {
  --lp-bg: var(--dsw-alias-bg-base, #fff);
  --lp-layer: var(--dsw-alias-bg-layer-1, #fff);
  --lp-layer-2: var(--dsw-alias-bg-layer-2, #fff);
  --lp-ink: var(--dsw-alias-label-primary, rgb(15, 17, 21));
  --lp-ink-2: var(--dsw-alias-label-secondary, rgb(97, 102, 107));
  --lp-ink-3: var(--dsw-alias-label-tertiary, rgb(129, 133, 140));
  --lp-ink-4: var(--dsw-alias-label-caption, rgb(173, 178, 184));
  --lp-line-1: var(--dsw-alias-border-l1, rgba(0, 0, 0, .04));
  --lp-line-2: var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
  --lp-line-3: var(--dsw-alias-border-l3, rgba(0, 0, 0, .12));
  --lp-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, .06));
  --lp-press: var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, .1));
  --lp-good: var(--dsw-alias-state-success-primary, rgb(34, 197, 94));
  --lp-warn: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11));
  --lp-bad: var(--dsw-alias-state-error-primary, rgb(236, 19, 19));
  --lp-skeleton: var(--dsw-alias-bg-skeleton, rgba(0, 0, 0, .04));
  --lp-brand: var(--dsw-alias-brand-primary, rgb(15, 17, 21));
  --lp-on-brand: var(--dsw-alias-label-primary-foreground, #fff);
  --lp-focus: var(--dsw-alias-state-business-primary, rgb(65, 118, 230));
  --lp-accent: #2a78d6;
  --lp-accent-wash: rgba(42, 120, 214, .08);
  --lp-accent-soft: rgba(42, 120, 214, .16);
  --lp-band: rgba(97, 102, 107, .11);
  --lp-good-ink: #15803d;
  --lp-good-wash: rgba(34, 197, 94, .11);
  --lp-warn-ink: #b45309;
  --lp-warn-wash: rgba(245, 158, 11, .13);
  --lp-bad-wash: rgba(236, 19, 19, .07);
  --lp-well: rgba(38, 49, 72, .035);
  --lp-field: #fff;
  --lp-seg-on: #fff;
  --lp-card-shadow: 0 0 0 .5px var(--lp-line-3), 0 1px 2px rgba(0, 0, 0, .02), 0 6px 20px rgba(0, 0, 0, .03);
  --lp-lift: var(--dsw-elevation-prominent, 0 0 0 .5px rgba(0, 0, 0, .16), 0 3px 8px rgba(0, 0, 0, .04), 0 0 20px rgba(0, 0, 0, .05));
  color-scheme: light;
  color: var(--lp-ink);
  font-size: 14px;
  line-height: 22px;
  -webkit-font-smoothing: antialiased;
}
body[data-ds-dark-theme] .lp {
  --lp-accent: #3987e5;
  --lp-accent-wash: rgba(57, 135, 229, .14);
  --lp-accent-soft: rgba(57, 135, 229, .26);
  --lp-band: rgba(207, 211, 214, .12);
  --lp-good-ink: #4ed17e;
  --lp-good-wash: rgba(34, 197, 94, .16);
  --lp-warn-ink: #f7ad31;
  --lp-warn-wash: rgba(245, 158, 11, .16);
  --lp-bad-wash: rgba(242, 90, 90, .14);
  --lp-well: rgba(255, 255, 255, .04);
  --lp-field: rgba(255, 255, 255, .03);
  --lp-seg-on: rgba(255, 255, 255, .14);
  --lp-card-shadow: 0 0 0 .5px var(--lp-line-2);
  color-scheme: dark;
}
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp button, .lp input, .lp select { font-family: inherit; }
.lp :is(button, a, summary, [tabindex="0"]):focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 2px; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lp-icon { flex: none; vertical-align: -3px; }

/* --- page frame ----------------------------------------------------------------- */
.lp-page-root {
  container: lp-root / inline-size;
  width: 100%; max-width: 100%; box-sizing: border-box;
  height: 100%; overflow-x: hidden; overflow-y: auto; background: var(--lp-bg);
  padding-top: var(--dsh-frame-top-clearance, 48px);
  padding-left: var(--dsh-frame-leading-clearance, 0px);
}
.lp-page { width: 100%; max-width: 1040px; margin: 0 auto; padding: 12px 40px 64px; box-sizing: border-box; }
@container lp-root (max-width: 760px) { .lp-page { padding: 8px 20px 48px; } }
.lp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
.lp-season-bar { position: static; display: flex; align-items: center; width: 100%; max-width: 100%; margin: -12px 0 16px; padding: 8px 12px; border: 0; border-radius: 12px; background: var(--lp-layer-2); color: var(--lp-ink); font: inherit; text-align: left; cursor: pointer; }
.lp-season-bar:hover { background: var(--lp-hover); }
@container lp-root (max-width: 760px) { .lp-header { flex-direction: column; gap: 16px; } }
.lp-kicker { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); margin-bottom: 6px; }
.lp-h1 { font-size: 26px; line-height: 34px; font-weight: 500; margin: 0 0 4px; letter-spacing: -.01em; }
.lp-h2 { font-size: 18px; line-height: 26px; font-weight: 500; margin: 0; }
.lp-h3 { font-size: 15px; line-height: 22px; font-weight: 500; margin: 6px 0 2px; }
.lp-lead { margin: 0 0 10px; color: var(--lp-ink-2); }
.lp-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-statusdot { width: 7px; height: 7px; border-radius: 50%; background: var(--lp-ink-4); flex: none; }
.lp-statusdot-on { background: var(--lp-good); box-shadow: 0 0 0 3px var(--lp-good-wash); }
.lp-statusdot-bad { background: var(--lp-warn); box-shadow: 0 0 0 3px var(--lp-warn-wash); }
.lp-actions { display: flex; gap: 6px; flex: none; flex-wrap: wrap; }
.lp-linkbtn {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 16px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px;
  text-decoration: none; cursor: pointer; white-space: nowrap; transition: background-color .15s ease;
}
.lp-linkbtn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-linkbtn:disabled { cursor: default; color: var(--lp-ink-3); }
.lp-linkbtn .lp-icon { color: var(--lp-ink-2); }
.lp-body { transition: opacity .2s ease; }
.lp-refreshing { opacity: .6; }
.lp-footer { margin-top: 56px; padding-top: 16px; border-top: .5px solid var(--lp-line-2); color: var(--lp-ink-3); font-size: 12px; line-height: 18px; }
.lp-footer p { margin: 0 0 4px; }
.lp-footer p:first-child { color: var(--lp-ink-2); }

/* --- building blocks ------------------------------------------------------------ */
.lp-card { background: var(--lp-layer); border-radius: 16px; padding: 20px 22px; box-shadow: var(--lp-card-shadow); min-width: 0; animation: lp-rise .45s cubic-bezier(.2, .7, .2, 1) both; }
.lp-section { margin-top: 44px; }
.lp-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.lp-label { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); font-weight: 500; margin: 0 0 12px; }
.lp-optional { font-weight: 400; font-size: 12px; color: var(--lp-ink-3); }
.lp-subhead { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); font-weight: 500; margin: 18px 0 8px; }
.lp-strong { font-weight: 500; color: var(--lp-ink); }
.lp-muted { color: var(--lp-ink-2); }
p.lp-muted { margin: 0; }
.lp-muted-ink { color: var(--lp-ink-3); }
.lp-good-ink { color: var(--lp-good-ink); }
.lp-caption { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); font-weight: 400; }
.lp-fine { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); margin: 12px 0 0; }
.lp-fine-tight { margin-top: 2px; max-width: 13rem; }
.lp-num { font-variant-numeric: tabular-nums; color: var(--lp-ink-2); }
.lp-tag { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; background: var(--lp-hover); color: var(--lp-ink-2); font-size: 11px; line-height: 16px; white-space: nowrap; font-weight: 400; }
.lp-pill { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 12px; background: var(--lp-hover); color: var(--lp-ink); font-size: 12px; line-height: 18px; font-weight: 500; white-space: nowrap; }
.lp-pill-good { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-skeleton { border-radius: 10px; background: var(--lp-skeleton); animation: lp-pulse 1.6s ease-in-out infinite; }
.lp-card-skeleton { border-radius: 16px; }
.lp-loading { display: grid; gap: 16px; }
.lp-failed { display: grid; gap: 10px; justify-items: start; }
.lp-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.lp-section-head + .lp-grid-2 { margin-top: 0; }
.lp-grid-top { align-items: start; }
.lp-grid-1 { margin-top: 16px; }
@container lp-root (max-width: 760px) { .lp-grid-2 { grid-template-columns: 1fr; } }
.lp-notice-slot { position: sticky; top: 8px; z-index: 5; height: 0; display: flex; justify-content: center; pointer-events: none; }
.lp-notice {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; max-width: min(560px, 100%);
  padding: 6px 6px 6px 14px; border-radius: 18px; background: var(--lp-layer-2); box-shadow: var(--lp-lift);
  font-size: 13px; line-height: 20px; animation: lp-rise .25s ease both;
}
.lp-onb .lp-notice { margin-top: 12px; box-shadow: 0 0 0 .5px var(--lp-line-3); }
.lp-notice > .lp-icon { color: var(--lp-ink-3); }
.lp-notice-good > .lp-icon { color: var(--lp-good-ink); }
.lp-notice-bad > .lp-icon { color: var(--lp-bad); }
.lp-notice-x, .lp-iconbtn {
  width: 28px; height: 28px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--lp-ink-3); cursor: pointer;
}
.lp-notice-x:hover, .lp-iconbtn:hover:not(:disabled) { background: var(--lp-hover); color: var(--lp-ink); }
.lp-iconbtn:disabled { opacity: .4; cursor: default; }
.lp-rows { list-style: none; margin: 0; padding: 0; }
.lp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: .5px solid var(--lp-line-2); font-size: 13px; line-height: 20px; }
.lp-row:first-child { border-top: 0; }
.lp-row-main { flex: 1; min-width: 0; }
.lp-row-stack { flex-direction: column; align-items: flex-start; gap: 0; }
.lp-row-end { display: inline-flex; align-items: baseline; gap: 8px; white-space: nowrap; }

/* --- forms ---------------------------------------------------------------------- */
.lp-field { display: grid; gap: 6px; min-width: 0; }
.lp-field-label { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-input {
  height: 36px; width: 100%; min-width: 0; padding: 0 12px; border-radius: 10px; border: .5px solid var(--lp-line-3);
  background: var(--lp-field); color: var(--lp-ink); font-size: 14px; line-height: 22px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.lp-input::placeholder { color: var(--lp-ink-4); }
.lp-input:hover { border-color: var(--lp-ink-4); }
.lp-input:focus { outline: none; border-color: var(--lp-ink-3); box-shadow: 0 0 0 3px var(--lp-hover); }
.lp-input[aria-invalid="true"] { border-color: var(--lp-bad); }
.lp-input[type="date"] { padding-right: 8px; }
.lp-input-unit { display: flex; align-items: center; gap: 8px; }
.lp-unit { color: var(--lp-ink-3); font-size: 13px; white-space: nowrap; }
.lp-select { height: 36px; flex: none; padding: 0 6px; border-radius: 10px; border: .5px solid var(--lp-line-3); background: var(--lp-field); color: var(--lp-ink); font-size: 13px; }
.lp-form-error { margin: 0; color: var(--lp-bad); font-size: 13px; line-height: 20px; }
.lp-form-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.lp-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 24px; flex-wrap: wrap; }
.lp-modal-actions > button { min-width: 96px; }
.lp-seg-wrap { display: grid; gap: 6px; }
.lp-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; background: var(--lp-hover); width: max-content; }
.lp-seg-opt { position: relative; display: inline-flex; }
.lp-seg-opt input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.lp-seg-opt span {
  display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 30px; padding: 0 12px;
  border-radius: 8px; font-size: 13px; color: var(--lp-ink-2); transition: background-color .15s ease, color .15s ease;
}
.lp-seg-opt:hover span { color: var(--lp-ink); }
.lp-seg-on span { background: var(--lp-seg-on); color: var(--lp-ink); font-weight: 500; box-shadow: 0 0 0 .5px var(--lp-line-3), 0 1px 2px rgba(0, 0, 0, .06); }
.lp-seg-opt input:focus-visible + span { outline: 2px solid var(--lp-focus); outline-offset: 1px; }
.lp-toggles { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-toggle {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 16px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 13px; cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
.lp-toggle:hover { background: var(--lp-hover); }
.lp-toggle-on, .lp-toggle-on:hover { background: var(--lp-brand); color: var(--lp-on-brand); border-color: transparent; }
.lp-toggle-badge { width: 18px; height: 18px; margin-left: -6px; border-radius: 50%; background: var(--lp-on-brand); color: var(--lp-brand); font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }

/* --- profile editor ----------------------------------------------------------------- */
.lp-profile { container: lp-form / inline-size; display: grid; gap: 18px; }
.lp-profile-basics { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 24px; }
.lp-field-age { width: 150px; }
.lp-unlock { display: flex; align-items: center; gap: 6px; margin: -10px 0 0; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-unlock-inline { display: block; margin: 2px 0 0; }
.lp-facts { border: 0; margin: 0; padding: 0; min-width: 0; }
.lp-facts-legend { padding: 0; margin-bottom: 6px; font-size: 13px; line-height: 20px; }
.lp-fact { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; border-top: .5px solid var(--lp-line-2); }
.lp-fact:first-of-type { border-top: 0; }
.lp-fact-text { min-width: 0; }
.lp-fact-label { font-size: 14px; line-height: 20px; }
@container lp-form (max-width: 420px) { .lp-fact { flex-direction: column; align-items: flex-start; gap: 8px; } }
.lp-focus { display: grid; gap: 8px; }

/* --- self measurements ---------------------------------------------------------------- */
.lp-self-latest { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.lp-self-latest li { display: grid; padding: 8px 12px; border-radius: 12px; background: var(--lp-well); min-width: 120px; }
.lp-self-value { font-size: 16px; line-height: 24px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-self-form { container: lp-form / inline-size; display: grid; gap: 14px; }
.lp-self-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.lp-self-bp { grid-column: 1 / -1; }
@container lp-form (max-width: 380px) { .lp-self-grid { grid-template-columns: 1fr; } }
.lp-self-field { display: grid; gap: 6px; min-width: 0; }
.lp-bp { display: flex; align-items: center; gap: 8px; }
.lp-bp .lp-input { width: 104px; }
.lp-bp-slash { color: var(--lp-ink-4); }
.lp-self-recent .lp-subhead { margin-top: 16px; }
.lp-self-empty { margin: 12px 0 0; }
.lp-inline-self { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lp-inline-self .lp-input { width: 92px; height: 32px; }
.lp-inline-self .lp-select { height: 32px; }

/* --- results --------------------------------------------------------------------------- */
.lp-results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
@container lp-root (max-width: 720px) { .lp-results { grid-template-columns: 1fr; } }
.lp-result { display: flex; flex-direction: column; }
.lp-result-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.lp-result-head .lp-label { margin: 0; }
.lp-result-figure { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.lp-bignum { font-size: 48px; line-height: 58px; font-weight: 500; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.lp-bignum-unit { font-size: 16px; line-height: 24px; color: var(--lp-ink-2); font-weight: 400; letter-spacing: 0; }
.lp-band-note { margin-left: auto; font-size: 12px; color: var(--lp-ink-3); align-self: center; }
.lp-result-sub { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 4px 0 14px; }
.lp-result-goal { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); }
.lp-story { display: flex; gap: 8px; align-items: flex-start; margin: 14px 0 0; color: var(--lp-ink); }
.lp-result-win { background: linear-gradient(180deg, var(--lp-good-wash), transparent 140px), var(--lp-layer); }
.lp-result-wait { font-size: 22px; line-height: 30px; font-weight: 500; margin: 8px 0 6px; }
.lp-blocker { margin: 0; color: var(--lp-ink-2); }
.lp-blocker-bad { color: var(--lp-ink); padding: 10px 12px; border-radius: 10px; background: var(--lp-warn-wash); }
.lp-needs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; }
.lp-need { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px; border-radius: 12px; border: 1px dashed var(--lp-line-3); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; white-space: nowrap; }
.lp-result-action { margin-top: auto; padding-top: 18px; }
/* The closing fine print sits on the card's floor, so side-by-side cards end on one line. */
.lp-result > .lp-fine:last-child { margin-top: auto; padding-top: 14px; }
.lp-result-self { margin-top: auto; padding-top: 16px; display: grid; gap: 8px; }
.lp-result-blocked .lp-result-self { border-top: .5px solid var(--lp-line-2); margin-top: 16px; }
.lp-addons { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-addon { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-addon-box { width: 30px; height: 30px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-layer); color: var(--lp-ink-2); box-shadow: 0 0 0 .5px var(--lp-line-3); }
.lp-addon-text { flex: 1; min-width: 150px; }

/* The body-age card's note when one of its inputs changed beyond normal fluctuation. */
.lp-caveat { display: flex; gap: 6px; align-items: flex-start; margin: -4px 0 14px; padding: 8px 10px; border-radius: 10px; background: var(--lp-warn-wash); font-size: 12px; line-height: 18px; color: var(--lp-ink); }
.lp-caveat .lp-icon { margin-top: 2px; color: var(--lp-warn-ink); }

/* --- record changes beyond normal fluctuation ------------------------------------------------ */
.lp-changes { margin-bottom: 16px; scroll-margin-top: 24px; }
.lp-change-group + .lp-change-group { margin-top: 18px; }
.lp-change-list { list-style: none; margin: 6px 0 0; padding: 0; }
.lp-change { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 6px 28px; align-items: center; padding: 12px 0; border-top: .5px solid var(--lp-line-2); }
.lp-change:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-change { grid-template-columns: minmax(0, 1fr); } }
.lp-change-main { min-width: 0; }
.lp-change-text { margin: 2px 0 0; color: var(--lp-ink-2); font-variant-numeric: tabular-nums; }
.lp-change-advice { display: flex; gap: 6px; align-items: flex-start; width: fit-content; max-width: 100%; margin: 10px 0 0; padding: 6px 12px; border-radius: 10px; font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-change-advice .lp-icon { margin-top: 3px; flex: none; }
.lp-change-warn { background: var(--lp-warn-wash); }
.lp-change-warn .lp-icon { color: var(--lp-warn-ink); }
.lp-change-good { background: var(--lp-good-wash); }
.lp-change-good .lp-icon { color: var(--lp-good-ink); }
.lp-change-neutral { background: var(--lp-well); }
.lp-change-neutral .lp-icon { color: var(--lp-ink-3); }
.lp-change-notes { margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--lp-line-2); display: grid; gap: 4px; }
.lp-change-notes p { margin: 0; }
.lp-change-source a { color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-change-source a:hover { text-decoration: underline; }
.lp-change-spark { min-width: 0; }

/* --- first-run steps -------------------------------------------------------------------------- */
.lp-step-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.lp-step-body > .lp-form-actions { margin-top: 0; }
.lp-consent { display: grid; gap: 12px; }
.lp-consent-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-consent-row p { margin: 0; color: var(--lp-ink); line-height: 24px; }
.lp-consent-icon { width: 28px; height: 28px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-first { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-first-cell { padding: 14px 16px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-first-cell .lp-blocker { margin-top: 2px; font-size: 13px; line-height: 20px; }
.lp-first-wait { margin-top: 6px; font-size: 18px; line-height: 26px; font-weight: 500; }
.lp-first-figure { font-size: 32px; line-height: 40px; font-weight: 500; margin-top: 2px; font-variant-numeric: tabular-nums; }
.lp-first-figure .lp-bignum-unit { margin-left: 4px; font-size: 14px; }
.lp-first-caveat { margin: 6px 0 0; color: var(--lp-warn-ink); }

/* --- plan ---------------------------------------------------------------------------------- */
.lp-tiles { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@container lp-root (max-width: 860px) { .lp-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } .lp-tile-today { grid-column: 1 / -1; } }
@container lp-root (max-width: 520px) { .lp-tiles { grid-template-columns: 1fr; } }
.lp-tile { display: flex; flex-direction: column; }
.lp-tile > .lp-fine { margin-top: auto; padding-top: 12px; }
.lp-tile-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.lp-tile-row { display: flex; align-items: center; gap: 14px; }
.lp-tile-figure { font-size: 24px; line-height: 32px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-today-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.lp-today-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0; min-height: 36px; }
.lp-today-title { font-weight: 500; }
.lp-today-done .lp-today-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-done-label { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px; background: var(--lp-good-wash); color: var(--lp-good-ink); font-size: 12px; font-weight: 500; white-space: nowrap; }
.lp-pop { animation: lp-pop .35s ease; }
.lp-streak { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 13px; font-weight: 500; }
.lp-streak .lp-icon { color: var(--lp-warn); }
.lp-streak-empty { margin-top: 14px; }
.lp-ring { flex: none; }
.lp-ring-track { fill: none; stroke: var(--lp-accent-soft); }
.lp-ring-fill { fill: none; stroke: var(--lp-accent); stroke-linecap: round; transition: stroke-dasharray .8s ease; }
.lp-plan-start { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 28px; align-items: center; }
@container lp-root (max-width: 720px) { .lp-plan-start { grid-template-columns: 1fr; gap: 16px; } }
.lp-plan-start .lp-h3 { margin-top: 0; font-size: 18px; line-height: 26px; }
.lp-plan-start .lp-muted { margin-top: 6px; }
.lp-prompts { display: grid; gap: 8px; }
.lp-prompt {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px;
  text-align: left; cursor: pointer; transition: background-color .15s ease;
}
.lp-prompt:hover { background: var(--lp-hover); }
.lp-prompt .lp-icon { color: var(--lp-ink-3); }
.lp-wins { margin-top: 16px; }
.lp-wins-empty { display: flex; gap: 12px; align-items: flex-start; }
.lp-win { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: .5px solid var(--lp-line-2); animation: lp-rise .45s ease both; }
.lp-win:first-of-type { border-top: 0; padding-top: 0; }
.lp-win-icon { width: 30px; height: 30px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-win-icon-quiet { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-timeline-card { margin-top: 16px; }
.lp-grid-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
.lp-item { display: flex; flex-direction: column; gap: 12px; }
.lp-item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.lp-cat { display: inline-block; padding: 0 8px; border-radius: 6px; background: var(--lp-hover); color: var(--lp-ink-2); font-size: 11px; line-height: 18px; }
.lp-item-adherence { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 12px 0; border-top: .5px solid var(--lp-line-2); border-bottom: .5px solid var(--lp-line-2); }
.lp-item-figure { font-size: 20px; line-height: 28px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-verdict-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.lp-reason { margin: 6px 0 0; color: var(--lp-ink-2); font-size: 13px; line-height: 20px; }
.lp-expected summary { margin-top: 6px; font-size: 12px; color: var(--lp-ink-3); cursor: pointer; width: fit-content; }
.lp-item-foot { margin-top: auto; padding-top: 4px; }
.lp-chip-v { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px 0 7px; border-radius: 12px; font-size: 12px; font-weight: 500; color: var(--lp-ink); white-space: nowrap; }
.lp-v-good { background: var(--lp-good-wash); }
.lp-v-good .lp-icon { color: var(--lp-good-ink); }
.lp-v-within { background: var(--lp-hover); }
.lp-v-within .lp-icon { color: var(--lp-ink-3); }
.lp-v-worse { background: var(--lp-warn-wash); }
.lp-v-worse .lp-icon { color: var(--lp-warn-ink); }
.lp-v-unknown { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-v-unknown .lp-icon { color: var(--lp-ink-3); }
.lp-grid-charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.lp-figure { margin: 0; }
.lp-figure-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.lp-grid-goals { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.lp-model-figures { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.lp-model-note { background: var(--lp-well); box-shadow: none; }
.lp-steps { list-style: none; margin: 0; padding: 6px 22px; }
.lp-step { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: .5px solid var(--lp-line-2); }
.lp-step:first-child { border-top: 0; }
.lp-step-icon { width: 28px; height: 28px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-step-worse .lp-step-icon { background: var(--lp-warn-wash); color: var(--lp-warn-ink); }
.lp-step-retest .lp-step-icon { background: var(--lp-accent-wash); color: var(--lp-accent); }
.lp-search { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.lp-search > button { flex: none; white-space: nowrap; }
.lp-run { margin-top: 12px; }

/* --- plan draft ---------------------------------------------------------------------------- */
.lp-draft { display: grid; gap: 4px; margin-bottom: 16px; }
.lp-draft-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.lp-draft-head .lp-kicker { margin-bottom: 2px; }
.lp-draft-title { margin-top: 0; font-size: 18px; line-height: 26px; }
.lp-draft-head .lp-muted { margin-top: 4px; }
.lp-draft-block .lp-subhead { margin-top: 20px; }
.lp-priorities { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.lp-priority { padding: 10px 12px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-priority-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.lp-draft-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.lp-draft-item { padding: 14px 16px; border-radius: 14px; box-shadow: inset 0 0 0 .5px var(--lp-line-3); display: grid; gap: 6px; min-width: 0; }
.lp-draft-item-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.lp-draft-item-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; font-size: 15px; }
.lp-draft-remove {
  flex: none; display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px;
  border: 0; background: transparent; color: var(--lp-ink-3); font-size: 12px; cursor: pointer; transition: background-color .15s ease, color .15s ease;
}
.lp-draft-remove:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-draft-detail { margin: 0; color: var(--lp-ink); }
.lp-draft-target { margin: 0; display: flex; align-items: center; gap: 4px; }
.lp-evidence { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 12px; line-height: 18px; color: var(--lp-ink-2); }
.lp-evidence .lp-icon { margin-top: 2px; color: var(--lp-ink-3); }
.lp-evidence a { display: inline-block; max-width: 100%; color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-evidence a:hover { text-decoration: underline; }
.lp-draft-warn { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 8px 10px; border-radius: 10px; background: var(--lp-warn-wash); }
.lp-warn-tag { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--lp-warn-wash); color: var(--lp-warn-ink); font-size: 12px; font-weight: 500; white-space: nowrap; }
.lp-draft-warn .lp-warn-tag { background: var(--lp-layer); box-shadow: inset 0 0 0 .5px var(--lp-warn); }
.lp-warn-text { font-size: 12px; line-height: 18px; color: var(--lp-ink); }
.lp-warn-icon { color: var(--lp-warn-ink); }
.lp-draft-removed { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.lp-draft-removed .lp-toggle { height: 28px; font-size: 12px; color: var(--lp-ink-2); }
.lp-draft-goals .lp-row { padding: 8px 0; }
.lp-draft-actions { margin-top: 20px; gap: 14px; }
.lp-draft-hint { display: inline-flex; align-items: baseline; gap: 2px; flex-wrap: wrap; }
.lp-draft-hint .lp-row-link { font-size: 12px; }
.lp-confirm-dialog.lp-confirm-dialog, div:has(> .lp-confirm.lp-confirm) { width: min(520px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-confirm { padding: 24px 28px 24px; display: grid; gap: 12px; max-height: calc(100vh - 48px); overflow-y: auto; }
.lp-confirm-lead { margin: 0; }
.lp-confirm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lp-confirm-list li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); }
.lp-confirm-list .lp-warn-tag { margin-left: auto; }
.lp-confirm-doctor { font-size: 13px; line-height: 20px; }
.lp-confirm .lp-modal-actions { margin-top: 8px; }

/* --- follow-up ------------------------------------------------------------------------------ */
.lp-followup { display: grid; gap: 4px; }
.lp-followup-head { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: .5px solid var(--lp-line-2); }
.lp-followup-grid { margin-top: 16px; gap: 20px 32px; }
.lp-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 14px; align-content: start; }
.lp-fieldset > legend { padding: 0; margin-bottom: 12px; }
.lp-followup-times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.lp-input-time { width: 128px; flex: none; font-variant-numeric: tabular-nums; }
.lp-select-wide { min-width: 132px; padding: 0 10px; }
.lp-followup-detail { display: grid; gap: 6px; margin-top: 20px; padding-top: 16px; border-top: .5px solid var(--lp-line-2); }
.lp-followup-detail .lp-caption { margin: 0; }
.lp-followup .lp-form-actions { margin-top: 16px; }
.lp-followup-log .lp-subhead { margin-top: 20px; }
.lp-followup-log .lp-row-main .lp-num { color: var(--lp-ink-2); }
.lp-sent { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 12px; white-space: nowrap; }
.lp-sent-ok { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-sent-bad { background: var(--lp-warn-wash); color: var(--lp-warn-ink); }
.lp-test-result { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.lp-check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; line-height: 22px; width: fit-content; }
.lp-check input { width: 16px; height: 16px; margin: 0; accent-color: var(--lp-brand); cursor: pointer; }
.lp-check-off { cursor: default; color: var(--lp-ink-3); }
.lp-check-off input { cursor: default; }
.lp-switch { display: inline-flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--lp-ink); font-size: 15px; font-weight: 500; line-height: 22px; cursor: pointer; }
.lp-switch:disabled { cursor: progress; }
.lp-switch-track { position: relative; width: 36px; height: 20px; flex: none; border-radius: 10px; background: var(--lp-line-3); transition: background-color .2s ease; }
.lp-switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .2s ease; }
.lp-switch-on .lp-switch-track { background: var(--lp-good); }
.lp-switch-on .lp-switch-thumb { transform: translateX(16px); }

/* --- charts ---------------------------------------------------------------------------------- */
.lp-chart { position: relative; width: 100%; }
.lp-chart svg { display: block; overflow: visible; }
.lp-chart svg:focus { outline: none; }
.lp-chart svg:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 4px; border-radius: 6px; }
.lp-chart-empty { color: var(--lp-ink-3); font-size: 13px; padding: 24px 0; }
.lp-grid { stroke: var(--lp-line-1); stroke-width: 1; }
.lp-axis { fill: var(--lp-ink-3); font-size: 11px; }
.lp-line { fill: none; stroke: var(--lp-accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.lp-area { fill: var(--lp-accent-wash); stroke: none; }
.lp-dot { fill: var(--lp-accent); stroke: var(--lp-layer); stroke-width: 2; transition: r .15s ease; }
.lp-band { fill: var(--lp-band); }
.lp-goal { stroke: var(--lp-ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
.lp-goal-text { fill: var(--lp-ink-2); font-size: 11px; }
.lp-ref { stroke: var(--lp-line-3); stroke-width: 1; }
.lp-cross { stroke: var(--lp-line-3); stroke-width: 1; }
.lp-end { fill: var(--lp-ink); font-size: 12px; font-weight: 500; }
.lp-bar { fill: var(--lp-accent); }
.lp-bar-muted { fill: var(--lp-line-3); }
.lp-hit { fill: transparent; }
.lp-row-label { fill: var(--lp-ink); font-size: 12.5px; }
.lp-checkup { stroke: var(--lp-line-2); stroke-width: 1; }
.lp-checkup-dot { fill: var(--lp-ink-3); stroke: var(--lp-layer); stroke-width: 2; }
.lp-today { stroke: var(--lp-accent); stroke-width: 1; opacity: .55; }
.lp-legend-inline { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--lp-ink-3); }
.lp-key-bar { width: 16px; height: 6px; border-radius: 3px; background: var(--lp-accent); display: inline-block; }
.lp-key-dot { width: 7px; height: 7px; margin-left: 10px; border-radius: 50%; background: var(--lp-ink-3); display: inline-block; }
.lp-tip { position: absolute; z-index: 5; min-width: 120px; max-width: 220px; padding: 8px 10px; border-radius: 10px; background: var(--lp-layer-2); box-shadow: var(--lp-lift); font-size: 12px; line-height: 18px; pointer-events: none; transform: translateY(-100%); }
.lp-tip-title { color: var(--lp-ink-3); margin-bottom: 2px; }
.lp-tip-row { display: flex; flex-direction: column; }
.lp-tip-value { color: var(--lp-ink); font-weight: 500; font-size: 13px; }
.lp-tip-label { color: var(--lp-ink-2); }
.lp-strip { position: relative; flex: none; }
.lp-cell-done { fill: var(--lp-accent); }
.lp-cell-missed { fill: var(--lp-line-3); }
.lp-cell-unknown { fill: var(--lp-line-1); }
.lp-twin { margin-top: 10px; font-size: 12px; }
.lp-twin summary { color: var(--lp-ink-3); cursor: pointer; width: fit-content; }
.lp-twin table { width: 100%; margin-top: 8px; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.lp-twin caption { text-align: left; color: var(--lp-ink-3); padding-bottom: 4px; }
.lp-twin th, .lp-twin td { text-align: left; padding: 4px 8px 4px 0; border-bottom: .5px solid var(--lp-line-2); }
.lp-twin th { color: var(--lp-ink-2); font-weight: 500; }

/* --- home greeting (in DSH's 34 px logo seat, in place of the headline) ------------------------ */
/* While the greeting shows, DSH's own title group ("探索未至之境" + Preview) is hidden. Structural on
   purpose: DSH's class names are hashed. The slot renders in a span beside the title span, wrapped in
   DSH's display:contents slot anchor, hence a descendant (not child) match. If DSH's markup changes and
   this stops matching, the greeting simply sits above DSH's title. */
div:has(> span .lp-hero) > span:not(:has(.lp-hero)) { display: none !important; }
.lp-hero {
  width: min(620px, calc(100vw - 48px)); max-width: 100%; margin: 0 auto;
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 6px;
  text-align: center; white-space: normal; letter-spacing: 0;
  animation: lp-fade .35s ease both;
}
.lp-hero-title {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px; max-width: 100%;
  font-size: 26px; line-height: 32px; font-weight: 500; color: var(--lp-ink);
}
.lp-hero-title > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.lp-hero-mark {
  width: 26px; height: 26px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(145deg, #3b82f6, #22c55e); color: #fff;
}
.lp-hero-status { margin: 0; max-width: 100%; font-size: 15px; line-height: 22px; font-weight: 400; color: var(--lp-ink-2); text-wrap: balance; }
.lp-hero-status b { color: var(--lp-ink); font-weight: 500; }
.lp-hero-care { color: var(--lp-ink); }
.lp-hero-sep, .lp-row-sep { color: var(--lp-ink-3); margin: 0 8px; }
.lp-row-sep { margin: 0 2px; }
.lp-hero-link, .lp-row-link {
  display: inline; padding: 0; border: 0; background: transparent; color: var(--lp-accent);
  font: inherit; cursor: pointer; white-space: nowrap; border-radius: 4px;
}
.lp-hero-link:hover, .lp-row-link:hover { text-decoration: underline; text-underline-offset: 3px; }

/* The second line: record changes a doctor should see. Quiet, but in the warning ink. */
.lp-hero-changes { margin: -2px 0 0; max-width: 100%; font-size: 13px; line-height: 20px; font-weight: 400; color: var(--lp-warn-ink); text-wrap: balance; }
.lp-hero-changes-icon { margin-right: 4px; vertical-align: -2px; }
.lp-hero-changes .lp-hero-sep { margin: 0 6px; }
.lp-hero-row { width: 100%; margin-top: 4px; }

/* --- the row under the composer (portalled in after conversation.composer.bar, only with the greeting) --- */
/* The host is the last child of DSH's hero composer stack; home.ts sets its top margin so the row sits
   12 px under the card whatever the stack's gap. Empty (no row for this stage), it takes no room. */
.lp-home-host {
  display: flex; flex-wrap: wrap; justify-content: center; width: 100%; min-width: 0; box-sizing: border-box;
  padding: 0 var(--dsh-composer-side-clearance, 16px);
}
.lp-home-host:empty { display: none; }
.lp-home-row {
  width: 100%; max-width: var(--dsh-composer-card-max-width, 744px); margin: 0 auto; padding: 0 8px;
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px 6px;
  font-size: 13px; line-height: 20px; color: var(--lp-ink-2); animation: lp-fade .35s ease both;
}
.lp-suggest {
  height: 32px; max-width: 100%; padding: 0 12px; border-radius: 16px; border: 1px solid var(--lp-line-2);
  background: var(--lp-bg); color: var(--lp-ink-2); font-size: 13px; line-height: 20px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background-color .15s ease, color .15s ease;
}
.lp-suggest:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-task {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 9px; border-radius: 15px;
  border: 1px solid var(--lp-line-1); background: var(--lp-hover); color: var(--lp-ink-2); font-size: 13px; line-height: 20px;
  cursor: pointer; white-space: nowrap; transition: background-color .15s ease;
}
.lp-task:hover:not(.lp-task-done) { background: var(--lp-press); color: var(--lp-ink); }
.lp-task:disabled { cursor: progress; }
.lp-task-done { cursor: default; }
.lp-task-ring {
  width: 14px; height: 14px; flex: none; border-radius: 50%; border: 1.5px solid var(--lp-ink-3);
  display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: background-color .2s ease, border-color .2s ease;
}
.lp-task-done .lp-task-ring { border-color: var(--lp-good); background: var(--lp-good); animation: lp-pop .35s ease; }
.lp-row-note { flex-basis: 100%; text-align: center; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-mark { display: inline-flex; }

/* --- reminder pill (shell overlay: click-through layer) ---------------------------------------- */
/* Bottom-right, but lifted clear of a chat's composer so it never covers the send button. */
.lp-pill-wrap {
  position: absolute; right: 20px; bottom: 136px; z-index: 1; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 2px; padding: 4px; border-radius: 20px;
  background: var(--lp-layer-2); box-shadow: var(--lp-lift); animation: lp-rise .4s ease both;
}
.lp-pill-main { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 4px; border: 0; border-radius: 16px; background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer; }
.lp-pill-main:hover { background: var(--lp-hover); }
.lp-pill-mark { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-brand); color: var(--lp-on-brand); }
.lp-pill-count { font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-pill-x { width: 28px; height: 28px; border: 0; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--lp-ink-3); cursor: pointer; }
.lp-pill-x:hover { background: var(--lp-hover); color: var(--lp-ink); }

/* --- onboarding (inside DSH's Modal card) ------------------------------------------------------ */
/* The Modal card is sized by className, and by what it directly holds in case the host ignores className. */
.lp-onb-dialog.lp-onb-dialog, div:has(> .lp-onb.lp-onb) { width: min(600px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-onb { display: flex; flex-direction: column; max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px 28px 28px; }
@media (max-width: 560px) { .lp-onb { padding: 20px; } }
.lp-onb-progress { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.lp-dots { list-style: none; display: flex; gap: 6px; margin: 0; padding: 0; }
.lp-dot-step { width: 6px; height: 6px; border-radius: 3px; background: var(--lp-line-3); transition: width .25s ease, background-color .25s ease; }
.lp-dot-now { width: 20px; background: var(--lp-brand); }
.lp-dot-past { background: var(--lp-ink-3); }
.lp-onb-title { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; outline: none; }
.lp-onb-body { margin-top: 18px; }
.lp-onb-lead { margin: 0 0 18px; color: var(--lp-ink-2); }
.lp-onb-computing { display: grid; gap: 10px; }
.lp-onb .lp-profile { gap: 16px; }

/* --- 5.1: tabs, banner, ⓘ, load errors ------------------------------------------------------ */
.lp-banner {
  display: flex; align-items: center; gap: 8px; width: 100%; margin: -12px 0 18px; padding: 10px 14px; border-radius: 12px;
  border: 0; background: var(--lp-accent-wash); color: var(--lp-ink); font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-banner .lp-icon { color: var(--lp-accent); }
.lp-banner:hover { background: var(--lp-accent-soft); }
.lp-banner-go { margin-left: auto; color: var(--lp-accent); white-space: nowrap; }
.lp-tabs { display: flex; gap: 4px; margin: 0 0 20px; max-width: 100%; border-bottom: .5px solid var(--lp-line-2); overflow-x: auto; scrollbar-width: none; }
.lp-tab {
  position: relative; display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border: 0; background: transparent;
  color: var(--lp-ink-2); font-size: 14px; line-height: 22px; cursor: pointer; white-space: nowrap; border-radius: 8px 8px 0 0;
}
.lp-tab:hover { color: var(--lp-ink); background: var(--lp-hover); }
.lp-tab-on { color: var(--lp-ink); font-weight: 500; }
.lp-tab-on::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -.5px; height: 2px; border-radius: 1px; background: var(--lp-brand); }
.lp-tab-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--lp-hover); font-size: 11px; line-height: 18px; text-align: center; }
.lp-tab-body { display: grid; gap: 16px; }
.lp-tab-body > .lp-section { margin-top: 28px; }
.lp-tab-body > .lp-section:first-child { margin-top: 0; }
.lp-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.lp-card-head .lp-label { margin: 0; }
.lp-info-wrap { position: relative; display: inline-flex; vertical-align: middle; }
.lp-info-btn {
  width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--lp-ink-3); cursor: pointer;
}
.lp-info-btn:hover, .lp-info-btn[aria-expanded="true"] { color: var(--lp-ink); background: var(--lp-hover); }
.lp-info-pop {
  position: absolute; top: calc(100% + 6px); z-index: 20; width: min(300px, 80vw); padding: 10px 12px; border-radius: 12px;
  background: var(--lp-layer-2); box-shadow: var(--lp-lift); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400;
  text-align: left; white-space: normal; display: grid; gap: 6px; animation: lp-fade .15s ease both;
}
.lp-info-start { left: -8px; }
.lp-info-end { right: -8px; }
.lp-info-line { display: block; }
.lp-loaderror { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--lp-ink); }
.lp-loaderror > .lp-icon { color: var(--lp-warn-ink); }
.lp-loaderror-text { flex: 1; min-width: 200px; }
.lp-loaderror-compact { margin-top: 12px; padding: 8px 10px; border-radius: 10px; background: var(--lp-warn-wash); font-size: 13px; line-height: 20px; }
.lp-empty { display: flex; gap: 14px; align-items: flex-start; }
.lp-empty > .lp-icon { margin-top: 3px; color: var(--lp-ink-3); }
.lp-empty .lp-muted { margin: 4px 0 12px; }
.lp-partial { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 20px; }
.lp-partial .lp-icon { margin-top: 3px; color: var(--lp-warn-ink); }
.lp-statusdot-warn { background: var(--lp-warn); box-shadow: 0 0 0 3px var(--lp-warn-wash); }
.lp-more > summary, .lp-basis > summary, .lp-draft-more > summary, .lp-evidence-more > summary, .lp-tool-report > summary {
  cursor: pointer; width: fit-content; color: var(--lp-ink-2); font-size: 13px; line-height: 20px;
}
.lp-more > summary .lp-optional { margin-left: 8px; }

/* --- 5.1: check-ins with three answers ---------------------------------------------------------- */
.lp-choices { display: inline-flex; align-items: center; gap: 6px; flex: none; }
.lp-choice {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px;
  border: .5px solid var(--lp-line-3); background: transparent; color: var(--lp-ink); font-size: 12px; line-height: 18px; cursor: pointer; white-space: nowrap;
}
.lp-choice:hover:not(:disabled) { background: var(--lp-hover); }
.lp-choice:disabled { cursor: progress; opacity: .6; }
.lp-choice-done { background: var(--lp-brand); color: var(--lp-on-brand); border-color: transparent; }
.lp-choice-done:hover:not(:disabled) { background: var(--lp-brand); opacity: .88; }
.lp-choice-undo { border-color: transparent; color: var(--lp-ink-3); }
.lp-choice-undo:hover:not(:disabled) { color: var(--lp-ink); }
.lp-choice-state { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 13px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.lp-choice-state-done { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-choice-state-missed { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-today-missed .lp-today-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-item-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

/* --- 5.1: 概览 ------------------------------------------------------------------------------ */
.lp-today-card .lp-today-row { border-top: .5px solid var(--lp-line-2); padding: 6px 0; }
.lp-today-card .lp-today-row:first-child { border-top: 0; }
.lp-week { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--lp-line-2); }
.lp-week-cells { list-style: none; display: inline-flex; gap: 3px; margin: 0; padding: 0; }
.lp-week-cell { width: 20px; height: 20px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-line-1); box-shadow: inset 0 0 0 .5px var(--lp-line-2); }
.lp-week-day { font-size: 10px; line-height: 12px; color: var(--lp-ink-3); }
.lp-week-done { background: var(--lp-accent); box-shadow: none; }
.lp-week-done .lp-week-day { color: #fff; }
.lp-week-part { background: var(--lp-accent-soft); box-shadow: none; }
.lp-week-missed { background: var(--lp-line-3); box-shadow: none; }
.lp-overview .lp-results .lp-card { padding: 18px 20px; }
.lp-overview .lp-bignum { font-size: 40px; line-height: 48px; }
.lp-overview .lp-result-figure { margin-bottom: 6px; }
.lp-overview .lp-result-figure .lp-pill { align-self: center; margin-left: 4px; }
.lp-overview .lp-result .lp-chart { margin: 4px 0 6px; }
.lp-overview .lp-result-goal { margin: 4px 0 8px; }
.lp-result > .lp-caption:last-child { margin-top: auto; padding-top: 8px; }
.lp-result-head .lp-label { align-items: center; gap: 4px; }
.lp-next-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.lp-care-card { flex-direction: column; align-items: stretch; }
.lp-visit { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.lp-visit-form { display: flex; flex-direction: column; gap: 8px; }
.lp-visit-outcome { width: 100%; font: inherit; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--lp-line, #ddd); }
.lp-brief-text { white-space: pre-wrap; max-height: 55vh; overflow: auto; font-size: 13px; line-height: 1.6; padding: 12px; border-radius: 8px; background: var(--lp-soft, rgba(0,0,0,0.03)); }
.lp-next-text { min-width: 0; flex: 1; }
.lp-next-text .lp-label { margin-bottom: 4px; }
.lp-next-text .lp-muted { margin-top: 2px; }
.lp-notable { scroll-margin-top: 24px; }
.lp-notable-list { list-style: none; margin: 8px 0 0; padding: 0; }
.lp-notable-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 140px; align-items: center; gap: 12px; padding: 8px 0; border-top: .5px solid var(--lp-line-2); }
.lp-notable-row:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-notable-row { grid-template-columns: auto minmax(0, 1fr) auto; } .lp-notable-row .lp-change-spark { display: none; } }
/* Narrow screens: the verdict chip on its own line, then the marker name and its values, so a long name is never a one-character column. */
@container lp-root (max-width: 480px) { .lp-notable-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; column-gap: 8px; } .lp-notable-row > .lp-chip-c { grid-column: 1 / -1; justify-self: start; } .lp-notable-values { white-space: normal; text-align: right; } }
.lp-notable-pointer { margin: 8px 0 0; }
.lp-bioage-gap { margin: 2px 0 0; }
.lp-notable-values { white-space: nowrap; }
.lp-basis { margin-top: 12px; }
.lp-basis .lp-change-notes { margin-top: 8px; }
.lp-chip-c { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px 0 6px; border-radius: 11px; font-size: 12px; font-weight: 500; color: var(--lp-ink); white-space: nowrap; }
.lp-chip-c-good { background: var(--lp-good-wash); }
.lp-chip-c-good .lp-icon { color: var(--lp-good-ink); }
.lp-chip-c-warn { background: var(--lp-warn-wash); }
.lp-chip-c-warn .lp-icon { color: var(--lp-warn-ink); }
.lp-chip-c-neutral, .lp-chip-c-within { background: var(--lp-hover); }
.lp-chip-c-neutral .lp-icon, .lp-chip-c-within .lp-icon { color: var(--lp-ink-3); }
.lp-chip-c-unjudged { background: transparent; color: var(--lp-ink-3); font-weight: 400; box-shadow: inset 0 0 0 .5px var(--lp-line-3); padding: 0 8px; }

/* --- 5.1: 指标 ------------------------------------------------------------------------------ */
.lp-ind-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-ind-toolbar > .lp-caption { display: inline-flex; align-items: center; gap: 6px; }
.lp-ind-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.lp-ind-filters .lp-toggle { height: 30px; padding: 0 12px; }
.lp-toggle-count { font-size: 11px; color: inherit; opacity: .65; font-variant-numeric: tabular-nums; }
.lp-ind-card { padding: 8px 22px 12px; }
.lp-ind-head, .lp-ind-btn { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.2fr) 96px 120px 44px 16px; align-items: center; gap: 12px; }
.lp-ind-head { padding: 8px 0; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); border-bottom: .5px solid var(--lp-line-2); }
.lp-ind-head > span:last-child { grid-column: 5 / 7; }
@container lp-root (max-width: 700px) {
  .lp-ind-head { display: none; }
  .lp-ind-btn { grid-template-columns: minmax(0, 1fr) auto 16px; row-gap: 4px; }
  .lp-ind-spark, .lp-ind-source { display: none; }
  .lp-ind-value { grid-column: 1; grid-row: 2; }
  .lp-ind-judged { grid-column: 2; grid-row: 1 / 3; }
  .lp-ind-chevron { grid-column: 3; grid-row: 1 / 3; }
}
.lp-ind-group-title { display: flex; align-items: baseline; gap: 8px; margin: 18px 0 2px; font-size: 13px; line-height: 20px; font-weight: 500; color: var(--lp-ink-2); }
.lp-ind-list { list-style: none; margin: 0; padding: 0; }
.lp-ind-row { border-top: .5px solid var(--lp-line-1); }
.lp-ind-row:first-child { border-top: 0; }
.lp-ind-btn { width: 100%; max-width: 100%; min-height: 44px; padding: 6px 8px; margin: 0; box-sizing: border-box; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.lp-ind-btn:hover, .lp-ind-open .lp-ind-btn { background: var(--lp-hover); }
.lp-ind-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.lp-ind-name .lp-strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-tag-plan { height: 18px; padding: 0 6px; background: var(--lp-accent-wash); color: var(--lp-accent); }
.lp-ind-value { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lp-ind-value .lp-num { color: var(--lp-ink); font-weight: 500; }
.lp-ind-date { margin-left: 8px; }
.lp-ind-error { display: inline-flex; align-items: center; gap: 4px; min-width: 0; grid-column: 2 / 4; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-ind-failed .lp-ind-spark { display: none; }
.lp-ind-source { text-align: left; }
.lp-ind-chevron { color: var(--lp-ink-3); transition: transform .15s ease; }
.lp-ind-open .lp-ind-chevron { transform: rotate(90deg); }
.lp-spark { display: block; overflow: visible; }
.lp-spark-line { fill: none; stroke: var(--lp-accent); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.lp-spark-dot { fill: var(--lp-accent); }
.lp-spark-none { font-size: 11px; color: var(--lp-ink-4); }
.lp-ind-panel { padding: 8px 0 16px; }
.lp-ind-detail { display: grid; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-ind-detail p { margin: 0; }
.lp-ind-detail a { color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-ind-table { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.lp-ind-table th, .lp-ind-table td { text-align: left; padding: 4px 8px 4px 0; border-bottom: .5px solid var(--lp-line-2); }
.lp-ind-table th { color: var(--lp-ink-2); font-weight: 500; }
.lp-ind-skeleton { margin: 10px 0; }

/* --- 5.1: data connection ------------------------------------------------------------------- */
.lp-conn { display: grid; gap: 12px; }
.lp-conn-status { display: grid; gap: 4px; }
.lp-conn-url code { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 12px; overflow-wrap: anywhere; }
.lp-conn-form { display: grid; gap: 12px; }
.lp-conn-form .lp-form-actions { margin-top: 0; }
.lp-conn-form .lp-fine { margin-top: 0; }
.lp-conn-change { justify-self: start; font-size: 13px; }
.lp-section > .lp-loaderror { margin-bottom: 16px; }
.lp-conn-ok { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--lp-good-ink); font-size: 13px; line-height: 20px; }

/* --- 5.1: onboarding steps 1, 3, 4 ------------------------------------------------------------ */
.lp-onb-hint { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 10px 12px; border-radius: 12px; background: var(--lp-warn-wash); font-size: 13px; line-height: 20px; }
.lp-onb-hint > .lp-icon { color: var(--lp-warn-ink); }
.lp-onb-hint > span { flex: 1; min-width: 180px; }
.lp-found { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.lp-found-tile { display: grid; gap: 2px; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-found-figure { font-size: 26px; line-height: 34px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-found-figure .lp-bignum-unit { margin-left: 3px; font-size: 13px; }
.lp-found-changes { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-found-changes .lp-icon { margin-top: 3px; color: var(--lp-ink-3); }
.lp-found-changes-warn { background: var(--lp-warn-wash); }
.lp-found-changes-warn .lp-icon { color: var(--lp-warn-ink); }
.lp-now-block .lp-subhead { margin-top: 4px; }
.lp-nows { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-now { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-now-icon { width: 30px; height: 30px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-layer); color: var(--lp-ink-2); box-shadow: 0 0 0 .5px var(--lp-line-3); }
.lp-now-text { flex: 1; min-width: 180px; display: grid; gap: 2px; }
.lp-now-text .lp-inline-self { margin-top: 6px; }

/* --- 5.1: plan draft, confirm, reminders -------------------------------------------------------- */
.lp-draft > .lp-draft-block { margin-top: 12px; }
.lp-draft-more { margin-top: 14px; }
.lp-draft-more .lp-priorities, .lp-draft-more .lp-rows { margin-top: 8px; }
.lp-evidence-more > summary { font-size: 12px; color: var(--lp-ink-3); }
.lp-evidence-more .lp-caption { margin: 4px 0 0; }
.lp-evidence-more a { color: var(--lp-accent); text-decoration: none; overflow-wrap: anywhere; }
.lp-draft-item-compact { padding: 10px 12px; gap: 4px; }
.lp-draft-item-compact .lp-draft-item-title { font-size: 14px; }
.lp-confirm-remind { margin-top: 4px; padding: 10px 12px; border-radius: 12px; background: var(--lp-well); width: 100%; }
.lp-followup-panel { display: grid; gap: 12px; }
.lp-remind { display: grid; gap: 6px; }
.lp-remind .lp-caption { margin: 0; }
.lp-remind-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-more .lp-followup { margin-top: 12px; }

/* --- 5.1: settings page (inside DSH's settings panel) --------------------------------------------- */
.lp-settings { container: lp-root / inline-size; display: grid; gap: 4px; padding-bottom: 24px; }
.lp-set-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.lp-set-block { padding: 18px 0; border-top: .5px solid var(--lp-line-2); }
.lp-set-head + .lp-set-block, .lp-notice-slot + .lp-set-block { border-top: 0; }
.lp-set-title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 12px; font-size: 15px; line-height: 22px; font-weight: 500; }
.lp-set-block .lp-more > summary .lp-set-title { display: inline-flex; margin: 0; }
.lp-privacy { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 12px; }
.lp-privacy-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-privacy-row .lp-muted { margin: 2px 0 0; font-size: 13px; line-height: 20px; }
.lp-methods { display: grid; gap: 4px; margin-top: 12px; }
.lp-methods .lp-card { padding: 16px 18px; }

/* --- 5.1: home check-in pills with a popover ------------------------------------------------------ */
.lp-task-wrap { position: relative; display: inline-flex; }
.lp-task-missed .lp-task-ring { border-color: var(--lp-ink-3); background: var(--lp-ink-3); }
.lp-task-done, .lp-task-missed { cursor: pointer; }
.lp-task-menu {
  position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 30; display: flex; gap: 2px; padding: 4px;
  border-radius: 14px; background: var(--lp-layer-2); box-shadow: var(--lp-lift); animation: lp-fade .12s ease both;
}
.lp-task-choice { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: var(--lp-ink); font-size: 13px; cursor: pointer; white-space: nowrap; }
.lp-task-choice:hover:not(:disabled) { background: var(--lp-hover); }
.lp-task-choice:disabled { color: var(--lp-ink-4); cursor: default; }
.lp-task-undo { color: var(--lp-ink-2); }

/* --- 5.1: chat cards (tool.call.toolview) ------------------------------------------------------ */
.lp-tool { container: lp-root / inline-size; font-size: 13px; line-height: 20px; margin: 2px 0; }
.lp-tool-card { border-radius: 14px; padding: 10px 14px 12px; box-shadow: inset 0 0 0 .5px var(--lp-line-3); background: var(--lp-layer); max-width: 680px; }
.lp-tool-quiet { padding: 0; }
.lp-tool-error.lp-tool-card { box-shadow: inset 0 0 0 .5px var(--lp-warn); }
.lp-tool-head { display: flex; align-items: center; gap: 6px; min-height: 24px; min-width: 0; flex-wrap: wrap; }
.lp-tool-icon { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); flex: none; }
.lp-tool-title { color: var(--lp-ink-2); font-weight: 500; white-space: nowrap; }
.lp-tool-quiet .lp-tool-title { font-weight: 400; }
.lp-tool-summary { color: var(--lp-ink-3); min-width: 0; }
.lp-tool-summary::before { content: "·"; margin: 0 6px 0 2px; color: var(--lp-ink-4); }
.lp-tool-warn { color: var(--lp-warn-ink); }
.lp-tool-bad { color: var(--lp-bad); }
.lp-tool-raw-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; height: 22px; padding: 0 6px; border: 0; border-radius: 6px; background: transparent; color: var(--lp-ink-3); font-size: 12px; cursor: pointer; }
.lp-tool-raw-btn:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-rot { transform: rotate(90deg); }
.lp-tool-undo { height: 22px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--lp-accent); font-size: 12px; cursor: pointer; }
.lp-tool-undo:hover:not(:disabled) { background: var(--lp-hover); }
.lp-tool-undo:disabled { color: var(--lp-ink-3); cursor: progress; }
.lp-tool-body { display: grid; gap: 8px; margin-top: 8px; }
.lp-tool-quiet .lp-tool-body { margin: 2px 0 0 22px; }
.lp-tool-raw {
  margin: 8px 0 0; max-height: 240px; overflow: auto; padding: 10px 12px; border-radius: 10px; background: var(--lp-well);
  box-shadow: inset 0 0 0 .5px var(--lp-line-2); font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 11.5px; line-height: 17px; color: var(--lp-ink-2); white-space: pre-wrap; word-break: break-word;
}
.lp-chip-saved { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--lp-good-wash); color: var(--lp-good-ink); font-size: 12px; font-weight: 500; white-space: normal; }
.lp-tool-summary .lp-chip-saved::before, .lp-tool-summary:has(.lp-chip-saved)::before { content: none; }
.lp-chip-undone { background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-tool-saved { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.lp-tool-draft { display: grid; gap: 8px; }
.lp-tool-draft .lp-draft-block { margin: 0; }
.lp-tool-draft .lp-form-actions { margin-top: 4px; }
.lp-readback { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.lp-readback li { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; padding: 6px 10px; border-radius: 10px; background: var(--lp-well); }
.lp-tool-result { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.lp-tool-figure { font-size: 28px; line-height: 36px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lp-tool-figure .lp-bignum-unit { margin-left: 3px; font-size: 13px; }
.lp-tool-report pre { margin: 6px 0 0; max-height: 240px; overflow: auto; white-space: pre-wrap; font-size: 12px; line-height: 18px; color: var(--lp-ink-2); }
.lp-tool-doctor { display: flex; gap: 4px; align-items: flex-start; margin: 0; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-tool-doctor .lp-icon { margin-top: 2px; flex: none; }
.lp-tool .lp-caption { margin: 0; }

/* Quick actions under a finished turn: one quiet row, wrapping in a narrow chat. */
.lp-turn-tail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0 2px; font-size: 13px; line-height: 20px; }
.lp-tail-group { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lp-tail-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 13px;
  border: .5px solid var(--lp-line-2); background: var(--lp-layer); color: var(--lp-ink); font: inherit; font-size: 12px; cursor: pointer;
}
.lp-tail-btn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-tail-btn:disabled { color: var(--lp-ink-3); cursor: progress; }
.lp-tail-primary { border-color: transparent; background: var(--lp-accent); color: #fff; }
.lp-tail-primary:hover:not(:disabled) { background: var(--lp-accent); filter: brightness(1.08); }
.lp-tail-links { display: inline-flex; gap: 12px; margin-left: auto; font-size: 12px; }
.lp-turn-tail .lp-form-error { margin: 0; font-size: 12px; }

/* The 健康 tab in DSH's right column: the 概览 tab, laid out for a narrow column by the lp-root queries. */
.lp-pane { container: lp-root / inline-size; display: grid; gap: 12px; padding: 12px 14px 24px; }
.lp-pane-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lp-pane-head .lp-label { display: inline-flex; align-items: center; gap: 6px; }
.lp-pane .lp-card { padding: 14px 16px; }
.lp-pane .lp-overview { gap: 12px; }
.lp-pane-loading { display: grid; gap: 12px; }
.lp-pane-foot { margin: 4px 0 0; }

.lp-subnav { display: flex; gap: 8px; flex-wrap: wrap; margin: -8px 0 16px; }
.lp-subnav-btn { border: 0; background: transparent; color: var(--lp-ink-2); font: inherit; padding: 4px 2px; cursor: pointer; }
.lp-subnav-on { color: var(--lp-ink); font-weight: 600; }
.lp-move { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lp-move-lead { font-variant-numeric: tabular-nums; }
.lp-move-second { color: var(--lp-ink-2); font-size: 13px; }
.lp-move-btn { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lp-quest-grid { display: grid; gap: 8px; }
.lp-quest-card { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; border: 1px solid var(--lp-line-2); border-radius: 12px; background: var(--lp-layer); color: inherit; font: inherit; padding: 12px; cursor: pointer; }
.lp-life-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.lp-season-bar-track { height: 8px; border-radius: 99px; background: var(--lp-line-2); overflow: hidden; }
.lp-season-bar-track > span { display: block; height: 100%; background: var(--lp-accent); }
.lp-timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-timeline-date { display: inline-block; min-width: 7em; color: var(--lp-ink-3); }
.lp-ask-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
.lp-ask-q { width: 100%; text-align: left; border: 1px solid var(--lp-line-2); border-radius: 12px; background: transparent; color: inherit; font: inherit; padding: 10px 12px; cursor: pointer; }
.lp-trends { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
.lp-spin { animation: lp-spin 1s linear infinite; }
@keyframes lp-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-pulse { 50% { opacity: .45; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
.lp-card, .lp-result, .lp-overview, .lp-science, .lp-tab-body, .lp-method-block, .lp-results { min-width: 0; max-width: 100%; box-sizing: border-box; }
.lp-science, .lp-science p, .lp-science h2, .lp-science label, .lp-card p, .lp-muted, .lp-caption { overflow-wrap: anywhere; }
.lp-actions, .lp-form-actions, .lp-life-row { flex-wrap: wrap; max-width: 100%; }
.lp-found { grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); }
.lp-timeline-date { min-width: 0; }
@media (max-width: 420px) {
  .lp-page { padding-left: 12px; padding-right: 12px; }
  .lp-results, .lp-grid-2, .lp-method-block, .lp-first { grid-template-columns: minmax(0, 1fr); }
  .lp-header, .lp-result-head, .lp-card-head { flex-wrap: wrap; }
  .lp-linkbtn, .lp-bignum { max-width: 100%; }
  .lp-bignum { font-size: 36px; line-height: 44px; }
}
/* A narrow page or settings column (a phone, or DSH's settings dialog at phone width, where the LongPi column
   is only about 110 px): every row wraps, fields take the column's width, nothing is pushed past the edge. */
@container lp-root (max-width: 360px) {
  .lp-settings > *, .lp-settings section, .lp-settings div, .lp-settings form, .lp-settings fieldset, .lp-settings label,
  .lp-settings li, .lp-settings details, .lp-settings summary, .lp-settings span, .lp-settings p, .lp-settings h2, .lp-settings h3 { min-width: 0; max-width: 100%; }
  .lp-settings input:not([type=radio]):not([type=checkbox]), .lp-settings select, .lp-settings textarea { min-width: 0 !important; max-width: 100%; width: 100%; box-sizing: border-box; }
  .lp-settings button { max-width: 100%; height: auto; min-height: 30px; white-space: normal; text-align: left; }
  .lp-settings .lp-set-head, .lp-settings .lp-set-title, .lp-settings .lp-field-label, .lp-settings .lp-input-unit, .lp-settings .lp-seg,
  .lp-settings .lp-status, .lp-settings .lp-privacy-row, .lp-settings .lp-switch, .lp-settings .lp-check, .lp-settings .lp-subhead,
  .lp-settings .lp-remind-row, .lp-settings .lp-form-actions { flex-wrap: wrap; }
  .lp-settings .lp-grid-2, .lp-settings .lp-followup-times, .lp-settings .lp-followup-grid, .lp-settings .lp-remind { grid-template-columns: minmax(0, 1fr); }
  .lp-settings .lp-seg { width: auto; max-width: 100%; }
  .lp-settings .lp-seg-opt, .lp-settings .lp-seg-opt span { min-width: 0; height: auto; white-space: normal; }
  .lp-settings, .lp-settings * { overflow-wrap: anywhere; }
}
/* On a narrow page an ⓘ note spans the column instead of hanging off the button toward the edge. The page root
   contains layout, so "fixed" here is relative to it. */
@container lp-root (max-width: 480px) {
  .lp-info-pop { position: fixed; left: 12px; right: 12px; top: auto; width: auto; max-width: none; margin-top: 28px; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-card, .lp-win, .lp-pop, .lp-skeleton, .lp-hero, .lp-home-row, .lp-task-ring, .lp-pill-wrap, .lp-notice, .lp-spin, .lp-info-pop, .lp-task-menu { animation: none; }
  .lp-ring-fill, .lp-body, .lp-dot, .lp-dot-step, .lp-switch-track, .lp-switch-thumb { transition: none; }
}
`;
		function injectStyles() {
			const id = "dsh-plugin-longpi-style";
			const existing = document.getElementById(id);
			if (existing) {
				existing.textContent = CSS;
				return;
			}
			const style = document.createElement("style");
			style.id = id;
			style.textContent = CSS;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/turn-data.ts
		/** The LongPi tools whose outcome can leave something to do after the turn. */
		const TAIL_TOOLS = [
			"draft_intervention_plan",
			"save_intervention_plan",
			"log_intervention_checkin"
		];
		const LONGPI_TURN_KEY = "longpi";
		const LONGPI_TURN_KIND = "dsh-plugin-longpi.turn";
		function objectOf$1(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function parsed(text) {
			if (typeof text !== "string" || !text.trim()) return null;
			try {
				const value = JSON.parse(text);
				return value && typeof value === "object" && !Array.isArray(value) ? value : null;
			} catch {
				return null;
			}
		}
		function isTailTool(name) {
			return typeof name === "string" && TAIL_TOOLS.includes(name);
		}
		/** A tool result as it entered the transcript, not a replacement copy (DSH's append-origin surface events). */
		function appended(event) {
			return event.surfaceOp === void 0 || event.surfaceOp === "append";
		}
		function turnOf(event) {
			const turn = objectOf$1(event.data).turn;
			return typeof turn === "number" && Number.isInteger(turn) ? turn : null;
		}
		/** The result block of a tool/result event: its call id, error flag and text. */
		function resultOf(event) {
			const message = objectOf$1(objectOf$1(event.data).message);
			const block = objectOf$1(Array.isArray(message.content) ? message.content[0] : void 0);
			const callId = String(objectOf$1(message.source).callId ?? block.toolCallId ?? "");
			if (!callId) return null;
			const text = (Array.isArray(block.content) ? block.content : []).map((part) => objectOf$1(part)).filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
			return {
				callId,
				isError: block.isError === true,
				text
			};
		}
		/** DSH's ConversationNodeDefinition, restated with only what this one uses (the package is not a dependency). */
		const longPiTurnDefinition = {
			kind: LONGPI_TURN_KIND,
			match(event) {
				const turn = turnOf(event);
				if (turn == null) return null;
				if (event.type === "turn/start") return {
					id: String(turn),
					role: "start"
				};
				if (event.type === "tool/call" && isTailTool(objectOf$1(event.data).name)) return {
					id: String(turn),
					role: "update"
				};
				if (event.type === "tool/result" && appended(event)) return {
					id: String(turn),
					role: "update"
				};
				return null;
			},
			start(_context, match) {
				return {
					turn: turnOf(match.event) ?? 0,
					pending: /* @__PURE__ */ new Map(),
					calls: []
				};
			},
			update(context, match) {
				const { event } = match;
				const state = context.state;
				if (event.type === "tool/call") {
					const data = objectOf$1(event.data);
					if (!isTailTool(data.name) || typeof data.callId !== "string") return state;
					const pending = new Map(state.pending);
					pending.set(data.callId, {
						name: data.name,
						args: parsed(data.arguments) ?? {}
					});
					return {
						...state,
						pending
					};
				}
				if (event.type !== "tool/result") return state;
				const result = resultOf(event);
				const call = result ? state.pending.get(result.callId) : void 0;
				if (!result || !call) return state;
				const pending = new Map(state.pending);
				pending.delete(result.callId);
				const settled = {
					callId: result.callId,
					name: call.name,
					seq: event.seq ?? 0,
					args: call.args,
					result: result.isError ? null : parsed(result.text),
					isError: result.isError
				};
				return {
					...state,
					pending,
					calls: [...state.calls, settled]
				};
			},
			buildLocationData(context, scope, previous) {
				const state = context.state;
				if (scope !== "turn" || !state || state.calls.length === 0) return null;
				const value = previous?.kind === "turn" && previous.key === "longpi" ? previous.value : void 0;
				if (value && value.turn === state.turn && value.calls === state.calls) return previous;
				return {
					kind: "turn",
					turn: state.turn,
					key: LONGPI_TURN_KEY,
					value: {
						turn: state.turn,
						calls: state.calls
					}
				};
			}
		};
		/** A read-back is waiting when the turn's last save call was confirm=false and came back readable, unsaved. */
		function waitingReadBack(calls) {
			const last = [...calls].reverse().find((call) => call.name === "save_intervention_plan");
			if (!last || last.isError || !last.result) return null;
			if (last.args.confirm === true || last.result.saved !== false) return null;
			return (Array.isArray(last.result.errors) ? last.result.errors : []).length === 0 ? last : null;
		}
		/** The turn's actions, or null when it left nothing to do (the chain then falls through to other tails). */
		function tailMatchOf(data) {
			const calls = data?.calls ?? [];
			if (calls.length === 0) return null;
			const draft = [...calls].reverse().find((call) => call.name === "draft_intervention_plan" && !call.isError && objectOf$1(call.result).draft != null) ?? null;
			const readBack = waitingReadBack(calls);
			const saved = [...calls].reverse().find((call) => call.name === "save_intervention_plan" && call.args.confirm === true && objectOf$1(call.result).saved === true) ?? null;
			const checkin = [...calls].reverse().find((call) => call.name === "log_intervention_checkin" && !call.isError && Array.isArray(objectOf$1(call.result).entries) && objectOf$1(call.result).entries.length > 0) ?? null;
			if (!draft && !readBack && !saved && !checkin) return null;
			return {
				draft,
				readBack,
				saved,
				checkin
			};
		}
		/** The turn-tail chain selector: DSH's owner carries the turn, whose data store holds LongPi's value. */
		function selectLongPiTail(owner) {
			try {
				return tailMatchOf(owner.turn?.data?.get?.(LONGPI_TURN_KEY));
			} catch {
				return null;
			}
		}
		//#endregion
		//#region src/client/turn-tail.ts
		const h$1 = react.default.createElement;
		function objectOf(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function strings(value) {
			return Array.isArray(value) ? value.filter((row) => typeof row === "string" && row.length > 0) : [];
		}
		/** Adopt the turn's draft as drafted (removing items is the card's job, above). */
		function DraftAction(props) {
			useCallState();
			const { journey } = useJourney();
			const [confirming, setConfirming] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const adopted = adoptedVersion(props.call.callId);
			let data = null;
			try {
				data = props.call.result ? normalizePlanDraft(props.call.result) : null;
			} catch {
				data = null;
			}
			const draft = data?.draft;
			if (!data || !draft) return null;
			if (adopted != null) return h$1("span", { className: "lp-chip-saved" }, h$1(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已采用为方案第 ${adopted} 版`);
			const source = {
				focus: data.brief.focus.map(String),
				markers: strings(props.call.args.markers)
			};
			async function accept(remind) {
				if (!draft) return;
				setBusy(true);
				setError(null);
				try {
					const result = await acceptDraft(draft, draft.items, remind, source);
					if (!result.ok) {
						setError(`没有保存：${result.error}`);
						return;
					}
					setAdopted(props.call.callId, result.version);
					setConfirming(false);
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$1(react.default.Fragment, null, h$1("button", {
				type: "button",
				className: "lp-tail-btn lp-tail-primary",
				onClick: () => {
					setError(null);
					setConfirming(true);
				}
			}, h$1(Icon, {
				name: "spark",
				size: 13
			}), `采用这份方案（${draft.items.length} 项）`), confirming ? h$1(ConfirmModal, {
				draft,
				items: draft.items,
				goals: keptGoals(draft, draft.items),
				today: journey?.today ?? localToday$1(),
				busy,
				error,
				onCancel: () => setConfirming(false),
				onConfirm: (remind) => {
					accept(remind);
				}
			}) : null);
		}
		/** Today's check-ins from this turn, with 撤销 while they can still be taken back. */
		function CheckinAction(props) {
			useCallState();
			const { journey } = useJourney();
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const today = journey?.today ?? localToday$1();
			const undoable = (Array.isArray(objectOf(props.call.result).entries) ? objectOf(props.call.result).entries : []).map(objectOf).filter((row) => row.undo !== true && (row.done === true || row.done === false) && row.date === today && typeof row.item === "string");
			if (undoable.length === 0) return null;
			const names = undoable.map((row) => `${String(row.title || row.item)}${row.done === false ? "（没做到）" : ""}`).join("、");
			if (isUndone(props.call.callId)) return h$1("span", { className: "lp-chip-saved lp-chip-undone" }, h$1(Icon, {
				name: "close",
				size: 12,
				strokeWidth: 2
			}), `已撤销：${names}`);
			async function undo() {
				setBusy(true);
				setError(null);
				try {
					for (const row of undoable) await postCheckIn(today, String(row.item), null);
					setUndone(props.call.callId);
				} catch (err) {
					setError(`没有撤销：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$1("span", { className: "lp-tail-group" }, h$1("span", { className: "lp-chip-saved" }, h$1(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已记录：${names}`), h$1("button", {
				type: "button",
				className: "lp-tail-btn",
				disabled: busy,
				onClick: () => {
					undo();
				},
				"aria-label": `撤销今天的打卡：${names}`
			}, busy ? "撤销中" : "撤销"), error ? h$1("span", { className: "lp-form-error" }, error) : null);
		}
		function LongPiTurnTail(props) {
			const openPane = usePaneOpener();
			const match = props.matched;
			if (!match) return null;
			const savedVersion = typeof objectOf(match.saved?.result).version === "number" ? objectOf(match.saved?.result).version : null;
			const openPlan = props.openPage ? () => {
				requestView({
					tab: "plan",
					id: "lp-plan"
				});
				props.openPage?.();
			} : null;
			const reply = (text) => setPendingPrompt(text, "page");
			return h$1("div", {
				className: "lp lp-turn-tail",
				role: "group",
				"aria-label": "LongPi 快捷操作"
			}, match.draft ? h$1(DraftAction, { call: match.draft }) : null, match.readBack && !match.saved ? h$1("span", { className: "lp-tail-group" }, h$1("span", { className: "lp-caption" }, "方案还没有保存"), h$1("button", {
				type: "button",
				className: "lp-tail-btn lp-tail-primary",
				onClick: () => reply("确认，保存这份方案")
			}, h$1(Icon, {
				name: "check",
				size: 13
			}), "确认保存"), h$1("button", {
				type: "button",
				className: "lp-tail-btn",
				onClick: () => reply("我想调整一下：")
			}, "还要调整")) : null, match.saved ? h$1("span", { className: "lp-chip-saved" }, h$1(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), savedVersion != null ? `已保存为方案第 ${savedVersion} 版` : "方案已保存") : null, match.checkin ? h$1(CheckinAction, { call: match.checkin }) : null, h$1("span", { className: "lp-tail-links" }, openPane ? h$1("button", {
				type: "button",
				className: "lp-row-link",
				onClick: openPane
			}, "在右侧查看") : null, openPlan ? h$1("button", {
				type: "button",
				className: "lp-row-link",
				onClick: openPlan
			}, "健康页 →") : null));
		}
		//#endregion
		//#region src/client/index.ts
		const h = react.default.createElement;
		const inject = ["slots", "layout"];
		/** The id of LongPi's page in DSH's settings (openSection('longpi')). */
		const SETTINGS_ID = "longpi";
		function PanelIcon(props) {
			return h(Icon, {
				name: "health",
				size: props.size ?? 18
			});
		}
		function apply(ctx) {
			registerClientModules();
			injectStyles();
			const select = (id) => {
				try {
					ctx.layout?.selectPanel(id);
				} catch {}
			};
			const face = () => ({
				openPage: () => select(PANEL_ID),
				openChat: () => select(null)
			});
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				inject: face
			}, LongPiPage));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 5,
				label: () => "健康"
			}, PanelIcon));
			ctx.slots.inject("sidebar.brand.name", () => ctx.slots.register({ name: "sidebar.brand.name" }, () => h("span", null, "LongPi")));
			ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({
				name: "conversation.hero.brand.mark",
				inject: face
			}, HomeHero));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "dsh-plugin-longpi",
				order: 90
			}, PromptBridge));
			ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
				name: "settings.onboarding",
				id: "longpi",
				order: 100,
				inject: face
			}, Onboarding));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: SETTINGS_ID,
				order: 60,
				label: () => "LongPi",
				inject: face
			}, LongPiSettings));
			for (const [key, view] of Object.entries(TOOL_VIEWS)) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key,
				inject: face
			}, view));
			for (const view of toolViewList()) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: view.tool,
				inject: face
			}, view.Component));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "longpi-reminders",
				order: 50,
				inject: face
			}, ReminderPill));
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				select: selectLongPiTail,
				inject: face
			}, LongPiTurnTail));
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: PANE_ID,
				inject: face
			}, HealthPane));
			if (typeof ctx.inject === "function") {
				ctx.inject(["uiConversation"], (sub) => {
					const events = sub.uiConversation?.events;
					if (events) sub.effect?.(() => events.register(longPiTurnDefinition), "longpi: turn data");
				});
				ctx.inject(["sidebarRightTabs"], (sub) => {
					const tabs = sub.sidebarRightTabs;
					if (tabs) sub.effect?.(() => tabs.register(paneDefinition(PanelIcon)), "longpi: 健康 tab type");
				});
				ctx.inject(["sidebarRight"], (sub) => {
					const column = sub.sidebarRight;
					if (!column) return;
					setPaneOpener(() => {
						try {
							column.openTab(PANE_KIND);
						} catch {}
					});
					sub.effect?.(() => () => setPaneOpener(null), "longpi: 健康 tab opener");
				});
				ctx.inject([
					"remote",
					"remote.llm",
					"remote.credentials"
				], (sub) => {
					setModelProbe(sub.remote);
					sub.effect?.(() => () => setModelProbe(null), "longpi: model status");
				});
				ctx.inject(["settingsScope"], (sub) => {
					try {
						const scope = sub.settingsScope;
						setModelSettings(scope?.describe?.() ?? null);
					} catch {
						setModelSettings(null);
					}
					sub.effect?.(() => () => setModelSettings(null), "longpi: model settings");
				});
			}
		}
		//#endregion
		exports.SETTINGS_ID = SETTINGS_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map