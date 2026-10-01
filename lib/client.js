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
		/** The person this page shows (set when the people list loads); every write carries it. */
		let shownPerson = "";
		function setShownPerson(id) {
			shownPerson = id;
		}
		function writeHeaders() {
			return shownPerson ? {
				...JSON_HEADERS,
				"x-longpi-person": shownPerson
			} : JSON_HEADERS;
		}
		async function getJson(path) {
			return read(await fetch(path, { credentials: "same-origin" }));
		}
		async function postJson(path, body) {
			return read(await fetch(path, {
				method: "POST",
				credentials: "same-origin",
				headers: writeHeaders(),
				body: JSON.stringify(body)
			}));
		}
		/** DELETE carries the JSON content type too (no body): the server's write check applies to every method. */
		async function deleteJson(path) {
			return read(await fetch(path, {
				method: "DELETE",
				credentials: "same-origin",
				headers: writeHeaders()
			}));
		}
		function errorText(error, fallback) {
			return error instanceof Error && error.message ? error.message : fallback;
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
			"testis-transcriptomic-atlas-lifespan": "年龄分段",
			"ckd-epi-2021-egfr": "肾功能 eGFR",
			"navy-circumference-body-fat": "体脂率与腰围"
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
			phenoage_gap: "身体年龄减周岁",
			waist_height_ratio: "腰围身高比",
			waist_hip_ratio: "腰臀比",
			body_fat_pct: "体脂率",
			egfr: "肾功能 eGFR"
		};
		function titleOf(skill, titleZh = "", outputKey = "") {
			if (skill !== "accelerated-biological-aging-risk" && skill !== "china-par-ascvd-risk" && TITLE_BY_OUTPUT[outputKey]) return TITLE_BY_OUTPUT[outputKey];
			if (TITLES[skill]) return TITLES[skill];
			const named = titleZh.trim().replace(/。$/, "");
			if (named && /[\u4e00-\u9fff]/.test(named) && !/[A-Za-z]{4,}/.test(named)) {
				if (named.length <= 22) return named;
				const cut = Math.max(...[
					"，",
					"、",
					"（",
					"："
				].map((p) => named.lastIndexOf(p, 22)));
				return `${named.slice(0, cut >= 8 ? cut : 21)}…`;
			}
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
			const shown = String(Number(value.toFixed(2))).replace(/^-/, "−");
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
			const title = titleOf(row.skill, row.title_zh, out?.key ?? "");
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
		/**
		* A result computed only from the profile's own age and sex (an age band from the age the person typed) tells them
		* nothing new: not a card. Scores computed from their answers or conditions do say something, and stay.
		*/
		function echoesProfile(row) {
			const used = row.inputs_used ?? [];
			return used.length > 0 && used.every((input) => input.provenance === "profile");
		}
		/** Personal results first (PhenoAge and China-PAR stay in the slice), then evidence rows. */
		function overviewSlice(results) {
			const value = results.filter((row) => row.label !== "evidence-only" && hasPersonalOutput(row) && (row.skill === "china-par-ascvd-risk" || !echoesProfile(row))).sort(byLabel);
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
		//#region src/client/charts.ts
		const h$49 = react.default.createElement;
		function dayNumber(iso) {
			return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 864e5);
		}
		function thisYear() {
			return (/* @__PURE__ */ new Date()).getFullYear();
		}
		/** 「9 月 30 日」, with the year only when it is not this year (「2025 年 9 月 12 日」). Not a date: returned as is. */
		function dateZh$1(iso) {
			const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
			if (!match) return iso;
			const [, year, month, day] = match;
			const text = `${Number(month)} 月 ${Number(day)} 日`;
			return Number(year) === thisYear() ? text : `${year} 年 ${text}`;
		}
		/** 「10 月」, with the year when it is not this year (「2027 年 1 月」). */
		function monthLabel(iso) {
			const match = /^(\d{4})-(\d{2})/.exec(iso);
			if (!match) return iso;
			const month = `${Number(match[2])} 月`;
			return Number(match[1]) === thisYear() ? month : `${match[1]} 年 ${month}`;
		}
		/** Every ISO date inside a sentence written as dateZh (「2025-09-12–2026-09-10」 → 「2025 年 9 月 12 日–9 月 10 日」). */
		function datesZh(text) {
			return text.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dateZh$1(iso));
		}
		/**
		* Two decimals under 10, one from 10 up: 1.26 mmol/L, 44.8 岁, 138.7 mmHg. A
		* whole number stays whole (125 mmHg): fmt drops trailing zeros.
		*/
		function fmtAuto(value) {
			if (value == null || !Number.isFinite(value)) return "—";
			return fmt$1(value, Math.abs(value) >= 10 ? 1 : 2);
		}
		function fmt$1(value, digits = 1) {
			if (value == null || !Number.isFinite(value)) return "—";
			const text = value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
			if (text === "-0") return "0";
			return text.startsWith("-") ? `−${text.slice(1)}` : text;
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
			return h$49("div", {
				className: "lp-tip",
				style: {
					left,
					top: Math.max(0, tip.y - 12)
				},
				role: "status"
			}, h$49("div", { className: "lp-tip-title" }, tip.title), ...tip.rows.map((row, index) => h$49("div", {
				className: "lp-tip-row",
				key: index
			}, h$49("span", { className: "lp-tip-value" }, row.value), h$49("span", { className: "lp-tip-label" }, row.label))));
		}
		function LineChart(props) {
			const pointDate = (iso) => props.weekly ? `${dateZh$1(iso)}起一周` : dateZh$1(iso);
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
			if (points.length === 0) return h$49("div", {
				ref,
				className: "lp-chart-empty"
			}, "还没有数据");
			if (points.length === 1) {
				const only = points[0];
				return h$49("div", {
					ref,
					className: "lp-chart-single"
				}, h$49("div", null, h$49("span", { className: "lp-num-md" }, fmt$1(only.value, digits)), props.unit ? h$49("span", { className: "lp-unit" }, props.unit.startsWith("%") ? props.unit : ` ${props.unit}`) : null), h$49("p", { className: "lp-caption" }, `${pointDate(only.date)} · 还需一次复测才能画趋势`));
			}
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
					title: pointDate(point.date),
					rows: [{
						label: props.label,
						value: `${fmt$1(point.value, digits)} ${props.unit}`.trim()
					}]
				});
			};
			const bandFrom = props.band ? Math.max(pad.left, x(dayNumber(props.band.from))) : 0;
			return h$49("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$49("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：${points.map((point) => `${pointDate(point.date)} ${fmt$1(point.value, digits)}${props.unit}`).join("，")}`,
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
			}, ...yTicks.map((value) => h$49("g", { key: `g${value}` }, h$49("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(value),
				y2: y(value),
				className: "lp-grid"
			}), h$49("text", {
				x: pad.left - 6,
				y: y(value) + 3,
				className: "lp-axis",
				textAnchor: "end"
			}, fmt$1(value, value % 1 === 0 ? 0 : digits)))), props.band ? h$49("rect", {
				x: bandFrom,
				width: Math.max(0, width - pad.right - bandFrom),
				y: y(props.band.high),
				height: Math.max(1, y(props.band.low) - y(props.band.high)),
				className: "lp-band",
				rx: 3
			}) : null, props.reference ? h$49("g", null, h$49("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.reference.value),
				y2: y(props.reference.value),
				className: "lp-ref"
			}), props.compact ? null : h$49("text", {
				x: width - pad.right + 4,
				y: y(props.reference.value) + 3,
				className: "lp-axis"
			}, props.reference.label)) : null, props.goal != null ? h$49("g", null, h$49("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.goal),
				y2: y(props.goal),
				className: "lp-goal"
			}), props.compact ? null : h$49("text", {
				x: pad.left + 4,
				y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5),
				className: "lp-goal-text"
			}, `目标 ${fmt$1(props.goal, digits)}`)) : null, h$49("path", {
				d: area,
				className: "lp-area"
			}), h$49("path", {
				d: path,
				className: "lp-line"
			}), focus != null ? h$49("line", {
				x1: x(days[focus]),
				x2: x(days[focus]),
				y1: pad.top,
				y2: height - pad.bottom,
				className: "lp-cross"
			}) : null, ...points.map((point, index) => points.length > 24 && index !== points.length - 1 && index !== focus ? null : h$49("circle", {
				key: `p${index}`,
				cx: x(days[index]),
				cy: y(point.value),
				r: focus === index ? 5.5 : 4,
				className: "lp-dot"
			})), props.compact ? null : h$49("text", {
				x: x(days.at(-1)) + 8,
				y: y(last.value) + 4,
				className: "lp-end"
			}, `${fmt$1(last.value, digits)}`), props.compact ? null : h$49("text", {
				x: pad.left,
				y: height - 6,
				className: "lp-axis"
			}, dateZh$1(points[0]?.date ?? "")), props.compact || points.length < 2 ? null : h$49("text", {
				x: width - pad.right,
				y: height - 6,
				className: "lp-axis",
				textAnchor: "end"
			}, dateZh$1(last.date))), h$49(Tooltip, {
				tip,
				width
			}));
		}
		let measureCtx;
		/** Width of `text` in px as the browser draws it (13px in the page font); an estimate where canvas is unavailable. */
		function textWidth(text, font) {
			if (measureCtx === void 0) try {
				measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
			} catch {
				measureCtx = null;
			}
			if (measureCtx) {
				measureCtx.font = font;
				return measureCtx.measureText(text).width;
			}
			let width = 0;
			for (const char of text) width += char.charCodeAt(0) > 255 ? 13 : 7.5;
			return width;
		}
		/** Cut a label to fit `max` px by its measured width, ending with 「…」. */
		function fitText(text, max, font) {
			if (textWidth(text, font) <= max) return text;
			let out = "";
			for (const char of text) {
				if (textWidth(`${out}${char}…`, font) > max) break;
				out += char;
			}
			return `${out}…`;
		}
		/**
		* The plan on a time axis that starts at today (or at the earliest item, if one began before) and runs at least
		* 12 weeks ahead: the elapsed part of each item solid, the part still ahead as a wash, checkups inside the window as dots.
		*/
		function Timeline$1(props) {
			const first = props.items[0];
			if (first && props.items.every((item) => item.start === first.start && (item.end ?? null) === (first.end ?? null))) {
				const count = props.items.length === 1 ? "这 1 项" : `${props.items.length} 项都`;
				return h$49("p", { className: "lp-small lp-muted" }, `${count}从 ${dateZh$1(first.start)} 开始${first.end ? `，到 ${dateZh$1(first.end)} 结束` : ""}。`);
			}
			return h$49(TimelineChart, props);
		}
		function TimelineChart(props) {
			const [ref, width] = useWidth(560);
			const [tip, setTip] = react.default.useState(null);
			const font = `13px ${ref.current ? getComputedStyle(ref.current).fontFamily : "sans-serif"}`;
			const labelWidth = Math.round(Math.min(220, Math.max(96, width * .3)));
			const row = 34;
			const top = 28;
			const height = top + props.items.length * row + 8;
			const today = dayNumber(props.today);
			const starts = props.items.map((item) => dayNumber(item.start));
			const ends = props.items.map((item) => item.end ? dayNumber(item.end) : today);
			const d0 = Math.min(today, ...starts);
			const inWindow = props.checkups.map(dayNumber).filter((day) => day >= d0);
			const d1 = Math.max(today + 84, ...ends, ...inWindow) + 4;
			const x = linear(d0, d1, labelWidth, width - 12);
			const todayX = x(today);
			const months = [];
			for (let day = d0 + 1; day <= d1; day += 1) {
				const iso = (/* @__PURE__ */ new Date(day * 864e5)).toISOString().slice(0, 10);
				if (iso.endsWith("-01")) months.push(iso);
			}
			const anyAhead = props.items.some((item) => !item.end || dayNumber(item.end) > today);
			const step = Math.max(1, Math.ceil(months.length / Math.max(2, Math.floor((width - labelWidth) / 72))));
			const ticks = months.filter((_, index) => index % step === 0).filter((iso) => Math.abs(x(dayNumber(iso)) - todayX) > 44);
			return h$49("div", { className: "lp-timeline" }, h$49("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$49("svg", {
				width,
				height,
				role: "img",
				"aria-label": `方案时间线：${props.items.map((item) => `${item.title} ${dateZh$1(item.start)} 起`).join("，")}`
			}, ...ticks.map((iso) => h$49("g", { key: iso }, h$49("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 20,
				y2: height - 6,
				className: "lp-grid"
			}), h$49("text", {
				x: x(dayNumber(iso)) + 4,
				y: 12,
				className: "lp-axis"
			}, monthLabel(iso)))), ...inWindow.map((day) => h$49("g", { key: `c${day}` }, h$49("line", {
				x1: x(day),
				x2: x(day),
				y1: 24,
				y2: height - 6,
				className: "lp-checkup"
			}), h$49("circle", {
				cx: x(day),
				cy: 24,
				r: 3,
				className: "lp-checkup-dot"
			}))), h$49("line", {
				x1: todayX,
				x2: todayX,
				y1: 20,
				y2: height - 6,
				className: "lp-today"
			}), h$49("text", {
				x: todayX + 4,
				y: 12,
				className: "lp-axis"
			}, "今天"), ...props.items.map((item, index) => {
				const y0 = top + index * row + row / 2;
				const x0 = x(dayNumber(item.start));
				const endDay = item.end ? dayNumber(item.end) : d1;
				const done = endDay < today;
				const x1 = x(Math.min(endDay, today));
				const ahead = done ? 0 : x(endDay) - Math.max(x0, x1);
				return h$49("g", {
					key: item.id,
					onPointerEnter: () => setTip({
						x: Math.max(x0, todayX),
						y: y0 - 8,
						title: item.title,
						rows: [{
							label: item.subtitle,
							value: item.headline
						}]
					}),
					onPointerLeave: () => setTip(null)
				}, h$49("text", {
					x: 0,
					y: y0 + 4,
					className: "lp-row-label"
				}, h$49("title", null, item.title), fitText(item.title, labelWidth - 16, font)), h$49("rect", {
					x: labelWidth,
					y: y0 - 12,
					width: width - labelWidth,
					height: 24,
					className: "lp-hit"
				}), ahead > 0 ? h$49("rect", {
					x: Math.max(x0, x1),
					y: y0 - 5,
					width: ahead,
					height: 10,
					rx: 5,
					className: "lp-cbar-ahead"
				}) : null, h$49("rect", {
					x: x0,
					y: y0 - 5,
					width: Math.max(10, x1 - x0),
					height: 10,
					rx: 5,
					className: done ? "lp-cbar-muted" : "lp-cbar"
				}));
			})), h$49(Tooltip, {
				tip,
				width
			})), h$49("div", { className: "lp-legend-inline" }, h$49("span", { className: "lp-key-bar" }), "已进行", anyAhead ? h$49(react.default.Fragment, null, h$49("span", { className: "lp-key-ahead" }), "接下来") : null, inWindow.length > 0 ? h$49(react.default.Fragment, null, h$49("span", { className: "lp-key-dot" }), "体检日") : null));
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
			return h$49("div", {
				className: "lp-strip",
				style: {
					width,
					height: 79
				}
			}, h$49("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === "done").length} 天`
			}, ...props.calendar.map((day, index) => h$49("rect", {
				key: day.date,
				x: Math.floor(index / 7) * 11,
				y: index % 7 * 11,
				width: cell,
				height: cell,
				rx: 2,
				className: `lp-cell-${day.status}`,
				onPointerEnter: () => setTip({
					x: Math.floor(index / 7) * 11,
					y: index % 7 * 11,
					title: dateZh$1(day.date),
					rows: [{
						label: props.label,
						value: statusZh[day.status] ?? day.status
					}]
				}),
				onPointerLeave: () => setTip(null)
			}))), h$49(Tooltip, {
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
			return h$49("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$49("svg", {
				width,
				height,
				role: "img",
				"aria-label": props.rows.map((row) => `${row.label} ${row.detail}：${fmt$1(row.value)}${row.unit}`).join("，")
			}, ...props.rows.map((item, index) => {
				const y0 = index * row;
				const length = Math.max(3, Math.abs(item.value) / max * barMax);
				return h$49("g", { key: item.label }, h$49("text", {
					x: 0,
					y: y0 + 14,
					className: "lp-row-label"
				}, item.label, item.detail ? h$49("tspan", {
					dx: 8,
					className: "lp-axis"
				}, item.detail) : null), h$49("path", {
					d: roundedBar(0, y0 + 22, length, 10),
					className: item.value <= 0 ? "lp-cbar" : "lp-cbar-muted"
				}), h$49("text", {
					x: length + 8,
					y: y0 + 31,
					className: "lp-end"
				}, `${item.value > 0 ? "+" : ""}${fmt$1(item.value)} ${item.unit}`));
			})));
		}
		/** A bar square at its baseline and rounded (4px) at its data end. */
		function roundedBar(x, y, length, thickness) {
			const r = Math.min(4, length / 2, thickness / 2);
			return `M${x},${y}H${x + length - r}Q${x + length},${y} ${x + length},${y + r}V${y + thickness - r}Q${x + length},${y + thickness} ${x + length - r},${y + thickness}H${x}Z`;
		}
		/** A 0–1 meter. With no value it renders nothing (null): an empty ring says nothing, so the caller shows .lp-empty instead. */
		function Ring(props) {
			if (props.value == null || !Number.isFinite(props.value)) return null;
			const size = props.size ?? 64;
			const stroke = 7;
			const radius = (size - stroke) / 2;
			const length = 2 * Math.PI * radius;
			const share = Math.max(0, Math.min(1, props.value));
			return h$49("svg", {
				width: size,
				height: size,
				role: "img",
				"aria-label": `${props.label} ${Math.round(share * 100)}%`,
				className: "lp-ring"
			}, h$49("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-track",
				strokeWidth: stroke
			}), h$49("circle", {
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
			return h$49("details", { className: "lp-twin" }, h$49("summary", null, "表格"), h$49("table", null, h$49("caption", null, props.caption), h$49("thead", null, h$49("tr", null, ...props.head.map((cell) => h$49("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$49("tbody", null, ...props.rows.map((row, index) => h$49("tr", { key: index }, ...row.map((cell, column) => h$49("td", { key: column }, cell)))))));
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
			const year = Number(match[1]);
			return year !== (/* @__PURE__ */ new Date()).getFullYear() ? `${year} 年 ${month} 月 ${day} 日` : `${month} 月 ${day} 日`;
		}
		function chineseMonth(iso) {
			if (!iso) return "";
			const match = /^(\d{4})-(\d{2})/.exec(iso);
			if (!match) return "";
			const month = Number(match[2]);
			if (!Number.isInteger(month) || month < 1 || month > 12) return "";
			return `${match[1]} 年 ${month} 月`;
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
			const text = fmt$1(percent, Math.abs(percent) < 10 ? 1 : 0);
			if (text === "—") return text;
			if (Number(text) === 0) return "0%";
			return `${percent > 0 ? "+" : ""}${text.replace(/^-/, "−")}%`;
		}
		/** How the body age compares with the calendar age, in words. */
		/**
		* Body age against the calendar. A single blood draw is never presented as "younger" (PLAN §B5, FINDINGS 54):
		* it is a model estimate from one draw, said as such; "younger" needs at least two complete checkups.
		*/
		function versusAge(advance, checkups = 2) {
			if (advance == null || !Number.isFinite(advance)) return "";
			if (Math.abs(advance) < .5) return "和实足年龄相当";
			if (advance < 0 && (checkups ?? 0) < 2) return `一次检查算出来的数（模型估计，不是诊断），比周岁小 ${fmt$1(-advance)} 岁。一次检查不能说明你变年轻了`;
			return advance < 0 ? `比实足年龄年轻 ${fmt$1(-advance)} 岁` : `比实足年龄大 ${fmt$1(advance)} 岁`;
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
		/** Machine field names that can reach a sentence through a source quote, in the words the page uses. */
		const FIELD_ZH = {
			sleepDuration: "睡眠时长",
			sleepHours: "睡眠时长",
			deepSleep: "深睡",
			remSleep: "快速眼动睡眠",
			sleepScore: "睡眠评分",
			steps: "步数",
			stepCount: "步数",
			restingHeartRate: "静息心率",
			heartRate: "心率",
			hrv: "心率变异性",
			heartRateVariability: "心率变异性",
			vo2max: "最大摄氧量",
			vo2Max: "最大摄氧量",
			activeCalories: "活动消耗",
			exerciseMinutes: "运动时长",
			weight: "体重",
			bmi: "BMI",
			waist: "腰围",
			systolic: "收缩压",
			diastolic: "舒张压",
			spo2: "血氧"
		};
		/**
		* Units and field names as a lab report prints them (#19): umol/L → μmol/L, kg/m2 → kg/m², 1.73m2 → 1.73m²,
		* a bare "5.6 h" → 5.6 小时, and camelCase field names in plain Chinese. Anything unknown is left as it is.
		*/
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
		/** The one place units, field names and number signs are made readable; every page goes through it. */
		function plainUnits(text) {
			return text.replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b|\b(?:steps|hrv|spo2|waist|weight|systolic|diastolic|vo2max)\b/g, (word) => FIELD_ZH[word] ?? word).replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, "$1μ$2").replace(/(×)?10\^(\d+)\//g, (_, _times, power) => `×10${[...power].map((digit) => SUPERSCRIPT[digit] ?? digit).join("")}/`).replace(/(\d)\s+%/g, "$1%").replace(/\s+([（【「])/g, "$1").replace(/([）】」])\s+(?=[\w\u4e00-\u9fff])/g, "$1").replace(/(\d|\/)m2\b/g, "$1m²").replace(/\bm2\b/g, "m²").replace(/(\d)\s*h\b(?![\w/])/g, "$1 小时").replace(/(\d)\s*min\b/g, "$1 分钟").replace(/(^|[^\w.\-−])-(?=\d)/g, "$1−");
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
		function num$2(value) {
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
			const age = num$2(raw.age);
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
				birthYear: num$2(raw.birthYear),
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
			const phenoage = num$2(bio.phenoage);
			const riskPct = num$2(risk.risk_pct);
			return {
				bioage: {
					status: bio.status === "ok" && phenoage != null ? "ok" : "blocked",
					phenoage,
					advance: num$2(bio.advance),
					date: strOrNull(bio.date),
					checkups: num$2(bio.checkups) ?? 0,
					band_years: num$2(bio.band_years),
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
			return objects(value).filter((row) => str(row.date) && num$2(row.value) != null).map((row) => ({
				date: str(row.date),
				value: num$2(row.value)
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
			const from = num$2(compare.from);
			const to = num$2(compare.to);
			const pct = num$2(compare.pct);
			const up = num$2(band.up);
			const down = num$2(band.down);
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
				latest: objects(raw.latest).filter((row) => SELF_KEYS.includes(row.key) && num$2(row.value) != null).map((row) => ({
					key: row.key,
					label_zh: str(row.label_zh),
					value: num$2(row.value),
					unit: str(row.unit),
					date: str(row.date),
					n: num$2(row.n) ?? 1
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
				version: num$2(raw.version),
				items: num$2(raw.items) ?? 0,
				started: strOrNull(raw.started),
				days: num$2(raw.days),
				checkin_items: objects(raw.checkin_items).filter((row) => typeof row.id === "string").map((row) => ({
					id: row.id,
					title: str(row.title, row.id),
					done_today: checkStateOf$1(row.done_today, legacy)
				})),
				streak: num$2(raw.streak) ?? 0,
				adherence_pct: num$2(raw.adherence_pct)
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
					indicator_count: num$2(records.indicator_count) ?? 0,
					full_checkups: num$2(records.full_checkups) ?? 0,
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
			const checkups = num$2(raw.checkups);
			if (checkups == null) return null;
			return {
				checkups,
				first_date: strOrNull(raw.first_date),
				last_date: strOrNull(raw.last_date),
				categories_zh: strings$2(raw.categories_zh),
				wearable_days: num$2(raw.wearable_days) ?? 0
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
			const value = num$2(target.value);
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
					value: num$2(row.value),
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
							value: num$2(effect.value) ?? 0,
							unit: str(effect.unit),
							...typeof effect.kind === "string" ? { kind: effect.kind } : {}
						},
						duration_weeks: num$2(row.duration_weeks),
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
					adherence_pct: num$2(row.adherence_pct)
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
			const goals = draft ? objects(draft.goals).filter((row) => str(row.marker) && num$2(row.value) != null).map((row) => ({
				marker: str(row.marker),
				value: num$2(row.value),
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
			const day = num$2(weekly?.day);
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
			const pct = num$2(raw.pct);
			const up = num$2(band.up);
			const down = num$2(band.down);
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
			const latestValue = latestRaw ? num$2(latestRaw.value) : null;
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
			const cvi = num$2(biovar?.cvi_pct);
			const up = num$2(band.up);
			const down = num$2(band.down);
			const source = obj(biovar?.source);
			return {
				row,
				all_points: objects(raw.all_points).filter((point) => str(point.date) && (num$2(point.value) != null || str(point.text))).slice(0, 200).map((point) => ({
					date: str(point.date),
					value: num$2(point.value),
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
		function useHeroShowing() {
			react.default.useSyncExternalStore(subscribe, () => version$1, () => version$1);
			return false;
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
		//#region src/client/icons.ts
		const h$48 = react.default.createElement;
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
			return h$48("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: `lp-icon ${props.className ?? ""}`.trim()
			}, h$48("path", {
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
			return h$48("span", {
				className: "lp-mark",
				"aria-hidden": true
			}, h$48(Icon, {
				name: "health",
				size: props.size ?? 16
			}));
		}
		const VERDICT_STYLE = {
			有效: {
				icon: "check",
				className: "lp-badge-good"
			},
			波动内: {
				icon: "within",
				className: "lp-badge-neutral"
			},
			反向: {
				icon: "worse",
				className: "lp-badge-warn"
			},
			无法判断: {
				icon: "unknown",
				className: "lp-badge-neutral"
			}
		};
		/** Verdicts always travel with an icon and a label, never color alone. */
		function VerdictChip(props) {
			const label = VERDICT_STYLE[props.verdict] ? props.verdict : "无法判断";
			const style = VERDICT_STYLE[label];
			return h$48("span", { className: `lp-badge ${style.className}` }, h$48(Icon, {
				name: style.icon,
				size: 12
			}), label);
		}
		//#endregion
		//#region src/client/ui.ts
		const h$47 = react.default.createElement;
		function Section(props) {
			const headingId = props.id ? `${props.id}-title` : void 0;
			return h$47("section", {
				className: `lp-section ${props.className ?? ""}`.trim(),
				id: props.id,
				"aria-labelledby": headingId
			}, h$47("div", { className: "lp-section-head" }, h$47("div", { className: "lp-section-titles" }, props.kicker ? h$47("div", { className: "lp-kicker" }, props.kicker) : null, h$47("h2", {
				className: "lp-h2",
				id: headingId
			}, props.title)), props.aside ?? null), props.children);
		}
		function Skeleton(props) {
			return h$47("div", {
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
			return h$47(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				size: "md",
				...props,
				className: `lp-btn ${props.size === "sm" ? "lp-btn-sm" : ""} ${props.className ?? ""}`.trim()
			});
		}
		/** A download link dressed as a DSH outline button (a real <a>, so the browser saves it). */
		function LinkButton(props) {
			return h$47("a", {
				className: "lp-linkbtn",
				href: props.href,
				download: props.download ?? true
			}, props.icon ? h$47(Icon, {
				name: props.icon,
				size: 14
			}) : null, props.children);
		}
		/** A radio group drawn as a segmented control. Nothing selected means "not answered". */
		function Segmented(props) {
			const labelId = `${props.name}-label`;
			return h$47("div", { className: "lp-seg-wrap" }, h$47("span", {
				id: labelId,
				className: props.hideLabel ? "lp-sr" : "lp-field-label"
			}, props.label), h$47("div", {
				className: "lp-seg",
				role: "radiogroup",
				"aria-labelledby": labelId
			}, ...props.options.map((option) => h$47("label", {
				key: option.value,
				className: `lp-seg-opt ${props.value === option.value ? "lp-seg-on" : ""}`
			}, h$47("input", {
				type: "radio",
				name: props.name,
				value: option.value,
				checked: props.value === option.value,
				disabled: props.disabled,
				onChange: () => props.onChange(option.value)
			}), h$47("span", null, option.label)))));
		}
		function ToggleChip(props) {
			return h$47("button", {
				type: "button",
				className: `lp-toggle ${props.pressed ? "lp-toggle-on" : ""}`,
				"aria-pressed": props.pressed,
				onClick: props.onClick
			}, props.badge ? h$47("span", {
				className: "lp-toggle-badge",
				"aria-hidden": true
			}, props.badge) : null, props.children);
		}
		/** An on/off switch: a real button with role=switch, labelled by its visible text. */
		function Switch(props) {
			return h$47("button", {
				type: "button",
				role: "switch",
				id: props.id,
				"aria-describedby": props.describedBy,
				"aria-checked": props.checked,
				"aria-busy": props.busy || void 0,
				disabled: props.disabled,
				className: `lp-switch ${props.checked ? "lp-switch-on" : ""}`,
				onClick: () => props.onChange(!props.checked)
			}, h$47("span", {
				className: "lp-switch-track",
				"aria-hidden": true
			}, h$47("span", { className: "lp-switch-thumb" })), h$47("span", { className: "lp-switch-label" }, props.label));
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
			return [notice ? h$47("div", {
				className: `lp-notice lp-notice-${notice.tone}`,
				role: "status"
			}, h$47(Icon, {
				name: notice.tone === "good" ? "check" : notice.tone === "bad" ? "info" : "info",
				size: 14
			}), h$47("span", null, notice.text), h$47("button", {
				type: "button",
				className: "lp-notice-x",
				"aria-label": "关闭提示",
				onClick: () => setNotice(null)
			}, h$47(Icon, {
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
			return h$47("span", {
				className: "lp-info-wrap",
				ref: wrap
			}, h$47("button", {
				type: "button",
				className: "lp-info-btn",
				"aria-label": `${props.label}：说明`,
				"aria-expanded": open,
				"aria-controls": id,
				onClick: () => setOpen((current) => !current)
			}, h$47(Icon, {
				name: "info",
				size: 14
			})), open ? h$47("span", {
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
			return h$47("div", {
				className: "lp-tabs",
				role: "tablist",
				"aria-label": props.label
			}, ...props.tabs.map((tab, index) => h$47("button", {
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
			}, tab.label, tab.badge ? h$47("span", { className: "lp-tab-badge" }, tab.badge) : null)));
		}
		/** An error in place of content that did not load, with a retry: never an empty state. */
		function LoadError(props) {
			const [busy, setBusy] = react.default.useState(false);
			return h$47("div", {
				className: `lp-loaderror ${props.compact ? "lp-loaderror-compact" : "lp-card"}`,
				role: "alert"
			}, h$47(Icon, {
				name: "warn",
				size: 14
			}), h$47("span", { className: "lp-loaderror-text" }, `没有读到${props.what}${props.error ? `：${props.error}` : ""}。`), h$47("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy,
				onClick: () => {
					setBusy(true);
					Promise.resolve(props.onRetry()).finally(() => setBusy(false));
				}
			}, h$47(Icon, {
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
		//#region src/client/home-actions.ts
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
		//#region src/client/datain/upload.ts
		const h$46 = react.default.createElement;
		const PIECE = 24576;
		function fileToBuffer(file) {
			return file.arrayBuffer();
		}
		/** `simple`: one 上传报告 button for a checkup report only (onboarding); otherwise the full form (档案 tab). */
		function ReportUpload(props) {
			const fileRef = react.default.useRef(null);
			const [busy, setBusy] = react.default.useState(false);
			const [status, setStatus] = react.default.useState("");
			const [error, setError] = react.default.useState("");
			const [kind, setKind] = react.default.useState("");
			const [confirmStore, setConfirmStore] = react.default.useState(false);
			const [chosen, setChosen] = react.default.useState("");
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
					setStatus(done.read_back_zh || "已读取这份报告");
					props.onDone?.(done.read_back_zh || "");
				} catch (err) {
					setError(`这份报告没有读取成功：${errorText(err, "原因不明")}。可以换一张更清晰的照片再试。`);
					setStatus("");
				} finally {
					setBusy(false);
				}
			}
			const fileInput = (reportOnly) => h$46("input", {
				id: "lp-report-file",
				type: "file",
				ref: fileRef,
				className: "lp-sr",
				tabIndex: -1,
				"aria-hidden": true,
				accept: reportOnly ? "application/pdf,image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,.csv,.tsv,.txt,.json",
				disabled: busy,
				onChange: (event) => {
					const file = event.target.files?.[0];
					if (file) {
						setChosen(file.name);
						send(file);
					}
					event.target.value = "";
				}
			});
			if (props.simple) return h$46("div", { className: "lp-upload-simple" }, fileInput(true), h$46("span", {
				className: "lp-upload-icon",
				"aria-hidden": true
			}, h$46(UploadGlyph)), h$46(Btn, {
				variant: props.quiet ? "outline" : "primary",
				onClick: () => fileRef.current?.click(),
				disabled: busy
			}, busy ? "正在读取…" : "上传报告"), h$46("span", { className: "lp-caption" }, "照片或 PDF"), busy ? h$46("p", {
				className: "lp-caption lp-upload-status",
				role: "status"
			}, `${status} 通常需要 1–2 分钟。`) : status ? h$46("p", {
				className: "lp-upload-status",
				role: "status"
			}, status) : null, error ? h$46("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
			return h$46("div", {
				id: "lp-report-upload",
				className: "lp-upload-form"
			}, h$46("div", { className: "lp-field" }, h$46("label", {
				className: "lp-field-label",
				htmlFor: "lp-upload-kind"
			}, "文件类型"), h$46("select", {
				id: "lp-upload-kind",
				className: "lp-select",
				value: kind,
				disabled: busy,
				onChange: (event) => setKind(event.target.value)
			}, h$46("option", { value: "" }, "体检报告（PDF 或照片）"), h$46("option", { value: "methylation" }, "甲基化位点表"), h$46("option", { value: "taxa" }, "菌群表"), h$46("option", { value: "proteins" }, "蛋白表"), h$46("option", { value: "conditions" }, "诊断编码"))), kind ? h$46("label", {
				className: "lp-checkrow",
				htmlFor: "lp-upload-confirm"
			}, h$46("input", {
				id: "lp-upload-confirm",
				type: "checkbox",
				checked: confirmStore,
				disabled: busy,
				onChange: (event) => setConfirmStore(event.target.checked)
			}), h$46("span", null, "确认后记在这台电脑上，不送进体检记录")) : null, h$46("div", { className: "lp-field" }, h$46("span", { className: "lp-field-label" }, "文件"), fileInput(false), h$46("div", { className: "lp-upload-pick" }, h$46(Btn, {
				variant: "outline",
				onClick: () => fileRef.current?.click(),
				disabled: busy
			}, busy ? "正在读取…" : "选择文件"), h$46("span", {
				className: "lp-caption lp-upload-chosen",
				role: "status",
				id: "lp-upload-status"
			}, status ? chosen ? `${chosen} · ${status}` : status : chosen || "PDF、照片，或 CSV、TXT 表格"))), error ? h$46("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$46("p", { className: "lp-caption" }, "也可以直接把 PDF 或照片发到健康对话。"));
		}
		/** An upload glyph (arrow up into a tray), drawn like icons.ts's 16px strokes. */
		function UploadGlyph() {
			return h$46("svg", {
				width: 20,
				height: 20,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: "lp-icon"
			}, h$46("path", {
				d: "M8 10V3M5 6l3-3 3 3M3.5 10.5v2h9v-2",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}));
		}
		//#endregion
		//#region src/client/self-measure.ts
		const h$45 = react.default.createElement;
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
				return `${fmt$1(row.value)}${dbp ? `/${fmt$1(dbp.value)}` : ""} ${row.unit}`;
			}
			return `${fmt$1(row.value)} ${row.unit}`;
		}
		/** Latest values as quiet stat chips; blood pressure shows as one weekly mean. */
		function SelfLatestList(props) {
			const rows = props.latest.filter((row) => row.key !== "dbp");
			if (rows.length === 0) return null;
			return h$45("ul", { className: "lp-self-latest" }, ...rows.map((row) => h$45("li", { key: row.key }, h$45("span", { className: "lp-caption" }, row.key === "sbp" ? "家庭血压" : row.label_zh), h$45("span", { className: "lp-self-value" }, selfLatestText(row, props.latest)), h$45("span", { className: "lp-caption" }, row.key === "sbp" ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : "1 次读数"} · 截至 ${chineseDate(row.date)}` : chineseDate(row.date)))));
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
			if (choices.length < 2) return h$45("span", { className: "lp-unit" }, props.spec.unit);
			return h$45("select", {
				id: props.id,
				className: "lp-select lp-self-unit",
				value: props.value,
				"aria-label": props.label,
				onChange: (event) => props.onChange(event.target.value)
			}, ...choices.map((unit) => h$45("option", {
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
			const field = (key, placeholder) => h$45("div", { className: "lp-field" }, h$45("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-${key}`
			}, spec(key).label_zh), h$45("div", { className: "lp-input-unit" }, h$45("input", {
				id: `${props.idPrefix}-${key}`,
				className: "lp-input",
				inputMode: "decimal",
				placeholder,
				value: values[key],
				onChange: (event) => set(key, event.target.value)
			}), h$45(UnitSelect, {
				id: `${props.idPrefix}-${key}-unit`,
				spec: spec(key),
				value: units[key],
				label: `${spec(key).label_zh}的单位`,
				onChange: (unit) => setUnits((current) => ({
					...current,
					[key]: unit
				}))
			})));
			return h$45("form", {
				className: "lp-self-form",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$45("div", { className: "lp-form-grid" }, field("waist", "例如 86"), field("weight", "例如 70.5"), h$45("div", { className: "lp-field lp-field-full" }, h$45("span", {
				className: "lp-field-label",
				id: `${props.idPrefix}-bp`
			}, "家庭血压"), h$45("div", {
				className: "lp-bp",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-bp`
			}, h$45("input", {
				id: `${props.idPrefix}-sbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "收缩压",
				"aria-label": "收缩压（高压）",
				value: values.sbp,
				onChange: (event) => set("sbp", event.target.value)
			}), h$45("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/"), h$45("input", {
				id: `${props.idPrefix}-dbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				value: values.dbp,
				onChange: (event) => set("dbp", event.target.value)
			}), h$45("span", { className: "lp-unit" }, "mmHg"))), h$45("div", { className: "lp-field" }, h$45("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-date`
			}, "测量日期"), h$45("input", {
				id: `${props.idPrefix}-date`,
				className: "lp-input",
				type: "date",
				value: date,
				max: today,
				min: "1990-01-01",
				onChange: (event) => setDate(event.target.value || today)
			}))), error ? h$45("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$45("div", { className: "lp-form-actions" }, h$45(Btn, {
				type: "submit",
				disabled: busy
			}, busy ? "记录中…" : "记录"), h$45("span", { className: "lp-caption" }, "单位可以选斤、尺或寸，会换算成 kg 和 cm。")));
		}
		function SelfRecent(props) {
			const { data, loading, error } = useSelfRows();
			const [busy, setBusy] = react.default.useState(null);
			const rows = (data?.rows ?? []).slice(0, 6);
			if (loading && !data) return null;
			if (!data && error) return h$45(LoadError, {
				what: "自测记录",
				error,
				compact: true,
				onRetry: () => reload("self")
			});
			if (rows.length === 0) return h$45("p", { className: "lp-caption lp-measure" }, "还没有自测记录。");
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
			return h$45("div", null, h$45("div", { className: "lp-subhead" }, "最近记录"), h$45("ul", { className: "lp-rows" }, ...rows.map((row) => h$45("li", {
				key: row.id,
				className: "lp-row"
			}, h$45("span", { className: "lp-row-main" }, h$45("span", null, labelOf(row.key)), h$45("span", { className: "lp-num" }, ` ${fmt$1(row.value)} ${row.unit}`), row.given ? h$45("span", { className: "lp-caption" }, `（记为 ${fmt$1(row.given.value)} ${row.given.unit}）`) : null), h$45("span", { className: "lp-row-end" }, h$45("span", { className: "lp-caption" }, chineseDate(row.date)), h$45("button", {
				type: "button",
				className: "lp-iconbtn",
				disabled: busy === row.id,
				"aria-label": `删除 ${chineseDate(row.date)} 的${labelOf(row.key)} ${fmt$1(row.value)} ${row.unit}`,
				onClick: () => {
					remove(row);
				}
			}, h$45(Icon, {
				name: "trash",
				size: 14
			})))))));
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
			return h$45("form", {
				className: "lp-inline-self",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$45("input", {
				className: "lp-input",
				inputMode: "decimal",
				value,
				placeholder: bp ? "收缩压" : spec.label_zh,
				"aria-label": bp ? "收缩压（高压）" : `${spec.label_zh}`,
				id: `${props.idPrefix}-${props.selfKey}`,
				onChange: (event) => setValue(event.target.value)
			}), bp ? h$45("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/") : null, bp ? h$45("input", {
				className: "lp-input",
				inputMode: "decimal",
				value: dbp,
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				onChange: (event) => setDbp(event.target.value)
			}) : null, bp ? h$45("span", { className: "lp-unit" }, "mmHg") : h$45(UnitSelect, {
				id: `${props.idPrefix}-${props.selfKey}-unit`,
				spec,
				value: unit,
				label: `${spec.label_zh}的单位`,
				onChange: setUnit
			}), h$45(Btn, {
				type: "submit",
				size: "sm",
				disabled: busy
			}, busy ? "记录中" : "记录"));
		}
		//#endregion
		//#region src/client/journey-steps.ts
		const h$44 = react.default.createElement;
		async function acceptConsent() {
			await postJson("/api/longpi/consent", { accept: true });
			notifyChanged();
		}
		/** The records' state in one line; `inline` renders it as a span for the page header's meta line. */
		function RecordsStatusLine(props) {
			const records = props.journey.records;
			const tag = props.inline ? "span" : "div";
			if (recordConnected(records.status) && records.indicator_count > 0) {
				const partial = records.status === "partial";
				return h$44(tag, { className: "lp-status" }, h$44("span", {
					className: `lp-statusdot ${partial ? "lp-statusdot-warn" : "lp-statusdot-on"}`,
					"aria-hidden": true
				}), `已有 ${records.indicator_count} 项指标${records.latest_checkup ? ` · 最近一次体检 ${chineseDate(records.latest_checkup)}` : ""}${partial ? " · 有一部分这次没有读到" : ""}`);
			}
			if (records.status === "error") return h$44(tag, { className: "lp-status" }, h$44("span", {
				className: "lp-statusdot lp-statusdot-bad",
				"aria-hidden": true
			}), `记录读取失败：${records.error || "原因不明"}`);
			return h$44(tag, { className: "lp-status" }, h$44("span", {
				className: "lp-statusdot",
				"aria-hidden": true
			}), recordConnected(records.status) ? "还没有体检记录" : "正在连接健康数据服务…");
		}
		//#endregion
		//#region src/client/onboarding.ts
		const h$43 = react.default.createElement;
		const ONBOARDING_TITLES = [
			"欢迎使用 LongPi",
			"填写基本信息",
			"添加第一份资料"
		];
		/** Short names for the stepper, so step 1 does not repeat the dialog title. */
		const STEP_NAMES = [
			"开始",
			"基本信息",
			"第一份资料"
		];
		/** A journey that has not arrived by then is shown as not read, with a retry. */
		const GIVE_UP_MS = 45e3;
		/** Steps still open, for the page banner (none once a record exists). */
		/** Set when the person finished onboarding without a report: the overview's 上传一份体检报告 card takes over. */
		const UPLOAD_SKIPPED_KEY = "lp-onb-upload-skipped";
		function stepsLeft(journey) {
			if (!journey.consent.accepted) return 3;
			if (!journey.profile.complete) return 2;
			if (recordConnected(journey.records.status) && journey.records.indicator_count > 0) return 0;
			const skipped = readPref(UPLOAD_SKIPPED_KEY);
			return skipped && skipped === (journey.consent.accepted_at ?? "") ? 0 : 1;
		}
		function Progress(props) {
			return h$43("div", {
				className: "lp-stepper",
				"aria-label": `第 ${props.step + 1} 步，共 ${ONBOARDING_TITLES.length} 步`
			}, ...STEP_NAMES.map((title, index) => h$43("div", {
				key: index,
				className: `lp-stepper-item${index === props.step ? " is-now" : index < props.step ? " is-done" : ""}`
			}, h$43("span", { className: "lp-stepper-dot" }, index < props.step ? h$43(Icon, {
				name: "check",
				size: 12
			}) : String(index + 1)), h$43("span", { className: "lp-stepper-label" }, title))));
		}
		/** Chat needs a model key: said only when LongPi could tell none is configured. */
		function ModelHint(props) {
			if (useModelStatus() !== "missing") return null;
			return h$43("div", {
				className: "lp-callout lp-callout-info",
				role: "note"
			}, h$43(Icon, {
				name: "info",
				size: 16
			}), h$43("div", { className: "lp-callout-body" }, h$43("p", null, "对话功能需要先在 DSH 设置里填写模型的 API Key。"), props.onOpen ? h$43(Btn, {
				variant: "outline",
				onClick: props.onOpen
			}, "去设置") : h$43("p", { className: "lp-caption" }, "在左下角「设置 → 模型」中填写。")));
		}
		function NotRead(props) {
			return h$43(OnboardingModal, {
				title: "数据暂时没有加载出来",
				onClose: props.onLater
			}, h$43("div", { className: "lp lp-onb" }, h$43("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, "数据暂时没有加载出来"), h$43("p", { className: "lp-onb-text" }, "可能是刚启动，稍等几秒后点「重试」。"), h$43("div", { className: "lp-onb-actions" }, h$43(Btn, {
				variant: "outline",
				onClick: props.onLater
			}, "稍后再说"), h$43(Btn, {
				"data-modal-autofocus": true,
				onClick: props.onRetry,
				disabled: props.busy
			}, props.busy ? "加载中…" : "重试"))));
		}
		/** One consent covers the notice, the health-data act and the flow to DeepSeek (owner decision, copy v2). */
		async function agreeAll() {
			await acceptConsent();
			await postJson("/api/longpi/privacy/consent", {
				scope: "pipl_sensitive",
				decision: "granted"
			});
			await postJson("/api/longpi/privacy/consent", {
				scope: "data_flow_deepseek",
				decision: "granted"
			});
			notifyChanged();
		}
		function Welcome(props) {
			const [agreed, setAgreed] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState("");
			return h$43("div", { className: "lp-onb-body" }, h$43(ModelHint, { onOpen: props.openSettings }), h$43("p", { className: "lp-onb-text" }, "LongPi 帮你管理自己的健康数据：根据体检结果估算身体年龄和 10 年心血管风险，并跟踪你的改善计划执行得怎么样。"), h$43("p", { className: "lp-onb-text" }, "它只提供健康管理参考，不做诊断，不开处方，也不给出用药剂量。"), h$43("p", { className: "lp-onb-text" }, "你的档案和记录只保存在这台电脑上。你提问时，回答所需的健康数值会发送给 DeepSeek 模型处理，不包含你的姓名。"), h$43("label", {
				className: "lp-checkrow",
				htmlFor: "lp-onb-agree"
			}, h$43("input", {
				id: "lp-onb-agree",
				type: "checkbox",
				checked: agreed,
				disabled: busy,
				onChange: (e) => setAgreed(e.target.checked)
			}), h$43("span", null, "我同意 LongPi 按上述方式使用我的体检、化验、血压、血糖、体重和用药等健康信息。")), h$43("p", { className: "lp-caption" }, "可以随时在「设置 → LongPi → 隐私与数据」中撤回。"), error ? h$43("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$43("div", { className: "lp-onb-actions" }, h$43(Btn, {
				variant: "outline",
				onClick: props.onLater,
				disabled: busy
			}, "以后再说"), h$43(Btn, {
				"data-modal-autofocus": true,
				disabled: !agreed || busy,
				onClick: () => {
					setBusy(true);
					setError("");
					agreeAll().then(props.onDone).catch((err) => setError(`没有保存成功：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
				}
			}, busy ? "正在保存…" : "同意并开始")));
		}
		function BasicInfo(props) {
			const [age, setAge] = react.default.useState(props.journey.profile.age != null ? String(props.journey.profile.age) : "");
			const [sex, setSex] = react.default.useState(props.journey.profile.sex === "male" || props.journey.profile.sex === "female" ? props.journey.profile.sex : "");
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState("");
			const ageNum = Number(age);
			const ageOk = /^\d{1,3}$/.test(age.trim()) && ageNum >= 1 && ageNum <= 120;
			return h$43("div", { className: "lp-onb-body" }, h$43("p", { className: "lp-onb-text" }, "计算身体年龄需要你的年龄和性别。"), h$43("div", { className: "lp-form-grid" }, h$43("label", { className: "lp-field" }, h$43("span", { className: "lp-field-label" }, "年龄（周岁）"), h$43("input", {
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "例如 45",
				value: age,
				disabled: busy,
				"data-modal-autofocus": true,
				onChange: (e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))
			})), h$43("div", { className: "lp-field" }, h$43("span", {
				className: "lp-field-label",
				id: "lp-onb-sex"
			}, "性别"), h$43("div", {
				className: "lp-seg",
				role: "radiogroup",
				"aria-labelledby": "lp-onb-sex"
			}, ...["male", "female"].map((value) => h$43("button", {
				key: value,
				type: "button",
				role: "radio",
				"aria-checked": sex === value,
				disabled: busy,
				className: `lp-seg-item${sex === value ? " is-on" : ""}`,
				onClick: () => setSex(value)
			}, value === "male" ? "男" : "女"))))), h$43("p", { className: "lp-caption" }, "其他问题（如是否吸烟、有无糖尿病）会在计算心血管风险需要时再问。"), error ? h$43("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$43("div", { className: "lp-onb-actions" }, h$43(Btn, {
				variant: "outline",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过"), h$43(Btn, {
				disabled: !ageOk || !sex || busy,
				onClick: () => {
					setBusy(true);
					setError("");
					postJson("/api/longpi/profile", {
						age: ageNum,
						sex
					}).then(() => {
						notifyChanged();
						props.onDone();
					}).catch((err) => setError(`没有保存成功：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
				}
			}, busy ? "正在保存…" : "下一步")));
		}
		function FirstData(props) {
			const [none, setNone] = react.default.useState(false);
			const [read, setRead] = react.default.useState("");
			return h$43("div", { className: "lp-onb-body" }, h$43("p", { className: "lp-onb-text" }, "上传一份体检或化验报告，LongPi 会读取其中的指标，算出你的第一个结果。"), h$43(ReportUpload, {
				simple: true,
				quiet: none,
				onDone: (text) => {
					setRead(text || "已读取这份报告。");
					notifyChanged();
				}
			}), !read && !none ? h$43("div", { className: "lp-onb-center" }, h$43("button", {
				type: "button",
				className: "lp-textbtn lp-textbtn-strong",
				onClick: () => setNone(true)
			}, "我现在没有报告 →")) : null, none && !read ? h$43("div", { className: "lp-callout lp-callout-info" }, h$43(Icon, {
				name: "info",
				size: 16
			}), h$43("div", { className: "lp-callout-body" }, h$43("p", { className: "lp-callout-title" }, "没有报告也可以先开始："), h$43("ul", { className: "lp-bullets" }, h$43("li", null, "记录一次血压或腰围"), h$43("li", null, "在健康对话里说说你想改善什么（睡眠、体重、血糖……）")), h$43("p", { className: "lp-caption" }, "以后拿到体检报告，随时在「健康」页上传。"))) : null, h$43("div", { className: "lp-onb-actions" }, none && !read ? h$43(Btn, {
				variant: "outline",
				onClick: props.openChat
			}, "去健康对话") : null, h$43(Btn, {
				variant: read || none ? "primary" : "outline",
				onClick: () => {
					if (!read && props.consentAt) writePref(UPLOAD_SKIPPED_KEY, props.consentAt);
					props.onFinish();
				}
			}, "完成")));
		}
		function Onboarding(props) {
			const { journey, error: loadError, loading, refresh } = useJourney();
			const [step, setStep] = react.default.useState(null);
			const [timedOut, setTimedOut] = react.default.useState(false);
			const [retrying, setRetrying] = react.default.useState(false);
			const [done, setDone] = react.default.useState(false);
			const content = react.default.useRef(null);
			const storedOpener = useSettingsOpener();
			const openSection = props.openSection ?? storedOpener;
			react.default.useEffect(() => {
				if (props.openSection) setSettingsOpener(props.openSection);
			}, [props.openSection]);
			const finish = react.default.useCallback(() => {
				setDone(true);
				props.complete();
			}, [props]);
			react.default.useEffect(() => {
				if (step != null || !journey) return;
				if (props.initialStep != null) setStep(Math.max(0, Math.min(2, props.initialStep)));
				else setStep(ONBOARDING_TITLES.length - Math.max(1, stepsLeft(journey)));
			}, [
				journey,
				step,
				props.initialStep
			]);
			react.default.useEffect(() => {
				if (journey || timedOut) return void 0;
				const timer = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS);
				return () => window.clearTimeout(timer);
			}, [journey, timedOut]);
			react.default.useEffect(() => {
				(content.current?.querySelector("[data-modal-autofocus]") ?? content.current?.querySelector("h2"))?.focus({ preventScroll: true });
			}, [step]);
			if (done) return null;
			if (!journey) {
				if (!timedOut && !retrying && !(loadError && !loading)) return null;
				return h$43(NotRead, {
					onRetry: () => {
						setRetrying(true);
						setTimedOut(false);
						refresh(true).finally(() => setRetrying(false));
					},
					onLater: finish,
					busy: retrying || loading
				});
			}
			if (step == null) return null;
			const openSettings = openSection ? () => {
				finish();
				openSection("models");
			} : null;
			const openChat = () => {
				finish();
				document.querySelector(".lp-healthchat-btn")?.click();
			};
			return h$43(OnboardingModal, {
				title: ONBOARDING_TITLES[step] ?? ONBOARDING_TITLES[0],
				onClose: finish
			}, h$43("div", {
				className: "lp lp-onb",
				ref: content
			}, h$43(Progress, { step }), h$43("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, ONBOARDING_TITLES[step]), step === 0 ? h$43(Welcome, {
				onDone: () => setStep(1),
				onLater: finish,
				openSettings
			}) : null, step === 1 ? h$43(BasicInfo, {
				journey,
				onDone: () => setStep(2),
				onSkip: () => setStep(2)
			}) : null, step === 2 ? h$43(FirstData, {
				onFinish: finish,
				openChat,
				consentAt: journey.consent.accepted_at ?? ""
			}) : null));
		}
		function OnboardingModal(props) {
			return h$43(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: props.title,
				onClose: props.onClose,
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
			if (/睡眠|入睡|深睡|清醒时间|心率变异|夜间最低血氧/.test(label)) return "sleep";
			if (/步数|运动|活动量|活动消耗|锻炼|卡路里|训练负荷|步行|静息心率|最大摄氧量/.test(label)) return "training";
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
		function notableRows(rows, covered) {
			return rows.filter((row) => !isCovered(covered, row)).slice(0, 3);
		}
		/** The doctor card's detail without the title it repeats: the values once, then what to do. */
		function careDetail(title, detail) {
			if (!detail || detail === title) return "";
			return /^请先去看医生：/.test(title) ? detail.replace(/^请先去看医生：/, "").replace(/请先去看医生。/g, "").replace(/\s{2,}/g, " ").trim() : detail;
		}
		//#endregion
		//#region src/client/changes.ts
		const h$42 = react.default.createElement;
		/** The trend, with the RCV band around the value it was compared from: points outside the band are the change. */
		function Spark(props) {
			const { row } = props;
			if (row.points.length < 2) return null;
			const base = row.compare.from;
			const dated = row.compare.from_date !== "";
			return h$42("div", { className: "lp-change-spark" }, h$42(LineChart, {
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
		/** Units as labs print them: 10^12/L → ×10¹²/L, umol/L → μmol/L, kg/m2 → kg/m². */
		/** Kept for its callers: the same as plainUnits (format.ts), the single formatter. */
		function prettyUnits(text) {
			return plainUnits(text);
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
		const VERDICT_ZH = {
			better: "变好",
			worse: "变差",
			unclear: "需结合参考范围"
		};
		function ChangeChip(props) {
			const tone = props.verdict === "better" && !props.askDoctor ? "good" : props.verdict === "worse" || props.askDoctor ? "warn" : "neutral";
			return h$42("span", { className: `lp-badge lp-badge-${tone}` }, h$42(Icon, {
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
			return plainUnits(`${from.toFixed(digits)} → ${to.toFixed(digits)}`);
		}
		function NotableRow(props) {
			const { row } = props;
			return h$42("li", { className: "lp-notable-row" }, h$42(ChangeChip, {
				verdict: row.verdict,
				askDoctor: row.ask_doctor
			}), h$42("span", { className: "lp-strong" }, row.label_zh), h$42("span", { className: "lp-num lp-notable-values" }, plainUnits(row.compare.from === row.compare.to ? `${row.compare.to} ${row.unit}`.trim() : `${pairText(row.compare.from, row.compare.to)} ${row.unit}`.trim())), h$42(Spark, { row }));
		}
		/** The one plain sentence behind 判断依据 (INT062 fix 7): what "超出正常波动" means, and what it is not. */
		const BASIS_ZH = "「超出正常波动」是说两次结果的差别，比同一个人平常的起伏更大。不同医院、不同仪器之间的差别没有算进去，这也不是诊断。";
		/**
		* 判断依据: one plain sentence and where the fluctuation data comes from. Method notes (CV scales, instrument
		* error, how wide a band may be) are for the chat's tool text, not for this fold.
		*/
		function Basis(props) {
			const { rows } = props;
			const unjudged = props.journey.changes_unjudged;
			if (rows.length === 0 && unjudged.length === 0) return null;
			const sources = distinct(rows.map((row) => row.source), (source) => source.url || source.title);
			return h$42("details", { className: "lp-basis" }, h$42("summary", null, "判断依据"), h$42("div", { className: "lp-change-notes" }, h$42("p", { className: "lp-caption" }, BASIS_ZH), unjudged.length > 0 ? h$42("p", { className: "lp-caption" }, `这几项这次没有读全，先不判断：${unjudged.map((row) => row.label_zh).join("、")}。`) : null, sources.length > 0 ? h$42("p", { className: "lp-caption lp-change-source" }, "数据来源：", ...sources.flatMap((source, index) => [index > 0 ? "；" : null, source.url ? h$42("a", {
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
			const shown = notableRows(rows, covered);
			const advice = groupsOf(shown).filter((group) => group.advice && group.tone === "warn");
			const pointer = onCard.length > 0 ? `${onCard[0]?.label_zh ?? ""}${onCard.length > 1 ? `等 ${onCard.length} 项` : ""}的变化，就是上面「最重要的一步」说的那件事。` : "";
			return h$42("section", {
				className: "lp-card lp-notable",
				id: "lp-changes",
				"aria-labelledby": "lp-changes-title"
			}, h$42("div", { className: "lp-card-head" }, h$42("h3", {
				className: "lp-card-title",
				id: "lp-changes-title"
			}, "值得注意的变化", rows.length > 0 ? h$42("span", { className: "lp-caption" }, `${rows.length} 项超出正常波动`) : null), h$42("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: props.onOpenIndicators
			}, "在「化验」里看全部 →")), pointer ? h$42("p", { className: "lp-caption" }, pointer) : null, ...advice.map((group) => h$42("div", {
				key: group.advice,
				className: "lp-callout lp-callout-warn"
			}, h$42(Icon, {
				name: "warn",
				size: 14
			}), h$42("span", null, group.advice))), shown.length > 0 ? h$42("ul", { className: "lp-notable-list" }, ...shown.map((row) => h$42(NotableRow, {
				key: row.key,
				row
			}))) : pointer ? null : h$42("p", { className: "lp-muted" }, "没有超出正常波动的变化。"), h$42(Basis, {
				journey: props.journey,
				rows
			}));
		}
		//#endregion
		//#region src/client/indicators.ts
		const h$41 = react.default.createElement;
		const SOURCE_ZH = {
			checkup: "体检",
			device: "手环",
			self: "自测"
		};
		/** Names as typeset Chinese: no space hugging a full-width bracket (「比（尿） UACR」 → 「比（尿）UACR」). */
		function cleanLabel$1(text) {
			return text.replace(/\s+([（【「])/g, "$1").replace(/([）】」])\s+/g, "$1");
		}
		/** Units as printed on a lab sheet: μ for micro (uIU/mL → μIU/mL, umol/L → μmol/L). */
		function unitText(unit) {
			return prettyUnits(unit ?? "").replace(/(^|[^A-Za-z])u(IU|mol|g|L)\b/g, "$1μ$2");
		}
		/** A value and its unit: 「62%」 with no space before %, 「3.8 mmol/L」 otherwise. */
		function withUnit$1(value, unit) {
			if (!unit) return value;
			return unit === "%" || unit.startsWith("%") ? `${value}${unit}` : `${value} ${unit}`;
		}
		/** Sentences from the movement helper: ISO dates as 「9 月 10 日」, micro units, no space before %. */
		function tidy$1(text) {
			return datesZh(unitText(text)).replace(/(\d) %/g, "$1%");
		}
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
			return `正常波动：+${fmt$1(biovar.band_pct.up, 1)}% / ${fmt$1(biovar.band_pct.down, 1)}%（个体内变异 ${fmt$1(biovar.cvi_pct, 1)}%）。两次结果之差在这个范围内，多半是测量和生理波动。`;
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
		/** A trend in 88 × 24: the line and the latest point, no axes (the panel has the full chart). Fewer than two values: 「—」. */
		function Sparkline(props) {
			const points = props.points;
			if (points.length < 2) return h$41("span", {
				className: "lp-caption",
				title: points.length === 1 ? "只有 1 次结果" : "没有数值"
			}, "—");
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
			return h$41("svg", {
				width,
				height,
				className: "lp-spark",
				role: "img",
				"aria-label": `${props.label}趋势：${points.map((point) => `${dateZh$1(point.date)} ${fmtAuto(point.value)}`).join("，")}`
			}, h$41("path", {
				d: path,
				className: "lp-spark-line"
			}), h$41("circle", {
				cx: x(points.length - 1),
				cy: y(last.value),
				r: 2.5,
				className: "lp-spark-dot"
			}));
		}
		/** The 「和正常波动比」 cell: a short badge; the full sentence is its tooltip (the toolbar ⓘ explains every word). */
		function JudgedChip(props) {
			const { row } = props;
			const reason = props.reason ?? "";
			if (row.range_flag === "low" || row.range_flag === "high") {
				const low = row.range_flag === "low";
				return h$41("span", {
					className: "lp-badge lp-badge-warn",
					title: row.range_zh || (low ? "低于参考范围" : "高于参考范围")
				}, low ? "偏低" : "偏高");
			}
			const kind = judgementKind({
				gate: props.gate,
				judged: row.judged,
				reason
			});
			const full = judgementText(kind, true);
			if (kind === "beyond") {
				const tone = row.change?.verdict === "better" && !row.change.ask_doctor ? "good" : row.change && row.change.verdict === "unclear" && !row.change.ask_doctor ? "neutral" : "warn";
				return h$41("span", {
					className: `lp-badge lp-badge-${tone}`,
					title: full
				}, judgementText(kind, false));
			}
			if (kind === "within") return h$41("span", {
				className: "lp-badge lp-badge-good",
				title: full
			}, judgementText(kind, false));
			if (kind === "unjudged") {
				const why = row.read_error ? "这项没有读到" : row.points.length < 2 ? "只有一次结果，还不能下结论" : "还缺比较要用的信息，还不能下结论";
				return h$41("span", {
					className: "lp-caption",
					title: why,
					"aria-label": judgementText(kind, false)
				}, "—");
			}
			return h$41("span", {
				className: "lp-caption",
				title: reason || full
			}, judgementText(kind, false));
		}
		function latestText(row) {
			if (!row.latest) return "—";
			if (row.latest.text) return row.latest.text;
			return row.latest.value == null ? "—" : fmtAuto(row.latest.value);
		}
		function panelSlug(id) {
			return id.replace(/[^A-Za-z0-9_-]/g, "_");
		}
		/** One table row: name | latest value + date | trend | vs normal fluctuation | source | chevron. Every cell always has content. */
		function IndicatorLine(props) {
			const { row } = props;
			const slug = panelSlug(row.id);
			const missed = row.read_error ? scrubVisible(row.read_error).replace(/没有在 \d+ 秒内返回这一项/, "这次没有读到，稍后刷新再看") : "";
			const unit = unitText(row.unit);
			const when = row.latest ? dateZh$1(row.latest.date) : "";
			return h$41("li", { className: `lp-ind-row ${props.open ? "lp-ind-open" : ""}` }, h$41("button", {
				type: "button",
				className: "lp-ind-btn",
				"aria-expanded": props.open,
				"aria-controls": `lp-ind-panel-${slug}`,
				onClick: props.onToggle
			}, h$41("span", { className: "lp-ind-name" }, h$41("span", {
				className: "lp-ind-label",
				title: cleanLabel$1(row.label_zh)
			}, cleanLabel$1(row.label_zh)), row.plan_marker ? h$41("span", { className: "lp-tag" }, "方案") : null), missed ? h$41("span", { className: "lp-ind-value" }, h$41("span", {
				className: "lp-ind-error",
				title: missed
			}, h$41(Icon, {
				name: "warn",
				size: 12
			}), "没有读到")) : h$41("span", { className: "lp-ind-value" }, h$41("span", { className: "lp-ind-num" }, unit.startsWith("%") ? `${latestText(row)}${unit}` : latestText(row)), h$41("span", { className: "lp-ind-unit" }, unit.startsWith("%") ? "" : unit)), h$41("span", { className: "lp-ind-date lp-caption" }, missed || !when ? "—" : when), h$41("span", { className: "lp-ind-spark" }, missed ? h$41("span", { className: "lp-caption" }, "—") : h$41(Sparkline, {
				points: row.points,
				label: row.label_zh
			})), h$41("span", { className: "lp-ind-judged" }, missed ? h$41("span", { className: "lp-caption" }, "—") : h$41(JudgedChip, {
				row,
				gate: props.gate,
				reason: props.reason
			})), h$41("span", { className: "lp-ind-source" }, SOURCE_ZH[row.source] ?? "—"), h$41(Icon, {
				name: "chevron",
				size: 14,
				className: "lp-ind-chevron"
			})), props.open ? h$41(DetailPanel, {
				row,
				slug
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
			const body = state.loading && !state.detail ? h$41(Skeleton, { height: 120 }) : !state.detail ? h$41(LoadError, {
				what: `${props.row.label_zh}的历次数值`,
				error: state.error,
				compact: true,
				onRetry: () => setAttempt((count) => count + 1)
			}) : h$41(DetailBody, { detail: state.detail });
			return h$41("div", {
				className: "lp-ind-panel",
				id: `lp-ind-panel-${props.slug}`,
				role: "region",
				"aria-label": `${props.row.label_zh}详情`
			}, body);
		}
		function DetailBody(props) {
			const { row, all_points: points, biovar } = props.detail;
			const numeric = points.filter((point) => point.value != null);
			const digits = Math.max(...numeric.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
			const units = [...new Set(points.map((point) => point.unit).filter(Boolean))];
			const move = movementOf(numeric.map((point) => ({
				date: point.date,
				value: point.value
			})), unitText(units[0] ?? row.unit));
			return h$41("div", { className: "lp-ind-detail" }, move ? h$41("p", { className: "lp-small lp-num" }, tidy$1(move.lead)) : null, row.read_error ? h$41("p", { className: "lp-blocker lp-blocker-bad" }, `这项这次没有读到：${row.read_error}。下面是能读到的部分。`) : null, row.change?.text_zh ? h$41("p", { className: "lp-muted" }, tidy$1(row.change.text_zh)) : null, numeric.length > 1 && units.length <= 1 ? h$41(LineChart, {
				points: numeric.map((point) => ({
					date: point.date,
					value: point.value
				})),
				unit: unitText(units[0] ?? row.unit),
				label: row.label_zh,
				height: 150,
				digits
			}) : null, row.range_zh ? h$41("p", { className: "lp-caption" }, tidy$1(row.range_zh)) : null, noiseSentence(props.detail) ? h$41("p", { className: "lp-caption" }, noiseSentence(props.detail), biovar?.source.url ? h$41(react.default.Fragment, null, " 来源：", h$41("a", {
				href: biovar.source.url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: biovar.source.title || void 0
			}, sourceLabel(biovar.source.title))) : biovar?.source.title ? ` 来源：${sourceLabel(biovar.source.title)}` : "", biovar?.source.doi ? ` · doi:${biovar.source.doi}` : "") : biovar && (row.gate === "too_early" || (row.reason_zh ?? "").startsWith("太早")) ? h$41("p", { className: "lp-caption" }, reasonBesideChip(row.gate, row.reason_zh) || "间隔还没到这项的最短复测时间。") : biovar && row.judged === "changed" ? h$41("p", { className: "lp-caption" }, "两次结果之差超出了上面的正常波动范围。") : h$41("p", { className: "lp-caption" }, row.range_zh ? "这项没有用来比较两次变化的波动数据。上面按参考范围标了偏低或偏高。" : row.source === "checkup" ? "这项没有收录个体正常波动数据，分不清真实变化和波动，所以不作判断。" : "手环和自测数据按周均值或日值显示趋势，不作正常波动判断。"), biovar ? h$41("p", { className: "lp-caption" }, `研究里用来判断变化的范围：+${fmt$1(biovar.band_pct.up, 1)}% / ${fmt$1(biovar.band_pct.down, 1)}%（来源：${sourceLabel(biovar.source.title)}）`) : null, biovar?.caveat_zh && !row.gate ? h$41("p", { className: "lp-caption" }, biovar.caveat_zh) : null, points.length > 0 ? h$41("div", { className: "lp-table-wrap" }, h$41("table", { className: "lp-table" }, h$41("caption", { className: "lp-sr" }, `${row.label_zh}历次数值`), h$41("thead", null, h$41("tr", null, ...[
				"日期",
				"数值",
				"单位",
				"来自"
			].map((cell) => h$41("th", {
				key: cell,
				scope: "col",
				className: cell === "数值" ? "lp-td-num" : void 0
			}, cell)))), h$41("tbody", null, ...[...points].reverse().map((point, index) => h$41("tr", { key: `${point.date}-${index}` }, h$41("td", null, dateZh$1(point.date)), h$41("td", { className: "lp-td-num" }, point.text ?? (point.value == null ? "—" : fmt$1(point.value, digits))), h$41("td", null, unitText(point.unit) || "—"), h$41("td", { className: "lp-caption" }, point.file ?? SOURCE_ZH[row.source])))))) : h$41("p", { className: "lp-muted" }, "没有可显示的数值。"), numeric.length > 1 && units.length > 1 ? h$41(TableTwin, {
				caption: row.label_zh,
				head: ["日期", "数值"],
				rows: numeric.map((point) => [dateZh$1(point.date), withUnit$1(fmt$1(point.value, digits), unitText(point.unit))])
			}) : null);
		}
		function Loading$1() {
			return h$41("div", {
				className: "lp-tab-body",
				"aria-busy": true,
				"aria-label": "正在读取指标"
			}, h$41(Skeleton, {
				height: 32,
				width: 320
			}), h$41("div", { className: "lp-card" }, ...[
				0,
				1,
				2,
				3,
				4
			].map((index) => h$41(Skeleton, {
				key: index,
				height: 32,
				className: "lp-ind-skeleton"
			}))));
		}
		/** An empty state in a card: icon, title, one sentence, and a button only when there is somewhere to go. */
		function EmptyCard(props) {
			return h$41("div", { className: "lp-card" }, h$41("div", { className: "lp-empty" }, h$41(Icon, {
				name: props.icon,
				size: 20
			}), h$41("div", { className: "lp-empty-title" }, props.title), h$41("p", { className: "lp-empty-text" }, props.text), props.action ? h$41(Btn, {
				variant: "outline",
				size: "md",
				onClick: props.action.onClick
			}, props.action.label) : null));
		}
		const AREA_EMPTY = {
			sleep: {
				icon: "pulse",
				title: "还没有睡眠数据",
				text: "连上手环或导入睡眠记录后，这里会列出睡眠时长和变化趋势。"
			},
			training: {
				icon: "flame",
				title: "还没有运动数据",
				text: "连上手环或导入运动记录后，这里会列出步数、活动量和变化趋势。"
			}
		};
		function Empty(props) {
			const none = props.data.record.status === "none";
			const action = props.onConnect ? {
				label: "连接记录",
				onClick: props.onConnect
			} : void 0;
			if (props.area !== "labs") return h$41(EmptyCard, {
				...AREA_EMPTY[props.area],
				action: action && !none ? {
					...action,
					label: "查看数据连接"
				} : action
			});
			return h$41(EmptyCard, {
				icon: "flask",
				title: "还没有化验数据",
				text: "上传体检报告后，这里会列出每一项化验，先看变化，再看这点变化算不算数。",
				action: {
					label: "上传报告",
					onClick: () => requestView({
						tab: "profile",
						id: "lp-findings-card"
					})
				}
			});
		}
		function lastCheckup(rows) {
			let last = null;
			for (const row of rows) if (row.source === "checkup" && row.latest && (!last || row.latest.date > last)) last = row.latest.date;
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
		const JUDGEMENT_HELP = "超出正常波动：比你平常的起伏更大，值得问医生，不是急症。在正常波动范围内：这点变化不算数。太早：离上次太近。不可比：两次不是同一家机构。还不能下结论：看缺的是哪一步。";
		function IndicatorsTab(props) {
			const { data, loading, error } = useIndicators();
			const gates = useGates(data?.updated_at);
			const [open, setOpen] = react.default.useState(null);
			const area = props.area ?? "labs";
			if (!data && loading) return h$41(Loading$1);
			if (!data) return h$41("div", { className: "lp-tab-body" }, h$41(LoadError, {
				what: "指标",
				error,
				onRetry: () => reload("indicators")
			}));
			if (data.groups.length === 0 && data.record.status === "error") return h$41("div", { className: "lp-tab-body" }, h$41(LoadError, {
				what: "体检记录",
				error: data.record.error || null,
				onRetry: () => reload("indicators")
			}));
			const all = data.groups.flatMap((group) => group.indicators).filter((row) => lifeAreaOf(row.label_zh) === area || area === "labs" && row.source !== "device");
			if (all.length === 0) return h$41("div", { className: "lp-tab-body" }, h$41(Empty, {
				data,
				area,
				onConnect: props.onConnect
			}));
			const filters = area === "labs" ? FILTERS : FILTERS.filter((row) => row.key !== "device");
			const filter = filters.find((row) => row.key === props.filter) ?? filters[0];
			const groups = data.groups.map((group) => ({
				...group,
				indicators: group.indicators.filter((row) => all.includes(row)).filter(filter.test)
			})).filter((group) => group.indicators.length > 0);
			const failed = all.filter((row) => row.read_error).length;
			const gateOf = (row) => ({
				gate: row.gate ?? gates[row.id]?.gate,
				reason: row.reason_zh ?? gates[row.id]?.reason
			});
			const judgedAny = groups.some((group) => group.indicators.some((row) => !row.read_error && (row.range_flag === "low" || row.range_flag === "high" || judgementKind({
				...gateOf(row),
				judged: row.judged
			}) !== "unjudged")));
			const oneSource = new Set(groups.flatMap((group) => group.indicators.map((row) => row.source))).size <= 1;
			const lastDate = area === "labs" ? lastCheckup(all) : all.reduce((last, row) => row.latest && (!last || row.latest.date > last) ? row.latest.date : last, null);
			const latestLine = lastDate ? `${area === "labs" ? "最近一次体检" : "最近一次"} ${dateZh$1(lastDate)}` : "";
			return h$41("div", { className: "lp-tab-body" }, data.record.status === "partial" || data.record.status === "error" ? h$41("div", {
				className: "lp-callout lp-callout-warn",
				role: "note"
			}, h$41(Icon, {
				name: "warn",
				size: 14
			}), h$41("div", { className: "lp-callout-body" }, `有一部分记录这次没有读到${data.record.error ? `：${data.record.error}` : failed > 0 ? `（${failed} 项）` : ""}。标着「没有读到」的指标不是没测，稍后刷新再读。`)) : null, h$41("div", { className: "lp-ind-toolbar" }, h$41("div", {
				className: "lp-seg",
				role: "group",
				"aria-label": "筛选指标"
			}, ...filters.map((row) => {
				const count = all.filter(row.test).length;
				const on = filter.key === row.key;
				return h$41("button", {
					key: row.key,
					type: "button",
					className: `lp-seg-item ${on ? "is-on" : ""}`,
					"aria-pressed": on,
					disabled: count === 0 && !on,
					onClick: () => props.onFilter(row.key)
				}, row.label, h$41("span", { className: "lp-seg-count" }, String(count)));
			})), latestLine ? h$41("span", { className: "lp-caption lp-ind-meta" }, latestLine, judgedAny ? h$41(Info, {
				label: "和正常波动比",
				align: "end"
			}, JUDGEMENT_HELP) : null) : null), groups.length === 0 ? h$41(EmptyCard, {
				icon: "check",
				title: `没有「${filter.label}」的指标`,
				text: "换一个筛选看看。",
				action: {
					label: "看全部",
					onClick: () => props.onFilter("all")
				}
			}) : h$41("div", { className: `lp-card lp-ind-card ${judgedAny ? "" : "lp-ind-nojudge"} ${oneSource ? "lp-ind-nosource" : ""}`.replace(/\s+/g, " ").trim() }, h$41("div", {
				className: "lp-ind-head",
				"aria-hidden": true
			}, h$41("span", null, "指标"), h$41("span", { className: "lp-ind-value" }, h$41("span", { className: "lp-ind-num" }, "最近一次"), h$41("span", null)), h$41("span", { className: "lp-ind-date" }, "日期"), h$41("span", null, "趋势"), h$41("span", { className: "lp-ind-head-judged" }, "和正常波动比"), h$41("span", { className: "lp-ind-source" }, "来源"), h$41("span", null)), ...groups.map((group) => h$41("section", {
				key: group.key,
				className: "lp-ind-group",
				"aria-label": group.label_zh
			}, h$41("h3", { className: "lp-ind-group-title" }, group.label_zh, h$41("span", { className: "lp-optional" }, `${group.indicators.length} 项`)), h$41("ul", { className: "lp-ind-list" }, ...group.indicators.map((row) => h$41(IndicatorLine, {
				key: row.id,
				row,
				open: open === row.id,
				...gateOf(row),
				onToggle: () => setOpen((current) => current === row.id ? null : row.id)
			})))))), h$41("p", { className: "lp-fine" }, "点任一行看历次数值、单位、来自哪份报告，以及正常波动的依据。"));
		}
		//#endregion
		//#region src/client/health-chat.ts
		const h$40 = react.default.createElement;
		let opener$1 = null;
		function setWorkspaceOpener(fn) {
			opener$1 = fn;
		}
		function HealthChatButton() {
			const [id, setId] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			react.default.useEffect(() => {
				getJson("/api/longpi/workspace").then((v) => setId(v.workspace_id)).catch(() => setId(null));
			}, []);
			if (!id || !opener$1) return null;
			return h$40("span", { className: "lp-healthchat" }, h$40("button", {
				type: "button",
				className: "lp-linkbtn lp-healthchat-btn",
				onClick: () => {
					setError("");
					opener$1?.(id).catch(() => setError("没有打开，请在左侧「健康对话」里新建会话"));
				}
			}, h$40(Icon, {
				name: "send",
				size: 14
			}), "去健康对话"), error ? h$40("span", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
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
		const h$39 = react.default.createElement;
		/**
		* The answer controls for one item: 完成 and 没做到 while unanswered; the
		* answer and 撤销 once given. Every state carries words, never color alone.
		*/
		function CheckChoices(props) {
			const { state, busy } = props;
			if (state === null) return h$39("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$39("button", {
				type: "button",
				className: "lp-choice lp-choice-done",
				disabled: busy,
				onClick: () => props.onAnswer(true)
			}, h$39(Icon, {
				name: "check",
				size: 13,
				strokeWidth: 2
			}), busy ? "记录中" : "完成"), h$39("button", {
				type: "button",
				className: "lp-choice",
				disabled: busy,
				onClick: () => props.onAnswer(false)
			}, "没做到"));
			return h$39("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$39("span", { className: `lp-badge ${state ? "lp-badge-good" : "lp-badge-neutral"}` }, h$39(Icon, {
				name: state ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), state ? "已完成" : "没做到"), h$39("button", {
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
				headline = `${marker.label_zh}还不到能下结论的时间。${advice.why_zh}最早 ${dayZhG(dates?.earliest)}再测。`;
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
				headline = `${movePhrase(marker)}，方向是对的，但还在测量波动里。${dates?.why_zh ?? ""}最早 ${dayZhG(dates?.earliest)}再测，才能确定是不是真实变化。`;
				body = extra;
			} else if (grade === "within_band_worse") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${movePhrase(marker)}，在波动里略偏反方向，还没有超出测量波动。先不下结论。${dates?.why_zh ?? ""}`;
				body = extra;
			} else if (grade === "within_band_flat") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${marker.label_zh}几乎没动，还在测量波动里。${dates?.why_zh ?? ""}最早 ${dayZhG(dates?.earliest)}再测。`;
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
				const headline = `${low}这是第一次身体年龄，一次检查不能说明你变年轻了。${advice.why_zh}最早 ${dayZhG(dates.earliest)}再测。`;
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
					headline_zh: `${moved}但只隔了 ${span} 天，不到 3 个月，还不能说变年轻。最早 ${dayZhG(early.earliest)}再测。`,
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
		/** 「12 月 30 日」, with the year when it is not this year (docs/design-system.md). */
		function dayZhG(iso) {
			const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
			if (!m) return iso ?? "";
			const md = `${Number(m[2])} 月 ${Number(m[3])} 日`;
			return Number(m[1]) === (/* @__PURE__ */ new Date()).getFullYear() ? md : `${m[1]} 年 ${md}`;
		}
		//#endregion
		//#region src/client/terms.ts
		const BIOAGE_LABEL = "身体年龄";
		const RISK_LABEL = "10 年心血管风险";
		const BIOAGE_INFO = "身体年龄是用九项常规血检和周岁算出来的数（模型估计，不是诊断，也不是你能活多久）。论文里叫表型年龄。";
		const RISK_INFO = "10 年心血管风险：和你情况相近的人里，未来 10 年出现心梗或中风的比例（模型估计）。这个模型没有公开的个人起伏范围。年龄不在 35–74 岁时，更不确定。论文里叫 China-PAR。";
		//#endregion
		//#region src/client/goals.ts
		const h$38 = react.default.createElement;
		/** Negative numbers with the minus sign (−), not a hyphen. */
		function minus(text) {
			return text.replace(/(^|[\s(（:：→])-(?=\d)/g, "$1−");
		}
		function Goals(props) {
			const models = props.tracking?.models ?? [];
			if (!props.tracking?.plan || models.length === 0) return null;
			const pheno = models.find((card) => card.model === "phenoage");
			const risk = models.find((card) => card.model === "china-par");
			const leverRows = (pheno?.levers ?? []).map((row) => ({
				label: row.label,
				detail: plainUnits(`${row.from} → ${row.to}`),
				value: row.years,
				unit: "岁"
			}));
			const sensitivityRows = (pheno?.sensitivity ?? []).map((row) => ({
				label: row.label,
				detail: plainUnits(`一次真实变化约 ${row.step}`),
				value: -Math.abs(row.years_per_step),
				unit: "岁"
			}));
			const estimate = h$38("div", { className: "lp-tags" }, h$38("span", { className: "lp-tag" }, "模型估计"));
			return h$38(Section, {
				id: "lp-goals",
				title: "如果达到目标"
			}, h$38("div", { className: "lp-grid-2 lp-grid-top" }, pheno ? h$38("div", { className: "lp-card" }, h$38("div", { className: "lp-card-head" }, h$38("h3", { className: "lp-card-title" }, BIOAGE_LABEL, h$38(Info, { label: BIOAGE_LABEL }, BIOAGE_INFO))), estimate, pheno.goal ? h$38("div", { className: "lp-plan-model-figures" }, h$38("div", { className: "lp-plan-model-figure" }, h$38("div", { className: "lp-caption" }, "现在"), h$38("div", { className: "lp-num-md" }, `${fmt$1(pheno.now?.phenoage)} 岁`)), h$38(Icon, {
				name: "arrow",
				size: 16
			}), h$38("div", { className: "lp-plan-model-figure" }, h$38("div", { className: "lp-caption" }, "达到方案目标"), h$38("div", { className: "lp-num-md lp-good-ink" }, `${fmt$1(pheno.goal.phenoage)} 岁`)), h$38("span", { className: "lp-badge lp-badge-good" }, `${fmt$1(pheno.goal.phenoage_delta)} 岁`)) : h$38("p", { className: "lp-muted lp-measure" }, pheno.note_zh ?? ""), leverRows.length > 0 ? h$38("div", null, h$38("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$38(LeverBars, { rows: leverRows })) : sensitivityRows.length > 0 ? h$38("div", null, h$38("div", { className: "lp-subhead" }, "对你的身体年龄影响最大的指标"), h$38(LeverBars, { rows: sensitivityRows })) : null, ...(pheno.levers ?? []).slice(0, 3).map((row) => h$38("p", {
				key: row.label,
				className: "lp-caption lp-measure"
			}, minus(projectionSentence(row.label, row.to, row.years, row.from)))), pheno.goal && pheno.goal.phenoage_delta != null ? h$38("p", { className: "lp-caption lp-measure" }, minus(projectionSentence("达到方案目标时的身体年龄", `${fmt$1(pheno.goal.phenoage)} 岁`, pheno.goal.phenoage_delta, pheno.now?.phenoage != null ? `${fmt$1(pheno.now.phenoage)} 岁` : void 0))) : null, h$38("p", { className: "lp-caption lp-measure" }, `${pheno.measured_on ? `按 ${chineseDate(pheno.measured_on) || pheno.measured_on}的血检计算。` : ""}${pheno.boundary_zh ?? ""}`)) : null, risk ? h$38("div", { className: "lp-card" }, h$38("div", { className: "lp-card-head" }, h$38("h3", { className: "lp-card-title" }, RISK_LABEL, h$38(Info, {
				label: RISK_LABEL,
				align: "end"
			}, RISK_INFO))), estimate, risk.status === "unavailable" ? (risk.missing ?? []).length > 0 ? h$38("div", { className: "lp-plan-model-figure" }, h$38("div", { className: "lp-h2 lp-muted" }, `还差 ${(risk.missing ?? []).length} 项`), h$38("div", { className: "lp-tags" }, ...(risk.missing ?? []).slice(0, 3).map((name) => h$38("span", {
				key: name,
				className: "lp-tag"
			}, name)), (risk.missing ?? []).length > 3 ? h$38("span", { className: "lp-caption" }, `等 ${(risk.missing ?? []).length} 项`) : null)) : h$38("div", { className: "lp-plan-model-figure" }, h$38("div", { className: "lp-h2 lp-muted" }, "暂不显示"), risk.note_zh ? h$38("p", { className: "lp-small lp-muted lp-measure" }, risk.note_zh) : null) : h$38("div", { className: "lp-stack" }, h$38("div", { className: "lp-plan-model-figures" }, h$38("div", { className: "lp-plan-model-figure" }, h$38("div", { className: "lp-caption" }, "现在"), h$38("div", { className: "lp-num-md" }, risk.now?.risk_pct == null ? "—" : `${risk.now.risk_pct.toFixed(1)}%`), risk.category_zh?.now ? h$38("span", { className: "lp-badge lp-badge-neutral" }, risk.category_zh.now) : null), risk.goal ? h$38(Icon, {
				name: "arrow",
				size: 16
			}) : null, risk.goal ? h$38("div", { className: "lp-plan-model-figure" }, h$38("div", { className: "lp-caption" }, "达到方案目标"), h$38("div", { className: "lp-num-md lp-good-ink" }, risk.goal.risk_pct == null ? "—" : `${risk.goal.risk_pct.toFixed(1)}%`), risk.category_zh?.goal ? h$38("span", { className: "lp-badge lp-badge-good" }, risk.category_zh.goal) : null) : null), (risk.levers ?? []).length > 0 ? h$38("div", null, h$38("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$38(LeverBars, { rows: (risk.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "个百分点"
			})) })) : h$38("p", { className: "lp-small lp-muted lp-measure" }, risk.note_zh ?? "")), risk.boundary_zh ? h$38("p", { className: "lp-caption lp-measure" }, risk.boundary_zh) : null) : null), h$38("p", { className: "lp-caption lp-measure" }, "关于「能多活几年」：没有经过验证的模型能对个人给出这个数。这里只给有依据的模型估计。试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月；能坚持的小改变，比追逐一个数字更重要。"));
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
			return h$38(Section, {
				id: "lp-next",
				title: "下一步",
				aside: h$38("span", { className: "lp-caption" }, "按优先级")
			}, h$38("div", { className: "lp-card" }, h$38("ol", { className: "lp-rows" }, ...rows.map((row, index) => h$38("li", {
				key: index,
				className: "lp-row lp-plan-step"
			}, h$38(Icon, {
				name: STEP_ICON[row.kind] ?? "info",
				size: 14,
				className: "lp-row-icon"
			}), h$38("span", { className: "lp-row-main" }, row.text_zh))))));
		}
		//#endregion
		//#region src/client/plan-draft.ts
		const h$37 = react.default.createElement;
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
		const num$1 = (value) => fmt$1(value, 2);
		function targetText(target) {
			return `手环自动记录：${METRIC_ZH[target.metric] ?? target.metric} ${target.op === ">=" ? "≥" : "≤"} ${num$1(target.value)} ${UNIT_ZH[target.unit] ?? target.unit}`;
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
			return h$37("details", null, h$37("summary", null, "证据"), evidence.population ? h$37("p", { className: "lp-caption lp-measure" }, `试验人群：${evidence.population}`) : null, evidence.doi ? h$37("p", { className: "lp-caption lp-measure" }, "文献：", h$37("a", {
				href: `https://doi.org/${evidence.doi}`,
				target: "_blank",
				rel: "noreferrer"
			}, `doi:${evidence.doi}`), evidence.verified ? "" : "（数据待核对）") : null, target ? h$37("p", { className: "lp-caption lp-measure" }, targetText(target)) : null, h$37("p", { className: "lp-caption lp-measure" }, "这是试验里的平均效果，个人结果会不同。"));
		}
		/** One line: what the trials found on average. */
		function EvidenceLine(props) {
			return h$37("p", { className: "lp-draft-evidence" }, h$37(Icon, {
				name: "flask",
				size: 13
			}), h$37("span", null, props.item.evidence.expected_zh || "有研究证据支持"));
		}
		function DraftItemCard(props) {
			const item = props.item;
			return h$37("li", { className: `lp-draft-item ${props.compact ? "lp-draft-item-compact" : ""}` }, h$37("div", { className: "lp-draft-item-head" }, h$37("div", { className: "lp-draft-item-title" }, item.category_zh ? h$37("span", { className: "lp-tag" }, item.category_zh) : null, h$37("span", null, item.title), item.needs_doctor ? h$37("span", { className: "lp-badge lp-badge-warn" }, h$37(Icon, {
				name: "warn",
				size: 12
			}), "需先与医生确认") : null), h$37("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: props.onRemove,
				"aria-label": `去掉「${item.title}」`
			}, h$37(Icon, {
				name: "close",
				size: 12
			}), "去掉")), behaviorOf(item) ? h$37("p", { className: "lp-draft-detail" }, behaviorOf(item)) : null, h$37(EvidenceLine, { item }), item.cautions_zh.length > 0 ? h$37("div", { className: "lp-callout lp-callout-warn" }, h$37(Icon, {
				name: "warn",
				size: 14
			}), h$37("div", { className: "lp-callout-body" }, ...item.cautions_zh.map((text) => h$37("p", { key: text }, text)))) : null, h$37(EvidenceMore, { item }));
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
			return h$37("div", { className: "lp-draft-block" }, kept.length > 0 ? h$37("ul", { className: "lp-draft-items" }, ...kept.map((item) => h$37(DraftItemCard, {
				key: item.id,
				item,
				compact: props.compact,
				onRemove: () => props.onToggle(item.id)
			}))) : h$37("p", { className: "lp-small lp-muted lp-measure" }, "所有项目都去掉了。恢复一项，或在对话里说说你想怎么调整。"), gone.length > 0 ? h$37("div", { className: "lp-draft-removed" }, h$37("span", { className: "lp-caption" }, "已去掉："), ...gone.map((item) => h$37("button", {
				key: `${item.id}|${item.title}`,
				type: "button",
				className: "lp-toggle",
				disabled: props.busy,
				onClick: () => props.onToggle(item.id || item.title),
				"aria-label": `恢复「${item.title}」`
			}, h$37(Icon, {
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
			return h$37("details", { open: props.open }, h$37("summary", null, "为什么是这几项"), h$37("ol", { className: "lp-draft-priorities" }, ...rows.map((row, index) => h$37("li", {
				key: `${row.marker_key}-${index}`,
				className: "lp-draft-priority"
			}, h$37("div", { className: "lp-draft-priority-head" }, h$37("span", { className: "lp-strong" }, row.label_zh), row.value != null ? h$37("span", { className: "lp-num" }, `${num$1(row.value)} ${row.unit}`) : null), h$37("div", { className: "lp-caption" }, [row.why_zh, row.date ? `${chineseDate(row.date)}的记录` : ""].filter(Boolean).join(" · "))))));
		}
		function DraftGoals(props) {
			if (props.goals.length === 0 && props.dropped === 0) return null;
			return h$37("details", null, h$37("summary", null, `目标（${props.goals.length} 个，按试验平均效应估算）`), props.goals.length > 0 ? h$37("ul", { className: "lp-rows" }, ...props.goals.map((goal) => h$37("li", {
				key: goal.marker,
				className: "lp-row"
			}, h$37("span", { className: "lp-row-main lp-row-lines" }, h$37("span", { className: "lp-strong" }, goal.marker), goal.basis_zh ? h$37("span", { className: "lp-caption" }, goal.basis_zh) : null), h$37("span", { className: "lp-row-end lp-num" }, `${num$1(goal.value)} ${goal.unit}`)))) : null, props.dropped > 0 ? h$37("p", { className: "lp-caption lp-measure" }, `去掉的项目对应的 ${props.dropped} 个目标也不会保存。`) : null);
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
			return h$37(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "采用这份方案",
				onClose: props.busy ? () => {} : props.onCancel,
				headless: true,
				className: "lp-confirm-dialog"
			}, h$37("div", { className: "lp lp-confirm" }, h$37("h2", { className: "lp-h2" }, "采用这份方案？"), h$37("p", { className: "lp-muted lp-measure" }, `保存为你的方案「${props.draft.title || "改善方案"}」，从今天（${chineseDate(props.today)}）开始。之后按项目打卡，并按每个指标安排复测；想调整随时在对话里说。`), h$37("ul", { className: "lp-confirm-list" }, ...props.items.map((item) => h$37("li", { key: item.id }, item.category_zh ? h$37("span", { className: "lp-tag" }, item.category_zh) : null, h$37("span", null, item.title), item.needs_doctor ? h$37("span", { className: "lp-badge lp-badge-warn" }, "需先与医生确认") : null))), props.goals.length > 0 ? h$37("p", { className: "lp-caption lp-measure" }, `目标：${props.goals.map((goal) => `${goal.marker} ${num$1(goal.value)} ${goal.unit}`).join("、")}（按试验平均效应估算，不是个人预测）`) : null, doctor.length > 0 ? h$37("div", { className: "lp-callout lp-callout-warn" }, h$37(Icon, {
				name: "warn",
				size: 14
			}), h$37("p", { className: "lp-callout-body" }, `${doctor.map((item) => `「${item.title}」`).join("")}需先与医生确认后再开始。方案里不含任何剂量。`)) : null, offer ? h$37("label", {
				className: "lp-checkrow",
				htmlFor: "lp-confirm-remind"
			}, h$37("input", {
				id: "lp-confirm-remind",
				type: "checkbox",
				checked: remind,
				disabled: props.busy,
				onChange: (event) => setRemind(event.target.checked)
			}), h$37("span", null, `每晚 ${offer.time} 提醒我打卡（不含健康数值）`)) : null, props.error ? h$37("p", {
				className: "lp-form-error",
				role: "alert"
			}, props.error) : null, h$37("div", { className: "lp-modal-actions" }, h$37(Btn, {
				variant: "outline",
				onClick: props.onCancel,
				disabled: props.busy
			}, "再想想"), h$37(Btn, {
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
			return h$37("span", { className: "lp-caption lp-draft-hint" }, "想调整？在对话中说", h$37("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => props.onPrompt(DRAFT_PROMPT)
			}, `「${DRAFT_PROMPT}」`));
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
			return h$37("div", { className: "lp-card lp-draft" }, h$37("div", { className: "lp-card-head" }, h$37("h3", { className: "lp-card-title" }, draft.title || "改善方案"), h$37("span", { className: "lp-caption" }, `方案草稿 · ${kept.length} 项 · 还没有保存`)), h$37("p", { className: "lp-text lp-muted" }, "按你的检查结果和试验证据起草。每项注明试验里的平均效果，个人结果会不同；你确认后才保存。"), h$37(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				saved: data.removed_items,
				busy
			}), error && !confirming ? h$37("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$37(DraftGoals, {
				goals,
				dropped: draft.goals.length - goals.length
			}), h$37(Priorities, { brief: data.brief }), ...draft.notes_zh.map((text) => h$37("p", {
				key: text,
				className: "lp-caption"
			}, text)), h$37("div", { className: "lp-actions lp-draft-actions" }, h$37(Btn, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$37(Hint, { onPrompt: props.onPrompt })), h$37("p", { className: "lp-caption lp-measure" }, data.brief.boundary_zh || "只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。"), confirming ? h$37(ConfirmModal, {
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
			return h$37("div", { className: "lp-draft-removed" }, h$37("span", { className: "lp-caption" }, "已去掉："), ...props.items.map((item) => h$37("button", {
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
			}, h$37(Icon, {
				name: "plus",
				size: 12
			}), item.title)));
		}
		/** The plan section's empty state: the draft, or why there is none yet. */
		function PlanDraftCard(props) {
			const { data, loading, error } = usePlanDraft();
			if (!data && loading) return h$37("div", {
				className: "lp-card lp-draft",
				"aria-busy": true
			}, h$37("div", { className: "lp-card-head" }, h$37("h3", { className: "lp-card-title" }, "方案草稿"), h$37("span", { className: "lp-caption" }, "正在按你的结果和研究证据起草…")), h$37(Skeleton, { height: 72 }), h$37(Skeleton, { height: 72 }));
			if (!data) return h$37("div", { className: "lp-card lp-draft" }, h$37("div", { className: "lp-card-head" }, h$37("h3", { className: "lp-card-title" }, "方案草稿")), h$37("p", { className: "lp-small lp-muted lp-measure" }, `没能读到方案草稿：${error ?? "没有返回"}。`), h$37(Hint, { onPrompt: props.onPrompt }));
			if (!data.draft) {
				const stop = data.brief.safety.stop_zh ?? "";
				const reasons = stop ? [stop, ...data.brief.notes_zh.filter((text) => text !== stop)] : data.brief.notes_zh;
				const fine = stop ? [data.brief.boundary_zh].filter(Boolean) : [...new Set([
					...reasons.slice(1),
					...data.brief.safety.notes_zh,
					data.brief.boundary_zh
				].filter(Boolean))];
				return h$37("div", { className: "lp-card lp-draft" }, h$37("div", { className: "lp-card-head" }, h$37("h3", { className: "lp-card-title" }, stop ? "请先去看医生，再做方案" : "现在还起草不了方案"), h$37("span", { className: "lp-caption" }, "方案草稿")), stop ? h$37("div", { className: "lp-callout lp-callout-warn" }, h$37(Icon, {
					name: "warn",
					size: 14
				}), h$37("p", { className: "lp-callout-body" }, reasons[0])) : h$37("p", { className: "lp-text lp-muted" }, reasons[0] || "你的记录里还没有能对上研究证据的指标。"), ...fine.map((text) => h$37("p", {
					key: text,
					className: "lp-caption"
				}, text)), stop ? null : h$37(Priorities, {
					brief: data.brief,
					open: true
				}), !stop && data.removed_items.length > 0 ? h$37(RestoreRow, {
					items: data.removed_items,
					onNotice: props.onNotice
				}) : null, stop ? null : h$37(Hint, { onPrompt: props.onPrompt }));
			}
			return h$37(Draft, {
				data,
				draft: data.draft,
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			});
		}
		//#endregion
		//#region src/client/plan.ts
		const h$36 = react.default.createElement;
		/** Today's items with their three answers; also the 概览 tab's today card. */
		function TodayList(props) {
			const items = props.journey.plan.checkin_items;
			if (items.length === 0) return h$36("p", { className: "lp-small lp-muted lp-measure" }, "今天没有需要亲手记的项目。手环和已经记下的服药会自动算进去。");
			return h$36("ul", { className: "lp-today-list" }, ...items.map((row) => {
				const state = props.stateOf(row.id);
				return h$36("li", {
					key: row.id,
					className: `lp-today-row ${state === true ? "lp-today-done" : state === false ? "lp-today-missed" : ""}`
				}, h$36("span", { className: "lp-today-title" }, row.title), h$36(CheckChoices, {
					title: row.title,
					state,
					busy: props.busy === row.id,
					onAnswer: (next) => props.onAnswer(row.id, row.title, next)
				}));
			}));
		}
		/** Today's progress only: the check-in buttons live once, in the item list below. */
		function TodayTile(props) {
			const counts = todayCounts(props.journey);
			const share = counts.total > 0 ? counts.done / counts.total : 0;
			return h$36("div", { className: `lp-card ${props.className ?? ""}`.trim() }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "今天")), counts.total > 0 ? h$36("div", { className: "lp-plan-grow" }, h$36("div", { className: "lp-num-md" }, `${counts.done}/${counts.total}`), h$36("div", {
				className: "lp-bar",
				role: "progressbar",
				"aria-label": "今天的打卡",
				"aria-valuemin": 0,
				"aria-valuemax": counts.total,
				"aria-valuenow": counts.done
			}, h$36("span", { style: { width: `${Math.round(share * 100)}%` } })), h$36("p", { className: "lp-caption" }, "在下面的项目里打卡。")) : h$36("p", { className: "lp-small lp-muted lp-measure" }, "今天没有需要亲手记的项目。手环和已经记下的服药会自动算进去。"));
		}
		function AdherenceTile(props) {
			const items = props.tracking?.items ?? [];
			const known = items.filter((item) => item.adherence && item.adherence.level !== "unknown" && item.adherence.rate != null);
			const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null;
			const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback;
			const streak = props.journey.plan.streak || Math.max(0, ...items.map((item) => item.adherence?.streak ?? 0));
			if (rate == null || !Number.isFinite(rate)) return h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "方案执行")), h$36("div", { className: "lp-empty" }, h$36("div", { className: "lp-empty-title" }, "还没有执行记录"), h$36("p", { className: "lp-empty-text" }, "在下面的项目里打卡后，这里显示近 12 周的执行率。")));
			return h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "方案执行")), h$36("div", { className: "lp-plan-grow" }, h$36("div", { className: "lp-plan-figure-row" }, h$36(Ring, {
				value: rate,
				label: "方案平均执行率",
				size: 56
			}), h$36("div", null, h$36("div", { className: "lp-num-md" }, `${Math.round(rate * 100)}%`), h$36("div", { className: "lp-caption" }, "近 12 周平均")))), streak > 1 ? h$36("div", { className: "lp-plan-streak" }, h$36(Icon, {
				name: "flame",
				size: 14
			}), `连续 ${streak} 天`) : h$36("p", { className: "lp-caption lp-measure" }, "连续完成两天以上会在这里显示"));
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
			return h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "下次复测")), h$36("div", { className: "lp-plan-grow" }, now.length > 0 ? h$36("div", null, h$36("div", { className: "lp-h2" }, "现在"), h$36("div", { className: "lp-caption" }, `可以复测${now.map((row) => row.marker).slice(0, 3).join("、")}`)) : first ? h$36("div", null, h$36("div", { className: "lp-num-md" }, `${daysBetween$1(props.today, first.date)} 天后`), h$36("div", { className: "lp-caption" }, `${chineseDate(first.date)}之后 · ${first.marker}`)) : h$36("div", null, h$36("div", { className: "lp-h2 lp-muted" }, "—"), h$36("div", { className: "lp-caption" }, props.failed ? "复测日期没有读到" : "方案里的指标还没有排出复测日"))), h$36("p", { className: "lp-caption lp-measure" }, "复测太早，变化多半只是波动。"));
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
			if (wins.length === 0) return h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "方案相关指标还没有超出正常波动")), h$36("p", { className: "lp-small lp-muted lp-measure" }, "血脂、血糖、炎症指标通常要 1–3 个月才会动。坚持执行、按时复测，就是在积累证据。"));
			return h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "朝目标方向、超出正常波动的变化")), h$36("ul", { className: "lp-rows" }, ...wins.map(({ item, row }, index) => h$36("li", {
				className: "lp-row lp-plan-win",
				key: index
			}, h$36("span", { className: "lp-plan-win-icon" }, h$36(Icon, {
				name: "check",
				size: 14
			})), h$36("div", { className: "lp-plan-win-text lp-row-main" }, h$36("div", { className: "lp-strong lp-num" }, minus(`${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ""}`)), h$36("p", { className: "lp-muted lp-measure" }, minus([
				`执行「${item.title}」期间`,
				row.change ? pct(row.change.pct) : "",
				"超出个体正常波动"
			].filter(Boolean).join(" · ")), (row.combined_with ?? []).length > 0 ? `；同期还在执行${(row.combined_with ?? []).map((name) => `「${name}」`).join("")}，无法区分各自的作用` : ""))))));
		}
		/** Check-in items not running today (not started, or ended) get no button, as the server leaves them out of today's list. */
		function checkinFoot(item, today) {
			if (item.start > today) return `${chineseDate(item.start)}开始，到时再打卡`;
			if (item.end && item.end < today) return "已结束，不用再打卡";
			return null;
		}
		/** Under 28 days nothing can be judged yet: the list says so once, so the rows carry no per-item 记录不足 or per-marker 无法判断. */
		const YOUNG_DAYS = 28;
		function ItemRow(props) {
			const item = props.item;
			const adherence = item.adherence ?? {};
			const source = props.raw?.mirobody ? "mirobody" : props.raw?.target ? "wearable" : "checkin";
			const idle = source === "checkin" ? checkinFoot(item, props.today) : null;
			const rate = adherence.rate;
			const known = rate != null && adherence.level !== "unknown";
			const verdicts = (item.verdicts ?? []).filter((row) => !(props.young && row.verdict === "无法判断" && /太早/.test(row.reason_zh ?? "")));
			const end = idle ? h$36("span", { className: "lp-caption" }, idle) : source === "checkin" ? props.checkable ? h$36(CheckChoices, {
				title: item.title,
				state: props.state,
				busy: props.busy,
				onAnswer: (next) => props.onAnswer(item.id, item.title, next)
			}) : h$36("span", { className: "lp-caption" }, "今天不用打卡") : h$36("span", { className: "lp-caption" }, source === "wearable" ? "手环自动记录" : "服用情况在原来的用药记录里");
			return h$36("li", { className: `lp-row lp-plan-row ${props.state === true ? "lp-today-done" : ""}` }, h$36("div", { className: "lp-row-main lp-plan-row-main" }, h$36("div", { className: "lp-plan-row-title" }, item.title), h$36("div", { className: "lp-tags" }, item.category_zh ? h$36("span", { className: "lp-tag" }, item.category_zh) : null, item.headline && !(props.young && item.headline === "无法判断") ? h$36(VerdictChip, { verdict: item.headline }) : null, known ? h$36("span", { className: "lp-caption lp-num" }, `近 12 周执行 ${Math.round(rate * 100)}%`) : null), known && (adherence.calendar ?? []).length > 0 ? h$36(AdherenceStrip, {
				calendar: adherence.calendar ?? [],
				label: item.title
			}) : null, !known && !props.young ? h$36("p", { className: "lp-caption lp-measure" }, `近 12 周执行：记录不足${adherence.note_zh ? `。${adherence.note_zh}` : ""}`) : null, ...verdicts.map((row, index) => h$36("div", {
				className: "lp-plan-verdict",
				key: index
			}, h$36("div", { className: "lp-plan-verdict-head" }, h$36(VerdictChip, { verdict: row.verdict }), h$36("span", { className: "lp-strong" }, row.marker), row.baseline && row.followup ? h$36("span", { className: "lp-num" }, minus(`${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ""}${row.change ? `（${pct(row.change.pct)}）` : ""}`)) : null), row.reason_zh ? h$36("p", { className: "lp-caption lp-measure" }, datesZh(row.reason_zh)) : null, (row.expected ?? []).length > 0 ? h$36("details", null, h$36("summary", null, "试验里平均能改变多少"), ...(row.expected ?? []).map((line) => h$36("p", {
				key: line.id,
				className: "lp-caption lp-measure"
			}, line.text_zh, line.comparison && line.comparison !== "not_comparable" ? `你的变化${{
				consistent: "与试验平均一致",
				smaller: "小于试验平均",
				larger: "大于试验平均",
				opposite: "方向与试验相反"
			}[line.comparison] ?? ""}。` : "", ` doi:${line.doi}`))) : null))), h$36("div", { className: "lp-plan-row-end" }, end));
		}
		/** Stage plan, next to the draft: the person may bring their own plan instead. */
		function PlanStart(props) {
			return h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, "已经有自己的方案？")), h$36("p", { className: "lp-text lp-muted" }, "说出你的方案，或上传医生、长寿师给的方案。LongPi 会读给你确认后保存，再按每个指标安排复测日，并算出达到目标时的模型估计。"), props.journey.suggestions.length > 0 ? h$36("div", { className: "lp-stack" }, ...props.journey.suggestions.map((row) => h$36("button", {
				key: row.id,
				type: "button",
				className: "lp-row-btn",
				onClick: () => props.onPrompt(row.text_zh)
			}, h$36("span", { className: "lp-row-main" }, row.text_zh), h$36(Icon, {
				name: "chevron",
				size: 14
			})))) : null, h$36("p", { className: "lp-caption lp-measure" }, "LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。"));
		}
		function PlanSection(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const tracking = props.tracking;
			const today = props.journey.today;
			if (!props.journey.plan.exists && !tracking?.plan) return h$36("div", {
				className: "lp-stack",
				id: "lp-plan"
			}, h$36(PlanDraftCard, {
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			}), h$36(PlanStart, {
				journey: props.journey,
				onPrompt: props.onPrompt
			}));
			if (props.loading && !tracking) return h$36("div", {
				className: "lp-stack",
				id: "lp-plan",
				"aria-busy": true
			}, h$36(Skeleton, {
				height: 260,
				className: "lp-card-skeleton"
			}));
			const failed = !tracking && props.error != null;
			const plan = tracking?.plan;
			const items = tracking?.items ?? [];
			const checkups = [...new Set((tracking?.bioage?.points ?? []).map((row) => row.date))];
			const todayIds = new Set(props.journey.plan.checkin_items.map((row) => row.id));
			const days = props.journey.plan.days ?? (items.length > 0 ? Math.max(...items.map((item) => item.days ?? 0)) : null);
			const young = days != null && days < YOUNG_DAYS;
			const firstRetest = retestDates(tracking ?? null).find((row) => row.date > today)?.date ?? null;
			const meta = `第 ${plan?.version ?? props.journey.plan.version ?? 1} 版`;
			return h$36("div", {
				className: "lp-stack",
				id: "lp-plan"
			}, failed ? h$36(LoadError, {
				what: "方案的执行记录和评判",
				error: props.error,
				onRetry: () => reload("tracking")
			}) : null, h$36("div", { className: "lp-plan-tiles" }, h$36(TodayTile, {
				journey: props.journey,
				className: "lp-plan-tile-today"
			}), h$36(AdherenceTile, {
				journey: props.journey,
				tracking
			}), h$36(RetestTile, {
				tracking,
				today,
				failed
			})), h$36(Wins, { tracking }), h$36("div", { className: "lp-card" }, h$36("div", { className: "lp-card-head" }, h$36("h3", { className: "lp-card-title" }, plan?.title || props.journey.plan.title || "时间线"), h$36("span", { className: "lp-caption" }, meta)), items.length > 0 ? h$36(Timeline$1, {
				items: items.map((item) => ({
					id: item.id,
					title: item.title,
					start: item.start,
					end: item.end ?? null,
					subtitle: `${chineseDate(item.start)}起，第 ${item.days ?? 0} 天`,
					headline: item.headline ?? ""
				})),
				checkups,
				today
			}) : h$36("p", { className: "lp-small lp-muted lp-measure" }, failed ? "方案的项目没有读到。" : "方案里还没有项目。")), items.length > 0 ? h$36("section", {
				className: "lp-card",
				"aria-labelledby": "lp-plan-items-title"
			}, h$36("div", { className: "lp-card-head" }, h$36("h3", {
				className: "lp-card-title",
				id: "lp-plan-items-title"
			}, "方案项目"), h$36("span", { className: "lp-caption" }, "完成 / 没做到 记在这里，点错了可以撤销")), young ? h$36("p", { className: "lp-caption lp-measure" }, `方案开始才 ${days ?? 0} 天。执行率和指标变化要满 ${YOUNG_DAYS} 天才能判断${firstRetest ? `，${chineseDate(firstRetest)}之后再看` : ""}。`) : null, h$36("ul", { className: "lp-rows" }, ...items.map((item) => h$36(ItemRow, {
				key: item.id,
				item,
				raw: plan?.items.find((raw) => raw.id === item.id),
				today,
				onAnswer: answer,
				busy: busy === item.id,
				state: stateOf(item.id),
				checkable: todayIds.has(item.id),
				young
			})))) : null);
		}
		/** The whole 方案 tab. */
		function PlanTab(props) {
			return h$36("div", { className: "lp-tab-body" }, h$36(PlanSection, props), h$36(Markers, { tracking: props.tracking }), h$36(Goals, { tracking: props.tracking }), h$36(NextSteps, { tracking: props.tracking }));
		}
		function Markers(props) {
			const charts = props.tracking?.charts ?? [];
			if (charts.length === 0) return null;
			const verdictOf = (indicator) => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? []).find((row) => row.indicator === indicator && row.verdict !== "无法判断");
			const dateOf = (chart, iso) => chart.weekly ? `${chineseDate(iso)}起一周` : chineseDate(iso);
			const notes = [charts.some((chart) => chart.points.length < 2) ? "只有一次数值的指标，还需一次复测才能画趋势。" : "", charts.some((chart) => !chart.band) ? "没有浅色带的指标缺少个体变异数据，分不清真实变化和波动。" : ""].filter(Boolean).join("");
			return h$36(Section, {
				id: "lp-markers",
				title: "方案相关的指标",
				aside: h$36(Info, {
					label: "图上的浅色带",
					align: "end"
				}, "浅色带是以基线为中心的平常起伏。落在带外才值得注意；带里的起伏多半不算数。")
			}, notes ? h$36("p", { className: "lp-caption lp-measure" }, notes) : null, h$36("div", { className: "lp-grid-2 lp-grid-top" }, ...charts.map((chart) => {
				const verdict = verdictOf(chart.indicator);
				const digits = Math.max(...chart.points.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
				const only = chart.points.length === 1 ? chart.points[0] : null;
				return h$36("figure", {
					className: "lp-card lp-plan-chart",
					key: chart.indicator
				}, h$36("div", { className: "lp-card-head" }, h$36("figcaption", { className: "lp-card-title" }, chart.label)), verdict ? h$36("div", { className: "lp-tags" }, h$36(VerdictChip, { verdict: verdict.verdict })) : null, only ? h$36("div", { className: "lp-plan-model-figure" }, h$36("div", null, h$36("span", { className: "lp-num-md" }, fmt$1(only.value, digits)), chart.unit ? h$36("span", { className: "lp-unit" }, ` ${chart.unit}`) : null), h$36("div", { className: "lp-caption" }, dateOf(chart, only.date))) : h$36(LineChart, {
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
					goal: chart.goal ?? null,
					weekly: chart.weekly === true
				}), chart.band ? h$36("p", { className: "lp-caption lp-measure" }, `浅色带：以 ${chineseDate(chart.band.base_date)}的 ${fmt$1(chart.band.base, 2)} 为基线的正常波动${chart.band.verified === false ? "（变异数据待核对）" : ""}。`) : null, chart.points.length > 1 ? h$36("details", null, h$36("summary", null, "历次数值"), h$36("div", { className: "lp-table-wrap" }, h$36("table", { className: "lp-table" }, h$36("caption", { className: "lp-sr" }, `${chart.label}（${chart.unit}）`), h$36("thead", null, h$36("tr", null, h$36("th", { scope: "col" }, "日期"), h$36("th", {
					scope: "col",
					className: "lp-td-num"
				}, chart.unit ? `数值（${chart.unit}）` : "数值"))), h$36("tbody", null, ...chart.points.map((point) => h$36("tr", { key: point.date }, h$36("td", null, dateOf(chart, point.date)), h$36("td", { className: "lp-td-num" }, fmt$1(point.value, digits)))))))) : null);
			})));
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
		const h$35 = react.default.createElement;
		function retestLine(retest) {
			if (retest.why_zh.includes("复测已在")) return datesZh(retest.why_zh);
			return `建议复测：${dateZh$1(retest.earliest)} 至 ${dateZh$1(retest.recommended)}。${datesZh(retest.why_zh)}`;
		}
		/** Keep compound names whole: γ-谷氨酰转移酶 must not break after the hyphen. */
		function keepWhole(text) {
			return text.replace(/([α-ωΑ-Ω])-/g, "$1‑");
		}
		/** The lines of one message, each thing said once: a repeated sentence, or a later clause that restates a waiting time
		* already given (「…糖化血红蛋白至少要满 90 天」 then 「…至少 90 天」), is dropped. */
		function linesOf(row) {
			const seen = [];
			const waits = /* @__PURE__ */ new Set();
			const key = (text) => text.replace(/[\s，,。；]/g, "");
			return [
				row.headline_zh,
				row.body_zh ?? "",
				row.retest ? retestLine(row.retest) : ""
			].map((line) => {
				const kept = datesZh(line).split(/(?<=[，。；])/).filter((clause) => {
					const k = key(clause);
					if (!k) return false;
					const wait = /至少(?:要满|要隔|隔)?\s*(\d+)\s*天/.exec(clause)?.[1];
					return !(seen.some((other) => other.includes(k)) || wait != null && waits.has(wait));
				});
				for (const clause of kept) {
					seen.push(key(clause));
					const wait = /至少(?:要满|要隔|隔)?\s*(\d+)\s*天/.exec(clause)?.[1];
					if (wait) waits.add(wait);
				}
				return kept.join("").replace(/[，；]$/, "。");
			}).filter(Boolean).map(keepWhole);
		}
		function FeedbackCard(props) {
			if (props.messages.length === 0) return null;
			return h$35("section", {
				className: "lp-card",
				id: "lp-feedback",
				"aria-label": "这次的变化"
			}, h$35("div", { className: "lp-card-head" }, h$35("h3", { className: "lp-card-title" }, "这次的变化")), h$35("ul", { className: "lp-rows" }, ...props.messages.map((row) => h$35("li", {
				key: row.id,
				className: "lp-row lp-row-stack"
			}, ...linesOf(row).map((line, index) => h$35("p", {
				key: index,
				className: `lp-small lp-muted lp-measure ${index === 0 ? "lp-fb-lead" : ""}`.trim()
			}, line))))));
		}
		//#endregion
		//#region src/client/feedback/share-card.ts
		const h$34 = react.default.createElement;
		/** compact: the sentence is already on the body-age card above; the card only offers to copy it (INT062 fix 7). */
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
			const action = h$34("div", { className: "lp-actions" }, h$34(Btn, {
				variant: "outline",
				onClick: copy
			}, "复制这句话"));
			if (props.compact) return h$34("section", {
				className: "lp-card",
				id: "lp-share",
				"aria-label": props.card.title_zh
			}, h$34("div", { className: "lp-card-head" }, h$34("h3", { className: "lp-card-title" }, props.card.title_zh)), h$34("p", { className: "lp-small lp-muted lp-measure" }, "上面身体年龄卡里的那句话，可以复制下来发给家人或朋友。"), action);
			return h$34("section", {
				className: "lp-card",
				id: "lp-share",
				"aria-label": props.card.title_zh
			}, h$34("div", { className: "lp-card-head" }, h$34("h3", { className: "lp-card-title" }, props.card.title_zh)), h$34("p", { className: "lp-text lp-strong" }, props.card.headline_zh), ...props.card.lines_zh.map((line) => h$34("p", {
				key: line,
				className: "lp-small lp-muted"
			}, line)), props.card.footnote_zh ? h$34("p", { className: "lp-caption lp-measure" }, props.card.footnote_zh) : null, action);
		}
		//#endregion
		//#region src/client/feedback/index.ts
		const h$33 = react.default.createElement;
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
			return h$33(react.default.Fragment, null, shown.length > 0 ? h$33(FeedbackCard, { messages: shown }) : null, share ? h$33(ShareCard, {
				card: share,
				onNotice: props.onNotice,
				compact: messages.some((row) => row.subject.kind === "bioage" && row.headline_zh === share.headline_zh)
			}) : null);
		}
		registerOverviewCard({
			id: "feedback",
			order: 25,
			Component: FeedbackBlock
		});
		//#endregion
		//#region src/client/results.ts
		const h$32 = react.default.createElement;
		/** More than this and the tags crowd the card; the action below lists the rest. */
		const NEEDS_SHOWN = 3;
		function EstimateTag() {
			return h$32("span", {
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
			return h$32("span", {
				className: "lp-tag",
				"data-result-label": props.label
			}, labelText(props.label));
		}
		/**
		* The title row holds the title and ⓘ only (ⓘ follows the last word when the title wraps); the tags sit on the
		* next line (#16). An unmatched result is not a tag: the grid says so once above, the card keeps its source line.
		*/
		function CardHead(props) {
			const tags = [props.estimate === false ? null : h$32(EstimateTag, { key: "estimate" }), props.mark && props.mark !== "unverified-binding" ? h$32(LabelTag, {
				key: "mark",
				label: props.mark
			}) : null].filter(Boolean);
			return h$32(react.default.Fragment, null, h$32("div", { className: "lp-card-head" }, h$32("h3", { className: "lp-card-title lp-result-title" }, props.label, " ", h$32(Info, { label: props.label }, props.info))), tags.length > 0 ? h$32("div", { className: "lp-tags" }, ...tags) : null);
		}
		/** A result's number as the method sentence prints it (formatMeasure's rounding) with its unit. */
		function shownOf(result) {
			const out = primaryOutput(result);
			if (!out || out.value == null || out.value === "") return "";
			const figure = typeof out.value === "number" ? String(Number(out.value.toFixed(2))) : String(out.value).trim();
			const unit = out.unit ? plainUnits(facingUnit(out.unit, out.key)) : "";
			return `${figure}${unit ? unit === "%" ? "%" : ` ${unit}` : ""}`;
		}
		/** The one line above the result grid when any card is not matched to the person yet (P1-6): the cards keep only their source. */
		/** The model's own age and sex facts are the profile's 年龄 / 性别 questions: never listed twice. */
		function riskFacts(facts) {
			return facts.filter((fact) => !/^(实足)?年龄$|^性别/.test(fact.trim()));
		}
		/** An unmatched result's caption: only its source (来源：肌酐(Cr) 84 μmol/L。), or nothing. */
		function bindingCaption(result) {
			const out = primaryOutput(result);
			const rest = restOfSentence(resultSentence(result, { youngerAllowed: false }), titleOf(result.skill, result.title_zh, out?.key ?? ""), shownOf(result)).replace(/^还没对上[，,。]?/, "").trim();
			return rest && rest !== "。" ? rest : "";
		}
		/** The measured value in a source line (来源：睡眠时长 5.6 小时。 → 5.6 小时), for word results (P2-20). */
		function measuredOf(source) {
			if (!source.startsWith("来源")) return "";
			return /(−?\d+(?:\.\d+)?\s*[^\s，,。；;、\d()（）]*)\s*。?$/.exec(source)?.[1]?.trim() ?? "";
		}
		/** A one-character word result reads as a judgement: 短 → 偏短. */
		function judgementWord(word) {
			return /^[短长高低]$/.test(word) ? `偏${word}` : word;
		}
		/** A method sentence without what the card already shows: its title, and the value when the figure is on the card. */
		function restOfSentence(sentence, title, shown) {
			let text = plainUnits(sentence);
			if (text.startsWith(`${title}是 `)) text = text.slice(title.length + 2);
			const value = plainUnits(shown);
			if (value && text.startsWith(value)) text = text.slice(value.length).trim();
			const wrapped = /^[（(]([^（）()]*(?:[（(][^（）()]*[）)][^（）()]*)*)[）)]。?(.*)$/.exec(text);
			if (wrapped) text = `${wrapped[1] ?? ""}。${wrapped[2] ?? ""}`;
			return text.replace(/^[，,。\s]+/, "").trim();
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
				label: `回答 ${Math.max(1, riskFacts(risk.missing_facts).length + (journey.profile.age == null ? 1 : 0) + (journey.profile.sex !== "male" && journey.profile.sex !== "female" ? 1 : 0))} 个问题`,
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
			const self = props.selfAddon && props.selfAddon.self_key && action?.target !== "profile" && action?.target !== "records" ? props.selfAddon : null;
			const all = [...props.questions, ...props.labs];
			const count = [props.questions.length > 0 ? `${props.questions.length} 个问题` : "", props.labs.length > 0 ? `${props.labs.length} 项指标` : ""].filter(Boolean).join("、");
			const needs = all.length > 0 ? h$32("div", { className: "lp-tags lp-result-needs" }, h$32("span", { className: "lp-caption" }, `还差 ${count}`), ...all.slice(0, NEEDS_SHOWN).map((need) => h$32("span", {
				className: "lp-tag",
				key: need
			}, need)), all.length > NEEDS_SHOWN ? h$32("span", { className: "lp-caption" }, "…") : null) : h$32("p", { className: "lp-blocker" }, props.blocker ? `还缺：${props.blocker.replace(/^记录里还缺|^档案里还缺|^还缺/, "").replace(/^[：:]/, "")}` : "还缺计算需要的数据。");
			return h$32("div", { className: "lp-card lp-result" }, h$32(CardHead, {
				label: props.label,
				info: props.info
			}), h$32("div", { className: "lp-result-wait" }, "暂时无法计算"), needs, props.note ?? null, self?.self_key ? h$32("div", { className: "lp-result-foot" }, h$32("div", { className: "lp-result-self" }, h$32("div", { className: "lp-caption" }, `${self.item_zh}可以自己在家量，记下就能算：`), h$32(InlineSelf, {
				journey: props.journey,
				selfKey: self.self_key,
				idPrefix: `${props.idPrefix}-self`,
				onNotice: props.onNotice
			}))) : action ? h$32("div", { className: "lp-result-foot" }, h$32(Btn, {
				variant: "outline",
				onClick: () => props.onAction(action.target)
			}, action.label)) : null);
		}
		function BodyAgeCard(props) {
			const result = props.journey.results.bioage;
			if (result.status !== "ok") return h$32(Blocked, {
				journey: props.journey,
				label: "身体年龄",
				info: BIOAGE_INFO,
				blocker: result.blocker_zh,
				questions: props.journey.profile.age == null ? ["年龄"] : [],
				labs: result.missing,
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
			const binding = props.method && props.method.label === "unverified-binding" ? bindingCaption(props.method) : "";
			const gradedText = concernLine ? result.headline_zh || graded?.headline_zh || "" : graded ? younger ? graded.headline_zh : stripYoungerClaim(graded.headline_zh) : "";
			const caption = older ? [
				older,
				younger && graded ? graded.headline_zh : "",
				binding
			].filter(Boolean).join("") : [binding, gradedText].filter(Boolean).join("");
			const info = h$32(react.default.Fragment, null, h$32("span", { className: "lp-info-line" }, BIOAGE_INFO), band != null ? h$32("span", { className: "lp-info-line" }, `浅色带是第一次检查的个体正常波动（±${fmt$1(band)} 岁${partial ? `，未含${bio?.band_missing?.join("、")}` : ""}），落在带外才算真实变化。`) : null, date ? h$32("span", { className: "lp-info-line" }, `最近一次：${chineseDate(date)}体检，共 ${count} 次完整血检。`) : null);
			return h$32("div", {
				className: "lp-card lp-result",
				...props.method ? { "data-result-label": props.method.label } : {}
			}, h$32(CardHead, {
				label: "身体年龄",
				info,
				mark: props.method?.label ?? null
			}), h$32("div", { className: "lp-result-figure" }, h$32("span", { className: props.method?.label === "unverified-binding" ? "lp-num-md" : "lp-num-lg" }, plainUnits(fmt$1(phenoage))), h$32("span", { className: "lp-bignum-unit" }, "岁"), younger ? h$32("span", { className: "lp-badge lp-badge-good" }, "真实的变化") : null), !older && versusCalendarAge(result.advance) ? h$32("p", { className: "lp-caption lp-bioage-gap" }, versusCalendarAge(result.advance)) : null, result.caveat_zh && !concernLine ? h$32("div", {
				className: "lp-callout lp-callout-warn",
				role: "note"
			}, h$32(Icon, {
				name: "warn",
				size: 14
			}), h$32("span", null, plainUnits(result.caveat_zh))) : null, points.length > 1 ? h$32(LineChart, {
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
			}) : props.tracking == null ? h$32(Skeleton, { height: 40 }) : null, caption ? h$32("p", {
				className: "lp-caption lp-method-sentence",
				id: "lp-bioage-feedback"
			}, plainUnits(caption)) : null, h$32(KeyTrends, {
				journey: props.journey,
				older: (latest?.advance ?? result.advance ?? 0) > 0,
				covered: props.covered
			}), h$32("p", { className: "lp-fine lp-result-note" }, [count > 0 ? `${count} 次体检` : "", points.length > 1 && band != null ? "浅色带为正常波动（这点变化不算数）" : ""].filter(Boolean).join(" · ")));
		}
		function KeyTrends(props) {
			const covered = props.covered ?? NOTHING_COVERED;
			const changes = props.journey.changes ?? [];
			const below = new Set(notableRows(changes, covered).map((row) => row.key));
			const trends = pickKeyTrends(changes.filter((row) => !isCovered(covered, row) && !below.has(row.key)), props.older);
			if (trends.length === 0) return null;
			return h$32("div", { className: "lp-key-trends" }, h$32("div", { className: "lp-caption" }, "旁边的变化"), h$32("ul", { "aria-label": "旁边的变化" }, ...trends.map((row) => h$32("li", { key: row.label_zh }, h$32("span", { className: "lp-strong" }, row.label_zh), h$32("span", { className: "lp-caption" }, ` ${plainUnits(row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() : row.text_zh)}`)))));
		}
		function rangeCaption(age) {
			const text = modelRangeNote("china-par", age);
			return text ? h$32("p", {
				className: "lp-caption",
				id: "lp-risk-range"
			}, text) : null;
		}
		/** The library run the risk card shows: an unmatched run only when it gives the card's own number. */
		function riskCardMethod(journey, method) {
			const risk = journey.results.risk;
			const out = method ? primaryOutput(method) : null;
			const same = out != null && typeof out.value === "number" && risk.risk_pct != null && Math.abs(out.value - risk.risk_pct) < .05;
			return method && (method.label !== "unverified-binding" || same) ? method : void 0;
		}
		function RiskCard(props) {
			const result = props.journey.results.risk;
			const range = rangeCaption(props.journey.profile.age);
			if (result.status !== "ok") {
				const profile = props.journey.profile;
				const questions = [
					...profile.age == null ? ["年龄"] : [],
					...profile.sex !== "male" && profile.sex !== "female" ? ["性别"] : [],
					...riskFacts(result.missing_facts)
				];
				return h$32(Blocked, {
					journey: props.journey,
					label: "10 年心血管风险",
					info: RISK_INFO,
					blocker: result.blocker_zh,
					questions,
					labs: result.missing_labs,
					note: range,
					action: riskAction(props.journey),
					selfAddon: riskSelfAddon(props.journey),
					onAction: props.onAction,
					onNotice: props.onNotice,
					idPrefix: "lp-risk"
				});
			}
			const card = props.tracking?.models?.find((row) => row.model === "china-par");
			const goal = card?.goal?.risk_pct;
			const method = riskCardMethod(props.journey, props.method);
			const binding = method && method.label === "unverified-binding" ? bindingCaption(method) : "";
			return h$32("div", {
				className: "lp-card lp-result",
				...method ? { "data-result-label": method.label } : {}
			}, h$32(CardHead, {
				label: "10 年心血管风险",
				info: h$32(react.default.Fragment, null, h$32("span", { className: "lp-info-line" }, RISK_INFO), card?.note_zh ? h$32("span", { className: "lp-info-line" }, card.note_zh) : null),
				mark: method?.label ?? null
			}), h$32("div", { className: "lp-result-figure" }, h$32("span", { className: "lp-num-lg" }, riskText(result.risk_pct)), h$32("span", { className: "lp-bignum-unit" }, "%"), result.category_zh ? h$32("span", { className: "lp-badge lp-badge-neutral" }, result.category_zh) : null), range, goal != null && Number.isFinite(goal) ? h$32("div", { className: "lp-result-goal" }, h$32("span", { className: "lp-caption" }, "达到方案目标约"), h$32("span", { className: "lp-strong" }, `${riskText(goal)}%`), card?.category_zh?.goal ? h$32("span", { className: "lp-badge lp-badge-good" }, card.category_zh.goal) : null) : null, binding ? h$32("p", { className: "lp-caption lp-method-sentence" }, binding) : null, h$32("p", { className: "lp-caption lp-result-note" }, [result.date ? `按 ${chineseDate(result.date)}的记录和你的档案计算` : "", "未来 10 年发生心梗、脑卒中等的估计概率"].filter(Boolean).join(" · ")));
		}
		function MethodCard(props) {
			const out = primaryOutput(props.result);
			const numeric = out != null && typeof out.value === "number";
			const title = titleOf(props.result.skill, props.result.title_zh, out?.key ?? "");
			const figure = numeric ? String(Number(out.value.toFixed(2))) : out && typeof out.value === "string" ? out.value.trim() : "";
			const unit = out?.unit ? plainUnits(facingUnit(out.unit, out.key)) : "";
			const unmatched = props.result.label === "unverified-binding";
			const sentence = unmatched ? bindingCaption(props.result) : figure ? restOfSentence(resultSentence(props.result, { youngerAllowed: false }), title, shownOf(props.result)) : plainUnits(resultSentence(props.result, { youngerAllowed: false }));
			return h$32("div", {
				className: "lp-card lp-result",
				"data-result-label": props.result.label
			}, h$32(CardHead, {
				label: title,
				info: h$32("span", { className: "lp-info-line" }, props.result.limits_zh || "模型估计，不是诊断。"),
				mark: props.result.label
			}), numeric ? h$32("div", { className: "lp-result-figure" }, h$32("span", { className: unmatched ? "lp-num-md" : "lp-num-lg" }, plainUnits(figure)), unit ? h$32("span", { className: "lp-bignum-unit" }, unit) : null) : figure ? h$32("div", { className: "lp-result-figure" }, h$32("span", { className: "lp-num-md" }, [unmatched ? measuredOf(sentence) : "", judgementWord(plainUnits(figure))].filter(Boolean).join(" · "))) : null, sentence ? h$32("p", { className: `${unmatched ? "lp-caption" : "lp-muted"} lp-method-sentence` }, sentence) : null);
		}
		function EvidenceCard(props) {
			const species = speciesOf(props.result) ?? "未标明";
			return h$32("section", {
				className: "lp-card lp-result lp-method-evidence",
				"data-result-label": "evidence-only"
			}, h$32(CardHead, {
				label: "文献证据",
				info: h$32("span", { className: "lp-info-line" }, props.result.limits_zh),
				mark: "evidence-only",
				estimate: false
			}), h$32("p", { className: "lp-strong" }, `物种：${species}`), h$32("p", { className: "lp-method-sentence" }, plainUnits(resultSentence(props.result, { youngerAllowed: false }))));
		}
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
			const values = extras.map((row, index) => h$32(MethodCard, {
				key: `value-${index}`,
				result: row
			}));
			const evidence = slice.evidence.map((row, index) => h$32(EvidenceCard, {
				key: `evidence-${index}`,
				result: row
			}));
			const bio = h$32(BodyAgeCard, {
				key: "bio",
				...props,
				method: pheno
			});
			const risk = h$32(RiskCard, {
				key: "risk",
				...props,
				method: riskMethod
			});
			const feedback = h$32(FeedbackBlock, {
				key: "feedback",
				journey: props.journey,
				tracking: props.tracking,
				onNotice: props.onNotice,
				recordChanges: false
			});
			const cards = riskFirst ? [risk, bio] : [bio, risk];
			const shownMethods = [
				props.journey.results.bioage.status === "ok" ? pheno : void 0,
				props.journey.results.risk.status === "ok" ? riskCardMethod(props.journey, riskMethod) : void 0,
				...extras
			];
			const unmatchedCount = shownMethods.filter((row) => row?.label === "unverified-binding").length;
			return h$32("div", {
				className: "lp-stack",
				id: "lp-results"
			}, unmatchedCount > 0 ? h$32("p", { className: "lp-caption" }, unmatchedCount === shownMethods.filter(Boolean).length ? "下面的结果都还没和你的记录逐项对上（各卡写了用的是哪个数值），先别当成你的结果。" : `其中 ${unmatchedCount} 项结果还没和你的记录逐项对上（卡里写了用的是哪个数值），先别当成你的结果。`) : null, h$32("div", { className: "lp-grid-2 lp-results" }, ...cards, ...values), evidence.length > 0 ? h$32("div", {
				className: "lp-stack",
				id: "lp-methods"
			}, ...evidence) : null, h$32("div", { className: "lp-grid-2 lp-results lp-results-plan" }, feedback));
		}
		//#endregion
		//#region src/client/triage/care-card.ts
		const h$31 = react.default.createElement;
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
			return h$31(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "给医生的一页简报",
				onClose: props.onClose,
				headless: true,
				className: "lp-brief-dialog"
			}, h$31("div", { className: "lp lp-brief-modal" }, h$31("h2", { className: "lp-h2" }, "给医生的一页简报"), h$31("p", { className: "lp-caption" }, "数字来自你的体检记录；姓名一栏留空，打印后手写。这不是诊断。"), h$31("pre", {
				className: "lp-brief-pre",
				tabIndex: 0
			}, answer.markdown ?? ""), h$31("div", { className: "lp-modal-actions" }, id ? h$31(LinkButton, {
				href: `/api/longpi/brief?id=${encodeURIComponent(id)}&format=md&download=1`,
				icon: "download",
				download: `longpi-doctor-brief-${answer.brief?.created ?? ""}.md`
			}, "存成文件") : null, h$31(Btn, {
				variant: "outline",
				onClick: () => printText("给医生的一页简报", answer.markdown ?? "")
			}, "打印"), h$31(Btn, {
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
					props.onNotice(status === "visited" ? "记下了医生的结论。下一步和方案会跟着调整。" : status === "booked" ? `记下了：${chineseDate(date)}看医生。去之前可以打印简报。` : "记下了。想去的时候，简报随时可以打印。", "good");
					setStep("none");
					notifyChanged();
				} catch (err) {
					props.onNotice(`没有保存：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(false);
				}
			};
			const lastText = last ? last.care_status === "booked" ? `已约 ${chineseDate(last.visit_date)}`.trim() : last.care_status === "declined" ? "你说暂时不去" : last.care_status === "visited" ? `已看过 ${chineseDate(last.visit_date)}`.trim() : "" : "";
			return h$31("div", { className: "lp-care-visit" }, h$31("p", { className: "lp-small lp-muted" }, lastText ? `约了吗？医生怎么说？（上次：${lastText}）` : "约了吗？医生怎么说？"), step === "none" ? h$31("div", { className: "lp-actions" }, h$31(Btn, {
				variant: "outline",
				disabled: busy,
				onClick: () => setStep("booked")
			}, "已预约"), h$31(Btn, {
				variant: "outline",
				disabled: busy,
				onClick: () => setStep("visited")
			}, "看完了"), h$31(Btn, {
				variant: "ghost",
				disabled: busy,
				onClick: () => {
					send("declined");
				}
			}, "暂时不去")) : null, step !== "none" ? h$31("div", { className: "lp-care-visit-form" }, h$31("div", { className: "lp-field lp-care-date" }, h$31("label", {
				className: "lp-field-label",
				htmlFor: "lp-care-visit-date"
			}, step === "booked" ? "就诊日期" : "看医生的日期"), h$31("input", {
				id: "lp-care-visit-date",
				type: "date",
				className: "lp-input",
				value: date,
				onChange: (event) => setDate(event.target.value)
			})), step === "visited" ? h$31("div", { className: "lp-field" }, h$31("label", {
				className: "lp-field-label",
				htmlFor: "lp-care-visit-outcome"
			}, "医生怎么说"), h$31("textarea", {
				id: "lp-care-visit-outcome",
				className: "lp-input",
				rows: 2,
				placeholder: "例如：缺铁，开了药，3 个月后复查",
				value: outcome,
				onChange: (event) => setOutcome(event.target.value)
			})) : null, h$31("div", { className: "lp-actions" }, h$31(Btn, {
				disabled: busy || !date,
				onClick: () => {
					send(step);
				}
			}, busy ? "保存中…" : "保存"), h$31(Btn, {
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
			const detail = careDetail(journey.next.title_zh, journey.next.detail_zh);
			return h$31("section", {
				className: "lp-card lp-care-box",
				"aria-label": "请先去看医生",
				id: "lp-care"
			}, h$31("div", { className: "lp-card-head" }, h$31("h3", { className: "lp-h3 lp-care-title" }, h$31(Icon, {
				name: "warn",
				size: 16
			}), "最重要的一步")), h$31("div", { className: "lp-care-text" }, h$31("p", { className: "lp-strong" }, journey.next.title_zh), detail ? h$31("p", { className: "lp-muted" }, detail) : null), h$31("div", { className: "lp-actions" }, h$31(Btn, {
				disabled: busy,
				onClick: () => {
					openBrief();
				}
			}, busy ? "正在整理…" : "医生简报（可打印）"), h$31(Btn, {
				variant: "outline",
				onClick: props.onIndicators
			}, "看这些指标"), journey.triage.needs_sex ? h$31(Btn, {
				variant: "outline",
				onClick: props.onProfile
			}, "填写性别") : null), h$31(VisitForm, {
				journey,
				onNotice: props.onNotice
			}), brief ? h$31(BriefModal, {
				answer: brief,
				onClose: () => setBrief(null)
			}) : null);
		}
		//#endregion
		//#region src/client/life.ts
		const h$30 = react.default.createElement;
		/** Sleep and training reuse the labs table; the filter lives here because the page keeps only the labs filter. */
		function AreaTab(props) {
			const [filter, setFilter] = react.default.useState("all");
			return h$30(IndicatorsTab, {
				filter,
				onFilter: setFilter,
				onConnect: props.onConnect,
				area: props.area
			});
		}
		function SleepTab(props = {}) {
			return h$30(AreaTab, {
				area: "sleep",
				onConnect: props.onConnect
			});
		}
		function TrainingTab(props = {}) {
			return h$30(AreaTab, {
				area: "training",
				onConnect: props.onConnect
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
			return h$30("div", { className: "lp-tab-body" }, h$30("section", {
				className: "lp-card",
				"aria-labelledby": "lp-ask-title"
			}, h$30("div", { className: "lp-card-head" }, h$30("h3", {
				className: "lp-card-title",
				id: "lp-ask-title"
			}, "可以这样问")), h$30("p", { className: "lp-muted lp-text" }, "想问就问，不用攒着。问吃药、补剂、饮食、检查或身体不舒服，会先直接回答，再把该知道的说全；问记录的变化和进度，回答分三小段：我看到的、数据说明不了的、下一步。"), h$30("ul", { className: "lp-ask-list" }, ...questions.map((text) => h$30("li", { key: text }, h$30("button", {
				type: "button",
				className: "lp-ask-btn",
				onClick: () => ask(text)
			}, h$30("span", { className: "lp-row-main" }, text), h$30(Icon, {
				name: "chevron",
				size: 14
			})))))));
		}
		function EmptyLine(props) {
			return h$30("div", { className: "lp-empty" }, h$30(Icon, {
				name: props.icon,
				size: 20
			}), h$30("div", { className: "lp-empty-title" }, props.title), h$30("p", { className: "lp-empty-text" }, props.text));
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
			const fallback = suggestions.length === 0 ? retests[0] : void 0;
			const suggestionRows = suggestions.length > 0 ? suggestions.map((row) => h$30("li", {
				key: row.id,
				className: "lp-row lp-cal-row"
			}, h$30("span", { className: "lp-cal-date" }, dateZh$1(row.date ?? "")), h$30("div", { className: "lp-row-main" }, row.title_zh), h$30("div", { className: "lp-cal-actions" }, h$30(Btn, {
				size: "sm",
				onClick: () => confirm(row)
			}, "放进日程")))) : fallback ? [h$30("li", {
				key: "retest",
				className: "lp-row lp-cal-row"
			}, h$30("span", { className: "lp-cal-date" }, dateZh$1(fallback.date ?? "")), h$30("div", { className: "lp-row-main" }, h$30("div", null, fallback.text_zh), h$30("div", { className: "lp-caption" }, "带着上次的简报和你想问的问题。")), h$30("div", { className: "lp-cal-actions" }, h$30(Btn, {
				size: "sm",
				onClick: () => confirm({
					date: fallback.date ?? "",
					title_zh: fallback.text_zh,
					brief_zh: "带着简报和问题。",
					questions_zh: suggestedQuestions({ visit: fallback.date }).slice(0, 2),
					kind: "retest"
				})
			}, "放进日程"), h$30(Btn, {
				size: "sm",
				variant: "outline",
				onClick: () => setNote("先不写上。")
			}, "先不用")))] : [];
			return h$30("div", { className: "lp-tab-body" }, events.length === 0 && retests.length === 0 ? h$30("section", {
				className: "lp-card",
				"aria-label": "已写上的日期"
			}, h$30(EmptyLine, {
				icon: "calendar",
				title: "还没有写上的日期",
				text: "复查、看医生、稍后要做的事。LongPi 的建议要你点一下才写上日期。"
			}), suggestionRows.length === 0 && note ? h$30("p", {
				className: "lp-caption",
				role: "status"
			}, note) : null) : h$30("section", {
				className: "lp-card",
				"aria-labelledby": "lp-cal-title"
			}, h$30("div", { className: "lp-card-head" }, h$30("h3", {
				className: "lp-card-title",
				id: "lp-cal-title"
			}, "已写上的日期")), h$30("ul", { className: "lp-rows" }, ...events.map((row) => h$30("li", {
				key: row.id,
				className: "lp-row lp-cal-line"
			}, h$30("span", { className: "lp-cal-date" }, dateZh$1(row.date ?? "")), h$30("div", { className: "lp-row-main" }, h$30("div", { className: "lp-strong" }, row.title_zh), row.brief_zh ? h$30("div", { className: "lp-muted" }, row.brief_zh) : null, row.questions_zh.length > 0 ? h$30("div", { className: "lp-caption" }, `可以问：${row.questions_zh.join("；")}`) : null))), ...retests.map((row) => h$30("li", {
				key: row.text_zh,
				className: "lp-row lp-cal-line"
			}, h$30("span", { className: "lp-cal-date" }, dateZh$1(row.date ?? "")), h$30("div", { className: "lp-row-main lp-strong" }, row.text_zh)))), suggestionRows.length === 0 && note ? h$30("p", {
				className: "lp-caption",
				role: "status"
			}, note) : null), suggestionRows.length > 0 ? h$30("section", {
				className: "lp-card",
				id: "lp-cal-suggest",
				"aria-labelledby": "lp-cal-suggest-title"
			}, h$30("div", { className: "lp-card-head" }, h$30("h3", {
				className: "lp-card-title",
				id: "lp-cal-suggest-title"
			}, "建议，还没写上")), h$30("ul", { className: "lp-rows" }, ...suggestionRows), note ? h$30("p", {
				className: "lp-caption",
				role: "status"
			}, note) : null) : null, h$30(Timeline, { journey: props.journey }));
		}
		function Timeline(props) {
			const [wearables, setWearables] = react.default.useState([]);
			react.default.useEffect(() => {
				getJson("/api/longpi/indicators").then((data) => {
					const rows = [];
					for (const group of data.groups ?? []) for (const row of group.indicators ?? []) {
						if (row.source !== "device" || !row.latest?.date || !row.label_zh) continue;
						if (!/睡眠|步数/.test(row.label_zh)) continue;
						const unit = prettyUnits(row.unit ?? "");
						const number = row.latest.text ?? (row.latest.value == null ? "" : fmtAuto(row.latest.value));
						const value = !number || !unit ? number : unit.startsWith("%") ? `${number}${unit}` : `${number} ${unit}`;
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
			if (items.length === 0) return h$30("section", {
				className: "lp-card",
				id: "lp-timeline",
				"aria-label": "按日期排"
			}, h$30(EmptyLine, {
				icon: "calendar",
				title: "还没有可以按日期排的事",
				text: "化验、手环和生活上的事放在一起，才看得出比如复查前生过病。"
			}));
			return h$30("section", {
				className: "lp-card",
				id: "lp-timeline",
				"aria-labelledby": "lp-timeline-title"
			}, h$30("div", { className: "lp-card-head" }, h$30("h3", {
				className: "lp-card-title",
				id: "lp-timeline-title"
			}, "按日期排")), h$30(react.default.Fragment, null, h$30("p", { className: "lp-muted" }, "化验、手环和生活上的事放在一起，才看得出比如复查前生过病。"), h$30("ol", { className: "lp-rows" }, ...items.slice(-8).map((item, index, shown) => h$30("li", {
				key: `${item.kind}-${item.date}-${item.title_zh}`,
				className: "lp-row lp-cal-line"
			}, h$30("span", { className: "lp-cal-date" }, index > 0 && shown[index - 1]?.date === item.date ? "" : dateZh$1(item.date)), h$30("span", { className: "lp-row-main" }, cleanLabel$1(`${item.title_zh} · ${item.detail_zh}`)))))));
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
			return h$30("section", {
				className: "lp-card lp-insight",
				id: "lp-insight"
			}, h$30("div", { className: "lp-label" }, "今日洞察"), h$30("p", null, text));
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
			return h$30("section", {
				className: "lp-card lp-science-invite",
				id: "lp-science-invite"
			}, h$30("div", { className: "lp-label" }, "一起研究"), h$30("p", null, SCIENCE_INTRO), h$30("p", { className: "lp-caption" }, waiting), h$30("div", { className: "lp-form-actions" }, h$30(Btn, { onClick: () => props.goTab("science") }, "加入"), h$30(Btn, {
				variant: "outline",
				onClick: later
			}, "以后再说")));
		}
		//#endregion
		//#region src/client/overview.ts
		const h$29 = react.default.createElement;
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
			return h$29("div", { className: "lp-week" }, h$29("div", { className: "lp-week-line" }, h$29("span", { className: "lp-caption" }, "本周"), h$29("ol", {
				className: "lp-week-cells",
				"aria-label": `近 7 天：${week.map((day) => `${chineseDate(day.date)}${DAY_ZH[day.state]}`).join("，")}`
			}, ...week.map((day) => h$29("li", {
				key: day.date,
				className: `lp-week-cell lp-week-${day.state}`,
				title: `${chineseDate(day.date)} ${DAY_ZH[day.state]}`
			}, h$29("span", {
				className: "lp-week-day",
				"aria-hidden": true
			}, WEEK_ZH[(/* @__PURE__ */ new Date(`${day.date}T12:00:00Z`)).getUTCDay()]))))), retestText ? h$29("p", { className: "lp-caption" }, retestText) : null);
		}
		function TodayCard(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const counts = todayCounts(props.journey);
			return h$29("section", {
				className: "lp-card",
				id: "lp-today",
				"aria-labelledby": "lp-today-title"
			}, h$29("div", { className: "lp-card-head" }, h$29("h3", {
				className: "lp-card-title",
				id: "lp-today-title"
			}, "今天", counts.total > 0 ? h$29("span", { className: "lp-caption lp-num" }, `${counts.done}/${counts.total}`) : null)), h$29(TodayList, {
				journey: props.journey,
				stateOf,
				busy,
				onAnswer: answer
			}), h$29(WeekStrip, {
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
		/** Next steps that are the unfinished setup, which the banner above the tabs already offers (P2-3). */
		const SETUP_ACTIONS = [
			"consent",
			"profile",
			"records"
		];
		function NextCard(props) {
			const next = props.journey.next;
			if (!next.title_zh && !next.detail_zh) return null;
			if (SETUP_ACTIONS.includes(next.action) && stepsLeft(props.journey) > 0) return null;
			if (next.action === "checkin" && props.journey.plan.exists) return null;
			const cta = ctaOf(next.action, props);
			return h$29("section", {
				className: "lp-card lp-next-card",
				"aria-label": "下一步"
			}, h$29("div", { className: "lp-next-text" }, h$29("div", { className: "lp-caption" }, "下一步"), h$29("h3", { className: "lp-h3" }, next.title_zh), next.detail_zh && next.detail_zh !== next.title_zh ? h$29("p", { className: "lp-muted lp-small" }, next.detail_zh) : null), cta ? h$29(Btn, { onClick: cta.run }, cta.label) : null);
		}
		/** Some reads failed: the missing values are unknown, not "not measured". */
		function PartialNote(props) {
			const records = props.journey.records;
			if (records.status !== "partial") return null;
			const missing = records.missing_reads.filter((name) => name && !isDiagnosisName(name)).map((name) => scrubVisible(name)).filter(Boolean);
			const errors = records.read_errors.map((line) => scrubVisible(line)).filter(Boolean);
			return h$29("div", {
				className: "lp-callout lp-callout-warn",
				role: "note"
			}, h$29(Icon, {
				name: "warn",
				size: 14
			}), h$29("span", null, `有一部分记录这次没有读到${errors.length > 0 ? `（${errors.slice(0, 2).join("；")}）` : ""}。`, missing.length > 0 ? `没读到的指标：${missing.slice(0, 6).join("、")}${missing.length > 6 ? ` 等 ${missing.length} 项` : ""}。` : "", "它们不是「没测」，稍后点右上角的刷新再读一次。"));
		}
		function Overview(props) {
			const { journey } = props;
			const doctor = journey.next.action === "doctor";
			const covered = coveredByCare(journey);
			return h$29("div", { className: "lp-tab-body" }, h$29(PartialNote, { journey }), doctor ? h$29(CareCard, {
				journey,
				onNotice: props.onNotice,
				onIndicators: () => props.goTab("indicators", { filter: "changed" }),
				onProfile: props.openOnboarding
			}) : null, h$29(InsightCard, {
				journey,
				covered
			}), journey.plan.exists ? h$29(TodayCard, {
				journey,
				tracking: props.tracking,
				onNotice: props.onNotice
			}) : null, h$29(ResultsRow, {
				journey,
				tracking: props.tracking,
				onAction: props.onAction,
				onNotice: props.onNotice,
				covered
			}), doctor ? null : h$29(NextCard, props), h$29(NotableChanges, {
				journey,
				covered,
				onOpenIndicators: () => props.goTab("indicators", { filter: "changed" })
			}), doctor ? null : h$29(ScienceIntro, { goTab: props.goTab }));
		}
		//#endregion
		//#region src/client/advice/advice-card.ts
		const h$28 = react.default.createElement;
		function AdviceCard({ advice }) {
			const lines = advice?.tier4?.first_aid_zh ?? advice?.person?.notes_zh ?? [];
			const title = advice?.tier ? `第 ${advice.tier} 层` : "建议";
			return h$28("div", { className: "longpi-advice" }, h$28("div", { className: "longpi-advice-title" }, `${title}${advice?.subject?.name_zh ? ` · ${advice.subject.name_zh}` : ""}`), ...lines.slice(0, 4).map((line, index) => h$28("p", { key: index }, line)));
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
		react.default.createElement;
		//#endregion
		//#region src/client/privacy/data-page.ts
		const h$26 = react.default.createElement;
		function List(props) {
			if (props.lines.length === 0) return null;
			return h$26("div", { className: "lp-data-list" }, h$26("div", { className: "lp-field-label" }, props.title), h$26("ul", { className: "lp-bullets" }, ...props.lines.map((line) => h$26("li", { key: line }, line))));
		}
		/**
		* embedded: inside the settings page's 隐私与数据 block, which has its own
		* title; the whole disclosure then waits behind one 展开 line.
		* hideExport: the host already offers the export (the 档案 tab's 导出 card), so
		* the 导出 part is left out here; settings keeps it.
		*/
		function DataPage(props) {
			const [status, setStatus] = react.default.useState(null);
			const [phrase, setPhrase] = react.default.useState("");
			const [error, setError] = react.default.useState(null);
			const [note, setNote] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/privacy").then(setStatus).catch((err) => setError(errorText(err, "没有读到隐私说明")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const act = (body) => {
				setError(null);
				setBusy(true);
				postJson("/api/longpi/privacy/consent", body).then(() => {
					setNote("已记下");
					if (body.scope === "data_flow_deepseek" && (body.decision === "granted" || body.decision === "declined")) props.onDecided?.(body.decision);
					load();
				}).catch((err) => setError(errorText(err, "没有记下"))).finally(() => setBusy(false));
			};
			const copy = status?.copy;
			const flow = copy?.data_flow;
			const decision = status?.consents?.data_flow_deepseek?.decision;
			const sessionOn = status?.session_log?.upload === true;
			const phraseText = copy?.delete?.phrase ?? "删除全部";
			const minorLine = status?.minor?.ask_age ? copy?.minor?.ask ?? "请填写年龄" : status?.minor?.minor ? copy?.minor?.under_18 ?? "未满 18 岁" : "";
			const title = flow?.title ?? "数据去哪里";
			const body = h$26("div", { className: "lp-data" }, flow ? h$26("div", { className: "lp-data-lists" }, h$26(List, {
				title: "会发给 DeepSeek 的",
				lines: flow.to_deepseek ?? []
			}), h$26(List, {
				title: "留在这台电脑的",
				lines: flow.stays_local ?? []
			}), h$26(List, {
				title: "体检原件留在原来的地方",
				lines: flow.mirobody ?? []
			}), flow.name && !(flow.to_deepseek ?? []).some((line) => /名字|称呼|姓名/.test(line)) ? h$26("p", { className: "lp-caption" }, flow.name) : null) : null, h$26("div", { className: "lp-data-group" }, h$26("div", { className: "lp-field-label" }, "健康对话发给 DeepSeek"), decision === "granted" || decision === "declined" ? h$26("div", { className: "lp-actions" }, h$26("span", { className: `lp-badge ${decision === "granted" ? "lp-badge-good" : "lp-badge-neutral"}` }, decision === "granted" ? "已同意" : "不发送"), h$26(Btn, {
				variant: "outline",
				disabled: busy,
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: decision === "granted" ? "declined" : "granted"
				})
			}, decision === "granted" ? "撤回" : "同意")) : h$26(react.default.Fragment, null, h$26("p", { className: "lp-caption" }, "还没有选择。"), h$26("div", { className: "lp-actions" }, h$26(Btn, {
				disabled: busy,
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: "granted"
				})
			}, copy?.buttons?.flow_grant ?? "同意把健康对话发给 DeepSeek"), h$26(Btn, {
				variant: "outline",
				disabled: busy,
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: "declined"
				})
			}, copy?.buttons?.flow_decline ?? "先不发送")))), h$26("div", { className: "lp-data-group" }, h$26(Switch, {
				checked: sessionOn,
				busy,
				disabled: busy || !status,
				label: "上传会话日志",
				onChange: (next) => act({
					scope: "session_log_upload",
					decision: next ? "granted" : "declined"
				})
			}), h$26("p", { className: "lp-caption" }, flow?.session_log || "健康对话默认不上传会话日志。")), minorLine ? h$26("p", { className: "lp-caption" }, minorLine) : null, props.hideExport ? null : h$26("div", { className: "lp-data-group" }, h$26("div", { className: "lp-field-label" }, "导出"), status?.export?.href ? h$26(LinkButton, {
				href: status.export.href,
				icon: "download"
			}, "下载这台电脑上的 LongPi 档案") : null, status?.export?.mirobody_note_zh ? h$26("p", { className: "lp-caption" }, status.export.mirobody_note_zh) : null), h$26("div", { className: "lp-data-group" }, h$26("div", { className: "lp-field" }, h$26("label", {
				className: "lp-field-label",
				htmlFor: "lp-privacy-phrase"
			}, `删除：输入「${phraseText}」`), h$26("input", {
				id: "lp-privacy-phrase",
				className: "lp-input",
				value: phrase,
				autoComplete: "off",
				onChange: (event) => setPhrase(event.target.value)
			})), h$26("div", { className: "lp-actions" }, h$26(Btn, {
				variant: "outline",
				onClick: () => {
					postJson("/api/longpi/privacy/delete", { confirm: phrase }).then(() => setNote("已删除这台电脑上的 LongPi 档案")).catch((err) => setError(errorText(err, "没有删除")));
				}
			}, "删除这台电脑上的 LongPi 数据")), copy?.delete?.note ? h$26("p", { className: "lp-caption" }, copy.delete.note) : null), error ? h$26("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, note ? h$26("p", {
				className: "lp-conn-ok",
				role: "status"
			}, note) : null);
			if (props.embedded) return h$26("details", {
				className: "lp-data-fold",
				id: "lp-privacy-data"
			}, h$26("summary", null, props.hideExport ? `${title}和删除` : `${title}、导出和删除`), body);
			return h$26("section", {
				className: "lp lp-data-page",
				id: "lp-privacy-data"
			}, h$26("h3", { className: "lp-h3" }, title), body);
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
		const h$25 = react.default.createElement;
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
			return h$25("div", {
				className: `lp lp-tool ${props.quiet ? "lp-tool-quiet" : "lp-tool-card"} ${call.state === "error" ? "lp-tool-error" : ""}`,
				"data-state": call.state
			}, h$25("div", { className: "lp-tool-head" }, h$25("span", {
				className: "lp-tool-icon",
				"aria-hidden": true
			}, h$25(Icon, {
				name: running ? "refresh" : call.state === "error" ? "warn" : props.icon,
				size: 14,
				className: running ? "lp-spin" : ""
			})), h$25("span", { className: "lp-tool-title" }, props.title), props.summary != null ? h$25("span", { className: `lp-tool-summary ${props.tone ? `lp-tool-${props.tone}` : ""}` }, props.summary) : null, props.action ?? null, rawText ? h$25("button", {
				type: "button",
				className: "lp-tool-raw-btn",
				"aria-expanded": raw,
				onClick: () => setRaw((current) => !current)
			}, "原始结果", h$25(Icon, {
				name: "chevron",
				size: 12,
				className: raw ? "lp-rot" : ""
			})) : null), props.children ? h$25("div", { className: "lp-tool-body" }, props.children) : null, raw && rawText ? h$25("pre", { className: "lp-tool-raw" }, rawText) : null);
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
			if (saved) return h$25("div", { className: "lp-tool-saved" }, h$25("span", { className: "lp-badge lp-badge-good" }, h$25(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已保存为方案第 ${saved.version} 版`), saved.reminder ? h$25("span", { className: "lp-caption" }, `打卡提醒没有打开：${saved.reminder}`) : null, openPlan ? h$25("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: openPlan
			}, "在健康页查看 →") : null);
			return h$25("div", { className: "lp-tool-draft" }, h$25(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				compact: true
			}), props.data.brief.notes_zh[0] ? h$25("p", { className: "lp-fine" }, props.data.brief.notes_zh[0]) : null, h$25("div", { className: "lp-form-actions" }, h$25(Btn, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$25("span", { className: "lp-caption" }, "每项是试验里的平均效果，个人结果会不同；补剂不给剂量，不涉及处方药。")), confirming ? h$25(ConfirmModal, {
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
			if (call.state === "running") return h$25(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "正在按你的结果和试验证据起草…"
			});
			if (call.state === "error") return h$25(Shell, {
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
			if (!data) return h$25(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "结果无法显示，展开看原始结果",
				tone: "warn"
			});
			if (!data.draft) return h$25(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: "现在还起草不了"
			}, h$25("p", { className: "lp-muted" }, data.brief.notes_zh[0] || "记录里还没有能对上研究证据的指标。"));
			return h$25(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: saved ? `${data.draft.items.length} 项 · 已采用` : `${data.draft.items.length} 项 · 按证据起草 · 还没有保存`
			}, h$25(DraftCard, {
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
			if (call.state === "running") return h$25(Shell, {
				call,
				icon: "check",
				title,
				summary: confirm ? "正在保存…" : "正在核对…"
			});
			if (call.state === "error") return h$25(Shell, {
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
				return h$25(Shell, {
					call,
					icon: "check",
					title: "保存方案",
					quiet: true,
					summary: h$25("span", { className: "lp-badge lp-badge-good" }, h$25(Icon, {
						name: "check",
						size: 12,
						strokeWidth: 2
					}), version != null ? `已保存为方案第 ${version} 版` : "已保存"),
					action: openPlan ? h$25("button", {
						type: "button",
						className: "lp-tool-undo",
						onClick: openPlan
					}, "在健康页查看 →") : null
				});
			}
			return h$25(Shell, {
				call,
				icon: "check",
				title: "方案复述",
				summary: errors.length > 0 ? "还缺信息，没有保存" : "还没有保存，确认后才保存",
				tone: errors.length > 0 ? "warn" : void 0
			}, readBack.length > 0 ? h$25("ul", { className: "lp-readback" }, ...readBack.map((text, index) => {
				const row = readBackRow(text);
				return h$25("li", { key: index }, row.category ? h$25("span", { className: "lp-tag" }, row.category) : null, h$25("span", { className: "lp-strong" }, row.title), row.rest ? h$25("span", { className: "lp-caption" }, ` ${row.rest}`) : null);
			})) : null, ...errors.map((text) => h$25("p", {
				key: `e:${text}`,
				className: "lp-form-error"
			}, text)), ...warnings.map((text) => h$25("p", {
				key: `w:${text}`,
				className: "lp-caption lp-tool-warn"
			}, h$25(Icon, {
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
			if (call.state === "running") return h$25(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "正在记录…"
			});
			if (call.state === "error") return h$25(Shell, {
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
			const nameOf = (row, withState) => `${titleOf(row)}${withState && row.done === false ? "（没做到）" : ""}${row.date && row.date !== today ? `（${chineseDate(row.date) || row.date}）` : ""}`;
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
			if (entries.length === 0) return h$25(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "没有记下",
				tone: "warn",
				quiet: true
			}, ...problems.map((text) => h$25("p", {
				key: text,
				className: "lp-caption"
			}, text)));
			return h$25(Shell, {
				call,
				icon: "check",
				title: "打卡",
				quiet: true,
				summary: h$25("span", { className: `lp-badge ${onlyTaken ? "lp-badge-neutral" : "lp-badge-good"}` }, h$25(Icon, {
					name: onlyTaken ? "close" : "check",
					size: 12,
					strokeWidth: 2
				}), parts.join("；")),
				action: !undone && undoable.length > 0 ? h$25("button", {
					type: "button",
					className: "lp-tool-undo",
					disabled: undoing,
					onClick: () => {
						undo();
					},
					"aria-label": `撤销今天的打卡：${undoable.map((row) => nameOf(row, true)).join("、")}`
				}, undoing ? "撤销中" : "撤销") : null
			}, error ? h$25("p", { className: "lp-form-error" }, error) : null, ...problems.map((text) => h$25("p", {
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
			return h$25("div", { className: "lp-tool-result" }, h$25("span", { className: "lp-num-md lp-tool-figure" }, props.figure, h$25("span", { className: "lp-unit" }, props.unit)), h$25("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计"), h$25(Info, { label: props.label }, props.info), ...props.lines.filter(Boolean).map((line) => h$25("span", {
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
			if (call.state === "running") return h$25(Shell, {
				call,
				icon: "play",
				title: `计算${plain}`,
				summary: "正在运行方法…"
			});
			if (call.state === "error") return h$25(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: `没有算完：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			if (result.ok !== true) {
				const reason = typeof result.error === "string" && result.error ? result.error : typeof result.error_kind === "string" ? result.error_kind : "方法没有给出结果";
				return h$25(Shell, {
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
				if (phenoage != null) return h$25(Shell, {
					call,
					icon: "play",
					title: BIOAGE_LABEL,
					summary: typeof result.measured_at === "string" ? `按 ${chineseDate(result.measured_at) || result.measured_at}的血检` : void 0
				}, h$25(ResultFigure, {
					figure: fmt$1(phenoage),
					unit: "岁",
					lines: [journey?.results.bioage.headline_zh ? journey.results.bioage.headline_zh : journey?.results.bioage.allows_younger ? versusAge(advance, journey.results.bioage.checkups) : "", band != null ? `正常波动 ±${fmt$1(band)} 岁` : ""],
					label: BIOAGE_LABEL,
					info: BIOAGE_INFO
				}));
			}
			if (name === RISK_SKILL) {
				const risk = numberOf(outputValue(result, "risk_10y_pct"));
				const category = outputValue(result, "risk_category");
				if (risk != null) return h$25(Shell, {
					call,
					icon: "play",
					title: RISK_LABEL,
					summary: typeof result.measured_at === "string" ? `按 ${chineseDate(result.measured_at) || result.measured_at}的记录` : void 0
				}, h$25(ResultFigure, {
					figure: riskText(risk),
					unit: "%",
					lines: [typeof category === "string" ? category : "", "同类人群的平均风险"],
					label: RISK_LABEL,
					info: RISK_INFO
				}));
			}
			const excerpt = typeof result.report_excerpt === "string" ? result.report_excerpt.trim() : "";
			return h$25(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: "已算出"
			}, excerpt ? h$25("details", { className: "lp-tool-report" }, h$25("summary", null, "报告"), h$25("pre", null, excerpt)) : null);
		}
		function SituationToolView(props) {
			const call = parseCall(props.block);
			if (call.state === "running") return h$25(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: "正在读取…"
			});
			if (call.state === "error") return h$25(Shell, {
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
			return h$25(Shell, {
				call,
				icon: "user",
				title: counts ? `已读取你的档案与记录（${counts}）` : "已读取你的档案与记录",
				quiet: true
			}, failed ? h$25("p", { className: "lp-caption lp-tool-warn" }, h$25(Icon, {
				name: "warn",
				size: 12
			}), ` 有一部分记录没有读到${typeof result.record_error === "string" && result.record_error ? `：${result.record_error}` : ""}`) : null, changes.length > 0 ? h$25("p", { className: "lp-tool-doctor" }, h$25(Icon, {
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
		const h$24 = react.default.createElement;
		const PLAIN = PLAIN_QUESTIONS;
		/** One word for where things stay: 这台电脑 (server text sometimes says 你的设备). */
		function localText(text) {
			return (text ?? "").replace(/你的设备/g, "这台电脑");
		}
		/** The page says once, at the top, that nothing leaves before a study starts; study texts drop their copy of that sentence. */
		function withoutStaysLocal(text) {
			return localText(text).replace(/[^。]*研究正式开始[^。]*只保存在[^。]*。/g, "").trim();
		}
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
					setNote("已记下。");
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
			return h$24("article", {
				className: "lp-card",
				id: `lp-study-${props.study.id}`
			}, h$24("div", { className: "lp-card-head" }, h$24("h3", { className: "lp-card-title" }, props.study.title_zh)), h$24("div", { className: "lp-tags" }, h$24("span", { className: `lp-badge ${props.study.consented === "granted" ? "lp-badge-good" : "lp-badge-neutral"}` }, state), h$24("span", { className: "lp-tag" }, props.study.kind === "community_season" ? "社区赛季" : "研究"), props.threshold ? h$24("span", { className: "lp-caption" }, props.threshold) : null), withoutStaysLocal(props.study.summary_zh) ? h$24("p", { className: "lp-text" }, withoutStaysLocal(props.study.summary_zh)) : null, h$24("p", { className: "lp-small lp-muted lp-measure" }, "基因和姓名不参加。"), h$24("details", null, h$24("summary", null, "完整同意书"), h$24("p", { className: "lp-small lp-muted lp-measure" }, localText(props.study.text_zh))), ...questions.map((question) => {
				const plain = PLAIN[question.id];
				const title = plain?.question_zh ?? question.question_zh;
				const options = plain?.options_zh ?? question.options_zh;
				return h$24("fieldset", {
					key: question.id,
					className: "lp-sci-q"
				}, h$24("legend", { className: "lp-field-label" }, title), h$24("div", { className: "lp-sci-options" }, ...options.map((option, index) => h$24("label", {
					key: option,
					className: "lp-check"
				}, h$24("input", {
					type: "radio",
					name: `${props.study.id}-${question.id}`,
					checked: picked[question.id] === index,
					onChange: () => setPicked({
						...picked,
						[question.id]: index
					})
				}), h$24("span", null, localText(option))))));
			}), h$24("div", { className: "lp-actions" }, h$24(Btn, {
				disabled: !ready,
				onClick: submit
			}, "加入"), h$24(Btn, {
				variant: "outline",
				onClick: () => {
					postJson("/api/longpi/science/invite", { decision: "later" }).then(() => setNote("以后再说。本机上的功能还在。")).catch(() => setNote("以后再说。"));
				}
			}, "以后再说"), props.study.consented === "granted" ? h$24(Btn, {
				variant: "outline",
				onClick: withdraw
			}, "退出这项研究") : null), props.personal ? h$24("div", { className: "lp-card-foot" }, h$24("span", { className: "lp-caption lp-measure" }, props.personal.note), h$24(Btn, {
				variant: "outline",
				onClick: props.personal.onStart
			}, "开始个人对照")) : null, h$24("p", { className: "lp-caption lp-measure" }, "已经发出的合计不会收回。"), note ? h$24("p", {
				className: "lp-small lp-measure",
				role: "status"
			}, note) : null);
		}
		//#endregion
		//#region src/client/science/community.ts
		const h$23 = react.default.createElement;
		function CommunityPanel(props) {
			const [topic, setTopic] = react.default.useState(props.voting.mine ?? "");
			const width = props.progress.min_cohort > 0 ? Math.min(100, Math.round(100 * props.progress.contributed / props.progress.min_cohort)) : 0;
			const vote = () => {
				postJson("/api/longpi/science/community", { topic_id: topic }).then(() => props.onChange()).catch((error) => props.onError(error instanceof Error ? error.message : "没有记下"));
			};
			const recruiting = (props.thresholds ?? []).some((row) => row.line_zh.includes("招募中"));
			return h$23(react.default.Fragment, null, h$23("section", {
				className: "lp-card",
				id: "lp-science-progress",
				"aria-labelledby": "lp-science-progress-title"
			}, h$23("div", { className: "lp-card-head" }, h$23("h3", {
				className: "lp-card-title",
				id: "lp-science-progress-title"
			}, "研究进度"), h$23("span", { className: "lp-caption" }, `第 ${props.progress.week} 周 / 共 ${props.progress.weeks} 周`)), h$23("div", {
				className: "lp-bar",
				role: "progressbar",
				"aria-label": `研究进度：${props.progress.label_zh}`,
				"aria-valuemin": 0,
				"aria-valuenow": props.progress.contributed,
				"aria-valuemax": props.progress.min_cohort
			}, h$23("span", { style: { width: `${width}%` } })), h$23("p", { className: "lp-small lp-muted lp-measure" }, recruiting ? "每项研究下面写的是想凑齐的人数，正在招募。现在不显示已经有多少人，也不把人数当成你的结果。" : `本机参加了 ${props.progress.studies} 项研究。发布合计至少 ${props.progress.min_cohort} 人。`)), h$23("section", {
				className: "lp-card",
				id: "lp-science-pulse",
				"aria-label": "大家的结果"
			}, h$23("div", { className: "lp-card-head" }, h$23("h3", { className: "lp-card-title" }, "大家的结果")), props.pulse ? h$23(react.default.Fragment, null, h$23("p", { className: "lp-text lp-strong" }, props.pulse.headline_zh), props.pulse.detail_zh ? h$23("p", { className: "lp-small lp-muted lp-measure" }, localText(props.pulse.detail_zh)) : null) : h$23("div", { className: "lp-empty" }, h$23(Icon, {
				name: "pulse",
				size: 20
			}), h$23("p", { className: "lp-empty-text lp-measure" }, localText(props.give_back_zh) || "还没有发回的群体结果。"))), h$23("section", {
				className: "lp-card",
				id: "lp-science-vote",
				"aria-labelledby": "lp-science-vote-title"
			}, h$23("div", { className: "lp-card-head" }, h$23("h3", {
				className: "lp-card-title",
				id: "lp-science-vote-title"
			}, "下个赛季想先看哪一件")), h$23("div", {
				className: "lp-sci-options",
				role: "radiogroup",
				"aria-labelledby": "lp-science-vote-title"
			}, ...props.voting.topics.map((item) => h$23("label", {
				key: item.id,
				className: "lp-check"
			}, h$23("input", {
				type: "radio",
				name: "lp-science-topic",
				value: item.id,
				checked: topic === item.id,
				onChange: () => setTopic(item.id)
			}), h$23("span", null, item.title_zh), h$23("span", {
				className: "lp-sci-count",
				"aria-label": `${item.votes} 票`
			}, String(item.votes))))), h$23("div", { className: "lp-actions" }, h$23(Btn, {
				variant: "outline",
				onClick: vote,
				disabled: !topic
			}, "记下我的一票"), props.voting.note_zh ? h$23("span", { className: "lp-caption" }, localText(props.voting.note_zh)) : null)), h$23("section", {
				className: "lp-card",
				id: "lp-science-cards",
				"aria-label": "贡献卡"
			}, h$23("div", { className: "lp-card-head" }, h$23("h3", { className: "lp-card-title" }, "贡献卡")), props.cards.length === 0 ? h$23("div", { className: "lp-empty" }, h$23(Icon, {
				name: "spark",
				size: 20
			}), h$23("p", { className: "lp-empty-text lp-measure" }, "贡献卡是你在这台电脑上参加研究之后留下的一张卡，和化验结果好坏无关。完成本机计算后会出现在这里。")) : h$23("ul", { className: "lp-rows" }, ...props.cards.map((card) => h$23("li", {
				key: card.id,
				className: "lp-row lp-row-stack"
			}, h$23("span", { className: "lp-strong" }, card.title_zh), h$23("span", { className: "lp-muted" }, card.body_zh))))));
		}
		//#endregion
		//#region src/client/science/translog.ts
		const h$22 = react.default.createElement;
		function TranslogPanel(props) {
			return h$22("section", {
				className: "lp-card",
				id: "lp-science-log",
				"aria-label": "发出记录"
			}, h$22("div", { className: "lp-card-head" }, h$22("h3", { className: "lp-card-title" }, "发出记录")), props.rows.length === 0 ? h$22("div", { className: "lp-empty" }, h$22(Icon, {
				name: "send",
				size: 20
			}), h$22("p", { className: "lp-empty-text lp-measure" }, "还没有东西离开这台电脑。这里只记离开的东西：什么时候、发给哪一项研究。")) : h$22(react.default.Fragment, null, h$22("p", { className: "lp-small lp-muted lp-measure" }, "这里只记离开这台电脑的东西：什么时候、发给哪一项研究。"), h$22("ol", { className: "lp-rows" }, ...props.rows.map((row) => h$22("li", {
				key: row.seq,
				className: "lp-row"
			}, h$22("span", { className: "lp-row-main" }, scrubVisible(row.detail_zh)), h$22("span", { className: "lp-caption lp-num" }, `${chineseDate(row.at)} ${row.at.slice(11, 16)}`.trim()))))));
		}
		//#endregion
		//#region src/client/science/studies-tab.ts
		const h$21 = react.default.createElement;
		function StudiesTab() {
			const [data, setData] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/science/community").then(setData).catch((reason) => setError(errorText(reason, "没有读到研究")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const startPersonal = () => {
				postJson("/api/longpi/science/n-of-1", {
					confirm: true,
					design: "abab"
				}).then(() => load()).catch((reason) => setError(errorText(reason, "没有排好")));
			};
			if (!data) return h$21("div", { className: "lp-tab-body" }, error ? h$21("div", {
				className: "lp-callout lp-callout-warn",
				role: "alert"
			}, h$21(Icon, {
				name: "warn",
				size: 14
			}), h$21("p", { className: "lp-callout-body" }, error), h$21("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => {
					setError("");
					load();
				}
			}, "重试")) : h$21("p", { className: "lp-small lp-muted lp-measure" }, "正在读取研究…"));
			if (data.mode === "off") return h$21("div", { className: "lp-tab-body" }, h$21("section", {
				className: "lp-card",
				"aria-label": "研究没有打开"
			}, h$21("div", { className: "lp-empty" }, h$21("div", { className: "lp-empty-title" }, "研究没有打开"), h$21("p", { className: "lp-empty-text" }, data.reason_zh || "可以在设置里再打开。不满 18 岁不参加研究。"))));
			const personalId = ((data.studies ?? []).find((study) => study.kind === "community_season") ?? (data.studies ?? [])[0])?.id;
			return h$21("div", { className: "lp-tab-body" }, error ? h$21("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, data.reason_zh ? h$21("div", { className: "lp-callout lp-callout-info" }, h$21(Icon, {
				name: "info",
				size: 14
			}), h$21("p", { className: "lp-callout-body" }, localText(data.reason_zh))) : null, data.progress && data.voting ? h$21(CommunityPanel, {
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
			}) : null, ...(data.studies ?? []).map((study) => h$21(ConsentPanel, {
				key: study.id,
				study,
				threshold: data.thresholds?.find((row) => row.study_id === study.id)?.line_zh,
				onChange: load,
				onError: setError,
				personal: study.id === personalId ? {
					note: `${data.early_zh ? `${localText(data.early_zh).split("。")[0]}。` : ""}可以先在这台电脑上做个人对照。`,
					onStart: startPersonal
				} : null
			})), h$21(TranslogPanel, { rows: data.translog ?? [] }));
		}
		//#endregion
		//#region src/client/science/index.ts
		const h$20 = react.default.createElement;
		function ScienceToolCard(props) {
			const call = parseCall(props.block);
			const result = call.result;
			const title = props.toolName === "record_study_consent" ? "研究同意" : props.toolName === "design_n_of_1" ? "个人对照" : "研究";
			const text = typeof result?.say_zh === "string" ? result.say_zh : typeof result?.result_zh === "string" ? result.result_zh : call.state === "running" ? "正在读取…" : call.error || "完成";
			return h$20("div", { className: "lp lp-tool lp-tool-card" }, h$20("div", { className: "lp-tool-head" }, h$20("span", { className: "lp-tool-title" }, title)), h$20("p", null, text));
		}
		function ScienceSettings() {
			return h$20("section", {
				className: "lp-stack",
				"aria-labelledby": "lp-science-settings-title"
			}, h$20("h3", {
				className: "lp-h3",
				id: "lp-science-settings-title"
			}, "研究"), h$20("p", { className: "lp-small lp-muted lp-measure" }, "研究正式开始后才会发出，现在只保存在你的设备上。"), h$20("a", {
				className: "lp-textbtn",
				href: "/api/longpi/science/community?view=page"
			}, "打开研究页"));
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
		const h$19 = react.default.createElement;
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
			if (error) return h$19("p", {
				className: "lp-form-error",
				role: "alert"
			}, error);
			if (!rows) return h$19("p", { className: "lp-small lp-muted lp-measure" }, "正在读取报告叙述…");
			if (rows.length === 0) return h$19("p", {
				className: "lp-small lp-muted lp-measure",
				id: "lp-findings-empty"
			}, "还没有从报告里记下超声、总检或医师建议。已经放进来的报告，打开健康页后会读到超声分级；也可以把 PDF 发到健康对话。");
			return h$19("ul", {
				className: "lp-rows",
				id: "lp-findings"
			}, ...rows.map((row) => h$19("li", {
				key: row.id,
				className: "lp-row lp-row-stack"
			}, row.kind === "wrong_person" ? h$19("span", { className: "lp-tags" }, h$19("span", { className: "lp-badge lp-badge-warn" }, KIND_ZH$1[row.kind]), row.date ? h$19("span", { className: "lp-caption" }, chineseDate(row.date) || row.date) : null) : h$19("span", { className: "lp-caption" }, `${KIND_ZH$1[row.kind] ?? "报告"} ${chineseDate(row.date) || row.date || ""}`.trim()), h$19("span", null, row.page_note_zh || row.text_zh))));
		}
		//#endregion
		//#region src/client/datain/index.ts
		const h$18 = react.default.createElement;
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
			if (!row) return h$18("p", {
				className: "lp-small lp-muted lp-measure",
				id: "lp-genetics-empty"
			}, "还没有基因摘要。叙述版 PDF 请发到健康对话。普通体检不要选基因文件。");
			return h$18("div", {
				className: "lp-stack",
				id: "lp-genetics"
			}, h$18("p", null, (row.headlines_zh ?? []).join("；") || "已记下基因报告。"), (row.variants ?? []).length > 0 ? h$18("ul", { className: "lp-rows" }, ...(row.variants ?? []).slice(0, 12).map((item) => h$18("li", {
				key: item.rsid,
				className: "lp-row"
			}, h$18("span", { className: "lp-row-main" }, item.note_zh || item.rsid), h$18("span", { className: "lp-row-end lp-num" }, item.note_zh ? `${item.rsid} ${item.genotype}` : item.genotype)))) : null, (row.caveats_zh ?? []).length > 0 ? h$18("ul", { className: "lp-bullets" }, ...(row.caveats_zh ?? []).map((line) => h$18("li", { key: line }, line))) : null, row.raw_export_zh ? h$18("p", { className: "lp-caption lp-measure" }, row.raw_export_zh) : null, row.sample_id ? h$18("p", { className: "lp-caption lp-measure" }, `样本号存在这台电脑上，不会发给模型。`) : null);
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
			return h$18("div", {
				className: "lp-stack",
				id: "lp-meds"
			}, lines.length > 0 ? h$18("ul", { className: "lp-rows" }, ...lines.map((line) => h$18("li", {
				key: line,
				className: "lp-row"
			}, h$18("span", { className: "lp-row-main" }, line)))) : h$18("p", { className: "lp-small lp-muted lp-measure" }, "还没有你让 LongPi 记下的药。"), h$18("div", { className: "lp-form-grid" }, h$18("div", { className: "lp-field lp-field-full" }, h$18("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-name"
			}, "药名"), h$18("input", {
				id: "lp-med-name",
				className: "lp-input",
				value: name,
				onChange: (event) => setName(event.target.value)
			})), h$18("div", { className: "lp-field" }, h$18("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-dose"
			}, "用法", h$18("span", { className: "lp-optional" }, "照处方抄，可不填")), h$18("input", {
				id: "lp-med-dose",
				className: "lp-input",
				value: dose,
				placeholder: "10 mg",
				onChange: (event) => setDose(event.target.value)
			})), h$18("div", { className: "lp-field" }, h$18("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-times"
			}, "什么时候吃", h$18("span", { className: "lp-optional" }, "可不填")), h$18("input", {
				id: "lp-med-times",
				className: "lp-input",
				value: times,
				placeholder: "每天早上一次",
				onChange: (event) => setTimes(event.target.value)
			}))), error ? h$18("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$18("div", { className: "lp-actions" }, h$18(Btn, {
				type: "button",
				disabled: !name.trim(),
				onClick: () => {
					save();
				}
			}, "记下这味药")));
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
			return h$18("div", {
				className: "lp-stack",
				id: "lp-conditions"
			}, rows.length > 0 ? h$18("ul", { className: "lp-rows" }, ...rows.map((row) => h$18("li", {
				key: row.id,
				className: "lp-row"
			}, h$18("span", { className: "lp-row-main" }, row.text_zh)))) : h$18("p", { className: "lp-small lp-muted lp-measure" }, "还没有记下病情。"), h$18("div", { className: "lp-field" }, h$18("label", {
				className: "lp-field-label",
				htmlFor: "lp-cond-name"
			}, "病情或诊断"), h$18("input", {
				id: "lp-cond-name",
				className: "lp-input",
				value: name,
				placeholder: "脂肪肝",
				onChange: (event) => setName(event.target.value)
			})), error ? h$18("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$18("div", { className: "lp-actions" }, h$18(Btn, {
				type: "button",
				disabled: !name.trim(),
				onClick: () => {
					save();
				}
			}, "记下")), h$18("p", { className: "lp-caption lp-measure" }, "诊断记在这台电脑上。体检原件那边不接收病情。"));
		}
		function DataInSection() {
			const [tick, setTick] = react.default.useState(0);
			return h$18("div", {
				className: "lp-grid-2",
				id: "lp-datain"
			}, h$18("div", {
				className: "lp-card",
				id: "lp-findings-card"
			}, h$18("div", { className: "lp-card-head" }, h$18("h3", { className: "lp-card-title" }, "报告里的叙述")), h$18(FindingsList, { reloadKey: tick }), h$18(ReportUpload, { onDone: () => setTick((value) => value + 1) })), h$18("div", {
				className: "lp-card",
				id: "lp-meds-card"
			}, h$18("div", { className: "lp-card-head" }, h$18("h3", { className: "lp-card-title" }, "用药")), h$18(MedsForm)), h$18("div", {
				className: "lp-card",
				id: "lp-conditions-card"
			}, h$18("div", { className: "lp-card-head" }, h$18("h3", { className: "lp-card-title" }, "病情")), h$18(ConditionsForm)), h$18("div", {
				className: "lp-card",
				id: "lp-genetics-card"
			}, h$18("div", { className: "lp-card-head" }, h$18("h3", { className: "lp-card-title" }, "基因")), h$18(GeneticsCard)));
		}
		//#endregion
		//#region src/client/connection.ts
		const h$17 = react.default.createElement;
		const LOOPBACK = /* @__PURE__ */ new Set([
			"127.0.0.1",
			"localhost",
			"[::1]"
		]);
		/** The same rule the server applies: https, or http only on this computer. */
		function addressProblem(text) {
			const trimmed = text.trim();
			if (!trimmed) return "请先展开「改用连接地址」，再粘贴连接地址。";
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
		function month(iso) {
			return chineseMonth(iso);
		}
		/** "4 次体检 · 2025 年 10 月至 2026 年 8 月 · 血脂、血糖等 · 手环 355 天": only what the server counted. */
		function summaryParts(summary) {
			const range = summary.first_date && summary.last_date ? summary.first_date.slice(0, 7) === summary.last_date.slice(0, 7) ? month(summary.last_date) : `${month(summary.first_date)}至 ${month(summary.last_date)}` : "";
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
			return h$17("div", { className: "lp-conn-status" }, h$17("div", { className: "lp-status" }, h$17("span", {
				className: `lp-statusdot ${ok ? "lp-statusdot-on" : bad ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), ok ? "已连上" : bad ? `连接失败：${connection.error || "没有返回原因"}` : "还没有连上"), ok && connection.summary && !props.brief ? h$17("div", { className: "lp-caption" }, `找到：${summaryParts(connection.summary).join(" · ")}`) : null);
		}
		function TestOutcome(props) {
			const { result } = props;
			if (!result.ok) return h$17("p", {
				className: "lp-form-error",
				role: "alert"
			}, `连接没有成功：${result.error}`);
			const summary = result.connection?.summary;
			return h$17("p", {
				className: "lp-conn-ok",
				role: "status"
			}, h$17(Icon, {
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
			return h$17("div", {
				className: "lp-conn-login",
				id: `${props.idPrefix}-login`
			}, h$17("p", { className: "lp-muted" }, "用邮箱和密码登录并连接。"), h$17("details", null, h$17("summary", null, "更改服务地址"), h$17("div", { className: "lp-field" }, h$17("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-base`
			}, "服务地址"), h$17("input", {
				id: `${props.idPrefix}-base`,
				className: "lp-input",
				value: base,
				autoComplete: "off",
				spellCheck: false,
				onChange: (event) => setBase(event.target.value)
			}))), h$17("div", { className: "lp-field" }, h$17("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-email`
			}, "邮箱"), h$17("input", {
				id: `${props.idPrefix}-email`,
				type: "email",
				className: "lp-input",
				value: email,
				autoComplete: "username",
				onChange: (event) => setEmail(event.target.value)
			})), h$17("div", { className: "lp-field" }, h$17("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-password`
			}, "密码"), h$17("input", {
				id: `${props.idPrefix}-password`,
				type: "password",
				className: "lp-input",
				value: password,
				autoComplete: "current-password",
				onChange: (event) => setPassword(event.target.value)
			})), error ? h$17("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, done ? h$17("p", {
				className: "lp-conn-ok",
				role: "status"
			}, done) : null, h$17("div", { className: "lp-form-actions" }, h$17(Btn, {
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
			return h$17("form", {
				className: "lp-conn-form",
				noValidate: true,
				onSubmit: (event) => {
					event.preventDefault();
					run("save");
				}
			}, h$17(MirobodyLogin, { idPrefix: props.idPrefix }), h$17("details", { className: "lp-conn-advanced" }, h$17("summary", null, "改用连接地址（给安装的人）"), props.connection?.url_masked ? h$17("p", { className: "lp-caption" }, `当前地址 ${props.connection.url_masked}`) : null, h$17("p", { className: "lp-caption" }, "安装的人如果已经拿到连接地址，再展开填写。平时不用看。"), h$17("div", { className: "lp-field" }, h$17("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-url`
			}, "连接地址"), h$17("input", {
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
			})), h$17("div", { className: "lp-field" }, h$17("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-token`
			}, "访问口令", h$17("span", { className: "lp-optional" }, "地址里已经带了就留空")), h$17("input", {
				id: `${props.idPrefix}-token`,
				type: "password",
				className: "lp-input",
				value: token,
				autoComplete: "new-password",
				placeholder: "可不填",
				onChange: (event) => setToken(event.target.value)
			}))), error ? h$17("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, outcome ? h$17(TestOutcome, { result: outcome }) : null, h$17("div", { className: "lp-form-actions" }, h$17(Btn, {
				variant: "outline",
				type: "button",
				disabled: busy != null,
				onClick: () => {
					run("test");
				}
			}, busy === "test" ? "测试中…" : "测试连接"), h$17(Btn, {
				type: "submit",
				disabled: busy != null
			}, busy === "save" ? "测试并保存中…" : "保存"), saved ? h$17("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy != null,
				onClick: () => {
					clear();
				}
			}, h$17(Icon, {
				name: "trash",
				size: 13
			}), busy === "clear" ? "清除中" : "清除保存的地址") : null), h$17("p", { className: "lp-fine" }, saved ? "清除后改用安装时配置的地址（如果有）。" : "保存前会先用这个地址读一次记录目录，读到了才保存；地址和令牌只存在这台电脑上。"));
		}
		/** Status plus form. collapsed: when connected, the form waits behind 换一个地址 (onboarding step 3). */
		/** hideStatus: the caller already shows the status line (the settings page, above its 高级 fold). */
		function ConnectionPanel(props) {
			const { data, loading, error } = useConnection();
			const [open, setOpen] = react.default.useState(false);
			if (!data && loading) return h$17(Skeleton, { height: 96 });
			if (!data) return h$17(LoadError, {
				what: "连接状态",
				error,
				onRetry: () => reload("connection")
			});
			const connected = data.status === "ok";
			const showForm = !props.collapsed || !connected || open;
			return h$17("div", { className: "lp-conn" }, props.hideStatus ? null : h$17(ConnectionStatus, {
				connection: data,
				brief: props.collapsed
			}), showForm ? h$17(ConnectionForm, {
				connection: data,
				idPrefix: props.idPrefix,
				onSaved: (connection) => {
					setOpen(false);
					props.onSaved?.(connection);
				}
			}) : h$17("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => setOpen(true)
			}, "换一个连接 →"));
		}
		//#endregion
		//#region src/client/profile-editor.ts
		const h$16 = react.default.createElement;
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
			return h$16("form", {
				className: `lp-profile lp-profile-${props.variant}`,
				onSubmit: (event) => {
					save(event);
				},
				noValidate: true
			}, onboarding ? null : h$16("div", { className: "lp-field" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-name`
			}, "称呼", h$16("span", { className: "lp-optional" }, "选填")), h$16("input", {
				id: `${props.idPrefix}-name`,
				className: "lp-input",
				value: draft.displayName,
				maxLength: 40,
				autoComplete: "nickname",
				placeholder: "页面上怎么称呼你",
				onChange: (event) => edit({ displayName: event.target.value })
			})), h$16("div", { className: "lp-profile-group" }, h$16("div", { className: "lp-profile-basics" }, h$16("div", { className: "lp-field lp-profile-age" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-age`
			}, "实足年龄"), h$16("div", { className: "lp-input-unit" }, h$16("input", {
				id: `${props.idPrefix}-age`,
				className: "lp-input",
				inputMode: "numeric",
				value: draft.age,
				placeholder: "例如 52",
				"aria-invalid": !ageCheck.ok,
				"data-modal-autofocus": onboarding ? true : void 0,
				onChange: (event) => edit({ age: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })
			}), h$16("span", { className: "lp-unit" }, "岁"))), h$16(Segmented, {
				name: `${props.idPrefix}-sex`,
				label: "性别",
				options: [{
					value: "male",
					label: "男"
				}, {
					value: "female",
					label: "女"
				}],
				value: draft.sex === "female" || draft.sex === "male" ? draft.sex : "",
				onChange: (value) => edit({ sex: value })
			})), h$16("p", { className: "lp-unlock" }, h$16(Icon, {
				name: "lock",
				size: 12
			}), `解锁：${unlockOf(props.journey, "age")}`)), h$16("fieldset", { className: "lp-facts" }, h$16("legend", { className: "lp-facts-legend" }, h$16("span", { className: "lp-field-label" }, "心血管风险还需要这 6 项"), h$16("span", { className: "lp-caption" }, `已回答 ${answeredFacts} 项。不确定就选「不确定」，不会当作「否」。`)), ...facts.map((row) => h$16("div", {
				className: "lp-fact",
				key: row.key
			}, h$16("div", { className: "lp-fact-text" }, h$16("div", {
				className: "lp-fact-label",
				id: `${props.idPrefix}-${row.key}-text`
			}, row.label_zh), h$16("div", { className: "lp-caption" }, `解锁：${row.unlocks_zh || "心血管风险"}`, row.men_only ? female ? " · 女性的公式不用这一项，可以跳过" : " · 只用于男性的公式" : "")), h$16(Segmented, {
				name: `${props.idPrefix}-${row.key}`,
				label: row.label_zh,
				hideLabel: true,
				options: ANSWERS,
				value: draft.risk[row.key] ?? "",
				onChange: (value) => edit({ risk: {
					...draft.risk,
					[row.key]: value
				} })
			})))), h$16("div", { className: "lp-profile-focus" }, h$16("div", {
				className: "lp-field-label",
				id: `${props.idPrefix}-focus`
			}, "你最关心什么", h$16("span", { className: "lp-optional" }, "可多选，按点选先后排序")), h$16("div", {
				className: "lp-toggles",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-focus`
			}, ...focusOptions.map((option) => {
				const index = draft.focus.indexOf(option.key);
				return h$16(ToggleChip, {
					key: option.key,
					pressed: index >= 0,
					badge: index >= 0 ? String(index + 1) : void 0,
					onClick: () => toggleFocus(option.key)
				}, option.label_zh);
			}))), error ? h$16("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$16("div", { className: onboarding ? "lp-modal-actions" : "lp-form-actions" }, onboarding ? h$16(Btn, {
				variant: "outline",
				type: "button",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过") : null, h$16(Btn, {
				type: "submit",
				disabled: busy || !onboarding && !dirty
			}, busy ? "保存中…" : onboarding ? "保存并继续" : "保存档案"), !onboarding && !dirty && props.journey?.profile.complete ? h$16("span", { className: "lp-caption" }, "已是最新") : null));
		}
		//#endregion
		//#region src/client/profile-tab.ts
		const h$15 = react.default.createElement;
		/** Where the connection is set: the LongPi page in DSH's settings, or here when settings cannot be opened from the page. */
		function ConnectionCard(props) {
			const { data } = useConnection();
			const openSettings = useSettingsOpener();
			const [editing, setEditing] = react.default.useState(false);
			return h$15("div", {
				className: "lp-card",
				id: "lp-connection-card"
			}, h$15("div", { className: "lp-card-head" }, h$15("h3", { className: "lp-card-title" }, "数据连接"), openSettings ? h$15("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => openSettings("longpi")
			}, "在设置中修改", h$15(Icon, {
				name: "chevron",
				size: 12
			})) : h$15("button", {
				type: "button",
				className: "lp-textbtn",
				"aria-expanded": editing,
				onClick: () => setEditing((current) => !current)
			}, editing ? "收起" : "修改连接")), data ? h$15(ConnectionStatus, { connection: data }) : h$15(RecordsStatusLine, { journey: props.journey }), editing && !openSettings ? h$15(ConnectionForm, {
				connection: data,
				idPrefix: "lp-profile-conn",
				onSaved: () => setEditing(false)
			}) : null);
		}
		/** The next-checkup add-on list, as rows. What they unlock is said once when it is the same for all of them. */
		function AddonRows(props) {
			return h$15("ul", {
				className: "lp-rows",
				id: "lp-profile-addons-addons"
			}, ...props.journey.addons.map((row) => {
				const note = [props.common ? "" : `解锁：${row.unlocks_zh}`, row.self_measurable ? "可以自己在家量" : ""].filter(Boolean).join(" · ");
				return h$15("li", {
					key: row.item_zh,
					className: "lp-row"
				}, h$15("div", { className: "lp-row-main lp-row-lines" }, h$15("span", { className: "lp-strong" }, row.item_zh), note ? h$15("span", { className: "lp-caption" }, note) : null), row.self_measurable && row.self_key ? h$15(InlineSelf, {
					journey: props.journey,
					selfKey: row.self_key,
					idPrefix: "lp-profile-addons-" + row.self_key,
					onNotice: props.onNotice
				}) : null);
			}));
		}
		/** Every export in one card: the report, the calendar, and the whole archive (the link the privacy service hands out). */
		function ExportCard(props) {
			const [archive, setArchive] = react.default.useState(null);
			const openSettings = useSettingsOpener();
			react.default.useEffect(() => {
				let gone = false;
				getJson("/api/longpi/privacy").then((body) => {
					if (!gone) setArchive({
						href: body.export?.href,
						note: body.export?.mirobody_note_zh
					});
				}).catch(() => {
					if (!gone) setArchive(null);
				});
				return () => {
					gone = true;
				};
			}, []);
			return h$15("div", {
				className: "lp-card",
				id: "lp-export-card"
			}, h$15("div", { className: "lp-card-head" }, h$15("h3", { className: "lp-card-title" }, "导出"), openSettings ? h$15("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => openSettings("longpi")
			}, "隐私与删除", h$15(Icon, {
				name: "chevron",
				size: 12
			})) : null), h$15("p", { className: "lp-small lp-muted lp-measure" }, "报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；日历文件包含复测日期和每天的打卡提醒。"), h$15("div", { className: "lp-actions" }, h$15(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: `longpi-report-${props.today}.md`
			}, "导出报告"), h$15(LinkButton, {
				href: "/api/longpi/calendar.ics",
				icon: "calendar",
				download: "longpi.ics"
			}, "加入日历"), archive?.href ? h$15(LinkButton, {
				href: archive.href,
				icon: "download"
			}, "下载完整档案") : null), archive?.note ? h$15("p", { className: "lp-caption lp-measure" }, archive.note) : null, h$15("p", { className: "lp-caption lp-plan-aside" }, h$15(Icon, {
				name: "lock",
				size: 12
			}), "导出的文件留在这台电脑上，LongPi 不会发给任何人。"));
		}
		function ProfileTab(props) {
			const { journey } = props;
			const today = journey.today;
			const unlocks = [...new Set(journey.addons.map((row) => row.unlocks_zh))];
			const common = unlocks.length === 1 && unlocks[0] ? unlocks[0] : null;
			return h$15("div", { className: "lp-tab-body" }, h$15("div", {
				className: "lp-grid-2",
				id: "lp-profile-section"
			}, h$15("div", {
				className: "lp-card",
				id: "lp-profile-card"
			}, h$15("div", { className: "lp-card-head" }, h$15("h3", { className: "lp-card-title" }, "基本情况"), h$15("span", { className: "lp-caption" }, "只保存在这台电脑上")), h$15(ProfileEditor, {
				journey,
				variant: "page",
				idPrefix: "lp-profile",
				onNotice: props.onNotice
			})), h$15("div", { className: "lp-profile-side" }, h$15("div", {
				className: "lp-card",
				id: "lp-self-card"
			}, h$15("div", { className: "lp-card-head" }, h$15("h3", { className: "lp-card-title" }, "自测"), h$15("span", { className: "lp-caption" }, "腰围 · 家庭血压 · 体重")), h$15(SelfLatestList, { latest: journey.self.latest }), h$15(SelfMeasureForm, {
				journey,
				idPrefix: "lp-self",
				onNotice: props.onNotice
			}), h$15("p", { className: "lp-caption lp-measure" }, "家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。早晚各量一次、每次坐着休息 5 分钟后再量。"), h$15(SelfRecent, { onNotice: props.onNotice })), h$15(ConnectionCard, { journey }), h$15(ExportCard, { today }))), h$15(DataInSection), journey.addons.length > 0 ? h$15("div", {
				className: "lp-card",
				id: "lp-addons-card"
			}, h$15("div", { className: "lp-card-head" }, h$15("h3", { className: "lp-card-title" }, "下次体检加测"), h$15("span", { className: "lp-caption" }, common ? `${journey.addons.length} 项 · 解锁${common}` : `${journey.addons.length} 项，加上就能算出更多结果`)), h$15(AddonRows, {
				journey,
				onNotice: props.onNotice,
				common
			})) : null, ...profileSections().filter((section) => section.id !== "longpi-privacy").map((section) => h$15("div", {
				key: section.id,
				className: "lp-card"
			}, h$15(section.Component, {
				journey,
				onNotice: props.onNotice
			}))));
		}
		//#endregion
		//#region src/client/engage/nudge-pill.ts
		const h$14 = react.default.createElement;
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
			return h$14("div", {
				className: "lp-callout lp-callout-info",
				role: "status"
			}, h$14("div", { className: "lp-callout-body" }, h$14("p", null, "要不要在别的对话里，偶尔看到一句这个赛季的事？默认关闭。"), h$14("div", { className: "lp-actions" }, h$14(Btn, {
				variant: "outline",
				onClick: props.onAccept
			}, "偶尔一句"), h$14(Btn, {
				variant: "ghost",
				onClick: props.onDismiss
			}, "不用"))));
		}
		//#endregion
		//#region src/client/engage/codex.ts
		const h$13 = react.default.createElement;
		function CodexPanel(props) {
			const codex = props.codex;
			if (!codex) return null;
			if (codex.hidden) {
				const closed = codex.reason_zh.includes("已关闭");
				return h$13("section", {
					className: "lp-card",
					"aria-label": "长寿图鉴"
				}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "长寿图鉴"), closed ? h$13(Switch, {
					checked: false,
					label: "显示图鉴",
					disabled: props.busy,
					onChange: () => props.onOpt(true)
				}) : null), h$13("p", { className: "lp-small lp-muted lp-measure" }, codex.reason_zh || "图鉴没有打开。"));
			}
			return h$13("section", {
				className: "lp-card",
				"aria-label": "长寿图鉴"
			}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "长寿图鉴"), h$13(Switch, {
				checked: true,
				label: "显示图鉴",
				disabled: props.busy,
				onChange: () => props.onOpt(false)
			})), h$13("p", { className: "lp-text lp-muted" }, CODEX_INTRO), h$13("details", null, h$13("summary", null, "概率说明"), h$13("ul", { className: "lp-bullets" }, h$13("li", null, "铜：细胞实验。"), h$13("li", null, "银：动物实验。"), h$13("li", null, "紫：观察人群。"), h$13("li", null, "金：分组做的人体试验，和几种长寿动物。"), h$13("li", null, "颜色不代表身体好坏。"), h$13("li", null, "连续 10 次里，至少有一次是银或更好。这不是指标变好了。"), codex.odds_zh ? h$13("li", null, codex.odds_zh) : null)), h$13("div", { className: "lp-actions" }, h$13(Btn, {
				onClick: props.onDraw,
				disabled: props.busy || codex.draws_available < 1
			}, "抽一张"), h$13("span", { className: "lp-caption" }, `可抽 ${codex.draws_available} 次 · 今天已抽 ${codex.draws_today} / ${codex.daily_cap}`)), props.note ? h$13("p", {
				className: "lp-small lp-measure",
				role: "status"
			}, props.note) : null, codex.owned.length === 0 ? h$13("p", { className: "lp-caption lp-measure" }, "还没有抽到卡。次数只从测量、记录、就诊或复测来。") : h$13("ul", { className: "lp-rows" }, codex.owned.slice(0, 12).map((card) => h$13("li", {
				key: card.id,
				className: "lp-row"
			}, h$13("div", { className: "lp-row-main lp-season-card" }, h$13("div", { className: "lp-tags" }, h$13("span", { className: "lp-tag" }, card.rarity_zh), h$13("span", { className: "lp-strong" }, card.title_zh)), card.family === "insight" ? h$13("p", { className: "lp-muted lp-measure" }, card.body_zh) : null, card.offer ? h$13("p", { className: "lp-muted lp-measure" }, card.offer.text_zh) : null), card.offer?.kind === "run" && props.onRun ? h$13(Btn, {
				size: "sm",
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onRun?.(card.id)
			}, "用我的记录算") : null))));
		}
		//#endregion
		//#region src/client/engage/streak.ts
		const h$12 = react.default.createElement;
		function StreakLine(props) {
			const streak = props.streak;
			if (!streak) return null;
			const frozen = streak.frozen.length;
			return h$12("div", { className: "lp-actions" }, h$12("span", { className: "lp-small lp-strong" }, `连续 ${streak.current} 天`), h$12("span", { className: "lp-caption" }, `最好 ${streak.best} 天 · ${frozen > 0 ? `冻结 ${frozen} 天` : `还可冻结 ${streak.freezes_available} 天`}`), h$12(Btn, {
				variant: "outline",
				onClick: () => props.onFreeze("sick"),
				disabled: props.busy
			}, "今天生病"), h$12(Btn, {
				variant: "outline",
				onClick: () => props.onFreeze("travel"),
				disabled: props.busy
			}, "今天出行"));
		}
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
		const h$11 = react.default.createElement;
		function SeasonPanel(props) {
			const season = props.view.season;
			const note = props.note ? h$11("p", {
				className: "lp-small lp-measure",
				role: "status"
			}, props.note) : null;
			if (props.view.invite?.show) return h$11("section", {
				className: "lp-card",
				"aria-label": "开始一个赛季"
			}, h$11("div", { className: "lp-card-head" }, h$11("h3", { className: "lp-card-title" }, "开始一个赛季")), h$11("p", { className: "lp-text" }, props.view.invite.body_zh), h$11("p", { className: "lp-caption lp-measure" }, "长寿图鉴是一组长寿研究的知识卡；抽卡次数只从测量、记录、就诊或复测来。"), props.view.subject_zh ? h$11("p", { className: "lp-caption lp-measure" }, `这个赛季用的是${props.view.subject_zh}的年龄和性别。`) : null, h$11("a", {
				className: "lp-textbtn",
				href: props.view.invite.odds_path
			}, "概率说明 →"), h$11("div", { className: "lp-actions" }, h$11(Btn, {
				disabled: props.busy,
				onClick: () => props.onAction({ action: "opt_in" })
			}, "开始这个赛季"), h$11(Btn, {
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onAction({ action: "decline_invite" })
			}, "先不用")), note);
			if (props.view.pressure !== true) return h$11("section", {
				className: "lp-card",
				"aria-label": "赛季"
			}, h$11("div", { className: "lp-card-head" }, h$11("h3", { className: "lp-card-title" }, "这个赛季还没开始")), h$11("p", { className: "lp-small lp-muted lp-measure" }, "这个赛季先不推。想开始时点下面。"), h$11("div", { className: "lp-actions" }, h$11(Btn, {
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onAction({ action: "opt_in" })
			}, "开始这个赛季")), props.view.streak.frozen.length > 0 ? h$11(StreakLine, {
				streak: props.view.streak,
				onFreeze: props.onFreeze,
				busy: props.busy
			}) : null, note);
			const shown = props.view.quests.slice(0, 5);
			const ratio = season ? Math.min(1, season.week / Math.max(1, season.weeks)) : 0;
			const family = props.view.family?.available ? props.view.family.opted ? h$11(Btn, {
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onAction({ action: "share_recap" })
			}, "把这个赛季的回看发给家人") : h$11(Btn, {
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onAction({ action: "family_on" })
			}, "打开家人圈") : null;
			return h$11(react.default.Fragment, null, h$11("section", {
				className: "lp-card",
				"aria-label": "本赛季"
			}, season ? h$11(react.default.Fragment, null, h$11("div", { className: "lp-card-head" }, h$11("h3", { className: "lp-card-title" }, season.title_zh), h$11("span", { className: "lp-caption" }, `本赛季 · 第 ${season.week} 周 / 共 ${season.weeks} 周`)), h$11("p", { className: "lp-text lp-muted" }, SEASON_INTRO), props.view.subject_zh ? h$11("p", { className: "lp-caption lp-measure" }, `按${props.view.subject_zh}的记录`) : null, h$11("div", {
				className: "lp-bar",
				role: "progressbar",
				"aria-label": "本赛季进度",
				"aria-valuemin": 0,
				"aria-valuemax": season.weeks,
				"aria-valuenow": season.week,
				"aria-valuetext": `第 ${season.week} 周 / 共 ${season.weeks} 周`
			}, h$11("span", { style: { width: `${Math.round(ratio * 100)}%` } })), h$11("p", { className: "lp-caption lp-measure" }, season.retest_day ? `复查 ${chineseDate(season.retest_day)}` : `${chineseDate(season.start)} → ${chineseDate(season.end)}`)) : h$11("p", { className: "lp-small lp-muted lp-measure" }, "这一赛季还没有开始。"), season?.status === "closed" || family ? h$11("div", { className: "lp-actions" }, season?.status === "closed" ? h$11(Btn, {
				disabled: props.busy,
				onClick: () => props.onAction({ action: "next_season" })
			}, "开始下一个赛季") : null, family) : null, h$11("div", { className: "lp-card-foot" }, h$11("span", { className: "lp-caption" }, "生病或出行的这一天：不算中断，也不算完成。"), h$11("div", { className: "lp-actions" }, h$11(Btn, {
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onFreeze("sick")
			}, "今天生病"), h$11(Btn, {
				variant: "outline",
				disabled: props.busy,
				onClick: () => props.onFreeze("travel")
			}, "今天出行")))), shown.length > 0 ? h$11("section", {
				className: "lp-card",
				"aria-label": "小目标"
			}, h$11("div", { className: "lp-card-head" }, h$11("h3", { className: "lp-card-title" }, "小目标")), h$11("div", { className: "lp-season-quests" }, ...shown.map((quest) => h$11("button", {
				key: quest.id,
				type: "button",
				className: "lp-row-btn",
				disabled: props.busy,
				onClick: () => props.onAction(actionForQuest(quest.title_zh))
			}, h$11("span", { className: "lp-row-main" }, quest.title_zh), quest.status === "done" ? h$11("span", { className: "lp-badge lp-badge-good" }, "做完了") : h$11("span", { className: "lp-caption lp-num" }, `${quest.progress}/${quest.count}`), h$11(Icon, {
				name: "chevron",
				size: 14
			}))))) : null, season?.recap_zh ? h$11("section", {
				className: "lp-card",
				"aria-label": "这一赛季的回看"
			}, h$11("div", { className: "lp-card-head" }, h$11("h3", { className: "lp-card-title" }, "这一赛季的回看")), h$11("p", { className: "lp-text" }, season.recap_zh)) : null, h$11(CodexPanel, {
				codex: props.view.codex,
				onDraw: props.onDraw,
				onOpt: props.onOpt,
				onRun: props.onRun,
				busy: props.busy,
				note: props.note
			}));
		}
		//#endregion
		//#region src/client/engage/index.ts
		const h$10 = react.default.createElement;
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
			const panel = view ? h$10(SeasonPanel, {
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
			if (page) return h$10("div", { className: "lp-tab-body" }, failed ? h$10("div", {
				className: "lp-callout lp-callout-warn",
				role: "alert"
			}, h$10(Icon, {
				name: "warn",
				size: 14
			}), h$10("p", { className: "lp-callout-body" }, failed), h$10("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => {
					load();
				}
			}, "重试")) : null, panel ?? (failed ? null : h$10("p", { className: "lp-small lp-muted lp-measure" }, "赛季正在读取。")), view?.nudge?.offer ? h$10(NudgeOffer, {
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
			return h$10("button", {
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
			return h$10("p", { className: "lp-caption lp-measure" }, line);
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
		//#region src/client/analysis.ts
		const h$9 = react.default.createElement;
		const CONF_ZH = {
			low: "低",
			moderate: "中"
		};
		/** Anything shown comes from a file a pipeline wrote: shown as text, never as an object. */
		const t = (v) => typeof v === "string" ? tidy(v) : typeof v === "number" && Number.isFinite(v) ? num(v) : "";
		/** Pipeline text, put into the house style: no doubled 岁, 「1/7」 without spaces, the minus sign, 「」 quotes. */
		function tidy(text) {
			return text.replace(/岁\s*岁/g, "岁").replace(/\.{3,}|。{3,}/g, "…").replace(/(\d)\s*\/\s*(\d)/g, "$1/$2").replace(/(^|[\s（(：:，,；;=≈<>])-(?=\d)/g, "$1−").replace(/[“"]([^“”"]*)[”"]/g, "「$1」").replace(/‘([^‘’]*)’/g, "「$1」");
		}
		const errText$1 = (e, fallback) => e instanceof Error && e.message ? e.message : fallback;
		/** Numbers by the spec rule: whole numbers as they are, below 10 two decimals, 10 and above one decimal. */
		function num(v) {
			if (typeof v !== "number" || !Number.isFinite(v)) return t(v) || "—";
			const a = Math.abs(v);
			const text = Number.isInteger(v) ? String(a) : String(Number(a.toFixed(a < 10 ? 2 : 1)));
			return v < 0 && Number(text) !== 0 ? `−${text}` : text;
		}
		const isProb = (r) => r.unit === "概率";
		/** A number with its unit: 岁 for years, % glued to the number, other units after a space. */
		function withUnit(r, v) {
			if (isProb(r)) return typeof v === "number" && Number.isFinite(v) ? `${num(Math.round(v * 1e4) / 100)}%` : "—";
			const n = num(v);
			if (r.unit === "a" || r.kind === "llm_estimate" && !r.unit) return `${n} 岁`;
			if (r.unit === "%") return `${n}%`;
			return r.unit ? `${n} ${t(r.unit)}` : n;
		}
		/** The value alone (the table header says what kind of estimate it is). */
		function valueText(r) {
			return r ? withUnit(r, r.value) : "—";
		}
		/** An estimate's range, with its horizon when it is not the 10 years the column header states. */
		function rangeText(r) {
			if (typeof r.low !== "number" || typeof r.high !== "number") return "";
			return `${isProb(r) ? withUnit(r, r.low).replace(/%$/, "") : num(r.low)}–${withUnit(r, r.high)}${r.horizon_years && r.horizon_years !== 10 ? `，${t(r.horizon_years)} 年` : ""}`;
		}
		/** Full text for places without a column header. */
		function fmt(r) {
			if (!r) return "—";
			if (r.kind !== "llm_estimate") return valueText(r);
			const range = rangeText(r);
			return `${valueText(r)}（AI 估计${range ? `，${range}` : ""}${isProb(r) && r.horizon_years === 10 ? "，10 年" : ""}）`;
		}
		/** Labels written by the pipeline repeat「（10 年，AI 估计）」; the column header says it once. */
		const cleanLabel = (label) => label.replace(/\s*[（(][^（）()]*(?:AI 估计|年)[^（）()]*[）)]\s*$/, "").trim() || label;
		/** A measured value; a worded one keeps its short verdict on the line and its explanation on a caption line below. */
		function measureValue(r) {
			if (typeof r.value === "number") return [h$9("span", {
				key: "v",
				className: "lp-num lp-an-val"
			}, valueText(r))];
			const text = valueText(r);
			const m = /^([^（(]+?)\s*[（(](.+)[）)]$/.exec(text);
			if (!m) return [h$9("span", {
				key: "v",
				className: "lp-an-valtext"
			}, text)];
			return [h$9("span", {
				key: "v",
				className: "lp-an-val"
			}, m[1]), h$9("span", {
				key: "n",
				className: "lp-caption lp-an-note"
			}, m[2])];
		}
		/** The report's boundary note minus what the page footer already says (reference only, not a diagnosis). */
		function pageBoundary(text) {
			return text.split(/[；;]/).map((x) => x.trim().replace(/。$/, "")).filter((x) => x && !/不是诊断|不做诊断|健康管理参考/.test(x)).join("；");
		}
		/** 「9 月 30 日」, with the year when it is not this year. */
		function dateZh(iso) {
			const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
			if (!m) return "";
			const md = `${Number(m[2])} 月 ${Number(m[3])} 日`;
			return Number(m[1]) === (/* @__PURE__ */ new Date()).getFullYear() ? md : `${m[1]} 年 ${md}`;
		}
		function AnalysisTab(props) {
			const [status, setStatus] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState("");
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/analysis").then((s) => {
					setStatus(s);
					setError("");
				}).catch((e) => setError(errText$1(e, "读取深度分析状态失败")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const running = status?.runs.find((r) => r.active) ?? null;
			react.default.useEffect(() => {
				if (!running) return void 0;
				const timer = setInterval(load, 15e3);
				return () => clearInterval(timer);
			}, [running?.id, load]);
			const notice = (text, tone = "info") => props.onNotice?.(text, tone);
			const act = async (name, fn, fallback) => {
				setBusy(name);
				try {
					await fn();
				} catch (e) {
					notice(errText$1(e, fallback), "bad");
				} finally {
					setBusy("");
					load();
				}
			};
			const toggle = (on) => act("auto", async () => {
				await postJson("/api/longpi/analysis/settings", { auto: on });
				notice(on ? "已打开自动深度分析：有新数据时 LongPi 会自己开始。" : "已关闭自动深度分析：只在关键时间点问你要不要做。", "info");
			}, "设置失败");
			const doImport = (runId) => act("import", async () => {
				await postJson("/api/longpi/analysis/import", { run_id: runId });
				notice("结果已导入。", "good");
			}, "导入失败");
			const abandon = (runId) => act("abandon", async () => {
				await postJson("/api/longpi/analysis/abandon", { run_id: runId });
				notice("已放弃这次分析。", "info");
			}, "操作失败");
			const accept = (back) => act("accept", async () => {
				const res = await postJson("/api/longpi/analysis/plan-accept", {
					run_id: back.run_id,
					plan_key: back.plan_key
				});
				notice(`方案已保存（第 ${t(res.version)} 版），复测提醒会按方案里的指标安排。`, "good");
			}, "保存失败");
			if (!status) return h$9("div", { className: "lp-tab-body" }, h$9("p", {
				className: "lp-muted",
				role: error ? "alert" : void 0
			}, error || "读取中…"));
			const cur = status.current;
			const ready = status.runs.find((r) => r.report_ready && r.id !== cur?.run_id) ?? null;
			const stopped = status.runs.find((r) => !r.active && !r.report_ready) ?? null;
			const back = status.plan_read_back;
			const disabled = Boolean(busy);
			return h$9("div", { className: "lp-tab-body" }, error ? h$9("div", {
				className: "lp-callout lp-callout-bad",
				role: "alert"
			}, h$9(Icon, {
				name: "warn",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, error)) : null, h$9("section", {
				className: "lp-section",
				"aria-label": "深度分析状态"
			}, h$9("div", { className: "lp-card lp-an-prose" }, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, "关于深度分析")), h$9("p", { className: "lp-text lp-muted" }, "用全基因组、甲基化、肠道菌、蛋白组和体检数据，算生物学年龄、各器官状况和以后的疾病风险，提出针对性的问题并逐一查证，最后给一份能照着做的方案。分析在对话里进行；也可以随时在对话里直接要求做一次。"), h$9(Switch, {
				checked: Boolean(status.readiness?.auto_on),
				onChange: (on) => {
					toggle(on);
				},
				label: "自动深度分析",
				disabled,
				busy: busy === "auto",
				describedBy: "lp-auto-cost"
			}), h$9("div", {
				className: "lp-callout lp-callout-warn",
				id: "lp-auto-cost",
				role: "note"
			}, h$9(Icon, {
				name: "warn",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, `注意：${t(status.cost_zh)}，会消耗大量 token。打开后，有新的体检、化验或检测文件时，LongPi 会自己判断并开始分析（每个人两次自动分析至少间隔 30 天）；关闭时（默认），只在关键时间点问你要不要做，你同意才开始。这个开关对你和家人都生效。`))), h$9(StatusCard, {
				status,
				running,
				stopped,
				ready,
				disabled,
				onAbandon: (id) => {
					abandon(id);
				},
				onImport: (id) => {
					doImport(id);
				}
			})), cur ? h$9(Section, {
				title: "报告",
				aside: cur.imported_at ? h$9("span", { className: "lp-caption" }, `导入于 ${dateZh(t(cur.imported_at))}`) : void 0
			}, h$9(ReportCard, {
				cur,
				planItems: back?.items.length ?? 0
			})) : null, cur && cur.organs.length ? h$9(Section, { title: "器官体检表" }, h$9("div", { className: "lp-card" }, h$9("p", { className: "lp-caption lp-an-narrow-note" }, "年龄与疾病风险均为 AI 估计，风险为 10 年。"), h$9("div", { className: "lp-table-wrap" }, h$9("table", { className: "lp-table lp-an-organs" }, h$9("thead", null, h$9("tr", null, ...[
				"器官",
				"测量和公式",
				"年龄 · AI 估计",
				"疾病风险 · 10 年 · AI 估计"
			].map((x) => h$9("th", {
				key: x,
				scope: "col"
			}, x)))), h$9("tbody", null, ...cur.organs.map((o) => {
				const measures = [...o.measured, ...o.indices];
				return h$9("tr", { key: t(o.organ) }, h$9("td", { className: "lp-an-organ" }, t(o.label_zh)), h$9("td", {
					className: measures.length ? void 0 : "lp-an-none",
					"data-label": "测量和公式"
				}, measures.length ? h$9("ul", { className: "lp-an-list" }, ...measures.map((r, i) => h$9("li", { key: `${t(r.id)}-${i}` }, h$9("span", { className: "lp-muted" }, t(r.label_zh)), " ", ...measureValue(r)))) : "—"), h$9("td", {
					className: o.ai_age ? void 0 : "lp-an-none",
					"data-label": "年龄"
				}, o.ai_age ? h$9("div", { className: "lp-an-est" }, h$9("span", { className: "lp-num lp-an-val" }, valueText(o.ai_age)), rangeText(o.ai_age) ? h$9("span", { className: "lp-caption lp-num" }, rangeText(o.ai_age)) : null) : "—"), h$9("td", {
					className: o.ai_risks.length || o.overrides.length ? void 0 : "lp-an-none",
					"data-label": "疾病风险"
				}, o.ai_risks.length || o.overrides.length ? h$9("ul", { className: "lp-an-list" }, ...o.ai_risks.map((r, i) => h$9("li", {
					key: `${t(r.id)}-${i}`,
					className: "lp-an-est"
				}, h$9("span", null, cleanLabel(t(r.label_zh)), " ", h$9("span", { className: "lp-num lp-an-val" }, valueText(r))), rangeText(r) ? h$9("span", { className: "lp-caption lp-num" }, rangeText(r)) : null)), ...o.overrides.map((x, i) => h$9("li", {
					key: `o-${i}`,
					className: "lp-an-est"
				}, h$9("span", { className: "lp-strong" }, t(x.disease)), h$9("span", { className: "lp-caption lp-warn-ink" }, t(x.message_zh))))) : "—"));
			})))))) : null, cur && cur.board.length ? h$9(Section, {
				title: "问题看板",
				aside: h$9("span", { className: "lp-caption" }, "每个问题由一位独立 AI 研究员查证")
			}, h$9("div", { className: "lp-stack" }, ...cur.board.map((b) => h$9(QuestionCard, {
				key: t(b.id),
				row: b
			})))) : null, cur && back ? h$9(Section, { title: "干预方案" }, h$9("div", { className: "lp-card" }, back.items.length ? h$9("ul", { className: "lp-rows" }, ...back.items.map((i) => h$9("li", {
				key: t(i.id),
				className: "lp-row lp-row-stack"
			}, h$9("span", { className: "lp-strong" }, t(i.title)), i.detail ? h$9("span", { className: "lp-muted" }, t(i.detail)) : null, i.markers.length ? h$9("span", { className: "lp-caption" }, `复测看：${i.markers.map(t).join("、")}`) : null))) : h$9("p", { className: "lp-muted" }, "这份方案里没有条目。"), back.warnings.length ? h$9("div", { className: "lp-callout lp-callout-warn" }, h$9(Icon, {
				name: "warn",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, h$9("ul", { className: "lp-bullets lp-an-bullets" }, ...back.warnings.map((w, i) => h$9("li", { key: i }, t(w)))))) : null, back.errors.length ? h$9("div", {
				className: "lp-callout lp-callout-bad",
				role: "alert"
			}, h$9(Icon, {
				name: "warn",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, back.errors.map(t).join("；"))) : null, cur.retests.length ? h$9("p", { className: "lp-small lp-muted" }, "复测：" + cur.retests.map((r) => `${t(r.what)}（${t(r.after_weeks)} 周后）`).join("；")) : null, h$9("div", { className: "lp-card-foot" }, cur.plan_accepted_version ? h$9("span", { className: "lp-badge lp-badge-good" }, h$9(Icon, {
				name: "check",
				size: 12
			}), `已保存为第 ${t(cur.plan_accepted_version)} 版`) : h$9("span", { className: "lp-caption" }, "确认后才生效"), cur.plan_accepted_version ? null : h$9(Btn, {
				onClick: () => {
					accept(back);
				},
				disabled: disabled || !back.ok
			}, "我读过了，接受方案")))) : null);
		}
		/** One card for where things stand: a run in progress, a stopped run, a finished run to import, or why not yet. */
		function StatusCard(props) {
			const { status, running, stopped, ready, disabled } = props;
			const run = running ?? stopped;
			const [showSteps, setShowSteps] = react.default.useState(false);
			if (run) {
				const total = run.stages.length;
				const now = running ? run.stages.findIndex((s) => !s.done) : -1;
				const folded = !running || run.done === 0;
				const firstOpen = run.stages.findIndex((s) => !s.done);
				const at = firstOpen < 0 ? Math.max(total - 1, 0) : firstOpen;
				const nowLabel = run.stages[at]?.label_zh ?? "";
				const summary = running ? `正在进行第 1 步${nowLabel ? `「${t(nowLabel)}」` : ""} · 共 ${total} 步` : `停在第 ${at + 1} 步${nowLabel ? `「${t(nowLabel)}」` : ""} · 共 ${total} 步`;
				return h$9("div", { className: "lp-card lp-an-prose" }, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, running ? "分析进行中" : "上次分析没有完成"), folded ? null : h$9("span", {
					className: "lp-caption lp-num",
					role: "status",
					"aria-label": `已完成 ${run.done} 步，共 ${total} 步`
				}, `${run.done}/${total}`)), h$9("div", {
					className: "lp-bar",
					role: "progressbar",
					"aria-label": "分析进度",
					"aria-valuemin": 0,
					"aria-valuemax": total,
					"aria-valuenow": run.done
				}, h$9("span", { style: { width: `${total ? Math.round(run.done / total * 100) : 0}%` } })), folded ? h$9("div", { className: "lp-an-fold" }, h$9("span", { className: "lp-small" }, summary), h$9("button", {
					type: "button",
					className: "lp-textbtn",
					"aria-expanded": showSteps,
					"aria-controls": "lp-an-steps",
					onClick: () => setShowSteps((v) => !v)
				}, showSteps ? "收起步骤" : "展开步骤")) : null, folded && !showSteps ? null : h$9("ol", {
					className: "lp-progress-steps",
					id: "lp-an-steps"
				}, ...run.stages.map((s, i) => h$9("li", {
					key: s.key,
					className: `lp-progress-step${s.done ? " is-done" : i === now ? " is-now" : ""}`,
					"aria-current": i === now ? "step" : void 0
				}, h$9("span", {
					className: "lp-progress-dot",
					"aria-hidden": true
				}, s.done ? h$9(Icon, {
					name: "check",
					size: 12,
					strokeWidth: 2
				}) : null), h$9("span", null, s.label_zh, s.done ? h$9("span", { className: "lp-sr" }, "（已完成）") : null)))), running && run.reason_zh ? h$9("p", { className: "lp-small lp-muted" }, `${run.trigger === "ai" ? "LongPi 发起" : "你要求的"}：${t(run.reason_zh)}`) : null, running ? null : h$9("p", { className: "lp-small lp-muted" }, "可以回到那段对话说「继续」，或者放弃后重新发起。"), run.state_error ? h$9("div", { className: "lp-callout lp-callout-warn" }, h$9(Icon, {
					name: "warn",
					size: 16
				}), h$9("div", { className: "lp-callout-body" }, t(run.state_error))) : null, ready ? h$9("div", { className: "lp-callout lp-callout-good" }, h$9(Icon, {
					name: "check",
					size: 16
				}), h$9("div", { className: "lp-callout-body" }, "另有一份分析已完成，可以先导入。", h$9("div", null, h$9(Btn, {
					onClick: () => props.onImport(ready.id),
					disabled
				}, "导入结果")))) : null, h$9("div", { className: "lp-card-foot" }, h$9("span", { className: "lp-caption" }, running ? "每 15 秒自动刷新" : ""), h$9(Btn, {
					variant: "outline",
					onClick: () => props.onAbandon(run.id),
					disabled
				}, "放弃这次分析")));
			}
			if (ready) return h$9("div", {
				className: "lp-card lp-an-prose",
				role: "status"
			}, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, "有一份新的分析已完成")), h$9("p", { className: "lp-text lp-muted" }, "导入后就能在这里看到报告、器官体检表和方案。"), h$9("div", { className: "lp-card-foot" }, h$9("span", { className: "lp-caption" }, "导入后，报告和问题看板会显示在下面。"), h$9(Btn, {
				onClick: () => props.onImport(ready.id),
				disabled
			}, "导入结果")));
			const blocked = status.blockers;
			if (blocked) return h$9("div", {
				className: "lp-card lp-an-prose",
				role: "status"
			}, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, "现在还不能做")), h$9("div", { className: "lp-callout lp-callout-warn" }, h$9(Icon, {
				name: "info",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, t(blocked.reply_zh))));
			const readiness = status.readiness;
			if (!readiness) return null;
			return h$9("div", {
				className: "lp-card lp-an-prose",
				role: "status"
			}, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, readiness.auto_on ? "LongPi 的判断" : "现在的情况")), h$9("p", { className: "lp-text" }, t(readiness.why_zh) || "现在没有进行中的分析。"), readiness.folder ? h$9("p", { className: "lp-caption" }, `检测文件夹：${t(readiness.folder)}（只读）`) : null);
		}
		/** The report as a summary; the full report opens in a new browser tab (it is sandboxed there by its own CSP). */
		function ReportCard(props) {
			const { cur } = props;
			const href = `/api/longpi/analysis/report?v=${encodeURIComponent(t(cur.imported_at))}`;
			const rank = (r) => r.unit === "a" ? 0 : r.kind === "llm_estimate" ? 1 : 2;
			const headline = cur.readouts.map((r, i) => ({
				r,
				i
			})).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).slice(0, 4).map((x) => x.r);
			const facts = [
				[
					"器官",
					cur.organs.length,
					"个"
				],
				[
					"问题",
					cur.board.length,
					"个"
				],
				[
					"方案",
					props.planItems,
					"项"
				],
				[
					"复测",
					cur.retests.length,
					"项"
				]
			];
			return h$9("div", { className: "lp-card" }, h$9("dl", { className: "lp-an-facts" }, ...facts.map(([label, value, unit]) => h$9("div", {
				key: label,
				className: "lp-an-fact"
			}, h$9("dt", { className: "lp-caption" }, label), h$9("dd", { className: "lp-an-fact-value" }, h$9("span", { className: "lp-num-md" }, String(value)), h$9("span", { className: "lp-unit" }, unit))))), headline.length ? h$9("dl", { className: "lp-kv" }, ...headline.flatMap((r, i) => [h$9("dt", { key: `k${i}` }, t(r.label_zh)), h$9("dd", {
				key: `v${i}`,
				className: "lp-num"
			}, fmt(r))])) : null, pageBoundary(t(cur.boundary_zh)) ? h$9("p", { className: "lp-caption" }, pageBoundary(t(cur.boundary_zh))) : null, h$9("div", { className: "lp-card-foot" }, h$9("span", { className: "lp-caption" }, "完整报告在新标签页打开"), h$9("a", {
				className: "lp-linkbtn lp-btn-primary",
				href,
				target: "_blank",
				rel: "noopener noreferrer"
			}, "打开完整报告", h$9(Icon, {
				name: "chevron",
				size: 14
			}))));
		}
		/** First sentence of a conclusion, cut to about two lines at a clause break; the whole text then goes under the fold. */
		const LEAD_MAX = 80;
		function splitFirst(text) {
			const m = /^[\s\S]*?[。！？!?](?=\s*\S)/.exec(text);
			const [first, rest] = m ? [m[0], text.slice(m[0].length).trim()] : [text, ""];
			if (first.length <= LEAD_MAX) return [first, rest];
			const head = first.slice(0, LEAD_MAX);
			const cut = Math.max(head.lastIndexOf("；"), head.lastIndexOf("，"), head.lastIndexOf("："));
			return [`${cut > 20 ? head.slice(0, cut) : head}…`, text];
		}
		function QuestionCard(props) {
			const b = props.row;
			const conf = Object.prototype.hasOwnProperty.call(CONF_ZH, t(b.confidence)) ? CONF_ZH[t(b.confidence)] : "";
			const verdict = t(b.verdict_zh);
			const summary = t(b.summary_zh);
			const [lead, more] = splitFirst(verdict && summary ? `${verdict}：${summary}` : verdict || summary);
			const limits = t(b.limitations_zh);
			const next = t(b.next_step_zh);
			return h$9("article", { className: "lp-card lp-an-prose" }, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, `${t(b.id)} ${t(b.title_zh)}`.trim()), conf ? h$9("span", { className: `lp-badge ${conf === "低" ? "lp-badge-warn" : "lp-badge-neutral"}` }, `把握：${conf}`) : null), h$9("p", { className: "lp-text" }, lead || "还没有结论。"), more || limits ? h$9("details", null, h$9("summary", null, limits ? "证据与局限" : "证据"), h$9("div", { className: "lp-an-more" }, more ? h$9("p", { className: "lp-text lp-muted" }, more) : null, limits ? h$9("p", { className: "lp-text lp-muted" }, `局限：${limits}`) : null)) : null, next ? h$9("p", { className: "lp-an-next" }, h$9("span", { className: "lp-muted" }, "下一步："), next) : null);
		}
		//#endregion
		//#region src/client/people.ts
		const h$8 = react.default.createElement;
		const errText = (e, fallback) => e instanceof Error && e.message ? e.message : fallback;
		let peopleLoad = null;
		function loadPeople() {
			peopleLoad ??= getJson("/api/longpi/people").then((v) => {
				setShownPerson(v.active);
				return v;
			});
			peopleLoad.catch(() => {
				peopleLoad = null;
			});
			return peopleLoad;
		}
		function usePeople() {
			const [view, setView] = react.default.useState(null);
			react.default.useEffect(() => {
				let live = true;
				loadPeople().then((v) => {
					if (live) setView(v);
				}).catch(() => {
					if (live) setView(null);
				});
				return () => {
					live = false;
				};
			}, []);
			return view;
		}
		/**
		* An option's text. The account holder's records connect by themselves, so 我 carries no connection suffix (#11);
		* a family member gets one only when their link needs renewing.
		*/
		function optionText(p) {
			const name = p.id !== "self" && p.name && p.name !== p.label_zh ? `（${p.name}）` : "";
			const suffix = p.id !== "self" && p.link_error_zh ? " · 链接待续期" : "";
			return `${p.label_zh}${name}${suffix}`;
		}
		function AddPersonDialog(props) {
			const { view } = props;
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState("");
			const [form, setForm] = react.default.useState({
				label_zh: "",
				name: "",
				sex: "",
				birth_year: "",
				mcp_url: ""
			});
			const ready = form.label_zh.trim() !== "" && form.name.trim().length >= 2 && form.sex !== "";
			const add = async () => {
				if (!ready) return;
				setBusy(true);
				setError("");
				try {
					const res = await postJson("/api/longpi/people", {
						label_zh: form.label_zh,
						name: form.name,
						sex: form.sex,
						birth_year: form.birth_year ? Number(form.birth_year) : null,
						...form.mcp_url.trim() ? { mcp_url: form.mcp_url.trim() } : {}
					});
					if (res.person) await postJson("/api/longpi/people/active", { id: res.person.id });
					window.location.reload();
				} catch (e) {
					setError(errText(e, "添加失败，请稍后再试"));
					setBusy(false);
				}
			};
			const input = (key, label, extra = {}, hint = "", full = false) => {
				const id = "lp-person-" + key;
				return h$8("div", {
					className: `lp-field ${full ? "lp-field-full" : ""}`.trim(),
					key
				}, h$8("label", {
					className: "lp-field-label",
					htmlFor: id
				}, label), h$8("input", {
					id,
					className: "lp-input",
					value: form[key],
					disabled: busy,
					onChange: (e) => setForm({
						...form,
						[key]: e.target.value
					}),
					...hint ? { "aria-describedby": `${id}-hint` } : {},
					...extra
				}), hint ? h$8("span", {
					className: "lp-caption",
					id: `${id}-hint`
				}, hint) : null);
			};
			return h$8(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "添加家人",
				onClose: props.onClose,
				headless: true,
				className: "lp-people-modal"
			}, h$8("form", {
				className: "lp lp-people-dialog",
				noValidate: true,
				onSubmit: (e) => {
					e.preventDefault();
					add();
				}
			}, h$8("div", { className: "lp-people-dialog-head" }, h$8("h2", { className: "lp-h2" }, "添加家人"), h$8("button", {
				type: "button",
				className: "lp-iconbtn",
				"aria-label": "关闭",
				onClick: props.onClose
			}, h$8(Icon, {
				name: "close",
				size: 18
			}))), h$8("p", { className: "lp-muted lp-small" }, view.can_create_in_mirobody ? "会在你的 Mirobody 账号下为家人建一份独立的档案（家人不需要自己的账号）。家人的体检、方案和深度分析都和你的分开。" : /个人链接/.test(view.create_hint_zh) ? view.create_hint_zh.trim() : `${view.create_hint_zh.trim().replace(/[。.]?$/, "。")}或者粘贴家人自己的 Mirobody 个人链接。`), h$8("div", { className: "lp-form-grid" }, input("label_zh", "称呼", {
				placeholder: "如 爸爸、妈妈",
				autoFocus: true
			}), input("birth_year", "出生年份", {
				inputMode: "numeric",
				placeholder: "例如 1960"
			}), input("name", "姓名", { autoComplete: "off" }, "报告上的真实名字，用来核对上传的报告是不是本人的", true), h$8("div", {
				className: "lp-field lp-field-full",
				key: "sex"
			}, h$8(Segmented, {
				name: "lp-person-sex",
				label: "生理性别",
				value: form.sex,
				disabled: busy,
				options: [{
					value: "male",
					label: "男"
				}, {
					value: "female",
					label: "女"
				}],
				onChange: (sex) => setForm({
					...form,
					sex
				})
			})), view.can_create_in_mirobody ? null : input("mcp_url", "家人的 Mirobody 个人链接（可选）", {}, "", true)), error ? h$8("div", {
				className: "lp-callout lp-callout-warn",
				role: "alert"
			}, h$8(Icon, {
				name: "warn",
				size: 14
			}), h$8("span", { className: "lp-callout-body" }, error)) : null, h$8("div", { className: "lp-modal-actions" }, h$8(Btn, {
				type: "button",
				variant: "outline",
				onClick: props.onClose,
				disabled: busy
			}, "取消"), h$8(Btn, {
				type: "submit",
				disabled: busy || !ready
			}, busy ? "添加中" : "添加"))));
		}
		/**
		* Whose record the page shows, in the header's control row: the person picker, 添加家人, then the rest of the
		* row (`children`: 去健康对话, 刷新). Narrow, the picker stays left and the actions go right.
		*/
		function PeoplePicker(props) {
			const view = usePeople();
			const [adding, setAdding] = react.default.useState(false);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState("");
			const choose = async (id) => {
				if (!view || id === view.active) return;
				setBusy(true);
				setError("");
				try {
					await postJson("/api/longpi/people/active", { id });
					window.location.reload();
				} catch (e) {
					setError(errText(e, "切换失败"));
					setBusy(false);
				}
			};
			return h$8(react.default.Fragment, null, view ? h$8("span", { className: "lp-people" }, h$8("label", {
				className: "lp-sr",
				htmlFor: "lp-people-select"
			}, "在看谁的记录"), h$8("select", {
				id: "lp-people-select",
				className: "lp-select lp-select-sm lp-people-select",
				value: view.active,
				disabled: busy,
				onChange: (e) => {
					choose(e.target.value);
				}
			}, ...view.people.filter((p) => !p.demo).map((p) => h$8("option", {
				key: p.id,
				value: p.id
			}, optionText(p))), ...view.people.some((p) => p.demo) ? [h$8("optgroup", {
				key: "demo",
				label: "示例"
			}, ...view.people.filter((p) => p.demo).map((p) => h$8("option", {
				key: p.id,
				value: p.id
			}, `${p.label_zh}（${p.name}）`)))] : [])) : null, h$8("span", { className: "lp-header-end" }, view ? h$8("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: () => setAdding(true),
				disabled: busy
			}, h$8(Icon, {
				name: "plus",
				size: 14
			}), "添加家人") : null, props.children), error ? h$8("p", {
				className: "lp-form-error lp-people-error",
				role: "alert"
			}, error) : null, view && adding ? h$8(AddPersonDialog, {
				view,
				onClose: () => setAdding(false)
			}) : null);
		}
		/** The shown family member's link problem, said once under the header (the picker only says 链接待续期). */
		function PersonNotice() {
			const view = usePeople();
			const shown = view?.people.find((p) => p.id === view.active);
			if (shown?.demo) return h$8("div", {
				className: "lp-callout lp-callout-info lp-people-notice",
				role: "note"
			}, h$8(Icon, {
				name: "info",
				size: 16
			}), h$8("div", { className: "lp-callout-body" }, h$8("p", { className: "lp-callout-title" }, "你在看示例档案"), h$8("p", null, `${shown.name}（虚构人物，58 岁）完整使用 LongPi 后的样子：两次体检、手环数据、一次深度分析和执行了三周的方案。数据都是合成的，不对应任何真实的人。`), h$8("p", { className: "lp-caption" }, "在这里随便点，改动不会保存，下次打开会还原。看完后在右上角切回「我」，继续你自己的档案。")));
			if (!shown || shown.id === "self" || !shown.link_error_zh) return null;
			return h$8("div", {
				className: "lp-callout lp-callout-warn lp-people-notice",
				role: "alert"
			}, h$8(Icon, {
				name: "warn",
				size: 14
			}), h$8("span", { className: "lp-callout-body" }, shown.link_error_zh));
		}
		/** For someone whose own record is still empty: one line inviting them to the 示例档案 first. */
		function DemoInvite(props) {
			const view = usePeople();
			const [busy, setBusy] = react.default.useState(false);
			const demo = view?.people.find((p) => p.demo);
			if (!props.empty || !view || !demo || view.active !== "self") return null;
			return h$8("div", { className: "lp-callout lp-people-notice" }, h$8(Icon, {
				name: "spark",
				size: 16
			}), h$8("div", { className: "lp-callout-body" }, h$8("p", null, "想先看看档案完整以后，LongPi 能为你做什么？"), h$8("button", {
				type: "button",
				className: "lp-textbtn lp-textbtn-strong",
				disabled: busy,
				onClick: () => {
					setBusy(true);
					postJson("/api/longpi/people/active", { id: demo.id }).then(() => window.location.reload()).catch(() => setBusy(false));
				}
			}, busy ? "正在打开…" : "打开示例档案 →")));
		}
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
				key: "analysis",
				label: "深度分析"
			},
			{
				key: "ask",
				label: "问 LongPi"
			}
		];
		/** The secondary pages, reached from 更多 at the right end of the tab row. */
		const SECONDARY = [
			{
				key: "plan",
				label: "方案"
			},
			{
				key: "profile",
				label: "档案"
			},
			{
				key: "season",
				label: "赛季"
			},
			{
				key: "science",
				label: "研究"
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
		/** Setup steps still open, for the banner: none once there is a first record. */
		function bannerOf(journey) {
			const left = stepsLeft(journey);
			if (!left) return null;
			return {
				left,
				title: ONBOARDING_TITLES[ONBOARDING_TITLES.length - left] ?? ""
			};
		}
		function Header(props) {
			const journey = props.journey;
			const today = journey?.today ?? localToday$1();
			const name = journey?.profile.displayName.trim() ?? "";
			const meta = [`${chineseDate(today)} ${weekday(today)}`, journey?.plan.exists && journey.plan.days != null ? `方案第 ${journey.plan.days} 天` : ""].filter(Boolean);
			const sep = () => h$7("span", {
				className: "lp-header-sep",
				"aria-hidden": true
			}, "·");
			return h$7("header", { className: "lp-header" }, h$7("div", { className: "lp-header-text" }, h$7("div", { className: "lp-kicker" }, "LongPi · 健康"), h$7("h1", { className: "lp-h1" }, `${greeting(/* @__PURE__ */ new Date())}${name ? `，${name}` : ""}`), h$7("div", { className: "lp-header-meta" }, ...meta.flatMap((text, index) => [index > 0 ? h$7(react.default.Fragment, { key: `s${index}` }, sep()) : null, h$7("span", { key: `m${index}` }, text)]), journey ? h$7(react.default.Fragment, null, sep(), h$7(RecordsStatusLine, {
				journey,
				inline: true
			})) : props.failed ? null : h$7(Skeleton, {
				height: 18,
				width: 160
			}))), h$7("div", { className: "lp-header-actions" }, h$7(PeoplePicker, null, h$7(HealthChatButton), h$7("button", {
				type: "button",
				className: "lp-linkbtn",
				onClick: props.onRefresh,
				disabled: props.refreshing,
				"aria-busy": props.refreshing
			}, h$7(Icon, {
				name: "refresh",
				size: 14,
				className: props.refreshing ? "lp-spin" : ""
			}), props.refreshing ? "刷新中" : "刷新"))));
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
			}), h$7("span", { className: "lp-banner-text" }, `还差 ${banner.left} 步完成设置：${banner.title}`), h$7("span", { className: "lp-banner-go" }, "继续", h$7(Icon, {
				name: "chevron",
				size: 14
			})));
		}
		/** 更多: a small menu of the secondary pages; a click elsewhere or Escape closes it. */
		function MoreMenu(props) {
			const [open, setOpen] = react.default.useState(false);
			const wrap = react.default.useRef(null);
			const button = react.default.useRef(null);
			const menuId = react.default.useId();
			react.default.useEffect(() => {
				if (!open) return void 0;
				wrap.current?.querySelector("[role=\"menuitem\"]")?.focus();
				const onDown = (event) => {
					if (!wrap.current?.contains(event.target)) setOpen(false);
				};
				const onKey = (event) => {
					if (event.key !== "Escape") return;
					setOpen(false);
					button.current?.focus();
				};
				document.addEventListener("pointerdown", onDown);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("pointerdown", onDown);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			const onMenuKey = (event) => {
				if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
				event.preventDefault();
				const items = Array.from(wrap.current?.querySelectorAll("[role=\"menuitem\"]") ?? []);
				items[(items.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
			};
			return h$7("div", {
				className: "lp-more",
				ref: wrap
			}, h$7("button", {
				type: "button",
				className: "lp-more-btn",
				ref: button,
				"aria-haspopup": "menu",
				"aria-expanded": open,
				"aria-controls": menuId,
				onClick: () => setOpen((current) => !current)
			}, "更多", h$7(Icon, {
				name: "chevron",
				size: 14
			})), open ? h$7("div", {
				className: "lp-more-pop",
				role: "menu",
				id: menuId,
				"aria-label": "更多页面",
				onKeyDown: onMenuKey
			}, ...props.items.map((item) => h$7("button", {
				key: item.key,
				type: "button",
				role: "menuitem",
				className: "lp-row-btn",
				"aria-current": item.key === props.current ? "page" : void 0,
				onClick: () => {
					setOpen(false);
					props.onPick(item.key);
				}
			}, item.label))) : null);
		}
		/**
		* The tab row: the primary tabs; while a secondary page is open, a temporary selected tab for it with × back to
		* 总览; and 更多 at the right end.
		*/
		function TabBar(props) {
			const secondary = SECONDARY.filter((item) => item.key !== "science" || props.science);
			const value = props.tab === "indicators" ? "labs" : props.tab;
			const extra = TABS.some((item) => item.key === value) ? null : secondary.find((item) => item.key === value) ?? null;
			const tabs = extra ? [...TABS, {
				key: extra.key,
				label: extra.label
			}] : TABS;
			return h$7("div", { className: "lp-tabbar" }, h$7(Tabs, {
				tabs,
				value,
				onChange: props.setTab,
				label: "LongPi 健康页",
				idPrefix: "lp-page"
			}), extra ? h$7("button", {
				type: "button",
				className: "lp-iconbtn lp-tab-close",
				"aria-label": `关闭「${extra.label}」，回到总览`,
				onClick: () => props.setTab("overview")
			}, h$7(Icon, {
				name: "close",
				size: 12
			})) : null, h$7(MoreMenu, {
				items: secondary,
				current: value,
				onPick: props.setTab
			}));
		}
		function Loading() {
			return h$7("div", {
				className: "lp-loading",
				"aria-busy": true,
				"aria-label": "正在读取"
			}, h$7(Skeleton, {
				height: 36,
				width: 320
			}), h$7("div", { className: "lp-grid-2" }, h$7(Skeleton, {
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
			const onConnect = () => goTab("profile", { id: "lp-connection-card" });
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
					onConnect,
					area: "labs"
				});
				else if (tab === "sleep") panel = h$7(SleepTab, { onConnect });
				else if (tab === "training") panel = h$7(TrainingTab, { onConnect });
				else if (tab === "calendar") panel = h$7(CalendarTab, { journey });
				else if (tab === "ask") panel = h$7(AskTab, {
					journey,
					openChat: props.openChat
				});
				else if (tab === "analysis") panel = h$7(AnalysisTab, { onNotice: notify });
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
				}), h$7(TabBar, {
					tab,
					setTab,
					science: scienceOn
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
			}), h$7(PersonNotice), h$7(DemoInvite, { empty: Boolean(journey) && (journey?.records.indicator_count ?? 0) === 0 }), notice ? h$7("div", { className: "lp-notice-slot" }, notice) : null, journey ? h$7(SeasonBar, { onOpen: () => setTab("season") }) : null, body, h$7("footer", { className: "lp-footer" }, h$7("p", { className: "lp-caption" }, `${journey?.boundary_zh || "模型估计，不是诊断，也不是用药建议，也不是你能活多久。紧急情况请拨打 120。"} 档案和记录只保存在这台电脑上；你同意后，提问时相关健康数值才会发送给 DeepSeek 模型。`))), onboarding ? h$7(Onboarding, {
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
		/** Anchors on the 档案 tab that a result card's action scrolls to (element ids, not classes). */
		const RECORDS_ID = "lp-connection-card";
		const ADDONS_ID = "lp-addons-card";
		const SELF_ID = "lp-self-card";
		const PROFILE_ID = "lp-profile-card";
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
			const onAction = (target) => toPage("profile", { id: target === "records" ? RECORDS_ID : target === "addons" ? ADDONS_ID : target === "self" ? SELF_ID : PROFILE_ID });
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
			return h$6("div", { className: "lp lp-pane" }, h$6("div", { className: "lp-pane-head" }, h$6("h2", { className: "lp-h3 lp-pane-title" }, h$6(Icon, {
				name: "health",
				size: 14
			}), PANE_TITLE), props.openPage ? h$6("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: props.openPage
			}, "打开健康页 →") : null), notice ? h$6("div", { className: "lp-notice-slot" }, notice) : null, body, h$6("p", { className: "lp-caption lp-pane-foot" }, journey?.boundary_zh || "模型估计，不是诊断，也不是用药建议，也不是你能活多久。紧急情况请拨打 120。"));
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
		function nextParts(data) {
			return [
				["下次打卡", data.next.checkin],
				["下次复测", data.next.retest],
				["下次小结", data.next.weekly]
			].filter((row) => Boolean(row[1])).map(([label, iso]) => [label, whenText(iso)]);
		}
		function nextLine(data) {
			const parts = nextParts(data);
			return parts.length > 0 ? parts.map(([label, when]) => `${label} ${when}`).join("，") : "近期没有要发的提醒";
		}
		/** 下次打卡 / 复测 / 小结 as a short key-value list; nothing when nothing is scheduled. */
		function NextList(props) {
			const parts = nextParts(props.data);
			if (parts.length === 0) return h$4("p", { className: "lp-caption" }, "近期没有要发的提醒。");
			return h$4("dl", { className: "lp-kv" }, ...parts.flatMap(([label, when]) => [h$4("dt", { key: `t:${label}` }, label), h$4("dd", {
				key: `d:${label}`,
				className: "lp-num"
			}, when)]));
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
			}), h$4("span", { className: "lp-check-text" }, props.children));
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
			}, h$4("span", { className: "lp-row-main" }, h$4("span", { className: "lp-num" }, whenText(row.at)), "  ", h$4("span", null, LOG_ZH[row.kind] ?? row.kind), row.error ? h$4("span", { className: "lp-caption" }, `  ${row.error}`) : null), h$4("span", { className: "lp-row-end" }, channelsText(row) ? h$4("span", { className: "lp-caption" }, channelsText(row)) : null, h$4("span", { className: `lp-badge ${row.ok ? "lp-badge-good" : "lp-badge-warn"}` }, h$4(Icon, {
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
				className: `lp-badge ${row.ok ? "lp-badge-good" : "lp-badge-warn"}`
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
			}), h$4("span", { className: "lp-caption" }, settings.enabled ? hasChannel ? nextLine(data) : "已开启，但还没有可用的渠道：打开桌面通知或填写 Webhook。" : "关闭时不会发送任何提醒。开启后按下面的时间提醒打卡、到期复测和每周小结。")), h$4("div", { className: "lp-grid-2 lp-followup-grid" }, h$4("fieldset", { className: "lp-fieldset" }, h$4("legend", { className: "lp-followup-legend" }, "什么时候"), h$4("div", { className: "lp-followup-times" }, h$4(TimeField, {
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
			})) : null)), h$4("fieldset", { className: "lp-fieldset" }, h$4("legend", { className: "lp-followup-legend" }, "发到哪里"), h$4(Check, {
				id: "lp-fu-desktop",
				checked: form.desktop && data.platform_desktop,
				disabled: !data.platform_desktop,
				onChange: (checked) => set("desktop", checked)
			}, "桌面通知", h$4("span", { className: "lp-caption" }, data.platform_desktop ? "这台电脑的系统通知" : "这台电脑的系统不支持")), h$4("div", { className: "lp-field" }, h$4("label", {
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
			}, "签名密钥", h$4("span", { className: "lp-optional" }, "机器人开了「加签」才需要")), h$4("div", { className: "lp-input-unit" }, h$4("input", {
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
			}), h$4("p", { className: "lp-caption" }, form.detail === "minimal" ? "只发「今天还有 2 项待打卡」这类提示，不含项目名称和健康数值。" : "会带上方案项目名称、执行率和复测指标，发到你配置的渠道。")), error ? h$4("p", {
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
			const where = channels.length > 0 ? channels.join("和") : data.platform_desktop ? "桌面通知" : "（还没有可用的渠道，在「更多设置」里填写 Webhook）";
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
			return h$4("div", { className: "lp-reminder" }, h$4("div", { className: "lp-reminder-row" }, h$4(Switch, {
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
			})), h$4("p", { className: "lp-caption" }, settings.enabled ? switchCaption(data) : `关闭时不会发送提醒。开启后：${switchCaption(data)}`), settings.enabled && hasChannel ? h$4(NextList, { data }) : null, error ? h$4("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
		}
		const SEASON_DEFAULT = "没有方案时，有待补的检查或本赛季的小目标，才会每周提醒一次；都没有就不发。";
		/**
		* The season's weekly reminder, said against the real state of the switch above (the same read as the
		* engage module's note): with no consent yet, only the season part waits, not the check-in reminder.
		*/
		function SeasonNote(props) {
			const { journey } = useJourney();
			const [view, setView] = react.default.useState(null);
			react.default.useEffect(() => {
				let live = true;
				getJson("/api/longpi/season").then((row) => {
					if (live) setView(row);
				}).catch(() => {});
				return () => {
					live = false;
				};
			}, []);
			const line = view?.reminder_zh ? view.reminder_zh : view?.needs_consent ? props.enabled ? "打卡提醒已开启。赛季的每周提醒要等你同意使用说明后才开始。" : "还没有同意使用说明，赛季的每周提醒还没开始。" : journey && !journey.plan.exists ? SEASON_DEFAULT : null;
			if (!line) return null;
			return h$4("div", { className: "lp-callout lp-callout-info" }, h$4(Icon, {
				name: "info",
				size: 14
			}), h$4("div", { className: "lp-callout-body" }, h$4("p", null, line)));
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
			return h$4("div", { className: "lp-followup-box" }, h$4(ReminderSwitch, {
				data,
				onNotice: props.onNotice
			}), h$4(SeasonNote, { enabled: data.settings.enabled }), h$4("details", null, h$4("summary", null, "更多设置", h$4("span", { className: "lp-optional" }, "复测提醒、每周小结、免打扰、发到飞书或手机、内容详略")), h$4(Settings, {
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
			return h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "你的记录现在就能算")), ready.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "还没有能直接计算的方法。") : h$3("ul", { className: "lp-rows" }, ...ready.slice(0, 8).map((row) => h$3("li", {
				key: row.name,
				className: "lp-row lp-row-stack"
			}, h$3("span", { className: "lp-strong" }, row.blurb || row.name), h$3("span", { className: "lp-caption" }, row.domain || row.name)))), ready.length > 8 ? h$3("p", { className: "lp-caption lp-measure" }, `另有 ${ready.length - 8} 项`) : null, ready.length > 0 ? h$3("div", { className: "lp-actions" }, h$3(Btn, {
				disabled: running,
				onClick: () => {
					run();
				}
			}, h$3(Icon, {
				name: "play",
				size: 12
			}), running ? "正在计算…" : `一键计算 ${ready.length} 项`)) : null, results ? h$3("ul", { className: "lp-rows" }, ...results.map((row) => h$3("li", {
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
			return h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("label", {
				className: "lp-card-title",
				htmlFor: "lp-method-q"
			}, "找方法")), h$3("form", {
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
				variant: "outline",
				disabled: busy || !question.trim()
			}, busy ? "匹配中" : "匹配")), error ? h$3("p", { className: "lp-form-error" }, error) : null, note ? h$3("p", { className: "lp-caption lp-measure" }, note) : null, shown.length > 0 ? h$3("ul", { className: "lp-rows" }, ...shown.slice(0, 6).map((item) => h$3("li", {
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
				className: "lp-stack",
				id: "lp-methods"
			}, h$3("p", { className: "lp-caption lp-measure" }, `方法库 ${board.skills?.version ?? ""} · ${board.readiness?.declared ?? 0} 个个人方法。对话里照常可用。`), h$3("div", { className: "lp-grid-2 lp-grid-top" }, h$3(RunReady, {
				board,
				onNotice: props.onNotice
			}), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "再测一项就能解锁")), unlock.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "没有只差一项的方法。") : h$3("ul", { className: "lp-rows" }, ...unlock.slice(0, 8).map((row) => h$3("li", {
				key: row.item,
				className: "lp-row"
			}, h$3("span", { className: "lp-strong" }, row.item), h$3("span", { className: "lp-caption" }, `解锁 ${row.skills.length} 个方法`)))))), h$3("div", { className: "lp-grid-2 lp-grid-top" }, h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "用药计划"), h$3("span", { className: "lp-caption" }, "只读，来自原来的用药记录")), meds.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "没有读到用药计划。") : h$3("ul", { className: "lp-rows" }, ...meds.map((row) => h$3("li", {
				key: row.name,
				className: "lp-row"
			}, h$3("span", null, row.name), h$3("span", { className: "lp-caption" }, row.status ?? ""))))), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "最近读出")), readouts.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "还没有算过。") : h$3("ul", { className: "lp-rows" }, ...readouts.slice(0, 8).map((row) => h$3("li", {
				key: row.key,
				className: "lp-row"
			}, h$3("span", null, row.label_zh || row.key), h$3("span", { className: "lp-row-end" }, h$3("span", { className: "lp-num" }, `${typeof row.value === "number" ? fmt$1(row.value, 2) : row.value ?? ""} ${row.unit && row.unit !== "1" ? row.unit === "a" || row.unit === "yr" ? "岁" : row.unit : ""}`), h$3("span", { className: "lp-caption" }, chineseDate(row.measured_at || row.at || "")))))))), h$3(Search, { board }));
		}
		//#endregion
		//#region src/client/settings-page.ts
		const h$2 = react.default.createElement;
		/** Registered settings sections this page covers itself (提醒 shows its own season note; 研究 is the 一起研究 block). */
		const PLACED = /* @__PURE__ */ new Set(["season-reminder", "science"]);
		function Block(props) {
			return h$2("section", {
				className: "lp-set-block",
				id: props.id,
				"aria-labelledby": `${props.id}-title`
			}, h$2("div", { className: "lp-set-titles" }, h$2("h3", {
				className: "lp-set-title",
				id: `${props.id}-title`
			}, props.title), props.hint ? h$2("p", { className: "lp-caption" }, props.hint) : null), props.children);
		}
		function ScienceSwitch() {
			const [mode, setMode] = react.default.useState("local");
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			react.default.useEffect(() => {
				getJson("/api/longpi/science/invite").then((row) => {
					setMode(row.preference === "off" || row.mode === "off" ? "off" : "local");
				}).catch(() => setMode("local"));
			}, []);
			const set = (next) => {
				setBusy(true);
				setError(null);
				postJson("/api/longpi/science/preference", { mode: next }).then(() => setMode(next)).catch(() => setError("没有保存，请稍后再试。")).finally(() => setBusy(false));
			};
			return h$2("div", { className: "lp-set-body" }, h$2(Switch, {
				id: "lp-set-science-on",
				checked: mode === "local",
				busy,
				disabled: busy,
				label: "在本机参与研究",
				onChange: (next) => set(next ? "local" : "off")
			}), h$2("p", { className: "lp-set-text lp-muted" }, "开着时，研究页、个人小试验和本机统计都能用，数据只保存在这台电脑上。关掉后这些会停。不满 18 岁时始终关闭。"), error ? h$2("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$2("a", {
				className: "lp-textbtn",
				href: "/api/longpi/science/community?view=page"
			}, "打开研究页 →"));
		}
		function Privacy() {
			return h$2("div", { className: "lp-set-body" }, h$2("dl", { className: "lp-kv lp-set-kv" }, ...[
				["存在哪里", "档案、方案、记录、自测和提醒只保存在这台电脑上。体检和手环的原件留在原来的地方，这里只读。"],
				["什么会发给模型", "和 LongPi 对话时，你的问题和为回答读出的档案、化验，在你同意后才会发给回答用的人工智能（默认 DeepSeek）。不对话就不发送。"],
				["发给手机", "默认不用。只有你自己配置后才会发，提醒里不写化验数字和项目名字。"]
			].flatMap(([title, text]) => [h$2("dt", { key: `t:${title}` }, title), h$2("dd", { key: `d:${title}` }, text)])), h$2("div", { className: "lp-actions" }, h$2(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: "longpi-report.md"
			}, "导出报告")));
		}
		function Connection() {
			const { data } = useConnection();
			return h$2("div", { className: "lp-set-body" }, data ? h$2(ConnectionStatus, { connection: data }) : null, h$2("details", null, h$2("summary", null, "高级：手动连接（一般不需要）"), h$2(ConnectionPanel, {
				idPrefix: "lp-set-conn",
				hideStatus: true
			})));
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
			const { journey } = useJourney();
			const extra = settingsSections().filter((section) => !PLACED.has(section.id));
			return h$2("div", { className: "lp lp-settings" }, h$2("div", { className: "lp-set-head" }, h$2("h2", { className: "lp-h2" }, "LongPi"), props.openPage ? h$2("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => {
					props.close?.();
					props.openPage?.();
				}
			}, "打开健康页 →") : null), notice ? h$2("div", { className: "lp-notice-slot" }, notice) : null, h$2(Block, {
				id: "lp-set-followup",
				title: "提醒",
				hint: "默认关闭。这个窗口关了，就不会响。"
			}, h$2(FollowupPanel, { onNotice: notify })), h$2(Block, {
				id: "lp-set-connection",
				title: "数据连接"
			}, h$2(Connection)), h$2(Block, {
				id: "lp-set-science",
				title: "一起研究"
			}, h$2(ScienceSwitch)), h$2(Block, {
				id: "lp-set-privacy",
				title: "隐私与数据"
			}, h$2(Privacy), ...extra.map((section) => h$2("div", {
				key: section.id,
				className: "lp-set-extra"
			}, h$2(section.Component, { embedded: true })))), h$2("section", {
				className: "lp-set-block",
				id: "lp-set-methods",
				"aria-label": "高级"
			}, h$2("details", { onToggle: (event) => setAdvanced(event.currentTarget.open) }, h$2("summary", null, "高级：方法库和安装细节"), advanced ? h$2(Methods, { onNotice: notify }) : null)), journey?.version ? h$2("p", { className: "lp-caption lp-set-version" }, `LongPi ${journey.version}`) : null);
		}
		//#endregion
		//#region src/client/styles/index.ts
		const CSS = [
			`
.lp {
  --lp-bg: var(--dsw-alias-bg-base, #fff);
  --lp-layer: var(--dsw-alias-bg-layer-1, #fff);
  --lp-layer-2: var(--dsw-alias-bg-layer-2, #fff);
  --lp-ink: var(--dsw-alias-label-primary, rgb(15, 17, 21));
  --lp-ink-2: var(--dsw-alias-label-secondary, rgb(97, 102, 107));
  --lp-ink-3: var(--dsw-alias-label-tertiary, rgb(129, 133, 140));
  --lp-ink-4: var(--dsw-alias-label-caption, rgb(173, 178, 184));
  --lp-line: var(--dsw-alias-border-l2, rgba(0, 0, 0, .08));
  --lp-line-strong: var(--dsw-alias-border-l3, rgba(0, 0, 0, .14));
  /* older names, same values */
  --lp-line-1: var(--dsw-alias-border-l1, rgba(0, 0, 0, .04));
  --lp-line-2: var(--lp-line);
  --lp-line-3: var(--lp-line-strong);
  --lp-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, .06));
  --lp-press: var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, .1));
  --lp-well: rgba(38, 49, 72, .04);
  --lp-skeleton: var(--dsw-alias-bg-skeleton, rgba(0, 0, 0, .05));
  --lp-accent: var(--dsw-alias-brand-primary, rgb(15, 17, 21));
  --lp-on-accent: var(--dsw-alias-label-primary-foreground, #fff);
  --lp-brand: var(--lp-accent);
  --lp-on-brand: var(--lp-on-accent);
  --lp-focus: var(--dsw-alias-state-business-primary, rgb(65, 118, 230));
  --lp-data: #2a78d6;
  --lp-data-wash: rgba(42, 120, 214, .10);
  --lp-band: rgba(97, 102, 107, .11);
  --lp-good: var(--dsw-alias-state-success-primary, rgb(34, 197, 94));
  --lp-good-ink: #15803d;
  --lp-good-wash: rgba(34, 197, 94, .11);
  --lp-warn: var(--dsw-alias-state-warn-primary, rgb(245, 158, 11));
  --lp-warn-ink: #b45309;
  --lp-warn-wash: rgba(245, 158, 11, .12);
  --lp-bad: var(--dsw-alias-state-error-primary, rgb(236, 19, 19));
  --lp-bad-ink: #c81e1e;
  --lp-bad-wash: rgba(236, 19, 19, .07);
  --lp-field: var(--lp-layer);
  --lp-shadow-pop: var(--dsw-shadow-lv3, 0 0 1px rgba(0, 0, 0, .2), 0 12px 32px rgba(0, 0, 0, .1));
  --lp-shadow-hover: var(--dsw-shadow-lv2, 0 4px 12px rgba(0, 0, 0, .04), 0 2px 8px rgba(0, 0, 0, .04));
  --lp-radius-card: 12px;
  --lp-radius-ctl: 8px;
  --lp-chevron-down: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2381858c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  color-scheme: light;
  color: var(--lp-ink);
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
body[data-ds-dark-theme] .lp {
  --lp-well: rgba(255, 255, 255, .05);
  --lp-data: #4b93ea;
  --lp-data-wash: rgba(75, 147, 234, .16);
  --lp-band: rgba(207, 211, 214, .12);
  --lp-good-ink: #4ed17e;
  --lp-good-wash: rgba(34, 197, 94, .16);
  --lp-warn-ink: #f7ad31;
  --lp-warn-wash: rgba(245, 158, 11, .09);
  --lp-bad-ink: #f47272;
  --lp-bad-wash: rgba(242, 90, 90, .14);
  --lp-field: rgba(255, 255, 255, .03);
  --lp-chevron-down: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a3a8ad' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  color-scheme: dark;
}
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp button, .lp input, .lp select, .lp textarea { font-family: inherit; }
.lp :is(button, a, summary, [tabindex="0"]):focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 2px; }
.lp p { margin: 0; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lp-icon { flex: none; vertical-align: -3px; }

/* type scale (§2) */
.lp-h1 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.01em; }
.lp-h2 { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; }
.lp-h3 { margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; }
.lp-text { font-size: 14px; line-height: 22px; max-width: 40em; }
.lp-muted { color: var(--lp-ink-2); }
.lp-muted-ink { color: var(--lp-ink-3); }
.lp-small { font-size: 13px; line-height: 20px; }
.lp-caption { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); font-weight: 400; }
.lp-fine { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-strong { font-weight: 500; color: var(--lp-ink); }
.lp-num { font-variant-numeric: tabular-nums; }
.lp-num-lg { font-size: 36px; line-height: 44px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.lp-num-md { font-size: 24px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-unit { font-size: 14px; line-height: 20px; font-weight: 400; color: var(--lp-ink-2); }
.lp-good-ink { color: var(--lp-good-ink); }
.lp-warn-ink { color: var(--lp-warn-ink); }
.lp-bad-ink { color: var(--lp-bad-ink); }
`,
			`
/* --- frame ----------------------------------------------------------------------------- */
.lp-page-root {
  container: lp-root / inline-size;
  width: 100%; max-width: 100%; height: 100%; overflow-x: hidden; overflow-y: auto; background: var(--lp-bg);
  padding-top: var(--dsh-frame-top-clearance, 48px);
  padding-left: var(--dsh-frame-leading-clearance, 0px);
}
.lp-page { width: 100%; max-width: 1040px; margin: 0 auto; padding: 16px 40px 48px; }
@container lp-root (max-width: 760px) { .lp-page { padding: 12px 20px 40px; } }
.lp-body { transition: opacity .2s ease; }
.lp-refreshing { opacity: .6; }
.lp-stack { display: grid; gap: 12px; min-width: 0; }
.lp-stack-lg { display: grid; gap: 32px; min-width: 0; }
.lp-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-grid-2 > :last-child:nth-child(odd) { grid-column: 1 / -1; }
.lp-grid-top { align-items: start; }
.lp-grid-1 { display: grid; gap: 12px; }
@container lp-root (max-width: 720px) { .lp-grid-2 { grid-template-columns: minmax(0, 1fr); } }

/* --- section and card ------------------------------------------------------------------- */
.lp-section { display: grid; gap: 12px; min-width: 0; }
.lp-section + .lp-section { margin-top: 32px; }
.lp-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.lp-section-titles { display: grid; gap: 2px; min-width: 0; }
.lp-kicker { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-card {
  min-width: 0; max-width: 100%; padding: 20px; border-radius: var(--lp-radius-card);
  background: var(--lp-layer); border: 1px solid var(--lp-line);
}
@container lp-root (max-width: 560px) { .lp-card { padding: 16px; } }
/* content spacing inside a card: stronger than .lp p / list resets, weaker than an explicit page rule with .lp */
.lp .lp-card > * + * { margin-top: 12px; }
.lp .lp-card > .lp-card-head + * { margin-top: 0; }
.lp .lp-card > .lp-card-foot { margin-top: 16px; }
.lp-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; min-height: 22px; }
.lp-card-title, .lp-label { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; color: var(--lp-ink); }
.lp-card-title .lp-caption, .lp-label .lp-caption, .lp-label .lp-optional { font-weight: 400; }
.lp-optional { font-size: 12px; line-height: 18px; font-weight: 400; color: var(--lp-ink-3); }
.lp-subhead { display: flex; align-items: baseline; gap: 8px; margin: 16px 0 8px; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--lp-ink); }
.lp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--lp-line); }
.lp-card-skeleton { border-radius: var(--lp-radius-card); }
.lp-divider { height: 1px; border: 0; margin: 16px 0; background: var(--lp-line); }

/* --- buttons: DSH Btn (with .lp-btn) and .lp-linkbtn share one shape -------------------- */
.lp .lp-btn.lp-btn { height: 32px; padding: 0 12px; border-radius: var(--lp-radius-ctl); font-size: 13px; line-height: 20px; font-weight: 500; gap: 6px; }
.lp .lp-btn.lp-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
/* disabled: the same button, faded — never a solid grey block louder than an enabled outline button */
.lp .lp-btn.lp-btn:disabled { opacity: .4; cursor: default; }
.lp-linkbtn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: var(--lp-radius-ctl); border: 1px solid var(--lp-line-strong); background: transparent; color: var(--lp-ink);
  font-size: 13px; line-height: 20px; font-weight: 400; text-decoration: none; cursor: pointer; white-space: nowrap;
  transition: background-color .15s ease;
}
.lp-linkbtn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-linkbtn:disabled { cursor: default; color: var(--lp-ink-3); }
.lp-linkbtn .lp-icon { color: var(--lp-ink-2); }
.lp-linkbtn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
.lp-btn-primary { background: var(--lp-accent); color: var(--lp-on-accent); border-color: transparent; }
.lp-btn-primary:hover:not(:disabled) { background: var(--lp-accent); opacity: .88; }
.lp-btn-primary .lp-icon { color: inherit; }
.lp-textbtn {
  display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: var(--lp-ink-2);
  font-size: 13px; line-height: 20px; cursor: pointer; text-decoration: none; width: fit-content;
}
.lp-textbtn:hover:not(:disabled) { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; }
.lp-textbtn:disabled { color: var(--lp-ink-3); cursor: default; }
.lp-textbtn-strong { color: var(--lp-ink); font-weight: 500; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--lp-line-strong); }
.lp-iconbtn, .lp-notice-x {
  width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; padding: 0;
  border: 0; border-radius: var(--lp-radius-ctl); background: transparent; color: var(--lp-ink-2); cursor: pointer;
}
.lp-notice-x { width: 24px; height: 24px; border-radius: 6px; color: var(--lp-ink-3); }
.lp-iconbtn:hover:not(:disabled), .lp-notice-x:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-iconbtn:disabled { opacity: .4; cursor: default; }
.lp-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.lp-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
.lp-modal-actions > button { min-width: 88px; }

/* --- tags and badges --------------------------------------------------------------------- */
.lp-tag {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 6px; border-radius: 4px; background: var(--lp-well);
  color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400; white-space: nowrap; vertical-align: middle;
}
.lp-badge, .lp-pill {
  display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--lp-well);
  color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 500; white-space: nowrap; vertical-align: middle;
}
.lp-badge-good, .lp-pill-good { background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-badge-warn { background: var(--lp-warn-wash); color: var(--lp-warn-ink); }
.lp-badge-bad { background: var(--lp-bad-wash); color: var(--lp-bad-ink); }
.lp-badge-neutral { background: var(--lp-well); color: var(--lp-ink-2); }
.lp-badge-accent { background: var(--lp-accent); color: var(--lp-on-accent); }
.lp-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

/* --- status line ------------------------------------------------------------------------- */
.lp-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); min-width: 0; }
.lp-statusdot { width: 7px; height: 7px; border-radius: 50%; background: var(--lp-ink-4); flex: none; }
.lp-statusdot-on { background: var(--lp-good); box-shadow: 0 0 0 3px var(--lp-good-wash); }
.lp-statusdot-warn { background: var(--lp-warn); box-shadow: 0 0 0 3px var(--lp-warn-wash); }
.lp-statusdot-bad { background: var(--lp-bad); box-shadow: 0 0 0 3px var(--lp-bad-wash); }

/* --- rows, lists, tables ----------------------------------------------------------------- */
.lp-rows { list-style: none; margin: 0; padding: 0; }
.lp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 10px 0; border-top: 1px solid var(--lp-line); font-size: 13px; line-height: 20px; }
.lp-row:first-child { border-top: 0; }
.lp-row-main { flex: 1; min-width: 0; }
.lp-row-stack { flex-direction: column; align-items: flex-start; gap: 2px; }
.lp-row-end { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; color: var(--lp-ink-2); }
.lp-row-btn {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 10px 12px; margin: 0; border: 1px solid var(--lp-line);
  border-radius: var(--lp-radius-ctl); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-row-btn:hover:not(:disabled) { background: var(--lp-hover); }
.lp-row-btn > .lp-icon:last-child { margin-left: auto; color: var(--lp-ink-3); }
.lp-bullets { margin: 4px 0 0; padding-left: 1.2em; display: grid; gap: 4px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-bullets li::marker { color: var(--lp-ink-3); }
.lp-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 16px; margin: 0; font-size: 13px; line-height: 20px; }
.lp-kv dt { color: var(--lp-ink-3); }
.lp-kv dd { margin: 0; min-width: 0; }
.lp-table-wrap { width: 100%; overflow-x: auto; }
.lp-table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 20px; }
.lp-table th { padding: 8px 12px; text-align: left; vertical-align: bottom; font-size: 12px; line-height: 18px; font-weight: 400; color: var(--lp-ink-3); border-bottom: 1px solid var(--lp-line); white-space: nowrap; }
.lp-table td { padding: 10px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--lp-line); }
.lp-table tr:last-child td { border-bottom: 0; }
.lp-table th:first-child, .lp-table td:first-child { padding-left: 0; }
.lp-table th:last-child, .lp-table td:last-child { padding-right: 0; }
.lp-table td:first-child { white-space: nowrap; min-width: 5em; font-weight: 500; }
.lp-table .lp-td-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* --- forms ----------------------------------------------------------------------------------- */
.lp-field { display: grid; gap: 6px; min-width: 0; align-content: start; }
.lp-field-full { grid-column: 1 / -1; }
.lp-field-label { display: flex; align-items: baseline; gap: 6px; font-size: 13px; line-height: 20px; font-weight: 500; color: var(--lp-ink); }
.lp-field-label .lp-caption { font-weight: 400; }
.lp-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@container lp-root (max-width: 420px) { .lp-form-grid { grid-template-columns: minmax(0, 1fr); } }
.lp-onb .lp-form-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.lp-input, .lp-select {
  height: 36px; width: 100%; min-width: 0; padding: 0 12px; border-radius: var(--lp-radius-ctl); border: 1px solid var(--lp-line-strong);
  background: var(--lp-field); color: var(--lp-ink); font-size: 14px; line-height: 22px; transition: border-color .15s ease, box-shadow .15s ease;
}
.lp-select, select.lp-input {
  appearance: none; -webkit-appearance: none; padding-right: 32px; cursor: pointer;
  background-image: var(--lp-chevron-down); background-position: calc(100% - 10px) 50%; background-size: 14px 14px; background-repeat: no-repeat;
}
.lp-select-sm { height: 32px; font-size: 13px; width: auto; }
.lp-input::placeholder { color: var(--lp-ink-4); }
.lp-input:hover, .lp-select:hover { border-color: var(--lp-ink-4); }
.lp-input:focus, .lp-select:focus { outline: none; border-color: var(--lp-ink-3); box-shadow: 0 0 0 3px var(--lp-hover); }
.lp-input[aria-invalid="true"] { border-color: var(--lp-bad); }
.lp-input:disabled, .lp-select:disabled { opacity: .6; cursor: default; }
textarea.lp-input { height: auto; min-height: 80px; padding: 8px 12px; resize: vertical; }
.lp-input[type="date"] { padding-right: 8px; }
.lp-input[type="file"] { height: auto; padding: 6px; font-size: 13px; }
.lp-input-unit { display: flex; align-items: center; gap: 8px; }
.lp-form-error { margin: 0; color: var(--lp-bad-ink); font-size: 12px; line-height: 18px; }
.lp .lp-check, .lp-checkrow { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 20px; color: var(--lp-ink); cursor: pointer; }
.lp-checkrow { padding: 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp input[type="checkbox"], .lp input[type="radio"] { width: 16px; height: 16px; margin: 2px 0 0; flex: none; accent-color: var(--lp-accent); cursor: pointer; }
.lp-seg-wrap { display: grid; gap: 6px; }
.lp-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); width: max-content; max-width: 100%; flex-wrap: wrap; }
.lp-seg-opt { position: relative; display: inline-flex; }
.lp-seg-opt input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.lp-seg-opt span, .lp-seg-item {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 44px; height: 28px; padding: 0 12px; border: 0;
  border-radius: 6px; background: transparent; font: inherit; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
.lp-seg-opt:hover span, .lp-seg-item:hover:not(:disabled) { color: var(--lp-ink); }
.lp-seg-on span, .lp-seg-item.is-on { background: var(--lp-layer); color: var(--lp-ink); font-weight: 500; box-shadow: 0 0 0 1px var(--lp-line), 0 1px 2px rgba(0, 0, 0, .05); }
.lp-seg-item:disabled { color: var(--lp-ink-4); cursor: default; }
body[data-ds-dark-theme] .lp .lp-seg-on span, body[data-ds-dark-theme] .lp .lp-seg-item.is-on { background: var(--lp-press); box-shadow: 0 0 0 1px var(--lp-line-strong); }
.lp-seg-count { font-size: 12px; color: var(--lp-ink-3); font-weight: 400; font-variant-numeric: tabular-nums; }
.lp-seg-opt input:focus-visible + span { outline: 2px solid var(--lp-focus); outline-offset: 1px; }
.lp-toggles { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-toggle {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: var(--lp-radius-ctl);
  border: 1px solid var(--lp-line-strong); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}
.lp-toggle:hover { background: var(--lp-hover); }
.lp-toggle-on, .lp-toggle-on:hover { background: var(--lp-accent); color: var(--lp-on-accent); border-color: transparent; }
.lp-toggle-badge { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--lp-on-accent); color: var(--lp-accent); font-size: 12px; line-height: 18px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
.lp-switch { display: inline-flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: var(--lp-ink); font-size: 13px; font-weight: 500; line-height: 22px; cursor: pointer; text-align: left; }
.lp-switch:disabled { cursor: progress; opacity: .7; }
.lp-switch-track { position: relative; width: 36px; height: 20px; flex: none; border-radius: 10px; background: var(--lp-line-strong); transition: background-color .2s ease; }
.lp-switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--lp-layer); box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .2s ease; }
.lp-switch-on .lp-switch-track { background: var(--lp-accent); }
/* the thumb contrasts with the track in both themes (the dark accent is near white) */
.lp-switch-on .lp-switch-thumb { background: var(--lp-on-accent); }
.lp-switch-on .lp-switch-thumb { transform: translateX(16px); }
.lp-switch-label { min-width: 0; }

/* --- callouts, notices, empty states, errors --------------------------------------------- */
.lp-callout { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--lp-well); font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-callout > .lp-icon { margin-top: 2px; color: var(--lp-ink-3); }
.lp-callout-body { display: grid; gap: 4px; min-width: 0; flex: 1; }
.lp-callout-title { font-size: 13px; line-height: 20px; font-weight: 600; }
.lp-callout-info > .lp-icon { color: var(--lp-ink-3); }
.lp-callout-warn { background: var(--lp-warn-wash); }
.lp-callout-warn > .lp-icon { color: var(--lp-warn-ink); }
.lp-callout-good { background: var(--lp-good-wash); }
.lp-callout-good > .lp-icon { color: var(--lp-good-ink); }
.lp-callout-bad { background: var(--lp-bad-wash); }
.lp-callout-bad > .lp-icon { color: var(--lp-bad-ink); }
.lp-empty { display: grid; justify-items: start; gap: 4px; padding: 8px 0; }
.lp-empty > .lp-icon { color: var(--lp-ink-3); margin-bottom: 4px; }
.lp-empty-title { font-size: 14px; line-height: 22px; font-weight: 500; }
.lp-empty .lp-muted, .lp-empty-text { font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-empty > .lp-linkbtn, .lp-empty > button { margin-top: 8px; }
.lp-loaderror { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--lp-ink); font-size: 13px; line-height: 20px; }
.lp-loaderror > .lp-icon { color: var(--lp-warn-ink); }
.lp-loaderror-text { flex: 1; min-width: 200px; }
.lp-loaderror-compact { padding: 8px 12px; border-radius: 10px; background: var(--lp-warn-wash); }
.lp-partial { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 20px; }
.lp-partial .lp-icon { margin-top: 2px; color: var(--lp-warn-ink); }
.lp-blocker { font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-blocker-bad { color: var(--lp-bad-ink); }
.lp-notice-slot { position: sticky; top: 8px; z-index: 5; height: 0; display: flex; justify-content: center; pointer-events: none; }
.lp-notice {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; max-width: min(560px, 100%); padding: 6px 6px 6px 12px;
  border-radius: 10px; background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); font-size: 13px; line-height: 20px; animation: lp-fade .2s ease both;
}
.lp-onb .lp-notice { margin-top: 12px; box-shadow: 0 0 0 1px var(--lp-line); }
.lp-notice > .lp-icon { color: var(--lp-ink-3); }
.lp-notice-good > .lp-icon { color: var(--lp-good-ink); }
.lp-notice-bad > .lp-icon { color: var(--lp-bad-ink); }
.lp-skeleton { border-radius: var(--lp-radius-ctl); background: var(--lp-skeleton); animation: lp-pulse 1.6s ease-in-out infinite; }
.lp-loading { display: grid; gap: 12px; }
.lp-failed { display: grid; gap: 12px; justify-items: start; }

/* --- ⓘ and disclosure ------------------------------------------------------------------------- */
.lp-info-wrap { position: relative; display: inline-flex; vertical-align: middle; }
.lp-info-btn { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--lp-ink-3); cursor: pointer; }
.lp-info-btn:hover, .lp-info-btn[aria-expanded="true"] { color: var(--lp-ink); background: var(--lp-hover); }
.lp-info-pop {
  position: absolute; top: calc(100% + 6px); z-index: 20; width: min(300px, 80vw); padding: 10px 12px; border-radius: 10px;
  background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400;
  text-align: left; white-space: normal; display: grid; gap: 6px; animation: lp-fade .15s ease both;
}
.lp-info-start { left: -8px; }
.lp-info-end { right: -8px; }
.lp-info-line { display: block; }
@container lp-root (max-width: 480px) { .lp-info-pop { position: fixed; left: 12px; right: 12px; top: auto; width: auto; max-width: none; margin-top: 28px; } }
.lp details > summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; width: fit-content; color: var(--lp-ink-2); font-size: 13px; line-height: 20px; }
.lp details > summary::-webkit-details-marker { display: none; }
.lp details > summary::before { content: ""; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .15s ease; margin-right: 2px; }
.lp details[open] > summary::before { transform: rotate(45deg); }
.lp details > summary:hover { color: var(--lp-ink); }
.lp details[open] > summary { margin-bottom: 12px; }

/* --- progress ----------------------------------------------------------------------------------- */
.lp-bar { position: relative; height: 6px; border-radius: 3px; background: var(--lp-line); overflow: hidden; }
.lp-bar > span { display: block; height: 100%; border-radius: 3px; background: var(--lp-accent); transition: width .3s ease; }
.lp-progress-steps { list-style: none; margin: 0; padding: 0; display: grid; }
.lp-progress-step { position: relative; display: flex; align-items: center; gap: 12px; min-height: 32px; font-size: 13px; line-height: 20px; color: var(--lp-ink-3); }
.lp-progress-step::before { content: ""; position: absolute; left: 7.5px; top: 24px; bottom: -8px; width: 1px; background: var(--lp-line-strong); }
.lp-progress-step:last-child::before { display: none; }
.lp-progress-dot { position: relative; z-index: 1; width: 16px; height: 16px; flex: none; border-radius: 50%; border: 1.5px solid var(--lp-line-strong); background: var(--lp-layer); display: inline-flex; align-items: center; justify-content: center; color: var(--lp-on-accent); }
.lp-progress-step.is-done { color: var(--lp-ink-2); }
.lp-progress-step.is-done .lp-progress-dot { background: var(--lp-accent); border-color: var(--lp-accent); }
.lp-progress-step.is-now { color: var(--lp-ink); font-weight: 500; }
.lp-progress-step.is-now .lp-progress-dot { border: 2px solid var(--lp-accent); border-right-color: transparent; animation: lp-spin 1s linear infinite; }

/* --- onboarding stepper and upload ------------------------------------------------------------- */
.lp-stepper { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 20px; padding: 0; list-style: none; }
.lp-stepper-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; line-height: 20px; color: var(--lp-ink-3); }
.lp-stepper-item + .lp-stepper-item::before { content: ""; width: 24px; height: 1px; background: var(--lp-line); margin-right: 2px; }
.lp-stepper-dot { width: 20px; height: 20px; flex: none; border-radius: 50%; border: 1px solid var(--lp-line-strong); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-stepper-item.is-now { color: var(--lp-ink); font-weight: 500; }
.lp-stepper-item.is-now .lp-stepper-dot { background: var(--lp-accent); border-color: var(--lp-accent); color: var(--lp-on-accent); }
.lp-stepper-item.is-done .lp-stepper-dot { background: var(--lp-accent); border-color: var(--lp-accent); color: var(--lp-on-accent); }
.lp-upload-simple { display: grid; justify-items: center; gap: 8px; padding: 24px; border: 1px dashed var(--lp-line-strong); border-radius: var(--lp-radius-card); text-align: center; }
.lp-upload-simple .lp-upload-status { max-width: 36em; }
.lp-upload-simple .lp-form-error { max-width: 36em; }

/* --- motion and overflow safety -------------------------------------------------------------- */
.lp-spin { animation: lp-spin 1s linear infinite; }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lp-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes lp-pulse { 50% { opacity: .45; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
.lp-card p, .lp-muted, .lp-caption, .lp-callout, .lp-row-main { overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) {
  .lp *, .lp *::before, .lp *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`,
			`
/* --- header: kicker → h1 → one meta line; one 32px control row on the right ------------------- */
.lp-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 16px; }
.lp-header-text { display: grid; gap: 4px; min-width: 0; }
.lp-header-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-header-sep { color: var(--lp-ink-4); }
.lp-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; flex: none; max-width: 100%; }
.lp-header-end { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-healthchat-btn { flex: none; }
.lp-healthchat { display: inline-flex; align-items: center; gap: 8px; }
@container lp-root (max-width: 760px) {
  .lp-header { flex-direction: column; align-items: stretch; gap: 20px; }
  .lp-header-actions { width: 100%; justify-content: space-between; }
}

/* --- people picker ------------------------------------------------------------------------------- */
.lp-people { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.lp-people-select { min-width: 120px; max-width: 220px; }
.lp-people-error { flex-basis: 100%; text-align: right; }
.lp-people-notice { margin-bottom: 16px; }
/* The add-family dialog renders outside the page, so container queries do not reach it: size it here. */
.lp-people-modal.lp-people-modal, div:has(> .lp-people-dialog.lp-people-dialog) { width: min(560px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-people-dialog { display: grid; gap: 16px; max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px; }
.lp-people-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.lp-people-dialog .lp-modal-actions { margin-top: 8px; }
/* 性别: a visible 36px track like the inputs beside it, each option a full-height button, so it reads as a control
   with nothing picked (R2-P2-10). */
.lp-people-dialog .lp-seg { display: flex; width: 100%; height: 36px; padding: 2px; gap: 4px; border: 1px solid var(--lp-line-strong); }
.lp-people-dialog .lp-seg-opt { flex: 1; }
.lp-people-dialog .lp-seg-opt span { width: 100%; height: 30px; color: var(--lp-ink); }
.lp-people-dialog .lp-seg-opt:hover span { background: var(--lp-hover); }
.lp-people-dialog .lp-seg-on span, .lp-people-dialog .lp-seg-on:hover span { background: var(--lp-layer); font-weight: 600; }
@media (max-width: 480px) { .lp-people-dialog { padding: 20px; } .lp-people-dialog .lp-form-grid { grid-template-columns: minmax(0, 1fr); } }

/* --- banners under the header: well, 40px, 12px radius ------------------------------------------- */
.lp-banner, .lp-season-bar {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; margin: 0 0 16px; padding: 8px 16px; border: 0;
  border-radius: var(--lp-radius-card); background: var(--lp-well); color: var(--lp-ink); font: inherit; font-size: 13px; line-height: 20px;
  text-align: left; cursor: pointer; transition: background-color .15s ease;
}
.lp-banner:hover, .lp-season-bar:hover { background: var(--lp-hover); }
.lp-banner > .lp-icon { color: var(--lp-ink-3); }
.lp-banner-text { flex: 1; min-width: 0; }
.lp-banner-go { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--lp-ink-2); white-space: nowrap; }

/* --- tabs: primary tabs, a temporary tab for a secondary page, 更多 at the right end ------------- */
.lp-tabbar { display: flex; align-items: flex-end; gap: 4px; margin: 8px 0 24px; border-bottom: 1px solid var(--lp-line); }
.lp-tabs { display: flex; gap: 4px; flex: 0 1 auto; min-width: 0; margin-bottom: -1px; overflow-x: auto; scrollbar-width: none; }
.lp-tabs::-webkit-scrollbar { display: none; }
.lp-tab {
  position: relative; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 0; background: transparent;
  color: var(--lp-ink-2); font-size: 14px; line-height: 22px; font-weight: 400; cursor: pointer; white-space: nowrap; transition: color .15s ease;
}
.lp-tab:hover { color: var(--lp-ink); }
.lp-tab-on { color: var(--lp-ink); font-weight: 600; }
.lp-tab-on::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; border-radius: 1px; background: var(--lp-accent); }
/* the first tab's text lines up with the page's left edge */
.lp-tab:first-child { padding-left: 0; }
.lp-tab:first-child.lp-tab-on::after { left: 0; }
.lp-tab-badge { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 4px; background: var(--lp-well); color: var(--lp-ink-2); font-size: 12px; line-height: 18px; font-weight: 400; text-align: center; }
.lp-tab-close { width: 24px; height: 24px; margin: 0 0 8px -8px; }
.lp-more { position: relative; margin: 0 0 4px auto; flex: none; }
.lp-more-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 8px 0 12px; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink-2); font-size: 14px; line-height: 22px; cursor: pointer;
}
.lp-more-btn:hover, .lp-more-btn[aria-expanded="true"] { background: var(--lp-hover); color: var(--lp-ink); }
.lp-more-btn .lp-icon { transform: rotate(90deg); color: var(--lp-ink-3); }
.lp-more-pop {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; display: grid; gap: 0; min-width: 160px; padding: 4px;
  border-radius: var(--lp-radius-card); background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); animation: lp-fade .15s ease both;
}
.lp-more-pop .lp-row-btn { border: 0; min-height: 36px; padding: 8px 12px; }
.lp-more-pop .lp-row-btn[aria-current="page"] { font-weight: 600; }

/* --- tab body and footer --------------------------------------------------------------------------- */
.lp-tab-body { display: grid; gap: 12px; min-width: 0; }
/* Sections sit 32px apart: the grid's 12px plus 20px. */
.lp-tab-body > .lp-section + .lp-section { margin-top: 20px; }
.lp-footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--lp-line); }
.lp-footer .lp-caption { max-width: none; }
`,
			`
/* --- results: a .lp-grid-2 of cards; title row = title + ⓘ, tags on the next line ---------------- */
.lp-results { align-items: stretch; }
.lp-results-plan:empty { display: none; }
/* 这次的变化 (feedback/feedback-card.ts): the first row starts under the title, every line at the same measure. */
.lp-results-plan .lp-rows > .lp-row:first-child { padding-top: 0; }
.lp-results-plan .lp-row-stack > p { max-width: 40em; overflow-wrap: break-word; }
.lp-results-plan .lp-row-stack > p:not(.lp-caption) { font-size: 14px; line-height: 22px; }
/* Rows with a leading icon: add-ons, and what can be done now in onboarding. */
.lp-row-wrap { flex-wrap: wrap; justify-content: flex-start; }
.lp-row-icon { color: var(--lp-ink-3); }
.lp-now-main .lp-inline-self { margin-top: 8px; }
.lp-result { display: flex; flex-direction: column; }
.lp-result-figure { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.lp-result-figure .lp-badge { align-self: center; }
.lp-result-wait { font-size: 17px; line-height: 24px; font-weight: 600; }
.lp-result-goal { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-result-foot { display: grid; gap: 12px; justify-items: start; padding-top: 12px; }
.lp-result-action { padding-top: 4px; }
/* Pinned to the card's floor, so side-by-side cards end on one line; .lp beats base's card spacing. */
.lp .lp-card > .lp-result-foot, .lp .lp-card > .lp-result-action, .lp .lp-card > .lp-result-note { margin-top: auto; }
.lp .lp-card > .lp-result-note { padding-top: 12px; }
.lp-result-title.lp-result-title { display: block; }
.lp-result-title .lp-info-wrap { vertical-align: -4px; }
.lp-result-self { display: grid; gap: 8px; width: 100%; }
.lp-result-needs .lp-tag { height: auto; min-height: 20px; white-space: normal; }
.lp-bignum-unit { font-size: 14px; line-height: 20px; font-weight: 400; color: var(--lp-ink-2); letter-spacing: 0; }
.lp-method-sentence { overflow-wrap: anywhere; }
.lp-method-evidence { grid-column: 1 / -1; }
.lp-bioage-gap { margin: 0; }
.lp-key-trends { display: grid; gap: 4px; }
.lp-key-trends ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px; line-height: 20px; }

/* --- record changes beyond normal fluctuation ---------------------------------------------------- */
.lp-notable { scroll-margin-top: 24px; }
.lp-notable-list { list-style: none; margin: 0; padding: 0; }
.lp-notable-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 140px; align-items: center; gap: 12px; min-height: 44px; padding: 8px 0; border-top: 1px solid var(--lp-line); font-size: 13px; line-height: 20px; }
.lp-notable-row:first-child { border-top: 0; }
@container lp-root (max-width: 640px) { .lp-notable-row { grid-template-columns: auto minmax(0, 1fr) auto; } .lp-notable-row .lp-change-spark { display: none; } }
/* Narrow screens: the verdict on its own line, then the marker name and its values, so a long name is never a one-character column. */
@container lp-root (max-width: 480px) { .lp-notable-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; column-gap: 8px; } .lp-notable-row > .lp-badge { grid-column: 1 / -1; justify-self: start; } .lp-notable-values { white-space: normal; text-align: right; } }
.lp-notable-values { white-space: nowrap; color: var(--lp-ink-2); }
.lp-change-spark { min-width: 0; }
.lp-basis { min-width: 0; }
.lp-change-notes { display: grid; gap: 4px; }
.lp-change-source a { color: var(--lp-ink-2); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.lp-change-source a:hover { color: var(--lp-ink); }

/* --- first-run steps ------------------------------------------------------------------------------ */
.lp-step-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.lp-step-body > .lp-form-actions { margin-top: 0; }
.lp-consent { display: grid; gap: 12px; }
.lp-consent-row { display: flex; gap: 12px; align-items: flex-start; }
.lp-consent-row p { color: var(--lp-ink); }
.lp-consent-icon { width: 24px; height: 24px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); }
.lp-first { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 480px) { .lp-first { grid-template-columns: minmax(0, 1fr); } }
.lp-first-cell { display: grid; gap: 4px; align-content: start; padding: 12px 16px; border-radius: var(--lp-radius-card); background: var(--lp-well); min-width: 0; }
.lp-first-wait { font-size: 17px; line-height: 24px; font-weight: 600; }
.lp-first-figure { font-size: 24px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-first-figure .lp-bignum-unit { margin-left: 4px; }
.lp-first-caveat { color: var(--lp-warn-ink); }

/* --- check-ins: three answers, outlined; the answer as a badge ------------------------------------ */
.lp-choices { display: inline-flex; align-items: center; gap: 8px; flex: none; }
.lp-choice {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 12px; border-radius: var(--lp-radius-ctl);
  border: 1px solid var(--lp-line-strong); background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap;
  transition: background-color .15s ease;
}
.lp-choice:hover:not(:disabled) { background: var(--lp-hover); }
.lp-choice:disabled { cursor: progress; opacity: .6; }
.lp-choice-done .lp-icon { color: var(--lp-ink-2); }
.lp-choice-undo { border-color: transparent; color: var(--lp-ink-3); padding: 0 8px; }
.lp-choice-undo:hover:not(:disabled) { color: var(--lp-ink); }

/* --- 总览: today, the week, next step -------------------------------------------------------------- */
.lp-week { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--lp-line); }
.lp-week-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-week-cells { list-style: none; display: inline-flex; gap: 4px; margin: 0; padding: 0; }
.lp-week-cell { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-well); }
.lp-week-day { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-week-done { background: var(--lp-accent); }
.lp-week-done .lp-week-day { color: var(--lp-on-accent); }
.lp-week-part { background: var(--lp-band); }
.lp-week-part .lp-week-day { color: var(--lp-ink); }
.lp-week-missed { background: var(--lp-warn-wash); }
.lp-week-missed .lp-week-day { color: var(--lp-warn-ink); }
.lp-next-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.lp .lp-card.lp-next-card > * + * { margin-top: 0; }
.lp-next-text { display: grid; gap: 4px; min-width: 0; flex: 1; }
`,
			`
/* --- charts: --lp-data is the only data color, --lp-band the noise band ------------------------ */
.lp-chart { position: relative; width: 100%; }
.lp-chart svg { display: block; overflow: visible; }
.lp-chart svg:focus { outline: none; }
.lp-chart svg:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 4px; border-radius: 4px; }
.lp-chart-single { display: grid; gap: 4px; padding: 8px 0; }
.lp-chart-empty { color: var(--lp-ink-3); font-size: 13px; line-height: 20px; padding: 24px 0; }
.lp-grid { stroke: var(--lp-line); stroke-width: 1; }
.lp-axis { fill: var(--lp-ink-3); font-size: 12px; }
.lp-line { fill: none; stroke: var(--lp-data); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.lp-area { fill: var(--lp-data-wash); stroke: none; }
.lp-dot { fill: var(--lp-data); stroke: var(--lp-layer); stroke-width: 2; transition: r .15s ease; }
.lp-band { fill: var(--lp-band); }
.lp-goal { stroke: var(--lp-ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
.lp-goal-text { fill: var(--lp-ink-2); font-size: 12px; }
.lp-ref { stroke: var(--lp-line-strong); stroke-width: 1; }
.lp-cross { stroke: var(--lp-line-strong); stroke-width: 1; }
.lp-end { fill: var(--lp-ink); font-size: 12px; font-weight: 500; }
.lp-cbar { fill: var(--lp-data); }
.lp-cbar-muted { fill: var(--lp-line-strong); }
.lp-cbar-ahead { fill: var(--lp-data-wash); }
.lp-hit { fill: transparent; }
.lp-row-label { fill: var(--lp-ink); font-size: 13px; }
.lp-checkup { stroke: var(--lp-line); stroke-width: 1; }
.lp-checkup-dot { fill: var(--lp-ink-3); stroke: var(--lp-layer); stroke-width: 2; }
.lp-today { stroke: var(--lp-ink-3); stroke-width: 1; }
.lp-timeline { display: grid; gap: 8px; }
.lp-legend-inline { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-key-bar { width: 16px; height: 6px; border-radius: 3px; background: var(--lp-data); display: inline-block; }
.lp-key-ahead { width: 16px; height: 6px; margin-left: 8px; border-radius: 3px; background: var(--lp-data-wash); display: inline-block; }
.lp-key-dot { width: 8px; height: 8px; margin-left: 8px; border-radius: 50%; background: var(--lp-ink-3); display: inline-block; }
.lp-tip {
  position: absolute; z-index: 5; min-width: 120px; max-width: 220px; padding: 8px 12px; border-radius: 8px; background: var(--lp-layer-2);
  box-shadow: var(--lp-shadow-pop); font-size: 12px; line-height: 18px; pointer-events: none; transform: translateY(-100%);
}
.lp-tip-title { color: var(--lp-ink-3); }
.lp-tip-row { display: flex; flex-direction: column; }
.lp-tip-value { color: var(--lp-ink); font-weight: 500; font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums; }
.lp-tip-label { color: var(--lp-ink-2); }
.lp-strip { position: relative; flex: none; }
.lp-cell-done { fill: var(--lp-data); }
.lp-cell-missed { fill: var(--lp-line-strong); }
.lp-cell-unknown { fill: var(--lp-line); }
.lp-twin { margin-top: 8px; font-size: 12px; line-height: 18px; }
.lp-twin table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.lp-twin caption { text-align: left; color: var(--lp-ink-3); padding-bottom: 4px; }
.lp-twin th, .lp-twin td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--lp-line); }
.lp-twin th { color: var(--lp-ink-3); font-weight: 400; }
.lp-spark { display: block; overflow: visible; }
.lp-spark-line { fill: none; stroke: var(--lp-data); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.lp-spark-dot { fill: var(--lp-data); }

/* --- 化验 / 睡眠 / 运动: one table, header and rows share --lp-ind-cols --------------------------- */
.lp-ind-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-ind-meta { display: inline-flex; align-items: center; gap: 4px; }
.lp-ind-card {
  --lp-ind-cols: minmax(0, 1.6fr) 136px 112px 88px minmax(104px, 1fr) 32px 16px;
  padding-top: 8px; padding-bottom: 8px;
}
/* no row in view has a judgement: the 「和正常波动比」 column is left out */
.lp-ind-nojudge { --lp-ind-cols: minmax(0, 1.6fr) 136px 112px 88px 32px 16px; }
.lp-ind-nojudge .lp-ind-judged, .lp-ind-nojudge .lp-ind-head-judged { display: none; }
/* every row in view has the same source: the 「来源」 column is left out */
.lp-ind-nosource { --lp-ind-cols: minmax(0, 1.6fr) 136px 112px 88px minmax(104px, 1fr) 16px; }
.lp-ind-nojudge.lp-ind-nosource { --lp-ind-cols: minmax(0, 1.6fr) 136px 112px 88px 16px; }
.lp-ind-nosource .lp-ind-source { display: none; }
.lp-ind-head { display: grid; grid-template-columns: var(--lp-ind-cols); align-items: center; column-gap: 12px; padding: 8px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); border-bottom: 1px solid var(--lp-line); }
.lp-ind-card > .lp-ind-group { margin-top: 4px; }
.lp-ind-group-title { margin: 0; padding: 12px 8px 4px; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--lp-ink-3); }
.lp-ind-group-title .lp-optional { margin-left: 8px; }
.lp-ind-list { list-style: none; margin: 0; padding: 0; }
.lp-ind-row + .lp-ind-row { border-top: 1px solid var(--lp-line); }
.lp-ind-btn {
  display: grid; grid-template-columns: var(--lp-ind-cols); align-items: center; column-gap: 12px;
  width: 100%; min-height: 48px; padding: 8px; margin: 0; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink); font: inherit; font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-ind-btn:hover, .lp-ind-open .lp-ind-btn { background: var(--lp-hover); }
.lp-ind-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lp-ind-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.lp-ind-value { display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 6px; align-items: baseline; min-width: 0; white-space: nowrap; }
.lp-ind-num { text-align: right; font-variant-numeric: tabular-nums; }
.lp-ind-row .lp-ind-num { font-weight: 500; }
.lp-ind-unit { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--lp-ink-2); }
.lp-ind-value > .lp-ind-error { grid-column: 1 / -1; }
.lp-ind-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.lp-ind-error { display: inline-flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-ind-judged { display: flex; align-items: center; min-width: 0; }
.lp-ind-source { color: var(--lp-ink-2); white-space: nowrap; }
.lp-ind-chevron { color: var(--lp-ink-3); transition: transform .15s ease; }
.lp-ind-open .lp-ind-chevron { transform: rotate(90deg); }
@container lp-root (max-width: 760px) {
  .lp-ind-head, .lp-ind-spark { display: none; }
  .lp-ind-btn { grid-template-columns: auto minmax(0, 1fr) auto 16px; grid-template-areas: "name name judged chev" "value date judged chev"; row-gap: 4px; }
  .lp-ind-name { grid-area: name; }
  .lp-ind-judged { grid-area: judged; justify-content: flex-end; align-self: center; }
  .lp-ind-value { grid-area: value; display: flex; gap: 4px; }
  .lp-ind-date { grid-area: date; }
  .lp-ind-source { display: none; }
  .lp-ind-chevron { grid-area: chev; align-self: center; }
}
.lp-ind-panel { padding: 4px 0 16px; }
.lp-ind-detail { display: grid; gap: 12px; padding: 12px 16px; border-radius: var(--lp-radius-card); background: var(--lp-well); }
.lp-ind-detail a { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.lp-ind-skeleton { margin: 12px 0; }

/* --- 日程 / 问 LongPi ------------------------------------------------------------------------- */
.lp-ask-list { list-style: none; margin: 0; padding: 0; }
.lp-ask-list > li + li { border-top: 1px solid var(--lp-line); }
.lp-ask-btn {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 10px 8px; margin: 0; border: 0;
  border-radius: var(--lp-radius-ctl); background: transparent; color: var(--lp-ink); font: inherit; font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.lp-ask-btn:hover { background: var(--lp-hover); }
.lp-ask-btn > .lp-icon { margin-left: auto; color: var(--lp-ink-3); }
.lp-cal-row { flex-wrap: wrap; }
.lp-cal-line { align-items: baseline; justify-content: flex-start; }
.lp-cal-date { flex: none; width: 128px; font-size: 13px; line-height: 20px; color: var(--lp-ink-3); font-variant-numeric: tabular-nums; }
.lp-cal-actions { display: flex; align-items: center; gap: 8px; flex: none; }

/* --- shared with engage/season-tab.ts and results.ts (look of .lp-row-btn) -------------------- */
`,
			`
/* --- shared with other screens (icons.ts VerdictChip, charts.ts Ring, triage care card) --- */
.lp-ring { flex: none; }
.lp-ring-track { fill: none; stroke: var(--lp-line); }
.lp-ring-fill { fill: none; stroke: var(--lp-accent); stroke-linecap: round; transition: stroke-dasharray .8s ease; }

/* --- today's check-ins (also inside the overview's today card) --------------------------------- */
.lp-today-list { list-style: none; margin: 0; padding: 0; display: grid; }
.lp-today-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 8px 0; border-top: 1px solid var(--lp-line); }
.lp-today-row:first-child { border-top: 0; }
.lp-today-title { min-width: 0; font-size: 14px; line-height: 22px; font-weight: 400; }
.lp-today-done .lp-today-title, .lp-today-missed .lp-today-title { color: var(--lp-ink-2); }

/* --- 方案 -------------------------------------------------------------------------------------- */
.lp-plan-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.lp-plan-tile-today { grid-column: 1 / -1; }
@container lp-root (max-width: 720px) { .lp-plan-tiles { grid-template-columns: minmax(0, 1fr); } }
/* cards are top-aligned and keep their own height; the grow wrapper only spaces the body */
.lp-plan-grow { display: grid; gap: 12px; align-content: start; min-width: 0; }
.lp-plan-figure-row { display: flex; align-items: center; gap: 16px; }
.lp-plan-streak { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; line-height: 20px; font-weight: 500; }
.lp-plan-streak .lp-icon { color: var(--lp-warn-ink); }
.lp-plan-win { display: flex; align-items: flex-start; gap: 12px; }
.lp-plan-win-icon { width: 28px; height: 28px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-good-wash); color: var(--lp-good-ink); }
.lp-plan-win-text { display: grid; gap: 2px; min-width: 0; }
.lp-plan-row { align-items: flex-start; padding: 12px 0; }
.lp-plan-row-main { display: grid; gap: 6px; }
.lp-plan-row-title { font-size: 14px; line-height: 22px; font-weight: 500; color: var(--lp-ink); }
.lp-today-done .lp-plan-row-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-plan-row-end { flex: none; display: flex; align-items: center; min-height: 22px; }
@container lp-root (max-width: 560px) { .lp-plan-row { flex-direction: column; } }
.lp-plan-verdict { display: grid; gap: 4px; }
.lp-plan-verdict-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; }
.lp-plan-verdict details > summary { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-plan-verdict details[open] > summary { margin-bottom: 4px; }
.lp-plan-chart { margin: 0; }
/* one reading measure for body text in these cards (spec: 40em at 14px) */
.lp-measure { max-width: 560px; }
.lp-plan-aside { display: inline-flex; align-items: center; gap: 4px; }
.lp-plan-model-figures { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.lp-plan-model-figures > .lp-icon { margin-bottom: 8px; color: var(--lp-ink-3); }
.lp-plan-model-figure { display: grid; gap: 4px; justify-items: start; }
.lp-plan-step .lp-row-main { color: var(--lp-ink); }

/* --- 方案草稿 and the adoption dialog (page and chat card) ------------------------------------------- */
.lp-draft-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-draft-item { display: grid; gap: 8px; min-width: 0; padding: 12px 16px; border: 1px solid var(--lp-line); border-radius: var(--lp-radius-ctl); }
.lp-draft-item-compact { padding: 12px; gap: 4px; }
.lp-draft-item-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.lp-draft-item-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; font-size: 14px; line-height: 22px; font-weight: 500; }
.lp-draft-item-head > .lp-textbtn { flex: none; height: 22px; }
.lp-draft-detail { font-size: 14px; line-height: 22px; }
.lp-draft-evidence { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-draft-evidence .lp-icon { margin-top: 4px; color: var(--lp-ink-3); }
.lp-draft-item a, .lp-draft a { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.lp-draft-item details > summary { font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-draft-item details[open] > summary { margin-bottom: 4px; }
.lp-draft-item details .lp-caption + .lp-caption { margin-top: 4px; }
.lp-draft-block { display: grid; gap: 12px; min-width: 0; }
.lp-draft-removed { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.lp-draft-removed .lp-toggle { height: 28px; font-size: 12px; color: var(--lp-ink-2); }
.lp-draft-priorities { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.lp-draft-priority { display: grid; gap: 4px; padding: 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); min-width: 0; }
.lp-draft-priority-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 13px; line-height: 20px; }
.lp-row-lines { display: grid; gap: 2px; }
.lp-draft-hint { display: inline-flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
.lp-draft-hint .lp-textbtn { font-size: 12px; line-height: 18px; }
.lp-draft-actions { gap: 16px; }
.lp-confirm-dialog.lp-confirm-dialog, div:has(> .lp-confirm.lp-confirm) { width: min(520px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-confirm { padding: 24px; display: grid; gap: 12px; max-height: calc(100vh - 48px); overflow-y: auto; }
.lp-confirm .lp-modal-actions { margin-top: 12px; }
.lp-confirm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.lp-confirm-list li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 40px; padding: 8px 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); font-size: 13px; line-height: 20px; }
.lp-confirm-list .lp-badge { margin-left: auto; }

/* --- 档案: profile editor, self measurements ------------------------------------------------------ */
.lp-profile { container: lp-form / inline-size; display: grid; gap: 20px; }
.lp-profile > .lp-form-actions { margin-top: 0; }
.lp-profile > .lp-modal-actions { margin-top: 4px; }
.lp-profile-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.lp-profile-side > .lp-card:last-child { flex: 1 1 auto; }
.lp-profile-group { display: grid; gap: 8px; }
.lp-profile-basics { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 24px; }
.lp-profile-age { width: 160px; }
/* the sex segment matches the 36px age input next to it */
.lp .lp-profile-basics .lp-seg-opt span { height: 32px; }
.lp-unlock { display: flex; align-items: center; gap: 4px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
.lp-facts { border: 0; margin: 0; padding: 0; min-width: 0; }
.lp-facts-legend { display: grid; gap: 2px; padding: 0; margin-bottom: 4px; }
.lp-fact { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 0; border-top: 1px solid var(--lp-line); }
.lp-facts-legend + .lp-fact { border-top: 0; }
.lp-fact-text { display: grid; gap: 2px; min-width: 0; }
.lp-fact-label { font-size: 14px; line-height: 22px; }
@container lp-form (max-width: 420px) { .lp-fact { flex-direction: column; align-items: flex-start; gap: 8px; } }
.lp-profile-focus { display: grid; gap: 8px; }
.lp-self-latest { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.lp-self-latest li { display: grid; gap: 2px; min-width: 120px; padding: 8px 12px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-self-value { font-size: 17px; line-height: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-self-form { container: lp-form / inline-size; display: grid; gap: 16px; }
.lp-self-form > .lp-form-actions { margin-top: 0; }
.lp-self-unit { width: auto; flex: none; }
.lp-bp { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-bp .lp-input { width: 104px; }
.lp-bp-slash { color: var(--lp-ink-3); }
.lp-inline-self { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-inline-self .lp-input { width: 96px; height: 32px; font-size: 13px; }
.lp-inline-self .lp-select { height: 32px; font-size: 13px; width: auto; }
.lp-search { display: flex; gap: 8px; align-items: center; }
.lp-search > button { flex: none; white-space: nowrap; }

/* --- 赛季 ------------------------------------------------------------------------------------------- */
.lp-season-card { display: grid; gap: 4px; }
.lp-season-quests { display: grid; gap: 8px; }
.lp-season-quests .lp-row-btn:disabled { cursor: progress; opacity: .6; }

/* --- 这次的变化 (feedback card): one size, colour and measure; the first line is only a little heavier */
.lp-fb-lead { font-weight: 500; }

/* --- 研究 ------------------------------------------------------------------------------------------- */
.lp-sci-q { border: 0; margin: 0; padding: 0; min-width: 0; }
.lp-sci-q legend { padding: 0; margin-bottom: 8px; }
/* question groups read as separate blocks: 24px between groups and above the first one */
.lp .lp-card > .lp-sci-q { margin-top: 24px; }
.lp .lp-card > .lp-sci-q + .lp-actions { margin-top: 24px; }
.lp-sci-options { display: grid; gap: 8px; }
.lp-sci-options .lp-check { align-items: center; }
.lp-sci-options .lp-check input { margin-top: 0; }
.lp-sci-count { margin-left: auto; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); font-variant-numeric: tabular-nums; }
`,
			`
/* cards that are mostly prose: every text block shares one line length (40em at 14px) */
.lp-an-prose > .lp-callout, .lp-an-prose > details, .lp-an-prose > .lp-an-next { max-width: 560px; }

/* report summary: four counts in a row, then the headline readouts (.lp-kv) */
.lp-an-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
@container lp-root (max-width: 560px) { .lp-an-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.lp-an-fact { display: grid; gap: 4px; min-width: 0; padding: 12px 16px; border-radius: var(--lp-radius-ctl); background: var(--lp-well); }
.lp-an-fact dt { margin: 0; }
.lp-an-fact-value { display: flex; align-items: baseline; gap: 4px; margin: 0; color: var(--lp-ink); }

/* organ table: value first, the estimate's range on a 12px line under it */
.lp-an-organs .lp-an-organ { white-space: nowrap; }
/* measurements 42% : age 7em : risks 40% — wide enough that the longest disease name stays on one line */
.lp-an-organs th:nth-child(2) { width: 42%; }
.lp-an-organs th:nth-child(3) { width: 7em; }
.lp-an-organs th:nth-child(4) { width: 40%; white-space: normal; }
.lp-an-valtext { color: var(--lp-ink); }
.lp-an-note { display: block; }
.lp-an-narrow-note { display: none; }
.lp-card > .lp-an-narrow-note + .lp-table-wrap { margin-top: 0; }
.lp-an-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lp-an-est { display: grid; gap: 2px; }
.lp-an-val { white-space: nowrap; color: var(--lp-ink); }

/* ≤760px: one block per organ (organ → measurements → age → risks) instead of a squeezed table */
@container lp-root (max-width: 760px) {
  .lp-table.lp-an-organs, .lp-an-organs tbody, .lp-an-organs tr, .lp-an-organs td { display: block; width: auto; }
  .lp-an-organs thead { display: none; }
  .lp-card > .lp-an-narrow-note { display: block; }
  .lp-card > .lp-an-narrow-note + .lp-table-wrap { margin-top: 12px; }
  .lp-an-organs tr { padding: 12px 0; border-bottom: 1px solid var(--lp-line); }
  .lp-an-organs tr:first-child { padding-top: 0; }
  .lp-an-organs tr:last-child { padding-bottom: 0; border-bottom: 0; }
  .lp-table.lp-an-organs td { padding: 0; border: 0; }
  .lp-table.lp-an-organs td + td { margin-top: 8px; }
  .lp-table.lp-an-organs .lp-an-organ { font-size: 14px; line-height: 22px; font-weight: 600; }
  .lp-an-organs td[data-label]::before { content: attr(data-label); display: block; margin-bottom: 4px; font-size: 12px; line-height: 18px; color: var(--lp-ink-3); }
  .lp-table.lp-an-organs td.lp-an-none { display: none; }
}

/* question board and plan */
.lp-an-more { display: grid; gap: 8px; }
.lp-an-next { font-size: 13px; line-height: 20px; color: var(--lp-ink); }

/* a stalled or not-started run: one line instead of eleven empty steps */
.lp-an-fold { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lp-an-bullets { margin: 0; color: var(--lp-ink); }
`,
			`
/* --- the settings section ---------------------------------------------------------------------- */
.lp-settings { container: lp-root / inline-size; display: grid; padding-bottom: 24px; }
.lp-set-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; padding-bottom: 4px; }
.lp-set-block { display: grid; gap: 12px; min-width: 0; padding: 20px 0; border-top: 1px solid var(--lp-line); }
.lp-set-head + .lp-set-block, .lp-notice-slot + .lp-set-block { border-top: 0; padding-top: 16px; }
.lp-set-titles { display: grid; gap: 4px; min-width: 0; }
.lp-set-title { margin: 0; font-size: 15px; line-height: 22px; font-weight: 600; color: var(--lp-ink); }
.lp-set-body { display: grid; gap: 12px; min-width: 0; justify-items: start; }
.lp-set-body > .lp-kv, .lp-set-body > details, .lp-set-body > .lp-conn-status { justify-self: stretch; }
.lp-set-text { font-size: 13px; line-height: 20px; }
.lp-settings :is(p, dd, .lp-bullets), .lp-data :is(p, dd, .lp-bullets) { max-width: 40em; }
.lp-set-kv { gap: 8px 16px; }
.lp-set-kv dd { color: var(--lp-ink-2); }
.lp-set-extra { min-width: 0; }
.lp-set-version { margin: 0; padding-top: 16px; border-top: 1px solid var(--lp-line); }

/* --- 提醒 -------------------------------------------------------------------------------------------- */
.lp-followup-box { display: grid; gap: 12px; min-width: 0; }
.lp-reminder { display: grid; gap: 8px; min-width: 0; }
.lp-reminder-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-reminder .lp-kv { margin-top: 4px; }
.lp-settings .lp-switch { font-size: 13px; line-height: 20px; font-weight: 500; }
.lp-input-time { width: 128px; flex: none; font-variant-numeric: tabular-nums; }
.lp-select-wide { width: auto; min-width: 128px; }

/* the whole form, under 更多设置 */
.lp-followup { display: grid; gap: 16px; min-width: 0; }
.lp-followup > .lp-form-actions { margin-top: 0; }
.lp-followup-head { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid var(--lp-line); }
.lp-followup-grid { gap: 20px 32px; }
.lp-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 12px; align-content: start; }
.lp-followup-legend { padding: 0; margin-bottom: 12px; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--lp-ink); }
.lp-followup-times { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.lp-followup-detail { display: grid; gap: 8px; padding-top: 16px; border-top: 1px solid var(--lp-line); }
.lp-followup-log .lp-subhead { margin-top: 4px; }
.lp-followup-log .lp-row-main .lp-num { color: var(--lp-ink-2); }
.lp-test-result { display: inline-flex; flex-wrap: wrap; gap: 8px; }
.lp-check-off { cursor: default; color: var(--lp-ink-3); }
.lp-check-off input { cursor: default; }
.lp-check-text { display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }

/* --- 数据连接 ------------------------------------------------------------------------------------------ */
.lp-conn { display: grid; gap: 12px; min-width: 0; }
.lp-conn-status { display: grid; gap: 4px; min-width: 0; }
.lp-conn-form { display: grid; gap: 12px; min-width: 0; }
.lp-conn-form .lp-form-actions { margin-top: 0; }
.lp-conn-login { display: grid; gap: 12px; min-width: 0; }
.lp-conn-advanced > :not(summary) + :not(summary) { margin-top: 12px; }
.lp-conn-ok { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--lp-good-ink); font-size: 13px; line-height: 20px; }

/* --- 隐私与数据 (privacy/data-page.ts, privacy/consent-screen.ts) ------------------------------------------ */
.lp-data-fold { min-width: 0; }
.lp-data-page { display: grid; gap: 12px; min-width: 0; }
.lp-data { display: grid; gap: 20px; min-width: 0; }
.lp-data-lists { display: grid; gap: 12px; }
.lp-data-list { display: grid; gap: 4px; }
.lp-data-group { display: grid; gap: 8px; justify-items: start; min-width: 0; }
.lp-data-group > .lp-field { width: 100%; max-width: 320px; }
.lp-pipl { display: grid; gap: 12px; min-width: 0; }
.lp-consent-age { max-width: 160px; }

/* --- 高级：方法库 (methods.ts) ------------------------------------------------------------------------------ */
.lp-methods { display: grid; gap: 12px; }
.lp-methods .lp-run { margin: 0; }

/* A narrow settings column (a phone, or DSH's settings dialog at phone width, where the LongPi column is only
   about 110 px): every row wraps, fields take the column's width, nothing is pushed past the edge. */
@container lp-root (max-width: 360px) {
  .lp-settings > *, .lp-settings section, .lp-settings div, .lp-settings form, .lp-settings fieldset, .lp-settings label,
  .lp-settings li, .lp-settings dl, .lp-settings dt, .lp-settings dd, .lp-settings details, .lp-settings summary, .lp-settings span,
  .lp-settings p, .lp-settings h2, .lp-settings h3 { min-width: 0; max-width: 100%; }
  .lp-settings input:not([type=radio]):not([type=checkbox]), .lp-settings select, .lp-settings textarea { min-width: 0 !important; max-width: 100%; width: 100%; box-sizing: border-box; }
  .lp-settings button, .lp-settings a.lp-linkbtn { max-width: 100%; height: auto; min-height: 32px; white-space: normal; text-align: left; }
  .lp-settings .lp-set-head, .lp-settings .lp-field-label, .lp-settings .lp-input-unit, .lp-settings .lp-seg, .lp-settings .lp-status,
  .lp-settings .lp-switch, .lp-settings .lp-check, .lp-settings .lp-subhead, .lp-settings .lp-reminder-row, .lp-settings .lp-actions,
  .lp-settings .lp-form-actions, .lp-settings .lp-row, .lp-settings summary, .lp-settings .lp-check-text { flex-wrap: wrap; }
  .lp-settings .lp-grid-2, .lp-settings .lp-followup-times, .lp-settings .lp-followup-grid, .lp-settings .lp-kv { grid-template-columns: minmax(0, 1fr); }
  .lp-settings .lp-kv { gap: 0; }
  .lp-settings .lp-kv dd + dt { margin-top: 8px; }
  .lp-settings .lp-seg { width: auto; max-width: 100%; }
  .lp-settings .lp-seg-opt, .lp-settings .lp-seg-opt span { min-width: 0; height: auto; white-space: normal; }
  .lp-settings, .lp-settings * { overflow-wrap: anywhere; }
}
`,
			`
/* in the form, the segmented control is as tall as the inputs (36px), and the form-wide hint sits apart from the age field */
.lp-onb .lp-seg .lp-seg-item { height: 32px; }
.lp-onb .lp-form-grid + .lp-caption { margin-top: 12px; }
/* --- the dialog (inside DSH's Modal card) ------------------------------------------------------ */
/* The Modal card is sized by className, and by what it directly holds in case the host ignores className. */
.lp-onb-dialog.lp-onb-dialog, div:has(> .lp-onb.lp-onb) { width: min(560px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-onb { display: flex; flex-direction: column; max-height: calc(100vh - 48px); overflow-y: auto; padding: 24px; color: var(--lp-ink); font-size: 14px; line-height: 22px; }
@media (max-width: 560px) { .lp-onb { padding: 20px 16px; } }
.lp-onb-title { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; color: var(--lp-ink); outline: none; }
.lp-onb-title + .lp-onb-text { margin-top: 12px; }
.lp-onb-body { margin-top: 16px; }
.lp-onb-body > * + * { margin-top: 16px; }
.lp-onb-body > .lp-onb-text + .lp-onb-text { margin-top: 12px; }
.lp-onb-body > .lp-checkrow + .lp-caption { margin-top: 8px; }
.lp-onb-body > .lp-onb-actions, .lp-onb-actions { margin-top: 24px; }
.lp-onb-text { max-width: 36em; margin: 0; font-size: 14px; line-height: 22px; color: var(--lp-ink-2); }
.lp-onb-lead { margin: 0 0 16px; max-width: 36em; color: var(--lp-ink-2); }
.lp-onb-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-onb-actions > :last-child { margin-left: auto; }
.lp-onb-actions > button { min-width: 88px; }
.lp-onb-center { display: flex; justify-content: center; }
.lp-onb-body > .lp-upload-simple + .lp-onb-center { margin-top: 12px; }

/* stepper labels: one line each; on a narrow dialog only the current step keeps its label */
.lp-stepper-label { font-size: 13px; line-height: 20px; white-space: nowrap; }
@media (max-width: 480px) { .lp-onb .lp-stepper-item:not(.is-now) .lp-stepper-label { display: none; } }

/* --- upload (datain/upload.ts) ----------------------------------------------------------------- */
.lp-upload-icon { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--lp-well); color: var(--lp-ink-2); }
.lp-upload-simple > .lp-upload-icon { margin-bottom: 4px; }
.lp-upload-status { margin: 0; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-upload-form { display: grid; gap: 16px; max-width: 480px; }
.lp-upload-pick { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-width: 0; }
.lp-upload-chosen { min-width: 0; overflow-wrap: anywhere; }

/* --- first-result blocks (journey-steps.ts) --------------------------------- */
.lp-found { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.lp-found-tile { display: grid; gap: 4px; padding: 12px 16px; border-radius: var(--lp-radius-card); background: var(--lp-well); min-width: 0; }
.lp-found-figure { font-size: 24px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-now-block .lp-subhead { margin-top: 4px; }
`,
			`
/* --- shared text link ("健康页 →"; other pages use it too) ------------------------------------ */
.lp-row-link {
  display: inline; padding: 0; border: 0; background: transparent; color: var(--lp-ink-2);
  font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; white-space: nowrap;
}
.lp-row-link:hover { color: var(--lp-ink); text-decoration: underline; text-underline-offset: 3px; }
.lp-mark { display: inline-flex; }

/* --- chat cards (tool.call.toolview) --------------------------------------------------------------- */
.lp-tool { container: lp-root / inline-size; margin: 4px 0; font-size: 13px; line-height: 20px; }
.lp-tool-card { max-width: 680px; padding: 12px 16px; border-radius: var(--lp-radius-card); border: 1px solid var(--lp-line); background: var(--lp-layer); }
.lp-tool-quiet { padding: 0; }
.lp-tool-card.lp-tool-error { border-color: var(--lp-warn); }
.lp-tool-head { display: flex; align-items: center; gap: 8px; min-height: 24px; min-width: 0; flex-wrap: wrap; }
.lp-tool-icon { width: 16px; height: 16px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: var(--lp-ink-3); }
.lp-tool-title { color: var(--lp-ink); font-weight: 500; white-space: nowrap; }
.lp-tool-quiet .lp-tool-title { color: var(--lp-ink-2); font-weight: 400; }
.lp-tool-summary { min-width: 0; color: var(--lp-ink-3); }
.lp-tool-summary::before { content: "·"; margin-right: 8px; color: var(--lp-ink-4); }
.lp-tool-summary:has(> .lp-badge)::before { content: none; }
.lp-tool-warn { color: var(--lp-warn-ink); }
.lp-tool-bad { color: var(--lp-bad-ink); }
.lp-tool-raw-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border: 0; border-radius: 6px;
  background: transparent; color: var(--lp-ink-3); font-size: 12px; line-height: 18px; cursor: pointer;
}
.lp-tool-raw-btn:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-rot { transform: rotate(90deg); }
.lp-tool-undo {
  height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--lp-ink);
  font-size: 12px; line-height: 18px; font-weight: 500; cursor: pointer;
}
.lp-tool-undo:hover:not(:disabled) { background: var(--lp-hover); }
.lp-tool-undo:disabled { color: var(--lp-ink-3); cursor: progress; }
.lp-tool-body { display: grid; gap: 8px; margin-top: 8px; }
.lp-tool-quiet .lp-tool-body { margin: 4px 0 0 24px; }
.lp-tool-raw {
  margin: 8px 0 0; max-height: 240px; overflow: auto; padding: 8px 12px; border-radius: var(--lp-radius-ctl);
  border: 1px solid var(--lp-line); background: var(--lp-well); color: var(--lp-ink-2);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 12px; line-height: 18px; white-space: pre-wrap; word-break: break-word;
}
.lp-tool-saved { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lp-tool-draft { display: grid; gap: 8px; }
.lp-tool-draft .lp-draft-block { margin: 0; }
.lp-tool-draft .lp-form-actions { margin-top: 4px; }
.lp-readback { list-style: none; margin: 0; padding: 0; display: grid; }
.lp-readback li { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding: 8px 0; border-top: 1px solid var(--lp-line); }
.lp-readback li:first-child { border-top: 0; padding-top: 0; }
.lp-tool-result { display: flex; align-items: baseline; gap: 8px 12px; flex-wrap: wrap; }
.lp-tool-figure .lp-unit { margin-left: 4px; }
.lp-tool-report pre { margin: 0; max-height: 240px; overflow: auto; white-space: pre-wrap; font-size: 12px; line-height: 18px; color: var(--lp-ink-2); }
.lp-tool-doctor { display: flex; gap: 4px; align-items: flex-start; margin: 0; color: var(--lp-warn-ink); font-size: 12px; line-height: 18px; }
.lp-tool-doctor .lp-icon { margin-top: 2px; }
.lp-tool .lp-caption { margin: 0; }

/* --- quick actions under a finished turn: one quiet row, wrapping in a narrow chat -------------------- */
.lp-turn-tail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0; font-size: 13px; line-height: 20px; }
.lp-tail-group { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-tail-links { display: inline-flex; align-items: center; gap: 12px; margin-left: auto; }
.lp-turn-tail .lp-form-error { margin: 0; }

/* --- the 健康 tab in DSH's right column (the 概览 tab, narrowed by the lp-root queries) ------------------ */
.lp-pane { container: lp-root / inline-size; display: grid; gap: 12px; padding: 12px 16px 24px; }
.lp-pane-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
.lp-pane-title { display: inline-flex; align-items: center; gap: 8px; }
.lp-pane-title .lp-icon { color: var(--lp-ink-3); }
.lp-pane .lp-card { padding: 16px; }
.lp-pane .lp-overview { gap: 12px; }
.lp-pane-loading { display: grid; gap: 12px; }
.lp-pane-foot { margin: 4px 0 0; }

/* --- reminder pill (shell overlay: click-through layer) --------------------------------------------- */
/* Bottom-right, lifted clear of a chat's composer so it never covers the send button. */
.lp-pill-wrap {
  position: absolute; right: 20px; bottom: 136px; z-index: 1; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: var(--lp-radius-card);
  background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop); animation: lp-fade .2s ease both;
}
.lp-pill-main {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 4px; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink); font-size: 13px; line-height: 20px; cursor: pointer;
}
.lp-pill-main:hover { background: var(--lp-hover); }
.lp-pill-mark { width: 24px; height: 24px; flex: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--lp-accent); color: var(--lp-on-accent); }
.lp-pill-count { font-weight: 600; font-variant-numeric: tabular-nums; }
.lp-pill-x {
  width: 28px; height: 28px; flex: none; border: 0; border-radius: var(--lp-radius-ctl); display: inline-flex; align-items: center; justify-content: center;
  background: transparent; color: var(--lp-ink-3); cursor: pointer;
}
.lp-pill-x:hover { background: var(--lp-hover); color: var(--lp-ink); }

/* --- the doctor-first card on 概览 and its one-page brief (triage/care-card.ts) ------------------------ */
.lp-care-box { min-width: 0; }
.lp-care-title { display: inline-flex; align-items: center; gap: 8px; }
.lp-care-title .lp-icon { color: var(--lp-warn-ink); }
.lp-care-text { display: grid; gap: 4px; min-width: 0; }
.lp-care-box p, .lp-tool-body p { max-width: 40em; }
.lp-care-visit { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--lp-line); }
.lp-care-visit-form { display: grid; gap: 12px; max-width: 480px; }
.lp-care-date { max-width: 200px; }
.lp-brief-dialog.lp-brief-dialog, div:has(> .lp-brief-modal.lp-brief-modal) { width: min(640px, calc(100vw - 32px)); max-width: none; padding: 0; gap: 0; }
.lp-brief-modal { display: grid; gap: 12px; padding: 24px; max-height: calc(100vh - 48px); overflow-y: auto; }
.lp-brief-modal .lp-modal-actions { margin-top: 8px; }
.lp-brief-pre {
  margin: 0; max-height: 55vh; overflow: auto; padding: 12px 16px; border-radius: var(--lp-radius-ctl); border: 1px solid var(--lp-line);
  background: var(--lp-well); color: var(--lp-ink); font-family: inherit; font-size: 13px; line-height: 20px; white-space: pre-wrap;
}
`
		].join("\n");
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
			if (adopted != null) return h$1("span", { className: "lp-badge lp-badge-good" }, h$1(Icon, {
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
				className: "lp-linkbtn lp-linkbtn-sm lp-btn-primary",
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
			if (isUndone(props.call.callId)) return h$1("span", { className: "lp-badge lp-badge-neutral" }, h$1(Icon, {
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
			return h$1("span", { className: "lp-tail-group" }, h$1("span", { className: "lp-badge lp-badge-good" }, h$1(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已记录：${names}`), h$1("button", {
				type: "button",
				className: "lp-linkbtn lp-linkbtn-sm",
				disabled: busy,
				onClick: () => {
					undo();
				},
				"aria-label": `撤销今天的打卡：${names}`
			}, busy ? "撤销中" : "撤销"), error ? h$1("span", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
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
				className: "lp-linkbtn lp-linkbtn-sm lp-btn-primary",
				onClick: () => reply("确认，保存这份方案")
			}, h$1(Icon, {
				name: "check",
				size: 13
			}), "确认保存"), h$1("button", {
				type: "button",
				className: "lp-linkbtn lp-linkbtn-sm",
				onClick: () => reply("我想调整一下：")
			}, "还要调整")) : null, match.saved ? h$1("span", { className: "lp-badge lp-badge-good" }, h$1(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), savedVersion != null ? `已保存为方案第 ${savedVersion} 版` : "方案已保存") : null, match.checkin ? h$1(CheckinAction, { call: match.checkin }) : null, h$1("span", { className: "lp-tail-links" }, openPane ? h$1("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: openPane
			}, "在右侧查看") : null, openPlan ? h$1("button", {
				type: "button",
				className: "lp-textbtn",
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
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "dsh-plugin-longpi",
				order: 90
			}, PromptBridge));
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
				ctx.inject(["uiWorkspace"], (sub) => {
					const nav = sub.uiWorkspace;
					if (!nav) return;
					setWorkspaceOpener((id) => nav.openWorkspace(id));
					sub.effect?.(() => () => setWorkspaceOpener(null), "longpi: 健康对话 opener");
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