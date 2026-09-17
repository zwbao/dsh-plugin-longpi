import { S2F_PENGUIN_REPO } from './catalog.ts'

export const AXES = ['constraint', 'molecular', 'cellular', 'evidence'] as const
export type Axis = (typeof AXES)[number]

export interface S2fEntity {
  gene?: string
  rsid?: string
  hgvs_c?: string
  hgvs_p?: string
  transcript?: string | null
  source_refs: string[]
  provenance_layer: 'demo_panel' | 'vcf' | 'user'
  verification_status: 'unverified' | 'panel' | 'translated'
}

/** De-identified profile-agent contract from s2f-penguin `s2f batch` (2026-09-14). */
export interface S2fBatchRequest {
  request_id: string
  assembly: 'hg38' | 'unknown'
  entities: S2fEntity[]
  allowed_axes: Axis[]
  claim_ceiling: 'constraint' | 'molecular' | 'cellular'
  return_to: string
  notes_zh: string[]
}

export function buildBatchRequest(input: {
  gene?: string
  rsid?: string
  hgvs_c?: string
  hgvs_p?: string
  assembly?: string
  axes?: string[]
}): S2fBatchRequest | { error: true; code: string; message_zh: string } {
  const assemblyRaw = (input.assembly ?? 'hg38').toLowerCase()
  if (assemblyRaw === 'hg19' || assemblyRaw === 'grch37') {
    return { error: true, code: 'ASSEMBLY', message_zh: 's2f-penguin 不做 hg19 liftover。请先转到 hg38。' }
  }
  if (assemblyRaw !== 'hg38' && assemblyRaw !== 'grch38') {
    return { error: true, code: 'ASSEMBLY', message_zh: 'assembly 必须是 hg38（或 unknown，整批拒绝）。' }
  }
  if (!input.gene && !input.rsid && !input.hgvs_c) {
    return { error: true, code: 'ENTITY', message_zh: '至少提供 gene、rsid 或 hgvs_c。' }
  }
  const axes = (input.axes?.length ? input.axes : ['constraint', 'molecular'])
    .map((a) => a.toLowerCase())
    .filter((a): a is Axis => (AXES as readonly string[]).includes(a))
  const cellular = axes.includes('cellular')
  const notes = [
    '这是交给 s2f-penguin `s2f batch` 的去标识契约，不是病历。',
    'constraint 轴：gpn_msa 发表表（人类可用，零凭据）。不要跑 gpn live forward。',
    'molecular 轴：s2f translate（需本机 cdot 数据）。DSH 不自己做 HGVS。',
    cellular
      ? 'cellular 轴需要 ALPHAGENOME_API_KEY 或 NVCF_RUN_KEY，否则 penguin 会标 not_run。'
      : '未请求 cellular（AlphaGenome/Evo2）。',
    'evidence 轴本仓未装。三角化按逻辑合取，禁止把正交分数做算术平均。',
  ]
  return {
    request_id: `longpi-${Date.now()}`,
    assembly: 'hg38',
    entities: [{
      gene: input.gene,
      rsid: input.rsid,
      hgvs_c: input.hgvs_c,
      hgvs_p: input.hgvs_p,
      transcript: null,
      source_refs: ['dsh-plugin-longpi'],
      provenance_layer: 'user',
      verification_status: 'unverified',
    }],
    allowed_axes: axes,
    claim_ceiling: cellular ? 'cellular' : axes.includes('molecular') ? 'molecular' : 'constraint',
    return_to: 's2f_workspace/longpi',
    notes_zh: notes,
    penguin: S2F_PENGUIN_REPO,
    next_cli: 's2f batch <this.json>   # inside zwbao/s2f-penguin shared_env',
  } as S2fBatchRequest & { penguin: string; next_cli: string }
}
