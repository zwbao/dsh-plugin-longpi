// 长寿图鉴 client (docs/codex-design.md §5): the pixel rasters are pure and deterministic per seed, every card face
// is 50 × 70 on one grid, the experiment card draws its 14 days (done / missed / ahead), the background swirl stops
// when asked; and the page keeps to its rules: nothing position:fixed, none of the banned words, every body it
// posts is one the server's parseAction accepts, and the stylesheet stays inside .lp-codex.

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  CARD_H, CARD_W, CELL_COLORS, FRAMES, PACKS, Raster, SWIRL_H, SWIRL_W, cardBack, cellAt, clearArtCache, emblem, experimentFace, footprintFace, gem,
  pack, resultFace, seal, speciesFace, startSwirl, studyFace, swirlFrame,
} from '../src/client/engage/art.ts'
import { codexBodies } from '../src/client/engage/codex-page.ts'
import { CODEX_FONT_CSS } from '../src/client/engage/font.ts'
import { CODEX } from '../src/client/styles/codex.ts'
import { CSS } from '../src/client/styles/index.ts'
import { parseAction } from '../src/engage/routes.ts'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pixels = (raster) => raster.c.join(',')

// ---- rasters: sizes -------------------------------------------------------------------------------------------
const MOTIFS = ['clock', 'organ', 'brain', 'immune', 'repair', 'tissue', 'gene', 'span']
const TIERS = ['cell', 'animal', 'human', 'trial']
const faces = [
  ...MOTIFS.flatMap((motif) => TIERS.map((tier) => studyFace({ tier, art: { motif, seed: 20261004 } }))),
  ...['mouse', 'c_elegans', 'drosophila', 'killifish', 'zebrafish', 'planarian', 'butterfly', 'naked_mole_rat', 'bowhead_whale'].flatMap((key) => [speciesFace({ key, lifespan_years: 2.5 }, false), speciesFace({ key, lifespan_years: 2.5 }, true)]),
  ...['walk', 'alarm', 'moon', 'chair', 'bp', 'cup', 'bowl'].map((icon) => experimentFace({ id: `x-${icon}`, icon }, [])),
  ...['care_brief', 'retest', 'addon', 'first_experiment', 'season', 'family'].map((kind) => footprintFace(kind)),
  ...['bioage', 'risk', 'egfr', 'ldl'].map((key) => resultFace({ key, tier: 'human' })),
  cardBack(),
]
for (const face of faces) {
  assert.ok(face instanceof Raster)
  assert.equal(face.w, 50, 'every card face is 50 px wide')
  assert.equal(face.h, 70, 'every card face is 70 px tall')
  assert.equal(face.c.length, 50 * 70)
}
assert.equal(CARD_W, 50)
assert.equal(CARD_H, 70)
for (const tier of TIERS) assert.deepEqual([gem(tier).w, gem(tier).h], [9, 9])
assert.deepEqual([seal('read').w, seal('read').h], [11, 11])
assert.deepEqual([emblem('gene').w, emblem('gene').h], [11, 11])
for (const kind of ['experiment', 'retest']) assert.deepEqual([pack(kind).w, pack(kind).h], [30, 42], 'packs are 30 × 42')
assert.notEqual(pixels(pack('experiment')), pixels(pack('retest')))
assert.ok(pack('experiment').c.includes(PACKS.experiment.b), '实验包 is orange')
assert.ok(pack('retest').c.includes(PACKS.retest.band), '复查包 has the gold band')

// ---- rasters: deterministic per seed --------------------------------------------------------------------------
for (const motif of MOTIFS) {
  const card = { tier: 'animal', art: { motif, seed: 4242 } }
  const first = pixels(studyFace(card))
  clearArtCache()
  assert.equal(pixels(studyFace(card)), first, `${motif}: the same seed draws the same face`)
  assert.notEqual(pixels(studyFace({ ...card, art: { motif, seed: 4243 } })), first, `${motif}: another seed draws another face`)
}
clearArtCache()
const swirlA = swirlFrame(1.5)
assert.equal(swirlA.length, SWIRL_W * SWIRL_H * 4)
assert.deepEqual(swirlFrame(1.5), swirlA, 'the swirl is deterministic per frame time')
assert.equal(SWIRL_W, 192)
assert.equal(SWIRL_H, 108)

// ---- frames: evidence colours, the experiment's 青绿, the 14 days ------------------------------------------------
const frameAt = (raster) => ({ light: raster.get(1, 20), base: raster.get(2, 20), dark: raster.get(48, 20) })
assert.deepEqual(frameAt(experimentFace({ id: 'x', icon: 'walk' }, [])), { light: '#6fd3c4', base: '#2a9d8f', dark: '#1b6159' }, 'experiment frame per design §5.2')
assert.deepEqual(FRAMES.experiment, { l: '#6fd3c4', b: '#2a9d8f', d: '#1b6159' })
for (const tier of TIERS) {
  const face = studyFace({ tier, art: { motif: 'clock', seed: 7 } })
  assert.deepEqual(frameAt(face), { light: FRAMES[tier].l, base: FRAMES[tier].b, dark: FRAMES[tier].d }, `${tier}: frame in its evidence colour`)
}
const cells = ['d', 'm', 'f', 'd', 'd', 'm', 'd', 'd']
const exp = experimentFace({ id: 'walk-after-meal', icon: 'walk' }, cells)
for (let i = 0; i < 14; i += 1) {
  const { x, y } = cellAt(i)
  const state = cells[i] ?? 'f'
  const want = state === 'd' ? CELL_COLORS.d : state === 'm' ? CELL_COLORS.m : CELL_COLORS.f
  assert.equal(exp.get(x + 1, y), want, `day ${i + 1} (${state})`)
  assert.equal(exp.get(x + 2, y), want)
  if (state === 'd') assert.equal(exp.get(x, y), CELL_COLORS.dLight, 'a done day has a lit corner')
}
assert.notEqual(pixels(exp), pixels(experimentFace({ id: 'walk-after-meal', icon: 'walk' }, cells.map(() => 'm'))), 'cells change the face')
assert.notEqual(pixels(speciesFace({ key: 'mouse', lifespan_years: 2.5 }, true)), pixels(speciesFace({ key: 'mouse', lifespan_years: 2.5 }, false)), 'an unmet species is a silhouette')
assert.ok(!speciesFace({ key: 'mouse', lifespan_years: 2.5 }, true).c.includes('#f2b53a'), 'no lifespan dot before meeting it')
assert.notEqual(pixels(footprintFace('family')), pixels(footprintFace('care_brief')), 'family has its own glyph')
assert.equal(pixels(footprintFace('retest')), pixels(footprintFace('retest')))

// ---- the swirl's disposer clears its timer; nothing runs when still ---------------------------------------------
{
  const fakeCanvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => {} }) }
  const realSet = globalThis.setInterval
  const realClear = globalThis.clearInterval
  const live = new Set()
  let next = 1
  globalThis.setInterval = () => { const id = next++; live.add(id); return id }
  globalThis.clearInterval = (id) => { live.delete(id) }
  globalThis.window = { matchMedia: () => ({ matches: false }) }
  try {
    const stop = startSwirl(fakeCanvas)
    assert.deepEqual([fakeCanvas.width, fakeCanvas.height], [192, 108])
    assert.equal(live.size, 1, 'the swirl turns')
    stop()
    assert.equal(live.size, 0, 'the disposer clears the interval')
    const still = startSwirl(fakeCanvas, { still: true })
    assert.equal(live.size, 0, '演示模式: one frame, no timer')
    still()
    globalThis.window = { matchMedia: () => ({ matches: true }) }
    startSwirl(fakeCanvas)()
    assert.equal(live.size, 0, 'reduced motion: no timer')
  } finally {
    globalThis.setInterval = realSet
    globalThis.clearInterval = realClear
    delete globalThis.window
  }
}

// ---- every body the page posts is one the server accepts -------------------------------------------------------
const bodies = [
  codexBodies.start({ start: '09:30', end: '01:30' }, '8w', true),
  codexBodies.start({ start: '13:00', end: '02:00' }, 'retest', false),
  codexBodies.prefs({ simple: true }),
  codexBodies.prefs({ presentation: false }),
  codexBodies.prefs({ my_day: { start: '08:00', end: '23:00' } }),
  codexBodies.prefs({ season_mode: 'retest' }),
  codexBodies.prefs({ standup: false }),
  codexBodies.prefs({ codex: false }),
  codexBodies.prefs({ codex: true }),
  codexBodies.openPack('pk-123'),
  codexBodies.begin('fixed-wake', 'pk-123', { night_shift: false, weekend_kids: true }, false),
  codexBodies.begin('walk-after-meal', null, {}, true),
  codexBodies.checkin('rn-1', true),
  codexBodies.checkin('rn-1', false),
  codexBodies.reveal('rn-1'),
  codexBodies.stop('rn-1'),
  codexBodies.read('s-china-par-ascvd-risk'),
  codexBodies.nextSeason(),
]
const used = new Set()
for (const body of bodies) {
  const parsed = parseAction(JSON.parse(JSON.stringify(body)))
  assert.ok(parsed, `parseAction accepts ${JSON.stringify(body)}`)
  used.add(body.action)
  for (const [key, value] of Object.entries(body)) assert.deepEqual(parsed[key], value, `${body.action}.${key} survives parseAction`)
}
assert.deepEqual([...used].sort(), ['begin', 'checkin', 'next_season', 'open_pack', 'prefs', 'read', 'reveal', 'start', 'stop'])
assert.equal(parseAction({ action: 'begin', experiment_id: 'x' }).pack_id, undefined, 'begin from 待选 carries no pack')

// ---- source rules -----------------------------------------------------------------------------------------------
const page = read('src/client/engage/codex-page.ts')
const styles = read('src/client/styles/codex.ts')
for (const [name, text] of [['codex-page.ts', page], ['codex.ts', styles], ['art.ts', read('src/client/engage/art.ts')]]) {
  assert.ok(!/position\s*:\s*['"]?fixed/.test(text), `${name}: nothing is position: fixed (overlays stay inside the container)`)
}
for (const word of ['抽卡', '稀有', '连续', '打卡天数', '真实变化', '有效', 'Mirobody']) assert.ok(!page.includes(word), `codex-page.ts: no 「${word}」`)
// Every post goes through codexBodies: one postJson, and action literals only inside that object.
assert.equal(page.match(/postJson[<(]/g)?.length, 1, 'one place posts')
const bodiesBlock = page.slice(page.indexOf('export const codexBodies'), page.indexOf('\n}\n', page.indexOf('export const codexBodies')))
const outside = page.replace(bodiesBlock, '')
assert.ok(!/action:\s*'/.test(outside), 'no action body is written outside codexBodies')
for (const line of page.split('\n').filter((row) => /from '\.\.\/\.\.\/(engage|contracts)\//.test(row))) assert.ok(line.startsWith('import type'), `type-only import from the server: ${line}`)

// The stylesheet: every rule inside .lp-codex, no global selectors, colours as --lp-codex-* variables, 12/24/36 px.
const rules = styles.replace(/^[\s\S]*?export const CODEX = `/, '').replace(/`\s*$/, '')
const flat = rules
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  .replace(/@(media|container)[^{]+\{/g, '}')
const selectors = [...flat.matchAll(/(?:^|\})\s*([^{}]+?)\s*\{/g)].map((m) => m[1].trim()).filter(Boolean)
assert.ok(selectors.length > 150, `found the rules (${selectors.length})`)
for (const sel of selectors) {
  // split on top-level commas only (not inside :is(…))
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = '' } else cur += ch
  }
  parts.push(cur.trim())
  for (const part of parts) assert.ok(part.startsWith('.lp-codex'), `scoped under .lp-codex: ${part}`)
}
assert.ok(!/:root|(^|[\s,}])(html|body)[\s,{.:#\[]/.test(flat), 'no global :root, html or body rules (and every rule above starts with .lp-codex, so no bare *)')
for (const m of rules.matchAll(/\.(lp-[a-z0-9-]+)/g)) assert.ok(m[1] === 'lp-codex' || m[1].startsWith('lp-codex-'), `class named lp-codex-*: ${m[1]}`)
const declaredAt = rules.indexOf('.lp-codex {')
const varsEnd = rules.indexOf('}', declaredAt)
const afterVars = rules.slice(varsEnd)
assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(afterVars), 'hex colours only in the --lp-codex-* block')
for (const m of rules.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok([12, 24, 36].includes(Number(m[1])), `font size ${m[1]}px is 12, 24 or 36`)
for (const m of rules.matchAll(/font:\s*([\d.]+)px/g)) assert.ok([12, 24, 36].includes(Number(m[1])), `font ${m[1]}px is 12, 24 or 36`)
for (const m of rules.matchAll(/@keyframes\s+([a-z0-9-]+)/g)) assert.ok(m[1].startsWith('lp-codex-'), `keyframes named lp-codex-*: ${m[1]}`)
assert.ok(CSS.includes(CODEX), 'the Codex stylesheet is in LongPi\'s one <style>')
assert.ok(/prefers-reduced-motion/.test(CODEX) && /lp-codex-still/.test(CODEX), 'reduced motion and 演示模式 stop the motion')
assert.ok(!/\.lp-codex-(spark|foil)\b/.test(CODEX), 'gold cards have no sweep or sparkle')

// The font: a woff2 subset of Fusion Pixel, with its licence.
assert.match(CODEX_FONT_CSS, /^@font-face \{ font-family: "LpCodexPixel"; src: url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\) format\("woff2"\); font-display: swap; \}$/)
assert.ok(CODEX_FONT_CSS.length < 200_000, `the subset stays small (${CODEX_FONT_CSS.length} bytes of CSS)`)
assert.ok(existsSync(new URL('../data/codex/v3/fonts/OFL.txt', import.meta.url)), 'the OFL ships with the font')
assert.match(read('data/codex/v3/fonts/OFL.txt'), /SIL OPEN FONT LICENSE/i)

const pageSource = readFileSync(new URL('../src/client/engage/codex-page.ts', import.meta.url), 'utf8')
assert.match(pageSource, /function goodResult\(/, 'foil and the gold stamp follow the direction of the result')
assert.doesNotMatch(pageSource, /outcome === 'outside' && props\.foil/, 'no foil for a result that moved the wrong way')
console.log(`codex client ok (${faces.length} faces 50×70, deterministic seeds, 14-day cells, swirl disposer, ${bodies.length} bodies through parseAction, scoped stylesheet, font ${Math.round(CODEX_FONT_CSS.length / 1024)} KB)`)
