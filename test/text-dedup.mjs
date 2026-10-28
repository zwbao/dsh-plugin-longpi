// D13: duplicate detection compares the whole report text, not a prefix. Two reports whose later pages differ are
// different reports and both import; a real copy (same text, different bytes or whitespace) is still a duplicate.
// Also checks that the PDF text extraction fed to the fingerprint covers every page (up to the 80-page cap), and that
// rows written by the old prefix algorithm are not compared with the new whole-text fingerprint.
// Synthetic data only. The PDF case is skipped when poppler (pdftotext/pdfinfo) is not installed.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ingestDocument } from '../src/datain/upload.ts'
import { textFingerprint } from '../src/datain/narrative.ts'

const made = []
function tempDir(tag) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-text-dedup-${tag}-`))
  made.push(dir)
  return dir
}

function depsFor(dataDir) {
  return {
    dataDir: () => dataDir,
    config: () => ({ dataDir, mcpUrl: '', mcpToken: '', member: '', mirobodyPluginHome: '', pythonBin: '', mirobodyHome: '', timeoutMs: 100 }),
    bus: { emit: () => {} },
    invalidate: () => {},
  }
}

const hasPdfTools = spawnSync('/usr/bin/which', ['pdfinfo'], { encoding: 'utf8' }).status === 0
  && spawnSync('/usr/bin/which', ['pdftotext'], { encoding: 'utf8' }).status === 0

/** A minimal PDF with one line of text per page, enough for pdftotext/pdfinfo. */
function writePdf(path, pageTexts) {
  const objects = []
  const contentNums = []
  const pageNums = []
  const fontNum = 3
  let next = 4
  for (const text of pageTexts) {
    const stream = `BT /F1 12 Tf 40 760 Td (${text.replace(/[\\()]/g, (char) => `\\${char}`)}) Tj ET`
    contentNums.push(next)
    objects[next] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
    next += 1
    pageNums.push(next)
    objects[next] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNums.at(-1)} 0 R >>`
    next += 1
  }
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageNums.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`
  objects[fontNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  let out = '%PDF-1.4\n'
  const offsets = [0]
  for (let num = 1; num < next; num += 1) {
    offsets[num] = Buffer.byteLength(out, 'latin1')
    out += `${num} 0 obj\n${objects[num]}\nendobj\n`
  }
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${next}\n0000000000 65535 f \n`
  for (let num = 1; num < next; num += 1) out += `${String(offsets[num]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  writeFileSync(path, out, 'latin1')
}

// More than 4000 characters once whitespace is removed, so the old prefix fingerprint would collapse the two files.
const PREFIX = '常规记录：无异常。\n'.repeat(500)
const TAIL_A = '医师建议：低盐饮食，三个月后复查血脂。'
const TAIL_B = '医师建议：多吃蔬菜，保持规律运动。'

try {
  // ---- the fingerprint covers the tail, not only a prefix
  assert.notEqual(textFingerprint(PREFIX + TAIL_A), textFingerprint(PREFIX + TAIL_B), 'a different tail changes the fingerprint')
  assert.equal(textFingerprint('医师建议：低盐。'), '', 'a short text has no text fingerprint and relies on its bytes')

  // ---- two different reports that share a long prefix are both imported, and the second keeps its own tail
  {
    const dataDir = tempDir('tails')
    const deps = depsFor(dataDir)
    const textA = PREFIX + TAIL_A
    const textB = PREFIX + TAIL_B
    const first = await ingestDocument(deps, { filename: 'first.txt', text: textA, bytes: Buffer.from(textA), upload: false })
    const second = await ingestDocument(deps, { filename: 'second.txt', text: textB, bytes: Buffer.from(textB), upload: false })
    assert.equal(first.duplicate, false, 'the first report is new')
    assert.equal(second.ok, true, second.read_back_zh)
    assert.equal(second.duplicate, false, 'the second report has a different tail, so it is a different report')
    assert.equal(second.read_back_zh.includes('未重复保存'), false)
    assert.ok(second.findings.some((row) => row.text_zh.includes('多吃蔬菜')), 'the second report keeps its own advice')
    assert.ok(!second.findings.some((row) => row.text_zh.includes('低盐饮食')), 'the second report does not inherit the first tail')
  }

  // ---- a real copy is still caught: same long text, different bytes and layout
  {
    const dataDir = tempDir('long-copy')
    const deps = depsFor(dataDir)
    const text = PREFIX + TAIL_A
    const first = await ingestDocument(deps, { filename: 'a.txt', text, bytes: Buffer.from(text), upload: false })
    const reflowed = text.replace(/\n/g, '\n\n  ').replace(/：/g, '： ')
    const copy = await ingestDocument(deps, { filename: 'b.txt', text: reflowed, bytes: Buffer.from(`copy:${reflowed}`), upload: false })
    assert.equal(first.duplicate, false)
    assert.equal(copy.duplicate, true, 'the same long text is still a duplicate, even with different bytes')
  }

  // ---- the same text with different line breaks and spacing is a duplicate
  {
    const dataDir = tempDir('same')
    const deps = depsFor(dataDir)
    const text = '体检日期：2026-08-20\n总检结论：本次体检未见明显异常，建议保持规律作息。\n医师建议：低盐饮食，三个月后复查血脂。'
    const first = await ingestDocument(deps, { filename: 'a.txt', text, bytes: Buffer.from(text), upload: false })
    const spaced = text.replace(/\n/g, '\n\n  ').replace(/：/g, '： ')
    const copy = await ingestDocument(deps, { filename: 'b.txt', text: spaced, bytes: Buffer.from(`copy:${spaced}`), upload: false })
    assert.equal(first.duplicate, false)
    assert.equal(copy.duplicate, true)
  }

  // ---- short texts: different short texts are not merged, an exact copy is, a short text with different bytes is not
  {
    const dataDir = tempDir('short')
    const deps = depsFor(dataDir)
    const first = await ingestDocument(deps, { filename: 'a.txt', text: '医师建议：低盐。', bytes: Buffer.from('short-a'), upload: false })
    const other = await ingestDocument(deps, { filename: 'b.txt', text: '医师建议：多动。', bytes: Buffer.from('short-b'), upload: false })
    const copy = await ingestDocument(deps, { filename: 'c.txt', text: '医师建议：低盐。', bytes: Buffer.from('short-a'), upload: false })
    const reworded = await ingestDocument(deps, { filename: 'd.txt', text: '医师建议：低盐。', bytes: Buffer.from('short-a-again'), upload: false })
    assert.equal(first.duplicate, false)
    assert.equal(other.duplicate, false, 'two different short texts are different reports')
    assert.equal(copy.duplicate, true, 'the same short file is a duplicate by its bytes')
    assert.equal(reworded.duplicate, false, 'a short text with other bytes is not merged (no text fingerprint to compare)')
  }

  // ---- rows written by the old prefix algorithm are only matched by their bytes, never by the new fingerprint
  {
    const dataDir = tempDir('old-row')
    const deps = depsFor(dataDir)
    mkdirSync(join(dataDir, 'datain'), { recursive: true })
    appendFileSync(join(dataDir, 'datain', 'uploads.jsonl'), `${JSON.stringify({
      id: 'up-old', at: '2026-01-01T00:00:00.000Z', filename: 'old.txt', sha256: 'old-bytes-sha',
      fingerprint: 'a309b0ea14539c78', bytes: 100, checkup_day: null, forwarded: false, accepted: true,
    })}\n`)
    const text = PREFIX + TAIL_A
    const res = await ingestDocument(deps, { filename: 'new.txt', text, bytes: Buffer.from(text), upload: false })
    assert.equal(res.duplicate, false, 'an old prefix fingerprint does not match the new whole-text fingerprint')
  }

  // ---- a PDF's whole text is fingerprinted, not only its first 40 pages
  if (hasPdfTools) {
    const dataDir = tempDir('pdf')
    const deps = depsFor(dataDir)
    // ASCII text survives PDF extraction without a CJK font, and TI-RADS/BI-RADS still make narrative findings.
    const same = 'TI-RADS 3 regular follow up'
    const pagesA = Array.from({ length: 41 }, (_, i) => i === 0 ? 'BI-RADS 2 regular follow up' : i === 40 ? 'TI-RADS 4 advice A' : same)
    const pagesB = Array.from({ length: 41 }, (_, i) => i === 0 ? 'BI-RADS 2 regular follow up' : i === 40 ? 'TI-RADS 4 advice B' : same)
    const pdfA = join(dataDir, 'a.pdf')
    const pdfB = join(dataDir, 'b.pdf')
    writePdf(pdfA, pagesA)
    writePdf(pdfB, pagesB)
    const first = await ingestDocument(deps, { filename: 'a.pdf', path: pdfA, upload: false })
    const second = await ingestDocument(deps, { filename: 'b.pdf', path: pdfB, upload: false })
    assert.equal(first.duplicate, false)
    assert.equal(second.duplicate, false, 'a PDF whose page 41 differs is a different report')
    assert.ok(second.read_back_zh.includes('TI-RADS 4'), 'the whole PDF reaches the read-back, not only its first pages')
  } else {
    console.log('pdf case skipped: poppler (pdftotext/pdfinfo) is not installed')
  }

  console.log('text dedup ok')
} finally {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
}
