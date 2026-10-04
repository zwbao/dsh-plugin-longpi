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
				label_zh: "方案效果"
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
			if (status === 503) return "LongPi 尚未就绪，请稍后再试（HTTP 503）";
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
		/**
		* A read that has not answered by then is reported, not left as a skeleton forever (F-3). Long enough for a first
		* read that runs the body-age methods (journey has no server-side limit).
		*/
		const READ_TIMEOUT_MS = 9e4;
		const READ_TIMEOUT_ZH = "读取时间较长，请稍后点「刷新」重试。如果同时打开了多个 DeepSeek Harness 标签页，关闭其余标签页也可能有帮助。";
		async function getJson(path) {
			let res;
			try {
				const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(READ_TIMEOUT_MS) : void 0;
				res = await fetch(path, {
					credentials: "same-origin",
					...signal ? { signal } : {}
				});
			} catch (error) {
				if (error instanceof Error && error.name === "TimeoutError") throw new Error(READ_TIMEOUT_ZH);
				throw error;
			}
			return read(res);
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
			out = replaceClaim(out, "你变年轻了", "数值有变化");
			out = replaceClaim(out, "更年轻了", "数值更低");
			out = out.replace(/年轻了\s*(\d+(?:\.\d+)?)/g, (match, digits, offset, whole) => {
				const before = whole.slice(Math.max(0, offset - 8), offset);
				return NEGATED_BEFORE.test(before) ? match : `变化了 ${digits}`;
			});
			return replaceClaim(out, "逆龄", "变化");
		}
		function evidenceSentence(row) {
			const species = speciesOf(row) ?? "未标明";
			const rest = row.limits_zh.replace(/物种[:：]\s*[^。；\n]+[。；]?/g, "").trim();
			return `仅证据（物种：${species}）。${rest ? rest.endsWith("。") ? rest : `${rest}。` : ""}${/不是你的/.test(rest) ? "" : "这不是你的个人数值。"}`;
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
			const shown = out && out.value != null && out.value !== "" ? formatMeasure(out.value, out.unit, out.key) : "无个人数值";
			const title = titleOf(row.skill, row.title_zh, out?.key ?? "");
			let text;
			if (row.label === "unverified-binding") {
				const quote = plainSource(row.inputs_used.map((item) => item.quote.trim()).find(Boolean) ?? "");
				text = quote ? `${title}是 ${shown}（尚未核对，来源：${quote}）。` : `${title}是 ${shown}（尚未核对）。`;
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
			if (Math.abs(advance) < .5) return "与周岁相近";
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
			return `${high}${names.length >= 2 ? `${names.join("、")}等红细胞指标使该数值偏高。如与贫血等原因有关，请先由医生查明原因；原因处理后，该数值可能下降。` : names.length === 1 ? `${names[0]}使该数值偏高。请先由医生查明原因；原因处理后，该数值可能下降。` : "具体是哪些指标使该数值偏高，需要对照化验结果判断。请先由医生查明原因；原因处理后，该数值可能下降。"}`;
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
		const h$47 = react.default.createElement;
		function dayNumber(iso) {
			return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 864e5);
		}
		function thisYear() {
			return (/* @__PURE__ */ new Date()).getFullYear();
		}
		/** 「9 月 30 日」, with the year only when it is not this year (「2025 年 9 月 12 日」). Not a date: returned as is. */
		function dateZh$2(iso) {
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
			return text.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => dateZh$2(iso));
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
			return h$47("div", {
				className: "lp-tip",
				style: {
					left,
					top: Math.max(0, tip.y - 12)
				},
				role: "status"
			}, h$47("div", { className: "lp-tip-title" }, tip.title), ...tip.rows.map((row, index) => h$47("div", {
				className: "lp-tip-row",
				key: index
			}, h$47("span", { className: "lp-tip-value" }, row.value), h$47("span", { className: "lp-tip-label" }, row.label))));
		}
		function LineChart(props) {
			const pointDate = (iso) => props.weekly ? `${dateZh$2(iso)}起一周` : dateZh$2(iso);
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
			if (points.length === 0) return h$47("div", {
				ref,
				className: "lp-chart-empty"
			}, "还没有数据");
			if (points.length === 1) {
				const only = points[0];
				return h$47("div", {
					ref,
					className: "lp-chart-single"
				}, h$47("div", null, h$47("span", { className: "lp-num-md" }, fmt$1(only.value, digits)), props.unit ? h$47("span", { className: "lp-unit" }, props.unit.startsWith("%") ? props.unit : ` ${props.unit}`) : null), h$47("p", { className: "lp-caption" }, `${pointDate(only.date)} · 再复测一次后可显示趋势`));
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
			return h$47("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$47("svg", {
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
			}, ...yTicks.map((value) => h$47("g", { key: `g${value}` }, h$47("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(value),
				y2: y(value),
				className: "lp-grid"
			}), h$47("text", {
				x: pad.left - 6,
				y: y(value) + 3,
				className: "lp-axis",
				textAnchor: "end"
			}, fmt$1(value, value % 1 === 0 ? 0 : digits)))), props.band ? h$47("rect", {
				x: bandFrom,
				width: Math.max(0, width - pad.right - bandFrom),
				y: y(props.band.high),
				height: Math.max(1, y(props.band.low) - y(props.band.high)),
				className: "lp-band",
				rx: 3
			}) : null, props.reference ? h$47("g", null, h$47("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.reference.value),
				y2: y(props.reference.value),
				className: "lp-ref"
			}), props.compact ? null : h$47("text", {
				x: width - pad.right + 4,
				y: y(props.reference.value) + 3,
				className: "lp-axis"
			}, props.reference.label)) : null, props.goal != null ? h$47("g", null, h$47("line", {
				x1: pad.left,
				x2: width - pad.right,
				y1: y(props.goal),
				y2: y(props.goal),
				className: "lp-goal"
			}), props.compact ? null : h$47("text", {
				x: pad.left + 4,
				y: y(props.goal) + (y(props.goal) - pad.top < 14 ? 13 : -5),
				className: "lp-goal-text"
			}, `目标 ${fmt$1(props.goal, digits)}`)) : null, h$47("path", {
				d: area,
				className: "lp-area"
			}), h$47("path", {
				d: path,
				className: "lp-line"
			}), focus != null ? h$47("line", {
				x1: x(days[focus]),
				x2: x(days[focus]),
				y1: pad.top,
				y2: height - pad.bottom,
				className: "lp-cross"
			}) : null, ...points.map((point, index) => points.length > 24 && index !== points.length - 1 && index !== focus ? null : h$47("circle", {
				key: `p${index}`,
				cx: x(days[index]),
				cy: y(point.value),
				r: focus === index ? 5.5 : 4,
				className: "lp-dot"
			})), props.compact ? null : h$47("text", {
				x: x(days.at(-1)) + 8,
				y: y(last.value) + 4,
				className: "lp-end"
			}, `${fmt$1(last.value, digits)}`), props.compact ? null : h$47("text", {
				x: pad.left,
				y: height - 6,
				className: "lp-axis"
			}, dateZh$2(points[0]?.date ?? "")), props.compact || points.length < 2 ? null : h$47("text", {
				x: width - pad.right,
				y: height - 6,
				className: "lp-axis",
				textAnchor: "end"
			}, dateZh$2(last.date))), h$47(Tooltip, {
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
				return h$47("p", { className: "lp-small lp-muted" }, `${count}从 ${dateZh$2(first.start)}开始${first.end ? `，到 ${dateZh$2(first.end)}结束` : ""}。`);
			}
			return h$47(TimelineChart, props);
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
			return h$47("div", { className: "lp-timeline" }, h$47("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$47("svg", {
				width,
				height,
				role: "img",
				"aria-label": `方案时间线：${props.items.map((item) => `${item.title} ${dateZh$2(item.start)}起`).join("，")}`
			}, ...ticks.map((iso) => h$47("g", { key: iso }, h$47("line", {
				x1: x(dayNumber(iso)),
				x2: x(dayNumber(iso)),
				y1: 20,
				y2: height - 6,
				className: "lp-grid"
			}), h$47("text", {
				x: x(dayNumber(iso)) + 4,
				y: 12,
				className: "lp-axis"
			}, monthLabel(iso)))), ...inWindow.map((day) => h$47("g", { key: `c${day}` }, h$47("line", {
				x1: x(day),
				x2: x(day),
				y1: 24,
				y2: height - 6,
				className: "lp-checkup"
			}), h$47("circle", {
				cx: x(day),
				cy: 24,
				r: 3,
				className: "lp-checkup-dot"
			}))), h$47("line", {
				x1: todayX,
				x2: todayX,
				y1: 20,
				y2: height - 6,
				className: "lp-today"
			}), h$47("text", {
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
				return h$47("g", {
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
				}, h$47("text", {
					x: 0,
					y: y0 + 4,
					className: "lp-row-label"
				}, h$47("title", null, item.title), fitText(item.title, labelWidth - 16, font)), h$47("rect", {
					x: labelWidth,
					y: y0 - 12,
					width: width - labelWidth,
					height: 24,
					className: "lp-hit"
				}), ahead > 0 ? h$47("rect", {
					x: Math.max(x0, x1),
					y: y0 - 5,
					width: ahead,
					height: 10,
					rx: 5,
					className: "lp-cbar-ahead"
				}) : null, h$47("rect", {
					x: x0,
					y: y0 - 5,
					width: Math.max(10, x1 - x0),
					height: 10,
					rx: 5,
					className: done ? "lp-cbar-muted" : "lp-cbar"
				}));
			})), h$47(Tooltip, {
				tip,
				width
			})), h$47("div", { className: "lp-legend-inline" }, h$47("span", { className: "lp-key-bar" }), "已进行", anyAhead ? h$47(react.default.Fragment, null, h$47("span", { className: "lp-key-ahead" }), "接下来") : null, inWindow.length > 0 ? h$47(react.default.Fragment, null, h$47("span", { className: "lp-key-dot" }), "体检日") : null));
		}
		function AdherenceStrip(props) {
			const [tip, setTip] = react.default.useState(null);
			const cell = 9;
			const width = Math.ceil(props.calendar.length / 7) * 11;
			const height = 77;
			const statusZh = {
				done: "完成",
				missed: "未完成",
				unknown: "没有记录"
			};
			return h$47("div", {
				className: "lp-strip",
				style: {
					width,
					height: 79
				}
			}, h$47("svg", {
				width,
				height,
				role: "img",
				"aria-label": `${props.label}：近 12 周，完成 ${props.calendar.filter((day) => day.status === "done").length} 天`
			}, ...props.calendar.map((day, index) => h$47("rect", {
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
					title: dateZh$2(day.date),
					rows: [{
						label: props.label,
						value: statusZh[day.status] ?? day.status
					}]
				}),
				onPointerLeave: () => setTip(null)
			}))), h$47(Tooltip, {
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
			return h$47("div", {
				ref,
				className: "lp-chart",
				style: { height }
			}, h$47("svg", {
				width,
				height,
				role: "img",
				"aria-label": props.rows.map((row) => `${row.label} ${row.detail}：${fmt$1(row.value)}${row.unit}`).join("，")
			}, ...props.rows.map((item, index) => {
				const y0 = index * row;
				const length = Math.max(3, Math.abs(item.value) / max * barMax);
				return h$47("g", { key: item.label }, h$47("text", {
					x: 0,
					y: y0 + 14,
					className: "lp-row-label"
				}, item.label, item.detail ? h$47("tspan", {
					dx: 8,
					className: "lp-axis"
				}, item.detail) : null), h$47("path", {
					d: roundedBar(0, y0 + 22, length, 10),
					className: item.value <= 0 ? "lp-cbar" : "lp-cbar-muted"
				}), h$47("text", {
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
			return h$47("svg", {
				width: size,
				height: size,
				role: "img",
				"aria-label": `${props.label} ${Math.round(share * 100)}%`,
				className: "lp-ring"
			}, h$47("circle", {
				cx: size / 2,
				cy: size / 2,
				r: radius,
				className: "lp-ring-track",
				strokeWidth: stroke
			}), h$47("circle", {
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
			return h$47("details", { className: "lp-twin" }, h$47("summary", null, "表格"), h$47("table", null, h$47("caption", null, props.caption), h$47("thead", null, h$47("tr", null, ...props.head.map((cell) => h$47("th", {
				key: cell,
				scope: "col"
			}, cell)))), h$47("tbody", null, ...props.rows.map((row, index) => h$47("tr", { key: index }, ...row.map((cell, column) => h$47("td", { key: column }, cell)))))));
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
			if (Math.abs(advance) < .5) return "与实足年龄相当";
			if (advance < 0 && (checkups ?? 0) < 2) return `根据单次检查估算（模型估计，不是诊断），比实足年龄小 ${fmt$1(-advance)} 岁。单次检查不能说明你变年轻了`;
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
				done_total: num$2(raw.done_total) ?? 0,
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
				boundary_zh: str(raw.boundary_zh) || "模型估计，不是诊断或用药建议，也不代表预期寿命。紧急情况请拨打 120。"
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
				pairing_error: str(raw.pairing_error),
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
				error: ok ? "" : error || connection?.error || "连接失败",
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
		const listeners$5 = /* @__PURE__ */ new Set();
		let version$2 = 0;
		let timersOn = false;
		let pageUsers = 0;
		/** The page or the 健康 pane on screen: what keeps the change stream open (the pill does not). */
		let liveUsers = 0;
		let bridges = 0;
		/** The right 健康 pane on screen: the prompt slot shows there instead of the bottom-right bar. */
		let paneUsers = 0;
		let pending = null;
		let promptNote = null;
		let viewRequest = null;
		let settingsOpener = null;
		function canonTab(tab) {
			if (tab === "indicators") return "labs";
			if (tab === "season") return "codex";
			return tab;
		}
		function emit$2() {
			version$2 += 1;
			for (const listener of listeners$5) listener();
		}
		function subscribe(listener) {
			listeners$5.add(listener);
			return () => {
				listeners$5.delete(listener);
			};
		}
		function load$1(key, mode = "reuse") {
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
				entry.error = errorText(error, "未能读取");
			}).finally(() => {
				if (seq !== entry.seq) return;
				entry.loading = false;
				entry.inflight = null;
				emit$2();
			});
			entry.inflight = run;
			emit$2();
			return run;
		}
		function inUse() {
			return Object.keys(entries).filter((key) => entries[key].users > 0);
		}
		function stale(key) {
			return Date.now() - entries[key].at > STALE_MS;
		}
		let source = null;
		let sourceGone = false;
		/** When the stream last closed (0: never open yet): on reopening, only what was read before that loads again. */
		let closedAt = 0;
		let pollTimer = null;
		let revive = null;
		function tabVisible() {
			return typeof document !== "undefined" && document.visibilityState !== "hidden";
		}
		function closeLive() {
			if (source) closedAt = Date.now();
			source?.close();
			source = null;
			if (pollTimer != null) clearInterval(pollTimer);
			pollTimer = null;
		}
		/** Open or close the change stream and the poll to match what is on screen. */
		function syncLive() {
			if (typeof window === "undefined" || !timersOn) return;
			if (!tabVisible()) {
				closeLive();
				return;
			}
			if (pollTimer == null) pollTimer = setInterval(() => {
				for (const key of inUse()) load$1(key);
			}, POLL_MS);
			if (liveUsers <= 0) {
				if (source) closedAt = Date.now();
				source?.close();
				source = null;
				return;
			}
			if (source || sourceGone || typeof EventSource === "undefined") return;
			try {
				const opened = new EventSource("/api/longpi/events");
				const reload = () => {
					for (const key of inUse()) load$1(key, "fresh");
				};
				for (const type of [
					"surfaces",
					"memory",
					"triage",
					"changed"
				]) opened.addEventListener(type, reload);
				opened.onerror = () => {
					if (opened.readyState === EventSource.CLOSED && source === opened) {
						source = null;
						sourceGone = true;
					}
				};
				source = opened;
				if (closedAt > 0) {
					for (const key of inUse()) if (entries[key].at <= closedAt) load$1(key);
				}
			} catch {
				source = null;
			}
		}
		function startTimers() {
			if (timersOn || typeof window === "undefined") return;
			timersOn = true;
			revive = () => {
				sourceGone = false;
				syncLive();
				if (document.visibilityState === "hidden") return;
				for (const key of inUse()) if (stale(key)) load$1(key);
			};
			window.addEventListener("focus", revive);
			document.addEventListener("visibilitychange", revive);
			syncLive();
		}
		/** Plugin unload or reload: give back the stream, the poll and the listeners (a reloaded client starts its own). */
		function stopTimers() {
			closeLive();
			sourceGone = false;
			if (revive && typeof window !== "undefined") {
				window.removeEventListener("focus", revive);
				document.removeEventListener("visibilitychange", revive);
			}
			revive = null;
			timersOn = false;
		}
		/**
		* Reload what is on screen. With force the journey goes first with
		* ?refresh=1 so the server re-reads Mirobody once, then the rest follow.
		*/
		async function refreshAll(force = false) {
			const keys = inUse();
			if (force) {
				await load$1("journey", "refresh");
				await Promise.all(keys.filter((key) => key !== "journey").map((key) => load$1(key, "fresh")));
				return;
			}
			await Promise.all(keys.map((key) => load$1(key)));
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
			for (const key of shown) load$1(key, "fresh");
			emit$2();
		}
		function useResource(key) {
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
			react.default.useEffect(() => {
				const entry = entries[key];
				entry.users += 1;
				startTimers();
				if (entry.data == null && !entry.inflight || stale(key)) load$1(key);
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
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
			return entries.board.data;
		}
		/** Fetch one resource again now (a retry, or a test send that only adds a log row). */
		function reload(key) {
			return load$1(key, "fresh");
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
			emit$2();
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
			emit$2();
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
			emit$2();
		}
		/**
		* The reminder pill hides while the LongPi page is on screen. On screen, not
		* mounted: a host that keeps a hidden panel mounted must not silence the pill.
		*/
		function usePageShown(ref) {
			useShown$1(ref, true);
		}
		function useShown$1(ref, page, pane = false) {
			react.default.useEffect(() => {
				const node = ref.current;
				let shown = false;
				const set = (next) => {
					if (next === shown) return;
					shown = next;
					if (page) pageUsers += next ? 1 : -1;
					if (pane) paneUsers += next ? 1 : -1;
					liveUsers += next ? 1 : -1;
					syncLive();
					emit$2();
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
			}, [
				ref,
				page,
				pane
			]);
		}
		function useHeroShowing() {
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
			return false;
		}
		/** The pane counts itself while on screen (and keeps the change stream open like useLiveShown). */
		function usePaneShown(ref) {
			useShown$1(ref, false, true);
		}
		function usePaneShowing() {
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
			return paneUsers > 0;
		}
		function usePageShowing() {
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
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
			emit$2();
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
			return react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
		}
		/** PromptBridge counts itself while mounted: that is how the home knows a session (and a composer to write into) exists. */
		function useBridgeMounted() {
			react.default.useEffect(() => {
				if (bridges === 0 && pending) pending = {
					...pending,
					at: Date.now()
				};
				bridges += 1;
				emit$2();
				return () => {
					bridges -= 1;
					emit$2();
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
			emit$2();
			if (!text) return;
			const id = promptNote?.id;
			window.setTimeout(() => {
				if (promptNote?.id !== id) return;
				promptNote = null;
				emit$2();
			}, 4e3);
		}
		/** Open the page at a tab (and a section in it): the page switches and scrolls once it shows them. */
		function requestView(request) {
			viewRequest = { ...request };
			emit$2();
		}
		function useViewRequest() {
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
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
			emit$2();
		}
		function useSettingsOpener() {
			react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
			return settingsOpener;
		}
		/** Re-render on any store change (for state kept outside the resources, such as check-in marks). */
		function useStoreVersion() {
			return react.default.useSyncExternalStore(subscribe, () => version$2, () => version$2);
		}
		function bumpStore() {
			emit$2();
		}
		/** When the journey on screen was fetched (0 before the first answer). */
		function journeyFetchedAt() {
			return entries.journey.at;
		}
		//#endregion
		//#region src/client/icons.ts
		const h$46 = react.default.createElement;
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
			return h$46("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: `lp-icon ${props.className ?? ""}`.trim()
			}, h$46("path", {
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
			return h$46("span", {
				className: "lp-mark",
				"aria-hidden": true
			}, h$46(Icon, {
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
			return h$46("span", { className: `lp-badge ${style.className}` }, h$46(Icon, {
				name: style.icon,
				size: 12
			}), label);
		}
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
		function Btn$1(props) {
			return h$45(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				size: "md",
				...props,
				className: `lp-btn ${props.size === "sm" ? "lp-btn-sm" : ""} ${props.className ?? ""}`.trim()
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
				"aria-describedby": props.describedBy,
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
			}), h$45("span", { className: "lp-loaderror-text" }, `未能读取${props.what}${props.error ? `：${props.error}` : ""}。`), h$45("button", {
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
					copyText(text).then((copied) => setPromptNote(copied ? "未能填入输入框，内容已复制，请直接粘贴" : "未能填入输入框，请手动输入"));
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
		const listeners$4 = /* @__PURE__ */ new Set();
		function set(next) {
			if (next === status) return;
			status = next;
			for (const listener of listeners$4) listener();
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
				listeners$4.add(listener);
				return () => {
					listeners$4.delete(listener);
				};
			}, () => status, () => status);
		}
		//#endregion
		//#region src/client/datain/upload.ts
		const h$44 = react.default.createElement;
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
					setError("文件超过 32 MB。叙述版基因报告请发送到健康对话，请勿在此上传整份报告。");
					return;
				}
				if (kind && !confirmStore) {
					setError("请先确认：此表格仅保存在这台电脑上，不写入体检记录。");
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
					if (!id) throw new Error("上传未能开始");
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
					setStatus("正在读取报告…");
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
			const fileInput = (reportOnly) => h$44("input", {
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
			if (props.simple) return h$44("div", { className: "lp-upload-simple" }, fileInput(true), h$44("span", {
				className: "lp-upload-icon",
				"aria-hidden": true
			}, h$44(UploadGlyph)), h$44(Btn$1, {
				variant: props.quiet ? "outline" : "primary",
				onClick: () => fileRef.current?.click(),
				disabled: busy
			}, busy ? "正在读取…" : "上传报告"), h$44("span", { className: "lp-caption" }, "照片或 PDF"), busy ? h$44("p", {
				className: "lp-caption lp-upload-status",
				role: "status"
			}, `${status} 通常需要 1–2 分钟。`) : status ? h$44("p", {
				className: "lp-upload-status",
				role: "status"
			}, status) : null, error ? h$44("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
			return h$44("div", {
				id: "lp-report-upload",
				className: "lp-upload-form"
			}, h$44("div", { className: "lp-field" }, h$44("label", {
				className: "lp-field-label",
				htmlFor: "lp-upload-kind"
			}, "文件类型"), h$44("select", {
				id: "lp-upload-kind",
				className: "lp-select",
				value: kind,
				disabled: busy,
				onChange: (event) => setKind(event.target.value)
			}, h$44("option", { value: "" }, "体检报告（PDF 或照片）"), h$44("option", { value: "methylation" }, "甲基化位点表"), h$44("option", { value: "taxa" }, "菌群表"), h$44("option", { value: "proteins" }, "蛋白表"), h$44("option", { value: "conditions" }, "诊断编码"))), kind ? h$44("label", {
				className: "lp-checkrow",
				htmlFor: "lp-upload-confirm"
			}, h$44("input", {
				id: "lp-upload-confirm",
				type: "checkbox",
				checked: confirmStore,
				disabled: busy,
				onChange: (event) => setConfirmStore(event.target.checked)
			}), h$44("span", null, "确认后保存在这台电脑上，不写入体检记录")) : null, h$44("div", { className: "lp-field" }, h$44("span", { className: "lp-field-label" }, "文件"), fileInput(false), h$44("div", { className: "lp-upload-pick" }, h$44(Btn$1, {
				variant: "outline",
				onClick: () => fileRef.current?.click(),
				disabled: busy
			}, busy ? "正在读取…" : "选择文件"), h$44("span", {
				className: "lp-caption lp-upload-chosen",
				role: "status",
				id: "lp-upload-status"
			}, status ? chosen ? `${chosen} · ${status}` : status : chosen || "PDF、照片，或 CSV、TXT 表格"))), error ? h$44("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$44("p", { className: "lp-caption" }, "也可以直接将 PDF 或照片发送到健康对话。"));
		}
		/** An upload glyph (arrow up into a tray), drawn like icons.ts's 16px strokes. */
		function UploadGlyph() {
			return h$44("svg", {
				width: 20,
				height: 20,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: "false",
				className: "lp-icon"
			}, h$44("path", {
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
		const h$43 = react.default.createElement;
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
			return h$43("ul", { className: "lp-self-latest" }, ...rows.map((row) => h$43("li", { key: row.key }, h$43("span", { className: "lp-caption" }, row.key === "sbp" ? "家庭血压" : row.label_zh), h$43("span", { className: "lp-self-value" }, selfLatestText(row, props.latest)), h$43("span", { className: "lp-caption" }, row.key === "sbp" ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : "1 次读数"} · 截至 ${chineseDate(row.date)}` : chineseDate(row.date)))));
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
			if (choices.length < 2) return h$43("span", { className: "lp-unit" }, props.spec.unit);
			return h$43("select", {
				id: props.id,
				className: "lp-select lp-self-unit",
				value: props.value,
				"aria-label": props.label,
				onChange: (event) => props.onChange(event.target.value)
			}, ...choices.map((unit) => h$43("option", {
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
						setError(`${spec(key).label_zh}请填写数字。`);
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
					setError("血压请同时填写收缩压和舒张压（高压和低压）。");
					return;
				}
				if (entries.length === 0) {
					setError("请至少填写一项后再记录。");
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
					setError(errorText(err, "记录失败，请稍后再试。"));
				} finally {
					setBusy(false);
				}
			}
			const field = (key, placeholder) => h$43("div", { className: "lp-field" }, h$43("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-${key}`
			}, spec(key).label_zh), h$43("div", { className: "lp-input-unit" }, h$43("input", {
				id: `${props.idPrefix}-${key}`,
				className: "lp-input",
				inputMode: "decimal",
				placeholder,
				value: values[key],
				onChange: (event) => set(key, event.target.value)
			}), h$43(UnitSelect, {
				id: `${props.idPrefix}-${key}-unit`,
				spec: spec(key),
				value: units[key],
				label: `${spec(key).label_zh}的单位`,
				onChange: (unit) => setUnits((current) => ({
					...current,
					[key]: unit
				}))
			})));
			return h$43("form", {
				className: "lp-self-form",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$43("div", { className: "lp-form-grid" }, field("waist", "例如 86"), field("weight", "例如 70.5"), h$43("div", { className: "lp-field lp-field-full" }, h$43("span", {
				className: "lp-field-label",
				id: `${props.idPrefix}-bp`
			}, "家庭血压"), h$43("div", {
				className: "lp-bp",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-bp`
			}, h$43("input", {
				id: `${props.idPrefix}-sbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "收缩压",
				"aria-label": "收缩压（高压）",
				value: values.sbp,
				onChange: (event) => set("sbp", event.target.value)
			}), h$43("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/"), h$43("input", {
				id: `${props.idPrefix}-dbp`,
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				value: values.dbp,
				onChange: (event) => set("dbp", event.target.value)
			}), h$43("span", { className: "lp-unit" }, "mmHg"))), h$43("div", { className: "lp-field" }, h$43("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-date`
			}, "测量日期"), h$43("input", {
				id: `${props.idPrefix}-date`,
				className: "lp-input",
				type: "date",
				value: date,
				max: today,
				min: "1990-01-01",
				onChange: (event) => setDate(event.target.value || today)
			}))), error ? h$43("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$43("div", { className: "lp-form-actions" }, h$43(Btn$1, {
				type: "submit",
				disabled: busy
			}, busy ? "记录中…" : "记录"), h$43("span", { className: "lp-caption" }, "单位可选斤、尺或寸，将自动换算为 kg 和 cm。")));
		}
		function SelfRecent(props) {
			const { data, loading, error } = useSelfRows();
			const [busy, setBusy] = react.default.useState(null);
			const rows = (data?.rows ?? []).slice(0, 6);
			if (loading && !data) return null;
			if (!data && error) return h$43(LoadError, {
				what: "自测记录",
				error,
				compact: true,
				onRetry: () => reload("self")
			});
			if (rows.length === 0) return h$43("p", { className: "lp-caption lp-measure" }, "还没有自测记录。");
			async function remove(row) {
				setBusy(row.id);
				try {
					await deleteJson(`/api/longpi/self?id=${encodeURIComponent(row.id)}`);
					props.onNotice(`已删除 ${chineseDate(row.date)}的${labelOf(row.key)}。`, "good");
					notifyChanged();
				} catch (err) {
					props.onNotice(`删除失败：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(null);
				}
			}
			return h$43("div", null, h$43("div", { className: "lp-subhead" }, "最近记录"), h$43("ul", { className: "lp-rows" }, ...rows.map((row) => h$43("li", {
				key: row.id,
				className: "lp-row"
			}, h$43("span", { className: "lp-row-main" }, h$43("span", null, labelOf(row.key)), h$43("span", { className: "lp-num" }, ` ${fmt$1(row.value)} ${row.unit}`), row.given ? h$43("span", { className: "lp-caption" }, `（原始填写 ${fmt$1(row.given.value)} ${row.given.unit}）`) : null), h$43("span", { className: "lp-row-end" }, h$43("span", { className: "lp-caption" }, chineseDate(row.date)), h$43("button", {
				type: "button",
				className: "lp-iconbtn",
				disabled: busy === row.id,
				"aria-label": `删除 ${chineseDate(row.date)} 的${labelOf(row.key)} ${fmt$1(row.value)} ${row.unit}`,
				onClick: () => {
					remove(row);
				}
			}, h$43(Icon, {
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
					props.onNotice(bp ? "请填写收缩压和舒张压。" : `${spec.label_zh}请填写数字。`, "bad");
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
					props.onNotice(errorText(err, "记录失败，请稍后再试。"), "bad");
				} finally {
					setBusy(false);
				}
			}
			return h$43("form", {
				className: "lp-inline-self",
				onSubmit: (event) => {
					submit(event);
				},
				noValidate: true
			}, h$43("input", {
				className: "lp-input",
				inputMode: "decimal",
				value,
				placeholder: bp ? "收缩压" : spec.label_zh,
				"aria-label": bp ? "收缩压（高压）" : `${spec.label_zh}`,
				id: `${props.idPrefix}-${props.selfKey}`,
				onChange: (event) => setValue(event.target.value)
			}), bp ? h$43("span", {
				className: "lp-bp-slash",
				"aria-hidden": true
			}, "/") : null, bp ? h$43("input", {
				className: "lp-input",
				inputMode: "decimal",
				value: dbp,
				placeholder: "舒张压",
				"aria-label": "舒张压（低压）",
				onChange: (event) => setDbp(event.target.value)
			}) : null, bp ? h$43("span", { className: "lp-unit" }, "mmHg") : h$43(UnitSelect, {
				id: `${props.idPrefix}-${props.selfKey}-unit`,
				spec,
				value: unit,
				label: `${spec.label_zh}的单位`,
				onChange: setUnit
			}), h$43(Btn$1, {
				type: "submit",
				size: "sm",
				disabled: busy
			}, busy ? "记录中" : "记录"));
		}
		//#endregion
		//#region src/client/journey-steps.ts
		const h$42 = react.default.createElement;
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
				return h$42(tag, { className: "lp-status" }, h$42("span", {
					className: `lp-statusdot ${partial ? "lp-statusdot-warn" : "lp-statusdot-on"}`,
					"aria-hidden": true
				}), `已有 ${records.indicator_count} 项指标${records.latest_checkup ? ` · 最近一次体检 ${chineseDate(records.latest_checkup)}` : ""}${partial ? " · 部分记录本次未读取到" : ""}`);
			}
			if (records.status === "error") return h$42(tag, { className: "lp-status" }, h$42("span", {
				className: "lp-statusdot lp-statusdot-bad",
				"aria-hidden": true
			}), `记录读取失败：${records.error || "原因不明"}`);
			return h$42(tag, { className: "lp-status" }, h$42("span", {
				className: "lp-statusdot",
				"aria-hidden": true
			}), recordConnected(records.status) ? "还没有体检记录" : "尚未连接健康数据服务（可在「档案」的「数据连接」中重新连接）");
		}
		//#endregion
		//#region src/client/onboarding.ts
		const h$41 = react.default.createElement;
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
			return h$41("div", {
				className: "lp-stepper",
				"aria-label": `第 ${props.step + 1} 步，共 ${ONBOARDING_TITLES.length} 步`
			}, ...STEP_NAMES.map((title, index) => h$41("div", {
				key: index,
				className: `lp-stepper-item${index === props.step ? " is-now" : index < props.step ? " is-done" : ""}`
			}, h$41("span", { className: "lp-stepper-dot" }, index < props.step ? h$41(Icon, {
				name: "check",
				size: 12
			}) : String(index + 1)), h$41("span", { className: "lp-stepper-label" }, title))));
		}
		/** Chat needs a model key: said only when LongPi could tell none is configured. */
		function ModelHint(props) {
			if (useModelStatus() !== "missing") return null;
			return h$41("div", {
				className: "lp-callout lp-callout-info",
				role: "note"
			}, h$41(Icon, {
				name: "info",
				size: 16
			}), h$41("div", { className: "lp-callout-body" }, h$41("p", null, "对话功能需要先在 DSH 设置里填写模型的 API Key。"), props.onOpen ? h$41(Btn$1, {
				variant: "outline",
				onClick: props.onOpen
			}, "去设置") : h$41("p", { className: "lp-caption" }, "在左下角「设置 → 模型」中填写。")));
		}
		function NotRead(props) {
			return h$41(OnboardingModal, {
				title: "数据暂时没有加载出来",
				onClose: props.onLater
			}, h$41("div", { className: "lp lp-onb" }, h$41("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, "数据暂时没有加载出来"), h$41("p", { className: "lp-onb-text" }, "可能是刚启动，稍等几秒后点「重试」。"), h$41("div", { className: "lp-onb-actions" }, h$41(Btn$1, {
				variant: "outline",
				onClick: props.onLater
			}, "稍后再说"), h$41(Btn$1, {
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
			return h$41("div", { className: "lp-onb-body" }, h$41(ModelHint, { onOpen: props.openSettings }), h$41("p", { className: "lp-onb-text" }, "LongPi 帮你管理自己的健康数据：根据体检结果估算身体年龄和 10 年心血管风险，并跟踪你的改善计划执行得怎么样。"), h$41("p", { className: "lp-onb-text" }, "它只提供健康管理参考，不做诊断，不开处方，也不给出用药剂量。"), h$41("p", { className: "lp-onb-text" }, "你的档案和记录只保存在这台电脑上。你提问时，回答所需的健康数值会发送给 DeepSeek 模型处理，不包含你的姓名。"), h$41("label", {
				className: "lp-checkrow",
				htmlFor: "lp-onb-agree"
			}, h$41("input", {
				id: "lp-onb-agree",
				type: "checkbox",
				checked: agreed,
				disabled: busy,
				onChange: (e) => setAgreed(e.target.checked)
			}), h$41("span", null, "我同意 LongPi 按上述方式使用我的体检、化验、血压、血糖、体重和用药等健康信息。")), h$41("p", { className: "lp-caption" }, "可以随时在「设置 → LongPi → 隐私与数据」中撤回。"), error ? h$41("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$41("div", { className: "lp-onb-actions" }, h$41(Btn$1, {
				variant: "outline",
				onClick: props.onLater,
				disabled: busy
			}, "以后再说"), h$41(Btn$1, {
				"data-modal-autofocus": true,
				disabled: !agreed || busy,
				onClick: () => {
					setBusy(true);
					setError("");
					agreeAll().then(props.onDone).catch((err) => setError(`保存失败：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
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
			return h$41("div", { className: "lp-onb-body" }, h$41("p", { className: "lp-onb-text" }, "计算身体年龄需要你的年龄和性别。"), h$41("div", { className: "lp-form-grid" }, h$41("label", { className: "lp-field" }, h$41("span", { className: "lp-field-label" }, "年龄（周岁）"), h$41("input", {
				className: "lp-input",
				inputMode: "numeric",
				placeholder: "例如 45",
				value: age,
				disabled: busy,
				"data-modal-autofocus": true,
				onChange: (e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))
			})), h$41("div", { className: "lp-field" }, h$41("span", {
				className: "lp-field-label",
				id: "lp-onb-sex"
			}, "性别"), h$41("div", {
				className: "lp-seg",
				role: "radiogroup",
				"aria-labelledby": "lp-onb-sex"
			}, ...["male", "female"].map((value) => h$41("button", {
				key: value,
				type: "button",
				role: "radio",
				"aria-checked": sex === value,
				disabled: busy,
				className: `lp-seg-item${sex === value ? " is-on" : ""}`,
				onClick: () => setSex(value)
			}, value === "male" ? "男" : "女"))))), h$41("p", { className: "lp-caption" }, "其他问题（如是否吸烟、有无糖尿病）会在计算心血管风险需要时再问。"), error ? h$41("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$41("div", { className: "lp-onb-actions" }, h$41(Btn$1, {
				variant: "outline",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过"), h$41(Btn$1, {
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
					}).catch((err) => setError(`保存失败：${errorText(err, "请稍后再试")}`)).finally(() => setBusy(false));
				}
			}, busy ? "正在保存…" : "下一步")));
		}
		function FirstData(props) {
			const [none, setNone] = react.default.useState(false);
			const [read, setRead] = react.default.useState("");
			return h$41("div", { className: "lp-onb-body" }, h$41("p", { className: "lp-onb-text" }, "上传一份体检或化验报告，LongPi 会读取其中的指标，算出你的第一个结果。"), h$41(ReportUpload, {
				simple: true,
				quiet: none,
				onDone: (text) => {
					setRead(text || "已读取这份报告。");
					notifyChanged();
				}
			}), !read && !none ? h$41("div", { className: "lp-onb-center" }, h$41("button", {
				type: "button",
				className: "lp-textbtn lp-textbtn-strong",
				onClick: () => setNone(true)
			}, "我现在没有报告 →")) : null, none && !read ? h$41("div", { className: "lp-callout lp-callout-info" }, h$41(Icon, {
				name: "info",
				size: 16
			}), h$41("div", { className: "lp-callout-body" }, h$41("p", { className: "lp-callout-title" }, "没有报告也可以先开始："), h$41("ul", { className: "lp-bullets" }, h$41("li", null, "记录一次血压或腰围"), h$41("li", null, "在健康对话里说说你想改善什么（睡眠、体重、血糖……）")), h$41("p", { className: "lp-caption" }, "以后拿到体检报告，随时在「健康」页上传。"))) : null, h$41("div", { className: "lp-onb-actions" }, none && !read ? h$41(Btn$1, {
				variant: "outline",
				onClick: props.openChat
			}, "前往健康对话") : null, h$41(Btn$1, {
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
				return h$41(NotRead, {
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
			return h$41(OnboardingModal, {
				title: ONBOARDING_TITLES[step] ?? ONBOARDING_TITLES[0],
				onClose: finish
			}, h$41("div", {
				className: "lp lp-onb",
				ref: content
			}, h$41(Progress, { step }), h$41("h2", {
				className: "lp-onb-title",
				tabIndex: -1
			}, ONBOARDING_TITLES[step]), step === 0 ? h$41(Welcome, {
				onDone: () => setStep(1),
				onLater: finish,
				openSettings
			}) : null, step === 1 ? h$41(BasicInfo, {
				journey,
				onDone: () => setStep(2),
				onSkip: () => setStep(2)
			}) : null, step === 2 ? h$41(FirstData, {
				onFinish: finish,
				openChat,
				consentAt: journey.consent.accepted_at ?? ""
			}) : null));
		}
		function OnboardingModal(props) {
			return h$41(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: props.title,
				onClose: props.onClose,
				headless: true,
				className: "lp-onb-dialog"
			}, props.children);
		}
		//#endregion
		//#region src/ux/plain.ts
		const SEASON_INTRO = "一个赛季 8 周，也可以设成到下次复查为止。一个赛季做 2–4 个两周的小实验：三选一，做，揭晓。";
		const CODEX_INTRO = "长寿图鉴有三部分：图书馆里的研究卡随时可读；两周的个人小实验，做完翻开看自己的结果；做到的事记成足迹卡。";
		const SCIENCE_INTRO = "LongPi 的用户共同研究如何延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。";
		const OUTBOX_ZH = "研究正式开始后才会发出，现在只保存在你的设备上。";
		const JUDGEMENT = {
			beyond: "超出正常波动（比你平时的波动更大，建议咨询医生。不是急症。）",
			within: "在正常波动范围内（尚不能视为真实变化）",
			too_early: "太早（距上次检测时间过短，目前的变化多为正常波动）",
			not_comparable: "不可比（两次检测不在同一家机构，无法直接比较）",
			unjudged: "暂不能下结论（请查看缺少的环节）"
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
		/** 「9 月 10 日」, with the year when it is not this year (docs/design-system.md). `today` fixes "this year" for tests. */
		function dateZh$1(iso, today) {
			const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
			if (!m) return iso ?? "";
			const md = `${Number(m[2])} 月 ${Number(m[3])} 日`;
			const year = today && /^\d{4}/.test(today) ? Number(today.slice(0, 4)) : (/* @__PURE__ */ new Date()).getFullYear();
			return Number(m[1]) === year ? md : `${m[1]} 年 ${md}`;
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
				lead: `${trimNum(first.value)}${unitText} · 1 次 · ${dateZh$1(first.date)}`
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
				lead: `${trimNum(first.value)} → ${trimNum(last.value)}${unitText}${pctText} · ${rows.length} 次 · ${dateZh$1(first.date)}–${dateZh$1(last.date)}`
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
			if (sleep != null && Number.isFinite(sleep)) bits.push(`昨晚睡眠 ${trimNum(sleep)} 小时`);
			if (steps != null && Number.isFinite(steps)) bits.push(`今日步数 ${trimNum(steps)} 步`);
			const lab = input.labNote ? `结合化验结果：${input.labNote}` : "手环数据反映近一两天的情况，化验通常间隔数周检测一次，两者宜分开解读。";
			return `${bits.join("，")}。${lab}`;
		}
		/** Questions in the person's own voice, about what changed and the next visit. */
		function suggestedQuestions(input) {
			const names = (input.changes ?? []).filter(Boolean).slice(0, 2);
			return [
				names.length > 0 ? `${names.join("、")}与上次相比变化了多少？` : "与上次相比，哪些项目有变化？",
				input.visit ? `下次 ${dateZh$1(input.visit)}就诊时，我应该询问哪些问题？` : "下次就诊时，我应该询问哪些问题？",
				"我现在应优先做哪一件？"
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
				detail_zh: row.note || "当天有化验记录"
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
			[/Mirobody/gi, "健康数据服务"],
			[/longevity-skills/gi, ""],
			[/\bMCP\b/g, ""],
			[/\/mcp\/\S*/g, ""],
			[/\bDSH\b/g, ""],
			[/HARNESS/gi, ""],
			[/\bLOINC\b/g, ""],
			[/\bRCV\b/g, "正常波动"],
			[/\bCVI\b/g, "个体波动"],
			[/ChiCTR/g, ""],
			[/签署密钥/g, ""],
			[/参考变化值/g, "平时的波动"],
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
			[/\bTHE PATTERN\b/g, "数据显示"],
			[/\bWHAT WE DON'T KNOW\b/g, "数据尚不能说明的"],
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
		const h$40 = react.default.createElement;
		/** The trend, with the RCV band around the value it was compared from: points outside the band are the change. */
		function Spark(props) {
			const { row } = props;
			if (row.points.length < 2) return null;
			const base = row.compare.from;
			const dated = row.compare.from_date !== "";
			return h$40("div", { className: "lp-change-spark" }, h$40(LineChart, {
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
		const VERDICT_ZH$1 = {
			better: "变好",
			worse: "变差",
			unclear: "需结合参考范围"
		};
		function ChangeChip(props) {
			const tone = props.verdict === "better" && !props.askDoctor ? "good" : props.verdict === "worse" || props.askDoctor ? "warn" : "neutral";
			return h$40("span", { className: `lp-badge lp-badge-${tone}` }, h$40(Icon, {
				name: tone === "good" ? "check" : tone === "warn" ? "warn" : "info",
				size: 12
			}), VERDICT_ZH$1[props.verdict]);
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
			return h$40("li", { className: "lp-notable-row" }, h$40(ChangeChip, {
				verdict: row.verdict,
				askDoctor: row.ask_doctor
			}), h$40("span", { className: "lp-strong" }, row.label_zh), h$40("span", { className: "lp-num lp-notable-values" }, plainUnits(row.compare.from === row.compare.to ? `${row.compare.to} ${row.unit}`.trim() : `${pairText(row.compare.from, row.compare.to)} ${row.unit}`.trim())), h$40(Spark, { row }));
		}
		/** The one plain sentence behind 判断依据 (INT062 fix 7): what "超出正常波动" means, and what it is not. */
		const BASIS_ZH = "「超出正常波动」指两次结果的差异大于同一个人平常的起伏。不同医院、不同仪器之间的差异未计入。这不是诊断。";
		/**
		* 判断依据: one plain sentence and where the fluctuation data comes from. Method notes (CV scales, instrument
		* error, how wide a band may be) are for the chat's tool text, not for this fold.
		*/
		function Basis(props) {
			const { rows } = props;
			const unjudged = props.journey.changes_unjudged;
			if (rows.length === 0 && unjudged.length === 0) return null;
			const sources = distinct(rows.map((row) => row.source), (source) => source.url || source.title);
			return h$40("details", { className: "lp-basis" }, h$40("summary", null, "判断依据"), h$40("div", { className: "lp-change-notes" }, h$40("p", { className: "lp-caption" }, BASIS_ZH), unjudged.length > 0 ? h$40("p", { className: "lp-caption" }, `以下指标本次未完整读取，暂不判断：${unjudged.map((row) => row.label_zh).join("、")}。`) : null, sources.length > 0 ? h$40("p", { className: "lp-caption lp-change-source" }, "数据来源：", ...sources.flatMap((source, index) => [index > 0 ? "；" : null, source.url ? h$40("a", {
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
			const pointer = onCard.length > 0 ? `${onCard[0]?.label_zh ?? ""}${onCard.length > 1 ? `等 ${onCard.length} 项` : ""}的变化，即上方「最重要的一步」所指的情况。` : "";
			return h$40("section", {
				className: "lp-card lp-notable",
				id: "lp-changes",
				"aria-labelledby": "lp-changes-title"
			}, h$40("div", { className: "lp-card-head" }, h$40("h3", {
				className: "lp-card-title",
				id: "lp-changes-title"
			}, "值得注意的变化", rows.length > 0 ? h$40("span", { className: "lp-caption" }, `${rows.length} 项超出正常波动`) : null), h$40("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: props.onOpenIndicators
			}, "在「化验」中查看全部 →")), pointer ? h$40("p", { className: "lp-caption" }, pointer) : null, ...advice.map((group) => h$40("div", {
				key: group.advice,
				className: "lp-callout lp-callout-warn"
			}, h$40(Icon, {
				name: "warn",
				size: 14
			}), h$40("span", null, group.advice))), shown.length > 0 ? h$40("ul", { className: "lp-notable-list" }, ...shown.map((row) => h$40(NotableRow, {
				key: row.key,
				row
			}))) : pointer ? null : h$40("p", { className: "lp-muted" }, "没有超出正常波动的变化。"), h$40(Basis, {
				journey: props.journey,
				rows
			}));
		}
		//#endregion
		//#region src/client/indicators.ts
		const h$39 = react.default.createElement;
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
			return `正常波动：+${fmt$1(biovar.band_pct.up, 1)}% / ${fmt$1(biovar.band_pct.down, 1)}%（个体内变异 ${fmt$1(biovar.cvi_pct, 1)}%）。两次结果的差异在此范围内时，多半属于测量误差和生理波动。`;
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
			if (points.length < 2) return h$39("span", {
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
			return h$39("svg", {
				width,
				height,
				className: "lp-spark",
				role: "img",
				"aria-label": `${props.label}趋势：${points.map((point) => `${dateZh$2(point.date)} ${fmtAuto(point.value)}`).join("，")}`
			}, h$39("path", {
				d: path,
				className: "lp-spark-line"
			}), h$39("circle", {
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
				return h$39("span", {
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
				return h$39("span", {
					className: `lp-badge lp-badge-${tone}`,
					title: full
				}, judgementText(kind, false));
			}
			if (kind === "within") return h$39("span", {
				className: "lp-badge lp-badge-good",
				title: full
			}, judgementText(kind, false));
			if (kind === "unjudged") {
				const why = row.read_error ? "此项未读取到" : row.points.length < 2 ? "只有一次结果，还不能下结论" : "还缺比较要用的信息，还不能下结论";
				return h$39("span", {
					className: "lp-caption",
					title: why,
					"aria-label": judgementText(kind, false)
				}, "—");
			}
			return h$39("span", {
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
			const missed = row.read_error ? scrubVisible(row.read_error).replace(/没有在 \d+ 秒内返回这一项/, "本次未读取到，请稍后刷新") : "";
			const unit = unitText(row.unit);
			const when = row.latest ? dateZh$2(row.latest.date) : "";
			return h$39("li", { className: `lp-ind-row ${props.open ? "lp-ind-open" : ""}` }, h$39("button", {
				type: "button",
				className: "lp-ind-btn",
				"aria-expanded": props.open,
				"aria-controls": `lp-ind-panel-${slug}`,
				onClick: props.onToggle
			}, h$39("span", { className: "lp-ind-name" }, h$39("span", {
				className: "lp-ind-label",
				title: cleanLabel$1(row.label_zh)
			}, cleanLabel$1(row.label_zh)), row.plan_marker ? h$39("span", { className: "lp-tag" }, "方案") : null), missed ? h$39("span", { className: "lp-ind-value" }, h$39("span", {
				className: "lp-ind-error",
				title: missed
			}, h$39(Icon, {
				name: "warn",
				size: 12
			}), "未读取到")) : h$39("span", { className: "lp-ind-value" }, h$39("span", { className: "lp-ind-num" }, unit.startsWith("%") ? `${latestText(row)}${unit}` : latestText(row)), h$39("span", { className: "lp-ind-unit" }, unit.startsWith("%") ? "" : unit)), h$39("span", { className: "lp-ind-date lp-caption" }, missed || !when ? "—" : when), h$39("span", { className: "lp-ind-spark" }, missed ? h$39("span", { className: "lp-caption" }, "—") : h$39(Sparkline, {
				points: row.points,
				label: row.label_zh
			})), h$39("span", { className: "lp-ind-judged" }, missed ? h$39("span", { className: "lp-caption" }, "—") : h$39(JudgedChip, {
				row,
				gate: props.gate,
				reason: props.reason
			})), h$39("span", { className: "lp-ind-source" }, SOURCE_ZH[row.source] ?? "—"), h$39(Icon, {
				name: "chevron",
				size: 14,
				className: "lp-ind-chevron"
			})), props.open ? h$39(DetailPanel, {
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
			const body = state.loading && !state.detail ? h$39(Skeleton, { height: 120 }) : !state.detail ? h$39(LoadError, {
				what: `${props.row.label_zh}的历次数值`,
				error: state.error,
				compact: true,
				onRetry: () => setAttempt((count) => count + 1)
			}) : h$39(DetailBody, { detail: state.detail });
			return h$39("div", {
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
			return h$39("div", { className: "lp-ind-detail" }, move ? h$39("p", { className: "lp-small lp-num" }, tidy$1(move.lead)) : null, row.read_error ? h$39("p", { className: "lp-blocker lp-blocker-bad" }, `此项本次未读取到：${row.read_error}。以下为已读取的部分。`) : null, row.change?.text_zh ? h$39("p", { className: "lp-muted" }, tidy$1(row.change.text_zh)) : null, numeric.length > 1 && units.length <= 1 ? h$39(LineChart, {
				points: numeric.map((point) => ({
					date: point.date,
					value: point.value
				})),
				unit: unitText(units[0] ?? row.unit),
				label: row.label_zh,
				height: 150,
				digits
			}) : null, row.range_zh ? h$39("p", { className: "lp-caption" }, tidy$1(row.range_zh)) : null, noiseSentence(props.detail) ? h$39("p", { className: "lp-caption" }, noiseSentence(props.detail), biovar?.source.url ? h$39(react.default.Fragment, null, " 来源：", h$39("a", {
				href: biovar.source.url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: biovar.source.title || void 0
			}, sourceLabel(biovar.source.title))) : biovar?.source.title ? ` 来源：${sourceLabel(biovar.source.title)}` : "", biovar?.source.doi ? ` · doi:${biovar.source.doi}` : "") : biovar && (row.gate === "too_early" || (row.reason_zh ?? "").startsWith("太早")) ? h$39("p", { className: "lp-caption" }, reasonBesideChip(row.gate, row.reason_zh) || "距上次检测尚未达到此项的最短复测间隔。") : biovar && row.judged === "changed" ? h$39("p", { className: "lp-caption" }, "两次结果之差超出了上面的正常波动范围。") : h$39("p", { className: "lp-caption" }, row.range_zh ? "此项缺少用于比较两次变化的波动数据，上方已按参考范围标注偏低或偏高。" : row.source === "checkup" ? "此项未收录个体正常波动数据，无法区分真实变化与波动，因此不作判断。" : "手环和自测数据按周均值或日值显示趋势，不作正常波动判断。"), biovar ? h$39("p", { className: "lp-caption" }, `研究里用来判断变化的范围：+${fmt$1(biovar.band_pct.up, 1)}% / ${fmt$1(biovar.band_pct.down, 1)}%（来源：${sourceLabel(biovar.source.title)}）`) : null, biovar?.caveat_zh && !row.gate ? h$39("p", { className: "lp-caption" }, biovar.caveat_zh) : null, points.length > 0 ? h$39("div", { className: "lp-table-wrap" }, h$39("table", { className: "lp-table" }, h$39("caption", { className: "lp-sr" }, `${row.label_zh}历次数值`), h$39("thead", null, h$39("tr", null, ...[
				"日期",
				"数值",
				"单位",
				"来源"
			].map((cell) => h$39("th", {
				key: cell,
				scope: "col",
				className: cell === "数值" ? "lp-td-num" : void 0
			}, cell)))), h$39("tbody", null, ...[...points].reverse().map((point, index) => h$39("tr", { key: `${point.date}-${index}` }, h$39("td", null, dateZh$2(point.date)), h$39("td", { className: "lp-td-num" }, point.text ?? (point.value == null ? "—" : fmt$1(point.value, digits))), h$39("td", null, unitText(point.unit) || "—"), h$39("td", { className: "lp-caption" }, point.file ?? SOURCE_ZH[row.source])))))) : h$39("p", { className: "lp-muted" }, "没有可显示的数值。"), numeric.length > 1 && units.length > 1 ? h$39(TableTwin, {
				caption: row.label_zh,
				head: ["日期", "数值"],
				rows: numeric.map((point) => [dateZh$2(point.date), withUnit$1(fmt$1(point.value, digits), unitText(point.unit))])
			}) : null);
		}
		function Loading$1() {
			return h$39("div", {
				className: "lp-tab-body",
				"aria-busy": true,
				"aria-label": "正在读取指标"
			}, h$39(Skeleton, {
				height: 32,
				width: 320
			}), h$39("div", { className: "lp-card" }, ...[
				0,
				1,
				2,
				3,
				4
			].map((index) => h$39(Skeleton, {
				key: index,
				height: 32,
				className: "lp-ind-skeleton"
			}))));
		}
		/** An empty state in a card: icon, title, one sentence, and a button only when there is somewhere to go. */
		function EmptyCard(props) {
			return h$39("div", { className: "lp-card" }, h$39("div", { className: "lp-empty" }, h$39(Icon, {
				name: props.icon,
				size: 20
			}), h$39("div", { className: "lp-empty-title" }, props.title), h$39("p", { className: "lp-empty-text" }, props.text), props.action ? h$39(Btn$1, {
				variant: "outline",
				size: "md",
				onClick: props.action.onClick
			}, props.action.label) : null));
		}
		const AREA_EMPTY = {
			sleep: {
				icon: "pulse",
				title: "还没有睡眠数据",
				text: "连接手环或导入睡眠记录后，这里会列出睡眠时长和变化趋势。"
			},
			training: {
				icon: "flame",
				title: "还没有运动数据",
				text: "连接手环或导入运动记录后，这里会列出步数、活动量和变化趋势。"
			}
		};
		function Empty(props) {
			const none = props.data.record.status === "none";
			const action = props.onConnect ? {
				label: "连接记录",
				onClick: props.onConnect
			} : void 0;
			if (props.area !== "labs") return h$39(EmptyCard, {
				...AREA_EMPTY[props.area],
				action: action && !none ? {
					...action,
					label: "查看数据连接"
				} : action
			});
			return h$39(EmptyCard, {
				icon: "flask",
				title: "还没有化验数据",
				text: "上传体检报告后，这里会列出每项化验及其变化，并判断变化是否超出正常波动。",
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
		const JUDGEMENT_HELP = "超出正常波动：变化大于你平常的起伏，建议咨询医生，但不属于急症。在正常波动范围内：变化没有实际意义。太早：距上次检测时间过短。不可比：两次检测不在同一机构。还不能下结论：请查看缺少哪一步。";
		function IndicatorsTab(props) {
			const { data, loading, error } = useIndicators();
			const gates = useGates(data?.updated_at);
			const [open, setOpen] = react.default.useState(null);
			const area = props.area ?? "labs";
			if (!data && loading) return h$39(Loading$1);
			if (!data) return h$39("div", { className: "lp-tab-body" }, h$39(LoadError, {
				what: "指标",
				error,
				onRetry: () => reload("indicators")
			}));
			if (data.groups.length === 0 && data.record.status === "error") return h$39("div", { className: "lp-tab-body" }, h$39(LoadError, {
				what: "体检记录",
				error: data.record.error || null,
				onRetry: () => reload("indicators")
			}));
			const all = data.groups.flatMap((group) => group.indicators).filter((row) => lifeAreaOf(row.label_zh) === area || area === "labs" && row.source !== "device");
			if (all.length === 0) return h$39("div", { className: "lp-tab-body" }, h$39(Empty, {
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
			const latestLine = lastDate ? `${area === "labs" ? "最近一次体检" : "最近一次"} ${dateZh$2(lastDate)}` : "";
			return h$39("div", { className: "lp-tab-body" }, data.record.status === "partial" || data.record.status === "error" ? h$39("div", {
				className: "lp-callout lp-callout-warn",
				role: "note"
			}, h$39(Icon, {
				name: "warn",
				size: 14
			}), h$39("div", { className: "lp-callout-body" }, `部分记录本次未读取到${data.record.error ? `：${data.record.error}` : failed > 0 ? `（${failed} 项）` : ""}。标有「未读取到」的指标并非未检测，请稍后刷新重试。`)) : null, h$39("div", { className: "lp-ind-toolbar" }, h$39("div", {
				className: "lp-seg",
				role: "group",
				"aria-label": "筛选指标"
			}, ...filters.map((row) => {
				const count = all.filter(row.test).length;
				const on = filter.key === row.key;
				return h$39("button", {
					key: row.key,
					type: "button",
					className: `lp-seg-item ${on ? "is-on" : ""}`,
					"aria-pressed": on,
					disabled: count === 0 && !on,
					onClick: () => props.onFilter(row.key)
				}, row.label, h$39("span", { className: "lp-seg-count" }, String(count)));
			})), latestLine ? h$39("span", { className: "lp-caption lp-ind-meta" }, latestLine, judgedAny ? h$39(Info, {
				label: "和正常波动比",
				align: "end"
			}, JUDGEMENT_HELP) : null) : null), groups.length === 0 ? h$39(EmptyCard, {
				icon: "check",
				title: `没有「${filter.label}」的指标`,
				text: "请更换筛选条件。",
				action: {
					label: "查看全部",
					onClick: () => props.onFilter("all")
				}
			}) : h$39("div", { className: `lp-card lp-ind-card ${judgedAny ? "" : "lp-ind-nojudge"} ${oneSource ? "lp-ind-nosource" : ""}`.replace(/\s+/g, " ").trim() }, h$39("div", {
				className: "lp-ind-head",
				"aria-hidden": true
			}, h$39("span", null, "指标"), h$39("span", { className: "lp-ind-value" }, h$39("span", { className: "lp-ind-num" }, "最近一次"), h$39("span", null)), h$39("span", { className: "lp-ind-date" }, "日期"), h$39("span", null, "趋势"), h$39("span", { className: "lp-ind-head-judged" }, "和正常波动比"), h$39("span", { className: "lp-ind-source" }, "来源"), h$39("span", null)), ...groups.map((group) => h$39("section", {
				key: group.key,
				className: "lp-ind-group",
				"aria-label": group.label_zh
			}, h$39("h3", { className: "lp-ind-group-title" }, group.label_zh, h$39("span", { className: "lp-optional" }, `${group.indicators.length} 项`)), h$39("ul", { className: "lp-ind-list" }, ...group.indicators.map((row) => h$39(IndicatorLine, {
				key: row.id,
				row,
				open: open === row.id,
				...gateOf(row),
				onToggle: () => setOpen((current) => current === row.id ? null : row.id)
			})))))), h$39("p", { className: "lp-fine" }, "点击任一行，可查看历次数值、单位、来源报告及正常波动依据。"));
		}
		//#endregion
		//#region src/client/health-chat.ts
		const h$38 = react.default.createElement;
		let opener$1 = null;
		function setWorkspaceOpener(fn) {
			opener$1 = fn;
		}
		let workspaceId = null;
		function healthWorkspaceId() {
			workspaceId ??= getJson("/api/longpi/workspace").then((v) => {
				if (!v.workspace_id) workspaceId = null;
				return v.workspace_id;
			}).catch(() => {
				workspaceId = null;
				return null;
			});
			return workspaceId;
		}
		/**
		* Open a session in 健康对话 (a blank one when there is one), where LongPi's persona and tools are; a prompt the
		* page queued is put into its composer there. False when DSH cannot open workspaces or there is no 健康对话.
		*/
		async function openHealthChat() {
			const id = await healthWorkspaceId();
			if (!id || !opener$1) return false;
			try {
				await opener$1(id);
				return true;
			} catch {
				return false;
			}
		}
		function HealthChatButton() {
			const [id, setId] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			react.default.useEffect(() => {
				getJson("/api/longpi/workspace").then((v) => setId(v.workspace_id)).catch(() => setId(null));
			}, []);
			if (!id || !opener$1) return null;
			return h$38("span", { className: "lp-healthchat" }, h$38("button", {
				type: "button",
				className: "lp-linkbtn lp-healthchat-btn",
				onClick: () => {
					setError("");
					opener$1?.(id).catch(() => setError("未能打开，请在左侧「健康对话」中新建会话"));
				}
			}, h$38(Icon, {
				name: "send",
				size: 14
			}), "前往健康对话"), error ? h$38("span", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null);
		}
		//#endregion
		//#region src/client/intro.ts
		const h$37 = react.default.createElement;
		let seen = null;
		let loading = null;
		const listeners$3 = /* @__PURE__ */ new Set();
		const emit$1 = () => {
			for (const fn of listeners$3) fn();
		};
		function load() {
			if (loading) return;
			loading = getJson("/api/longpi/intro").then((v) => {
				seen = Boolean(v.seen);
			}).catch(() => {
				seen = true;
			}).finally(emit$1);
		}
		/** null while unknown, then whether this install's welcome was already seen. */
		function useIntroSeen() {
			const [, tick] = react.default.useReducer((n) => n + 1, 0);
			react.default.useEffect(() => {
				listeners$3.add(tick);
				load();
				return () => {
					listeners$3.delete(tick);
				};
			}, []);
			return seen;
		}
		function markIntroSeen() {
			if (seen === true) return;
			seen = true;
			emit$1();
			postJson("/api/longpi/intro", {}).catch(() => void 0);
		}
		/** The sidebar icon with a dot while the welcome has not been seen. */
		function IntroDot(props) {
			const isSeen = useIntroSeen();
			return h$37("span", { className: "lp lp-intro-icon" }, props.children, isSeen === false ? h$37("span", {
				className: "lp-intro-dot",
				"aria-label": "新"
			}) : null);
		}
		function Card$1(props) {
			if (useIntroSeen() !== false || props.pageShowing) return null;
			return h$37("div", {
				className: "lp lp-intro-card",
				role: "dialog",
				"aria-modal": false,
				"aria-labelledby": "lp-intro-title"
			}, h$37("div", { className: "lp-intro-head" }, h$37("span", { className: "lp-pill-mark" }, h$37(Mark, { size: 14 })), h$37("p", {
				className: "lp-intro-title",
				id: "lp-intro-title"
			}, "已安装 LongPi 健康"), h$37("button", {
				type: "button",
				className: "lp-iconbtn lp-intro-x",
				"aria-label": "关闭",
				onClick: markIntroSeen
			}, h$37(Icon, {
				name: "close",
				size: 14
			}))), h$37("p", { className: "lp-intro-text" }, "左侧新增了「健康」入口：上传体检报告后，可以查看身体年龄、心血管风险和各项指标的变化，并制定改善方案。"), h$37("p", { className: "lp-caption" }, "也可以先打开示例档案，了解档案完整后的效果。"), h$37("div", { className: "lp-intro-actions" }, h$37(Btn$1, {
				variant: "outline",
				size: "sm",
				onClick: markIntroSeen
			}, "知道了"), h$37(Btn$1, {
				size: "sm",
				onClick: () => props.openPage?.()
			}, "打开健康页")));
		}
		function WithPanelInfo$1(props) {
			const active = props.usePanelInfo((info) => info.activePanelId === PANEL_ID);
			const showing = usePageShowing();
			return h$37(Card$1, {
				...props,
				pageShowing: active || showing
			});
		}
		function WithoutPanelInfo$1(props) {
			return h$37(Card$1, {
				...props,
				pageShowing: usePageShowing()
			});
		}
		/** The one-time welcome card in the shell overlay. */
		function IntroCard(props) {
			return typeof props.usePanelInfo === "function" ? h$37(WithPanelInfo$1, {
				...props,
				usePanelInfo: props.usePanelInfo
			}) : h$37(WithoutPanelInfo$1, props);
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
			false: "今天未完成",
			null: "已撤销今天的记录"
		};
		function saidText(title, state) {
			return state === null ? `「${title}」${SAID.null}。` : `已记录：${title}，${SAID[String(state)]}。`;
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
						const text = `未能记录「${title}」：${errorText(err, "请稍后再试")}`;
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
		const h$36 = react.default.createElement;
		/**
		* The answer controls for one item: 完成 and 没做到 while unanswered; the
		* answer and 撤销 once given. Every state carries words, never color alone.
		*/
		function CheckChoices(props) {
			const { state, busy } = props;
			if (state === null) return h$36("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$36("button", {
				type: "button",
				className: "lp-choice lp-choice-done",
				disabled: busy,
				onClick: () => props.onAnswer(true)
			}, h$36(Icon, {
				name: "check",
				size: 13,
				strokeWidth: 2
			}), busy ? "记录中" : "完成"), h$36("button", {
				type: "button",
				className: "lp-choice",
				disabled: busy,
				onClick: () => props.onAnswer(false)
			}, "未完成"));
			return h$36("span", {
				className: "lp-choices",
				role: "group",
				"aria-label": `${props.title}：今天`
			}, h$36("span", { className: `lp-badge ${state ? "lp-badge-good" : "lp-badge-neutral"}` }, h$36(Icon, {
				name: state ? "check" : "close",
				size: 12,
				strokeWidth: 2
			}), state ? "已完成" : "未完成"), h$36("button", {
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
				why_zh: "糖化血红蛋白反映近 3 个月的平均血糖，两次检测至少间隔 90 天。"
			};
			if (k === "phenoage" || k === "bioage" || k === "bodyage") return {
				minDays: 90,
				earliestDays: 90,
				recommendedDays: 180,
				family: "bioage",
				why_zh: "身体年龄的测量波动大约有两三岁。间隔 3 到 6 个月、在同一家实验室复测，才能区分是否为真实变化。"
			};
			if (k === "vitd" || k === "vitamin_d" || k === "25ohd" || k.includes("vitd")) return {
				minDays: 90,
				earliestDays: 90,
				recommendedDays: 90,
				family: "vitamin_d",
				why_zh: "维生素 D 至少间隔 90 天复测，更早出现的变化通常属于波动。"
			};
			if (LIPIDS.has(k)) return {
				minDays: 56,
				earliestDays: 56,
				recommendedDays: 84,
				family: "lipids",
				why_zh: "血脂的真实变化通常需要 8–12 周才能显现。"
			};
			if (k === "glucose" || k === "fpg" || k === "fasting_glucose") return {
				minDays: 56,
				earliestDays: 56,
				recommendedDays: 84,
				family: "glucose",
				why_zh: "空腹血糖的真实变化通常需要 8–12 周才能显现。"
			};
			if (k === "weight" || k === "bmi" || k === "bodymass") return {
				minDays: 56,
				earliestDays: 56,
				recommendedDays: 84,
				family: "weight",
				why_zh: "体重的真实变化通常需要 8–12 周才能显现。"
			};
			return {
				minDays: 28,
				earliestDays: 28,
				recommendedDays: 56,
				family: "other",
				why_zh: "此项至少间隔 4 周复测，才能区分波动与真实变化。"
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
				why_zh: `复测已在 ${dateZh$1(done, today)}完成。`
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
			if (!/你确实年轻了|计算结果小了/.test(text)) return {};
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
			return `模型估计：${label}${Number.isFinite(targetNum) && Number.isFinite(fromNum) && targetNum < fromNum ? "降到" : "到"} ${target}${years == null || !Number.isFinite(years) ? "" : years < -.05 ? `，身体年龄约年轻 ${showYears(-years)} 岁` : years > .05 ? `，身体年龄约增加 ${showYears(years)} 岁` : "，身体年龄基本不变"}。`;
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
			if (/adherence|执行/.test(blocked)) parts.push(grade === "beyond_band_better" || grade === "beyond_band_worse" ? "执行记录不足，本次变化不能归因于方案。" : "执行记录不足，本次不评价方案本身。");
			if (marker.confounders && marker.confounders.length > 0) parts.push(`同期还有其他变化（${marker.confounders.slice(0, 2).join("；")}），无法将变化归因于其中某一项。`);
			if (marker.ask_doctor) parts.push("此项请先咨询医生，不要自行视为改善。");
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
				headline = `${marker.label_zh}只有一次诊室读数，暂不能比较。请连续 7 天在家测量后再判断变化方向。`;
				body = "单次诊室血压无论是否超出波动范围，都不能据此下结论。";
			} else if (/no direction|没有方向/.test(marker.blocked_by ?? "") && marker.range_flag && ask && marker.from != null && marker.to != null) headline = `${movePhrase(marker)}，变化超出了波动，而且已经${marker.range_flag === "low" ? "低于" : "高于"}参考范围。建议携带这几次体检报告咨询医生。`;
			else if (/no direction|没有方向/.test(marker.blocked_by ?? "")) headline = marker.from != null && marker.to != null ? `${movePhrase(marker)}，变化${isBeyond(marker) ? "超出了波动" : "还不大"}，但${marker.label_zh}没有单一的好坏方向，因此暂不判断好转或变差。` : `${marker.label_zh}没有单一的好坏方向，因此暂不判断好转或变差。`;
			else if (/glucose fall/.test(marker.blocked_by ?? "")) headline = `${movePhrase(marker)}。血糖下降不一定是好事，请先对照参考范围，暂不视为改善。`;
			else if (grade === "too_early") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${marker.label_zh}尚未到可下结论的时间。${advice.why_zh}最早可于 ${dayZhG(dates?.earliest)}复测。`;
				body = "本次暂不下结论。";
			} else if (grade === "not_comparable") headline = `${marker.label_zh}两次结果无法直接比较（单位或实验室不一致）。请先复查一次再下结论。`;
			else if (grade === "beyond_band_better") {
				headline = `${movePhrase(marker)}，超出了测量波动，是真实的变化。`;
				body = extra;
			} else if (grade === "beyond_band_worse") {
				headline = `${movePhrase(marker)}，超出了测量波动，方向不好。建议复查，并和医生讨论。`;
				body = extra;
			} else if (grade === "within_band_improving") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${movePhrase(marker)}，方向正确，但仍在测量波动范围内。${dates?.why_zh ?? ""}最早可于 ${dayZhG(dates?.earliest)}复测，以确认是否为真实变化。`;
				body = extra;
			} else if (grade === "within_band_worse") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${movePhrase(marker)}，略偏不利方向，但未超出测量波动。暂不下结论。${dates?.why_zh ?? ""}`;
				body = extra;
			} else if (grade === "within_band_flat") {
				const dates = schedule(marker, advice, today, grade);
				headline = `${marker.label_zh}基本不变，仍在测量波动范围内。${dates?.why_zh ?? ""}最早可于 ${dayZhG(dates?.earliest)}复测。`;
				body = extra;
			} else {
				headline = marker.from == null ? `${marker.label_zh}尚无可对比的基线。补充一次结果后再评估，这并不代表没有变化。` : `${marker.label_zh}本次暂不下结论：${marker.blocked_by || "尚缺可对比的结果"}。`;
				body = "目前缺少可比的复测或记录，并非「没有变化」。";
			}
			headline = headline.replace(/。。+/g, "。");
			if (BARE.test(headline) || headline.length < 8) headline = `${marker.label_zh}本次暂不下结论，补充可比结果后再评估。`;
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
						headline_zh: "历次身体年龄的计算依据尚未统一，暂不判断是否变年轻。待九项血检在同一天测齐后再比较。",
						tone: "neutral"
					};
				}
				const low = advance != null && pheno != null ? advance < -.05 ? `这次算出 ${showNum(pheno)} 岁，比实足年龄低 ${showNum(-advance)} 岁。` : advance > .05 ? `这次算出 ${showNum(pheno)} 岁，比实足年龄高 ${showNum(advance)} 岁。` : `这次算出 ${showNum(pheno)} 岁，和实足年龄相当。` : pheno != null ? `这次算出 ${showNum(pheno)} 岁。` : "";
				const dates = retestDates$1(today, advice, 0, today);
				const headline = `${low}这是首次计算身体年龄，单次检查不能说明你变年轻了。${advice.why_zh}最早 ${dayZhG(dates.earliest)}再测。`;
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
					why_zh: "两次检测不在同一家实验室，身体年龄不能直接比较。"
				},
				headline_zh: "两次身体年龄来自不同实验室，数值不能直接比较，暂不判断是否变年轻。请在同一家实验室复测一次。",
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
					headline_zh: `${moved}但仅间隔 ${span} 天，不足 3 个月，尚不能说变年轻。最早可于 ${dayZhG(early.earliest)}复测。`,
					tone: "neutral"
				};
			}
			const beyond = band != null && deltaYears != null && Math.abs(deltaYears) > Math.abs(band);
			const younger = beyond && deltaYears != null && deltaYears < 0 && input.band_verified;
			if (input.story_zh && input.story_younger === false && /计算结果小了|不一定是好事/.test(input.story_zh)) return {
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
				headline_zh: `身体年龄高了 ${showYears(deltaYears)} 岁，超出了测量波动。这不是「变年轻」。建议与医生一起查看是哪些指标导致升高。`,
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
				headline_zh: `身体年龄低了 ${showYears(Math.abs(deltaYears))} 岁，超出了给出的波动范围。波动数据的来源尚未核对，因此暂不判断是否变年轻。`,
				body_zh: advice.why_zh,
				tone: "encourage"
			};
			const way = deltaYears == null ? "flat" : deltaYears < -.05 ? "improving" : deltaYears > .05 ? "worse" : "flat";
			const grade = way === "improving" ? "within_band_improving" : way === "worse" ? "within_band_worse" : "within_band_flat";
			const bandText = band != null ? `测量波动大约 ±${showYears(band)} 岁。` : "";
			const moved = deltaYears != null && Math.abs(deltaYears) >= .05 ? `身体年龄变化 ${showYears(Math.abs(deltaYears))} 岁，仍在波动范围内。` : "身体年龄基本不变，仍在测量波动范围内。";
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
				headline_zh: `${moved}${bandText}尚不能说变年轻。${advice.why_zh}`,
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
			let headline = "本次暂不下结论：尚无可对比的结果。完成复测后再评估，这并不代表没有变化。";
			let tone = "neutral";
			if (better.length > 0) {
				grade = "beyond_band_better";
				tone = "celebrate";
				headline = `${listZh(better.map((row) => row.subject.label_zh))}超出了测量波动，是真实的变化。`;
				if (n > better.length) headline += `${n} 项中 ${k} 项正在改善${withinNames ? `，波动范围内向好的有${withinNames}` : ""}。间隔 8–12 周后复查，才能确定其余各项的结果。`;
			} else if (worse.length > 0 && k === 0) {
				grade = "beyond_band_worse";
				tone = "care";
				headline = `${listZh(worse.map((row) => row.subject.label_zh))}超出了测量波动，方向不好。建议复查，并和医生讨论。`;
			} else if (k > 0) {
				grade = "within_band_improving";
				tone = "encourage";
				headline = `方向正确：${n} 项中 ${k} 项正在改善${withinNames ? `（${withinNames}）` : ""}。仍在测量波动范围内，间隔 8–12 周后复查，才能确认是否为真实变化。`;
			} else if (markers.some((row) => row.grade === "within_band_worse")) {
				grade = "within_band_worse";
				tone = "neutral";
				headline = `${n} 项均在测量波动范围内，部分略偏不利方向。暂不下结论，请间隔 8–12 周后复查。`;
			} else if (markers.some((row) => row.grade === "within_band_flat")) {
				grade = "within_band_flat";
				tone = "neutral";
				headline = `这 ${n} 项均在测量波动范围内，尚无一项超出。间隔 8–12 周后复查，才能确定是否有真实变化。`;
			} else if (markers.some((row) => movedPastBand(row))) {
				tone = "care";
				headline = `${listZh(markers.filter((row) => movedPastBand(row)).map((row) => row.subject.label_zh))}的变化超出了正常波动。先不说变好或变差。`;
			} else if (markers.some((row) => row.grade === "too_early")) {
				grade = "too_early";
				headline = "这几项尚未到可下结论的时间。请按各项的复测间隔再测，糖化血红蛋白至少间隔 90 天。";
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
			if (wait.length > 0) parts.push(`${listZh(wait)}需待间隔足够后再测，糖化血红蛋白和维生素 D 至少间隔 90 天。`);
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
					label_zh: "今日完成情况"
				},
				grade: "behaviour_done",
				allowed_claims: ["affirm"],
				numbers: [],
				headline_zh: done.length === 1 ? `今天的「${done[0]?.title_zh}」已完成并记录。` : `今天完成了${names}，均已记录。`,
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
		const BIOAGE_INFO = "身体年龄根据九项常规血检和周岁计算得出（模型估计，不是诊断，也不代表预期寿命）。学术上称为表型年龄。";
		const RISK_INFO = "10 年心血管风险：与你情况相近的人群中，未来 10 年发生心梗或脑卒中的比例（模型估计）。该模型未公开个体波动范围。年龄不在 35–74 岁时，结果更不确定。模型名称为 China-PAR。";
		//#endregion
		//#region src/client/goals.ts
		const h$35 = react.default.createElement;
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
			const estimate = h$35("div", { className: "lp-tags" }, h$35("span", { className: "lp-tag" }, "模型估计"));
			return h$35(Section, {
				id: "lp-goals",
				title: "如果达到目标"
			}, h$35("div", { className: "lp-grid-2 lp-grid-top" }, pheno ? h$35("div", { className: "lp-card" }, h$35("div", { className: "lp-card-head" }, h$35("h3", { className: "lp-card-title" }, BIOAGE_LABEL, h$35(Info, { label: BIOAGE_LABEL }, BIOAGE_INFO))), estimate, pheno.goal ? h$35("div", { className: "lp-plan-model-figures" }, h$35("div", { className: "lp-plan-model-figure" }, h$35("div", { className: "lp-caption" }, "现在"), h$35("div", { className: "lp-num-md" }, `${fmt$1(pheno.now?.phenoage)} 岁`)), h$35(Icon, {
				name: "arrow",
				size: 16
			}), h$35("div", { className: "lp-plan-model-figure" }, h$35("div", { className: "lp-caption" }, "达到方案目标"), h$35("div", { className: "lp-num-md lp-good-ink" }, `${fmt$1(pheno.goal.phenoage)} 岁`)), h$35("span", { className: "lp-badge lp-badge-good" }, `${fmt$1(pheno.goal.phenoage_delta)} 岁`)) : h$35("p", { className: "lp-muted lp-measure" }, pheno.note_zh ?? ""), leverRows.length > 0 ? h$35("div", null, h$35("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$35(LeverBars, { rows: leverRows })) : sensitivityRows.length > 0 ? h$35("div", null, h$35("div", { className: "lp-subhead" }, "对你的身体年龄影响最大的指标"), h$35(LeverBars, { rows: sensitivityRows })) : null, ...(pheno.levers ?? []).slice(0, 3).map((row) => h$35("p", {
				key: row.label,
				className: "lp-caption lp-measure"
			}, minus(projectionSentence(row.label, row.to, row.years, row.from)))), pheno.goal && pheno.goal.phenoage_delta != null ? h$35("p", { className: "lp-caption lp-measure" }, minus(projectionSentence("达到方案目标时的身体年龄", `${fmt$1(pheno.goal.phenoage)} 岁`, pheno.goal.phenoage_delta, pheno.now?.phenoage != null ? `${fmt$1(pheno.now.phenoage)} 岁` : void 0))) : null, h$35("p", { className: "lp-caption lp-measure" }, `${pheno.measured_on ? `按 ${chineseDate(pheno.measured_on) || pheno.measured_on}的血检计算。` : ""}${pheno.boundary_zh ?? ""}`)) : null, risk ? h$35("div", { className: "lp-card" }, h$35("div", { className: "lp-card-head" }, h$35("h3", { className: "lp-card-title" }, RISK_LABEL, h$35(Info, {
				label: RISK_LABEL,
				align: "end"
			}, RISK_INFO))), estimate, risk.status === "unavailable" ? (risk.missing ?? []).length > 0 ? h$35("div", { className: "lp-plan-model-figure" }, h$35("div", { className: "lp-h2 lp-muted" }, `还差 ${(risk.missing ?? []).length} 项`), h$35("div", { className: "lp-tags" }, ...(risk.missing ?? []).slice(0, 3).map((name) => h$35("span", {
				key: name,
				className: "lp-tag"
			}, name)), (risk.missing ?? []).length > 3 ? h$35("span", { className: "lp-caption" }, `等 ${(risk.missing ?? []).length} 项`) : null)) : h$35("div", { className: "lp-plan-model-figure" }, h$35("div", { className: "lp-h2 lp-muted" }, "暂不显示"), risk.note_zh ? h$35("p", { className: "lp-small lp-muted lp-measure" }, risk.note_zh) : null) : h$35("div", { className: "lp-stack" }, h$35("div", { className: "lp-plan-model-figures" }, h$35("div", { className: "lp-plan-model-figure" }, h$35("div", { className: "lp-caption" }, "现在"), h$35("div", { className: "lp-num-md" }, risk.now?.risk_pct == null ? "—" : `${risk.now.risk_pct.toFixed(1)}%`), risk.category_zh?.now ? h$35("span", { className: "lp-badge lp-badge-neutral" }, risk.category_zh.now) : null), risk.goal ? h$35(Icon, {
				name: "arrow",
				size: 16
			}) : null, risk.goal ? h$35("div", { className: "lp-plan-model-figure" }, h$35("div", { className: "lp-caption" }, "达到方案目标"), h$35("div", { className: "lp-num-md lp-good-ink" }, risk.goal.risk_pct == null ? "—" : `${risk.goal.risk_pct.toFixed(1)}%`), risk.category_zh?.goal ? h$35("span", { className: "lp-badge lp-badge-good" }, risk.category_zh.goal) : null) : null), (risk.levers ?? []).length > 0 ? h$35("div", null, h$35("div", { className: "lp-subhead" }, "每个目标单独的贡献"), h$35(LeverBars, { rows: (risk.levers ?? []).map((row) => ({
				label: row.label,
				detail: `${row.from} → ${row.to}`,
				value: row.years,
				unit: "个百分点"
			})) })) : h$35("p", { className: "lp-small lp-muted lp-measure" }, risk.note_zh ?? "")), risk.boundary_zh ? h$35("p", { className: "lp-caption lp-measure" }, risk.boundary_zh) : null) : null), h$35("p", { className: "lp-caption lp-measure" }, "关于「能多活几年」：没有经过验证的模型能对个人给出这个数。这里只给有依据的模型估计。试验里的平均效应都不大：热量限制使衰老速度慢约 2–3%，鱼油三年约慢 3 个月；能坚持的小改变，比追逐一个数字更重要。"));
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
			return h$35(Section, {
				id: "lp-next",
				title: "下一步",
				aside: h$35("span", { className: "lp-caption" }, "按优先级")
			}, h$35("div", { className: "lp-card" }, h$35("ol", { className: "lp-rows" }, ...rows.map((row, index) => h$35("li", {
				key: index,
				className: "lp-row lp-plan-step"
			}, h$35(Icon, {
				name: STEP_ICON[row.kind] ?? "info",
				size: 14,
				className: "lp-row-icon"
			}), h$35("span", { className: "lp-row-main" }, row.text_zh))))));
		}
		//#endregion
		//#region src/client/plan-draft.ts
		const h$34 = react.default.createElement;
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
			return h$34("details", null, h$34("summary", null, "证据"), evidence.population ? h$34("p", { className: "lp-caption lp-measure" }, `试验人群：${evidence.population}`) : null, evidence.doi ? h$34("p", { className: "lp-caption lp-measure" }, "文献：", h$34("a", {
				href: `https://doi.org/${evidence.doi}`,
				target: "_blank",
				rel: "noreferrer"
			}, `doi:${evidence.doi}`), evidence.verified ? "" : "（数据待核对）") : null, target ? h$34("p", { className: "lp-caption lp-measure" }, targetText(target)) : null, h$34("p", { className: "lp-caption lp-measure" }, "这是试验里的平均效果，个人结果会不同。"));
		}
		/** One line: what the trials found on average. */
		function EvidenceLine(props) {
			return h$34("p", { className: "lp-draft-evidence" }, h$34(Icon, {
				name: "flask",
				size: 13
			}), h$34("span", null, props.item.evidence.expected_zh || "有研究证据支持"));
		}
		function DraftItemCard(props) {
			const item = props.item;
			return h$34("li", { className: `lp-draft-item ${props.compact ? "lp-draft-item-compact" : ""}` }, h$34("div", { className: "lp-draft-item-head" }, h$34("div", { className: "lp-draft-item-title" }, item.category_zh ? h$34("span", { className: "lp-tag" }, item.category_zh) : null, h$34("span", null, item.title), item.needs_doctor ? h$34("span", { className: "lp-badge lp-badge-warn" }, h$34(Icon, {
				name: "warn",
				size: 12
			}), "需先与医生确认") : null), h$34("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: props.onRemove,
				"aria-label": `移除「${item.title}」`
			}, h$34(Icon, {
				name: "close",
				size: 12
			}), "移除")), behaviorOf(item) ? h$34("p", { className: "lp-draft-detail" }, behaviorOf(item)) : null, h$34(EvidenceLine, { item }), item.cautions_zh.length > 0 ? h$34("div", { className: "lp-callout lp-callout-warn" }, h$34(Icon, {
				name: "warn",
				size: 14
			}), h$34("div", { className: "lp-callout-body" }, ...item.cautions_zh.map((text) => h$34("p", { key: text }, text)))) : null, h$34(EvidenceMore, { item }));
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
			return h$34("div", { className: "lp-draft-block" }, kept.length > 0 ? h$34("ul", { className: "lp-draft-items" }, ...kept.map((item) => h$34(DraftItemCard, {
				key: item.id,
				item,
				compact: props.compact,
				onRemove: () => props.onToggle(item.id)
			}))) : h$34("p", { className: "lp-small lp-muted lp-measure" }, "所有项目均已移除。可恢复其中一项，或在对话中说明希望如何调整。"), gone.length > 0 ? h$34("div", { className: "lp-draft-removed" }, h$34("span", { className: "lp-caption" }, "已移除："), ...gone.map((item) => h$34("button", {
				key: `${item.id}|${item.title}`,
				type: "button",
				className: "lp-toggle",
				disabled: props.busy,
				onClick: () => props.onToggle(item.id || item.title),
				"aria-label": `恢复「${item.title}」`
			}, h$34(Icon, {
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
					error: String(result.error ?? "保存失败")
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
					error: errorText(err, "保存失败")
				};
			}
		}
		function Priorities(props) {
			const rows = props.brief.priorities;
			if (rows.length === 0) return null;
			return h$34("details", { open: props.open }, h$34("summary", null, "为什么是这几项"), h$34("ol", { className: "lp-draft-priorities" }, ...rows.map((row, index) => h$34("li", {
				key: `${row.marker_key}-${index}`,
				className: "lp-draft-priority"
			}, h$34("div", { className: "lp-draft-priority-head" }, h$34("span", { className: "lp-strong" }, row.label_zh), row.value != null ? h$34("span", { className: "lp-num" }, `${num$1(row.value)} ${row.unit}`) : null), h$34("div", { className: "lp-caption" }, [row.why_zh, row.date ? `${chineseDate(row.date)}的记录` : ""].filter(Boolean).join(" · "))))));
		}
		function DraftGoals(props) {
			if (props.goals.length === 0 && props.dropped === 0) return null;
			return h$34("details", null, h$34("summary", null, `目标（${props.goals.length} 个，按试验平均效应估算）`), props.goals.length > 0 ? h$34("ul", { className: "lp-rows" }, ...props.goals.map((goal) => h$34("li", {
				key: goal.marker,
				className: "lp-row"
			}, h$34("span", { className: "lp-row-main lp-row-lines" }, h$34("span", { className: "lp-strong" }, goal.marker), goal.basis_zh ? h$34("span", { className: "lp-caption" }, goal.basis_zh) : null), h$34("span", { className: "lp-row-end lp-num" }, `${num$1(goal.value)} ${goal.unit}`)))) : null, props.dropped > 0 ? h$34("p", { className: "lp-caption lp-measure" }, `已移除项目对应的 ${props.dropped} 个目标也不会保存。`) : null);
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
			return h$34(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "采用这份方案",
				onClose: props.busy ? () => {} : props.onCancel,
				headless: true,
				className: "lp-confirm-dialog"
			}, h$34("div", { className: "lp lp-confirm" }, h$34("h2", { className: "lp-h2" }, "采用这份方案？"), h$34("p", { className: "lp-muted lp-measure" }, `保存为你的方案「${props.draft.title || "改善方案"}」，从今天（${chineseDate(props.today)}）开始。此后按项目打卡，并按各项指标安排复测；如需调整，可随时在对话中提出。`), h$34("ul", { className: "lp-confirm-list" }, ...props.items.map((item) => h$34("li", { key: item.id }, item.category_zh ? h$34("span", { className: "lp-tag" }, item.category_zh) : null, h$34("span", null, item.title), item.needs_doctor ? h$34("span", { className: "lp-badge lp-badge-warn" }, "需先与医生确认") : null))), props.goals.length > 0 ? h$34("p", { className: "lp-caption lp-measure" }, `目标：${props.goals.map((goal) => `${goal.marker} ${num$1(goal.value)} ${goal.unit}`).join("、")}（按试验平均效应估算，不是个人预测）`) : null, doctor.length > 0 ? h$34("div", { className: "lp-callout lp-callout-warn" }, h$34(Icon, {
				name: "warn",
				size: 14
			}), h$34("p", { className: "lp-callout-body" }, `${doctor.map((item) => `「${item.title}」`).join("")}需先与医生确认后再开始。方案里不含任何剂量。`)) : null, offer ? h$34("label", {
				className: "lp-checkrow",
				htmlFor: "lp-confirm-remind"
			}, h$34("input", {
				id: "lp-confirm-remind",
				type: "checkbox",
				checked: remind,
				disabled: props.busy,
				onChange: (event) => setRemind(event.target.checked)
			}), h$34("span", null, `每晚 ${offer.time} 提醒我打卡（不含健康数值）`)) : null, props.error ? h$34("p", {
				className: "lp-form-error",
				role: "alert"
			}, props.error) : null, h$34("div", { className: "lp-modal-actions" }, h$34(Btn$1, {
				variant: "outline",
				onClick: props.onCancel,
				disabled: props.busy
			}, "暂不采用"), h$34(Btn$1, {
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
				if (!saved.ok) reminder = saved.error || "未能开启";
				else if (saved.settings) putFollowup(saved);
			} catch (err) {
				reminder = errorText(err, "未能开启");
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
			return h$34("span", { className: "lp-caption lp-draft-hint" }, "如需调整，请在对话中提出", h$34("button", {
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
					if (!result.ok) setError(`保存失败：${result.error}`);
					else props.onNotice(inDraft ? `已移除「${target.title}」，后续草稿不会再加入此项。` : `已恢复「${target.title}」。`, "good");
				}).finally(() => setBusy(false));
			};
			async function accept(remind) {
				setBusy(true);
				setError(null);
				try {
					const result = await acceptDraft(draft, kept, remind);
					if (!result.ok) {
						setError(`保存失败：${result.error}`);
						return;
					}
					setConfirming(false);
					props.onNotice(`已保存为方案第 ${result.version} 版，共 ${result.items} 项。${result.reminder ? `打卡提醒没有打开：${result.reminder}` : remind ? "每晚会提醒你打卡。" : ""}`, result.reminder ? "info" : "good");
				} catch (err) {
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(false);
				}
			}
			return h$34("div", { className: "lp-card lp-draft" }, h$34("div", { className: "lp-card-head" }, h$34("h3", { className: "lp-card-title" }, draft.title || "改善方案"), h$34("span", { className: "lp-caption" }, `方案草稿 · ${kept.length} 项 · 还没有保存`)), h$34("p", { className: "lp-text lp-muted" }, "按你的检查结果和试验证据起草。每项注明试验里的平均效果，个人结果会不同；你确认后才保存。"), h$34(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				saved: data.removed_items,
				busy
			}), error && !confirming ? h$34("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$34(DraftGoals, {
				goals,
				dropped: draft.goals.length - goals.length
			}), h$34(Priorities, { brief: data.brief }), ...draft.notes_zh.map((text) => h$34("p", {
				key: text,
				className: "lp-caption"
			}, text)), h$34("div", { className: "lp-actions lp-draft-actions" }, h$34(Btn$1, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$34(Hint, { onPrompt: props.onPrompt })), h$34("p", { className: "lp-caption lp-measure" }, data.brief.boundary_zh || "只起草生活方式；补剂只作为需先与医生确认的选项，不给剂量；不涉及任何处方药。"), confirming ? h$34(ConfirmModal, {
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
			return h$34("div", { className: "lp-draft-removed" }, h$34("span", { className: "lp-caption" }, "已移除："), ...props.items.map((item) => h$34("button", {
				key: `${item.id}|${item.title}`,
				type: "button",
				className: "lp-toggle",
				disabled: busy,
				"aria-label": `恢复「${item.title}」`,
				onClick: () => {
					setBusy(true);
					setDraftItemExcluded(item, false).then((result) => {
						props.onNotice(result.ok ? `已恢复「${item.title}」。` : `恢复失败：${result.error}`, result.ok ? "good" : "info");
					}).finally(() => setBusy(false));
				}
			}, h$34(Icon, {
				name: "plus",
				size: 12
			}), item.title)));
		}
		/** The plan section's empty state: the draft, or why there is none yet. */
		function PlanDraftCard(props) {
			const { data, loading, error } = usePlanDraft();
			if (!data && loading) return h$34("div", {
				className: "lp-card lp-draft",
				"aria-busy": true
			}, h$34("div", { className: "lp-card-head" }, h$34("h3", { className: "lp-card-title" }, "方案草稿"), h$34("span", { className: "lp-caption" }, "正在按你的结果和研究证据起草…")), h$34(Skeleton, { height: 72 }), h$34(Skeleton, { height: 72 }));
			if (!data) return h$34("div", { className: "lp-card lp-draft" }, h$34("div", { className: "lp-card-head" }, h$34("h3", { className: "lp-card-title" }, "方案草稿")), h$34("p", { className: "lp-small lp-muted lp-measure" }, `未能读取方案草稿：${error ?? "未返回数据"}。`), h$34(Hint, { onPrompt: props.onPrompt }));
			if (!data.draft) {
				const stop = data.brief.safety.stop_zh ?? "";
				const reasons = stop ? [stop, ...data.brief.notes_zh.filter((text) => text !== stop)] : data.brief.notes_zh;
				const fine = stop ? [data.brief.boundary_zh].filter(Boolean) : [...new Set([
					...reasons.slice(1),
					...data.brief.safety.notes_zh,
					data.brief.boundary_zh
				].filter(Boolean))];
				return h$34("div", { className: "lp-card lp-draft" }, h$34("div", { className: "lp-card-head" }, h$34("h3", { className: "lp-card-title" }, stop ? "请先去看医生，再做方案" : "暂时无法起草方案"), h$34("span", { className: "lp-caption" }, "方案草稿")), stop ? h$34("div", { className: "lp-callout lp-callout-warn" }, h$34(Icon, {
					name: "warn",
					size: 14
				}), h$34("p", { className: "lp-callout-body" }, reasons[0])) : h$34("p", { className: "lp-text lp-muted" }, reasons[0] || "你的记录中暂无与研究证据匹配的指标。"), ...fine.map((text) => h$34("p", {
					key: text,
					className: "lp-caption"
				}, text)), stop ? null : h$34(Priorities, {
					brief: data.brief,
					open: true
				}), !stop && data.removed_items.length > 0 ? h$34(RestoreRow, {
					items: data.removed_items,
					onNotice: props.onNotice
				}) : null, stop ? null : h$34(Hint, { onPrompt: props.onPrompt }));
			}
			return h$34(Draft, {
				data,
				draft: data.draft,
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			});
		}
		//#endregion
		//#region src/client/plan.ts
		const h$33 = react.default.createElement;
		/** Today's items with their three answers; also the 概览 tab's today card. */
		function TodayList(props) {
			const items = props.journey.plan.checkin_items;
			if (items.length === 0) return h$33("p", { className: "lp-small lp-muted lp-measure" }, "今天没有需要手动记录的项目。手环数据和已记录的服药情况会自动计入。");
			return h$33("ul", { className: "lp-today-list" }, ...items.map((row) => {
				const state = props.stateOf(row.id);
				return h$33("li", {
					key: row.id,
					className: `lp-today-row ${state === true ? "lp-today-done" : state === false ? "lp-today-missed" : ""}`
				}, h$33("span", { className: "lp-today-title" }, row.title), h$33(CheckChoices, {
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
			return h$33("div", { className: `lp-card ${props.className ?? ""}`.trim() }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "今天")), counts.total > 0 ? h$33("div", { className: "lp-plan-grow" }, h$33("div", { className: "lp-num-md" }, `${counts.done}/${counts.total}`), h$33("div", {
				className: "lp-bar",
				role: "progressbar",
				"aria-label": "今天的打卡",
				"aria-valuemin": 0,
				"aria-valuemax": counts.total,
				"aria-valuenow": counts.done
			}, h$33("span", { style: { width: `${Math.round(share * 100)}%` } })), h$33("p", { className: "lp-caption" }, "请在下方项目中打卡。")) : h$33("p", { className: "lp-small lp-muted lp-measure" }, "今天没有需要手动记录的项目。手环数据和已记录的服药情况会自动计入。"));
		}
		function AdherenceTile(props) {
			const known = (props.tracking?.items ?? []).filter((item) => item.adherence && item.adherence.level !== "unknown" && item.adherence.rate != null);
			const fallback = known.length > 0 ? known.reduce((sum, item) => sum + (item.adherence?.rate ?? 0), 0) / known.length : null;
			const rate = props.journey.plan.adherence_pct != null ? props.journey.plan.adherence_pct / 100 : fallback;
			const total = props.journey.plan.done_total;
			if (rate == null || !Number.isFinite(rate)) return h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "方案执行")), h$33("div", { className: "lp-empty" }, h$33("div", { className: "lp-empty-title" }, "暂无执行记录"), h$33("p", { className: "lp-empty-text" }, "在下面的项目里打卡后，这里显示近 12 周的执行率。")));
			return h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "方案执行")), h$33("div", { className: "lp-plan-grow" }, h$33("div", { className: "lp-plan-figure-row" }, h$33(Ring, {
				value: rate,
				label: "方案平均执行率",
				size: 56
			}), h$33("div", null, h$33("div", { className: "lp-num-md" }, `${Math.round(rate * 100)}%`), h$33("div", { className: "lp-caption" }, "近 12 周平均")))), total > 0 ? h$33("div", { className: "lp-plan-streak" }, h$33(Icon, {
				name: "flame",
				size: 14
			}), `累计打卡 ${total} 次`) : h$33("p", { className: "lp-caption lp-measure" }, "打卡后，这里会显示累计次数；没做到的日子不会让它减少"));
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
			return h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "下次复测")), h$33("div", { className: "lp-plan-grow" }, now.length > 0 ? h$33("div", null, h$33("div", { className: "lp-h2" }, "现在"), h$33("div", { className: "lp-caption" }, `可以复测${now.map((row) => row.marker).slice(0, 3).join("、")}`)) : first ? h$33("div", null, h$33("div", { className: "lp-num-md" }, `${daysBetween$1(props.today, first.date)} 天后`), h$33("div", { className: "lp-caption" }, `${chineseDate(first.date)}之后 · ${first.marker}`)) : h$33("div", null, h$33("div", { className: "lp-h2 lp-muted" }, "—"), h$33("div", { className: "lp-caption" }, props.failed ? "未读取到复测日期" : "方案中的指标尚未安排复测日期"))), h$33("p", { className: "lp-caption lp-measure" }, "复测过早，变化多半只是正常波动。"));
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
			if (wins.length === 0) return h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "方案相关指标尚未超出正常波动")), h$33("p", { className: "lp-small lp-muted lp-measure" }, "血脂、血糖、炎症指标通常需要 1–3 个月才会变化。坚持执行、按时复测，就是在积累证据。"));
			return h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "朝目标方向、超出正常波动的变化")), h$33("ul", { className: "lp-rows" }, ...wins.map(({ item, row }, index) => h$33("li", {
				className: "lp-row lp-plan-win",
				key: index
			}, h$33("span", { className: "lp-plan-win-icon" }, h$33(Icon, {
				name: "check",
				size: 14
			})), h$33("div", { className: "lp-plan-win-text lp-row-main" }, h$33("div", { className: "lp-strong lp-num" }, minus(`${row.marker} ${fmtAuto(row.baseline?.value)} → ${fmtAuto(row.followup?.value)} ${row.unit ?? ""}`)), h$33("p", { className: "lp-muted lp-measure" }, minus([
				`执行「${item.title}」期间`,
				row.change ? pct(row.change.pct) : "",
				"超出个体正常波动"
			].filter(Boolean).join(" · ")), (row.combined_with ?? []).length > 0 ? `；同期还在执行${(row.combined_with ?? []).map((name) => `「${name}」`).join("")}，无法区分各自的作用` : ""))))));
		}
		/** Check-in items not running today (not started, or ended) get no button, as the server leaves them out of today's list. */
		function checkinFoot(item, today) {
			if (item.start > today) return `${chineseDate(item.start)}开始，届时再打卡`;
			if (item.end && item.end < today) return "已结束，无需打卡";
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
			const end = idle ? h$33("span", { className: "lp-caption" }, idle) : source === "checkin" ? props.checkable ? h$33(CheckChoices, {
				title: item.title,
				state: props.state,
				busy: props.busy,
				onAnswer: (next) => props.onAnswer(item.id, item.title, next)
			}) : h$33("span", { className: "lp-caption" }, "今天无需打卡") : h$33("span", { className: "lp-caption" }, source === "wearable" ? "手环自动记录" : "服用情况记录在健康数据服务的用药计划中");
			return h$33("li", { className: `lp-row lp-plan-row ${props.state === true ? "lp-today-done" : ""}` }, h$33("div", { className: "lp-row-main lp-plan-row-main" }, h$33("div", { className: "lp-plan-row-title" }, item.title), h$33("div", { className: "lp-tags" }, item.category_zh ? h$33("span", { className: "lp-tag" }, item.category_zh) : null, item.headline && !(props.young && item.headline === "无法判断") ? h$33(VerdictChip, { verdict: item.headline }) : null, known ? h$33("span", { className: "lp-caption lp-num" }, `近 12 周执行 ${Math.round(rate * 100)}%`) : null), known && (adherence.calendar ?? []).length > 0 ? h$33(AdherenceStrip, {
				calendar: adherence.calendar ?? [],
				label: item.title
			}) : null, !known && !props.young ? h$33("p", { className: "lp-caption lp-measure" }, `近 12 周执行：记录不足${adherence.note_zh ? `。${adherence.note_zh}` : ""}`) : null, ...verdicts.map((row, index) => h$33("div", {
				className: "lp-plan-verdict",
				key: index
			}, h$33("div", { className: "lp-plan-verdict-head" }, h$33(VerdictChip, { verdict: row.verdict }), h$33("span", { className: "lp-strong" }, row.marker), row.baseline && row.followup ? h$33("span", { className: "lp-num" }, minus(`${fmtAuto(row.baseline.value)} → ${fmtAuto(row.followup.value)} ${row.unit ?? ""}${row.change ? `（${pct(row.change.pct)}）` : ""}`)) : null), row.reason_zh ? h$33("p", { className: "lp-caption lp-measure" }, datesZh(row.reason_zh)) : null, (row.expected ?? []).length > 0 ? h$33("details", null, h$33("summary", null, "试验里平均能改变多少"), ...(row.expected ?? []).map((line) => h$33("p", {
				key: line.id,
				className: "lp-caption lp-measure"
			}, line.text_zh, line.comparison && line.comparison !== "not_comparable" ? `你的变化${{
				consistent: "与试验平均一致",
				smaller: "小于试验平均",
				larger: "大于试验平均",
				opposite: "方向与试验相反"
			}[line.comparison] ?? ""}。` : "", ` doi:${line.doi}`))) : null))), h$33("div", { className: "lp-plan-row-end" }, end));
		}
		/** Stage plan, next to the draft: the person may bring their own plan instead. */
		function PlanStart(props) {
			return h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, "已经有自己的方案？")), h$33("p", { className: "lp-text lp-muted" }, "描述你的方案，或上传医生、长寿师提供的方案。LongPi 会复述并经你确认后保存，再按各项指标安排复测日，并计算达到目标时的模型估计。"), props.journey.suggestions.length > 0 ? h$33("div", { className: "lp-stack" }, ...props.journey.suggestions.map((row) => h$33("button", {
				key: row.id,
				type: "button",
				className: "lp-row-btn",
				onClick: () => props.onPrompt(row.text_zh)
			}, h$33("span", { className: "lp-row-main" }, row.text_zh), h$33(Icon, {
				name: "chevron",
				size: 14
			})))) : null, h$33("p", { className: "lp-caption lp-measure" }, "LongPi 只起草生活方式方案；不会开始、停止或调整任何处方药，也不给药物或补剂的剂量。"));
		}
		function PlanSection(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const tracking = props.tracking;
			const today = props.journey.today;
			if (!props.journey.plan.exists && !tracking?.plan) return h$33("div", {
				className: "lp-stack",
				id: "lp-plan"
			}, h$33(PlanDraftCard, {
				journey: props.journey,
				onNotice: props.onNotice,
				onPrompt: props.onPrompt
			}), h$33(PlanStart, {
				journey: props.journey,
				onPrompt: props.onPrompt
			}));
			if (props.loading && !tracking) return h$33("div", {
				className: "lp-stack",
				id: "lp-plan",
				"aria-busy": true
			}, h$33(Skeleton, {
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
			return h$33("div", {
				className: "lp-stack",
				id: "lp-plan"
			}, failed ? h$33(LoadError, {
				what: "方案的执行记录和评判",
				error: props.error,
				onRetry: () => reload("tracking")
			}) : null, h$33("div", { className: "lp-plan-tiles" }, h$33(TodayTile, {
				journey: props.journey,
				className: "lp-plan-tile-today"
			}), h$33(AdherenceTile, {
				journey: props.journey,
				tracking
			}), h$33(RetestTile, {
				tracking,
				today,
				failed
			})), h$33(Wins, { tracking }), h$33("div", { className: "lp-card" }, h$33("div", { className: "lp-card-head" }, h$33("h3", { className: "lp-card-title" }, plan?.title || props.journey.plan.title || "时间线"), h$33("span", { className: "lp-caption" }, meta)), items.length > 0 ? h$33(Timeline$1, {
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
			}) : h$33("p", { className: "lp-small lp-muted lp-measure" }, failed ? "未读取到方案项目。" : "方案中暂无项目。")), items.length > 0 ? h$33("section", {
				className: "lp-card",
				"aria-labelledby": "lp-plan-items-title"
			}, h$33("div", { className: "lp-card-head" }, h$33("h3", {
				className: "lp-card-title",
				id: "lp-plan-items-title"
			}, "方案项目"), h$33("span", { className: "lp-caption" }, "在此记录完成或未完成，误操作可撤销")), young ? h$33("p", { className: "lp-caption lp-measure" }, `方案开始仅 ${days ?? 0} 天。执行率和指标变化需满 ${YOUNG_DAYS} 天才能判断${firstRetest ? `，请于${chineseDate(firstRetest)}之后查看` : ""}。`) : null, h$33("ul", { className: "lp-rows" }, ...items.map((item) => h$33(ItemRow, {
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
			return h$33("div", { className: "lp-tab-body" }, h$33(PlanSection, props), h$33(Markers, { tracking: props.tracking }), h$33(Goals, { tracking: props.tracking }), h$33(NextSteps, { tracking: props.tracking }));
		}
		function Markers(props) {
			const charts = props.tracking?.charts ?? [];
			if (charts.length === 0) return null;
			const verdictOf = (indicator) => (props.tracking?.items ?? []).flatMap((item) => item.verdicts ?? []).find((row) => row.indicator === indicator && row.verdict !== "无法判断");
			const dateOf = (chart, iso) => chart.weekly ? `${chineseDate(iso)}起一周` : chineseDate(iso);
			const notes = [charts.some((chart) => chart.points.length < 2) ? "仅有一次数值的指标，需再复测一次才能显示趋势。" : "", charts.some((chart) => !chart.band) ? "没有浅色带的指标缺少个体变异数据，无法区分真实变化与波动。" : ""].filter(Boolean).join("");
			return h$33(Section, {
				id: "lp-markers",
				title: "方案相关的指标",
				aside: h$33(Info, {
					label: "图上的浅色带",
					align: "end"
				}, "浅色带表示以基线为中心的正常波动范围。落在带外的变化才值得关注；带内的起伏通常没有实际意义。")
			}, notes ? h$33("p", { className: "lp-caption lp-measure" }, notes) : null, h$33("div", { className: "lp-grid-2 lp-grid-top" }, ...charts.map((chart) => {
				const verdict = verdictOf(chart.indicator);
				const digits = Math.max(...chart.points.map((point) => (String(point.value).split(".")[1] ?? "").length), 0) > 1 ? 2 : 1;
				const only = chart.points.length === 1 ? chart.points[0] : null;
				return h$33("figure", {
					className: "lp-card lp-plan-chart",
					key: chart.indicator
				}, h$33("div", { className: "lp-card-head" }, h$33("figcaption", { className: "lp-card-title" }, chart.label)), verdict ? h$33("div", { className: "lp-tags" }, h$33(VerdictChip, { verdict: verdict.verdict })) : null, only ? h$33("div", { className: "lp-plan-model-figure" }, h$33("div", null, h$33("span", { className: "lp-num-md" }, fmt$1(only.value, digits)), chart.unit ? h$33("span", { className: "lp-unit" }, ` ${chart.unit}`) : null), h$33("div", { className: "lp-caption" }, dateOf(chart, only.date))) : h$33(LineChart, {
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
				}), chart.band ? h$33("p", { className: "lp-caption lp-measure" }, `浅色带：以 ${chineseDate(chart.band.base_date)}的 ${fmt$1(chart.band.base, 2)} 为基线的正常波动${chart.band.verified === false ? "（变异数据待核对）" : ""}。`) : null, chart.points.length > 1 ? h$33("details", null, h$33("summary", null, "历次数值"), h$33("div", { className: "lp-table-wrap" }, h$33("table", { className: "lp-table" }, h$33("caption", { className: "lp-sr" }, `${chart.label}（${chart.unit}）`), h$33("thead", null, h$33("tr", null, h$33("th", { scope: "col" }, "日期"), h$33("th", {
					scope: "col",
					className: "lp-td-num"
				}, chart.unit ? `数值（${chart.unit}）` : "数值"))), h$33("tbody", null, ...chart.points.map((point) => h$33("tr", { key: point.date }, h$33("td", null, dateOf(chart, point.date)), h$33("td", { className: "lp-td-num" }, fmt$1(point.value, digits)))))))) : null);
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
				footnote_zh: "超出了测量波动，是真实的变化。仅在同一实验室、间隔充足时作此结论。这不是诊断。"
			};
			return {
				id: "fb-share",
				title_zh: "可以分享的一句话",
				headline_zh: messages.find((row) => row.id === "fb-summary" && row.grade === "beyond_band_better")?.headline_zh ?? wins[0]?.headline_zh ?? "",
				lines_zh: lines,
				footnote_zh: "超出了测量波动，是真实的变化。这不是诊断，也不是「多活几年」。"
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
		const h$32 = react.default.createElement;
		function retestLine(retest) {
			if (retest.why_zh.includes("复测已在")) return datesZh(retest.why_zh);
			return `建议复测：${dateZh$2(retest.earliest)}至 ${dateZh$2(retest.recommended)}。${datesZh(retest.why_zh)}`;
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
			return h$32("section", {
				className: "lp-card",
				id: "lp-feedback",
				"aria-label": "这次的变化"
			}, h$32("div", { className: "lp-card-head" }, h$32("h3", { className: "lp-card-title" }, "这次的变化")), h$32("ul", { className: "lp-rows" }, ...props.messages.map((row) => h$32("li", {
				key: row.id,
				className: "lp-row lp-row-stack"
			}, ...linesOf(row).map((line, index) => h$32("p", {
				key: index,
				className: `lp-small lp-muted lp-measure ${index === 0 ? "lp-fb-lead" : ""}`.trim()
			}, line))))));
		}
		//#endregion
		//#region src/client/feedback/share-card.ts
		const h$31 = react.default.createElement;
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
			const action = h$31("div", { className: "lp-actions" }, h$31(Btn$1, {
				variant: "outline",
				onClick: copy
			}, "复制这句话"));
			if (props.compact) return h$31("section", {
				className: "lp-card",
				id: "lp-share",
				"aria-label": props.card.title_zh
			}, h$31("div", { className: "lp-card-head" }, h$31("h3", { className: "lp-card-title" }, props.card.title_zh)), h$31("p", { className: "lp-small lp-muted lp-measure" }, "上面身体年龄卡里的那句话，可以复制下来发给家人或朋友。"), action);
			return h$31("section", {
				className: "lp-card",
				id: "lp-share",
				"aria-label": props.card.title_zh
			}, h$31("div", { className: "lp-card-head" }, h$31("h3", { className: "lp-card-title" }, props.card.title_zh)), h$31("p", { className: "lp-text lp-strong" }, props.card.headline_zh), ...props.card.lines_zh.map((line) => h$31("p", {
				key: line,
				className: "lp-small lp-muted"
			}, line)), props.card.footnote_zh ? h$31("p", { className: "lp-caption lp-measure" }, props.card.footnote_zh) : null, action);
		}
		//#endregion
		//#region src/client/feedback/index.ts
		const h$30 = react.default.createElement;
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
			return h$30(react.default.Fragment, null, shown.length > 0 ? h$30(FeedbackCard, { messages: shown }) : null, share ? h$30(ShareCard, {
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
		const h$29 = react.default.createElement;
		/** More than this and the tags crowd the card; the action below lists the rest. */
		const NEEDS_SHOWN = 3;
		function EstimateTag() {
			return h$29("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计");
		}
		function labelText(label) {
			if (label === "verified") return "数据已核对";
			if (label === "unverified-binding") return "尚未核对，暂不能视为你的结果";
			return "这是研究中的结论，并非根据你的体检计算";
		}
		function LabelTag(props) {
			return h$29("span", {
				className: "lp-tag",
				"data-result-label": props.label
			}, labelText(props.label));
		}
		/**
		* The title row holds the title and ⓘ only (ⓘ follows the last word when the title wraps); the tags sit on the
		* next line (#16). An unmatched result is not a tag: the grid says so once above, the card keeps its source line.
		*/
		function CardHead(props) {
			const tags = [props.estimate === false ? null : h$29(EstimateTag, { key: "estimate" }), props.mark && props.mark !== "unverified-binding" ? h$29(LabelTag, {
				key: "mark",
				label: props.mark
			}) : null].filter(Boolean);
			return h$29(react.default.Fragment, null, h$29("div", { className: "lp-card-head" }, h$29("h3", { className: "lp-card-title lp-result-title" }, props.label, " ", h$29(Info, { label: props.label }, props.info))), tags.length > 0 ? h$29("div", { className: "lp-tags" }, ...tags) : null);
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
			const rest = restOfSentence(resultSentence(result, { youngerAllowed: false }), titleOf(result.skill, result.title_zh, out?.key ?? ""), shownOf(result)).replace(/^(?:还没对上|尚未核对)[，,。]?/, "").trim();
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
			const needs = all.length > 0 ? h$29("div", { className: "lp-tags lp-result-needs" }, h$29("span", { className: "lp-caption" }, `还差 ${count}`), ...all.slice(0, NEEDS_SHOWN).map((need) => h$29("span", {
				className: "lp-tag",
				key: need
			}, need)), all.length > NEEDS_SHOWN ? h$29("span", { className: "lp-caption" }, "…") : null) : h$29("p", { className: "lp-blocker" }, props.blocker ? `还缺：${props.blocker.replace(/^记录里还缺|^档案里还缺|^还缺/, "").replace(/^[：:]/, "")}` : "缺少计算所需的数据。");
			return h$29("div", { className: "lp-card lp-result" }, h$29(CardHead, {
				label: props.label,
				info: props.info
			}), h$29("div", { className: "lp-result-wait" }, "暂时无法计算"), needs, props.note ?? null, self?.self_key ? h$29("div", { className: "lp-result-foot" }, h$29("div", { className: "lp-result-self" }, h$29("div", { className: "lp-caption" }, `${self.item_zh}可在家自行测量，记录后即可计算：`), h$29(InlineSelf, {
				journey: props.journey,
				selfKey: self.self_key,
				idPrefix: `${props.idPrefix}-self`,
				onNotice: props.onNotice
			}))) : action ? h$29("div", { className: "lp-result-foot" }, h$29(Btn$1, {
				variant: "outline",
				onClick: () => props.onAction(action.target)
			}, action.label)) : null);
		}
		function BodyAgeCard(props) {
			const result = props.journey.results.bioage;
			if (result.status !== "ok") return h$29(Blocked, {
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
			const info = h$29(react.default.Fragment, null, h$29("span", { className: "lp-info-line" }, BIOAGE_INFO), band != null ? h$29("span", { className: "lp-info-line" }, `浅色带表示首次检查的个体正常波动范围（±${fmt$1(band)} 岁${partial ? `，未含${bio?.band_missing?.join("、")}` : ""}），落在带外才视为真实变化。`) : null, date ? h$29("span", { className: "lp-info-line" }, `最近一次：${chineseDate(date)}体检，共 ${count} 次完整血检。`) : null);
			return h$29("div", {
				className: "lp-card lp-result",
				...props.method ? { "data-result-label": props.method.label } : {}
			}, h$29(CardHead, {
				label: "身体年龄",
				info,
				mark: props.method?.label ?? null
			}), h$29("div", { className: "lp-result-figure" }, h$29("span", { className: props.method?.label === "unverified-binding" ? "lp-num-md" : "lp-num-lg" }, plainUnits(fmt$1(phenoage))), h$29("span", { className: "lp-bignum-unit" }, "岁"), younger ? h$29("span", { className: "lp-badge lp-badge-good" }, "真实变化") : null), !older && versusCalendarAge(result.advance) ? h$29("p", { className: "lp-caption lp-bioage-gap" }, versusCalendarAge(result.advance)) : null, result.caveat_zh && !concernLine ? h$29("div", {
				className: "lp-callout lp-callout-warn",
				role: "note"
			}, h$29(Icon, {
				name: "warn",
				size: 14
			}), h$29("span", null, plainUnits(result.caveat_zh))) : null, points.length > 1 ? h$29(LineChart, {
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
			}) : props.tracking == null ? h$29(Skeleton, { height: 40 }) : null, caption ? h$29("p", {
				className: "lp-caption lp-method-sentence",
				id: "lp-bioage-feedback"
			}, plainUnits(caption)) : null, h$29(KeyTrends, {
				journey: props.journey,
				older: (latest?.advance ?? result.advance ?? 0) > 0,
				covered: props.covered
			}), h$29("p", { className: "lp-fine lp-result-note" }, [count > 0 ? `${count} 次体检` : "", points.length > 1 && band != null ? "浅色带为正常波动范围" : ""].filter(Boolean).join(" · ")));
		}
		function KeyTrends(props) {
			const covered = props.covered ?? NOTHING_COVERED;
			const changes = props.journey.changes ?? [];
			const below = new Set(notableRows(changes, covered).map((row) => row.key));
			const trends = pickKeyTrends(changes.filter((row) => !isCovered(covered, row) && !below.has(row.key)), props.older);
			if (trends.length === 0) return null;
			return h$29("div", { className: "lp-key-trends" }, h$29("div", { className: "lp-caption" }, "相关变化"), h$29("ul", { "aria-label": "相关变化" }, ...trends.map((row) => h$29("li", { key: row.label_zh }, h$29("span", { className: "lp-strong" }, row.label_zh), h$29("span", { className: "lp-caption" }, ` ${plainUnits(row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() : row.text_zh)}`)))));
		}
		function rangeCaption(age) {
			const text = modelRangeNote("china-par", age);
			return text ? h$29("p", {
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
				return h$29(Blocked, {
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
			return h$29("div", {
				className: "lp-card lp-result",
				...method ? { "data-result-label": method.label } : {}
			}, h$29(CardHead, {
				label: "10 年心血管风险",
				info: h$29(react.default.Fragment, null, h$29("span", { className: "lp-info-line" }, RISK_INFO), card?.note_zh ? h$29("span", { className: "lp-info-line" }, card.note_zh) : null),
				mark: method?.label ?? null
			}), h$29("div", { className: "lp-result-figure" }, h$29("span", { className: "lp-num-lg" }, riskText(result.risk_pct)), h$29("span", { className: "lp-bignum-unit" }, "%"), result.category_zh ? h$29("span", { className: "lp-badge lp-badge-neutral" }, result.category_zh) : null), range, goal != null && Number.isFinite(goal) ? h$29("div", { className: "lp-result-goal" }, h$29("span", { className: "lp-caption" }, "达到方案目标约"), h$29("span", { className: "lp-strong" }, `${riskText(goal)}%`), card?.category_zh?.goal ? h$29("span", { className: "lp-badge lp-badge-good" }, card.category_zh.goal) : null) : null, binding ? h$29("p", { className: "lp-caption lp-method-sentence" }, binding) : null, h$29("p", { className: "lp-caption lp-result-note" }, [result.date ? `按 ${chineseDate(result.date)}的记录和你的档案计算` : "", "未来 10 年发生心梗、脑卒中等的估计概率"].filter(Boolean).join(" · ")));
		}
		function MethodCard(props) {
			const out = primaryOutput(props.result);
			const numeric = out != null && typeof out.value === "number";
			const title = titleOf(props.result.skill, props.result.title_zh, out?.key ?? "");
			const figure = numeric ? String(Number(out.value.toFixed(2))) : out && typeof out.value === "string" ? out.value.trim() : "";
			const unit = out?.unit ? plainUnits(facingUnit(out.unit, out.key)) : "";
			const unmatched = props.result.label === "unverified-binding";
			const sentence = unmatched ? bindingCaption(props.result) : figure ? restOfSentence(resultSentence(props.result, { youngerAllowed: false }), title, shownOf(props.result)) : plainUnits(resultSentence(props.result, { youngerAllowed: false }));
			return h$29("div", {
				className: "lp-card lp-result",
				"data-result-label": props.result.label
			}, h$29(CardHead, {
				label: title,
				info: h$29("span", { className: "lp-info-line" }, props.result.limits_zh || "模型估计，不是诊断。"),
				mark: props.result.label
			}), numeric ? h$29("div", { className: "lp-result-figure" }, h$29("span", { className: unmatched ? "lp-num-md" : "lp-num-lg" }, plainUnits(figure)), unit ? h$29("span", { className: "lp-bignum-unit" }, unit) : null) : figure ? h$29("div", { className: "lp-result-figure" }, h$29("span", { className: "lp-num-md" }, [unmatched ? measuredOf(sentence) : "", judgementWord(plainUnits(figure))].filter(Boolean).join(" · "))) : null, sentence ? h$29("p", { className: `${unmatched ? "lp-caption" : "lp-muted"} lp-method-sentence` }, sentence) : null);
		}
		function EvidenceCard(props) {
			const species = speciesOf(props.result) ?? "未标明";
			return h$29("section", {
				className: "lp-card lp-result lp-method-evidence",
				"data-result-label": "evidence-only"
			}, h$29(CardHead, {
				label: "文献证据",
				info: h$29("span", { className: "lp-info-line" }, props.result.limits_zh),
				mark: "evidence-only",
				estimate: false
			}), h$29("p", { className: "lp-strong" }, `物种：${species}`), h$29("p", { className: "lp-method-sentence" }, plainUnits(resultSentence(props.result, { youngerAllowed: false }))));
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
			const values = extras.map((row, index) => h$29(MethodCard, {
				key: `value-${index}`,
				result: row
			}));
			const evidence = slice.evidence.map((row, index) => h$29(EvidenceCard, {
				key: `evidence-${index}`,
				result: row
			}));
			const bio = h$29(BodyAgeCard, {
				key: "bio",
				...props,
				method: pheno
			});
			const risk = h$29(RiskCard, {
				key: "risk",
				...props,
				method: riskMethod
			});
			const feedback = h$29(FeedbackBlock, {
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
			return h$29("div", {
				className: "lp-stack",
				id: "lp-results"
			}, unmatchedCount > 0 ? h$29("p", { className: "lp-caption" }, unmatchedCount === shownMethods.filter(Boolean).length ? "以下结果均未与你的记录逐项核对（各卡已注明所用数值），暂不能视为你的结果。" : `其中 ${unmatchedCount} 项结果未与你的记录逐项核对（卡片已注明所用数值），暂不能视为你的结果。`) : null, h$29("div", { className: "lp-grid-2 lp-results" }, ...cards, ...values), evidence.length > 0 ? h$29("div", {
				className: "lp-stack",
				id: "lp-methods"
			}, ...evidence) : null, h$29("div", { className: "lp-grid-2 lp-results lp-results-plan" }, feedback));
		}
		//#endregion
		//#region src/client/triage/care-card.ts
		const h$28 = react.default.createElement;
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
			return h$28(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title: "给医生的一页简报",
				onClose: props.onClose,
				headless: true,
				className: "lp-brief-dialog"
			}, h$28("div", { className: "lp lp-brief-modal" }, h$28("h2", { className: "lp-h2" }, "给医生的一页简报"), h$28("p", { className: "lp-caption" }, "数字来自你的体检记录；姓名一栏留空，打印后手写。这不是诊断。"), h$28("pre", {
				className: "lp-brief-pre",
				tabIndex: 0
			}, answer.markdown ?? ""), h$28("div", { className: "lp-modal-actions" }, id ? h$28(LinkButton, {
				href: `/api/longpi/brief?id=${encodeURIComponent(id)}&format=md&download=1`,
				icon: "download",
				download: `longpi-doctor-brief-${answer.brief?.created ?? ""}.md`
			}, "保存为文件") : null, h$28(Btn$1, {
				variant: "outline",
				onClick: () => printText("给医生的一页简报", answer.markdown ?? "")
			}, "打印"), h$28(Btn$1, {
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
					if (!result.ok) throw new Error(result.error || "保存失败");
					props.onNotice(status === "visited" ? "已记录医生结论，下一步建议和方案将相应调整。" : status === "booked" ? `已记录：${chineseDate(date)}就诊。就诊前可打印简报。` : "已记录。需要就诊时，可随时打印简报。", "good");
					setStep("none");
					notifyChanged();
				} catch (err) {
					props.onNotice(`保存失败：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(false);
				}
			};
			const lastText = last ? last.care_status === "booked" ? `已预约 ${chineseDate(last.visit_date)}`.trim() : last.care_status === "declined" ? "暂不就诊" : last.care_status === "visited" ? `已就诊 ${chineseDate(last.visit_date)}`.trim() : "" : "";
			return h$28("div", { className: "lp-care-visit" }, h$28("p", { className: "lp-small lp-muted" }, lastText ? `是否已预约？医生意见如何？（上次：${lastText}）` : "是否已预约？医生意见如何？"), step === "none" ? h$28("div", { className: "lp-actions" }, h$28(Btn$1, {
				variant: "outline",
				disabled: busy,
				onClick: () => setStep("booked")
			}, "已预约"), h$28(Btn$1, {
				variant: "outline",
				disabled: busy,
				onClick: () => setStep("visited")
			}, "已就诊"), h$28(Btn$1, {
				variant: "ghost",
				disabled: busy,
				onClick: () => {
					send("declined");
				}
			}, "暂不就诊")) : null, step !== "none" ? h$28("div", { className: "lp-care-visit-form" }, h$28("div", { className: "lp-field lp-care-date" }, h$28("label", {
				className: "lp-field-label",
				htmlFor: "lp-care-visit-date"
			}, step === "booked" ? "就诊日期" : "就诊日期"), h$28("input", {
				id: "lp-care-visit-date",
				type: "date",
				className: "lp-input",
				value: date,
				onChange: (event) => setDate(event.target.value)
			})), step === "visited" ? h$28("div", { className: "lp-field" }, h$28("label", {
				className: "lp-field-label",
				htmlFor: "lp-care-visit-outcome"
			}, "医生意见"), h$28("textarea", {
				id: "lp-care-visit-outcome",
				className: "lp-input",
				rows: 2,
				placeholder: "例如：缺铁，已开药，3 个月后复查",
				value: outcome,
				onChange: (event) => setOutcome(event.target.value)
			})) : null, h$28("div", { className: "lp-actions" }, h$28(Btn$1, {
				disabled: busy || !date,
				onClick: () => {
					send(step);
				}
			}, busy ? "保存中…" : "保存"), h$28(Btn$1, {
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
					if (!answer.ok) throw new Error(answer.error || "生成失败");
					setBrief(answer);
				} catch (err) {
					props.onNotice(`简报生成失败：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setBusy(false);
				}
			};
			const detail = careDetail(journey.next.title_zh, journey.next.detail_zh);
			return h$28("section", {
				className: "lp-card lp-care-box",
				"aria-label": "请先去看医生",
				id: "lp-care"
			}, h$28("div", { className: "lp-card-head" }, h$28("h3", { className: "lp-h3 lp-care-title" }, h$28(Icon, {
				name: "warn",
				size: 16
			}), "最重要的一步")), h$28("div", { className: "lp-care-text" }, h$28("p", { className: "lp-strong" }, journey.next.title_zh), detail ? h$28("p", { className: "lp-muted" }, detail) : null), h$28("div", { className: "lp-actions" }, h$28(Btn$1, {
				disabled: busy,
				onClick: () => {
					openBrief();
				}
			}, busy ? "正在整理…" : "医生简报（可打印）"), h$28(Btn$1, {
				variant: "outline",
				onClick: props.onIndicators
			}, "查看这些指标"), journey.triage.needs_sex ? h$28(Btn$1, {
				variant: "outline",
				onClick: props.onProfile
			}, "填写性别") : null), h$28(VisitForm, {
				journey,
				onNotice: props.onNotice
			}), brief ? h$28(BriefModal, {
				answer: brief,
				onClose: () => setBrief(null)
			}) : null);
		}
		//#endregion
		//#region src/client/life.ts
		const h$27 = react.default.createElement;
		/** Sleep and training reuse the labs table; the filter lives here because the page keeps only the labs filter. */
		function AreaTab(props) {
			const [filter, setFilter] = react.default.useState("all");
			return h$27(IndicatorsTab, {
				filter,
				onFilter: setFilter,
				onConnect: props.onConnect,
				area: props.area
			});
		}
		function SleepTab(props = {}) {
			return h$27(AreaTab, {
				area: "sleep",
				onConnect: props.onConnect
			});
		}
		function TrainingTab(props = {}) {
			return h$27(AreaTab, {
				area: "training",
				onConnect: props.onConnect
			});
		}
		function AskTab(props) {
			const questions = suggestedQuestions({
				changes: (props.journey.changes ?? []).slice(0, 2).map((row) => row.label_zh),
				visit: props.journey.reminders.find((row) => row.kind === "retest")?.date ?? null
			});
			const ask = (text) => props.onPrompt(text);
			return h$27("div", { className: "lp-tab-body" }, h$27("section", {
				className: "lp-card",
				"aria-labelledby": "lp-ask-title"
			}, h$27("div", { className: "lp-card-head" }, h$27("h3", {
				className: "lp-card-title",
				id: "lp-ask-title"
			}, "可以这样问")), h$27("p", { className: "lp-muted lp-text" }, "随时可以提问。问用药、补剂、饮食、检查或身体不适，会先直接回答，再补充需要了解的信息；问记录变化和进度，回答分为三部分：观察到的情况、数据无法说明的内容、下一步。"), h$27("ul", { className: "lp-ask-list" }, ...questions.map((text) => h$27("li", { key: text }, h$27("button", {
				type: "button",
				className: "lp-ask-btn",
				onClick: () => ask(text)
			}, h$27("span", { className: "lp-row-main" }, text), h$27(Icon, {
				name: "chevron",
				size: 14
			})))))));
		}
		function EmptyLine(props) {
			return h$27("div", { className: "lp-empty" }, h$27(Icon, {
				name: props.icon,
				size: 20
			}), h$27("div", { className: "lp-empty-title" }, props.title), h$27("p", { className: "lp-empty-text" }, props.text));
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
					setNote("已加入日程。");
					load();
				}).catch((error) => setNote(errorText(error, "未能加入日程")));
			};
			const fallback = suggestions.length === 0 ? retests[0] : void 0;
			const suggestionRows = suggestions.length > 0 ? suggestions.map((row) => h$27("li", {
				key: row.id,
				className: "lp-row lp-cal-row"
			}, h$27("span", { className: "lp-cal-date" }, dateZh$2(row.date ?? "")), h$27("div", { className: "lp-row-main" }, row.title_zh), h$27("div", { className: "lp-cal-actions" }, h$27(Btn$1, {
				size: "sm",
				onClick: () => confirm(row)
			}, "加入日程")))) : fallback ? [h$27("li", {
				key: "retest",
				className: "lp-row lp-cal-row"
			}, h$27("span", { className: "lp-cal-date" }, dateZh$2(fallback.date ?? "")), h$27("div", { className: "lp-row-main" }, h$27("div", null, fallback.text_zh), h$27("div", { className: "lp-caption" }, "请携带上次的简报和想咨询的问题。")), h$27("div", { className: "lp-cal-actions" }, h$27(Btn$1, {
				size: "sm",
				onClick: () => confirm({
					date: fallback.date ?? "",
					title_zh: fallback.text_zh,
					brief_zh: "携带简报和问题。",
					questions_zh: suggestedQuestions({ visit: fallback.date }).slice(0, 2),
					kind: "retest"
				})
			}, "加入日程"), h$27(Btn$1, {
				size: "sm",
				variant: "outline",
				onClick: () => setNote("暂不添加。")
			}, "暂不添加")))] : [];
			return h$27("div", { className: "lp-tab-body" }, events.length === 0 && retests.length === 0 ? h$27("section", {
				className: "lp-card",
				"aria-label": "已安排的日程"
			}, h$27(EmptyLine, {
				icon: "calendar",
				title: "暂无已安排的日程",
				text: "复查、就诊和待办事项。LongPi 的建议需经你确认后才会加入日程。"
			}), suggestionRows.length === 0 && note ? h$27("p", {
				className: "lp-caption",
				role: "status"
			}, note) : null) : h$27("section", {
				className: "lp-card",
				"aria-labelledby": "lp-cal-title"
			}, h$27("div", { className: "lp-card-head" }, h$27("h3", {
				className: "lp-card-title",
				id: "lp-cal-title"
			}, "已安排的日程")), h$27("ul", { className: "lp-rows" }, ...events.map((row) => h$27("li", {
				key: row.id,
				className: "lp-row lp-cal-line"
			}, h$27("span", { className: "lp-cal-date" }, dateZh$2(row.date ?? "")), h$27("div", { className: "lp-row-main" }, h$27("div", { className: "lp-strong" }, row.title_zh), row.brief_zh ? h$27("div", { className: "lp-muted" }, row.brief_zh) : null, row.questions_zh.length > 0 ? h$27("div", { className: "lp-caption" }, `可以问：${row.questions_zh.join("；")}`) : null))), ...retests.map((row) => h$27("li", {
				key: row.text_zh,
				className: "lp-row lp-cal-line"
			}, h$27("span", { className: "lp-cal-date" }, dateZh$2(row.date ?? "")), h$27("div", { className: "lp-row-main lp-strong" }, row.text_zh)))), suggestionRows.length === 0 && note ? h$27("p", {
				className: "lp-caption",
				role: "status"
			}, note) : null), suggestionRows.length > 0 ? h$27("section", {
				className: "lp-card",
				id: "lp-cal-suggest",
				"aria-labelledby": "lp-cal-suggest-title"
			}, h$27("div", { className: "lp-card-head" }, h$27("h3", {
				className: "lp-card-title",
				id: "lp-cal-suggest-title"
			}, "建议日程（未添加）")), h$27("ul", { className: "lp-rows" }, ...suggestionRows), note ? h$27("p", {
				className: "lp-caption",
				role: "status"
			}, note) : null) : null, h$27(Timeline, { journey: props.journey }));
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
			if (items.length === 0) return h$27("section", {
				className: "lp-card",
				id: "lp-timeline",
				"aria-label": "时间线"
			}, h$27(EmptyLine, {
				icon: "calendar",
				title: "暂无可显示的事件",
				text: "将化验、手环数据和生活事件按时间排列，便于发现关联，例如复查前曾经生病。"
			}));
			return h$27("section", {
				className: "lp-card",
				id: "lp-timeline",
				"aria-labelledby": "lp-timeline-title"
			}, h$27("div", { className: "lp-card-head" }, h$27("h3", {
				className: "lp-card-title",
				id: "lp-timeline-title"
			}, "时间线")), h$27(react.default.Fragment, null, h$27("p", { className: "lp-muted" }, "将化验、手环数据和生活事件按时间排列，便于发现关联，例如复查前曾经生病。"), h$27("ol", { className: "lp-rows" }, ...items.slice(-8).map((item, index, shown) => h$27("li", {
				key: `${item.kind}-${item.date}-${item.title_zh}`,
				className: "lp-row lp-cal-line"
			}, h$27("span", { className: "lp-cal-date" }, index > 0 && shown[index - 1]?.date === item.date ? "" : dateZh$2(item.date)), h$27("span", { className: "lp-row-main" }, cleanLabel$1(`${item.title_zh} · ${item.detail_zh}`)))))));
		}
		function InsightCard(props) {
			const [text, setText] = react.default.useState(null);
			react.default.useEffect(() => {
				let live = true;
				getJson("/api/longpi/codex/slot").then(async (season) => {
					if (!live) return;
					if (season.enabled !== true) {
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
					const labNote = lab ? `${lab.label_zh}近期变化大于平常。睡眠或步数无法解释这项化验结果，建议复查时再关注。` : null;
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
			return h$27("section", {
				className: "lp-card lp-insight",
				id: "lp-insight"
			}, h$27("div", { className: "lp-label" }, "今日洞察"), h$27("p", null, text));
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
			return h$27("section", {
				className: "lp-card lp-science-invite",
				id: "lp-science-invite"
			}, h$27("div", { className: "lp-label" }, "一起研究"), h$27("p", null, SCIENCE_INTRO), h$27("p", { className: "lp-caption" }, waiting), h$27("div", { className: "lp-form-actions" }, h$27(Btn$1, { onClick: () => props.goTab("science") }, "加入"), h$27(Btn$1, {
				variant: "outline",
				onClick: later
			}, "以后再说")));
		}
		//#endregion
		//#region src/client/overview.ts
		const h$26 = react.default.createElement;
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
			missed: "未完成",
			unknown: "没有记录"
		};
		function WeekStrip(props) {
			if (!props.tracking) return null;
			const week = weekOf(props.tracking, props.today);
			const retest = retestDates(props.tracking)[0];
			const retestText = retest ? retest.date <= props.today ? `现在可以复测${retest.marker}` : `${chineseDate(retest.date)}可复测${retest.marker}` : "";
			return h$26("div", { className: "lp-week" }, h$26("div", { className: "lp-week-line" }, h$26("span", { className: "lp-caption" }, "本周"), h$26("ol", {
				className: "lp-week-cells",
				"aria-label": `近 7 天：${week.map((day) => `${chineseDate(day.date)}${DAY_ZH[day.state]}`).join("，")}`
			}, ...week.map((day) => h$26("li", {
				key: day.date,
				className: `lp-week-cell lp-week-${day.state}`,
				title: `${chineseDate(day.date)} ${DAY_ZH[day.state]}`
			}, h$26("span", {
				className: "lp-week-day",
				"aria-hidden": true
			}, WEEK_ZH[(/* @__PURE__ */ new Date(`${day.date}T12:00:00Z`)).getUTCDay()]))))), retestText ? h$26("p", { className: "lp-caption" }, retestText) : null);
		}
		function TodayCard(props) {
			const { stateOf, busy, answer } = useCheckIns(props.journey, props.onNotice);
			const counts = todayCounts(props.journey);
			return h$26("section", {
				className: "lp-card",
				id: "lp-today",
				"aria-labelledby": "lp-today-title"
			}, h$26("div", { className: "lp-card-head" }, h$26("h3", {
				className: "lp-card-title",
				id: "lp-today-title"
			}, "今天", counts.total > 0 ? h$26("span", { className: "lp-caption lp-num" }, `${counts.done}/${counts.total}`) : null)), h$26(TodayList, {
				journey: props.journey,
				stateOf,
				busy,
				onAnswer: answer
			}), h$26(WeekStrip, {
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
					label: "查看方案效果",
					run: () => props.goTab("plan")
				};
				case "doctor": return {
					label: "查看这些指标",
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
			return h$26("section", {
				className: "lp-card lp-next-card",
				"aria-label": "下一步"
			}, h$26("div", { className: "lp-next-text" }, h$26("div", { className: "lp-caption" }, "下一步"), h$26("h3", { className: "lp-h3" }, next.title_zh), next.detail_zh && next.detail_zh !== next.title_zh ? h$26("p", { className: "lp-muted lp-small" }, next.detail_zh) : null), cta ? h$26(Btn$1, { onClick: cta.run }, cta.label) : null);
		}
		/** Some reads failed: the missing values are unknown, not "not measured". */
		function PartialNote(props) {
			const records = props.journey.records;
			if (records.status !== "partial") return null;
			const missing = records.missing_reads.filter((name) => name && !isDiagnosisName(name)).map((name) => scrubVisible(name)).filter(Boolean);
			const errors = records.read_errors.map((line) => scrubVisible(line)).filter(Boolean);
			return h$26("div", {
				className: "lp-callout lp-callout-warn",
				role: "note"
			}, h$26(Icon, {
				name: "warn",
				size: 14
			}), h$26("span", null, `部分记录本次未读取到${errors.length > 0 ? `（${errors.slice(0, 2).join("；")}）` : ""}。`, missing.length > 0 ? `未读取到的指标：${missing.slice(0, 6).join("、")}${missing.length > 6 ? ` 等 ${missing.length} 项` : ""}。` : "", "这些指标并非未检测，请稍后点击右上角「刷新」重试。"));
		}
		function Overview(props) {
			const { journey } = props;
			const doctor = journey.next.action === "doctor";
			const covered = coveredByCare(journey);
			return h$26("div", { className: "lp-tab-body" }, h$26(PartialNote, { journey }), doctor ? h$26(CareCard, {
				journey,
				onNotice: props.onNotice,
				onIndicators: () => props.goTab("indicators", { filter: "changed" }),
				onProfile: props.openOnboarding
			}) : null, h$26(InsightCard, {
				journey,
				covered
			}), journey.plan.exists ? h$26(TodayCard, {
				journey,
				tracking: props.tracking,
				onNotice: props.onNotice
			}) : null, h$26(ResultsRow, {
				journey,
				tracking: props.tracking,
				onAction: props.onAction,
				onNotice: props.onNotice,
				covered
			}), doctor ? null : h$26(NextCard, props), h$26(NotableChanges, {
				journey,
				covered,
				onOpenIndicators: () => props.goTab("indicators", { filter: "changed" })
			}), doctor ? null : h$26(ScienceIntro, { goTab: props.goTab }));
		}
		react.default.createElement;
		//#endregion
		//#region src/client/privacy/data-page.ts
		const h$24 = react.default.createElement;
		function List(props) {
			if (props.lines.length === 0) return null;
			return h$24("div", { className: "lp-data-list" }, h$24("div", { className: "lp-field-label" }, props.title), h$24("ul", { className: "lp-bullets" }, ...props.lines.map((line) => h$24("li", { key: line }, line))));
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
				getJson("/api/longpi/privacy").then(setStatus).catch((err) => setError(errorText(err, "未能读取隐私说明")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const act = (body) => {
				setError(null);
				setBusy(true);
				postJson("/api/longpi/privacy/consent", body).then(() => {
					setNote("已保存");
					if (body.scope === "data_flow_deepseek" && (body.decision === "granted" || body.decision === "declined")) props.onDecided?.(body.decision);
					load();
				}).catch((err) => setError(errorText(err, "保存失败"))).finally(() => setBusy(false));
			};
			const copy = status?.copy;
			const flow = copy?.data_flow;
			const decision = status?.consents?.data_flow_deepseek?.decision;
			const sessionOn = status?.session_log?.upload === true;
			const phraseText = copy?.delete?.phrase ?? "删除全部";
			const minorLine = status?.minor?.ask_age ? copy?.minor?.ask ?? "请填写年龄" : status?.minor?.minor ? copy?.minor?.under_18 ?? "未满 18 岁" : "";
			const title = flow?.title ?? "数据去向";
			const body = h$24("div", { className: "lp-data" }, flow ? h$24("div", { className: "lp-data-lists" }, h$24(List, {
				title: "发送给 DeepSeek 模型的数据",
				lines: flow.to_deepseek ?? []
			}), h$24(List, {
				title: "保存在这台电脑上的数据",
				lines: flow.stays_local ?? []
			}), h$24(List, {
				title: "保存在健康数据服务中的数据",
				lines: flow.mirobody ?? []
			}), flow.name && !(flow.to_deepseek ?? []).some((line) => /名字|称呼|姓名/.test(line)) ? h$24("p", { className: "lp-caption" }, flow.name) : null) : null, h$24("div", { className: "lp-data-group" }, h$24("div", { className: "lp-field-label" }, "健康对话发给 DeepSeek"), decision === "granted" || decision === "declined" ? h$24("div", { className: "lp-actions" }, h$24("span", { className: `lp-badge ${decision === "granted" ? "lp-badge-good" : "lp-badge-neutral"}` }, decision === "granted" ? "已同意" : "不发送"), h$24(Btn$1, {
				variant: "outline",
				disabled: busy,
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: decision === "granted" ? "declined" : "granted"
				})
			}, decision === "granted" ? "撤回" : "同意")) : h$24(react.default.Fragment, null, h$24("p", { className: "lp-caption" }, "还没有选择。"), h$24("div", { className: "lp-actions" }, h$24(Btn$1, {
				disabled: busy,
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: "granted"
				})
			}, copy?.buttons?.flow_grant ?? "同意把健康对话发给 DeepSeek"), h$24(Btn$1, {
				variant: "outline",
				disabled: busy,
				onClick: () => act({
					scope: "data_flow_deepseek",
					decision: "declined"
				})
			}, copy?.buttons?.flow_decline ?? "暂不发送")))), h$24("div", { className: "lp-data-group" }, h$24(Switch, {
				checked: sessionOn,
				busy,
				disabled: busy || !status,
				label: "上传会话日志",
				onChange: (next) => act({
					scope: "session_log_upload",
					decision: next ? "granted" : "declined"
				})
			}), h$24("p", { className: "lp-caption" }, flow?.session_log || "健康对话默认不上传会话日志。")), minorLine ? h$24("p", { className: "lp-caption" }, minorLine) : null, props.hideExport ? null : h$24("div", { className: "lp-data-group" }, h$24("div", { className: "lp-field-label" }, "导出"), status?.export?.href ? h$24(LinkButton, {
				href: status.export.href,
				icon: "download"
			}, "下载这台电脑上的 LongPi 档案") : null, status?.export?.mirobody_note_zh ? h$24("p", { className: "lp-caption" }, status.export.mirobody_note_zh) : null), h$24("div", { className: "lp-data-group" }, h$24("div", { className: "lp-field" }, h$24("label", {
				className: "lp-field-label",
				htmlFor: "lp-privacy-phrase"
			}, `删除：输入「${phraseText}」`), h$24("input", {
				id: "lp-privacy-phrase",
				className: "lp-input",
				value: phrase,
				autoComplete: "off",
				onChange: (event) => setPhrase(event.target.value)
			})), h$24("div", { className: "lp-actions" }, h$24(Btn$1, {
				variant: "outline",
				onClick: () => {
					postJson("/api/longpi/privacy/delete", { confirm: phrase }).then(() => setNote("已删除这台电脑上的 LongPi 档案")).catch((err) => setError(errorText(err, "删除失败")));
				}
			}, "删除这台电脑上的 LongPi 数据")), copy?.delete?.note ? h$24("p", { className: "lp-caption" }, copy.delete.note) : null), error ? h$24("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, note ? h$24("p", {
				className: "lp-conn-ok",
				role: "status"
			}, note) : null);
			if (props.embedded) return h$24("details", {
				className: "lp-data-fold",
				id: "lp-privacy-data"
			}, h$24("summary", null, props.hideExport ? `${title}和删除` : `${title}、导出和删除`), body);
			return h$24("section", {
				className: "lp lp-data-page",
				id: "lp-privacy-data"
			}, h$24("h3", { className: "lp-h3" }, title), body);
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
		let version$1 = 0;
		const listeners$2 = /* @__PURE__ */ new Set();
		function changed() {
			version$1 += 1;
			for (const listener of listeners$2) listener();
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
				listeners$2.add(listener);
				return () => {
					listeners$2.delete(listener);
				};
			}, () => version$1, () => version$1);
		}
		//#endregion
		//#region src/client/toolviews.ts
		const h$23 = react.default.createElement;
		function objectOf$3(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function parseArgs(raw) {
			if (typeof raw !== "string" || !raw.trim()) return {};
			try {
				return objectOf$3(JSON.parse(raw));
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
			const node = objectOf$3(block);
			if (node.kind !== "tool-result") return {
				state: "running",
				args: parseArgs(node.argsRaw),
				result: null,
				text: "",
				error: ""
			};
			const args = parseArgs(objectOf$3(node.call).argsRaw);
			const text = (Array.isArray(node.content) ? node.content : []).map((part) => {
				const row = objectOf$3(part);
				return row.type === "text" && typeof row.text === "string" ? row.text : JSON.stringify(part, null, 2);
			}).join("\n");
			if (node.isError === true) {
				const err = objectOf$3(node.error);
				const code = [err.name, err.code].filter((part) => typeof part === "string" && part).join(": ");
				return {
					state: "error",
					args,
					result: null,
					text,
					error: text.split("\n")[0] || code || "工具未完成"
				};
			}
			let result = null;
			try {
				result = objectOf$3(JSON.parse(text));
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
			return h$23("div", {
				className: `lp lp-tool ${props.quiet ? "lp-tool-quiet" : "lp-tool-card"} ${call.state === "error" ? "lp-tool-error" : ""}`,
				"data-state": call.state
			}, h$23("div", { className: "lp-tool-head" }, h$23("span", {
				className: "lp-tool-icon",
				"aria-hidden": true
			}, h$23(Icon, {
				name: running ? "refresh" : call.state === "error" ? "warn" : props.icon,
				size: 14,
				className: running ? "lp-spin" : ""
			})), h$23("span", { className: "lp-tool-title" }, props.title), props.summary != null ? h$23("span", { className: `lp-tool-summary ${props.tone ? `lp-tool-${props.tone}` : ""}` }, props.summary) : null, props.action ?? null, rawText ? h$23("button", {
				type: "button",
				className: "lp-tool-raw-btn",
				"aria-expanded": raw,
				onClick: () => setRaw((current) => !current)
			}, "原始结果", h$23(Icon, {
				name: "chevron",
				size: 12,
				className: raw ? "lp-rot" : ""
			})) : null), props.children ? h$23("div", { className: "lp-tool-body" }, props.children) : null, raw && rawText ? h$23("pre", { className: "lp-tool-raw" }, rawText) : null);
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
						setError(`保存失败：${result.error}`);
						return;
					}
					setAdopted(props.callId, result.version);
					props.onSaved({
						version: result.version,
						reminder: result.reminder
					});
					setConfirming(false);
				} catch (err) {
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
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
			if (saved) return h$23("div", { className: "lp-tool-saved" }, h$23("span", { className: "lp-badge lp-badge-good" }, h$23(Icon, {
				name: "check",
				size: 12,
				strokeWidth: 2
			}), `已保存为方案第 ${saved.version} 版`), saved.reminder ? h$23("span", { className: "lp-caption" }, `打卡提醒没有打开：${saved.reminder}`) : null, openPlan ? h$23("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: openPlan
			}, "在健康页查看 →") : null);
			return h$23("div", { className: "lp-tool-draft" }, h$23(DraftItems, {
				draft,
				removed,
				onToggle: toggle,
				compact: true
			}), props.data.brief.notes_zh[0] ? h$23("p", { className: "lp-fine" }, props.data.brief.notes_zh[0]) : null, h$23("div", { className: "lp-form-actions" }, h$23(Btn$1, {
				onClick: () => {
					setError(null);
					setConfirming(true);
				},
				disabled: kept.length === 0
			}, "采用这份方案"), h$23("span", { className: "lp-caption" }, "每项是试验里的平均效果，个人结果会不同；补剂不给剂量，不涉及处方药。")), confirming ? h$23(ConfirmModal, {
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
			if (call.state === "running") return h$23(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "正在按你的结果和试验证据起草…"
			});
			if (call.state === "error") return h$23(Shell, {
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
			if (!data) return h$23(Shell, {
				call,
				icon: "spark",
				title: "起草方案",
				summary: "结果无法显示，请展开查看原始结果",
				tone: "warn"
			});
			if (!data.draft) return h$23(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: "暂时无法起草"
			}, h$23("p", { className: "lp-muted" }, data.brief.notes_zh[0] || "你的记录中暂无与研究证据匹配的指标。"));
			return h$23(Shell, {
				call,
				icon: "spark",
				title: "方案草稿",
				summary: saved ? `${data.draft.items.length} 项 · 已采用` : `${data.draft.items.length} 项 · 按证据起草 · 还没有保存`
			}, h$23(DraftCard, {
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
			if (call.state === "running") return h$23(Shell, {
				call,
				icon: "check",
				title,
				summary: confirm ? "正在保存…" : "正在核对…"
			});
			if (call.state === "error") return h$23(Shell, {
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
				return h$23(Shell, {
					call,
					icon: "check",
					title: "保存方案",
					quiet: true,
					summary: h$23("span", { className: "lp-badge lp-badge-good" }, h$23(Icon, {
						name: "check",
						size: 12,
						strokeWidth: 2
					}), version != null ? `已保存为方案第 ${version} 版` : "已保存"),
					action: openPlan ? h$23("button", {
						type: "button",
						className: "lp-tool-undo",
						onClick: openPlan
					}, "在健康页查看 →") : null
				});
			}
			return h$23(Shell, {
				call,
				icon: "check",
				title: "方案复述",
				summary: errors.length > 0 ? "还缺信息，没有保存" : "还没有保存，确认后才保存",
				tone: errors.length > 0 ? "warn" : void 0
			}, readBack.length > 0 ? h$23("ul", { className: "lp-readback" }, ...readBack.map((text, index) => {
				const row = readBackRow(text);
				return h$23("li", { key: index }, row.category ? h$23("span", { className: "lp-tag" }, row.category) : null, h$23("span", { className: "lp-strong" }, row.title), row.rest ? h$23("span", { className: "lp-caption" }, ` ${row.rest}`) : null);
			})) : null, ...errors.map((text) => h$23("p", {
				key: `e:${text}`,
				className: "lp-form-error"
			}, text)), ...warnings.map((text) => h$23("p", {
				key: `w:${text}`,
				className: "lp-caption lp-tool-warn"
			}, h$23(Icon, {
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
			if (call.state === "running") return h$23(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "正在记录…"
			});
			if (call.state === "error") return h$23(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: `记录失败：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const entries = (Array.isArray(result.entries) ? result.entries : []).map((row) => {
				const entry = objectOf$3(row);
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
			const nameOf = (row, withState) => `${titleOf(row)}${withState && row.done === false ? "（未完成）" : ""}${row.date && row.date !== today ? `（${chineseDate(row.date) || row.date}）` : ""}`;
			const answered = entries.filter((row) => !row.undo && row.done !== null);
			const undoable = answered.filter((row) => row.date === today);
			const recorded = undone ? answered.filter((row) => row.date !== today) : answered;
			const taken = [...entries.filter((row) => row.undo), ...undone ? undoable : []];
			const noted = entries.filter((row) => !row.undo && row.done === null);
			const parts = [
				recorded.length > 0 ? `已记录：${recorded.map((row) => nameOf(row, true)).join("、")}` : "",
				taken.length > 0 ? `已撤销：${taken.map((row) => nameOf(row, false)).join("、")}` : "",
				noted.length > 0 ? `已保存备注：${noted.map((row) => nameOf(row, false)).join("、")}` : ""
			].filter(Boolean);
			const onlyTaken = recorded.length === 0 && noted.length === 0;
			async function undo() {
				setUndoing(true);
				setError(null);
				try {
					for (const row of undoable) await postCheckIn(today, row.item, null);
					setUndone(props.callId);
				} catch (err) {
					setError(`撤销失败：${errorText(err, "请稍后再试")}`);
				} finally {
					setUndoing(false);
				}
			}
			if (entries.length === 0) return h$23(Shell, {
				call,
				icon: "check",
				title: "打卡",
				summary: "记录失败",
				tone: "warn",
				quiet: true
			}, ...problems.map((text) => h$23("p", {
				key: text,
				className: "lp-caption"
			}, text)));
			return h$23(Shell, {
				call,
				icon: "check",
				title: "打卡",
				quiet: true,
				summary: h$23("span", { className: `lp-badge ${onlyTaken ? "lp-badge-neutral" : "lp-badge-good"}` }, h$23(Icon, {
					name: onlyTaken ? "close" : "check",
					size: 12,
					strokeWidth: 2
				}), parts.join("；")),
				action: !undone && undoable.length > 0 ? h$23("button", {
					type: "button",
					className: "lp-tool-undo",
					disabled: undoing,
					onClick: () => {
						undo();
					},
					"aria-label": `撤销今天的打卡：${undoable.map((row) => nameOf(row, true)).join("、")}`
				}, undoing ? "撤销中" : "撤销") : null
			}, error ? h$23("p", { className: "lp-form-error" }, error) : null, ...problems.map((text) => h$23("p", {
				key: text,
				className: "lp-caption"
			}, text)));
		}
		const PHENOAGE_SKILL = "accelerated-biological-aging-risk";
		const RISK_SKILL = "china-par-ascvd-risk";
		function outputValue(result, key) {
			const value = objectOf$3(objectOf$3(result.outputs)[key]).value;
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
			const outputs = Object.values(objectOf$3(result?.outputs)).map((row) => objectOf$3(row).label_zh).find((label) => typeof label === "string" && label);
			return typeof outputs === "string" ? outputs : name;
		}
		function ResultFigure(props) {
			return h$23("div", { className: "lp-tool-result" }, h$23("span", { className: "lp-num-md lp-tool-figure" }, props.figure, h$23("span", { className: "lp-unit" }, props.unit)), h$23("span", {
				className: "lp-tag",
				title: "模型根据你的记录计算的估计值，不是诊断"
			}, "模型估计"), h$23(Info, { label: props.label }, props.info), ...props.lines.filter(Boolean).map((line) => h$23("span", {
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
			if (call.state === "running") return h$23(Shell, {
				call,
				icon: "play",
				title: `计算${plain}`,
				summary: "正在运行方法…"
			});
			if (call.state === "error") return h$23(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: `计算未完成：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			if (result.ok !== true) {
				const reason = typeof result.error === "string" && result.error ? result.error : typeof result.error_kind === "string" ? result.error_kind : "方法未返回结果";
				return h$23(Shell, {
					call,
					icon: "play",
					title: plain,
					summary: `未能算出：${reason}`,
					tone: "warn"
				});
			}
			if (name === PHENOAGE_SKILL) {
				const phenoage = numberOf(outputValue(result, "phenoage"));
				const advance = numberOf(outputValue(result, "phenoage_advance"));
				const band = journey?.results.bioage.band_years;
				if (phenoage != null) return h$23(Shell, {
					call,
					icon: "play",
					title: BIOAGE_LABEL,
					summary: typeof result.measured_at === "string" ? `按 ${chineseDate(result.measured_at) || result.measured_at}的血检` : void 0
				}, h$23(ResultFigure, {
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
				if (risk != null) return h$23(Shell, {
					call,
					icon: "play",
					title: RISK_LABEL,
					summary: typeof result.measured_at === "string" ? `按 ${chineseDate(result.measured_at) || result.measured_at}的记录` : void 0
				}, h$23(ResultFigure, {
					figure: riskText(risk),
					unit: "%",
					lines: [typeof category === "string" ? category : "", "同类人群的平均风险"],
					label: RISK_LABEL,
					info: RISK_INFO
				}));
			}
			const excerpt = typeof result.report_excerpt === "string" ? result.report_excerpt.trim() : "";
			return h$23(Shell, {
				call,
				icon: "play",
				title: plain,
				summary: "已算出"
			}, excerpt ? h$23("details", { className: "lp-tool-report" }, h$23("summary", null, "报告"), h$23("pre", null, excerpt)) : null);
		}
		function SituationToolView(props) {
			const call = parseCall(props.block);
			if (call.state === "running") return h$23(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: "正在读取…"
			});
			if (call.state === "error") return h$23(Shell, {
				call,
				icon: "user",
				title: "读取档案与记录",
				quiet: true,
				summary: `读取失败：${call.error}`,
				tone: "bad"
			});
			const result = call.result ?? {};
			const indicators = typeof result.indicator_count === "number" ? result.indicator_count : null;
			const summary = objectOf$3(result.records_summary);
			const checkups = typeof summary.checkups === "number" ? summary.checkups : null;
			const counts = [checkups != null ? `${checkups} 次体检` : "", indicators != null ? `${indicators} 项指标` : ""].filter(Boolean).join("，");
			const changes = (Array.isArray(result.record_changes) ? result.record_changes : []).map(objectOf$3).filter((row) => row.ask_doctor === true);
			const failed = result.record_status === "error" || result.record_status === "partial";
			return h$23(Shell, {
				call,
				icon: "user",
				title: counts ? `已读取你的档案与记录（${counts}）` : "已读取你的档案与记录",
				quiet: true
			}, failed ? h$23("p", { className: "lp-caption lp-tool-warn" }, h$23(Icon, {
				name: "warn",
				size: 12
			}), ` 部分记录未读取到${typeof result.record_error === "string" && result.record_error ? `：${result.record_error}` : ""}`) : null, changes.length > 0 ? h$23("p", { className: "lp-tool-doctor" }, h$23(Icon, {
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
				question_zh: "以下哪类人暂不参加这项步行小试验？",
				options_zh: [
					"谁都可以，包括正在打胰岛素的人",
					"正在打胰岛素，或在吃容易让血糖过低的药的人，暂不参加",
					"只有不满 18 岁的人可以"
				]
			},
			claim: {
				question_zh: "结果会怎么说？",
				options_zh: [
					"说走路治好了血糖",
					"只说明两种走法之后的血糖差值，以及该差别是否可靠",
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
				question_zh: "如何退出？",
				options_zh: [
					"无法退出",
					"随时可以退出。尚未发出的部分将被删除，已发出的合计无法收回",
					"要等研究结束才能退"
				]
			},
			dx: {
				question_zh: "这个结果能当作诊断吗？",
				options_zh: [
					"能，它可以下诊断",
					"不能。它只说明起伏的大小，诊疗仍需咨询医生",
					"可以代替看医生"
				]
			}
		};
		//#endregion
		//#region src/client/science/consent.ts
		const h$22 = react.default.createElement;
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
					setNote("已保存。");
					props.onChange();
				}).catch((error) => props.onError(error instanceof Error ? error.message : "保存失败"));
			};
			const withdraw = () => {
				postJson("/api/longpi/science/withdraw", {
					study_id: props.study.id,
					confirm: true
				}).then(() => {
					setNote("已退出。");
					props.onChange();
				}).catch((error) => props.onError(error instanceof Error ? error.message : "退出失败"));
			};
			const state = props.study.consented === "granted" ? "已参加" : props.study.consented === "withdrawn" ? "已退出" : "未参加";
			return h$22("article", {
				className: "lp-card",
				id: `lp-study-${props.study.id}`
			}, h$22("div", { className: "lp-card-head" }, h$22("h3", { className: "lp-card-title" }, props.study.title_zh)), h$22("div", { className: "lp-tags" }, h$22("span", { className: `lp-badge ${props.study.consented === "granted" ? "lp-badge-good" : "lp-badge-neutral"}` }, state), h$22("span", { className: "lp-tag" }, props.study.kind === "community_season" ? "社区赛季" : "研究"), props.threshold ? h$22("span", { className: "lp-caption" }, props.threshold) : null), withoutStaysLocal(props.study.summary_zh) ? h$22("p", { className: "lp-text" }, withoutStaysLocal(props.study.summary_zh)) : null, h$22("p", { className: "lp-small lp-muted lp-measure" }, "基因数据和姓名不纳入研究。"), h$22("details", null, h$22("summary", null, "完整同意书"), h$22("p", { className: "lp-small lp-muted lp-measure" }, localText(props.study.text_zh))), ...questions.map((question) => {
				const plain = PLAIN[question.id];
				const title = plain?.question_zh ?? question.question_zh;
				const options = plain?.options_zh ?? question.options_zh;
				return h$22("fieldset", {
					key: question.id,
					className: "lp-sci-q"
				}, h$22("legend", { className: "lp-field-label" }, title), h$22("div", { className: "lp-sci-options" }, ...options.map((option, index) => h$22("label", {
					key: option,
					className: "lp-check"
				}, h$22("input", {
					type: "radio",
					name: `${props.study.id}-${question.id}`,
					checked: picked[question.id] === index,
					onChange: () => setPicked({
						...picked,
						[question.id]: index
					})
				}), h$22("span", null, localText(option))))));
			}), h$22("div", { className: "lp-actions" }, h$22(Btn$1, {
				disabled: !ready,
				onClick: submit
			}, "加入"), h$22(Btn$1, {
				variant: "outline",
				onClick: () => {
					postJson("/api/longpi/science/invite", { decision: "later" }).then(() => setNote("已暂缓。这台电脑上的功能仍可使用。")).catch(() => setNote("以后再说。"));
				}
			}, "以后再说"), props.study.consented === "granted" ? h$22(Btn$1, {
				variant: "outline",
				onClick: withdraw
			}, "退出这项研究") : null), props.personal ? h$22("div", { className: "lp-card-foot" }, h$22("span", { className: "lp-caption lp-measure" }, props.personal.note), h$22(Btn$1, {
				variant: "outline",
				onClick: props.personal.onStart
			}, "开始个人对照")) : null, h$22("p", { className: "lp-caption lp-measure" }, "已发送的汇总数据无法撤回。"), note ? h$22("p", {
				className: "lp-small lp-measure",
				role: "status"
			}, note) : null);
		}
		//#endregion
		//#region src/client/science/community.ts
		const h$21 = react.default.createElement;
		function CommunityPanel(props) {
			const [topic, setTopic] = react.default.useState(props.voting.mine ?? "");
			const width = props.progress.min_cohort > 0 ? Math.min(100, Math.round(100 * props.progress.contributed / props.progress.min_cohort)) : 0;
			const vote = () => {
				postJson("/api/longpi/science/community", { topic_id: topic }).then(() => props.onChange()).catch((error) => props.onError(error instanceof Error ? error.message : "保存失败"));
			};
			const recruiting = (props.thresholds ?? []).some((row) => row.line_zh.includes("招募中"));
			return h$21(react.default.Fragment, null, h$21("section", {
				className: "lp-card",
				id: "lp-science-progress",
				"aria-labelledby": "lp-science-progress-title"
			}, h$21("div", { className: "lp-card-head" }, h$21("h3", {
				className: "lp-card-title",
				id: "lp-science-progress-title"
			}, "研究进度"), h$21("span", { className: "lp-caption" }, `第 ${props.progress.week} 周 / 共 ${props.progress.weeks} 周`)), h$21("div", {
				className: "lp-bar",
				role: "progressbar",
				"aria-label": `研究进度：${props.progress.label_zh}`,
				"aria-valuemin": 0,
				"aria-valuenow": props.progress.contributed,
				"aria-valuemax": props.progress.min_cohort
			}, h$21("span", { style: { width: `${width}%` } })), h$21("p", { className: "lp-small lp-muted lp-measure" }, recruiting ? "每项研究下方标注的是目标人数，目前正在招募。暂不显示已加入人数，人数也不代表你的结果。" : `这台电脑已参加 ${props.progress.studies} 项研究。发布的汇总数据至少包含 ${props.progress.min_cohort} 人。`)), h$21("section", {
				className: "lp-card",
				id: "lp-science-pulse",
				"aria-label": "大家的结果"
			}, h$21("div", { className: "lp-card-head" }, h$21("h3", { className: "lp-card-title" }, "大家的结果")), props.pulse ? h$21(react.default.Fragment, null, h$21("p", { className: "lp-text lp-strong" }, props.pulse.headline_zh), props.pulse.detail_zh ? h$21("p", { className: "lp-small lp-muted lp-measure" }, localText(props.pulse.detail_zh)) : null) : h$21("div", { className: "lp-empty" }, h$21(Icon, {
				name: "pulse",
				size: 20
			}), h$21("p", { className: "lp-empty-text lp-measure" }, localText(props.give_back_zh) || "暂无返回的群体结果。"))), h$21("section", {
				className: "lp-card",
				id: "lp-science-vote",
				"aria-labelledby": "lp-science-vote-title"
			}, h$21("div", { className: "lp-card-head" }, h$21("h3", {
				className: "lp-card-title",
				id: "lp-science-vote-title"
			}, "下个赛季希望优先研究哪个问题")), h$21("div", {
				className: "lp-sci-options",
				role: "radiogroup",
				"aria-labelledby": "lp-science-vote-title"
			}, ...props.voting.topics.map((item) => h$21("label", {
				key: item.id,
				className: "lp-check"
			}, h$21("input", {
				type: "radio",
				name: "lp-science-topic",
				value: item.id,
				checked: topic === item.id,
				onChange: () => setTopic(item.id)
			}), h$21("span", null, item.title_zh), h$21("span", {
				className: "lp-sci-count",
				"aria-label": `${item.votes} 票`
			}, String(item.votes))))), h$21("div", { className: "lp-actions" }, h$21(Btn$1, {
				variant: "outline",
				onClick: vote,
				disabled: !topic
			}, "提交投票"), props.voting.note_zh ? h$21("span", { className: "lp-caption" }, localText(props.voting.note_zh)) : null)), h$21("section", {
				className: "lp-card",
				id: "lp-science-cards",
				"aria-label": "贡献卡"
			}, h$21("div", { className: "lp-card-head" }, h$21("h3", { className: "lp-card-title" }, "贡献卡")), props.cards.length === 0 ? h$21("div", { className: "lp-empty" }, h$21(Icon, {
				name: "spark",
				size: 20
			}), h$21("p", { className: "lp-empty-text lp-measure" }, "贡献卡记录你在这台电脑上参与研究的情况，与化验结果好坏无关。在这台电脑上完成计算后会显示在此处。")) : h$21("ul", { className: "lp-rows" }, ...props.cards.map((card) => h$21("li", {
				key: card.id,
				className: "lp-row lp-row-stack"
			}, h$21("span", { className: "lp-strong" }, card.title_zh), h$21("span", { className: "lp-muted" }, card.body_zh))))));
		}
		//#endregion
		//#region src/client/science/translog.ts
		const h$20 = react.default.createElement;
		function TranslogPanel(props) {
			return h$20("section", {
				className: "lp-card",
				id: "lp-science-log",
				"aria-label": "发出记录"
			}, h$20("div", { className: "lp-card-head" }, h$20("h3", { className: "lp-card-title" }, "发出记录")), props.rows.length === 0 ? h$20("div", { className: "lp-empty" }, h$20(Icon, {
				name: "send",
				size: 20
			}), h$20("p", { className: "lp-empty-text lp-measure" }, "尚无数据离开这台电脑。此处仅记录发出的数据：发送时间及接收的研究。")) : h$20(react.default.Fragment, null, h$20("p", { className: "lp-small lp-muted lp-measure" }, "此处仅记录离开这台电脑的数据：发送时间及接收的研究。"), h$20("ol", { className: "lp-rows" }, ...props.rows.map((row) => h$20("li", {
				key: row.seq,
				className: "lp-row"
			}, h$20("span", { className: "lp-row-main" }, scrubVisible(row.detail_zh)), h$20("span", { className: "lp-caption lp-num" }, `${chineseDate(row.at)} ${row.at.slice(11, 16)}`.trim()))))));
		}
		//#endregion
		//#region src/client/science/studies-tab.ts
		const h$19 = react.default.createElement;
		function StudiesTab() {
			const [data, setData] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(() => {
				getJson("/api/longpi/science/community").then(setData).catch((reason) => setError(errorText(reason, "未能读取研究信息")));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const startPersonal = () => {
				postJson("/api/longpi/science/n-of-1", {
					confirm: true,
					design: "abab"
				}).then(() => load()).catch((reason) => setError(errorText(reason, "未能安排个人对照")));
			};
			if (!data) return h$19("div", { className: "lp-tab-body" }, error ? h$19("div", {
				className: "lp-callout lp-callout-warn",
				role: "alert"
			}, h$19(Icon, {
				name: "warn",
				size: 14
			}), h$19("p", { className: "lp-callout-body" }, error), h$19("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => {
					setError("");
					load();
				}
			}, "重试")) : h$19("p", { className: "lp-small lp-muted lp-measure" }, "正在读取研究…"));
			if (data.mode === "off") return h$19("div", { className: "lp-tab-body" }, h$19("section", {
				className: "lp-card",
				"aria-label": "研究没有打开"
			}, h$19("div", { className: "lp-empty" }, h$19("div", { className: "lp-empty-title" }, "研究没有打开"), h$19("p", { className: "lp-empty-text" }, data.reason_zh || "可在设置中重新开启。未满 18 岁者不参加研究。"))));
			const personalId = ((data.studies ?? []).find((study) => study.kind === "community_season") ?? (data.studies ?? [])[0])?.id;
			return h$19("div", { className: "lp-tab-body" }, error ? h$19("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, data.reason_zh ? h$19("div", { className: "lp-callout lp-callout-info" }, h$19(Icon, {
				name: "info",
				size: 14
			}), h$19("p", { className: "lp-callout-body" }, localText(data.reason_zh))) : null, data.progress && data.voting ? h$19(CommunityPanel, {
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
			}) : null, ...(data.studies ?? []).map((study) => h$19(ConsentPanel, {
				key: study.id,
				study,
				threshold: data.thresholds?.find((row) => row.study_id === study.id)?.line_zh,
				onChange: load,
				onError: setError,
				personal: study.id === personalId ? {
					note: `${data.early_zh ? `${localText(data.early_zh).split("。")[0]}。` : ""}可以先在这台电脑上做个人对照。`,
					onStart: startPersonal
				} : null
			})), h$19(TranslogPanel, { rows: data.translog ?? [] }));
		}
		//#endregion
		//#region src/client/science/index.ts
		const h$18 = react.default.createElement;
		function ScienceToolCard(props) {
			const call = parseCall(props.block);
			const result = call.result;
			const title = props.toolName === "record_study_consent" ? "研究同意" : props.toolName === "design_n_of_1" ? "个人对照" : "研究";
			const text = typeof result?.say_zh === "string" ? result.say_zh : typeof result?.result_zh === "string" ? result.result_zh : call.state === "running" ? "正在读取…" : call.error || "完成";
			return h$18("div", { className: "lp lp-tool lp-tool-card" }, h$18("div", { className: "lp-tool-head" }, h$18("span", { className: "lp-tool-title" }, title)), h$18("p", null, text));
		}
		function ScienceSettings() {
			return h$18("section", {
				className: "lp-stack",
				"aria-labelledby": "lp-science-settings-title"
			}, h$18("h3", {
				className: "lp-h3",
				id: "lp-science-settings-title"
			}, "研究"), h$18("p", { className: "lp-small lp-muted lp-measure" }, "研究正式开始后才会发送，目前仅保存在这台电脑上。"), h$18("a", {
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
			registerPrivacyClient();
			registerScienceClient();
		}
		//#endregion
		//#region src/client/datain/findings.ts
		const h$17 = react.default.createElement;
		const KIND_ZH$1 = {
			"ti-rads": "甲状腺超声",
			"bi-rads": "乳腺超声",
			nodule: "结节",
			ultrasound: "超声",
			conclusion: "结论",
			advice: "医师建议",
			wrong_person: "不属于本档案",
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
					if (!gone) setError(errorText(err, "未能读取报告叙述"));
				});
				return () => {
					gone = true;
				};
			}, [props.reloadKey]);
			if (error) return h$17("p", {
				className: "lp-form-error",
				role: "alert"
			}, error);
			if (!rows) return h$17("p", { className: "lp-small lp-muted lp-measure" }, "正在读取报告叙述…");
			if (rows.length === 0) return h$17("p", {
				className: "lp-small lp-muted lp-measure",
				id: "lp-findings-empty"
			}, "尚未从报告中读取超声、总检或医师建议。已上传的报告会在打开健康页时读取超声分级；也可以将 PDF 发送到健康对话。");
			return h$17("ul", {
				className: "lp-rows",
				id: "lp-findings"
			}, ...rows.map((row) => h$17("li", {
				key: row.id,
				className: "lp-row lp-row-stack"
			}, row.kind === "wrong_person" ? h$17("span", { className: "lp-tags" }, h$17("span", { className: "lp-badge lp-badge-warn" }, KIND_ZH$1[row.kind]), row.date ? h$17("span", { className: "lp-caption" }, chineseDate(row.date) || row.date) : null) : h$17("span", { className: "lp-caption" }, `${KIND_ZH$1[row.kind] ?? "报告"} ${chineseDate(row.date) || row.date || ""}`.trim()), h$17("span", null, row.page_note_zh || row.text_zh))));
		}
		//#endregion
		//#region src/client/datain/index.ts
		const h$16 = react.default.createElement;
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
			if (!row) return h$16("p", {
				className: "lp-small lp-muted lp-measure",
				id: "lp-genetics-empty"
			}, "暂无基因摘要。叙述版 PDF 请发送到健康对话。上传普通体检报告时请勿选择基因文件。");
			return h$16("div", {
				className: "lp-stack",
				id: "lp-genetics"
			}, h$16("p", null, (row.headlines_zh ?? []).join("；") || "已保存基因报告。"), (row.variants ?? []).length > 0 ? h$16("ul", { className: "lp-rows" }, ...(row.variants ?? []).slice(0, 12).map((item) => h$16("li", {
				key: item.rsid,
				className: "lp-row"
			}, h$16("span", { className: "lp-row-main" }, item.note_zh || item.rsid), h$16("span", { className: "lp-row-end lp-num" }, item.note_zh ? `${item.rsid} ${item.genotype}` : item.genotype)))) : null, (row.caveats_zh ?? []).length > 0 ? h$16("ul", { className: "lp-bullets" }, ...(row.caveats_zh ?? []).map((line) => h$16("li", { key: line }, line))) : null, row.raw_export_zh ? h$16("p", { className: "lp-caption lp-measure" }, row.raw_export_zh) : null, row.sample_id ? h$16("p", { className: "lp-caption lp-measure" }, `样本号仅保存在这台电脑上，不会发送给 DeepSeek 模型。`) : null);
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
					setError(errorText(err, "保存失败"));
				}
			}
			return h$16("div", {
				className: "lp-stack",
				id: "lp-meds"
			}, lines.length > 0 ? h$16("ul", { className: "lp-rows" }, ...lines.map((line) => h$16("li", {
				key: line,
				className: "lp-row"
			}, h$16("span", { className: "lp-row-main" }, line)))) : h$16("p", { className: "lp-small lp-muted lp-measure" }, "尚未记录用药。"), h$16("div", { className: "lp-form-grid" }, h$16("div", { className: "lp-field lp-field-full" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-name"
			}, "药名"), h$16("input", {
				id: "lp-med-name",
				className: "lp-input",
				value: name,
				onChange: (event) => setName(event.target.value)
			})), h$16("div", { className: "lp-field" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-dose"
			}, "用法", h$16("span", { className: "lp-optional" }, "按处方填写，选填")), h$16("input", {
				id: "lp-med-dose",
				className: "lp-input",
				value: dose,
				placeholder: "10 mg",
				onChange: (event) => setDose(event.target.value)
			})), h$16("div", { className: "lp-field" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: "lp-med-times"
			}, "服用时间", h$16("span", { className: "lp-optional" }, "选填")), h$16("input", {
				id: "lp-med-times",
				className: "lp-input",
				value: times,
				placeholder: "每日早晨一次",
				onChange: (event) => setTimes(event.target.value)
			}))), error ? h$16("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$16("div", { className: "lp-actions" }, h$16(Btn$1, {
				type: "button",
				disabled: !name.trim(),
				onClick: () => {
					save();
				}
			}, "保存用药")));
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
					setError(errorText(err, "保存失败"));
				}
			}
			return h$16("div", {
				className: "lp-stack",
				id: "lp-conditions"
			}, rows.length > 0 ? h$16("ul", { className: "lp-rows" }, ...rows.map((row) => h$16("li", {
				key: row.id,
				className: "lp-row"
			}, h$16("span", { className: "lp-row-main" }, row.text_zh)))) : h$16("p", { className: "lp-small lp-muted lp-measure" }, "尚未记录病情。"), h$16("div", { className: "lp-field" }, h$16("label", {
				className: "lp-field-label",
				htmlFor: "lp-cond-name"
			}, "病情或诊断"), h$16("input", {
				id: "lp-cond-name",
				className: "lp-input",
				value: name,
				placeholder: "脂肪肝",
				onChange: (event) => setName(event.target.value)
			})), error ? h$16("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$16("div", { className: "lp-actions" }, h$16(Btn$1, {
				type: "button",
				disabled: !name.trim(),
				onClick: () => {
					save();
				}
			}, "保存")), h$16("p", { className: "lp-caption lp-measure" }, "诊断保存在这台电脑上；健康数据服务不接收病情信息。"));
		}
		function DataInSection() {
			const [tick, setTick] = react.default.useState(0);
			return h$16("div", {
				className: "lp-grid-2",
				id: "lp-datain"
			}, h$16("div", {
				className: "lp-card",
				id: "lp-findings-card"
			}, h$16("div", { className: "lp-card-head" }, h$16("h3", { className: "lp-card-title" }, "报告里的叙述")), h$16(FindingsList, { reloadKey: tick }), h$16(ReportUpload, { onDone: () => setTick((value) => value + 1) })), h$16("div", {
				className: "lp-card",
				id: "lp-meds-card"
			}, h$16("div", { className: "lp-card-head" }, h$16("h3", { className: "lp-card-title" }, "用药")), h$16(MedsForm)), h$16("div", {
				className: "lp-card",
				id: "lp-conditions-card"
			}, h$16("div", { className: "lp-card-head" }, h$16("h3", { className: "lp-card-title" }, "病情")), h$16(ConditionsForm)), h$16("div", {
				className: "lp-card",
				id: "lp-genetics-card"
			}, h$16("div", { className: "lp-card-head" }, h$16("h3", { className: "lp-card-title" }, "基因")), h$16(GeneticsCard)));
		}
		//#endregion
		//#region src/client/connection.ts
		const h$15 = react.default.createElement;
		const LOOPBACK = /* @__PURE__ */ new Set([
			"127.0.0.1",
			"localhost",
			"[::1]"
		]);
		/** The same rule the server applies: https, or http only on this computer. */
		/**
		* The manual connection form (address, token, email and password) is for whoever installs LongPi, not for the
		* person using it (LongPi pairs with the health data service on this computer by itself). It shows only when this
		* browser has localStorage longpi.dev = 1.
		*/
		function manualConnectionAllowed() {
			try {
				return typeof localStorage !== "undefined" && localStorage.getItem("longpi.dev") === "1";
			} catch {
				return false;
			}
		}
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
			return h$15("div", { className: "lp-conn-status" }, h$15("div", { className: "lp-status" }, h$15("span", {
				className: `lp-statusdot ${ok ? "lp-statusdot-on" : bad ? "lp-statusdot-bad" : ""}`,
				"aria-hidden": true
			}), ok ? "已连接" : bad ? `连接失败：${connection.error || "未返回原因"}` : connection.pairing_error ? `尚未连接：${connection.pairing_error}` : "尚未连接"), ok && connection.summary && !props.brief ? h$15("div", { className: "lp-caption" }, `找到：${summaryParts(connection.summary).join(" · ")}`) : null);
		}
		/** Whether the 数据连接 card offers 重新连接: the record does not read, or the link was set by hand (no token). */
		function reconnectOffer(connection) {
			if (!connection) return {
				show: false,
				confirm: ""
			};
			const handSet = connection.source !== "none" && !connection.token_set;
			if (connection.status === "ok" && !handSet) return {
				show: false,
				confirm: ""
			};
			return {
				show: true,
				confirm: connection.status === "ok" && handSet ? "当前连接由安装时设置。重新连接后将改用 LongPi 在这台电脑上的账号，原连接中的记录不再显示。" : ""
			};
		}
		/**
		* 重新连接: LongPi pairs with the health data service on this computer again. Nothing to fill in. With confirm,
		* the first click says what will change and a second click goes ahead.
		*/
		function ReconnectAction(props) {
			const [busy, setBusy] = react.default.useState(false);
			const [asking, setAsking] = react.default.useState(false);
			const [message, setMessage] = react.default.useState(null);
			const run = async () => {
				if (props.confirm && !asking) {
					setAsking(true);
					return;
				}
				setAsking(false);
				setBusy(true);
				setMessage(null);
				try {
					const result = await postJson("/api/longpi/connection/reconnect", {});
					setMessage(result.ok ? {
						text: "已重新连接。",
						ok: true
					} : {
						text: result.error || "重新连接失败，请稍后重试。",
						ok: false
					});
					notifyChanged();
				} catch (error) {
					setMessage({
						text: errorText(error, "重新连接失败，请稍后重试。"),
						ok: false
					});
				} finally {
					setBusy(false);
				}
			};
			return h$15("div", { className: "lp-conn-reconnect" }, asking ? h$15("p", { className: "lp-caption" }, props.confirm) : null, h$15("div", { className: "lp-actions" }, h$15(Btn$1, {
				variant: "outline",
				disabled: busy,
				onClick: () => {
					run();
				}
			}, busy ? "正在重新连接…" : asking ? "确认重新连接" : "重新连接"), asking ? h$15(Btn$1, {
				variant: "ghost",
				disabled: busy,
				onClick: () => setAsking(false)
			}, "取消") : null), message ? h$15("p", {
				className: message.ok ? "lp-conn-ok" : "lp-form-error",
				role: message.ok ? "status" : "alert"
			}, message.text) : null);
		}
		function TestOutcome(props) {
			const { result } = props;
			if (!result.ok) return h$15("p", {
				className: "lp-form-error",
				role: "alert"
			}, `连接失败：${result.error}`);
			const summary = result.connection?.summary;
			return h$15("p", {
				className: "lp-conn-ok",
				role: "status"
			}, h$15(Icon, {
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
					setDone(`已登录并连接${typeof result.indicators === "number" ? `，读取到 ${result.indicators} 项` : ""}。`);
					notifyChanged();
					await reload("connection");
					props.onSaved?.();
				} catch (err) {
					setError(errorText(err, "登录失败"));
				} finally {
					setBusy(false);
				}
			}
			return h$15("div", {
				className: "lp-conn-login",
				id: `${props.idPrefix}-login`
			}, h$15("p", { className: "lp-muted" }, "用邮箱和密码登录并连接。"), h$15("details", null, h$15("summary", null, "更改服务地址"), h$15("div", { className: "lp-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-base`
			}, "服务地址"), h$15("input", {
				id: `${props.idPrefix}-base`,
				className: "lp-input",
				value: base,
				autoComplete: "off",
				spellCheck: false,
				onChange: (event) => setBase(event.target.value)
			}))), h$15("div", { className: "lp-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-email`
			}, "邮箱"), h$15("input", {
				id: `${props.idPrefix}-email`,
				type: "email",
				className: "lp-input",
				value: email,
				autoComplete: "username",
				onChange: (event) => setEmail(event.target.value)
			})), h$15("div", { className: "lp-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-password`
			}, "密码"), h$15("input", {
				id: `${props.idPrefix}-password`,
				type: "password",
				className: "lp-input",
				value: password,
				autoComplete: "current-password",
				onChange: (event) => setPassword(event.target.value)
			})), error ? h$15("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, done ? h$15("p", {
				className: "lp-conn-ok",
				role: "status"
			}, done) : null, h$15("div", { className: "lp-form-actions" }, h$15(Btn$1, {
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
					setError(`清除失败：${errorText(err, "请稍后再试")}`);
				} finally {
					setBusy(null);
				}
			}
			return h$15("form", {
				className: "lp-conn-form",
				noValidate: true,
				onSubmit: (event) => {
					event.preventDefault();
					run("save");
				}
			}, h$15(MirobodyLogin, { idPrefix: props.idPrefix }), h$15("details", { className: "lp-conn-advanced" }, h$15("summary", null, "改用连接地址（供安装人员使用）"), props.connection?.url_masked ? h$15("p", { className: "lp-caption" }, `当前地址 ${props.connection.url_masked}`) : null, h$15("p", { className: "lp-caption" }, "仅在安装人员提供连接地址时填写，一般无需设置。"), h$15("div", { className: "lp-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-url`
			}, "连接地址"), h$15("input", {
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
			})), h$15("div", { className: "lp-field" }, h$15("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-token`
			}, "访问令牌", h$15("span", { className: "lp-optional" }, "地址中已包含时可留空")), h$15("input", {
				id: `${props.idPrefix}-token`,
				type: "password",
				className: "lp-input",
				value: token,
				autoComplete: "new-password",
				placeholder: "选填",
				onChange: (event) => setToken(event.target.value)
			}))), error ? h$15("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, outcome ? h$15(TestOutcome, { result: outcome }) : null, h$15("div", { className: "lp-form-actions" }, h$15(Btn$1, {
				variant: "outline",
				type: "button",
				disabled: busy != null,
				onClick: () => {
					run("test");
				}
			}, busy === "test" ? "测试中…" : "测试连接"), h$15(Btn$1, {
				type: "submit",
				disabled: busy != null
			}, busy === "save" ? "测试并保存中…" : "保存"), saved ? h$15("button", {
				type: "button",
				className: "lp-linkbtn",
				disabled: busy != null,
				onClick: () => {
					clear();
				}
			}, h$15(Icon, {
				name: "trash",
				size: 13
			}), busy === "clear" ? "清除中" : "清除保存的地址") : null), h$15("p", { className: "lp-fine" }, saved ? "清除后改用安装时配置的地址（如果有）。" : "保存前会先用此地址读取记录目录，读取成功后才保存；地址和令牌仅保存在这台电脑上。"));
		}
		/** Status plus form. collapsed: when connected, the form waits behind 换一个地址 (onboarding step 3). */
		/** hideStatus: the caller already shows the status line (the settings page, above its 高级 fold). */
		function ConnectionPanel(props) {
			const { data, loading, error } = useConnection();
			const [open, setOpen] = react.default.useState(false);
			if (!data && loading) return h$15(Skeleton, { height: 96 });
			if (!data) return h$15(LoadError, {
				what: "连接状态",
				error,
				onRetry: () => reload("connection")
			});
			const connected = data.status === "ok";
			const showForm = !props.collapsed || !connected || open;
			return h$15("div", { className: "lp-conn" }, props.hideStatus ? null : h$15(ConnectionStatus, {
				connection: data,
				brief: props.collapsed
			}), showForm ? h$15(ConnectionForm, {
				connection: data,
				idPrefix: props.idPrefix,
				onSaved: (connection) => {
					setOpen(false);
					props.onSaved?.(connection);
				}
			}) : h$15("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => setOpen(true)
			}, "更换连接 →"));
		}
		//#endregion
		//#region src/client/profile-editor.ts
		const h$14 = react.default.createElement;
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
					setError("年龄请填写整数，例如 52。");
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
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
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
			return h$14("form", {
				className: `lp-profile lp-profile-${props.variant}`,
				onSubmit: (event) => {
					save(event);
				},
				noValidate: true
			}, onboarding ? null : h$14("div", { className: "lp-field" }, h$14("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-name`
			}, "称呼", h$14("span", { className: "lp-optional" }, "选填")), h$14("input", {
				id: `${props.idPrefix}-name`,
				className: "lp-input",
				value: draft.displayName,
				maxLength: 40,
				autoComplete: "nickname",
				placeholder: "页面中对你的称呼",
				onChange: (event) => edit({ displayName: event.target.value })
			})), h$14("div", { className: "lp-profile-group" }, h$14("div", { className: "lp-profile-basics" }, h$14("div", { className: "lp-field lp-profile-age" }, h$14("label", {
				className: "lp-field-label",
				htmlFor: `${props.idPrefix}-age`
			}, "年龄（周岁）"), h$14("div", { className: "lp-input-unit" }, h$14("input", {
				id: `${props.idPrefix}-age`,
				className: "lp-input",
				inputMode: "numeric",
				value: draft.age,
				placeholder: "例如 52",
				"aria-invalid": !ageCheck.ok,
				"data-modal-autofocus": onboarding ? true : void 0,
				onChange: (event) => edit({ age: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })
			}), h$14("span", { className: "lp-unit" }, "岁"))), h$14(Segmented, {
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
			})), h$14("p", { className: "lp-unlock" }, h$14(Icon, {
				name: "lock",
				size: 12
			}), `解锁：${unlockOf(props.journey, "age")}`)), h$14("fieldset", { className: "lp-facts" }, h$14("legend", { className: "lp-facts-legend" }, h$14("span", { className: "lp-field-label" }, "心血管风险还需要这 6 项"), h$14("span", { className: "lp-caption" }, `已回答 ${answeredFacts} 项。如不确定，请选择「不确定」，不会按「否」处理。`)), ...facts.map((row) => h$14("div", {
				className: "lp-fact",
				key: row.key
			}, h$14("div", { className: "lp-fact-text" }, h$14("div", {
				className: "lp-fact-label",
				id: `${props.idPrefix}-${row.key}-text`
			}, row.label_zh), h$14("div", { className: "lp-caption" }, `解锁：${row.unlocks_zh || "心血管风险"}`, row.men_only ? female ? " · 女性公式不使用此项，可跳过" : " · 只用于男性的公式" : "")), h$14(Segmented, {
				name: `${props.idPrefix}-${row.key}`,
				label: row.label_zh,
				hideLabel: true,
				options: ANSWERS,
				value: draft.risk[row.key] ?? "",
				onChange: (value) => edit({ risk: {
					...draft.risk,
					[row.key]: value
				} })
			})))), h$14("div", { className: "lp-profile-focus" }, h$14("div", {
				className: "lp-field-label",
				id: `${props.idPrefix}-focus`
			}, "你最关心什么", h$14("span", { className: "lp-optional" }, "可多选，按选择顺序排列")), h$14("div", {
				className: "lp-toggles",
				role: "group",
				"aria-labelledby": `${props.idPrefix}-focus`
			}, ...focusOptions.map((option) => {
				const index = draft.focus.indexOf(option.key);
				return h$14(ToggleChip, {
					key: option.key,
					pressed: index >= 0,
					badge: index >= 0 ? String(index + 1) : void 0,
					onClick: () => toggleFocus(option.key)
				}, option.label_zh);
			}))), error ? h$14("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$14("div", { className: onboarding ? "lp-modal-actions" : "lp-form-actions" }, onboarding ? h$14(Btn$1, {
				variant: "outline",
				type: "button",
				onClick: props.onSkip,
				disabled: busy
			}, "跳过") : null, h$14(Btn$1, {
				type: "submit",
				disabled: busy || !onboarding && !dirty
			}, busy ? "保存中…" : onboarding ? "保存并继续" : "保存档案"), !onboarding && !dirty && props.journey?.profile.complete ? h$14("span", { className: "lp-caption" }, "已是最新") : null));
		}
		//#endregion
		//#region src/client/profile-tab.ts
		const h$13 = react.default.createElement;
		/** Whether the record is connected, and what was found. LongPi pairs by itself; the manual form is for installers only. */
		function ConnectionCard(props) {
			const { data } = useConnection();
			const manual = manualConnectionAllowed();
			const [editing, setEditing] = react.default.useState(false);
			return h$13("div", {
				className: "lp-card",
				id: "lp-connection-card"
			}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "数据连接"), manual ? h$13("button", {
				type: "button",
				className: "lp-textbtn",
				"aria-expanded": editing,
				onClick: () => setEditing((current) => !current)
			}, editing ? "收起" : "手动连接") : null), data ? h$13(ConnectionStatus, { connection: data }) : h$13(RecordsStatusLine, { journey: props.journey }), reconnectOffer(data).show ? h$13(ReconnectAction, { confirm: reconnectOffer(data).confirm }) : null, manual && editing ? h$13(ConnectionForm, {
				connection: data,
				idPrefix: "lp-profile-conn",
				onSaved: () => setEditing(false)
			}) : null);
		}
		/** The next-checkup add-on list, as rows. What they unlock is said once when it is the same for all of them. */
		function AddonRows(props) {
			return h$13("ul", {
				className: "lp-rows",
				id: "lp-profile-addons-addons"
			}, ...props.journey.addons.map((row) => {
				const note = [props.common ? "" : `解锁：${row.unlocks_zh}`, row.self_measurable ? "可在家自行测量" : ""].filter(Boolean).join(" · ");
				return h$13("li", {
					key: row.item_zh,
					className: "lp-row"
				}, h$13("div", { className: "lp-row-main lp-row-lines" }, h$13("span", { className: "lp-strong" }, row.item_zh), note ? h$13("span", { className: "lp-caption" }, note) : null), row.self_measurable && row.self_key ? h$13(InlineSelf, {
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
			return h$13("div", {
				className: "lp-card",
				id: "lp-export-card"
			}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "导出"), openSettings ? h$13("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: () => openSettings("longpi")
			}, "隐私与删除", h$13(Icon, {
				name: "chevron",
				size: 12
			})) : null), h$13("p", { className: "lp-small lp-muted lp-measure" }, "报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；会员档案是 Pi 记下的你的画面、小承诺和小胜利；日历文件包含复测日期和每天的打卡提醒。"), h$13("div", { className: "lp-actions" }, h$13(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: `longpi-report-${props.today}.md`
			}, "导出报告"), h$13(LinkButton, {
				href: "/api/longpi/member-file",
				icon: "download",
				download: `longpi-member-${props.today}.md`
			}, "会员档案"), h$13(LinkButton, {
				href: "/api/longpi/calendar.ics",
				icon: "calendar",
				download: "longpi.ics"
			}, "加入日历"), archive?.href ? h$13(LinkButton, {
				href: archive.href,
				icon: "download"
			}, "下载完整档案") : null), archive?.note ? h$13("p", { className: "lp-caption lp-measure" }, archive.note) : null, h$13("p", { className: "lp-caption lp-plan-aside" }, h$13(Icon, {
				name: "lock",
				size: 12
			}), "导出的文件留在这台电脑上，LongPi 不会发给任何人。"));
		}
		function ProfileTab(props) {
			const { journey } = props;
			const today = journey.today;
			const unlocks = [...new Set(journey.addons.map((row) => row.unlocks_zh))];
			const common = unlocks.length === 1 && unlocks[0] ? unlocks[0] : null;
			return h$13("div", { className: "lp-tab-body" }, h$13("div", {
				className: "lp-grid-2",
				id: "lp-profile-section"
			}, h$13("div", {
				className: "lp-card",
				id: "lp-profile-card"
			}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "基本情况"), h$13("span", { className: "lp-caption" }, "只保存在这台电脑上")), h$13(ProfileEditor, {
				journey,
				variant: "page",
				idPrefix: "lp-profile",
				onNotice: props.onNotice
			})), h$13("div", { className: "lp-profile-side" }, h$13("div", {
				className: "lp-card",
				id: "lp-self-card"
			}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "自测"), h$13("span", { className: "lp-caption" }, "腰围 · 家庭血压 · 体重")), h$13(SelfLatestList, { latest: journey.self.latest }), h$13(SelfMeasureForm, {
				journey,
				idPrefix: "lp-self",
				onNotice: props.onNotice
			}), h$13("p", { className: "lp-caption lp-measure" }, "家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。建议早晚各测一次，每次坐位休息 5 分钟后测量。"), h$13(SelfRecent, { onNotice: props.onNotice })), h$13(ConnectionCard, { journey }), h$13(ExportCard, { today }))), h$13(DataInSection), journey.addons.length > 0 ? h$13("div", {
				className: "lp-card",
				id: "lp-addons-card"
			}, h$13("div", { className: "lp-card-head" }, h$13("h3", { className: "lp-card-title" }, "下次体检加测"), h$13("span", { className: "lp-caption" }, common ? `${journey.addons.length} 项 · 解锁${common}` : `${journey.addons.length} 项，加测后可计算更多结果`)), h$13(AddonRows, {
				journey,
				onNotice: props.onNotice,
				common
			})) : null, ...profileSections().filter((section) => section.id !== "longpi-privacy").map((section) => h$13("div", {
				key: section.id,
				className: "lp-card"
			}, h$13(section.Component, {
				journey,
				onNotice: props.onNotice
			}))));
		}
		//#endregion
		//#region src/client/engage/activity.ts
		const KEY = "dsh-plugin-longpi.activity";
		let state = {
			since: Date.now(),
			last: Date.now()
		};
		let lastKey = 0;
		let turnSince = null;
		let installed = false;
		function readShared() {
			try {
				const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
				return raw && Number.isFinite(raw.since) && Number.isFinite(raw.last) ? raw : null;
			} catch {
				return null;
			}
		}
		function writeShared() {
			try {
				window.localStorage.setItem(KEY, JSON.stringify(state));
			} catch {}
		}
		/** One input event: a long enough pause before it starts a new sitting. Exported for tests. */
		function noteInput(now, prev) {
			if (now - prev.last >= 3e5) return {
				since: now,
				last: now
			};
			return {
				since: prev.since,
				last: now
			};
		}
		function onInput(event) {
			const now = Date.now();
			const shared = readShared();
			if (shared && shared.last > state.last) state = shared;
			state = noteInput(now, state);
			if (event.type === "keydown") lastKey = now;
			writeShared();
		}
		let moveAt = 0;
		function onMove(event) {
			const now = Date.now();
			if (now - moveAt < 15e3) return;
			moveAt = now;
			onInput(event);
		}
		/** Listen once; returns a disposer. */
		function installActivity() {
			if (installed || typeof document === "undefined") return () => {};
			installed = true;
			const shared = readShared();
			if (shared && Date.now() - shared.last < 3e5) state = shared;
			document.addEventListener("keydown", onInput, true);
			document.addEventListener("pointerdown", onInput, true);
			document.addEventListener("pointermove", onMove, true);
			document.addEventListener("wheel", onMove, true);
			return () => {
				installed = false;
				document.removeEventListener("keydown", onInput, true);
				document.removeEventListener("pointerdown", onInput, true);
				document.removeEventListener("pointermove", onMove, true);
				document.removeEventListener("wheel", onMove, true);
			};
		}
		/** Minutes of continuous use; 0 after a pause of 5 minutes or more. */
		function sittingMinutes(now = Date.now()) {
			const shared = readShared();
			const row = shared && shared.last > state.last ? shared : state;
			if (now - row.last >= 3e5) return 0;
			return (now - row.since) / 6e4;
		}
		function typedWithin(ms, now = Date.now()) {
			return now - lastKey < ms;
		}
		/** Feed whether some agent turn is running now; the time it started is kept. */
		function noteTurnRunning(running, now = Date.now()) {
			if (running && turnSince == null) turnSince = now;
			if (!running) turnSince = null;
		}
		function turnRunningMs(now = Date.now()) {
			return turnSince == null ? 0 : now - turnSince;
		}
		/** DOM fallback when the host's session hooks are absent: a stop button or a streaming node is on screen. */
		function turnBusy() {
			if (typeof document === "undefined") return false;
			return Boolean(document.querySelector("[data-streaming=\"true\"], button[aria-label=\"停止\"], button[aria-label=\"停止生成\"], button[aria-label=\"Stop\"]"));
		}
		//#endregion
		//#region src/client/engage/slot-store.ts
		let current = {
			enabled: false,
			slot: {
				standup: false,
				standups_left: 0,
				reveal: null,
				quiet: null
			},
			pane_zh: null,
			pane_neutral_zh: null,
			presentation: false,
			ready: 0
		};
		let version = 0;
		let timer = null;
		let users = 0;
		const listeners$1 = /* @__PURE__ */ new Set();
		function emit() {
			version += 1;
			for (const listener of listeners$1) listener();
		}
		async function refreshSlot() {
			try {
				const next = await getJson("/api/longpi/codex/slot");
				if (next && typeof next === "object" && next.slot) {
					current = {
						enabled: next.enabled === true,
						slot: next.slot,
						pane_zh: next.pane_zh ?? null,
						pane_neutral_zh: next.pane_neutral_zh ?? null,
						presentation: next.presentation === true,
						ready: next.ready ?? 0
					};
					emit();
				}
			} catch {}
		}
		function start() {
			if (timer != null || typeof window === "undefined") return;
			refreshSlot();
			timer = window.setInterval(() => {
				if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
				refreshSlot();
			}, 6e4);
		}
		function stop() {
			if (timer != null) window.clearInterval(timer);
			timer = null;
		}
		function useSlot() {
			react.default.useEffect(() => {
				users += 1;
				start();
				return () => {
					users -= 1;
					if (users === 0) stop();
				};
			}, []);
			react.default.useSyncExternalStore((listener) => {
				listeners$1.add(listener);
				return () => {
					listeners$1.delete(listener);
				};
			}, () => version, () => version);
			return current;
		}
		/** Presentation mode: everything LongPi shows outside its own page is hidden at once, then saved. */
		async function setPresentation(on) {
			current = {
				...current,
				presentation: on,
				slot: {
					...current.slot,
					quiet: on ? "presentation" : null
				}
			};
			emit();
			try {
				await postJson("/api/longpi/codex", {
					action: "prefs",
					presentation: on
				});
			} catch {}
			await refreshSlot();
		}
		function togglePresentation() {
			setPresentation(!current.presentation);
		}
		/** A prompt-slot event (shown, 好, 今天别提醒了, reveal shown / 稍后 / 去看). */
		function slotEvent(event, ref) {
			postJson("/api/longpi/codex", {
				action: "nudge",
				event,
				...ref ? { ref } : {}
			}).then(() => refreshSlot()).catch(() => void 0);
		}
		const TYPING_MS = 1e4;
		function sittingZh(minutes) {
			const m = Math.max(0, Math.round(minutes));
			const hours = Math.floor(m / 60);
			const rest = m % 60;
			if (hours === 0) return `${rest} 分钟`;
			return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
		}
		/** Decide, at most every few seconds, whether a prompt should appear now. Pure apart from the shared clocks. */
		function nextPrompt(input) {
			if (!input.enabled || input.presentation || input.typing) return null;
			if (input.reveal) return {
				kind: "reveal",
				ref: input.reveal.ref,
				text: input.reveal.text_zh,
				at: input.now
			};
			if (input.standup && input.sitting >= 90 && input.turnMs >= 6e4) return {
				kind: "standup",
				text: `已经坐了 ${sittingZh(input.sitting)}。起来走两分钟？`,
				at: input.now
			};
			return null;
		}
		//#endregion
		//#region src/client/engage/slot.ts
		const h$12 = react.default.createElement;
		let prompt = null;
		let promptVersion = 0;
		const promptListeners = /* @__PURE__ */ new Set();
		function setPrompt(next) {
			prompt = next;
			promptVersion += 1;
			for (const listener of promptListeners) listener();
		}
		function usePrompt() {
			react.default.useSyncExternalStore((listener) => {
				promptListeners.add(listener);
				return () => {
					promptListeners.delete(listener);
				};
			}, () => promptVersion, () => promptVersion);
			return prompt;
		}
		function useTick(ms) {
			const [, set] = react.default.useState(0);
			react.default.useEffect(() => {
				const timer = window.setInterval(() => set((n) => n + 1), ms);
				return () => window.clearInterval(timer);
			}, [ms]);
		}
		function useDecide(running) {
			const slot = useSlot();
			const current = usePrompt();
			useTick(5e3);
			react.default.useEffect(() => installActivity(), []);
			noteTurnRunning(running);
			react.default.useEffect(() => {
				const now = Date.now();
				if (current) {
					if (slot.presentation) setPrompt(null);
					else if (current.kind === "standup" && now - current.at > 18e4) setPrompt(null);
					return;
				}
				const next = nextPrompt({
					enabled: slot.enabled,
					presentation: slot.presentation,
					standup: slot.slot.standup,
					reveal: slot.slot.reveal,
					sitting: sittingMinutes(now),
					turnMs: turnRunningMs(now),
					typing: typedWithin(TYPING_MS, now),
					now
				});
				if (!next) return;
				setPrompt(next);
				if (next.kind === "standup") slotEvent("shown");
				else slotEvent("reveal_shown", next.ref);
			});
			return current;
		}
		function PromptRow(props) {
			const p = props.prompt;
			const buttons = p.kind === "standup" ? [h$12(Btn$1, {
				key: "ok",
				size: "sm",
				variant: "outline",
				onClick: () => {
					slotEvent("ok");
					setPrompt(null);
				}
			}, "好"), h$12(Btn$1, {
				key: "off",
				size: "sm",
				variant: "ghost",
				onClick: () => {
					slotEvent("dismiss_today");
					setPrompt(null);
				}
			}, "今天别提醒了")] : [h$12(Btn$1, {
				key: "go",
				size: "sm",
				variant: "outline",
				onClick: () => {
					slotEvent("reveal_open", p.ref);
					setPrompt(null);
					props.openCodex();
				}
			}, "去看"), h$12(Btn$1, {
				key: "later",
				size: "sm",
				variant: "ghost",
				onClick: () => {
					slotEvent("reveal_later", p.ref);
					setPrompt(null);
				}
			}, "稍后")];
			return h$12("div", {
				className: props.className,
				role: "status"
			}, h$12("span", { className: "lp-slot-text" }, p.text), h$12("span", { className: "lp-slot-actions" }, ...buttons));
		}
		/** The pane's top row: the prompt, or in presentation mode the one line 「演示模式中」. */
		function PaneSlot(props) {
			const slot = useSlot();
			const current = useDecide(props.running ?? turnBusy());
			if (slot.presentation) return null;
			if (!current) return null;
			return h$12(PromptRow, {
				prompt: current,
				openCodex: props.openCodex,
				className: "lp-slot lp-slot-pane"
			});
		}
		function Bar(props) {
			const current = useDecide(props.running);
			if (!current || props.hidden) return null;
			const open = () => {
				try {
					window.localStorage.setItem("dsh-plugin-longpi.page-tab", "codex");
				} catch {}
				props.openPage?.();
			};
			return h$12("div", { className: "lp lp-slot-wrap" }, h$12(PromptRow, {
				prompt: current,
				openCodex: open,
				className: "lp-slot lp-slot-bar"
			}));
		}
		function useBusy(useSessions) {
			return useSessions ? useSessions((state) => Object.values(state.byId ?? {}).some((row) => row.running === true)) : turnBusy();
		}
		function WithHooks(props) {
			const active = props.usePanelInfo ? props.usePanelInfo((info) => info.activePanelId === PANEL_ID) : false;
			const page = usePageShowing();
			const pane = usePaneShowing();
			const running = useBusy(props.useSessions);
			return h$12(Bar, {
				...props,
				hidden: active || page || pane,
				running
			});
		}
		/** shell.overlay: the bottom-right bar when neither the pane nor the page is on screen. */
		function CodexOverlay(props) {
			const key = `${typeof props.usePanelInfo}-${typeof props.useSessions}`;
			return h$12(WithHooks, {
				...props,
				key
			});
		}
		/** The page's in-flow line under the header: what the Codex has going, never a value. */
		function SeasonBar(props) {
			const slot = useSlot();
			if (!slot.enabled || slot.presentation) return null;
			const text = slot.ready > 0 ? "长寿图鉴 · 有一张实验卡可以翻了" : slot.pane_zh ? `长寿图鉴 · ${slot.pane_zh}` : "";
			if (!text) return null;
			return h$12("button", {
				type: "button",
				className: "lp-season-bar",
				onClick: () => props.onOpen?.()
			}, h$12(Icon, {
				name: "spark",
				size: 14
			}), h$12("span", { className: "lp-banner-text" }, text), h$12(Icon, {
				name: "chevron",
				size: 14
			}));
		}
		/** sidebar.footer.action: 演示模式 on/off, always reachable. */
		function PresentationButton(_props) {
			const on = useSlot().presentation;
			return h$12("button", {
				type: "button",
				className: `lp lp-present-btn ${on ? "lp-present-on" : ""}`,
				"aria-pressed": on,
				title: on ? "演示模式已打开：LongPi 的提示和健康栏内容都已隐藏（⌘⌥P / Ctrl+Alt+P）" : "演示模式：投屏或开会时隐藏 LongPi 的提示和健康栏内容（⌘⌥P / Ctrl+Alt+P）",
				onClick: () => togglePresentation()
			}, h$12(Icon, {
				name: "lock",
				size: 14
			}), on ? "演示中" : "演示");
		}
		/** ⌘⌥P / Ctrl+Alt+P toggles presentation mode anywhere in DSH. */
		function installPresentationShortcut() {
			if (typeof document === "undefined") return () => {};
			const onKey = (event) => {
				if (event.code !== "KeyP" || !event.altKey || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
				event.preventDefault();
				togglePresentation();
			};
			document.addEventListener("keydown", onKey, true);
			return () => document.removeEventListener("keydown", onKey, true);
		}
		/** The /演示模式 command where DSH offers client commands. */
		function presentationCommand() {
			return {
				name: "演示模式",
				description: () => "打开或关闭演示模式：隐藏 LongPi 的提示和健康栏内容",
				available: () => true,
				ui: {
					kind: "action",
					run: () => togglePresentation()
				}
			};
		}
		//#endregion
		//#region src/client/engage/art.ts
		const INK = "#0d0f12";
		const WIN = {
			x: 5,
			y: 12,
			w: 40,
			h: 32
		};
		function rng(seed) {
			let s = seed >>> 0;
			return () => {
				s = s + 1831565813 >>> 0;
				let t = s;
				t = Math.imul(t ^ t >>> 15, t | 1);
				t ^= t + Math.imul(t ^ t >>> 7, t | 61);
				return ((t ^ t >>> 14) >>> 0) / 4294967296;
			};
		}
		const between = (r, lo, hi) => lo + r() * (hi - lo);
		const pick = (r, list) => list[Math.floor(r() * list.length)];
		var Raster = class {
			w;
			h;
			c;
			constructor(w, h, fill = null) {
				this.w = w;
				this.h = h;
				this.c = new Array(w * h).fill(fill);
			}
			set(xIn, yIn, col) {
				const x = Math.round(xIn);
				const y = Math.round(yIn);
				if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col;
			}
			get(x, y) {
				return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] ?? null : null;
			}
			each(fn) {
				for (let y = 0; y < this.h; y += 1) for (let x = 0; x < this.w; x += 1) fn(x, y, this.c[y * this.w + x] ?? null);
			}
			rect(x, y, w, h, col) {
				for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j, col);
			}
			line(ax, ay, bx, by, col) {
				let x0 = Math.round(ax);
				let y0 = Math.round(ay);
				const x1 = Math.round(bx);
				const y1 = Math.round(by);
				const dx = Math.abs(x1 - x0);
				const dy = -Math.abs(y1 - y0);
				const sx = x0 < x1 ? 1 : -1;
				const sy = y0 < y1 ? 1 : -1;
				let err = dx + dy;
				for (;;) {
					this.set(x0, y0, col);
					if (x0 === x1 && y0 === y1) break;
					const e2 = 2 * err;
					if (e2 >= dy) {
						err += dy;
						x0 += sx;
					}
					if (e2 <= dx) {
						err += dx;
						y0 += sy;
					}
				}
			}
			path(points, col) {
				for (let i = 1; i < points.length; i += 1) {
					const a = points[i - 1];
					const b = points[i];
					this.line(a[0], a[1], b[0], b[1], col);
				}
			}
			thick(x0, y0, x1, y1, col, t) {
				const half = t / 2;
				const minX = Math.floor(Math.min(x0, x1) - half - 1);
				const maxX = Math.ceil(Math.max(x0, x1) + half + 1);
				const minY = Math.floor(Math.min(y0, y1) - half - 1);
				const maxY = Math.ceil(Math.max(y0, y1) + half + 1);
				const lx = x1 - x0;
				const ly = y1 - y0;
				const len2 = lx * lx + ly * ly || 1;
				for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
					const t2 = Math.max(0, Math.min(1, ((x - x0) * lx + (y - y0) * ly) / len2));
					if (Math.hypot(x - (x0 + lx * t2), y - (y0 + ly * t2)) <= half) this.set(x, y, col);
				}
			}
			disc(cx, cy, r, col) {
				for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) if (Math.hypot(x - cx, y - cy) <= r + .25) this.set(x, y, col);
			}
			ring(cx, cy, r, col, t = 1) {
				const half = t / 2 + .05;
				for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y += 1) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x += 1) if (Math.abs(Math.hypot(x - cx, y - cy) - r) <= half) this.set(x, y, col);
			}
			ellipse(cx, cy, rx, ry, col, rot = 0) {
				const c = Math.cos(rot);
				const s = Math.sin(rot);
				const m = Math.max(rx, ry) + 1;
				for (let y = Math.floor(cy - m); y <= cy + m; y += 1) for (let x = Math.floor(cx - m); x <= cx + m; x += 1) {
					const dx = x - cx;
					const dy = y - cy;
					const u = (dx * c + dy * s) / rx;
					const v = (-dx * s + dy * c) / ry;
					if (u * u + v * v <= 1.05) this.set(x, y, col);
				}
			}
			poly(points, col) {
				const xs = points.map((p) => p[0]);
				const ys = points.map((p) => p[1]);
				for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y += 1) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x += 1) {
					let inside = false;
					for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
						const [xi, yi] = points[i];
						const [xj, yj] = points[j];
						if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
					}
					if (inside) this.set(x, y, col);
				}
			}
			recolor(fn) {
				this.each((x, y, col) => {
					if (!col) return;
					const next = fn(x, y, col);
					if (next) this.c[y * this.w + x] = next;
				});
			}
			/** Classic one-pixel outline: every empty pixel that touches a filled one (4-neighbour). */
			outline(col = INK) {
				const add = [];
				this.each((x, y, here) => {
					if (here) return;
					if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
				});
				for (const [x, y] of add) this.set(x, y, col);
				return this;
			}
			blit(src, ox, oy) {
				src.each((x, y, col) => {
					if (col) this.set(ox + x, oy + y, col);
				});
				return this;
			}
		};
		/** Memo for the face builders: a face is fully determined by its key. */
		const memo = /* @__PURE__ */ new Map();
		function cached(key, make) {
			let hit = memo.get(key);
			if (!hit) {
				hit = make();
				memo.set(key, hit);
			}
			return hit;
		}
		const FRAMES = {
			cell: {
				l: "#f6b884",
				b: "#c8703a",
				d: "#7f3f1d"
			},
			animal: {
				l: "#f1f5f8",
				b: "#a9b6c1",
				d: "#5b6974"
			},
			human: {
				l: "#cdb0ff",
				b: "#8a5cd6",
				d: "#4a2c86"
			},
			trial: {
				l: "#ffe896",
				b: "#f2b53a",
				d: "#a86b14"
			},
			species: {
				l: "#77705a",
				b: "#3a372f",
				d: "#15140f"
			},
			milestone: {
				l: "#f4d8a4",
				b: "#c9925a",
				d: "#7a4f26"
			},
			back: {
				l: "#6fd3c4",
				b: "#2a9d8f",
				d: "#1b6159"
			},
			experiment: {
				l: "#6fd3c4",
				b: "#2a9d8f",
				d: "#1b6159"
			}
		};
		const PAPER = {
			light: "#f4ead5",
			shade: "#d8c9a8",
			dark: "#1a1d24",
			darkShade: "#2a2f3a"
		};
		const CHAPTERS = {
			clock: {
				bg: "#1f2f52",
				bg2: "#27406b",
				fg: "#f4ead5",
				mid: "#93add9",
				acc: "#f2b53a"
			},
			organ: {
				bg: "#4a1d24",
				bg2: "#5e2730",
				fg: "#f9d3b4",
				mid: "#e0735a",
				acc: "#ffd166"
			},
			brain: {
				bg: "#2a1f4a",
				bg2: "#36295e",
				fg: "#f1e4ff",
				mid: "#b49ce0",
				acc: "#ff8fab"
			},
			immune: {
				bg: "#0f3f3d",
				bg2: "#16504d",
				fg: "#ddfbf1",
				mid: "#5fd0ac",
				acc: "#ffb703"
			},
			repair: {
				bg: "#47280f",
				bg2: "#5a3416",
				fg: "#ffe1b5",
				mid: "#f19a4d",
				acc: "#8ecae6"
			},
			tissue: {
				bg: "#4a1b38",
				bg2: "#5c2346",
				fg: "#ffd7ea",
				mid: "#e0659b",
				acc: "#f9c74f"
			},
			gene: {
				bg: "#173a21",
				bg2: "#1f4a2a",
				fg: "#e7f9d3",
				mid: "#8fd16a",
				acc: "#ff6b6b"
			},
			span: {
				bg: "#262b33",
				bg2: "#30363f",
				fg: "#eef2f5",
				mid: "#93a1b0",
				acc: "#f2b53a"
			}
		};
		const W = WIN.w;
		const H = WIN.h;
		function backdrop(p) {
			return new Raster(W, H, p.bg);
		}
		const MOTIFS = {
			clock(r, p) {
				const B = backdrop(p);
				const L = new Raster(W, H);
				const cx = 20 + Math.round(between(r, -4, 4));
				const cy = 16 + Math.round(between(r, -1, 1));
				const R = 10 + Math.round(between(r, 0, 2));
				B.each((x, y) => {
					const d = Math.hypot(x - cx, y - cy);
					if (d > R + 1 && Math.floor((d - R) / 2) % 2 === 0) B.set(x, y, p.bg2);
				});
				L.disc(cx, cy, R, p.fg);
				L.ring(cx, cy, R - 2, p.mid);
				for (let i = 0; i < 12; i += 1) {
					const a = i / 12 * Math.PI * 2;
					L.set(cx + Math.cos(a) * (R - .6), cy + Math.sin(a) * (R - .6), i % 3 === 0 ? INK : p.mid);
				}
				const sa = r() * Math.PI * 2;
				const sx = Math.round(cx + Math.cos(sa) * R * .45);
				const sy = Math.round(cy + Math.sin(sa) * R * .45);
				L.disc(sx, sy, 2.2, p.mid);
				L.set(sx, sy, p.fg);
				const h1 = r() * Math.PI * 2;
				const h2 = r() * Math.PI * 2;
				L.line(cx, cy, cx + Math.cos(h1) * (R - 5), cy + Math.sin(h1) * (R - 5), INK);
				L.line(cx, cy, cx + Math.cos(h2) * (R - 3), cy + Math.sin(h2) * (R - 3), p.acc);
				L.set(cx, cy, p.acc);
				return B.blit(L.outline(), 0, 0);
			},
			organ(r, p) {
				const B = backdrop(p);
				B.each((x, y) => {
					if (x % 4 === 0 && y % 4 === 0) B.set(x, y, p.bg2);
				});
				const L = new Raster(W, H);
				const cx = 20 + between(r, -4, 4);
				const cy = 16 + between(r, -2, 2);
				const R = between(r, 11, 13);
				const hs = [
					2,
					3,
					4
				].map((k) => ({
					k,
					a: between(r, .05, .16) / (k - 1),
					ph: r() * Math.PI * 2
				}));
				L.each((x, y) => {
					const dx = x - cx;
					const dy = (y - cy) / .8;
					const th = Math.atan2(dy, dx);
					let s = 1;
					for (const h of hs) s += h.a * Math.cos(h.k * th + h.ph);
					const q = Math.hypot(dx, dy) / (R * s);
					if (q > 1) return;
					const dith = (x + y) % 2 === 0 ? .04 : -.04;
					L.set(x, y, q + dith < .38 ? p.acc : q + dith < .7 ? p.mid : p.fg);
				});
				const y0 = between(r, 4, 28);
				const ph = r() * Math.PI * 2;
				for (let x = 0; x < W; x += 1) L.set(x, y0 + Math.sin(x / 5 + ph) * 3, p.fg);
				return B.blit(L.outline(), 0, 0);
			},
			brain(r, p) {
				const B = backdrop(p);
				const L = new Raster(W, H);
				const ghost = (x, y, a, len, depth) => {
					const x2 = x + Math.cos(a) * len;
					const y2 = y + Math.sin(a) * len;
					B.line(x, y, x2, y2, p.bg2);
					if (depth > 0) {
						ghost(x2, y2, a - .6, len * .7, depth - 1);
						ghost(x2, y2, a + .6, len * .7, depth - 1);
					}
				};
				const gx = between(r, 3, 12);
				const gy = between(r, 4, 28);
				for (let i = 0; i < 4; i += 1) ghost(gx, gy, i / 4 * Math.PI * 2 + r(), 5, 2);
				const sx = Math.round(between(r, 15, 26));
				const sy = Math.round(between(r, 11, 20));
				const branch = (x, y, a, len, depth) => {
					const x2 = x + Math.cos(a) * len;
					const y2 = y + Math.sin(a) * len;
					L.line(x, y, x2, y2, p.fg);
					if (depth <= 0) {
						L.set(x2, y2, p.acc);
						return;
					}
					const spread = between(r, .4, .75);
					branch(x2, y2, a - spread, len * between(r, .6, .78), depth - 1);
					branch(x2, y2, a + spread, len * between(r, .6, .78), depth - 1);
				};
				const axon = r() * Math.PI * 2;
				const prim = 4 + Math.floor(r() * 3);
				for (let i = 0; i < prim; i += 1) {
					const a = axon + Math.PI * .4 + i / prim * Math.PI * 1.2;
					branch(sx + Math.cos(a) * 3, sy + Math.sin(a) * 3, a, between(r, 5, 7), 2);
				}
				let ax = sx;
				let ay = sy;
				let a = axon;
				for (let i = 0; i < 12; i += 1) {
					a += between(r, -.25, .25);
					const nx = ax + Math.cos(a) * 2.5;
					const ny = ay + Math.sin(a) * 2.5;
					L.line(ax, ay, nx, ny, i % 2 ? p.mid : p.fg);
					ax = nx;
					ay = ny;
				}
				L.disc(sx, sy, 3, p.fg);
				L.rect(sx - 1, sy - 1, 2, 2, p.acc);
				return B.blit(L.outline(), 0, 0);
			},
			immune(r, p) {
				const B = backdrop(p);
				for (let i = 0; i < 40; i += 1) B.set(between(r, 0, W), between(r, 0, H), p.bg2);
				const L = new Raster(W, H);
				const cells = [];
				for (let tries = 0; tries < 200 && cells.length < 7; tries += 1) {
					const rad = between(r, 2.6, 5.6);
					const x = between(r, rad + 2, W - rad - 2);
					const y = between(r, rad + 2, H - rad - 2);
					if (cells.every((c) => Math.hypot(c.x - x, c.y - y) > c.rad + rad + 3)) cells.push({
						x,
						y,
						rad
					});
				}
				cells.forEach((c, i) => {
					L.disc(c.x, c.y, c.rad, p.mid);
					if (r() < .35) for (let k = 0; k < 3; k += 1) {
						const a = k / 3 * Math.PI * 2 + r();
						L.set(c.x + Math.cos(a) * c.rad * .4, c.y + Math.sin(a) * c.rad * .4, p.acc);
					}
					else L.disc(c.x + between(r, -.8, .8), c.y + between(r, -.8, .8), c.rad * .45, p.fg);
					if (i === 0 || r() < .4) for (let k = 0; k < 8; k += 1) {
						const a = k / 8 * Math.PI * 2;
						L.set(c.x + Math.cos(a) * (c.rad + 1.2), c.y + Math.sin(a) * (c.rad + 1.2), p.acc);
					}
				});
				return B.blit(L.outline(), 0, 0);
			},
			repair(r, p) {
				const B = backdrop(p);
				B.each((x, y) => {
					if ((x + y * 3) % 7 === 0) B.set(x, y, p.bg2);
				});
				const L = new Raster(W, H);
				const count = 2 + Math.floor(r() * 2);
				for (let i = 0; i < count; i += 1) {
					const cx = between(r, 9, 31);
					const cy = between(r, 8, 24);
					const len = between(r, 7, 10);
					const ang = pick(r, [
						0,
						.45,
						-.45,
						.9,
						-.9
					]);
					const w = 3.6;
					const x0 = cx - Math.cos(ang) * len;
					const y0 = cy - Math.sin(ang) * len;
					const x1 = cx + Math.cos(ang) * len;
					const y1 = cy + Math.sin(ang) * len;
					const lx = x1 - x0;
					const ly = y1 - y0;
					const len2 = lx * lx + ly * ly;
					L.each((x, y) => {
						const t = Math.max(0, Math.min(1, ((x - x0) * lx + (y - y0) * ly) / len2));
						const d = Math.hypot(x - (x0 + lx * t), y - (y0 + ly * t));
						if (d > w) return;
						const along = t * len * 2;
						L.set(x, y, d < 2.4000000000000004 && Math.floor(along / 2.2) % 2 === 0 ? p.fg : p.mid);
					});
				}
				for (let i = 0; i < 3; i += 1) {
					const x = between(r, 4, 36);
					const y = between(r, 4, 28);
					if (L.get(Math.round(x), Math.round(y))) continue;
					L.ring(x, y, 2.2, p.acc);
					L.set(x, y, p.fg);
				}
				return B.blit(L.outline(), 0, 0);
			},
			tissue(r, p) {
				const B = backdrop(p);
				const th = between(r, -.5, .5);
				const lam = between(r, 10, 16);
				const amp = between(r, 1.2, 2.4);
				const ph = r() * Math.PI * 2;
				const striated = r() < .5;
				const c = Math.cos(th);
				const s = Math.sin(th);
				B.each((x, y) => {
					const u = x * c + y * s;
					const v = -x * s + y * c + amp * Math.sin(u / lam * Math.PI * 2 + ph);
					const band = (Math.floor(v / 3) % 3 + 3) % 3;
					let col = band === 0 ? p.bg : band === 1 ? p.mid : p.fg;
					if (striated && band !== 0 && (Math.floor(u) % 4 + 4) % 4 === 0) col = band === 2 ? p.mid : p.bg2;
					B.set(x, y, col);
				});
				const L = new Raster(W, H);
				for (let i = 0; i < 2; i += 1) L.ellipse(between(r, 6, 34), between(r, 6, 26), 2.4, 1.2, p.acc, th);
				return B.blit(L.outline(), 0, 0);
			},
			gene(r, p) {
				const B = backdrop(p);
				B.each((x, y) => {
					if (x % 6 === 0 && y % 2 === 0) B.set(x, y, p.bg2);
				});
				const L = new Raster(W, H);
				const A = between(r, 6, 8);
				const lam = between(r, 14, 18);
				const ph = r() * Math.PI * 2;
				const slope = between(r, -.15, .15);
				const special = 3 * Math.floor(between(r, 2, 12));
				const strand = (x, sign) => 16 + slope * (x - 20) + sign * A * Math.sin(x / lam * Math.PI * 2 + ph);
				for (let x = 0; x < W; x += 3) {
					const y1 = strand(x, 1);
					const y2 = strand(x, -1);
					if (Math.abs(y1 - y2) > 2) L.line(x, y1, x, y2, x === special ? p.acc : p.mid);
				}
				for (let x = 0; x < W; x += 1) {
					const order = Math.cos(x / lam * Math.PI * 2 + ph) > 0 ? [[-1, p.acc], [1, p.fg]] : [[1, p.fg], [-1, p.acc]];
					for (const [sign, col] of order) {
						const y = strand(x, sign);
						L.set(x, y, col);
						L.set(x, y + 1, col);
					}
				}
				return B.blit(L.outline(), 0, 0);
			},
			span(r, p) {
				const B = backdrop(p);
				const ph = r() * Math.PI * 2;
				for (let x = 0; x < W; x += 2) B.set(x, 3 + Math.sin(x / 4 + ph) * 1.5, p.bg2);
				const L = new Raster(W, H);
				L.line(4, 4, 4, 28, p.fg);
				L.line(4, 28, 36, 28, p.fg);
				for (let x = 10; x <= 34; x += 6) L.set(x, 29, p.fg);
				const n = 3 + Math.floor(r() * 2);
				const accent = Math.floor(r() * n);
				for (let k = 0; k < n; k += 1) {
					const b = between(r, 3, 8);
					const a = between(r, .03, .12);
					const pts = [];
					for (let i = 0; i <= 16; i += 1) {
						const t = i / 16;
						const sv = Math.exp(-a / b * (Math.exp(b * t) - 1) * 6);
						pts.push([6 + t * 30, 26 - sv * 20]);
					}
					L.path(pts, k === accent ? p.acc : k % 2 ? p.mid : p.fg);
				}
				L.disc(33, 7, 2, p.acc);
				return B.blit(L.outline(), 0, 0);
			}
		};
		const SPECIES_BG = {
			bg: "#1b2536",
			star: "#33415a",
			bright: "#8796b0"
		};
		const SPECIES = {
			mouse(L) {
				const a = "#b9aa98";
				const b = "#8a7a69";
				const c = "#e6d9c8";
				const p = "#f2a3b3";
				L.thick(7, 21, 3, 24, p, 1.2);
				L.thick(3, 24, 3, 28, p, 1.2);
				L.thick(3, 28, 6, 30, p, 1.2);
				L.ellipse(17, 19, 11, 6.5, a);
				L.ellipse(27, 16, 6, 5, a);
				L.poly([
					[30, 12],
					[37, 17],
					[30, 21]
				], a);
				L.disc(25, 10, 3.5, a);
				L.disc(25, 10, 2, p);
				L.rect(10, 25, 3, 2, b);
				L.rect(21, 25, 3, 2, b);
				L.recolor((x, y, col) => col === a && y >= 22 ? b : col === a && y <= 15 && x < 22 ? c : null);
				L.set(29, 15, INK);
				L.set(37, 17, p);
			},
			c_elegans(L) {
				const a = "#efe3c8";
				const b = "#c4ad86";
				const d = "#e07a5f";
				for (let x = 3; x <= 37; x += .25) {
					const t = (x - 3) / 34;
					const y = 16 + 6 * Math.sin(2 * Math.PI * t * 1.25 + .4);
					const w = 2.6 * Math.pow(Math.sin(Math.PI * Math.min(.97, Math.max(.03, t))), .6);
					for (let dy = -w; dy <= w; dy += .5) L.set(x, y + dy, a);
				}
				for (let x = 7; x <= 31; x += 2) L.set(x, 16 + 6 * Math.sin(2 * Math.PI * ((x - 3) / 34) * 1.25 + .4), b);
				L.disc(34, 16 + 6 * Math.sin(2 * Math.PI * (31 / 34) * 1.25 + .4), 1.4, d);
			},
			drosophila(L) {
				const a = "#8a6a44";
				const b = "#523c25";
				const w = "#cfe4f2";
				const d = "#e5484d";
				L.ellipse(12, 21, 9, 3.4, w, -.6);
				L.ellipse(28, 21, 9, 3.4, w, .6);
				for (const [x0, y0, x1, y1] of [
					[
						16,
						14,
						11,
						10
					],
					[
						16,
						16,
						10,
						16
					],
					[
						17,
						18,
						13,
						23
					],
					[
						24,
						14,
						29,
						10
					],
					[
						24,
						16,
						30,
						16
					],
					[
						23,
						18,
						27,
						23
					]
				]) L.line(x0, y0, x1, y1, b);
				L.ellipse(20, 15, 4, 4, a);
				L.ellipse(20, 23, 3, 5.5, a);
				L.rect(18, 21, 5, 1, b);
				L.rect(18, 24, 5, 1, b);
				L.disc(20, 9, 2.6, a);
				L.disc(18, 8, 1.4, d);
				L.disc(22, 8, 1.4, d);
				L.line(19, 6, 17, 3, b);
				L.line(21, 6, 23, 3, b);
			},
			killifish(L) {
				const a = "#3fb8af";
				const b = "#1f7a78";
				const c = "#bff0e8";
				const d = "#e5484d";
				const f = "#f6c453";
				L.poly([
					[11, 16],
					[2, 8],
					[2, 24]
				], d);
				L.recolor((_x, y, col) => col === d && y % 3 === 0 ? f : null);
				L.poly([
					[15, 11],
					[27, 11],
					[26, 6],
					[17, 7]
				], d);
				L.poly([
					[17, 21],
					[26, 21],
					[24, 26],
					[18, 25]
				], d);
				L.ellipse(21, 16, 12, 6, a);
				L.recolor((x, y, col) => col === a && x >= 12 && x <= 30 && x % 3 === 0 ? b : col === a && y >= 20 ? c : null);
				L.disc(29, 14, 1.4, "#ffffff");
				L.set(29, 14, INK);
			},
			zebrafish(L) {
				const a = "#ead9a2";
				const b = "#2f5594";
				const fin = "#d9c487";
				L.poly([
					[8, 16],
					[1, 10],
					[4, 16],
					[1, 22]
				], a);
				L.poly([
					[18, 12],
					[24, 12],
					[21, 9]
				], fin);
				L.poly([
					[18, 20],
					[25, 20],
					[22, 23]
				], fin);
				L.ellipse(21, 16, 15, 4, a);
				L.recolor((x, y, col) => col === a && (y === 14 || y === 16 || y === 18) && x < 34 ? b : null);
				L.disc(32, 15, 1.2, "#ffffff");
				L.set(32, 15, INK);
			},
			planarian(L) {
				const a = "#a8805e";
				const b = "#7a5a3f";
				const c = "#d9b28d";
				L.ellipse(19, 17, 15, 5, a);
				L.poly([
					[30, 12],
					[38, 17],
					[30, 22]
				], a);
				L.poly([
					[29, 13],
					[33, 9],
					[33, 14]
				], a);
				L.poly([
					[29, 21],
					[33, 25],
					[33, 20]
				], a);
				for (let x = 9; x <= 26; x += 3) {
					L.line(x, 17, x - 1, 14, b);
					L.line(x, 17, x - 1, 20, b);
				}
				L.line(8, 17, 28, 17, b);
				L.ellipse(18, 17, 4, 1.4, c);
				L.rect(31, 15, 2, 1, "#ffffff");
				L.rect(31, 18, 2, 1, "#ffffff");
				L.set(32, 15, INK);
				L.set(32, 18, INK);
			},
			butterfly(L) {
				const b = "#2c2436";
				const d = "#e5484d";
				const c = "#f6c453";
				const body = "#4a4250";
				L.ellipse(11, 11, 10, 4, b, -.5);
				L.ellipse(29, 11, 10, 4, b, .5);
				L.ellipse(13, 21, 6, 4.5, b, .45);
				L.ellipse(27, 21, 6, 4.5, b, -.45);
				L.ellipse(11, 11, 6, 1.5, d, -.5);
				L.ellipse(29, 11, 6, 1.5, d, .5);
				L.thick(9, 21, 15, 24, c, 1.4);
				L.thick(31, 21, 25, 24, c, 1.4);
				L.ellipse(20, 16, 1.4, 8, body);
				L.disc(20, 8, 1.6, body);
				L.line(19, 7, 15, 1, body);
				L.line(21, 7, 25, 1, body);
				L.set(15, 1, c);
				L.set(25, 1, c);
			},
			naked_mole_rat(L) {
				const p = "#e9aaa0";
				const b = "#c47f74";
				const w = "#fffbe8";
				L.thick(6, 19, 2, 21, p, 1.2);
				L.rect(9, 23, 3, 2, b);
				L.rect(24, 23, 3, 2, b);
				L.ellipse(18, 18, 13, 6, p);
				L.ellipse(30, 17, 6, 4.8, p);
				L.ellipse(35, 18, 2.6, 2.6, p);
				L.recolor((x, y, col) => col === p && x >= 7 && x <= 30 && x % 3 === 0 && y > 13 ? b : col === p && y >= 22 ? b : null);
				L.rect(36, 21, 2, 2, w);
				L.set(32, 15, INK);
			},
			bowhead_whale(L) {
				const a = "#6b88a6";
				const b = "#465f7c";
				const c = "#eef3f7";
				L.poly([
					[6, 17],
					[0, 11],
					[2, 17],
					[0, 23]
				], a);
				L.poly([
					[4, 17],
					[9, 14],
					[16, 12],
					[24, 11],
					[30, 9],
					[34, 10],
					[37, 13],
					[39, 16],
					[39, 19],
					[37, 22],
					[33, 25],
					[27, 26],
					[20, 25],
					[13, 22],
					[8, 20]
				], a);
				L.poly([
					[21, 24],
					[26, 25],
					[21, 29],
					[19, 28]
				], b);
				L.recolor((_x, y, col) => col === a && y >= 23 ? b : null);
				L.poly([
					[30, 22],
					[37, 21],
					[35, 24],
					[30, 25]
				], c);
				L.path([
					[39, 17],
					[37, 14],
					[34, 13],
					[31, 15],
					[29, 20]
				], INK);
				L.set(27, 20, INK);
			}
		};
		const SPECIES_AFTER = {
			mouse(L) {
				L.set(38, 15, "#e6d9c8");
				L.set(39, 14, "#e6d9c8");
				L.set(38, 19, "#e6d9c8");
				L.set(39, 20, "#e6d9c8");
			},
			naked_mole_rat(L) {
				L.set(39, 16, "#f5c9c0");
				L.set(39, 19, "#f5c9c0");
			},
			bowhead_whale(L) {
				L.set(31, 6, "#cfe4f2");
				L.set(30, 4, "#cfe4f2");
				L.set(32, 4, "#cfe4f2");
				L.set(31, 3, "#ffffff");
				L.set(29, 2, "#cfe4f2");
				L.set(33, 2, "#cfe4f2");
			}
		};
		function speciesWindow(key, silhouette) {
			const B = new Raster(W, H, SPECIES_BG.bg);
			const r = rng(key.length * 7919);
			for (let i = 0; i < 26; i += 1) B.set(between(r, 0, W), between(r, 0, H), i % 6 === 0 ? SPECIES_BG.bright : SPECIES_BG.star);
			const L = new Raster(W, H);
			SPECIES[key]?.(L);
			if (silhouette) L.recolor(() => "#2b3954");
			L.outline(silhouette ? "#0f1520" : INK);
			if (!silhouette) SPECIES_AFTER[key]?.(L);
			return B.blit(L, 0, 0);
		}
		const MILE = {
			bg: "#d9b77f",
			bg2: "#cfa96e",
			fg: "#fff6e0",
			mid: "#8a5a2b",
			acc: "#e5484d"
		};
		const MILE_ICONS = {
			brief(L) {
				L.rect(13, 7, 14, 20, MILE.fg);
				L.rect(17, 5, 6, 3, MILE.acc);
				for (const y of [
					12,
					15,
					18,
					21
				]) L.rect(15, y, 10, 1, MILE.mid);
			},
			plus(L) {
				L.rect(17, 7, 6, 18, MILE.acc);
				L.rect(11, 13, 18, 6, MILE.acc);
			},
			repeat(L) {
				L.ring(20, 16, 8, MILE.fg, 2);
				L.rect(18, 7, 5, 2, MILE.bg);
				L.rect(18, 23, 5, 2, MILE.bg);
				L.poly([
					[22, 5],
					[26, 8],
					[22, 11]
				], MILE.acc);
				L.poly([
					[18, 21],
					[14, 24],
					[18, 27]
				], MILE.acc);
			},
			flag(L) {
				L.rect(12, 5, 2, 23, MILE.mid);
				L.poly([
					[14, 6],
					[29, 10],
					[14, 15]
				], MILE.acc);
			},
			ab(L) {
				L.rect(7, 10, 11, 13, MILE.fg);
				L.rect(22, 10, 11, 13, MILE.acc);
				L.line(19, 16, 21, 16, MILE.mid);
				L.line(12, 20, 12, 13, MILE.mid);
				L.line(12, 13, 14, 13, MILE.mid);
				L.line(14, 13, 14, 20, MILE.mid);
				L.line(12, 16, 14, 16, MILE.mid);
			},
			/** Two people side by side, the second one smaller and leaning on a stick: going along with a family member. */
			family(L) {
				L.disc(14, 9, 3, MILE.fg);
				L.rect(10, 13, 9, 12, MILE.fg);
				L.rect(11, 25, 3, 3, MILE.mid);
				L.rect(15, 25, 3, 3, MILE.mid);
				L.disc(26, 12, 2.6, MILE.fg);
				L.rect(23, 16, 7, 9, MILE.acc);
				L.rect(24, 25, 2, 3, MILE.mid);
				L.rect(27, 25, 2, 3, MILE.mid);
				L.rect(31, 17, 1, 11, MILE.mid);
				L.rect(29, 17, 2, 1, MILE.mid);
				L.rect(19, 18, 4, 2, MILE.fg);
			}
		};
		const FOOTPRINT_GLYPH = {
			care_brief: "brief",
			retest: "repeat",
			addon: "plus",
			first_experiment: "ab",
			season: "flag",
			family: "family"
		};
		function milestoneWindow(glyph) {
			const B = new Raster(W, H, MILE.bg);
			B.each((x, y) => {
				if ((x + y) % 2 === 0 && (x * 7 + y * 3) % 5 === 0) B.set(x, y, MILE.bg2);
			});
			B.ring(33, 7, 5, MILE.acc);
			B.ring(33, 7, 3, MILE.bg2);
			const L = new Raster(W, H);
			(MILE_ICONS[glyph] ?? MILE_ICONS.brief)(L);
			return B.blit(L.outline(), 0, 0);
		}
		const EXP = {
			bg: "#163d33",
			bg2: "#1d4a3e",
			fg: "#e6f8ec",
			mid: "#8fe8be",
			acc: "#ffd166"
		};
		const EXP_ICONS = {
			walk(L) {
				L.poly([
					[9, 22],
					[13, 12],
					[19, 12],
					[21, 18],
					[31, 20],
					[32, 25],
					[9, 25]
				], EXP.fg);
				L.rect(9, 25, 24, 2, EXP.mid);
				L.line(14, 15, 18, 15, EXP.mid);
				L.line(13, 18, 19, 18, EXP.mid);
				L.thick(28, 8, 34, 8, EXP.acc, 1.4);
				L.thick(30, 5, 35, 5, EXP.acc, 1.4);
			},
			alarm(L) {
				L.disc(20, 17, 9, EXP.fg);
				L.ring(20, 17, 9, EXP.mid);
				L.disc(12, 8, 3, EXP.acc);
				L.disc(28, 8, 3, EXP.acc);
				L.line(20, 17, 20, 11, INK);
				L.line(20, 17, 24, 19, INK);
				L.line(14, 26, 12, 29, EXP.mid);
				L.line(26, 26, 28, 29, EXP.mid);
			},
			moon(L) {
				L.disc(19, 16, 10, EXP.acc);
				L.disc(24, 12, 9, null);
				for (const [x, y] of [
					[31, 7],
					[34, 15],
					[29, 24]
				]) {
					L.set(x, y, EXP.fg);
					L.set(x + 1, y, EXP.fg);
					L.set(x, y + 1, EXP.fg);
				}
			},
			chair(L) {
				L.rect(8, 8, 3, 18, EXP.mid);
				L.rect(8, 17, 14, 3, EXP.mid);
				L.rect(19, 20, 3, 6, EXP.mid);
				L.poly([
					[29, 6],
					[34, 13],
					[31, 13],
					[31, 24],
					[27, 24],
					[27, 13],
					[24, 13]
				], EXP.acc);
			},
			bp(L) {
				L.rect(6, 12, 15, 9, EXP.fg);
				L.rect(8, 14, 11, 5, EXP.mid);
				L.disc(29, 16, 7, EXP.fg);
				L.ring(29, 16, 7, EXP.mid);
				L.line(29, 16, 32, 12, "#e5484d");
				L.thick(21, 17, 22, 17, EXP.mid, 2);
			},
			cup(L) {
				L.poly([
					[11, 8],
					[27, 8],
					[25, 27],
					[13, 27]
				], EXP.fg);
				L.rect(12, 12, 14, 3, EXP.acc);
				L.thick(19, 3, 23, 8, EXP.mid, 1.6);
				L.thick(28, 10, 36, 24, "#e5484d", 2.4);
				L.thick(36, 10, 28, 24, "#e5484d", 2.4);
			},
			bowl(L) {
				L.poly([
					[6, 16],
					[26, 16],
					[23, 24],
					[9, 24]
				], EXP.fg);
				L.rect(10, 13, 12, 3, EXP.acc);
				L.disc(31, 10, 6, EXP.fg);
				L.line(31, 10, 31, 6, INK);
				L.line(31, 10, 34, 11, INK);
			}
		};
		/** Cell positions of the 14-day bar (two rows of seven), for tests and overlays. */
		function cellAt(i) {
			return {
				x: 5 + i % 7 * 4,
				y: 45 + Math.floor(i / 7) * 2
			};
		}
		const CELL_COLORS = {
			d: FRAMES.experiment.b,
			dLight: FRAMES.experiment.l,
			m: "#3b4048",
			f: "#cfc2a3"
		};
		const RESULT_ICONS = {
			dial: {
				pal: CHAPTERS.clock,
				draw(L, p) {
					L.disc(20, 19, 12, p.fg);
					L.disc(20, 19, 9, p.bg2);
					L.rect(7, 20, 27, 12, null);
					for (let i = 0; i <= 6; i += 1) {
						const a = Math.PI + i / 6 * Math.PI;
						L.set(20 + Math.cos(a) * 10.5, 19 + Math.sin(a) * 10.5, i === 3 ? p.acc : INK);
					}
					L.thick(20, 19, 26, 12, p.acc, 1.4);
					L.disc(20, 19, 2, p.mid);
					L.rect(10, 23, 21, 4, p.mid);
					L.rect(12, 24, 17, 2, p.fg);
				}
			},
			heart: {
				pal: CHAPTERS.organ,
				draw(L, p) {
					L.disc(15, 13, 6, p.mid);
					L.disc(25, 13, 6, p.mid);
					L.poly([
						[9, 15],
						[31, 15],
						[20, 28]
					], p.mid);
					L.disc(14, 11, 2, p.fg);
					L.path([
						[6, 20],
						[12, 20],
						[14, 17],
						[17, 24],
						[20, 15],
						[22, 20],
						[34, 20]
					], p.acc);
				}
			},
			kidney: {
				pal: CHAPTERS.organ,
				draw(L, p) {
					L.ellipse(19, 16, 9, 12, p.mid);
					L.ellipse(26, 16, 3.4, 4.2, null);
					L.ellipse(16, 12, 3, 4, p.fg);
					L.thick(26, 16, 33, 22, p.acc, 1.6);
				}
			},
			bars: {
				pal: CHAPTERS.span,
				draw(L, p) {
					L.rect(6, 27, 29, 1, p.fg);
					L.rect(8, 18, 5, 9, p.mid);
					L.rect(15, 12, 5, 15, p.fg);
					L.rect(22, 15, 5, 12, p.mid);
					L.rect(29, 8, 5, 19, p.acc);
				}
			}
		};
		function resultIcon(key) {
			if (key === "bioage") return "dial";
			if (key === "risk") return "heart";
			if (/egfr|kidney|creat/.test(key)) return "kidney";
			return "bars";
		}
		function frame(kind, dark) {
			const f = FRAMES[kind];
			const r = new Raster(50, 70);
			const paper = dark ? PAPER.dark : PAPER.light;
			const shade = dark ? PAPER.darkShade : PAPER.shade;
			r.each((x, y) => {
				const xr = 49 - x;
				const yb = 69 - y;
				if (Math.min(x, xr) + Math.min(y, yb) < 2 && Math.min(x, xr) < 2 && Math.min(y, yb) < 2) return;
				const e = Math.min(x, y, xr, yb);
				let col;
				if (e === 0) col = INK;
				else if (e <= 3) col = (x === 1 || y === 1) && e === 1 ? f.l : (xr === 1 || yb === 1) && e === 1 ? f.d : f.b;
				else col = e === 4 ? shade : paper;
				r.set(x, y, col);
			});
			r.each((x, y) => {
				if (!r.get(x, y)) return;
				if ([
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1]
				].some(([dx, dy]) => r.get(x + dx, y + dy) == null)) r.set(x, y, INK);
			});
			r.rect(WIN.x - 1, WIN.y - 1, WIN.w + 2, WIN.h + 2, INK);
			r.rect(5, 50, 40, 11, INK);
			r.rect(6, 51, 38, 9, "#232a30");
			r.rect(6, 51, 38, 1, "#3c464e");
			return r;
		}
		const TIER_RANK = {
			cell: 0,
			animal: 1,
			human: 2,
			trial: 3
		};
		function pips(r, tier) {
			const f = FRAMES[tier];
			const rank = TIER_RANK[tier];
			for (let i = 0; i < 4; i += 1) {
				const x = 5 + i * 4;
				r.rect(x, 46, 3, 2, INK);
				if (i <= rank) {
					r.rect(x, 46, 3, 2, f.b);
					r.set(x, 46, f.l);
				}
			}
		}
		function lifespanBar(r, years) {
			const lo = Math.log10(7 / 365);
			const hi = Math.log10(300);
			const at = (y) => Math.round(5 + (Math.log10(y) - lo) / (hi - lo) * 39);
			r.rect(5, 47, 40, 1, "#4b5566");
			for (const y of [
				1 / 12,
				1,
				10,
				100
			]) r.rect(at(y), 46, 1, 3, "#8796b0");
			r.rect(at(80), 45, 1, 4, "#ffffff");
			if (years) {
				const x = at(years);
				r.rect(x - 1, 44, 3, 1, "#f2b53a");
				r.set(x, 45, "#f2b53a");
			}
		}
		const isTier = (value) => value === "cell" || value === "animal" || value === "human" || value === "trial";
		/** A research card: its evidence colour's frame, the chapter motif from its seed, the evidence pips. */
		function studyFace(card) {
			const tier = isTier(card.tier) ? card.tier : "cell";
			const motif = MOTIFS[card.art.motif] ? card.art.motif : "clock";
			return cached(`s:${tier}:${motif}:${card.art.seed}`, () => {
				const r = frame(tier, false);
				const p = CHAPTERS[motif];
				r.blit(MOTIFS[motif](rng(card.art.seed), p), WIN.x, WIN.y);
				pips(r, tier);
				return r;
			});
		}
		/** A species card: dark frame, night sky, the animal (a silhouette until met), the log lifespan ruler. */
		function speciesFace(species, locked) {
			return cached(`sp:${species.key}:${locked ? 1 : 0}:${species.lifespan_years ?? ""}`, () => {
				const r = frame("species", true);
				r.blit(speciesWindow(species.key, locked), WIN.x, WIN.y);
				if (!locked) lifespanBar(r, species.lifespan_years);
				return r;
			});
		}
		/** An experiment card: teal frame, its icon, and the 14 days (done bright, missed dark, ahead pale). */
		function experimentFace(exp, cells = []) {
			const icon = exp.icon in EXP_ICONS ? exp.icon : "walk";
			return cached(`x:${icon}:${cells.join("")}`, () => {
				const r = frame("experiment", false);
				const B = new Raster(W, H, EXP.bg);
				B.each((x, y) => {
					if ((x + y) % 4 === 0 && (x * 3 + y) % 7 === 0) B.set(x, y, EXP.bg2);
				});
				const L = new Raster(W, H);
				EXP_ICONS[icon](L);
				r.blit(B.blit(L.outline(), 0, 0), WIN.x, WIN.y);
				for (let i = 0; i < 14; i += 1) {
					const { x, y } = cellAt(i);
					const state = cells[i] ?? "f";
					r.rect(x, y, 3, 1, state === "d" ? CELL_COLORS.d : state === "m" ? CELL_COLORS.m : CELL_COLORS.f);
					if (state === "d") r.set(x, y, CELL_COLORS.dLight);
				}
				return r;
			});
		}
		/** A footprint card: kraft paper, a glyph and a postmark ring. */
		function footprintFace(kind) {
			const glyph = FOOTPRINT_GLYPH[kind] ?? "brief";
			return cached(`f:${glyph}`, () => frame("milestone", false).blit(milestoneWindow(glyph), WIN.x, WIN.y));
		}
		/** A retest result card: the frame of the evidence colour behind it, a picture of the measure. */
		function resultFace(card) {
			const tier = isTier(card.tier) ? card.tier : "human";
			const icon = resultIcon(card.key);
			return cached(`r:${tier}:${icon}`, () => {
				const spec = RESULT_ICONS[icon];
				const r = frame(tier, false);
				const B = backdrop(spec.pal);
				B.each((x, y) => {
					if (x % 4 === 0 && y % 4 === 0) B.set(x, y, spec.pal.bg2);
				});
				const L = new Raster(W, H);
				spec.draw(L, spec.pal);
				r.blit(B.blit(L.outline(), 0, 0), WIN.x, WIN.y);
				pips(r, tier);
				return r;
			});
		}
		/** The deck back: what an unturned card looks like (teal lattice and π). */
		function cardBack() {
			return cached("back", () => {
				const f = FRAMES.back;
				const r = frame("back", true);
				for (let y = 5; y < 65; y += 1) for (let x = 5; x < 45; x += 1) {
					const lattice = (x + y) % 6 === 0 || (x - y + 60) % 6 === 0;
					r.set(x, y, lattice ? "#1f525a" : "#163a42");
				}
				const L = new Raster(50, 70);
				L.rect(15, 27, 20, 3, PAPER.light);
				L.rect(18, 30, 3, 12, PAPER.light);
				L.rect(29, 30, 3, 10, PAPER.light);
				L.rect(31, 40, 3, 2, PAPER.light);
				L.rect(15, 27, 20, 1, "#fffaf0");
				for (const [x, y] of [
					[10, 10],
					[39, 10],
					[10, 59],
					[39, 59]
				]) {
					L.set(x, y - 1, f.l);
					L.set(x - 1, y, f.l);
					L.set(x + 1, y, f.l);
					L.set(x, y + 1, f.l);
					L.set(x, y, "#f2b53a");
				}
				r.blit(L.outline(), 0, 0);
				return r;
			});
		}
		/** The evidence gem set into the frame (9 × 9). */
		function gem(tier) {
			const t = isTier(tier) ? tier : "cell";
			return cached(`gem:${t}`, () => {
				const f = FRAMES[t];
				const r = new Raster(9, 9);
				r.poly([
					[4, .5],
					[8, 4.5],
					[4, 8.5],
					[0, 4.5]
				], f.b);
				r.recolor((x, y) => x + y < 7 && x < 5 && y < 5 ? f.l : x + y > 9 ? f.d : null);
				r.set(3, 3, "#ffffff");
				return r.outline();
			});
		}
		/** The blue 已读 stamp (11 × 11) with a tick. */
		function seal(kind) {
			return cached(`seal:${kind}`, () => {
				const col = {
					b: "#2f8fe6",
					l: "#7cc0ff",
					d: "#1a5a9c"
				};
				const r = new Raster(11, 11);
				r.rect(1, 1, 9, 9, col.b);
				r.set(1, 1, null);
				r.set(9, 1, null);
				r.set(1, 9, null);
				r.set(9, 9, null);
				r.rect(2, 1, 7, 1, col.l);
				r.rect(1, 2, 1, 7, col.l);
				r.rect(2, 9, 7, 1, col.d);
				r.rect(9, 2, 1, 7, col.d);
				r.set(3, 5, "#ffffff");
				r.set(4, 6, "#ffffff");
				r.set(5, 7, "#ffffff");
				r.set(6, 6, "#ffffff");
				r.set(7, 5, "#ffffff");
				r.set(8, 4, "#ffffff");
				return r.outline();
			});
		}
		const EMBLEMS = {
			clock(r, c) {
				r.ring(5, 5, 4, c);
				r.line(5, 5, 5, 2, c);
				r.line(5, 5, 7, 6, c);
			},
			organ(r, c) {
				r.ellipse(5, 5, 4, 3.5, c);
				r.ellipse(5, 5, 1.6, 1.4, null);
			},
			brain(r, c) {
				r.disc(5, 5, 1.4, c);
				r.line(5, 5, 5, 1, c);
				r.line(5, 5, 1, 8, c);
				r.line(5, 5, 9, 8, c);
				r.line(5, 5, 1, 3, c);
				r.line(5, 5, 9, 3, c);
			},
			immune(r, c) {
				r.disc(5, 5, 2.4, c);
				for (let k = 0; k < 8; k += 1) {
					const a = k / 8 * Math.PI * 2;
					r.set(5 + Math.cos(a) * 4.2, 5 + Math.sin(a) * 4.2, c);
				}
			},
			repair(r, c) {
				r.rect(1, 3, 9, 5, c);
				r.set(1, 3, null);
				r.set(9, 3, null);
				r.set(1, 7, null);
				r.set(9, 7, null);
				r.set(3, 4, null);
				r.set(5, 6, null);
				r.set(7, 4, null);
			},
			tissue(r, c) {
				for (const y of [
					2,
					5,
					8
				]) for (let x = 0; x <= 10; x += 1) r.set(x, y + (x % 4 < 2 ? 0 : 1), c);
			},
			gene(r, c) {
				for (let y = 0; y <= 10; y += 1) {
					const s = Math.sin(y / 1.7);
					r.set(5 + 3 * s, y, c);
					r.set(5 - 3 * s, y, c);
				}
			},
			span(r, c) {
				r.line(1, 0, 1, 9, c);
				r.line(1, 9, 10, 9, c);
				r.path([
					[2, 1],
					[5, 2],
					[7, 5],
					[9, 8]
				], c);
			}
		};
		/** A chapter's small emblem (11 × 11), for the chapter list and chips. */
		function emblem(motif, color = PAPER.light) {
			return cached(`em:${motif}:${color}`, () => {
				const r = new Raster(11, 11);
				(EMBLEMS[motif] ?? EMBLEMS.clock)(r, color);
				return r;
			});
		}
		const PACKS = {
			experiment: {
				b: "#ef8a2a",
				l: "#ffc27a",
				d: "#a35210",
				band: "#232a30",
				fg: "#fff6e0",
				acc: "#e5484d"
			},
			retest: {
				b: "#8a5cd6",
				l: "#cdb0ff",
				d: "#4a2c86",
				band: "#f2b53a",
				fg: "#f4ead5",
				acc: "#f2b53a"
			}
		};
		const PACK_EMBLEMS = {
			experiment(L, p) {
				L.rect(6, 11, 7, 10, p.fg);
				L.rect(12, 9, 7, 10, p.acc);
				L.rect(18, 11, 7, 10, p.fg);
			},
			retest(L, p) {
				L.rect(10, 9, 11, 14, p.fg);
				L.rect(13, 7, 5, 3, p.acc);
				for (const y of [
					13,
					16,
					19
				]) L.rect(12, y, 7, 1, "#8a5cd6");
			}
		};
		/** A pack (30 × 42): 实验包 orange with three cards, 复查包 purple with a gold band and a clipboard. */
		function pack(kind) {
			const k = kind === "retest" ? "retest" : "experiment";
			return cached(`pack:${k}`, () => {
				const p = PACKS[k];
				const w = 30;
				const h = 42;
				const r = new Raster(w, h);
				for (let x = 1; x < 29; x += 1) {
					const tooth = x % 4 < 2 ? 0 : 1;
					for (let y = tooth; y < h - tooth; y += 1) r.set(x, y, p.b);
				}
				r.recolor((x, y) => x <= 3 ? p.l : x >= 26 ? p.d : (x === 7 || x === 8) && y > 4 && y < 37 && !(y >= 27 && y <= 31) ? p.l : null);
				r.rect(1, 3, 28, 1, p.d);
				r.rect(1, 38, 28, 1, p.d);
				r.rect(1, 27, 28, 5, p.band);
				for (let x = 4; x < 26; x += 3) r.set(x, 29, p.d);
				const L = new Raster(w, h);
				PACK_EMBLEMS[k](L, p);
				L.outline();
				r.blit(L, 0, 0);
				return r.outline();
			});
		}
		/** Shard colours for a pack burst. */
		const PACK_SHARDS = {
			experiment: [
				"#ef8a2a",
				"#ffc27a",
				"#e5484d"
			],
			retest: [
				"#8a5cd6",
				"#cdb0ff",
				"#f2b53a"
			]
		};
		const BAYER = [
			[
				0,
				8,
				2,
				10
			],
			[
				12,
				4,
				14,
				6
			],
			[
				3,
				11,
				1,
				9
			],
			[
				15,
				7,
				13,
				5
			]
		];
		const SWIRL = [
			[
				12,
				34,
				38
			],
			[
				16,
				44,
				48
			],
			[
				21,
				56,
				58
			],
			[
				27,
				70,
				69
			],
			[
				35,
				86,
				80
			]
		];
		/** One frame of the swirl as RGBA bytes (pure; the canvas only copies it). */
		function swirlFrame(t, out = /* @__PURE__ */ new Uint8ClampedArray(82944)) {
			const w = 192;
			const h = 108;
			for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
				const u = (x - w / 2) / h;
				const v = (y - h / 2) / h;
				const rr = Math.hypot(u, v);
				const val = (Math.sin(Math.atan2(v, u) * 2 + rr * 9 - t * .5 + Math.sin(rr * 5 + t * .25) * 1.4) + 1) * .36 + rr * .45;
				const dither = BAYER[y % 4][x % 4];
				const idx = Math.max(0, Math.min(4, Math.floor(val * 4 + dither / 16 - .5)));
				const [cr, cg, cb] = SWIRL[4 - idx];
				const i = (y * w + x) * 4;
				out[i] = cr;
				out[i + 1] = cg;
				out[i + 2] = cb;
				out[i + 3] = 255;
			}
			return out;
		}
		const urls = /* @__PURE__ */ new WeakMap();
		/** The raster as a PNG data URL (canvas), cached per raster. */
		function toDataURL(raster) {
			const hit = urls.get(raster);
			if (hit) return hit;
			const canvas = document.createElement("canvas");
			canvas.width = raster.w;
			canvas.height = raster.h;
			const ctx = canvas.getContext("2d");
			if (!ctx) return "";
			const img = ctx.createImageData(raster.w, raster.h);
			raster.each((x, y, col) => {
				if (!col) return;
				const i = (y * raster.w + x) * 4;
				img.data[i] = parseInt(col.slice(1, 3), 16);
				img.data[i + 1] = parseInt(col.slice(3, 5), 16);
				img.data[i + 2] = parseInt(col.slice(5, 7), 16);
				img.data[i + 3] = 255;
			});
			ctx.putImageData(img, 0, 0);
			const url = canvas.toDataURL("image/png");
			urls.set(raster, url);
			return url;
		}
		/**
		* Draw the swirl into the canvas and keep it turning slowly. Still (one frame, no timer) under
		* prefers-reduced-motion or when the caller says so (演示模式). Returns a disposer that clears the timer.
		*/
		function startSwirl(canvas, opts = {}) {
			canvas.width = 192;
			canvas.height = 108;
			const ctx = canvas.getContext("2d");
			if (!ctx) return () => {};
			const img = ctx.createImageData(192, 108);
			let t = 0;
			const draw = () => {
				swirlFrame(t, img.data);
				ctx.putImageData(img, 0, 0);
				t += .06;
			};
			draw();
			const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			if (opts.still || reduce) return () => {};
			const timer = setInterval(draw, 80);
			return () => clearInterval(timer);
		}
		//#endregion
		//#region src/client/engage/font.ts
		const CODEX_FONT_CSS = `@font-face { font-family: "LpCodexPixel"; src: url(data:font/woff2;base64,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) format("woff2"); font-display: swap; }`;
		//#endregion
		//#region src/client/engage/codex-page.ts
		const h$11 = react.default.createElement;
		const PATH = "/api/longpi/codex";
		const codexBodies = {
			start: (myDay, seasonMode, standup) => ({
				action: "start",
				my_day: myDay,
				season_mode: seasonMode,
				standup
			}),
			prefs: (prefs) => ({
				action: "prefs",
				...prefs
			}),
			openPack: (packId) => ({
				action: "open_pack",
				pack_id: packId
			}),
			begin: (experimentId, packId, answers, randomized) => ({
				action: "begin",
				experiment_id: experimentId,
				...packId ? { pack_id: packId } : {},
				answers,
				randomized
			}),
			checkin: (runId, done) => ({
				action: "checkin",
				run_id: runId,
				done
			}),
			reveal: (runId) => ({
				action: "reveal",
				run_id: runId
			}),
			stop: (runId) => ({
				action: "stop",
				run_id: runId
			}),
			read: (cardId) => ({
				action: "read",
				card_id: cardId
			}),
			nextSeason: () => ({ action: "next_season" })
		};
		const TIERS = {
			cell: {
				metal: "铜",
				label: "细胞实验",
				key: "lp-codex-k-copper"
			},
			animal: {
				metal: "银",
				label: "动物实验",
				key: "lp-codex-k-silver"
			},
			human: {
				metal: "紫",
				label: "人群研究",
				key: "lp-codex-k-violet"
			},
			trial: {
				metal: "金",
				label: "人体随机试验",
				key: "lp-codex-k-gold"
			}
		};
		const TIER_ORDER = [
			"cell",
			"animal",
			"human",
			"trial"
		];
		const OUTCOME_STAMP = {
			outside: "超出波动",
			inside: "波动内",
			insufficient: "数据不够"
		};
		const OBJECT_ZH = {
			human: "人",
			cell_line: "细胞",
			multi_species: "多种动物",
			other: "其他动物"
		};
		const SHARD_GOLD = [
			"#f2b53a",
			"#ffe896",
			"#ffffff"
		];
		const SHARD_FOIL = [
			"#ff5e5e",
			"#ffd166",
			"#5eead4",
			"#60a5fa",
			"#c084fc"
		];
		/** Display width: Latin letters, digits and spaces count half. */
		function widthOf(text) {
			let width = 0;
			for (const char of text) width += /[\u0000-ɏ -⁯]/.test(char) ? .5 : 1;
			return width;
		}
		function dayZh(day) {
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
			return m ? `${Number(m[2])}月${Number(m[3])}日` : "";
		}
		const cx = (...names) => names.filter(Boolean).join(" ");
		function isView(value) {
			return Boolean(value) && typeof value === "object" && "started" in value && "intro" in value;
		}
		function isLibrary(value) {
			return Boolean(value) && typeof value === "object" && Array.isArray(value.studies) && Array.isArray(value.chapters);
		}
		const HIGHLIGHT = /(小鼠|大鼠|线虫|果蝇|绿松石鳉|鳉鱼|斑马鱼|涡虫|裸鼹鼠|弓头鲸|袖蝶|猕猴|狨猴|哺乳动物|蝴蝶|酵母)|(随机对照试验|随机试验|随机)|(\d[\d.,]*(?:万|%)?)/g;
		/** Species names, numbers and 「随机」 coloured inside the cream description box (design §5.2). */
		function highlight(text) {
			const out = [];
			let at = 0;
			for (const m of text.matchAll(HIGHLIGHT)) {
				const index = m.index ?? 0;
				if (index > at) out.push(text.slice(at, index));
				const cls = m[1] ? "lp-codex-hl-s" : m[2] ? "lp-codex-hl-k" : "lp-codex-hl-n";
				out.push(h$11("span", {
					key: `${index}`,
					className: cls
				}, m[0]));
				at = index + m[0].length;
			}
			if (at < text.length) out.push(text.slice(at));
			return out;
		}
		function motionQuery() {
			return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
		}
		function useReducedMotion() {
			const [reduce, setReduce] = react.default.useState(() => Boolean(motionQuery()?.matches));
			react.default.useEffect(() => {
				const query = motionQuery();
				if (!query) return void 0;
				const on = () => setReduce(query.matches);
				query.addEventListener?.("change", on);
				return () => query.removeEventListener?.("change", on);
			}, []);
			return reduce;
		}
		let fontInjected = false;
		function injectFont() {
			if (fontInjected || typeof document === "undefined") return;
			fontInjected = true;
			const id = "lp-codex-font";
			if (document.getElementById(id)) return;
			const style = document.createElement("style");
			style.id = id;
			style.textContent = CODEX_FONT_CSS;
			document.head.appendChild(style);
		}
		/** How far down the container the visible part starts (the page scrolls inside DSH's panel). */
		function visibleTop(el) {
			const rect = el.getBoundingClientRect();
			let top = Math.max(0, -rect.top);
			for (let node = el.parentElement; node; node = node.parentElement) {
				const style = window.getComputedStyle(node);
				if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
					top = Math.max(top, node.getBoundingClientRect().top - rect.top);
					break;
				}
			}
			return Math.max(0, Math.min(top, rect.height - 200));
		}
		function Card(props) {
			const size = props.size ?? "s4";
			const live = Boolean(props.live && props.onOpen);
			const move = (event) => {
				if (!props.tilt) return;
				const el = event.currentTarget;
				const rect = el.getBoundingClientRect();
				const px = (event.clientX - rect.left) / rect.width;
				const py = (event.clientY - rect.top) / rect.height;
				el.style.setProperty("--rx", `${((.5 - py) * 18).toFixed(1)}deg`);
				el.style.setProperty("--ry", `${((px - .5) * 22).toFixed(1)}deg`);
				el.style.setProperty("--mx", `${Math.round(px * 100)}%`);
				el.style.setProperty("--my", `${Math.round(py * 100)}%`);
			};
			const leave = (event) => {
				const el = event.currentTarget;
				for (const name of [
					"--rx",
					"--ry",
					"--mx",
					"--my"
				]) el.style.removeProperty(name);
				props.onHover?.(null);
			};
			return h$11("div", {
				className: cx("lp-codex-pc", `lp-codex-${size}`, live && "lp-codex-live", props.flipped && "lp-codex-flipped", props.bob && "lp-codex-bob", props.className),
				"data-family": props.family,
				style: props.delay != null ? { "--d": `${props.delay}s` } : void 0,
				role: live ? "button" : void 0,
				tabIndex: live ? 0 : void 0,
				"aria-label": live ? props.label : void 0,
				onClick: live ? props.onOpen : void 0,
				onKeyDown: live ? (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						props.onOpen?.();
					}
				} : void 0,
				onPointerEnter: props.onHover ? (event) => props.onHover?.(event.currentTarget) : void 0,
				onPointerMove: props.tilt ? move : void 0,
				onPointerLeave: props.tilt || props.onHover ? leave : void 0
			}, h$11("div", { className: "lp-codex-tilt" }, h$11("div", { className: "lp-codex-side lp-codex-front" }, h$11("img", {
				className: "lp-codex-face",
				src: toDataURL(props.face),
				alt: live ? "" : props.label,
				draggable: false
			}), props.children, h$11("div", { className: "lp-codex-shine" })), h$11("div", { className: "lp-codex-side lp-codex-back" }, h$11("img", {
				className: "lp-codex-face",
				src: toDataURL(cardBack()),
				alt: props.flipped ? "卡背" : "",
				draggable: false
			}))));
		}
		function nameClass(title, size) {
			const w = widthOf(title);
			if (size === "s6") return w > 9 ? "lp-codex-t lp-codex-name lp-codex-long" : "lp-codex-t lp-codex-name";
			if (size === "s3") return w > 9 ? "lp-codex-t lp-codex-name lp-codex-two" : "lp-codex-t lp-codex-name";
			return "lp-codex-t lp-codex-name";
		}
		function objectOf$2(card, speciesName) {
			if (card.tier === "cell") return "细胞";
			if (card.tier === "human" || card.tier === "trial") return "人";
			const animal = card.species.find((key) => key !== "human" && key !== "cell_line");
			return animal ? speciesName(animal) : "动物";
		}
		function StudyText(props) {
			const { card, size } = props;
			return h$11(react.default.Fragment, null, h$11("span", { className: "lp-codex-t lp-codex-no" }, `No.${card.no}`), h$11("img", {
				className: "lp-codex-gem",
				src: toDataURL(gem(card.tier)),
				alt: ""
			}), h$11("span", { className: "lp-codex-t lp-codex-tier" }, TIERS[card.tier].label), h$11("span", { className: nameClass(card.title_zh, size) }, card.title_zh), h$11("span", { className: "lp-codex-t lp-codex-sub" }, h$11("span", null, objectOf$2(card, props.speciesName)), h$11("span", null, card.source.year ?? "")), card.read ? h$11("img", {
				className: "lp-codex-seal",
				src: toDataURL(seal("read")),
				alt: "已读"
			}) : null);
		}
		function studyLabel(card) {
			return `研究卡 No.${card.no}「${card.title_zh}」，${TIERS[card.tier].metal} · ${TIERS[card.tier].label}${card.read ? "，已读" : ""}`;
		}
		function ExpCard(props) {
			const { info } = props;
			const size = props.size ?? "s4";
			const outcome = info.result?.outcome;
			const label = `实验卡「${info.title}」，${info.status}${outcome ? `，${OUTCOME_STAMP[outcome]}` : ""}`;
			return h$11(Card, {
				face: experimentFace({
					id: info.id,
					icon: info.icon
				}, info.cells),
				size,
				family: "experiment",
				label,
				live: props.live,
				flipped: props.flipped,
				bob: props.bob,
				delay: props.delay,
				tilt: props.tilt,
				className: props.className,
				onOpen: props.onOpen
			}, h$11("span", { className: "lp-codex-t lp-codex-no" }, "实验"), h$11("span", { className: "lp-codex-t lp-codex-tier lp-codex-tier-r" }, `${info.days} 天`), h$11("span", { className: nameClass(info.title, size) }, info.title), h$11("span", { className: "lp-codex-t lp-codex-sub" }, h$11("span", null, info.status), h$11("span", null, info.right)), outcome === "outside" && props.foil ? h$11("div", {
				className: "lp-codex-holo",
				"aria-hidden": true
			}) : null, outcome ? h$11("span", { className: cx("lp-codex-stamp", outcome !== "outside" && "lp-codex-calm") }, OUTCOME_STAMP[outcome]) : null, info.waiting ? h$11("span", { className: "lp-codex-stamp lp-codex-calm" }, "等复查") : null);
		}
		function optionInfo(option) {
			return {
				id: option.id,
				icon: option.icon,
				title: option.title_zh,
				days: option.days,
				cells: [],
				status: "可选",
				right: option.randomizable ? "可选随机版" : "",
				result: null
			};
		}
		function runInfo(run) {
			const result = run.result;
			const status = run.status === "revealed" && result ? `做到 ${result.done_days}/${result.window_days} 天` : run.status === "retest_wait" ? "等复查" : run.status === "ready" ? "可以翻了" : `第 ${run.day}/${run.days} 天`;
			return {
				id: run.experiment_id,
				icon: run.icon,
				title: run.title_zh,
				days: run.days,
				cells: run.cells,
				status,
				right: run.randomized ? "随机版" : "",
				result: run.status === "revealed" ? result : null,
				waiting: run.status === "retest_wait"
			};
		}
		function resultCardFace(card) {
			const short = card.title_zh.replace(/（[^）]*）/g, "").trim();
			return [
				h$11("span", {
					key: "no",
					className: "lp-codex-t lp-codex-no"
				}, "复查"),
				h$11("img", {
					key: "gem",
					className: "lp-codex-gem",
					src: toDataURL(gem(card.tier)),
					alt: ""
				}),
				h$11("span", {
					key: "name",
					className: nameClass(short, "s4")
				}, short),
				h$11("span", {
					key: "sub",
					className: "lp-codex-t lp-codex-sub"
				}, h$11("span", null, card.value_zh ?? "没有算"), h$11("span", null, card.outcome ? OUTCOME_STAMP[card.outcome] : ""))
			];
		}
		function TierChip(props) {
			return h$11("span", { className: `lp-codex-chip lp-codex-chip-${props.tier}` }, `${TIERS[props.tier].metal} · ${TIERS[props.tier].label}`);
		}
		function ChapterChip(props) {
			if (!props.chapter) return null;
			return h$11("span", { className: "lp-codex-chip" }, h$11("img", {
				src: toDataURL(emblem(props.chapter.motif)),
				alt: ""
			}), props.chapter.title_zh);
		}
		function SourceLine(props) {
			const s = props.source;
			const head = [
				`${s.first_author}${s.et_al ? " 等" : ""}`,
				s.journal,
				s.year ? String(s.year) : "",
				s.preprint ? "预印本" : ""
			].filter(Boolean).join(" · ");
			return h$11("div", { className: "lp-codex-src" }, h$11("p", null, `出处：${head}`), s.doi ? h$11("p", null, h$11("a", {
				className: "lp-codex-link",
				href: `https://doi.org/${s.doi}`,
				target: "_blank",
				rel: "noopener noreferrer"
			}, `DOI ${s.doi}`)) : null, s.coi_zh ? h$11("p", { className: "lp-codex-coi" }, s.coi_zh) : null);
		}
		function StudyInfo(props) {
			const { card } = props;
			const tier = TIERS[card.tier];
			return h$11("div", { className: "lp-codex-info" }, h$11("h3", { className: cx("lp-codex-info-h", widthOf(card.title_zh) > 10 && "lp-codex-long") }, card.title_zh), h$11("p", { className: "lp-codex-desc" }, ...highlight(card.line_zh)), h$11("div", { className: "lp-codex-pills" }, h$11(TierChip, { tier: card.tier }), h$11(ChapterChip, { chapter: props.chapter })), props.full ? h$11("div", { className: "lp-codex-more" }, h$11("p", null, h$11("b", null, "这项研究"), card.about_zh), card.relation_zh ? h$11("p", { className: "lp-codex-mine" }, h$11("b", null, "和你的关系"), card.relation_zh) : null, h$11("p", null, h$11("b", null, `为什么是${tier.metal}色`), `${tier.metal} · ${tier.label}：${card.tier_reason_zh}`), h$11(SourceLine, { source: card.source }), h$11("p", { className: "lp-codex-readmark" }, h$11("img", {
				src: toDataURL(seal("read")),
				alt: ""
			}), "已读"), ...(props.met ?? []).map((key) => h$11("div", {
				key,
				className: "lp-codex-status lp-codex-pop",
				style: { "--d": ".3s" }
			}, props.metFace?.(key) ? h$11(Card, {
				face: props.metFace(key),
				size: "s2",
				family: "species",
				label: props.speciesName(key)
			}) : null, h$11("span", null, h$11("b", null, `遇见了 ${props.speciesName(key)}`), h$11("br"), "已放进物种志。")))) : null);
		}
		function ResultInfo(props) {
			const { run, result } = props;
			return h$11("div", { className: "lp-codex-info lp-codex-result" }, h$11("h3", { className: cx("lp-codex-info-h", widthOf(run.title_zh) > 10 && "lp-codex-long") }, run.title_zh), h$11("p", { className: "lp-codex-result-main" }, result.primary.text_zh), result.praise_zh ? h$11("p", { className: "lp-codex-praise" }, result.praise_zh) : null, ...result.also.map((row) => h$11("p", {
				key: row.key,
				className: "lp-codex-also"
			}, row.text_zh)), h$11("p", null, `${result.window_days} 天里做到了 ${result.done_days} 天。`), run.randomized ? h$11("p", { className: "lp-codex-cap" }, "这是随机版：比较的是做的日子和不做的日子。") : null, h$11("details", { className: "lp-codex-fold" }, h$11("summary", null, "怎么算的"), h$11("p", null, result.how_zh)), null);
		}
		function OptionText(props) {
			const o = props.option;
			return h$11("div", { className: "lp-codex-slot-text" }, h$11("p", null, h$11("b", null, "做什么　"), o.do_zh), h$11("p", null, h$11("b", null, "看什么　"), o.primary_zh), o.also_zh.length > 0 ? h$11("p", null, h$11("b", null, "顺便看　"), o.also_zh.join("、")) : null, h$11("div", { className: "lp-codex-chips" }, h$11("span", { className: "lp-codex-chip lp-codex-chip-exp" }, `${o.days} 天`), o.randomizable ? h$11("span", { className: "lp-codex-chip lp-codex-chip-blue" }, "可选随机版") : null, o.needs_retest ? h$11("span", { className: "lp-codex-chip lp-codex-chip-human" }, "等复查揭晓") : null));
		}
		function Btn(props) {
			return h$11("button", {
				type: "button",
				className: cx("lp-codex-btn", props.tone && props.tone !== "orange" && `lp-codex-btn-${props.tone}`, props.small && "lp-codex-btn-sm", props.className),
				onClick: props.onClick,
				disabled: props.disabled,
				"aria-pressed": props.pressed,
				"aria-label": props.label
			}, props.children);
		}
		function PixelSwitch(props) {
			return h$11("button", {
				type: "button",
				role: "switch",
				"aria-checked": props.checked,
				disabled: props.disabled,
				className: "lp-codex-switch",
				onClick: () => props.onChange(!props.checked)
			}, h$11("span", {
				className: "lp-codex-switch-track",
				"aria-hidden": true
			}, h$11("span", { className: "lp-codex-switch-thumb" })), h$11("span", null, props.label), h$11("span", { className: "lp-codex-switch-state" }, props.checked ? "开" : "关"));
		}
		function Choice(props) {
			return h$11("div", {
				className: "lp-codex-choice",
				role: "group",
				"aria-label": props.label
			}, ...props.options.map(([value, text]) => h$11(Btn, {
				key: value,
				small: true,
				tone: props.value === value ? "teal" : "grey",
				pressed: props.value === value,
				disabled: props.disabled,
				onClick: () => props.onChange(value)
			}, text)));
		}
		function MyDayFields(props) {
			return h$11("div", { className: "lp-codex-times" }, h$11("label", { className: "lp-codex-field" }, h$11("span", null, "开始"), h$11("input", {
				className: "lp-codex-time",
				type: "time",
				value: props.value.start,
				onChange: (event) => props.onChange({
					...props.value,
					start: event.target.value
				})
			})), h$11("span", { "aria-hidden": true }, "—"), h$11("label", { className: "lp-codex-field" }, h$11("span", null, "结束"), h$11("input", {
				className: "lp-codex-time",
				type: "time",
				value: props.value.end,
				onChange: (event) => props.onChange({
					...props.value,
					end: event.target.value
				})
			})));
		}
		function ChoosePanel(props) {
			const o = props.option;
			const [answers, setAnswers] = react.default.useState({});
			const [randomized, setRandomized] = react.default.useState(false);
			const unanswered = o.questions.some((q) => answers[q.id] == null);
			return h$11("div", { className: "lp-codex-box lp-codex-stack lp-codex-pop" }, h$11("h3", { className: "lp-codex-h2" }, o.title_zh), h$11(OptionText, { option: o }), h$11("p", { className: "lp-codex-cap" }, `来源：${o.source_zh}`), o.needs_retest ? h$11("p", { className: "lp-codex-cap" }, "这个实验的结果要靠化验，等下次复查时在复查包里揭晓。") : null, o.questions.length > 0 ? h$11("div", { className: "lp-codex-ask" }, h$11("p", { className: "lp-codex-h3" }, "开始前问一句"), ...o.questions.map((q) => h$11("div", {
				key: q.id,
				className: "lp-codex-ask-q"
			}, h$11("span", null, q.text_zh), h$11(Choice, {
				label: q.text_zh,
				value: answers[q.id] === true ? "yes" : answers[q.id] === false ? "no" : "",
				options: [["yes", "是"], ["no", "不是"]],
				onChange: (value) => setAnswers((all) => ({
					...all,
					[q.id]: value === "yes"
				}))
			})))) : null, o.randomizable ? h$11("div", { className: "lp-codex-stack" }, h$11(PixelSwitch, {
				checked: randomized,
				label: "用随机版",
				onChange: setRandomized
			}), h$11("p", { className: "lp-codex-cap" }, "随机版：每天早上由 LongPi 随机定今天做还是不做，两种日子各 7 天，最后比较两种日子。比前后比较更能排除天气和忙闲的影响。")) : null, h$11("div", { className: "lp-codex-row" }, h$11(Btn, {
				tone: "green",
				disabled: props.busy || unanswered,
				onClick: () => props.onStart(answers, randomized)
			}, "开始这个实验"), props.onBack ? h$11(Btn, {
				tone: "grey",
				onClick: props.onBack
			}, "回到三张") : null), unanswered ? h$11("p", { className: "lp-codex-cap" }, "先回答上面的问题。") : null);
		}
		function CodexPage(props) {
			const [view, setView] = react.default.useState(null);
			const [lib, setLib] = react.default.useState(null);
			const [libFailed, setLibFailed] = react.default.useState("");
			const [failed, setFailed] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const [tab, setTab] = react.default.useState("exp");
			const [ov, setOv] = react.default.useState(null);
			const [stageTop, setStageTop] = react.default.useState(16);
			const [minHeight, setMinHeight] = react.default.useState(null);
			const [notice, setNotice] = react.default.useState(null);
			const [tip, setTip] = react.default.useState(null);
			const [filterTier, setFilterTier] = react.default.useState(null);
			const [filterChapter, setFilterChapter] = react.default.useState(null);
			const [myDay, setMyDay] = react.default.useState(null);
			const [intro, setIntro] = react.default.useState(null);
			const root = react.default.useRef(null);
			const canvas = react.default.useRef(null);
			const shards = react.default.useRef(null);
			const stage = react.default.useRef(null);
			const tipBox = react.default.useRef(null);
			const opener = react.default.useRef(null);
			const timers = react.default.useRef(/* @__PURE__ */ new Set());
			const reduce = useReducedMotion();
			const still = Boolean(view?.prefs.presentation);
			const simple = Boolean(view?.prefs.simple);
			const anim = !still && !reduce && !simple;
			const flipAnim = !still && !simple;
			const later = react.default.useCallback((ms, fn) => {
				const id = setTimeout(() => {
					timers.current.delete(id);
					fn();
				}, ms);
				timers.current.add(id);
			}, []);
			const wait = react.default.useCallback((ms) => new Promise((resolve) => {
				if (ms <= 0) resolve();
				else later(ms, resolve);
			}), [later]);
			react.default.useEffect(() => () => {
				for (const id of timers.current) clearTimeout(id);
				timers.current.clear();
			}, []);
			const say = react.default.useCallback((text) => {
				if (!text) return;
				setNotice({
					text,
					id: Date.now()
				});
				props.onNotice?.(text);
			}, [props.onNotice]);
			react.default.useEffect(() => {
				if (!notice) return void 0;
				const id = setTimeout(() => setNotice((now) => now?.id === notice.id ? null : now), 7e3);
				return () => clearTimeout(id);
			}, [notice]);
			const load = react.default.useCallback(async () => {
				try {
					const next = await getJson(PATH);
					if (!isView(next)) throw new Error("长寿图鉴的回答看不懂。");
					setView(next);
					setFailed("");
				} catch (error) {
					setFailed(errorText(error, "没能打开长寿图鉴"));
				}
			}, []);
			const loadLibrary = react.default.useCallback(async () => {
				try {
					const next = await getJson(`${PATH}/library`);
					if (!isLibrary(next)) throw new Error("图书馆的回答看不懂。");
					setLib(next);
					setLibFailed("");
				} catch (error) {
					setLibFailed(errorText(error, "没能打开图书馆"));
				}
			}, []);
			react.default.useEffect(() => {
				injectFont();
				load();
				loadLibrary();
			}, [load, loadLibrary]);
			react.default.useEffect(() => {
				if (!canvas.current) return void 0;
				return startSwirl(canvas.current, { still: still || simple });
			}, [still, simple]);
			async function act(body) {
				setBusy(true);
				try {
					const res = await postJson(PATH, body);
					if (isView(res.view)) setView(res.view);
					if (!res.ok) {
						say(res.error || "没有做成，请再试一次。");
						return null;
					}
					if (res.note_zh) say(res.note_zh);
					return res;
				} catch (error) {
					say(errorText(error, "没有做成，请再试一次。"));
					load();
					return null;
				} finally {
					setBusy(false);
				}
			}
			const openOverlay = (next) => {
				opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				setTip(null);
				if (root.current) setStageTop(visibleTop(root.current) + 16);
				setOv(next);
			};
			const closeOverlay = react.default.useCallback(() => {
				setOv(null);
				setMinHeight(null);
				const back = opener.current;
				opener.current = null;
				if (back && document.contains(back)) back.focus();
			}, []);
			const ovKind = ov?.kind ?? null;
			react.default.useEffect(() => {
				if (!ovKind) return void 0;
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						closeOverlay();
					}
				};
				document.addEventListener("keydown", onKey);
				stage.current?.focus({ preventScroll: true });
				return () => document.removeEventListener("keydown", onKey);
			}, [ovKind, closeOverlay]);
			react.default.useLayoutEffect(() => {
				if (!ov || !stage.current) return void 0;
				const el = stage.current;
				const fit = () => setMinHeight(stageTop + el.offsetHeight + 24);
				fit();
				if (typeof ResizeObserver === "undefined") return void 0;
				const watch = new ResizeObserver(fit);
				watch.observe(el);
				return () => watch.disconnect();
			}, [ov, stageTop]);
			/** Pixel shards from the middle of an element, inside the container. */
			const burst = (el, colors, n) => {
				if (!anim || !el || !root.current || !shards.current) return;
				const base = root.current.getBoundingClientRect();
				const rect = el.getBoundingClientRect();
				const x = rect.left - base.left + rect.width / 2;
				const y = rect.top - base.top + rect.height / 2;
				for (let i = 0; i < n; i += 1) {
					const node = document.createElement("i");
					node.className = "lp-codex-shard";
					const a = Math.random() * Math.PI * 2;
					const d = 60 + Math.random() * 160;
					node.style.left = `${Math.round(x - 4)}px`;
					node.style.top = `${Math.round(y - 4)}px`;
					node.style.setProperty("--dx", `${Math.round(Math.cos(a) * d)}px`);
					node.style.setProperty("--dy", `${Math.round(Math.sin(a) * d)}px`);
					node.style.setProperty("--c", colors[i % colors.length]);
					shards.current.appendChild(node);
					later(900, () => node.remove());
				}
			};
			const openPack = (pack) => {
				const opened = pack.kind === "experiment" && Boolean(pack.opened) && pack.options.length > 0;
				openOverlay({
					kind: "pack",
					pack,
					phase: opened ? "cards" : "idle",
					options: opened ? pack.options : [],
					results: [],
					flipped: [
						false,
						false,
						false
					],
					dealt: opened,
					chosen: null,
					leaving: false,
					note: ""
				});
			};
			const tearPack = async () => {
				if (!ov || ov.kind !== "pack" || ov.phase !== "idle") return;
				const pack = ov.pack;
				setOv({
					...ov,
					phase: "shake"
				});
				const [res] = await Promise.all([act(codexBodies.openPack(pack.id)), wait(anim ? 500 : 0)]);
				if (!res) {
					setOv((now) => now && now.kind === "pack" ? {
						...now,
						phase: "idle"
					} : now);
					return;
				}
				burst(stage.current?.querySelector(".lp-codex-ovpack") ?? null, PACK_SHARDS[pack.kind], 26);
				if (pack.kind === "experiment") {
					const options = res.view.packs.find((row) => row.id === pack.id)?.options ?? [];
					if (options.length === 0) {
						setOv((now) => now && now.kind === "pack" ? {
							...now,
							phase: "empty",
							note: res.note_zh || "现在没有适合你的实验。包会一直留着。"
						} : now);
						return;
					}
					dealCards(options.length, {
						options,
						results: []
					});
				} else dealCards(res.pack?.results.length ?? 0, {
					options: [],
					results: res.pack?.results ?? []
				});
			};
			const dealCards = (count, content) => {
				const flipped = Array.from({ length: count }, () => flipAnim);
				setOv((now) => now && now.kind === "pack" ? {
					...now,
					phase: "cards",
					...content,
					flipped,
					dealt: !flipAnim
				} : now);
				if (!flipAnim) return;
				later((anim ? 450 : 60) + count * 160 + 700, () => setOv((now) => now && now.kind === "pack" ? {
					...now,
					dealt: true
				} : now));
				for (let i = 0; i < count; i += 1) later((anim ? 450 : 60) + i * 160, () => {
					setOv((now) => {
						if (!now || now.kind !== "pack") return now;
						const next = [...now.flipped];
						next[i] = false;
						return {
							...now,
							flipped: next
						};
					});
					const card = content.results[i];
					if (card && !card.plain) later(200, () => burst(stage.current?.querySelector(`[data-slot="${i}"] .lp-codex-pc`) ?? null, SHARD_GOLD, 14));
				});
			};
			const beginRun = async (option, packId, answers, randomized) => {
				const res = await act(codexBodies.begin(option.id, packId, answers, randomized));
				if (!res) return;
				if (!res.note_zh) say(`开始了「${res.run?.title_zh ?? option.title_zh}」。从今天算第 1 天。`);
				if (packId) {
					setOv((now) => now && now.kind === "pack" ? {
						...now,
						leaving: true
					} : now);
					await wait(anim ? 420 : 0);
				}
				setTab("exp");
				closeOverlay();
			};
			const turn = async () => {
				if (!ov || ov.kind !== "reveal" || ov.phase !== "back") return;
				const res = await act(codexBodies.reveal(ov.run.id));
				if (!res) return;
				const run = res.run ?? res.view.deck[0] ?? ov.run;
				setOv({
					kind: "reveal",
					run,
					phase: "turning"
				});
				await wait(flipAnim ? 380 : 0);
				setOv((now) => now && now.kind === "reveal" ? {
					...now,
					phase: "done"
				} : now);
				if (run.result?.outcome === "outside") later(40, () => burst(stage.current?.querySelector(".lp-codex-pc") ?? null, SHARD_FOIL, 34));
			};
			const speciesName = react.default.useCallback((key) => lib?.species.find((row) => row.key === key)?.name_zh ?? OBJECT_ZH[key] ?? key, [lib]);
			const speciesRaster = react.default.useCallback((key) => {
				const row = lib?.species.find((item) => item.key === key);
				return row ? speciesFace(row, false) : null;
			}, [lib]);
			const openStudy = async (card) => {
				openOverlay({
					kind: "study",
					id: card.id,
					met: []
				});
				const res = await act(codexBodies.read(card.id));
				if (!res) return;
				const met = res.met ?? [];
				setLib((now) => now ? {
					...now,
					studies: now.studies.map((row) => row.id === card.id ? {
						...row,
						read: true
					} : row),
					species: now.species.map((row) => met.includes(row.key) ? {
						...row,
						met: true
					} : row)
				} : now);
				if (met.length > 0) {
					setOv((now) => now && now.kind === "study" && now.id === card.id ? {
						...now,
						met
					} : now);
					say(`遇见了 ${met.map(speciesName).join("、")}，已放进物种志。`);
				}
			};
			const hoverStudy = (id) => (el) => {
				if (!el || !root.current || simple) {
					setTip(null);
					return;
				}
				const base = root.current.getBoundingClientRect();
				const rect = el.getBoundingClientRect();
				const width = 268;
				const right = rect.right - base.left + 16;
				const left = rect.left - base.left - width - 16;
				const x = right + width <= base.width - 8 ? right : left >= 8 ? left : null;
				if (x == null) {
					setTip(null);
					return;
				}
				setTip({
					id,
					left: Math.round(x),
					top: Math.round(rect.top - base.top)
				});
			};
			react.default.useLayoutEffect(() => {
				if (!tip || !tipBox.current || !root.current) return;
				const max = root.current.offsetHeight - tipBox.current.offsetHeight - 12;
				if (tip.top > max) tipBox.current.style.top = `${Math.max(8, max)}px`;
			}, [tip]);
			const packsWaiting = view ? view.packs.length : 0;
			const containerClass = cx("lp lp-codex", still && "lp-codex-still", simple && "lp-codex-simple");
			const shell = (...children) => h$11("div", {
				className: containerClass,
				ref: root,
				style: minHeight ? { minHeight } : void 0,
				role: "region",
				"aria-label": "长寿图鉴"
			}, h$11("div", {
				className: "lp-codex-bgwrap",
				"aria-hidden": true
			}, h$11("div", { className: "lp-codex-bgview" }, h$11("canvas", {
				className: "lp-codex-bg",
				ref: canvas
			}))), h$11("div", { className: "lp-codex-body" }, ...children), tip && lib && !ov ? tipNode(tip) : null, ov ? overlayNode(ov) : null, h$11("div", {
				className: "lp-codex-shards",
				ref: shards,
				"aria-hidden": true
			}));
			const header = (side) => h$11("header", { className: "lp-codex-head" }, h$11("div", { className: "lp-codex-logo" }, h$11("img", {
				src: toDataURL(cardBack()),
				alt: ""
			}), h$11("div", null, h$11("h2", { className: "lp-codex-h1" }, "长寿图鉴"), h$11("p", { className: "lp-codex-meta" }, ...seasonLine()))), side ?? null);
			function seasonLine() {
				const season = view?.season;
				if (!view || !view.enabled || !view.started || !season) return ["读研究，做两周的小实验，翻开看自己的结果。"];
				if (season.status === "closed") return [h$11("b", { key: "end" }, "赛季已结束"), "。做过的实验都在牌组里。"];
				const mode = season.mode === "retest" ? "到下次复查为止" : `共 ${season.weeks} 周`;
				const out = [h$11("b", { key: "wk" }, `赛季 · 第 ${season.week} 周`), ` / ${mode}`];
				if (packsWaiting > 0) out.push(` · ${packsWaiting} 个包等你拆开`);
				if (view.ready.length > 0) out.push(` · ${view.ready.length} 张实验卡可以翻了`);
				return out;
			}
			const status = notice ? h$11("div", {
				className: "lp-codex-status",
				role: "status"
			}, h$11("span", null, notice.text), h$11(Btn, {
				small: true,
				tone: "grey",
				label: "关闭提示",
				onClick: () => setNotice(null)
			}, "知道了")) : null;
			const memberLine = view?.member ? h$11("p", { className: "lp-codex-box lp-codex-cream" }, view.member.note_zh) : null;
			if (!view) return shell(header(), failed ? h$11("div", {
				className: "lp-codex-box lp-codex-stack",
				role: "alert"
			}, h$11("p", null, `没能打开长寿图鉴：${failed}`), h$11("div", null, h$11(Btn, { onClick: () => {
				load();
			} }, "再试一次"))) : h$11("p", { className: "lp-codex-box" }, "正在打开长寿图鉴…"));
			if (!view.enabled) {
				const closed = view.reason === "opt_out";
				return shell(header(), memberLine, h$11("div", { className: "lp-codex-box lp-codex-stack" }, h$11("p", { className: "lp-codex-big" }, view.reason_zh || "长寿图鉴没有打开。"), closed ? h$11("div", null, h$11(Btn, {
					tone: "green",
					disabled: busy,
					onClick: () => {
						act(codexBodies.prefs({ codex: true }));
					}
				}, "重新打开")) : null), status);
			}
			if (!view.started) return shell(header(), memberLine, firstOpen(), status);
			const tabs = [
				[
					"exp",
					"实验",
					String(view.packs.length + view.ready.length || "")
				],
				[
					"library",
					"图书馆",
					""
				],
				[
					"deck",
					"牌组",
					view.deck.length ? String(view.deck.length) : ""
				],
				[
					"species",
					"物种志",
					`${view.species.met}/${view.species.total}`
				],
				[
					"footprints",
					"足迹",
					""
				],
				[
					"settings",
					"设置",
					""
				]
			];
			return shell(header(view.season?.status === "closed" ? h$11("div", { className: "lp-codex-head-side" }, h$11(Btn, {
				tone: "green",
				disabled: busy,
				onClick: () => {
					act(codexBodies.nextSeason());
				}
			}, "开始下一个赛季")) : null), memberLine, status, h$11("nav", {
				className: "lp-codex-tabs",
				role: "tablist",
				"aria-label": "长寿图鉴"
			}, ...tabs.map(([key, label, badge]) => h$11("button", {
				key,
				type: "button",
				role: "tab",
				id: `lp-codex-tab-${key}`,
				"aria-selected": tab === key,
				"aria-controls": "lp-codex-panel",
				className: "lp-codex-btn lp-codex-tab",
				onClick: () => {
					setTab(key);
					setTip(null);
				}
			}, label, badge ? h$11("span", { className: "lp-codex-tab-n" }, badge) : null))), h$11("div", {
				id: "lp-codex-panel",
				role: "tabpanel",
				"aria-labelledby": `lp-codex-tab-${tab}`,
				className: "lp-codex-stack"
			}, tab === "exp" ? experimentsTab() : tab === "library" ? libraryTab() : tab === "deck" ? deckTab() : tab === "species" ? speciesTab() : tab === "footprints" ? footprintsTab() : settingsTab()));
			function firstOpen() {
				const v = view;
				const form = intro ?? {
					my_day: v.intro.my_day,
					season_mode: v.intro.season_mode,
					standup: v.intro.standup
				};
				const set = (patch) => setIntro({
					...form,
					...patch
				});
				return h$11("div", { className: "lp-codex-box lp-codex-set" }, h$11("div", { className: "lp-codex-pair" }, h$11("div", {
					className: "lp-codex-hand",
					"aria-hidden": true
				}, h$11("img", {
					src: toDataURL(pack("experiment")),
					alt: "",
					width: 90,
					height: 126,
					className: "lp-codex-bob"
				})), h$11("div", { className: "lp-codex-stack" }, h$11("h3", { className: "lp-codex-h2" }, "第一次打开长寿图鉴"), h$11("p", null, CODEX_INTRO), h$11("p", { className: "lp-codex-lead" }, SEASON_INTRO))), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "你通常几点开始、几点结束一天的工作？"), h$11("div", { className: "lp-codex-stack" }, h$11(MyDayFields, {
					value: form.my_day,
					onChange: (next) => set({ my_day: next })
				}), h$11("p", { className: "lp-codex-cap" }, "可以跨过午夜，比如 13:00 到 02:00。LongPi 只在这段时间里提醒你。"))), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "一个赛季多长？"), h$11(Choice, {
					label: "赛季长度",
					value: form.season_mode,
					options: [["8w", "8 周"], ["retest", "到下次复查为止"]],
					onChange: (value) => set({ season_mode: value })
				})), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "起身提醒"), v.intro.wristband ? h$11("div", { className: "lp-codex-stack" }, h$11(PixelSwitch, {
					checked: form.standup,
					label: "坐太久时提醒我起来走两分钟",
					onChange: (value) => set({ standup: value })
				}), h$11("p", { className: "lp-codex-cap" }, "你在 DSH 前已经坐了 90 分钟、又正好在等 agent 跑任务时，健康栏会出现一行小字。点「好」后手环记到你走动才算一次。每天最多两次，不发奖励。")) : h$11("p", null, "没有手环时，不会出现起身提醒。")), h$11("div", null, h$11(Btn, {
					tone: "green",
					disabled: busy,
					onClick: () => {
						act(codexBodies.start(form.my_day, form.season_mode, v.intro.wristband ? form.standup : false));
					}
				}, "开始")));
			}
			function experimentsTab() {
				const v = view;
				const parts = [];
				const top = [];
				if (v.ready.length > 0) top.push(h$11("section", {
					key: "ready",
					className: "lp-codex-box lp-codex-section"
				}, h$11("h3", { className: "lp-codex-h2" }, "可以翻了"), ...v.ready.map((run, i) => h$11("div", {
					key: run.id,
					className: "lp-codex-pair"
				}, h$11(Card, {
					face: cardBack(),
					size: simple ? "s3" : "s4",
					family: "back",
					label: `「${run.title_zh}」做完了，翻开看结果`,
					live: true,
					bob: anim,
					delay: -i * .7,
					onOpen: () => openOverlay({
						kind: "reveal",
						run,
						phase: "back"
					})
				}), h$11("div", { className: "lp-codex-stack" }, h$11("p", { className: "lp-codex-big" }, `「${run.title_zh}」做完了`), h$11("p", null, `${run.days} 天里做到了 ${run.done_count} 天。`), h$11("p", { className: "lp-codex-lead" }, `翻开看主要结果：${run.primary_zh}，有没有超出你的平时波动。`), h$11("div", null, h$11(Btn, {
					tone: "gold",
					onClick: () => openOverlay({
						kind: "reveal",
						run,
						phase: "back"
					})
				}, "翻开")))))));
				if (v.packs.length > 0) top.push(h$11("section", {
					key: "packs",
					className: "lp-codex-box lp-codex-section"
				}, h$11("h3", { className: "lp-codex-h2" }, "等你拆开的包"), h$11("p", { className: "lp-codex-lead" }, "实验包里有三个小实验（多数是两周），选一个开始；复查包里是这次体检能算出的结果卡。包会一直留着。"), h$11("div", { className: "lp-codex-shelf" }, ...v.packs.map((pack$1, i) => h$11("button", {
					key: pack$1.id,
					type: "button",
					className: "lp-codex-pack",
					onClick: () => openPack(pack$1),
					"aria-label": `${pack$1.kind === "experiment" ? "实验包" : "复查包"}：${pack$1.source_zh}，点开拆`
				}, h$11("img", {
					src: toDataURL(pack(pack$1.kind)),
					alt: "",
					className: anim ? "lp-codex-bob" : void 0,
					style: { "--d": `${-i * .9}s` }
				}), h$11("span", { className: "lp-codex-pname" }, pack$1.kind === "experiment" ? "实验包" : "复查包"), h$11("span", { className: "lp-codex-cap" }, pack$1.source_zh), h$11("span", { className: "lp-codex-k-gold" }, pack$1.empty_zh ?? (pack$1.opened ? "拆开了，还没选" : "点开拆")))))));
				if (top.length > 0) parts.push(h$11("div", {
					key: "top",
					className: "lp-codex-duo"
				}, ...top));
				parts.push(h$11("section", {
					key: "running",
					className: "lp-codex-box lp-codex-section"
				}, h$11("h3", { className: "lp-codex-h2" }, "进行中"), v.running.length === 0 ? h$11("p", { className: "lp-codex-empty" }, v.packs.some((pack) => pack.kind === "experiment") ? "现在没有进行中的实验。拆开上面的实验包，选一个开始。" : "现在没有进行中的实验。做完一个实验、或者新赛季开始时，会有新的实验包。") : h$11("div", { className: "lp-codex-stack" }, ...v.running.map((run) => runBlock(run))), v.running.length > 0 ? h$11("p", { className: "lp-codex-cap" }, "底部 14 格是 14 天：亮的是做到的日子，暗的是断掉的日子，浅色是还没到的日子。断几天没关系，有 10 天的数据就能揭晓。") : null));
				if (v.reserve.length > 0) parts.push(h$11("section", {
					key: "reserve",
					className: "lp-codex-box lp-codex-section"
				}, h$11("h3", { className: "lp-codex-h2" }, "待选"), h$11("p", { className: "lp-codex-lead" }, "之前没选的实验放在这里，下次可以直接开始。"), h$11("ul", { className: "lp-codex-list" }, ...v.reserve.map((option) => h$11("li", {
					key: option.id,
					className: "lp-codex-item"
				}, h$11("img", {
					src: toDataURL(experimentFace({
						id: option.id,
						icon: option.icon
					}, [])),
					alt: ""
				}), h$11("div", { className: "lp-codex-item-main" }, h$11("b", null, option.title_zh), h$11("span", null, option.do_zh), h$11("span", { className: "lp-codex-cap" }, `看什么：${option.primary_zh} · ${option.days} 天${option.randomizable ? " · 可选随机版" : ""}${option.needs_retest ? " · 等复查揭晓" : ""}`)), h$11(Btn, {
					tone: "teal",
					small: true,
					onClick: () => openOverlay({
						kind: "choose",
						option
					})
				}, "开始"))))));
				return h$11(react.default.Fragment, null, ...parts);
			}
			function runBlock(run) {
				const info = runInfo(run);
				const canTick = run.status === "running" && Boolean(run.checkin_zh);
				return h$11("div", {
					key: run.id,
					className: "lp-codex-pair"
				}, h$11(ExpCard, {
					info,
					size: simple ? "s3" : "s4"
				}), h$11("div", { className: "lp-codex-stack" }, h$11("h4", { className: "lp-codex-h2" }, run.title_zh), h$11("p", { className: "lp-codex-run-day" }, run.status === "retest_wait" ? "等复查" : `第 ${run.day}/${run.days} 天`), run.today_zh ? h$11("p", null, h$11("span", { className: "lp-codex-today" }, run.today_zh)) : null, h$11("p", null, h$11("span", { className: "lp-codex-k-gold" }, "做什么　"), run.do_zh), h$11("p", null, h$11("span", { className: "lp-codex-k-gold" }, "看什么　"), run.primary_zh), run.status === "retest_wait" ? h$11("p", { className: "lp-codex-lead" }, "这个实验的结果靠化验。下次复查的结果进了档案，会在复查包里揭晓。") : null, canTick ? h$11("div", { className: "lp-codex-row" }, h$11(Btn, {
					tone: run.done_today ? "teal" : "green",
					pressed: run.done_today,
					disabled: busy,
					onClick: () => {
						act(codexBodies.checkin(run.id, !run.done_today));
					}
				}, run.done_today ? `今天已记：${run.checkin_zh.replace(/^今天/, "")}` : run.checkin_zh), run.done_today ? h$11("span", { className: "lp-codex-cap" }, "记错了就再点一下。") : null) : null, run.status === "running" && !run.checkin_zh ? h$11("p", { className: "lp-codex-cap" }, "这个实验不用你记，手环或血压计会自动记上。") : null, h$11("details", { className: "lp-codex-fold" }, h$11("summary", null, "怎么判定"), h$11("p", null, run.threshold_zh)), h$11("div", null, h$11(Btn, {
					tone: "grey",
					small: true,
					disabled: busy,
					onClick: () => openOverlay({
						kind: "confirm",
						text: `停下「${run.title_zh}」？停下不算失败，也不扣任何东西。`,
						ok: "停下",
						tone: "red",
						run: () => {
							act(codexBodies.stop(run.id));
						}
					})
				}, "停下"))));
			}
			function libraryTab() {
				if (!lib) return h$11("div", { className: "lp-codex-box lp-codex-stack" }, libFailed ? [h$11("p", { key: "e" }, `没能打开图书馆：${libFailed}`), h$11("div", { key: "b" }, h$11(Btn, { onClick: () => {
					loadLibrary();
				} }, "再试一次"))] : h$11("p", null, "正在打开图书馆…"));
				const chapters = [...lib.chapters].sort((a, b) => a.no - b.no);
				const order = new Map(chapters.map((row) => [row.id, row.no]));
				const read = lib.studies.filter((row) => row.read).length;
				const pending = lib.pending > 0 ? h$11("p", { className: "lp-codex-cap" }, `还有 ${lib.pending} 张卡在审核，审核通过后上架。`) : null;
				if (lib.studies.length === 0) return h$11("div", { className: "lp-codex-box lp-codex-stack" }, h$11("h3", { className: "lp-codex-h2" }, "图书馆"), h$11("p", null, "图书馆里还没有上架的研究卡。"), pending);
				const shown = lib.studies.filter((row) => (!filterTier || row.tier === filterTier) && (!filterChapter || row.chapter === filterChapter)).sort((a, b) => Number(Boolean(b.relation_zh)) - Number(Boolean(a.relation_zh)) || (order.get(a.chapter) ?? 99) - (order.get(b.chapter) ?? 99) || a.no.localeCompare(b.no));
				const mine = shown.filter((row) => row.relation_zh);
				const groups = [];
				if (mine.length > 0) groups.push({
					key: "mine",
					title: "和你有关",
					cards: mine
				});
				for (const chapter of chapters) {
					const cards = shown.filter((row) => !row.relation_zh && row.chapter === chapter.id);
					if (cards.length > 0) groups.push({
						key: chapter.id,
						title: `第 ${chapter.no} 章 · ${chapter.title_zh}`,
						cards
					});
				}
				const tierCount = (tier) => lib.studies.filter((row) => row.tier === tier && (!filterChapter || row.chapter === filterChapter)).length;
				return h$11(react.default.Fragment, null, h$11("section", { className: "lp-codex-box lp-codex-section" }, h$11("h3", { className: "lp-codex-h2" }, "图书馆"), h$11("p", { className: "lp-codex-lead" }, `${lib.studies.length} 张研究卡，随时可以读。读过 ${read} 张；读过的卡角上有蓝色的「已读」章。`), pending, h$11("div", { className: "lp-codex-chapters" }, ...chapters.map((chapter) => {
					const size = lib.studies.filter((row) => row.chapter === chapter.id).length;
					const done = lib.studies.filter((row) => row.chapter === chapter.id && row.read).length;
					return h$11("button", {
						key: chapter.id,
						type: "button",
						className: "lp-codex-chapter",
						"aria-pressed": filterChapter === chapter.id,
						onClick: () => setFilterChapter(filterChapter === chapter.id ? null : chapter.id)
					}, h$11("span", { className: "lp-codex-chapter-t" }, h$11("img", {
						src: toDataURL(emblem(chapter.motif)),
						alt: ""
					}), chapter.title_zh), h$11("span", {
						className: "lp-codex-bar",
						"aria-hidden": true
					}, h$11("span", { style: { width: `${size ? done / size * 100 : 0}%` } })), h$11("span", { className: "lp-codex-chapter-c" }, h$11("span", null, `读过 ${done}/${size}`), h$11("span", null, `第 ${chapter.no} 章`)));
				})), h$11("div", {
					className: "lp-codex-chips",
					role: "group",
					"aria-label": "按证据颜色筛选"
				}, h$11("button", {
					type: "button",
					className: "lp-codex-filter",
					"aria-pressed": filterTier == null,
					onClick: () => setFilterTier(null)
				}, "全部颜色"), ...TIER_ORDER.map((tier) => h$11("button", {
					key: tier,
					type: "button",
					className: cx("lp-codex-filter", `lp-codex-chip-${tier}`, filterTier && filterTier !== tier && "lp-codex-filter-off"),
					"aria-pressed": filterTier === tier,
					onClick: () => setFilterTier(filterTier === tier ? null : tier)
				}, `${TIERS[tier].metal} ${TIERS[tier].label} ${tierCount(tier)}`))), h$11("p", { className: "lp-codex-cap" }, lib.note_zh)), shown.length === 0 ? h$11("p", { className: "lp-codex-box" }, "这个筛选下没有卡。") : null, ...groups.map((group) => h$11("section", {
					key: group.key,
					className: "lp-codex-box lp-codex-section"
				}, h$11("h3", { className: "lp-codex-h3" }, `${group.title} · ${group.cards.length} 张`), simple ? h$11("ul", { className: "lp-codex-list" }, ...group.cards.map((card) => h$11("li", { key: card.id }, h$11("button", {
					type: "button",
					className: "lp-codex-item-btn lp-codex-item",
					onClick: () => {
						openStudy(card);
					}
				}, h$11("img", {
					className: "lp-codex-gemi",
					src: toDataURL(gem(card.tier)),
					alt: ""
				}), h$11("span", { className: "lp-codex-item-main" }, h$11("b", null, `No.${card.no} ${card.title_zh}`), h$11("span", null, card.line_zh)), h$11("span", { className: TIERS[card.tier].key }, `${TIERS[card.tier].metal} · ${TIERS[card.tier].label}${card.read ? " · 已读" : ""}`))))) : h$11("div", { className: "lp-codex-grid" }, ...group.cards.map((card) => h$11(Card, {
					key: card.id,
					face: studyFace(card),
					size: "s3",
					family: "study",
					label: studyLabel(card),
					live: true,
					tilt: anim,
					onOpen: () => {
						openStudy(card);
					},
					onHover: hoverStudy(card.id)
				}, h$11(StudyText, {
					card,
					size: "s3",
					speciesName
				})))))));
			}
			function tipNode(at) {
				const card = lib?.studies.find((row) => row.id === at.id);
				if (!card) return null;
				return h$11("div", {
					className: "lp-codex-tip",
					ref: tipBox,
					style: {
						left: at.left,
						top: at.top
					},
					"aria-hidden": true
				}, h$11(StudyInfo, {
					card,
					chapter: lib?.chapters.find((row) => row.id === card.chapter),
					speciesName
				}));
			}
			function deckTab() {
				const v = view;
				if (v.deck.length === 0) return h$11("div", { className: "lp-codex-box lp-codex-stack" }, h$11("h3", { className: "lp-codex-h2" }, "牌组"), h$11("p", null, "做完的实验翻开后会收进这里，每做一次留一张。"));
				return h$11("section", { className: "lp-codex-box lp-codex-section" }, h$11("h3", { className: "lp-codex-h2" }, "牌组"), h$11("p", { className: "lp-codex-lead" }, "每做完一个实验留一张卡。主要结果超出你的平时波动时，卡是镭射版。点开看结果。"), simple ? h$11("ul", { className: "lp-codex-list" }, ...v.deck.map((run) => h$11("li", { key: run.id }, h$11("button", {
					type: "button",
					className: "lp-codex-item-btn lp-codex-item",
					onClick: () => openOverlay({
						kind: "result",
						run
					})
				}, h$11("img", {
					src: toDataURL(experimentFace({
						id: run.experiment_id,
						icon: run.icon
					}, run.cells)),
					alt: ""
				}), h$11("span", { className: "lp-codex-item-main" }, h$11("b", null, run.title_zh), h$11("span", null, run.result?.primary.text_zh ?? ""), h$11("span", { className: "lp-codex-cap" }, `${dayZh(run.start)}–${dayZh(run.end)}`)), h$11("span", { className: run.result?.outcome === "outside" ? "lp-codex-k-red" : "lp-codex-cap" }, run.result ? OUTCOME_STAMP[run.result.outcome] : ""))))) : h$11("div", { className: "lp-codex-hand" }, ...v.deck.map((run) => h$11("div", {
					key: run.id,
					className: "lp-codex-stack"
				}, h$11(ExpCard, {
					info: runInfo(run),
					live: true,
					foil: true,
					tilt: anim,
					onOpen: () => openOverlay({
						kind: "result",
						run
					})
				}), h$11("p", { className: "lp-codex-cap" }, `${dayZh(run.start)}–${dayZh(run.end)}${run.randomized ? " · 随机版" : ""}`)))));
			}
			function speciesTab() {
				if (!lib) return h$11("p", { className: "lp-codex-box" }, libFailed ? `没能打开物种志：${libFailed}` : "正在打开物种志…");
				const met = lib.species.filter((row) => row.met).length;
				return h$11("section", { className: "lp-codex-box lp-codex-section" }, h$11("h3", { className: "lp-codex-h2" }, `物种志 · 遇见了 ${met}/${lib.species.length} 种`), h$11("p", { className: "lp-codex-lead" }, "第一次读到用到某种动物的研究卡时，就遇见了它。卡下方是寿命尺：从一周到三百年，金点是这种动物，白线是人。"), h$11("div", { className: "lp-codex-entries" }, ...lib.species.map((row) => {
					const count = row.studies.length;
					return h$11("div", {
						key: row.key,
						className: "lp-codex-entry"
					}, h$11(Card, {
						face: speciesFace(row, !row.met),
						size: "s3",
						family: "species",
						label: row.met ? `${row.name_zh}，寿命 ${row.lifespan_zh}` : "还没遇见的物种"
					}, h$11("span", { className: "lp-codex-t lp-codex-no" }, `No.${row.no}`), h$11("span", { className: "lp-codex-t lp-codex-name" }, row.met ? row.name_zh : "？？？"), h$11("span", { className: "lp-codex-t lp-codex-sub" }, h$11("span", null, row.met ? row.lifespan_zh : "还没遇见"))), row.met ? h$11("div", { className: "lp-codex-stack" }, h$11("p", { className: "lp-codex-entry-h" }, row.name_zh), h$11("p", { className: "lp-codex-latin" }, row.latin), h$11("div", { className: "lp-codex-chips" }, h$11("span", { className: "lp-codex-chip lp-codex-chip-species" }, `寿命 ${row.lifespan_zh}`), h$11("span", { className: "lp-codex-chip" }, `${count} 张研究卡`)), h$11("p", { className: "lp-codex-k-gold" }, row.hook_zh), h$11("p", null, row.body_zh)) : h$11("div", { className: "lp-codex-stack" }, h$11("p", { className: "lp-codex-entry-h" }, "？？？"), h$11("p", { className: "lp-codex-lead" }, count > 0 ? `图书馆里有 ${count} 张研究卡用到它。读到其中一张，就会遇见它。` : "图书馆里暂时还没有用到它的研究卡。")));
				})));
			}
			function footprintsTab() {
				const v = view;
				return h$11("section", { className: "lp-codex-box lp-codex-section" }, h$11("h3", { className: "lp-codex-h2" }, "足迹"), h$11("p", { className: "lp-codex-lead" }, v.footprints_note_zh), v.footprints.length === 0 ? h$11("p", { className: "lp-codex-empty" }, "还没有足迹。带着简报去看医生、按时复查、做完一个实验，都会记在这里。") : h$11("div", { className: "lp-codex-entries" }, ...v.footprints.map((row) => h$11("div", {
					key: row.id,
					className: "lp-codex-entry"
				}, h$11(Card, {
					face: footprintFace(row.kind),
					size: "s3",
					family: "footprint",
					label: `足迹卡「${row.title_zh}」，${dayZh(row.day)}`
				}, h$11("span", { className: "lp-codex-t lp-codex-no" }, "足迹"), h$11("span", { className: nameClass(row.title_zh, "s3") }, row.title_zh), h$11("span", { className: "lp-codex-t lp-codex-sub" }, h$11("span", null, dayZh(row.day)))), h$11("div", { className: "lp-codex-stack" }, h$11("p", { className: "lp-codex-entry-h" }, row.title_zh), h$11("p", { className: "lp-codex-k-gold" }, dayZh(row.day)), h$11("p", null, row.text_zh))))));
			}
			function settingsTab() {
				const v = view;
				const day = myDay ?? v.prefs.my_day;
				const changed = day.start !== v.prefs.my_day.start || day.end !== v.prefs.my_day.end;
				return h$11("section", { className: "lp-codex-box lp-codex-set" }, h$11("h3", { className: "lp-codex-h2" }, "设置"), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "简洁模式"), h$11("div", { className: "lp-codex-stack" }, h$11(PixelSwitch, {
					checked: v.prefs.simple,
					label: "用列表显示",
					disabled: busy,
					onChange: (next) => {
						act(codexBodies.prefs({ simple: next }));
					}
				}), h$11("p", { className: "lp-codex-cap" }, "打开后用列表显示，不翻牌、不放镭射和碎片，内容不变。"))), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "演示模式"), h$11("div", { className: "lp-codex-stack" }, h$11(PixelSwitch, {
					checked: v.prefs.presentation,
					label: "投屏或开会时打开",
					disabled: busy,
					onChange: (next) => {
						act(codexBodies.prefs({ presentation: next }));
					}
				}), h$11("p", { className: "lp-codex-cap" }, "打开后，LongPi 不出现任何提示，图鉴里也不播放动画。"))), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "我的白天"), h$11("div", { className: "lp-codex-stack" }, h$11(MyDayFields, {
					value: day,
					onChange: setMyDay
				}), h$11("p", { className: "lp-codex-cap" }, "提醒只在这段时间里出现。可以跨过午夜，比如 13:00 到 02:00。"), changed ? h$11("div", null, h$11(Btn, {
					small: true,
					tone: "teal",
					disabled: busy,
					onClick: () => {
						act(codexBodies.prefs({ my_day: day })).then((res) => {
							if (res) {
								setMyDay(null);
								say("我的白天已保存。");
							}
						});
					}
				}, "保存")) : null)), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "起身提醒"), v.devices.wristband ? h$11("div", { className: "lp-codex-stack" }, h$11(PixelSwitch, {
					checked: v.prefs.standup,
					label: "坐太久时提醒我起来走两分钟",
					disabled: busy,
					onChange: (next) => {
						act(codexBodies.prefs({ standup: next }));
					}
				}), h$11("p", { className: "lp-codex-cap" }, "每天最多两次，不发奖励。点「好」之后手环看到你起身走动，才记一次起身。")) : h$11("p", null, "没有手环时，不会出现起身提醒。")), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "赛季长度"), h$11("div", { className: "lp-codex-stack" }, h$11(Choice, {
					label: "赛季长度",
					value: v.prefs.season_mode,
					disabled: busy,
					options: [["8w", "8 周"], ["retest", "到下次复查为止"]],
					onChange: (value) => {
						act(codexBodies.prefs({ season_mode: value }));
					}
				}), h$11("p", { className: "lp-codex-cap" }, "从下一个赛季开始算。"))), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "规则"), h$11("ul", { className: "lp-codex-rules" }, ...v.rules_zh.map((line) => h$11("li", { key: line }, line)))), h$11("div", { className: "lp-codex-set-row" }, h$11("span", null, "关闭"), h$11("div", { className: "lp-codex-stack" }, h$11("div", null, h$11(Btn, {
					tone: "red",
					disabled: busy,
					onClick: () => openOverlay({
						kind: "confirm",
						text: "关闭长寿图鉴？已经读过的卡、做过的实验和足迹都会留着，随时可以重新打开。",
						ok: "关闭",
						tone: "red",
						run: () => {
							act(codexBodies.prefs({ codex: false }));
						}
					})
				}, "关闭长寿图鉴")))));
			}
			function overlayNode(o) {
				const label = o.kind === "pack" ? o.pack.kind === "experiment" ? "拆实验包" : "拆复查包" : o.kind === "choose" ? "开始一个实验" : o.kind === "reveal" ? "翻开实验卡" : o.kind === "result" ? "实验结果" : o.kind === "study" ? "研究卡" : "确认";
				return h$11("div", {
					className: "lp-codex-ov",
					onClick: (event) => {
						if (event.target === event.currentTarget && o.kind !== "pack") closeOverlay();
					}
				}, h$11("div", {
					className: "lp-codex-stage",
					ref: stage,
					role: "dialog",
					"aria-modal": true,
					"aria-label": label,
					tabIndex: -1,
					style: { top: stageTop }
				}, o.kind === "pack" ? packStage(o) : o.kind === "choose" ? h$11("div", { className: "lp-codex-ov-row" }, h$11(ExpCard, { info: optionInfo(o.option) }), h$11("div", { className: "lp-codex-ov-side" }, h$11(ChoosePanel, {
					option: o.option,
					busy,
					onStart: (answers, randomized) => {
						beginRun(o.option, null, answers, randomized);
					},
					onBack: closeOverlay
				}))) : o.kind === "reveal" ? revealStage(o) : o.kind === "result" ? resultStage(o.run) : o.kind === "study" ? studyStage(o) : h$11("div", { className: "lp-codex-box lp-codex-confirm" }, h$11("p", { className: "lp-codex-big" }, o.text), h$11("div", { className: "lp-codex-row" }, h$11(Btn, {
					tone: o.tone,
					onClick: () => {
						closeOverlay();
						o.run();
					}
				}, o.ok), h$11(Btn, {
					tone: "grey",
					onClick: closeOverlay
				}, "再想想"))), h$11(Btn, {
					tone: "grey",
					small: true,
					className: "lp-codex-ov-close",
					label: "关闭",
					onClick: closeOverlay
				}, "关闭 ×")));
			}
			function packStage(o) {
				const name = o.pack.kind === "experiment" ? "实验包" : "复查包";
				if (o.phase === "idle" || o.phase === "shake") return h$11(react.default.Fragment, null, h$11("p", { className: "lp-codex-ov-line lp-codex-big" }, name), h$11("button", {
					type: "button",
					className: cx("lp-codex-ovpack", o.phase === "idle" && anim && "lp-codex-idle", o.phase === "shake" && anim && "lp-codex-shake"),
					disabled: o.phase === "shake" || busy,
					onClick: () => {
						tearPack();
					},
					"aria-label": `拆开${name}`
				}, h$11("img", {
					src: toDataURL(pack(o.pack.kind)),
					alt: ""
				})), h$11("p", { className: "lp-codex-ov-line" }, o.pack.source_zh, h$11("br"), h$11("span", { className: "lp-codex-cap" }, "点一下拆开")));
				if (o.phase === "empty") return h$11("div", { className: "lp-codex-box lp-codex-confirm" }, h$11("p", null, o.note), h$11("div", null, h$11(Btn, {
					tone: "grey",
					onClick: closeOverlay
				}, "好")));
				if (o.pack.kind === "retest") return h$11(react.default.Fragment, null, h$11("p", { className: "lp-codex-ov-line lp-codex-big" }, "这次复查能算出的结果"), h$11("p", { className: "lp-codex-ov-line" }, "每张写明和上次相比，有没有超出平时波动。需要先看医生的结果不放在这里，在健康页上单独说。"), o.results.length === 0 ? h$11("p", { className: "lp-codex-box" }, "这次复查没有能算出的新结果。") : null, h$11("div", { className: "lp-codex-ov-row" }, ...o.results.map((card, i) => h$11("div", {
					key: card.id,
					className: cx("lp-codex-slot", !o.dealt && "lp-codex-deal"),
					"data-slot": i,
					style: { "--d": `${i * .12}s` }
				}, h$11(Card, {
					face: resultFace(card),
					family: "result",
					label: `结果卡「${card.title_zh}」`,
					flipped: o.flipped[i]
				}, ...resultCardFace(card)), h$11("div", { className: "lp-codex-slot-text" }, h$11("b", null, card.title_zh), card.value_zh ? h$11("p", { className: "lp-codex-big" }, card.value_zh) : null, h$11("p", null, card.compare_zh), card.note_zh && card.note_zh !== card.compare_zh ? h$11("p", { className: "lp-codex-cap" }, card.note_zh) : null)))), h$11("div", { className: "lp-codex-ov-actions" }, h$11(Btn, {
					tone: "green",
					onClick: closeOverlay
				}, "收好")));
				const chosen = o.options.find((row) => row.id === o.chosen) ?? null;
				const pick = (id) => setOv({
					...o,
					chosen: o.chosen === id ? null : id
				});
				if (chosen) {
					const rest = o.options.filter((row) => row.id !== chosen.id);
					return h$11(react.default.Fragment, null, h$11("p", { className: "lp-codex-ov-line lp-codex-big" }, "选这张？"), h$11("div", { className: "lp-codex-ov-row" }, h$11("div", {
						key: chosen.id,
						className: "lp-codex-slot lp-codex-picked"
					}, h$11(ExpCard, {
						info: optionInfo(chosen),
						live: true,
						onOpen: () => pick(chosen.id)
					})), h$11("div", { className: "lp-codex-ov-side" }, h$11(ChoosePanel, {
						key: chosen.id,
						option: chosen,
						busy,
						onStart: (answers, randomized) => {
							beginRun(chosen, o.pack.id, answers, randomized);
						},
						onBack: () => pick(chosen.id)
					}))), h$11("div", { className: "lp-codex-ov-row lp-codex-ov-rest" }, ...rest.map((option) => h$11("div", {
						key: option.id,
						className: cx("lp-codex-slot", "lp-codex-slot-sm", o.leaving ? "lp-codex-gone" : "lp-codex-out")
					}, h$11(ExpCard, {
						info: optionInfo(option),
						size: "s3",
						live: true,
						onOpen: () => pick(option.id)
					}))), h$11("p", { className: "lp-codex-cap lp-codex-rest-note" }, "另外两个会放进「待选」，下次可以直接开始。")));
				}
				return h$11(react.default.Fragment, null, h$11("p", { className: "lp-codex-ov-line lp-codex-big" }, "三选一"), h$11("p", { className: "lp-codex-ov-line" }, "三个小实验，都是按你的数据和方案挑的。点一张看详情；都不想做也可以，包会留着。"), h$11("div", { className: "lp-codex-ov-row" }, ...o.options.map((option, i) => h$11("div", {
					key: option.id,
					"data-slot": i,
					className: cx("lp-codex-slot", !o.dealt && "lp-codex-deal"),
					style: { "--d": `${i * .12}s` }
				}, h$11(ExpCard, {
					info: optionInfo(option),
					live: true,
					flipped: o.flipped[i],
					tilt: anim,
					onOpen: () => pick(option.id)
				}), h$11(OptionText, { option })))), h$11("div", { className: "lp-codex-ov-actions" }, h$11(Btn, {
					tone: "grey",
					onClick: closeOverlay
				}, "先不选，包留着")));
			}
			function revealStage(o) {
				const result = o.run.result;
				const done = o.phase === "done" && result;
				return h$11("div", { className: "lp-codex-ov-row" }, h$11("div", { className: "lp-codex-stack" }, h$11(ExpCard, {
					info: runInfo({
						...o.run,
						status: result ? "revealed" : o.run.status
					}),
					size: "s6",
					flipped: o.phase === "back",
					foil: Boolean(done) && !simple
				})), h$11("div", { className: "lp-codex-ov-side" }, done ? h$11("div", { className: "lp-codex-stack lp-codex-pop" }, h$11(ResultInfo, {
					run: o.run,
					result
				}), h$11("div", { className: "lp-codex-row" }, h$11(Btn, {
					tone: "green",
					onClick: () => {
						closeOverlay();
						setTab("deck");
					}
				}, "收进牌组"))) : h$11("div", { className: "lp-codex-box lp-codex-stack" }, h$11("p", { className: "lp-codex-big" }, `「${o.run.title_zh}」做完了`), h$11("p", null, "翻开看看：主要结果有没有超出你的平时波动。"), h$11("div", null, h$11(Btn, {
					tone: "gold",
					disabled: busy || o.phase !== "back",
					onClick: () => {
						turn();
					}
				}, "翻开")))));
			}
			function resultStage(run) {
				return h$11("div", { className: "lp-codex-ov-row" }, h$11(ExpCard, {
					info: runInfo(run),
					size: "s6",
					foil: !simple
				}), h$11("div", { className: "lp-codex-ov-side" }, run.result ? h$11(ResultInfo, {
					run,
					result: run.result
				}) : h$11("p", { className: "lp-codex-box" }, "这张卡还没有结果。")));
			}
			function studyStage(o) {
				const card = lib?.studies.find((row) => row.id === o.id);
				if (!card) return h$11("p", { className: "lp-codex-box" }, "这张卡不在图书馆里了。");
				const chapter = lib?.chapters.find((row) => row.id === card.chapter);
				return h$11("div", { className: "lp-codex-ov-row" }, simple ? null : h$11(Card, {
					face: studyFace(card),
					size: "s6",
					family: "study",
					label: studyLabel(card)
				}, h$11(StudyText, {
					card,
					size: "s6",
					speciesName
				})), h$11("div", { className: "lp-codex-ov-side" }, h$11(StudyInfo, {
					card,
					chapter,
					full: true,
					met: o.met,
					speciesName,
					metFace: speciesRaster
				})));
			}
		}
		//#endregion
		//#region src/client/engage/index.ts
		const h$10 = react.default.createElement;
		function CodexTab(props) {
			return h$10(CodexPage, { onNotice: typeof props.onNotice === "function" ? props.onNotice : void 0 });
		}
		registerPageTab({
			id: "codex",
			label_zh: "长寿图鉴",
			order: 35,
			Component: CodexTab
		});
		//#endregion
		//#region src/client/analysis.ts
		const h$9 = react.default.createElement;
		const VERDICT_ZH = {
			increase_beyond_noise: "升高，超出正常波动",
			decrease_beyond_noise: "降低，超出正常波动",
			within_noise: "在正常波动内"
		};
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
			const [brief, setBrief] = react.default.useState(null);
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
				const timer = setInterval(() => {
					if (typeof document === "undefined" || document.visibilityState !== "hidden") load();
				}, 15e3);
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
				notice(on ? "已开启自动深度分析：有新数据时，LongPi 将自动开始分析。" : "已关闭自动深度分析：仅在关键时间点征求你的意见。", "info");
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
			const openBrief = () => act("brief", async () => {
				const answer = await postJson("/api/longpi/brief", {});
				if (!answer.ok) throw new Error(answer.error || "生成失败");
				setBrief(answer);
			}, "简报生成失败");
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
			}, h$9("div", { className: "lp-card lp-an-prose" }, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, "关于深度分析")), h$9("p", { className: "lp-text lp-muted" }, "根据全基因组、甲基化、肠道菌、蛋白组和体检数据，估算生物学年龄、各器官状况和未来的疾病风险，提出针对性问题并逐一查证，最后给出一份可执行的方案。分析在对话中进行；也可随时在对话中直接发起。"), h$9(Switch, {
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
			}), h$9("div", { className: "lp-callout-body" }, `注意：${t(status.cost_zh)}，会消耗大量 token。开启后，有新的体检、化验或检测文件时，LongPi 会自动判断并开始分析（同一人两次自动分析至少间隔 30 天）；关闭时（默认），仅在关键时间点征求你的意见，经你同意后才开始。此开关对你和家人均生效。`))), h$9(StatusCard, {
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
			}, h$9("span", { className: "lp-strong" }, t(i.title)), i.detail ? h$9("span", { className: "lp-muted" }, t(i.detail)) : null, i.markers.length ? h$9("span", { className: "lp-caption" }, `复测指标：${i.markers.map(t).join("、")}`) : null))) : h$9("p", { className: "lp-muted" }, "这份方案里没有条目。"), back.warnings.length ? h$9("div", { className: "lp-callout lp-callout-warn" }, h$9(Icon, {
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
			}), `已保存为第 ${t(cur.plan_accepted_version)} 版`) : h$9("span", { className: "lp-caption" }, "确认后才生效"), cur.plan_accepted_version ? null : h$9(Btn$1, {
				onClick: () => {
					accept(back);
				},
				disabled: disabled || !back.ok
			}, "我已阅读，接受方案")))) : null, cur?.doctor_items?.length ? h$9(Section, { title: "交给医生的事项" }, h$9("div", { className: "lp-card" }, h$9("p", { className: "lp-caption" }, "补剂、检查和转诊由医生决定，不放进方案打卡；它们会写进医生简报。"), h$9("ul", { className: "lp-rows" }, ...cur.doctor_items.map((i, n) => h$9("li", {
				key: n,
				className: "lp-row lp-row-stack"
			}, h$9("span", null, h$9("span", { className: "lp-badge lp-badge-neutral" }, t(i.kind_zh)), " ", h$9("span", { className: "lp-strong" }, t(i.title))), i.detail && i.detail !== i.title ? h$9("span", { className: "lp-muted" }, t(i.detail)) : null))), h$9("div", { className: "lp-card-foot" }, h$9(Btn$1, {
				variant: "outline",
				onClick: () => {
					openBrief();
				},
				disabled
			}, busy === "brief" ? "正在整理…" : "医生简报（可打印）")))) : null, cur?.compare ? h$9(Section, { title: "和上次深度分析相比" }, h$9(CompareCard, { compare: cur.compare })) : null, brief ? h$9(BriefModal, {
				answer: brief,
				onClose: () => setBrief(null)
			}) : null);
		}
		/** The two analyses side by side: only a change beyond the reference change value is a change. */
		function CompareCard(props) {
			const c = props.compare;
			if (!c.ok) return h$9("div", { className: "lp-card" }, h$9("p", { className: "lp-muted" }, t(c.error_zh)));
			const beyond = c.rows.filter((r) => r.verdict !== "within_noise");
			const within = c.rows.filter((r) => r.verdict === "within_noise");
			const since = c.prev_sample_date || c.prev_imported_at;
			return h$9("div", { className: "lp-card" }, ...c.alerts.map((a, i) => h$9("div", {
				key: `a${i}`,
				className: "lp-callout lp-callout-bad",
				role: "alert"
			}, h$9(Icon, {
				name: "warn",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, t(a)))), h$9("p", { className: "lp-caption" }, `与${since ? ` ${dateZh(t(since))} 的` : "上一次"}分析比较。超出个人正常波动（参考变化值）才算真实变化；在波动内的还看不出变化。`), beyond.length ? h$9("ul", { className: "lp-rows" }, ...beyond.map((r, i) => h$9("li", {
				key: i,
				className: "lp-row lp-row-stack"
			}, h$9("span", null, h$9("span", { className: "lp-strong" }, t(r.marker)), " ", h$9("span", { className: "lp-num" }, `${t(r.prev)} → ${t(r.cur)}${r.unit ? ` ${t(r.unit)}` : ""}`)), h$9("span", { className: "lp-caption" }, `${VERDICT_ZH[r.verdict] ?? t(r.verdict)}${r.change_pct !== null ? `（${r.change_pct > 0 ? "+" : "−"}${num(Math.abs(r.change_pct))}%）` : ""}`), r.caveat ? h$9("span", { className: "lp-caption lp-warn-ink" }, t(r.caveat)) : null))) : h$9("p", { className: "lp-muted" }, "没有超出正常波动的变化。"), h$9("p", { className: "lp-small lp-muted" }, [within.length ? `${within.length} 项在正常波动内（${within.slice(0, 6).map((r) => t(r.marker)).join("、")}${within.length > 6 ? " 等" : ""}）` : "", c.not_judged ? `${c.not_judged} 项没有个人波动数据或条件不足，只能并排看，不判断变好变坏` : ""].filter(Boolean).join("；")));
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
				return h$9("div", { className: "lp-card lp-an-prose" }, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, running ? "分析进行中" : "上次分析未完成"), folded ? null : h$9("span", {
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
				}) : null), h$9("span", null, s.label_zh, s.done ? h$9("span", { className: "lp-sr" }, "（已完成）") : null)))), running && run.reason_zh ? h$9("p", { className: "lp-small lp-muted" }, `${run.trigger === "ai" ? "LongPi 发起" : "你发起"}：${t(run.reason_zh)}`) : null, running ? null : h$9("p", { className: "lp-small lp-muted" }, "可回到原对话输入「继续」，或放弃后重新发起。"), run.state_error ? h$9("div", { className: "lp-callout lp-callout-warn" }, h$9(Icon, {
					name: "warn",
					size: 16
				}), h$9("div", { className: "lp-callout-body" }, t(run.state_error))) : null, ready ? h$9("div", { className: "lp-callout lp-callout-good" }, h$9(Icon, {
					name: "check",
					size: 16
				}), h$9("div", { className: "lp-callout-body" }, "另有一份分析已完成，可以先导入。", h$9("div", null, h$9(Btn$1, {
					onClick: () => props.onImport(ready.id),
					disabled
				}, "导入结果")))) : null, h$9("div", { className: "lp-card-foot" }, h$9("span", { className: "lp-caption" }, running ? "每 15 秒自动刷新" : ""), h$9(Btn$1, {
					variant: "outline",
					onClick: () => props.onAbandon(run.id),
					disabled
				}, "放弃这次分析")));
			}
			if (ready) return h$9("div", {
				className: "lp-card lp-an-prose",
				role: "status"
			}, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, "有一份新的分析已完成")), h$9("p", { className: "lp-text lp-muted" }, "导入后可在此查看报告、器官体检表和方案。"), h$9("div", { className: "lp-card-foot" }, h$9("span", { className: "lp-caption" }, "导入后，报告和问题看板会显示在下面。"), h$9(Btn$1, {
				onClick: () => props.onImport(ready.id),
				disabled
			}, "导入结果")));
			const blocked = status.blockers;
			if (blocked) return h$9("div", {
				className: "lp-card lp-an-prose",
				role: "status"
			}, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, "暂时无法进行")), h$9("div", { className: "lp-callout lp-callout-warn" }, h$9(Icon, {
				name: "info",
				size: 16
			}), h$9("div", { className: "lp-callout-body" }, t(blocked.reply_zh))));
			const readiness = status.readiness;
			if (!readiness) return null;
			return h$9("div", {
				className: "lp-card lp-an-prose",
				role: "status"
			}, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, readiness.auto_on ? "LongPi 的判断" : "当前状态")), h$9("p", { className: "lp-text" }, t(readiness.why_zh) || "现在没有进行中的分析。"), readiness.folder ? h$9("p", { className: "lp-caption" }, `检测文件夹：${t(readiness.folder)}（只读）`) : null);
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
			return h$9("article", { className: "lp-card lp-an-prose" }, h$9("div", { className: "lp-card-head" }, h$9("h3", { className: "lp-h3" }, `${t(b.id)} ${t(b.title_zh)}`.trim()), conf ? h$9("span", { className: `lp-badge ${conf === "低" ? "lp-badge-warn" : "lp-badge-neutral"}` }, `可信度：${conf}`) : null), h$9("p", { className: "lp-text" }, lead || "暂无结论。"), more || limits ? h$9("details", null, h$9("summary", null, limits ? "证据与局限" : "证据"), h$9("div", { className: "lp-an-more" }, more ? h$9("p", { className: "lp-text lp-muted" }, more) : null, limits ? h$9("p", { className: "lp-text lp-muted" }, `局限：${limits}`) : null)) : null, next ? h$9("p", { className: "lp-an-next" }, h$9("span", { className: "lp-muted" }, "下一步："), next) : null);
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
			}))), h$8("p", { className: "lp-muted lp-small" }, view.can_create_in_mirobody ? "将为家人建立独立档案，家人无需单独注册。家人的体检、方案和深度分析都和你的分开。" : view.create_hint_zh.trim()), h$8("div", { className: "lp-form-grid" }, input("label_zh", "称呼", {
				placeholder: "如 爸爸、妈妈",
				autoFocus: true
			}), input("birth_year", "出生年份", {
				inputMode: "numeric",
				placeholder: "例如 1960"
			}), input("name", "姓名", { autoComplete: "off" }, "报告上的真实姓名，用于核对上传的报告是否属于本人", true), h$8("div", {
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
			})), view.can_create_in_mirobody || !manualConnectionAllowed() ? null : input("mcp_url", "家人的健康数据服务个人链接（选填）", {}, "", true)), error ? h$8("div", {
				className: "lp-callout lp-callout-warn",
				role: "alert"
			}, h$8(Icon, {
				name: "warn",
				size: 14
			}), h$8("span", { className: "lp-callout-body" }, error)) : null, h$8("div", { className: "lp-modal-actions" }, h$8(Btn$1, {
				type: "button",
				variant: "outline",
				onClick: props.onClose,
				disabled: busy
			}, "取消"), h$8(Btn$1, {
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
			}, "当前查看的档案"), h$8("select", {
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
			}), h$8("div", { className: "lp-callout-body" }, h$8("p", { className: "lp-callout-title" }, "你在看示例档案"), h$8("p", null, `${shown.name}（虚构人物，58 岁）完整使用 LongPi 后的样子：两次体检、手环数据、一次深度分析和执行了三周的方案。数据都是合成的，不对应任何真实的人。`), h$8("p", { className: "lp-caption" }, "可在此随意操作，改动不会保存，下次打开时恢复原样。查看完毕后，请在右上角切换回「我」。")));
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
			}), h$8("div", { className: "lp-callout-body" }, h$8("p", null, "想了解档案完整后，LongPi 能为你做什么？"), h$8("button", {
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
				key: "codex",
				label: "长寿图鉴"
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
			if (saved && (TABS.some((tab) => tab.key === key) || extra.includes(key) || key === "plan" || key === "profile" || key === "codex" || key === "science")) return key;
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
			}, h$7("div", { className: "lp-strong" }, "LongPi 未能读取数据"), h$7("p", { className: "lp-muted" }, `服务返回：${props.error}。通常是刚启动所致，请稍等几秒后重试。`), h$7(Btn$1, {
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
			const introSeen = useIntroSeen();
			const introHandled = react.default.useRef(false);
			react.default.useEffect(() => {
				if (introHandled.current || introSeen === null || !journey) return;
				introHandled.current = true;
				if (introSeen) return;
				markIntroSeen();
				if (stepsLeft(journey) > 0) setOnboarding(true);
			}, [introSeen, journey]);
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
				const opened = props.openChat?.();
				if (opened instanceof Promise) {
					opened.then((ok) => {
						if (ok) return;
						takePendingPrompt();
						copying.then((copied) => notify(copied ? "未能打开「健康对话」，问题已复制。请在左侧工作区打开「健康对话」后粘贴发送。" : "未能打开「健康对话」。请在左侧工作区打开「健康对话」后提问。", "bad"));
					});
					return;
				}
				if (props.openChat) return;
				copying.then((copied) => notify(copied ? "已复制，请粘贴到对话中发送。" : text, "info"));
			};
			let body;
			if (!journey && loading) body = h$7(Loading);
			else if (!journey) body = h$7(Failed, {
				error: error ?? "未返回数据",
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
					onPrompt
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
			}), h$7(PersonNotice), h$7(DemoInvite, { empty: Boolean(journey) && (journey?.records.indicator_count ?? 0) === 0 }), notice ? h$7("div", { className: "lp-notice-slot" }, notice) : null, journey ? h$7(SeasonBar, { onOpen: () => setTab("codex") }) : null, body, h$7("footer", { className: "lp-footer" }, h$7("p", { className: "lp-caption" }, `${journey?.boundary_zh || "模型估计，不是诊断或用药建议，也不代表预期寿命。紧急情况请拨打 120。"} 档案和记录只保存在这台电脑上；你同意后，提问时相关健康数值才会发送给 DeepSeek 模型。`))), onboarding ? h$7(Onboarding, {
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
		const EXPLAIN_KEY = "dsh-plugin-longpi.pane-explained";
		/** How long 显示 keeps the numbers open (design §2.2). */
		const SHOW_MS = 6e4;
		/**
		* Personal numbers, indicator names and diagnosis words stay folded in the pane until 显示 (60 s, and folded at once
		* when the window loses focus or the tab is hidden): a browser cannot see a system screen share, and an unplanned
		* meeting is not on any calendar. The full 健康 page, which the person opens themselves, shows everything.
		*/
		function useShown(visible) {
			const [until, setUntil] = react.default.useState(0);
			const [, tick] = react.default.useState(0);
			react.default.useEffect(() => {
				if (until === 0) return void 0;
				const left = until - Date.now();
				if (left <= 0) {
					setUntil(0);
					return;
				}
				const timer = window.setTimeout(() => {
					setUntil(0);
					tick((n) => n + 1);
				}, left);
				return () => window.clearTimeout(timer);
			}, [until]);
			react.default.useEffect(() => {
				const fold = () => setUntil(0);
				const onVisibility = () => {
					if (document.visibilityState === "hidden") fold();
				};
				window.addEventListener("blur", fold);
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					window.removeEventListener("blur", fold);
					document.removeEventListener("visibilitychange", onVisibility);
				};
			}, []);
			react.default.useEffect(() => {
				if (!visible) setUntil(0);
			}, [visible]);
			return [
				until > Date.now(),
				() => setUntil(Date.now() + SHOW_MS),
				() => setUntil(0)
			];
		}
		function PaneTabVisible(props) {
			const visible = props.useTabInfo((info) => info.tab?.visible !== false);
			return props.children(visible);
		}
		function HealthPane(props) {
			if (typeof props.useTabInfo === "function") return h$6(PaneTabVisible, {
				useTabInfo: props.useTabInfo,
				children: (visible) => h$6(PaneBody, {
					...props,
					visible
				})
			});
			return h$6(PaneBody, {
				...props,
				visible: true
			});
		}
		function PaneBody(props) {
			const { journey, loading, error, refresh } = useJourney();
			const tracking = useTracking();
			const [notice, notify] = useNotice();
			const slot = useSlot();
			const [open, show, fold] = useShown(props.visible);
			const [explain] = react.default.useState(() => {
				const seen = Number(readPref(EXPLAIN_KEY) ?? "0");
				writePref(EXPLAIN_KEY, String(seen + 1));
				return seen < 3;
			});
			const root = react.default.useRef(null);
			usePaneShown(root);
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
			}, h$6("p", { className: "lp-muted" }, `未能读取数据：${error ?? "未返回数据"}。`), h$6(Btn$1, {
				variant: "outline",
				onClick: () => {
					refresh(true);
				}
			}, h$6(Icon, {
				name: "refresh",
				size: 14
			}), "重试"));
			else if (slot.presentation) body = h$6("div", {
				className: "lp-card lp-pane-mask",
				role: "status"
			}, h$6("p", { className: "lp-pane-mask-text" }, "演示模式中"));
			else if (!open) body = h$6("div", { className: "lp-card lp-pane-mask" }, h$6("p", { className: "lp-pane-mask-text" }, slot.pane_neutral_zh ?? "已收起"), explain ? h$6("p", { className: "lp-caption" }, "这里默认收起，投屏时不露出健康信息。点「显示」展开 60 秒。") : null, h$6("div", { className: "lp-actions" }, h$6(Btn$1, {
				size: "sm",
				variant: "outline",
				onClick: show
			}, "显示")));
			else body = h$6(react.default.Fragment, null, h$6("div", { className: "lp-pane-shown" }, h$6("span", { className: "lp-caption" }, "60 秒后自动收起"), h$6("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: fold
			}, "收起")), h$6(Overview, {
				journey,
				tracking: tracking.data,
				onNotice: notify,
				onAction,
				goTab: toPage,
				openOnboarding: () => toPage("overview")
			}));
			const openCodex = () => toPage("codex");
			return h$6("div", {
				className: "lp lp-pane",
				ref: root
			}, h$6("div", { className: "lp-pane-head" }, h$6("h2", { className: "lp-h3 lp-pane-title" }, h$6(Icon, {
				name: "health",
				size: 14
			}), PANE_TITLE), props.openPage ? h$6("button", {
				type: "button",
				className: "lp-textbtn",
				onClick: props.openPage
			}, "打开健康页 →") : null), h$6(PaneSlot, { openCodex }), notice && open ? h$6("div", { className: "lp-notice-slot" }, notice) : null, body, open ? h$6("p", { className: "lp-caption lp-pane-foot" }, journey?.boundary_zh || "模型估计，不是诊断或用药建议，也不代表预期寿命。紧急情况请拨打 120。") : null);
		}
		//#endregion
		//#region src/client/pill.ts
		const h$5 = react.default.createElement;
		const HIDE_KEY = "dsh-plugin-longpi.pill-hidden-on";
		/** '1' when the person turned the evening pill on. */
		const PILL_ON_KEY = "dsh-plugin-longpi.pill-on";
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
			const slot = useSlot();
			const on = readPref(PILL_ON_KEY) === "1";
			const open = journey ? journey.plan.checkin_items.filter((item) => checkStateOf(journey, item.id) === null) : [];
			if (!on || slot.presentation || !journey || open.length === 0 || !evening || dismissed || props.pageShowing || heroShowing) return null;
			const summary = open.map((item) => item.title).join("、");
			return h$5("div", {
				className: "lp lp-pill-wrap",
				role: "status"
			}, h$5("button", {
				type: "button",
				className: "lp-pill-main",
				onClick: () => props.openPage?.(),
				title: summary,
				"aria-label": `LongPi：今天还有 ${open.length} 项未打卡：${summary}。打开健康页`
			}, h$5("span", { className: "lp-pill-mark" }, h$5(Mark, { size: 14 })), h$5("span", null, "LongPi · 今天还有 ", h$5("span", { className: "lp-pill-count" }, open.length), " 项未打卡")), h$5("button", {
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
			return hit ? `${hit[0]}的时间 ${hit[1]} 处于免打扰时段（${form.quietStart}–${form.quietEnd}）中午夜之前的部分，当天将无法发送；请调整时间或免打扰时段。` : null;
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
			}, "没有可用的渠道：请开启桌面通知或填写 Webhook 后重试。");
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
				if (!result.ok) throw new Error(result.error || "保存失败");
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
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
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
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
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
					setError(`测试消息发送失败：${errorText(err, "请稍后再试")}`);
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
			}), h$4("span", { className: "lp-caption" }, settings.enabled ? hasChannel ? nextLine(data) : "已开启，但暂无可用渠道：请开启桌面通知或填写 Webhook。" : "关闭时不会发送任何提醒。开启后按下面的时间提醒打卡、到期复测和每周小结。")), h$4("div", { className: "lp-grid-2 lp-followup-grid" }, h$4("fieldset", { className: "lp-fieldset" }, h$4("legend", { className: "lp-followup-legend" }, "什么时候"), h$4("div", { className: "lp-followup-times" }, h$4(TimeField, {
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
			}, "Webhook 渠道", h$4("span", { className: "lp-optional" }, "选填：发送到手机上的群机器人或 App")), h$4("select", {
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
			}, "签名密钥", h$4("span", { className: "lp-optional" }, "仅在机器人开启「加签」时需要")), h$4("div", { className: "lp-input-unit" }, h$4("input", {
				id: "lp-fu-secret",
				type: "password",
				className: "lp-input",
				value: form.secret,
				autoComplete: "new-password",
				placeholder: storedSame && settings.webhook?.secret_set ? form.clearSecret ? "保存后清除" : "已设置（留空保持不变）" : "选填",
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
			}, error) : null, h$4("div", { className: "lp-form-actions" }, h$4(Btn$1, {
				onClick: () => {
					save();
				},
				disabled: !dirty || saving
			}, saving ? "保存中…" : "保存设置"), h$4(Btn$1, {
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
			const where = channels.length > 0 ? channels.join("和") : data.platform_desktop ? "桌面通知" : "（暂无可用渠道，请在「更多设置」中填写 Webhook）";
			const what = settings.detail === "minimal" ? "不含健康数值" : "含方案项目名称和执行率";
			return `当天有未完成的打卡时，${settings.checkin_time} 通过${where}提醒；${what}。`;
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
					if (!result.ok) throw new Error(result.error || "保存失败");
					if (result.settings) putFollowup(result);
					notifyChanged();
					props.onNotice(done, "good");
				} catch (err) {
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
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
		/** The Codex sends no reminder of its own (docs/codex-design.md §2): one prompt slot while working, set in the Codex. */
		function SeasonNote(_props) {
			return h$4("div", { className: "lp-callout lp-callout-info" }, h$4(Icon, {
				name: "info",
				size: 14
			}), h$4("div", { className: "lp-callout-body" }, h$4("p", null, "长寿图鉴不发送提醒。工作时它只占右侧健康栏的一个提示位（起身提醒和揭晓通知），可以在图鉴的设置里关掉。")));
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
			}), h$4(SeasonNote, { enabled: data.settings.enabled }), h$4("details", null, h$4("summary", null, "更多设置", h$4("span", { className: "lp-optional" }, "复测提醒、每周小结、免打扰、发送到飞书或手机、内容详略")), h$4(Settings, {
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
					props.onNotice(`计算未完成：${errorText(err, "请稍后再试")}`, "bad");
				} finally {
					setRunning(false);
				}
			}
			return h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "可用现有记录计算")), ready.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "还没有能直接计算的方法。") : h$3("ul", { className: "lp-rows" }, ...ready.slice(0, 8).map((row) => h$3("li", {
				key: row.name,
				className: "lp-row lp-row-stack"
			}, h$3("span", { className: "lp-strong" }, row.blurb || row.name), h$3("span", { className: "lp-caption" }, row.domain || row.name)))), ready.length > 8 ? h$3("p", { className: "lp-caption lp-measure" }, `另有 ${ready.length - 8} 项`) : null, ready.length > 0 ? h$3("div", { className: "lp-actions" }, h$3(Btn$1, {
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
					setError(`匹配失败：${errorText(err, "请稍后再试")}`);
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
			}), h$3(Btn$1, {
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
			}, h$3("p", { className: "lp-caption lp-measure" }, `方法库 ${board.skills?.version ?? ""} · ${board.readiness?.declared ?? 0} 个个人方法。在对话中同样可以使用。`), h$3("div", { className: "lp-grid-2 lp-grid-top" }, h$3(RunReady, {
				board,
				onNotice: props.onNotice
			}), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "再测一项即可解锁")), unlock.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "没有只差一项的方法。") : h$3("ul", { className: "lp-rows" }, ...unlock.slice(0, 8).map((row) => h$3("li", {
				key: row.item,
				className: "lp-row"
			}, h$3("span", { className: "lp-strong" }, row.item), h$3("span", { className: "lp-caption" }, `解锁 ${row.skills.length} 个方法`)))))), h$3("div", { className: "lp-grid-2 lp-grid-top" }, h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "用药计划"), h$3("span", { className: "lp-caption" }, "只读，来自健康数据服务的用药计划")), meds.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "未读取到用药计划。") : h$3("ul", { className: "lp-rows" }, ...meds.map((row) => h$3("li", {
				key: row.name,
				className: "lp-row"
			}, h$3("span", null, row.name), h$3("span", { className: "lp-caption" }, row.status ?? ""))))), h$3("div", { className: "lp-card" }, h$3("div", { className: "lp-card-head" }, h$3("h3", { className: "lp-card-title" }, "最近结果")), readouts.length === 0 ? h$3("p", { className: "lp-small lp-muted lp-measure" }, "尚未计算。") : h$3("ul", { className: "lp-rows" }, ...readouts.slice(0, 8).map((row) => h$3("li", {
				key: row.key,
				className: "lp-row"
			}, h$3("span", null, row.label_zh || row.key), h$3("span", { className: "lp-row-end" }, h$3("span", { className: "lp-num" }, `${typeof row.value === "number" ? fmt$1(row.value, 2) : row.value ?? ""} ${row.unit && row.unit !== "1" ? row.unit === "a" || row.unit === "yr" ? "岁" : row.unit : ""}`), h$3("span", { className: "lp-caption" }, chineseDate(row.measured_at || row.at || "")))))))), h$3(Search, { board }));
		}
		//#endregion
		//#region src/client/settings-page.ts
		const h$2 = react.default.createElement;
		/** Registered settings sections this page covers itself (研究 is the 一起研究 block). */
		const PLACED = /* @__PURE__ */ new Set(["science"]);
		/** The evening pill for open check-ins (bottom right, after 18:00). Off unless turned on here. */
		function PillSwitch() {
			const [on, setOn] = react.default.useState(() => readPref(PILL_ON_KEY) === "1");
			return h$2("div", { className: "lp-set-row" }, h$2(Switch, {
				id: "lp-set-pill",
				checked: on,
				label: "晚上 6 点后，在右下角提示还没打卡的项目",
				onChange: (next) => {
					writePref(PILL_ON_KEY, next ? "1" : "0");
					setOn(next);
				}
			}));
		}
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
				postJson("/api/longpi/science/preference", { mode: next }).then(() => setMode(next)).catch(() => setError("保存失败，请稍后再试。")).finally(() => setBusy(false));
			};
			return h$2("div", { className: "lp-set-body" }, h$2(Switch, {
				id: "lp-set-science-on",
				checked: mode === "local",
				busy,
				disabled: busy,
				label: "在这台电脑上参与研究",
				onChange: (next) => set(next ? "local" : "off")
			}), h$2("p", { className: "lp-set-text lp-muted" }, "开启后，可使用研究页、个人对照和本地统计，数据仅保存在这台电脑上。关闭后以上功能停止。未满 18 岁时始终关闭。"), error ? h$2("p", {
				className: "lp-form-error",
				role: "alert"
			}, error) : null, h$2("a", {
				className: "lp-textbtn",
				href: "/api/longpi/science/community?view=page"
			}, "打开研究页 →"));
		}
		function Privacy() {
			return h$2("div", { className: "lp-set-body" }, h$2("dl", { className: "lp-kv lp-set-kv" }, ...[
				["存储位置", "档案、方案、记录、自测和提醒只保存在这台电脑上。体检和手环原始数据保存在健康数据服务中，LongPi 只读取。"],
				["哪些内容会发送给模型", "与 LongPi 对话时，经你同意，你的问题以及回答所需的档案和化验数据才会发送给 DeepSeek 模型（默认）。不对话则不发送。"],
				["发送到手机", "默认关闭，仅在你自行配置后发送。默认不含项目名称和健康数值；选择「详细」后会带上项目名称、执行率和复测指标。"]
			].flatMap(([title, text]) => [h$2("dt", { key: `t:${title}` }, title), h$2("dd", { key: `d:${title}` }, text)])), h$2("div", { className: "lp-actions" }, h$2(LinkButton, {
				href: "/api/longpi/report",
				icon: "download",
				download: "longpi-report.md"
			}, "导出报告")));
		}
		function Connection() {
			const { data } = useConnection();
			return h$2("div", { className: "lp-set-body" }, data ? h$2(ConnectionStatus, { connection: data }) : null, reconnectOffer(data).show ? h$2(ReconnectAction, { confirm: reconnectOffer(data).confirm }) : null, manualConnectionAllowed() ? h$2("details", null, h$2("summary", null, "手动连接（安装人员使用）"), h$2(ConnectionPanel, {
				idPrefix: "lp-set-conn",
				hideStatus: true
			})) : null);
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
				hint: "默认关闭。关闭此窗口后不会发送提醒。"
			}, h$2(FollowupPanel, { onNotice: notify }), h$2(PillSwitch)), h$2(Block, {
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
.lp-conn-reconnect { display: grid; gap: 6px; margin-top: 8px; }
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

/* --- first-run welcome (shell overlay) and the sidebar dot ------------------------------------------- */
/* Next to the sidebar's 健康 entry; no mask, the rest of DSH stays usable. */
.lp-intro-card {
  position: absolute; left: 284px; top: 112px; z-index: 2; pointer-events: auto; width: min(340px, calc(100vw - 300px));
  display: grid; gap: 8px; padding: 16px; border-radius: var(--lp-radius-card); background: var(--lp-layer-2);
  box-shadow: var(--lp-shadow-pop); animation: lp-fade .2s ease both;
}
.lp-intro-card::before { content: ""; position: absolute; left: -6px; top: 22px; width: 12px; height: 12px; background: var(--lp-layer-2); transform: rotate(45deg); box-shadow: -1px 1px 0 0 var(--lp-line); }
.lp-intro-head { display: flex; align-items: center; gap: 8px; }
.lp-intro-title { margin: 0; flex: 1; font-size: 15px; line-height: 22px; font-weight: 600; }
.lp-intro-x { width: 28px; height: 28px; }
.lp-intro-text { margin: 0; font-size: 13px; line-height: 20px; color: var(--lp-ink-2); }
.lp-intro-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.lp-intro-icon { position: relative; display: inline-flex; color: inherit; font-size: inherit; line-height: inherit; }
.lp-intro-dot { position: absolute; top: -2px; right: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--lp-bad); box-shadow: 0 0 0 2px var(--lp-bg); }

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

/* --- the prompt slot (docs/codex-design.md §2): DSH's own look, 13 px, no dot, no motion, never takes focus ---- */
.lp-slot { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-slot-text { min-width: 0; }
.lp-slot-actions { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; }
.lp-slot-pane { padding: 8px 12px; border-radius: var(--lp-radius-card); background: var(--lp-well); }
.lp-slot-wrap {
  position: absolute; right: 20px; bottom: 136px; z-index: 1; pointer-events: auto; max-width: min(420px, calc(100vw - 40px));
  padding: 4px 4px 4px 12px; border-radius: var(--lp-radius-card); background: var(--lp-layer-2); box-shadow: var(--lp-shadow-pop);
}
.lp-slot-bar { min-height: 32px; }
/* 演示模式 at DSH's sidebar foot. */
.lp-present-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: var(--lp-radius-ctl);
  background: transparent; color: var(--lp-ink-2); font: inherit; font-size: 12px; line-height: 16px; cursor: pointer;
}
.lp-present-btn:hover { background: var(--lp-hover); color: var(--lp-ink); }
.lp-present-on { background: var(--lp-well); color: var(--lp-ink); }
/* The pane folds personal numbers by default (§2.2). */
.lp-pane-mask { display: grid; gap: 8px; }
.lp-pane-mask-text { margin: 0; font-size: 13px; line-height: 20px; color: var(--lp-ink); }
.lp-pane-shown { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lp-set-row { margin-top: 8px; }
`,
			`
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
.lp-codex .lp-codex-slot.lp-codex-out { opacity: .3; transform: translateY(12px); }
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
						setError(`保存失败：${result.error}`);
						return;
					}
					setAdopted(props.call.callId, result.version);
					setConfirming(false);
				} catch (err) {
					setError(`保存失败：${errorText(err, "请稍后再试")}`);
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
			const names = undoable.map((row) => `${String(row.title || row.item)}${row.done === false ? "（未完成）" : ""}`).join("、");
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
					setError(`撤销失败：${errorText(err, "请稍后再试")}`);
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
			}, "继续调整")) : null, match.saved ? h$1("span", { className: "lp-badge lp-badge-good" }, h$1(Icon, {
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
			return h(IntroDot, null, h(Icon, {
				name: "health",
				size: props.size ?? 18
			}));
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
				openChat: () => openHealthChat()
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
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "longpi-codex-slot",
				order: 45,
				inject: face
			}, CodexOverlay));
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "longpi-presentation",
				order: 50
			}, PresentationButton));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "longpi-intro",
				order: 40,
				inject: face
			}, IntroCard));
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
				ctx.inject(["slots"], (sub) => {
					sub.effect?.(() => () => stopTimers(), "longpi: store timers");
					sub.effect?.(() => installActivity(), "longpi: activity clock");
					sub.effect?.(() => installPresentationShortcut(), "longpi: presentation shortcut");
				});
				ctx.inject(["commandUi"], (sub) => {
					const commands = sub.commandUi;
					if (commands?.register) sub.effect?.(() => commands.register(presentationCommand()), "longpi: /演示模式");
				});
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