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
			"LongPi 用你自己的体检和可穿戴数据计算身体年龄、心血管风险等指标，并跟踪你的干预方案是否有效；它不做诊断，不开处方，也不给用药剂量。",
			"病历保存在你自己的 Mirobody 中，档案、方案和打卡只保存在这台电脑上；与 LongPi 对话时，对话内容会发送给 DeepSeek 模型处理。",
			"每个数字都注明来源，并标出正常波动的范围，帮助你判断哪些努力真正有效。"
		];
		//#endregion
		//#region src/client/charts.ts
		const h$25 = react.default.createElement;
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
			return h$25("div", {
				className: "lp-tip",
				style: {
					left,
					top: Math.max(0, tip.y - 12)
				},
				role: "status"
			}, h$25("div", { className: "lp-tip-title" }, tip.title), ...tip.rows.map((row, index) => h$25("div", {
				className: "lp-tip-row",
				key: index
			}, h$25("span", { className: "lp-tip-value" }, row.value), h$25("span", { className: "lp-tip-label" }, row.label))));
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
			if (points.length === 0) return h$25("div", {
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
			return h$25("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$25("svg", {
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
			}, ...yTicks.map((value) => h$25("g", { key: `g${value}` }, h$25("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(value),
				y2: y(value),
				className: "lp-grid"
			}), h$25("text", {
				x: pad.left - 6,
				y: y(value) + 3,
				className: "lp-axis",
				textAnchor: "end"
			}, fmt(value, value % 1 === 0 ? 0 : digits)))), props.band ? h$25("rect", {
				x: bandFrom,
				width: Math.max(0, width - pad.right - bandFrom),
				y: y(props.band.high),
				height: Math.max(1, y(props.band.low) - y(props.band.high)),
				className: "lp-band",
				rx: 3
			}) : null, props.reference ? h$25("g", null, h$25("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.reference.value),
				y2: y(props.reference.value),
				className: "lp-ref"
			}), props.compact ? null : h$25("text", {
				x: width - pad.right + 4,
				y: y(props.reference.value) + 3,
				className: "lp-axis"
			}, props.reference.label)) : null, props.goal != null ? h$25("g", null, h$25("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.goal),
				y2: y(props.goal),
				className: "lp-goal"
			}), props.compact ? null : h$25("text", {
				x: pad.left + 4,
				y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5),
				className: "lp-goal-text"
			}, `目标 ${fmt(props.goal, digits)}`)) : null, h$25("path", {
				d: area,
				className: "lp-area"
			}), h$25("path", {
				d: path,
				className: "lp-line"
			}), focus != null ? h$25("line", {
				x1: x(days[focus]),
				x2: x(days[focus]),
				y1: pad.top,
				y2: height - pad.bottom,
				className: "lp-cross"
			}) : null, ...points.map((point, index) => points.length > 24 && index !== points.length - 1 && index !== focus ? null : h$25("circle", {
				key: `p${index}`,
				cx: x(days[index]),
				cy: y(point.value),
				r: focus === index ? 5.5 : 4,
				className: "lp-dot"
			})), props.compact ? null : h$25("text", {
				x: x(days.at(-1)) + 8,
				y: y(last.value) + 4,
				className: "lp-end"
			}, `${fmt(last.value, digits)}`), props.compact ? null : h$25("text", {
				x: pad.left,
				y: height - 6,
				className: "lp-axis"
			}, monthLabel(points[0]?.date ?? "")), props.compact || points.length < 2 ? null : h$25("text", {
				x: width - pad.right,
				y: height - 6,
				className: "lp-axis",
				textAnchor: "end"
			}, monthLabel(last.date))), h$25(Tooltip, {
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
			return h$25("div", { className: "lp-timeline" }, h$25("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$25("svg", {
				width,
				height,
				role: "img",
				"aria-label": `方案时间线：${props.items.map((item) => `${item.title} ${item.start} 起`).join("，")}`
			}, ...months.filter((_, index) => index % step === 0).map((iso) => h$25("g", { key: iso }, h$25("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 20,
				y2: height - 6,
				className: "lp-grid"
			}), h$25("text", {
				x: x(dayNumber(iso)) + 3,
				y: 12,
				className: "lp-axis"
			}, monthLabel(iso)))), ...props.checkups.map((iso) => h$25("g", { key: `c${iso}` }, h$25("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 22,
				y2: height - 6,
				className: "lp-checkup"
			}), h$25("circle", {
				cx: x(dayNumber(iso)),
				cy: 22,
				r: 3,
				className: "lp-checkup-dot"
			}))), h$25("line", {
				x1: x(today),
				x2: x(today),
				y1: 16,
				y2: height - 6,
				className: "lp-today"
			}), h$25("text", {
				x: x(today) - 3,
				y: 24,
				className: "lp-axis",
				textAnchor: "end"
			}, "今天"), ...props.items.map((item, index) => {
				const y0 = top + index * row + row / 2;
				const x0 = x(dayNumber(item.start));
				const x1 = x(item.end ? Math.min(dayNumber(item.end), today) : today);
				const done = Boolean(item.end && dayNumber(item.end) < today);
				return h$25("g", {
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
				}, h$25("text", {
					x: 0,
					y: y0 + 4,
					className: "lp-row-label"
				}, item.title.length > 12 ? `${item.title.slice(0, 11)}…` : item.title), h$25("rect", {
					x: labelWidth,
					y: y0 - 12,
					width: width - labelWidth,
					height: 24,
					className: "lp-hit"
				}), h$25("rect", {
					x: x0,
					y: y0 - 5,
					width: Math.max(6, x1 - x0),
					height: 10,
					rx: 5,
					className: done ? "lp-bar-muted" : "lp-bar"
				}));
			})), h$25(Tooltip, {
				tip,
				width
			})), h$25("div", { className: "lp-legend-inline" }, h$25("span", { className: "lp-key-bar" }), "执行中", h$25("span", { className: "lp-key-dot" }), "体检日"));
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
			return h$25("div", {
				className: "lp-strip",
				style: {
					width,
					height: 79
				}
			}, h$25("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === "done").length} 天`
			}, ...props.calendar.map((day, index) => h$25("rect", {
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
			}))), h$25(Tooltip, {
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
			return h$25("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$25("svg", {
				width,
				height,
				role: "img",
				"aria-label": props.rows.map((row) => `${row.label} ${row.detail}：${fmt(row.value)}${row.unit}`).join("，")
			}, ...props.rows.map((item, index) => {
				const y0 = index * row;
				const length = Math.max(3, Math.abs(item.value) / max * barMax);
				return h$25("g", { key: item.label }, h$25("text", {
					x: 0,
					y: y0 + 14,
					className: "lp-row-label"
				}, item.label, item.detail ? h$25("tspan", {
					dx: 8,
					className: "lp-axis"
				}, item.detail) : null), h$25("path", {
					d: roundedBar(0, y0 + 22, length, 10),
					className: item.value <= 0 ? "lp-bar" : "lp-bar-muted"
				}), h$25("text", {
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
			return h$25("svg", {
				width: size,
				height: size,
				role: "img",
				"aria-label": `${props.label} ${props.value == null ? "未知" : `${Math.round(share * 100)}%`}`,
				className: "lp-ring"
			}, h$25("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-track",
				strokeWidth: stroke
			}), h$25("circle", {
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
			return h$25("details", { className: "lp-twin" }, h$25("summary", null, "表格"), h$25("table", null, h$25("caption", null, props.caption), h$25("thead", null, h$25("tr", null, ...props.head.map((cell) => h$25("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$25("tbody", null, ...props.rows.map((row, index) => h$25("tr", { key: index }, ...row.map((cell, column) => h$25("td", { key: column }, cell)))))));
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
		function daysBetween(from, to) {
			return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 864e5);
		}
		function chineseDate(iso) {
			const [, month, day] = iso.slice(0, 10).split("-");
			return `${Number(month)} 月 ${Number(day)} 日`;
		}
		function chineseMonth(iso) {
			const [year, month] = iso.slice(0, 10).split("-");
			return `${year} 年 ${Number(month)} 月`;
		}
		function weekday(iso) {
			return WEEKDAYS[(/* @__PURE__ */ new Date(`${iso.slice(0, 10)}T12:00:00Z`)).getUTCDay()] ?? "";
		}
		function localToday() {
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
		function versusAge(advance) {
			if (advance == null || !Number.isFinite(advance)) return "";
			if (Math.abs(advance) < .5) return "和实足年龄相当";
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
		const h$24 = react.default.createElement;
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
			return h$24("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: `lp-icon ${props.className ?? ""}`.trim()
			}, h$24("path", {
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
			return h$24("span", {
				className: "lp-mark",
				"aria-hidden": true
			}, h$24(Icon, {
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
			return h$24("span", { className: `lp-chip-v ${style.className}` }, h$24(Icon, {
				name: style.icon,
				size: 14
			}), label);
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
			"open"
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
		function strings$1(value) {
			return Array.isArray(value) ? value.filter((row) => typeof row === "string" && row.length > 0) : [];
		}
		function oneOf(value, allowed, fallback) {
			return allowed.includes(value) ? value : fallback;
		}
		function profileOf(raw) {
			const risk = {};
			for (const [key, value] of Object.entries(obj(raw.risk))) if (typeof value === "boolean") risk[key] = value;
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
				focus: strings$1(raw.focus).filter((key) => FOCUS.includes(key)),
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
					missing: strings$1(bio.missing),
					...str(bio.caveat_zh) ? { caveat_zh: str(bio.caveat_zh) } : {}
				},
				risk: {
					status: risk.status === "ok" && riskPct != null ? "ok" : "blocked",
					risk_pct: riskPct,
					category_zh: str(risk.category_zh),
					date: strOrNull(risk.date),
					blocker_zh: str(risk.blocker_zh),
					missing_labs: strings$1(risk.missing_labs),
					missing_facts: strings$1(risk.missing_facts)
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
					units: strings$1(row.units)
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
		/** True for a version string below 5.1 ("5.0.0"); false when newer or unknown. */
		function beforeTriState(version) {
			const match = /^(\d+)\.(\d+)/.exec(version.trim());
			if (!match) return false;
			const major = Number(match[1]);
			const minor = Number(match[2]);
			return major < 5 || major === 5 && minor < 1;
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
				today: str(raw.today) || localToday(),
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
					read_errors: strings$1(records.read_errors),
					missing_reads: strings$1(records.missing_reads),
					summary: summaryOf(records.summary)
				},
				results: resultsOf(obj(raw.results)),
				addons: addonsOf(raw.addons),
				self: selfOf(obj(raw.self)),
				plan: planOf(obj(raw.plan), beforeTriState(version)),
				reminders: remindersOf(raw.reminders),
				boundary_zh: str(raw.boundary_zh) || "模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。"
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
				}))
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
				categories_zh: strings$1(raw.categories_zh),
				wearable_days: num$1(raw.wearable_days) ?? 0
			};
		}
		function journeyFollowupOf(raw) {
			return {
				enabled: raw.enabled === true,
				channels: strings$1(raw.channels).filter((row) => row === "desktop" || row === "webhook"),
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
				markers: strings$1(row.markers),
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
				cautions_zh: strings$1(row.cautions_zh)
			};
		}
		function briefOf(raw) {
			const safety = obj(raw.safety);
			return {
				today: str(raw.today) || localToday(),
				focus: strings$1(raw.focus).filter((key) => FOCUS.includes(key)),
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
						cautions_zh: strings$1(row.cautions_zh)
					};
				}),
				safety: {
					medications: strings$1(safety.medications),
					notes_zh: strings$1(safety.notes_zh)
				},
				past_items: objects(raw.past_items).filter((row) => str(row.title)).map((row) => ({
					title: str(row.title),
					category: str(row.category),
					verdicts: strings$1(row.verdicts),
					adherence_pct: num$1(row.adherence_pct)
				})),
				notes_zh: strings$1(raw.notes_zh),
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
					notes_zh: strings$1(draft.notes_zh)
				} : null
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
				...readError ? { read_error: readError } : {}
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
		const listeners$1 = /* @__PURE__ */ new Set();
		let version = 0;
		let timersOn = false;
		let pageUsers = 0;
		let bridges = 0;
		let heroUsers = 0;
		let pending = null;
		let promptNote = null;
		let viewRequest = null;
		let settingsOpener = null;
		function emit() {
			version += 1;
			for (const listener of listeners$1) listener();
		}
		function subscribe(listener) {
			listeners$1.add(listener);
			return () => {
				listeners$1.delete(listener);
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
			}).catch((error) => {
				if (seq !== entry.seq) return;
				entry.error = errorText(error, "没有读到");
			}).finally(() => {
				if (seq !== entry.seq) return;
				entry.at = Date.now();
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
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
			return heroUsers > 0;
		}
		function usePageShowing() {
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
			return react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
			return promptNote?.text ?? null;
		}
		/** Open the page at a tab (and a section in it): the page switches and scrolls once it shows them. */
		function requestView(request) {
			viewRequest = { ...request };
			emit();
		}
		function useViewRequest() {
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
			return settingsOpener;
		}
		/** Re-render on any store change (for state kept outside the resources, such as check-in marks). */
		function useStoreVersion() {
			return react.default.useSyncExternalStore(subscribe, () => version, () => version);
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
		const h$23 = react.default.createElement;
		/**
		* The answer controls for one item: 完成 and 没做到 while unanswered; the
		* answer and 撤销 once given. Every state carries words, never color alone.
		*/
		function CheckChoices(props) {
			const { state, busy } = props;
			if (state === null) return h$23("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$23("button", {
				type: "button",
				className: "lp-choice lp-choice-done",
				disabled: busy,
				onClick: () => props.onAnswer(true)
			}, h$23(Icon, {
				name: "check",
				size: 13,
				strokeWidth: 2
			}), busy ? "记录中" : "完成"), h$23("button", {
				type: "button",
				className: "lp-choice",
				disabled: busy,
				onClick: () => props.onAnswer(false)
			}, "没做到"));
			return h$23("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$23("span", { className: `lp-choice-state ${state ? "lp-choice-state-done" : "lp-choice-state-missed"}` }, h$23(Icon, {
				name: state ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), state ? "已完成" : "没做到"), h$23("button", {
				type: "button",
				className: "lp-choice lp-choice-undo",
				disabled: busy,
				onClick: () => props.onAnswer(null),
				"aria-label": `撤销「${props.title}」今天的记录`
			}, busy ? "撤销中" : "撤销"));
		}
		//#endregion
		//#region src/client/ui.ts
		const h$22 = react.default.createElement;
		function Section(props) {
			const headingId = props.id ? `${props.id}-title` : void 0;
			return h$22("section", {
				className: `lp-section ${props.className ?? ""}`.trim(),
				id: props.id,
				"aria-labelledby": headingId
			}, h$22("div", { className: "lp-section-head" }, h$22("div", { className: "lp-section-titles" }, props.kicker ? h$22("div", { className: "lp-kicker" }, props.kicker) : null, h$22("h2", {
				className: "lp-h2",
				id: headingId
			}, props.title)), props.aside ?? null), props.children);
		}
		function Skeleton(props) {
			return h$22("div", {
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
			return h$22(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				size: "md",
				...props
			});
		}
		/** A download link dressed as a DSH outline button (a real <a>, so the browser saves it). */
		function LinkButton(props) {
			return h$22("a", {
				className: "lp-linkbtn",
				href: props.href,
				download: props.download ?? true
			}, props.icon ? h$22(Icon, {
				name: props.icon,
				size: 14
			}) : null, props.children);
		}
		/** A radio group drawn as a segmented control. Nothing selected means "not answered". */
		function Segmented(props) {
			const labelId = `${props.name}-label`;
			return h$22("div", { className: "lp-seg-wrap" }, h$22("span", {
				id: labelId,
				className: props.hideLabel ? "lp-sr" : "lp-field-label"
			}, props.label), h$22("div", {
				className: "lp-seg",
				role: "radiogroup",
				"aria-labelledby": labelId
			}, ...props.options.map((option) => h$22("label", {
				key: option.value,
				className: `lp-seg-opt ${props.value === option.value ? "lp-seg-on" : ""}`
			}, h$22("input", {
				type: "radio",
				name: props.name,
				value: option.value,
				checked: props.value === option.value,
				disabled: props.disabled,
				onChange: () => props.onChange(option.value)
			}), h$22("span", null, option.label)))));
		}
		function ToggleChip(props) {
			return h$22("button", {
				type: "button",
				className: `lp-toggle ${props.pressed ? "lp-toggle-on" : ""}`,
				"aria-pressed": props.pressed,
				onClick: props.onClick
			}, props.badge ? h$22("span", {
				className: "lp-toggle-badge",
				"aria-hidden": true
			}, props.badge) : null, props.children);
		}
		/** An on/off switch: a real button with role=switch, labelled by its visible text. */
		function Switch(props) {
			return h$22("button", {
				type: "button",
				role: "switch",
				id: props.id,
				"aria-checked": props.checked,
				"aria-busy": props.busy || void 0,
				disabled: props.disabled,
				className: `lp-switch ${props.checked ? "lp-switch-on" : ""}`,
				onClick: () => props.onChange(!props.checked)
			}, h$22("span", {
				className: "lp-switch-track",
				"aria-hidden": true
			}, h$22("span", { className: "lp-switch-thumb" })), h$22("span", { className: "lp-switch-label" }, props.label));
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
			return [notice ? h$22("div", {
				className: `lp-notice lp-notice-${notice.tone}`,
				role: "status"
			}, h$22(Icon, {
				name: notice.tone === "good" ? "check" : notice.tone === "bad" ? "info" : "info",
				size: 14
			}), h$22("span", null, notice.text), h$22("button", {
				type: "button",
				className: "lp-notice-x",
				"aria-label": "关闭提示",
				onClick: () => setNotice(null)
			}, h$22(Icon, {
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
			return h$22("span", {
				className: "lp-info-wrap",
				ref: wrap
			}, h$22("button", {
				type: "button",
				className: "lp-info-btn",
				"aria-label": `${props.label}：说明`,
				"aria-expanded": open,
				"aria-controls": id,
				onClick: () => setOpen((current) => !current)
			}, h$22(Icon, {
				name: "info",
				size: 14
			})), open ? h$22("span", {
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
			return h$22("div", {
				className: "lp-tabs",
				role: "tablist",
				"aria-label": props.label
			}, ...props.tabs.map((tab, index) => h$22("button", {
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
			}, tab.label, tab.badge ? h$22("span", { className: "lp-tab-badge" }, tab.badge) : null)));
		}
		/** An error in place of content that did not load, with a retry: never an empty state. */
		function LoadError(props) {
			const [busy, setBusy] = react.default.useState(false);
			return h$22("div", {
				className: `lp-loaderror ${props.compact ? "lp-loaderror-compact" : "lp-card"}`,
				role: "alert"
			}, h$22(Icon, {
				name: "warn",
				size: 14
			}), h$22("span", { className: "lp-loaderror-text" }, `没有读到${props.what}${props.error ? `：${props.error}` : ""}。`), h$22("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy,
				onClick: () => {
					setBusy(true);
					Promise.resolve(props.onRetry()).finally(() => setBusy(false));
				}
			}, h$22(Icon, {
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
		const h$21 = react.default.createElement;
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
			return h$21(Section, {
				id: "lp-goals",
				title: "如果达到目标",
				kicker: "模型估计"
			}, h$21("div", { className: "lp-grid-goals" }, pheno ? h$21("div", { className: "lp-card lp-model" }, h$21("div", { className: "lp-label" }, "表型年龄"), pheno.goal ? h$21("div", { className: "lp-model-figures" }, h$21("div", null, h$21("div", { className: "lp-caption" }, "现在"), h$21("div", { className: "lp-tile-figure" }, `${fmt(pheno.now?.phenoage)} 岁`)), h$21(Icon, {
				name: "arrow",
				size: 18,
				className: "lp-muted-ink"
			}), h$21("div", null, h$21("div", { className: "lp-caption" }, "达到方案目标"), h$21("div", { className: "lp-tile-figure lp-good-ink" }, `${fmt(pheno.goal.phenoage)} 岁`)), h$21("span", { className: "lp-pill lp-pill-good" }, `${fmt(pheno.goal.phenoage_delta)} 岁`)) : h$21("p", { className: "lp-muted" }, pheno.note_zh ?? ""), leverRows.length > 0 ? h$21("div", null, h$21("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$21(LeverBars, { rows: leverRows })) : sensitivityRows.length > 0 ? h$21("div", null, h$21("div", { className: "lp-subhead" }, "对你的表型年龄影响最大的指标"), h$21(LeverBars, { rows: sensitivityRows })) : null, pheno.goal && pheno.now?.mortality_10y_pct != null && pheno.goal.mortality_10y_pct != null ? h$21("p", { className: "lp-fine" }, `同一模型的 10 年死亡风险：${pheno.now.mortality_10y_pct.toFixed(1)}% → ${pheno.goal.mortality_10y_pct.toFixed(1)}%。`) : null, h$21("p", { className: "lp-fine" }, `${pheno.measured_on ? `按 ${pheno.measured_on} 的血检计算。` : ""}${pheno.boundary_zh ?? ""}`)) : null, risk ? h$21("div", { className: "lp-card lp-model" }, h$21("div", { className: "lp-label" }, "10 年心血管病风险 · China-PAR"), risk.status === "unavailable" ? h$21("div", null, h$21("div", { className: "lp-tile-figure lp-muted-ink" }, (risk.missing ?? []).length > 0 ? "还差几项" : "暂不显示"), h$21("p", { className: "lp-muted" }, risk.note_zh ?? "")) : h$21("div", null, h$21("div", { className: "lp-model-figures" }, h$21("div", null, h$21("div", { className: "lp-caption" }, "现在"), h$21("div", { className: "lp-tile-figure" }, risk.now?.risk_pct == null ? "—" : `${risk.now.risk_pct.toFixed(1)}%`), risk.category_zh?.now ? h$21("span", { className: "lp-pill" }, risk.category_zh.now) : null), risk.goal ? h$21(Icon, {
				name: "arrow",
				size: 18,
				className: "lp-muted-ink"
			}) : null, risk.goal ? h$21("div", null, h$21("div", { className: "lp-caption" }, "达到方案目标"), h$21("div", { className: "lp-tile-figure lp-good-ink" }, risk.goal.risk_pct == null ? "—" : `${risk.goal.risk_pct.toFixed(1)}%`), risk.category_zh?.goal ? h$21("span", { className: "lp-pill lp-pill-good" }, risk.category_zh.goal) : null) : null), (risk.levers ?? []).length > 0 ? h$21("div", null, h$21("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$21(LeverBars, { rows: (risk.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "个百分点"
			})) })) : h$21("p", { className: "lp-muted" }, risk.note_zh ?? "")), h$21("p", { className: "lp-fine" }, risk.boundary_zh ?? "")) : null, h$21("div", { className: "lp-card lp-model lp-model-note" }, h$21("div", { className: "lp-label" }, "关于“能多活几年”"), h$21("p", { className: "lp-muted" }, "没有经过验证的模型能对个人给出“多活几年”。这里只给有依据的模型估计：表型年龄、同一模型的 10 年死亡风险，以及中国人群的 10 年心血管病风险。"), h$21("p", { className: "lp-fine" }, "试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月。能坚持的小改变，比追逐一个数字更重要。"))));
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
			return h$21(Section, {
				id: "lp-next",
				title: "下一步",
				kicker: "按优先级"
			}, h$21("ol", { className: "lp-card lp-steps" }, ...rows.map((row, index) => h$21("li", {
				key: index,
				className: `lp-step lp-step-${row.kind}`
			}, h$21("span", { className: "lp-step-icon" }, h$21(Icon, {
				name: STEP_ICON[row.kind] ?? "info",
				size: 15
			})), h$21("span", null, row.text_zh)))), h$21("p", { className: "lp-fine" }, "这里不会建议开始、停止或调整任何药物和补剂，也不给剂量。"));
		}
		//#endregion
		//#region src/client/plan-draft.ts
		const h$20 = react.default.createElement;
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
		/** The server ends each detail with the evidence sentence; the card shows evidence on its own line, so drop the repeat. */
		function behaviorOf(item) {
			const evidence = item.evidence.expected_zh;
			let text = item.detail;
			if (evidence && text.includes(evidence)) text = text.replace(evidence, "");
			return text.replace(/\s*(证据|依据)[:：]\s*$/, "").replace(/[\s，,；;]+$/, "").trim();
		}
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
			return h$20("details", { className: "lp-evidence-more" }, h$20("summary", null, "证据"), evidence.population ? h$20("p", { className: "lp-caption" }, `试验人群：${evidence.population}`) : null, evidence.doi ? h$20("p", { className: "lp-caption" }, "文献：", h$20("a", {
				href: `https://doi.org/${evidence.doi}`,
				target: "_blank",
				rel: "noreferrer"
			}, `doi:${evidence.doi}`), evidence.verified ? "" : "（数据待核对）") : null, target ? h$20("p", { className: "lp-caption" }, targetText(target)) : null, h$20("p", { className: "lp-caption" }, "这是试验里的平均效果，个人结果会不同。"));
		}
		/** One line: what the trials found on average. */
		function EvidenceLine(props) {
			return h$20("p", { className: "lp-evidence" }, h$20(Icon, {
				name: "flask",
				size: 13
			}), h$20("span", null, props.item.evidence.expected_zh || "有研究证据支持"));
		}
		function DraftItemCard(props) {
			const item = props.item;
			return h$20("li", { className: `lp-draft-item ${props.compact ? "lp-draft-item-compact" : ""}` }, h$20("div", { className: "lp-draft-item-head" }, h$20("div", { className: "lp-draft-item-title" }, item.category_zh ? h$20("span", { className: "lp-cat" }, item.category_zh) : null, h$20("span", { className: "lp-strong" }, item.title), item.needs_doctor ? h$20("span", { className: "lp-warn-tag" }, h$20(Icon, {
				name: "warn",
				size: 12
			}), "需先与医生确认") : null), h$20("button", {
				type: "button",
				className: "lp-draft-remove",
				onClick: props.onRemove,
				"aria-label": `去掉「${item.title}」`
			}, h$20(Icon, {
				name: "close",
				size: 12
			}), "去掉")), behaviorOf(item) ? h$20("p", { className: "lp-draft-detail" }, behaviorOf(item)) : null, h$20(EvidenceLine, { item }), item.cautions_zh.length > 0 ? h$20("div", { className: "lp-draft-warn" }, h$20(Icon, {
				name: "warn",
				size: 14,
				className: "lp-warn-icon"
			}), ...item.cautions_zh.map((text) => h$20("span", {
				key: text,
				className: "lp-warn-text"
			}, text))) : null, h$20(EvidenceMore, { item }));
		}
		/** The kept items with 去掉, and the dropped ones as chips to put back. */
		function DraftItems(props) {
			const kept = props.draft.items.filter((item) => !props.removed.has(item.id));
			const gone = props.draft.items.filter((item) => props.removed.has(item.id));
			return h$20("div", { className: "lp-draft-block" }, kept.length > 0 ? h$20("ul", { className: "lp-draft-items" }, ...kept.map((item) => h$20(DraftItemCard, {
				key: item.id,
				item,
				compact: props.compact,
				onRemove: () => props.onToggle(item.id)
			}))) : h$20("p", { className: "lp-muted" }, "所有项目都去掉了。恢复一项，或在对话里说说你想怎么调整。"), gone.length > 0 ? h$20("div", { className: "lp-draft-removed" }, h$20("span", { className: "lp-caption" }, "已去掉："), ...gone.map((item) => h$20("button", {
				key: item.id,
				type: "button",
				className: "lp-toggle",
				onClick: () => props.onToggle(item.id),
				"aria-label": `恢复「${item.title}」`
			}, h$20(Icon, {
				name: "plus",
				size: 12
			}), item.title))) : null);
		}
		function Priorities(props) {
			const rows = props.brief.priorities;
			if (rows.length === 0) return null;
			return h$20("details", {
				className: "lp-draft-more",
				open: props.open
			}, h$20("summary", null, "为什么是这几项"), h$20("ol", { className: "lp-priorities" }, ...rows.map((row, index) => h$20("li", {
				key: `${row.marker_key}-${index}`,
				className: "lp-priority"
			}, h$20("div", { className: "lp-priority-head" }, h$20("span", { className: "lp-strong" }, row.label_zh), row.value != null ? h$20("span", { className: "lp-num" }, `${num(row.value)} ${row.unit}`) : null), h$20("div", { className: "lp-caption" }, [row.why_zh, row.date ? `${chineseDate(row.date)}的记录` : ""].filter(Boolean).join(" · "))))));
		}
		function DraftGoals(props) {
			if (props.goals.length === 0 && props.dropped === 0) return null;
			return h$20("details", { className: "lp-draft-more" }, h$20("summary", null, `目标（${props.goals.length} 个，按试验平均效应估算）`), props.goals.length > 0 ? h$20("ul", { className: "lp-rows lp-draft-goals" }, ...props.goals.map((goal) => h$20("li", {
				key: goal.marker,
				className: "lp-row"
			}, h$20("span", { className: "lp-row-main" }, h$20("span", { className: "lp-strong" }, goal.marker), h$20("span", { className: "lp-caption" }, `  ${goal.basis_zh}`)), h$20("span", { className: "lp-row-end lp-num" }, `${num(goal.value)} ${goal.unit}`)))) : null, props.dropped > 0 ? h$20("p", { className: "lp-fine" }, `去掉的项目对应的 ${props.dropped} 个目标也不会保存。`) : null);
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
			return h$20(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "采用这份方案",
				onClose: props.busy ? () => {} : props.onCancel,
				headless: true,
				className: "lp-confirm-dialog"
			}, h$20("div", { className: "lp lp-confirm" }, h$20("h2", { className: "lp-onb-title" }, "采用这份方案？"), h$20("p", { className: "lp-muted lp-confirm-lead" }, `保存为你的方案「${props.draft.title || "改善方案"}」，从今天（${chineseDate(props.today)}）开始。之后按项目打卡，并按每个指标安排复测；想调整随时在对话里说。`), h$20("ul", { className: "lp-confirm-list" }, ...props.items.map((item) => h$20("li", { key: item.id }, item.category_zh ? h$20("span", { className: "lp-cat" }, item.category_zh) : null, h$20("span", null, item.title), item.needs_doctor ? h$20("span", { className: "lp-warn-tag" }, "需先与医生确认") : null))), props.goals.length > 0 ? h$20("p", { className: "lp-caption" }, `目标：${props.goals.map((goal) => `${goal.marker} ${num(goal.value)} ${goal.unit}`).join("、")}（按试验平均效应估算，不是个人预测）`) : null, doctor.length > 0 ? h$20("p", { className: "lp-blocker lp-blocker-bad lp-confirm-doctor" }, `${doctor.map((item) => `「${item.title}」`).join("")}需先与医生确认后再开始。方案里不含任何剂量。`) : null, offer ? h$20("label", {
				className: "lp-check lp-confirm-remind",
				htmlFor: "lp-confirm-remind"
			}, h$20("input", {
				id: "lp-confirm-remind",
				type: "checkbox",
				checked: remind,
				disabled: props.busy,
				onChange: (event) => setRemind(event.target.checked)
			}), h$20("span", null, `每晚 ${offer.time} 提醒我打卡（不含健康数值）`)) : null, props.error ? h$20("p", {
				className: "lp-form-error",
				role: "alert"
			}, props.error) : null, h$20("div", { className: "lp-modal-actions" }, h$20(Btn, {
				variant: "outline",
				onClick: props.onCancel,
				disabled: props.busy
			}, "再想想"), h$20(Btn, {
				"data-modal-autofocus": true,
				onClick: () => props.onConfirm(offer != null && remind),
				disabled: props.busy
			}, props.busy ? "保存中…" : "确认采用"))));
		}
		/**
		* Save the kept items (and the goals that still have their item), then turn
		* the reminder on when the person left the box ticked. Unticked sends nothing.
		*/
		async function acceptDraft(draft, kept, remind) {
			const goals = keptGoals(draft, kept);
			const result = await postJson("/api/longpi/plan-draft/accept", { draft: {
				...draft,
				items: kept,
				goals
			} });
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
			return h$20("span", { className: "lp-caption lp-draft-hint" }, "想调整？在对话中说", h$20("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => props.onPrompt(DRAFT_PROMPT)
			}, `“${DRAFT_PROMPT}”`));
		}
		function Draft(props) {
			const { draft, data } = props;
			const [removed, setRemoved] = react.default.useState(/* @__PURE__ */ new Set());
			const [confirming, setConfirming] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const signature = `${draft.title}|${draft.items.map((item) => item.id).join("|")}`;
			react.default.useEffect(() => {
				setRemoved(/* @__PURE__ */ new Set());
			}, [signature]);
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
			return h$20("div", { className: "lp-card lp-draft" }, h$20("div", { className: "lp-draft-head" }, h$20("div", null, h$20("div", { className: "lp-kicker" }, `方案草稿 · ${kept.length} 项 · 还没有保存`), h$20("h3", { className: "lp-h3 lp-draft-title" }, draft.title || "改善方案"), h$20("p", { className: "lp-muted" }, "按你的检查结果和试验证据起草。每项注明试验里的平均效果，个人结果会不同；你确认后才保存。")), h$20("span", { className: "lp-tag" }, "草稿")), h$20(DraftItems, {
				draft,
				removed,
				onToggle: toggle
			}), h$20(DraftGoals, {
				goals,
				dropped: draft.goals.length - goals.length
			}), h$20(Priorities, { brief: data.brief }), ...draft.notes_zh.map((text) => h$20("p", {
				key: text,
				className: "lp-fine"
			}, text)), h$20("div", { className: "lp-form-actions lp-draft-actions" }, h$20(Btn, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$20(Hint, { onPrompt: props.onPrompt })), h$20("p", { className: "lp-fine" }, data.brief.boundary_zh || "只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。"), confirming ? h$20(ConfirmModal, {
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
		/** The plan section's empty state: the draft, or why there is none yet. */
		function PlanDraftCard(props) {
			const { data, loading, error } = usePlanDraft();
			if (!data && loading) return h$20("div", {
				className: "lp-card lp-draft",
				"aria-busy": true
			}, h$20("div", { className: "lp-kicker" }, "方案草稿"), h$20("p", { className: "lp-caption" }, "正在按你的结果和研究证据起草…"), h$20(Skeleton, { height: 72 }), h$20("div", { style: { height: 10 } }), h$20(Skeleton, { height: 72 }));
			if (!data) return h$20("div", { className: "lp-card lp-draft" }, h$20("div", { className: "lp-kicker" }, "方案草稿"), h$20("p", { className: "lp-muted" }, `没能读到方案草稿：${error ?? "没有返回"}。`), h$20("div", { className: "lp-form-actions" }, h$20(Hint, { onPrompt: props.onPrompt })));
			if (!data.draft) {
				const reasons = data.brief.notes_zh;
				const fine = [...new Set([
					...reasons.slice(1),
					...data.brief.safety.notes_zh,
					data.brief.boundary_zh
				].filter(Boolean))];
				return h$20("div", { className: "lp-card lp-draft" }, h$20("div", { className: "lp-kicker" }, "方案草稿"), h$20("h3", { className: "lp-h3 lp-draft-title" }, "现在还起草不了方案"), h$20("p", { className: "lp-muted" }, reasons[0] || "你的记录里还没有能对上研究证据的指标。"), ...fine.map((text) => h$20("p", {
					key: text,
					className: "lp-fine"
				}, text)), h$20(Priorities, {
					brief: data.brief,
					open: true
				}), h$20("div", { className: "lp-form-actions lp-draft-actions" }, h$20(Hint, { onPrompt: props.onPrompt })));
			}
			return h$20(Draft, {
				data,
				draft: data.draft,
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			});
		}
		//#endregion
		//#region src/client/plan.ts
		const h$19 = react.default.createElement;
		/** Today's items with their three answers; also the 概览 tab's today card. */
		function TodayList(props) {
			const items = props.journey.plan.checkin_items;
			if (items.length === 0) return h$19("p", { className: "lp-muted" }, "今天没有需要打卡的项目，手环和 Mirobody 记录的会自动计入。");
			return h$19("ul", { className: "lp-today-list" }, ...items.map((row) => {
				const state = props.stateOf(row.id);
				return h$19("li", {
					key: row.id,
					className: `lp-today-row ${state === true ? "lp-today-done" : state === false ? "lp-today-missed" : ""}`
				}, h$19("span", { className: "lp-today-title" }, row.title), h$19(CheckChoices, {
					title: row.title,
					state,
					busy: props.busy === row.id,
					onAnswer: (next) => props.onAnswer(row.id, row.title, next)
				}));
			}));
		}
		function TodayTile(props) {
			const counts = todayCounts(props.journey);
			return h$19("div", { className: "lp-card lp-tile lp-tile-today" }, h$19("div", { className: "lp-tile-head" }, h$19("div", { className: "lp-label" }, "今天"), counts.total > 0 ? h$19("span", { className: "lp-caption" }, `${counts.done}/${counts.total} 完成`) : null), h$19(TodayList, props), h$19("p", { className: "lp-fine" }, "点错了可以撤销；没做到也记一下，执行率才真实。"));
		}
		function AdherenceTile(props) {
			const items = props.tracking?.items ?? [];
			const known = items.filter((item) => item.adherence && item.adherence.level !== "unknown" && item.adherence.rate != null);
			const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null;
			const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback;
			const streak = props.journey.plan.streak || Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0));
			return h$19("div", { className: "lp-card lp-tile" }, h$19("div", { className: "lp-label" }, "方案执行"), h$19("div", { className: "lp-tile-row" }, h$19(Ring, {
				value: rate,
				label: "方案平均执行率",
				size: 56
			}), h$19("div", null, h$19("div", { className: "lp-tile-figure" }, rate == null ? "—" : `${Math.round(rate * 100)}%`), h$19("div", { className: "lp-caption" }, rate == null ? "还没有执行记录" : "近 12 周平均"))), streak > 1 ? h$19("div", { className: "lp-streak" }, h$19(Icon, {
				name: "flame",
				size: 15
			}), `连续 ${streak} 天`) : h$19("div", { className: "lp-caption lp-streak-empty" }, "连续完成两天以上会在这里显示"));
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
			return h$19("div", { className: "lp-card lp-tile" }, h$19("div", { className: "lp-label" }, "下次复测"), now.length > 0 ? h$19("div", null, h$19("div", { className: "lp-tile-figure" }, "现在"), h$19("div", { className: "lp-caption" }, `可以复测${now.map((row) => row.marker).slice(0, 3).join("、")}`)) : first ? h$19("div", null, h$19("div", { className: "lp-tile-figure" }, `${daysBetween(props.today, first.date)} 天后`), h$19("div", { className: "lp-caption" }, `${chineseDate(first.date)}之后 · ${first.marker}`)) : h$19("div", null, h$19("div", { className: "lp-tile-figure lp-muted-ink" }, "—"), h$19("div", { className: "lp-caption" }, props.failed ? "复测日期没有读到" : "方案里的指标还没有排出复测日")), h$19("p", { className: "lp-fine" }, h$19(Icon, {
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
			if (wins.length === 0) return h$19("div", { className: "lp-card lp-wins lp-wins-empty" }, h$19("span", { className: "lp-win-icon lp-win-icon-quiet" }, h$19(Icon, {
				name: "spark",
				size: 16
			})), h$19("div", null, h$19("div", { className: "lp-strong" }, "还没有超出正常波动的变化"), h$19("div", { className: "lp-muted" }, "血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。")));
			return h$19("div", { className: "lp-card lp-wins" }, h$19("div", { className: "lp-label" }, "朝目标方向、超出正常波动的变化"), ...wins.map(({ item, row }, index) => h$19("div", {
				className: "lp-win",
				key: index,
				style: { animationDelay: `${index * 80}ms` }
			}, h$19("span", { className: "lp-win-icon" }, h$19(Icon, {
				name: "check",
				size: 16
			})), h$19("div", null, h$19("div", { className: "lp-strong" }, `${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ""}`), h$19("div", { className: "lp-muted" }, [
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
			return h$19("article", { className: "lp-card lp-item" }, h$19("div", { className: "lp-item-head" }, h$19("div", null, item.category_zh ? h$19("span", { className: "lp-cat" }, item.category_zh) : null, h$19("h3", { className: "lp-h3" }, item.title), h$19("div", { className: "lp-caption" }, `${item.start} 起 · 第 ${item.days ?? 0} 天`)), item.headline ? h$19(VerdictChip, { verdict: item.headline }) : null), h$19("div", { className: "lp-item-adherence" }, h$19("div", null, h$19("div", { className: "lp-caption" }, "近 12 周执行"), h$19("div", { className: "lp-item-figure" }, rate == null || adherence.level === "unknown" ? "记录不足" : `${Math.round(rate * 100)}%`), adherence.note_zh ? h$19("div", { className: "lp-fine lp-fine-tight" }, adherence.note_zh) : null), (adherence.calendar ?? []).length > 0 ? h$19(AdherenceStrip, {
				calendar: adherence.calendar ?? [],
				label: item.title
			}) : null), ...(item.verdicts ?? []).map((row, index) => h$19("div", {
				className: "lp-verdict",
				key: index
			}, h$19("div", { className: "lp-verdict-head" }, h$19(VerdictChip, { verdict: row.verdict }), h$19("span", { className: "lp-strong" }, row.marker), row.baseline && row.followup ? h$19("span", { className: "lp-num" }, `${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ""}${row.change ? `（${pct(row.change.pct)}）` : ""}`) : null), h$19("p", { className: "lp-reason" }, row.reason_zh ?? ""), (row.expected ?? []).length > 0 ? h$19("details", { className: "lp-expected" }, h$19("summary", null, "试验里平均能改变多少"), ...(row.expected ?? []).map((line) => h$19("p", {
				key: line.id,
				className: "lp-fine"
			}, line.text_zh, line.comparison && line.comparison !== "not_comparable" ? `你的变化${{
				consistent: "与试验平均一致",
				smaller: "小于试验平均",
				larger: "大于试验平均",
				opposite: "方向与试验相反"
			}[line.comparison] ?? ""}。` : "", ` doi:${line.doi}`))) : null)), h$19("div", { className: "lp-item-foot" }, idle ? h$19("span", { className: "lp-caption" }, idle) : source === "checkin" ? props.checkable ? h$19(react.default.Fragment, null, h$19("span", { className: "lp-caption" }, "今天"), h$19(CheckChoices, {
				title: item.title,
				state: props.state,
				busy: props.busy,
				onAnswer: (next) => props.onAnswer(item.id, item.title, next)
			})) : h$19("span", { className: "lp-caption" }, "今天不用打卡") : h$19("span", { className: "lp-caption" }, source === "wearable" ? "手环自动记录，不用打卡" : "服用情况在 Mirobody 里打卡")));
		}
		/** Stage plan, next to the draft: the person may bring their own plan instead. */
		function PlanStart(props) {
			return h$19("div", { className: "lp-card lp-plan-start" }, h$19("div", { className: "lp-plan-start-text" }, h$19("h3", { className: "lp-h3" }, "已经有自己的方案？"), h$19("p", { className: "lp-muted" }, "说出你的方案，或上传医生、长寿师给的方案。LongPi 会读给你确认后保存，再按每个指标安排复测日，并算出达到目标时的模型估计。"), h$19("p", { className: "lp-fine" }, "LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。")), h$19("div", { className: "lp-prompts" }, ...props.journey.suggestions.map((row) => h$19("button", {
				key: row.id,
				type: "button",
				className: "lp-prompt",
				onClick: () => props.onPrompt(row.text_zh)
			}, h$19("span", null, row.text_zh), h$19(Icon, {
				name: "arrow",
				size: 14
			})))));
		}
		function PlanSection(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const tracking = props.tracking;
			const today = props.journey.today;
			if (!props.journey.plan.exists && !tracking?.plan) return h$19(Section, {
				id: "lp-plan",
				title: "我的方案",
				kicker: "还没有方案"
			}, h$19(PlanDraftCard, {
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			}), h$19(PlanStart, {
				journey: props.journey,
				onPrompt: props.onPrompt
			}));
			if (props.loading && !tracking) return h$19(Section, {
				id: "lp-plan",
				title: props.journey.plan.title || "我的方案",
				kicker: "我的方案"
			}, h$19(Skeleton, { height: 260 }));
			const failed = !tracking && props.error != null;
			const plan = tracking?.plan;
			const items = tracking?.items ?? [];
			const checkups = [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))];
			const todayIds = new Set(props.journey.plan.checkin_items.map((row) => row.id));
			const days = props.journey.plan.days;
			return h$19(Section, {
				id: "lp-plan",
				title: plan?.title || props.journey.plan.title,
				kicker: `我的方案 · 第 ${plan?.version ?? props.journey.plan.version ?? 1} 版`,
				aside: h$19("span", { className: "lp-caption" }, [
					`${items.length || props.journey.plan.items} 项`,
					props.journey.plan.started ? `${chineseDate(props.journey.plan.started)}起` : "",
					days != null ? `第 ${days} 天` : ""
				].filter(Boolean).join(" · "))
			}, failed ? h$19(LoadError, {
				what: "方案的执行记录和评判",
				error: props.error,
				onRetry: () => reload("tracking")
			}) : null, h$19("div", { className: "lp-tiles" }, h$19(TodayTile, {
				journey: props.journey,
				stateOf,
				busy,
				onAnswer: answer
			}), h$19(AdherenceTile, {
				journey: props.journey,
				tracking
			}), h$19(RetestTile, {
				tracking,
				today,
				failed
			})), h$19(Wins, { tracking }), items.length > 0 ? h$19("div", { className: "lp-card lp-timeline-card" }, h$19("div", { className: "lp-label" }, "时间线"), h$19(Timeline, {
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
			})) : null, items.length > 0 ? h$19("div", { className: "lp-grid-items" }, ...items.map((item) => h$19(ItemCard, {
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
			return h$19("div", { className: "lp-tab-body" }, h$19(PlanSection, props), h$19(Markers, { tracking: props.tracking }), h$19(Goals, { tracking: props.tracking }), h$19(NextSteps, { tracking: props.tracking }));
		}
		function Markers(props) {
			const charts = props.tracking?.charts ?? [];
			if (charts.length === 0) return null;
			const verdictOf = (indicator) => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? []).find((row) => row.indicator === indicator && row.verdict !== "无法判断");
			return h$19(Section, {
				id: "lp-markers",
				title: "方案相关的指标",
				kicker: "和正常波动比",
				aside: h$19(Info, {
					label: "和正常波动比",
					align: "end"
				}, "浅色带是以基线为中心的个体正常波动范围（参考变化值，RCV，按生物学变异数据计算）。落在带外才算真实变化；带内的起伏多半是测量和生理波动。")
			}, h$19("div", { className: "lp-grid-charts" }, ...charts.map((chart) => {
				const verdict = verdictOf(chart.indicator);
				const digits = Math.max(...chart.points.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
				return h$19("figure", {
					className: "lp-card lp-figure",
					key: chart.indicator
				}, h$19("div", { className: "lp-figure-head" }, h$19("figcaption", null, h$19("span", { className: "lp-strong" }, chart.label), h$19("span", { className: "lp-caption" }, ` ${chart.unit}`)), verdict ? h$19(VerdictChip, { verdict: verdict.verdict }) : null), h$19(LineChart, {
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
				}), h$19("p", { className: "lp-fine" }, chart.band ? `浅色带：以 ${chart.band.base_date} 的 ${fmt(chart.band.base, 2)} 为基线的正常波动${chart.band.verified === false ? "（变异数据待核对）" : ""}。` : "缺少这项的个体变异数据，分不清真实变化和波动。"), h$19(TableTwin, {
					caption: `${chart.label}（${chart.unit}）`,
					head: ["日期", "数值"],
					rows: chart.points.map((point) => [point.date, fmt(point.value, digits)])
				}));
			})));
		}
		//#endregion
		//#region src/client/home-actions.ts
		const h$18 = react.default.createElement;
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
			return h$18("span", {
				className: "lp-row-sep",
				"aria-hidden": true
			}, "·");
		}
		function retestText(date, what, today) {
			return date <= today ? `可以${what}了` : `${chineseDate(date)}可${what}`;
		}
		/** The retest part of the row, with the separators around it (the page link always follows). */
		function RetestPart(props) {
			if (!props.text) return props.before ? h$18(Sep$1) : null;
			return h$18(react.default.Fragment, null, props.before ? h$18(Sep$1) : null, h$18("span", null, props.text), h$18(Sep$1));
		}
		/** Retest dates beyond the journey's 7-day reminder window live only in tracking; read it just for this line. */
		function LaterRetest(props) {
			const next = retestDates(useTracking().data)[0];
			return h$18(RetestPart, {
				text: next ? retestText(next.date, `复测${next.marker}`, props.today) : null,
				before: props.before
			});
		}
		function Note(props) {
			return props.text ? h$18("span", {
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
			return h$18("span", {
				className: "lp-task-wrap",
				ref: wrap
			}, h$18("button", {
				type: "button",
				className: `lp-task ${state === true ? "lp-task-done" : state === false ? "lp-task-missed" : ""}`,
				"aria-haspopup": "menu",
				"aria-expanded": open,
				"aria-controls": menuId,
				disabled: props.busy,
				title: `${label}，点一下记录`,
				"aria-label": `${props.title}：${label}`,
				onClick: () => setOpen((current) => !current)
			}, h$18("span", {
				className: "lp-task-ring",
				"aria-hidden": true
			}, state === true ? h$18(Icon, {
				name: "check",
				size: 10,
				strokeWidth: 2.4
			}) : state === false ? h$18(Icon, {
				name: "close",
				size: 9,
				strokeWidth: 2.4
			}) : null), props.title), open ? h$18("span", {
				className: "lp-task-menu",
				id: menuId,
				role: "menu",
				"aria-label": `${props.title}：今天`
			}, h$18("button", {
				type: "button",
				role: "menuitem",
				className: "lp-task-choice",
				disabled: state === true,
				onClick: () => choose(true)
			}, h$18(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), "完成"), h$18("button", {
				type: "button",
				role: "menuitem",
				className: "lp-task-choice",
				disabled: state === false,
				onClick: () => choose(false)
			}, "没做到"), state !== null ? h$18("button", {
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
			const lead = items.map((row) => h$18(CheckPill, {
				key: row.id,
				id: row.id,
				title: row.title,
				state: stateOf(row.id),
				busy: busy === row.id,
				onAnswer: (state) => answer(row.id, row.title, state)
			}));
			if (items.length === 0 && journey.next.detail_zh) lead.push(h$18("span", { key: "next" }, journey.next.detail_zh));
			return h$18("div", {
				className: "lp lp-home-row",
				role: "group",
				"aria-label": "LongPi 今天"
			}, ...lead, reminder?.date ? h$18(RetestPart, {
				text: retestText(reminder.date, reminder.text_zh, journey.today),
				before: lead.length > 0
			}) : h$18(LaterRetest, {
				today: journey.today,
				before: lead.length > 0
			}), h$18("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.openPage
			}, "健康页 →"), h$18(Note, { text: error ?? props.note }));
		}
		/** The row itself; null when the stage has nothing for it (then the host stays empty and takes no room). */
		function HomeRow(props) {
			const { journey } = props;
			const ready = useComposerReady();
			const bridgeNote = usePromptNote();
			usePendingVersion();
			const note = bridgeNote ?? (!ready && hasPendingPrompt() ? "先在输入框上方选择一个工作区，选好后会自动放进输入框" : null);
			if (journey.stage === "routine") return h$18(RoutineRow, {
				journey,
				openPage: props.openPage,
				note
			});
			const suggestions = journey.suggestions.slice(0, 2);
			if (suggestions.length === 0) return null;
			return h$18("div", {
				className: "lp lp-home-row",
				role: "group",
				"aria-label": "LongPi 建议的问题"
			}, ...suggestions.map((row) => h$18("button", {
				key: row.id,
				type: "button",
				className: "lp-suggest",
				title: "放进输入框",
				onClick: () => setPendingPrompt(row.text_zh, "hero")
			}, row.text_zh)), h$18(Note, { text: note }));
		}
		//#endregion
		//#region src/client/home.ts
		const h$17 = react.default.createElement;
		/** Items named in the first-result sentence; the rest are counted, not listed. */
		const ADDONS_NAMED = 3;
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
			return h$17("span", {
				className: "lp-hero-sep",
				"aria-hidden": true
			}, "·");
		}
		function Go(props) {
			return h$17("button", {
				type: "button",
				className: "lp-hero-link",
				onClick: props.onClick
			}, `${props.label} →`);
		}
		/** What the add-ons unlock, body age first (the order the page's results use). */
		function joinUnlocks(journey) {
			const all = [...new Set(journey.addons.flatMap((row) => row.unlocks_zh.split("、")).map((text) => text.trim()).filter(Boolean))];
			const rank = (text) => text.includes("身体年龄") ? 0 : text.includes("心血管") ? 1 : 2;
			return all.sort((a, b) => rank(a) - rank(b)).join("和") || "第一个结果";
		}
		/** Body age and cardiovascular risk in the order the person cares about; a figure that is not available is left out. */
		function figures(journey) {
			const { bioage, risk } = journey.results;
			const body = bioage.status === "ok" && bioage.phenoage != null ? [
				"身体年龄 ",
				h$17("b", {
					key: "b",
					title: ESTIMATE
				}, `${fmt(bioage.phenoage)} 岁`),
				versusAge(bioage.advance) ? `，${versusAge(bioage.advance)}` : ""
			] : null;
			const heart = risk.status === "ok" && risk.risk_pct != null ? [
				"心血管 10 年风险 ",
				h$17("b", {
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
			return `${greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`;
		}
		/** One sentence per stage (spec D.1). Every figure comes from the journey; nothing is estimated here. */
		function Status(props) {
			const { journey, open } = props;
			const parts = [];
			if (journey.stage === "consent" || journey.stage === "profile") parts.push("花 2 分钟建档，算出你的身体年龄和心血管风险", h$17(Sep, { key: "s" }), h$17(Go, {
				key: "go",
				label: "开始建档",
				onClick: open
			}));
			else if (journey.stage === "records") parts.push(journey.records.status === "error" ? "体检记录读取失败，暂时算不出结果" : "连接体检记录后，就能算出你的身体年龄", h$17(Sep, { key: "s" }), h$17(Go, {
				key: "go",
				label: journey.records.status === "error" ? "查看原因" : "怎么连接",
				onClick: open
			}));
			else if (journey.stage === "first_result" && journey.addons.length > 0) {
				const named = journey.addons.slice(0, ADDONS_NAMED).map((row) => row.item_zh).join("、");
				const more = journey.addons.length > ADDONS_NAMED ? " 等" : "";
				parts.push("还差 ", h$17("b", { key: "n" }, `${journey.addons.length} 项检查`), `就能算出${joinUnlocks(journey)}：${named}${more}`, h$17(Sep, { key: "s" }), h$17(Go, {
					key: "go",
					label: "加测清单",
					onClick: open
				}));
			} else {
				const rows = journey.stage === "first_result" ? [] : figures(journey);
				if (rows.length > 0) rows.forEach((row, index) => {
					if (index > 0) parts.push(h$17(Sep, { key: `s${index}` }));
					parts.push(h$17(react.default.Fragment, { key: `f${index}` }, ...row));
				});
				else {
					const detail = journey.next.detail_zh || journey.results.risk.blocker_zh || journey.results.bioage.blocker_zh || "打开健康页看看还缺什么";
					if (journey.stage === "routine") parts.push(detail);
					else parts.push(detail, h$17(Sep, { key: "s" }), h$17(Go, {
						key: "go",
						label: journey.next.action === "profile" ? "去填写" : "健康页",
						onClick: open
					}));
				}
			}
			return h$17("p", { className: "lp-hero-status" }, ...parts);
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
			return h$17("p", { className: "lp-hero-changes" }, h$17(Icon, {
				name: "warn",
				size: 14,
				className: "lp-hero-changes-icon"
			}), `${subject}的变化超出正常波动`, h$17(Sep), h$17(Go, {
				label: "查看",
				onClick: () => props.openAt("lp-changes")
			}));
		}
		function Hero(props) {
			const ref = react.default.useRef(null);
			useHeroShown();
			useOwnRow(ref);
			const { host, inline } = useRowHost(ref);
			const row = h$17(HomeRow, {
				journey: props.journey,
				openPage: props.open
			});
			return h$17("div", {
				ref,
				className: "lp lp-hero",
				role: "group",
				"aria-label": "LongPi"
			}, h$17("div", { className: "lp-hero-title" }, h$17("span", {
				className: "lp-hero-mark",
				"aria-hidden": true
			}, h$17(Icon, {
				name: "pulse",
				size: 16,
				strokeWidth: 1.8
			})), h$17("span", null, titleOf(props.journey))), h$17(Status, {
				journey: props.journey,
				open: props.open
			}), h$17(ChangesLine$1, {
				journey: props.journey,
				openAt: props.openAt
			}), inline ? h$17("div", { className: "lp-hero-row" }, row) : null, host ? (0, react_dom.createPortal)(row, host) : null);
		}
		function HomeHero(props) {
			const { journey } = useJourney();
			if (!journey) return null;
			return h$17(Hero, {
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
		/** The official DeepSeek route and the key reference its settings default to (dsh-llm-deepseek). */
		const DEEPSEEK_ROUTE = "deepseek-official";
		const DEEPSEEK_KEY = "DEEPSEEK_API_KEY";
		let probe = null;
		let status = "unknown";
		const listeners = /* @__PURE__ */ new Set();
		function set(next) {
			if (next === status) return;
			status = next;
			for (const listener of listeners) listener();
		}
		async function readModelStatus(remote) {
			try {
				const providers = await remote.llm?.listProviders?.();
				if (!providers?.ok) return "unknown";
				const ids = providers.value.map((row) => String(row.id ?? ""));
				if (!ids.includes(DEEPSEEK_ROUTE) || ids.some((id) => id !== DEEPSEEK_ROUTE)) return "unknown";
				const described = await remote.credentials?.describe?.([DEEPSEEK_KEY]);
				if (!described?.ok) return "unknown";
				const key = described.value[DEEPSEEK_KEY];
				if (!key) return "unknown";
				return key.configured === true ? "ready" : "missing";
			} catch {
				return "unknown";
			}
		}
		/** Called from apply() inside ctx.inject: the probe lives as long as those services do. */
		function setModelProbe(remote) {
			probe = remote ? () => readModelStatus(remote) : null;
			if (!remote) set("unknown");
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
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			}, () => status, () => status);
		}
		//#endregion
		//#region src/client/connection.ts
		const h$16 = react.default.createElement;
		const LOOPBACK = /* @__PURE__ */ new Set([
			"127.0.0.1",
			"localhost",
			"[::1]"
		]);
		/** The same rule the server applies: https, or http only on this computer. */
		function addressProblem(text) {
			const trimmed = text.trim();
			if (!trimmed) return "请粘贴 Mirobody 的 MCP 地址。";
			let url;
			try {
				url = new URL(trimmed);
			} catch {
				return "这不是一个完整的网址，请从 Mirobody 复制完整地址（以 https:// 开头）。";
			}
			if (url.protocol === "https:") return null;
			if (url.protocol === "http:" && LOOPBACK.has(url.hostname)) return null;
			return url.protocol === "http:" ? "只有本机地址（127.0.0.1 或 localhost）可以用 http://，其他地址请用 https://。" : "地址要以 https:// 开头。";
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
		function sourceText(connection) {
			if (connection.source === "saved") return "在这里保存的地址";
			if (connection.source === "config") return "安装时配置的地址";
			return "";
		}
		/** brief: without the summary line, where the found counts are already on screen (onboarding step 3). */
		function ConnectionStatus(props) {
			const { connection } = props;
			const ok = connection.status === "ok";
			const bad = connection.status === "error";
			return h$16("div", { className: "lp-conn-status" }, h$16("div", { className: "lp-status" }, h$16("span", {
				className: `lp-statusdot ${ok ? "lp-statusdot-on" : bad ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), ok ? "已连接 Mirobody" : bad ? `连接失败：${connection.error || "没有返回原因"}` : "还没有连接 Mirobody"), connection.url_masked ? h$16("div", { className: "lp-caption lp-conn-url" }, h$16("code", null, connection.url_masked), sourceText(connection) ? ` · ${sourceText(connection)}` : "", connection.token_set ? " · 令牌已设置" : "") : null, ok && connection.summary && !props.brief ? h$16("div", { className: "lp-caption" }, `找到：${summaryParts(connection.summary).join(" · ")}`) : null);
		}
		function TestOutcome(props) {
			const { result } = props;
			if (!result.ok) return h$16("p", {
				className: "lp-form-error",
				role: "alert"
			}, `连接没有成功：${result.error}`);
			const summary = result.connection?.summary;
			return h$16("p", {
				className: "lp-conn-ok",
				role: "status"
			}, h$16(Icon, {
				name: "check",
				size: 14
			}), summary ? `连接成功，找到 ${summaryParts(summary).join(" · ")}` : "连接成功");
		}
		/**
		* The form: address, optional token, 测试连接 and 保存, and 清除 for a saved
		* address. Nothing is saved unless the test inside 保存 succeeds.
		*/
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
			return h$16("form", {
				className: "lp-conn-form",
				noValidate: true,
				onSubmit: (event) => {
					event.preventDefault();
					run("save");
				}
			}, h$16("div", { className: "lp-field" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-url`
			}, "Mirobody 地址", h$16("span", { className: "lp-optional" }, "在 Mirobody 网页生成的个人 MCP 地址")), h$16("input", {
				id: `${props.idPrefix}-url`,
				type: "url",
				className: "lp-input",
				value: url,
				autoComplete: "off",
				spellCheck: false,
				placeholder: props.connection?.url_masked ? `现在：${props.connection.url_masked}` : "https://…/mcp/…",
				onChange: (event) => {
					setUrl(event.target.value);
					setError(null);
				}
			})), h$16("div", { className: "lp-field" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-token`
			}, "访问令牌", h$16("span", { className: "lp-optional" }, "选填：地址里已含令牌时留空")), h$16("input", {
				id: `${props.idPrefix}-token`,
				type: "password",
				className: "lp-input",
				value: token,
				autoComplete: "new-password",
				placeholder: "可不填",
				onChange: (event) => setToken(event.target.value)
			})), error ? h$16("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, outcome ? h$16(TestOutcome, { result: outcome }) : null, h$16("div", { className: "lp-form-actions" }, h$16(Btn, {
				variant: "outline",
				type: "button",
				disabled: busy != null,
				onClick: () => {
					run("test");
				}
			}, busy === "test" ? "测试中…" : "测试连接"), h$16(Btn, {
				type: "submit",
				disabled: busy != null
			}, busy === "save" ? "测试并保存中…" : "保存"), saved ? h$16("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy != null,
				onClick: () => {
					clear();
				}
			}, h$16(Icon, {
				name: "trash",
				size: 13
			}), busy === "clear" ? "清除中" : "清除保存的地址") : null), h$16("p", { className: "lp-fine" }, saved ? "清除后改用安装时配置的地址（如果有）。" : "保存前会先用这个地址读一次记录目录，读到了才保存；地址和令牌只存在这台电脑上。"));
		}
		/** Status plus form. collapsed: when connected, the form waits behind 换一个地址 (onboarding step 3). */
		function ConnectionPanel(props) {
			const { data, loading, error } = useConnection();
			const [open, setOpen] = react.default.useState(false);
			if (!data && loading) return h$16(Skeleton, { height: 96 });
			if (!data) return h$16(LoadError, {
				what: "连接状态",
				error,
				onRetry: () => reload("connection")
			});
			const connected = data.status === "ok";
			const showForm = !props.collapsed || !connected || open;
			return h$16("div", { className: "lp-conn" }, h$16(ConnectionStatus, {
				connection: data,
				brief: props.collapsed
			}), showForm ? h$16(ConnectionForm, {
				connection: data,
				idPrefix: props.idPrefix,
				onSaved: (connection) => {
					setOpen(false);
					props.onSaved?.(connection);
				}
			}) : h$16("button", {
				type: "button",
				className: "lp-row-link lp-conn-change",
				onClick: () => setOpen(true)
			}, "换一个 Mirobody 地址 →"));
		}
		//#endregion
		//#region src/client/self-measure.ts
		const h$15 = react.default.createElement;
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
			return h$15("ul", { className: "lp-self-latest" }, ...rows.map((row) => h$15("li", { key: row.key }, h$15("span", { className: "lp-caption" }, row.key === "sbp" ? "家庭血压" : row.label_zh), h$15("span", { className: "lp-self-value" }, selfLatestText(row, props.latest)), h$15("span", { className: "lp-caption" }, row.key === "sbp" ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : "1 次读数"} · 截至 ${chineseDate(row.date)}` : chineseDate(row.date)))));
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
			if (choices.length < 2) return h$15("span", { className: "lp-unit" }, props.spec.unit);
			return h$15("select", {
				id: props.id,
				className: "lp-select lp-unit-select",
				value: props.value,
				"aria-label": props.label,
				onChange: (event) => props.onChange(event.target.value)
			}, ...choices.map((unit) => h$15("option", {
				key: unit,
				value: unit
			}, unit)));
		}
		function SelfMeasureForm(props) {
			const all = specs(props.journey);
			const spec = (key) => all.find((row) => row.key === key) ?? SELF_FALLBACK.find((row) => row.key === key);
			const today = props.journey?.today ?? localToday();
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
			const field = (key, placeholder) => h$15("div", { className: "lp-self-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-${key}`
			}, spec(key).label_zh), h$15("div", { className: "lp-input-unit" }, h$15("input", {
				id: `${props.idPrefix}-${key}`,
				className: "lp-input",
				inputMode: "decimal",
				placeholder,
				value: values[key],
				onChange: (event) => set(key, event.target.value)
			}), h$15(UnitSelect, {
				id: `${props.idPrefix}-${key}-unit`,
				spec: spec(key),
				value: units[key],
				label: `${spec(key).label_zh}的单位`,
				onChange: (unit) => setUnits((current) => ({
					...current,
					[key]: unit
				}))
			})));
			return h$15("form", {
				className: "lp-self-form",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$15("div", { className: "lp-self-grid" }, field("waist", "例如 86"), field("weight", "例如 70.5"), h$15("div", { className: "lp-self-field lp-self-bp" }, h$15("span", {
				className: "lp-field-label",
				id: `${props.idPrefix}-bp`
			}, "家庭血压"), h$15("div", {
				className: "lp-bp",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-bp`
			}, h$15("input", {
				id: `${props.idPrefix}-sbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "收缩压",
				"aria-label": "收缩压（高压）",
				value: values.sbp,
				onChange: (event) => set("sbp", event.target.value)
			}), h$15("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/"), h$15("input", {
				id: `${props.idPrefix}-dbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				value: values.dbp,
				onChange: (event) => set("dbp", event.target.value)
			}), h$15("span", { className: "lp-unit" }, "mmHg"))), h$15("div", { className: "lp-self-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-date`
			}, "测量日期"), h$15("input", {
				id: `${props.idPrefix}-date`,
				className: "lp-input",
				type: "date",
				value: date,
				max: today,
				min: "1990-01-01",
				onChange: (event) => setDate(event.target.value || today)
			}))), error ? h$15("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$15("div", { className: "lp-form-actions" }, h$15(Btn, {
				type: "submit",
				disabled: busy
			}, busy ? "记录中…" : "记录"), h$15("span", { className: "lp-caption" }, "单位可以选斤、尺或寸，会换算成 kg 和 cm。")));
		}
		function SelfRecent(props) {
			const { data, loading, error } = useSelfRows();
			const [busy, setBusy] = react.default.useState(null);
			const rows = (data?.rows ?? []).slice(0, 6);
			if (loading && !data) return null;
			if (!data && error) return h$15(LoadError, {
				what: "自测记录",
				error,
				compact: true,
				onRetry: () => reload("self")
			});
			if (rows.length === 0) return h$15("p", { className: "lp-caption lp-self-empty" }, "还没有自测记录。");
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
			return h$15("div", { className: "lp-self-recent" }, h$15("div", { className: "lp-subhead" }, "最近记录"), h$15("ul", { className: "lp-rows" }, ...rows.map((row) => h$15("li", {
				key: row.id,
				className: "lp-row"
			}, h$15("span", { className: "lp-row-main" }, h$15("span", null, labelOf(row.key)), h$15("span", { className: "lp-num" }, ` ${fmt(row.value)} ${row.unit}`), row.given ? h$15("span", { className: "lp-caption" }, `（记为 ${fmt(row.given.value)} ${row.given.unit}）`) : null), h$15("span", { className: "lp-caption" }, chineseDate(row.date)), h$15("button", {
				type: "button",
				className: "lp-iconbtn",
				disabled: busy === row.id,
				"aria-label": `删除 ${chineseDate(row.date)} 的${labelOf(row.key)} ${fmt(row.value)} ${row.unit}`,
				onClick: () => {
					remove(row);
				}
			}, h$15(Icon, {
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
			return h$15("form", {
				className: "lp-inline-self",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$15("input", {
				className: "lp-input",
				inputMode: "decimal",
				value,
				placeholder: bp ? "收缩压" : spec.label_zh,
				"aria-label": bp ? "收缩压（高压）" : `${spec.label_zh}`,
				id: `${props.idPrefix}-${props.selfKey}`,
				onChange: (event) => setValue(event.target.value)
			}), bp ? h$15("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/") : null, bp ? h$15("input", {
				className: "lp-input",
				inputMode: "decimal",
				value: dbp,
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				onChange: (event) => setDbp(event.target.value)
			}) : null, bp ? h$15("span", { className: "lp-unit" }, "mmHg") : h$15(UnitSelect, {
				id: `${props.idPrefix}-${props.selfKey}-unit`,
				spec,
				value: unit,
				label: `${spec.label_zh}的单位`,
				onChange: setUnit
			}), h$15(Btn, {
				type: "submit",
				size: "sm",
				disabled: busy
			}, busy ? "记录中" : "记录"));
		}
		//#endregion
		//#region src/client/journey-steps.ts
		const h$14 = react.default.createElement;
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
			return h$14("div", { className: "lp-consent" }, ...CONSENT_SENTENCES.map((text, index) => h$14("div", {
				key: index,
				className: "lp-consent-row"
			}, h$14("span", {
				className: "lp-consent-icon",
				"aria-hidden": true
			}, h$14(Icon, {
				name: CONSENT_ICONS[index] ?? "info",
				size: 15
			})), h$14("p", null, text))));
		}
		/** '· N 次完整体检', left out at 0: "0 次完整体检" reads as a fault. */
		function checkupsText(count) {
			return count > 0 ? ` · ${count} 次完整体检` : "";
		}
		function RecordsStatusLine(props) {
			const records = props.journey.records;
			if (recordConnected(records.status)) {
				const partial = records.status === "partial";
				return h$14("div", { className: "lp-status" }, h$14("span", {
					className: `lp-statusdot ${partial ? "lp-statusdot-warn" : "lp-statusdot-on"}`,
					"aria-hidden": true
				}), `Mirobody 已连接 · ${records.indicator_count} 项指标${checkupsText(records.full_checkups)}${partial ? " · 部分没有读到" : ""}`);
			}
			return h$14("div", { className: "lp-status" }, h$14("span", {
				className: `lp-statusdot ${records.status === "error" ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), records.status === "error" ? `记录读取失败：${records.error || "没有返回原因"}` : "还没有连接 Mirobody 记录");
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
					label: "化验指标",
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
					label: "化验指标",
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
			return h$14("ul", { className: "lp-found" }, ...tiles.map((tile) => h$14("li", {
				key: tile.label,
				className: "lp-found-tile"
			}, h$14("span", { className: "lp-caption" }, tile.label), h$14("span", { className: "lp-found-figure" }, tile.figure, h$14("span", { className: "lp-bignum-unit" }, tile.unit)), tile.caption ? h$14("span", { className: "lp-caption" }, tile.caption) : null)));
		}
		/** One line on changes beyond normal fluctuation, when the record has any. */
		function ChangesLine(props) {
			const rows = props.journey.changes;
			if (rows.length === 0) return null;
			const names = rows.slice(0, 3).map((row) => row.label_zh).join("、");
			const doctor = rows.some((row) => row.ask_doctor);
			return h$14("p", { className: `lp-found-changes ${doctor ? "lp-found-changes-warn" : ""}` }, h$14(Icon, {
				name: doctor ? "warn" : "info",
				size: 14
			}), h$14("span", null, h$14("span", { className: "lp-strong" }, `值得注意：${rows.length} 项指标的变化超出正常波动`), ` · ${names}${rows.length > 3 ? " 等" : ""}`, props.onOpenChanges ? h$14(react.default.Fragment, null, " · ", h$14("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.onOpenChanges
			}, "在健康页查看")) : null));
		}
		/** Step 3: what LongPi found, or the connection form (no installer needed). */
		function RecordsStep(props) {
			const records = props.journey.records;
			const connected = recordConnected(records.status);
			return h$14("div", { className: "lp-step-body" }, connected ? h$14(react.default.Fragment, null, h$14("p", { className: "lp-muted" }, "我们在 Mirobody 里看到了这些（只读）："), h$14(FoundTiles, { journey: props.journey }), records.status === "partial" ? h$14("p", { className: "lp-blocker lp-blocker-bad" }, `有一部分记录这次没有读到${records.read_errors[0] ? `：${records.read_errors[0]}` : ""}。它们不是“没测”，稍后在健康页刷新。`) : null, h$14(ChangesLine, props)) : h$14(react.default.Fragment, null, records.status === "error" ? h$14("p", { className: "lp-blocker lp-blocker-bad" }, `记录读取失败：${records.error || "没有返回原因"}`) : h$14("p", { className: "lp-muted" }, "LongPi 从你自己的 Mirobody 读取体检和可穿戴数据（只读）。在 Mirobody 网页生成个人 MCP 地址，粘贴到这里：")), h$14(ConnectionPanel, {
				idPrefix: "lp-onb-conn",
				collapsed: connected
			}));
		}
		/** The two results, compact: a figure, or 还不能计算 with the server's reason. */
		function ResultFigures(props) {
			const { bioage, risk } = props.journey.results;
			return h$14("div", { className: "lp-first" }, h$14("div", { className: "lp-first-cell" }, h$14("div", { className: "lp-caption" }, "身体年龄 · 模型估计"), bioage.status === "ok" ? h$14("div", null, h$14("div", { className: "lp-first-figure" }, fmt(bioage.phenoage), h$14("span", { className: "lp-bignum-unit" }, "岁")), h$14("div", { className: "lp-caption" }, versusAge(bioage.advance)), bioage.caveat_zh ? h$14("p", {
				className: "lp-caption lp-first-caveat",
				role: "note"
			}, bioage.caveat_zh) : null) : h$14("div", null, h$14("div", { className: "lp-first-wait" }, "还不能计算"), h$14("p", { className: "lp-blocker" }, bioage.blocker_zh))), h$14("div", { className: "lp-first-cell" }, h$14("div", { className: "lp-caption" }, "10 年心血管风险 · 模型估计"), risk.status === "ok" ? h$14("div", null, h$14("div", { className: "lp-first-figure" }, riskText(risk.risk_pct), h$14("span", { className: "lp-bignum-unit" }, "%")), h$14("div", { className: "lp-caption" }, risk.category_zh)) : h$14("div", null, h$14("div", { className: "lp-first-wait" }, "还不能计算"), h$14("p", { className: "lp-blocker" }, risk.blocker_zh))));
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
			if (waist?.self_key) rows.push(h$14("li", {
				key: "self",
				className: "lp-now"
			}, h$14("span", {
				className: "lp-now-icon",
				"aria-hidden": true
			}, h$14(Icon, {
				name: "ruler",
				size: 15
			})), h$14("div", { className: "lp-now-text" }, h$14("div", { className: "lp-strong" }, `量一下${waist.item_zh}`), h$14("div", { className: "lp-caption" }, `填上就能算出${waist.unlocks_zh}`), h$14(InlineSelf, {
				journey,
				selfKey: waist.self_key,
				idPrefix: "lp-onb-now",
				onNotice: props.onNotice
			}))));
			rows.push(h$14("li", {
				key: "plan",
				className: "lp-now"
			}, h$14("span", {
				className: "lp-now-icon",
				"aria-hidden": true
			}, h$14(Icon, {
				name: "spark",
				size: 15
			})), h$14("div", { className: "lp-now-text" }, h$14("div", { className: "lp-strong" }, "先制定一份改善方案"), h$14("div", { className: "lp-caption" }, "按你关心的方面，从收录的试验证据里起草；你确认后才保存。")), h$14(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.actions.onDraft
			}, "起草方案")));
			if (lab.length > 0) rows.push(h$14("li", {
				key: "lab",
				className: "lp-now"
			}, h$14("span", {
				className: "lp-now-icon",
				"aria-hidden": true
			}, h$14(Icon, {
				name: "flask",
				size: 15
			})), h$14("div", { className: "lp-now-text" }, h$14("div", { className: "lp-strong" }, `下次体检加测${lab.slice(0, 2).map((row) => row.item_zh).join("、")}${lab.length > 2 ? " 等" : ""}`), h$14("div", { className: "lp-caption" }, `加上就能算${[...new Set(lab.map((row) => row.unlocks_zh))].join("、")}`)), h$14(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.actions.onAddons
			}, "加测清单")));
			return h$14("div", { className: "lp-now-block" }, h$14("div", { className: "lp-subhead" }, "现在就能做的事"), h$14("ul", { className: "lp-nows" }, ...rows));
		}
		/** Step 4: the results; when one is blocked, what can be done now instead of an empty card. */
		function FirstResult(props) {
			const { bioage, risk } = props.journey.results;
			const blocked = bioage.status !== "ok" || risk.status !== "ok";
			return h$14("div", { className: "lp-step-body" }, h$14(ResultFigures, { journey: props.journey }), blocked ? h$14(NowList, props) : null);
		}
		//#endregion
		//#region src/client/profile-editor.ts
		const h$13 = react.default.createElement;
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
					const risk = Object.fromEntries(facts.map((row) => {
						const answer = draft.risk[row.key] ?? "";
						return [row.key, answer === "yes" ? true : answer === "no" ? false : null];
					}));
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
			const answeredFacts = facts.filter((row) => (draft.risk[row.key] ?? "") === "yes" || draft.risk[row.key] === "no").length;
			return h$13("form", {
				className: `lp-profile lp-profile-${props.variant}`,
				onSubmit: (event) => {
					save(event);
				},
				noValidate: true
			}, onboarding ? null : h$13("div", { className: "lp-field" }, h$13("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-name`
			}, "称呼", h$13("span", { className: "lp-optional" }, "选填")), h$13("input", {
				id: `${props.idPrefix}-name`,
				className: "lp-input",
				value: draft.displayName,
				maxLength: 40,
				autoComplete: "nickname",
				placeholder: "页面上怎么称呼你",
				onChange: (event) => edit({ displayName: event.target.value })
			})), h$13("div", { className: "lp-profile-basics" }, h$13("div", { className: "lp-field lp-field-age" }, h$13("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-age`
			}, "实足年龄"), h$13("div", { className: "lp-input-unit" }, h$13("input", {
				id: `${props.idPrefix}-age`,
				className: "lp-input",
				inputMode: "numeric",
				value: draft.age,
				placeholder: "例如 52",
				"aria-invalid": !ageCheck.ok,
				"data-modal-autofocus": onboarding ? true : void 0,
				onChange: (event) => edit({ age: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })
			}), h$13("span", { className: "lp-unit" }, "岁"))), h$13("div", { className: "lp-field lp-field-sex" }, h$13(Segmented, {
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
			}))), h$13("p", { className: "lp-unlock" }, h$13(Icon, {
				name: "lock",
				size: 12
			}), `解锁：${unlockOf(props.journey, "age")}`), h$13("fieldset", { className: "lp-facts" }, h$13("legend", { className: "lp-facts-legend" }, h$13("span", { className: "lp-strong" }, "心血管风险还需要这 6 项"), h$13("span", { className: "lp-caption" }, ` · 已回答 ${answeredFacts} 项，不确定就选“不确定”，不会当作“否”`)), ...facts.map((row) => h$13("div", {
				className: "lp-fact",
				key: row.key
			}, h$13("div", { className: "lp-fact-text" }, h$13("div", {
				className: "lp-fact-label",
				id: `${props.idPrefix}-${row.key}-text`
			}, row.label_zh), h$13("div", { className: "lp-unlock lp-unlock-inline" }, `解锁：${row.unlocks_zh || "心血管风险"}`, row.men_only ? female ? " · 女性的公式不用这一项，可以跳过" : " · 只用于男性的公式" : "")), h$13(Segmented, {
				name: `${props.idPrefix}-${row.key}`,
				label: row.label_zh,
				hideLabel: true,
				options: ANSWERS,
				value: draft.risk[row.key] ?? "",
				onChange: (value) => edit({ risk: {
					...draft.risk,
					[row.key]: value
				} })
			})))), h$13("div", { className: "lp-focus" }, h$13("div", {
				className: "lp-field-label",
				id: `${props.idPrefix}-focus`
			}, "你最关心什么", h$13("span", { className: "lp-optional" }, "可多选，按点选先后排序")), h$13("div", {
				className: "lp-toggles",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-focus`
			}, ...focusOptions.map((option) => {
				const index = draft.focus.indexOf(option.key);
				return h$13(ToggleChip, {
					key: option.key,
					pressed: index >= 0,
					badge: index >= 0 ? String(index + 1) : void 0,
					onClick: () => toggleFocus(option.key)
				}, option.label_zh);
			}))), error ? h$13("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$13("div", { className: onboarding ? "lp-modal-actions" : "lp-form-actions" }, onboarding ? h$13(Btn, {
				variant: "outline",
				type: "button",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过") : null, h$13(Btn, {
				type: "submit",
				disabled: busy || !onboarding && !dirty
			}, busy ? "保存中…" : onboarding ? "保存并继续" : "保存档案"), !onboarding && !dirty && props.journey?.profile.complete ? h$13("span", { className: "lp-caption" }, "已是最新") : null));
		}
		//#endregion
		//#region src/client/onboarding.ts
		const h$12 = react.default.createElement;
		const ONBOARDING_TITLES = [
			"欢迎使用 LongPi",
			"建立档案",
			"连接体检记录",
			"第一个结果"
		];
		const NOOP = () => {};
		/** A journey that has not arrived by then is shown as not read, with a retry. */
		const GIVE_UP_MS = 45e3;
		/** The step a stage starts at when onboarding is opened on purpose. */
		function stepOfStage(stage) {
			if (stage === "consent") return 0;
			if (stage === "profile") return 1;
			if (stage === "records") return 2;
			return 3;
		}
		function Dots(props) {
			return h$12("div", { className: "lp-onb-progress" }, h$12("ol", {
				className: "lp-dots",
				"aria-hidden": true
			}, ...ONBOARDING_TITLES.map((_, index) => h$12("li", {
				key: index,
				className: `lp-dot-step ${index === props.step ? "lp-dot-now" : index < props.step ? "lp-dot-past" : ""}`
			}))), h$12("span", { className: "lp-caption" }, `第 ${props.step + 1} 步，共 ${ONBOARDING_TITLES.length} 步`));
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
			return h$12("div", {
				className: "lp-onb-hint",
				role: "note"
			}, h$12(Icon, {
				name: "info",
				size: 15
			}), h$12("span", null, "对话需要先在设置里填 DeepSeek API Key。"), props.onOpen ? h$12(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.onOpen
			}, "去设置") : h$12("span", { className: "lp-caption" }, "在左下角“设置 → 模型”中填写。"));
		}
		/** The journey did not arrive: say so, offer a retry, and let the person move on. */
		function NotRead(props) {
			return h$12(OnboardingModal, { title: "没有读到 LongPi 的数据" }, h$12("div", { className: "lp lp-onb" }, h$12("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, "暂时没有读到 LongPi 的数据"), h$12("p", { className: "lp-muted" }, props.error ? `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。` : "读取比平时慢，可能是 DSH 刚启动或 Mirobody 响应慢。可以再试一次，或者先去对话，稍后在健康页继续。"), h$12("div", { className: "lp-modal-actions" }, h$12(Btn, {
				variant: "outline",
				onClick: props.onLater
			}, "稍后再说"), h$12(Btn, {
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
				if (decided.current || !journey) return;
				decided.current = true;
				if (props.initialStep != null) {
					setStep(Math.max(0, Math.min(3, props.initialStep)));
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
			}, [journey, finish]);
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
				if (!timedOut && !(loadError && !loading)) return null;
				return h$12(NotRead, {
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
			return h$12(OnboardingModal, { title: ONBOARDING_TITLES[step] ?? ONBOARDING_TITLES[0] }, h$12("div", {
				className: "lp lp-onb",
				ref: content
			}, h$12(Dots, { step }), h$12("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, ONBOARDING_TITLES[step]), step === 0 ? h$12("div", { className: "lp-onb-body" }, h$12(ModelHint, { onOpen: toSettings }), h$12(ConsentText), error ? h$12("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$12("div", { className: "lp-modal-actions" }, h$12(Btn, {
				variant: "outline",
				onClick: finish,
				disabled: busy
			}, "以后再说"), h$12(Btn, {
				"data-modal-autofocus": true,
				disabled: busy,
				onClick: () => {
					setBusy(true);
					acceptConsent().then(() => go(1)).catch((err) => setError(`没有记下：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
				}
			}, busy ? "记录中…" : "开始"))) : null, step === 1 ? h$12("div", { className: "lp-onb-body" }, h$12("p", { className: "lp-onb-lead" }, "只问能解锁结果的问题。每一项都可以跳过，跳过就是“不知道”，不会当作“否”。"), h$12(ProfileEditor, {
				journey,
				variant: "onboarding",
				idPrefix: "lp-onb-profile",
				onSaved: () => go(2),
				onSkip: () => go(2)
			})) : null, step === 2 ? h$12("div", { className: "lp-onb-body" }, h$12(RecordsStep, {
				journey,
				onOpenChanges: props.openPage || props.explicit ? () => toPage({
					tab: "overview",
					id: "lp-changes"
				}) : void 0
			}), h$12("div", { className: "lp-modal-actions" }, h$12(Btn, {
				variant: "outline",
				onClick: () => go(1)
			}, "上一步"), h$12(Btn, {
				"data-modal-autofocus": true,
				onClick: () => go(3)
			}, recordConnected(journey.records.status) ? "继续" : "先跳过"))) : null, step === 3 ? h$12("div", { className: "lp-onb-body" }, computing ? h$12("div", {
				className: "lp-onb-computing",
				"aria-busy": true
			}, h$12(Skeleton, { height: 88 }), h$12("p", { className: "lp-caption" }, "正在用你的记录计算…")) : h$12(FirstResult, {
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
			}), notice, h$12("p", { className: "lp-fine" }, journey.boundary_zh), h$12("div", { className: "lp-modal-actions" }, h$12(Btn, {
				variant: "outline",
				onClick: finish
			}, "完成"), props.explicit ? null : h$12(Btn, {
				"data-modal-autofocus": true,
				onClick: () => {
					props.openPage?.();
					finish();
				}
			}, "打开健康页"))) : null));
		}
		function OnboardingModal(props) {
			useInertRoot();
			return h$12(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: props.title,
				onClose: NOOP,
				headless: true,
				className: "lp-onb-dialog"
			}, props.children);
		}
		//#endregion
		//#region src/client/changes.ts
		const h$11 = react.default.createElement;
		/** The trend, with the RCV band around the value it was compared from: points outside the band are the change. */
		function Spark(props) {
			const { row } = props;
			if (row.points.length < 2) return null;
			const base = row.compare.from;
			const dated = row.compare.from_date !== "";
			return h$11("div", { className: "lp-change-spark" }, h$11(LineChart, {
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
		/** The server's sentence opens with the label, which the row already shows in bold just above it. */
		function withoutLabel(row) {
			return prettyUnits(row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() || row.text_zh : row.text_zh);
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
		/** "MCV 的个体内变异非常小…" and "MCH 的个体内变异非常小…" become one line: "MCV、MCH 的个体内变异非常小…". */
		function mergedCaveats(rows) {
			const byRest = /* @__PURE__ */ new Map();
			for (const row of rows) {
				const text = row.caveat_zh ?? "";
				if (!text) continue;
				const at = text.indexOf("的");
				const [head, rest] = at > 0 && at <= 12 ? [text.slice(0, at).trim(), text.slice(at)] : ["", text];
				const members = byRest.get(rest) ?? [];
				if (!members.some((member) => member.text === text)) members.push({
					head,
					text
				});
				byRest.set(rest, members);
			}
			return [...byRest.entries()].map(([rest, members]) => members.length > 1 && members.every((member) => member.head) ? `${members.map((member) => member.head).join("、")} ${rest}` : members[0].text);
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
			return h$11("span", { className: `lp-chip-c lp-chip-c-${tone}` }, h$11(Icon, {
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
			return h$11("li", { className: "lp-notable-row" }, h$11(ChangeChip, {
				verdict: row.verdict,
				askDoctor: row.ask_doctor
			}), h$11("span", { className: "lp-strong" }, row.label_zh), h$11("span", { className: "lp-num lp-notable-values" }, `${pairText(row.compare.from, row.compare.to)} ${prettyUnits(row.unit)}`.trim()), h$11(Spark, { row }));
		}
		/** How a change is judged, the caveats and the sources: behind 判断依据, never in the way. */
		function Basis(props) {
			const { rows } = props;
			const unjudged = props.journey.changes_unjudged;
			if (rows.length === 0 && unjudged.length === 0) return null;
			const caveats = mergedCaveats(rows);
			const sources = distinct(rows.map((row) => ({
				...row.source,
				verified: row.verified
			})), (source) => source.url || source.title);
			return h$11("details", { className: "lp-basis" }, h$11("summary", null, "判断依据"), h$11("div", { className: "lp-change-notes" }, h$11("p", { className: "lp-caption" }, "“超出正常波动”指两次结果之差大于个体正常波动（参考变化值，RCV）。趋势图里的浅色带以比较起点那次结果为基线，落在带外就是真实变化。"), ...rows.map((row) => h$11("p", {
				key: `text:${row.key}`,
				className: "lp-caption"
			}, h$11("span", { className: "lp-strong" }, row.label_zh), `：${withoutLabel(row)}`)), ...caveats.map((text) => h$11("p", {
				key: `caveat:${text}`,
				className: "lp-caption"
			}, text)), unjudged.length > 0 ? h$11("p", { className: "lp-caption" }, `没有判断：${unjudged.map((row) => `${row.label_zh}（${row.reason_zh || "读取没有完成"}）`).join("、")}`) : null, sources.length > 0 ? h$11("p", { className: "lp-caption lp-change-source" }, "波动数据来源：", ...sources.flatMap((source, index) => [
				index > 0 ? "；" : null,
				source.url ? h$11("a", {
					key: source.url,
					href: source.url,
					target: "_blank",
					rel: "noopener noreferrer"
				}, source.title || source.url) : source.title,
				source.verified ? null : "（引用尚未逐字核对）"
			])) : null, props.journey.changes_note_zh ? h$11("p", { className: "lp-fine" }, props.journey.changes_note_zh) : null));
		}
		/**
		* 值得注意的变化 on 概览: at most three rows (a doctor's first), the advice
		* said once per group, and a link to 指标 for the rest. The server decides
		* which rows qualify and writes every sentence; nothing here names a cause.
		*/
		function NotableChanges(props) {
			const rows = props.journey.changes;
			if (rows.length === 0 && props.journey.changes_unjudged.length === 0) return null;
			const shown = rows.slice(0, NOTABLE);
			const advice = groupsOf(shown).filter((group) => group.advice && group.tone === "warn");
			return h$11("section", {
				className: "lp-card lp-notable",
				id: "lp-changes",
				"aria-labelledby": "lp-changes-title"
			}, h$11("div", { className: "lp-card-head" }, h$11("div", {
				className: "lp-label",
				id: "lp-changes-title"
			}, "值得注意的变化", rows.length > 0 ? h$11("span", { className: "lp-optional" }, `${rows.length} 项超出正常波动`) : null), h$11("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.onOpenIndicators
			}, "在“指标”里看全部 →")), ...advice.map((group) => h$11("p", {
				key: group.advice,
				className: "lp-change-advice lp-change-warn"
			}, h$11(Icon, {
				name: "warn",
				size: 14
			}), h$11("span", null, group.advice))), shown.length > 0 ? h$11("ul", { className: "lp-notable-list" }, ...shown.map((row) => h$11(NotableRow, {
				key: row.key,
				row
			}))) : h$11("p", { className: "lp-muted" }, "没有超出正常波动的变化。"), h$11(Basis, {
				journey: props.journey,
				rows
			}));
		}
		//#endregion
		//#region src/client/indicators.ts
		const h$10 = react.default.createElement;
		const SOURCE_ZH = {
			checkup: "体检",
			device: "手环",
			self: "自测"
		};
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
			if (points.length < 2) return h$10("span", {
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
			return h$10("svg", {
				width,
				height,
				className: "lp-spark",
				role: "img",
				"aria-label": `${props.label}趋势：${points.map((point) => `${point.date} ${fmtAuto(point.value)}`).join("，")}`
			}, h$10("path", {
				d: path,
				className: "lp-spark-line"
			}), h$10("circle", {
				cx: x(points.length - 1),
				cy: y(last.value),
				r: 2.5,
				className: "lp-spark-dot"
			}));
		}
		function JudgedChip(props) {
			const { row } = props;
			if (row.judged === "changed" && row.change) return h$10(ChangeChip, {
				verdict: row.change.verdict,
				askDoctor: row.change.ask_doctor
			});
			if (row.judged === "within") return h$10("span", { className: "lp-chip-c lp-chip-c-within" }, h$10(Icon, {
				name: "within",
				size: 12
			}), "波动内");
			const why = row.read_error ? "这项没有读到" : row.points.length < 2 ? "只有一次结果" : "缺少这项的正常波动数据";
			return h$10("span", {
				className: "lp-chip-c lp-chip-c-unjudged",
				title: why
			}, "未判断");
		}
		function latestText(row) {
			if (!row.latest) return "—";
			if (row.latest.text) return row.latest.text;
			return row.latest.value == null ? "—" : fmtAuto(row.latest.value);
		}
		function IndicatorLine(props) {
			const { row } = props;
			const panelId = `lp-ind-panel-${row.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
			return h$10("li", { className: `lp-ind-row ${props.open ? "lp-ind-open" : ""} ${row.read_error ? "lp-ind-failed" : ""}` }, h$10("button", {
				type: "button",
				className: "lp-ind-btn",
				"aria-expanded": props.open,
				"aria-controls": panelId,
				onClick: props.onToggle
			}, h$10("span", { className: "lp-ind-name" }, h$10("span", { className: "lp-strong" }, row.label_zh), row.plan_marker ? h$10("span", { className: "lp-tag lp-tag-plan" }, "方案") : null), row.read_error ? h$10("span", { className: "lp-ind-error" }, h$10(Icon, {
				name: "warn",
				size: 13
			}), `没有读到：${row.read_error}`) : h$10("span", { className: "lp-ind-value" }, h$10("span", { className: "lp-num" }, latestText(row)), row.latest?.text ? null : h$10("span", { className: "lp-caption" }, ` ${prettyUnits(row.unit)}`), row.latest ? h$10("span", { className: "lp-caption lp-ind-date" }, row.latest.date) : null), row.read_error ? h$10("span", { className: "lp-ind-spark" }) : h$10("span", { className: "lp-ind-spark" }, h$10(Sparkline, {
				points: row.points,
				label: row.label_zh
			})), h$10("span", { className: "lp-ind-judged" }, h$10(JudgedChip, { row })), h$10("span", { className: "lp-ind-source lp-caption" }, SOURCE_ZH[row.source]), h$10(Icon, {
				name: "chevron",
				size: 14,
				className: "lp-ind-chevron"
			})), props.open ? h$10(DetailPanel, {
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
			const body = state.loading && !state.detail ? h$10(Skeleton, { height: 120 }) : !state.detail ? h$10(LoadError, {
				what: `${props.row.label_zh}的历次数值`,
				error: state.error,
				compact: true,
				onRetry: () => setAttempt((count) => count + 1)
			}) : h$10(DetailBody, { detail: state.detail });
			return h$10("div", {
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
			return h$10("div", { className: "lp-ind-detail" }, row.read_error ? h$10("p", { className: "lp-blocker lp-blocker-bad" }, `这项这次没有读到：${row.read_error}。下面是能读到的部分。`) : null, row.change?.text_zh ? h$10("p", { className: "lp-muted" }, prettyUnits(row.change.text_zh)) : null, numeric.length > 1 && units.length <= 1 ? h$10(LineChart, {
				points: numeric.map((point) => ({
					date: point.date,
					value: point.value
				})),
				unit: prettyUnits(units[0] ?? row.unit),
				label: row.label_zh,
				height: 150,
				digits
			}) : null, biovar ? h$10("p", { className: "lp-caption" }, `正常波动：+${fmt(biovar.band_pct.up, 1)}% / ${fmt(biovar.band_pct.down, 1)}%（个体内变异 ${fmt(biovar.cvi_pct, 1)}%）。两次结果之差在这个范围内，多半是测量和生理波动。`, biovar.source.url ? h$10(react.default.Fragment, null, " 来源：", h$10("a", {
				href: biovar.source.url,
				target: "_blank",
				rel: "noopener noreferrer"
			}, biovar.source.title || biovar.source.url)) : biovar.source.title ? ` 来源：${biovar.source.title}` : "", biovar.source.doi ? ` · doi:${biovar.source.doi}` : "") : h$10("p", { className: "lp-caption" }, row.source === "checkup" ? "这项没有收录个体正常波动数据，分不清真实变化和波动，所以不作判断。" : "手环和自测数据按周均值或日值显示趋势，不作正常波动判断。"), biovar?.caveat_zh ? h$10("p", { className: "lp-caption" }, biovar.caveat_zh) : null, points.length > 0 ? h$10("table", { className: "lp-ind-table" }, h$10("caption", { className: "lp-sr" }, `${row.label_zh}历次数值`), h$10("thead", null, h$10("tr", null, ...[
				"日期",
				"数值",
				"单位",
				"来自"
			].map((cell) => h$10("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$10("tbody", null, ...[...points].reverse().map((point, index) => h$10("tr", { key: `${point.date}-${index}` }, h$10("td", null, point.date), h$10("td", { className: "lp-num" }, point.text ?? (point.value == null ? "—" : fmt(point.value, digits))), h$10("td", null, prettyUnits(point.unit)), h$10("td", { className: "lp-caption" }, point.file ?? SOURCE_ZH[row.source]))))) : h$10("p", { className: "lp-muted" }, "没有可显示的数值。"), numeric.length > 1 && units.length > 1 ? h$10(TableTwin, {
				caption: row.label_zh,
				head: ["日期", "数值"],
				rows: numeric.map((point) => [point.date, `${fmt(point.value, digits)} ${point.unit}`])
			}) : null);
		}
		function Loading$1() {
			return h$10("div", {
				className: "lp-tab-body",
				"aria-busy": true,
				"aria-label": "正在读取指标"
			}, h$10(Skeleton, {
				height: 32,
				width: 320
			}), h$10("div", { className: "lp-card" }, ...[
				0,
				1,
				2,
				3,
				4
			].map((index) => h$10(Skeleton, {
				key: index,
				height: 28,
				className: "lp-ind-skeleton"
			}))));
		}
		function Empty(props) {
			const none = props.data.record.status === "none";
			return h$10("div", { className: "lp-card lp-empty" }, h$10(Icon, {
				name: "flask",
				size: 18
			}), h$10("div", null, h$10("div", { className: "lp-strong" }, none ? "还没有连接体检记录" : "记录里还没有指标"), h$10("p", { className: "lp-muted" }, none ? "连接你的 Mirobody 之后，这里会列出每一次体检的化验值和手环数据，按系统分组，带趋势和正常波动的判断。" : "已连接 Mirobody，但还没有读到体检或手环数据。在 Mirobody 上传体检报告后，点右上角的刷新。"), none ? h$10(Btn, {
				size: "sm",
				onClick: props.onConnect
			}, "连接记录") : null));
		}
		function lastCheckup(data) {
			let last = null;
			for (const group of data.groups) for (const row of group.indicators) if (row.source === "checkup" && row.latest && (!last || row.latest.date > last)) last = row.latest.date;
			return last;
		}
		function IndicatorsTab(props) {
			const { data, loading, error } = useIndicators();
			const [open, setOpen] = react.default.useState(null);
			if (!data && loading) return h$10(Loading$1);
			if (!data) return h$10("div", { className: "lp-tab-body" }, h$10(LoadError, {
				what: "指标",
				error,
				onRetry: () => reload("indicators")
			}));
			if (data.groups.length === 0) {
				if (data.record.status === "error") return h$10("div", { className: "lp-tab-body" }, h$10(LoadError, {
					what: "体检记录",
					error: data.record.error || null,
					onRetry: () => reload("indicators")
				}));
				return h$10("div", { className: "lp-tab-body" }, h$10(Empty, {
					data,
					onConnect: props.onConnect
				}));
			}
			const all = data.groups.flatMap((group) => group.indicators);
			const filter = FILTERS.find((row) => row.key === props.filter) ?? FILTERS[0];
			const groups = data.groups.map((group) => ({
				...group,
				indicators: group.indicators.filter(filter.test)
			})).filter((group) => group.indicators.length > 0);
			const failed = all.filter((row) => row.read_error).length;
			const checkup = lastCheckup(data);
			return h$10("div", { className: "lp-tab-body lp-indicators" }, data.record.status === "partial" || data.record.status === "error" ? h$10("p", {
				className: "lp-blocker lp-blocker-bad lp-partial",
				role: "note"
			}, h$10(Icon, {
				name: "warn",
				size: 14
			}), h$10("span", null, `有一部分记录这次没有读到${data.record.error ? `：${data.record.error}` : failed > 0 ? `（${failed} 项）` : ""}。标着“没有读到”的指标不是没测，稍后刷新再读。`)) : null, h$10("div", { className: "lp-ind-toolbar" }, h$10("div", {
				className: "lp-ind-filters",
				role: "group",
				"aria-label": "筛选指标"
			}, ...FILTERS.map((row) => {
				const count = all.filter(row.test).length;
				return h$10("button", {
					key: row.key,
					type: "button",
					className: `lp-toggle ${props.filter === row.key ? "lp-toggle-on" : ""}`,
					"aria-pressed": props.filter === row.key,
					onClick: () => props.onFilter(row.key)
				}, row.label, h$10("span", { className: "lp-toggle-count" }, String(count)));
			})), h$10("span", { className: "lp-caption" }, checkup ? `最近一次体检 ${chineseDate(checkup)}` : "", h$10(Info, {
				label: "和正常波动比",
				align: "end"
			}, "“变好/变差”：最近两次体检之差超出个体正常波动（参考变化值 RCV，按生物学变异数据库计算）；“需结合参考范围”：变化超出波动，但好坏要看是否在参考范围内；“波动内”：差值在正常波动以内；“未判断”：只有一次结果、没有这项的波动数据，或这次没有读到。手环为每周均值，自测为每日值，只显示趋势。"))), groups.length === 0 ? h$10("div", { className: "lp-card lp-empty" }, h$10("p", { className: "lp-muted" }, `没有“${filter.label}”的指标。`), h$10("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => props.onFilter("all")
			}, "看全部 →")) : h$10("div", { className: "lp-card lp-ind-card" }, h$10("div", {
				className: "lp-ind-head",
				"aria-hidden": true
			}, h$10("span", null, "指标"), h$10("span", null, "最近一次"), h$10("span", null, "趋势"), h$10("span", null, "和正常波动比"), h$10("span", null, "来源")), ...groups.map((group) => h$10("section", {
				key: group.key,
				className: "lp-ind-group",
				"aria-label": group.label_zh
			}, h$10("h3", { className: "lp-ind-group-title" }, group.label_zh, h$10("span", { className: "lp-optional" }, `${group.indicators.length} 项`)), h$10("ul", { className: "lp-ind-list" }, ...group.indicators.map((row) => h$10(IndicatorLine, {
				key: row.id,
				row,
				open: open === row.id,
				onToggle: () => setOpen((current) => current === row.id ? null : row.id)
			})))))), h$10("p", { className: "lp-fine" }, "点任一行看历次数值、单位、来自哪份报告，以及正常波动的依据。这里只列出记录里的数值，不做诊断。"));
		}
		//#endregion
		//#region src/client/results.ts
		const h$9 = react.default.createElement;
		/** More than this and the chips crowd the card; the action below lists the rest. */
		const NEEDS_SHOWN = 4;
		function EstimateTag() {
			return h$9("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计");
		}
		function CardHead(props) {
			return h$9("div", { className: "lp-result-head" }, h$9("div", { className: "lp-label" }, props.label, h$9(Info, { label: props.label }, props.info)), h$9(EstimateTag));
		}
		const BIOAGE_INFO = "表型年龄（Levine 2018）：用九项常规血检和实足年龄估计的“身体年龄”。它是人群模型的估计，不是诊断。";
		const RISK_INFO = "China-PAR：按中国成人队列建立的 10 年动脉粥样硬化性心血管病（心梗、脑卒中等）风险模型。它给出的是和你条件相同的人群的平均风险，不是对你个人的预言；这个模型没有公开的个体波动范围。";
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
			return h$9("div", { className: "lp-card lp-result lp-result-blocked" }, h$9(CardHead, {
				label: props.label,
				info: props.info
			}), h$9("div", { className: "lp-result-wait" }, "还不能计算"), h$9("p", { className: "lp-blocker" }, props.blocker || "还缺少计算需要的信息。"), props.needs.length > 0 ? h$9("div", { className: "lp-needs" }, h$9("span", { className: "lp-caption" }, "还需要"), ...props.needs.slice(0, NEEDS_SHOWN).map((need) => h$9("span", {
				className: "lp-need",
				key: need
			}, need)), props.needs.length > NEEDS_SHOWN ? h$9("span", { className: "lp-caption" }, `等 ${props.needs.length} 项`) : null) : null, props.selfAddon && props.selfAddon.self_key && action?.target !== "profile" && action?.target !== "records" ? h$9("div", { className: "lp-result-self" }, h$9("div", { className: "lp-caption" }, `${props.selfAddon.item_zh}可以自己在家量，记下就能算：`), h$9(InlineSelf, {
				journey: props.journey,
				selfKey: props.selfAddon.self_key,
				idPrefix: `${props.idPrefix}-self`,
				onNotice: props.onNotice
			})) : action ? h$9("div", { className: "lp-result-action" }, h$9(Btn, {
				size: "sm",
				variant: "outline",
				onClick: () => props.onAction(action.target)
			}, action.label, h$9(Icon, {
				name: "arrow",
				size: 14
			}))) : null);
		}
		function BodyAgeCard(props) {
			const result = props.journey.results.bioage;
			if (result.status !== "ok") return h$9(Blocked, {
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
			const advance = latest ? latest.advance : result.advance;
			const band = bio?.band_years ?? result.band_years;
			const date = latest?.date ?? result.date;
			const count = points.length || result.checkups;
			const partial = (bio?.band_missing ?? []).length > 0;
			const delta = latest?.advance != null && first?.advance != null && points.length > 1 ? latest.advance - first.advance : null;
			let story = "";
			if (delta != null && first) {
				const moved = delta < 0 ? `年轻了 ${fmt(-delta)} 岁` : delta > 0 ? `多了 ${fmt(delta)} 岁` : "没有变化";
				story = `从 ${chineseMonth(first.date)}到现在，相对实足年龄${moved}`;
				story += band != null ? Math.abs(delta) > band ? "，超出个体正常波动。" : "，还在个体正常波动以内。" : "。";
			}
			const versus = versusAge(advance);
			const info = h$9(react.default.Fragment, null, h$9("span", { className: "lp-info-line" }, BIOAGE_INFO), band != null ? h$9("span", { className: "lp-info-line" }, `浅色带是第一次检查的个体正常波动（±${fmt(band)} 岁${partial ? `，未含${bio?.band_missing?.join("、")}` : ""}），落在带外才算真实变化。`) : null, date ? h$9("span", { className: "lp-info-line" }, `最近一次：${chineseDate(date)}体检，共 ${count} 次完整血检。`) : null);
			return h$9("div", { className: "lp-card lp-result" }, h$9(CardHead, {
				label: "身体年龄",
				info
			}), h$9("div", { className: "lp-result-figure" }, h$9("span", { className: "lp-bignum" }, fmt(phenoage)), h$9("span", { className: "lp-bignum-unit" }, "岁"), versus ? h$9("span", { className: `lp-pill ${advance != null && advance < -.5 ? "lp-pill-good" : ""}` }, versus) : null), result.caveat_zh ? h$9("p", {
				className: "lp-caveat",
				role: "note"
			}, h$9(Icon, {
				name: "warn",
				size: 14
			}), h$9("span", null, result.caveat_zh)) : null, points.length > 1 ? h$9(LineChart, {
				points: points.filter((row) => row.advance != null).map((row) => ({
					date: row.date,
					value: row.advance
				})),
				unit: "岁",
				label: "身体年龄减实足年龄",
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
			}) : props.tracking == null ? h$9(Skeleton, { height: 40 }) : null, h$9("p", { className: "lp-caption" }, [
				count > 0 ? `${count} 次体检` : "",
				points.length > 1 && band != null ? "浅色带为正常波动" : "",
				story
			].filter(Boolean).join(" · ")));
		}
		function RiskCard(props) {
			const result = props.journey.results.risk;
			if (result.status !== "ok") {
				const needs = [...result.missing_facts, ...result.missing_labs];
				return h$9(Blocked, {
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
				});
			}
			const card = props.tracking?.models?.find((row) => row.model === "china-par");
			const goal = card?.goal?.risk_pct;
			return h$9("div", { className: "lp-card lp-result" }, h$9(CardHead, {
				label: "10 年心血管风险",
				info: h$9(react.default.Fragment, null, h$9("span", { className: "lp-info-line" }, RISK_INFO), card?.note_zh ? h$9("span", { className: "lp-info-line" }, card.note_zh) : null)
			}), h$9("div", { className: "lp-result-figure" }, h$9("span", { className: "lp-bignum" }, riskText(result.risk_pct)), h$9("span", { className: "lp-bignum-unit" }, "%"), result.category_zh ? h$9("span", { className: "lp-pill" }, result.category_zh) : null), goal != null && Number.isFinite(goal) ? h$9("div", { className: "lp-result-goal" }, h$9("span", { className: "lp-caption" }, "达到方案目标约"), h$9("span", { className: "lp-strong" }, `${riskText(goal)}%`), card?.category_zh?.goal ? h$9("span", { className: "lp-pill lp-pill-good" }, card.category_zh.goal) : null) : null, h$9("p", { className: "lp-caption" }, [result.date ? `按 ${chineseDate(result.date)}的记录和你的档案计算` : "", "未来 10 年发生心梗、脑卒中等的估计概率"].filter(Boolean).join(" · ")));
		}
		function ResultsRow(props) {
			const focus = props.journey.profile.focus;
			const riskAt = focus.findIndex((key) => key === "cardio" || key === "weight");
			const bioAt = focus.indexOf("bioage");
			const riskFirst = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt);
			const bio = h$9(BodyAgeCard, {
				key: "bio",
				...props
			});
			const risk = h$9(RiskCard, {
				key: "risk",
				...props
			});
			return h$9("div", {
				className: "lp-results",
				id: "lp-results"
			}, ...riskFirst ? [risk, bio] : [bio, risk]);
		}
		/** The next-checkup add-on list; items the person can measure at home get a field right here. */
		function AddonList(props) {
			const addons = props.journey.addons;
			if (addons.length === 0) return h$9("p", { className: "lp-muted" }, "没有需要加测的项目。");
			return h$9("ul", {
				className: "lp-addons",
				id: `${props.idPrefix}-addons`
			}, ...addons.map((row) => h$9("li", {
				key: row.item_zh,
				className: "lp-addon"
			}, h$9("span", {
				className: "lp-addon-box",
				"aria-hidden": true
			}, h$9(Icon, {
				name: row.self_measurable ? "ruler" : "flask",
				size: 14
			})), h$9("div", { className: "lp-addon-text" }, h$9("div", { className: "lp-strong" }, row.item_zh), h$9("div", { className: "lp-caption" }, `解锁：${row.unlocks_zh}${row.self_measurable ? " · 可以自己在家量" : " · 下次体检加测"}`)), row.self_measurable && row.self_key ? h$9(InlineSelf, {
				journey: props.journey,
				selfKey: row.self_key,
				idPrefix: `${props.idPrefix}-${row.self_key}`,
				onNotice: props.onNotice
			}) : null)));
		}
		//#endregion
		//#region src/client/overview.ts
		const h$8 = react.default.createElement;
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
			return h$8("div", { className: "lp-week" }, h$8("span", { className: "lp-caption" }, "本周"), h$8("ol", {
				className: "lp-week-cells",
				"aria-label": `近 7 天：${week.map((day) => `${chineseDate(day.date)}${DAY_ZH[day.state]}`).join("，")}`
			}, ...week.map((day) => h$8("li", {
				key: day.date,
				className: `lp-week-cell lp-week-${day.state}`,
				title: `${chineseDate(day.date)} ${DAY_ZH[day.state]}`
			}, h$8("span", {
				className: "lp-week-day",
				"aria-hidden": true
			}, WEEK_ZH[(/* @__PURE__ */ new Date(`${day.date}T12:00:00Z`)).getUTCDay()])))), retestText ? h$8("span", { className: "lp-caption" }, `· ${retestText}`) : null);
		}
		function TodayCard(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const counts = todayCounts(props.journey);
			return h$8("section", {
				className: "lp-card lp-today-card",
				id: "lp-today",
				"aria-labelledby": "lp-today-title"
			}, h$8("div", { className: "lp-card-head" }, h$8("div", {
				className: "lp-label",
				id: "lp-today-title"
			}, "今天", counts.total > 0 ? h$8("span", { className: "lp-optional" }, `${counts.done} / ${counts.total}`) : null), props.journey.plan.days != null ? h$8("span", { className: "lp-caption" }, `方案第 ${props.journey.plan.days} 天`) : null), h$8(TodayList, {
				journey: props.journey,
				stateOf,
				busy,
				onAnswer: answer
			}), h$8(WeekStrip, {
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
				default: return null;
			}
		}
		function NextCard(props) {
			const next = props.journey.next;
			if (!next.title_zh && !next.detail_zh) return null;
			const cta = ctaOf(next.action, props);
			return h$8("section", {
				className: "lp-card lp-next-card",
				"aria-label": "下一步"
			}, h$8("div", { className: "lp-next-text" }, h$8("div", { className: "lp-label" }, "下一步"), h$8("div", { className: "lp-strong" }, next.title_zh), next.detail_zh && next.detail_zh !== next.title_zh ? h$8("p", { className: "lp-muted" }, next.detail_zh) : null), cta ? h$8(Btn, {
				size: "sm",
				onClick: cta.run
			}, cta.label, h$8(Icon, {
				name: "arrow",
				size: 14
			})) : null);
		}
		/** Some reads failed: the missing values are unknown, not "not measured". */
		function PartialNote(props) {
			const records = props.journey.records;
			if (records.status !== "partial") return null;
			const missing = records.missing_reads;
			return h$8("p", {
				className: "lp-blocker lp-blocker-bad lp-partial",
				role: "note"
			}, h$8(Icon, {
				name: "warn",
				size: 14
			}), h$8("span", null, `有一部分记录这次没有读到${records.read_errors.length > 0 ? `（${records.read_errors.slice(0, 2).join("；")}）` : ""}。`, missing.length > 0 ? `没读到的指标：${missing.slice(0, 6).join("、")}${missing.length > 6 ? ` 等 ${missing.length} 项` : ""}。` : "", "它们不是“没测”，稍后点右上角的刷新再读一次。"));
		}
		function Overview(props) {
			const { journey } = props;
			return h$8("div", { className: "lp-tab-body lp-overview" }, h$8(PartialNote, { journey }), journey.plan.exists ? h$8(TodayCard, {
				journey,
				tracking: props.tracking,
				onNotice: props.onNotice
			}) : null, h$8(ResultsRow, {
				journey,
				tracking: props.tracking,
				onAction: props.onAction,
				onNotice: props.onNotice
			}), h$8(NextCard, props), h$8(NotableChanges, {
				journey,
				onOpenIndicators: () => props.goTab("indicators", { filter: "changed" })
			}));
		}
		//#endregion
		//#region src/client/profile-tab.ts
		const h$7 = react.default.createElement;
		/** Where the connection is set: the LongPi page in DSH's settings, or here when settings cannot be opened from the page. */
		function ConnectionCard(props) {
			const { data } = useConnection();
			const openSettings = useSettingsOpener();
			const [editing, setEditing] = react.default.useState(false);
			return h$7("div", {
				className: "lp-card",
				id: "lp-connection-card"
			}, h$7("div", { className: "lp-card-head" }, h$7("div", { className: "lp-label" }, "数据连接"), openSettings ? h$7("button", {
				type: "button",
				className: "lp-row-link",
				onClick: () => openSettings("longpi")
			}, "在设置中修改 →") : h$7("button", {
				type: "button",
				className: "lp-row-link",
				"aria-expanded": editing,
				onClick: () => setEditing((current) => !current)
			}, editing ? "收起" : "修改连接")), data ? h$7(ConnectionStatus, { connection: data }) : h$7(RecordsStatusLine, { journey: props.journey }), editing && !openSettings ? h$7(ConnectionForm, {
				connection: data,
				idPrefix: "lp-profile-conn",
				onSaved: () => setEditing(false)
			}) : null, openSettings ? null : h$7("p", { className: "lp-fine" }, "也可以在 DSH 左下角的“设置 → LongPi”中修改。"));
		}
		function ProfileTab(props) {
			const { journey } = props;
			const today = journey.today;
			return h$7("div", { className: "lp-tab-body" }, h$7(Section, {
				id: "lp-profile-section",
				title: "档案与自测",
				kicker: "只保存在这台电脑上"
			}, h$7("div", { className: "lp-grid-2 lp-grid-top" }, h$7("div", {
				className: "lp-card",
				id: "lp-profile-card"
			}, h$7("div", { className: "lp-label" }, "档案"), h$7(ProfileEditor, {
				journey,
				variant: "page",
				idPrefix: "lp-profile",
				onNotice: props.onNotice
			})), h$7("div", {
				className: "lp-card",
				id: "lp-self-card"
			}, h$7("div", { className: "lp-label" }, "自测", h$7("span", { className: "lp-optional" }, "腰围 · 家庭血压 · 体重")), h$7(SelfLatestList, { latest: journey.self.latest }), h$7(SelfMeasureForm, {
				journey,
				idPrefix: "lp-self",
				onNotice: props.onNotice
			}), h$7("p", { className: "lp-fine" }, "家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。早晚各量一次、每次坐着休息 5 分钟后再量。"), h$7(SelfRecent, { onNotice: props.onNotice })))), journey.addons.length > 0 ? h$7("div", {
				className: "lp-card",
				id: "lp-addons-card"
			}, h$7("div", { className: "lp-label" }, "下次体检加测", h$7("span", { className: "lp-optional" }, `${journey.addons.length} 项，加上就能算出更多结果`)), h$7(AddonList, {
				journey,
				onNotice: props.onNotice,
				idPrefix: "lp-profile-addons"
			})) : null, h$7("div", { className: "lp-grid-2 lp-grid-top" }, h$7(ConnectionCard, { journey }), h$7("div", {
				className: "lp-card",
				id: "lp-export-card"
			}, h$7("div", { className: "lp-label" }, "导出"), h$7("p", { className: "lp-muted" }, "报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；日历文件包含复测日期和每天的打卡提醒。"), h$7("div", { className: "lp-form-actions" }, h$7(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: `longpi-report-${today}.md`
			}, "导出报告"), h$7(LinkButton, {
				href: "/api/longpi/calendar.ics",
				icon: "calendar",
				download: "longpi.ics"
			}, "加入日历")), h$7("p", { className: "lp-fine" }, h$7(Icon, {
				name: "lock",
				size: 12
			}), " 导出的文件留在你的电脑上，LongPi 不会发给任何人。"))));
		}
		//#endregion
		//#region src/client/page.ts
		const h$6 = react.default.createElement;
		const TAB_KEY = "dsh-plugin-longpi.page-tab";
		const TABS = [
			{
				key: "overview",
				label: "概览"
			},
			{
				key: "indicators",
				label: "指标"
			},
			{
				key: "plan",
				label: "方案"
			},
			{
				key: "profile",
				label: "档案"
			}
		];
		/** How long a request from elsewhere waits for its section to be on screen. */
		const SCROLL_WAIT_MS = 2e3;
		function storedTab() {
			const saved = readPref(TAB_KEY);
			return TABS.some((tab) => tab.key === saved) ? saved : "overview";
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
			const today = journey?.today ?? localToday();
			const name = journey?.profile.displayName.trim() ?? "";
			const plan = journey?.plan.exists && journey.plan.days != null ? ` · 方案第 ${journey.plan.days} 天` : "";
			return h$6("header", { className: "lp-header" }, h$6("div", { className: "lp-header-text" }, h$6("div", { className: "lp-kicker" }, `LongPi${journey?.version ? ` ${journey.version}` : ""} · 健康`), h$6("h1", { className: "lp-h1" }, `${greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`), h$6("p", { className: "lp-lead" }, `${chineseDate(today)} ${weekday(today)}${plan}`), journey ? h$6(RecordsStatusLine, { journey }) : props.failed ? null : h$6(Skeleton, {
				height: 18,
				width: 240
			})), h$6("div", { className: "lp-actions" }, h$6("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: props.onRefresh,
				disabled: props.refreshing,
				"aria-busy": props.refreshing
			}, h$6(Icon, {
				name: "refresh",
				size: 14,
				className: props.refreshing ? "lp-spin" : ""
			}), props.refreshing ? "刷新中" : "刷新")));
		}
		function Banner(props) {
			const banner = bannerOf(props.journey);
			if (!banner) return null;
			return h$6("button", {
				type: "button",
				className: "lp-banner",
				onClick: props.onOpen
			}, h$6(Icon, {
				name: "spark",
				size: 14
			}), h$6("span", null, `还差 ${banner.left} 步：${banner.title}`), h$6("span", { className: "lp-banner-go" }, "继续 →"));
		}
		function Loading() {
			return h$6("div", {
				className: "lp-loading",
				"aria-busy": true,
				"aria-label": "正在读取"
			}, h$6(Skeleton, {
				height: 36,
				width: 320
			}), h$6("div", { className: "lp-results" }, h$6(Skeleton, {
				height: 180,
				className: "lp-card-skeleton"
			}), h$6(Skeleton, {
				height: 180,
				className: "lp-card-skeleton"
			})), h$6(Skeleton, {
				height: 120,
				className: "lp-card-skeleton"
			}));
		}
		function Failed(props) {
			return h$6("div", {
				className: "lp-card lp-failed",
				role: "alert"
			}, h$6("div", { className: "lp-strong" }, "LongPi 没有读到数据"), h$6("p", { className: "lp-muted" }, `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。`), h$6(Btn, {
				variant: "outline",
				size: "sm",
				onClick: props.onRetry
			}, h$6(Icon, {
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
			const [tab, setTabState] = react.default.useState(storedTab);
			const [filter, setFilter] = react.default.useState("all");
			const [refreshing, setRefreshing] = react.default.useState(false);
			const [onboarding, setOnboarding] = react.default.useState(false);
			const setTab = react.default.useCallback((next) => {
				setTabState(next);
				writePref(TAB_KEY, next);
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
			if (!journey && loading) body = h$6(Loading);
			else if (!journey) body = h$6(Failed, {
				error: error ?? "没有返回",
				onRetry: () => {
					doRefresh();
				}
			});
			else {
				let panel;
				if (tab === "overview") panel = h$6(Overview, {
					journey,
					tracking: tracking.data,
					onNotice: notify,
					onAction,
					goTab,
					openOnboarding: () => setOnboarding(true)
				});
				else if (tab === "indicators") panel = h$6(IndicatorsTab, {
					filter,
					onFilter: setFilter,
					onConnect: () => goTab("profile", { id: "lp-connection-card" })
				});
				else if (tab === "plan") panel = h$6(PlanTab, {
					journey,
					tracking: tracking.data,
					loading: tracking.loading,
					error: tracking.error,
					onNotice: notify,
					onPrompt
				});
				else panel = h$6(ProfileTab, {
					journey,
					onNotice: notify
				});
				body = h$6("div", { className: `lp-body ${refreshing ? "lp-refreshing" : ""}` }, h$6(Banner, {
					journey,
					onOpen: () => setOnboarding(true)
				}), h$6(Tabs, {
					tabs: TABS,
					value: tab,
					onChange: setTab,
					label: "LongPi 健康页",
					idPrefix: "lp-page"
				}), h$6("div", {
					className: "lp-tab-panel",
					role: "tabpanel",
					id: "lp-page-panel",
					"aria-labelledby": `lp-page-tab-${tab}`
				}, panel));
			}
			return h$6("div", {
				className: "lp lp-page-root",
				ref: root
			}, h$6("div", { className: "lp-page" }, h$6(Header, {
				journey,
				failed: !journey && !loading,
				refreshing,
				onRefresh: () => {
					doRefresh();
				}
			}), notice ? h$6("div", { className: "lp-notice-slot" }, notice) : null, body, h$6("footer", { className: "lp-footer" }, h$6("p", null, journey?.boundary_zh || "模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。"), h$6("p", { className: "lp-caption" }, "档案、方案、打卡和自测只保存在这台电脑上，病历在你自己的 Mirobody 中；对话内容会发送给 DSH 里配置的模型处理。"))), onboarding ? h$6(Onboarding, {
				explicit: true,
				complete: () => setOnboarding(false),
				openPage: () => {}
			}) : null);
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
			const today = journey?.today ?? localToday();
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
		function whenText(iso, today = localToday()) {
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
			}), h$4("details", { className: "lp-more" }, h$4("summary", null, "更多设置", h$4("span", { className: "lp-optional" }, "复测提醒、每周小结、免打扰、发到飞书或手机、内容详略")), h$4(Settings, {
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
			}, h$3("span", { className: "lp-strong" }, row.item), h$3("span", { className: "lp-caption" }, `解锁 ${row.skills.length} 个方法`)))))), h$3("div", { className: "lp-grid-2" }, h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-label" }, "用药计划", h$3("span", { className: "lp-optional" }, "只读，来自 Mirobody")), meds.length === 0 ? h$3("p", { className: "lp-muted" }, "没有读到用药计划。") : h$3("ul", { className: "lp-rows" }, ...meds.map((row) => h$3("li", {
				key: row.name,
				className: "lp-row"
			}, h$3("span", null, row.name), h$3("span", { className: "lp-caption" }, row.status ?? ""))))), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-label" }, "最近读出"), readouts.length === 0 ? h$3("p", { className: "lp-muted" }, "还没有算过。") : h$3("ul", { className: "lp-rows" }, ...readouts.slice(0, 8).map((row) => h$3("li", {
				key: row.key,
				className: "lp-row"
			}, h$3("span", null, row.label_zh || row.key), h$3("span", { className: "lp-row-end" }, h$3("span", { className: "lp-num" }, `${typeof row.value === "number" ? fmt(row.value, 2) : row.value ?? ""} ${row.unit && row.unit !== "1" ? row.unit === "a" ? "岁" : row.unit : ""}`), h$3("span", { className: "lp-caption" }, (row.measured_at || row.at || "").slice(0, 10)))))))), h$3("div", { className: "lp-grid-1" }, h$3(Search, { board })));
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
		function Privacy() {
			return h$2("div", null, h$2("ul", { className: "lp-privacy" }, ...[
				[
					"lock",
					"存在哪里",
					"档案、方案、打卡、自测和提醒设置只保存在这台电脑上（默认在 ~/.dsh/longpi，安装时可以改）。体检和手环记录在你自己的 Mirobody 中，LongPi 只读。"
				],
				[
					"send",
					"什么会发给模型",
					"和 LongPi 对话时，你的问题，以及 LongPi 工具为回答它读出的档案、指标数值和结果，会作为对话内容发给你在 DSH 里配置的模型（默认 DeepSeek）处理。不对话就不会发送。"
				],
				[
					"bell",
					"什么会发给 Webhook",
					"只在你配置了 Webhook 时发送。简要模式只发“今天还有 2 项待打卡”这类提示，不含项目名称和健康数值；详细模式会带上方案项目名称、执行率和复测指标。"
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
				title: "随访提醒",
				hint: "默认关闭 · 只在 DSH 运行时发送"
			}, h$2(FollowupPanel, { onNotice: notify })), h$2(Block, {
				id: "lp-set-connection",
				title: "数据连接",
				hint: "Mirobody"
			}, h$2(ConnectionPanel, { idPrefix: "lp-set-conn" })), h$2(Block, {
				id: "lp-set-privacy",
				title: "隐私与数据"
			}, h$2(Privacy)), h$2("section", {
				className: "lp-set-block",
				id: "lp-set-methods"
			}, h$2("details", {
				className: "lp-more",
				onToggle: (event) => setAdvanced(event.currentTarget.open)
			}, h$2("summary", null, h$2("span", { className: "lp-set-title" }, "高级：方法库"), h$2("span", { className: "lp-optional" }, "给想看方法细节的人")), advanced ? h$2(Methods, { onNotice: notify }) : null)));
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
  height: 100%; overflow-y: auto; background: var(--lp-bg);
  padding-top: var(--dsh-frame-top-clearance, 48px);
  padding-left: var(--dsh-frame-leading-clearance, 0px);
}
.lp-page { max-width: 1040px; margin: 0 auto; padding: 12px 40px 64px; }
@container lp-root (max-width: 760px) { .lp-page { padding: 8px 20px 48px; } }
.lp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; }
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
  display: flex; flex-wrap: wrap; justify-content: center; width: 100%; min-width: 0;
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
.lp-tabs { display: flex; gap: 4px; margin: 0 0 20px; border-bottom: .5px solid var(--lp-line-2); overflow-x: auto; scrollbar-width: none; }
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
.lp-next-text { min-width: 0; flex: 1; }
.lp-next-text .lp-label { margin-bottom: 4px; }
.lp-next-text .lp-muted { margin-top: 2px; }
.lp-notable { scroll-margin-top: 24px; }
.lp-notable-list { list-style: none; margin: 8px 0 0; padding: 0; }
.lp-notable-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 140px; align-items: center; gap: 12px; padding: 8px 0; border-top: .5px solid var(--lp-line-2); }
.lp-notable-row:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-notable-row { grid-template-columns: auto minmax(0, 1fr) auto; } .lp-notable-row .lp-change-spark { display: none; } }
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
.lp-ind-btn { width: 100%; min-height: 44px; padding: 6px 8px; margin: 0 -8px; width: calc(100% + 16px); border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
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

.lp-spin { animation: lp-spin 1s linear infinite; }
@keyframes lp-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-pulse { 50% { opacity: .45; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
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
		//#region src/client/toolviews.ts
		const h$1 = react.default.createElement;
		function objectOf(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function parseArgs(raw) {
			if (typeof raw !== "string" || !raw.trim()) return {};
			try {
				return objectOf(JSON.parse(raw));
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
			const node = objectOf(block);
			if (node.kind !== "tool-result") return {
				state: "running",
				args: parseArgs(node.argsRaw),
				result: null,
				text: "",
				error: ""
			};
			const args = parseArgs(objectOf(node.call).argsRaw);
			const text = (Array.isArray(node.content) ? node.content : []).map((part) => {
				const row = objectOf(part);
				return row.type === "text" && typeof row.text === "string" ? row.text : JSON.stringify(part, null, 2);
			}).join("\n");
			if (node.isError === true) {
				const err = objectOf(node.error);
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
				result = objectOf(JSON.parse(text));
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
			return h$1("div", {
				className: `lp lp-tool ${props.quiet ? "lp-tool-quiet" : "lp-tool-card"} ${call.state === "error" ? "lp-tool-error" : ""}`,
				"data-state": call.state
			}, h$1("div", { className: "lp-tool-head" }, h$1("span", {
				className: `lp-tool-icon ${running ? "lp-tool-running" : ""}`,
				"aria-hidden": true
			}, h$1(Icon, {
				name: running ? "refresh" : call.state === "error" ? "warn" : props.icon,
				size: 14,
				className: running ? "lp-spin" : ""
			})), h$1("span", { className: "lp-tool-title" }, props.title), props.summary != null ? h$1("span", { className: `lp-tool-summary ${props.tone ? `lp-tool-${props.tone}` : ""}` }, props.summary) : null, props.action ?? null, rawText ? h$1("button", {
				type: "button",
				className: "lp-tool-raw-btn",
				"aria-expanded": raw,
				onClick: () => setRaw((current) => !current)
			}, "原始结果", h$1(Icon, {
				name: "chevron",
				size: 12,
				className: raw ? "lp-rot" : ""
			})) : null), props.children ? h$1("div", { className: "lp-tool-body" }, props.children) : null, raw && rawText ? h$1("pre", { className: "lp-tool-raw" }, rawText) : null);
		}
		const ADOPTED_KEY = "dsh-plugin-longpi.adopted.";
		function DraftCard(props) {
			const { journey } = useJourney();
			const { draft } = props;
			const [removed, setRemoved] = react.default.useState(/* @__PURE__ */ new Set());
			const [confirming, setConfirming] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const [saved, setSaved] = react.default.useState(() => {
				const version = Number(readPref(`${ADOPTED_KEY}${props.callId}`));
				return Number.isFinite(version) && version > 0 ? {
					version,
					reminder: null
				} : null;
			});
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
					const result = await acceptDraft(draft, kept, remind);
					if (!result.ok) {
						setError(`没有保存：${result.error}`);
						return;
					}
					writePref(`${ADOPTED_KEY}${props.callId}`, String(result.version));
					setSaved({
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
			if (saved) return h$1("div", { className: "lp-tool-saved" }, h$1("span", { className: "lp-chip-saved" }, h$1(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已保存为方案第 ${saved.version} 版`), saved.reminder ? h$1("span", { className: "lp-caption" }, `打卡提醒没有打开：${saved.reminder}`) : null, openPlan ? h$1("button", {
				type: "button",
				className: "lp-row-link",
				onClick: openPlan
			}, "在健康页查看 →") : null);
			return h$1("div", { className: "lp-tool-draft" }, h$1(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				compact: true
			}), props.data.brief.notes_zh[0] ? h$1("p", { className: "lp-fine" }, props.data.brief.notes_zh[0]) : null, h$1("div", { className: "lp-form-actions" }, h$1(Btn, {
				size: "sm",
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$1("span", { className: "lp-caption" }, "每项是试验里的平均效果，个人结果会不同；补剂不给剂量，不涉及处方药。")), confirming ? h$1(ConfirmModal, {
				draft,
				items: kept,
				goals,
				today: journey?.today ?? localToday(),
				busy,
				error,
				onCancel: () => setConfirming(false),
				onConfirm: (remind) => {
					accept(remind);
				}
			}) : null);
		}
		function DraftToolView(props) {
			const call = parseCall(props.block);
			if (call.state === "running") return h$1(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "正在按你的结果和试验证据起草…"
			});
			if (call.state === "error") return h$1(Shell, {
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
			if (!data) return h$1(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "结果无法显示，展开看原始结果",
				tone: "warn"
			});
			if (!data.draft) return h$1(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: "现在还起草不了"
			}, h$1("p", { className: "lp-muted" }, data.brief.notes_zh[0] || "记录里还没有能对上研究证据的指标。"));
			return h$1(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: `${data.draft.items.length} 项 · 按证据起草 · 还没有保存`
			}, h$1(DraftCard, {
				callId: props.callId,
				data,
				draft: data.draft,
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
		function strings(value) {
			return Array.isArray(value) ? value.filter((row) => typeof row === "string" && row.length > 0) : [];
		}
		function SaveToolView(props) {
			const call = parseCall(props.block);
			const confirm = call.args.confirm === true;
			const title = confirm ? "保存方案" : "核对方案";
			if (call.state === "running") return h$1(Shell, {
				call,
				icon: "check",
				title,
				summary: confirm ? "正在保存…" : "正在核对…"
			});
			if (call.state === "error") return h$1(Shell, {
				call,
				icon: "check",
				title,
				summary: `没有完成：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const readBack = strings(result.read_back);
			const warnings = strings(result.warnings);
			const errors = strings(result.errors);
			if (result.saved === true) {
				const version = typeof result.version === "number" ? result.version : null;
				const openPlan = props.openPage ? () => {
					requestView({
						tab: "plan",
						id: "lp-plan"
					});
					props.openPage?.();
				} : null;
				return h$1(Shell, {
					call,
					icon: "check",
					title: "保存方案",
					quiet: true,
					summary: h$1("span", { className: "lp-chip-saved" }, h$1(Icon, {
						name: "check",
						size: 12,
						strokeWidth: 2
					}), version != null ? `已保存为方案第 ${version} 版` : "已保存"),
					action: openPlan ? h$1("button", {
						type: "button",
						className: "lp-tool-undo",
						onClick: openPlan
					}, "在健康页查看 →") : null
				});
			}
			return h$1(Shell, {
				call,
				icon: "check",
				title: "方案复述",
				summary: errors.length > 0 ? "还缺信息，没有保存" : "还没有保存，确认后才保存",
				tone: errors.length > 0 ? "warn" : void 0
			}, readBack.length > 0 ? h$1("ul", { className: "lp-readback" }, ...readBack.map((text, index) => {
				const row = readBackRow(text);
				return h$1("li", { key: index }, row.category ? h$1("span", { className: "lp-cat" }, row.category) : null, h$1("span", { className: "lp-strong" }, row.title), row.rest ? h$1("span", { className: "lp-caption" }, ` ${row.rest}`) : null);
			})) : null, ...errors.map((text) => h$1("p", {
				key: `e:${text}`,
				className: "lp-form-error"
			}, text)), ...warnings.map((text) => h$1("p", {
				key: `w:${text}`,
				className: "lp-caption lp-tool-warn"
			}, h$1(Icon, {
				name: "warn",
				size: 12
			}), ` ${text}`)));
		}
		const UNDONE_KEY = "dsh-plugin-longpi.undone.";
		function CheckinToolView(props) {
			const call = parseCall(props.block);
			const { journey } = useJourney();
			const [undoing, setUndoing] = react.default.useState(false);
			const [undone, setUndone] = react.default.useState(() => readPref(`${UNDONE_KEY}${props.callId}`) === "1");
			const [error, setError] = react.default.useState(null);
			if (call.state === "running") return h$1(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "正在记录…"
			});
			if (call.state === "error") return h$1(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: `没有记下：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const entries = (Array.isArray(result.entries) ? result.entries : []).map((row) => {
				const entry = objectOf(row);
				return {
					item: String(entry.item ?? ""),
					date: String(entry.date ?? ""),
					done: entry.done === true ? true : entry.done === false ? false : null
				};
			}).filter((row) => row.item);
			const problems = strings(result.problems);
			const titleOf = (id) => journey?.plan.checkin_items.find((row) => row.id === id)?.title ?? id;
			const today = journey?.today ?? localToday();
			const undoable = entries.filter((row) => row.date === today);
			const names = entries.map((row) => `${titleOf(row.item)}${row.done === true ? "" : row.done === false ? "（没做到）" : ""}${row.date && row.date !== today ? `（${row.date.slice(5)}）` : ""}`);
			async function undo() {
				setUndoing(true);
				setError(null);
				try {
					for (const row of undoable) await postCheckIn(today, row.item, null);
					writePref(`${UNDONE_KEY}${props.callId}`, "1");
					setUndone(true);
				} catch (err) {
					setError(`没有撤销：${errorText(err, "请稍后再试")}`);
				} finally {
					setUndoing(false);
				}
			}
			if (entries.length === 0) return h$1(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "没有记下",
				tone: "warn",
				quiet: true
			}, ...problems.map((text) => h$1("p", {
				key: text,
				className: "lp-caption"
			}, text)));
			return h$1(Shell, {
				call,
				icon: "check",
				title: "打卡",
				quiet: true,
				summary: h$1("span", { className: `lp-chip-saved ${undone ? "lp-chip-undone" : ""}` }, h$1(Icon, {
					name: undone ? "close" : "check",
					size: 12,
					strokeWidth: 2
				}), undone ? `已撤销：${names.join("、")}` : `已记录：${names.join("、")}`),
				action: !undone && undoable.length > 0 ? h$1("button", {
					type: "button",
					className: "lp-tool-undo",
					disabled: undoing,
					onClick: () => {
						undo();
					},
					"aria-label": `撤销今天的打卡：${names.join("、")}`
				}, undoing ? "撤销中" : "撤销") : null
			}, error ? h$1("p", { className: "lp-form-error" }, error) : null, ...problems.map((text) => h$1("p", {
				key: text,
				className: "lp-caption"
			}, text)));
		}
		const PHENOAGE_SKILL = "accelerated-biological-aging-risk";
		const RISK_SKILL = "china-par-ascvd-risk";
		function outputValue(result, key) {
			const value = objectOf(objectOf(result.outputs)[key]).value;
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
			const outputs = Object.values(objectOf(result?.outputs)).map((row) => objectOf(row).label_zh).find((label) => typeof label === "string" && label);
			return typeof outputs === "string" ? outputs : name;
		}
		function ResultFigure(props) {
			return h$1("div", { className: "lp-tool-result" }, h$1("span", { className: "lp-tool-figure" }, props.figure, h$1("span", { className: "lp-bignum-unit" }, props.unit)), h$1("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计"), ...props.lines.filter(Boolean).map((line) => h$1("span", {
				key: line,
				className: "lp-caption"
			}, line)));
		}
		function SkillToolView(props) {
			const call = parseCall(props.block);
			const board = useCachedBoard();
			const { journey } = useJourney();
			const name = typeof call.args.name === "string" ? call.args.name : "";
			const plain = name === PHENOAGE_SKILL ? "身体年龄" : name === RISK_SKILL ? "10 年心血管风险" : skillName(board, name, call.result);
			if (call.state === "running") return h$1(Shell, {
				call,
				icon: "play",
				title: `计算${plain}`,
				summary: "正在运行方法…"
			});
			if (call.state === "error") return h$1(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: `没有算完：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			if (result.ok !== true) {
				const reason = typeof result.error === "string" && result.error ? result.error : typeof result.error_kind === "string" ? result.error_kind : "方法没有给出结果";
				return h$1(Shell, {
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
				if (phenoage != null) return h$1(Shell, {
					call,
					icon: "play",
					title: "身体年龄",
					summary: typeof result.measured_at === "string" ? `按 ${result.measured_at} 的血检` : void 0
				}, h$1(ResultFigure, {
					figure: fmt(phenoage),
					unit: "岁",
					lines: [versusAge(advance), band != null ? `正常波动 ±${fmt(band)} 岁` : ""]
				}));
			}
			if (name === RISK_SKILL) {
				const risk = numberOf(outputValue(result, "risk_10y_pct"));
				const category = outputValue(result, "risk_category");
				if (risk != null) return h$1(Shell, {
					call,
					icon: "play",
					title: "10 年心血管风险",
					summary: typeof result.measured_at === "string" ? `按 ${result.measured_at} 的记录` : void 0
				}, h$1(ResultFigure, {
					figure: riskText(risk),
					unit: "%",
					lines: [typeof category === "string" ? category : "", "China-PAR，同类人群的平均风险"]
				}));
			}
			const excerpt = typeof result.report_excerpt === "string" ? result.report_excerpt.trim() : "";
			return h$1(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: "已算出"
			}, excerpt ? h$1("details", { className: "lp-tool-report" }, h$1("summary", null, "报告"), h$1("pre", null, excerpt)) : null);
		}
		function SituationToolView(props) {
			const call = parseCall(props.block);
			if (call.state === "running") return h$1(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: "正在读取…"
			});
			if (call.state === "error") return h$1(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: `没有读到：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const indicators = typeof result.indicator_count === "number" ? result.indicator_count : null;
			const onboarding = objectOf(result.onboarding);
			const summary = objectOf(objectOf(result.records_summary).checkups != null ? result.records_summary : objectOf(onboarding.records).summary);
			const checkups = typeof summary.checkups === "number" ? summary.checkups : null;
			const counts = [checkups != null ? `${checkups} 次体检` : "", indicators != null ? `${indicators} 项指标` : ""].filter(Boolean).join("，");
			const changes = (Array.isArray(result.record_changes) ? result.record_changes : []).map(objectOf).filter((row) => row.ask_doctor === true);
			const failed = result.record_status === "error" || result.record_status === "partial";
			return h$1(Shell, {
				call,
				icon: "user",
				title: counts ? `已读取你的档案与记录（${counts}）` : "已读取你的档案与记录",
				quiet: true
			}, failed ? h$1("p", { className: "lp-caption lp-tool-warn" }, h$1(Icon, {
				name: "warn",
				size: 12
			}), ` 有一部分记录没有读到${typeof result.record_error === "string" && result.record_error ? `：${result.record_error}` : ""}`) : null, changes.length > 0 ? h$1("p", { className: "lp-tool-doctor" }, h$1(Icon, {
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
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "longpi-reminders",
				order: 50,
				inject: face
			}, ReminderPill));
			if (typeof ctx.inject === "function") ctx.inject([
				"remote",
				"remote.llm",
				"remote.credentials"
			], (sub) => {
				setModelProbe(sub.remote);
				sub.effect?.(() => () => setModelProbe(null), "longpi: model status");
			});
		}
		//#endregion
		exports.SETTINGS_ID = SETTINGS_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map