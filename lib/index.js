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
const cache = /* @__PURE__ */ new Map();
function stampOf(home) {
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
	const stamp = stampOf(home);
	const hit = cache.get(home);
	if (hit && hit.stamp === stamp) return hit.catalog;
	const catalog = buildCatalog(home);
	cache.set(home, {
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
const EMPTY = {
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
function detectIntents(question, intents, lexicon = EMPTY) {
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
	if (!home) return EMPTY;
	const path = join(home, "skills", "longevity-evidence", "data", "claims.jsonl");
	if (!existsSync(path)) return EMPTY;
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
function fmt(value) {
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
	let message = `${spec.label_zh} 读成 ${withUnit(fmt(value), unit)}（${shown}），不在合理范围 ${withUnit(`${fmt(low)}–${fmt(high)}`, unit)} 内。`;
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
			shown = factor === 1 ? `单位 ${unit}` : `原值 ${fmt(number)} ${unit}`;
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
			factor
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
		const cells = [spec.key, fmt(values[spec.key] ?? 0)];
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
	}
	return null;
}
//#endregion
//#region src/match.ts
const WEAK = /* @__PURE__ */ new Set([
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
		if (WEAK.has(term)) score += 1;
		else {
			score += 3;
			specific += 1;
			why.push(`说明里有「${term}」`);
		}
	}
	for (const gram of cjkGrams(asked)) {
		if (!hay.includes(gram)) continue;
		if (WEAK.has(gram)) {
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
/** The most recent non-null value of each output key. */
function latestOutputs(dataDir) {
	const latest = {};
	for (const row of readHistory(dataDir)) for (const [key, item] of Object.entries(row.outputs)) {
		if (item.value == null) continue;
		latest[key] = {
			...item,
			at: row.at,
			skill: row.skill
		};
	}
	return latest;
}
/** Every recorded value of one output key, oldest first, for before-and-after readings. */
function seriesOf(dataDir, key) {
	const out = [];
	for (const row of readHistory(dataDir, 1e3)) {
		const item = row.outputs[key];
		if (item && item.value != null) out.push({
			at: row.at,
			value: item.value,
			skill: row.skill
		});
	}
	return out;
}
//#endregion
//#region src/runner.ts
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const OUT_PATH = /^out\/?$|^out\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const MEASUREMENTS_FILE = "measurements.csv";
const EXIT_INPUT_PROBLEM = 3;
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
		outputs
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
const PRODUCT_VERSION = "3.0.0";
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
	"longpi_status"
];
const HARNESS_SKILLS = [
	"longpi-dispatch",
	"longpi-board",
	"longpi-boundary"
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
const CHANGE = new RegExp([
	"停药",
	"把药停",
	"停掉",
	"停了",
	"停用",
	"停吃",
	"能停",
	"可以停",
	"要不要停",
	"该不该停",
	"断药",
	"戒掉",
	"不吃",
	"别吃",
	"不用吃",
	"不用再吃",
	"不再吃",
	"能不能不吃",
	"可以不吃",
	"继续吃",
	"还要吃",
	"还用吃",
	"要不要吃",
	"该不该吃",
	"能不能吃",
	"可以吃吗",
	"能吃吗",
	"开始吃",
	"开始服",
	"开始用",
	"开始打",
	"吃多少",
	"吃几",
	"几片",
	"几粒",
	"几颗",
	"多少毫克",
	"多少mg",
	"多少微克",
	"一天吃",
	"每天吃",
	"一次吃",
	"怎么吃",
	"吃法",
	"剂量",
	"用量",
	"加量",
	"减量",
	"加药",
	"减药",
	"换药",
	"换成",
	"改剂量",
	"调整剂量",
	"加大",
	"减半",
	"increase (the |my )?dose",
	"decrease (the |my )?dose",
	"change (my |the )?dose",
	"dosage",
	"how much [a-z0-9 -]{0,40}(should|can|do|to) i? ?take",
	"should i (take|stop|start|keep|quit)",
	"stop (taking|my|the)",
	"start taking",
	"keep taking",
	"quit (taking|my)",
	"come off"
].join("|"), "i");
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
	if (CHANGE.test(text) && mentionsMedicine(text)) return {
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
					version: "2.0.0"
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
function summarizeIndicators(payload, max = 40) {
	const rows = [];
	walkIndicators(payload, rows, 0, Math.max(max * 2, 80));
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
	const rows = [];
	walkMedications(payload, rows, 0);
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
function memberArgs(member) {
	const trimmed = member.trim();
	return trimmed ? { member: trimmed } : {};
}
function payloadOf(result) {
	if (result.success === false) return null;
	return result.result ?? result.text ?? null;
}
async function loadRecords(config, dataDir, pluginHome) {
	const profile = readProfile(dataDir);
	const engine = runBridgeStatus(pluginHome, discoverPython(config.pythonBin, pluginHome), config.mirobodyHome, config.timeoutMs);
	const configured = Boolean(config.mcpUrl.trim());
	const snapshot = {
		profile,
		estimated_age: estimatedAge(profile.birthYear, (/* @__PURE__ */ new Date()).getFullYear()),
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
		if (filled.size > 0) snapshot.indicators = snapshot.indicators.map((item) => filled.get(item.name.toLowerCase()) ?? item);
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
					const current = config();
					const dataDir = resolveDataDir(current.dataDir);
					sendJson(res, 200, buildBoard({
						catalog: loadCatalog(resolveSkillsHome(current.skillsHome)),
						records: await loadRecords(current, dataDir, mount.pluginHome),
						mount,
						receipts: readReceipts(dataDir, 5),
						limit: clampMatches(current.maxSkillMatches),
						outputs: latestOutputs(dataDir)
					}));
				})().catch(() => sendJson(res, 500, {
					ok: false,
					error: "board failed"
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
		output: jsonOut,
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
export { Config, EMPTY_PROFILE, HARNESS_SKILLS, PRODUCT_VERSION, TOOL_NAMES, apply, buildBoard, buildStats, commandExcerpt, detectIntents, domainSummary, estimatedAge, foldName, inject, latestOutputs, loadCatalog, loadEvidenceLexicon, manifestSummary, matchSkills, mentionedEntities, name, nameVariants, normalizeProfile, normalizeUnit, organismOf, organismsAsked, parseFrontmatter, parseNumber, parseReadme, preGuard, readHistory, readProfile, readReceipts, readResultFile, recordOutputs, rememberMedications, reportExcerpt, resolveDataDir, resolveMirobodyPlugin, resolveSkillsHome, runSkill, runnableFrom, seriesOf, stageMeasurements, summarizeIndicators, summarizeMedications, unitFactor, versionCheck, wrapGuardMessage, writeProfile, writeStats };
