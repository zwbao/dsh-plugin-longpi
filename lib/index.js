import Schema from "@deepseek-ai/schemastery";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
	maxSkillMatches: Schema.number().default(8)
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
		if (bullet?.[1] && bullet[2]) map.set(bullet[1], {
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
function loadCatalog(home) {
	if (!home) return {
		home: "",
		revision: "",
		cards: [],
		error: "longevity-skills checkout not found. Set skillsHome or LONGEVITY_SKILLS_HOME."
	};
	const skillsDir = join(home, "skills");
	if (!existsSync(skillsDir)) return {
		home,
		revision: gitRevision(home),
		cards: [],
		error: `missing ${skillsDir}`
	};
	const readmePath = join(home, "README.md");
	const meta = parseReadme(existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "");
	const cards = [];
	for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
		if (!entry.isDirectory() || !NAME.test(entry.name)) continue;
		const skillMd = join(skillsDir, entry.name, "SKILL.md");
		if (!existsSync(skillMd)) continue;
		let parsed;
		try {
			parsed = parseFrontmatter(readFileSync(skillMd, "utf8"));
		} catch {
			continue;
		}
		const info = meta.get(entry.name);
		const dir = join(skillsDir, entry.name);
		cards.push({
			name: entry.name,
			description: parsed.description,
			domain: info?.domain ?? "未归类",
			blurb: info?.blurb ?? "",
			lead: leadOf(parsed.body),
			script: findScript(dir, parsed.body)
		});
	}
	cards.sort((a, b) => a.name.localeCompare(b.name));
	return {
		home,
		revision: gitRevision(home),
		cards,
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
	const index = body.search(/^## Command\s*$/m);
	if (index < 0) return "";
	return body.slice(index, index + 1800);
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
	"不是"
]);
const ORGANISMS = [
	{
		id: "mouse",
		re: /小鼠|mouse|mice/i
	},
	{
		id: "worm",
		re: /线虫|elegans/i
	},
	{
		id: "fly",
		re: /果蝇|drosophila/i
	},
	{
		id: "mole",
		re: /裸鼹鼠|naked mole/i
	},
	{
		id: "planarian",
		re: /涡虫|planarian/i
	},
	{
		id: "butterfly",
		re: /蝴蝶|butterfly|helicon/i
	},
	{
		id: "whale",
		re: /弓头鲸|bowhead/i
	},
	{
		id: "fish",
		re: /青鳉|killifish|斑马鱼|zebrafish/i
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
	for (const match of query.matchAll(/[\u4e00-\u9fff]{2,}/g)) {
		const run = match[0] ?? "";
		const max = Math.min(run.length, 8);
		for (let size = 2; size <= max; size += 1) for (let index = 0; index + size <= run.length; index += 1) found.add(run.slice(index, index + size));
	}
	return [...found];
}
function organismOf(card) {
	const hay = `${card.name} ${card.domain} ${card.blurb}`;
	return ORGANISMS.find((item) => item.re.test(hay)) ?? null;
}
function signalWhy(skill, indicatorHay) {
	if (!indicatorHay) return "";
	const rule = SIGNALS.find((item) => item.skill === skill);
	if (!rule) return "";
	return rule.needles.filter((needle) => indicatorHay.includes(needle.toLowerCase())).length >= rule.need ? rule.why : "";
}
function matchSkills(cards, query, indicatorNames, limit) {
	const asked = query.trim();
	const terms = englishTerms(asked);
	const grams = cjkGrams(asked);
	const indicatorHay = indicatorNames.join("\n").toLowerCase();
	const hits = [];
	for (const card of cards) {
		const why = [];
		let score = 0;
		let specific = 0;
		const hay = `${card.name}\n${card.description}\n${card.blurb}\n${card.lead}`.toLowerCase();
		if (asked) {
			if (terms.some((term) => term === card.name || card.name.includes(term))) {
				score += 8;
				specific += 1;
				why.push("名字对上了问题");
			}
			for (const term of terms) {
				if (term === card.name || card.name.includes(term)) continue;
				if (!hay.includes(term.toLowerCase())) continue;
				if (WEAK.has(term)) score += 1;
				else {
					score += 3;
					specific += 1;
					why.push(`说明里有「${term}」`);
				}
			}
			for (const gram of grams) {
				if (!hay.includes(gram)) continue;
				if (WEAK.has(gram)) {
					score += 1;
					continue;
				}
				score += gram.length >= 4 ? 4 : gram.length === 3 ? 3 : 2;
				specific += 1;
				if (gram.length >= 3) why.push(`说明里有「${gram}」`);
			}
		}
		const signal = signalWhy(card.name, indicatorHay);
		if (signal) {
			score += 6;
			specific += 1;
			why.push(signal);
		}
		const organism = organismOf(card);
		if (organism && !organism.re.test(asked)) score -= 8;
		if (organism && organism.re.test(asked)) {
			score += 4;
			specific += 1;
			why.push("问题点了这个模式生物");
		}
		if (asked && specific === 0) score = Math.min(score, 2);
		if (score <= 0) continue;
		hits.push({
			name: card.name,
			domain: card.domain,
			blurb: card.blurb,
			score,
			why: why.slice(0, 4),
			has_script: Boolean(card.script)
		});
	}
	hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
	const matches = hits.slice(0, limit);
	let note = "按问题和个人记录排序。名单以外的技能这次不调度。";
	if (matches.length === 0 && asked) note = "没有技能的说明对上这个问题。可以先看领域目录，换一种说法。";
	if (matches.length === 0 && !asked) note = "还没有问题，记录里也没有对上已知指标。先说出要读的方法，或接上检查。";
	return {
		matches,
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
		join(homedir(), "Projects", "longevity-skills"),
		join(homedir(), "longevity-skills")
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
//#region src/runner.ts
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const OUT_PATH = /^out\/?$|^out\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
function fail(skill, revision, error_kind, error, hint) {
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
		stderr_tail: ""
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
	const picked = lines.filter((line) => /年龄|age|边界|boundary|差|未计算|没有/.test(line)).slice(0, 4);
	return (picked.length > 0 ? picked : lines.slice(0, 3)).join("\n").slice(0, 400);
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
	for (const line of lines.slice(-50)) try {
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
async function runSkill(request) {
	const catalog = loadCatalog(request.home);
	const card = catalog.cards.find((item) => item.name === request.name);
	if (!card) return fail(request.name, request.revision, "unknown_skill", catalog.error || `unknown skill ${request.name}`, "Use match_longevity_skills and pass a directory name from that list.");
	if (!card.script) return fail(request.name, catalog.revision, "no_script", "this skill has no personal_report.py", "Read the skill and follow its command. Do not invent a score the script does not compute.");
	if (request.args.length > 40) return fail(request.name, catalog.revision, "invalid_arguments", "at most 40 arguments", "Pass only the flags the skill command lists.");
	if (request.files.length > 12) return fail(request.name, catalog.revision, "invalid_arguments", "at most 12 staged files", "Stage the files named by the skill command.");
	for (const arg of request.args) {
		const problem = checkArg(arg);
		if (problem) return fail(request.name, catalog.revision, "invalid_arguments", problem, "Paths stay inside the run directory. Do not point the script at the skill tree or the home directory.");
	}
	const seen = /* @__PURE__ */ new Set();
	for (const file of request.files) {
		if (!FILE_NAME.test(file.name) || file.name.includes("..")) return fail(request.name, catalog.revision, "invalid_arguments", `bad file name ${file.name}`, "File names are a single path segment, such as biomarkers.csv.");
		if (seen.has(file.name)) return fail(request.name, catalog.revision, "invalid_arguments", `duplicate file ${file.name}`, "Stage each file once.");
		seen.add(file.name);
		if (typeof file.text !== "string" || file.text.length > 256e3) return fail(request.name, catalog.revision, "invalid_arguments", `${file.name} is empty or larger than 256KB`, "Stage the measurement file the skill asked for, not a PDF or a genome.");
	}
	const runs = join(request.dataDir, "runs");
	const runDir = join(runs, `${Date.now()}-${request.name}`);
	mkdirSync(runDir, {
		recursive: true,
		mode: 448
	});
	for (const file of request.files) writeFileSync(join(runDir, file.name), file.text, { mode: 384 });
	mkdirSync(join(runDir, "out"), {
		recursive: true,
		mode: 448
	});
	const python = request.python.trim() || "python3";
	const timeoutMs = Math.max(1e3, Math.min(18e4, request.timeoutMs));
	const result = await new Promise((resolve) => {
		const child = spawn(python, [card.script, ...request.args], {
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
	const ok = result.code === 0 && !result.error;
	const payload = {
		ok,
		skill: request.name,
		revision: catalog.revision,
		exit_code: result.code,
		report_excerpt: excerpt,
		stdout_tail: result.stdout.slice(-2e3),
		stderr_tail: result.stderr.slice(-2e3),
		...result.error ? {
			error_kind: "unavailable",
			error: result.error
		} : {},
		...!ok && !result.error ? {
			error_kind: "script_failed",
			error: "the skill script did not exit 0"
		} : {},
		hint: report ? "Quote report_excerpt, including the 边界 line. Do not add a diagnosis or a dose." : "No out/report.md was written. Say so. Do not invent the missing readout."
	};
	remember(request.dataDir, {
		at: (/* @__PURE__ */ new Date()).toISOString(),
		skill: request.name,
		revision: catalog.revision,
		exit_code: result.code,
		ok,
		excerpt
	});
	pruneRuns(runs);
	return payload;
}
//#endregion
//#region src/version.ts
const PRODUCT_VERSION = "2.0.0";
const PRODUCT_NAME = "dsh-plugin-longpi";
const TOOL_NAMES = [
	"read_personal_situation",
	"match_longevity_skills",
	"read_longevity_skill",
	"run_longevity_skill",
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
					catalog.error ? `skills unavailable: ${catalog.error}` : `skills ${catalog.cards.length}  revision ${catalog.revision || "unknown"}`,
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
				const matched = matchSkills(catalog.cards, question, [], clampMatches(current.maxSkillMatches));
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
	"呼吸困难",
	"喘不上气",
	"晕倒",
	"昏迷",
	"抽搐",
	"大出血",
	"自杀",
	"不想活",
	"严重过敏",
	"中风",
	"半身麻木",
	"chest pain",
	"can't breathe",
	"fainted",
	"seizure",
	"suicide",
	"overdose",
	"stroke"
];
const DOSE_CHANGE = /(停药|把药停|停掉.{0,6}药|加量|减量|换药|改剂量|调整剂量|increase (the |my )?dose|stop (my |the )?(medication|medicine|drug)|change (my |the )?dose)/i;
function preGuard(text) {
	const lower = text.toLowerCase();
	if (EMERGENCY.some((item) => lower.includes(item.toLowerCase()))) return {
		code: "emergency",
		reply_zh: "如果您正在经历紧急不适，请立即拨打 120 或当地急救电话。在美国可拨打或发短信至 988。我不能替代急救，也不会给出处理步骤。"
	};
	if (DOSE_CHANGE.test(text)) return {
		code: "no_medication_change",
		reply_zh: "我不能建议开始、停止、加量、减量或更换药物。用药记录只读。调整处方请联系开具该药的医生。"
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
				"Dispatch with tools, in this order: read_personal_situation, match_longevity_skills, read_longevity_skill, then run_longevity_skill only if that skill has a script and the command says the inputs are present.",
				"Use only skill names match_longevity_skills returned. Read a skill before running it.",
				"Stage files from tool results. Never fill a missing biomarker from another file, a reference range, or memory.",
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
	const domains = domainSummary(input.catalog.cards).map((row) => ({
		domain: row.domain,
		count: row.count
	}));
	const dispatch = matchSkills(input.catalog.cards, "", input.records.indicators.map((item) => item.name), input.limit);
	return {
		product: "dsh-plugin-longpi",
		version: PRODUCT_VERSION,
		profile: input.records.profile,
		estimated_age: input.records.estimated_age,
		skills: {
			home_set: Boolean(input.catalog.home),
			revision: input.catalog.revision,
			count: input.catalog.cards.length,
			error: input.catalog.error,
			domains
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
			indicators: input.records.indicators.slice(0, 20),
			medications: input.records.medications.slice(0, 20)
		},
		dispatch,
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
function summarizeIndicators(payload) {
	const rows = [];
	walkIndicators(payload, rows, 0);
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
	for (const row of rows) {
		const key = row.name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(row);
		if (unique.length >= 40) break;
	}
	return unique;
}
function walkIndicators(value, rows, depth) {
	if (depth > 8 || rows.length >= 80) return;
	if (Array.isArray(value)) {
		for (const item of value) if (typeof item === "string") {
			const name = item.trim();
			if (name) rows.push({
				name,
				value: "",
				unit: ""
			});
		} else walkIndicators(item, rows, depth + 1);
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
	if (name && (measurement || unit)) rows.push({
		name,
		value: measurement,
		unit
	});
	for (const [key, child] of Object.entries(rec)) {
		if (key === "name" || key === "value" || key === "unit") continue;
		if (child && typeof child === "object") walkIndicators(child, rows, depth + 1);
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
	snapshot.indicators = summarizeIndicators(payloadOf(catalogue));
	const names = snapshot.indicators.map((item) => item.name).filter(Boolean).slice(0, 12);
	if (names.length > 0 && snapshot.indicators.every((item) => !item.value)) {
		const latest = await callMcpTool({
			url: config.mcpUrl,
			token: config.mcpToken,
			name: "query_health_indicators",
			args: {
				...memberArgs(config.member),
				indicators: names,
				aggregate: "latest"
			},
			timeoutMs: config.timeoutMs
		});
		if (latest.success !== false) {
			const rows = summarizeIndicators(payloadOf(latest));
			if (rows.some((item) => item.value)) snapshot.indicators = rows;
		}
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
	else snapshot.medications = summarizeMedications(payloadOf(meds));
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
						limit: clampMatches(current.maxSkillMatches)
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
					const catalog = loadCatalog(resolveSkillsHome(current.skillsHome));
					const records = await loadRecords(current, dataDir, mount.pluginHome);
					const matched = matchSkills(catalog.cards, questionOf(req.url), records.indicators.map((item) => item.name), clampMatches(current.maxSkillMatches));
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
function registerTools(ctx, config, mount) {
	const where = () => {
		const current = config();
		return {
			skillsHome: resolveSkillsHome(current.skillsHome),
			dataDir: resolveDataDir(current.dataDir),
			current
		};
	};
	ctx.tools.register(defineTool({
		name: "read_personal_situation",
		description: "Read this person's saved profile and a summary of their Mirobody record: latest indicator names and values, and the medication plan. Read-only. Use this before choosing a longevity skill. Absence means not on file. Do not invent a lab, a dose, or a genotype. Genetics are not listed here; name rsIDs with query_genetic_data. An estimated age from birth year is not the age to pass to a skill unless the saved age field is set.",
		parameters: {},
		output: jsonOut,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute() {
			const current = config();
			const records = await loadRecords(current, resolveDataDir(current.dataDir), mount.pluginHome);
			return asJson({
				profile: records.profile,
				estimated_age_from_birth_year: records.estimated_age,
				use_saved_age: records.profile.age,
				indicators: records.indicators,
				medications: records.medications,
				record_status: records.record_status,
				record_error: records.record_error,
				mcp: records.mcp,
				note: "Medication doses are what the record says. They are not an instruction to change a dose. A missing indicator was not on file."
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "match_longevity_skills",
		description: "Choose which longevity-skills apply to this person and this question. Returns a short ranked list. Dispatch only those names. An empty list means nothing matched: say so and look at list_longevity_domains. Model-organism skills drop unless the question names that organism. The score is a sort key, not a biological age.",
		parameters: { question: {
			type: "string",
			description: "What the person asked, in their words. Empty ranks only skills whose known inputs appear in the record."
		} },
		output: jsonOut,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute(args) {
			const { skillsHome, dataDir, current } = where();
			const catalog = loadCatalog(skillsHome);
			const records = await loadRecords(current, dataDir, mount.pluginHome);
			const limit = clampMatches(current.maxSkillMatches);
			const matched = matchSkills(catalog.cards, args.question ?? "", records.indicators.map((item) => item.name), limit);
			return asJson({
				question: args.question ?? "",
				revision: catalog.revision,
				catalog_count: catalog.cards.length,
				catalog_error: catalog.error,
				saved_age: records.profile.age,
				sex: records.profile.sex,
				indicator_count: records.indicators.length,
				...matched
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "read_longevity_skill",
		description: "Read one longevity skill by its directory name, after match_longevity_skills. Follow that file. Do not run a skill you have not read. The command block is the only way to build arguments. Missing inputs stay missing. Cohort hazard ratios and experimental doses are not personal instructions.",
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
				command: commandExcerpt(found.raw),
				content: found.raw.slice(0, 3e4)
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "run_longevity_skill",
		description: "Run one skill's personal_report.py with files you stage and arguments copied from the skill command. The script computes the readout. Do not calculate the formula yourself, and do not fill a missing marker from another file or from memory. Paths stay inside the run directory: pass biomarkers.csv, not an absolute path. Quote the returned excerpt, including 边界. A non-zero exit is the answer; do not replace it with a guess.",
		parameters: {
			name: {
				type: "string",
				required: true,
				description: "Skill directory name returned by match_longevity_skills."
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
			}
		},
		output: jsonOut,
		timeoutMs: 18e4,
		isConcurrencySafe: () => false,
		async execute(args) {
			const { skillsHome, dataDir, current } = where();
			const catalog = loadCatalog(skillsHome);
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
				python: current.skillPython,
				timeoutMs: current.skillTimeoutMs,
				revision: catalog.revision
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
			return asJson({
				revision: catalog.revision,
				count: catalog.cards.length,
				error: catalog.error,
				domains: domainSummary(catalog.cards)
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
		description: "Report whether the longevity-skills checkout and the Mirobody engine are available. Use this when a skill or a record tool failed. Does not return the chart or any token.",
		parameters: {},
		output: jsonOut,
		timeoutMs: 6e4,
		isConcurrencySafe: () => true,
		async execute() {
			const current = config();
			const { skillsHome, dataDir } = where();
			const catalog = loadCatalog(skillsHome);
			const python = discoverPython(current.pythonBin, mount.pluginHome);
			return asJson({
				version: PRODUCT_VERSION,
				skills: {
					found: Boolean(skillsHome),
					revision: catalog.revision,
					count: catalog.cards.length,
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
					exit_code: item.exit_code
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
export { Config, EMPTY_PROFILE, HARNESS_SKILLS, PRODUCT_VERSION, TOOL_NAMES, apply, buildBoard, commandExcerpt, domainSummary, estimatedAge, inject, loadCatalog, matchSkills, name, normalizeProfile, parseFrontmatter, parseReadme, preGuard, readProfile, readReceipts, reportExcerpt, resolveDataDir, resolveMirobodyPlugin, resolveSkillsHome, runSkill, summarizeIndicators, summarizeMedications, wrapGuardMessage, writeProfile };
