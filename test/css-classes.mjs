// Design-system guard (docs/design-system.md §0): every lp-* class a client component uses is defined in the
// stylesheet, no class is defined twice at the top level, and outside tokens.ts there are no hex colors and no
// font sizes off the scale. A failure lists what to fix and where.

import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const clientDir = join(root, 'src/client')
const styleDir = join(clientDir, 'styles')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? (path === styleDir ? [] : walk(path)) : name.endsWith('.ts') ? [path] : []
  })
}

const styles = Object.fromEntries(readdirSync(styleDir).filter((f) => f.endsWith('.ts')).map((f) => [f, readFileSync(join(styleDir, f), 'utf8')]))
const css = Object.values(styles).join('\n')
const defined = new Set([...css.matchAll(/\.(lp-[a-z0-9-]+)/g)].map((m) => m[1]))

// Classes used in components: string literals and template-literal parts that start with lp-.
const missing = new Map()
for (const file of walk(clientDir)) {
  const src = readFileSync(file, 'utf8')
  const used = new Set()
  for (const m of src.matchAll(/className:\s*(['"])([^'"]*)\1/g)) for (const c of m[2].split(/\s+/)) if (c.startsWith('lp-')) used.add(c)
  // template literals: a class glued to an interpolation (lp-chip-c-${tone}) is a prefix
  for (const m of src.matchAll(/`([^`]*)`/g)) for (const part of (/(?:\bid|htmlFor|'aria-[a-z]+'|aria[A-Z][A-Za-z]*|key|querySelector\(|getElementById\()\s*:?\s*$/.test(src.slice(Math.max(0, m.index - 24), m.index)) ? '' : m[1]).replace(/\$\{[^}]*\}/g, '\u0000').split(/\s+/)) {
    if (!part.startsWith('lp-')) continue
    used.add(part.includes('\u0000') ? part.slice(0, part.indexOf('\u0000')) : part)
  }
  for (const m of src.matchAll(/['"](lp-[a-z0-9-]+(?: lp-[a-z0-9-]+)*)['"]/g)) for (const c of m[1].split(' ')) used.add(c)
  // ids, label targets, keys and panel names are not classes
  const notClasses = new Set([...src.matchAll(/(?:\bid|htmlFor|idPrefix|key|name|stepId|PANEL_ID|PANE_ID|PANE_KIND|SETTINGS_ID|'aria-[a-z]+'|aria[A-Z][A-Za-z]*|getElementById|querySelector)\s*[:=(]\s*['"](lp-[a-z0-9-]+)['"]/g)].map((m) => m[1]))
  for (const m of src.matchAll(/(?:const|let)\s+[A-Z_]*(?:ID|KEY|KIND)[A-Z_]*\s*=\s*['"](lp-[a-z0-9-]+)['"]/g)) notClasses.add(m[1])
  for (const c of used) {
    if (notClasses.has(c)) continue
    // semantic hooks that need no style of their own, and dynamic prefixes (lp-cell-${x}) matched by prefix
    if (/^lp-(root|page-panel|tab-panel|set-[a-z]+|onb-[a-z]+-conn|profile-conn)$/.test(c)) continue
    const ok = c.endsWith('-') ? [...defined].some((d) => d.startsWith(c)) : defined.has(c)
    if (!ok) missing.set(c, [...(missing.get(c) ?? []), relative(clientDir, file)])
  }
}

// Top-level duplicate definitions (a rule starting a line with a single class selector).
const dup = []
const seen = new Map()
for (const [file, text] of Object.entries(styles)) {
  for (const m of text.matchAll(/^\.(lp-[a-z0-9-]+) \{/gm)) {
    if (seen.has(m[1])) dup.push(`${m[1]} (${seen.get(m[1])} and ${file})`)
    else seen.set(m[1], file)
  }
}

const offScale = []
for (const [file, text] of Object.entries(styles)) {
  if (file === 'tokens.ts') continue
  // codex.ts holds the 长寿图鉴 palette as --lp-codex-* variables (docs/codex-design.md §5.5): hex there is by design.
  if (file !== 'codex.ts') for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) if (!['#fff', '#ffffff'].includes(m[0].toLowerCase())) offScale.push(`${file}: color ${m[0]}`)
  for (const m of text.matchAll(/font-size:\s*([\d.]+)px/g)) if (![12, 13, 14, 15, 17, 24, 36].includes(Number(m[1]))) offScale.push(`${file}: font-size ${m[1]}px`)
}

const report = [
  missing.size ? `used but not defined (${missing.size}):\n${[...missing].map(([c, files]) => `  ${c}  ← ${[...new Set(files)].join(', ')}`).join('\n')}` : '',
  dup.length ? `defined twice (${dup.length}):\n  ${dup.join('\n  ')}` : '',
  offScale.length ? `off the design scale (${offScale.length}):\n  ${offScale.join('\n  ')}` : '',
].filter(Boolean).join('\n')
assert.equal(report, '', report)
console.log(`css ok (${defined.size} classes defined, every used class styled, no duplicates, on scale)`)
