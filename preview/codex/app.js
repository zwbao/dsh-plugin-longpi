// Codex v2 preview, pixel style: card spec, every card, a playable season, rules (docs/codex-v2.md).

(function () {
  const P = window.CODEX
  const R = window.CodexRules
  const A = window.PixelArt
  const $ = (sel, el) => (el || document).querySelector(sel)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const chapterById = new Map(P.chapters.map((row) => [row.id, row]))
  const studyById = new Map(P.studies.map((row) => [row.id, row]))
  const speciesByKey = new Map(P.species.map((row) => [row.key, row]))
  const speciesById = new Map(P.species.map((row) => [row.id, row]))
  const toolById = new Map(P.tools.map((row) => [row.id, row]))
  const mileById = new Map(P.milestones.map((row) => [row.id, row]))
  const TIERS = ['cell', 'animal', 'human', 'trial']
  const METAL_CLASS = { cell: 'k-copper', animal: 'k-silver', human: 'k-violet', trial: 'k-gold' }
  const BAR = { cell: 'var(--copper)', animal: 'var(--silver)', human: 'var(--violet)', trial: 'var(--gold)' }
  const width = (text) => [...String(text)].reduce((sum, ch) => sum + (/[\u0000-\u024f]/.test(ch) ? 0.5 : 1), 0)

  // ---- cards -------------------------------------------------------------------

  function familyOf(id) {
    return id.startsWith('s-') ? 'study' : id.startsWith('sp-') ? 'species' : id.startsWith('t-') ? 'tool' : id.startsWith('x-') ? 'experiment' : 'milestone'
  }

  // The experiment catalogue of docs/codex-design.md §3.2 (first batch).
  const EXPERIMENTS = [
    { id: 'x-walk', icon: 'walk', title: '饭后走 10 分钟', do: '午饭或晚饭后走 10 分钟，手环识别到就自动记上。可选随机版：每天早上告诉你今天走不走。', look: '主要结果：有血糖仪时看餐后 1 小时血糖，否则看晚间静息心率。顺便看：体重。', from: '来自你的方案' },
    { id: 'x-wake', icon: 'alarm', title: '起床时间固定', do: '工作日起床时间不超过 ±30 分钟，周末不超过 ±60 分钟。', look: '主要结果：入睡时间的规律性。顺便看：睡眠时长、心率变异性。', from: '研究卡「作息乱与衰弱」「七天手环看节律」' },
    { id: 'x-water', icon: 'moon', title: '睡前 2 小时少喝水', do: '睡前 2 小时内不喝大杯水和汤。可选随机版。', look: '主要结果：夜间醒来次数。顺便看：睡眠时长。', from: '来自你的方案' },
    { id: 'x-sit', icon: 'chair', title: '每坐 90 分钟起身', do: '起身提醒出现时站起来走两分钟，手环确认后计入做到情况。', look: '主要结果：晚间静息心率；有血糖仪时为午后血糖。做到情况单独显示，不当作结果。', from: '来自你的方案' },
    { id: 'x-bp', icon: 'bp', title: '早晚量血压', do: '每天早晚各量一次家庭血压；吃食堂外卖时选少盐菜、不喝汤。', look: '主要结果：两周的家庭血压均值，和开始前两周比。', from: '来自你的方案' },
    { id: 'x-sugar', icon: 'cup', title: '戒掉含糖饮料', do: '两周不喝奶茶、可乐等含糖饮料，每天一键打卡。', look: '主要结果：体重。顺便看：腰围。尿酸、甘油三酯在下次复查时由复查包补上。', from: '来自你的方案' },
    { id: 'x-ldl', icon: 'bowl', title: '8 周降脂饮食', do: '每天一份燕麦或豆类，用坚果替代零食，少吃肥肉和油炸。', look: '主要结果：LDL 胆固醇，在复查包里揭晓。', from: '来自你的方案（只在 8–12 周内有复查时出现）' },
  ]
  const expById = new Map(EXPERIMENTS.map((row) => [row.id, row]))

  function offerOf(card) {
    if (card.tier === 'cell' || card.tier === 'animal') return { kind: 'evidence', text: `${card.species_zh.split('、')[0]}研究证据，不用你的数据` }
    if (!card.use_zh) return { kind: 'evidence', text: '这项研究没有个人报告' }
    return card.art.seed % 3 === 0 ? { kind: 'unlock', text: '补上相关检查后可以计算' } : { kind: 'run', text: '可以用你的记录计算' }
  }

  function frontOf(id, o) {
    const family = familyOf(id)
    if (family === 'study') {
      const c = studyById.get(id)
      if (o.locked) {
        return `<img class="face" src="${A.back()}" alt=""><span class="lockno">No.${c.no}</span><img class="gem" src="${A.gem(c.tier)}" alt=""><span class="lockq">？</span>`
      }
      const name = c.headline_zh
      return `<img class="face" src="${A.studyFace(c)}" alt="">
        <span class="t no">No.${c.no}</span><img class="gem" src="${A.gem(c.tier)}" alt="">
        <span class="t tierlabel">${P.tiers[c.tier].label_zh}</span>
        <span class="t name${width(name) > 10 ? ' long' : ''}">${esc(name)}</span>
        <span class="t sub"><span>${esc(c.species_zh.split('、')[0])}</span><span>${c.source.year || ''}</span></span>
        ${o.ran ? '<div class="holo"></div>' : ''}
        ${o.read ? `<img class="seal read" src="${A.seal('read')}" alt="读过">` : ''}${o.ran ? `<img class="seal ran" src="${A.seal('ran')}" alt="算过">` : ''}`
    }
    if (family === 'species') {
      const s = speciesById.get(id)
      return `<img class="face" src="${A.speciesFace(s, o.locked)}" alt=""><span class="t no">No.${s.no}</span>
        <span class="t name">${o.locked ? '？？？' : esc(s.name_zh)}</span>
        <span class="t sub"><span>${o.locked ? '未遇见' : esc(s.lifespan_zh)}</span><span>${s.studies.length} 项研究</span></span>`
    }
    if (family === 'tool') {
      const t = toolById.get(id)
      if (o.locked) return `<img class="face" src="${A.back()}" alt=""><span class="lockno">No.${t.no}</span><span class="lockq">工具</span>`
      return `<img class="face" src="${A.toolFace(t)}" alt=""><span class="t no">No.${t.no}</span><span class="t tierlabel">工具</span>
        <span class="t name${width(t.headline_zh) > 10 ? ' long' : ''}">${esc(t.headline_zh)}</span><span class="t sub"><span>用过即收录</span></span>`
    }
    if (family === 'experiment') {
      const x = expById.get(id)
      const days = o.days || []
      const done = days.filter((d) => d === 'd').length
      const status = o.result ? `完成 ${done}/14 天` : days.length ? `第 ${days.filter((d) => d !== 'f').length}/14 天` : '可选'
      return `<img class="face" src="${A.experimentFace(x, days)}" alt=""><span class="t no">实验</span>
        <span class="t tierlabel" style="left:calc(var(--u)*34)">14 天</span>
        <span class="t name${width(x.title) > 10 ? ' long' : ''}">${esc(x.title)}</span>
        <span class="t sub"><span>${status}</span><span>${o.result ? '已揭晓' : ''}</span></span>
        ${o.result === '超出波动' ? '<div class="holo"></div>' : ''}${o.result ? `<span class="rstamp${o.result === '超出波动' ? '' : ' calm'}">${esc(o.result)}</span>` : ''}`
    }
    const m = mileById.get(id)
    if (o.locked) return `<img class="face" src="${A.back()}" alt=""><span class="lockno">No.${m.no}</span><span class="lockq">足迹</span>`
    return `<img class="face" src="${A.milestoneFace(m)}" alt=""><span class="t no">No.${m.no}</span><span class="t tierlabel">足迹</span>
      <span class="t name${width(m.title_zh) > 10 ? ' long' : ''}">${esc(m.title_zh)}</span><span class="t sub"><span>${esc(o.date || '')}</span><span>记行动</span></span>`
  }

  function card(id, opts) {
    const o = opts || {}
    const family = familyOf(id)
    const tier = family === 'study' ? studyById.get(id).tier : ''
    const cls = ['pc', o.size || 's4', o.live ? 'live' : '', o.locked ? 'locked' : '', o.flipped ? 'is-flipped' : '', o.bob ? 'bob' : ''].filter(Boolean).join(' ')
    const style = o.bob ? ` style="--d:${(-Math.abs(hashOf(id) % 300) / 100).toFixed(2)}s"` : ''
    return `<div class="${cls}" data-id="${id}" data-family="${family}" data-tier="${tier}"${o.live ? ' tabindex="0" role="button"' : ''}${o.locked ? ' data-locked="1"' : ''}${style}>
      ${o.isNew ? '<span class="new">新</span>' : ''}
      <div class="tilt"><div class="side front">${frontOf(id, o)}<div class="shine"></div></div><div class="side back"><img class="face" src="${A.back()}" alt=""></div></div></div>`
  }

  function hashOf(text) {
    let h = 0
    for (const ch of text) h = (h * 31 + ch.codePointAt(0)) | 0
    return h
  }

  // ---- info panel ---------------------------------------------------------------

  const SPECIES_WORDS = /(小鼠|大鼠|线虫|果蝇|鳉鱼|斑马鱼|涡虫|裸鼹鼠|弓头鲸|袖蝶|蚕|猕猴|鲸|哺乳动物|蝴蝶)/g
  function hl(text) {
    return esc(text)
      .replace(SPECIES_WORDS, '<span class="ks">$1</span>')
      .replace(/(随机对照试验|随机试验|随机)/g, '<span class="k">$1</span>')
      .replace(/(\d[\d.,万]*)/g, '<span class="kn">$1</span>')
  }

  function tierChip(tier) {
    return `<span class="chip t-${tier}">${P.tiers[tier].metal_zh} · ${P.tiers[tier].label_zh}</span>`
  }
  function chapterChip(chapterId) {
    const ch = chapterById.get(chapterId)
    return `<span class="chip"><img src="${A.emblem(ch.motif)}" alt="">${esc(ch.title_zh)}</span>`
  }

  function info(id, opts) {
    const o = opts || {}
    const family = familyOf(id)
    if (family === 'study') {
      const c = studyById.get(id)
      if (o.locked) return `<div class="info"><h4>未收录</h4><div class="desc">第 ${chapterById.get(c.chapter).no} 章的第 ${c.no} 号。拆到之后才显示标题。</div><div class="pills">${tierChip(c.tier)}${chapterChip(c.chapter)}</div></div>`
      const offer = offerOf(c)
      const more = o.full ? `<div class="more"><p><b>这项研究</b><br>${esc(c.about_zh)}</p>${c.use_zh ? `<p><b>拿你的记录能做什么</b><br>${esc(c.use_zh)}</p>` : ''}</div>
        <div class="caveat">${esc(c.caveat_zh)}</div>
        <div class="src">${esc(c.source.journal || '')} ${c.source.year || ''}${c.source.authors ? ` · ${esc(c.source.authors)}` : ''}${c.source.doi ? `<br>doi:${esc(c.source.doi)}` : ''}</div>
        <div class="pills"><span class="chip ${offer.kind === 'run' ? 't-human' : ''}">${esc(offer.text)}（示意）</span></div>` : ''
      return `<div class="info"><h4 class="${width(c.headline_zh) > 10 ? 'long' : ''}">${esc(c.headline_zh)}</h4><div class="desc">${hl(c.hook_zh)}</div><div class="pills">${tierChip(c.tier)}${chapterChip(c.chapter)}</div>${more}</div>`
    }
    if (family === 'species') {
      const s = speciesById.get(id)
      if (o.locked) return `<div class="info"><h4>？？？</h4><div class="desc">收录一张用到这种动物的研究卡后遇见。图鉴里有 ${s.studies.length} 项研究用到它。</div><div class="pills"><span class="chip f-species">物种</span></div></div>`
      const list = o.full ? `<div class="more"><p><b>图鉴里用到它的研究</b><br>${s.studies.map((sid) => `${(o.owned && o.owned.has(sid)) ? '■' : '□'} ${esc(studyById.get(sid).headline_zh)}`).join('<br>')}</p></div><div class="caveat">物种卡讲的是这种动物，不是你。</div>` : ''
      return `<div class="info"><h4>${esc(s.name_zh)}</h4><div class="desc">${hl(s.hook_zh)}。${esc(s.body_zh)}<br><i>${esc(s.latin)}</i></div><div class="pills"><span class="chip f-species">物种</span><span class="chip">寿命 ${esc(s.lifespan_zh)}</span></div>${list}</div>`
    }
    if (family === 'tool') {
      const t = toolById.get(id)
      if (o.locked) return '<div class="info"><h4>未收录</h4><div class="desc">LongPi 第一次替你用到这个工具时收录。</div><div class="pills"><span class="chip f-tool">工具</span></div></div>'
      return `<div class="info"><h4 class="${width(t.headline_zh) > 10 ? 'long' : ''}">${esc(t.headline_zh)}</h4><div class="desc">${esc(t.hook_zh)}</div><div class="pills"><span class="chip f-tool">工具 · 不进抽卡池</span></div>${o.full ? `<div class="more"><p>${esc(t.blurb_zh)}</p></div>` : ''}</div>`
    }
    if (family === 'experiment') {
      const x = expById.get(id)
      const lines = (o.lines || []).map(([label, change, verdict]) => `<p>${esc(label)}：${esc(change)}　<span class="${verdict === '超出平时波动' ? 'k-green' : 'caption'}">${esc(verdict)}</span></p>`).join('')
      return `<div class="info"><h4 class="${width(x.title) > 10 ? 'long' : ''}">${esc(x.title)}</h4><div class="desc">${esc(x.do)}</div><div class="pills"><span class="chip" style="--c:#2fa874;--cd:#1a6646">实验 · 14 天</span></div>
        <div class="more"><p><b>看什么</b><br>${esc(x.look)}</p><p><b>从哪来</b><br>${esc(x.from)}</p>${lines ? `<p><b>揭晓：拿开始前两周和这两周比</b></p><p class="caption">你开始前两周，晚间静息心率每天上下浮动约 2 次/分；这两周的平均低了 3 次/分，超过了按你自己的浮动算出的范围。</p>${lines}` : ''}</div></div>`
    }
    const m = mileById.get(id)
    return `<div class="info"><h4>${esc(m.title_zh)}</h4><div class="desc">${esc(o.locked ? '还没走到这一步。' : m.hook_zh)}</div><div class="pills"><span class="chip f-milestone">足迹</span>${o.date ? `<span class="chip">${esc(o.date)}</span>` : ''}</div>${o.full ? `<div class="caveat">${esc(m.caveat_zh)}</div>` : ''}</div>`
  }

  // ---- tilt, shine and tooltip ------------------------------------------------------

  const tip = document.createElement('div')
  tip.className = 'tip'
  tip.hidden = true
  document.body.appendChild(tip)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  document.addEventListener('pointermove', (event) => {
    const el = event.target.closest && event.target.closest('.pc.live')
    document.querySelectorAll('.pc.tilted').forEach((node) => { if (node !== el) { node.classList.remove('tilted'); node.style.removeProperty('--rx'); node.style.removeProperty('--ry') } })
    if (!el) { tip.hidden = true; return }
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    if (!reduce) {
      el.classList.add('tilted')
      el.style.setProperty('--rx', `${((0.5 - py) * 18).toFixed(1)}deg`)
      el.style.setProperty('--ry', `${((px - 0.5) * 22).toFixed(1)}deg`)
    }
    el.style.setProperty('--mx', `${(px * 100).toFixed(0)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(0)}%`)
    if (el.closest('.modal') || el.closest('.ov') || el.dataset.notip) { tip.hidden = true; return }
    const ctx = tipContext(el.dataset.id)
    tip.innerHTML = info(el.dataset.id, { locked: Boolean(el.dataset.locked), ...ctx })
    tip.hidden = false
    const right = rect.right + 16 + 268 < window.innerWidth
    tip.style.left = `${right ? rect.right + 16 : Math.max(8, rect.left - 284)}px`
    tip.style.top = `${Math.max(8, Math.min(window.innerHeight - tip.offsetHeight - 8, rect.top))}px`
  })

  function tipContext(id) {
    if (tab === 'play' && play.state && id.startsWith('f-') && play.state.milestones.has(id)) return { date: dateOf(play.state.milestones.get(id)) }
    return {}
  }

  function burst(x, y, colors, n) {
    if (reduce) return
    for (let i = 0; i < n; i += 1) {
      const node = document.createElement('i')
      node.className = 'burst'
      const a = Math.random() * Math.PI * 2
      const d = 60 + Math.random() * 160
      node.style.left = `${x - 4}px`
      node.style.top = `${y - 4}px`
      node.style.setProperty('--dx', `${Math.cos(a) * d}px`)
      node.style.setProperty('--dy', `${Math.sin(a) * d}px`)
      node.style.setProperty('--c', colors[i % colors.length])
      document.body.appendChild(node)
      setTimeout(() => node.remove(), 900)
    }
  }
  const PACK_COLORS = { daily: ['#43a862', '#8fe0a3', '#f4ead5'], care: ['#8a5cd6', '#cdb0ff', '#f2b53a'], pick: ['#ef8a2a', '#ffc27a', '#e5484d'] }

  // ---- tab: card design ------------------------------------------------------------

  const SHOWCASE = { cell: 's-bowhead-whale-dna-repair', animal: 's-circadian-caloric-restriction-longevity', human: 's-wearable-aging-clock', trial: 's-fasting-mimicking-diet' }

  function specPage() {
    const counts = (tier) => P.studies.filter((c) => c.tier === tier).length
    const hero = TIERS.map((tier) => `<figure>${card(SHOWCASE[tier], { live: true, bob: true })}<figcaption>${tierChip(tier)}<br>全库 ${counts(tier)} 张</figcaption></figure>`).join('')
    const families = [
      [speciesByKey.get('bowhead_whale').id, '<span class="chip f-species">物种卡</span><br>收录第一张用到这种动物的研究卡时遇见'],
      [P.tools.find((t) => t.skill === 'pyaging').id, '<span class="chip f-tool">工具卡</span><br>LongPi 第一次替你用到这个工具时收录'],
      ['f-care-brief', '<span class="chip f-milestone">足迹卡</span><br>做到一件事时收录，只记行动'],
    ].map(([id, cap]) => `<figure>${card(id, { live: true, bob: true, date: '10·03' })}<figcaption>${cap}</figcaption></figure>`).join('')
    const anatomyId = 's-calerie-methylation-clocks'
    const pins = [['l', 34], ['r', 28], ['l', 110], ['l', 220], ['l', 268], ['l', 322], ['l', 371], ['r', 200]]
    const legend = [
      ['编号', '按章节、证据从金到铜排序的固定编号，图鉴册里空位就是这个号。'],
      ['证据宝石', '铜、银、紫、金四色。嵌在边框上，和边框同色。'],
      ['像素版画', '本章母题（这里是「身体的钟」的表盘），按卡号生成，没有两张一样。'],
      ['印章', '读完盖蓝章；用自己的记录算过，再加红章，整张卡变成镭射版。'],
      ['证据格', '四格：细胞 → 动物 → 人群 → 人体试验，亮到第几格就是哪一级，后面写着文字。'],
      ['标题条', '12 个字以内，说这项研究是什么。'],
      ['物种与年份', '研究对象和发表年份。'],
      ['边框', '证据材质：铜、银、紫、金。金卡多一道扫光和闪点。'],
    ]
    const anatomy = `<div class="anatomy"><div class="anatomy-card">${card(anatomyId, { size: 's6', read: true })}${pins.map(([side, y], i) => `<span class="pin ${side}" style="${side === 'l' ? 'left:-40px' : 'left:318px'};top:${y}px">${i + 1}</span>`).join('')}</div>
      <ol class="legend">${legend.map(([k, v], i) => `<li><span class="k">${i + 1}</span><span><b>${k}</b>　${v}</span></li>`).join('')}</ol></div>`
    const infoDemo = `<div class="row" style="align-items:flex-start;gap:28px">${card(SHOWCASE.human, { size: 's6', live: true })}<div style="width:300px">${info(SHOWCASE.human, { full: true })}</div>
      <div style="max-width:300px" class="lead">卡面只放图和标题，说明都在旁边的信息框里：鼠标停在卡上就出现，点开看全文。信息框里物种名、数字和「随机」三类词着色，一眼能看出这是小鼠还是人、是不是随机试验。</div></div>`
    const sample = 's-sleep-chart-biological-ageing'
    const states = `<div class="hand">
      <figure>${card(sample, { live: true, locked: true })}<figcaption>未收录：卡背 + 本卡的证据宝石，只剧透等级，不剧透标题</figcaption></figure>
      <figure>${card(sample, { live: true, isNew: true })}<figcaption>刚拆到：左上角红色「新」，会跳</figcaption></figure>
      <figure>${card(sample, { live: true, read: true })}<figcaption>读过：蓝色印章</figcaption></figure>
      <figure>${card(sample, { live: true, read: true, ran: true })}<figcaption>算过：红色印章，整张变成镭射版</figcaption></figure>
      <figure>${card(speciesByKey.get('naked_mole_rat').id, { live: true, locked: true })}<figcaption>未遇见的物种：只给剪影</figcaption></figure></div>`
    const MOTIF_ZH = { clock: '表盘', organ: '器官等高线', brain: '神经元', immune: '免疫细胞', repair: '线粒体', tissue: '肌纤维', gene: '双螺旋', span: '生存曲线' }
    const motifs = `<div class="grid">${P.chapters.map((ch) => {
      const c = P.studies.find((row) => row.chapter === ch.id && row.tier !== 'trial') || P.studies.find((row) => row.chapter === ch.id)
      return `<figure style="margin:0;display:grid;gap:10px;justify-items:center">${card(c.id, { live: true })}<figcaption class="caption" style="text-align:center">${chapterChip(ch.id)}<br>${ch.size} 张 · 母题：${MOTIF_ZH[ch.motif]}</figcaption></figure>`
    }).join('')}</div>`
    const variety = `<div class="hand">${P.studies.filter((c) => c.chapter === 'brain').slice(0, 8).map((c) => card(c.id, { size: 's3', live: true })).join('')}</div>`
    const species = `<div class="grid">${P.species.map((s) => card(s.id, { live: true })).join('')}</div>`
    const packs = `<div class="hand" style="gap:40px">${['daily', 'care', 'pick'].map((kind) => `<figure class="pack"><img src="${A.pack(kind)}" alt=""><span class="pname">${R.RULES.bags[kind].label_zh}</span><span class="prule">${R.RULES.bags[kind].from_zh}<br><span class="k-gold">${R.RULES.bags[kind].pool_zh}</span></span></figure>`).join('')}</div>`
    const frames = `<table class="table"><thead><tr><th>边框</th><th>亮 · 基 · 暗</th><th>意思</th></tr></thead><tbody>${[...TIERS, 'species', 'tool', 'milestone', 'back'].map((k) => {
      const f = A.FRAMES[k]
      const label = { species: '物种', tool: '工具', milestone: '足迹', back: '卡背' }[k] || `${P.tiers[k].metal_zh} · ${P.tiers[k].label_zh}`
      const note = P.tiers[k] ? esc(P.tiers[k].caveat_zh.replace('{species}', '动物')) : { species: '黑底星空，物种剪影', tool: '蓝图网格', milestone: '牛皮纸 + 邮戳', back: '青色菱格 + π' }[k]
      return `<tr><td>${label}</td><td><span class="swatches"><i style="background:${f.l}"></i><i style="background:${f.b}"></i><i style="background:${f.d}"></i></span></td><td class="caption">${note}</td></tr>`
    }).join('')}</tbody></table>`
    const chapterPal = `<table class="table"><thead><tr><th>章</th><th>底 · 底 2 · 主 · 中 · 强调</th></tr></thead><tbody>${P.chapters.map((ch) => {
      const p = A.CHAPTERS[ch.motif]
      return `<tr><td>${chapterChip(ch.id)}</td><td><span class="swatches">${[p.bg, p.bg2, p.fg, p.mid, p.acc].map((c) => `<i style="background:${c}"></i>`).join('')}</span></td></tr>`
    }).join('')}</tbody></table>`
    const motion = `<div class="row">${TIERS.map((t) => `<button class="btn ${({ cell: '', animal: 'grey', human: 'violet', trial: 'gold' })[t]}" data-demo="${t}">拆一包：${P.tiers[t].metal_zh}卡</button>`).join('')}<button class="btn" data-demo="pick">目标袋：三选一</button><button class="btn blue" data-demo="species">遇见物种</button><button class="btn green" data-demo="chapter">集齐一章</button></div>`
    const offer = ['x-walk', 'x-water', 'x-bp'].map((id) => `<figure>${card(id, { live: true, bob: true })}<figcaption>${esc(expById.get(id).look)}</figcaption></figure>`).join('')
    const activeDays = 'dddmdddddf'.split('').concat(['f', 'f', 'f', 'f'])
    const doneDays = 'ddddmddddddmdd'.split('')
    const resultLines = [['主要结果 · 晚间静息心率', '64 → 61 次/分', '超出平时波动'], ['顺便看 · 体重', '58.2 → 57.9 公斤', '在平时波动内']]
    const experiments = `
      <h3 class="h3">实验包：三选一</h3><p class="lead">赛季开始和每做完一个实验，拿到一个实验包。三张都按你的数据、方案和限制挑出来；没选的两张留在「待选」。</p><div class="hand">${offer}</div>
      <h3 class="h3" style="margin-top:28px">进行中</h3><p class="lead">底部 14 格是 14 天：亮的是做到的天，暗的是断掉的天，空的是还没到的天。有效天数够 10 天就能揭晓，断几天不算失败。</p>
      <div class="row" style="align-items:flex-start;gap:28px">${card('x-walk', { size: 's6', live: true, days: activeDays })}<div style="width:300px">${info('x-walk', {})}</div></div>
      <h3 class="h3" style="margin-top:28px">揭晓</h3><p class="lead">实验结束时翻面。只看开始前定好的一个主要结果：超出你的平时波动时卡变镭射版、盖红章；在波动内或数据不够时只翻面、盖灰章，不庆祝。只说「超出平时波动」，不说「真实变化」。</p>
      <div class="row" style="align-items:flex-start;gap:28px">${card('x-walk', { size: 's6', live: true, days: doneDays, result: '超出波动' })}<div style="width:300px">${info('x-walk', { lines: resultLines })}</div>
        ${card('x-wake', { size: 's6', live: true, days: 'ddddddmddddddd'.split(''), result: '波动内' })}</div>`
    const packs2 = `<div class="hand" style="gap:48px">${[['experiment', '实验包', '赛季开始；每做完一个实验', '三张实验卡，选一张开始'], ['recheck', '复查包', '本人复查或补检查后', '这次能算出的结果卡，写明和上次比是否超出平时波动']].map(([k, name, from, inside]) => `<figure class="pack"><img src="${A.pack(k)}" alt=""><span class="pname">${name}</span><span class="prule">${from}<br><span class="k-gold">${inside}</span></span></figure>`).join('')}</div>`
    const nudge = `<div class="dsh-mock"><div class="dsh-chat"><div class="dsh-bar">工作区 · api-refactor</div><div class="dsh-msg">把 order 服务的重试逻辑改成指数退避，并补上单测。</div><div class="dsh-run">● Agent 运行中 · 正在执行 npm test（已 2 分 14 秒）</div></div>
      <div class="dsh-side"><div class="dsh-tabs"><span>文件</span><span class="on">健康</span></div><div class="dsh-nudge"><p>已经坐了 1 小时 40 分。起来走两分钟？</p><div><button>好</button><button class="ghost">今天别提醒了</button></div></div><p class="dsh-note">右侧健康栏顶部一行；没打开健康栏时是右下角一个小条。没有数字，没有时间承诺，跑完的任务不影响它。打字时、会议中、演示模式下、「我的白天」以外都不出现。</p></div></div>`
    return `
      <section class="section box cream"><p><b>定稿：</b>玩法和视觉以 <code>docs/codex-design.md</code> 为准。本页的研究卡、物种卡、足迹卡、像素风是定稿视觉；下面的「实验」「两种包」「起身提醒」是定稿新增的组件。「试玩一个赛季」「玩法与概率」两页演示的是已废弃的第二版玩法，只看视觉。原型数据仍是旧的证据分级（金卡 4 张）；定稿后金卡只有 1 张，见设计文档第 4 节。</p></section>
      <section class="section box"><h2 class="h2">实验：图鉴的主线</h2>${experiments}</section>
      <section class="section box"><h2 class="h2">两种包</h2><p class="lead">没有每天的卡包。包只在真实发生的事之后出现，一个赛季约 4–6 个。</p>${packs2}</section>
      <section class="section box"><h2 class="h2">起身提醒：DSH 原生样式</h2><p class="lead">LongPi 在工作时唯一的出现方式。不用像素风，和 DSH 其他界面一样安静。</p>${nudge}</section>
      <section class="section box"><h2 class="h2">四种证据，四种边框</h2><p class="lead">研究卡的颜色只表示研究证据的类型：<span class="k-copper">铜是细胞实验</span>，<span class="k-silver">银是动物实验</span>，<span class="k-violet">紫是人群研究</span>，<span class="k-gold">金是人体随机试验</span>。金卡只有 ${counts('trial')} 张，因为长寿领域的人体随机试验本来就少。颜色不表示你的身体好坏。鼠标停在卡上看说明，卡会跟着鼠标倾斜。</p><div class="hand">${hero}</div></section>
      <section class="section box"><h2 class="h2">另外三种卡：不靠运气</h2><p class="lead">只有研究卡来自拆包。物种、工具、足迹三种卡都是做到了就收录。</p><div class="hand">${families}</div></section>
      <section class="section box"><h2 class="h2">卡面结构</h2><p class="lead">整张卡是一张 50 × 70 的像素图：边框、版画窗、证据格、标题条都在同一套像素网格上，按 3、4、6 倍整数放大，文字用 12 像素点阵字体对齐到网格。</p>${anatomy}</section>
      <section class="section box"><h2 class="h2">信息框</h2>${infoDemo}</section>
      <section class="section box"><h2 class="h2">卡的状态</h2>${states}</section>
      <section class="section box"><h2 class="h2">八章，八种像素母题</h2><p class="lead">同一章共用一种母题和一套配色，图案由卡号生成。方法库新增一项研究，卡面自动生成，不用画图。</p>${motifs}<h3 class="h3" style="margin-top:24px">同一章（大脑与心理）的前八张</h3>${variety}</section>
      <section class="section box"><h2 class="h2">物种志</h2><p class="lead">九种动物都来自方法库里真实用到它们的研究。版画窗下面一条寿命尺：从一周到三百年的对数刻度，<span class="k-gold">金点</span>是这种动物，<span style="color:#fff">白线</span>是人。</p>${species}</section>
      <section class="section box"><h2 class="h2">三种卡包</h2><p class="lead">做什么事，拿什么包。卡包不过期，每天最多拆 ${R.RULES.dailyCap} 包。包装只表示来路，不暗示里面是什么等级。</p>${packs}</section>
      <section class="section box"><h2 class="h2">配色</h2><div class="row" style="align-items:flex-start;gap:24px"><div style="flex:1;min-width:320px">${frames}</div><div style="flex:1;min-width:320px">${chapterPal}</div></div></section>
      <section class="section box"><h2 class="h2">拆包动效</h2><p class="lead">点卡包 → 抖动 0.5 秒 → 炸开碎片 → 卡背朝上发出来 → 0.35 秒后翻面。金卡翻面时多一次金色碎片。拆开前不提示等级，没有「差一点就是金卡」的动画。系统开启「减少动态效果」时，抖动、碎片、倾斜、扫光全部关闭。</p>${motion}</section>`
  }

  // ---- tab: all cards ------------------------------------------------------------------

  const gallery = { family: 'study', chapter: 'all', tier: 'all' }
  function galleryPage() {
    const fam = [['study', '研究', P.studies.length], ['species', '物种', P.species.length], ['tool', '工具', P.tools.length], ['milestone', '足迹', P.milestones.length]]
    const rows = [`<div class="row">${fam.map(([k, label, n]) => `<button class="btn tab sm" data-gf="${k}" aria-selected="${gallery.family === k}">${label} ${n}</button>`).join('')}</div>`]
    let ids = []
    if (gallery.family === 'study') {
      const pool = P.studies.filter((c) => gallery.chapter === 'all' || c.chapter === gallery.chapter)
      rows.push(`<div class="row"><button class="btn tab sm" data-gc="all" aria-selected="${gallery.chapter === 'all'}">全部章节</button>${P.chapters.map((ch) => `<button class="btn tab sm" data-gc="${ch.id}" aria-selected="${gallery.chapter === ch.id}">${esc(ch.title_zh)} ${ch.size}</button>`).join('')}</div>`)
      rows.push(`<div class="row"><button class="btn tab sm" data-gt="all" aria-selected="${gallery.tier === 'all'}">全部证据</button>${TIERS.map((t) => `<button class="btn tab sm" data-gt="${t}" aria-selected="${gallery.tier === t}">${P.tiers[t].metal_zh} ${P.tiers[t].label_zh} ${pool.filter((c) => c.tier === t).length}</button>`).join('')}</div>`)
      ids = pool.filter((c) => gallery.tier === 'all' || c.tier === gallery.tier).map((c) => c.id)
    } else if (gallery.family === 'species') ids = P.species.map((s) => s.id)
    else if (gallery.family === 'tool') ids = P.tools.map((t) => t.id)
    else ids = P.milestones.map((m) => m.id)
    return `<div class="section"><div class="box" style="display:grid;gap:10px;margin-bottom:24px">${rows.join('')}<p class="caption">共 ${ids.length} 张。鼠标停在卡上看说明，点开看全文。</p></div><div class="grid">${ids.map((id) => card(id, { live: true, date: '10·03' })).join('')}</div></div>`
  }

  // ---- detail modal ----------------------------------------------------------------------

  function openDetail(id, ctx) {
    const c = ctx || {}
    $('#modal').innerHTML = `<div class="modal" data-close><div class="modal-box"><div style="display:grid;gap:16px;justify-items:center">${card(id, { size: 's6', live: true, read: c.read, ran: c.ran, date: c.date })}<button class="btn grey" data-close>关闭</button></div>${info(id, { full: true, owned: c.owned, date: c.date })}</div></div>`
    $('#modal').querySelector('.pc').dataset.notip = '1'
  }

  // ---- reveal ----------------------------------------------------------------------------

  function reveal(args) {
    const ov = $('#overlay')
    const { bagKind } = args
    const label = R.RULES.bags[bagKind].label_zh
    if (args.skipPack) return showCards(args)
    ov.innerHTML = `<div class="ov"><div class="ov-stage"><div class="ov-pack idle" data-pack><img src="${A.pack(bagKind)}" alt=""></div><p class="ov-line big">${label}</p><p class="ov-line">${R.RULES.bags[bagKind].pool_zh}<br><span class="caption">点卡包拆开</span></p></div></div>`
    $('[data-pack]', ov).onclick = () => {
      const el = $('[data-pack]', ov)
      el.classList.remove('idle')
      el.classList.add('shake')
      setTimeout(() => {
        const rect = el.getBoundingClientRect()
        burst(rect.left + rect.width / 2, rect.top + rect.height / 2, PACK_COLORS[bagKind], 26)
        showCards(args)
      }, reduce ? 0 : 500)
    }
  }

  function showCards(args) {
    const ov = $('#overlay')
    if (args.pick) {
      ov.innerHTML = `<div class="ov"><div class="ov-stage"><p class="ov-line big">选一张留下</p><p class="ov-line">另外两张放回去，以后还能抽到。鼠标停在卡上看说明。</p>
        <div class="ov-row">${args.pick.map((c, i) => `<div class="pick-slot deal" style="--d:${i * 0.12}s" data-pick="${c.id}">${card(c.id, { live: true, flipped: true, isNew: true })}</div>`).join('')}</div>
        <div class="ov-actions"><button class="btn grey" data-close>先不选，卡包留着</button></div></div></div>`
      args.pick.forEach((c, i) => setTimeout(() => { const n = ov.querySelector(`[data-pick="${c.id}"] .pc`); if (n) n.classList.remove('is-flipped') }, reduce ? 0 : 450 + i * 160))
      const stage = $('.ov-stage', ov)
      let chosen = null
      stage.onclick = (event) => {
        if (event.target.closest('[data-close]')) { ov.innerHTML = ''; tip.hidden = true; return }
        const slot = event.target.closest('[data-pick]')
        if (!slot || chosen) return
        chosen = slot.dataset.pick
        tip.hidden = true
        stage.querySelectorAll('[data-pick]').forEach((node) => { if (node.dataset.pick !== chosen) node.classList.add('dim') })
        setTimeout(() => {
          const out = args.onChoose(chosen)
          showCards({ bagKind: 'pick', card: studyById.get(chosen), met: out.met, chapterDone: out.chapterDone, onKeep: args.onKeep })
        }, reduce ? 0 : 420)
      }
      return
    }
    const c = args.card
    const banners = []
    for (const key of args.met || []) {
      const s = speciesByKey.get(key)
      banners.push(`<div class="banner pop" style="animation-delay:.5s">${card(s.id, { size: 's2' })}<span><b>遇见新物种：${esc(s.name_zh)}</b><br>${esc(s.hook_zh)}。已放进物种志。</span></div>`)
    }
    if (args.chapterDone) {
      const ch = chapterById.get(args.chapterDone)
      banners.push(`<div class="complete">集齐！</div><div class="banner pop" style="animation-delay:.6s"><img src="${A.emblem(ch.motif)}" style="width:44px;height:44px" alt=""><span><b>第 ${ch.no} 章「${esc(ch.title_zh)}」</b><br>+1 次连续记录冻结。章节导读：${esc(ch.intro_zh)}</span></div>`)
    }
    const line = c.tier === 'trial' ? `<span class="k-gold">金卡 · 人体随机试验</span>　全库只有 ${P.studies.filter((x) => x.tier === 'trial').length} 张` : `<span class="${METAL_CLASS[c.tier]}">${P.tiers[c.tier].metal_zh} · ${P.tiers[c.tier].label_zh}</span>　${esc(chapterById.get(c.chapter).title_zh)}`
    ov.innerHTML = `<div class="ov"><div class="ov-stage"><div class="ov-row"><div class="deal">${card(c.id, { size: 's6', live: true, flipped: true, isNew: true })}</div><div style="width:300px" class="pop">${info(c.id, { full: true })}</div></div>
      <p class="ov-line big">${line}</p>${args.caption ? `<p class="ov-line">${args.caption}</p>` : ''}${banners.join('')}
      <div class="ov-actions"><button class="btn green" data-keep>收进图鉴</button></div></div></div>`
    const node = ov.querySelector('.pc')
    node.dataset.notip = '1'
    setTimeout(() => {
      node.classList.remove('is-flipped')
      if (c.tier === 'trial') setTimeout(() => { const r = node.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, ['#f2b53a', '#ffe896', '#ffffff'], 34) }, 250)
    }, reduce ? 0 : 380)
    if (args.chapterDone) setTimeout(() => burst(window.innerWidth / 2, window.innerHeight / 2, ['#e5484d', '#2f8fe6', '#35b37e', '#f2b53a', '#8a5cd6'], 60), 650)
    $('.ov-stage', ov).onclick = (event) => {
      if (event.target.closest('[data-keep]')) { ov.innerHTML = ''; tip.hidden = true; if (args.onKeep) args.onKeep() }
    }
  }

  function demo(kind) {
    const any = (tier) => { const list = P.studies.filter((c) => c.tier === tier); return list[Math.floor(Math.random() * list.length)] }
    if (kind === 'pick') reveal({ bagKind: 'pick', pick: [any('human'), any('animal'), any('trial')], onChoose: () => ({ met: [], chapterDone: null }) })
    else if (kind === 'species') reveal({ bagKind: 'daily', card: studyById.get('s-bowhead-whale-dna-repair'), met: ['bowhead_whale'] })
    else if (kind === 'chapter') reveal({ bagKind: 'daily', card: studyById.get('s-ageing-inflammatory-marker'), chapterDone: 'immune' })
    else reveal({ bagKind: kind === 'trial' ? 'care' : 'daily', card: any(kind) })
  }

  // ---- tab: play -------------------------------------------------------------------------

  const play = { state: null, isNew: new Set(), view: 'collecting', note: '' }

  function newGame() {
    play.state = R.createState(P, 20261003, 'clock')
    play.isNew = new Set()
    R.earn(play.state, 'pick', '赛季开始')
    play.note = '赛季开始：送你一个目标袋。日常袋都从「正在收集」的那一章里抽。'
  }
  function dateOf(day) {
    const d = new Date(2026, 9, 3 + day)
    return `${d.getMonth() + 1}·${String(d.getDate()).padStart(2, '0')}`
  }

  function playPage() {
    const s = play.state
    const shelf = s.bags.length
      ? s.bags.map((bag, i) => `<button data-open="${i}" ${s.drawsToday >= R.RULES.dailyCap ? 'disabled' : ''}><img src="${A.pack(bag.kind)}" alt="">${R.RULES.bags[bag.kind].label_zh}</button>`).join('')
      : '<p class="caption">没有待拆的卡包。做一件健康行动就会有。</p>'
    const oddsFor = (kind) => {
      const o = R.odds(s, P, { kind })
      if (!o.total) return `<p class="caption">${R.RULES.bags[kind].label_zh}：图鉴已集齐</p>`
      return `<div style="display:grid;gap:4px"><div><span class="k-gold">${R.RULES.bags[kind].label_zh}</span> <span class="caption">${o.fallback ? '本范围已集齐 · ' : ''}${o.total} 张 · 金 ${(o.pTrial * 100).toFixed(1)}%${kind === 'pick' ? '（三张里至少一张）' : ''}</span></div>
        ${TIERS.map((t) => `<div class="odds-line"><span class="${METAL_CLASS[t]}">${P.tiers[t].metal_zh} ${P.tiers[t].label_zh.slice(0, 2)}</span><div class="bar"><span style="--c:${BAR[t]};width:${(o.byTier[t] / o.total) * 100}%"></span></div><span class="caption" style="text-align:right">${o.byTier[t]}/${o.total}</span></div>`).join('')}</div>`
    }
    const side = `<div class="side-col">
      <div class="box"><div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="k-gold">第 ${s.day + 1} 天 · 第 ${Math.floor(s.day / 7) + 1} 周</span><span class="caption">今天拆了 ${s.drawsToday}/${R.RULES.dailyCap}</span></div>
        <div class="actions-grid">
          <button class="btn green" data-act="record" ${s.recordedToday ? 'disabled' : ''}>记一条记录</button>
          <button class="btn" data-act="quest">完成小目标</button>
          <button class="btn violet" data-act="care">带简报就诊</button>
          <button class="btn violet" data-act="addon">补一项检查</button>
          <button class="btn violet" data-act="retest">按时复测</button>
          <button class="btn blue" data-act="tool">LongPi 用了工具</button>
          <button class="btn grey" data-act="day">过一天</button>
          <button class="btn grey" data-act="week">快进一周</button>
        </div>
        <button class="btn red" data-act="auto" style="width:100%;margin-top:10px">自动玩 4 周</button>
        <p class="caption" style="margin-top:8px">本周日常袋 ${s.dailyBagsThisWeek}/${R.RULES.dailyBagsPerWeek}。「快进一周」按每周记录 4 天模拟，卡包留给你拆。</p></div>
      <div class="box"><span class="k-gold">待拆的卡包（${s.bags.length}）</span><div class="shelf" style="margin-top:10px">${shelf}</div></div>
      <div class="box" style="display:grid;gap:12px"><span class="k-gold">下一包能拆到什么</span>${oddsFor('daily')}${oddsFor('care')}${oddsFor('pick')}<p class="caption">每包都从你还没有的卡里等概率抽，不会重复。</p></div>
      <div class="box dim"><span class="k-gold">记录</span><ul class="log" style="margin-top:8px">${s.log.slice(-30).reverse().map((row) => `<li>${dateOf(row.day)} ${R.RULES.bags[row.bag].label_zh} → <span class="${METAL_CLASS[row.tier]}">${P.tiers[row.tier].metal_zh}</span>「${esc(studyById.get(row.card).headline_zh)}」</li>`).join('') || '<li>还没有拆过卡包</li>'}</ul></div>
      <button class="btn grey sm" data-act="reset">重新开始</button></div>`
    const scores = `<div class="scores">
      <div class="score"><b>${s.owned.length}</b><span>研究卡 /${P.studies.length}</span></div>
      <div class="score" style="--c:var(--red);--cd:var(--red-d)"><b>${s.read.size}</b><span>读过</span></div>
      <div class="score" style="--c:var(--violet);--cd:var(--violet-d)"><b>${s.ran.size}</b><span>算过</span></div>
      <div class="score" style="--c:var(--gold);--cd:var(--gold-d)"><b style="color:#2a1c05;text-shadow:none">${s.chaptersDone.size}</b><span style="color:#2a1c05">集齐 /8</span></div>
      <div class="score" style="--c:#3a372f;--cd:#15140f"><b>${s.species.size}</b><span>物种</span></div>
      <div class="score" style="--c:#4a72a8;--cd:#22385c"><b>${s.tools.size}</b><span>工具</span></div>
      <div class="score" style="--c:#c9925a;--cd:#7a4f26"><b>${s.milestones.size}</b><span>足迹</span></div>
      <div class="score" style="--c:var(--green);--cd:var(--green-d)"><b>${s.freezes}</b><span>冻结</span></div></div>`
    const chapters = `<div class="chapters">${P.chapters.map((ch) => {
      const p = R.chapterProgress(s, P, ch.id)
      const golds = P.studies.filter((c) => c.chapter === ch.id && c.tier === 'trial').length
      return `<button class="chapter-btn" data-ch="${ch.id}" aria-pressed="${(play.view === 'collecting' ? s.collecting : play.view) === ch.id}"><span class="t"><img src="${A.emblem(ch.motif)}" alt="">${esc(ch.title_zh)}</span><div class="bar"><span style="--c:${s.chaptersDone.has(ch.id) ? 'var(--gold)' : 'var(--blue)'};width:${(p.have / p.size) * 100}%"></span></div><span class="c"><span>${p.have}/${p.size}${s.chaptersDone.has(ch.id) ? ' 集齐' : ''}</span><span>${s.collecting === ch.id ? '<span class="k-red">收集中</span>' : golds ? `<span class="k-gold">金 ${golds}</span>` : ''}</span></span></button>`
    }).join('')}</div>`
    let body = ''
    const viewId = play.view === 'collecting' ? s.collecting : play.view
    if (chapterById.has(viewId)) {
      const ch = chapterById.get(viewId)
      body = `<div class="row" style="justify-content:space-between;margin-bottom:14px"><div><h3 class="h2" style="margin:0">第 ${ch.no} 章 · ${esc(ch.title_zh)}</h3><p class="caption">${esc(ch.intro_zh)}</p></div>${s.collecting === ch.id ? '<span class="chip" style="--c:var(--red);--cd:var(--red-d)">日常袋从这一章里抽</span>' : `<button class="btn" data-collect="${ch.id}">改为收集这一章</button>`}</div>
        <div class="grid xs">${P.studies.filter((c) => c.chapter === ch.id).map((c) => card(c.id, s.ownedSet.has(c.id) ? { size: 's3', live: true, isNew: play.isNew.has(c.id), read: s.read.has(c.id), ran: s.ran.has(c.id) } : { size: 's3', live: true, locked: true })).join('')}</div>`
    } else if (play.view === 'species') body = `<h3 class="h2">物种志 ${s.species.size}/${P.species.length}</h3><div class="grid xs">${P.species.map((sp) => card(sp.id, { size: 's3', live: true, locked: !s.species.has(sp.key) })).join('')}</div>`
    else if (play.view === 'tools') body = `<h3 class="h2">工具 ${s.tools.size}/${P.tools.length}</h3><div class="grid xs">${P.tools.map((t) => card(t.id, { size: 's3', live: true, locked: !s.tools.has(t.id) })).join('')}</div>`
    else body = `<h3 class="h2">足迹 ${s.milestones.size}/${P.milestones.length}</h3><div class="grid xs">${P.milestones.map((m) => card(m.id, { size: 's3', live: true, locked: !s.milestones.has(m.id), date: s.milestones.has(m.id) ? dateOf(s.milestones.get(m.id)) : '' })).join('')}</div>`
    const views = [['collecting', '正在收集'], ['species', `物种 ${s.species.size}`], ['tools', `工具 ${s.tools.size}`], ['milestones', `足迹 ${s.milestones.size}`]]
    return `<div class="play">${side}<div><div class="box">${scores}${play.note ? `<p class="box dim" style="margin:16px 4px 4px;padding:10px 12px">${esc(play.note)}</p>` : ''}</div>${chapters}
      <div class="row" style="margin-bottom:16px">${views.map(([k, label]) => `<button class="btn tab sm" data-view="${k}" aria-selected="${play.view === k}">${label}</button>`).join('')}</div><div class="box">${body}</div></div></div>`
  }

  function playAct(act) {
    const s = play.state
    play.note = ''
    const mile = (id) => { if (R.milestone(s, id)) play.note += `收录足迹卡「${mileById.get(id).title_zh}」。` }
    if (act === 'record') {
      play.note = R.record(s) ? '今天有记录，得到一个日常袋。' : '今天有记录。本周的日常袋已满 3 个，不用天天打开。'
      mile('f-first-record')
      if (s.recordDays >= 28) mile('f-four-weeks')
    } else if (act === 'quest') { R.earn(s, 'pick', '小目标'); play.note = '完成一个小目标，得到一个目标袋：翻开三张，选一张。' }
    else if (act === 'care') { R.earn(s, 'care', '就诊'); play.note = '带简报就诊，得到一个就诊袋：只出人群研究或人体试验卡。'; mile('f-care-brief') }
    else if (act === 'addon') { R.earn(s, 'care', '补检查'); play.note = '补上一项检查，得到一个就诊袋。'; mile('f-addon') }
    else if (act === 'retest') { R.earn(s, 'care', '复测'); play.note = '按时复测，得到一个就诊袋。'; mile('f-retest') }
    else if (act === 'tool') {
      const left = P.tools.filter((t) => !s.tools.has(t.id))
      if (left.length) { const t = left[Math.floor(s.roll() * left.length)]; s.tools.add(t.id); play.note = `LongPi 在对话里用了「${t.headline_zh}」，工具卡已收录。` }
    } else if (act === 'day') { R.nextDay(s); play.note = '新的一天。' }
    else if (act === 'week') {
      const start = s.day
      while (s.day < start + 7) { if (s.roll() < 4 / 7) R.record(s); R.nextDay(s) }
      if (s.recordDays >= 28) mile('f-four-weeks')
      play.note = `快进了一周，现在有 ${s.bags.length} 个待拆的卡包。`
    } else if (act === 'reset') newGame()
    else if (act === 'auto') autoplay(4)
    render()
  }

  function autoplay(weeks) {
    const s = play.state
    const rank = { cell: 0, animal: 1, human: 2, trial: 3 }
    const before = s.owned.length
    const startWeek = Math.floor(s.day / 7)
    for (let w = 0; w < weeks; w += 1) {
      const week = startWeek + w
      for (let d = 0; d < 7; d += 1) {
        if (s.roll() < 4 / 7) { R.record(s); R.milestone(s, 'f-first-record') }
        if (d === 3 && week % 2 === 1) R.earn(s, 'pick', '小目标')
        if (d === 5 && week % 4 === 2) { R.earn(s, 'care', '就诊'); R.milestone(s, 'f-care-brief') }
        while (s.bags.length) {
          const out = R.draw(s, P, 0)
          if (!out.ok) break
          const res = out.pick ? R.choose(s, P, 0, (out.options.find((c) => c.tier === 'trial') || out.options.find((c) => c.chapter === s.collecting) || out.options.slice().sort((a, b) => rank[b.tier] - rank[a.tier])[0]).id) : out
          play.isNew.add(res.card.id)
          if (res.chapterDone) { const next = R.suggestChapter(s, P); if (next) s.collecting = next }
        }
        R.nextDay(s)
      }
    }
    if (s.recordDays >= 28) R.milestone(s, 'f-four-weeks')
    for (const id of s.owned.slice(0, Math.floor(s.owned.length * 0.6))) { s.read.add(id); play.isNew.delete(id) }
    for (const id of s.owned.slice(0, 4)) if (offerOf(studyById.get(id)).kind === 'run') { s.ran.add(id); R.milestone(s, 'f-ran-method') }
    if (s.tools.size === 0) s.tools.add(P.tools.find((t) => t.skill === 'pyaging').id)
    play.note = `自动玩了 ${weeks} 周：每周记录约 4 天，隔周完成一个小目标，每四周就诊一次。新收录 ${s.owned.length - before} 张，其中六成已读过。`
  }

  function openBag(index) {
    const s = play.state
    const bag = s.bags[index]
    const out = R.draw(s, P, index)
    if (!out.ok) {
      play.note = out.reason === 'daily_cap' ? `今天已经拆了 ${R.RULES.dailyCap} 包，剩下的明天再拆，卡包不会过期。` : '图鉴已集齐。方法库新增研究时会有新卡上架。'
      render()
      return
    }
    const after = (res) => {
      play.isNew.add(res.card.id)
      if (res.chapterDone) {
        const next = R.suggestChapter(s, P)
        if (next) s.collecting = next
        play.note = `集齐「${chapterById.get(res.chapterDone).title_zh}」。接下来收集「${next ? chapterById.get(next).title_zh : '—'}」，可以随时换。`
      }
      render()
    }
    if (out.pick) reveal({ bagKind: 'pick', pick: out.options, onChoose: (id) => { const res = R.choose(s, P, index, id); after(res); return res } })
    else {
      reveal({ bagKind: bag.kind, card: out.card, met: out.met, chapterDone: out.chapterDone, caption: out.fallback ? '这个范围已经集齐，这一包改从全部未收录的卡里抽。' : '' })
      after(out)
    }
  }

  // ---- tab: rules -------------------------------------------------------------------------

  function simulateCurve(person, seed, weeks) {
    const behave = R.rng(seed ^ 0x9e3779b9)
    const s = R.createState(P, seed, 'organ')
    const rank = { cell: 0, animal: 1, human: 2, trial: 3 }
    const curve = []
    const open = () => {
      while (s.bags.length) {
        const out = R.draw(s, P, 0)
        if (!out.ok) return
        const res = out.pick ? R.choose(s, P, 0, (out.options.find((c) => c.tier === 'trial') || out.options.find((c) => c.chapter === s.collecting) || out.options.slice().sort((a, b) => rank[b.tier] - rank[a.tier])[0]).id) : out
        if (res.chapterDone) { const next = R.suggestChapter(s, P); if (next) s.collecting = next }
      }
    }
    for (let w = 0; w < weeks; w += 1) {
      if (w % 12 === 0) R.earn(s, 'pick', '赛季开始')
      const qd = behave() < person.quests / 12 ? Math.floor(behave() * 7) : -1
      const cd = behave() < person.care / 12 ? Math.floor(behave() * 7) : -1
      for (let d = 0; d < 7; d += 1) {
        if (behave() < person.days / 7) R.record(s)
        if (d === qd) R.earn(s, 'pick', '小目标')
        if (d === cd) R.earn(s, 'care', '就诊')
        if (s.recordedToday || d === qd || d === cd) open()
        R.nextDay(s)
      }
      curve.push({ cards: s.owned.length / P.studies.length, chapters: s.chaptersDone.size })
    }
    return curve
  }

  function simulateOld(person, seed, weeks) {
    const roll = R.rng(seed)
    const sizes = { common: 13, rare: 51, epic: 103, legendary: 13 }
    const odds = [['common', 0.52], ['rare', 0.28], ['epic', 0.16], ['legendary', 0.04]]
    const owned = new Set()
    const curve = []
    for (let w = 0; w < weeks; w += 1) {
      let draws = 0
      for (let d = 0; d < 7; d += 1) if (roll() < person.days / 7) draws += 1
      if (roll() < person.quests / 12) draws += 1
      for (let i = 0; i < draws; i += 1) {
        let u = roll()
        let tier = 'legendary'
        for (const [t, p] of odds) { if (u < p) { tier = t; break } u -= p }
        owned.add(`${tier}:${Math.floor(roll() * sizes[tier])}`)
      }
      curve.push({ cards: owned.size / 180 })
    }
    return curve
  }
  const median = (rows, week, key) => { const v = rows.map((row) => row[week][key]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] }

  function chart() {
    const weeks = 104
    const runs = 120
    const e = Array.from({ length: runs }, (_, i) => simulateCurve({ days: 4, quests: 5, care: 3 }, i + 1, weeks))
    const c = Array.from({ length: runs }, (_, i) => simulateCurve({ days: 1.5, quests: 2, care: 1 }, i + 1, weeks))
    const o = Array.from({ length: runs }, (_, i) => simulateOld({ days: 4, quests: 5 }, i + 1, weeks))
    const W = 640
    const H = 230
    const x = (w) => 44 + (w / weeks) * (W - 64)
    const y = (v) => 196 - v * 176
    const step = (rows, key) => rows[0].map((_, w) => [x(w + 1), y(median(rows, w, key))])
    const pixelLine = (pts, color, dash) => `<path d="M${pts.map(([px, py]) => `${Math.round(px / 4) * 4},${Math.round(py / 4) * 4}`).join('L')}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="miter"${dash ? ' stroke-dasharray="8 8"' : ''}/>`
    let axes = `<path d="M44,16V196H${W - 16}" fill="none" stroke="#0d0f12" stroke-width="4"/>`
    for (const v of [0.25, 0.5, 0.75, 1]) axes += `<line x1="44" x2="${W - 16}" y1="${y(v)}" y2="${y(v)}" stroke="#33454c" stroke-width="2"/><text x="38" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`
    for (const w of [12, 24, 36, 52, 78, 104]) axes += `<text x="${x(w)}" y="214" text-anchor="middle">${w}周</text>`
    const marks = (rows, color) => {
      let out = ''
      for (let n = 1; n <= 8; n += 1) {
        const done = rows.map((row) => { const i = row.findIndex((p) => p.chapters >= n); return i < 0 ? null : i + 1 }).filter((v) => v != null).sort((a, b) => a - b)
        if (done.length < rows.length / 2) continue
        const wk = done[Math.floor(done.length / 2)]
        out += `<rect x="${x(wk) - 6}" y="${y(median(rows, wk - 1, 'cards')) - 6}" width="12" height="12" fill="${color}" stroke="#0d0f12" stroke-width="2"/>`
      }
      return out
    }
    const pct = (rows) => Math.round(median(rows, 51, 'cards') * 100)
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">${axes}${pixelLine(step(o, 'cards'), '#7f9398', true)}${pixelLine(step(c, 'cards'), '#2f8fe6')}${pixelLine(step(e, 'cards'), '#f2b53a')}${marks(e, '#f2b53a')}${marks(c, '#2f8fe6')}</svg>
      <div class="row"><span class="k-gold">■ 新规则 · 积极（每周记录 4 天）一年 ${pct(e)}%</span><span class="k-blue">■ 新规则 · 普通（每周 1.5 天）一年 ${pct(c)}%</span><span class="caption">┅ 旧规则 · 积极 一年 ${pct(o)}%（不重复的卡）</span><span class="caption">方块 = 集齐一章</span></div>`
  }

  function rulesPage() {
    const bagRows = ['daily', 'care', 'pick'].map((k) => `<tr><td><img src="${A.pack(k)}" style="width:45px;height:63px" alt=""></td><td class="k-gold">${R.RULES.bags[k].label_zh}</td><td>${R.RULES.bags[k].from_zh}</td><td>${R.RULES.bags[k].pool_zh}</td></tr>`).join('')
    const tierTable = `<table class="table"><thead><tr><th>章</th>${TIERS.map((t) => `<th class="num ${METAL_CLASS[t]}">${P.tiers[t].metal_zh} ${P.tiers[t].label_zh}</th>`).join('')}<th class="num">合计</th><th>方法库领域</th></tr></thead><tbody>${P.chapters.map((ch) => `<tr><td>${chapterChip(ch.id)}</td>${TIERS.map((t) => `<td class="num">${P.studies.filter((c) => c.chapter === ch.id && c.tier === t).length || '—'}</td>`).join('')}<td class="num">${ch.size}</td><td class="caption">${esc(ch.domains.join('、'))}</td></tr>`).join('')}
      <tr><td class="k-gold">全部</td>${TIERS.map((t) => `<td class="num ${METAL_CLASS[t]}">${P.studies.filter((c) => c.tier === t).length}</td>`).join('')}<td class="num">${P.studies.length}</td><td></td></tr></tbody></table>`
    return `
      <section class="section box"><h2 class="h2">一句话玩法</h2><p style="font-size:24px;line-height:32px;color:var(--cream)">做一件对健康有用的事，拿一个卡包；拆开收下一张研究卡，读懂它，能算就用自己的记录算一下；一章一章把图鉴集齐。</p></section>
      <section class="section box"><h2 class="h2">三种卡包</h2><table class="table"><thead><tr><th></th><th>卡包</th><th>怎么得到</th><th>能拆到什么</th></tr></thead><tbody>${bagRows}</tbody></table><p class="caption" style="margin-top:10px">每天最多拆 ${R.RULES.dailyCap} 包；卡包不过期；日常袋每周最多 ${R.RULES.dailyBagsPerWeek} 个，天天打开不会多拿。</p></section>
      <section class="section box"><h2 class="h2">概率</h2><p class="lead">每一包都从你<span class="k-gold">还没有</span>的研究卡里等概率抽，不会重复；${P.studies.length} 张卡最多 ${P.studies.length} 包一定集齐。日常袋只看你正在收集的那一章；就诊袋只看人群研究和人体试验；目标袋翻开三张让你选。拆包页随时显示「下一包能拆到什么」：刚开始时，日常袋收集「身体的钟」拆到金卡的机会是 3/26（11.5%），就诊袋 4/104（3.8%）。</p>${tierTable}</section>
      <section class="section box"><h2 class="h2">两年里的收集曲线</h2><p class="lead">120 次模拟的中位数。旧规则按稀有度定概率、允许重复：一年后一半以上是重复卡，紫卡要约 3,400 次才能集齐。新规则下积极用户约每 5 周集齐一章、一年内集齐全部；普通用户约每个赛季集齐一章。</p>${chart()}</section>
      <section class="section box"><h2 class="h2">不做的事</h2><div style="display:grid;gap:6px;color:var(--text-2)">
        <p><span class="k-red">✕</span> 不卖卡包，不卖卡，不能交易或赠送；没有任何货币。</p>
        <p><span class="k-red">✕</span> 卡的颜色只表示证据类型；拆到什么与化验结果、指标好坏无关。</p>
        <p><span class="k-red">✕</span> 拆开前不提示等级，没有「差一点就是金卡」的动画，没有限时卡池和倒计时。</p>
        <p><span class="k-red">✕</span> 卡包不过期，连续记录中断不会收走任何卡。</p>
        <p><span class="k-red">✕</span> 未满 18 岁或年龄未填时图鉴关闭；关掉图鉴后 LongPi 不再提拆包。</p>
        <p><span class="k-red">✕</span> 没有十连抽，每天最多拆 ${R.RULES.dailyCap} 包。</p></div></section>`
  }

  // ---- shell -------------------------------------------------------------------------------

  const TABS = [['spec', '卡面设计'], ['gallery', `全部卡片 ${P.studies.length + P.species.length + P.tools.length + P.milestones.length}`], ['play', '试玩一个赛季'], ['rules', '玩法与概率']]
  let tab = (location.hash || '#spec').slice(1)
  if (!TABS.some(([k]) => k === tab)) tab = 'spec'

  function render() {
    tip.hidden = true
    $('#tabs').innerHTML = TABS.map(([k, label]) => `<button class="btn tab" data-tab="${k}" aria-selected="${tab === k}">${label}</button>`).join('')
    const stale = '<div class="box cream" style="margin-bottom:24px"><b>已废弃的玩法：</b>这一页演示的是第二版规则（日常袋、按章收集、每周上限），只作视觉参考。定稿玩法见 <code>docs/codex-design.md</code>。</div>'
    $('#page').innerHTML = tab === 'spec' ? specPage() : tab === 'gallery' ? galleryPage() : tab === 'play' ? stale + playPage() : stale + rulesPage()
  }

  document.addEventListener('click', (event) => {
    const t = event.target
    if (t.closest('#overlay')) return
    const tabBtn = t.closest('[data-tab]'); if (tabBtn) { tab = tabBtn.dataset.tab; location.hash = tab; render(); window.scrollTo(0, 0); return }
    if ($('#modal').contains(t)) { if (t.closest('[data-close]') && (t.hasAttribute('data-close') || t.closest('.btn'))) $('#modal').innerHTML = ''; return }
    const gf = t.closest('[data-gf]'); if (gf) { gallery.family = gf.dataset.gf; gallery.chapter = 'all'; gallery.tier = 'all'; render(); return }
    const gc = t.closest('[data-gc]'); if (gc) { gallery.chapter = gc.dataset.gc; render(); return }
    const gt = t.closest('[data-gt]'); if (gt) { gallery.tier = gt.dataset.gt; render(); return }
    const dm = t.closest('[data-demo]'); if (dm) { demo(dm.dataset.demo); return }
    const act = t.closest('[data-act]'); if (act) { playAct(act.dataset.act); return }
    const ob = t.closest('[data-open]'); if (ob) { openBag(Number(ob.dataset.open)); return }
    const ch = t.closest('[data-ch]'); if (ch) { play.view = ch.dataset.ch; render(); return }
    const cl = t.closest('[data-collect]'); if (cl) { play.state.collecting = cl.dataset.collect; play.view = 'collecting'; play.note = `改为收集「${chapterById.get(cl.dataset.collect).title_zh}」。日常袋从这一章里抽。`; render(); return }
    const vw = t.closest('[data-view]'); if (vw) { play.view = vw.dataset.view; render(); return }
    const el = t.closest('.pc.live')
    if (el && !el.dataset.locked) {
      const id = el.dataset.id
      if (tab === 'play' && id.startsWith('s-')) {
        play.isNew.delete(id)
        play.state.read.add(id)
        render()
        openDetail(id, { read: true, ran: play.state.ran.has(id) })
        return
      }
      const date = tab === 'play' && play.state.milestones.has(id) ? dateOf(play.state.milestones.get(id)) : '10·03'
      openDetail(id, { owned: play.state.ownedSet, date })
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { $('#modal').innerHTML = ''; $('#overlay').innerHTML = ''; tip.hidden = true }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('live')) { event.preventDefault(); event.target.click() }
  })

  A.swirl($('#bg'))
  $('#logo').src = A.back()
  newGame()
  const params = new URLSearchParams(location.search)
  if (params.get('auto')) autoplay(Number(params.get('auto')) || 4)
  document.fonts.load('12px FusionPixel').finally(() => {
    render()
    // ?demo=trial|human|animal|cell|pick|species|chapter opens a reveal; &open=1 also opens the pack.
    if (params.get('demo')) {
      demo(params.get('demo'))
      if (params.get('open')) setTimeout(() => { const pack = $('[data-pack]'); if (pack) pack.click() }, 60)
    }
    if (params.get('detail')) openDetail(params.get('detail'), { owned: play.state.ownedSet })
  })
})()
