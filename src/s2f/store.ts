import type { VcfIngestResult } from './vcf.ts'

export interface GenomeStore {
  ingest: VcfIngestResult | null
  source_label: string | null
}

const genome: GenomeStore = {
  ingest: null,
  source_label: null,
}

export function getGenomeStore(): GenomeStore {
  return genome
}

export function setIngest(result: VcfIngestResult, source_label: string): void {
  genome.ingest = result
  genome.source_label = source_label
}

export function clearIngest(): void {
  genome.ingest = null
  genome.source_label = null
}
