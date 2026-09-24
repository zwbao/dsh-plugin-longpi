import Schema from "@deepseek-ai/schemastery";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/config.ts
const Config = Schema.object({
	skillsHome: Schema.string().default(""),
	mirobodyPluginHome: Schema.string().default(""),
	pythonBin: Schema.string().default(""),
	mirobodyHome: Schema.string().default(""),
	mcpUrl: Schema.string().default(""),
	mcpToken: Schema.string().default(""),
	member: Schema.string().default(""),
	timeoutMs: Schema.number().default(3e4),
	skillPython: Schema.string().default(""),
	skillTimeoutMs: Schema.number().default(12e4),
	dataDir: Schema.string().default(""),
	maxSkillMatches: Schema.number().default(8),
	skillRuntimes: Schema.dict(Schema.string()).default({}),
	skillsVersion: Schema.string().default("")
});
//#endregion
//#region src/catalog.ts
const NAME = /^[a-z0-9][a-z0-9-]*$/;
function parseFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) throw new Error("SKILL.md missing frontmatter");
	const fm = match[1] ?? "";
	const body = match[2] ?? "";
	const name = fm.match(/^name:\s*['"]?([a-z0-9][a-z0-9-]*)['"]?\s*$/m)?.[1];
	if (!name) throw new Error("SKILL.md missing name");
	const description = readDescription(fm);
	if (!description) throw new Error(`${name}: SKILL.md missing description`);
	return {
		name,
		description,
		body
	};
}
function readDescription(fm) {
	const lines = fm.split(/\r?\n/);
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (/^description:\s*(>-|[>|])\s*$/.test(line)) {
			const block = [];
			for (let inner = index + 1; inner < lines.length; inner += 1) {
				const next = lines[inner] ?? "";
				if (next.trim() !== "" && !/^\s/.test(next)) break;
				if (next.trim() === "") continue;
				block.push(next.trim());
			}
			return block.join(" ").replace(/\s+/g, " ").trim();
		}
		const inline = line.match(/^description:\s*(.+)\s*$/);
		if (inline?.[1]) return inline[1].replace(/^['"]|['"]$/g, "").trim();
	}
	return "";
}
function parseReadme(raw) {
	const map = /* @__PURE__ */ new Map();
	let domain = "未归类";
	for (const line of raw.split(/\r?\n/)) {
		const heading = line.match(/^##\s+(.+?)\s*$/);
		if (heading?.[1]) {
			domain = heading[1].trim();
			continue;
		}
		const bullet = line.match(/^- `skills\/([a-z0-9-]+)\/`\s+[—-]\s+(.+)\s*$/);
		if (bullet?.[1] && bullet[2] && !map.has(bullet[1])) map.set(bullet[1], {
			domain,
			blurb: bullet[2].trim()
		});
	}
	return map;
}
function findScript(skillDir, body) {
	const standard = join(skillDir, "scripts", "personal_report.py");
	if (existsSync(standard)) return standard;
	const mentioned = body.match(/scripts\/([A-Za-z0-9._-]+\.py)/);
	if (!mentioned?.[1]) return null;
	const candidate = join(skillDir, "scripts", mentioned[1]);
	return existsSync(candidate) ? candidate : null;
}
function leadOf(body) {
	return (body.replace(/^#[^\n]*\n/, "").split(/\n## /)[0] ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
}
function gitRevision(home) {
	const result = spawnSync("git", [
		"-C",
		home,
		"rev-parse",
		"--short",
		"HEAD"
	], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : "";
}
function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}
function scriptOf(dir, entry, body) {
	if (entry?.script && /^scripts\/[A-Za-z0-9._-]+\.py$/.test(entry.script)) {
		const path = join(dir, entry.script);
		return existsSync(path) ? path : null;
	}
	return findScript(dir, body);
}
function cardFrom(dir, name, data, skillMd) {
	let parsed;
	try {
		parsed = parseFrontmatter(skillMd);
	} catch {
		return null;
	}
	const domains = data.domains?.length ? data.domains : ["未归类"];
	return {
		name,
		description: data.description || parsed.description,
		domain: domains[0] ?? "未归类",
		domains,
		blurb: data.blurb_zh ?? "",
		lead: leadOf(parsed.body),
		script: scriptOf(dir, data.entry, parsed.body),
		kind: data.kind ?? "paper",
		tier: data.tier ?? "",
		species: data.species ?? [],
		intents: data.intents ?? [],
		inputsStatus: data.inputs_status ?? "none",
		inputs: data.inputs ?? [],
		outputs: data.outputs ?? [],
		entry: data.entry ?? null,
		paper: data.paper ? {
			doi: data.paper.doi,
			title_zh: data.paper.title_zh,
			journal: data.paper.journal,
			year: data.paper.year
		} : null
	};
}
function legacyCard(dir, name, meta, skillMd) {
	let parsed;
	try {
		parsed = parseFrontmatter(skillMd);
	} catch {
		return null;
	}
	const domain = meta?.domain ?? "未归类";
	return {
		name,
		description: parsed.description,
		domain,
		domains: [domain],
		blurb: meta?.blurb ?? "",
		lead: leadOf(parsed.body),
		script: findScript(dir, parsed.body),
		kind: "paper",
		tier: "",
		species: [],
		intents: [],
		inputsStatus: "none",
		inputs: [],
		outputs: [],
		entry: null,
		paper: null
	};
}
const cache$1 = /* @__PURE__ */ new Map();
function stampOf$1(home) {
	const parts = [];
	for (const file of [
		"catalog.json",
		"intents.json",
		"README.md"
	]) {
		const path = join(home, file);
		if (existsSync(path)) parts.push(`${file}:${statSync(path).mtimeMs}`);
	}
	const skillsDir = join(home, "skills");
	if (existsSync(skillsDir)) parts.push(`skills:${statSync(skillsDir).mtimeMs}`);
	const head = join(home, ".git", "HEAD");
	if (existsSync(head)) parts.push(`head:${statSync(head).mtimeMs}`);
	return parts.join("|");
}
function loadCatalog(home) {
	if (!home) return {
		home: "",
		revision: "",
		version: "",
		source: "",
		cards: [],
		intents: [],
		error: "longevity-skills checkout not found. Set skillsHome or LONGEVITY_SKILLS_HOME."
	};
	const stamp = stampOf$1(home);
	const hit = cache$1.get(home);
	if (hit && hit.stamp === stamp) return hit.catalog;
	const catalog = buildCatalog(home);
	cache$1.set(home, {
		stamp,
		catalog
	});
	return catalog;
}
function buildCatalog(home) {
	const skillsDir = join(home, "skills");
	if (!existsSync(skillsDir)) return {
		home,
		revision: gitRevision(home),
		version: "",
		source: "",
		cards: [],
		intents: [],
		error: `missing ${skillsDir}`
	};
	const revision = gitRevision(home);
	const catalogPath = join(home, "catalog.json");
	if (existsSync(catalogPath)) try {
		const parsed = readJson(catalogPath);
		if (parsed.schema === "longevity-catalog/1" && Array.isArray(parsed.skills)) {
			const cards = [];
			for (const item of parsed.skills) {
				if (!item.name || !NAME.test(item.name)) continue;
				const dir = join(skillsDir, item.name);
				const skillMd = join(dir, "SKILL.md");
				if (!existsSync(skillMd)) continue;
				const card = cardFrom(dir, item.name, item, readFileSync(skillMd, "utf8"));
				if (card) cards.push(card);
			}
			cards.sort((a, b) => a.name.localeCompare(b.name));
			return {
				home,
				revision,
				version: parsed.version ?? "",
				source: "catalog.json",
				cards,
				intents: parsed.intents ?? [],
				error: ""
			};
		}
	} catch {}
	const readmePath = join(home, "README.md");
	const meta = parseReadme(existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "");
	const cards = [];
	let manifests = 0;
	for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
		if (!entry.isDirectory() || !NAME.test(entry.name)) continue;
		const dir = join(skillsDir, entry.name);
		const skillMd = join(dir, "SKILL.md");
		if (!existsSync(skillMd)) continue;
		const raw = readFileSync(skillMd, "utf8");
		const manifestPath = join(dir, "skill.json");
		let card = null;
		if (existsSync(manifestPath)) try {
			card = cardFrom(dir, entry.name, readJson(manifestPath), raw);
			manifests += 1;
		} catch {
			card = null;
		}
		card ??= legacyCard(dir, entry.name, meta.get(entry.name), raw);
		if (card) cards.push(card);
	}
	cards.sort((a, b) => a.name.localeCompare(b.name));
	let intents = [];
	const intentsPath = join(home, "intents.json");
	if (existsSync(intentsPath)) try {
		intents = readJson(intentsPath).intents ?? [];
	} catch {
		intents = [];
	}
	return {
		home,
		revision,
		version: "",
		source: manifests > 0 ? "skill.json" : "readme",
		cards,
		intents,
		error: ""
	};
}
function readSkillFile(home, name) {
	if (!NAME.test(name)) return { error: "skill name must be the directory name" };
	const catalog = loadCatalog(home);
	const card = catalog.cards.find((item) => item.name === name);
	if (!card) return { error: catalog.error || `unknown skill ${name}` };
	return {
		raw: readFileSync(join(home, "skills", name, "SKILL.md"), "utf8"),
		card
	};
}
function commandExcerpt(body) {
	const index = body.search(/^## (Command|命令)\s*$/m);
	if (index < 0) return "";
	return body.slice(index, index + 1800);
}
//#endregion
//#region src/intents.ts
const EMPTY$1 = {
	interventions: [],
	genes: []
};
const INTERVENTION_TYPES = /* @__PURE__ */ new Set([
	"drug",
	"compound",
	"supplement",
	"intervention"
]);
const GENE_TYPES = /* @__PURE__ */ new Set([
	"gene",
	"protein",
	"variant"
]);
const compiled = /* @__PURE__ */ new Map();
function escape(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function triggerRegex(trigger, caseSensitive = false) {
	const key = `${caseSensitive ? "c" : "i"}:${trigger}`;
	const hit = compiled.get(key);
	if (hit) return hit;
	const flags = caseSensitive ? "" : "i";
	let re;
	if (trigger.startsWith("re:")) re = new RegExp(trigger.slice(3), flags);
	else if (/^[\x20-\x7e]+$/.test(trigger)) re = new RegExp(`(?<![A-Za-z0-9])${escape(trigger)}(?![A-Za-z0-9])`, flags);
	else re = new RegExp(escape(trigger), flags);
	compiled.set(key, re);
	return re;
}
function mentioned(question, names, caseSensitive = false) {
	const found = [];
	for (const name of names) if (triggerRegex(name, caseSensitive).test(question) && !found.includes(name)) found.push(name);
	return found;
}
function detectIntents(question, intents, lexicon = EMPTY$1) {
	const asked = question.trim();
	if (!asked) return [];
	const hits = [];
	for (const intent of intents) {
		const triggers = mentioned(asked, intent.triggers);
		const entities = mentioned(asked, intent.entities ?? []);
		let score = triggers.length + 2 * entities.length;
		const found = [...triggers, ...entities];
		if (intent.id === "intervention_evidence") {
			const named = mentioned(asked, lexicon.interventions).filter((name) => !found.includes(name));
			score += 2 * Math.min(named.length, 2);
			found.push(...named.slice(0, 3));
		}
		if (intent.id === "gene_variant") {
			const named = mentioned(asked, lexicon.genes, true).filter((name) => !found.includes(name));
			score += Math.min(named.length, 2);
			found.push(...named.slice(0, 3));
		}
		if (score > 0) hits.push({
			id: intent.id,
			label_zh: intent.label_zh,
			score,
			hits: found.slice(0, 5)
		});
	}
	const order = new Map(intents.map((intent, index) => [intent.id, index]));
	const priority = new Map(intents.map((intent) => [intent.id, intent.priority ?? 0]));
	return hits.sort((a, b) => b.score - a.score || (priority.get(b.id) ?? 0) - (priority.get(a.id) ?? 0) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
/** Drugs, supplements and genes the question names, for the evidence lookup. */
function mentionedEntities(question, intents, lexicon) {
	const names = [
		...mentioned(question, intents.find((intent) => intent.id === "intervention_evidence")?.entities ?? []),
		...mentioned(question, lexicon.interventions),
		...mentioned(question, lexicon.genes, true)
	];
	const unique = [];
	for (const name of names.sort((a, b) => b.length - a.length)) if (!unique.some((kept) => kept.toLowerCase().includes(name.toLowerCase()))) unique.push(name);
	return unique.slice(0, 6);
}
const lexiconCache = /* @__PURE__ */ new Map();
function loadEvidenceLexicon(home) {
	if (!home) return EMPTY$1;
	const path = join(home, "skills", "longevity-evidence", "data", "claims.jsonl");
	if (!existsSync(path)) return EMPTY$1;
	const stamp = statSync(path).mtimeMs;
	const hit = lexiconCache.get(path);
	if (hit && hit.stamp === stamp) return hit.lexicon;
	const interventions = /* @__PURE__ */ new Set();
	const genes = /* @__PURE__ */ new Set();
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		if (!line.trim()) continue;
		let row;
		try {
			row = JSON.parse(line);
		} catch {
			continue;
		}
		const names = [
			row.entity ?? "",
			row.entity_zh ?? "",
			...row.aliases ?? []
		];
		for (const name of names) {
			const trimmed = name.trim();
			if (!trimmed) continue;
			const ascii = /^[\x20-\x7e]+$/.test(trimmed);
			if (ascii ? trimmed.length < 3 : trimmed.length < 2) continue;
			if (INTERVENTION_TYPES.has(row.entity_type ?? "")) interventions.add(trimmed);
			else if (GENE_TYPES.has(row.entity_type ?? "") && ascii && /[A-Z]/.test(trimmed)) genes.add(trimmed);
		}
	}
	const lexicon = {
		interventions: [...interventions],
		genes: [...genes]
	};
	lexiconCache.set(path, {
		stamp,
		lexicon
	});
	return lexicon;
}
//#endregion
//#region src/units.ts
const SUPERSCRIPTS = {
	"⁰": "0",
	"¹": "1",
	"²": "2",
	"³": "3",
	"⁴": "4",
	"⁵": "5",
	"⁶": "6",
	"⁷": "7",
	"⁸": "8",
	"⁹": "9",
	"⁻": "-"
};
const UNIT_ALIASES = {
	"岁": "a",
	"年": "a",
	years: "a",
	year: "a",
	yr: "a",
	yrs: "a",
	y: "a",
	"小时": "h",
	hours: "h",
	hour: "h",
	hr: "h",
	hrs: "h",
	"分钟": "min",
	minutes: "min",
	minute: "min",
	mins: "min",
	"天": "d",
	days: "d",
	day: "d",
	"毫米汞柱": "mmhg",
	"kg/m2": "kg/m^2",
	"公斤": "kg",
	"千克": "kg",
	"克": "g",
	"厘米": "cm",
	"米": "m",
	"毫米": "mm",
	"k/ul": "10^3/ul",
	"10^3/mm^3": "10^3/ul",
	"10^3/mm3": "10^3/ul",
	"thou/ul": "10^3/ul",
	"克/升": "g/l",
	"克/分升": "g/dl",
	"毫克/分升": "mg/dl",
	"毫克/升": "mg/l",
	"毫摩尔/升": "mmol/l",
	"微摩尔/升": "umol/l",
	"纳摩尔/升": "nmol/l",
	"飞升": "fl",
	"皮克": "pg",
	"单位/升": "u/l",
	"次/分": "/min",
	"次/分钟": "/min",
	bpm: "/min",
	ratio: "1",
	fraction: "1"
};
function normalizeUnit(text) {
	if (text == null) return "";
	let s = String(text);
	s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^${[...run].map((char) => SUPERSCRIPTS[char] ?? "").join("")}`);
	s = s.normalize("NFKC");
	s = s.replace(/µ/g, "u").replace(/μ/g, "u");
	s = s.toLowerCase();
	s = s.replace(/\s+/g, "");
	s = s.replace(/^[×x*](?=10)/, "");
	s = s.replace(/10\*(\d+)/g, "10^$1");
	s = s.replace(/\^\^/g, "^");
	if (s.startsWith("iu/")) s = s.slice(1);
	return UNIT_ALIASES[s] ?? s;
}
function foldName(text) {
	return String(text).normalize("NFKC").toLowerCase().replace(/[\s_\-·•:：,，/\\]+/g, "");
}
function nameVariants(text) {
	const raw = String(text).normalize("NFKC").trim();
	const found = [];
	const add = (value) => {
		const folded = foldName(value);
		if (folded && !found.includes(folded)) found.push(folded);
	};
	add(raw);
	add(raw.replace(/[(\[（【][^)\]）】]*[)\]）】]/g, " "));
	for (const match of raw.matchAll(/[(\[（【]([^)\]）】]*)[)\]）】]/g)) add(match[1] ?? "");
	return found;
}
function parseNumber(raw) {
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
	if (typeof raw !== "string") return null;
	let text = raw.normalize("NFKC").trim();
	if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
	if (/^[<>≤≥]/.test(text) || text === "") return null;
	const value = Number(text);
	return Number.isFinite(value) ? value : null;
}
//#endregion
//#region src/measurements.ts
function fmt$2(value) {
	return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
}
function measurementInputs(card) {
	return card.inputs.filter((spec) => (spec.from ?? "measurements") === "measurements");
}
function aliasIndex(specs) {
	const index = /* @__PURE__ */ new Map();
	for (const spec of specs) index.set(foldName(spec.key), {
		spec,
		byKey: true
	});
	for (const spec of specs) for (const name of [spec.label_zh, ...spec.aliases ?? []]) {
		const folded = foldName(name ?? "");
		if (folded && !index.has(folded)) index.set(folded, {
			spec,
			byKey: false
		});
	}
	return index;
}
function unitFactor(spec, unit) {
	const canonical = normalizeUnit(spec.unit ?? "");
	const given = normalizeUnit(unit);
	if (given === canonical) return 1;
	for (const [name, factor] of Object.entries(spec.accept ?? {})) if (normalizeUnit(name) === given) return factor;
	return null;
}
function unitLabel(spec) {
	return spec.unit && spec.unit !== "1" ? spec.unit : "";
}
function withUnit(text, unit) {
	return unit ? `${text} ${unit}` : text;
}
function rangeProblem(spec, value, shown, raw) {
	if (!spec.range) return null;
	const [low, high] = spec.range;
	if (value >= low && value <= high) return null;
	const unit = unitLabel(spec);
	let message = `${spec.label_zh} 读成 ${withUnit(fmt$2(value), unit)}（${shown}），不在合理范围 ${withUnit(`${fmt$2(low)}–${fmt$2(high)}`, unit)} 内。`;
	if (raw != null) {
		const hints = Object.entries(spec.accept ?? {}).filter(([name, factor]) => normalizeUnit(name) !== normalizeUnit(spec.unit ?? "") && raw * factor >= low && raw * factor <= high).map(([name]) => name);
		if (hints.length > 0) message += `如果化验单上的单位是 ${hints.join("、")}，请写明单位。`;
	}
	if (spec.note_zh) message += spec.note_zh;
	return {
		key: spec.key,
		label: spec.label_zh,
		kind: "range",
		message_zh: message
	};
}
function resolveInput(index, name) {
	for (const variant of nameVariants(name)) {
		const hit = index.get(variant);
		if (hit) return hit;
	}
	return null;
}
/** Validate and convert measurements; build the CSV in the input's own units. */
function stageMeasurements(card, items) {
	const specs = measurementInputs(card);
	const index = aliasIndex(specs);
	const values = {};
	const problems = [];
	const used = [];
	for (const item of items) {
		const hit = resolveInput(index, String(item.key ?? ""));
		if (!hit) {
			problems.push({
				key: String(item.key),
				label: String(item.key),
				kind: "unknown",
				message_zh: `${item.key} 不是这个技能要的输入。`
			});
			continue;
		}
		const { spec, byKey } = hit;
		const number = parseNumber(item.value);
		if (number == null) {
			problems.push({
				key: spec.key,
				label: spec.label_zh,
				kind: "parse",
				message_zh: `${spec.label_zh} 的值「${String(item.value)}」不是一个可以计算的数。`
			});
			continue;
		}
		const unit = String(item.unit ?? "");
		let factor = 1;
		let shown = unitLabel(spec) ? `按 ${unitLabel(spec)} 读` : "没有单位";
		if (!normalizeUnit(unit)) {
			if (!byKey && spec.unit_required) {
				const accepted = [spec.unit ?? "", ...Object.keys(spec.accept ?? {}).filter((name) => normalizeUnit(name) !== normalizeUnit(spec.unit ?? ""))];
				problems.push({
					key: spec.key,
					label: spec.label_zh,
					kind: "unit_missing",
					message_zh: `${spec.label_zh} 没有写单位。这一项常见 ${accepted.join("、")}，请写明单位。`
				});
				continue;
			}
		} else {
			factor = unitFactor(spec, unit);
			if (factor == null) {
				const accepted = [.../* @__PURE__ */ new Set([spec.unit ?? "", ...Object.keys(spec.accept ?? {})])];
				problems.push({
					key: spec.key,
					label: spec.label_zh,
					kind: "unit",
					message_zh: `${spec.label_zh} 的单位 ${unit} 不能换算成 ${unitLabel(spec) || "无单位的数"}。可以接受：${accepted.filter(Boolean).join("、") || "无单位"}。${spec.note_zh ?? ""}`
				});
				continue;
			}
			shown = factor === 1 ? `单位 ${unit}` : `原值 ${fmt$2(number)} ${unit}`;
		}
		const value = number * factor;
		if (spec.key in values && Math.abs((values[spec.key] ?? 0) - value) > 1e-9 * Math.max(1, Math.abs(value))) {
			problems.push({
				key: spec.key,
				label: spec.label_zh,
				kind: "duplicate",
				message_zh: `${spec.label_zh} 出现了两次，数值不同。请只保留一次。`
			});
			continue;
		}
		const problem = rangeProblem(spec, value, shown, factor === 1 ? number : null);
		if (problem) {
			problems.push(problem);
			continue;
		}
		values[spec.key] = value;
		used.push({
			key: spec.key,
			from: String(item.key),
			unit: spec.unit ?? "",
			factor,
			given_unit: unit,
			raw: number,
			value
		});
	}
	for (const spec of specs) if (spec.required && !(spec.key in values) && !problems.some((problem) => problem.key === spec.key)) problems.push({
		key: spec.key,
		label: spec.label_zh,
		kind: "missing",
		message_zh: `缺少${spec.label_zh}。`
	});
	const header = card.entry?.measurements_header?.length ? card.entry.measurements_header : [
		"marker",
		"value",
		"unit"
	];
	const rows = [header.join(",")];
	for (const spec of specs) {
		if (!(spec.key in values)) continue;
		const cells = [spec.key, fmt$2(values[spec.key] ?? 0)];
		if (header.length > 2) cells.push(spec.unit ?? "");
		rows.push(cells.join(","));
	}
	return {
		values,
		csv: `${rows.join("\n")}\n`,
		problems,
		used
	};
}
/** Which of this skill's required inputs the record, the profile and past outputs already supply. */
function runnableFrom(card, indicators, profile, outputs = {}) {
	if (card.inputsStatus === "none" || card.inputs.length === 0 || !card.script) return {
		status: "unknown",
		have: [],
		missing: [],
		from_record: []
	};
	const have = [];
	const missing = [];
	const fromRecord = [];
	const byLoinc = /* @__PURE__ */ new Map();
	for (const row of indicators) if (row.loinc) byLoinc.set(row.loinc, row);
	for (const spec of card.inputs) {
		if (!spec.required) continue;
		const source = spec.from ?? "measurements";
		if (source === "profile") {
			if (spec.key === "age" ? profile.age != null : profile.sex && profile.sex !== "unknown") have.push(spec.label_zh);
			else missing.push(spec.label_zh);
			continue;
		}
		if (source === "measurements") {
			const found = matchIndicator(spec, indicators, byLoinc);
			if (found) {
				have.push(spec.label_zh);
				fromRecord.push({
					key: spec.key,
					value: found.value,
					unit: found.unit
				});
				continue;
			}
			if (spec.output_of?.some((key) => key in outputs)) {
				have.push(spec.label_zh);
				continue;
			}
			missing.push(spec.label_zh);
			continue;
		}
		if (source === "output" && spec.output_of?.some((key) => key in outputs)) {
			have.push(spec.label_zh);
			continue;
		}
		missing.push(spec.label_zh);
	}
	return {
		status: missing.length === 0 ? "ready" : have.length > 0 && missing.length <= 2 ? "partial" : "none",
		have,
		missing,
		from_record: fromRecord
	};
}
/** The record indicator that holds one declared input, by LOINC code first, then by name. */
function indicatorFor(spec, indicators) {
	const byLoinc = /* @__PURE__ */ new Map();
	for (const row of indicators) if (row.loinc) byLoinc.set(row.loinc, row);
	return matchIndicator(spec, indicators, byLoinc);
}
function matchIndicator(spec, indicators, byLoinc) {
	for (const code of spec.loinc ?? []) {
		const row = byLoinc.get(code);
		if (row && parseNumber(row.value) != null) return row;
	}
	const names = new Set([
		spec.key,
		spec.label_zh,
		...spec.aliases ?? []
	].map((name) => foldName(name)).filter(Boolean));
	for (const row of indicators) {
		if (parseNumber(row.value) == null) continue;
		if (nameVariants(row.name).some((variant) => names.has(variant))) return row;
		if (row.label && nameVariants(row.label).some((variant) => names.has(variant))) return row;
	}
	return null;
}
//#endregion
//#region src/match.ts
const WEAK$1 = /* @__PURE__ */ new Set([
	"age",
	"aging",
	"ageing",
	"aged",
	"biological",
	"blood",
	"human",
	"cell",
	"cells",
	"gene",
	"genes",
	"protein",
	"risk",
	"health",
	"study",
	"paper",
	"user",
	"when",
	"年龄",
	"血液",
	"指标",
	"检查",
	"个人",
	"这个",
	"一个",
	"什么",
	"怎么",
	"可以",
	"记录",
	"技能",
	"方法",
	"实足",
	"没有",
	"不是",
	"衰老",
	"抗衰",
	"延缓",
	"我的"
]);
const ORGANISMS = [
	{
		id: "mouse",
		species: ["mouse", "rat"],
		re: /小鼠|大鼠|老鼠|mouse|mice|(?<![A-Za-z])rats?(?![A-Za-z])/i
	},
	{
		id: "worm",
		species: ["c_elegans"],
		re: /线虫|elegans/i
	},
	{
		id: "fly",
		species: ["drosophila"],
		re: /果蝇|drosophila/i
	},
	{
		id: "mole",
		species: ["naked_mole_rat"],
		re: /裸鼹鼠|naked[ -]?mole/i
	},
	{
		id: "planarian",
		species: ["planarian"],
		re: /涡虫|planarian/i
	},
	{
		id: "butterfly",
		species: ["butterfly"],
		re: /蝴蝶|butterfl|helicon/i
	},
	{
		id: "whale",
		species: ["bowhead_whale"],
		re: /弓头鲸|鲸|bowhead|whale/i
	},
	{
		id: "fish",
		species: ["zebrafish", "killifish"],
		re: /青鳉|鳉鱼|killifish|斑马鱼|zebrafish/i
	},
	{
		id: "yeast",
		species: ["yeast"],
		re: /酵母|yeast/i
	},
	{
		id: "cells",
		species: ["cell_line"],
		re: /细胞实验|细胞系|cell line/i
	}
];
const SIGNALS = [
	{
		skill: "accelerated-biological-aging-risk",
		needles: [
			"albumin",
			"白蛋白",
			"creatinine",
			"肌酐",
			"glucose",
			"血糖",
			"crp",
			"c-reactive",
			"c反应",
			"lymph",
			"淋巴",
			"mcv",
			"rdw",
			"alp",
			"碱性磷酸酶",
			"wbc",
			"白细胞"
		],
		need: 3,
		why: "检查名里出现了表型年龄会用到的指标"
	},
	{
		skill: "leukocyte-telomere-length",
		needles: ["telomere", "端粒"],
		need: 1,
		why: "记录里有端粒"
	},
	{
		skill: "digital-telomere-measurement-sequencing",
		needles: ["telomere", "端粒"],
		need: 1,
		why: "记录里有端粒"
	},
	{
		skill: "sleep-chart-biological-ageing",
		needles: ["sleep duration", "睡眠"],
		need: 1,
		why: "记录里有睡眠"
	}
];
function domainSummary(cards) {
	const map = /* @__PURE__ */ new Map();
	for (const card of cards) {
		const names = map.get(card.domain) ?? [];
		names.push(card.name);
		map.set(card.domain, names);
	}
	return [...map.entries()].map(([domain, names]) => ({
		domain,
		count: names.length,
		names
	}));
}
function englishTerms(query) {
	const found = /* @__PURE__ */ new Set();
	for (const match of query.toLowerCase().matchAll(/[a-z0-9][a-z0-9-]{2,}/g)) if (match[0]) found.add(match[0]);
	return [...found];
}
function cjkGrams(query) {
	const found = /* @__PURE__ */ new Set();
	for (const match of query.matchAll(/[一-鿿]{2,}/g)) {
		const run = match[0] ?? "";
		const max = Math.min(run.length, 8);
		for (let size = 2; size <= max; size += 1) for (let index = 0; index + size <= run.length; index += 1) found.add(run.slice(index, index + size));
	}
	return [...found];
}
function organismsAsked(question) {
	return new Set(ORGANISMS.filter((item) => item.re.test(question)).map((item) => item.id));
}
function organismOf(card) {
	if (card.species.length > 0) {
		if (card.species.includes("human")) return null;
		return ORGANISMS.find((item) => item.species.some((species) => card.species.includes(species)))?.id ?? "other";
	}
	const hay = `${card.name} ${card.domain} ${card.blurb} ${card.description}`;
	return ORGANISMS.find((item) => item.re.test(hay))?.id ?? null;
}
const GENERIC_NAME_TOKENS = /* @__PURE__ */ new Set([
	"age",
	"aging",
	"ageing",
	"clock",
	"clocks",
	"biological",
	"human",
	"risk",
	"score",
	"aged",
	"the"
]);
/** A short token the question names exactly (CT, MRI, NMN) that is also a word of the skill's directory name. */
function nameTokenBonus(card, asked) {
	const tokens = new Set(card.name.split("-").filter((token) => token.length >= 2 && !GENERIC_NAME_TOKENS.has(token)));
	for (const match of asked.matchAll(/(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]{1,11})(?![A-Za-z0-9])/g)) if (tokens.has((match[1] ?? "").toLowerCase())) return 8;
	return 0;
}
function lexical(card, asked) {
	const why = [];
	let score = 0;
	let specific = 0;
	let strong = false;
	if (!asked) return {
		score,
		specific,
		strong,
		why
	};
	const hay = `${card.name}\n${card.description}\n${card.blurb}\n${card.lead}`.toLowerCase();
	const terms = englishTerms(asked);
	if (terms.some((term) => term === card.name || card.name.includes(term))) {
		score += 8;
		specific += 1;
		why.push("名字对上了问题");
	}
	for (const term of terms) {
		if (term === card.name || card.name.includes(term) || !hay.includes(term)) continue;
		if (WEAK$1.has(term)) score += 1;
		else {
			score += 3;
			specific += 1;
			why.push(`说明里有「${term}」`);
		}
	}
	for (const gram of cjkGrams(asked)) {
		if (!hay.includes(gram)) continue;
		if (WEAK$1.has(gram)) {
			score += 1;
			continue;
		}
		score += gram.length >= 4 ? 4 : gram.length === 3 ? 3 : 2;
		specific += 1;
		if (gram.length >= 3) why.push(`说明里有「${gram}」`);
		if (gram.length >= 4) strong = true;
	}
	return {
		score,
		specific,
		strong,
		why
	};
}
function signalWhy(skill, indicatorHay) {
	if (!indicatorHay) return "";
	const rule = SIGNALS.find((item) => item.skill === skill);
	if (!rule) return "";
	return rule.needles.filter((needle) => indicatorHay.includes(needle.toLowerCase())).length >= rule.need ? rule.why : "";
}
function asRows(indicators) {
	return indicators.map((item) => typeof item === "string" ? {
		name: item,
		value: "",
		unit: ""
	} : item);
}
function matchSkills(cards, query, indicators, limit, options = {}) {
	const asked = query.trim();
	const rows = asRows(indicators);
	const indicatorHay = rows.map((row) => row.name).join("\n").toLowerCase();
	const profile = options.profile ?? {
		age: null,
		sex: "unknown"
	};
	const specs = options.intents ?? [];
	const explicit = (options.explicitIntents ?? []).filter((id) => specs.some((spec) => spec.id === id));
	const detected = explicit.length > 0 ? explicit.map((id) => ({
		id,
		label_zh: specs.find((spec) => spec.id === id)?.label_zh ?? id,
		score: 10,
		hits: ["模型指定"]
	})) : detectIntents(asked, specs, options.lexicon);
	const organisms = organismsAsked(asked);
	const organismIntent = detected.some((hit) => hit.id === "model_organism");
	const hits = [];
	const near = [];
	for (const card of cards) {
		const organism = organismOf(card);
		if (card.tier === "C" && !organismIntent && organisms.size === 0) continue;
		if (organism && organisms.size > 0 && !organisms.has(organism) && organism !== "other") continue;
		const why = [];
		let score = 0;
		let specific = 0;
		detected.forEach((hit, rank) => {
			const spec = specs.find((item) => item.id === hit.id);
			const position = spec ? spec.skills.indexOf(card.name) : -1;
			const weight = 1 / (1 + rank);
			if (position >= 0) {
				score += (30 - 2 * position) * weight;
				specific += 1;
				why.push(`对上意图「${hit.label_zh}」`);
			} else if (card.intents.includes(hit.id)) {
				score += 10 * weight;
				specific += 1;
				why.push(`对上意图「${hit.label_zh}」`);
			}
		});
		const run = runnableFrom(card, rows, profile, options.outputs);
		if (run.status === "ready") {
			score += 6;
			why.push("记录里的输入已经齐了");
		} else if (run.status === "partial") {
			score += 2;
			why.push(`还缺 ${run.missing.join("、")}`);
		}
		const words = lexical(card, asked);
		score += Math.min(words.score, 12) * (detected.length > 0 && !words.strong ? .5 : 1);
		specific += words.specific;
		why.push(...words.why);
		const token = nameTokenBonus(card, asked);
		if (token) {
			score += token;
			specific += 1;
			why.push("问题点了这个方法名里的词");
		}
		const signal = card.inputs.length === 0 ? signalWhy(card.name, indicatorHay) : "";
		if (signal) {
			score += 6;
			specific += 1;
			why.push(signal);
		}
		if (organism && organisms.has(organism)) {
			score += 6;
			specific += 1;
			why.push("问题点了这个模式生物");
		} else if (organism && !card.tier) score -= 8;
		if (card.tier === "B" && detected[0] && !["intervention_evidence", "gene_variant"].includes(detected[0].id)) score -= 2;
		const hit = {
			name: card.name,
			domain: card.domain,
			blurb: card.blurb,
			score: Math.round(score * 10) / 10,
			why: [...new Set(why)].slice(0, 4),
			has_script: Boolean(card.script),
			tier: card.tier,
			runnable: {
				status: run.status,
				missing: run.missing
			}
		};
		if (!asked && run.status === "partial" && card.tier !== "C") near.push(hit);
		if (asked) {
			if (specific === 0) continue;
		} else if (run.status !== "ready" && !signal) continue;
		if (score <= 0) continue;
		hits.push(hit);
	}
	hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
	near.sort((a, b) => a.runnable.missing.length - b.runnable.missing.length || b.score - a.score || a.name.localeCompare(b.name));
	const matches = hits.slice(0, limit);
	let note = "按问题、个人记录和已经算过的读出排序。名单以外的技能这次不调度。";
	if (matches.length === 0 && asked) note = detected.some((hit) => hit.id === "intervention_evidence") ? "没有技能直接对上。这是查证据的问题，用 query_longevity_evidence。" : "没有技能的说明对上这个问题。可以先看 list_longevity_intents，换一种说法。";
	if (matches.length === 0 && !asked) note = "还没有问题，记录里也没有哪项方法的输入是齐的。先说出想了解什么，或接上检查。";
	return {
		matches,
		near: near.slice(0, 6),
		intents: detected,
		note
	};
}
//#endregion
//#region src/paths.ts
function firstExisting(candidates, marker) {
	for (const candidate of candidates) {
		const trimmed = candidate.trim();
		if (!trimmed) continue;
		const dir = resolve(trimmed);
		if (marker(dir)) return dir;
	}
	return "";
}
function resolveSkillsHome(configured) {
	return firstExisting([
		configured,
		process.env.LONGEVITY_SKILLS_HOME ?? "",
		join(homedir(), "longevity-skills"),
		join(homedir(), "Projects", "longevity-skills")
	], (dir) => existsSync(join(dir, "skills")) && existsSync(join(dir, "README.md")));
}
function resolveMirobodyPlugin(configured) {
	return firstExisting([
		configured,
		process.env.MIROBODY_PLUGIN_HOME ?? "",
		join(homedir(), "Projects", "dsh-plugin-mirobody")
	], (dir) => existsSync(join(dir, "lib", "index.js")) && existsSync(join(dir, "bridge", "dsh_bridge.py")));
}
function resolveDataDir(configured) {
	const trimmed = configured.trim();
	if (trimmed) return resolve(trimmed);
	return join(homedir(), ".dsh", "longpi");
}
function clampMatches(value) {
	if (!Number.isFinite(value)) return 8;
	return Math.max(1, Math.min(20, Math.floor(value)));
}
//#endregion
//#region src/profile.ts
const SEXES = [
	"female",
	"male",
	"other",
	"unknown"
];
const EMPTY_PROFILE = {
	displayName: "",
	birthYear: null,
	age: null,
	sex: "unknown"
};
function optionalInt(value, min, max, label) {
	if (value == null || value === "") return {
		ok: true,
		value: null
	};
	const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
	if (!Number.isInteger(number) || number < min || number > max) return {
		ok: false,
		error: `${label} must be an integer from ${min} to ${max}`
	};
	return {
		ok: true,
		value: number
	};
}
function normalizeProfile(input) {
	if (!input || typeof input !== "object" || Array.isArray(input)) return {
		ok: false,
		error: "profile must be an object"
	};
	const raw = input;
	for (const key of Object.keys(raw)) if (![
		"displayName",
		"birthYear",
		"age",
		"sex"
	].includes(key)) return {
		ok: false,
		error: `unknown field ${key}`
	};
	let displayName = "";
	if (raw.displayName != null && raw.displayName !== "") {
		if (typeof raw.displayName !== "string") return {
			ok: false,
			error: "displayName must be a string"
		};
		displayName = raw.displayName.trim();
		if (displayName.length > 40) return {
			ok: false,
			error: "displayName is longer than 40 characters"
		};
		if (/[\u0000-\u001f]/.test(displayName)) return {
			ok: false,
			error: "displayName has control characters"
		};
	}
	const birthYear = optionalInt(raw.birthYear, 1900, 2100, "birthYear");
	if (!birthYear.ok) return birthYear;
	const age = optionalInt(raw.age, 0, 130, "age");
	if (!age.ok) return age;
	let sex = "unknown";
	if (raw.sex != null && raw.sex !== "") {
		if (typeof raw.sex !== "string" || !SEXES.includes(raw.sex)) return {
			ok: false,
			error: "sex must be female, male, other, or unknown"
		};
		sex = raw.sex;
	}
	return {
		ok: true,
		profile: {
			displayName,
			birthYear: birthYear.value,
			age: age.value,
			sex
		}
	};
}
function estimatedAge(birthYear, nowYear) {
	if (birthYear == null) return null;
	const age = nowYear - birthYear;
	if (age < 0 || age > 130) return null;
	return age;
}
function profilePath(dataDir) {
	return join(dataDir, "profile.json");
}
function readProfile(dataDir) {
	const path = profilePath(dataDir);
	if (!existsSync(path)) return { ...EMPTY_PROFILE };
	try {
		const normalized = normalizeProfile(JSON.parse(readFileSync(path, "utf8")));
		return normalized.ok ? normalized.profile : { ...EMPTY_PROFILE };
	} catch {
		return { ...EMPTY_PROFILE };
	}
}
function writeProfile(dataDir, profile) {
	mkdirSync(dirname(profilePath(dataDir)), {
		recursive: true,
		mode: 448
	});
	writeFileSync(profilePath(dataDir), `${JSON.stringify(profile, null, 2)}\n`, { mode: 384 });
}
//#endregion
//#region src/history.ts
function historyPath(dataDir) {
	return join(dataDir, "history.jsonl");
}
function readResultFile(path) {
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (parsed.schema !== "longevity-result/1" || !parsed.outputs) return {};
		return parsed.outputs;
	} catch {
		return {};
	}
}
function recordOutputs(dataDir, row) {
	const kept = Object.fromEntries(Object.entries(row.outputs).filter(([, item]) => item && item.value != null));
	if (Object.keys(kept).length === 0) return;
	mkdirSync(dataDir, {
		recursive: true,
		mode: 448
	});
	appendFileSync(historyPath(dataDir), `${JSON.stringify({
		...row,
		outputs: kept
	})}\n`, { mode: 384 });
}
function readHistory(dataDir, limit = 200) {
	const path = historyPath(dataDir);
	if (!existsSync(path)) return [];
	const rows = [];
	for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).slice(-limit)) try {
		const item = JSON.parse(line);
		if (item && typeof item.skill === "string" && item.outputs) rows.push(item);
	} catch {}
	return rows;
}
function whenOf(row) {
	return row.measured_at || row.at;
}
/** The value of each output key read from the most recent measurements (not the most recent run). */
function latestOutputs(dataDir) {
	const latest = {};
	for (const row of readHistory(dataDir)) for (const [key, item] of Object.entries(row.outputs)) {
		if (item.value == null) continue;
		const prior = latest[key];
		if (prior && (prior.measured_at || prior.at) > whenOf(row)) continue;
		latest[key] = {
			...item,
			at: row.at,
			skill: row.skill,
			...row.measured_at ? { measured_at: row.measured_at } : {}
		};
	}
	return latest;
}
/**
* Every recorded value of one output key, oldest measurement first, one per
* measurement date (a rerun on the same checkup replaces the earlier run).
*/
function seriesOf(dataDir, key) {
	const byDate = /* @__PURE__ */ new Map();
	for (const row of readHistory(dataDir, 1e3)) {
		const item = row.outputs[key];
		if (!item || item.value == null) continue;
		byDate.set(whenOf(row), {
			at: row.at,
			value: item.value,
			skill: row.skill,
			...row.measured_at ? { measured_at: row.measured_at } : {}
		});
	}
	return [...byDate.values()].sort((a, b) => (a.measured_at || a.at).localeCompare(b.measured_at || b.at));
}
//#endregion
//#region src/runner.ts
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const OUT_PATH = /^out\/?$|^out\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const MEASUREMENTS_FILE = "measurements.csv";
const EXIT_INPUT_PROBLEM = 3;
function readLevers(runDir) {
	const path = join(runDir, "out", "levers.json");
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		return parsed && parsed.schema === "longevity-levers/1" ? parsed : null;
	} catch {
		return null;
	}
}
function fail(skill, revision, error_kind, error, hint, extra = {}) {
	return {
		ok: false,
		error_kind,
		error,
		hint,
		skill,
		revision,
		exit_code: null,
		report_excerpt: "",
		stdout_tail: "",
		stderr_tail: "",
		...extra
	};
}
function checkArg(arg) {
	if (typeof arg !== "string" || arg.length === 0 || arg.length > 500) return "each argument must be 1–500 characters";
	if (arg.includes("\0") || arg.includes("..")) return "arguments cannot contain ..";
	if (arg.startsWith("-")) {
		if (arg.includes("/") || arg.includes("\\")) return "flags cannot contain a path";
		return null;
	}
	if (arg.startsWith("/") || /^[A-Za-z]:[\\/]/.test(arg)) return "absolute paths are not accepted";
	if (arg.includes("/") || arg.includes("\\")) {
		if (!OUT_PATH.test(arg)) return "only staged file names and out/ are accepted as paths";
	}
	return null;
}
function formatNumber(value) {
	if (Number.isInteger(value)) return String(value);
	return String(Number(value.toPrecision(4)));
}
function reportExcerpt(text) {
	const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	const picked = lines.filter((line) => /年龄|age|边界|boundary|差|未计算|没有|不在合理范围|单位/.test(line)).slice(0, 5);
	return (picked.length > 0 ? picked : lines.slice(0, 3)).join("\n").slice(0, 600);
}
function remember(dataDir, receipt) {
	mkdirSync(dataDir, {
		recursive: true,
		mode: 448
	});
	appendFileSync(join(dataDir, "receipts.jsonl"), `${JSON.stringify(receipt)}\n`, { mode: 384 });
}
function readReceipts(dataDir, limit = 5) {
	const path = join(dataDir, "receipts.jsonl");
	if (!existsSync(path)) return [];
	const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
	const parsed = [];
	for (const line of lines.slice(-Math.max(limit, 50))) try {
		const item = JSON.parse(line);
		if (item && typeof item.skill === "string" && typeof item.at === "string") parsed.push(item);
	} catch {}
	return parsed.slice(-limit).reverse();
}
function pruneRuns(root) {
	if (!existsSync(root)) return;
	const names = readdirSync(root).filter((name) => /^[0-9]+-/.test(name)).sort();
	for (const name of names.slice(0, Math.max(0, names.length - 30))) rmSync(join(root, name), {
		recursive: true,
		force: true
	});
}
function readProblems(runDir) {
	const path = join(runDir, "out", "problems.json");
	if (!existsSync(path)) return [];
	try {
		return JSON.parse(readFileSync(path, "utf8")).problems ?? [];
	} catch {
		return [];
	}
}
/** Add profile flags and the out flag the skill declares, unless the model already passed them. */
function autofill(card, args, request) {
	const out = [...args];
	const filled = [];
	const problems = [];
	const has = (flag) => out.includes(flag);
	if (request.useProfile !== false && request.profile) for (const spec of card.inputs) {
		if (spec.from !== "profile" || !spec.flag || has(spec.flag)) continue;
		if (spec.key === "age") {
			if (request.profile.age != null) {
				out.push(spec.flag, String(request.profile.age));
				filled.push(`${spec.flag} ${request.profile.age}（档案里保存的实足年龄）`);
			} else if (spec.required) problems.push({
				key: "age",
				label: spec.label_zh,
				kind: "missing",
				message_zh: "档案里没有实足年龄。请这个人说出年龄后用 save_personal_profile 保存，不要用出生年估算。"
			});
		}
		if (spec.key === "sex" && request.profile.sex && request.profile.sex !== "unknown" && request.profile.sex !== "other") {
			out.push(spec.flag, request.profile.sex);
			filled.push(`${spec.flag} ${request.profile.sex}（档案里保存的性别）`);
		}
	}
	const outFlag = card.entry?.out_flag ?? (card.entry ? "--out" : "");
	if (outFlag && !has(outFlag)) {
		out.push(outFlag, "out");
		filled.push(`${outFlag} out`);
	}
	return {
		args: out,
		filled,
		problems
	};
}
async function runSkill(request) {
	const catalog = loadCatalog(request.home);
	const card = catalog.cards.find((item) => item.name === request.name);
	if (!card) return fail(request.name, request.revision, "unknown_skill", catalog.error || `unknown skill ${request.name}`, "Use match_longevity_skills and pass a directory name from that list.");
	if (!card.script) return fail(request.name, catalog.revision, "no_script", "this skill has no script", "Read the skill and follow its command. Do not invent a score the script does not compute.");
	let python = request.python.trim() || "python3";
	const runtime = card.entry?.runtime ?? "";
	if (runtime) {
		const configured = request.runtimes?.[runtime]?.trim() ?? "";
		if (!configured) return fail(request.name, catalog.revision, "runtime_missing", `this skill needs the "${runtime}" runtime, which is not configured`, `Set skillRuntimes.${runtime} in the plugin config to a Python interpreter that has this skill's dependencies. Do not run it with another interpreter and do not estimate the result.`, { runtime });
		python = configured;
	}
	if (request.args.length > 40) return fail(request.name, catalog.revision, "invalid_arguments", "at most 40 arguments", "Pass only the flags the skill command lists.");
	if (request.files.length > 12) return fail(request.name, catalog.revision, "invalid_arguments", "at most 12 staged files", "Stage the files named by the skill command.");
	for (const arg of request.args) {
		const problem = checkArg(arg);
		if (problem) return fail(request.name, catalog.revision, "invalid_arguments", problem, "Paths stay inside the run directory. Do not point the script at the skill tree or the home directory.");
	}
	const files = [...request.files];
	const seen = /* @__PURE__ */ new Set();
	for (const file of files) {
		if (!FILE_NAME.test(file.name) || file.name.includes("..")) return fail(request.name, catalog.revision, "invalid_arguments", `bad file name ${file.name}`, "File names are a single path segment, such as biomarkers.csv.");
		if (seen.has(file.name)) return fail(request.name, catalog.revision, "invalid_arguments", `duplicate file ${file.name}`, "Stage each file once.");
		seen.add(file.name);
		if (typeof file.text !== "string" || file.text.length > 256e3) return fail(request.name, catalog.revision, "invalid_arguments", `${file.name} is empty or larger than 256KB`, "Stage the measurement file the skill asked for, not a PDF or a genome.");
	}
	let args = [...request.args];
	const inputKeys = [];
	const conversions = [];
	if (request.measurements && request.measurements.length > 0) {
		if (card.inputsStatus === "none" || !card.entry?.measurements_flag) return fail(request.name, catalog.revision, "invalid_arguments", "this skill does not declare measurement inputs", "Stage the file its command names with files and args instead.");
		const staged = stageMeasurements(card, request.measurements);
		if (staged.problems.length > 0) {
			const kinds = [...new Set(staged.problems.map((item) => item.kind))];
			const onlyMissing = kinds.every((kind) => kind === "missing");
			remember(request.dataDir, {
				at: (/* @__PURE__ */ new Date()).toISOString(),
				skill: request.name,
				revision: catalog.revision,
				exit_code: null,
				ok: false,
				excerpt: "",
				error_kind: onlyMissing ? "missing_inputs" : "invalid_inputs",
				input_keys: Object.keys(staged.values),
				problem_kinds: kinds,
				missing: staged.problems.filter((item) => item.kind === "missing").map((item) => item.key)
			});
			return fail(request.name, catalog.revision, onlyMissing ? "missing_inputs" : "invalid_inputs", staged.problems.map((item) => item.message_zh).join(" "), onlyMissing ? "Say which inputs are missing. Do not fill them from another file, a reference range, or memory." : "Tell the person which value or unit did not pass and why. Ask them to check the report; do not change the value yourself.", { problems: staged.problems });
		}
		if (files.some((file) => file.name === MEASUREMENTS_FILE)) return fail(request.name, catalog.revision, "invalid_arguments", `${MEASUREMENTS_FILE} is staged by the harness`, "Pass measurements or files, not both for the same table.");
		files.push({
			name: MEASUREMENTS_FILE,
			text: staged.csv
		});
		inputKeys.push(...Object.keys(staged.values));
		for (const item of staged.used) {
			if (item.factor === 1) continue;
			const label = card.inputs.find((spec) => spec.key === item.key)?.label_zh ?? item.key;
			const from = `${formatNumber(item.raw)} ${item.given_unit}`.trim();
			const to = `${formatNumber(item.value)} ${item.unit}`.trim();
			conversions.push({
				key: item.key,
				label,
				from,
				to,
				line_zh: `${label} ${from} → ${to}`
			});
		}
		const flag = card.entry.measurements_flag;
		const at = args.indexOf(flag);
		if (at >= 0) args.splice(at, 2);
		args.push(flag, MEASUREMENTS_FILE);
	}
	const filled = autofill(card, args, request);
	if (filled.problems.length > 0) {
		remember(request.dataDir, {
			at: (/* @__PURE__ */ new Date()).toISOString(),
			skill: request.name,
			revision: catalog.revision,
			exit_code: null,
			ok: false,
			excerpt: "",
			error_kind: "missing_inputs",
			input_keys: inputKeys,
			problem_kinds: ["missing"],
			missing: filled.problems.map((item) => item.key)
		});
		return fail(request.name, catalog.revision, "missing_inputs", filled.problems.map((item) => item.message_zh).join(" "), "Ask the person for the missing profile field.", { problems: filled.problems });
	}
	args = filled.args;
	const runs = join(request.dataDir, "runs");
	const runDir = join(runs, `${Date.now()}-${request.name}`);
	mkdirSync(runDir, {
		recursive: true,
		mode: 448
	});
	for (const file of files) writeFileSync(join(runDir, file.name), file.text, { mode: 384 });
	mkdirSync(join(runDir, "out"), {
		recursive: true,
		mode: 448
	});
	const timeoutMs = Math.max(1e3, Math.min(18e4, request.timeoutMs));
	const result = await new Promise((resolve) => {
		const child = spawn(python, [card.script, ...args], {
			cwd: runDir,
			shell: false,
			env: {
				PATH: process.env.PATH ?? "",
				HOME: process.env.HOME ?? "",
				LANG: process.env.LANG ?? "C.UTF-8",
				PYTHONDONTWRITEBYTECODE: "1",
				PYTHONNOUSERSITE: "1"
			}
		});
		const stdout = [];
		const stderr = [];
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(value);
		};
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			finish({
				code: null,
				stdout: "",
				stderr: "",
				error: "skill timed out"
			});
		}, timeoutMs);
		child.stdout.on("data", (chunk) => stdout.push(chunk));
		child.stderr.on("data", (chunk) => stderr.push(chunk));
		child.on("error", (error) => finish({
			code: null,
			stdout: "",
			stderr: "",
			error: error.message
		}));
		child.on("close", (code) => {
			finish({
				code,
				stdout: Buffer.concat(stdout).toString("utf8").slice(-8e3),
				stderr: Buffer.concat(stderr).toString("utf8").slice(-4e3)
			});
		});
	});
	const reportPath = join(runDir, "out", "report.md");
	const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
	const excerpt = reportExcerpt(report || result.stdout);
	const outputs = readResultFile(join(runDir, "out", "result.json"));
	const problems = readProblems(runDir);
	const levers = readLevers(runDir);
	const ok = result.code === 0 && !result.error;
	let errorKind = "";
	if (result.error) errorKind = "unavailable";
	else if (result.code === EXIT_INPUT_PROBLEM) errorKind = "input_problems";
	else if (!ok) errorKind = "script_failed";
	const payload = {
		ok,
		skill: request.name,
		revision: catalog.revision,
		exit_code: result.code,
		report_excerpt: excerpt,
		stdout_tail: result.stdout.slice(-2e3),
		stderr_tail: result.stderr.slice(-2e3),
		...request.reportLimit ? { report_text: report.slice(0, request.reportLimit) } : {},
		...Object.keys(outputs).length > 0 ? { outputs } : {},
		...problems.length > 0 ? { problems } : {},
		...filled.filled.length > 0 ? { autofilled: filled.filled } : {},
		...runtime ? { runtime } : {},
		...conversions.length > 0 ? { conversions } : {},
		...levers ? { levers } : {},
		...request.measuredAt ? { measured_at: request.measuredAt } : {},
		...result.error ? { error: result.error } : {},
		...errorKind ? { error_kind: errorKind } : {},
		...errorKind === "script_failed" ? { error: "the skill script did not exit 0" } : {},
		hint: errorKind === "input_problems" ? "The script refused its inputs. Quote the reasons in report_excerpt and problems; do not correct a value or unit yourself." : report ? "Quote report_excerpt, including the 边界 line. Cite outputs exactly. Do not add a diagnosis or a dose." : "No out/report.md was written. Say so. Do not invent the missing readout."
	};
	remember(request.dataDir, {
		at: (/* @__PURE__ */ new Date()).toISOString(),
		skill: request.name,
		revision: catalog.revision,
		exit_code: result.code,
		ok,
		excerpt,
		...errorKind ? { error_kind: errorKind } : {},
		input_keys: inputKeys,
		...problems.length > 0 ? {
			problem_kinds: [...new Set(problems.map((item) => item.kind))],
			missing: problems.filter((item) => item.kind === "missing").map((item) => item.key)
		} : {}
	});
	if (ok) recordOutputs(request.dataDir, {
		at: (/* @__PURE__ */ new Date()).toISOString(),
		skill: request.name,
		revision: catalog.revision,
		outputs,
		...request.measuredAt ? { measured_at: request.measuredAt } : {}
	});
	pruneRuns(runs);
	return payload;
}
//#endregion
//#region src/stats.ts
function isoWeek(date) {
	const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const weekday = day.getUTCDay() || 7;
	day.setUTCDate(day.getUTCDate() + 4 - weekday);
	const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
	return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function allReceipts(dataDir) {
	const path = join(dataDir, "receipts.jsonl");
	if (!existsSync(path)) return [];
	const rows = [];
	for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) try {
		const item = JSON.parse(line);
		if (item && typeof item.skill === "string" && typeof item.at === "string") rows.push(item);
	} catch {}
	return rows;
}
function bump(counter, key) {
	if (!key) return;
	counter[key] = (counter[key] ?? 0) + 1;
}
function buildStats(dataDir, days = 7, now = /* @__PURE__ */ new Date()) {
	const since = /* @__PURE__ */ new Date(now.getTime() - days * 864e5);
	const bySkill = /* @__PURE__ */ new Map();
	let runs = 0;
	for (const receipt of allReceipts(dataDir)) {
		const at = new Date(receipt.at);
		if (Number.isNaN(at.getTime()) || at < since || at > now) continue;
		runs += 1;
		const row = bySkill.get(receipt.skill) ?? {
			skill: receipt.skill,
			runs: 0,
			ok: 0,
			error_kinds: {},
			problem_kinds: {},
			missing_inputs: {}
		};
		row.runs += 1;
		if (receipt.ok) row.ok += 1;
		bump(row.error_kinds, receipt.error_kind);
		for (const kind of receipt.problem_kinds ?? []) bump(row.problem_kinds, kind);
		for (const key of receipt.missing ?? []) bump(row.missing_inputs, key);
		bySkill.set(receipt.skill, row);
	}
	return {
		schema: "longpi-stats/1",
		week: isoWeek(now),
		since: since.toISOString(),
		until: now.toISOString(),
		runs,
		skills: [...bySkill.values()].sort((a, b) => b.runs - a.runs || a.skill.localeCompare(b.skill))
	};
}
function writeStats(dataDir, now = /* @__PURE__ */ new Date()) {
	const stats = buildStats(dataDir, 7, now);
	mkdirSync(dataDir, {
		recursive: true,
		mode: 448
	});
	const path = join(dataDir, `stats-${stats.week}.json`);
	writeFileSync(path, `${JSON.stringify(stats, null, 2)}\n`, { mode: 384 });
	return path;
}
//#endregion
//#region src/version.ts
const PRODUCT_VERSION = "4.0.0";
const PRODUCT_NAME = "dsh-plugin-longpi";
const TOOL_NAMES = [
	"read_personal_situation",
	"list_longevity_intents",
	"match_longevity_skills",
	"read_longevity_skill",
	"run_longevity_skill",
	"query_longevity_evidence",
	"list_longevity_domains",
	"save_personal_profile",
	"longpi_status",
	"save_intervention_plan",
	"log_intervention_checkin",
	"read_intervention_plan",
	"review_interventions",
	"model_intervention_goals"
];
const HARNESS_SKILLS = [
	"longpi-dispatch",
	"longpi-board",
	"longpi-boundary",
	"longpi-interventions"
];
//#endregion
//#region src/commands.ts
function argsOf(raw, name) {
	const text = raw.trim().replace(/^\//, "");
	if (text === name) return "";
	if (text.startsWith(`${name} `)) return text.slice(name.length).trim();
	return text;
}
function registerCommands(ctx, config, mount) {
	ctx.inject(["commands"], (scoped) => {
		scoped.commands.register({
			name: "longpi",
			description: "打印个人看板摘要：技能库版本、档案、Mirobody 是否接上。不含检验数值。",
			handler: () => {
				const current = config();
				const catalog = loadCatalog(resolveSkillsHome(current.skillsHome));
				const profile = readProfile(resolveDataDir(current.dataDir));
				const lines = [
					`${PRODUCT_NAME} ${PRODUCT_VERSION}`,
					catalog.error ? `skills unavailable: ${catalog.error}` : `skills ${catalog.cards.length} (personal ${catalog.cards.filter((card) => card.tier !== "C").length})  version ${catalog.version || "unversioned"}  revision ${catalog.revision || "unknown"}  from ${catalog.source}`,
					`profile age ${profile.age ?? "unset"}  sex ${profile.sex}  birth ${profile.birthYear ?? "unset"}`,
					mount.mounted ? `mirobody mounted${mount.peer ? " (already loaded beside this plugin)" : ""}` : `mirobody not mounted: ${mount.error || "checkout missing"}`,
					current.mcpUrl.trim() ? "record server configured" : "record server not configured"
				];
				const last = readReceipts(resolveDataDir(current.dataDir), 1)[0];
				if (last) lines.push(`last skill ${last.skill}  ok ${last.ok}`);
				return {
					kind: catalog.error ? "error" : "success",
					text: lines.join("\n")
				};
			}
		});
		scoped.commands.register({
			name: "longpi-skills",
			description: "按一句话匹配长寿技能。例：/longpi-skills 表型年龄",
			handler: (invocation) => {
				const question = argsOf(invocation.rawInput, "longpi-skills");
				const current = config();
				const catalog = loadCatalog(resolveSkillsHome(current.skillsHome));
				if (catalog.error) return {
					kind: "error",
					text: catalog.error
				};
				const matched = matchSkills(catalog.cards, question, [], clampMatches(current.maxSkillMatches), { intents: catalog.intents });
				if (matched.matches.length === 0) return {
					kind: "success",
					text: matched.note
				};
				return {
					kind: "success",
					text: matched.matches.map((item) => `${item.name}  ${item.why.join("；") || item.domain}`).join("\n")
				};
			}
		});
		scoped.commands.register({
			name: "longpi-stats",
			description: "把最近 7 天的匿名运行统计写到本地文件：技能名、是否跑完、失败原因和缺了哪些输入。不含任何数值。",
			handler: () => {
				return {
					kind: "success",
					text: `wrote ${writeStats(resolveDataDir(config().dataDir))}\nIt holds counts only. Share it with the skill maintainers if you want to.`
				};
			}
		});
		scoped.commands.register({
			name: "longpi-version",
			description: "打印 dsh-plugin-longpi 版本。",
			handler: () => ({
				kind: "success",
				text: `${PRODUCT_NAME} ${PRODUCT_VERSION}`
			})
		});
	});
}
//#endregion
//#region src/guardrails.ts
const EMERGENCY = [
	"胸痛",
	"胸口疼",
	"胸口痛",
	"心口疼",
	"呼吸困难",
	"喘不上气",
	"喘不过气",
	"晕倒",
	"晕厥",
	"昏迷",
	"意识不清",
	"抽搐",
	"大出血",
	"吐血",
	"自杀",
	"不想活",
	"想死",
	"轻生",
	"割腕",
	"严重过敏",
	"中风",
	"脑梗",
	"心梗",
	"半身麻木",
	"口角歪斜",
	"chest pain",
	"can't breathe",
	"cannot breathe",
	"fainted",
	"seizure",
	"suicide",
	"kill myself",
	"overdose",
	"stroke",
	"heart attack"
];
const MEDICINE = /(药|药物|药片|胶囊|处方|medication|medicine|drug|pill|tablet)/i;
const DRUGS = [
	"二甲双胍",
	"阿司匹林",
	"雷帕霉素",
	"西罗莫司",
	"他汀",
	"阿托伐他汀",
	"瑞舒伐他汀",
	"辛伐他汀",
	"降压药",
	"降糖药",
	"胰岛素",
	"司美格鲁肽",
	"替尔泊肽",
	"利拉鲁肽",
	"阿卡波糖",
	"达格列净",
	"恩格列净",
	"华法林",
	"氯吡格雷",
	"左甲状腺素",
	"优甲乐",
	"激素",
	"泼尼松",
	"地塞米松",
	"褪黑素",
	"安眠药",
	"抗抑郁药",
	"达沙替尼",
	"槲皮素",
	"非瑟酮",
	"白藜芦醇",
	"nmn",
	"nr",
	"烟酰胺核糖",
	"烟酰胺单核苷酸",
	"亚精胺",
	"尿石素",
	"辅酶q10",
	"维生素d",
	"维生素",
	"鱼油",
	"补剂",
	"保健品",
	"metformin",
	"aspirin",
	"rapamycin",
	"sirolimus",
	"statin",
	"atorvastatin",
	"rosuvastatin",
	"insulin",
	"semaglutide",
	"tirzepatide",
	"acarbose",
	"warfarin",
	"clopidogrel",
	"levothyroxine",
	"prednisone",
	"melatonin",
	"dasatinib",
	"quercetin",
	"fisetin",
	"resveratrol",
	"spermidine",
	"urolithin",
	"coq10",
	"vitamin d",
	"fish oil",
	"supplement"
];
const STRONG = new RegExp([
	"停药",
	"断药",
	"加药",
	"减药",
	"换药",
	"加量",
	"减量",
	"减半",
	"加大剂量",
	"改剂量",
	"调整剂量",
	"能停",
	"可以停",
	"要不要停",
	"该不该停",
	"能不能停",
	"能不能不吃",
	"可以不吃",
	"要不要吃",
	"该不该吃",
	"能不能吃",
	"可以吃吗",
	"能吃吗",
	"吃多少",
	"吃几",
	"多少毫克",
	"多少mg",
	"多少微克",
	"怎么吃",
	"吃法",
	"increase (the |my )?dose",
	"decrease (the |my )?dose",
	"change (my |the )?dose",
	"dosage",
	"how much [a-z0-9 -]{0,40}(should|can|do|to) i? ?take",
	"should i (take|stop|start|keep|quit)",
	"start taking",
	"keep taking",
	"quit (taking|my)",
	"come off"
].join("|"), "i");
const WEAK = new RegExp([
	"停掉",
	"停了",
	"停用",
	"停吃",
	"戒掉",
	"不吃",
	"别吃",
	"不用吃",
	"不用再吃",
	"不再吃",
	"继续吃",
	"还要吃",
	"还用吃",
	"开始吃",
	"开始服",
	"开始用",
	"开始打",
	"一天吃",
	"每天吃",
	"一次吃",
	"剂量",
	"用量",
	"换成",
	"加大",
	"stop (taking|my|the)"
].join("|"), "i");
const ASK = /(吗|？|\?|要不要|该不该|能不能|可不可以|是否|应不应该|应该|需不需要|建议|怎么办|怎么样|如何|多少|合适|推荐|should|could|can i|how much|how many|recommend|advise)/i;
const INTENT = /(我想|打算|准备|考虑|帮我|给我|请你|请帮)(?!记录|记一下|记下|保存|存下|存一下|打卡|上传|录入|整理|看看|查)/;
let rememberedDrugs = [];
/** Names from this person's medication plan, so "停掉<药名>" is caught too. */
function rememberMedications(names) {
	rememberedDrugs = names.map((name) => name.trim()).filter((name) => name.length >= 2).slice(0, 60);
}
function mentionsMedicine(text) {
	const lower = text.toLowerCase();
	if (MEDICINE.test(text)) return true;
	for (const name of [...DRUGS, ...rememberedDrugs]) {
		const item = name.toLowerCase();
		if (/^[a-z0-9 ]+$/.test(item)) {
			if (new RegExp(`(?<![a-z0-9])${item}(?![a-z0-9])`, "i").test(lower)) return true;
		} else if (lower.includes(item)) return true;
	}
	return false;
}
function preGuard(text) {
	const lower = text.toLowerCase();
	if (EMERGENCY.some((item) => lower.includes(item.toLowerCase()))) return {
		code: "emergency",
		reply_zh: "如果您正在经历紧急不适，请立即拨打 120 或当地急救电话。在美国可拨打或发短信至 988。我不能替代急救，也不会给出处理步骤。"
	};
	if ((STRONG.test(text) || WEAK.test(text) && (ASK.test(text) || INTENT.test(text))) && mentionsMedicine(text)) return {
		code: "no_medication_change",
		reply_zh: "我不能建议开始、停止、继续、加量、减量或更换药物和补剂，也不给剂量。用药记录只读。调整处方请联系开具该药的医生或药师。"
	};
	return null;
}
function extractUserText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((block) => {
		if (block && typeof block === "object" && "type" in block && block.type === "text") return String(block.text ?? "");
		return "";
	}).join("\n");
}
function wrapGuardMessage(text, hit) {
	return [
		hit.reply_zh,
		"",
		"Answer with that boundary only. Do not add a diagnosis, a dose, a treatment step, or a skill report.",
		"For a medication question you may offer to look up what the collected papers say (query_longevity_evidence), without a dose and without telling them to start or stop.",
		`The user said: ${text.slice(0, 500)}`
	].join("\n");
}
//#endregion
//#region src/harness-skills.ts
function parseSkill(raw) {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) throw new Error("harness SKILL.md missing frontmatter");
	const fm = match[1] ?? "";
	const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
	const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
	if (!name || !description) throw new Error("harness SKILL.md missing name or description");
	return {
		name,
		description,
		content: (match[2] ?? "").trim()
	};
}
function registerHarnessSkills(ctx) {
	ctx.inject(["skills"], (scoped) => {
		const root = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
		for (const dir of HARNESS_SKILLS) {
			const skill = parseSkill(readFileSync(join(root, dir, "SKILL.md"), "utf8"));
			scoped.skills.register({
				name: skill.name,
				description: skill.description,
				content: skill.content,
				source: "runtime",
				invocation: {
					modelInvocable: true,
					userInvocable: false
				}
			});
		}
	});
}
//#endregion
//#region src/mirobody.ts
async function mountMirobody(ctx, config, pluginHome) {
	if (!pluginHome) return {
		mounted: false,
		peer: false,
		error: "dsh-plugin-mirobody checkout not found",
		pluginHome: ""
	};
	try {
		const loaded = await import(pathToFileURL(join(pluginHome, "lib", "index.js")).href);
		if (typeof loaded.apply !== "function") return {
			mounted: false,
			peer: false,
			error: "mirobody plugin has no apply()",
			pluginHome
		};
		await loaded.apply(ctx, config);
		return {
			mounted: true,
			peer: false,
			error: "",
			pluginHome
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("already registered")) return {
			mounted: true,
			peer: true,
			error: "",
			pluginHome
		};
		return {
			mounted: false,
			peer: false,
			error: message.slice(0, 400),
			pluginHome
		};
	}
}
//#endregion
//#region src/prompt.ts
function registerPrompt(ctx, _config, mount) {
	ctx.inject(["systemPrompt"], (scoped) => {
		scoped.systemPrompt.section({
			name: "longpi:persona",
			order: 20,
			text: () => [
				`You are LongPi ${PRODUCT_VERSION}, a personal longevity harness inside DeepSeek Harness.`,
				"Methods live in the longevity-skills checkout. You do not recompute a clock in your head and you do not invent a coefficient, a cutoff, or a missing input.",
				"Dispatch with tools, in this order: read_personal_situation, match_longevity_skills (pass an intent id from list_longevity_intents when you know it), read_longevity_skill, then run_longevity_skill only if that skill has a script and its inputs are present.",
				"Questions about whether a drug, supplement or diet works, or what research says about a gene, go to query_longevity_evidence. Report its human, animal and cell sections as they are; an animal result is not a human effect.",
				"Use only skill names match_longevity_skills returned. Read a skill before running it. Skills marked tier C are animal or cell work; use them only when the person asked about that organism.",
				"When read_longevity_skill says structured_measurements, pass run_longevity_skill measurements copied from the record with their units exactly as recorded; the harness converts units, checks ranges and fills the saved age. Never convert a unit yourself. If the harness or the script refuses an input, say which one and why.",
				"Otherwise stage files from tool results. Never fill a missing biomarker from another file, a reference range, or memory.",
				"earlier_readouts are this person's past skill outputs; a before-and-after skill may use them, cited with their dates.",
				mount.mounted ? "Mirobody tools in this process resolve LOINC and read the chart. They are the only record. Absence is not normal and not a negative genotype." : `Mirobody is not mounted (${mount.error || "checkout missing"}). Do not invent records.`,
				"Never diagnose. Never say 患有 or 治愈. Never advise starting, stopping, increasing, decreasing, or switching a medicine or a dose.",
				"A cohort hazard ratio is not this person's risk. An experimental dose is not an instruction. A model-organism result is not a human dose.",
				"If the user describes an emergency, tell them to call 120 (988 in the US) and stop.",
				"Reply in the user's language. Every number you cite comes from a tool result. When you quote a report, include its 边界 line."
			].join("\n")
		});
	});
}
//#endregion
//#region src/board.ts
function buildBoard(input) {
	const personal = input.catalog.cards.filter((card) => card.tier !== "C");
	const domains = domainSummary(personal).map((row) => ({
		domain: row.domain,
		count: row.count
	}));
	const outputs = input.outputs ?? {};
	const dispatch = matchSkills(input.catalog.cards, "", input.records.indicators, input.limit, {
		intents: input.catalog.intents,
		profile: {
			age: input.records.profile.age,
			sex: input.records.profile.sex
		},
		outputs
	});
	return {
		product: "dsh-plugin-longpi",
		version: PRODUCT_VERSION,
		profile: input.records.profile,
		estimated_age: input.records.estimated_age,
		skills: {
			home_set: Boolean(input.catalog.home),
			revision: input.catalog.revision,
			version: input.catalog.version,
			count: input.catalog.cards.length,
			personal: personal.length,
			error: input.catalog.error,
			domains,
			intents: input.catalog.intents.map((intent) => ({
				id: intent.id,
				label: intent.label_zh
			}))
		},
		mirobody: {
			mounted: input.mount.mounted,
			peer: input.mount.peer,
			error: input.mount.error,
			engine: input.records.engine,
			mcp: input.records.mcp
		},
		records: {
			status: input.records.record_status,
			error: input.records.record_error,
			indicator_count: input.records.indicators.length,
			indicators: input.records.indicators.slice(0, 20),
			medications: input.records.medications.slice(0, 20)
		},
		dispatch: {
			matches: dispatch.matches,
			note: dispatch.note
		},
		near: dispatch.near,
		readouts: Object.entries(outputs).map(([key, item]) => ({
			key,
			...item
		})).slice(0, 12),
		receipts: input.receipts,
		boundary: "这不是诊断，也不能改处方。技能没写出的数字不要补。紧急情况请拨打 120。"
	};
}
//#endregion
//#region src/bridge.ts
const PYTHON_CANDIDATES = [
	"python3.14",
	"python3.13",
	"python3.12",
	"python3"
];
function discoverPython(configured, pluginHome) {
	const explicit = configured.trim() || process.env.MIROBODY_PYTHON?.trim() || "";
	if (explicit) return explicit;
	const venv = pluginHome ? join(pluginHome, ".venv", "bin", "python") : "";
	if (venv && existsSync(venv)) return venv;
	for (const bin of PYTHON_CANDIDATES) {
		const found = spawnSync("/usr/bin/which", [bin], { encoding: "utf8" });
		const path = found.stdout.trim();
		if (found.status === 0 && path && existsSync(path)) return path;
	}
	return "python3";
}
function runBridgeStatus(pluginHome, python, mirobodyHome, timeoutMs) {
	if (!pluginHome) return {
		ok: false,
		error: "mirobody plugin checkout not found"
	};
	const script = join(pluginHome, "bridge", "dsh_bridge.py");
	if (!existsSync(script)) return {
		ok: false,
		error: "mirobody bridge script is missing"
	};
	const result = spawnSync(python, [script], {
		input: JSON.stringify({ op: "status" }),
		encoding: "utf8",
		timeout: timeoutMs,
		env: {
			...process.env,
			MIROBODY_HOME: mirobodyHome.trim(),
			PYTHONDONTWRITEBYTECODE: "1"
		}
	});
	if (result.error) return {
		ok: false,
		python,
		error: result.error.message
	};
	const text = (result.stdout ?? "").trim();
	if (!text) return {
		ok: false,
		python,
		error: (result.stderr ?? "bridge produced no JSON").slice(0, 300)
	};
	try {
		const parsed = JSON.parse(text);
		return {
			...parsed,
			python: parsed.python || python
		};
	} catch {
		return {
			ok: false,
			python,
			error: "bridge status was not JSON"
		};
	}
}
//#endregion
//#region src/mcp.ts
function endpoint(raw) {
	try {
		const url = new URL(raw.trim());
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url;
	} catch {
		return null;
	}
}
function mcpHost(raw) {
	return endpoint(raw)?.host ?? "";
}
function parseBody(text) {
	const trimmed = text.trim();
	if (!trimmed) throw new Error("empty MCP response");
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
	const payloads = [];
	for (const line of trimmed.split("\n")) {
		if (!line.startsWith("data:")) continue;
		const payload = line.slice(5).trim();
		if (payload && payload !== "[DONE]") payloads.push(payload);
	}
	if (payloads.length === 0) throw new Error("MCP response had no JSON");
	return JSON.parse(payloads[payloads.length - 1] ?? "");
}
function unwrap(message) {
	if (!message || typeof message !== "object") return {
		success: false,
		error_kind: "internal",
		error: "MCP response was not an object"
	};
	const body = message;
	if (body.error) {
		const denied = body.error.code === -32e3 || /auth/i.test(body.error.message ?? "");
		return {
			success: false,
			error_kind: denied ? "denied" : "internal",
			error: body.error.message || "MCP error",
			code: body.error.code,
			hint: denied ? "Mirobody refused this call. Set mcpToken to the account JWT, or paste the personal MCP URL." : "The Mirobody MCP server returned an error. Do not invent the missing record."
		};
	}
	const structured = body.result?.structuredContent;
	if (structured !== void 0) return {
		success: true,
		result: structured
	};
	const content = body.result?.content;
	if (Array.isArray(content)) {
		const text = content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
		if (!text) return {
			success: true,
			result: body.result
		};
		try {
			return {
				success: true,
				result: JSON.parse(text)
			};
		} catch {
			return {
				success: true,
				text
			};
		}
	}
	return {
		success: true,
		result: body.result ?? message
	};
}
async function postJson(url, token, body, session, timeoutMs) {
	const headers = {
		"content-type": "application/json",
		accept: "application/json, text/event-stream",
		"mcp-protocol-version": "2025-06-18"
	};
	if (token.trim()) headers.authorization = `Bearer ${token.trim()}`;
	if (session) headers["mcp-session-id"] = session;
	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs)
	});
	return {
		status: response.status,
		session: response.headers.get("mcp-session-id") ?? session,
		text: await response.text()
	};
}
async function callMcpTool(options) {
	const target = endpoint(options.url);
	if (!target) return {
		success: false,
		error_kind: "unavailable",
		error: "mcpUrl is empty or not http(s)",
		hint: "Run Mirobody and set mcpUrl. The harness does not keep a second copy of the chart."
	};
	const url = target.toString();
	try {
		const init = await postJson(url, options.token, {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: {
					name: "dsh-plugin-longpi",
					version: PRODUCT_VERSION
				}
			}
		}, "", options.timeoutMs);
		if (init.status === 401 || init.status === 403) return {
			success: false,
			error_kind: "denied",
			error: `MCP HTTP ${init.status}`,
			hint: "Set mcpToken to a Mirobody JWT, or use the personal MCP URL from Settings → MCP."
		};
		if (init.session) await postJson(url, options.token, {
			jsonrpc: "2.0",
			method: "notifications/initialized"
		}, init.session, options.timeoutMs).catch(() => void 0);
		const call = await postJson(url, options.token, {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: {
				name: options.name,
				arguments: options.args
			}
		}, init.session, options.timeoutMs);
		if (call.status === 401 || call.status === 403) return {
			success: false,
			error_kind: "denied",
			error: `MCP HTTP ${call.status}`,
			hint: "The Mirobody account token was rejected."
		};
		return unwrap(parseBody(call.text));
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		return {
			success: false,
			error_kind: timedOut ? "unavailable" : "internal",
			error: error instanceof Error ? error.message : "MCP call failed",
			hint: timedOut ? "The Mirobody server did not answer before timeoutMs." : "Could not reach mcpUrl. Do not fill the gap with guessed labs."
		};
	}
}
function redact(text, secrets) {
	let out = text;
	for (const secret of secrets) {
		const trimmed = secret.trim();
		if (trimmed.length < 4) continue;
		out = out.split(trimmed).join("[redacted]");
	}
	return out.slice(0, 500);
}
//#endregion
//#region src/compact.ts
const META_LINE = /^\((?:window|resolution|aggregate|rows)=/;
const CONSTANTS = "(constants: ";
function emptyMeta() {
	return {
		window: "",
		tz: "",
		resolution: "",
		aggregate: "",
		rows: null,
		total: null,
		truncated: false
	};
}
/** Split "k=v, k=v" where a value may itself contain ", " — a pair only starts at ", name=". */
function parsePairs(body) {
	const pairs = [];
	const starts = [];
	const pattern = /(?:^|, )([a-z_][a-z0-9_]*)=/g;
	for (let match = pattern.exec(body); match; match = pattern.exec(body)) starts.push({
		at: match.index,
		key: match[1] ?? "",
		value: match.index + match[0].length
	});
	for (let i = 0; i < starts.length; i += 1) {
		const here = starts[i];
		if (!here) continue;
		const end = starts[i + 1]?.at ?? body.length;
		pairs.push([here.key, body.slice(here.value, end)]);
	}
	return pairs;
}
function parseMeta(line) {
	const meta = emptyMeta();
	const inner = line.slice(1, line.endsWith(")") ? -1 : void 0);
	for (const part of inner.split(", ")) {
		const eq = part.indexOf("=");
		if (eq < 0) {
			if (part === "truncated") meta.truncated = true;
			const of = /^of (\d+)$/.exec(part);
			if (of) meta.total = Number(of[1]);
			continue;
		}
		const key = part.slice(0, eq);
		const value = part.slice(eq + 1);
		if (key === "window") meta.window = value;
		else if (key === "tz") meta.tz = value;
		else if (key === "resolution") meta.resolution = value;
		else if (key === "aggregate") meta.aggregate = value;
		else if (key === "rows") meta.rows = Number(value);
	}
	return meta;
}
function parseCompact(text) {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const first = (lines.find((line) => line.trim()) ?? "").trim();
	const refusal = /^error \(([a-z_]+)\): ?(.*)$/.exec(first);
	if (refusal) return {
		rows: [],
		meta: emptyMeta(),
		notes: [],
		error: {
			kind: refusal[1] ?? "internal",
			message: refusal[2] ?? ""
		}
	};
	let metaAt = -1;
	for (let i = lines.length - 1; i > 0; i -= 1) if (lines[i - 1] === "" && META_LINE.test(lines[i] ?? "")) {
		metaAt = i;
		break;
	}
	const body = metaAt >= 0 ? lines.slice(0, metaAt - 1) : lines.filter((line) => line.trim());
	const meta = metaAt >= 0 ? parseMeta(lines[metaAt] ?? "") : emptyMeta();
	const notes = metaAt >= 0 ? lines.slice(metaAt + 1).filter((line) => line.trim()) : [];
	let at = 0;
	const constants = {};
	const head = body[0] ?? "";
	if (head.startsWith(CONSTANTS) && head.endsWith(")")) {
		for (const [key, value] of parsePairs(head.slice(12, -1))) constants[key] = value;
		at = 1;
	}
	const rest = body.slice(at).filter((line) => !line.startsWith("… cut at"));
	if (rest[0] === "(no rows)" || rest.length === 0 && Object.keys(constants).length === 0) return {
		rows: [],
		meta,
		notes
	};
	if (rest.length === 0) return {
		rows: [{ ...constants }],
		meta,
		notes
	};
	const header = (rest[0] ?? "").split("|");
	const rows = [];
	for (const line of rest.slice(1)) {
		const cells = line.split("|");
		if (cells.length > header.length) {
			const keep = cells.slice(0, header.length - 1);
			keep.push(cells.slice(header.length - 1).join("|"));
			cells.splice(0, cells.length, ...keep);
		}
		const row = { ...constants };
		header.forEach((column, i) => {
			row[column] = cells[i] ?? "";
		});
		rows.push(row);
	}
	return {
		rows,
		meta,
		notes
	};
}
/**
* The table inside one MCP tool payload. Mirobody wraps it as {result: "<table>",
* status, row_count, truncated}; a transport may hand over the bare text. Returns
* null when the payload is not a compact table (an older JSON shape).
*/
function tableOf(payload) {
	if (typeof payload === "string") return looksCompact(payload) ? parseCompact(payload) : null;
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
	const result = payload.result;
	if (typeof result === "string" && looksCompact(result)) return parseCompact(result);
	return null;
}
function looksCompact(text) {
	const trimmed = text.trim();
	if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
	return trimmed.includes("|") || trimmed.startsWith(CONSTANTS) || trimmed.startsWith("(no rows)") || trimmed.startsWith("error (") || /\n\((?:window|rows)=/.test(trimmed);
}
/** A cell as a number, or null for an empty or non-numeric cell ("Positive", "<0.5"). */
function cellNumber(value) {
	if (value == null) return null;
	const text = value.trim();
	if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(text)) return null;
	const number = Number(text);
	return Number.isFinite(number) ? number : null;
}
//#endregion
//#region src/situation.ts
function asRecord(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value;
}
function textOf(value) {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
}
function firstText(rec, keys) {
	for (const key of keys) {
		const text = textOf(rec[key]);
		if (text) return text;
	}
	return "";
}
function loincOf(row) {
	return (row.system ?? "").toLowerCase() === "loinc" ? (row.code ?? "").trim() : "";
}
/** Rows of a Mirobody catalogue or latest table as indicator rows. */
function indicatorsFromTable(table) {
	const out = [];
	for (const row of table.rows) {
		const name = (row.indicator ?? "").trim();
		if (!name) continue;
		const item = {
			name,
			value: (row.value ?? row.last ?? "").trim(),
			unit: (row.unit ?? "").trim()
		};
		const loinc = loincOf(row);
		if (loinc) item.loinc = loinc;
		const label = (row.name ?? "").trim();
		if (label && label !== name) item.label = label;
		const date = (row.date || row.last_date || (row.time ?? "").slice(0, 10)).trim();
		if (date && item.value) item.date = date;
		if (row.count && /^\d+$/.test(row.count)) item.count = Number(row.count);
		if (row.first_date) item.first_date = row.first_date;
		if (row.last_date) item.last_date = row.last_date;
		out.push(item);
	}
	return out;
}
function summarizeIndicators(payload, max = 40) {
	const table = tableOf(payload);
	const rows = [];
	if (table) rows.push(...indicatorsFromTable(table));
	else walkIndicators(payload, rows, 0, Math.max(max * 2, 80));
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
	for (const row of rows) {
		const key = row.name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(row);
		if (unique.length >= max) break;
	}
	return unique;
}
function walkIndicators(value, rows, depth, cap) {
	if (depth > 8 || rows.length >= cap) return;
	if (Array.isArray(value)) {
		for (const item of value) if (typeof item === "string") {
			const name = item.trim();
			if (name) rows.push({
				name,
				value: "",
				unit: ""
			});
		} else walkIndicators(item, rows, depth + 1, cap);
		return;
	}
	const rec = asRecord(value);
	if (!rec) return;
	const name = firstText(rec, [
		"indicator",
		"indicator_name",
		"name",
		"title"
	]);
	const measurement = firstText(rec, [
		"value",
		"latest",
		"result",
		"last_value"
	]);
	const unit = firstText(rec, ["unit", "ucum"]);
	const loinc = firstText(rec, [
		"loinc",
		"loinc_code",
		"loincCode"
	]);
	if (name && (measurement || unit)) rows.push(loinc ? {
		name,
		value: measurement,
		unit,
		loinc
	} : {
		name,
		value: measurement,
		unit
	});
	for (const [key, child] of Object.entries(rec)) {
		if (key === "name" || key === "value" || key === "unit") continue;
		if (child && typeof child === "object") walkIndicators(child, rows, depth + 1, cap);
	}
}
function summarizeMedications(payload) {
	const table = tableOf(payload);
	const rows = [];
	if (table) for (const row of table.rows) {
		const name = (row.medication ?? "").trim();
		if (!name) continue;
		const item = {
			name,
			status: (row.status ?? "").trim(),
			recorded_dose: (row.dose ?? "").trim()
		};
		if (row.schedule) item.schedule = row.schedule;
		if (row.since) item.since = row.since;
		if (row.until) item.until = row.until;
		if (row.plan_id) item.plan_id = row.plan_id;
		rows.push(item);
	}
	else walkMedications(payload, rows, 0);
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
	for (const row of rows) {
		const key = row.name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(row);
		if (unique.length >= 30) break;
	}
	return unique;
}
function walkMedications(value, rows, depth) {
	if (depth > 8 || rows.length >= 60) return;
	if (Array.isArray(value)) {
		for (const item of value) walkMedications(item, rows, depth + 1);
		return;
	}
	const rec = asRecord(value);
	if (!rec) return;
	const name = firstText(rec, [
		"drug",
		"medication",
		"medicine",
		"name",
		"title"
	]);
	const status = firstText(rec, ["status", "state"]);
	const recorded = firstText(rec, [
		"dose",
		"dosage",
		"strength",
		"recorded_dose"
	]);
	if (name && (status || recorded || rec.dose != null || rec.status != null)) rows.push({
		name,
		status,
		recorded_dose: recorded
	});
	for (const [key, child] of Object.entries(rec)) {
		if ([
			"name",
			"dose",
			"status",
			"drug"
		].includes(key)) continue;
		if (child && typeof child === "object") walkMedications(child, rows, depth + 1);
	}
}
//#endregion
//#region src/records.ts
const MAX_INDICATORS = 400;
const LATEST_CHUNK = 50;
/** One conversation turn calls several tools that each need the record; read it once. */
const CACHE_TTL_MS$1 = 6e4;
const SERIES_CHUNK = 12;
function memberArgs(member) {
	const trimmed = member.trim();
	return trimmed ? { member: trimmed } : {};
}
function payloadOf(result) {
	if (result.success === false) return null;
	return result.result ?? result.text ?? null;
}
const cache = /* @__PURE__ */ new Map();
function cacheKey(config, kind, extra = "") {
	return [
		kind,
		config.mcpUrl.trim(),
		config.member.trim(),
		config.mirobodyHome,
		config.pythonBin,
		extra
	].join("\0");
}
async function cached(key, load) {
	const now = Date.now();
	const hit = cache.get(key);
	if (hit && now - hit.at < CACHE_TTL_MS$1) return hit.value;
	const value = load();
	cache.set(key, {
		at: now,
		value
	});
	value.catch(() => cache.delete(key));
	for (const [name, entry] of cache) if (now - entry.at >= CACHE_TTL_MS$1) cache.delete(name);
	return value;
}
/** Forget cached record reads, after a change the next read must see. */
function invalidateRecords() {
	cache.clear();
}
async function loadRecords(config, dataDir, pluginHome) {
	const profile = readProfile(dataDir);
	const remote = await cached(cacheKey(config, "records", pluginHome), () => loadRemote(config, pluginHome));
	return {
		profile,
		estimated_age: estimatedAge(profile.birthYear, (/* @__PURE__ */ new Date()).getFullYear()),
		...remote,
		indicators: remote.indicators.map((row) => ({ ...row })),
		medications: remote.medications.map((row) => ({ ...row }))
	};
}
async function loadRemote(config, pluginHome) {
	const engine = runBridgeStatus(pluginHome, discoverPython(config.pythonBin, pluginHome), config.mirobodyHome, config.timeoutMs);
	const configured = Boolean(config.mcpUrl.trim());
	const snapshot = {
		engine,
		mcp: {
			configured,
			host: mcpHost(config.mcpUrl),
			token_set: Boolean(config.mcpToken.trim())
		},
		indicators: [],
		medications: [],
		record_status: configured ? "ok" : "unconfigured",
		record_error: ""
	};
	if (!configured) return snapshot;
	const secrets = [config.mcpToken, config.mcpUrl];
	const catalogue = await callMcpTool({
		url: config.mcpUrl,
		token: config.mcpToken,
		name: "query_health_indicators",
		args: memberArgs(config.member),
		timeoutMs: config.timeoutMs
	});
	if (catalogue.success === false) {
		snapshot.record_status = "error";
		snapshot.record_error = redact(catalogue.error || "record read failed", secrets);
		return snapshot;
	}
	const refused = tableOf(payloadOf(catalogue))?.error;
	if (refused) {
		snapshot.record_status = "error";
		snapshot.record_error = redact(`${refused.kind}: ${refused.message}`, secrets);
		return snapshot;
	}
	snapshot.indicators = summarizeIndicators(payloadOf(catalogue), MAX_INDICATORS);
	const names = snapshot.indicators.filter((item) => !item.value).map((item) => item.name).filter(Boolean);
	if (names.length > 0) {
		const filled = /* @__PURE__ */ new Map();
		for (let start = 0; start < names.length; start += LATEST_CHUNK) {
			const latest = await callMcpTool({
				url: config.mcpUrl,
				token: config.mcpToken,
				name: "query_health_indicators",
				args: {
					...memberArgs(config.member),
					indicators: names.slice(start, start + LATEST_CHUNK),
					aggregate: "latest"
				},
				timeoutMs: config.timeoutMs
			});
			if (latest.success === false) break;
			for (const row of summarizeIndicators(payloadOf(latest), MAX_INDICATORS)) if (row.value) filled.set(row.name.toLowerCase(), row);
		}
		if (filled.size > 0) snapshot.indicators = snapshot.indicators.map((item) => {
			const hit = filled.get(item.name.toLowerCase());
			return hit ? {
				...item,
				...hit,
				loinc: hit.loinc ?? item.loinc
			} : item;
		});
	}
	const meds = await callMcpTool({
		url: config.mcpUrl,
		token: config.mcpToken,
		name: "query_medications",
		args: {
			...memberArgs(config.member),
			view: "plan"
		},
		timeoutMs: config.timeoutMs
	});
	if (meds.success === false) snapshot.record_error = redact(meds.error || "medication read failed", secrets);
	else {
		snapshot.medications = summarizeMedications(payloadOf(meds));
		rememberMedications(snapshot.medications.map((item) => item.name));
	}
	return snapshot;
}
/**
* Dated values of named indicators, oldest first. resolution raw returns every
* reading (labs); day returns one daily mean per indicator (wearables). Values
* that are not numbers ("Positive", "<0.5") are left out, never guessed.
*/
async function loadSeries(config, names, options) {
	const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
	if (wanted.length === 0 || !config.mcpUrl.trim()) return {
		series: {},
		truncated: false,
		...config.mcpUrl.trim() ? {} : { error: "mcpUrl is not set" }
	};
	return cached(cacheKey(config, "series", JSON.stringify([wanted, options])), async () => {
		const out = {
			series: {},
			truncated: false
		};
		const secrets = [config.mcpToken, config.mcpUrl];
		for (let start = 0; start < wanted.length; start += SERIES_CHUNK) {
			const chunk = wanted.slice(start, start + SERIES_CHUNK);
			const args = {
				...memberArgs(config.member),
				indicators: chunk,
				start: options.start,
				end: options.end,
				resolution: options.resolution,
				aggregate: "none"
			};
			if (options.resolution === "raw") args.limit = 500;
			const call = await callMcpTool({
				url: config.mcpUrl,
				token: config.mcpToken,
				name: "query_health_indicators",
				args,
				timeoutMs: config.timeoutMs
			});
			if (call.success === false) {
				out.error = redact(call.error || "series read failed", secrets);
				break;
			}
			const table = tableOf(payloadOf(call));
			if (!table) continue;
			if (table.error) {
				out.error = redact(`${table.error.kind}: ${table.error.message}`, secrets);
				continue;
			}
			if (table.meta.truncated) out.truncated = true;
			for (const row of table.rows) {
				const indicator = (row.indicator ?? "").trim();
				if (!indicator) continue;
				const value = cellNumber(options.resolution === "raw" ? row.value : row.avg);
				const date = options.resolution === "raw" ? row.date || (row.time ?? "").slice(0, 10) : (row.period ?? "").slice(0, 10);
				if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
				const series = out.series[indicator] ?? (out.series[indicator] = {
					indicator,
					unit: (row.unit ?? "").trim(),
					points: []
				});
				if (row.name && row.name !== indicator && !series.label) series.label = row.name;
				if ((row.system ?? "").toLowerCase() === "loinc" && row.code && !series.loinc) series.loinc = row.code;
				series.points.push({
					date,
					time: row.time ?? date,
					value,
					unit: (row.unit ?? series.unit).trim(),
					...row.file ? { file: row.file } : {}
				});
			}
		}
		for (const series of Object.values(out.series)) series.points.sort((a, b) => a.time.localeCompare(b.time));
		return out;
	});
}
function addDays$1(iso, days) {
	const at = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
	at.setUTCDate(at.getUTCDate() + days);
	return at.toISOString().slice(0, 10);
}
/** Doses recorded taken or skipped for one medication, read in windows under Mirobody's row cap. */
async function loadDoseLog(config, medication, start, end) {
	if (!config.mcpUrl.trim()) return {
		rows: [],
		error: "mcpUrl is not set"
	};
	return cached(cacheKey(config, "doses", JSON.stringify([
		medication,
		start,
		end
	])), async () => {
		const rows = [];
		let from = start;
		while (from <= end) {
			const to = [addDays$1(from, 89), end].sort()[0] ?? end;
			const call = await callMcpTool({
				url: config.mcpUrl,
				token: config.mcpToken,
				name: "query_medications",
				args: {
					...memberArgs(config.member),
					view: "log",
					keywords: [medication],
					start: from,
					end: to
				},
				timeoutMs: config.timeoutMs
			});
			if (call.success === false) return {
				rows,
				error: redact(call.error || "dose log read failed", [config.mcpToken, config.mcpUrl])
			};
			const table = tableOf(payloadOf(call));
			if (table?.error) return {
				rows,
				error: `${table.error.kind}: ${table.error.message}`
			};
			for (const row of table?.rows ?? []) {
				if (!row.date || !row.medication) continue;
				rows.push({
					date: row.date,
					medication: row.medication,
					status: (row.status ?? "").trim(),
					plan_id: row.plan_id ?? ""
				});
			}
			from = addDays$1(to, 1);
		}
		return { rows };
	});
}
/** Medication courses with their start and end dates: the dates a change could confound a lab. */
async function loadCourses(config) {
	if (!config.mcpUrl.trim()) return {
		rows: [],
		error: "mcpUrl is not set"
	};
	return cached(cacheKey(config, "courses"), async () => {
		const call = await callMcpTool({
			url: config.mcpUrl,
			token: config.mcpToken,
			name: "query_medications",
			args: {
				...memberArgs(config.member),
				view: "history"
			},
			timeoutMs: config.timeoutMs
		});
		if (call.success === false) return {
			rows: [],
			error: redact(call.error || "course history read failed", [config.mcpToken, config.mcpUrl])
		};
		const table = tableOf(payloadOf(call));
		if (table?.error) return {
			rows: [],
			error: `${table.error.kind}: ${table.error.message}`
		};
		return { rows: (table?.rows ?? []).filter((row) => row.medication).map((row) => ({
			medication: row.medication ?? "",
			start: row.start ?? "",
			end: row.end ?? "",
			closed_by: row.closed_by ?? "",
			plan_id: row.plan_id ?? ""
		})) };
	});
}
//#endregion
//#region src/interventions.ts
const CATEGORIES = [
	"diet",
	"exercise",
	"sleep",
	"supplement",
	"drug",
	"behavior",
	"weight",
	"other"
];
const CATEGORY_ZH = {
	diet: "饮食",
	exercise: "运动",
	sleep: "睡眠",
	supplement: "补剂",
	drug: "药物",
	behavior: "行为",
	weight: "体重",
	other: "其他"
};
const CHECKIN_TAGS = [
	"illness",
	"travel",
	"lab_change",
	"stress",
	"other"
];
const TAG_ZH = {
	illness: "生病",
	travel: "出差旅行",
	lab_change: "换了检测机构",
	stress: "压力大",
	other: "其他"
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DOSE = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|μg|ug|iu|g|ml|毫克|微克|国际单位|单位|克|毫升|粒|片|颗|支|滴|袋|勺)|[一二两三四五六七八九十半]+\s*(?:粒|片|颗|支|滴|袋|勺)/gi;
function dir(dataDir) {
	return join(dataDir, "interventions");
}
function readLines(path, keep) {
	if (!existsSync(path)) return [];
	const rows = [];
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		if (!line.trim()) continue;
		try {
			const row = JSON.parse(line);
			if (row && keep(row)) rows.push(row);
		} catch {}
	}
	return rows;
}
function append(dataDir, file, row) {
	mkdirSync(dir(dataDir), {
		recursive: true,
		mode: 448
	});
	appendFileSync(join(dir(dataDir), file), `${JSON.stringify(row)}\n`, { mode: 384 });
}
function readPlans(dataDir) {
	return readLines(join(dir(dataDir), "plan.jsonl"), (row) => row.schema === "longpi-plan/1" && Array.isArray(row.items));
}
function currentPlan(dataDir) {
	const plans = readPlans(dataDir);
	return plans.length > 0 ? plans[plans.length - 1] ?? null : null;
}
function readCheckIns(dataDir) {
	return readLines(join(dir(dataDir), "adherence.jsonl"), (row) => typeof row.item === "string" && DATE.test(row.date));
}
function isoDay(at = /* @__PURE__ */ new Date()) {
	return (/* @__PURE__ */ new Date(at.getTime() - at.getTimezoneOffset() * 6e4)).toISOString().slice(0, 10);
}
function addDays(iso, days) {
	const at = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
	at.setUTCDate(at.getUTCDate() + days);
	return at.toISOString().slice(0, 10);
}
function daysBetween(from, to) {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}
function text(value, max) {
	return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
function stripDoses(value) {
	const cleaned = value.replace(DOSE, "").replace(/[，,]\s*(?=[，,]|$)/g, "").replace(/\s{2,}/g, " ").trim();
	return {
		text: cleaned,
		stripped: cleaned !== value.trim()
	};
}
/**
* Check a plan the person described or uploaded and put it in the stored shape.
* Returns errors that stop saving and warnings to read back before confirming.
*/
function normalizePlan(raw, context) {
	const input = raw && typeof raw === "object" ? raw : {};
	const errors = [];
	const warnings = [];
	const itemsIn = Array.isArray(input.items) ? input.items : [];
	if (itemsIn.length === 0) errors.push("方案里没有任何一项干预。");
	if (itemsIn.length > 30) errors.push("一次最多保存 30 项干预。");
	const previousByTitle = new Map((context.previous?.items ?? []).map((item) => [foldName(item.title), item]));
	const usedIds = /* @__PURE__ */ new Set();
	const items = [];
	itemsIn.slice(0, 30).forEach((value, index) => {
		const row = value && typeof value === "object" ? value : {};
		let title = text(row.title, 60);
		const where = title || `第 ${index + 1} 项`;
		if (!title) errors.push(`${where}没有名称。`);
		const category = CATEGORIES.includes(String(row.category)) ? row.category : "other";
		if (category === "other" && row.category && row.category !== "other") warnings.push(`${where}的类别「${String(row.category)}」不认识，记为「其他」。`);
		let detail = text(row.detail, 300);
		const start = text(row.start, 10);
		if (!DATE.test(start)) errors.push(`${where}缺少开始日期（YYYY-MM-DD）。判断效果要靠它找基线。`);
		const endText = text(row.end, 10);
		const end = DATE.test(endText) ? endText : null;
		if (end && DATE.test(start) && end < start) errors.push(`${where}的结束日期早于开始日期。`);
		if (DATE.test(start) && start > addDays(context.today, 60)) warnings.push(`${where}的开始日期在两个月以后。`);
		let mirobody = null;
		if (category === "drug" || category === "supplement") {
			const cleanedTitle = stripDoses(title);
			const cleanedDetail = stripDoses(detail);
			if (cleanedTitle.stripped || cleanedDetail.stripped) warnings.push(`${where}的剂量没有保存：药物和补剂的剂量与服用记录在 Mirobody 的用药计划里。`);
			title = cleanedTitle.text || title;
			detail = cleanedDetail.text;
			const name = text(row.medication, 60) || title;
			const folded = foldName(name);
			const hit = context.medications.find((med) => {
				const other = foldName(med.name);
				return other && folded && (other.includes(folded) || folded.includes(other));
			});
			if (hit) mirobody = {
				medication: hit.name,
				...hit.plan_id ? { plan_id: hit.plan_id } : {}
			};
			else {
				mirobody = { medication: name };
				warnings.push(`Mirobody 用药计划里没有找到「${name}」。在 Mirobody 里建好用药计划并打卡后，才能跟踪服用情况。`);
			}
		}
		let frequency = null;
		const freq = row.frequency && typeof row.frequency === "object" ? row.frequency : null;
		if (freq && Number.isFinite(Number(freq.times)) && Number(freq.times) > 0 && (freq.per === "day" || freq.per === "week")) frequency = {
			times: Math.min(50, Math.round(Number(freq.times))),
			per: freq.per
		};
		let target = null;
		const tgt = row.target && typeof row.target === "object" ? row.target : null;
		if (tgt && text(tgt.metric, 80) && Number.isFinite(Number(tgt.value))) target = {
			metric: text(tgt.metric, 80),
			op: tgt.op === "<=" ? "<=" : ">=",
			value: Number(tgt.value),
			unit: text(tgt.unit, 20)
		};
		const markers = [...new Set((Array.isArray(row.markers) ? row.markers : []).map((item) => text(item, 60)).filter(Boolean))].slice(0, 12);
		const previous = title ? previousByTitle.get(foldName(title)) : void 0;
		let id = text(row.id, 40) || previous?.id || "";
		if (!/^[a-z0-9-]{2,40}$/.test(id) || usedIds.has(id)) id = `i${Date.now().toString(36)}${index.toString(36)}`;
		usedIds.add(id);
		items.push({
			id,
			category,
			title,
			detail,
			start,
			end,
			frequency,
			target,
			markers,
			mirobody
		});
	});
	const goals = [];
	for (const value of Array.isArray(input.goals) ? input.goals.slice(0, 20) : []) {
		const row = value && typeof value === "object" ? value : {};
		const marker = text(row.marker, 60);
		const number = Number(row.value);
		if (!marker || !Number.isFinite(number)) {
			warnings.push(`目标「${marker || "未命名"}」没有数值，没有保存。`);
			continue;
		}
		goals.push({
			marker,
			value: number,
			unit: text(row.unit, 20)
		});
	}
	const source = input.source === "file" || input.source === "board" ? input.source : "chat";
	return {
		plan: {
			schema: "longpi-plan/1",
			title: text(input.title, 60) || "我的干预方案",
			source,
			note: text(input.note, 500),
			items,
			goals
		},
		warnings,
		errors
	};
}
function savePlan(dataDir, plan) {
	const previous = currentPlan(dataDir);
	const saved = {
		...plan,
		version: (previous?.version ?? 0) + 1,
		saved_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	append(dataDir, "plan.jsonl", saved);
	return saved;
}
/** Record check-ins against items of the current plan. `item` may be an id or a title. */
function addCheckIns(dataDir, entries, context) {
	const plan = currentPlan(dataDir);
	const problems = [];
	const saved = [];
	if (!plan) return {
		saved,
		problems: ["还没有保存的干预方案。先保存方案再打卡。"]
	};
	for (const value of entries.slice(0, 40)) {
		const row = value && typeof value === "object" ? value : {};
		const ref = text(row.item, 60);
		const folded = foldName(ref);
		const item = plan.items.find((candidate) => candidate.id === ref) ?? plan.items.find((candidate) => foldName(candidate.title) === folded) ?? plan.items.find((candidate) => folded.length >= 2 && foldName(candidate.title).includes(folded));
		if (!item) {
			problems.push(`方案里没有「${ref}」。`);
			continue;
		}
		if (item.mirobody) {
			problems.push(`「${item.title}」是药物或补剂，服用记录请在 Mirobody 里打卡，这里只读。`);
			continue;
		}
		const date = DATE.test(text(row.date, 10)) ? text(row.date, 10) : context.today;
		if (date > context.today) {
			problems.push(`「${item.title}」的打卡日期 ${date} 在未来。`);
			continue;
		}
		const amount = Number.isFinite(Number(row.amount)) && row.amount !== null && row.amount !== "" ? Number(row.amount) : null;
		const tags = (Array.isArray(row.tags) ? row.tags : []).map((tag) => String(tag)).filter((tag) => CHECKIN_TAGS.includes(tag));
		const checkIn = {
			at: (/* @__PURE__ */ new Date()).toISOString(),
			date,
			item: item.id,
			done: typeof row.done === "boolean" ? row.done : amount != null ? true : null,
			amount,
			unit: text(row.unit, 20),
			note: text(row.note, 200),
			tags,
			source: context.source
		};
		append(dataDir, "adherence.jsonl", checkIn);
		saved.push(checkIn);
	}
	return {
		saved,
		problems
	};
}
//#endregion
//#region src/overview.ts
function personal(card) {
	return card.tier === "A" && card.inputsStatus !== "none" && Boolean(card.script) && card.inputs.length > 0;
}
function readiness(catalog, records, outputs) {
	const out = {
		ready: [],
		near: [],
		unlock: [],
		declared: 0
	};
	const unlock = /* @__PURE__ */ new Map();
	for (const card of catalog.cards) {
		if (!personal(card)) continue;
		out.declared += 1;
		const run = runnableFrom(card, records.indicators, {
			age: records.profile.age,
			sex: records.profile.sex
		}, outputs);
		if (run.status === "ready") out.ready.push({
			name: card.name,
			blurb: card.blurb,
			domain: card.domain
		});
		else if (run.status === "partial") out.near.push({
			name: card.name,
			blurb: card.blurb,
			missing: run.missing
		});
		if (run.missing.length === 1) {
			const item = run.missing[0];
			if (!unlock.has(item)) unlock.set(item, /* @__PURE__ */ new Set());
			unlock.get(item)?.add(card.name);
		}
	}
	out.near.sort((a, b) => a.missing.length - b.missing.length || a.name.localeCompare(b.name));
	out.near = out.near.slice(0, 8);
	out.unlock = [...unlock.entries()].map(([item, skills]) => ({
		item,
		skills: [...skills].sort()
	})).sort((a, b) => b.skills.length - a.skills.length || a.item.localeCompare(b.item)).slice(0, 8);
	return out;
}
/** Run every method the record already supplies (at most `limit`), with values exactly as recorded. */
async function runReady(context, limit = 8) {
	const results = [];
	for (const card of context.catalog.cards) {
		if (results.length >= limit) break;
		if (!personal(card) || !card.entry?.measurements_flag) continue;
		const run = runnableFrom(card, context.records.indicators, {
			age: context.records.profile.age,
			sex: context.records.profile.sex
		}, context.outputs);
		if (run.status !== "ready" || run.from_record.length === 0) continue;
		const measurements = run.from_record;
		const result = await runSkill({
			home: context.skillsHome,
			dataDir: context.dataDir,
			name: card.name,
			args: [],
			files: [],
			measurements,
			profile: {
				age: context.records.profile.age,
				sex: context.records.profile.sex
			},
			useProfile: true,
			python: context.config.skillPython,
			runtimes: context.config.skillRuntimes,
			timeoutMs: context.config.skillTimeoutMs,
			revision: context.catalog.revision
		});
		results.push({
			skill: card.name,
			ok: result.ok,
			excerpt: result.report_excerpt,
			outputs: result.outputs ?? {},
			...result.ok ? {} : { error: result.error || result.error_kind || "没有读出" }
		});
	}
	return results;
}
function fmt$1(value, digits = 1) {
	if (value == null || !Number.isFinite(value)) return "—";
	return value.toFixed(digits);
}
/** A plain Markdown summary for a doctor or coach: data, not advice. */
function buildReport(input) {
	const lines = [];
	const profile = input.records.profile;
	lines.push(`# ${input.name || "个人"}长寿看板报告`, "");
	lines.push(`生成日期：${input.today}。数据来自本人的 Mirobody 记录、本人确认过的干预方案和打卡，以及 longevity-skills 技能脚本。本报告不是诊断，也不包含用药建议。`, "");
	lines.push("## 基本信息", "");
	lines.push(`- 实足年龄：${profile.age ?? "未填写"}；性别：${profile.sex === "male" ? "男" : profile.sex === "female" ? "女" : "未填写"}`);
	lines.push(`- 记录状态：${input.records.record_status === "ok" ? `已接入 Mirobody（${input.records.indicators.length} 项指标）` : "未接入"}`, "");
	const tracking = input.tracking;
	if (tracking) {
		const bio = tracking.bioage;
		lines.push("## 表型年龄（PhenoAge，Levine 2018）", "");
		if (bio.points.length > 0) {
			lines.push("| 检查日期 | 表型年龄 | 减实足年龄 | 模型 10 年死亡风险 |", "|---|---|---|---|");
			for (const row of bio.points) lines.push(`| ${row.date} | ${fmt$1(row.phenoage)} 岁 | ${fmt$1(row.advance)} 岁 | ${fmt$1(row.mortality_10y_pct)}% |`);
			lines.push("");
			if (bio.band_years != null) lines.push(`两次检查之间，表型年龄变化在 ±${fmt$1(bio.band_years)} 岁以内可能只是个体内正常波动${bio.band_missing.length > 0 ? `（未含${bio.band_missing.join("、")}，实际波动更大）` : ""}。`, "");
		} else lines.push(bio.note_zh, "");
		if (tracking.plan) {
			lines.push(`## 干预方案（第 ${tracking.plan.version} 版，${tracking.plan.saved_at.slice(0, 10)} 保存）`, "");
			for (const item of tracking.items) {
				const adherence = item.adherence.rate != null ? `${Math.round(item.adherence.rate * 100)}%` : "未知";
				lines.push(`### ${item.title}（${item.category_zh}，${item.start} 起）`, "");
				lines.push(`执行：${adherence}（${item.adherence.note_zh}）`, "");
				for (const row of item.verdicts) {
					const change = row.baseline && row.followup ? `${row.baseline.date} ${row.baseline.value} → ${row.followup.date} ${row.followup.value} ${row.unit}` : "缺少可比较的结果";
					lines.push(`- ${row.marker}：**${row.verdict}**。${change}。${row.reason_zh}`);
					for (const note of row.confounders) lines.push(`  - 同期变化：${note}`);
				}
				lines.push("");
			}
		}
		const models = tracking.models.filter((card) => card.status !== "unavailable");
		if (models.length > 0) {
			lines.push("## 模型估计", "");
			for (const card of models) if (card.model === "phenoage" && card.goal) {
				lines.push(`- 表型年龄：现在 ${fmt$1(card.now.phenoage)} 岁；达到方案目标时 ${fmt$1(card.goal.phenoage)} 岁（${card.measured_on} 的血检）。${card.boundary_zh}`);
				for (const lever of card.levers) lines.push(`  - ${lever.label} ${lever.from} → ${lever.to}：${fmt$1(lever.years)} 岁`);
			} else if (card.model === "phenoage") lines.push(`- 表型年龄：${card.note_zh}`);
			lines.push("");
		}
		if (tracking.suggestions.length > 0) {
			lines.push("## 下一步", "");
			for (const row of tracking.suggestions) lines.push(`- ${row.text_zh}`);
			lines.push("");
		}
	}
	lines.push("---", "", "判断依据：变化超过个体内生物变异与检测误差合成的参考变化值（RCV）才算真实变化；变异数据来自 EFLM 生物变异数据库和同行评审研究。试验效应是人群平均，不是个人预测。模型估计不是寿命预测。");
	return `${lines.join("\n")}\n`;
}
//#endregion
//#region src/reference.ts
const EMPTY = {
	z: 1.96,
	default_cva_rule_zh: "",
	markers: []
};
/** EFLM desirable analytical imprecision: CVA at most half of CVI (Fraser). Used when the source gives no CVA. */
const DEFAULT_CVA_FACTOR = .5;
let memo$1 = null;
function stampOf(path) {
	try {
		return existsSync(path) ? String(readFileSync(path).length) : "-";
	} catch {
		return "-";
	}
}
function loadReference(skillsHome) {
	const biovarPath = join(skillsHome, "data", "biological_variation.json");
	const effectsPath = join(skillsHome, "data", "effects.jsonl");
	const stamp = `${stampOf(biovarPath)}:${stampOf(effectsPath)}`;
	if (memo$1 && memo$1.home === skillsHome && memo$1.stamp === stamp) return memo$1.value;
	const value = {
		biovar: EMPTY,
		effects: []
	};
	try {
		if (existsSync(biovarPath)) {
			const parsed = JSON.parse(readFileSync(biovarPath, "utf8"));
			if (parsed.schema === "longevity-biovar/1" && Array.isArray(parsed.markers)) value.biovar = {
				z: typeof parsed.z === "number" ? parsed.z : 1.96,
				default_cva_rule_zh: parsed.default_cva_rule_zh ?? "",
				markers: parsed.markers
			};
		}
		if (existsSync(effectsPath)) for (const line of readFileSync(effectsPath, "utf8").split(/\r?\n/)) {
			if (!line.trim()) continue;
			try {
				const row = JSON.parse(line);
				if (row && row.id && row.effect) value.effects.push(row);
			} catch {}
		}
	} catch (error) {
		value.error = error instanceof Error ? error.message : "reference tables unreadable";
	}
	memo$1 = {
		home: skillsHome,
		stamp,
		value
	};
	return value;
}
/** The biological-variation row for one indicator, by LOINC code, device code, or name. */
function markerFor(biovar, indicator) {
	if (indicator.loinc) {
		const hit = biovar.markers.find((row) => row.loinc.includes(indicator.loinc));
		if (hit) return hit;
	}
	if (indicator.name) {
		const hit = biovar.markers.find((row) => (row.device_codes ?? []).includes(indicator.name));
		if (hit) return hit;
	}
	const wanted = new Set([indicator.name, indicator.label].filter(Boolean).flatMap((name) => nameVariants(name)));
	if (wanted.size === 0) return null;
	for (const row of biovar.markers) if ([
		row.key,
		row.label_zh,
		...row.aliases ?? []
	].map((name) => foldName(name)).filter(Boolean).some((name) => wanted.has(name))) return row;
	return null;
}
/**
* Reference change value as fractions of the first result: a later result
* outside [down, up] is unlikely (at z) to be noise alone. Symmetric for
* normally distributed markers; asymmetric (log-normal) for right-skewed ones
* such as CRP and triglycerides.
*/
function rcvBand(marker, z) {
	const cvi = marker.cvi_pct / 100;
	const cvaDefault = marker.cva_pct == null;
	const cvaPct = cvaDefault ? marker.cvi_pct * DEFAULT_CVA_FACTOR : marker.cva_pct;
	const cva = cvaPct / 100;
	if (marker.log_normal) {
		const sigma = Math.sqrt(Math.log(1 + cvi * cvi) + Math.log(1 + cva * cva));
		return {
			up: Math.exp(z * Math.SQRT2 * sigma) - 1,
			down: Math.exp(-z * Math.SQRT2 * sigma) - 1,
			cva_pct: cvaPct,
			cva_default: cvaDefault
		};
	}
	const band = Math.SQRT2 * z * Math.sqrt(cvi * cvi + cva * cva);
	return {
		up: band,
		down: -band,
		cva_pct: cvaPct,
		cva_default: cvaDefault
	};
}
/** Trial effects on one marker for an intervention described in a person's plan. */
function effectsFor(effects, item, marker, loinc) {
	const text = foldName(`${item.title} ${item.detail ?? ""}`);
	return effects.filter((row) => {
		if (!(marker && row.marker_key === marker.key || loinc && (row.loinc ?? []).includes(loinc))) return false;
		return [
			row.intervention_zh,
			row.intervention,
			...row.keywords ?? []
		].map((word) => foldName(word)).filter((word) => word.length >= 2).some((word) => text.includes(word));
	});
}
//#endregion
//#region src/evaluate.ts
/** Days to wait after starting before a retest means anything, when the table has no row for the marker. */
const DEFAULT_RETEST_DAYS = 28;
const BASELINE_LOOKBACK_DAYS = 180;
const ADHERENCE_GOOD = .8;
const ADHERENCE_LOW = .5;
const COVERAGE_MIN = .3;
const CRP_ACUTE_MG_L = 10;
function resolveMarkers(names, indicators, biovar) {
	return names.map((asked) => {
		const direct = biovar.markers.find((row) => row.key === asked) ?? markerFor(biovar, {
			name: asked,
			label: asked
		});
		const record = indicators.find((row) => row.name === asked) ?? (direct ? indicators.find((row) => row.loinc && direct.loinc.includes(row.loinc) || (direct.device_codes ?? []).includes(row.name)) : void 0) ?? indicators.find((row) => markerFor(biovar, row) === direct && direct != null);
		const row = direct ?? (record ? markerFor(biovar, record) : null);
		return {
			asked,
			label: row?.label_zh ?? record?.label ?? asked,
			indicator: record?.name ?? null,
			...record?.loinc ? { loinc: record.loinc } : {},
			unit: record?.unit || row?.unit || "",
			biovar: row
		};
	});
}
function meets(value, op, threshold) {
	return op === "<=" ? value <= threshold : value >= threshold;
}
/**
* How well one item was followed over [start, end]. Missing data is unknown,
* never a miss: a dose absent from the log is not evidence it was skipped.
*/
function adherenceFor(item, window, data, calendarDays = 84) {
	const start = item.start > window.start ? item.start : window.start;
	const endCap = item.end && item.end < window.end ? item.end : window.end;
	const days = Math.max(0, daysBetween(start, endCap) + 1);
	const status = /* @__PURE__ */ new Map();
	let source = "none";
	if (item.target && data.daily) {
		source = "wearable";
		for (const point of data.daily) {
			if (point.date < start || point.date > endCap) continue;
			status.set(point.date, meets(point.value, item.target.op, item.target.value) ? "done" : "missed");
		}
	} else if (item.mirobody && data.doses) {
		source = "dose_log";
		const byDay = /* @__PURE__ */ new Map();
		for (const dose of data.doses) {
			if (dose.date < start || dose.date > endCap) continue;
			const day = byDay.get(dose.date) ?? {
				taken: 0,
				skipped: 0
			};
			if (/taken|done|已服|服用/i.test(dose.status)) day.taken += 1;
			else if (/skip|missed|漏|未服/i.test(dose.status)) day.skipped += 1;
			byDay.set(dose.date, day);
		}
		for (const [date, day] of byDay) if (day.taken + day.skipped > 0) status.set(date, day.skipped === 0 ? "done" : "missed");
	} else {
		source = "check_in";
		for (const row of data.checkins) {
			if (row.item !== item.id || row.date < start || row.date > endCap || row.done == null) continue;
			if (row.done) status.set(row.date, "done");
			else if (!status.has(row.date)) status.set(row.date, "missed");
		}
		if (status.size === 0) source = data.checkins.some((row) => row.item === item.id) ? "check_in" : "none";
	}
	let rate;
	let knownDays = status.size;
	let doneDays = [...status.values()].filter((value) => value === "done").length;
	if (source === "check_in" && item.frequency?.per === "week" && days >= 7) {
		const weeks = /* @__PURE__ */ new Map();
		for (const [date, value] of status) {
			if (value !== "done") continue;
			const week = Math.floor(daysBetween(start, date) / 7);
			weeks.set(week, (weeks.get(week) ?? 0) + 1);
		}
		const reported = new Set([...status.keys()].map((date) => Math.floor(daysBetween(start, date) / 7)));
		const perWeek = [...reported].map((week) => Math.min(1, (weeks.get(week) ?? 0) / (item.frequency?.times ?? 1)));
		rate = perWeek.length > 0 ? perWeek.reduce((a, b) => a + b, 0) / perWeek.length : null;
		knownDays = reported.size * 7;
		doneDays = Math.round((rate ?? 0) * knownDays);
	} else rate = knownDays > 0 ? doneDays / knownDays : null;
	const coverage = days > 0 ? Math.min(1, knownDays / days) : 0;
	let level = "unknown";
	if (rate != null && coverage >= COVERAGE_MIN) level = rate >= ADHERENCE_GOOD ? "good" : rate >= ADHERENCE_LOW ? "partial" : "low";
	let streak = 0;
	for (let day = endCap; day >= start; day = addDays(day, -1)) {
		const value = status.get(day);
		if (value === "done") streak += 1;
		else if (value === "missed" || day < endCap) break;
	}
	const calendar = [];
	for (let i = calendarDays - 1; i >= 0; i -= 1) {
		const date = addDays(window.end, -i);
		calendar.push({
			date,
			status: date < item.start || item.end != null && date > item.end ? "unknown" : status.get(date) ?? "unknown"
		});
	}
	const sourceZh = {
		wearable: "手环数据",
		dose_log: "Mirobody 服用记录",
		check_in: "打卡",
		none: "没有记录"
	}[source];
	let note = "";
	if (source === "none") note = item.mirobody ? "在 Mirobody 里打卡服用后才有执行记录。" : "还没有打卡记录。";
	else if (level === "unknown") note = `${sourceZh}覆盖 ${Math.round(coverage * 100)}% 的天数，太少，执行率不作数。`;
	else note = `${sourceZh}：执行率 ${Math.round((rate ?? 0) * 100)}%（覆盖 ${Math.round(coverage * 100)}% 的天数）。`;
	return {
		source,
		rate,
		coverage,
		known_days: knownDays,
		done_days: doneDays,
		window_days: days,
		level,
		streak,
		calendar,
		note_zh: note
	};
}
function crpInMgL(value, unit) {
	return /mg\/dl/i.test(unit) ? value * 10 : value;
}
function isCrp(marker) {
	return marker.biovar?.key === "crp" || /crp|c反应蛋白|c-反应蛋白/i.test(`${marker.asked} ${marker.label}`);
}
function expectationText(row) {
	const effect = row.effect;
	const sign = effect.value > 0 ? "+" : "";
	let amount;
	if (effect.kind === "percent_change") amount = `${sign}${effect.value}%`;
	else if (effect.kind === "standardized") amount = `标准化效应 ${effect.value}（${effect.unit}）`;
	else if (effect.kind === "rate") amount = `${sign}${effect.value} ${effect.unit}（年化）`;
	else amount = `${sign}${effect.value} ${effect.unit}`;
	const ci = effect.ci ? `（95% 区间 ${effect.ci[0]} 至 ${effect.ci[1]}）` : "";
	const per = effect.kind === "per_unit" && effect.per ? `，按每${effect.per}` : "";
	const weeks = row.duration_weeks ? `，约 ${row.duration_weeks} 周` : "";
	const design = row.design === "meta-analysis" ? "荟萃分析" : row.design === "rct" ? "随机对照试验" : row.design;
	return `${row.intervention_zh}对${row.marker_zh}：试验组比对照组平均 ${amount}${ci}${per}${weeks}；${row.population}；${design}。`;
}
/** The published effect in the marker's unit, or null when it cannot be put there. */
function effectInUnit(row, unit, marker) {
	const norm = (text) => text.replace(/\s/g, "").toLowerCase();
	const effect = row.effect;
	if (norm(effect.unit) === norm(unit)) return {
		value: effect.value,
		ci: effect.ci ?? null
	};
	const factor = marker?.convert ? Object.entries(marker.convert).find(([from]) => norm(from) === norm(effect.unit))?.[1] : void 0;
	if (factor == null || norm(marker?.unit ?? "") !== norm(unit)) return null;
	return {
		value: effect.value * factor,
		ci: effect.ci ? [effect.ci[0] * factor, effect.ci[1] * factor] : null
	};
}
function compare(row, change, unit, marker, years) {
	if (!change) return "not_comparable";
	const effect = row.effect;
	let observed;
	let expected;
	if (effect.kind === "standardized" || effect.kind === "per_unit") return "not_comparable";
	if (effect.kind === "percent_change") {
		observed = change.pct * 100;
		expected = {
			value: effect.value,
			ci: effect.ci ?? null
		};
	} else {
		observed = change.abs;
		expected = effectInUnit(row, unit, marker);
		if (expected && effect.kind === "rate") expected = {
			value: expected.value * years,
			ci: expected.ci ? [expected.ci[0] * years, expected.ci[1] * years] : null
		};
	}
	if (!expected) return "not_comparable";
	if (expected.value !== 0 && observed !== 0 && Math.sign(observed) !== Math.sign(expected.value)) return "opposite";
	const [low, high] = expected.ci ? [Math.min(...expected.ci), Math.max(...expected.ci)] : [expected.value, expected.value];
	if (observed >= low && observed <= high) return "consistent";
	return Math.abs(observed) < Math.min(Math.abs(low), Math.abs(high)) ? "smaller" : "larger";
}
/** Mean of the readings in the last `days` days of a run of readings, dated at its last day. */
function meanOver(points, days) {
	const last = points.at(-1);
	if (!last) return void 0;
	const from = addDays(last.date, -(days - 1));
	const used = points.filter((point) => point.date >= from && point.date <= last.date);
	const value = used.reduce((sum, point) => sum + point.value, 0) / used.length;
	return {
		...last,
		value: Math.round(value * 100) / 100
	};
}
function evaluateMarker(item, marker, input) {
	const base = {
		item: item.id,
		item_title: item.title,
		marker: marker.label,
		indicator: marker.indicator,
		unit: marker.unit,
		verdict: "无法判断",
		reason_zh: "",
		baseline: null,
		followup: null,
		change: null,
		band: null,
		direction: "unknown",
		confounders: [],
		combined_with: [],
		expected: [],
		next_retest: null
	};
	const retestDays = marker.biovar?.min_retest_days ?? DEFAULT_RETEST_DAYS;
	if (!marker.indicator) {
		base.reason_zh = `记录里还没有${marker.label}。下次检查时加测，才能看这项干预对它的影响。`;
		return base;
	}
	const points = (input.series[marker.indicator] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
	const before = points.filter((point) => point.date <= item.start && point.date >= addDays(item.start, -180));
	const earliest = addDays(item.start, retestDays);
	const lastDay = item.end ? addDays(item.end, 30) : input.today;
	const after = points.filter((point) => point.date >= earliest && point.date <= lastDay);
	const window = marker.biovar?.average_days ?? 0;
	const baseline = window > 0 ? meanOver(before, window) : before.at(-1);
	const followup = window > 0 ? meanOver(after, window) : after.at(-1);
	if (!baseline) {
		base.reason_zh = `开始前 ${BASELINE_LOOKBACK_DAYS} 天内没有${marker.label}的结果，没有基线可比。`;
		base.next_retest = earliest > input.today ? earliest : null;
		return base;
	}
	base.baseline = {
		date: baseline.date,
		value: baseline.value
	};
	if (!followup) {
		base.next_retest = earliest > input.today ? earliest : input.today;
		base.reason_zh = earliest > input.today ? `开始才 ${Math.max(0, daysBetween(item.start, input.today))} 天。${marker.label}至少要隔 ${retestDays} 天复测才有意义，${earliest} 之后复测。` : `开始后还没有复测${marker.label}。现在可以复测了。`;
		return base;
	}
	base.followup = {
		date: followup.date,
		value: followup.value
	};
	const abs = followup.value - baseline.value;
	const pct = baseline.value !== 0 ? abs / baseline.value : 0;
	base.change = {
		abs,
		pct
	};
	const windowFrom = baseline.date;
	const windowTo = followup.date;
	const within = (date) => Boolean(date) && date > windowFrom && date <= windowTo;
	for (const other of input.plan.items) {
		if (other.id === item.id) continue;
		if (other.markers.some((name) => {
			const resolved = input.markers[name];
			return resolved ? resolved.indicator === marker.indicator : name === marker.asked;
		}) && (within(other.start) || within(other.end) || other.start <= windowFrom && (!other.end || other.end > windowFrom))) base.combined_with.push(other.title);
	}
	const combinedMeds = new Set(input.plan.items.filter((other) => other.mirobody && base.combined_with.includes(other.title)).map((other) => other.mirobody?.medication));
	for (const course of input.courses) {
		if (item.mirobody && course.medication === item.mirobody.medication) continue;
		if (combinedMeds.has(course.medication)) continue;
		const runningAtRetest = within(course.start) && (!course.end || course.end >= addDays(windowTo, -14));
		const stoppedJustBefore = within(course.end) && daysBetween(course.end, windowTo) <= 30;
		if (runningAtRetest) base.confounders.push(`${course.start} 开始用${course.medication}（Mirobody 用药记录）`);
		else if (stoppedJustBefore) base.confounders.push(`${course.end} 停用${course.medication}，距复测不到一个月（Mirobody 用药记录）`);
	}
	for (const row of input.checkins) {
		if (!within(row.date) || row.tags.length === 0) continue;
		if (row.tags.includes("illness") ? daysBetween(row.date, windowTo) <= 21 : true) base.confounders.push(`${row.date} ${row.tags.map((tag) => TAG_ZH[tag] ?? tag).join("、")}${row.note ? `：${row.note}` : ""}`);
	}
	base.confounders = [...new Set(base.confounders)].slice(0, 6);
	const years = Math.max(0, daysBetween(baseline.date, followup.date)) / 365.25;
	base.expected = effectsFor(input.effects, item, marker.biovar, marker.loinc).slice(0, 4).map((row) => ({
		id: row.id,
		text_zh: expectationText(row),
		doi: row.doi,
		verified: row.verified,
		comparison: compare(row, base.change, marker.unit, marker.biovar, years)
	}));
	const adherence = input.adherence[item.id];
	if (isCrp(marker) && (crpInMgL(baseline.value, marker.unit) > CRP_ACUTE_MG_L || crpInMgL(followup.value, marker.unit) > CRP_ACUTE_MG_L)) {
		base.reason_zh = "CRP 高于 10 mg/L，多半是急性炎症（感冒、感染、受伤），这次比较不作数。建议恢复两周后复测。";
		return base;
	}
	if (!marker.biovar) {
		base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%。缺少${marker.label}的个体内变异数据，分不清是真实变化还是波动。`;
		return base;
	}
	const band = rcvBand(marker.biovar, input.biovar.z);
	base.band = {
		up_pct: band.up * 100,
		down_pct: band.down * 100,
		verified: marker.biovar.verified,
		cva_default: band.cva_default
	};
	const beyondUp = pct > band.up;
	const beyondDown = pct < band.down;
	let better = marker.biovar.better;
	const goal = (input.goals ?? []).find((row) => row.marker === marker.asked || row.marker === marker.biovar?.key || row.marker === marker.label);
	if ((better === "none" || better === "range") && goal && goal.value !== baseline.value) better = goal.value < baseline.value ? "lower" : "higher";
	if (!beyondUp && !beyondDown) {
		base.direction = "within";
		base.verdict = "波动内";
		base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，在正常波动范围（${(band.down * 100).toFixed(0)}% 至 +${(band.up * 100).toFixed(0)}%）内，还不能算真实变化。`;
	} else if (better === "lower" || better === "higher") {
		const improved = better === "lower" && beyondDown || better === "higher" && beyondUp;
		base.direction = improved ? "improved" : "worse";
		base.verdict = improved ? "有效" : "反向";
		base.reason_zh = improved ? `变化 ${(pct * 100).toFixed(0)}%，超出正常波动，是真实的改善。` : `变化 ${(pct * 100).toFixed(0)}%，超出正常波动，朝不好的方向走了。`;
	} else {
		base.direction = "unknown";
		base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，超出正常波动；这一项没有“越低越好”或“越高越好”的方向，请结合参考范围看。`;
	}
	if (base.verdict === "有效" && base.combined_with.length > 0) base.reason_zh += `同期还有${base.combined_with.join("、")}，只能说明组合有效，分不出是哪一项。`;
	if ((base.verdict === "有效" || base.verdict === "反向") && base.confounders.length > 0) base.reason_zh += `期间还有其他变化（${base.confounders.slice(0, 2).join("；")}），结论要打折扣。`;
	if (adherence?.level === "low") {
		base.verdict = "无法判断";
		base.reason_zh = `执行率只有 ${Math.round((adherence.rate ?? 0) * 100)}%，${marker.label}的变化评价不了这项方案本身。${base.reason_zh}`;
	}
	if (!marker.biovar.verified) base.reason_zh += "（波动范围所用的变异数据尚未核对来源。）";
	return base;
}
function headline(verdicts) {
	if (verdicts.some((row) => row.verdict === "有效")) return "有效";
	if (verdicts.some((row) => row.verdict === "反向")) return "反向";
	if (verdicts.some((row) => row.verdict === "波动内")) return "波动内";
	return "无法判断";
}
function evaluatePlan(input) {
	return input.plan.items.map((item) => {
		const adherence = input.adherence[item.id] ?? adherenceFor(item, {
			start: item.start,
			end: input.today
		}, { checkins: [] });
		const verdicts = item.markers.map((name) => evaluateMarker(item, input.markers[name] ?? {
			asked: name,
			label: name,
			indicator: null,
			unit: "",
			biovar: null
		}, {
			...input,
			adherence: {
				...input.adherence,
				[item.id]: adherence
			}
		}));
		return {
			id: item.id,
			title: item.title,
			category: item.category,
			category_zh: CATEGORY_ZH[item.category],
			start: item.start,
			end: item.end,
			days: Math.max(0, daysBetween(item.start, item.end && item.end < input.today ? item.end : input.today)),
			adherence,
			verdicts,
			headline: headline(verdicts)
		};
	});
}
/**
* Concrete next steps within the harness's boundary: follow the plan, retest on
* time, measure what is missing, change one thing at a time, and discuss a
* plan that is not working with the doctor or coach. Never a dose.
*/
function suggestNext(summaries, context) {
	const out = [];
	const seenRetest = /* @__PURE__ */ new Set();
	for (const item of summaries) {
		if ((item.adherence.level === "low" || item.adherence.level === "partial") && item.days >= 14) out.push({
			kind: "adherence",
			priority: item.adherence.level === "low" ? 1 : 3,
			item: item.id,
			text_zh: `「${item.title}」执行率 ${Math.round((item.adherence.rate ?? 0) * 100)}%。先把执行稳定在八成以上，再判断它有没有用。`
		});
		if (item.adherence.source === "none" && item.days >= 7) out.push({
			kind: "record",
			priority: 4,
			item: item.id,
			text_zh: item.adherence.note_zh.startsWith("在 Mirobody") ? `「${item.title}」没有服用记录。${item.adherence.note_zh}` : `「${item.title}」还没有执行记录。每天在对话里说一句“今天${item.title}完成了”就能记下。`
		});
		for (const row of item.verdicts) {
			if (!row.indicator) out.push({
				kind: "missing_marker",
				priority: 3,
				item: item.id,
				marker: row.marker,
				text_zh: `「${item.title}」针对${row.marker}，但记录里没有这一项。下次检查加测。`
			});
			else if (row.next_retest && !seenRetest.has(`${row.marker}:${row.next_retest}`)) {
				seenRetest.add(`${row.marker}:${row.next_retest}`);
				out.push({
					kind: "retest",
					priority: row.next_retest <= context.today ? 2 : 5,
					marker: row.marker,
					date: row.next_retest,
					text_zh: row.next_retest <= context.today ? `现在可以复测${row.marker}了。` : `${row.next_retest} 之后复测${row.marker}。`
				});
			}
			if (row.verdict === "反向") out.push({
				kind: "worse",
				priority: 1,
				item: item.id,
				marker: row.marker,
				text_zh: `${row.marker}在「${item.title}」期间变差且超出波动。建议复查确认，并和医生讨论。`
			});
			if (row.reason_zh.startsWith("CRP 高于 10")) out.push({
				kind: "acute",
				priority: 2,
				marker: row.marker,
				text_zh: "CRP 超过 10 mg/L。身体恢复两周后再测一次 CRP，再做比较。"
			});
			if (row.verdict === "有效" && row.combined_with.length > 0) out.push({
				kind: "one_change",
				priority: 4,
				item: item.id,
				text_zh: `${row.marker}的改善来自「${item.title}」和${row.combined_with.join("、")}的组合。下次调整一次只改一项，才分得清谁起作用。`
			});
			if (row.verdict === "波动内" && item.adherence.level === "good" && item.days >= 90) out.push({
				kind: "review",
				priority: 3,
				item: item.id,
				marker: row.marker,
				text_zh: `「${item.title}」执行得很好，但${row.marker}的变化还在波动范围内。可以再复测一次确认，或和医生、长寿师讨论是否调整这一项。`
			});
		}
	}
	for (const lever of (context.levers ?? []).slice(0, 2)) {
		if (lever.years >= -.2) continue;
		out.push({
			kind: "lever",
			priority: 4,
			text_zh: `按表型年龄模型，${lever.label}从 ${lever.from} 到 ${lever.to}，表型年龄约 ${lever.years.toFixed(1)} 岁（模型估计）。它是你当前最大的杠杆。`
		});
	}
	const unique = /* @__PURE__ */ new Map();
	for (const row of out) if (!unique.has(row.text_zh)) unique.set(row.text_zh, row);
	return [...unique.values()].sort((a, b) => a.priority - b.priority).slice(0, 10);
}
//#endregion
//#region src/tracking.ts
const PHENOAGE_SKILL = "accelerated-biological-aging-risk";
const RISK_SKILL = "china-par-ascvd-risk";
const CACHE_TTL_MS = 6e4;
const memo = /* @__PURE__ */ new Map();
const leverMemo = /* @__PURE__ */ new Map();
function invalidateTracking() {
	memo.clear();
}
function referenceStats(reference) {
	return {
		biovar_markers: reference.biovar.markers.length,
		biovar_verified: reference.biovar.markers.filter((row) => row.verified).length,
		effects: reference.effects.length,
		effects_verified: reference.effects.filter((row) => row.verified).length,
		...reference.error ? { error: reference.error } : {}
	};
}
async function buildTracking(context) {
	const plan = currentPlan(context.dataDir);
	const checkins = readCheckIns(context.dataDir);
	const key = [
		context.dataDir,
		context.skillsHome,
		context.today,
		plan?.version ?? 0,
		checkins.length,
		context.catalog.revision
	].join("\0");
	const hit = memo.get(key);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
	const value = compute(context, plan, checkins);
	memo.set(key, {
		at: Date.now(),
		value
	});
	value.catch(() => memo.delete(key));
	return value;
}
async function compute(context, plan, checkins) {
	const reference = loadReference(context.skillsHome);
	const errors = [];
	const versions = readPlans(context.dataDir).map((row) => ({
		version: row.version,
		saved_at: row.saved_at,
		title: row.title,
		items: row.items.length
	}));
	const bioage = await ensureBioAge(context, reference);
	const goals = plan?.goals ?? [];
	const models = await modelCards(context, reference, goals);
	const levers = models.find((card) => card.model === "phenoage")?.levers ?? [];
	if (!plan) return {
		status: "no_plan",
		today: context.today,
		plan: null,
		versions,
		items: [],
		suggestions: [],
		charts: [],
		bioage,
		models,
		checkins: [],
		reference: referenceStats(reference),
		errors
	};
	const resolvedList = resolveMarkers([.../* @__PURE__ */ new Set([...plan.items.flatMap((item) => item.markers), ...goals.map((goal) => goal.marker)])], context.records.indicators, reference.biovar);
	const markers = Object.fromEntries(resolvedList.map((row) => [row.asked, row]));
	const earliest = plan.items.map((item) => item.start).sort()[0] ?? context.today;
	const indicatorNames = [...new Set(resolvedList.map((row) => row.indicator).filter((name) => Boolean(name)))];
	const seriesStart = addDays(earliest, -200);
	const labs = context.records.record_status === "ok" && indicatorNames.length > 0 ? await loadSeries(context.config, indicatorNames, {
		start: seriesStart,
		end: context.today,
		resolution: "raw"
	}) : {
		series: {},
		truncated: false
	};
	if ("error" in labs && labs.error) errors.push(`读取检查结果：${labs.error}`);
	const series = Object.fromEntries(Object.entries(labs.series).map(([name, row]) => [name, row.points]));
	const adherence = {};
	const calendarStart = addDays(context.today, -83);
	for (const item of plan.items) {
		const window = {
			start: calendarStart,
			end: context.today
		};
		let daily;
		let doses;
		if (item.target && context.records.record_status === "ok") {
			const read = await loadSeries(context.config, [item.target.metric], {
				start: item.start < calendarStart ? item.start : calendarStart,
				end: context.today,
				resolution: "day"
			});
			if (read.error) errors.push(`读取${item.target.metric}：${read.error}`);
			daily = read.series[item.target.metric]?.points ?? [];
		} else if (item.mirobody && context.records.record_status === "ok") {
			const read = await loadDoseLog(context.config, item.mirobody.medication, item.start, context.today);
			if (read.error) errors.push(`读取${item.mirobody.medication}的服用记录：${read.error}`);
			doses = read.rows;
		}
		adherence[item.id] = adherenceFor(item, window, {
			daily,
			doses,
			checkins
		});
	}
	const courses = context.records.record_status === "ok" ? (await loadCourses(context.config)).rows : [];
	const items = evaluatePlan({
		plan,
		goals,
		today: context.today,
		markers,
		series,
		adherence,
		courses,
		checkins,
		biovar: reference.biovar,
		effects: reference.effects
	});
	const suggestions = suggestNext(items, {
		today: context.today,
		levers
	});
	const charts = chartsFor(plan, resolvedList, series, reference, goals);
	return {
		status: "ok",
		today: context.today,
		plan,
		versions,
		items,
		suggestions,
		charts,
		bioage,
		models,
		checkins: checkins.slice(-30).reverse(),
		reference: referenceStats(reference),
		errors
	};
}
function chartsFor(plan, markers, series, reference, goals) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const marker of markers) {
		if (!marker.indicator || seen.has(marker.indicator)) continue;
		seen.add(marker.indicator);
		const raw = (series[marker.indicator] ?? []).map((point) => ({
			date: point.date,
			value: point.value
		}));
		const points = marker.biovar?.average_days ? weeklyMeans(raw) : raw;
		if (points.length === 0) continue;
		const items = plan.items.filter((item) => item.markers.includes(marker.asked)).map((item) => item.id);
		const firstStart = plan.items.filter((item) => items.includes(item.id)).map((item) => item.start).sort()[0];
		const base = (firstStart ? points.filter((point) => point.date <= firstStart).at(-1) : void 0) ?? points[0];
		let band = null;
		if (base && marker.biovar) {
			const rcv = rcvBand(marker.biovar, reference.biovar.z);
			band = {
				base: base.value,
				base_date: base.date,
				low: base.value * (1 + rcv.down),
				high: base.value * (1 + rcv.up),
				verified: marker.biovar.verified
			};
		}
		const goal = goals.find((row) => row.marker === marker.asked || markers.find((other) => other.asked === row.marker)?.indicator === marker.indicator);
		out.push({
			key: marker.biovar?.key ?? marker.indicator,
			label: marker.label,
			indicator: marker.indicator,
			unit: marker.unit,
			better: marker.biovar?.better ?? "none",
			points,
			band,
			goal: goal ? goal.value : null,
			items
		});
	}
	return out;
}
function weeklyMeans(points) {
	const weeks = /* @__PURE__ */ new Map();
	for (const point of points) {
		const at = /* @__PURE__ */ new Date(`${point.date}T00:00:00Z`);
		at.setUTCDate(at.getUTCDate() - (at.getUTCDay() + 6) % 7);
		const key = at.toISOString().slice(0, 10);
		weeks.set(key, [...weeks.get(key) ?? [], point.value]);
	}
	return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({
		date,
		value: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
	}));
}
function pairsFor(card, records) {
	return measurementInputs(card).filter((spec) => spec.required).map((spec) => ({
		spec,
		indicator: indicatorFor(spec, records.indicators)
	}));
}
function ageOn(date, today, ageNow) {
	return Math.round((ageNow - daysBetween(date, today) / 365.25) * 10) / 10;
}
async function ensureBioAge(context, reference) {
	const empty = (status, note, missing = []) => ({
		status,
		note_zh: note,
		missing,
		points: pointsFromHistory(context.dataDir),
		band_years: null,
		band_verified: false,
		band_missing: [],
		runs: 0
	});
	const card = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL);
	if (!card || !card.script) return empty("no_skill", "技能库里没有表型年龄方法。");
	if (context.records.record_status !== "ok") return empty("no_record", "还没有接上 Mirobody 记录，无法回算历次体检的表型年龄。");
	const pairs = pairsFor(card, context.records);
	const missing = pairs.filter((pair) => !pair.indicator).map((pair) => pair.spec.label_zh);
	if (missing.length > 0) return empty("missing_inputs", `记录里还缺${missing.join("、")}，凑齐九项血检才能算表型年龄。`, missing);
	const ageNow = context.records.profile.age;
	if (ageNow == null) return empty("no_age", "档案里还没有实足年龄。保存年龄后才能回算表型年龄。");
	const names = pairs.map((pair) => pair.indicator?.name);
	const read = await loadSeries(context.config, names, {
		start: addDays(context.today, -1095),
		end: context.today,
		resolution: "raw"
	});
	if (read.error && Object.keys(read.series).length === 0) return empty("error", `读取历次血检失败：${read.error}`);
	const byDate = /* @__PURE__ */ new Map();
	for (const pair of pairs) for (const point of read.series[pair.indicator?.name]?.points ?? []) {
		const day = byDate.get(point.date) ?? /* @__PURE__ */ new Map();
		day.set(pair.spec.key, point);
		byDate.set(point.date, day);
	}
	const checkups = [...byDate.entries()].filter(([, day]) => pairs.every((pair) => day.has(pair.spec.key))).map(([date]) => date).sort().slice(-6);
	if (checkups.length === 0) return empty("no_checkup", "没有一次检查同时测齐九项血检，还不能算表型年龄。");
	const done = new Set(readHistory(context.dataDir, 1e3).filter((row) => row.skill === "accelerated-biological-aging-risk" && row.measured_at).map((row) => row.measured_at));
	let runs = 0;
	for (const date of checkups) {
		if (done.has(date)) continue;
		const day = byDate.get(date);
		const measurements = pairs.map((pair) => {
			const point = day.get(pair.spec.key);
			return {
				key: pair.spec.key,
				value: point.value,
				unit: point.unit
			};
		});
		await runSkill({
			home: context.skillsHome,
			dataDir: context.dataDir,
			name: PHENOAGE_SKILL,
			args: [],
			files: [],
			measurements,
			profile: {
				age: ageOn(date, context.today, ageNow),
				sex: context.records.profile.sex
			},
			useProfile: true,
			python: context.config.skillPython,
			runtimes: context.config.skillRuntimes,
			timeoutMs: context.config.skillTimeoutMs,
			revision: context.catalog.revision,
			measuredAt: date
		});
		runs += 1;
	}
	const points = pointsFromHistory(context.dataDir);
	const band = await bioAgeBand(context, reference, card, pairs, byDate, checkups.at(-1), ageNow);
	return {
		status: points.length > 0 ? "ok" : "error",
		note_zh: points.length > 0 ? `按 ${points.length} 次同时测齐九项血检的检查回算。` : "表型年龄没有算出来，请查看技能的报告。",
		missing: [],
		points,
		band_years: band?.years ?? null,
		band_verified: band?.verified ?? false,
		band_missing: band?.missing ?? [],
		runs
	};
}
function pointsFromHistory(dataDir) {
	const pheno = seriesOf(dataDir, "phenoage").filter((row) => row.measured_at);
	const advance = new Map(seriesOf(dataDir, "phenoage_advance").filter((row) => row.measured_at).map((row) => [row.measured_at, row.value]));
	const mortality = new Map(seriesOf(dataDir, "mortality_10y_pct").filter((row) => row.measured_at).map((row) => [row.measured_at, row.value]));
	return pheno.map((row) => ({
		date: row.measured_at,
		phenoage: Number(row.value),
		advance: advance.has(row.measured_at) ? Number(advance.get(row.measured_at)) : null,
		mortality_10y_pct: mortality.has(row.measured_at) ? Number(mortality.get(row.measured_at)) : null
	})).filter((row) => Number.isFinite(row.phenoage)).slice(-6);
}
async function leversAt(context, card, measurements, age, targets, date) {
	const key = JSON.stringify([
		card.name,
		context.catalog.revision,
		date,
		measurements,
		age,
		targets
	]);
	if (leverMemo.has(key)) return leverMemo.get(key) ?? null;
	const files = [];
	const args = [];
	const flag = card.entry?.targets_flag;
	if (flag && targets.length > 0) {
		const staged = stageMeasurements(card, targets);
		files.push({
			name: "targets.csv",
			text: staged.csv
		});
		args.push(flag, "targets.csv");
	}
	const result = await runSkill({
		home: context.skillsHome,
		dataDir: context.dataDir,
		name: card.name,
		args,
		files,
		measurements,
		profile: {
			age,
			sex: context.records.profile.sex
		},
		useProfile: true,
		python: context.config.skillPython,
		runtimes: context.config.skillRuntimes,
		timeoutMs: context.config.skillTimeoutMs,
		revision: context.catalog.revision,
		measuredAt: date
	});
	const levers = result.ok ? result.levers ?? null : null;
	leverMemo.set(key, levers);
	if (leverMemo.size > 50) leverMemo.delete(leverMemo.keys().next().value);
	return levers;
}
function latestMeasurements(pairs, byDate, date) {
	const day = byDate.get(date);
	return pairs.map((pair) => {
		const point = day.get(pair.spec.key);
		return {
			key: pair.spec.key,
			value: point.value,
			unit: point.unit
		};
	});
}
/** Years of phenotypic age that within-person variation of the nine inputs could move, from the skill's own slopes. */
async function bioAgeBand(context, reference, card, pairs, byDate, date, ageNow) {
	const levers = await leversAt(context, card, latestMeasurements(pairs, byDate, date), ageOn(date, context.today, ageNow), [], date);
	if (!levers) return null;
	let variance = 0;
	let verified = true;
	const missing = [];
	for (const row of levers.sensitivity) {
		const pair = pairs.find((item) => item.spec.key === row.key);
		const marker = pair?.indicator ? markerFor(reference.biovar, pair.indicator) : null;
		if (!marker || row.years_per_unit == null) {
			missing.push(row.label_zh);
			continue;
		}
		verified &&= marker.verified;
		const cvi = marker.cvi_pct / 100;
		const cva = (marker.cva_pct ?? marker.cvi_pct / 2) / 100;
		const relative = marker.log_normal ? Math.sqrt(Math.log(1 + cvi * cvi) + Math.log(1 + cva * cva)) : Math.sqrt(cvi * cvi + cva * cva);
		variance += (row.years_per_unit * row.value * relative) ** 2;
	}
	if (missing.length === levers.sensitivity.length) return null;
	return {
		years: Math.SQRT2 * reference.biovar.z * Math.sqrt(variance),
		verified,
		missing
	};
}
function goalTargets(card, goals, reference) {
	const index = aliasIndex(measurementInputs(card));
	const out = [];
	for (const goal of goals) {
		let hit = resolveInput(index, goal.marker);
		if (!hit) {
			const marker = reference.biovar.markers.find((row) => row.key === goal.marker) ?? markerFor(reference.biovar, {
				name: goal.marker,
				label: goal.marker
			});
			const spec = marker ? measurementInputs(card).find((item) => (item.loinc ?? []).some((code) => marker.loinc.includes(code))) : void 0;
			if (spec) hit = {
				spec,
				byKey: true
			};
		}
		if (hit) out.push({
			key: hit.spec.key,
			value: goal.value,
			unit: goal.unit
		});
	}
	return out;
}
function fmt(value) {
	return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(3)));
}
async function modelCards(context, reference, goals) {
	const cards = [];
	const pheno = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL);
	const boundary = "模型估计，基于人群数据拟合，不是对你个人的预测，也不是寿命预测。";
	if (pheno && pheno.entry?.levers_json && context.records.record_status === "ok" && context.records.profile.age != null) {
		const pairs = pairsFor(pheno, context.records);
		if (pairs.every((pair) => pair.indicator)) {
			const names = pairs.map((pair) => pair.indicator?.name);
			const read = await loadSeries(context.config, names, {
				start: addDays(context.today, -1095),
				end: context.today,
				resolution: "raw"
			});
			const byDate = /* @__PURE__ */ new Map();
			for (const pair of pairs) for (const point of read.series[pair.indicator?.name]?.points ?? []) {
				const day = byDate.get(point.date) ?? /* @__PURE__ */ new Map();
				day.set(pair.spec.key, point);
				byDate.set(point.date, day);
			}
			const date = [...byDate.entries()].filter(([, day]) => pairs.every((pair) => day.has(pair.spec.key))).map(([day]) => day).sort().at(-1);
			if (date) {
				const targets = goalTargets(pheno, goals, reference);
				const age = ageOn(date, context.today, context.records.profile.age);
				const current = latestMeasurements(pairs, byDate, date);
				const levers = await leversAt(context, pheno, current, age, targets, date);
				const inTheirUnits = (key, fallback) => {
					const now = current.find((row) => row.key === key);
					const goal = targets.find((row) => row.key === key);
					return now && goal ? {
						from: `${fmt(Number(now.value))} ${now.unit}`.trim(),
						to: `${fmt(Number(goal.value))} ${goal.unit}`.trim()
					} : fallback;
				};
				if (levers) {
					const target = levers.targets;
					const sensitivity = levers.sensitivity.map((row) => {
						const pair = pairs.find((item) => item.spec.key === row.key);
						const marker = pair?.indicator ? markerFor(reference.biovar, pair.indicator) : null;
						const relative = marker ? marker.cvi_pct / 100 : .1;
						const stepValue = row.value * relative;
						return {
							label: row.label_zh,
							unit: row.unit,
							years_per_step: (row.years_per_unit ?? 0) * stepValue,
							step: `${fmt(stepValue)} ${row.unit}`
						};
					}).filter((row) => Number.isFinite(row.years_per_step)).sort((a, b) => Math.abs(b.years_per_step) - Math.abs(a.years_per_step)).slice(0, 5);
					cards.push({
						model: "phenoage",
						title_zh: "表型年龄",
						status: target ? "ok" : "no_goal",
						note_zh: target ? `按 ${date} 的血检，达到方案目标时表型年龄 ${target.phenoage_delta != null && target.phenoage_delta <= 0 ? "年轻" : "变化"} ${fmt(Math.abs(target.phenoage_delta ?? 0))} 岁。` : "方案里还没有和九项血检对应的目标值。设定目标（如空腹血糖、超敏 CRP）后，这里会算出达到目标时的表型年龄。",
						measured_on: date,
						now: {
							phenoage: levers.current.phenoage ?? null,
							mortality_10y_pct: levers.current.mortality_10y_pct ?? null,
							age
						},
						goal: target ? {
							phenoage: target.phenoage ?? null,
							mortality_10y_pct: target.mortality_10y_pct ?? null,
							phenoage_delta: target.phenoage_delta ?? null
						} : null,
						levers: levers.levers.map((row) => ({
							label: row.label_zh,
							...inTheirUnits(row.key, {
								from: `${fmt(row.from)} ${row.unit}`,
								to: `${fmt(row.to)} ${row.unit}`
							}),
							years: row.phenoage_delta ?? 0
						})),
						sensitivity,
						boundary_zh: boundary
					});
				}
			}
		}
	}
	const risk = context.catalog.cards.find((item) => item.name === RISK_SKILL);
	cards.push(await riskCard(context, reference, risk, goals));
	return cards;
}
async function riskCard(context, reference, card, goals) {
	const base = {
		model: "china-par",
		title_zh: "10 年动脉粥样硬化性心血管病风险（China-PAR）",
		status: "unavailable",
		note_zh: "",
		measured_on: null,
		now: {},
		goal: null,
		levers: [],
		sensitivity: [],
		boundary_zh: "模型估计：China-PAR 按中国成人队列建立，给出的是和你条件相同的人群平均风险，不是诊断。"
	};
	if (!card || !card.script || card.inputsStatus !== "verified") {
		base.note_zh = "风险模型还没有通过系数校验，暂不显示数值。";
		return base;
	}
	if (context.records.record_status !== "ok" || context.records.profile.age == null) {
		base.note_zh = "需要 Mirobody 记录和档案里的实足年龄。";
		return base;
	}
	const specs = measurementInputs(card);
	const measurements = [];
	const missing = [];
	for (const spec of specs) {
		const row = indicatorFor(spec, context.records.indicators);
		if (row) measurements.push({
			key: spec.key,
			value: row.value,
			unit: row.unit
		});
		else if (spec.required) missing.push(spec.label_zh);
	}
	if (missing.length > 0) {
		base.note_zh = `还缺${missing.join("、")}。`;
		return base;
	}
	const targets = goalTargets(card, goals, reference);
	const levers = await leversAt(context, card, measurements, context.records.profile.age, targets, context.today);
	if (!levers) {
		base.note_zh = "风险模型没有算出结果，请在对话里运行它查看原因。";
		return base;
	}
	const target = levers.targets;
	return {
		...base,
		status: target ? "ok" : "no_goal",
		note_zh: target ? "达到方案目标时的 10 年风险按同一模型计算。" : "设定血压、血脂等目标后，这里会算出达到目标时的风险。",
		measured_on: context.today,
		now: { risk_pct: levers.current.risk_pct ?? null },
		goal: target ? {
			risk_pct: target.risk_pct ?? null,
			risk_delta_pct: target.risk_delta_pct ?? null
		} : null,
		levers: levers.levers.map((row) => ({
			label: row.label_zh,
			from: `${fmt(row.from)} ${row.unit}`,
			to: `${fmt(row.to)} ${row.unit}`,
			years: row.risk_delta_pct ?? 0
		}))
	};
}
/** Model cards for goal values named in conversation, without saving them to the plan. */
async function modelGoals(context, goals) {
	return {
		models: await modelCards(context, loadReference(context.skillsHome), goals),
		how_to_read: "Model estimates at the latest complete checkup. levers[].years is the change in phenotypic age (years) or, for china-par, in 10-year risk (percentage points) from moving that one marker alone. Say 模型估计 and quote boundary_zh; never present it as a personal prediction or a lifespan."
	};
}
function describeItem(item) {
	const parts = [`${CATEGORY_ZH[item.category]}｜${item.title}`, `${item.start} 起${item.end ? `，${item.end} 止` : ""}`];
	if (item.frequency) parts.push(`每${item.frequency.per === "day" ? "天" : "周"} ${item.frequency.times} 次`);
	if (item.target) parts.push(`手环目标 ${item.target.metric} ${item.target.op} ${item.target.value}${item.target.unit ? ` ${item.target.unit}` : ""}`);
	if (item.markers.length > 0) parts.push(`看 ${item.markers.join("、")}`);
	if (item.mirobody) parts.push(`服用记录来自 Mirobody（${item.mirobody.medication}）`);
	return parts.join("；");
}
//#endregion
//#region src/routes.ts
function sendJson(res, status, body) {
	if (res.writableEnded) return;
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.end(JSON.stringify(body));
}
function readBody(req, limit = 8e3) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > limit) {
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
function questionOf(url) {
	if (!url) return "";
	return new URL(url, "http://127.0.0.1").searchParams.get("q")?.trim() ?? "";
}
function registerRoutes(ctx, config, mount) {
	ctx.inject(["webServer"], (scoped) => {
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/version",
			handler: (_req, res) => sendJson(res, 200, {
				product: PRODUCT_NAME,
				version: PRODUCT_VERSION
			})
		});
		const context = async () => {
			const current = config();
			const dataDir = resolveDataDir(current.dataDir);
			const skillsHome = resolveSkillsHome(current.skillsHome);
			return {
				current,
				dataDir,
				skillsHome,
				catalog: loadCatalog(skillsHome),
				records: await loadRecords(current, dataDir, mount.pluginHome)
			};
		};
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/board",
			handler: (req, res) => {
				if (req.method !== "GET" && req.method !== "HEAD") {
					sendJson(res, 405, {
						ok: false,
						error: "GET only"
					});
					return;
				}
				(async () => {
					if (new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("refresh")) {
						invalidateRecords();
						invalidateTracking();
					}
					const { current, dataDir, catalog, records } = await context();
					const outputs = latestOutputs(dataDir);
					sendJson(res, 200, {
						...buildBoard({
							catalog,
							records,
							mount,
							receipts: readReceipts(dataDir, 5),
							limit: clampMatches(current.maxSkillMatches),
							outputs
						}),
						readiness: readiness(catalog, records, outputs),
						today: isoDay()
					});
				})().catch(() => sendJson(res, 500, {
					ok: false,
					error: "board failed"
				}));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/tracking",
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, {
						ok: false,
						error: "GET only"
					});
					return;
				}
				(async () => {
					const { current, dataDir, skillsHome, catalog, records } = await context();
					sendJson(res, 200, await buildTracking({
						config: current,
						dataDir,
						skillsHome,
						catalog,
						records,
						today: isoDay()
					}));
				})().catch(() => sendJson(res, 500, {
					ok: false,
					error: "tracking failed"
				}));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/checkin",
			handler: (req, res) => {
				if (req.method !== "POST") {
					sendJson(res, 405, {
						ok: false,
						error: "POST only"
					});
					return;
				}
				(async () => {
					let parsed;
					try {
						parsed = JSON.parse(await readBody(req));
					} catch {
						sendJson(res, 400, {
							ok: false,
							error: "check-in must be JSON"
						});
						return;
					}
					const entries = Array.isArray(parsed) ? parsed : [parsed];
					const result = addCheckIns(resolveDataDir(config().dataDir), entries, {
						today: isoDay(),
						source: "board"
					});
					if (result.saved.length > 0) invalidateTracking();
					sendJson(res, result.saved.length > 0 ? 200 : 400, {
						ok: result.saved.length > 0,
						saved: result.saved,
						problems: result.problems
					});
				})().catch(() => sendJson(res, 400, {
					ok: false,
					error: "check-in failed"
				}));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/run-ready",
			handler: (req, res) => {
				if (req.method !== "POST") {
					sendJson(res, 405, {
						ok: false,
						error: "POST only"
					});
					return;
				}
				(async () => {
					const { current, dataDir, skillsHome, catalog, records } = await context();
					const results = await runReady({
						config: current,
						dataDir,
						skillsHome,
						catalog,
						records,
						outputs: latestOutputs(dataDir)
					});
					invalidateTracking();
					sendJson(res, 200, {
						ok: true,
						results
					});
				})().catch(() => sendJson(res, 500, {
					ok: false,
					error: "run failed"
				}));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/report",
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, {
						ok: false,
						error: "GET only"
					});
					return;
				}
				(async () => {
					const { current, dataDir, skillsHome, catalog, records } = await context();
					const today = isoDay();
					const tracking = await buildTracking({
						config: current,
						dataDir,
						skillsHome,
						catalog,
						records,
						today
					}).catch(() => null);
					const text = buildReport({
						name: records.profile.displayName,
						today,
						records,
						tracking
					});
					res.statusCode = 200;
					res.setHeader("Content-Type", "text/markdown; charset=utf-8");
					res.setHeader("Content-Disposition", `attachment; filename="longpi-report-${today}.md"`);
					res.setHeader("Cache-Control", "no-store");
					res.end(text);
				})().catch(() => sendJson(res, 500, {
					ok: false,
					error: "report failed"
				}));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/match",
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, {
						ok: false,
						error: "GET only"
					});
					return;
				}
				(async () => {
					const current = config();
					const dataDir = resolveDataDir(current.dataDir);
					const home = resolveSkillsHome(current.skillsHome);
					const catalog = loadCatalog(home);
					const records = await loadRecords(current, dataDir, mount.pluginHome);
					const matched = matchSkills(catalog.cards, questionOf(req.url), records.indicators, clampMatches(current.maxSkillMatches), {
						intents: catalog.intents,
						profile: {
							age: records.profile.age,
							sex: records.profile.sex
						},
						outputs: latestOutputs(dataDir),
						lexicon: loadEvidenceLexicon(home)
					});
					sendJson(res, 200, {
						revision: catalog.revision,
						count: catalog.cards.length,
						error: catalog.error,
						...matched
					});
				})().catch(() => sendJson(res, 500, {
					ok: false,
					error: "match failed"
				}));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/stats",
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, {
						ok: false,
						error: "GET only"
					});
					return;
				}
				sendJson(res, 200, buildStats(resolveDataDir(config().dataDir)));
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/intents",
			handler: (req, res) => {
				if (req.method !== "GET") {
					sendJson(res, 405, {
						ok: false,
						error: "GET only"
					});
					return;
				}
				const catalog = loadCatalog(resolveSkillsHome(config().skillsHome));
				sendJson(res, 200, {
					version: catalog.version,
					intents: catalog.intents.map((item) => ({
						id: item.id,
						label: item.label_zh,
						skills: item.skills
					}))
				});
			}
		});
		scoped.webServer.register({
			kind: "exact",
			path: "/api/longpi/profile",
			handler: (req, res) => {
				if (req.method !== "POST") {
					sendJson(res, 405, {
						ok: false,
						error: "POST only"
					});
					return;
				}
				(async () => {
					const raw = await readBody(req);
					let parsed;
					try {
						parsed = JSON.parse(raw);
					} catch {
						sendJson(res, 400, {
							ok: false,
							error: "profile must be JSON"
						});
						return;
					}
					const normalized = normalizeProfile(parsed);
					if (!normalized.ok) {
						sendJson(res, 400, {
							ok: false,
							error: normalized.error
						});
						return;
					}
					writeProfile(resolveDataDir(config().dataDir), normalized.profile);
					invalidateTracking();
					sendJson(res, 200, {
						ok: true,
						profile: normalized.profile
					});
				})().catch((error) => {
					const message = error instanceof Error ? error.message : "profile failed";
					sendJson(res, 400, {
						ok: false,
						error: message === "body too large" ? message : "profile failed"
					});
				});
			}
		});
	});
}
//#endregion
//#region src/json.ts
function asJson(value) {
	return value;
}
//#endregion
//#region src/tools.ts
function jsonText$1(value) {
	return [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}];
}
const jsonOut$1 = {
	schema: { type: "json" },
	render: (_args, value) => jsonText$1(value)
};
const EVIDENCE_SKILL = "longevity-evidence";
function manifestSummary(card) {
	return {
		tier: card.tier,
		kind: card.kind,
		species: card.species,
		intents: card.intents,
		inputs_status: card.inputsStatus,
		structured_measurements: card.inputsStatus !== "none" && Boolean(card.entry?.measurements_flag),
		inputs: card.inputs.map((spec) => ({
			key: spec.key,
			label: spec.label_zh,
			unit: spec.unit ?? "",
			also_accepts: Object.keys(spec.accept ?? {}),
			unit_required: Boolean(spec.unit_required),
			range: spec.range ?? null,
			required: spec.required,
			from: spec.from,
			...spec.output_of ? { output_of: spec.output_of } : {},
			...spec.note_zh ? { note: spec.note_zh } : {}
		})),
		outputs: card.outputs,
		runtime: card.entry?.runtime ?? ""
	};
}
function versionCheck(catalog, pinned) {
	const want = pinned.trim().replace(/^v/, "");
	if (!want) return {
		pinned: "",
		catalog: catalog.version,
		matches: null
	};
	return {
		pinned: want,
		catalog: catalog.version,
		matches: catalog.version === want
	};
}
function registerTools(ctx, config, mount) {
	const where = () => {
		const current = config();
		return {
			skillsHome: resolveSkillsHome(current.skillsHome),
			dataDir: resolveDataDir(current.dataDir),
			current
		};
	};
	async function situation() {
		const { skillsHome, dataDir, current } = where();
		return {
			catalog: loadCatalog(skillsHome),
			records: await loadRecords(current, dataDir, mount.pluginHome),
			outputs: latestOutputs(dataDir),
			skillsHome,
			dataDir,
			current
		};
	}
	ctx.tools.register(defineTool({
		name: "read_personal_situation",
		description: "Read this person's saved profile, a summary of their Mirobody record (indicator names, latest values, units, medication plan), readouts earlier skill runs produced, and which methods their record can already run. Read-only. Use this before choosing a longevity skill. Absence means not on file. Do not invent a lab, a dose, or a genotype. Genetics are not listed here; name rsIDs with query_genetic_data. An estimated age from birth year is not the age to pass to a skill unless the saved age field is set.",
		parameters: {},
		output: jsonOut$1,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute() {
			const { catalog, records, outputs, current } = await situation();
			const profile = {
				age: records.profile.age,
				sex: records.profile.sex
			};
			const dispatch = matchSkills(catalog.cards, "", records.indicators, clampMatches(current.maxSkillMatches), {
				intents: catalog.intents,
				profile,
				outputs
			});
			return asJson({
				profile: records.profile,
				estimated_age_from_birth_year: records.estimated_age,
				use_saved_age: records.profile.age,
				indicators: records.indicators.slice(0, 120),
				indicator_count: records.indicators.length,
				medications: records.medications,
				earlier_readouts: outputs,
				runnable_now: dispatch.matches.map((item) => ({
					name: item.name,
					blurb: item.blurb
				})),
				almost_runnable: dispatch.near.map((item) => ({
					name: item.name,
					missing: item.runnable.missing
				})),
				record_status: records.record_status,
				record_error: records.record_error,
				mcp: records.mcp,
				note: "Medication doses are what the record says. They are not an instruction to change a dose. A missing indicator was not on file. earlier_readouts are outputs of skills already run for this person; cite them with their date."
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "list_longevity_intents",
		description: "List the kinds of questions the longevity library answers (biological age, methylation age, wearable and sleep, does an intervention have evidence, genes, before-and-after, …), the data each needs, and for this person which skills of each are ready to run or missing one or two inputs. Use this when the question is broad or matched nothing.",
		parameters: {},
		output: jsonOut$1,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute() {
			const { catalog, records, outputs } = await situation();
			const profile = {
				age: records.profile.age,
				sex: records.profile.sex
			};
			const byName = new Map(catalog.cards.map((card) => [card.name, card]));
			return asJson({
				version: catalog.version,
				intents: catalog.intents.map((intent) => ({
					id: intent.id,
					label: intent.label_zh,
					description: intent.description_zh,
					data: intent.data,
					skills: intent.skills.map((name) => {
						const card = byName.get(name);
						if (!card) return {
							name,
							available: false
						};
						const run = runnableFrom(card, records.indicators, profile, outputs);
						return {
							name,
							tier: card.tier,
							blurb: card.blurb,
							runnable: run.status,
							missing: run.missing
						};
					})
				})),
				note: "Pass an intent id to match_longevity_skills to rank that intent's skills first. intervention_evidence questions go to query_longevity_evidence."
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "match_longevity_skills",
		description: "Choose which longevity-skills apply to this person and this question. Returns a short ranked list with the detected intents and, per skill, whether this person's record already has its inputs. Dispatch only those names. Model-organism and cell-only skills appear only when the question names that organism. An empty list means nothing matched: say so and look at list_longevity_intents. The score is a sort key, not a biological age.",
		parameters: {
			question: {
				type: "string",
				description: "What the person asked, in their words. Empty lists the skills this record can already run."
			},
			intent: {
				type: "string",
				description: "Optional intent id from list_longevity_intents, when you already know what kind of question it is."
			}
		},
		output: jsonOut$1,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute(args) {
			const { catalog, records, outputs, skillsHome, current } = await situation();
			const lexicon = loadEvidenceLexicon(skillsHome);
			const question = args.question ?? "";
			const matched = matchSkills(catalog.cards, question, records.indicators, clampMatches(current.maxSkillMatches), {
				intents: catalog.intents,
				explicitIntents: args.intent ? [args.intent] : [],
				profile: {
					age: records.profile.age,
					sex: records.profile.sex
				},
				outputs,
				lexicon
			});
			return asJson({
				question,
				revision: catalog.revision,
				version: catalog.version,
				catalog_count: catalog.cards.length,
				catalog_error: catalog.error,
				saved_age: records.profile.age,
				sex: records.profile.sex,
				indicator_count: records.indicators.length,
				mentioned_entities: mentionedEntities(question, catalog.intents, lexicon),
				...matched
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "read_longevity_skill",
		description: "Read one longevity skill by its directory name, after match_longevity_skills. Follow that file. Do not run a skill you have not read. The manifest lists each input with its unit, accepted units and plausible range; when structured_measurements is true, pass values to run_longevity_skill as measurements and the harness converts units and builds the file. Missing inputs stay missing. Cohort hazard ratios and experimental doses are not personal instructions.",
		parameters: { name: {
			type: "string",
			required: true,
			description: "Skill directory name, such as accelerated-biological-aging-risk."
		} },
		output: jsonOut$1,
		timeoutMs: 3e4,
		isConcurrencySafe: () => true,
		async execute(args) {
			const { skillsHome } = where();
			const found = readSkillFile(skillsHome, args.name);
			if ("error" in found) return asJson({
				ok: false,
				error: found.error
			});
			return asJson({
				ok: true,
				name: found.card.name,
				domain: found.card.domain,
				blurb: found.card.blurb,
				has_script: Boolean(found.card.script),
				manifest: manifestSummary(found.card),
				command: commandExcerpt(found.raw),
				content: found.raw.slice(0, 3e4)
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "run_longevity_skill",
		description: "Run one skill's script. For a skill whose manifest has structured_measurements, pass measurements as {key, value, unit} copied from read_personal_situation (key may be the input key or the indicator name on the report; unit exactly as the record gives it) — the harness converts declared units, checks ranges, refuses a missing or wrong unit, fills age and sex from the saved profile, and adds --out. Otherwise stage files and arguments copied from the skill command. The script computes the readout. Do not calculate the formula yourself and do not fill a missing marker from another file or from memory. Quote the returned excerpt, including 边界. A refusal or non-zero exit is the answer; do not replace it with a guess.",
		parameters: {
			name: {
				type: "string",
				required: true,
				description: "Skill directory name returned by match_longevity_skills."
			},
			measurements: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						key: {
							type: "string",
							required: true,
							description: "Input key or the indicator name as the record shows it."
						},
						value: {
							type: "string",
							required: true,
							description: "The value exactly as recorded."
						},
						unit: {
							type: "string",
							description: "The unit exactly as recorded; empty only when none was recorded."
						}
					}
				},
				description: "Structured measurements for skills with structured_measurements."
			},
			args: {
				type: "array",
				items: { type: "string" },
				description: "Argument vector after the script, such as [\"--age\",\"45\",\"--biomarkers\",\"biomarkers.csv\",\"--out\",\"out\"]."
			},
			files: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						name: {
							type: "string",
							required: true,
							description: "File name, one segment, such as biomarkers.csv."
						},
						text: {
							type: "string",
							required: true,
							description: "UTF-8 contents built from tool results."
						}
					}
				},
				description: "Measurement files the skill command names. At most 12, each at most 256KB."
			},
			use_profile: {
				type: "boolean",
				description: "Fill age and sex from the saved profile when the skill declares them. Default true."
			}
		},
		output: jsonOut$1,
		timeoutMs: 18e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const { skillsHome, dataDir, current } = where();
			const catalog = loadCatalog(skillsHome);
			const profile = readProfile(dataDir);
			return asJson(await runSkill({
				home: skillsHome,
				dataDir,
				name: args.name,
				args: args.args ?? [],
				files: (args.files ?? []).flatMap((file) => {
					if (!file || typeof file.name !== "string" || typeof file.text !== "string") return [];
					return [{
						name: file.name,
						text: file.text
					}];
				}),
				measurements: (args.measurements ?? []).flatMap((item) => {
					if (!item || typeof item.key !== "string") return [];
					return [{
						key: item.key,
						value: String(item.value ?? ""),
						unit: typeof item.unit === "string" ? item.unit : ""
					}];
				}),
				profile: {
					age: profile.age,
					sex: profile.sex
				},
				useProfile: args.use_profile !== false,
				python: current.skillPython,
				runtimes: current.skillRuntimes,
				timeoutMs: current.skillTimeoutMs,
				revision: catalog.revision
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "query_longevity_evidence",
		description: "Look up what the papers collected in longevity-skills state about drugs, supplements, diets, genes or proteins, grouped into human studies, animal experiments and cell experiments, each with its citation. Use for \"does X work\", \"what does research say about gene Y\", or to see what the collected papers say about a medicine on the plan. It never gives a dose. Animal and cell results are not human effects.",
		parameters: {
			entities: {
				type: "array",
				items: { type: "string" },
				description: "Names to look up, in any language (NMN, 二甲双胍, rapamycin, FOXO3). match_longevity_skills returns mentioned_entities you can pass here."
			},
			include_medications: {
				type: "boolean",
				description: "Also look up every medicine on this person's plan. Default false."
			}
		},
		output: jsonOut$1,
		timeoutMs: 6e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const { skillsHome, dataDir, current } = where();
			const catalog = loadCatalog(skillsHome);
			if (!catalog.cards.some((card) => card.name === EVIDENCE_SKILL)) return asJson({
				ok: false,
				error: `${EVIDENCE_SKILL} is not in this checkout`,
				hint: "Update longevity-skills, or use the evipedia skill."
			});
			const entities = (args.entities ?? []).map((item) => String(item).trim()).filter((item) => item && !item.includes("..") && item.length <= 80).slice(0, 8);
			const runArgs = [];
			for (const entity of entities) runArgs.push("--entity", entity);
			const files = [];
			if (args.include_medications) {
				const names = (await loadRecords(current, dataDir, mount.pluginHome)).medications.map((item) => item.name).filter(Boolean);
				if (names.length > 0) {
					files.push({
						name: "meds.txt",
						text: `${names.join("\n")}\n`
					});
					runArgs.push("--medications", "meds.txt");
				}
			}
			if (runArgs.length === 0) return asJson({
				ok: false,
				error: "no entity to look up",
				hint: "Pass entities, or set include_medications when the plan is on file."
			});
			return asJson(await runSkill({
				home: skillsHome,
				dataDir,
				name: EVIDENCE_SKILL,
				args: runArgs,
				files,
				python: current.skillPython,
				runtimes: current.skillRuntimes,
				timeoutMs: current.skillTimeoutMs,
				revision: catalog.revision,
				reportLimit: 12e3
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "list_longevity_domains",
		description: "List longevity-skill domains and the directory names in each. Use this when a question matches nothing, or when the person wants to see what the harness can read. Names are methods, not advice to start a method.",
		parameters: {},
		output: jsonOut$1,
		timeoutMs: 3e4,
		isConcurrencySafe: () => true,
		async execute() {
			const catalog = loadCatalog(where().skillsHome);
			const personal = catalog.cards.filter((card) => card.tier !== "C");
			return asJson({
				revision: catalog.revision,
				version: catalog.version,
				count: catalog.cards.length,
				indexed_only: catalog.cards.length - personal.length,
				error: catalog.error,
				domains: domainSummary(personal)
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "save_personal_profile",
		description: "Save the display name, birth year, chronological age, and sex this person stated. This is the profile the skills may use. It does not write the Mirobody chart. Pass only fields the person just gave. Age must be the age they stated; do not store an age you computed unless they confirmed it. Sex is female, male, other, or unknown.",
		parameters: {
			displayName: {
				type: "string",
				description: "Name they want on the board, at most 40 characters. Omit to leave blank."
			},
			birthYear: {
				type: "integer",
				description: "Four-digit birth year, if they gave one."
			},
			age: {
				type: "integer",
				description: "Chronological age they stated, 0–130."
			},
			sex: {
				type: "string",
				enum: [
					"female",
					"male",
					"other",
					"unknown"
				],
				description: "Sex they stated."
			}
		},
		output: jsonOut$1,
		timeoutMs: 1e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const dataDir = resolveDataDir(config().dataDir);
			const current = readProfile(dataDir);
			const normalized = normalizeProfile({
				displayName: args.displayName ?? current.displayName,
				birthYear: args.birthYear ?? current.birthYear,
				age: args.age ?? current.age,
				sex: args.sex ?? current.sex
			});
			if (!normalized.ok) return asJson({
				ok: false,
				error: normalized.error
			});
			writeProfile(dataDir, normalized.profile);
			return asJson({
				ok: true,
				profile: normalized.profile,
				estimated_age_from_birth_year: estimatedAge(normalized.profile.birthYear, (/* @__PURE__ */ new Date()).getFullYear()),
				note: "Saved locally for this harness. Not written to Mirobody. Use profile.age for a skill, not the estimate, unless the person confirmed the estimate."
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "longpi_status",
		description: "Report whether the longevity-skills checkout and the Mirobody engine are available, which library version is loaded, and which skill runtimes are configured. Use this when a skill or a record tool failed. Does not return the chart or any token.",
		parameters: {},
		output: jsonOut$1,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute() {
			const current = config();
			const { skillsHome, dataDir } = where();
			const catalog = loadCatalog(skillsHome);
			const python = discoverPython(current.pythonBin, mount.pluginHome);
			const needed = [...new Set(catalog.cards.map((card) => card.entry?.runtime).filter((item) => Boolean(item)))];
			return asJson({
				version: PRODUCT_VERSION,
				skills: {
					found: Boolean(skillsHome),
					revision: catalog.revision,
					version: catalog.version,
					source: catalog.source,
					count: catalog.cards.length,
					tiers: {
						A: catalog.cards.filter((card) => card.tier === "A").length,
						B: catalog.cards.filter((card) => card.tier === "B").length,
						C: catalog.cards.filter((card) => card.tier === "C").length,
						tool: catalog.cards.filter((card) => card.tier === "tool").length
					},
					pin: versionCheck(catalog, current.skillsVersion),
					runtimes: needed.map((name) => ({
						name,
						configured: Boolean(current.skillRuntimes?.[name]?.trim())
					})),
					error: catalog.error
				},
				mirobody: {
					mounted: mount.mounted,
					peer: mount.peer,
					error: mount.error,
					engine: runBridgeStatus(mount.pluginHome, python, current.mirobodyHome, current.timeoutMs),
					mcp: {
						configured: Boolean(current.mcpUrl.trim()),
						host: mcpHost(current.mcpUrl),
						token_set: Boolean(current.mcpToken.trim())
					}
				},
				receipts: readReceipts(dataDir, 5).map((item) => ({
					at: item.at,
					skill: item.skill,
					ok: item.ok,
					exit_code: item.exit_code,
					error_kind: item.error_kind ?? ""
				}))
			});
		}
	}));
}
//#endregion
//#region src/tools-tracking.ts
function jsonText(value) {
	return [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}];
}
const jsonOut = {
	schema: { type: "json" },
	render: (_args, value) => jsonText(value)
};
const HOW_TO_READ = [
	"有效 = the change is larger than within-person noise (reference change value) in the good direction, the retest came late enough, and the plan was followed.",
	"波动内 = the change is inside normal within-person variation; do not call it an improvement or a failure.",
	"反向 = larger than noise in the bad direction; suggest a recheck and talking to their doctor.",
	"无法判断 = no baseline, too early to retest, too little adherence, acute inflammation, or no variation data. Say which.",
	"combined_with and confounders mean the change cannot be credited to one item. Say so.",
	"expected rows are trial averages for a population, not a prediction for this person.",
	"Model cards (phenoage, china-par) are model estimates. Say 模型估计 and quote boundary_zh. Never turn them into \"you will live X more years\".",
	"suggestions are the only next steps to offer. Never add a medicine, a supplement, or a dose."
];
function registerTrackingTools(ctx, config, mount) {
	const where = () => {
		const current = config();
		return {
			current,
			dataDir: resolveDataDir(current.dataDir),
			skillsHome: resolveSkillsHome(current.skillsHome)
		};
	};
	async function tracking() {
		const { current, dataDir, skillsHome } = where();
		return buildTracking({
			config: current,
			dataDir,
			skillsHome,
			catalog: loadCatalog(skillsHome),
			records: await loadRecords(current, dataDir, mount.pluginHome),
			today: isoDay()
		});
	}
	ctx.tools.register(defineTool({
		name: "save_intervention_plan",
		description: "Save the person's own intervention plan (from what they said, or a plan document from their doctor or longevity coach that they shared). First call with confirm=false: the tool checks it and returns the structured read-back and warnings. Read that back to the person. Only after they confirm, call again with the same plan and confirm=true. Each item needs a start date (YYYY-MM-DD) so its effect can be judged against a baseline. List the markers each item aims to move (hs-CRP, 空腹血糖, LDL-C, 血压…) and goal values if the plan has them. For a wearable-tracked item give target {metric, op, value} using a Mirobody indicator name from read_personal_situation (dailySteps, dailyTotalSleepTime). Medicines and supplements are saved by name only: their dose and dose log stay in Mirobody. Never add an item, a dose or a goal the person did not state. Saving a new plan keeps earlier versions.",
		parameters: {
			title: {
				type: "string",
				description: "Plan title, such as 2026 秋季方案."
			},
			note: {
				type: "string",
				description: "Anything else the plan says, in the person's words."
			},
			source: {
				type: "string",
				enum: ["chat", "file"],
				description: "chat when the person described it, file when it came from a document they shared."
			},
			items: {
				type: "array",
				required: true,
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						category: {
							type: "string",
							enum: [...CATEGORIES],
							required: true,
							description: "diet, exercise, sleep, supplement, drug, behavior, weight, or other."
						},
						title: {
							type: "string",
							required: true,
							description: "Short name, such as 地中海饮食 or 快走."
						},
						detail: {
							type: "string",
							description: "What it involves, in the plan's words. No dose for a medicine or supplement."
						},
						start: {
							type: "string",
							required: true,
							description: "Start date, YYYY-MM-DD."
						},
						end: {
							type: "string",
							description: "End date, YYYY-MM-DD, when the plan gives one."
						},
						frequency: {
							type: "object",
							additionalProperties: false,
							properties: {
								times: {
									type: "integer",
									description: "How many times."
								},
								per: {
									type: "string",
									enum: ["day", "week"],
									description: "Per day or per week."
								}
							}
						},
						target: {
							type: "object",
							additionalProperties: false,
							properties: {
								metric: {
									type: "string",
									description: "Mirobody indicator measured daily, such as dailySteps."
								},
								op: {
									type: "string",
									enum: [">=", "<="]
								},
								value: { type: "number" },
								unit: { type: "string" }
							},
							description: "A daily wearable threshold that counts the day as done."
						},
						markers: {
							type: "array",
							items: { type: "string" },
							description: "Markers this item aims to move, by name as on the report."
						},
						medication: {
							type: "string",
							description: "For a medicine or supplement: its name as on the Mirobody medication plan."
						}
					}
				}
			},
			goals: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						marker: {
							type: "string",
							required: true
						},
						value: {
							type: "number",
							required: true
						},
						unit: { type: "string" }
					}
				},
				description: "Target values the plan states, such as 空腹血糖 5.3 mmol/L."
			},
			confirm: {
				type: "boolean",
				description: "false (default) checks and returns the read-back; true saves after the person confirmed it."
			}
		},
		output: jsonOut,
		timeoutMs: 6e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const { current, dataDir } = where();
			const records = await loadRecords(current, dataDir, mount.pluginHome);
			const normalized = normalizePlan(args, {
				today: isoDay(),
				medications: records.medications.map((row) => ({
					name: row.name,
					...row.plan_id ? { plan_id: row.plan_id } : {}
				})),
				previous: currentPlan(dataDir)
			});
			const readBack = normalized.plan.items.map(describeItem);
			if (normalized.errors.length > 0) return asJson({
				ok: false,
				saved: false,
				errors: normalized.errors,
				warnings: normalized.warnings,
				read_back: readBack,
				hint: "Ask the person for what is missing. Do not fill a date or a marker yourself."
			});
			if (!args.confirm) return asJson({
				ok: true,
				saved: false,
				read_back: readBack,
				goals: normalized.plan.goals,
				warnings: normalized.warnings,
				next: "Read the read_back and warnings to the person. Save only after they confirm, by calling again with confirm=true."
			});
			const saved = savePlan(dataDir, normalized.plan);
			invalidateTracking();
			return asJson({
				ok: true,
				saved: true,
				version: saved.version,
				read_back: readBack,
				warnings: normalized.warnings,
				note: "Saved locally in this harness (interventions/plan.jsonl). Not written to Mirobody. Check-ins go through log_intervention_checkin; medicine and supplement doses are logged in Mirobody."
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "log_intervention_checkin",
		description: "Record that the person did (or did not do) an item of their saved plan on a day, when they tell you. item is the item title or id. done true/false; amount and unit when they give one (40 分钟). Tag a day that could disturb a lab result: illness, travel, lab_change (a different lab or hospital), stress. Medicine and supplement doses are logged in Mirobody, not here. Never log something the person did not say.",
		parameters: { entries: {
			type: "array",
			required: true,
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					item: {
						type: "string",
						required: true,
						description: "Item title or id from the saved plan."
					},
					date: {
						type: "string",
						description: "YYYY-MM-DD; default today."
					},
					done: {
						type: "boolean",
						description: "Whether they did it that day."
					},
					amount: {
						type: "number",
						description: "How much, when they said (minutes, steps, hours)."
					},
					unit: { type: "string" },
					note: {
						type: "string",
						description: "Their words, short."
					},
					tags: {
						type: "array",
						items: {
							type: "string",
							enum: [...CHECKIN_TAGS]
						}
					}
				}
			}
		} },
		output: jsonOut,
		timeoutMs: 2e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const { dataDir } = where();
			const result = addCheckIns(dataDir, Array.isArray(args.entries) ? args.entries : [], {
				today: isoDay(),
				source: "chat"
			});
			if (result.saved.length > 0) invalidateTracking();
			return asJson({
				ok: result.saved.length > 0,
				saved: result.saved.length,
				entries: result.saved,
				problems: result.problems
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "read_intervention_plan",
		description: "Read the person's saved intervention plan, its earlier versions, and recent check-ins. Read-only.",
		parameters: {},
		output: jsonOut,
		timeoutMs: 1e4,
		isConcurrencySafe: () => true,
		async execute() {
			const { dataDir } = where();
			const plan = currentPlan(dataDir);
			return asJson({
				plan: plan ? {
					...plan,
					read_back: plan.items.map(describeItem)
				} : null,
				versions: readPlans(dataDir).map((row) => ({
					version: row.version,
					saved_at: row.saved_at,
					title: row.title,
					items: row.items.length
				})),
				recent_checkins: readCheckIns(dataDir).slice(-20).reverse(),
				...plan ? {} : { hint: "No plan yet. Offer to save one with save_intervention_plan when the person shares theirs." }
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "review_interventions",
		description: "Judge each item of the saved plan against the Mirobody record: for every marker it aims at, the baseline before it started, the latest retest, whether the change is larger than within-person noise, how well the plan was followed (wearable, Mirobody dose log, or check-ins), what else changed at the same time, and what trials saw on average. Also returns phenotypic age at every past checkup with its noise band, model cards for the goals, and next steps. Use for 方案有没有用, 哪些有效, 怎么调整. Read-only; runs skill scripts.",
		parameters: {},
		output: jsonOut,
		timeoutMs: 18e4,
		isConcurrencySafe: () => false,
		async execute() {
			const result = await tracking();
			return asJson({
				how_to_read: HOW_TO_READ,
				...result,
				items: result.items.map((item) => ({
					...item,
					adherence: {
						...item.adherence,
						calendar: void 0
					}
				}))
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "model_intervention_goals",
		description: "What-if for goal values the person names without saving them, such as 空腹血糖降到 5.0 或 CRP 降到 1: runs the phenotypic-age skill (and the China-PAR risk model when its coefficients are verified) at their latest complete checkup with those targets, and returns now vs goal and the change from each target alone. Model estimates, not predictions: say 模型估计 and quote boundary_zh.",
		parameters: { goals: {
			type: "array",
			required: true,
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					marker: {
						type: "string",
						required: true
					},
					value: {
						type: "number",
						required: true
					},
					unit: { type: "string" }
				}
			}
		} },
		output: jsonOut,
		timeoutMs: 12e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const { current, dataDir, skillsHome } = where();
			const catalog = loadCatalog(skillsHome);
			const records = await loadRecords(current, dataDir, mount.pluginHome);
			const goals = (Array.isArray(args.goals) ? args.goals : []).flatMap((row) => {
				const value = Number(row?.value);
				return row && typeof row.marker === "string" && Number.isFinite(value) ? [{
					marker: row.marker,
					value,
					unit: typeof row.unit === "string" ? row.unit : ""
				}] : [];
			});
			return asJson(await modelGoals({
				config: current,
				dataDir,
				skillsHome,
				catalog,
				records,
				today: isoDay()
			}, goals));
		}
	}));
}
//#endregion
//#region src/index.ts
const name = "dsh-plugin-longpi";
const inject = ["tools"];
async function apply(ctx, config) {
	const pluginHome = resolveMirobodyPlugin(config.mirobodyPluginHome);
	const mount = await mountMirobody(ctx, {
		pythonBin: config.pythonBin,
		mirobodyHome: config.mirobodyHome,
		mcpUrl: config.mcpUrl,
		mcpToken: config.mcpToken,
		timeoutMs: config.timeoutMs
	}, pluginHome);
	const source = () => config;
	registerTools(ctx, source, mount);
	registerTrackingTools(ctx, source, mount);
	registerHarnessSkills(ctx);
	registerPrompt(ctx, source, mount);
	registerRoutes(ctx, source, mount);
	registerCommands(ctx, source, mount);
	ctx.on("agent/pre-step", async (payload, next) => {
		const text = payload.messages.map((message) => extractUserText(message.content)).join("\n");
		const hit = preGuard(text);
		if (!hit) return next();
		const first = payload.messages[0];
		if (!first) return { kind: "reject" };
		return {
			kind: "enter",
			messages: [{
				...first,
				content: [{
					type: "text",
					text: wrapGuardMessage(text, hit)
				}]
			}]
		};
	});
}
//#endregion
export { Config, EMPTY_PROFILE, HARNESS_SKILLS, PHENOAGE_SKILL, PRODUCT_VERSION, RISK_SKILL, TOOL_NAMES, addCheckIns, addDays, adherenceFor, apply, buildBoard, buildReport, buildStats, buildTracking, cellNumber, commandExcerpt, currentPlan, daysBetween, detectIntents, domainSummary, effectsFor, estimatedAge, evaluateMarker, evaluatePlan, foldName, indicatorsFromTable, inject, invalidateRecords, invalidateTracking, isoDay, latestOutputs, loadCatalog, loadCourses, loadDoseLog, loadEvidenceLexicon, loadRecords, loadReference, loadSeries, manifestSummary, markerFor, matchSkills, mentionedEntities, modelGoals, name, nameVariants, normalizePlan, normalizeProfile, normalizeUnit, organismOf, organismsAsked, parseCompact, parseFrontmatter, parseNumber, parseReadme, preGuard, rcvBand, readCheckIns, readHistory, readPlans, readProfile, readReceipts, readResultFile, readiness, recordOutputs, rememberMedications, reportExcerpt, resolveDataDir, resolveMarkers, resolveMirobodyPlugin, resolveSkillsHome, runReady, runSkill, runnableFrom, savePlan, seriesOf, stageMeasurements, suggestNext, summarizeIndicators, summarizeMedications, tableOf, unitFactor, versionCheck, wrapGuardMessage, writeProfile, writeStats };
