// Where the guard asks the model. In LongPi's own workspace every message the person sends is labelled by
// the host model, as before. Elsewhere (a coding workspace, say) a message goes to the model only when it
// touches health: a recall-first local word list, plus everything the rule layer flags, so the rules' own
// words are always in it. A session that touched health once, or ran a LongPi tool, stays in scope for the
// rest of it, so a follow-up such as 「现在更严重了」 is labelled too. Outside the scope the rules decide;
// they would not fire there anyway. A false hit only costs the usual model call.

import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { mentionsMedicine, ruleLabels } from './guardrails.ts'
import { WORKSPACE_MARKER, WORKSPACE_TITLE } from './workspace.ts'

export const GUARD_SCOPES = ['health', 'all'] as const
export type GuardScope = typeof GUARD_SCOPES[number]

/** Titles of workspaces counted as LongPi's own: the one it creates, and the name 0.5.0 gave it. */
const HEALTH_WORKSPACE_TITLES = [WORKSPACE_TITLE, '健康']

// Chinese, matched as substrings. Single characters only where they rarely mean anything else in everyday or
// programming talk: no 头 (请求头, 头像), 吐 (吞吐量, 吐槽), 死 (死锁, 死循环) or a bare 120 (120 行).
const HEALTH_ZH = [
  // signs and emergencies
  '胸', '心脏', '心跳', '心慌', '心悸', '心梗', '心肌', '心绞', '心衰', '心口', '中风', '卒中', '脑梗', '脑出血', '偏瘫', '瘫',
  '痛', '疼', '晕', '昏', '麻木', '发麻', '无力', '没力气', '抽搐', '痉挛', '喘', '呼吸', '憋气', '窒息', '气短', '上不来气', '没气', '透不过气',
  '咳', '咯血', '血', '冷汗', '发紫', '发青', '苍白', '休克', '过敏', '肿', '呕', '想吐', '吐了', '腹泻', '拉肚子', '发烧', '发热', '高烧', '烧到',
  '意识', '叫不醒', '没反应', '不省人事', '倒地', '倒在地', '倒下', '摔倒', '跌倒', '站不起来', '动不了', '说不出话', '说话不清', '口齿不清', '嘴歪', '口角歪',
  '看不见', '看不清', '眼前发黑', '喉咙', '嗓子', '噎', '骨折', '扭伤', '烫伤', '烧伤', '伤口', '受伤', '车祸', '中毒', '误食', '溺水', '触电', '中暑', '咬',
  '救命', '急救', '急诊', '救护车', '打120', '拨120', '叫120', '打 120', '拨打 120', '叫 120', '快不行', '撑不住', '难受', '不舒服', '症状',
  // self-harm
  '自杀', '轻生', '想死', '不想活', '活不下去', '活着没', '伤害自己', '割腕', '跳楼', '结束生命', '结束自己', '一死了之', '死了算了', '寻死', '我崩溃', '我快崩溃',
  // care, medicines, records
  '病', '医', '诊', '药', '剂量', '毫克', '处方', '补剂', '保健品', '维生素', '鱼油', '体检', '化验', '检查结果', '报告单',
  '血压', '血糖', '血脂', '胆固醇', '甘油三酯', '尿', '肝', '肾', '肺', '胃', '肠', '皮肤', '牙', '眼睛', '视力', '耳朵', '怀孕', '孕',
  // people it may be happening to
  '爸', '妈', '爷爷', '奶奶', '外公', '外婆', '姥姥', '姥爷', '老公', '老婆', '丈夫', '妻子', '宝宝', '婴儿', '孩子', '儿子', '女儿', '父亲', '母亲', '家人', '老人',
  // what LongPi is for
  '身体', '健康', '体重', '减肥', '饮食', '运动', '睡眠', '失眠', '睡不着', '焦虑', '抑郁', '情绪', '压力大', '长寿', '衰老', '寿命', '年龄',
]

// English, whole words. Not weak (weak reference), numb as in number, sleep(), font-weight, collapse the panel,
// "help me fix".
const HEALTH_EN = new RegExp(`\\b(?:${[
  'chest', 'heart', 'cardiac', 'stroke', 'pain', 'painful', 'hurts?', 'hurting', 'ache', 'aching', 'faint(?:ed|ing)?', 'dizz\\w*', 'numb(?:ness)?',
  'seizures?', 'convuls\\w*', 'breathe', 'breath\\w*', 'choking', 'suffocat\\w*', 'bleed\\w*', 'blood', 'vomit\\w*', 'fever', 'sick', 'ill',
  'unconscious', 'unresponsive', 'collapsed', 'passed out', 'allerg\\w*', 'anaphyla\\w*', 'swell\\w*', 'throat', 'drooping', 'slurred', 'rash',
  'overdose', 'poison\\w*', 'suicid\\w*', 'kill (?:myself|me)', 'want to die', 'dying', 'end (?:my life|it all)', 'self[- ]harm', 'hurt myself',
  'emergency', 'ambulance', '911', 'symptoms?', 'doctor', 'hospital', 'clinic', 'medic\\w*', 'drugs?', 'pills?', 'dose', 'dosage', 'mg',
  'supplements?', 'vitamins?', 'prescri\\w*', 'blood pressure', 'glucose', 'cholesterol', 'diabet\\w*', 'health', 'healthy', 'pregnan\\w*',
  'insomnia', 'anxiety', 'depress(?:ed|ion)', 'longevity', 'aging', 'ageing', 'diet', 'lose weight', 'weight loss', 'body weight',
  'dad', 'mom', 'mum', 'father', 'mother', 'baby', 'wife', 'husband', 'son', 'daughter', 'grandma', 'grandpa', 'grandmother', 'grandfather',
].join('|')})\\b`, 'i')

/**
 * Whether a message touches health: a word from the lists, a medicine, or anything the rule layer acts on
 * (an emergency, self-harm, a medicine change or a dose). Recall first; it decides only whether the model
 * is asked, never what the note says.
 */
export function touchesHealth(text: string): boolean {
  const value = String(text ?? '').normalize('NFKC')
  if (!value.trim()) return false
  if (HEALTH_ZH.some((word) => value.includes(word)) || HEALTH_EN.test(value) || mentionsMedicine(value)) return true
  const labels = ruleLabels(value)
  return labels.acute_emergency || labels.self_harm || labels.med_change_request || labels.personal_dose_request
}

export interface WorkspaceLike {
  path: string
  title?: string
}

/** LongPi's workspaces: the one it created (its marker in dataDir), and any titled 健康对话 or 健康. */
export function healthWorkspacePaths(dataDir: string, workspaces: readonly WorkspaceLike[]): string[] {
  const out = new Set<string>()
  if (dataDir) {
    try {
      const row = JSON.parse(readFileSync(join(dataDir, WORKSPACE_MARKER), 'utf8')) as { path?: unknown }
      if (typeof row.path === 'string' && row.path) out.add(row.path)
    } catch {
      // not created by LongPi, or unreadable
    }
  }
  for (const row of workspaces) {
    if (row.path && HEALTH_WORKSPACE_TITLES.includes(String(row.title ?? '').trim())) out.add(row.path)
  }
  return [...out]
}

/** Whether a session's working directory is the workspace or inside it. */
export function insideWorkspace(cwd: string, root: string): boolean {
  if (!cwd || !root) return false
  const base = root.length > 1 && root.endsWith(sep) ? root.slice(0, -1) : root
  return cwd === base || cwd.startsWith(base.endsWith(sep) ? base : `${base}${sep}`)
}

/** Sessions known to be about health, and those already scanned once for earlier health talk. Bounded. */
export class HealthSessions {
  private readonly health = new Set<string>()
  private readonly scanned = new Set<string>()

  constructor(private readonly max = 2000) {}

  has(id: string): boolean {
    return this.health.has(id)
  }

  mark(id: string): void {
    this.add(this.health, id)
  }

  /** True the first time for a session, so its earlier messages are read once per process. */
  firstSight(id: string): boolean {
    if (this.scanned.has(id)) return false
    this.add(this.scanned, id)
    return true
  }

  private add(set: Set<string>, id: string): void {
    set.delete(id)
    set.add(id)
    if (set.size > this.max) set.delete(set.values().next().value as string)
  }
}
