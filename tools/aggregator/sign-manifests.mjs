// Sign the two shipped manifests with the simulated dev key. Not a production ceremony.

import { createHash, createPrivateKey, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const studies = join(root, 'data', 'studies')
const key = createPrivateKey(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dev-signing-key.pem')))

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const name of Object.keys(value).sort()) {
    if (value[name] !== undefined) out[name] = canonicalize(value[name])
  }
  return out
}

function stable(value) {
  return JSON.stringify(canonicalize(value))
}

function sha(text) {
  return createHash('sha256').update(text).digest('hex')
}

const base = {
  schema: 'longpi.study/1',
  sponsor: { name: 'LongPi 模拟研究', contact: 'local-only@example.invalid' },
  eligibility: { age: [18, 90], minors: false },
  data: {
    inputs: [],
    excluded: ['genetics', 'free_text', 'identifiers', 'images'],
  },
  consent: { withdraw: 'any_time', after_withdraw: 'delete_unreleased', comprehension: [] },
  give_back: { participant_zh: '把你自己的结果和群体合计都写回来，并写明噪声会带来多大差别。', community: true },
  endpoints: { aggregator: 'http://127.0.0.1:18184' },
}

const markers = [
  ['glucose', '空腹血糖', 'record'],
  ['hba1c', '糖化血红蛋白', 'record'],
  ['hb', '血红蛋白', 'record'],
  ['tc', '总胆固醇', 'record'],
  ['ldl', '低密度脂蛋白胆固醇', 'record'],
  ['hdl', '高密度脂蛋白胆固醇', 'record'],
  ['tg', '甘油三酯', 'record'],
  ['creatinine', '肌酐', 'record'],
  ['sbp', '收缩压', 'record'],
  ['albumin', '白蛋白', 'record'],
]

const rcv = {
  ...base,
  id: 'rcv-calibration',
  version: '1.0.0',
  title_zh: '体检常见指标的个人波动',
  summary_zh: '用你历次体检里的常见指标，在本机估算个人波动，再和文献里的参考变化值对照。送出的只有加噪后的合计。',
  kind: 'observational',
  ethics: { committee: null, approval_id: null, registry: { name: 'none', id: null } },
  data: {
    inputs: markers.map(([key, , source]) => ({ key, source, window_days: 3650 })),
    excluded: ['genetics', 'free_text', 'identifiers', 'images'],
  },
  analysis: {
    local: markers.map(([key]) => ({ stat: 'rcv_calibration', key })),
    release: { dp: { mechanism: 'laplace', epsilon: 1, delta: 0, clip: [0, 40] }, aggregation: 'secure_sum', min_cohort: 20 },
  },
  consent: {
    text_version: 'rcv-1',
    text_zh_sha256: sha(readFileSync(join(studies, 'rcv-calibration.consent.zh.txt'), 'utf8').trim()),
    withdraw: 'any_time',
    after_withdraw: 'delete_unreleased',
    comprehension: [
      { id: 'leave', question_zh: '离开这台电脑的是什么？', options_zh: ['原始化验单', '加了噪声并遮住的合计，不是原始化验单', '基因数据'], correct: 1 },
      { id: 'quit', question_zh: '想退出时怎么办？', options_zh: ['不能退出', '可以随时退出，未发布的数字会删除', '要等研究结束'], correct: 1 },
      { id: 'dx', question_zh: '这个结果可以当作诊断吗？', options_zh: ['可以，它能下诊断', '不可以，它只描述波动，看病还是找医生', '可以代替看医生'], correct: 1 },
    ],
  },
}

const walk = {
  ...base,
  id: 'walk-timing-glucose',
  version: '1.0.0',
  title_zh: '晚饭后走和早晨走',
  summary_zh: '比较晚饭后走和早晨走之后的血糖。上线收集真实数据之前必须有伦理委员会批件和 ChiCTR 注册号。这个版本的 live 拒绝打开，模拟只在本机进行。',
  kind: 'community_season',
  ethics: { committee: null, approval_id: null, registry: { name: 'ChiCTR', id: null } },
  eligibility: { age: [18, 90], minors: false, exclude_conditions: ['pregnancy', 'minor'], exclude_drug_classes: ['insulin', 'sulfonylurea'] },
  data: {
    inputs: [
      { key: 'glucose', source: 'chat_outcome', window_days: 84 },
      { key: 'steps', source: 'wearable', window_days: 84 },
    ],
    excluded: ['genetics', 'free_text', 'identifiers', 'images'],
  },
  protocol: {
    arms: [{ id: 'morning', label_zh: '早晨走' }, { id: 'after_dinner', label_zh: '晚饭后走' }],
    weeks: 8,
    block_days: 14,
    crossover: true,
    outcome: { key: 'glucose', unit: 'mmol/L', better: 'lower' },
  },
  analysis: {
    local: [{ stat: 'mean_diff', key: 'glucose' }, { stat: 'paired_t', key: 'glucose' }],
    release: { dp: { mechanism: 'gaussian', epsilon: 2, delta: 1e-6, clip: [-5, 5] }, aggregation: 'secure_sum', min_cohort: 20 },
  },
  consent: {
    text_version: 'walk-1',
    text_zh_sha256: sha(readFileSync(join(studies, 'walk-timing-glucose.consent.zh.txt'), 'utf8').trim()),
    withdraw: 'any_time',
    after_withdraw: 'delete_unreleased',
    comprehension: [
      { id: 'live', question_zh: '现在可以把数据交到真实的研究服务器吗？', options_zh: ['可以，已经注册', '不可以，还没有伦理批件和 ChiCTR，live 打不开', '可以，只要本人同意'], correct: 1 },
      { id: 'who', question_zh: '谁不应该参加这项走路对照？', options_zh: ['谁都可以，包括正在用胰岛素的人', '正在用胰岛素或磺脲类药物的人先不参加', '只有未成年人可以'], correct: 1 },
      { id: 'claim', question_zh: '结果会怎么说？', options_zh: ['说走路治好了血糖', '只报告两组血糖的差别，以及噪声有多大', '建议你把药停了'], correct: 1 },
    ],
  },
}

for (const manifest of [rcv, walk]) {
  const bytes = Buffer.from(stable(manifest), 'utf8')
  const sig = sign(null, bytes, key).toString('base64')
  const signed = { ...manifest, signature: { alg: 'ed25519', key_id: 'longpi-sim-dev-1', sig } }
  writeFileSync(join(studies, `${manifest.id}.manifest.json`), `${JSON.stringify(signed, null, 2)}\n`)
  console.log('signed', manifest.id, sig.slice(0, 16))
}
