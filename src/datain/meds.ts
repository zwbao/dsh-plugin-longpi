// Medicines the person asks LongPi to remember. Mirobody may already hold an imported plan;
// a stated line is stored in medication_statements.jsonl and mirrored into memory.

import { addStatement, presentMedications, readStatements, type StatedMedication } from '../meds-stated.ts'
import { memoryFor } from '../core/memory.ts'

export function listMedications(dataDir: string): { lines: string[]; rows: StatedMedication[] } {
  const rows = readStatements(dataDir)
  return { rows, lines: presentMedications([], rows).lines }
}

export function rememberMedication(dataDir: string, input: { name: string; dose_text?: string; frequency_text?: string; since?: string }): { ok: true; read_back: string } | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name || name.length > 80) return { ok: false, error: '需要对方说出的药名。' }
  const since = input.since && /^\d{4}-\d{2}-\d{2}$/.test(input.since) ? input.since : ''
  const saved = addStatement(dataDir, {
    name,
    dose_text: (input.dose_text ?? '').trim().slice(0, 80),
    frequency_text: (input.frequency_text ?? '').trim().slice(0, 80),
    since,
  })
  // addStatement already imports the line into memory. Read it back so a failed mirror is visible in tests.
  memoryFor(dataDir)
  const readBack = `你记下的：${saved.name}${saved.dose_text ? ` ${saved.dose_text}` : ''}${saved.frequency_text ? ` ${saved.frequency_text}` : ''}${saved.since ? `，${saved.since} 起` : ''}`
  return { ok: true, read_back: readBack }
}
