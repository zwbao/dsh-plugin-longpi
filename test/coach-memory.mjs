// Pi's part of the memory (owner decision, 0.9: LongPi's data is the record): why, vision, wins, style and small
// commitments through remember_for_me; a commitment's count is its plan item's check-ins plus any count carried from
// the standalone coach, and never resets; the digest leads with these lines; the member file renders in the coach's
// template and a standalone file is read back in, without medicines or measurements.

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'

const TODAY = mod.isoDay()
const tmp = (p) => mkdtempSync(join(tmpdir(), `longpi-coach-${p}-`))

function host(dataDir) {
  const tools = new Map()
  const routes = new Map()
  const ctx = { tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } } }
  const deps = {
    dataDir: () => dataDir,
    config: () => ({ dataDir }),
    invalidate: () => {},
    http: { route: (method, path, handler) => routes.set(`${method} ${path}`, handler) },
  }
  mod.registerMemoryTools(ctx, deps)
  mod.registerMemberFile(ctx, deps)
  return { tools, routes, remember: (args) => tools.get('remember_for_me').execute(args, {}) }
}

// ---- the coach's kinds, commitment counts from check-ins, shrink and graduate
{
  const dataDir = tmp('kinds')
  const plan = mod.normalizePlan({ items: [{ category: 'diet', title: '限盐', start: TODAY, markers: ['收缩压'] }] }, { today: TODAY, medications: [], previous: null })
  const saved = mod.savePlan(dataDir, plan.plan)
  const salt = saved.items[0].id
  const h = host(dataDir)
  assert.equal((await h.remember({ op: 'add', kind: 'vision', text: '70 岁带孙子爬泰山', quote: '带孙子去爬泰山吧' })).ok, true)
  await h.remember({ op: 'add', kind: 'motivation', text: '父亲 68 岁中风后再没出过门', quote: '我爸六十八岁中风' })
  await h.remember({ op: 'add', kind: 'style', text: '称您，风格 direct', tone: 'direct', address: '您' })
  const first = await h.remember({ op: 'add', kind: 'commitment', text: '当做晚饭时，我就用限盐勺', confidence: 6, plan_item: salt })
  assert.equal(first.ok, true, JSON.stringify(first))
  // shrunk to something they are sure of: the old one is superseded, not deleted
  const smaller = await h.remember({ op: 'add', kind: 'commitment', text: '当工作日在家做晚饭时，我就用限盐勺', confidence: 8, plan_item: salt, replaces: first.saved.id })
  const memory = mod.memoryFor(dataDir)
  const commitments = memory.active('commitment')
  assert.equal(commitments.length, 1, 'one active commitment after shrinking')
  assert.equal(commitments[0].confidence, 8)
  assert.equal(commitments[0].supersedes, first.saved.id)
  mod.addCheckIns(dataDir, [
    { item: '限盐', date: mod.addDays(TODAY, -3), done: true },
    { item: '限盐', date: mod.addDays(TODAY, -2), done: false },
    { item: '限盐', date: mod.addDays(TODAY, -1), done: true },
  ], { today: TODAY, source: 'chat' })
  assert.equal(mod.doneCounts(dataDir).get(salt), 2, 'a miss takes nothing away')
  await h.remember({ op: 'add', kind: 'win', text: '婚礼那周也量了 5 次血压', quote: '量了 5 次' })
  const digest = memory.digest({ purpose: 'chat' })
  const lines = digest.split('\n')
  assert.match(lines[0], /^想要的画面：70 岁带孙子爬泰山/, 'Pi\'s lines lead, so a clipped digest keeps them')
  assert.match(digest, /为什么在乎：父亲 68 岁中风/)
  assert.match(digest, /称呼和风格：称您，风格 direct/)
  assert.match(digest, /在做的小承诺：当工作日在家做晚饭时，我就用限盐勺（把握度 8\/10，累计 2 次）/)
  assert.match(digest, /最近的小胜利：.*婚礼那周也量了 5 次血压/)
  assert.ok(!/当做晚饭时，我就用限盐勺（/.test(digest), 'the superseded commitment is gone from the digest')
  assert.doesNotMatch(memory.digest({ purpose: 'triage' }), /想要的画面/, 'triage stays clinical')
  // a habit now
  const grad = await h.tools.get('remember_for_me').execute({ op: 'graduate', id: smaller.saved.id }, {})
  assert.equal(grad.ok, true)
  assert.match(memory.digest({ purpose: 'chat' }), /已成习惯：当工作日在家做晚饭时，我就用限盐勺，累计 2 次/)
  assert.equal((await h.tools.get('remember_for_me').execute({ op: 'graduate', id: 'nope' }, {})).ok, false)
  // a style never keeps a name
  assert.equal(h.tools.get('remember_for_me').parameters.properties.address.enum.join(), '你,您')

  // ---- the member file renders in the coach's template
  const text = mod.renderMemberFile({ dataDir, label_zh: '我', personId: 'self', today: TODAY })
  for (const head of ['## 基本', '## 为什么 & 想要的画面', '## 生活和偏好', '## 近期大事', '## 小承诺', '## 测量', '## 检测和报告', '## 小胜利', '## 后台']) assert.ok(text.includes(head), head)
  assert.match(text, /七八十岁时想还能做的事：70 岁带孙子爬泰山/)
  assert.match(text, /\| 用限盐勺（方案：限盐） \| 工作日在家做晚饭 \|  \| \d{4}-\d{2}-\d{2} \| 2 \| 已成习惯/)
  assert.match(text, /称呼方式：您　　风格：direct/)
  assert.match(text, /分析师会员编号：lp-me/)
  const route = await h.routes.get('GET /api/longpi/member-file')()
  assert.match(route.__raw.type, /markdown/); assert.match(route.__raw.headers['Content-Disposition'], /longpi-member-/)
}

// ---- a member file from the standalone coach comes in once: counts carry on; medicines and measurements do not
{
  const dataDir = tmp('import')
  const h = host(dataDir)
  const file = join(tmp('file'), '老王.md')
  writeFileSync(file, `# 老王

<!-- Pi 的会员档案 -->

## 基本

- 年龄 / 出生年月：52
- 性别：男
- 称呼方式：你　　风格：upbeat
- 在用的药和补剂：氨氯地平 5mg 每天一次
- 聊天节奏：大约每 7 天

## 为什么 & 想要的画面

- 为什么在乎：我爸六十八岁中风，之后基本没出过门
- 七八十岁时想还能做的事：带孙子去爬泰山

## 生活和偏好

- 作息、运动、饮食、压力、社交：周末常在外吃饭
- 喜欢的 / 讨厌的：讨厌跑步，喜欢游泳

## 近期大事

- 2026-10-18 女儿婚礼

## 小承诺

| 承诺 | 当…时 | 频率 | 开始 | 累计次数 | 状态 |
|---|---|---|---|---|---|
| 用限盐勺 | 在家做晚饭 | 每天 | 2026-09-01 | 10 | 进行中 |
| 刷完牙做十个靠墙俯卧撑 | 刷完牙 | 每天 | 2026-08-01 | 45 | 毕业 |

## 测量

| 日期 | 指标 | 数值 | 单位 | 来源 |
|---|---|---|---|---|
| 2026-09-20 | 收缩压 | 138 | mmHg | 家里量 |

## 小胜利

- 2026-09-28 婚礼前也记了 5 次血压
`)
  assert.equal((await h.tools.get('import_member_file').execute({ path: 'relative.md' })).ok, false)
  assert.equal((await h.tools.get('import_member_file').execute({ path: join(tmpdir(), 'x.txt') })).ok, false, 'only a .md file')
  const res = await h.tools.get('import_member_file').execute({ path: file })
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.match(res.imported_zh, /小承诺 2 条/)
  assert.ok(res.skipped_zh.some((line) => /药和补剂没有导入/.test(line)))
  assert.ok(res.skipped_zh.some((line) => /测量表里的 1 行没有导入/.test(line)))
  const memory = mod.memoryFor(dataDir)
  assert.equal(memory.active('medication').length, 0, 'no medicine comes in on a file\'s say-so')
  const [salt, pushups] = memory.active('commitment')
  assert.equal(salt.text_zh, '当在家做晚饭时，我就用限盐勺')
  assert.equal(salt.carried_count, 10); assert.equal(salt.started, '2026-09-01')
  assert.ok(pushups.graduated, 'a graduated commitment stays a habit')
  assert.equal(memory.active('life_event')[0].from, '2026-10-18')
  assert.equal(memory.active('win')[0].day, '2026-09-28')
  const digest = memory.digest({ purpose: 'chat' })
  assert.match(digest, /想要的画面：带孙子去爬泰山/)
  assert.match(digest, /当在家做晚饭时，我就用限盐勺（把握度未问，累计 10 次）/, 'the count carried from the standalone coach never resets')
  // reading the same file again adds nothing twice
  await h.tools.get('import_member_file').execute({ path: file })
  assert.equal(memory.active('commitment').length, 2)
  // what LongPi renders reads back as the same items
  const again = mod.parseMemberFile(mod.renderMemberFile({ dataDir, label_zh: '我', personId: 'self', today: TODAY }), new Date().toISOString(), TODAY)
  assert.deepEqual(again.items.filter((i) => i.kind === 'commitment').map((i) => i.carried_count), [10, 45])
}

console.log('coach memory ok')
