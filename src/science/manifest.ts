// Load the signed study manifests shipped in data/studies, plus their consent text.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StudyManifest } from '../contracts/science.ts'
import { sha256Hex, verifyManifest, type VerifyResult } from './verify.ts'

export interface LoadedStudy {
  manifest: StudyManifest
  text_zh: string
  sha256: string
  verify: VerifyResult
  consent_hash_ok: boolean
}

export function studiesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [join(here, '../../data/studies'), join(here, '../data/studies')]
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0] ?? 'data/studies'
}

export function consentText(studyId: string): string {
  const path = join(studiesDir(), `${studyId}.consent.zh.txt`)
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : ''
}

export function loadStudies(): LoadedStudy[] {
  const dir = studiesDir()
  if (!existsSync(dir)) return []
  const names = readdirSync(dir).filter((name) => name.endsWith('.manifest.json')).sort()
  return names.map((name) => {
    const file = readFileSync(join(dir, name))
    const raw = JSON.parse(file.toString('utf8')) as StudyManifest
    const text = consentText(raw.id)
    return {
      manifest: raw,
      text_zh: text,
      sha256: sha256Hex(file),
      verify: verifyManifest(raw),
      consent_hash_ok: sha256Hex(text) === raw.consent?.text_zh_sha256,
    }
  })
}

export function loadStudy(id: string): LoadedStudy | null {
  return loadStudies().find((row) => row.manifest.id === id) ?? null
}

/** Questions the page shows. The correct index stays on disk. */
export function publicQuestions(manifest: StudyManifest): Array<{ id: string; question_zh: string; options_zh: string[] }> {
  return manifest.consent.comprehension.map(({ id, question_zh, options_zh }) => ({ id, question_zh, options_zh }))
}

export function ethicsLine(manifest: StudyManifest): string {
  if (manifest.ethics.approval_id && manifest.ethics.registry.id) {
    return `伦理批件 ${manifest.ethics.approval_id}，${manifest.ethics.registry.name} ${manifest.ethics.registry.id}`
  }
  if (manifest.ethics.registry.name === 'ChiCTR') {
    return '上线收集真实数据之前，需要伦理委员会批件和 ChiCTR 注册号。这个版本的 live 不会打开。'
  }
  return '观察性波动研究，模拟模式只在本机汇总。'
}
