// Codex v2 art (docs/codex-v2.md §6). Everything is line art in currentColor so the tier ink
// colours it; `.a` strokes take the tier accent. Plates are generated from the card's seed,
// so one chapter shares a motif and no two cards share a plate.

(function (root) {
  const W = 240
  const H = 150

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
  const f = (n) => (Math.round(n * 10) / 10).toString()
  const between = (r, lo, hi) => lo + r() * (hi - lo)
  const poly = (points, close) => `M${points.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}${close ? 'Z' : ''}`
  const path = (d, cls, extra) => `<path d="${d}"${cls ? ` class="${cls}"` : ''}${extra || ''}/>`
  const circle = (x, y, r, cls, extra) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"${cls ? ` class="${cls}"` : ''}${extra || ''}/>`
  const line = (x1, y1, x2, y2, cls, extra) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"${cls ? ` class="${cls}"` : ''}${extra || ''}/>`
  const svg = (body, cls, vb) => `<svg class="${cls || 'cx-svg'}" viewBox="${vb || `0 0 ${W} ${H}`}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

  /** Smooth path through points (Catmull–Rom to cubic Bézier). */
  function smooth(points, close) {
    const pts = close ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]]
    let d = `M${f(pts[1][0])},${f(pts[1][1])}`
    for (let i = 1; i < pts.length - 2; i += 1) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[i + 1]
      const [x3, y3] = pts[i + 2]
      d += `C${f(x1 + (x2 - x0) / 6)},${f(y1 + (y2 - y0) / 6)} ${f(x2 - (x3 - x1) / 6)},${f(y2 - (y3 - y1) / 6)} ${f(x2)},${f(y2)}`
    }
    return close ? `${d}Z` : d
  }

  // ---- chapter motifs -------------------------------------------------------

  function clock(r) {
    const cx = between(r, 92, 148)
    const cy = between(r, 66, 84)
    const R = between(r, 50, 60)
    let out = ''
    for (const extra of [14, 26, 40]) out += circle(cx, cy, R + extra, 'f')
    out += circle(cx, cy, R, 'w')
    for (let i = 0; i < 60; i += 1) {
      const a = (i / 60) * Math.PI * 2
      const len = i % 5 === 0 ? 7 : 3
      out += line(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len), cx + Math.cos(a) * R, cy + Math.sin(a) * R, i % 15 === 0 ? 'w' : '')
    }
    const rings = 2 + Math.floor(r() * 3)
    for (let i = 0; i < rings; i += 1) out += circle(cx, cy, R * between(r, 0.28, 0.82), i === 0 ? 'd' : '')
    for (let i = 0; i < 2; i += 1) {
      const rr = R * between(r, 0.45, 0.9)
      const a0 = r() * Math.PI * 2
      const a1 = a0 + between(r, 0.6, 2.4)
      out += path(`M${f(cx + Math.cos(a0) * rr)},${f(cy + Math.sin(a0) * rr)}A${f(rr)},${f(rr)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(cx + Math.cos(a1) * rr)},${f(cy + Math.sin(a1) * rr)}`, 'a w')
    }
    const sa = r() * Math.PI * 2
    const sx = cx + Math.cos(sa) * R * 0.5
    const sy = cy + Math.sin(sa) * R * 0.5
    out += circle(sx, sy, 10, '')
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      out += line(sx + Math.cos(a) * 8, sy + Math.sin(a) * 8, sx + Math.cos(a) * 10, sy + Math.sin(a) * 10, '')
    }
    const h1 = r() * Math.PI * 2
    const h2 = r() * Math.PI * 2
    out += line(cx, cy, cx + Math.cos(h1) * R * 0.5, cy + Math.sin(h1) * R * 0.5, 'w')
    out += line(cx, cy, cx + Math.cos(h2) * R * 0.8, cy + Math.sin(h2) * R * 0.8, '')
    out += circle(cx, cy, 2.2, 'w')
    return out
  }

  function organ(r) {
    const cx = between(r, 90, 150)
    const cy = between(r, 62, 88)
    const R = between(r, 54, 66)
    const harmonics = [2, 3, 4, 5].map((k) => ({ k, a: between(r, 0.03, 0.14) / (k - 1), p: r() * Math.PI * 2 }))
    let out = ''
    const n = 8
    for (let i = 1; i <= n; i += 1) {
      const s = i / n
      const drift = (1 - s) * 10
      const pts = []
      for (let j = 0; j < 48; j += 1) {
        const t = (j / 48) * Math.PI * 2
        let rad = 1
        for (const h of harmonics) rad += h.a * Math.cos(h.k * t + h.p + s * 0.8)
        pts.push([cx + drift * 0.6 + Math.cos(t) * R * 1.35 * s * rad, cy - drift * 0.3 + Math.sin(t) * R * 0.78 * s * rad])
      }
      out += path(smooth(pts, true), i === 4 ? 'a w' : i === n ? 'w' : i < 3 ? 'd' : '')
    }
    const ribbon = []
    let x = -10
    let y = between(r, 20, 130)
    while (x < W + 10) {
      ribbon.push([x, y])
      x += between(r, 30, 50)
      y = Math.max(14, Math.min(H - 14, y + between(r, -30, 30)))
    }
    out += path(smooth(ribbon, false), 'f w')
    out += path(smooth(ribbon.map(([px, py]) => [px, py + 4]), false), 'f')
    return out
  }

  function brain(r) {
    let out = ''
    const branch = (x, y, a, len, depth, cls) => {
      const bend = between(r, -0.35, 0.35)
      const x2 = x + Math.cos(a) * len
      const y2 = y + Math.sin(a) * len
      const mx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * len * bend * 0.3
      const my = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * len * bend * 0.3
      out += path(`M${f(x)},${f(y)}Q${f(mx)},${f(my)} ${f(x2)},${f(y2)}`, depth > 2 ? `w ${cls}` : cls)
      if (depth <= 0) {
        if (r() < 0.5) out += circle(x2, y2, 1.1, cls)
        return
      }
      const spread = between(r, 0.32, 0.7)
      branch(x2, y2, a - spread, len * between(r, 0.6, 0.78), depth - 1, cls)
      branch(x2, y2, a + spread, len * between(r, 0.6, 0.78), depth - 1, cls)
      if (r() < 0.25) branch(x2, y2, a + between(r, -0.2, 0.2), len * 0.5, depth - 2, cls)
    }
    const ghostX = between(r, 30, 70)
    const ghostY = between(r, 30, 120)
    for (let i = 0; i < 4; i += 1) branch(ghostX, ghostY, (i / 4) * Math.PI * 2 + r(), 14, 2, 'f')
    const sx = between(r, 100, 150)
    const sy = between(r, 60, 92)
    const prim = 4 + Math.floor(r() * 3)
    const axon = r() * Math.PI * 2
    for (let i = 0; i < prim; i += 1) {
      const a = axon + Math.PI * 0.35 + (i / prim) * Math.PI * 1.3 + between(r, -0.15, 0.15)
      branch(sx + Math.cos(a) * 8, sy + Math.sin(a) * 8, a, between(r, 18, 26), 3, '')
    }
    out += circle(sx, sy, 9, 'w')
    out += circle(sx + 1.5, sy - 1, 3.2, 'a')
    let ax = sx + Math.cos(axon) * 9
    let ay = sy + Math.sin(axon) * 9
    let a = axon
    for (let i = 0; i < 9; i += 1) {
      a += between(r, -0.25, 0.25)
      const nx = ax + Math.cos(a) * 16
      const ny = ay + Math.sin(a) * 16
      if (i % 2 === 1) {
        const px = Math.cos(a + Math.PI / 2) * 2.6
        const py = Math.sin(a + Math.PI / 2) * 2.6
        out += path(`M${f(ax + px)},${f(ay + py)}L${f(nx + px)},${f(ny + py)}M${f(ax - px)},${f(ay - py)}L${f(nx - px)},${f(ny - py)}`, 'a')
      } else out += line(ax, ay, nx, ny, 'w')
      ax = nx
      ay = ny
    }
    return out
  }

  function immune(r) {
    let out = ''
    const cells = []
    for (let tries = 0; tries < 120 && cells.length < 13; tries += 1) {
      const rad = between(r, 7, 19)
      const x = between(r, rad + 4, W - rad - 4)
      const y = between(r, rad + 4, H - rad - 4)
      if (cells.every((c) => Math.hypot(c.x - x, c.y - y) > c.rad + rad + 6)) cells.push({ x, y, rad })
    }
    cells.sort((a, b) => b.rad - a.rad)
    cells.forEach((c, i) => {
      const accent = i === 0
      out += circle(c.x, c.y, c.rad, accent ? 'a w' : 'w')
      const kind = r()
      if (kind < 0.35) {
        for (let k = 0; k < 3; k += 1) {
          const a = (k / 3) * Math.PI * 2 + r()
          out += circle(c.x + Math.cos(a) * c.rad * 0.32, c.y + Math.sin(a) * c.rad * 0.32, c.rad * 0.24, '')
        }
      } else out += circle(c.x + between(r, -2, 2), c.y + between(r, -2, 2), c.rad * between(r, 0.38, 0.55), 'd')
      if (accent || r() < 0.35) {
        const spikes = 12 + Math.floor(r() * 6)
        for (let k = 0; k < spikes; k += 1) {
          const a = (k / spikes) * Math.PI * 2
          out += line(c.x + Math.cos(a) * c.rad, c.y + Math.sin(a) * c.rad, c.x + Math.cos(a) * (c.rad + 4), c.y + Math.sin(a) * (c.rad + 4), accent ? 'a' : '')
        }
      }
    })
    for (let i = 0; i < 34; i += 1) out += circle(between(r, 4, W - 4), between(r, 4, H - 4), 0.9, 'f')
    for (let i = 0; i < 3; i += 1) {
      const x = between(r, 20, W - 20)
      const y = between(r, 20, H - 20)
      const a = r() * Math.PI * 2
      const p = (len, da) => [x + Math.cos(a + da) * len, y + Math.sin(a + da) * len]
      const [x1, y1] = p(7, 0)
      const [x2, y2] = p(6, Math.PI * 0.8)
      const [x3, y3] = p(6, -Math.PI * 0.8)
      out += path(`M${f(x1)},${f(y1)}L${f(x)},${f(y)}L${f(x2)},${f(y2)}M${f(x)},${f(y)}L${f(x3)},${f(y3)}`, 'd')
    }
    return out
  }

  function repair(r) {
    let out = ''
    const count = 2 + Math.floor(r() * 2)
    for (let i = 0; i < count; i += 1) {
      const cx = between(r, 60, 180)
      const cy = between(r, 40, 110)
      const len = between(r, 62, 92)
      const wid = between(r, 24, 32)
      const a = between(r, -0.7, 0.7)
      const body = []
      body.push(`<rect x="${f(-len / 2)}" y="${f(-wid / 2)}" width="${f(len)}" height="${f(wid)}" rx="${f(wid / 2)}" class="${i === 0 ? 'a w' : 'w'}"/>`)
      body.push(`<rect x="${f(-len / 2 + 3)}" y="${f(-wid / 2 + 3)}" width="${f(len - 6)}" height="${f(wid - 6)}" rx="${f(wid / 2 - 3)}" class="d"/>`)
      const folds = 5 + Math.floor(r() * 4)
      for (let k = 0; k < folds; k += 1) {
        const x = -len / 2 + wid * 0.45 + (k / (folds - 1)) * (len - wid * 0.9)
        const top = k % 2 === 0
        const y0 = top ? -wid / 2 + 3 : wid / 2 - 3
        const y1 = top ? wid * between(r, 0.05, 0.22) : -wid * between(r, 0.05, 0.22)
        body.push(`<path d="M${f(x - 2)},${f(y0)}L${f(x - 2)},${f(y1)}Q${f(x)},${f(y1 + (top ? 3 : -3))} ${f(x + 2)},${f(y1)}L${f(x + 2)},${f(y0)}"/>`)
      }
      out += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f((a * 180) / Math.PI)})">${body.join('')}</g>`
    }
    for (let i = 0; i < 4; i += 1) {
      const x = between(r, 16, W - 16)
      const y = between(r, 16, H - 16)
      const rad = between(r, 7, 13)
      out += circle(x, y, rad, 'w') + circle(x, y, rad - 2.4, '')
      for (let k = 0; k < 4; k += 1) out += circle(x + between(r, -rad / 2, rad / 2), y + between(r, -rad / 2, rad / 2), 1, 'f')
    }
    for (let i = 0; i < 18; i += 1) out += circle(between(r, 4, W - 4), between(r, 4, H - 4), between(r, 0.8, 2.2), 'd')
    return out
  }

  function tissue(r) {
    let out = ''
    const angle = between(r, -0.45, 0.45)
    const fibers = 10 + Math.floor(r() * 5)
    const gap = between(r, 8, 11)
    const wave = between(r, 44, 80)
    const amp = between(r, 2, 5)
    const striated = r() < 0.5
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const to = (u, v) => [W / 2 + u * ca - v * sa, H / 2 + u * sa + v * ca]
    for (let i = 0; i < fibers; i += 1) {
      const v0 = (i - fibers / 2) * gap
      const phase = r() * Math.PI * 2
      const pts = []
      for (let u = -150; u <= 150; u += 6) pts.push(to(u, v0 + Math.sin((u / wave) * Math.PI * 2 + phase) * amp))
      out += path(poly(pts), i === Math.floor(fibers / 2) ? 'a w' : i % 3 === 0 ? 'w' : '')
      if (striated && i % 2 === 0) {
        for (let u = -140; u <= 140; u += 7) {
          const v = v0 + Math.sin((u / wave) * Math.PI * 2 + phase) * amp
          const [x1, y1] = to(u, v - gap * 0.45)
          const [x2, y2] = to(u, v + gap * 0.45)
          out += line(x1, y1, x2, y2, 'f')
        }
      }
      if (!striated && r() < 0.6) {
        const u = between(r, -100, 100)
        const [x, y] = to(u, v0 + Math.sin((u / wave) * Math.PI * 2 + phase) * amp)
        out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="6" ry="1.8" transform="rotate(${f((angle * 180) / Math.PI)} ${f(x)} ${f(y)})" class="d"/>`
      }
    }
    return out
  }

  function gene(r) {
    let out = ''
    const x0 = -10
    const x1 = W + 10
    const y0 = between(r, 40, 110)
    const y1 = between(r, 40, 110)
    const amp = between(r, 14, 22)
    const turns = between(r, 2.4, 3.6)
    const phase = r() * Math.PI * 2
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    const nx = -dy / len
    const ny = dx / len
    const at = (t, s) => {
      const off = Math.sin(t * turns * Math.PI * 2 + phase + s) * amp
      return [x0 + dx * t + nx * off, y0 + dy * t + ny * off]
    }
    const a = []
    const b = []
    for (let i = 0; i <= 120; i += 1) {
      a.push(at(i / 120, 0))
      b.push(at(i / 120, Math.PI))
    }
    const rungs = Math.floor(turns * 9)
    const special = Math.floor(r() * rungs)
    for (let i = 1; i < rungs; i += 1) {
      const t = i / rungs
      const [ax, ay] = at(t, 0)
      const [bx, by] = at(t, Math.PI)
      out += line(ax, ay, bx, by, i === special ? 'a w' : 'd')
      if (i === special) out += circle((ax + bx) / 2, (ay + by) / 2, 3, 'a')
    }
    out += path(poly(a), 'w') + path(poly(b), 'w')
    out += path(poly(a.map(([x, y]) => [x + nx * 3, y + ny * 3])), 'f')
    if (r() < 0.6) {
      const cx = between(r, 30, 210)
      const cy = y0 < 75 ? between(r, 112, 132) : between(r, 18, 38)
      const g = []
      for (const rot of [-28, 28]) {
        g.push(`<rect x="-4" y="-16" width="8" height="32" rx="4" transform="rotate(${rot})"/>`)
      }
      for (const v of [-9, -4, 5, 10]) g.push(`<line x1="-5" y1="${v}" x2="5" y2="${v}" class="d" transform="rotate(${v < 0 ? -28 : 28})"/>`)
      out += `<g transform="translate(${f(cx)} ${f(cy)})">${g.join('')}</g>`
    }
    return out
  }

  function span(r) {
    let out = ''
    const left = 26
    const bottom = 130
    const right = 224
    const top = 22
    out += path(`M${left},${top - 6}L${left},${bottom}L${right + 6},${bottom}`, 'w')
    for (let i = 1; i <= 5; i += 1) {
      const x = left + ((right - left) * i) / 5
      out += line(x, bottom, x, bottom + 3, '')
      const y = bottom - ((bottom - top) * i) / 5
      out += line(left - 3, y, left, y, '')
    }
    const curves = 4 + Math.floor(r() * 3)
    const accent = Math.floor(r() * curves)
    for (let c = 0; c < curves; c += 1) {
      const b = between(r, 3, 9)
      const a = between(r, 0.02, 0.12)
      const pts = []
      for (let i = 0; i <= 60; i += 1) {
        const t = i / 60
        const s = Math.exp((-a / b) * (Math.exp(b * t) - 1) * 6)
        pts.push([left + (right - left) * t, bottom - (bottom - top) * s])
      }
      out += path(poly(pts), c === accent ? 'a w' : c % 2 ? 'd' : '')
    }
    const pts = []
    const ph = r() * Math.PI * 2
    for (let x = left; x <= right; x += 3) pts.push([x, 14 + Math.sin((x / 36) * Math.PI * 2 + ph) * 5])
    out += path(poly(pts), 'f')
    return out
  }

  const MOTIFS = { clock, organ, brain, immune, repair, tissue, gene, span }

  function plate(motif, seed) {
    const draw = MOTIFS[motif] || clock
    return svg(`<g class="cx-plate-art">${draw(rng(seed))}</g>`, 'cx-svg cx-plate-svg')
  }

  // ---- chapter emblems (16 × 16) -------------------------------------------

  const EMBLEMS = {
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>',
    organ: '<path d="M3 9c0-3 2.5-6 5.5-6S14 5 13.5 8.5 10 14 7 13.5 3 12 3 9z"/><path d="M6 9c0-1.4 1.1-3 2.6-3s2.4 1 2.1 2.6-1.6 2.6-3 2.4S6 10.2 6 9z"/>',
    brain: '<circle cx="8" cy="8" r="2"/><path d="M8 6V2.5M6.3 9 3 12M9.7 9 13 12M6.3 7 3 5M9.7 7 13 4.5"/>',
    immune: '<circle cx="8" cy="8" r="3.6"/><path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M3.8 12.2l1.1-1.1M11.1 4.9l1.1-1.1"/>',
    repair: '<rect x="2" y="4.5" width="12" height="7" rx="3.5"/><path d="M5 4.8v3.4M8 11.2V7.8M11 4.8v3.4"/>',
    tissue: '<path d="M2 4.5c2-1.5 4 1.5 6 0s4 1.5 6 0M2 8c2-1.5 4 1.5 6 0s4 1.5 6 0M2 11.5c2-1.5 4 1.5 6 0s4 1.5 6 0"/>',
    gene: '<path d="M4 2c0 4 8 4 8 6s-8 2-8 6M12 2c0 4-8 4-8 6s8 2 8 6M5 4h6M5 12h6"/>',
    span: '<path d="M2.5 2v11.5H14"/><path d="M3.5 3.5c3 0 5 1 6.5 4s2 5 3.5 5"/>',
  }
  function emblem(motif, size) {
    const s = size || 14
    return `<svg class="cx-emblem" width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EMBLEMS[motif] || EMBLEMS.clock}</svg>`
  }

  // ---- species --------------------------------------------------------------

  function worm(x0, x1, cy, amp, waves, maxW, phase) {
    const top = []
    const bot = []
    const mid = []
    const n = 90
    for (let i = 0; i <= n; i += 1) {
      const t = i / n
      const x = x0 + (x1 - x0) * t
      const y = cy + Math.sin(t * waves * Math.PI * 2 + phase) * amp
      const dy = Math.cos(t * waves * Math.PI * 2 + phase) * amp * waves * Math.PI * 2 / (x1 - x0)
      const norm = Math.hypot(1, dy)
      const w = maxW * Math.pow(Math.sin(Math.PI * Math.min(0.98, Math.max(0.02, t))), 0.55)
      top.push([x - (dy / norm) * w, y + (1 / norm) * -w])
      bot.push([x + (dy / norm) * w, y + (1 / norm) * w])
      mid.push([x, y])
    }
    return { outline: poly([...top, ...bot.reverse()], true), mid, top }
  }

  const SPECIES = {
    mouse: () => [
      path('M58,104C56,78 88,60 124,62C146,63 160,70 172,79C184,85 196,92 203,98C197,104 186,106 174,106C160,112 118,114 88,112C70,111 58,110 58,104Z', 'w'),
      circle(166, 70, 11, 'w'), circle(167, 71, 6.5, 'd'),
      circle(186, 89, 1.9, '', ' fill="currentColor"'),
      circle(203, 98, 1.6, 'a', ' fill="currentColor"'),
      path('M200,96L220,89M201,99L222,98M200,102L218,108', 'd'),
      path('M60,106C36,112 24,100 20,86C17,74 26,64 36,66', 'w'),
      path('M96,112L92,120M104,112L103,120M150,110L153,118M160,108L164,116', ''),
      path('M90,74C100,70 112,68 122,68M84,82C96,77 110,75 124,75M80,92C92,87 106,85 120,85', 'f'),
    ].join(''),
    c_elegans: () => {
      const body = worm(18, 222, 75, 22, 1.25, 7, 0.4)
      const [hx, hy] = body.mid[84]
      const [bx, by] = body.mid[78]
      const [vx, vy] = body.mid[46]
      return [
        path(body.outline, 'w'),
        path(poly(body.mid.slice(8, 76)), 'd', ' stroke-dasharray="1.5 3"'),
        `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="3.6" ry="2.6" class="a"/>`,
        `<ellipse cx="${f(bx)}" cy="${f(by)}" rx="2.6" ry="2" class=""/>`,
        circle(vx, vy, 1.6, 'a'),
        path(poly(body.top.slice(20, 70).map(([x, y]) => [x, y + 2.2])), 'f'),
      ].join('')
    },
    drosophila: () => [
      `<ellipse cx="78" cy="78" rx="46" ry="12" transform="rotate(-28 78 78)" class="d"/>`,
      `<ellipse cx="162" cy="78" rx="46" ry="12" transform="rotate(28 162 78)" class="d"/>`,
      path('M70,70L40,92M82,74L44,100M158,74L196,100M170,70L200,92', 'f'),
      circle(120, 38, 8.5, 'w'),
      `<ellipse cx="113" cy="37" rx="4" ry="5.5" class="a"/>`, `<ellipse cx="127" cy="37" rx="4" ry="5.5" class="a"/>`,
      `<ellipse cx="120" cy="60" rx="13" ry="14" class="w"/>`,
      `<ellipse cx="120" cy="95" rx="11" ry="21" class="w"/>`,
      path('M110,86Q120,90 130,86M109,95Q120,99 131,95M110,104Q120,108 130,104', ''),
      path('M108,60L92,52L84,40M107,66L88,68L80,80M108,72L94,86L90,102M132,60L148,52L156,40M133,66L152,68L160,80M132,72L146,86L150,102', ''),
      path('M116,31L110,22M124,31L130,22', ''),
    ].join(''),
    killifish: () => {
      const scales = []
      for (let x = 70; x < 170; x += 9) for (let y = 66; y < 92; y += 8) scales.push(`M${x},${y}q4.5,4 9,0`)
      return [
        path('M38,76C58,50 128,44 170,60C186,66 196,71 204,76C196,82 186,87 170,92C128,106 58,102 38,76Z', 'w'),
        path('M42,76L12,52C16,66 16,86 12,100Z', 'w'),
        path('M16,60L40,74M15,70L40,76M15,82L40,78M16,92L40,80', 'f'),
        path('M96,52C110,32 142,30 162,50', 'a'), path('M106,49L112,36M118,47L124,34M130,46L136,34M142,47L148,38', 'f'),
        path('M96,100C110,118 140,118 158,98', 'a'), path('M108,103L112,114M120,104L124,116M132,104L136,114', 'f'),
        path(scales.join(''), 'f'),
        circle(186, 72, 3.6, 'w'), circle(186.5, 72, 1.4, '', ' fill="currentColor"'),
        path('M174,62C170,72 170,82 174,90', 'd'),
      ].join('')
    },
    zebrafish: () => [
      path('M30,78C60,60 140,58 190,70C198,72 205,76 210,78C205,82 198,85 190,87C140,96 60,94 30,78Z', 'w'),
      path('M34,78L8,60L18,78L8,96Z', 'w'),
      path('M52,72C90,66 150,64 188,72', 'a'), path('M50,78C90,74 150,74 196,78', 'a'), path('M52,84C90,88 150,88 188,84', 'a'),
      path('M12,66L30,78M12,90L30,78', 'f'),
      path('M110,62C116,52 130,50 138,60', ''), path('M120,92C126,102 138,102 144,92', ''),
      circle(192, 75, 3, 'w'),
    ].join(''),
    planarian: () => [
      path('M28,75C36,58 100,54 156,57C176,58 190,50 202,44C199,56 204,64 216,75C204,86 199,94 202,106C190,100 176,92 156,93C100,96 36,92 28,75Z', 'w'),
      circle(190, 70, 4, 'w'), circle(191, 70.5, 1.6, '', ' fill="currentColor"'),
      circle(190, 80, 4, 'w'), circle(191, 79.5, 1.6, '', ' fill="currentColor"'),
      `<ellipse cx="112" cy="75" rx="20" ry="5" class="a"/>`,
      path('M160,75L60,75M150,75L140,64M150,75L140,86M130,75L120,62M130,75L120,88M100,75L90,63M100,75L90,87M80,75L70,64M80,75L70,86', 'd'),
      path('M40,70C80,64 140,62 180,64', 'f'),
    ].join(''),
    butterfly: () => [
      path('M118,58C92,30 40,18 18,26C24,44 70,68 116,72Z', 'w'),
      path('M122,58C148,30 200,18 222,26C216,44 170,68 124,72Z', 'w'),
      path('M116,76C86,80 56,100 62,120C82,126 106,106 117,88Z', 'w'),
      path('M124,76C154,80 184,100 178,120C158,126 134,106 123,88Z', 'w'),
      path('M40,30C60,44 84,52 104,58M44,40C62,50 86,58 100,62', 'a'),
      path('M200,30C180,44 156,52 136,58M196,40C178,50 154,58 140,62', 'a'),
      path('M70,112C82,108 96,98 104,90M170,112C158,108 144,98 136,90', 'd'),
      `<ellipse cx="120" cy="80" rx="3.2" ry="26" class="w"/>`, circle(120, 51, 4, 'w'),
      path('M118,48C112,30 104,18 98,12M122,48C128,30 136,18 142,12', ''), circle(98, 12, 2, 'a'), circle(142, 12, 2, 'a'),
    ].join(''),
    naked_mole_rat: () => {
      const folds = []
      for (let x = 64; x < 186; x += 7) folds.push(`M${x},${66 + Math.abs(x - 120) * 0.04}C${x - 3},${80} ${x - 3},${96} ${x},${108}`)
      return [
        path('M40,96C38,74 66,62 110,63C150,64 176,70 192,82C200,88 204,95 199,101C188,108 152,111 110,111C68,111 42,108 40,96Z', 'w'),
        path(folds.join(''), 'f'),
        path('M198,98L203,108M193,99L197,109', 'a'),
        circle(186, 84, 1.3, '', ' fill="currentColor"'),
        path('M201,94L214,90M201,97L214,99', 'd'),
        path('M42,98C30,100 22,96 18,92', 'w'),
        path('M70,110L66,118M82,111L80,119M160,110L162,118M172,109L176,117', ''),
      ].join('')
    },
    bowhead_whale: () => {
      const chin = []
      for (let i = 0; i < 14; i += 1) chin.push(circle(184 + (i % 5) * 7 + (Math.floor(i / 5) % 2) * 3, 100 + Math.floor(i / 5) * 5, 0.9, 'd', ' fill="currentColor"'))
      return [
        // back, the rise of the head, the arched rostrum, then the deep lower lip and belly
        path('M42,84C58,62 96,50 132,48C148,47 160,44 170,40C196,44 216,58 228,76C224,96 204,112 176,114C150,116 132,110 114,104C88,98 62,94 42,88Z', 'w'),
        path('M42,84C32,78 20,70 6,68C14,76 22,82 32,86C22,90 14,98 8,108C20,104 32,96 42,88', 'w'),
        path('M227,77C214,52 184,52 164,86', 'a w'),
        path('M164,86C176,96 196,100 220,90', 'd'),
        circle(160, 92, 1.9, '', ' fill="currentColor"'),
        path('M140,108C134,118 126,126 112,130C116,122 120,114 124,106', ''),
        path('M174,40L170,32M180,41L182,33', 'd'),
        path('M70,66C96,56 128,52 158,52M60,76C92,66 130,62 168,62', 'f'),
        ...chin,
      ].join('')
    },
  }

  function species(key, opts) {
    const draw = SPECIES[key]
    const body = draw ? draw() : ''
    return svg(`<g class="cx-species-art${opts && opts.silhouette ? ' is-silhouette' : ''}">${body}</g>`, 'cx-svg cx-species-svg')
  }

  /** Lifespan on a log scale from one week to 300 years, with a human reference. */
  function lifespan(years) {
    const lo = Math.log10(7 / 365)
    const hi = Math.log10(300)
    const x = (y) => 6 + ((Math.log10(y) - lo) / (hi - lo)) * 188
    const ticks = [[1 / 12, '1 月'], [1, '1 年'], [10, '10 年'], [100, '100 年']]
    let out = line(6, 10, 194, 10, 'd')
    for (const [y, label] of ticks) out += line(x(y), 7, x(y), 13, '') + `<text x="${f(x(y))}" y="24" text-anchor="middle">${label}</text>`
    out += line(x(80), 3, x(80), 17, 'd', ' stroke-dasharray="1.5 1.5"') + `<text x="${f(x(80))}" y="2" text-anchor="middle" class="cx-tiny">人</text>`
    if (years) out += path(`M${f(x(years))},9L${f(x(years) - 4)},2L${f(x(years) + 4)},2Z`, 'a', ' fill="currentColor"')
    return `<svg class="cx-lifespan" viewBox="0 -6 200 32" fill="none" stroke="currentColor" aria-label="寿命刻度">${out}</svg>`
  }

  // ---- tools and milestones --------------------------------------------------

  const TOOL_GLYPHS = {
    search: '<circle cx="104" cy="68" r="26" class="w"/><circle cx="104" cy="68" r="19" class="d"/><path d="M123,87L146,110" class="a w"/>',
    book: '<path d="M80,46C96,42 110,44 120,52C130,44 144,42 160,46V104C144,100 130,102 120,110C110,102 96,100 80,104Z" class="w"/><path d="M120,52V110" class="a"/><path d="M90,60h20M90,70h20M90,80h16M130,60h20M130,70h20M130,80h16" class="d"/>',
    db: '<ellipse cx="120" cy="46" rx="34" ry="10" class="w"/><path d="M86,46V104C86,110 101,114 120,114S154,110 154,104V46" class="w"/><path d="M86,66C86,72 101,76 120,76S154,72 154,66M86,86C86,92 101,96 120,96S154,92 154,86" class="a"/>',
    clock: '<circle cx="120" cy="75" r="34" class="w"/><path d="M120,52V75L136,86" class="a w"/><path d="M120,41v5M120,104v5M86,75h5M149,75h5" />',
    helix: '<path d="M96,36C96,62 144,62 144,75S96,88 96,114M144,36C144,62 96,62 96,75S144,88 144,114" class="w"/><path d="M100,46h40M104,104h32M102,66h36M102,84h36" class="a"/>',
    bench: '<path d="M78,110H162" class="w"/><rect x="86" y="80" width="16" height="30" class="d"/><rect x="112" y="56" width="16" height="54" class="a"/><rect x="138" y="68" width="16" height="42" class="d"/>',
    review: '<rect x="88" y="38" width="64" height="76" rx="4" class="w"/><path d="M98,54h44M98,64h44M98,74h30" class="d"/><path d="M100,92l8,8 16-18" class="a w"/>',
  }
  function toolPlate(glyph) {
    let grid = ''
    for (let x = 0; x <= W; x += 12) grid += line(x, 0, x, H, 'f')
    for (let y = 0; y <= H; y += 12) grid += line(0, y, W, y, 'f')
    return svg(`${grid}<g class="cx-tool-art">${TOOL_GLYPHS[glyph] || TOOL_GLYPHS.search}</g>`, 'cx-svg cx-plate-svg')
  }

  const MILESTONE_GLYPHS = {
    pen: '<path d="M96,104L104,84L140,48L152,60L116,96Z" class="w"/><path d="M134,54L146,66" class="a"/>',
    brief: '<rect x="94" y="44" width="52" height="66" rx="4" class="w"/><rect x="108" y="38" width="24" height="10" rx="3" class="a"/><path d="M104,64h32M104,74h32M104,84h22" class="d"/>',
    plus: '<rect x="90" y="46" width="60" height="60" rx="8" class="w"/><path d="M120,62V90M106,76H134" class="a w"/>',
    calendar: '<rect x="88" y="46" width="64" height="60" rx="5" class="w"/><path d="M88,60H152M102,40V50M138,40V50" class=""/><path d="M98,70h8M110,70h8M122,70h8M134,70h8M98,80h8M110,80h8M122,80h8M134,80h8M98,90h8M110,90h8M122,90h8" class="a"/>',
    repeat: '<path d="M96,70A26,26 0 0 1 144,62M144,82A26,26 0 0 1 96,90" class="w"/><path d="M140,52L145,63L134,65M100,100L95,89L106,87" class="a"/>',
    flag: '<path d="M104,110V40" class="w"/><path d="M104,44C120,36 132,52 148,44V72C132,80 120,64 104,72Z" class="a"/>',
    calc: '<rect x="96" y="40" width="48" height="70" rx="5" class="w"/><rect x="104" y="48" width="32" height="14" class="a"/><path d="M106,74h4M118,74h4M130,74h4M106,86h4M118,86h4M130,86h4M106,98h4M118,98h4M130,98h4" class="d"/>',
    ab: '<rect x="80" y="54" width="34" height="42" rx="4" class="w"/><rect x="126" y="54" width="34" height="42" rx="4" class="a"/><path d="M90,82L97,66L104,82M93,77h8M136,66v16h8a4,4 0 0 0 0-8h-8M136,74h7a4,4 0 0 0 0-8h-7" class="d"/>',
  }
  function milestonePlate(glyph, stamp) {
    let lines = ''
    for (let y = 18; y < H; y += 14) lines += line(0, y, W, y, 'f')
    const mark = `<g class="cx-postmark"><circle cx="186" cy="40" r="24"/><circle cx="186" cy="40" r="19" class="d"/><text x="186" y="44" text-anchor="middle">${stamp || ''}</text></g>`
    return svg(`${lines}<g class="cx-mile-art">${MILESTONE_GLYPHS[glyph] || MILESTONE_GLYPHS.pen}</g>${mark}`, 'cx-svg cx-plate-svg')
  }

  // ---- bags -----------------------------------------------------------------

  const BAG_GLYPHS = {
    daily: '<path d="M0,6C-4,2 -4,-4 0,-7C4,-4 4,2 0,6ZM0,6V9"/>',
    care: '<rect x="-5" y="-6" width="10" height="12" rx="1.5"/><path d="M-2.5,-2h5M-2.5,1h5M-2.5,4h3"/>',
    pick: '<rect x="-8" y="-5" width="6" height="9" rx="1"/><rect x="-3" y="-6" width="6" height="9" rx="1"/><rect x="2" y="-5" width="6" height="9" rx="1"/>',
  }
  function bag(kind) {
    return `<svg class="cx-bag-svg" viewBox="0 0 200 130" aria-hidden="true">
      <rect class="cx-bag-body" x="6" y="22" width="188" height="102" rx="6"/>
      <path class="cx-bag-pocket" d="M6,124L100,70L194,124"/>
      <path class="cx-bag-flap" d="M6,26Q6,22 10,22H190Q194,22 194,26L100,84Z"/>
      <g class="cx-bag-seal" transform="translate(100 82)"><circle r="15"/><g class="cx-bag-glyph" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BAG_GLYPHS[kind] || BAG_GLYPHS.daily}</g></g>
    </svg>`
  }

  root.CodexArt = { plate, emblem, species, lifespan, toolPlate, milestonePlate, bag, MOTIFS: Object.keys(MOTIFS) }
})(globalThis)
