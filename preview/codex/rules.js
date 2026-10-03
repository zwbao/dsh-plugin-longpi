// Codex v2 draw rules (docs/codex-v2.md §3). Shared by the preview and scripts/codex-v2/sim.mjs.
// A classic script so the preview opens from file://; sim.mjs runs it in a vm context.
// The production engine keeps sha256-counter draws; this file uses a seeded PRNG with the same rules.

(function (root) {
  const RULES = {
    dailyCap: 3,
    dailyBagsPerWeek: 3,
    pickSize: 3,
    tierOrder: ['cell', 'animal', 'human', 'trial'],
    bags: {
      daily: { label_zh: '日常袋', from_zh: '当天有一条自己的记录（每周最多 3 袋）', pool_zh: '从你正在收集的那一章里随机抽一张' },
      care:  { label_zh: '就诊袋', from_zh: '带简报就诊、补一项检查或按时复测', pool_zh: '从所有章节的人群研究和人体试验卡里随机抽一张' },
      pick:  { label_zh: '目标袋', from_zh: '赛季开始，或完成一个赛季小目标', pool_zh: '从所有章节里翻开三张，选一张留下' },
    },
  }

  function rng(seed) {
    let s = seed >>> 0
    return function () {
      s = (s + 0x6d2b79f5) >>> 0
      let t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function createState(pack, seed, collecting) {
    return {
      seed,
      roll: rng(seed),
      day: 0,
      collecting: collecting || pack.chapters[0].id,
      bags: [],
      owned: [],
      ownedSet: new Set(),
      read: new Set(),
      ran: new Set(),
      species: new Set(),
      tools: new Set(),
      milestones: new Map(),
      chaptersDone: new Set(),
      freezes: 1,
      drawsToday: 0,
      dailyBagsThisWeek: 0,
      recordedToday: false,
      recordDays: 0,
      draws: 0,
      log: [],
    }
  }

  function earn(state, kind, reason) {
    const bag = { kind, reason, day: state.day }
    state.bags.push(bag)
    return bag
  }

  /** Daily bags: one per day with a record, at most dailyBagsPerWeek a week. */
  function record(state) {
    if (state.recordedToday) return null
    state.recordedToday = true
    state.recordDays += 1
    if (state.dailyBagsThisWeek >= RULES.dailyBagsPerWeek) return null
    state.dailyBagsThisWeek += 1
    return earn(state, 'daily', '当天的记录')
  }

  function nextDay(state) {
    state.day += 1
    state.drawsToday = 0
    state.recordedToday = false
    if (state.day % 7 === 0) state.dailyBagsThisWeek = 0
  }

  function unowned(state, pack) {
    return pack.studies.filter((card) => !state.ownedSet.has(card.id))
  }

  /** The cards a bag can give, and whether it fell back to every unowned card because its own range is complete. */
  function poolFor(state, pack, bag) {
    const left = unowned(state, pack)
    let pool = left
    if (bag.kind === 'daily') pool = left.filter((card) => card.chapter === state.collecting)
    if (bag.kind === 'care') pool = left.filter((card) => card.tier === 'human' || card.tier === 'trial')
    if (pool.length === 0 && left.length > 0) return { pool: left, fallback: true }
    return { pool, fallback: false }
  }

  function odds(state, pack, bag) {
    const { pool, fallback } = poolFor(state, pack, bag)
    const byTier = { cell: 0, animal: 0, human: 0, trial: 0 }
    for (const card of pool) byTier[card.tier] += 1
    const n = pool.length
    let pTrial = n ? byTier.trial / n : 0
    if (bag.kind === 'pick' && n > 0) {
      // P(at least one 金 among pickSize cards drawn without replacement)
      const k = Math.min(RULES.pickSize, n)
      let none = 1
      for (let i = 0; i < k; i += 1) none *= (n - byTier.trial - i) / (n - i)
      pTrial = 1 - Math.max(0, none)
    }
    return { total: n, byTier, fallback, pTrial }
  }

  function chapterProgress(state, pack, chapterId) {
    const cards = pack.studies.filter((card) => card.chapter === chapterId)
    return { have: cards.filter((card) => state.ownedSet.has(card.id)).length, size: cards.length }
  }

  function milestone(state, id) {
    if (state.milestones.has(id)) return false
    state.milestones.set(id, state.day)
    return true
  }

  function sample(state, pool, k) {
    const copy = pool.slice()
    const out = []
    while (out.length < k && copy.length > 0) out.push(copy.splice(Math.floor(state.roll() * copy.length), 1)[0])
    return out
  }

  function keep(state, pack, card, bag, fallback) {
    state.drawsToday += 1
    state.draws += 1
    state.owned.push(card.id)
    state.ownedSet.add(card.id)
    const met = []
    for (const key of card.meet || []) {
      if (!state.species.has(key)) { state.species.add(key); met.push(key) }
    }
    let chapterDone = null
    const progress = chapterProgress(state, pack, card.chapter)
    if (progress.have === progress.size && !state.chaptersDone.has(card.chapter)) {
      state.chaptersDone.add(card.chapter)
      state.freezes += 1
      chapterDone = card.chapter
    }
    state.log.push({ day: state.day, bag: bag.kind, card: card.id, tier: card.tier, fallback })
    return { ok: true, card, bag, met, chapterDone, fallback }
  }

  /**
   * Open one bag. A daily or care bag gives one card. A pick bag returns `options`;
   * call choose() with one of them. Nothing is spent when the daily cap is reached.
   */
  function draw(state, pack, bagIndex) {
    const index = bagIndex == null ? 0 : bagIndex
    const bag = state.bags[index]
    if (!bag) return { ok: false, reason: 'no_bag' }
    if (state.drawsToday >= RULES.dailyCap) return { ok: false, reason: 'daily_cap' }
    const { pool, fallback } = poolFor(state, pack, bag)
    if (pool.length === 0) return { ok: false, reason: 'complete' }
    if (bag.kind === 'pick') {
      bag.options = bag.options || sample(state, pool, RULES.pickSize).map((card) => card.id)
      return { ok: true, pick: true, bag, options: bag.options.map((id) => pack.studies.find((card) => card.id === id)) }
    }
    const card = pool[Math.min(pool.length - 1, Math.floor(state.roll() * pool.length))]
    state.bags.splice(index, 1)
    return keep(state, pack, card, bag, fallback)
  }

  function choose(state, pack, bagIndex, cardId) {
    const bag = state.bags[bagIndex]
    if (!bag || bag.kind !== 'pick' || !bag.options || !bag.options.includes(cardId)) return { ok: false, reason: 'not_offered' }
    if (state.drawsToday >= RULES.dailyCap) return { ok: false, reason: 'daily_cap' }
    const card = pack.studies.find((row) => row.id === cardId)
    state.bags.splice(bagIndex, 1)
    return keep(state, pack, card, bag, false)
  }

  /** The chapter to collect next: the person's choice; this picks the one closest to done. */
  function suggestChapter(state, pack) {
    let best = null
    for (const chapter of pack.chapters) {
      const p = chapterProgress(state, pack, chapter.id)
      if (p.have === p.size) continue
      const left = p.size - p.have
      if (!best || left < best.left) best = { id: chapter.id, left }
    }
    return best ? best.id : null
  }

  const api = { RULES, rng, createState, earn, record, nextDay, poolFor, odds, draw, choose, chapterProgress, milestone, unowned, suggestChapter }
  root.CodexRules = api
})(globalThis)
