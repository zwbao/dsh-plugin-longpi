/** Enabled skills from s2f-agent registry/skills.yaml (JiaqiLi1024/s2f-agent). */

export interface S2fSkill {
  id: string
  family: string
  tasks: string[]
  triggers: string[]
  best_for: string
}

export const S2F_SKILLS: S2fSkill[] = [
  { id: 'alphagenome-api', family: 'api-variant-prediction', tasks: ['variant-effect', 'track-prediction', 'interval-prediction', 'plotting', 'troubleshooting'], triggers: ['alphagenome', 'dna_client', 'predict_variant', 'predict_interval', 'rna_seq', 'track_prediction'], best_for: 'AlphaGenome API variant-effect and interval/track prediction' },
  { id: 'alphagenome-research', family: 'local-regulatory-model-inference', tasks: ['environment-setup', 'interval-prediction', 'track-prediction', 'variant-effect', 'interpretation', 'troubleshooting'], triggers: ['alphagenome-research', 'local alphagenome', 'score_ism_variants'], best_for: 'Local AlphaGenome checkpoints' },
  { id: 'bpnet-skill', family: 'profile-prediction-and-attribution', tasks: ['environment-setup', 'preprocessing', 'training', 'prediction', 'attribution', 'motif-analysis', 'troubleshooting'], triggers: ['bpnet-skill', 'bpnet model', 'bpnet 2', 'kundaje bpnet', 'modisco'], best_for: 'BPNet 2.x ATAC/DNase profiles' },
  { id: 'basenji-workflows', family: 'quantitative-regulatory-activity', tasks: ['environment-setup', 'preprocessing', 'training', 'prediction', 'variant-effect', 'attribution', 'motif-analysis', 'troubleshooting'], triggers: ['basenji', 'basenji_sad', 'SAD score'], best_for: 'Basenji SAD/SED and motif analysis' },
  { id: 'caduceus-inference', family: 'rc-equivariant-dna-language-models', tasks: ['environment-setup', 'forward', 'embedding', 'variant-effect', 'fine-tuning', 'training', 'troubleshooting'], triggers: ['caduceus', 'caduceus-ph', 'rcps', 'caduceus VEP'], best_for: 'Caduceus RC-aware embeddings and VEP' },
  { id: 'borzoi-workflows', family: 'sequence-to-signal', tasks: ['environment-setup', 'track-prediction', 'variant-effect', 'interpretation', 'tutorial-playbooks'], triggers: ['borzoi', 'westminster', 'baskerville', 'human_gtex'], best_for: 'Borzoi sequence-to-signal and GTEx tracks' },
  { id: 'chrombpnet-skill', family: 'bias-factorized-accessibility-modeling', tasks: ['environment-setup', 'preprocessing', 'bias-model-training', 'training', 'prediction', 'attribution', 'motif-analysis', 'footprinting', 'troubleshooting'], triggers: ['chrombpnet', 'bias factorized', 'pred_bw'], best_for: 'ChromBPNet ATAC/DNase' },
  { id: 'dnabert2', family: 'transformer-embedding-and-finetuning', tasks: ['embedding', 'gue-evaluation', 'fine-tuning', 'csv-validation'], triggers: ['dnabert2', 'zhihan1996/DNABERT-2-117M', 'gue'], best_for: 'DNABERT-2 embeddings and CSV fine-tune' },
  { id: 'evo2-inference', family: 'genome-language-model-inference', tasks: ['environment-setup', 'forward', 'embedding', 'generation', 'hosted-api'], triggers: ['evo2', 'nvcf', 'flash-attn'], best_for: 'Evo 2 inference (GPU or hosted API)' },
  { id: 'gpn-models', family: 'phylogenetic-language-models', tasks: ['framework-selection', 'loading', 'training', 'variant-scoring'], triggers: ['gpn', 'phylogpn', 'gpn-star'], best_for: 'GPN / PhyloGPN variant scoring' },
  { id: 'hyenadna-inference', family: 'long-context-dna-language-models', tasks: ['environment-setup', 'embedding', 'forward', 'training', 'fine-tuning', 'troubleshooting'], triggers: ['hyenadna', 'hyena-dna', 'LongSafari'], best_for: 'HyenaDNA long-context embeddings' },
  { id: 'nucleotide-transformer-v3', family: 'transformers-ntv3', tasks: ['environment-setup', 'embedding', 'fine-tuning', 'track-prediction', 'troubleshooting'], triggers: ['ntv3', 'species-conditioning', 'post-trained', 'bigwig', 'annotation'], best_for: 'Nucleotide Transformer v3' },
  { id: 'pangolin-workflows', family: 'tissue-specific-splice-prediction', tasks: ['environment-setup', 'variant-effect', 'prediction', 'interpretation', 'troubleshooting'], triggers: ['pangolin', 'pangolin splice', 'tissue-specific splice'], best_for: 'Pangolin tissue-specific splice scores' },
  { id: 'segment-nt', family: 'segmentation-heads', tasks: ['segmentation-inference', 'rescaling-factor', 'constraints', 'troubleshooting'], triggers: ['segmentnt', 'segmentenformer', 'segmentborzoi'], best_for: 'SegmentNT-family segmentation' },
  { id: 'sei-workflows', family: 'chromatin-profile-sequence-class', tasks: ['environment-setup', 'prediction', 'variant-effect', 'interpretation', 'training', 'troubleshooting'], triggers: ['sei', 'sequence class', 'chromatin profiles'], best_for: 'Sei 40 sequence classes' },
  { id: 'spliceai-workflows', family: 'splice-site-prediction', tasks: ['environment-setup', 'variant-effect', 'prediction', 'interpretation', 'troubleshooting'], triggers: ['spliceai', 'splice-ai', 'DS_AG', 'splice variant'], best_for: 'SpliceAI delta scores' },
  { id: 'skill-factory', family: 'skilling-and-scaffolding', tasks: ['skill-scaffold', 'skill-registry-update', 'skill-template-generation', 'skill-validation'], triggers: ['skill-factory', 'scaffold-skill', 'create-skill'], best_for: 'Scaffold new s2f skills' },
]

export const TASK_DEFAULTS: Record<string, string[]> = {
  'environment-setup': ['alphagenome-api', 'gpn-models', 'nucleotide-transformer-v3', 'borzoi-workflows', 'evo2-inference'],
  embedding: ['dnabert2', 'nucleotide-transformer-v3', 'evo2-inference'],
  'variant-effect': ['alphagenome-api', 'borzoi-workflows', 'gpn-models', 'evo2-inference'],
  'fine-tuning': ['dnabert2', 'nucleotide-transformer-v3', 'bpnet-skill'],
  'track-prediction': ['alphagenome-api', 'nucleotide-transformer-v3', 'segment-nt', 'borzoi-workflows'],
}

export const TASK_CONTRACTS: Record<string, string[]> = {
  'environment-setup': ['target-stack-or-model-family', 'runtime-context', 'hardware-context'],
  embedding: ['sequence-or-interval', 'embedding-target'],
  'variant-effect': ['assembly', 'coordinate-or-interval', 'ref-alt-or-variant-spec'],
  'fine-tuning': ['task-objective', 'dataset-schema', 'compute-constraints'],
  'track-prediction': ['species', 'assembly', 'sequence-or-interval'],
  troubleshooting: ['failing-step-or-error', 'runtime-context'],
}

export const TASK_ALIASES: Array<[RegExp, string]> = [
  [/\b(set up|setup|install|bootstrap|environment)\b/i, 'environment-setup'],
  [/\b(troubleshoot|debug|error|failure|troubleshooting)\b/i, 'troubleshooting'],
  [/\b(fine[ -]?tune|finetune|training|train)\b/i, 'fine-tuning'],
  [/\b(embedding|embed)\b/i, 'embedding'],
  [/\b(variant[ -]?effect|variant scoring|ref[ /]?alt)\b/i, 'variant-effect'],
  [/\b(track prediction|sequence to track)\b/i, 'track-prediction'],
  [/\b(model family|choose model)\b/i, 'framework-selection'],
]

export const S2F_REPO = 'https://github.com/JiaqiLi1024/s2f-agent'
export const S2F_WEIGHTS = {
  explicit: 120,
  skillId: 80,
  trigger: 25,
  taskAlign: 20,
  phrase: 60,
  highMin: 70,
  highMargin: 25,
  medMin: 35,
  medMargin: 10,
}
