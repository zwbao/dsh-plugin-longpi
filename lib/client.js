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
		const h$18 = react.default.createElement;
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
			return h$18("div", {
				className: "lp-tip",
				style: {
					left,
					top: Math.max(0, tip.y - 12)
				},
				role: "status"
			}, h$18("div", { className: "lp-tip-title" }, tip.title), ...tip.rows.map((row, index) => h$18("div", {
				className: "lp-tip-row",
				key: index
			}, h$18("span", { className: "lp-tip-value" }, row.value), h$18("span", { className: "lp-tip-label" }, row.label))));
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
			if (points.length === 0) return h$18("div", {
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
			return h$18("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$18("svg", {
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
			}, ...yTicks.map((value) => h$18("g", { key: `g${value}` }, h$18("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(value),
				y2: y(value),
				className: "lp-grid"
			}), h$18("text", {
				x: pad.left - 6,
				y: y(value) + 3,
				className: "lp-axis",
				textAnchor: "end"
			}, fmt(value, value % 1 === 0 ? 0 : digits)))), props.band ? h$18("rect", {
				x: bandFrom,
				width: Math.max(0, width - pad.right - bandFrom),
				y: y(props.band.high),
				height: Math.max(1, y(props.band.low) - y(props.band.high)),
				className: "lp-band",
				rx: 3
			}) : null, props.reference ? h$18("g", null, h$18("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.reference.value),
				y2: y(props.reference.value),
				className: "lp-ref"
			}), props.compact ? null : h$18("text", {
				x: width - pad.right + 4,
				y: y(props.reference.value) + 3,
				className: "lp-axis"
			}, props.reference.label)) : null, props.goal != null ? h$18("g", null, h$18("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.goal),
				y2: y(props.goal),
				className: "lp-goal"
			}), props.compact ? null : h$18("text", {
				x: pad.left + 4,
				y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5),
				className: "lp-goal-text"
			}, `目标 ${fmt(props.goal, digits)}`)) : null, h$18("path", {
				d: area,
				className: "lp-area"
			}), h$18("path", {
				d: path,
				className: "lp-line"
			}), focus != null ? h$18("line", {
				x1: x(days[focus]),
				x2: x(days[focus]),
				y1: pad.top,
				y2: height - pad.bottom,
				className: "lp-cross"
			}) : null, ...points.map((point, index) => points.length > 24 && index !== points.length - 1 && index !== focus ? null : h$18("circle", {
				key: `p${index}`,
				cx: x(days[index]),
				cy: y(point.value),
				r: focus === index ? 5.5 : 4,
				className: "lp-dot"
			})), props.compact ? null : h$18("text", {
				x: x(days.at(-1)) + 8,
				y: y(last.value) + 4,
				className: "lp-end"
			}, `${fmt(last.value, digits)}`), props.compact ? null : h$18("text", {
				x: pad.left,
				y: height - 6,
				className: "lp-axis"
			}, monthLabel(points[0]?.date ?? "")), props.compact || points.length < 2 ? null : h$18("text", {
				x: width - pad.right,
				y: height - 6,
				className: "lp-axis",
				textAnchor: "end"
			}, monthLabel(last.date))), h$18(Tooltip, {
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
			return h$18("div", { className: "lp-timeline" }, h$18("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$18("svg", {
				width,
				height,
				role: "img",
				"aria-label": `方案时间线：${props.items.map((item) => `${item.title} ${item.start} 起`).join("，")}`
			}, ...months.filter((_, index) => index % step === 0).map((iso) => h$18("g", { key: iso }, h$18("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 20,
				y2: height - 6,
				className: "lp-grid"
			}), h$18("text", {
				x: x(dayNumber(iso)) + 3,
				y: 12,
				className: "lp-axis"
			}, monthLabel(iso)))), ...props.checkups.map((iso) => h$18("g", { key: `c${iso}` }, h$18("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 22,
				y2: height - 6,
				className: "lp-checkup"
			}), h$18("circle", {
				cx: x(dayNumber(iso)),
				cy: 22,
				r: 3,
				className: "lp-checkup-dot"
			}))), h$18("line", {
				x1: x(today),
				x2: x(today),
				y1: 16,
				y2: height - 6,
				className: "lp-today"
			}), h$18("text", {
				x: x(today) - 3,
				y: 24,
				className: "lp-axis",
				textAnchor: "end"
			}, "今天"), ...props.items.map((item, index) => {
				const y0 = top + index * row + row / 2;
				const x0 = x(dayNumber(item.start));
				const x1 = x(item.end ? Math.min(dayNumber(item.end), today) : today);
				const done = Boolean(item.end && dayNumber(item.end) < today);
				return h$18("g", {
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
				}, h$18("text", {
					x: 0,
					y: y0 + 4,
					className: "lp-row-label"
				}, item.title.length > 12 ? `${item.title.slice(0, 11)}…` : item.title), h$18("rect", {
					x: labelWidth,
					y: y0 - 12,
					width: width - labelWidth,
					height: 24,
					className: "lp-hit"
				}), h$18("rect", {
					x: x0,
					y: y0 - 5,
					width: Math.max(6, x1 - x0),
					height: 10,
					rx: 5,
					className: done ? "lp-bar-muted" : "lp-bar"
				}));
			})), h$18(Tooltip, {
				tip,
				width
			})), h$18("div", { className: "lp-legend-inline" }, h$18("span", { className: "lp-key-bar" }), "执行中", h$18("span", { className: "lp-key-dot" }), "体检日"));
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
			return h$18("div", {
				className: "lp-strip",
				style: {
					width,
					height: 79
				}
			}, h$18("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === "done").length} 天`
			}, ...props.calendar.map((day, index) => h$18("rect", {
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
			}))), h$18(Tooltip, {
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
			return h$18("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$18("svg", {
				width,
				height,
				role: "img",
				"aria-label": props.rows.map((row) => `${row.label} ${row.detail}：${fmt(row.value)}${row.unit}`).join("，")
			}, ...props.rows.map((item, index) => {
				const y0 = index * row;
				const length = Math.max(3, Math.abs(item.value) / max * barMax);
				return h$18("g", { key: item.label }, h$18("text", {
					x: 0,
					y: y0 + 14,
					className: "lp-row-label"
				}, item.label, item.detail ? h$18("tspan", {
					dx: 8,
					className: "lp-axis"
				}, item.detail) : null), h$18("path", {
					d: roundedBar(0, y0 + 22, length, 10),
					className: item.value <= 0 ? "lp-bar" : "lp-bar-muted"
				}), h$18("text", {
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
			return h$18("svg", {
				width: size,
				height: size,
				role: "img",
				"aria-label": `${props.label} ${props.value == null ? "未知" : `${Math.round(share * 100)}%`}`,
				className: "lp-ring"
			}, h$18("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-track",
				strokeWidth: stroke
			}), h$18("circle", {
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
			return h$18("details", { className: "lp-twin" }, h$18("summary", null, "表格"), h$18("table", null, h$18("caption", null, props.caption), h$18("thead", null, h$18("tr", null, ...props.head.map((cell) => h$18("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$18("tbody", null, ...props.rows.map((row, index) => h$18("tr", { key: index }, ...row.map((cell, column) => h$18("td", { key: column }, cell)))))));
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
		function pct(value) {
			return `${value > 0 ? "+" : ""}${fmt(value * 100, 0)}%`;
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
		//#region src/client/icons.ts
		const h$17 = react.default.createElement;
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
			return h$17("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: `lp-icon ${props.className ?? ""}`.trim()
			}, h$17("path", {
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
			return h$17("span", {
				className: "lp-mark",
				"aria-hidden": true
			}, h$17(Icon, {
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
			return h$17("span", { className: `lp-chip-v ${style.className}` }, h$17(Icon, {
				name: style.icon,
				size: 14
			}), label);
		}
		//#endregion
		//#region src/client/api.ts
		function api(path) {
			const token = new URLSearchParams(window.location.search).get("token");
			if (!token) return path;
			return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
		}
		async function read(res) {
			let json = null;
			try {
				json = await res.json();
			} catch {
				json = null;
			}
			if (!res.ok || json == null) {
				const problems = (json?.problems ?? []).join(" ");
				throw new Error(problems || json?.error || `HTTP ${res.status}`);
			}
			return json;
		}
		async function getJson(path) {
			return read(await fetch(api(path), { credentials: "include" }));
		}
		async function postJson(path, body) {
			return read(await fetch(api(path), {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			}));
		}
		async function deleteJson(path) {
			return read(await fetch(api(path), {
				method: "DELETE",
				credentials: "include"
			}));
		}
		function errorText(error, fallback) {
			return error instanceof Error && error.message ? error.message : fallback;
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
		function strings(value) {
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
				focus: strings(raw.focus).filter((key) => FOCUS.includes(key)),
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
					missing: strings(bio.missing)
				},
				risk: {
					status: risk.status === "ok" && riskPct != null ? "ok" : "blocked",
					risk_pct: riskPct,
					category_zh: str(risk.category_zh),
					date: strOrNull(risk.date),
					blocker_zh: str(risk.blocker_zh),
					missing_labs: strings(risk.missing_labs),
					missing_facts: strings(risk.missing_facts)
				}
			};
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
					units: strings(row.units)
				}))
			};
		}
		function planOf(raw) {
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
					done_today: row.done_today === true
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
		/** The same order the server uses, for a journey that arrives without a stage. */
		function stageOf(journey) {
			if (!journey.consent.accepted) return "consent";
			if (!journey.profile.complete) return "profile";
			if (journey.records.status !== "ok") return "records";
			if (journey.results.bioage.status !== "ok" && journey.results.risk.status !== "ok") return "first_result";
			return journey.plan.exists ? "routine" : "plan";
		}
		function normalizeJourney(input) {
			const raw = obj(input);
			if (!("stage" in raw) && !("consent" in raw) && !("profile" in raw)) throw new Error("返回的不是 LongPi 的进度数据");
			const consent = obj(raw.consent);
			const records = obj(raw.records);
			const body = {
				version: str(raw.version),
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
						"error"
					], "unconfigured"),
					error: str(records.error),
					indicator_count: num$1(records.indicator_count) ?? 0,
					full_checkups: num$1(records.full_checkups) ?? 0,
					latest_checkup: strOrNull(records.latest_checkup),
					mirobody_mounted: records.mirobody_mounted !== false
				},
				results: resultsOf(obj(raw.results)),
				addons: addonsOf(raw.addons),
				self: selfOf(obj(raw.self)),
				plan: planOf(obj(raw.plan)),
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
				followup: journeyFollowupOf(obj(raw.followup))
			};
		}
		function journeyFollowupOf(raw) {
			return {
				enabled: raw.enabled === true,
				channels: strings(raw.channels).filter((row) => row === "desktop" || row === "webhook"),
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
				markers: strings(row.markers),
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
				cautions_zh: strings(row.cautions_zh)
			};
		}
		function briefOf(raw) {
			const safety = obj(raw.safety);
			return {
				today: str(raw.today) || localToday(),
				focus: strings(raw.focus).filter((key) => FOCUS.includes(key)),
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
						cautions_zh: strings(row.cautions_zh)
					};
				}),
				safety: {
					medications: strings(safety.medications),
					notes_zh: strings(safety.notes_zh)
				},
				past_items: objects(raw.past_items).filter((row) => str(row.title)).map((row) => ({
					title: str(row.title),
					category: str(row.category),
					verdicts: strings(row.verdicts),
					adherence_pct: num$1(row.adherence_pct)
				})),
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
				basis_zh: str(row.basis_zh)
			})) : [];
			return {
				brief: briefOf(obj(raw.brief)),
				draft: draft && items.length > 0 ? {
					title: str(draft.title),
					items,
					goals,
					notes_zh: strings(draft.notes_zh)
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
		//#endregion
		//#region src/client/store.ts
		const PATHS = {
			journey: "/api/longpi/journey",
			board: "/api/longpi/board",
			tracking: "/api/longpi/tracking",
			self: "/api/longpi/self",
			planDraft: "/api/longpi/plan-draft",
			followup: "/api/longpi/followup"
		};
		/** Contract shapes are read through one normalizer each, so every surface can rely on them. */
		const SHAPE = {
			journey: normalizeJourney,
			planDraft: normalizePlanDraft,
			followup: normalizeFollowup
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
			followup: blank()
		};
		const listeners = /* @__PURE__ */ new Set();
		let version = 0;
		let timersOn = false;
		let pageUsers = 0;
		let heroShown = 0;
		let pending = null;
		function emit() {
			version += 1;
			for (const listener of listeners) listener();
		}
		function subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		function load(key, force = false) {
			const entry = entries[key];
			if (entry.inflight && !force) return entry.inflight;
			entry.seq += 1;
			const seq = entry.seq;
			entry.loading = true;
			const run = getJson(force && REFRESHABLE.includes(key) ? `${PATHS[key]}?refresh=1` : PATHS[key]).then((raw) => {
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
				await load("journey", true);
				await Promise.all(keys.filter((key) => key !== "journey").map((key) => load(key)));
				return;
			}
			await Promise.all(keys.map((key) => load(key)));
		}
		/** Call after any save: every surface refetches what it shows. */
		function notifyChanged() {
			for (const key of Object.keys(entries)) entries[key].at = 0;
			refreshAll(false);
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
		/** Fetch one resource again now (a test send adds a log row, nothing else changes). */
		function reload(key) {
			return load(key, true);
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
		* Whether the home greeting is on screen with content. The composer-dock row
		* belongs to the greeting: it shows exactly when the greeting does, so it
		* never appears under a running conversation or under DSH's own headline.
		*/
		function useHeroShown(shown) {
			react.default.useEffect(() => {
				if (!shown) return void 0;
				heroShown += 1;
				emit();
				return () => {
					heroShown -= 1;
					emit();
				};
			}, [shown]);
		}
		function useHeroShowing() {
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
			return heroShown > 0;
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
		function usePageShowing() {
			react.default.useSyncExternalStore(subscribe, () => version, () => version);
			return pageUsers > 0;
		}
		/**
		* A prompt chosen on the page, waiting for the composer dock of the chat the
		* page switches to. Old prompts are dropped so a later chat is not surprised.
		*/
		function setPendingPrompt(text) {
			pending = {
				text,
				at: Date.now()
			};
			emit();
		}
		function takePendingPrompt() {
			const current = pending;
			pending = null;
			if (!current || Date.now() - current.at > 3e4) return null;
			return current.text;
		}
		function hasPendingPrompt() {
			return pending != null;
		}
		function usePendingVersion() {
			return react.default.useSyncExternalStore(subscribe, () => version, () => version);
		}
		//#endregion
		//#region src/client/home.ts
		const h$16 = react.default.createElement;
		/** Items named in the first-result sentence; the rest are counted, not listed. */
		const ADDONS_NAMED = 3;
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
				for (let depth = 0; row && depth < 4; depth += 1) {
					const style = window.getComputedStyle(row);
					if (style.display.includes("flex") && style.flexWrap === "wrap" && !style.flexDirection.startsWith("column")) break;
					item = row;
					row = row.parentElement;
				}
				if (!row) return void 0;
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
		function Sep$1() {
			return h$16("span", {
				className: "lp-hero-sep",
				"aria-hidden": true
			}, "·");
		}
		function Go(props) {
			return h$16("button", {
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
				h$16("b", { key: "b" }, `${fmt(bioage.phenoage)} 岁`),
				versusAge(bioage.advance) ? `，${versusAge(bioage.advance)}` : ""
			] : null;
			const heart = risk.status === "ok" && risk.risk_pct != null ? [
				"心血管 10 年风险 ",
				h$16("b", { key: "b" }, `${riskText(risk.risk_pct)}%`),
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
			let estimate = false;
			if (journey.stage === "consent" || journey.stage === "profile") parts.push("花 2 分钟建档，算出你的身体年龄和心血管风险", h$16(Sep$1, { key: "s" }), h$16(Go, {
				key: "go",
				label: "开始建档",
				onClick: open
			}));
			else if (journey.stage === "records") parts.push(journey.records.status === "error" ? "体检记录读取失败，暂时算不出结果" : "连接体检记录后，就能算出你的身体年龄", h$16(Sep$1, { key: "s" }), h$16(Go, {
				key: "go",
				label: journey.records.status === "error" ? "查看原因" : "怎么连接",
				onClick: open
			}));
			else if (journey.stage === "first_result" && journey.addons.length > 0) {
				const named = journey.addons.slice(0, ADDONS_NAMED).map((row) => row.item_zh).join("、");
				const more = journey.addons.length > ADDONS_NAMED ? " 等" : "";
				parts.push("还差 ", h$16("b", { key: "n" }, `${journey.addons.length} 项检查`), `就能算出${joinUnlocks(journey)}：${named}${more}`, h$16(Sep$1, { key: "s" }), h$16(Go, {
					key: "go",
					label: "加测清单",
					onClick: open
				}));
			} else {
				const rows = journey.stage === "first_result" ? [] : figures(journey);
				if (rows.length > 0) {
					estimate = true;
					rows.forEach((row, index) => {
						if (index > 0) parts.push(h$16(Sep$1, { key: `s${index}` }));
						parts.push(h$16(react.default.Fragment, { key: `f${index}` }, ...row));
					});
				} else {
					const detail = journey.next.detail_zh || journey.results.risk.blocker_zh || journey.results.bioage.blocker_zh || "打开健康页看看还缺什么";
					parts.push(detail, h$16(Sep$1, { key: "s" }), h$16(Go, {
						key: "go",
						label: journey.next.action === "profile" ? "去填写" : "健康页",
						onClick: open
					}));
				}
			}
			return h$16("p", { className: "lp-hero-status" }, ...parts, estimate ? h$16("span", {
				className: "lp-hero-est",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计") : null);
		}
		function Hero(props) {
			const ref = react.default.useRef(null);
			useOwnRow(ref);
			return h$16("div", {
				ref,
				className: "lp lp-hero",
				role: "group",
				"aria-label": "LongPi"
			}, h$16("div", { className: "lp-hero-title" }, h$16("span", {
				className: "lp-hero-mark",
				"aria-hidden": true
			}, h$16(Icon, {
				name: "pulse",
				size: 16,
				strokeWidth: 1.8
			})), h$16("span", null, titleOf(props.journey))), h$16(Status, {
				journey: props.journey,
				open: props.open
			}));
		}
		function HomeHero(props) {
			const { journey } = useJourney();
			useHeroShown(journey != null);
			if (!journey) return null;
			return h$16(Hero, {
				journey,
				open: () => props.openPage?.()
			});
		}
		//#endregion
		//#region src/client/ui.ts
		const h$15 = react.default.createElement;
		function Section(props) {
			const headingId = props.id ? `${props.id}-title` : void 0;
			return h$15("section", {
				className: `lp-section ${props.className ?? ""}`.trim(),
				id: props.id,
				"aria-labelledby": headingId
			}, h$15("div", { className: "lp-section-head" }, h$15("div", { className: "lp-section-titles" }, props.kicker ? h$15("div", { className: "lp-kicker" }, props.kicker) : null, h$15("h2", {
				className: "lp-h2",
				id: headingId
			}, props.title)), props.aside ?? null), props.children);
		}
		function Skeleton(props) {
			return h$15("div", {
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
			return h$15(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				size: "md",
				...props
			});
		}
		/** A download link dressed as a DSH outline button (a real <a>, so the browser saves it). */
		function LinkButton(props) {
			return h$15("a", {
				className: "lp-linkbtn",
				href: api(props.href),
				download: props.download ?? true
			}, props.icon ? h$15(Icon, {
				name: props.icon,
				size: 14
			}) : null, props.children);
		}
		/** A radio group drawn as a segmented control. Nothing selected means "not answered". */
		function Segmented(props) {
			const labelId = `${props.name}-label`;
			return h$15("div", { className: "lp-seg-wrap" }, h$15("span", {
				id: labelId,
				className: props.hideLabel ? "lp-sr" : "lp-field-label"
			}, props.label), h$15("div", {
				className: "lp-seg",
				role: "radiogroup",
				"aria-labelledby": labelId
			}, ...props.options.map((option) => h$15("label", {
				key: option.value,
				className: `lp-seg-opt ${props.value === option.value ? "lp-seg-on" : ""}`
			}, h$15("input", {
				type: "radio",
				name: props.name,
				value: option.value,
				checked: props.value === option.value,
				disabled: props.disabled,
				onChange: () => props.onChange(option.value)
			}), h$15("span", null, option.label)))));
		}
		function ToggleChip(props) {
			return h$15("button", {
				type: "button",
				className: `lp-toggle ${props.pressed ? "lp-toggle-on" : ""}`,
				"aria-pressed": props.pressed,
				onClick: props.onClick
			}, props.badge ? h$15("span", {
				className: "lp-toggle-badge",
				"aria-hidden": true
			}, props.badge) : null, props.children);
		}
		/** An on/off switch: a real button with role=switch, labelled by its visible text. */
		function Switch(props) {
			return h$15("button", {
				type: "button",
				role: "switch",
				id: props.id,
				"aria-checked": props.checked,
				"aria-busy": props.busy || void 0,
				disabled: props.disabled,
				className: `lp-switch ${props.checked ? "lp-switch-on" : ""}`,
				onClick: () => props.onChange(!props.checked)
			}, h$15("span", {
				className: "lp-switch-track",
				"aria-hidden": true
			}, h$15("span", { className: "lp-switch-thumb" })), h$15("span", { className: "lp-switch-label" }, props.label));
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
			return [notice ? h$15("div", {
				className: `lp-notice lp-notice-${notice.tone}`,
				role: "status"
			}, h$15(Icon, {
				name: notice.tone === "good" ? "check" : notice.tone === "bad" ? "info" : "info",
				size: 14
			}), h$15("span", null, notice.text), h$15("button", {
				type: "button",
				className: "lp-notice-x",
				"aria-label": "关闭提示",
				onClick: () => setNotice(null)
			}, h$15(Icon, {
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
		//#endregion
		//#region src/client/plan-draft.ts
		const h$14 = react.default.createElement;
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
		* drops every item that stood behind a goal, the goal goes too; a goal no item
		* names (the server's own call) is kept.
		*/
		function keptGoals(draft, kept) {
			return draft.goals.filter((goal) => !covers(draft.items, goal) || covers(kept, goal));
		}
		function Evidence(props) {
			const evidence = props.item.evidence;
			const population = evidence.population && !/[（(]/.test(evidence.expected_zh) ? evidence.population : "";
			return h$14("p", { className: "lp-evidence" }, h$14(Icon, {
				name: "flask",
				size: 13
			}), h$14("span", null, evidence.expected_zh || "有研究证据支持", population ? `（${population}）` : "", evidence.doi ? h$14(react.default.Fragment, null, " · ", h$14("a", {
				href: `https://doi.org/${evidence.doi}`,
				target: "_blank",
				rel: "noreferrer"
			}, `doi:${evidence.doi}`)) : null, evidence.verified ? "" : " · 数据待核对"));
		}
		function DraftItemCard(props) {
			const item = props.item;
			const warn = item.needs_doctor || item.cautions_zh.length > 0;
			return h$14("li", { className: "lp-draft-item" }, h$14("div", { className: "lp-draft-item-head" }, h$14("div", { className: "lp-draft-item-title" }, item.category_zh ? h$14("span", { className: "lp-cat" }, item.category_zh) : null, h$14("span", { className: "lp-strong" }, item.title)), h$14("button", {
				type: "button",
				className: "lp-draft-remove",
				onClick: props.onRemove,
				"aria-label": `去掉「${item.title}」`
			}, h$14(Icon, {
				name: "close",
				size: 12
			}), "去掉")), behaviorOf(item) ? h$14("p", { className: "lp-draft-detail" }, behaviorOf(item)) : null, item.target ? h$14("p", { className: "lp-caption lp-draft-target" }, h$14(Icon, {
				name: "check",
				size: 12
			}), " ", targetText(item.target)) : null, h$14(Evidence, { item }), warn ? h$14("div", { className: "lp-draft-warn" }, item.needs_doctor ? h$14("span", { className: "lp-warn-tag" }, h$14(Icon, {
				name: "warn",
				size: 12
			}), "需先与医生确认") : h$14(Icon, {
				name: "warn",
				size: 14,
				className: "lp-warn-icon"
			}), ...item.cautions_zh.map((text) => h$14("span", {
				key: text,
				className: "lp-warn-text"
			}, text))) : null);
		}
		function Priorities(props) {
			const rows = props.brief.priorities;
			if (rows.length === 0) return null;
			return h$14("div", { className: "lp-draft-block" }, h$14("div", { className: "lp-subhead" }, "为什么先改善这些", h$14("span", { className: "lp-optional" }, "按重要性排列")), h$14("ol", { className: "lp-priorities" }, ...rows.map((row, index) => h$14("li", {
				key: `${row.marker_key}-${index}`,
				className: "lp-priority"
			}, h$14("div", { className: "lp-priority-head" }, h$14("span", { className: "lp-strong" }, row.label_zh), row.value != null ? h$14("span", { className: "lp-num" }, `${num(row.value)} ${row.unit}`) : null), h$14("div", { className: "lp-caption" }, [row.why_zh, row.date ? `${chineseDate(row.date)}的记录` : ""].filter(Boolean).join(" · "))))));
		}
		function Goals$1(props) {
			if (props.goals.length === 0 && props.dropped === 0) return null;
			return h$14("div", { className: "lp-draft-block" }, h$14("div", { className: "lp-subhead" }, "目标", h$14("span", { className: "lp-optional" }, "模型估计")), props.goals.length > 0 ? h$14("ul", { className: "lp-rows lp-draft-goals" }, ...props.goals.map((goal) => h$14("li", {
				key: goal.marker,
				className: "lp-row"
			}, h$14("span", { className: "lp-row-main" }, h$14("span", { className: "lp-strong" }, goal.marker), h$14("span", { className: "lp-caption" }, `  ${goal.basis_zh}`)), h$14("span", { className: "lp-row-end lp-num" }, `${num(goal.value)} ${goal.unit}`)))) : null, props.dropped > 0 ? h$14("p", { className: "lp-fine" }, `去掉的项目对应的 ${props.dropped} 个目标也不会保存。`) : null);
		}
		function ConfirmModal(props) {
			const doctor = props.items.filter((item) => item.needs_doctor);
			return h$14(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "采用这份方案",
				onClose: props.busy ? () => {} : props.onCancel,
				headless: true,
				className: "lp-confirm-dialog"
			}, h$14("div", { className: "lp lp-confirm" }, h$14("h2", { className: "lp-onb-title" }, "采用这份方案？"), h$14("p", { className: "lp-muted lp-confirm-lead" }, `保存为你的方案「${props.draft.title || "改善方案"}」，从今天（${chineseDate(props.today)}）开始。之后按项目打卡，并按每个指标安排复测；想调整随时在对话里说。`), h$14("ul", { className: "lp-confirm-list" }, ...props.items.map((item) => h$14("li", { key: item.id }, item.category_zh ? h$14("span", { className: "lp-cat" }, item.category_zh) : null, h$14("span", null, item.title), item.needs_doctor ? h$14("span", { className: "lp-warn-tag" }, "需先与医生确认") : null))), props.goals.length > 0 ? h$14("p", { className: "lp-caption" }, `目标：${props.goals.map((goal) => `${goal.marker} ${num(goal.value)} ${goal.unit}`).join("、")}（按试验平均效应估算，不是个人预测）`) : null, doctor.length > 0 ? h$14("p", { className: "lp-blocker lp-blocker-bad lp-confirm-doctor" }, `${doctor.map((item) => `「${item.title}」`).join("")}需先与医生确认后再开始。方案里不含任何剂量。`) : null, props.error ? h$14("p", {
				className: "lp-form-error",
				role: "alert"
			}, props.error) : null, h$14("div", { className: "lp-modal-actions" }, h$14(Btn, {
				variant: "outline",
				onClick: props.onCancel,
				disabled: props.busy
			}, "再想想"), h$14(Btn, {
				"data-modal-autofocus": true,
				onClick: props.onConfirm,
				disabled: props.busy
			}, props.busy ? "保存中…" : "确认采用"))));
		}
		function Hint(props) {
			return h$14("span", { className: "lp-caption lp-draft-hint" }, "想调整？在对话中说", h$14("button", {
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
			const gone = draft.items.filter((item) => removed.has(item.id));
			const goals = keptGoals(draft, kept);
			const toggle = (id) => setRemoved((current) => {
				const next = new Set(current);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
			async function accept() {
				setBusy(true);
				setError(null);
				try {
					const result = await postJson("/api/longpi/plan-draft/accept", { draft: {
						...draft,
						items: kept,
						goals
					} });
					if (!result.ok) {
						setError(`没有保存：${(result.problems ?? []).join(" ") || result.error || "请稍后再试"}`);
						return;
					}
					setConfirming(false);
					props.onNotice(`已保存为方案第 ${result.plan.version} 版，共 ${result.plan.items} 项。`, "good");
					notifyChanged();
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$14("div", { className: "lp-card lp-draft" }, h$14("div", { className: "lp-draft-head" }, h$14("div", null, h$14("div", { className: "lp-kicker" }, "方案草稿 · 还没有保存"), h$14("h3", { className: "lp-h3 lp-draft-title" }, draft.title || "改善方案"), h$14("p", { className: "lp-muted" }, "LongPi 按你的检查结果和研究证据起草。每一项都注明试验里的平均效果，个人结果会不同；你确认后才保存。")), h$14("span", { className: "lp-tag" }, "草稿")), h$14(Priorities, { brief: data.brief }), h$14("div", { className: "lp-draft-block" }, h$14("div", { className: "lp-subhead" }, `建议的做法（${kept.length} 项）`), kept.length > 0 ? h$14("ul", { className: "lp-draft-items" }, ...kept.map((item) => h$14(DraftItemCard, {
				key: item.id,
				item,
				onRemove: () => toggle(item.id)
			}))) : h$14("p", { className: "lp-muted" }, "所有项目都去掉了。恢复一项，或在对话里说说你想怎么调整。"), gone.length > 0 ? h$14("div", { className: "lp-draft-removed" }, h$14("span", { className: "lp-caption" }, "已去掉："), ...gone.map((item) => h$14("button", {
				key: item.id,
				type: "button",
				className: "lp-toggle",
				onClick: () => toggle(item.id),
				"aria-label": `恢复「${item.title}」`
			}, h$14(Icon, {
				name: "plus",
				size: 12
			}), item.title))) : null), h$14(Goals$1, {
				goals,
				dropped: draft.goals.length - goals.length
			}), ...draft.notes_zh.map((text) => h$14("p", {
				key: text,
				className: "lp-fine"
			}, text)), h$14("div", { className: "lp-form-actions lp-draft-actions" }, h$14(Btn, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$14(Hint, { onPrompt: props.onPrompt })), h$14("p", { className: "lp-fine" }, data.brief.boundary_zh || "只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。"), confirming ? h$14(ConfirmModal, {
				draft,
				items: kept,
				goals,
				today: props.journey.today,
				busy,
				error,
				onCancel: () => setConfirming(false),
				onConfirm: () => {
					accept();
				}
			}) : null);
		}
		/** The plan section's empty state: the draft, or why there is none yet. */
		function PlanDraftCard(props) {
			const { data, loading, error } = usePlanDraft();
			if (!data && loading) return h$14("div", {
				className: "lp-card lp-draft",
				"aria-busy": true
			}, h$14("div", { className: "lp-kicker" }, "方案草稿"), h$14("p", { className: "lp-caption" }, "正在按你的结果和研究证据起草…"), h$14(Skeleton, { height: 72 }), h$14("div", { style: { height: 10 } }), h$14(Skeleton, { height: 72 }));
			if (!data) return h$14("div", { className: "lp-card lp-draft" }, h$14("div", { className: "lp-kicker" }, "方案草稿"), h$14("p", { className: "lp-muted" }, `没能读到方案草稿：${error ?? "没有返回"}。`), h$14("div", { className: "lp-form-actions" }, h$14(Hint, { onPrompt: props.onPrompt })));
			if (!data.draft) {
				const why = [...data.brief.safety.notes_zh, data.brief.boundary_zh].filter(Boolean);
				return h$14("div", { className: "lp-card lp-draft" }, h$14("div", { className: "lp-kicker" }, "方案草稿"), h$14("h3", { className: "lp-h3 lp-draft-title" }, "现在还起草不了方案"), h$14("p", { className: "lp-muted" }, why[0] || "你的记录里还没有能对上研究证据的指标。"), ...why.slice(1).map((text) => h$14("p", {
					key: text,
					className: "lp-fine"
				}, text)), h$14(Priorities, { brief: data.brief }), h$14("div", { className: "lp-form-actions lp-draft-actions" }, h$14(Hint, { onPrompt: props.onPrompt })));
			}
			return h$14(Draft, {
				data,
				draft: data.draft,
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			});
		}
		//#endregion
		//#region src/client/plan.ts
		const h$13 = react.default.createElement;
		/** Check-ins are shared by the today tile and the item cards, so both flip at once. */
		function useCheckIn(onNotice) {
			const [done, setDone] = react.default.useState(/* @__PURE__ */ new Set());
			const [busy, setBusy] = react.default.useState(null);
			return {
				done,
				busy,
				checkIn: react.default.useCallback((id, title) => {
					setBusy(id);
					postJson("/api/longpi/checkin", {
						item: id,
						done: true
					}).then(() => {
						setDone((current) => new Set(current).add(id));
						onNotice(`已记下：${title}，今天完成。`, "good");
						notifyChanged();
					}).catch((err) => onNotice(`没有记下：${errorText(err, "请稍后再试")}`, "bad")).finally(() => setBusy(null));
				}, [onNotice])
			};
		}
		function TodayTile(props) {
			const items = props.journey.plan.checkin_items;
			const finished = items.filter((row) => row.done_today || props.done.has(row.id)).length;
			return h$13("div", { className: "lp-card lp-tile lp-tile-today" }, h$13("div", { className: "lp-tile-head" }, h$13("div", { className: "lp-label" }, "今天"), items.length > 0 ? h$13("span", { className: "lp-caption" }, `${finished}/${items.length} 完成`) : null), items.length === 0 ? h$13("p", { className: "lp-muted" }, "今天没有需要打卡的项目，手环和 Mirobody 记录的会自动计入。") : h$13("ul", { className: "lp-today-list" }, ...items.map((row) => {
				const isDone = row.done_today || props.done.has(row.id);
				return h$13("li", {
					key: row.id,
					className: `lp-today-row ${isDone ? "lp-today-done" : ""}`
				}, h$13("span", { className: "lp-today-title" }, row.title), isDone ? h$13("span", { className: "lp-done-label" }, h$13(Icon, {
					name: "check",
					size: 14
				}), "已完成") : h$13(Btn, {
					size: "sm",
					variant: "outline",
					disabled: props.busy === row.id,
					onClick: () => props.onCheckIn(row.id, row.title)
				}, props.busy === row.id ? "记录中" : "今天完成了"));
			})), h$13("p", { className: "lp-fine" }, "也可以在对话里说一句“今天的方案我都完成了”。"));
		}
		function AdherenceTile(props) {
			const items = props.tracking?.items ?? [];
			const known = items.filter((item) => item.adherence && item.adherence.level !== "unknown" && item.adherence.rate != null);
			const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null;
			const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback;
			const streak = props.journey.plan.streak || Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0));
			return h$13("div", { className: "lp-card lp-tile" }, h$13("div", { className: "lp-label" }, "方案执行"), h$13("div", { className: "lp-tile-row" }, h$13(Ring, {
				value: rate,
				label: "方案平均执行率",
				size: 56
			}), h$13("div", null, h$13("div", { className: "lp-tile-figure" }, rate == null ? "—" : `${Math.round(rate * 100)}%`), h$13("div", { className: "lp-caption" }, rate == null ? "还没有执行记录" : "近 12 周平均"))), streak > 1 ? h$13("div", { className: "lp-streak" }, h$13(Icon, {
				name: "flame",
				size: 15
			}), `连续 ${streak} 天`) : h$13("div", { className: "lp-caption lp-streak-empty" }, "连续完成两天以上会在这里显示"));
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
			return h$13("div", { className: "lp-card lp-tile" }, h$13("div", { className: "lp-label" }, "下次复测"), now.length > 0 ? h$13("div", null, h$13("div", { className: "lp-tile-figure" }, "现在"), h$13("div", { className: "lp-caption" }, `可以复测${now.map((row) => row.marker).slice(0, 3).join("、")}`)) : first ? h$13("div", null, h$13("div", { className: "lp-tile-figure" }, `${daysBetween(props.today, first.date)} 天后`), h$13("div", { className: "lp-caption" }, `${chineseDate(first.date)}之后 · ${first.marker}`)) : h$13("div", null, h$13("div", { className: "lp-tile-figure lp-muted-ink" }, "—"), h$13("div", { className: "lp-caption" }, "保存方案后按指标排复测日")), h$13("p", { className: "lp-fine" }, h$13(Icon, {
				name: "calendar",
				size: 13
			}), " 复测太早，变化多半只是波动。"));
		}
		function Wins(props) {
			const items = props.tracking?.items ?? [];
			if (!props.tracking?.plan) return null;
			const wins = items.flatMap((item) => (item.verdicts ?? []).filter((row) => row.verdict === "有效").map((row) => ({
				item,
				row
			})));
			if (wins.length === 0) return h$13("div", { className: "lp-card lp-wins lp-wins-empty" }, h$13("span", { className: "lp-win-icon lp-win-icon-quiet" }, h$13(Icon, {
				name: "spark",
				size: 16
			})), h$13("div", null, h$13("div", { className: "lp-strong" }, "还没有超出波动的改善"), h$13("div", { className: "lp-muted" }, "血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。")));
			return h$13("div", { className: "lp-card lp-wins" }, h$13("div", { className: "lp-label" }, "真实的改善"), ...wins.map(({ item, row }, index) => h$13("div", {
				className: "lp-win",
				key: index,
				style: { animationDelay: `${index * 80}ms` }
			}, h$13("span", { className: "lp-win-icon" }, h$13(Icon, {
				name: "check",
				size: 16
			})), h$13("div", null, h$13("div", { className: "lp-strong" }, `${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ""}`), h$13("div", { className: "lp-muted" }, `${item.title} · ${row.change ? pct(row.change.pct) : ""} · 超出个体正常波动`, (row.combined_with ?? []).length > 0 ? `（与${(row.combined_with ?? []).join("、")}共同作用）` : "")))));
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
			return h$13("article", { className: "lp-card lp-item" }, h$13("div", { className: "lp-item-head" }, h$13("div", null, item.category_zh ? h$13("span", { className: "lp-cat" }, item.category_zh) : null, h$13("h3", { className: "lp-h3" }, item.title), h$13("div", { className: "lp-caption" }, `${item.start} 起 · 第 ${item.days ?? 0} 天`)), item.headline ? h$13(VerdictChip, { verdict: item.headline }) : null), h$13("div", { className: "lp-item-adherence" }, h$13("div", null, h$13("div", { className: "lp-caption" }, "近 12 周执行"), h$13("div", { className: "lp-item-figure" }, rate == null || adherence.level === "unknown" ? "记录不足" : `${Math.round(rate * 100)}%`), adherence.note_zh ? h$13("div", { className: "lp-fine lp-fine-tight" }, adherence.note_zh) : null), (adherence.calendar ?? []).length > 0 ? h$13(AdherenceStrip, {
				calendar: adherence.calendar ?? [],
				label: item.title
			}) : null), ...(item.verdicts ?? []).map((row, index) => h$13("div", {
				className: "lp-verdict",
				key: index
			}, h$13("div", { className: "lp-verdict-head" }, h$13(VerdictChip, { verdict: row.verdict }), h$13("span", { className: "lp-strong" }, row.marker), row.baseline && row.followup ? h$13("span", { className: "lp-num" }, `${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ""}${row.change ? `（${pct(row.change.pct)}）` : ""}`) : null), h$13("p", { className: "lp-reason" }, row.reason_zh ?? ""), (row.expected ?? []).length > 0 ? h$13("details", { className: "lp-expected" }, h$13("summary", null, "试验里平均能改变多少"), ...(row.expected ?? []).map((line) => h$13("p", {
				key: line.id,
				className: "lp-fine"
			}, line.text_zh, line.comparison && line.comparison !== "not_comparable" ? `你的变化${{
				consistent: "与试验平均一致",
				smaller: "小于试验平均",
				larger: "大于试验平均",
				opposite: "方向与试验相反"
			}[line.comparison] ?? ""}。` : "", ` doi:${line.doi}`))) : null)), h$13("div", { className: "lp-item-foot" }, idle ? h$13("span", { className: "lp-caption" }, idle) : source === "checkin" ? props.done ? h$13("span", { className: "lp-done-label lp-pop" }, h$13(Icon, {
				name: "check",
				size: 14
			}), "今天已完成") : h$13(Btn, {
				size: "sm",
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onCheckIn(item.id, item.title)
			}, h$13(Icon, {
				name: "check",
				size: 14
			}), "今天完成了") : h$13("span", { className: "lp-caption" }, source === "wearable" ? "手环自动记录，不用打卡" : "服用情况在 Mirobody 里打卡")));
		}
		/** Stage plan, next to the draft: the person may bring their own plan instead. */
		function PlanStart(props) {
			return h$13("div", { className: "lp-card lp-plan-start" }, h$13("div", { className: "lp-plan-start-text" }, h$13("h3", { className: "lp-h3" }, "已经有自己的方案？"), h$13("p", { className: "lp-muted" }, "说出你的方案，或上传医生、长寿师给的方案。LongPi 会读给你确认后保存，再按每个指标安排复测日，并算出达到目标时的模型估计。"), h$13("p", { className: "lp-fine" }, "LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。")), h$13("div", { className: "lp-prompts" }, ...props.journey.suggestions.map((row) => h$13("button", {
				key: row.id,
				type: "button",
				className: "lp-prompt",
				onClick: () => props.onPrompt(row.text_zh)
			}, h$13("span", null, row.text_zh), h$13(Icon, {
				name: "arrow",
				size: 14
			})))));
		}
		function PlanSection(props) {
			const { done, busy, checkIn } = useCheckIn(props.onNotice);
			const tracking = props.tracking;
			const today = props.journey.today;
			if (!props.journey.plan.exists && !tracking?.plan) return h$13(Section, {
				id: "lp-plan",
				title: "我的方案",
				kicker: "干预"
			}, h$13(PlanDraftCard, {
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			}), h$13(PlanStart, {
				journey: props.journey,
				onPrompt: props.onPrompt
			}));
			if (props.loading && !tracking) return h$13(Section, {
				id: "lp-plan",
				title: props.journey.plan.title || "我的方案",
				kicker: "我的方案"
			}, h$13(Skeleton, { height: 260 }));
			const plan = tracking?.plan;
			const items = tracking?.items ?? [];
			const checkups = [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))];
			const doneIds = /* @__PURE__ */ new Set([...done, ...props.journey.plan.checkin_items.filter((row) => row.done_today).map((row) => row.id)]);
			const days = props.journey.plan.days;
			return h$13(Section, {
				id: "lp-plan",
				title: plan?.title || props.journey.plan.title,
				kicker: `我的方案 · 第 ${plan?.version ?? props.journey.plan.version ?? 1} 版`,
				aside: h$13("span", { className: "lp-caption" }, [
					`${items.length || props.journey.plan.items} 项`,
					props.journey.plan.started ? `${chineseDate(props.journey.plan.started)}起` : "",
					days != null ? `第 ${days} 天` : ""
				].filter(Boolean).join(" · "))
			}, h$13("div", { className: "lp-tiles" }, h$13(TodayTile, {
				journey: props.journey,
				done,
				busy,
				onCheckIn: checkIn
			}), h$13(AdherenceTile, {
				journey: props.journey,
				tracking
			}), h$13(RetestTile, {
				tracking,
				today
			})), h$13(Wins, { tracking }), items.length > 0 ? h$13("div", { className: "lp-card lp-timeline-card" }, h$13("div", { className: "lp-label" }, "时间线"), h$13(Timeline, {
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
			})) : null, items.length > 0 ? h$13("div", { className: "lp-grid-items" }, ...items.map((item) => h$13(ItemCard, {
				key: item.id,
				item,
				raw: plan?.items.find((raw) => raw.id === item.id),
				today,
				onCheckIn: checkIn,
				busy: busy === item.id,
				done: doneIds.has(item.id)
			}))) : null);
		}
		function Markers(props) {
			const charts = props.tracking?.charts ?? [];
			if (charts.length === 0) return null;
			const verdictOf = (indicator) => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? []).find((row) => row.indicator === indicator && row.verdict !== "无法判断");
			return h$13(Section, {
				id: "lp-markers",
				title: "指标变化",
				kicker: "对照正常波动"
			}, h$13("div", { className: "lp-grid-charts" }, ...charts.map((chart) => {
				const verdict = verdictOf(chart.indicator);
				const digits = Math.max(...chart.points.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
				return h$13("figure", {
					className: "lp-card lp-figure",
					key: chart.indicator
				}, h$13("div", { className: "lp-figure-head" }, h$13("figcaption", null, h$13("span", { className: "lp-strong" }, chart.label), h$13("span", { className: "lp-caption" }, ` ${chart.unit}`)), verdict ? h$13(VerdictChip, { verdict: verdict.verdict }) : null), h$13(LineChart, {
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
				}), h$13("p", { className: "lp-fine" }, chart.band ? `浅色带：以 ${chart.band.base_date} 的 ${fmt(chart.band.base, 2)} 为基线的正常波动范围${chart.band.verified === false ? "（变异数据待核对）" : ""}。落在带外才算真实变化。` : "缺少这项的个体变异数据，分不清真实变化和波动。"), h$13(TableTwin, {
					caption: `${chart.label}（${chart.unit}）`,
					head: ["日期", "数值"],
					rows: chart.points.map((point) => [point.date, fmt(point.value, digits)])
				}));
			})));
		}
		//#endregion
		//#region src/client/home-actions.ts
		const h$12 = react.default.createElement;
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
		function Sep() {
			return h$12("span", {
				className: "lp-row-sep",
				"aria-hidden": true
			}, "·");
		}
		function retestText(date, what, today) {
			return date <= today ? `可以${what}了` : `${chineseDate(date)}可${what}`;
		}
		/** The retest part of the row, with the separators around it (the page link always follows). */
		function RetestPart(props) {
			if (!props.text) return props.before ? h$12(Sep) : null;
			return h$12(react.default.Fragment, null, props.before ? h$12(Sep) : null, h$12("span", null, props.text), h$12(Sep));
		}
		/** Retest dates beyond the journey's 7-day reminder window live only in tracking; read it just for this line. */
		function LaterRetest(props) {
			const next = retestDates(useTracking().data)[0];
			return h$12(RetestPart, {
				text: next ? retestText(next.date, `复测${next.marker}`, props.today) : null,
				before: props.before
			});
		}
		function RoutineRow(props) {
			const { journey } = props;
			const [done, setDone] = react.default.useState(/* @__PURE__ */ new Set());
			const [busy, setBusy] = react.default.useState(null);
			const [failed, setFailed] = react.default.useState(null);
			const items = journey.plan.checkin_items;
			const reminder = journey.reminders.filter((row) => row.kind === "retest" && row.date).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0];
			const checkIn = (id, title) => {
				setBusy(id);
				setFailed(null);
				postJson("/api/longpi/checkin", {
					item: id,
					done: true
				}).then(() => {
					setDone((current) => new Set(current).add(id));
					notifyChanged();
				}).catch((err) => setFailed(`没有记下「${title}」：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(null));
			};
			const lead = items.map((row) => {
				const isDone = row.done_today || done.has(row.id);
				return h$12("button", {
					key: row.id,
					type: "button",
					className: `lp-task ${isDone ? "lp-task-done" : ""}`,
					"aria-pressed": isDone,
					disabled: busy === row.id,
					title: isDone ? "今天已完成" : "点一下记为今天完成",
					onClick: isDone || busy ? void 0 : () => checkIn(row.id, row.title)
				}, h$12("span", {
					className: "lp-task-ring",
					"aria-hidden": true
				}, isDone ? h$12(Icon, {
					name: "check",
					size: 10,
					strokeWidth: 2.4
				}) : null), row.title);
			});
			if (items.length === 0 && journey.next.detail_zh) lead.push(h$12("span", { key: "next" }, journey.next.detail_zh));
			return h$12("div", {
				className: "lp lp-home-row",
				role: "group",
				"aria-label": "LongPi 今天"
			}, ...lead, reminder?.date ? h$12(RetestPart, {
				text: retestText(reminder.date, reminder.text_zh, journey.today),
				before: lead.length > 0
			}) : h$12(LaterRetest, {
				today: journey.today,
				before: lead.length > 0
			}), h$12("button", {
				type: "button",
				className: "lp-row-link",
				onClick: props.openPage
			}, "健康页 →"), failed || props.note ? h$12("span", {
				className: "lp-row-note",
				role: "status"
			}, failed ?? props.note) : null);
		}
		function HomeActions(props) {
			const { journey } = useJourney();
			const heroShowing = useHeroShowing();
			const pending = usePendingVersion();
			const [note, setNote] = react.default.useState(null);
			const latest = react.default.useRef(props);
			latest.current = props;
			const place = react.default.useCallback((text) => {
				if (insertInto(latest.current, text)) {
					setNote(null);
					return;
				}
				copyText(text).then((copied) => setNote(copied ? "没能放进输入框，已复制，粘贴即可" : "没能放进输入框，请手动输入"));
			}, []);
			react.default.useEffect(() => {
				if (!hasPendingPrompt()) return;
				const text = takePendingPrompt();
				if (text) place(text);
			}, [pending, place]);
			react.default.useEffect(() => {
				if (!note) return void 0;
				const timer = window.setTimeout(() => setNote(null), 4e3);
				return () => window.clearTimeout(timer);
			}, [note]);
			if (!heroShowing || !journey) return null;
			if (journey.stage === "routine") return h$12(RoutineRow, {
				journey,
				openPage: () => props.openPage?.(),
				note
			});
			const suggestions = journey.suggestions.slice(0, 2);
			if (suggestions.length === 0) return null;
			return h$12("div", {
				className: "lp lp-home-row",
				role: "group",
				"aria-label": "LongPi 建议的问题"
			}, ...suggestions.map((row) => h$12("button", {
				key: row.id,
				type: "button",
				className: "lp-suggest",
				title: "放进输入框",
				onClick: () => place(row.text_zh)
			}, row.text_zh)), note ? h$12("span", {
				className: "lp-row-note",
				role: "status"
			}, note) : null);
		}
		//#endregion
		//#region src/client/followup.ts
		const h$11 = react.default.createElement;
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
		function problemOf(form, settings) {
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
			return h$11("div", { className: "lp-field" }, h$11("label", {
				className: "lp-field-label",
				htmlFor: props.id
			}, props.label, props.hint ? h$11("span", { className: "lp-optional" }, props.hint) : null), h$11("input", {
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
			return h$11("label", {
				className: `lp-check ${props.disabled ? "lp-check-off" : ""}`,
				htmlFor: props.id
			}, h$11("input", {
				id: props.id,
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled,
				onChange: (event) => props.onChange(event.target.checked)
			}), h$11("span", null, props.children));
		}
		function channelsText(row) {
			const out = [];
			if (row.channels.desktop != null) out.push(`桌面${row.channels.desktop ? "" : " 失败"}`);
			if (row.channels.webhook != null) out.push(`Webhook${row.channels.webhook ? "" : " 失败"}`);
			return out.join("、");
		}
		function Log(props) {
			const rows = [...props.rows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
			return h$11("div", { className: "lp-followup-log" }, h$11("div", { className: "lp-subhead" }, "最近发送", h$11("span", { className: "lp-optional" }, rows.length > 0 ? `最近 ${rows.length} 条` : "")), rows.length === 0 ? h$11("p", { className: "lp-caption" }, "还没有发过提醒。") : h$11("ul", { className: "lp-rows" }, ...rows.map((row, index) => h$11("li", {
				key: `${row.at}-${index}`,
				className: "lp-row"
			}, h$11("span", { className: "lp-row-main" }, h$11("span", { className: "lp-num" }, whenText(row.at)), "  ", h$11("span", null, LOG_ZH[row.kind] ?? row.kind), row.error ? h$11("span", { className: "lp-caption" }, `  ${row.error}`) : null), h$11("span", { className: "lp-row-end" }, channelsText(row) ? h$11("span", { className: "lp-caption" }, channelsText(row)) : null, h$11("span", { className: `lp-sent ${row.ok ? "lp-sent-ok" : "lp-sent-bad"}` }, h$11(Icon, {
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
			if (rows.length === 0) return h$11("span", {
				className: "lp-caption",
				role: "status"
			}, "没有可用的渠道：打开桌面通知或填写 Webhook 后再试。");
			return h$11("span", {
				className: "lp-test-result",
				role: "status"
			}, ...rows.map((row) => h$11("span", {
				key: row.name,
				className: `lp-sent ${row.ok ? "lp-sent-ok" : "lp-sent-bad"}`
			}, h$11(Icon, {
				name: row.ok ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), `${row.name}：${row.ok ? "已发送" : `失败${row.error ? `（${row.error}）` : ""}`}`)));
		}
		function Settings(props) {
			const { data } = props;
			const settings = data.settings;
			const signature = JSON.stringify(settings);
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
			return h$11("div", { className: "lp-card lp-followup" }, h$11("div", { className: "lp-followup-head" }, h$11(Switch, {
				id: "lp-followup-on",
				checked: settings.enabled,
				busy: switching,
				disabled: switching,
				label: "开启随访提醒",
				onChange: (next) => {
					toggle(next);
				}
			}), h$11("span", { className: "lp-caption" }, settings.enabled ? hasChannel ? nextLine(data) : "已开启，但还没有可用的渠道：打开桌面通知或填写 Webhook。" : "关闭时不会发送任何提醒。开启后按下面的时间提醒打卡、到期复测和每周小结。")), h$11("div", { className: "lp-grid-2 lp-followup-grid" }, h$11("fieldset", { className: "lp-fieldset" }, h$11("legend", { className: "lp-label" }, "什么时候"), h$11("div", { className: "lp-followup-times" }, h$11(TimeField, {
				id: "lp-fu-checkin",
				label: "打卡提醒",
				hint: "当天还有未完成时",
				value: form.checkin_time,
				onChange: (value) => set("checkin_time", value)
			}), h$11(TimeField, {
				id: "lp-fu-retest",
				label: "复测提醒",
				hint: "到期当天",
				value: form.retest_time,
				onChange: (value) => set("retest_time", value)
			})), h$11("div", { className: "lp-field" }, h$11("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-weekly"
			}, "每周小结"), h$11("div", { className: "lp-input-unit" }, h$11("select", {
				id: "lp-fu-weekly",
				className: "lp-select lp-select-wide",
				value: form.weeklyDay,
				onChange: (event) => set("weeklyDay", event.target.value)
			}, h$11("option", { value: "0" }, "不发送"), ...DAYS.map((label, index) => h$11("option", {
				key: label,
				value: String(index + 1)
			}, label))), form.weeklyDay !== "0" ? h$11("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: form.weeklyTime,
				"aria-label": "每周小结的时间",
				onChange: (event) => {
					if (event.target.value) set("weeklyTime", event.target.value);
				}
			}) : null)), h$11("div", { className: "lp-field" }, h$11(Check, {
				id: "lp-fu-quiet",
				checked: form.quietOn,
				onChange: (checked) => set("quietOn", checked)
			}, "免打扰时段"), form.quietOn ? h$11("div", { className: "lp-input-unit" }, h$11("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: form.quietStart,
				"aria-label": "免打扰开始",
				onChange: (event) => {
					if (event.target.value) set("quietStart", event.target.value);
				}
			}), h$11("span", { className: "lp-unit" }, "至"), h$11("input", {
				type: "time",
				className: "lp-input lp-input-time",
				value: form.quietEnd,
				"aria-label": "免打扰结束",
				onChange: (event) => {
					if (event.target.value) set("quietEnd", event.target.value);
				}
			})) : null)), h$11("fieldset", { className: "lp-fieldset" }, h$11("legend", { className: "lp-label" }, "发到哪里"), h$11(Check, {
				id: "lp-fu-desktop",
				checked: form.desktop && data.platform_desktop,
				disabled: !data.platform_desktop,
				onChange: (checked) => set("desktop", checked)
			}, "桌面通知", h$11("span", { className: "lp-caption" }, data.platform_desktop ? "  这台电脑的系统通知" : "  这台电脑的系统不支持")), h$11("div", { className: "lp-field" }, h$11("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-kind"
			}, "Webhook 渠道", h$11("span", { className: "lp-optional" }, "可选：发到手机上的群机器人或 App")), h$11("select", {
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
			}, h$11("option", { value: "" }, "不使用"), ...Object.keys(KIND_ZH).map((key) => h$11("option", {
				key,
				value: key
			}, KIND_ZH[key])))), kind ? h$11("div", { className: "lp-field" }, h$11("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-url"
			}, "地址", storedSame ? h$11("span", { className: "lp-optional" }, `已设置：${settings.webhook?.url_masked}`) : null), h$11("input", {
				id: "lp-fu-url",
				type: "url",
				className: "lp-input",
				value: form.url,
				autoComplete: "off",
				spellCheck: false,
				placeholder: storedSame ? "留空保持不变；填写则替换" : KIND_URL[kind],
				onChange: (event) => set("url", event.target.value)
			})) : null, kind && SIGNED.includes(kind) ? h$11("div", { className: "lp-field" }, h$11("label", {
				className: "lp-field-label",
				htmlFor: "lp-fu-secret"
			}, "签名密钥", h$11("span", { className: "lp-optional" }, "机器人开了“加签”才需要")), h$11("div", { className: "lp-input-unit" }, h$11("input", {
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
			}), storedSame && settings.webhook?.secret_set && !form.clearSecret && !form.secret ? h$11("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: () => set("clearSecret", true)
			}, "清除") : null)) : null)), h$11("div", { className: "lp-followup-detail" }, h$11(Segmented, {
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
			}), h$11("p", { className: "lp-caption" }, form.detail === "minimal" ? "只发“今天还有 2 项待打卡”这类提示，不含项目名称和健康数值。" : "会带上方案项目名称、执行率和复测指标，发到你配置的渠道。")), error ? h$11("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$11("div", { className: "lp-form-actions" }, h$11(Btn, {
				onClick: () => {
					save();
				},
				disabled: !dirty || saving
			}, saving ? "保存中…" : "保存设置"), h$11(Btn, {
				variant: "outline",
				onClick: () => {
					sendTest();
				},
				disabled: testing || dirty,
				title: dirty ? "先保存设置再测试" : void 0
			}, h$11(Icon, {
				name: "send",
				size: 14
			}), testing ? "发送中…" : "发送测试"), dirty ? h$11("span", { className: "lp-caption" }, "有未保存的更改") : test ? h$11(TestResult, {
				result: test,
				kind: settings.webhook?.kind ?? null
			}) : null), h$11("p", { className: "lp-fine" }, FOLLOWUP_NOTE), h$11(Log, { rows: data.log }));
		}
		function FollowupSection(props) {
			const { data, loading, error } = useFollowup();
			let body;
			if (!data && loading) body = h$11(Skeleton, {
				height: 220,
				className: "lp-card-skeleton"
			});
			else if (!data) body = h$11("div", { className: "lp-card" }, h$11("p", { className: "lp-muted" }, `随访设置没有读到：${error ?? "没有返回"}。LongPi 插件可能需要更新。`));
			else body = h$11(Settings, {
				data,
				onNotice: props.onNotice
			});
			return h$11(Section, {
				id: "lp-followup-section",
				title: "随访提醒",
				kicker: "默认关闭 · 只在 DSH 运行时发送"
			}, body);
		}
		/** Onboarding step 4: one opt-in row. Nothing is sent unless the person ticks it. */
		function FollowupOptIn() {
			const { data } = useFollowup();
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			if (!data) return null;
			const settings = data.settings;
			const checked = settings.enabled && settings.desktop;
			async function change(next) {
				setBusy(true);
				setError(null);
				try {
					const result = await postJson("/api/longpi/followup", next ? {
						enabled: true,
						desktop: true
					} : { enabled: false });
					if (!result.ok) throw new Error(result.error || "没有保存");
					if (result.settings) putFollowup(result);
					notifyChanged();
				} catch (err) {
					setError(`没有保存：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$11("div", { className: "lp-optin" }, h$11(Check, {
				id: "lp-onb-followup",
				checked: checked && data.platform_desktop,
				disabled: busy || !data.platform_desktop,
				onChange: (next) => {
					change(next);
				}
			}, `每天${Number(settings.checkin_time.slice(0, 2)) >= 17 ? "晚上" : ""} ${settings.checkin_time} 提醒我打卡（桌面通知）`), h$11("span", { className: "lp-caption" }, data.platform_desktop ? "只在 DSH 运行时提醒，不含健康数值；随时可以在健康页的“随访提醒”里关闭或改时间。" : "这台电脑的系统不支持桌面通知；可以在健康页的“随访提醒”里设置 Webhook。"), error ? h$11("span", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
		}
		//#endregion
		//#region src/client/self-measure.ts
		const h$10 = react.default.createElement;
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
			return h$10("ul", { className: "lp-self-latest" }, ...rows.map((row) => h$10("li", { key: row.key }, h$10("span", { className: "lp-caption" }, row.key === "sbp" ? "家庭血压" : row.label_zh), h$10("span", { className: "lp-self-value" }, selfLatestText(row, props.latest)), h$10("span", { className: "lp-caption" }, row.key === "sbp" ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : "1 次读数"} · 截至 ${chineseDate(row.date)}` : chineseDate(row.date)))));
		}
		async function saveEntries(entries) {
			return postJson("/api/longpi/self", { entries });
		}
		function numberOf(text) {
			const trimmed = text.trim().replace(/，/g, ".").replace(/,/g, ".");
			if (!trimmed) return null;
			const value = Number(trimmed);
			return Number.isFinite(value) && value > 0 ? value : NaN;
		}
		function UnitSelect(props) {
			const choices = unitChoices(props.spec);
			if (choices.length < 2) return h$10("span", { className: "lp-unit" }, props.spec.unit);
			return h$10("select", {
				id: props.id,
				className: "lp-select lp-unit-select",
				value: props.value,
				"aria-label": props.label,
				onChange: (event) => props.onChange(event.target.value)
			}, ...choices.map((unit) => h$10("option", {
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
					const value = numberOf(values[key]);
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
			const field = (key, placeholder) => h$10("div", { className: "lp-self-field" }, h$10("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-${key}`
			}, spec(key).label_zh), h$10("div", { className: "lp-input-unit" }, h$10("input", {
				id: `${props.idPrefix}-${key}`,
				className: "lp-input",
				inputMode: "decimal",
				placeholder,
				value: values[key],
				onChange: (event) => set(key, event.target.value)
			}), h$10(UnitSelect, {
				id: `${props.idPrefix}-${key}-unit`,
				spec: spec(key),
				value: units[key],
				label: `${spec(key).label_zh}的单位`,
				onChange: (unit) => setUnits((current) => ({
					...current,
					[key]: unit
				}))
			})));
			return h$10("form", {
				className: "lp-self-form",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$10("div", { className: "lp-self-grid" }, field("waist", "例如 86"), field("weight", "例如 70.5"), h$10("div", { className: "lp-self-field lp-self-bp" }, h$10("span", {
				className: "lp-field-label",
				id: `${props.idPrefix}-bp`
			}, "家庭血压"), h$10("div", {
				className: "lp-bp",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-bp`
			}, h$10("input", {
				id: `${props.idPrefix}-sbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "收缩压",
				"aria-label": "收缩压（高压）",
				value: values.sbp,
				onChange: (event) => set("sbp", event.target.value)
			}), h$10("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/"), h$10("input", {
				id: `${props.idPrefix}-dbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				value: values.dbp,
				onChange: (event) => set("dbp", event.target.value)
			}), h$10("span", { className: "lp-unit" }, "mmHg"))), h$10("div", { className: "lp-self-field" }, h$10("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-date`
			}, "测量日期"), h$10("input", {
				id: `${props.idPrefix}-date`,
				className: "lp-input",
				type: "date",
				value: date,
				max: today,
				min: "1990-01-01",
				onChange: (event) => setDate(event.target.value || today)
			}))), error ? h$10("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$10("div", { className: "lp-form-actions" }, h$10(Btn, {
				type: "submit",
				disabled: busy
			}, busy ? "记录中…" : "记录"), h$10("span", { className: "lp-caption" }, "单位可以选斤、尺或寸，会换算成 kg 和 cm。")));
		}
		function SelfRecent(props) {
			const { data, loading } = useSelfRows();
			const [busy, setBusy] = react.default.useState(null);
			const rows = (data?.rows ?? []).slice(0, 6);
			if (loading && !data) return null;
			if (rows.length === 0) return h$10("p", { className: "lp-caption lp-self-empty" }, "还没有自测记录。");
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
			return h$10("div", { className: "lp-self-recent" }, h$10("div", { className: "lp-subhead" }, "最近记录"), h$10("ul", { className: "lp-rows" }, ...rows.map((row) => h$10("li", {
				key: row.id,
				className: "lp-row"
			}, h$10("span", { className: "lp-row-main" }, h$10("span", null, labelOf(row.key)), h$10("span", { className: "lp-num" }, ` ${fmt(row.value)} ${row.unit}`), row.given ? h$10("span", { className: "lp-caption" }, `（记为 ${fmt(row.given.value)} ${row.given.unit}）`) : null), h$10("span", { className: "lp-caption" }, chineseDate(row.date)), h$10("button", {
				type: "button",
				className: "lp-iconbtn",
				disabled: busy === row.id,
				"aria-label": `删除 ${chineseDate(row.date)} 的${labelOf(row.key)} ${fmt(row.value)} ${row.unit}`,
				onClick: () => {
					remove(row);
				}
			}, h$10(Icon, {
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
				const first = numberOf(value);
				const second = bp ? numberOf(dbp) : null;
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
			return h$10("form", {
				className: "lp-inline-self",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$10("input", {
				className: "lp-input",
				inputMode: "decimal",
				value,
				placeholder: bp ? "收缩压" : spec.label_zh,
				"aria-label": bp ? "收缩压（高压）" : `${spec.label_zh}`,
				id: `${props.idPrefix}-${props.selfKey}`,
				onChange: (event) => setValue(event.target.value)
			}), bp ? h$10("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/") : null, bp ? h$10("input", {
				className: "lp-input",
				inputMode: "decimal",
				value: dbp,
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				onChange: (event) => setDbp(event.target.value)
			}) : null, bp ? h$10("span", { className: "lp-unit" }, "mmHg") : h$10(UnitSelect, {
				id: `${props.idPrefix}-${props.selfKey}-unit`,
				spec,
				value: unit,
				label: `${spec.label_zh}的单位`,
				onChange: setUnit
			}), h$10(Btn, {
				type: "submit",
				size: "sm",
				disabled: busy
			}, busy ? "记录中" : "记录"));
		}
		//#endregion
		//#region src/client/results.ts
		const h$9 = react.default.createElement;
		/** More than this and the chips crowd the card; the action below lists the rest. */
		const NEEDS_SHOWN = 6;
		function EstimateTag() {
			return h$9("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计");
		}
		function CardHead(props) {
			return h$9("div", { className: "lp-result-head" }, h$9("div", { className: "lp-label" }, props.label), h$9(EstimateTag));
		}
		function bioageAction(journey) {
			const bio = journey.results.bioage;
			if (bio.blocker_zh.includes("方法库")) return null;
			if (journey.profile.age == null) return {
				label: "填写年龄",
				target: "profile"
			};
			if (journey.records.status !== "ok") return {
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
			if (journey.records.status !== "ok") return {
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
			const action = props.action?.target === "addons" && !props.canShowAddons ? null : props.action;
			return h$9("div", { className: "lp-card lp-result lp-result-blocked" }, h$9(CardHead, { label: props.label }), h$9("div", { className: "lp-result-wait" }, "还不能计算"), h$9("p", { className: "lp-blocker" }, props.blocker || "还缺少计算需要的信息。"), props.needs.length > 0 ? h$9("div", { className: "lp-needs" }, h$9("span", { className: "lp-caption" }, "还需要"), ...props.needs.slice(0, NEEDS_SHOWN).map((need) => h$9("span", {
				className: "lp-need",
				key: need
			}, need)), props.needs.length > NEEDS_SHOWN ? h$9("span", { className: "lp-caption" }, `等 ${props.needs.length} 项`) : null) : null, props.selfAddon && props.selfAddon.self_key && props.action?.target !== "profile" && props.action?.target !== "records" ? h$9("div", { className: "lp-result-self" }, h$9("div", { className: "lp-caption" }, `${props.selfAddon.item_zh}可以自己在家量，记下就能算：`), h$9(InlineSelf, {
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
				label: "身体年龄 · 表型年龄",
				blocker: result.blocker_zh,
				needs: result.missing,
				action: bioageAction(props.journey),
				canShowAddons: props.canShowAddons,
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
			let real = false;
			if (delta != null && first) {
				const moved = delta < 0 ? `年轻了 ${fmt(-delta)} 岁` : delta > 0 ? `多了 ${fmt(delta)} 岁` : "没有变化";
				story = `从 ${chineseMonth(first.date)}到现在，表型年龄相对实足年龄${moved}`;
				if (band != null) {
					if (Math.abs(delta) > band) {
						real = delta < 0;
						story += partial ? `，超过了已知的个体波动（±${fmt(band)} 岁，未含${bio?.band_missing?.join("、")}）。` : `，超出个体正常波动（±${fmt(band)} 岁），是真实的变化。`;
					} else story += `，还在个体正常波动（±${fmt(band)} 岁）以内。`;
				} else story += "。";
			}
			const versus = versusAge(advance);
			return h$9("div", { className: `lp-card lp-result ${real ? "lp-result-win" : ""}` }, h$9(CardHead, { label: "身体年龄 · 表型年龄" }), h$9("div", { className: "lp-result-figure" }, h$9("span", { className: "lp-bignum" }, fmt(phenoage)), h$9("span", { className: "lp-bignum-unit" }, "岁"), band != null ? h$9("span", { className: "lp-band-note" }, `正常波动 ±${fmt(band)} 岁`) : null), h$9("div", { className: "lp-result-sub" }, versus ? h$9("span", { className: `lp-pill ${advance != null && advance < -.5 ? "lp-pill-good" : ""}` }, versus) : null, date ? h$9("span", { className: "lp-caption" }, `${chineseDate(date)}体检 · 共 ${count} 次完整血检`) : null), points.length > 1 ? h$9(LineChart, {
				points: points.filter((row) => row.advance != null).map((row) => ({
					date: row.date,
					value: row.advance
				})),
				unit: "岁",
				label: "表型年龄减实足年龄",
				height: 132,
				band: band != null && first?.advance != null ? {
					low: first.advance - band,
					high: first.advance + band,
					from: first.date
				} : null,
				reference: {
					value: 0,
					label: "持平"
				}
			}) : props.tracking == null ? h$9(Skeleton, { height: 60 }) : null, story ? h$9("p", { className: "lp-story" }, real ? h$9(Icon, {
				name: "spark",
				className: "lp-good-ink"
			}) : null, story) : null, h$9("p", { className: "lp-fine" }, "Levine 2018 表型年龄：九项常规血检加实足年龄。浅色带是第一次检查的个体正常波动，落在带外才算真实变化。"), points.length > 1 ? h$9(TableTwin, {
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
		function RiskCard(props) {
			const result = props.journey.results.risk;
			if (result.status !== "ok") {
				const needs = [...result.missing_facts, ...result.missing_labs];
				return h$9(Blocked, {
					journey: props.journey,
					label: "10 年心血管病风险 · China-PAR",
					blocker: result.blocker_zh,
					needs,
					action: riskAction(props.journey),
					selfAddon: riskSelfAddon(props.journey),
					canShowAddons: props.canShowAddons,
					onAction: props.onAction,
					onNotice: props.onNotice,
					idPrefix: "lp-risk"
				});
			}
			const card = props.tracking?.models?.find((row) => row.model === "china-par");
			const goal = card?.goal?.risk_pct;
			return h$9("div", { className: "lp-card lp-result" }, h$9(CardHead, { label: "10 年心血管病风险 · China-PAR" }), h$9("div", { className: "lp-result-figure" }, h$9("span", { className: "lp-bignum" }, riskText(result.risk_pct)), h$9("span", { className: "lp-bignum-unit" }, "%")), h$9("div", { className: "lp-result-sub" }, result.category_zh ? h$9("span", { className: "lp-pill" }, result.category_zh) : null, result.date ? h$9("span", { className: "lp-caption" }, `按 ${chineseDate(result.date)}的记录和你的档案计算`) : null), goal != null && Number.isFinite(goal) ? h$9("div", { className: "lp-result-goal" }, h$9("span", { className: "lp-caption" }, "达到方案目标时"), h$9("span", { className: "lp-strong" }, `${riskText(goal)}%`), card?.category_zh?.goal ? h$9("span", { className: "lp-pill lp-pill-good" }, card.category_zh.goal) : null) : null, h$9("p", { className: "lp-story" }, "未来 10 年发生心梗、脑卒中等动脉粥样硬化性心血管病的估计概率。它说的是同类人群的平均，不是对你个人的预言。"), h$9("p", { className: "lp-fine" }, `China-PAR 中国人群模型。${card?.note_zh ?? ""}这个模型没有公开的个体波动范围，所以这里不画波动带。`));
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
		//#region src/client/journey-steps.ts
		const h$8 = react.default.createElement;
		const INSTALL_HINT = "curl -fsSL https://raw.githubusercontent.com/zwbao/dsh-plugin-longpi/main/install.sh | bash -s -- --mcp-url <你的 MCP 地址>";
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
			return h$8("div", { className: "lp-consent" }, ...CONSENT_SENTENCES.map((text, index) => h$8("div", {
				key: index,
				className: "lp-consent-row"
			}, h$8("span", {
				className: "lp-consent-icon",
				"aria-hidden": true
			}, h$8(Icon, {
				name: CONSENT_ICONS[index] ?? "info",
				size: 15
			})), h$8("p", null, text))));
		}
		/** The notice inline on the page (the modal has its own buttons). */
		function ConsentInline(props) {
			const [busy, setBusy] = react.default.useState(false);
			async function accept() {
				setBusy(true);
				try {
					await acceptConsent();
					props.onNotice("已开始使用 LongPi。接下来填写档案。", "good");
				} catch (err) {
					props.onNotice(`没有记下：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(false);
				}
			}
			return h$8("div", { className: "lp-step-body" }, h$8(ConsentText), h$8("div", { className: "lp-form-actions" }, h$8(Btn, {
				onClick: () => {
					accept();
				},
				disabled: busy
			}, busy ? "记录中…" : "开始"), h$8("span", { className: "lp-caption" }, `点“开始”表示你已读过以上说明（版本 ${props.journey.consent.current}）。`)));
		}
		function RecordsStatusLine(props) {
			const records = props.journey.records;
			if (records.status === "ok") return h$8("div", { className: "lp-status" }, h$8("span", {
				className: "lp-statusdot lp-statusdot-on",
				"aria-hidden": true
			}), `Mirobody 已连接 · ${records.indicator_count} 项指标 · ${records.full_checkups} 次完整体检`);
			return h$8("div", { className: "lp-status" }, h$8("span", {
				className: `lp-statusdot ${records.status === "error" ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), records.status === "error" ? `记录读取失败：${records.error || "没有返回原因"}` : "还没有连接 Mirobody 记录");
		}
		/** Connected: what it holds. Not connected: exactly what to do in Mirobody, then check again. */
		function RecordsGuide(props) {
			const [checking, setChecking] = react.default.useState(false);
			const [copied, setCopied] = react.default.useState(false);
			const records = props.journey.records;
			async function recheck() {
				setChecking(true);
				try {
					await props.onRecheck();
				} finally {
					setChecking(false);
				}
			}
			const recheckButton = h$8(Btn, {
				variant: "outline",
				size: "sm",
				onClick: () => {
					recheck();
				},
				disabled: checking
			}, h$8(Icon, {
				name: "refresh",
				size: 14
			}), checking ? "检查中…" : "重新检查");
			if (records.status === "ok") return h$8("div", { className: "lp-step-body" }, h$8("div", { className: "lp-connected" }, h$8("span", {
				className: "lp-connected-icon",
				"aria-hidden": true
			}, h$8(Icon, {
				name: "check",
				size: 16
			})), h$8("div", null, h$8("div", { className: "lp-strong" }, `已连接 · ${records.indicator_count} 项指标 · ${records.full_checkups} 次完整体检`), h$8("div", { className: "lp-caption" }, records.latest_checkup ? `最近一次完整体检：${chineseDate(records.latest_checkup)}` : "还没有九项血检测齐的一次体检"))), h$8(CanCompute, { journey: props.journey }), h$8("div", { className: "lp-form-actions" }, recheckButton));
			return h$8("div", { className: "lp-step-body" }, records.status === "error" ? h$8("p", { className: "lp-blocker lp-blocker-bad" }, `记录读取失败：${records.error || "没有返回原因"}`) : h$8("p", { className: "lp-muted" }, "LongPi 从你自己的 Mirobody 读取体检和可穿戴数据（只读）。三步接上："), h$8("ol", { className: "lp-howto" }, h$8("li", null, "在 Mirobody 网页上传体检报告（PDF 或照片），或连接手环、手表。"), h$8("li", null, "在 Mirobody 生成个人 MCP 地址。"), h$8("li", null, "重新运行 LongPi 的安装命令，加上 ", h$8("code", null, "--mcp-url"), " 和这个地址，然后重启 DSH。")), h$8("div", { className: "lp-code" }, h$8("code", null, INSTALL_HINT), h$8("button", {
				type: "button",
				className: "lp-iconbtn",
				"aria-label": "复制安装命令",
				onClick: () => {
					copyText(INSTALL_HINT).then((ok) => setCopied(ok));
				}
			}, h$8(Icon, {
				name: copied ? "check" : "link",
				size: 14
			}))), h$8("div", { className: "lp-form-actions" }, recheckButton, h$8("span", { className: "lp-caption" }, records.mirobody_mounted ? "接好后点“重新检查”。" : "Mirobody 插件还没有加载，重新运行安装命令会一起装好。")));
		}
		/** Right after connecting: what can be computed now, and which extra test unlocks the rest. */
		function CanCompute(props) {
			const { bioage, risk } = props.journey.results;
			const line = (label, ok, detail) => h$8("li", { className: "lp-can" }, h$8("span", {
				className: `lp-can-mark ${ok ? "lp-can-ok" : ""}`,
				"aria-hidden": true
			}, h$8(Icon, {
				name: ok ? "check" : "dot",
				size: 12,
				strokeWidth: ok ? 2 : 3
			})), h$8("span", { className: "lp-strong" }, label), h$8("span", { className: "lp-caption" }, detail));
			return h$8("ul", { className: "lp-cans" }, line("身体年龄", bioage.status === "ok", bioage.status === "ok" ? "现在就能算" : bioage.blocker_zh), line("心血管风险", risk.status === "ok", risk.status === "ok" ? "现在就能算" : risk.blocker_zh));
		}
		/** Step 3: the results themselves (compact), or the checklist that would unlock them. */
		function FirstResult(props) {
			const { bioage, risk } = props.journey.results;
			const blocked = props.journey.addons.length;
			return h$8("div", { className: "lp-step-body" }, !props.showResults && blocked === 0 ? h$8(CanCompute, { journey: props.journey }) : null, !props.showResults ? null : h$8("div", { className: "lp-first" }, h$8("div", { className: "lp-first-cell" }, h$8("div", { className: "lp-caption" }, "身体年龄 · 模型估计"), bioage.status === "ok" ? h$8("div", null, h$8("div", { className: "lp-first-figure" }, fmt(bioage.phenoage), h$8("span", { className: "lp-bignum-unit" }, "岁")), h$8("div", { className: "lp-caption" }, [versusAge(bioage.advance), bioage.band_years != null ? `正常波动 ±${fmt(bioage.band_years)} 岁` : ""].filter(Boolean).join(" · "))) : h$8("div", null, h$8("div", { className: "lp-first-wait" }, "还不能计算"), h$8("p", { className: "lp-blocker" }, bioage.blocker_zh))), h$8("div", { className: "lp-first-cell" }, h$8("div", { className: "lp-caption" }, "10 年心血管病风险 · 模型估计"), risk.status === "ok" ? h$8("div", null, h$8("div", { className: "lp-first-figure" }, riskText(risk.risk_pct), h$8("span", { className: "lp-bignum-unit" }, "%")), h$8("div", { className: "lp-caption" }, [risk.category_zh, "China-PAR"].filter(Boolean).join(" · "))) : h$8("div", null, h$8("div", { className: "lp-first-wait" }, "还不能计算"), h$8("p", { className: "lp-blocker" }, risk.blocker_zh)))), blocked > 0 ? h$8("div", { className: "lp-first-addons" }, h$8("div", { className: "lp-subhead" }, `还差 ${blocked} 项检查`, h$8("span", { className: "lp-optional" }, "下次体检加测，或现在自己量")), h$8(AddonList, {
				journey: props.journey,
				onNotice: props.onNotice,
				idPrefix: props.idPrefix
			})) : null);
		}
		//#endregion
		//#region src/client/profile-editor.ts
		const h$7 = react.default.createElement;
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
			return h$7("form", {
				className: `lp-profile lp-profile-${props.variant}`,
				onSubmit: (event) => {
					save(event);
				},
				noValidate: true
			}, onboarding ? null : h$7("div", { className: "lp-field" }, h$7("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-name`
			}, "称呼", h$7("span", { className: "lp-optional" }, "选填")), h$7("input", {
				id: `${props.idPrefix}-name`,
				className: "lp-input",
				value: draft.displayName,
				maxLength: 40,
				autoComplete: "nickname",
				placeholder: "页面上怎么称呼你",
				onChange: (event) => edit({ displayName: event.target.value })
			})), h$7("div", { className: "lp-profile-basics" }, h$7("div", { className: "lp-field lp-field-age" }, h$7("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-age`
			}, "实足年龄"), h$7("div", { className: "lp-input-unit" }, h$7("input", {
				id: `${props.idPrefix}-age`,
				className: "lp-input",
				inputMode: "numeric",
				value: draft.age,
				placeholder: "例如 52",
				"aria-invalid": !ageCheck.ok,
				"data-modal-autofocus": onboarding ? true : void 0,
				onChange: (event) => edit({ age: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })
			}), h$7("span", { className: "lp-unit" }, "岁"))), h$7("div", { className: "lp-field lp-field-sex" }, h$7(Segmented, {
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
			}))), h$7("p", { className: "lp-unlock" }, h$7(Icon, {
				name: "lock",
				size: 12
			}), `解锁：${unlockOf(props.journey, "age")}`), h$7("fieldset", { className: "lp-facts" }, h$7("legend", { className: "lp-facts-legend" }, h$7("span", { className: "lp-strong" }, "心血管风险还需要这 6 项"), h$7("span", { className: "lp-caption" }, ` · 已回答 ${answeredFacts} 项，不确定就选“不确定”，不会当作“否”`)), ...facts.map((row) => h$7("div", {
				className: "lp-fact",
				key: row.key
			}, h$7("div", { className: "lp-fact-text" }, h$7("div", {
				className: "lp-fact-label",
				id: `${props.idPrefix}-${row.key}-text`
			}, row.label_zh), h$7("div", { className: "lp-unlock lp-unlock-inline" }, `解锁：${row.unlocks_zh || "心血管风险"}`, row.men_only ? female ? " · 女性的公式不用这一项，可以跳过" : " · 只用于男性的公式" : "")), h$7(Segmented, {
				name: `${props.idPrefix}-${row.key}`,
				label: row.label_zh,
				hideLabel: true,
				options: ANSWERS,
				value: draft.risk[row.key] ?? "",
				onChange: (value) => edit({ risk: {
					...draft.risk,
					[row.key]: value
				} })
			})))), h$7("div", { className: "lp-focus" }, h$7("div", {
				className: "lp-field-label",
				id: `${props.idPrefix}-focus`
			}, "你最关心什么", h$7("span", { className: "lp-optional" }, "可多选，按点选先后排序")), h$7("div", {
				className: "lp-toggles",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-focus`
			}, ...focusOptions.map((option) => {
				const index = draft.focus.indexOf(option.key);
				return h$7(ToggleChip, {
					key: option.key,
					pressed: index >= 0,
					badge: index >= 0 ? String(index + 1) : void 0,
					onClick: () => toggleFocus(option.key)
				}, option.label_zh);
			}))), error ? h$7("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$7("div", { className: onboarding ? "lp-modal-actions" : "lp-form-actions" }, onboarding ? h$7(Btn, {
				variant: "outline",
				type: "button",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过") : null, h$7(Btn, {
				type: "submit",
				disabled: busy || !onboarding && !dirty
			}, busy ? "保存中…" : onboarding ? "保存并继续" : "保存档案"), !onboarding && !dirty && props.journey?.profile.complete ? h$7("span", { className: "lp-caption" }, "已是最新") : null));
		}
		//#endregion
		//#region src/client/onboarding.ts
		const h$6 = react.default.createElement;
		const TITLES = [
			"欢迎使用 LongPi",
			"建立档案",
			"连接体检记录",
			"第一个结果"
		];
		const NOOP = () => {};
		/** A journey that has not arrived by then counts as failed; the page and home card still offer the notice. */
		const GIVE_UP_MS = 45e3;
		function Dots(props) {
			return h$6("div", { className: "lp-onb-progress" }, h$6("ol", {
				className: "lp-dots",
				"aria-hidden": true
			}, ...TITLES.map((_, index) => h$6("li", {
				key: index,
				className: `lp-dot-step ${index === props.step ? "lp-dot-now" : index < props.step ? "lp-dot-past" : ""}`
			}))), h$6("span", { className: "lp-caption" }, `第 ${props.step + 1} 步，共 ${TITLES.length} 步`));
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
		function Onboarding(props) {
			const { journey, error: loadError, refresh } = useJourney();
			const [step, setStep] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const [computing, setComputing] = react.default.useState(false);
			const [notice, notify] = useNotice();
			const decided = react.default.useRef(false);
			const content = react.default.useRef(null);
			const { done, finish } = useCompleteOnce(props.complete);
			react.default.useEffect(() => {
				if (decided.current) return;
				if (!journey) {
					if (loadError) {
						decided.current = true;
						finish();
					}
					return;
				}
				decided.current = true;
				if (props.initialStep != null) {
					setStep(Math.max(0, Math.min(3, props.initialStep)));
					return;
				}
				if (props.explicit) {
					setStep(1);
					return;
				}
				if (journey.consent.accepted && journey.profile.complete) {
					finish();
					return;
				}
				setStep(journey.consent.accepted ? 1 : 0);
			}, [
				journey,
				loadError,
				finish
			]);
			react.default.useEffect(() => {
				const timer = window.setTimeout(() => {
					if (decided.current) return;
					decided.current = true;
					finish();
				}, GIVE_UP_MS);
				return () => window.clearTimeout(timer);
			}, [finish]);
			const go = react.default.useCallback((next) => {
				setError(null);
				setStep(next);
				if (next === 3) {
					setComputing(true);
					refresh(true).finally(() => setComputing(false));
				}
			}, [refresh]);
			useAutofocus(content, step ?? -1, step != null && !!journey && !done);
			if (done || step == null || !journey) return null;
			return h$6(OnboardingModal, { title: TITLES[step] ?? TITLES[0] }, h$6("div", {
				className: "lp lp-onb",
				ref: content
			}, h$6(Dots, { step }), h$6("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, TITLES[step]), step === 0 ? h$6("div", { className: "lp-onb-body" }, h$6(ConsentText), error ? h$6("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$6("div", { className: "lp-modal-actions" }, h$6(Btn, {
				variant: "outline",
				onClick: finish,
				disabled: busy
			}, "以后再说"), h$6(Btn, {
				"data-modal-autofocus": true,
				disabled: busy,
				onClick: () => {
					setBusy(true);
					acceptConsent().then(() => go(1)).catch((err) => setError(`没有记下：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
				}
			}, busy ? "记录中…" : "开始"))) : null, step === 1 ? h$6("div", { className: "lp-onb-body" }, h$6("p", { className: "lp-onb-lead" }, "只问能解锁结果的问题。每一项都可以跳过，跳过就是“不知道”，不会当作“否”。"), h$6(ProfileEditor, {
				journey,
				variant: "onboarding",
				idPrefix: "lp-onb-profile",
				onSaved: () => go(2),
				onSkip: () => go(2)
			})) : null, step === 2 ? h$6("div", { className: "lp-onb-body" }, h$6(RecordsGuide, {
				journey,
				onRecheck: () => refresh(true)
			}), h$6("div", { className: "lp-modal-actions" }, h$6(Btn, {
				variant: "outline",
				onClick: () => go(1)
			}, "上一步"), h$6(Btn, {
				"data-modal-autofocus": true,
				onClick: () => go(3)
			}, journey.records.status === "ok" ? "继续" : "先跳过"))) : null, step === 3 ? h$6("div", { className: "lp-onb-body" }, computing ? h$6("div", {
				className: "lp-onb-computing",
				"aria-busy": true
			}, h$6(Skeleton, { height: 88 }), h$6("p", { className: "lp-caption" }, "正在用你的记录计算…")) : h$6(FirstResult, {
				journey,
				onNotice: notify,
				idPrefix: "lp-onb-result",
				showResults: true
			}), h$6(FollowupOptIn), notice, h$6("p", { className: "lp-fine" }, journey.boundary_zh), h$6("div", { className: "lp-modal-actions" }, h$6(Btn, {
				variant: "outline",
				onClick: finish
			}, "完成"), h$6(Btn, {
				"data-modal-autofocus": true,
				onClick: () => {
					props.openPage?.();
					finish();
				}
			}, "打开健康页"))) : null));
		}
		function OnboardingModal(props) {
			useInertRoot();
			return h$6(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: props.title,
				onClose: NOOP,
				headless: true,
				className: "lp-onb-dialog"
			}, props.children);
		}
		//#endregion
		//#region src/client/goals.ts
		const h$5 = react.default.createElement;
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
			return h$5(Section, {
				id: "lp-goals",
				title: "如果达到目标",
				kicker: "模型估计"
			}, h$5("div", { className: "lp-grid-goals" }, pheno ? h$5("div", { className: "lp-card lp-model" }, h$5("div", { className: "lp-label" }, "表型年龄"), pheno.goal ? h$5("div", { className: "lp-model-figures" }, h$5("div", null, h$5("div", { className: "lp-caption" }, "现在"), h$5("div", { className: "lp-tile-figure" }, `${fmt(pheno.now?.phenoage)} 岁`)), h$5(Icon, {
				name: "arrow",
				size: 18,
				className: "lp-muted-ink"
			}), h$5("div", null, h$5("div", { className: "lp-caption" }, "达到方案目标"), h$5("div", { className: "lp-tile-figure lp-good-ink" }, `${fmt(pheno.goal.phenoage)} 岁`)), h$5("span", { className: "lp-pill lp-pill-good" }, `${fmt(pheno.goal.phenoage_delta)} 岁`)) : h$5("p", { className: "lp-muted" }, pheno.note_zh ?? ""), leverRows.length > 0 ? h$5("div", null, h$5("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$5(LeverBars, { rows: leverRows })) : sensitivityRows.length > 0 ? h$5("div", null, h$5("div", { className: "lp-subhead" }, "对你的表型年龄影响最大的指标"), h$5(LeverBars, { rows: sensitivityRows })) : null, pheno.goal && pheno.now?.mortality_10y_pct != null && pheno.goal.mortality_10y_pct != null ? h$5("p", { className: "lp-fine" }, `同一模型的 10 年死亡风险：${pheno.now.mortality_10y_pct.toFixed(1)}% → ${pheno.goal.mortality_10y_pct.toFixed(1)}%。`) : null, h$5("p", { className: "lp-fine" }, `${pheno.measured_on ? `按 ${pheno.measured_on} 的血检计算。` : ""}${pheno.boundary_zh ?? ""}`)) : null, risk ? h$5("div", { className: "lp-card lp-model" }, h$5("div", { className: "lp-label" }, "10 年心血管病风险 · China-PAR"), risk.status === "unavailable" ? h$5("div", null, h$5("div", { className: "lp-tile-figure lp-muted-ink" }, (risk.missing ?? []).length > 0 ? "还差几项" : "暂不显示"), h$5("p", { className: "lp-muted" }, risk.note_zh ?? "")) : h$5("div", null, h$5("div", { className: "lp-model-figures" }, h$5("div", null, h$5("div", { className: "lp-caption" }, "现在"), h$5("div", { className: "lp-tile-figure" }, risk.now?.risk_pct == null ? "—" : `${risk.now.risk_pct.toFixed(1)}%`), risk.category_zh?.now ? h$5("span", { className: "lp-pill" }, risk.category_zh.now) : null), risk.goal ? h$5(Icon, {
				name: "arrow",
				size: 18,
				className: "lp-muted-ink"
			}) : null, risk.goal ? h$5("div", null, h$5("div", { className: "lp-caption" }, "达到方案目标"), h$5("div", { className: "lp-tile-figure lp-good-ink" }, risk.goal.risk_pct == null ? "—" : `${risk.goal.risk_pct.toFixed(1)}%`), risk.category_zh?.goal ? h$5("span", { className: "lp-pill lp-pill-good" }, risk.category_zh.goal) : null) : null), (risk.levers ?? []).length > 0 ? h$5("div", null, h$5("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$5(LeverBars, { rows: (risk.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "个百分点"
			})) })) : h$5("p", { className: "lp-muted" }, risk.note_zh ?? "")), h$5("p", { className: "lp-fine" }, risk.boundary_zh ?? "")) : null, h$5("div", { className: "lp-card lp-model lp-model-note" }, h$5("div", { className: "lp-label" }, "关于“能多活几年”"), h$5("p", { className: "lp-muted" }, "没有经过验证的模型能对个人给出“多活几年”。这里只给有依据的模型估计：表型年龄、同一模型的 10 年死亡风险，以及中国人群的 10 年心血管病风险。"), h$5("p", { className: "lp-fine" }, "试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月。能坚持的小改变，比追逐一个数字更重要。"))));
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
			return h$5(Section, {
				id: "lp-next",
				title: "下一步",
				kicker: "按优先级"
			}, h$5("ol", { className: "lp-card lp-steps" }, ...rows.map((row, index) => h$5("li", {
				key: index,
				className: `lp-step lp-step-${row.kind}`
			}, h$5("span", { className: "lp-step-icon" }, h$5(Icon, {
				name: STEP_ICON[row.kind] ?? "info",
				size: 15
			})), h$5("span", null, row.text_zh)))), h$5("p", { className: "lp-fine" }, "这里不会建议开始、停止或调整任何药物和补剂，也不给剂量。"));
		}
		//#endregion
		//#region src/client/methods.ts
		const h$4 = react.default.createElement;
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
			return h$4("div", { className: "lp-card" }, h$4("div", { className: "lp-label" }, "你的记录现在就能算"), ready.length === 0 ? h$4("p", { className: "lp-muted" }, "还没有能直接计算的方法。") : h$4("ul", { className: "lp-rows" }, ...ready.slice(0, 8).map((row) => h$4("li", {
				key: row.name,
				className: "lp-row lp-row-stack"
			}, h$4("span", { className: "lp-strong" }, row.blurb || row.name), h$4("span", { className: "lp-caption" }, row.domain || row.name)))), ready.length > 8 ? h$4("p", { className: "lp-caption" }, `另有 ${ready.length - 8} 项`) : null, ready.length > 0 ? h$4("div", { className: "lp-form-actions" }, h$4(Btn, {
				size: "sm",
				disabled: running,
				onClick: () => {
					run();
				}
			}, h$4(Icon, {
				name: "play",
				size: 13
			}), running ? "正在计算…" : `一键计算 ${ready.length} 项`)) : null, results ? h$4("ul", { className: "lp-rows lp-run" }, ...results.map((row) => h$4("li", {
				key: row.skill,
				className: "lp-row lp-row-stack"
			}, h$4("span", null, h$4("span", { className: row.ok ? "lp-good-ink" : "lp-muted-ink" }, row.ok ? "✓ " : "· "), row.skill), h$4("span", { className: "lp-caption" }, row.excerpt.split("\n")[0] ?? "")))) : null);
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
			return h$4("div", { className: "lp-card" }, h$4("label", {
				className: "lp-label",
				htmlFor: "lp-method-q"
			}, "找方法"), h$4("form", {
				className: "lp-search",
				onSubmit: (event) => {
					ask(event);
				}
			}, h$4("input", {
				id: "lp-method-q",
				className: "lp-input",
				placeholder: "例如：生物年龄、甲基化、NMN 有用吗",
				value: question,
				onChange: (event) => setQuestion(event.target.value)
			}), h$4(Btn, {
				type: "submit",
				size: "sm",
				variant: "outline",
				disabled: busy || !question.trim()
			}, busy ? "匹配中" : "匹配")), error ? h$4("p", { className: "lp-form-error" }, error) : null, note ? h$4("p", { className: "lp-fine" }, note) : null, shown.length > 0 ? h$4("ul", { className: "lp-rows" }, ...shown.slice(0, 6).map((item) => h$4("li", {
				key: item.name,
				className: "lp-row lp-row-stack"
			}, h$4("span", { className: "lp-strong" }, item.name), h$4("span", { className: "lp-caption" }, (item.why ?? []).join("；") || item.blurb || "")))) : null);
		}
		function MethodsSection(props) {
			const board = props.board;
			if (!board) return h$4(Section, {
				id: "lp-methods",
				title: "记录与方法",
				kicker: "数据"
			}, props.loading ? h$4(Skeleton, { height: 160 }) : h$4("div", { className: "lp-card" }, h$4("p", { className: "lp-muted" }, `方法和记录没有读到${props.error ? `（${props.error}）` : ""}。点右上角的刷新再试一次。`)));
			const unlock = board.readiness?.unlock ?? [];
			const meds = board.records?.medications ?? [];
			const readouts = board.readouts ?? [];
			return h$4(Section, {
				id: "lp-methods",
				title: "记录与方法",
				kicker: "数据",
				aside: h$4("span", { className: "lp-caption" }, `方法库 ${board.skills?.version ?? ""} · ${board.readiness?.declared ?? 0} 个个人方法`)
			}, h$4("div", { className: "lp-grid-2" }, h$4(RunReady, {
				board,
				onNotice: props.onNotice
			}), h$4("div", { className: "lp-card" }, h$4("div", { className: "lp-label" }, "再测一项就能解锁"), unlock.length === 0 ? h$4("p", { className: "lp-muted" }, "没有只差一项的方法。") : h$4("ul", { className: "lp-rows" }, ...unlock.slice(0, 8).map((row) => h$4("li", {
				key: row.item,
				className: "lp-row"
			}, h$4("span", { className: "lp-strong" }, row.item), h$4("span", { className: "lp-caption" }, `解锁 ${row.skills.length} 个方法`)))))), h$4("div", { className: "lp-grid-2" }, h$4("div", { className: "lp-card" }, h$4("div", { className: "lp-label" }, "用药计划", h$4("span", { className: "lp-optional" }, "只读，来自 Mirobody")), meds.length === 0 ? h$4("p", { className: "lp-muted" }, "没有读到用药计划。") : h$4("ul", { className: "lp-rows" }, ...meds.map((row) => h$4("li", {
				key: row.name,
				className: "lp-row"
			}, h$4("span", null, row.name), h$4("span", { className: "lp-caption" }, row.status ?? ""))))), h$4("div", { className: "lp-card" }, h$4("div", { className: "lp-label" }, "最近读出"), readouts.length === 0 ? h$4("p", { className: "lp-muted" }, "还没有算过。") : h$4("ul", { className: "lp-rows" }, ...readouts.slice(0, 8).map((row) => h$4("li", {
				key: row.key,
				className: "lp-row"
			}, h$4("span", null, row.label_zh || row.key), h$4("span", { className: "lp-row-end" }, h$4("span", { className: "lp-num" }, `${typeof row.value === "number" ? fmt(row.value, 2) : row.value ?? ""} ${row.unit && row.unit !== "1" ? row.unit === "a" ? "岁" : row.unit : ""}`), h$4("span", { className: "lp-caption" }, (row.measured_at || row.at || "").slice(0, 10)))))))), h$4("div", { className: "lp-grid-1" }, h$4(Search, { board })));
		}
		//#endregion
		//#region src/client/stepper.ts
		const h$3 = react.default.createElement;
		const STEPS = [
			{
				key: "profile",
				title: "建档",
				hint: "年龄、性别和 6 个问题"
			},
			{
				key: "records",
				title: "连接记录",
				hint: "接上你的 Mirobody"
			},
			{
				key: "first_result",
				title: "第一个结果",
				hint: "身体年龄和心血管风险"
			}
		];
		function stepOf(stage) {
			if (stage === "consent" || stage === "profile") return 0;
			if (stage === "records") return 1;
			if (stage === "first_result") return 2;
			return 3;
		}
		/** The step shown open: the one the person picked, else the current one (建档 when only profile answers hold up the first result). */
		function openStepOf(journey, picked) {
			if (picked) return picked;
			return journey.stage === "first_result" && journey.addons.length === 0 && journey.next.action === "profile" ? "profile" : STEPS[Math.min(stepOf(journey.stage), 2)]?.key ?? "profile";
		}
		function JourneyStepper(props) {
			const current = stepOf(props.journey.stage);
			const openFacts = props.journey.results.risk.missing_facts.length;
			const openKey = openStepOf(props.journey, props.open);
			const body = (key) => {
				if (key === "profile") return props.journey.consent.accepted ? h$3("div", { className: "lp-step-body" }, h$3(ProfileEditor, {
					journey: props.journey,
					variant: "page",
					idPrefix: "lp-step-profile",
					onNotice: props.onNotice
				})) : h$3(ConsentInline, {
					journey: props.journey,
					onNotice: props.onNotice
				});
				if (key === "records") return h$3(RecordsGuide, {
					journey: props.journey,
					onRecheck: props.onRecheck
				});
				return h$3(FirstResult, {
					journey: props.journey,
					onNotice: props.onNotice,
					idPrefix: "lp-step-result",
					showResults: false
				});
			};
			return h$3("section", {
				className: "lp-card lp-stepper",
				id: "lp-stepper",
				"aria-labelledby": "lp-stepper-title"
			}, h$3("div", { className: "lp-stepper-head" }, h$3("div", null, h$3("div", { className: "lp-kicker" }, `开始使用 · 第 ${Math.min(current, 2) + 1} 步，共 3 步`), h$3("h2", {
				className: "lp-h2",
				id: "lp-stepper-title"
			}, props.journey.next.title_zh), h$3("p", { className: "lp-muted lp-stepper-detail" }, props.journey.next.detail_zh))), h$3("ol", { className: "lp-steps-bar" }, ...STEPS.map((step, index) => {
				const state = index < current ? "done" : index === current ? "current" : "todo";
				const isOpen = openKey === step.key;
				return h$3("li", {
					key: step.key,
					className: `lp-stepbar lp-stepbar-${state} ${isOpen ? "lp-stepbar-open" : ""}`
				}, h$3("button", {
					type: "button",
					className: "lp-stepbar-btn",
					"aria-expanded": isOpen,
					"aria-controls": `lp-step-${step.key}`,
					"aria-current": state === "current" ? "step" : void 0,
					onClick: () => props.onOpen(step.key)
				}, h$3("span", {
					className: "lp-stepbar-num",
					"aria-hidden": true
				}, state === "done" ? h$3(Icon, {
					name: "check",
					size: 14,
					strokeWidth: 2
				}) : String(index + 1)), h$3("span", { className: "lp-stepbar-text" }, h$3("span", { className: "lp-stepbar-title" }, step.title), h$3("span", { className: "lp-stepbar-hint" }, state !== "done" ? step.hint : step.key === "profile" && openFacts > 0 ? `还有 ${openFacts} 个问题可答` : "已完成"))));
			})), h$3("div", {
				className: "lp-step-panel",
				id: `lp-step-${openKey}`,
				role: "region",
				"aria-label": STEPS.find((step) => step.key === openKey)?.title
			}, body(openKey)));
		}
		//#endregion
		//#region src/client/page.ts
		const h$2 = react.default.createElement;
		function Header(props) {
			const journey = props.journey;
			const today = journey?.today ?? localToday();
			const name = journey?.profile.displayName.trim() ?? "";
			const late = journey && (journey.stage === "plan" || journey.stage === "routine");
			return h$2("header", { className: "lp-header" }, h$2("div", { className: "lp-header-text" }, h$2("div", { className: "lp-kicker" }, `LongPi${journey?.version ? ` ${journey.version}` : ""} · 健康`), h$2("h1", { className: "lp-h1" }, `${greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`), h$2("p", { className: "lp-lead" }, `${chineseDate(today)} ${weekday(today)}`, late && journey ? ` · ${journey.next.detail_zh}` : ""), journey ? h$2(RecordsStatusLine, { journey }) : props.failed ? null : h$2(Skeleton, {
				height: 18,
				width: 240
			})), h$2("div", { className: "lp-actions" }, h$2("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: props.onRefresh,
				disabled: props.refreshing,
				"aria-busy": props.refreshing
			}, h$2(Icon, {
				name: "refresh",
				size: 14,
				className: props.refreshing ? "lp-spin" : ""
			}), props.refreshing ? "刷新中" : "刷新"), h$2(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: `longpi-report-${today}.md`
			}, "导出报告"), h$2(LinkButton, {
				href: "/api/longpi/calendar.ics",
				icon: "calendar",
				download: "longpi.ics"
			}, "加入日历")));
		}
		function Loading() {
			return h$2("div", {
				className: "lp-loading",
				"aria-busy": true,
				"aria-label": "正在读取"
			}, h$2("div", { className: "lp-results" }, h$2(Skeleton, {
				height: 260,
				className: "lp-card-skeleton"
			}), h$2(Skeleton, {
				height: 260,
				className: "lp-card-skeleton"
			})), h$2(Skeleton, {
				height: 180,
				className: "lp-card-skeleton"
			}));
		}
		function Failed(props) {
			return h$2("div", {
				className: "lp-card lp-failed",
				role: "alert"
			}, h$2("div", { className: "lp-strong" }, "LongPi 没有读到数据"), h$2("p", { className: "lp-muted" }, `服务返回：${props.error}。通常是 DSH 刚启动、插件还在加载，稍等几秒再试。`), h$2(Btn, {
				variant: "outline",
				size: "sm",
				onClick: props.onRetry
			}, h$2(Icon, {
				name: "refresh",
				size: 14
			}), "重试"));
		}
		function ProfileAndSelf(props) {
			return h$2(Section, {
				id: "lp-profile-section",
				title: "档案与自测",
				kicker: "只保存在这台电脑上"
			}, h$2("div", { className: "lp-grid-2 lp-grid-top" }, h$2("div", {
				className: "lp-card",
				id: "lp-profile-card"
			}, h$2("div", { className: "lp-label" }, "档案"), props.profileInStepper ? h$2("div", { className: "lp-pointer" }, h$2("p", { className: "lp-muted" }, props.journey.consent.accepted ? "档案正在上方“建档”这一步填写，填好年龄和性别就能算身体年龄。" : "先在上方读一下说明并点“开始”，然后在同一处填写档案。"), h$2(Btn, {
				size: "sm",
				variant: "outline",
				onClick: props.onOpenProfileStep
			}, "去填写", h$2(Icon, {
				name: "arrow",
				size: 14
			}))) : h$2(ProfileEditor, {
				journey: props.journey,
				variant: "page",
				idPrefix: "lp-profile",
				onNotice: props.onNotice
			})), h$2("div", {
				className: "lp-card",
				id: "lp-self-card"
			}, h$2("div", { className: "lp-label" }, "自测", h$2("span", { className: "lp-optional" }, "腰围 · 家庭血压 · 体重")), h$2(SelfLatestList, { latest: props.journey.self.latest }), h$2(SelfMeasureForm, {
				journey: props.journey,
				idPrefix: "lp-self",
				onNotice: props.onNotice
			}), h$2("p", { className: "lp-fine" }, "家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。早晚各量一次、每次坐着休息 5 分钟后再量。"), h$2(SelfRecent, { onNotice: props.onNotice }))));
		}
		function LongPiPage(props) {
			const root = react.default.useRef(null);
			usePageShown(root);
			const { journey, loading, error, refresh } = useJourney();
			const board = useBoard();
			const tracking = useTracking();
			const [notice, notify] = useNotice();
			const [openStep, setOpenStep] = react.default.useState(null);
			const [refreshing, setRefreshing] = react.default.useState(false);
			const stage = journey?.stage;
			const early = stage != null && stepOf(stage) < 3;
			react.default.useEffect(() => {
				setOpenStep(null);
			}, [stage]);
			const doRefresh = react.default.useCallback(async () => {
				setRefreshing(true);
				try {
					await refresh(true);
				} finally {
					setRefreshing(false);
				}
			}, [refresh]);
			const onAction = (target) => {
				if (early && (target === "profile" || target === "records" || target === "addons")) {
					setOpenStep(target === "addons" ? "first_result" : target);
					goTo("lp-stepper");
					return;
				}
				goTo(target === "self" ? "lp-self-card" : target === "profile" ? "lp-profile-card" : "lp-results");
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
			if (!journey && loading) body = h$2(Loading);
			else if (!journey) body = h$2(Failed, {
				error: error ?? "没有返回",
				onRetry: () => {
					doRefresh();
				}
			});
			else {
				const trackingData = tracking.data;
				const showPlan = journey.plan.exists || stage === "plan" || stage === "routine";
				body = h$2("div", { className: `lp-body ${refreshing ? "lp-refreshing" : ""}` }, early ? h$2(JourneyStepper, {
					journey,
					open: openStep,
					onOpen: setOpenStep,
					onRecheck: doRefresh,
					onNotice: notify
				}) : null, h$2(ResultsRow, {
					journey,
					tracking: trackingData,
					canShowAddons: early,
					onAction,
					onNotice: notify
				}), showPlan ? h$2(PlanSection, {
					journey,
					tracking: trackingData,
					loading: tracking.loading,
					onNotice: notify,
					onPrompt
				}) : null, showPlan ? h$2(Markers, { tracking: trackingData }) : null, showPlan ? h$2(Goals, { tracking: trackingData }) : null, showPlan ? h$2(NextSteps, { tracking: trackingData }) : null, h$2(ProfileAndSelf, {
					journey,
					profileInStepper: early && openStepOf(journey, openStep) === "profile",
					onNotice: notify,
					onOpenProfileStep: () => {
						setOpenStep("profile");
						goTo("lp-stepper");
					}
				}), h$2(FollowupSection, { onNotice: notify }), h$2(MethodsSection, {
					board: board.data,
					loading: board.loading,
					error: board.error,
					onNotice: notify
				}));
			}
			return h$2("div", {
				className: "lp lp-page-root",
				ref: root
			}, h$2("div", { className: "lp-page" }, h$2(Header, {
				journey,
				failed: !journey && !loading,
				refreshing,
				onRefresh: () => {
					doRefresh();
				}
			}), notice ? h$2("div", { className: "lp-notice-slot" }, notice) : null, body, h$2("footer", { className: "lp-footer" }, h$2("p", null, journey?.boundary_zh || "模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。"), h$2("p", { className: "lp-caption" }, "档案、方案、打卡和自测只保存在这台电脑上，病历在你自己的 Mirobody 中；只有对话内容会发送给 DeepSeek 模型处理。"))));
		}
		//#endregion
		//#region src/client/pill.ts
		const h$1 = react.default.createElement;
		const HIDE_KEY = "dsh-plugin-longpi.pill-hidden-on";
		function hiddenOn() {
			try {
				return window.localStorage.getItem(HIDE_KEY);
			} catch {
				return null;
			}
		}
		function hideFor(day) {
			try {
				window.localStorage.setItem(HIDE_KEY, day);
			} catch {}
		}
		function Pill(props) {
			const { journey } = useJourney();
			const today = journey?.today ?? localToday();
			const [dismissed, setDismissed] = react.default.useState(() => hiddenOn() === today);
			react.default.useEffect(() => {
				setDismissed(hiddenOn() === today);
			}, [today]);
			const due = (journey?.reminders ?? []).filter((row) => row.due);
			if (!journey || due.length === 0 || dismissed || props.pageShowing) return null;
			const summary = due.map((row) => row.text_zh).join("；");
			return h$1("div", {
				className: "lp lp-pill-wrap",
				role: "status"
			}, h$1("button", {
				type: "button",
				className: "lp-pill-main",
				onClick: () => props.openPage?.(),
				title: summary,
				"aria-label": `LongPi 今天 ${due.length} 项待办：${summary}。打开健康页`
			}, h$1("span", { className: "lp-pill-mark" }, h$1(Mark, { size: 14 })), h$1("span", null, "LongPi · 今天 ", h$1("span", { className: "lp-pill-count" }, due.length), " 项待办")), h$1("button", {
				type: "button",
				className: "lp-pill-x",
				"aria-label": "今天不再提醒",
				onClick: () => {
					hideFor(today);
					setDismissed(true);
				}
			}, h$1(Icon, {
				name: "close",
				size: 12
			})));
		}
		function WithPanelInfo(props) {
			const active = props.usePanelInfo((info) => info.activePanelId === PANEL_ID);
			return h$1(Pill, {
				...props,
				pageShowing: active
			});
		}
		function WithoutPanelInfo(props) {
			const showing = usePageShowing();
			return h$1(Pill, {
				...props,
				pageShowing: showing
			});
		}
		function ReminderPill(props) {
			return typeof props.usePanelInfo === "function" ? h$1(WithPanelInfo, {
				...props,
				usePanelInfo: props.usePanelInfo
			}) : h$1(WithoutPanelInfo, props);
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

/* --- journey stepper and first-run steps -------------------------------------------------- */
.lp-stepper { padding: 24px 24px 6px; margin-bottom: 16px; }
.lp-stepper-head .lp-h2 { font-size: 20px; line-height: 28px; }
.lp-stepper-detail { margin: 4px 0 0; }
.lp-steps-bar { list-style: none; margin: 20px -8px 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.lp-stepbar { position: relative; padding-top: 10px; }
.lp-stepbar::before { content: ""; position: absolute; top: 0; left: 8px; right: 8px; height: 3px; border-radius: 2px; background: var(--lp-line-2); }
.lp-stepbar-done::before { background: var(--lp-good); }
.lp-stepbar-current::before { background: var(--lp-brand); }
.lp-stepbar-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px; border: 0; border-radius: 12px; background: transparent; color: inherit; text-align: left; cursor: pointer; transition: background-color .15s ease; }
.lp-stepbar-btn:hover { background: var(--lp-hover); }
.lp-stepbar-open .lp-stepbar-btn { background: var(--lp-hover); }
.lp-stepbar-num { width: 26px; height: 26px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; color: var(--lp-ink-2); box-shadow: inset 0 0 0 1px var(--lp-line-3); }
.lp-stepbar-current .lp-stepbar-num { background: var(--lp-brand); color: var(--lp-on-brand); box-shadow: none; }
.lp-stepbar-done .lp-stepbar-num { background: var(--lp-good-wash); color: var(--lp-good-ink); box-shadow: none; }
.lp-stepbar-text { display: flex; flex-direction: column; min-width: 0; }
.lp-stepbar-title { font-size: 14px; line-height: 20px; font-weight: 500; }
.lp-stepbar-todo .lp-stepbar-title { color: var(--lp-ink-2); }
.lp-stepbar-hint { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@container lp-root (max-width: 620px) { .lp-stepbar-hint { display: none; } }
.lp-step-panel { margin: 14px -24px 0; padding: 22px 24px 20px; border-top: .5px solid var(--lp-line-2); }
.lp-step-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.lp-step-body > .lp-form-actions { margin-top: 0; }
.lp-consent { display: grid; gap: 12px; }
.lp-consent-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-consent-row p { margin: 0; color: var(--lp-ink); line-height: 24px; }
.lp-consent-icon { width: 28px; height: 28px; flex: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-hover); color: var(--lp-ink-2); }
.lp-connected { display: flex; align-items: center; gap: 12px; }
.lp-connected-icon { width: 32px; height: 32px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-howto { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.lp-howto li::marker { color: var(--lp-ink-3); }
.lp-howto code { padding: 1px 6px; border-radius: 6px; background: var(--lp-hover); font-size: 12px; }
.lp-code { min-width: 0; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 10px; background: var(--lp-well); box-shadow: inset 0 0 0 .5px var(--lp-line-2); }
.lp-code code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; color: var(--lp-ink-2); font-size: 12px; line-height: 20px; scrollbar-width: none; }
.lp-code code, .lp-howto code { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); }
.lp-cans { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.lp-can { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.lp-can-mark { width: 16px; height: 16px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); background: var(--lp-hover); transform: translateY(3px); }
.lp-can-ok { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-first { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-first-cell { padding: 14px 16px; border-radius: 12px; background: var(--lp-well); min-width: 0; }
.lp-first-cell .lp-blocker { margin-top: 2px; font-size: 13px; line-height: 20px; }
.lp-first-wait { margin-top: 6px; font-size: 18px; line-height: 26px; font-weight: 500; }
.lp-first-figure { font-size: 32px; line-height: 40px; font-weight: 500; margin-top: 2px; font-variant-numeric: tabular-nums; }
.lp-first-figure .lp-bignum-unit { margin-left: 4px; font-size: 14px; }
.lp-first-addons .lp-subhead { margin-top: 18px; }
.lp-pointer { display: grid; gap: 12px; justify-items: start; }

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
.lp-optin { display: grid; gap: 2px; margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: var(--lp-well); }
.lp-optin .lp-caption { padding-left: 24px; }
.lp-optin .lp-check .lp-icon { color: var(--lp-ink-2); }

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
.lp-hero-est {
  display: inline-block; margin-left: 8px; padding: 0 6px; border-radius: 9px; border: .5px solid var(--lp-line-3);
  font-size: 11px; line-height: 16px; color: var(--lp-ink-3); vertical-align: 2px; white-space: nowrap;
}

/* --- the row under the composer (conversation.composer.dock, only with the greeting) ------------- */
.lp-home-row {
  width: 100%; max-width: var(--dsh-composer-card-max-width, 744px); margin: 12px auto 0; padding: 0 8px;
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

.lp-spin { animation: lp-spin 1s linear infinite; }
@keyframes lp-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-pulse { 50% { opacity: .45; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .lp-card, .lp-win, .lp-pop, .lp-skeleton, .lp-hero, .lp-home-row, .lp-task-ring, .lp-pill-wrap, .lp-notice, .lp-spin { animation: none; }
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
		//#region src/client/index.ts
		const h = react.default.createElement;
		const inject = ["slots", "layout"];
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
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "dsh-plugin-longpi",
				order: 10,
				inject: face
			}, HomeActions));
			ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
				name: "settings.onboarding",
				id: "longpi",
				order: 100,
				inject: face
			}, Onboarding));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "longpi-reminders",
				order: 50,
				inject: face
			}, ReminderPill));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map