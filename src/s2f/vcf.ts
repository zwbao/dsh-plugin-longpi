export interface ParsedVariant {
  chrom: string
  position: number
  rsid: string
  ref: string
  alt: string
  genotype?: string
  filter: string
}

export interface VcfIngestResult {
  ok: true
  assembly_assumed: 'hg38'
  n_header_lines: number
  n_records: number
  n_kept: number
  n_dropped_nonsnp: number
  n_truncated: boolean
  variants: ParsedVariant[]
}

export interface VcfIngestError {
  ok: false
  code: 'EMPTY' | 'NOT_VCF' | 'TOO_LARGE' | 'NO_RECORDS'
  message_zh: string
}

const MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_MAX_VARIANTS = 5000

export function normalizeChrom(raw: string): string {
  const s = raw.replace(/^chr/i, '')
  return `chr${s}`
}

export function parseVcf(
  text: string,
  options?: { maxVariants?: number; maxBytes?: number },
): VcfIngestResult | VcfIngestError {
  const maxBytes = options?.maxBytes ?? MAX_BYTES
  const maxVariants = options?.maxVariants ?? DEFAULT_MAX_VARIANTS
  if (!text || !text.trim()) return { ok: false, code: 'EMPTY', message_zh: 'VCF 为空。' }
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    return { ok: false, code: 'TOO_LARGE', message_zh: `VCF 超过 ${maxBytes} 字节上限。` }
  }
  if (!text.includes('#CHROM') && !/^##fileformat=VCF/m.test(text)) {
    return { ok: false, code: 'NOT_VCF', message_zh: '不是 VCF：缺少 fileformat 或 #CHROM 头。' }
  }

  const lines = text.split(/\r?\n/)
  let headerLines = 0
  let records = 0
  let dropped = 0
  const variants: ParsedVariant[] = []

  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      if (line.startsWith('#')) headerLines += 1
      continue
    }
    records += 1
    const cols = line.split('\t')
    if (cols.length < 5) {
      dropped += 1
      continue
    }
    const [chrom, posStr, id, ref, alt, , filter, , format, sample] = cols
    const position = Number(posStr)
    if (!chrom || !Number.isFinite(position) || !/^[ACGT]+$/i.test(ref) || !/^[ACGT]+$/i.test(alt.split(',')[0] ?? '')) {
      dropped += 1
      continue
    }
    const altFirst = alt.split(',')[0]!.toUpperCase()
    const refU = ref.toUpperCase()
    if (refU.length !== 1 || altFirst.length !== 1) {
      dropped += 1
      continue
    }
    let genotype: string | undefined
    if (format && sample) {
      const keys = format.split(':')
      const vals = sample.split(':')
      const gi = keys.indexOf('GT')
      const gt = gi >= 0 ? vals[gi] : sample.split(':')[0]
      genotype = gtToAlleles(gt, refU, altFirst)
    }
    variants.push({
      chrom: normalizeChrom(chrom),
      position,
      rsid: id && id !== '.' ? id.split(';')[0]! : `chr${chrom.replace(/^chr/i, '')}:${position}`,
      ref: refU,
      alt: altFirst,
      genotype,
      filter: filter || '.',
    })
    if (variants.length >= maxVariants) {
      return {
        ok: true,
        assembly_assumed: 'hg38',
        n_header_lines: headerLines,
        n_records: records,
        n_kept: variants.length,
        n_dropped_nonsnp: dropped,
        n_truncated: true,
        variants,
      }
    }
  }

  if (variants.length === 0) {
    return { ok: false, code: 'NO_RECORDS', message_zh: '没有可保留的 SNP（仅 A/C/G/T 单碱基 REF/ALT）。' }
  }

  return {
    ok: true,
    assembly_assumed: 'hg38',
    n_header_lines: headerLines,
    n_records: records,
    n_kept: variants.length,
    n_dropped_nonsnp: dropped,
    n_truncated: false,
    variants,
  }
}

function gtToAlleles(gt: string | undefined, ref: string, alt: string): string | undefined {
  if (!gt) return undefined
  const norm = gt.replace(/[|]/g, '/')
  if (norm === '0/0' || norm === '0') return ref + ref
  if (norm === '0/1' || norm === '1/0') return ref + alt
  if (norm === '1/1' || norm === '1') return alt + alt
  return norm
}
