// Codex v2 preview: card spec, every card, a playable season, and the rules (docs/codex-v2.md).

(function () {
  const P = window.CODEX
  const R = window.CodexRules
  const A = window.CodexArt
  const $ = (sel, el) => (el || document).querySelector(sel)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const chapterById = new Map(P.chapters.map((row) => [row.id, row]))
  const studyById = new Map(P.studies.map((row) => [row.id, row]))
  const speciesByKey = new Map(P.species.map((row) => [row.key, row]))
  const TIERS = ['cell', 'animal', 'human', 'trial']
  const TIER_ODDS_COLOR = { cell: '#b8622c', animal: '#7c8a99', human: '#7750c6', trial: '#c48c1c' }

  // ---- card renderers -------------------------------------------------------

  function ladder(tier) {
    const rank = P.tiers[tier].rank
    return `<span class="cx-ladder" title="证据等级：细胞 → 动物 → 人群 → 人体试验">${TIERS.map((_, i) => `<i class="${i <= rank ? 'on' : ''}"></i>`).join('')}<b>${P.tiers[tier].label_zh}</b></span>`
  }

  function shell(attrs, front, back, opts) {
    const cls = ['cx-card', opts.size || '', opts.locked ? 'is-locked' : '', opts.flipped ? 'is-flipped' : '', opts.clickable ? 'is-clickable' : '', opts.revealed ? 'is-revealed' : ''].filter(Boolean).join(' ')
    return `<div class="${cls}" ${attrs}${opts.clickable ? ' tabindex="0" role="button"' : ''}>${opts.isNew ? '<span class="cx-tag-new">新</span>' : ''}<div class="cx-inner"><div class="cx-face cx-front"><div class="cx-sheet">${front}</div></div><div class="cx-face cx-back"><div class="cx-sheet">${back}</div></div></div></div>`
  }

  function offerOf(card) {
    if (card.tier === 'cell' || card.tier === 'animal') return { kind: 'evidence', text: `${card.species_zh.split('、')[0]}研究证据，不用你的数据` }
    if (!card.use_zh) return { kind: 'evidence', text: '这项研究没有个人报告' }
    return card.art.seed % 3 === 0 ? { kind: 'unlock', text: '补上相关检查后可以计算' } : { kind: 'run', text: '可以用你的记录计算' }
  }

  function studyCard(card, opts) {
    const o = opts || {}
    const chapter = chapterById.get(card.chapter)
    const year = card.source.year ? ` · ${card.source.year}` : ''
    const top = `<div class="cx-top"><span class="cx-no">No.${card.no}</span><span class="cx-ch">${A.emblem(chapter.motif, 12)}${esc(chapter.title_zh)}</span></div>`
    if (o.locked) {
      const front = `${top}<div class="cx-plate">${A.emblem(chapter.motif, 40)}</div><h4 class="cx-title">未收录</h4><p class="cx-hook">${esc(P.tiers[card.tier].label_zh)}</p><div class="cx-foot">${ladder(card.tier)}<span class="cx-meta"></span></div>`
      return shell(`data-family="study" data-tier="${card.tier}" data-id="${card.id}" aria-label="未收录的${P.tiers[card.tier].label_zh}卡"`, front, '', o)
    }
    const offer = o.offer ? offerOf(card) : null
    const front = `${top}
      <div class="cx-plate">${A.plate(card.art.motif, card.art.seed)}${card.tier === 'trial' ? '<span class="cx-seal">RCT</span>' : ''}</div>
      <h4 class="cx-title">${esc(card.headline_zh)}</h4>
      <p class="cx-hook">${esc(card.hook_zh)}</p>
      ${offer && o.size === 'lg' ? `<span class="cx-chip">${esc(offer.text)}</span>` : ''}
      <div class="cx-foot">${ladder(card.tier)}<span class="cx-meta">${esc(card.species_zh.split('、')[0])}${year}</span></div>
      ${o.read ? '<span class="cx-stamp read">读过</span>' : ''}${o.ran ? '<span class="cx-stamp ran">算过</span>' : ''}`
    const back = `<div class="cx-top"><span class="cx-no">No.${card.no}</span><span class="cx-ch">这项研究</span></div>
      <p class="cx-body">${esc(card.about_zh)}</p>
      ${card.use_zh ? `<h5>拿你的记录能做什么</h5><p class="cx-use">${esc(card.use_zh)}</p>` : ''}
      <p class="cx-caveat">${esc(card.caveat_zh)}</p>
      <div class="cx-src"><span>${esc(card.source.journal || '')}${year}${card.source.authors ? ` · ${esc(card.source.authors)}` : ''}</span><span>${card.source.doi ? `doi:${esc(card.source.doi)}` : esc(card.source.skill)}</span></div>`
    return shell(`data-family="study" data-tier="${card.tier}" data-id="${card.id}" aria-label="${esc(card.headline_zh)}，${P.tiers[card.tier].label_zh}"`, front, back, o)
  }

  function speciesCard(sp, opts) {
    const o = opts || {}
    const top = `<div class="cx-top"><span class="cx-no">No.${sp.no}</span><span class="cx-ch">物种</span></div>`
    if (o.locked) {
      const front = `${top}<div class="cx-plate">${A.species(sp.key, { silhouette: true })}</div><h4 class="cx-title">？？？</h4><p class="cx-hook">收录一张有这种动物的研究卡后出现</p><div class="cx-foot"><span>未遇见</span><span class="cx-meta">${sp.studies.length} 项研究</span></div>`
      return shell(`data-family="species" data-id="${sp.id}" aria-label="未遇见的物种"`, front, '', o)
    }
    const owned = o.owned || new Set()
    const front = `${top}
      <div class="cx-plate">${A.species(sp.key)}</div>
      <h4 class="cx-title">${esc(sp.name_zh)}</h4>
      <p class="cx-latin">${esc(sp.latin)}</p>
      <p class="cx-hook">${esc(sp.hook_zh)}</p>
      ${A.lifespan(sp.lifespan_years)}
      <div class="cx-foot"><span>寿命 ${esc(sp.lifespan_zh)}</span><span class="cx-meta">${sp.studies.length} 项研究</span></div>`
    const list = sp.studies.slice(0, 5).map((id) => {
      const card = studyById.get(id)
      return `<span>${owned.has(id) ? '●' : '○'} ${esc(card.headline_zh)}</span>`
    }).join('')
    const back = `${top.replace('物种', esc(sp.name_zh))}
      <p class="cx-body">${esc(sp.body_zh)}</p>
      <h5>图鉴里用到它的研究</h5><div class="cx-use" style="display:grid">${list}${sp.studies.length > 5 ? `<span>还有 ${sp.studies.length - 5} 项</span>` : ''}</div>
      <p class="cx-caveat">物种卡讲的是这种动物，不是你。</p>`
    return shell(`data-family="species" data-id="${sp.id}" aria-label="${esc(sp.name_zh)}"`, front, back, o)
  }

  function toolCard(tool, opts) {
    const o = opts || {}
    const top = `<div class="cx-top"><span class="cx-no">No.${tool.no}</span><span class="cx-ch">工具</span></div>`
    if (o.locked) {
      const front = `${top}<div class="cx-plate">${A.toolPlate(tool.glyph)}</div><h4 class="cx-title">未收录</h4><p class="cx-hook">LongPi 第一次替你用到它时收录</p><div class="cx-foot"><span>用过即收录</span></div>`
      return shell(`data-family="tool" data-id="${tool.id}"`, front, '', o)
    }
    const front = `${top}<div class="cx-plate">${A.toolPlate(tool.glyph)}</div><h4 class="cx-title">${esc(tool.headline_zh)}</h4><p class="cx-hook">${esc(tool.hook_zh)}</p><div class="cx-foot"><span>用过即收录</span><span class="cx-meta" style="font-family:var(--mono)">${esc(tool.skill)}</span></div>`
    const back = `${top}<p class="cx-body">${esc(tool.blurb_zh)}</p><p class="cx-caveat">工具卡不进抽卡池，只在真的用过之后收录。</p>`
    return shell(`data-family="tool" data-id="${tool.id}"`, front, back, o)
  }

  function milestoneCard(m, opts) {
    const o = opts || {}
    const top = `<div class="cx-top"><span class="cx-no">No.${m.no}</span><span class="cx-ch">足迹</span></div>`
    const date = o.date || ''
    if (o.locked) {
      const front = `${top}<div class="cx-plate">${A.milestonePlate(m.glyph, '')}</div><h4 class="cx-title">${esc(m.title_zh)}</h4><p class="cx-hook">还没走到这一步</p><div class="cx-foot"><span>记的是行动</span></div>`
      return shell(`data-family="milestone" data-id="${m.id}"`, front, '', o)
    }
    const front = `${top}<div class="cx-plate">${A.milestonePlate(m.glyph, date)}</div><h4 class="cx-title">${esc(m.title_zh)}</h4><p class="cx-hook">${esc(m.hook_zh)}</p><div class="cx-foot"><span>记的是行动，不是指标</span></div>`
    const back = `${top}<p class="cx-body">${esc(m.hook_zh)}${date ? `（${esc(date)}）` : ''}。</p><p class="cx-caveat">${esc(m.caveat_zh)}</p>`
    return shell(`data-family="milestone" data-id="${m.id}"`, front, back, o)
  }

  function anyCard(id, opts) {
    if (id.startsWith('s-')) return studyCard(studyById.get(id), opts)
    if (id.startsWith('sp-')) return speciesCard(P.species.find((row) => row.id === id), opts)
    if (id.startsWith('t-')) return toolCard(P.tools.find((row) => row.id === id), opts)
    return milestoneCard(P.milestones.find((row) => row.id === id), opts)
  }

  // ---- tab: card spec -------------------------------------------------------

  const SHOWCASE = {
    cell: 's-bowhead-whale-dna-repair',
    animal: 's-circadian-caloric-restriction-longevity',
    human: 's-wearable-aging-clock',
    trial: 's-fasting-mimicking-diet',
  }

  function specPage() {
    const hero = TIERS.map((tier) => `<figure>${studyCard(studyById.get(SHOWCASE[tier]), { clickable: true })}<figcaption><b>${P.tiers[tier].metal_zh} · ${P.tiers[tier].label_zh}</b><br>全库 ${P.studies.filter((c) => c.tier === tier).length} 张</figcaption></figure>`).join('')
    const families = [
      `<figure>${speciesCard(speciesByKey.get('bowhead_whale'), { clickable: true })}<figcaption><b>物种卡</b><br>收录第一张用到这种动物的研究卡时遇见</figcaption></figure>`,
      `<figure>${toolCard(P.tools.find((t) => t.skill === 'pyaging'), { clickable: true })}<figcaption><b>工具卡</b><br>LongPi 第一次替你用到这个工具时收录</figcaption></figure>`,
      `<figure>${milestoneCard(P.milestones.find((m) => m.id === 'f-care-brief'), { clickable: true, date: '10·03' })}<figcaption><b>足迹卡</b><br>做到一件事时收录，记行动，不记指标</figcaption></figure>`,
    ].join('')
    const anatomyCard = studyById.get('s-calerie-methylation-clocks')
    const pins = [['l', 15], ['r', 15], ['l', 119], ['r', 56], ['l', 229], ['l', 267], ['l', 385], ['r', 385], ['r', 165]]
    const legend = [
      ['编号', '按章节、证据等级排序的固定编号，图鉴册里的位置不会变。'],
      ['章节', '8 章之一，章名前是本章的徽记。'],
      ['版画', '本章母题（这里是「身体的钟」的表盘），由卡号生成，每张都不一样。'],
      ['金章', '只有人体随机试验卡有这枚 RCT 印章。'],
      ['标题', '12 个字以内，说这项研究是什么。'],
      ['一句话', '30 个字以内，说研究看到了什么；不说「你」会怎样。'],
      ['证据梯', '四格：细胞 → 动物 → 人群 → 人体试验。亮到第几格就是哪一级；边框材质同色。'],
      ['物种与年份', '研究对象和发表年份。动物和细胞卡先说物种。'],
      ['印章', '翻到背面读完盖「读过」，用自己的记录算过盖「算过」。'],
    ]
    const anatomy = `<div class="anatomy"><div class="anatomy-card">${studyCard(anatomyCard, { size: 'lg', read: true })}${pins.map(([side, y], i) => `<span class="pin ${side}" style="${side === 'l' ? 'left:-36px' : 'left:316px'};top:${y}px">${i + 1}</span>`).join('')}</div>
      <ol class="legend">${legend.map(([k, v], i) => `<li><span class="k">${i + 1}</span><span><b>${k}</b>　${v}</span></li>`).join('')}</ol></div>`
    const back = `<div class="strip"><figure>${studyCard(anatomyCard, { size: 'lg', flipped: true })}<figcaption>背面：这项研究做了什么、拿你的记录能做什么、这一级证据的边界、出处</figcaption></figure>
      <figure>${studyCard(studyById.get(SHOWCASE.animal), { size: 'lg', offer: true })}<figcaption>动物实验卡的提示永远是「研究证据，不用你的数据」</figcaption></figure>
      <figure>${studyCard(studyById.get(SHOWCASE.human), { size: 'lg', offer: true, read: true, ran: true })}<figcaption>人群研究卡：读过、算过两枚印章</figcaption></figure></div>`
    const sample = studyById.get('s-sleep-chart-biological-ageing')
    const states = `<div class="strip">
      <figure>${studyCard(sample, { locked: true })}<figcaption>未收录：只露证据等级和章节，标题不剧透</figcaption></figure>
      <figure>${studyCard(sample, { isNew: true })}<figcaption>刚拆到：左上角「新」，读过后消失</figcaption></figure>
      <figure>${studyCard(sample, { read: true })}<figcaption>读过：翻到背面停留 3 秒，或点「读完了」</figcaption></figure>
      <figure>${studyCard(sample, { read: true, ran: true })}<figcaption>算过：用自己的记录跑过这张卡的方法</figcaption></figure>
      <figure>${speciesCard(speciesByKey.get('naked_mole_rat'), { locked: true })}<figcaption>未遇见的物种：只给剪影</figcaption></figure></div>`
    const motifs = `<div class="grid">${P.chapters.map((chapter) => {
      const card = P.studies.find((c) => c.chapter === chapter.id && c.tier !== 'trial') || P.studies.find((c) => c.chapter === chapter.id)
      return `<figure style="margin:0;display:grid;gap:8px;justify-items:center">${studyCard(card, { clickable: true })}<figcaption class="caption" style="text-align:center">第 ${chapter.no} 章 · ${esc(chapter.title_zh)} · ${chapter.size} 张<br>母题：${({ clock: '表盘与刻度', organ: '器官等高线与蛋白丝带', brain: '神经元与轴突', immune: '免疫细胞与抗体', repair: '线粒体与自噬泡', tissue: '纤维与横纹', gene: '双螺旋与染色体', span: '生存曲线与昼夜波' })[chapter.motif]}</figcaption></figure>`
    }).join('')}</div>`
    const variety = (() => {
      const cards = P.studies.filter((c) => c.chapter === 'brain').slice(0, 6)
      return `<div class="strip">${cards.map((c) => `<figure>${studyCard(c, { size: 'xs', clickable: true })}</figure>`).join('')}</div>`
    })()
    const speciesRow = `<div class="grid">${P.species.map((sp) => speciesCard(sp, { clickable: true })).join('')}</div>`
    const bags = `<div class="strip">${['daily', 'care', 'pick'].map((kind) => `<figure class="cx-bag" data-kind="${kind}">${A.bag(kind)}<span class="cx-bag-name">${R.RULES.bags[kind].label_zh}</span><span class="cx-bag-rule">${R.RULES.bags[kind].from_zh}<br>${R.RULES.bags[kind].pool_zh}</span></figure>`).join('')}</div>`
    const materials = `<table class="table"><thead><tr><th>等级</th><th>边框</th><th>纸色</th><th>墨色</th><th>强调</th><th>意思</th></tr></thead><tbody>${TIERS.map((tier) => {
      const probe = document.createElement('div')
      probe.className = 'cx-card'
      probe.dataset.tier = tier
      probe.style.position = 'absolute'
      document.body.appendChild(probe)
      const cs = getComputedStyle(probe)
      const row = `<tr><td>${P.tiers[tier].metal_zh}</td><td><div class="swatch" style="background:${cs.getPropertyValue('--cx-frame')}"></div></td><td><div class="swatch" style="background:${cs.getPropertyValue('--cx-paper')}"></div></td><td><div class="swatch" style="background:${cs.getPropertyValue('--cx-ink')}"></div></td><td><div class="swatch" style="background:${cs.getPropertyValue('--cx-accent')}"></div></td><td>${P.tiers[tier].label_zh}。${esc(P.tiers[tier].caveat_zh.replace('{species}', '动物'))}</td></tr>`
      probe.remove()
      return row
    }).join('')}</tbody></table>`
    const motion = `<div class="row">${TIERS.map((tier) => `<button class="btn outline" data-demo="${tier}">拆一袋：${P.tiers[tier].metal_zh}卡</button>`).join('')}<button class="btn outline" data-demo="pick">目标袋：三选一</button><button class="btn outline" data-demo="species">遇见物种</button></div>`
    return `
      <section class="section"><h2 class="h2">四种证据，四种材质</h2><p class="lead">研究卡的颜色只表示研究证据的类型：细胞实验是铜、动物实验是银、人群研究是紫、人体随机试验是金。金卡最少，是因为方法库里的人体随机试验本来就只有 ${P.studies.filter((c) => c.tier === 'trial').length} 项。颜色不表示你的身体好坏。点任意一张卡可以翻面。</p><div class="strip">${hero}</div></section>
      <section class="section"><h2 class="h2">另外三种卡：都不靠运气</h2><p class="lead">只有研究卡来自抽卡。物种、工具、足迹三种卡都是做到了就收录，没有概率。</p><div class="strip">${families}</div></section>
      <section class="section"><h2 class="h2">卡面结构</h2>${anatomy}</section>
      <section class="section"><h2 class="h2">背面</h2>${back}</section>
      <section class="section"><h2 class="h2">卡的状态</h2>${states}</section>
      <section class="section"><h2 class="h2">八章，八种版画母题</h2><p class="lead">同一章的卡共用一种母题，具体图案由卡号生成。不需要为 ${P.studies.length} 张卡逐张画图，方法库新增一项研究，卡面自动生成。</p>${motifs}<h3 class="h3" style="margin-top:24px">同一章（大脑与心理）里的前六张</h3>${variety}</section>
      <section class="section"><h2 class="h2">物种志</h2><p class="lead">九种动物都来自方法库里真实用到它们的研究。卡底是一条从一周到三百年的对数寿命尺，虚线是人。</p>${speciesRow}</section>
      <section class="section"><h2 class="h2">三种标本袋</h2><p class="lead">做什么事，拿什么袋。袋子不过期，每天最多拆 ${R.RULES.dailyCap} 袋。</p>${bags}</section>
      <section class="section"><h2 class="h2">材质色板</h2><p class="lead">右上角切换深色模式，纸色和墨色一起换；边框材质两种模式相同。</p>${materials}</section>
      <section class="section"><h2 class="h2">拆袋动效</h2><p class="lead">总时长不超过 1.2 秒：封口翻开 0.38 秒，卡片升起 0.55 秒；金卡多一道箔光。不预告稀有度，也没有「差一点就是金卡」的动画。系统开启「减少动态效果」时只淡入。</p>${motion}</section>`
  }

  // ---- tab: all cards ---------------------------------------------------------

  const gallery = { family: 'study', chapter: 'all', tier: 'all' }

  function galleryPage() {
    const fam = [['study', '研究', P.studies.length], ['species', '物种', P.species.length], ['tool', '工具', P.tools.length], ['milestone', '足迹', P.milestones.length]]
    const filters = [`<div class="seg">${fam.map(([k, label, n]) => `<button data-gf="${k}" aria-pressed="${gallery.family === k}">${label}<span class="n">${n}</span></button>`).join('')}</div>`]
    let cards = []
    if (gallery.family === 'study') {
      const pool = P.studies.filter((c) => (gallery.chapter === 'all' || c.chapter === gallery.chapter))
      filters.push(`<div class="seg"><button data-gc="all" aria-pressed="${gallery.chapter === 'all'}">全部章节</button>${P.chapters.map((ch) => `<button data-gc="${ch.id}" aria-pressed="${gallery.chapter === ch.id}">${esc(ch.title_zh)}<span class="n">${ch.size}</span></button>`).join('')}</div>`)
      filters.push(`<div class="seg"><button data-gt="all" aria-pressed="${gallery.tier === 'all'}">全部证据</button>${TIERS.map((t) => `<button data-gt="${t}" aria-pressed="${gallery.tier === t}">${P.tiers[t].metal_zh} · ${P.tiers[t].label_zh}<span class="n">${pool.filter((c) => c.tier === t).length}</span></button>`).join('')}</div>`)
      cards = pool.filter((c) => gallery.tier === 'all' || c.tier === gallery.tier).map((c) => studyCard(c, { clickable: true }))
    } else if (gallery.family === 'species') cards = P.species.map((s) => speciesCard(s, { clickable: true }))
    else if (gallery.family === 'tool') cards = P.tools.map((t) => toolCard(t, { clickable: true }))
    else cards = P.milestones.map((m, i) => milestoneCard(m, { clickable: true, date: `${9 + Math.floor(i / 4)}·${String(3 + i * 3).padStart(2, '0')}` }))
    return `<div class="section"><div style="display:grid;gap:8px;margin-bottom:20px">${filters.join('')}</div><p class="caption" style="margin-bottom:16px">共 ${cards.length} 张。点卡片看大图和背面。</p><div class="grid">${cards.join('')}</div></div>`
  }

  // ---- detail modal -------------------------------------------------------------

  function openDetail(id, ctx) {
    const flipped = { on: false }
    const draw = () => {
      let info = ''
      if (id.startsWith('s-')) {
        const c = studyById.get(id)
        const ch = chapterById.get(c.chapter)
        const offer = offerOf(c)
        info = `<h3 class="h3">${esc(c.headline_zh)}</h3><p class="muted small" style="margin-bottom:16px">${esc(c.hook_zh)}</p>
          <dl class="kv"><dt>章节</dt><dd>第 ${ch.no} 章 · ${esc(ch.title_zh)}</dd><dt>证据</dt><dd>${P.tiers[c.tier].metal_zh} · ${P.tiers[c.tier].label_zh}</dd><dt>研究对象</dt><dd>${esc(c.species_zh)}</dd>
          <dt>论文</dt><dd>${esc(c.source.title || '—')}</dd><dt>期刊</dt><dd>${esc(c.source.journal || '—')} ${c.source.year || ''}${c.source.authors ? ` · ${esc(c.source.authors)}` : ''}</dd>
          ${c.source.doi ? `<dt>DOI</dt><dd><a href="https://doi.org/${esc(c.source.doi)}" target="_blank" rel="noreferrer">${esc(c.source.doi)}</a></dd>` : ''}<dt>方法库</dt><dd style="font-family:var(--mono);font-size:12px">${esc(c.source.skill)}</dd>
          ${c.meet.length ? `<dt>遇见</dt><dd>${c.meet.map((k) => esc(speciesByKey.get(k).name_zh)).join('、')}</dd>` : ''}</dl>
          <div class="callout" style="margin-top:16px"><b>示意</b>　${esc(offer.text)}。真实结果由这张卡对应的方法和此人的记录决定。</div>`
      } else if (id.startsWith('sp-')) {
        const s = P.species.find((row) => row.id === id)
        info = `<h3 class="h3">${esc(s.name_zh)} <span class="caption" style="font-style:italic">${esc(s.latin)}</span></h3><p class="muted small" style="margin-bottom:16px">${esc(s.body_zh)}</p><dl class="kv"><dt>寿命</dt><dd>${esc(s.lifespan_zh)}</dd><dt>遇见方式</dt><dd>收录下列任意一张研究卡</dd></dl><ul class="small" style="margin:12px 0 0;padding-left:18px">${s.studies.map((sid) => `<li>${esc(studyById.get(sid).headline_zh)}（${P.tiers[studyById.get(sid).tier].metal_zh}）</li>`).join('')}</ul>`
      } else if (id.startsWith('t-')) {
        const t = P.tools.find((row) => row.id === id)
        info = `<h3 class="h3">${esc(t.headline_zh)}</h3><p class="muted small">${esc(t.blurb_zh)}</p><div class="callout" style="margin-top:16px">工具卡不进抽卡池。LongPi 在对话或深度分析里第一次真的调用这个工具时收录。</div>`
      } else {
        const m = P.milestones.find((row) => row.id === id)
        info = `<h3 class="h3">${esc(m.title_zh)}</h3><p class="muted small">${esc(m.hook_zh)}</p><div class="callout" style="margin-top:16px">${esc(m.caveat_zh)}</div>`
      }
      const opts = { size: 'lg', flipped: flipped.on, read: ctx && ctx.read, ran: ctx && ctx.ran, owned: ctx && ctx.owned, date: ctx && ctx.date }
      $('#modal').innerHTML = `<div class="modal" data-close><div class="modal-box"><button class="btn outline sm x" data-close>关闭</button><div style="display:grid;gap:12px;justify-items:center">${anyCard(id, opts)}<button class="btn outline" data-flip>${flipped.on ? '看正面' : '翻到背面'}</button></div><div>${info}</div></div></div>`
    }
    draw()
    $('#modal').onclick = (event) => {
      if (event.target.closest('[data-flip]') || event.target.closest('.modal-box .cx-card')) { flipped.on = !flipped.on; draw(); return }
      if (event.target.hasAttribute('data-close')) $('#modal').innerHTML = ''
    }
  }

  // ---- reveal overlay -------------------------------------------------------------

  function reveal({ bagKind, card, pick, met, chapterDone, onKeep, onChoose, caption }) {
    const ov = $('#overlay')
    const bagHtml = `<div class="cx-bag ov-bag" data-kind="${bagKind}">${A.bag(bagKind)}<span class="cx-bag-name">${R.RULES.bags[bagKind].label_zh}</span><span class="cx-bag-rule">${R.RULES.bags[bagKind].pool_zh}</span></div>`
    ov.innerHTML = `<div class="ov"><div class="ov-stage">${bagHtml}<p class="ov-caption">点袋子拆开</p></div></div>`
    const stage = $('.ov-stage', ov)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    $('.ov-bag', ov).onclick = () => {
      $('.ov-bag', ov).classList.add('is-open')
      setTimeout(() => {
        if (pick) {
          let chosen = null
          const paint = () => {
            stage.innerHTML = `<p class="ov-caption"><b>目标袋</b>　三张里选一张留下，另外两张放回去，以后还能抽到。</p>
              <div class="pick-row">${pick.map((c) => `<div data-pick="${c.id}">${studyCard(c, { size: '', revealed: true, isNew: true })}</div>`).join('')}</div>
              <div class="ov-actions"><button class="btn outline" data-close>先不选，袋子留着</button></div>`
          }
          paint()
          stage.onclick = (event) => {
            const el = event.target.closest('[data-pick]')
            if (event.target.closest('[data-close]')) { ov.innerHTML = ''; return }
            if (!el || chosen) return
            chosen = el.dataset.pick
            stage.querySelectorAll('[data-pick]').forEach((node) => { if (node.dataset.pick !== chosen) node.querySelector('.cx-card').classList.add('is-dim') })
            setTimeout(() => {
              const out = onChoose(chosen)
              reveal({ bagKind: 'pick', card: studyById.get(chosen), met: out.met, chapterDone: out.chapterDone, onKeep, skipBag: true, caption })
            }, reduce ? 0 : 450)
          }
          return
        }
        showCard()
      }, reduce ? 0 : 380)
    }
    function showCard() {
      const tier = P.tiers[card.tier]
      const banners = []
      for (const key of met || []) {
        const sp = speciesByKey.get(key)
        banners.push(`<div class="ov-banner">${speciesCard(sp, { size: 'xs' })}<span><b>遇见新物种：${esc(sp.name_zh)}</b><br>${esc(sp.hook_zh)}。已放进物种志。</span></div>`)
      }
      if (chapterDone) {
        const ch = chapterById.get(chapterDone)
        banners.push(`<div class="ov-banner">${A.emblem(ch.motif, 28)}<span><b>集齐第 ${ch.no} 章「${esc(ch.title_zh)}」</b><br>多了 1 次连续记录冻结，章节导读已解锁：${esc(ch.intro_zh)}</span></div>`)
      }
      const line = card.tier === 'trial'
        ? `<b>金卡 · 人体随机试验</b>　全库只有 ${P.studies.filter((c) => c.tier === 'trial').length} 张。`
        : `<b>${tier.metal_zh} · ${tier.label_zh}</b>　${esc(chapterById.get(card.chapter).title_zh)}`
      stage.innerHTML = `<div class="ov-card">${studyCard(card, { size: 'lg', revealed: true, isNew: true })}</div><p class="ov-caption">${line}${caption ? `<br>${caption}` : ''}</p>${banners.join('')}
        <div class="ov-actions"><button class="btn outline" data-flip>翻到背面</button><button class="btn" data-keep>收进图鉴</button></div>`
      stage.onclick = (event) => {
        if (event.target.closest('[data-flip]')) { stage.querySelector('.cx-card').classList.toggle('is-flipped'); return }
        if (event.target.closest('[data-keep]')) { ov.innerHTML = ''; if (onKeep) onKeep() }
      }
    }
    if (arguments[0].skipBag) showCard()
  }

  function demo(kind) {
    const pickFrom = (tier) => P.studies.filter((c) => c.tier === tier)[Math.floor(Math.random() * P.studies.filter((c) => c.tier === tier).length)]
    if (kind === 'pick') {
      const options = [pickFrom('human'), pickFrom('animal'), pickFrom('trial')]
      reveal({ bagKind: 'pick', pick: options, onChoose: () => ({ met: [], chapterDone: null }) })
    } else if (kind === 'species') reveal({ bagKind: 'daily', card: studyById.get('s-bowhead-whale-dna-repair'), met: ['bowhead_whale'] })
    else reveal({ bagKind: kind === 'trial' ? 'care' : 'daily', card: pickFrom(kind) })
  }

  // ---- tab: play -------------------------------------------------------------------

  const play = { state: null, isNew: new Set(), view: 'collecting', note: '' }

  function newGame() {
    play.state = R.createState(P, 20261003, 'clock')
    play.isNew = new Set()
    play.state.read = new Set()
    play.state.ran = new Set()
    R.earn(play.state, 'pick', '赛季开始')
    play.note = '赛季开始：送你一个目标袋。先选一章来集，日常袋都从这一章里抽。'
  }

  function dateOf(day) {
    const d = new Date(2026, 9, 3 + day)
    return `${d.getMonth() + 1}·${String(d.getDate()).padStart(2, '0')}`
  }

  function playPage() {
    const s = play.state
    const week = Math.floor(s.day / 7) + 1
    const bagsHtml = s.bags.length
      ? s.bags.map((bag, i) => `<button class="mini" data-open="${i}" ${s.drawsToday >= R.RULES.dailyCap ? 'disabled' : ''}><div class="cx-bag" data-kind="${bag.kind}">${A.bag(bag.kind)}</div>${R.RULES.bags[bag.kind].label_zh}</button>`).join('')
      : '<p class="caption">没有待拆的袋子。做一件健康行动就会有。</p>'
    const oddsFor = (kind) => {
      const odds = R.odds(s, P, { kind })
      if (odds.total === 0) return `<p class="caption">${R.RULES.bags[kind].label_zh}：图鉴已集齐</p>`
      return `<div style="display:grid;gap:4px"><div class="small"><b>${R.RULES.bags[kind].label_zh}</b> <span class="caption">${odds.fallback ? '本范围已集齐，改从全部未收录卡里抽 · ' : ''}${odds.total} 张可抽 · 金 ${(odds.pTrial * 100).toFixed(1)}%${kind === 'pick' ? '（三张里至少一张）' : ''}</span></div>
        ${TIERS.map((t) => `<div class="odds-line" style="--odds:${TIER_ODDS_COLOR[t]}"><span>${P.tiers[t].metal_zh} ${P.tiers[t].label_zh.slice(0, 2)}</span><div class="bar"><span style="width:${odds.total ? (odds.byTier[t] / odds.total) * 100 : 0}%"></span></div><span class="caption" style="text-align:right">${odds.byTier[t]}/${odds.total}</span></div>`).join('')}</div>`
    }
    const side = `<div class="play-side">
      <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:12px"><b>第 ${s.day + 1} 天 · 第 ${week} 周</b><span class="caption">今天拆了 ${s.drawsToday}/${R.RULES.dailyCap}</span></div>
        <div class="actions-grid">
          <button class="btn outline" data-act="record" ${s.recordedToday ? 'disabled' : ''}>记一条记录</button>
          <button class="btn outline" data-act="quest">完成小目标</button>
          <button class="btn outline" data-act="care">带简报就诊</button>
          <button class="btn outline" data-act="addon">补一项检查</button>
          <button class="btn outline" data-act="retest">按时复测</button>
          <button class="btn outline" data-act="tool">LongPi 用了工具</button>
          <button class="btn" data-act="day">过一天</button>
          <button class="btn" data-act="week">快进一周</button>
        </div>
        <button class="btn outline" data-act="auto" style="width:100%;margin-top:8px">自动玩 4 周（自动拆袋）</button>
        <p class="caption" style="margin-top:8px">本周日常袋 ${s.dailyBagsThisWeek}/${R.RULES.dailyBagsPerWeek}。「快进一周」按每周记录 4 天来模拟，袋子留给你拆。</p></div>
      <div class="panel"><b class="small">待拆的袋子（${s.bags.length}）</b><div class="shelf" style="margin-top:8px">${bagsHtml}</div></div>
      <div class="panel" style="display:grid;gap:12px"><b class="small">下一袋能抽到什么</b>${oddsFor('daily')}${oddsFor('care')}${oddsFor('pick')}<p class="caption">每袋都从你还没有的卡里等概率抽，不会重复。概率随你的收藏实时变化。</p></div>
      <div class="panel"><b class="small">记录</b><ul class="log" style="margin-top:8px">${s.log.slice(-30).reverse().map((row) => `<li>${dateOf(row.day)}　${R.RULES.bags[row.bag].label_zh} → ${P.tiers[row.tier].metal_zh}「${esc(studyById.get(row.card).headline_zh)}」</li>`).join('') || '<li>还没有拆过袋子</li>'}</ul></div>
      <button class="textbtn" data-act="reset">重新开始</button>
    </div>`
    const chapters = `<div class="chapters">${P.chapters.map((ch) => {
      const p = R.chapterProgress(s, P, ch.id)
      const golds = P.studies.filter((c) => c.chapter === ch.id && c.tier === 'trial').length
      return `<button class="chapter-btn" data-ch="${ch.id}" aria-pressed="${play.view === ch.id}"><span class="t">${A.emblem(ch.motif, 14)}${esc(ch.title_zh)}${s.collecting === ch.id ? '<span class="tag">正在收集</span>' : ''}</span><div class="bar"><span style="width:${(p.have / p.size) * 100}%"></span></div><span class="c"><span>${p.have}/${p.size}${s.chaptersDone.has(ch.id) ? ' · 集齐' : ''}</span><span>${golds ? `金 ${golds}` : ''}</span></span></button>`
    }).join('')}</div>`
    let body = ''
    const viewId = play.view === 'collecting' ? s.collecting : play.view
    if (chapterById.has(viewId)) {
      const ch = chapterById.get(viewId)
      const cards = P.studies.filter((c) => c.chapter === ch.id)
      body = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><div><h3 class="h3" style="margin:0">第 ${ch.no} 章 · ${esc(ch.title_zh)}</h3><p class="caption">${esc(ch.intro_zh)}</p></div>${s.collecting === ch.id ? '<span class="caption">日常袋从这一章里抽</span>' : `<button class="btn outline" data-collect="${ch.id}">改为收集这一章</button>`}</div>
        <div class="grid xs">${cards.map((c) => s.ownedSet.has(c.id) ? studyCard(c, { size: 'xs', clickable: true, isNew: play.isNew.has(c.id), read: s.read.has(c.id), ran: s.ran.has(c.id) }) : studyCard(c, { size: 'xs', locked: true })).join('')}</div>`
    } else if (play.view === 'species') {
      body = `<h3 class="h3">物种志 ${s.species.size}/${P.species.length}</h3><div class="grid">${P.species.map((sp) => speciesCard(sp, { clickable: s.species.has(sp.key), locked: !s.species.has(sp.key), owned: s.ownedSet })).join('')}</div>`
    } else if (play.view === 'tools') {
      body = `<h3 class="h3">工具 ${s.tools.size}/${P.tools.length}</h3><div class="grid xs">${P.tools.map((t) => toolCard(t, { size: 'xs', clickable: s.tools.has(t.id), locked: !s.tools.has(t.id) })).join('')}</div>`
    } else {
      body = `<h3 class="h3">足迹 ${s.milestones.size}/${P.milestones.length}</h3><div class="grid xs">${P.milestones.map((m) => milestoneCard(m, { size: 'xs', clickable: s.milestones.has(m.id), locked: !s.milestones.has(m.id), date: s.milestones.has(m.id) ? dateOf(s.milestones.get(m.id)) : '' })).join('')}</div>`
    }
    const main = `<div>
      <div class="panel"><div class="stat"><div><b>${s.owned.length}<span class="caption">/${P.studies.length}</span></b><span>研究卡</span></div><div><b>${s.read.size}</b><span>读过</span></div><div><b>${s.ran.size}</b><span>算过</span></div><div><b>${s.chaptersDone.size}<span class="caption">/8</span></b><span>集齐的章</span></div><div><b>${s.species.size}</b><span>物种</span></div><div><b>${s.tools.size}</b><span>工具</span></div><div><b>${s.milestones.size}</b><span>足迹</span></div><div><b>${s.freezes}</b><span>冻结次数</span></div></div>
      ${play.note ? `<p class="callout" style="margin-top:12px">${esc(play.note)}</p>` : ''}</div>
      ${chapters}
      <div class="seg" style="margin-bottom:16px">${[['collecting', '正在收集'], ['species', `物种 ${s.species.size}`], ['tools', `工具 ${s.tools.size}`], ['milestones', `足迹 ${s.milestones.size}`]].map(([k, label]) => `<button data-view="${k}" aria-pressed="${play.view === k}">${label}</button>`).join('')}</div>
      ${body}</div>`
    return `<div class="play">${side}${main}</div>`
  }

  function playAct(act) {
    const s = play.state
    play.note = ''
    const mile = (id, text) => { if (R.milestone(s, id)) play.note = `${play.note}收录足迹卡「${P.milestones.find((m) => m.id === id).title_zh}」。${text || ''}` }
    if (act === 'record') {
      const bag = R.record(s)
      play.note = bag ? '今天有记录，得到一个日常袋。' : '今天有记录。本周的日常袋已满 3 个，不用天天打开。'
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
      while (s.day < start + 7) {
        if (s.roll() < 4 / 7) R.record(s)
        R.nextDay(s)
      }
      if (s.recordDays >= 28) mile('f-four-weeks')
      play.note = `快进了一周，现在有 ${s.bags.length} 个待拆的袋子。`
    } else if (act === 'reset') newGame()
    else if (act === 'auto') autoplay(4)
    render()
  }

  /** Four record days a week, a quest every other week, a care action every four; every bag opened. */
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
    for (const id of s.owned.slice(0, 3)) if (offerOf(studyById.get(id)).kind === 'run') { s.ran.add(id); R.milestone(s, 'f-ran-method') }
    if (s.tools.size === 0) s.tools.add(P.tools.find((t) => t.skill === 'pyaging').id)
    play.note = `自动玩了 ${weeks} 周：每周记录约 4 天，隔周完成一个小目标，每四周就诊一次。新收录 ${s.owned.length - before} 张，其中六成已读过。`
  }

  function openBag(index) {
    const s = play.state
    const bag = s.bags[index]
    const out = R.draw(s, P, index)
    if (!out.ok) {
      play.note = out.reason === 'daily_cap' ? `今天已经拆了 ${R.RULES.dailyCap} 袋，剩下的明天再拆，袋子不会过期。` : '图鉴已集齐。方法库新增研究时会有新卡上架。'
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
    if (out.pick) {
      reveal({ bagKind: 'pick', pick: out.options, onChoose: (id) => { const res = R.choose(s, P, index, id); after(res); return res } })
    } else {
      reveal({ bagKind: bag.kind, card: out.card, met: out.met, chapterDone: out.chapterDone, caption: out.fallback ? '这个范围已经集齐，这一袋改从全部未收录的卡里抽。' : '', onKeep: () => {} })
      after(out)
    }
  }

  // ---- tab: rules -------------------------------------------------------------------

  function simulateCurve(person, seed, weeks) {
    const behave = R.rng(seed ^ 0x9e3779b9)
    const s = R.createState(P, seed, 'organ')
    const rank = { cell: 0, animal: 1, human: 2, trial: 3 }
    const curve = []
    const open = () => {
      while (s.bags.length) {
        const out = R.draw(s, P, 0)
        if (!out.ok) return
        const res = out.pick ? R.choose(s, P, 0, (out.options.find((c) => c.tier === 'trial') || out.options.find((c) => c.chapter === s.collecting) || out.options.sort((a, b) => rank[b.tier] - rank[a.tier])[0]).id) : out
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

  /** The 0.6–0.7 Codex: 52/28/16/4 by rarity, uniform inside a rarity, duplicates allowed, one draw per active day. */
  function simulateOld(person, seed, weeks) {
    const roll = R.rng(seed)
    const sizes = { common: 13, rare: 51, epic: 103, legendary: 13 }
    const odds = [['common', 0.52], ['rare', 0.28], ['epic', 0.16], ['legendary', 0.04]]
    const owned = new Set()
    const total = 180
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
      curve.push({ cards: owned.size / total })
    }
    return curve
  }

  function median(rows, week, key) {
    const values = rows.map((row) => row[week][key]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }

  function chart() {
    const weeks = 104
    const runs = 120
    const engaged = { days: 4, quests: 5, care: 3 }
    const casual = { days: 1.5, quests: 2, care: 1 }
    const e = Array.from({ length: runs }, (_, i) => simulateCurve(engaged, i + 1, weeks))
    const c = Array.from({ length: runs }, (_, i) => simulateCurve(casual, i + 1, weeks))
    const o = Array.from({ length: runs }, (_, i) => simulateOld(engaged, i + 1, weeks))
    const W = 640
    const H = 220
    const x = (w) => 40 + (w / weeks) * (W - 60)
    const y = (v) => 190 - v * 170
    const line = (rows, key, cls) => `<path d="M${rows[0].map((_, w) => `${x(w + 1).toFixed(1)},${y(median(rows, w, key)).toFixed(1)}`).join('L')}" fill="none" ${cls}/>`
    let axes = `<path d="M40,20V190H${W - 20}" fill="none" stroke="var(--line-strong)"/>`
    for (const v of [0.25, 0.5, 0.75, 1]) axes += `<line x1="40" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="34" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`
    for (const w of [12, 24, 36, 52, 78, 104]) axes += `<text x="${x(w)}" y="206" text-anchor="middle">${w}周</text>`
    const chMarks = (rows, color) => {
      let out = ''
      for (let n = 1; n <= 8; n += 1) {
        const weeksDone = rows.map((row) => { const i = row.findIndex((p) => p.chapters >= n); return i < 0 ? null : i + 1 }).filter((v) => v != null).sort((a, b) => a - b)
        if (weeksDone.length < rows.length / 2) continue
        const wk = weeksDone[Math.floor(weeksDone.length / 2)]
        out += `<circle cx="${x(wk)}" cy="${y(median(rows, wk - 1, 'cards'))}" r="3.5" fill="${color}"/>`
      }
      return out
    }
    const e52 = Math.round(median(e, 51, 'cards') * 100)
    const c52 = Math.round(median(c, 51, 'cards') * 100)
    const o52 = Math.round(median(o, 51, 'cards') * 100)
    return `<svg class="chart" viewBox="0 0 ${W} ${H + 10}">${axes}
      ${line(o, 'cards', 'stroke="var(--ink-4)" stroke-width="2" stroke-dasharray="4 4"')}
      ${line(c, 'cards', 'stroke="var(--ink-2)" stroke-width="2"')}
      ${line(e, 'cards', 'stroke="var(--accent)" stroke-width="2.5"')}
      ${chMarks(e, 'var(--accent)')}${chMarks(c, 'var(--ink-2)')}
    </svg>
    <div class="row caption"><span>━ 新规则 · 积极（每周记录 4 天）一年收集 ${e52}%</span><span>━ 新规则 · 普通（每周 1.5 天）一年 ${c52}%</span><span>┄ 旧规则 · 积极 一年 ${o52}%（不重复的卡）</span><span>● 集齐一章</span></div>`
  }

  function rulesPage() {
    const bagRows = ['daily', 'care', 'pick'].map((k) => `<tr><td><div class="cx-bag" data-kind="${k}" style="width:72px">${A.bag(k)}</div></td><td><b>${R.RULES.bags[k].label_zh}</b></td><td>${R.RULES.bags[k].from_zh}</td><td>${R.RULES.bags[k].pool_zh}</td></tr>`).join('')
    const tierTable = `<table class="table"><thead><tr><th>章</th>${TIERS.map((t) => `<th class="num">${P.tiers[t].metal_zh} ${P.tiers[t].label_zh}</th>`).join('')}<th class="num">合计</th><th>母题</th></tr></thead><tbody>${P.chapters.map((ch) => `<tr><td>${A.emblem(ch.motif, 14)} ${esc(ch.title_zh)}</td>${TIERS.map((t) => `<td class="num">${P.studies.filter((c) => c.chapter === ch.id && c.tier === t).length || '—'}</td>`).join('')}<td class="num">${ch.size}</td><td class="caption">${esc(ch.domains.join('、'))}</td></tr>`).join('')}
      <tr><td><b>全部</b></td>${TIERS.map((t) => `<td class="num"><b>${P.studies.filter((c) => c.tier === t).length}</b></td>`).join('')}<td class="num"><b>${P.studies.length}</b></td><td></td></tr></tbody></table>`
    const odds = `每一袋都从你<b>还没有</b>的研究卡里等概率抽一张，所以不会抽到重复卡；${P.studies.length} 张卡最多 ${P.studies.length} 袋一定集齐。日常袋只看你正在收集的那一章；就诊袋只看人群研究和人体试验；目标袋翻开三张让你选。抽卡页随时显示「下一袋能抽到什么」：例如刚开始时，日常袋收集「身体的钟」抽到金卡的机会是 3/26（11.5%），就诊袋是 4/104（3.8%）。`
    return `
      <section class="section"><h2 class="h2">一句话玩法</h2><p class="lead" style="font-size:15px;line-height:24px;color:var(--ink)">做一件对健康有用的事，拿一个标本袋；拆开收下一张研究卡，翻过来读懂它，能算就用自己的记录算一下；一章一章把图鉴集齐。</p></section>
      <section class="section"><h2 class="h2">三种袋子</h2><table class="table"><thead><tr><th></th><th>袋子</th><th>怎么得到</th><th>能抽到什么</th></tr></thead><tbody>${bagRows}</tbody></table>
        <p class="caption" style="margin-top:8px">每天最多拆 ${R.RULES.dailyCap} 袋；袋子不过期；日常袋每周最多 ${R.RULES.dailyBagsPerWeek} 个，天天打开不会多拿。</p></section>
      <section class="section"><h2 class="h2">概率</h2><p class="lead">${odds}</p>${tierTable}</section>
      <section class="section"><h2 class="h2">两年里的收集曲线（${120} 次模拟的中位数）</h2><p class="lead">旧规则按稀有度定概率、允许重复：积极用户一年后一半以上的抽取是重复卡，紫卡要约 3,400 次才能集齐。新规则下积极用户约每 5 周集齐一章、一年内集齐全部；普通用户约每个赛季集齐一章。</p><div class="panel">${chart()}</div></section>
      <section class="section"><h2 class="h2">不做的事</h2><ul class="small" style="padding-left:18px;display:grid;gap:6px">
        <li>不卖袋子，不卖卡，不能交易或赠送；没有任何货币。</li>
        <li>卡的颜色只表示证据类型；抽到什么与化验结果、指标好坏无关。</li>
        <li>不预告稀有度，没有「差一点就是金卡」的动画，没有限时卡池和倒计时。</li>
        <li>袋子不过期，连续记录中断不会收走任何卡。</li>
        <li>未满 18 岁或年龄未填时图鉴关闭；关掉图鉴后 LongPi 不再提抽卡。</li>
        <li>没有十连抽。每天最多拆 ${R.RULES.dailyCap} 袋。</li></ul></section>`
  }

  // ---- shell -----------------------------------------------------------------------

  const TABS = [['spec', '卡面设计'], ['gallery', `全部卡片 · ${P.studies.length + P.species.length + P.tools.length + P.milestones.length}`], ['play', '试玩一个赛季'], ['rules', '玩法与概率']]
  let tab = (location.hash || '#spec').slice(1)
  if (!TABS.some(([k]) => k === tab)) tab = 'spec'

  function render() {
    $('#theme').textContent = document.documentElement.dataset.theme === 'dark' ? '切换浅色' : '切换深色'
    $('#tabs').innerHTML = TABS.map(([k, label]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${label}</button>`).join('')
    const page = tab === 'spec' ? specPage() : tab === 'gallery' ? galleryPage() : tab === 'play' ? playPage() : rulesPage()
    $('#page').innerHTML = page
  }

  document.addEventListener('click', (event) => {
    const t = event.target
    const tabBtn = t.closest('[data-tab]')
    if (tabBtn) { tab = tabBtn.dataset.tab; location.hash = tab; render(); window.scrollTo(0, 0); return }
    if (t.closest('#theme')) { const root = document.documentElement; root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; render(); return }
    const gf = t.closest('[data-gf]'); if (gf) { gallery.family = gf.dataset.gf; gallery.chapter = 'all'; gallery.tier = 'all'; render(); return }
    const gc = t.closest('[data-gc]'); if (gc) { gallery.chapter = gc.dataset.gc; render(); return }
    const gt = t.closest('[data-gt]'); if (gt) { gallery.tier = gt.dataset.gt; render(); return }
    const dm = t.closest('[data-demo]'); if (dm) { demo(dm.dataset.demo); return }
    const act = t.closest('[data-act]'); if (act) { playAct(act.dataset.act); return }
    const ob = t.closest('[data-open]'); if (ob) { openBag(Number(ob.dataset.open)); return }
    const ch = t.closest('[data-ch]'); if (ch) { play.view = ch.dataset.ch; render(); return }
    const cl = t.closest('[data-collect]'); if (cl) { play.state.collecting = cl.dataset.collect; play.note = `改为收集「${chapterById.get(cl.dataset.collect).title_zh}」。日常袋从这一章里抽。`; render(); return }
    const vw = t.closest('[data-view]'); if (vw) { play.view = vw.dataset.view; render(); return }
    if (t.closest('#page') && !t.closest('#overlay')) {
      const card = t.closest('.cx-card.is-clickable')
      if (card) {
        const id = card.dataset.id
        if (tab === 'play' && id.startsWith('s-')) {
          play.isNew.delete(id)
          play.state.read.add(id)
          openDetail(id, { read: true, ran: play.state.ran.has(id) })
          render()
          return
        }
        if (tab === 'spec' && !card.closest('.anatomy-card')) { card.classList.toggle('is-flipped'); return }
        openDetail(id, { owned: play.state ? play.state.ownedSet : new Set(), date: tab === 'play' && play.state.milestones.has(id) ? dateOf(play.state.milestones.get(id)) : '10·03' })
      }
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { $('#modal').innerHTML = ''; $('#overlay').innerHTML = '' }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('is-clickable')) { event.preventDefault(); event.target.click() }
  })

  newGame()
  const params = new URLSearchParams(location.search)
  if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark'
  if (params.get('auto')) autoplay(Number(params.get('auto')) || 4)
  render()
  // ?demo=trial|human|animal|cell|pick|species opens a reveal; &open=1 also opens the bag.
  if (params.get('demo')) {
    demo(params.get('demo'))
    if (params.get('open')) setTimeout(() => { const bag = $('.ov-bag'); if (bag) bag.click() }, 60)
  }
})()
