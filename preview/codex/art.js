// Codex v2 pixel art (docs/codex-v2.md §5). Every card face is one 50 × 70 raster: frame,
// window and motif share a single pixel grid and are scaled up by an integer with
// image-rendering: pixelated. Motifs are generated from the card's seed; species, icons,
// packs and the card back are built from shapes on the same grid. No image files.

(function (root) {
  const INK = '#0d0f12'
  const CARD_W = 50
  const CARD_H = 70
  const WIN = { x: 5, y: 12, w: 40, h: 32 }

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
  const between = (r, lo, hi) => lo + r() * (hi - lo)
  const pick = (r, list) => list[Math.floor(r() * list.length)]

  // ---- raster --------------------------------------------------------------

  class Raster {
    constructor(w, h, fill) {
      this.w = w
      this.h = h
      this.c = new Array(w * h).fill(fill || null)
    }
    set(x, y, col) {
      x = Math.round(x)
      y = Math.round(y)
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col
    }
    get(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null
    }
    each(fn) {
      for (let y = 0; y < this.h; y += 1) for (let x = 0; x < this.w; x += 1) fn(x, y, this.c[y * this.w + x])
    }
    rect(x, y, w, h, col) {
      for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j, col)
    }
    line(x0, y0, x1, y1, col) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
      const dx = Math.abs(x1 - x0)
      const dy = -Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx + dy
      for (;;) {
        this.set(x0, y0, col)
        if (x0 === x1 && y0 === y1) break
        const e2 = 2 * err
        if (e2 >= dy) { err += dy; x0 += sx }
        if (e2 <= dx) { err += dx; y0 += sy }
      }
    }
    path(points, col) {
      for (let i = 1; i < points.length; i += 1) this.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], col)
    }
    thick(x0, y0, x1, y1, col, t) {
      const half = t / 2
      const minX = Math.floor(Math.min(x0, x1) - half - 1)
      const maxX = Math.ceil(Math.max(x0, x1) + half + 1)
      const minY = Math.floor(Math.min(y0, y1) - half - 1)
      const maxY = Math.ceil(Math.max(y0, y1) + half + 1)
      const lx = x1 - x0
      const ly = y1 - y0
      const len2 = lx * lx + ly * ly || 1
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
        const t2 = Math.max(0, Math.min(1, ((x - x0) * lx + (y - y0) * ly) / len2))
        if (Math.hypot(x - (x0 + lx * t2), y - (y0 + ly * t2)) <= half) this.set(x, y, col)
      }
    }
    disc(cx, cy, r, col) {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
        if (Math.hypot(x - cx, y - cy) <= r + 0.25) this.set(x, y, col)
      }
    }
    ring(cx, cy, r, col, t) {
      const half = (t || 1) / 2 + 0.05
      for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y += 1) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x += 1) {
        if (Math.abs(Math.hypot(x - cx, y - cy) - r) <= half) this.set(x, y, col)
      }
    }
    ellipse(cx, cy, rx, ry, col, rot) {
      const c = Math.cos(rot || 0)
      const s = Math.sin(rot || 0)
      const m = Math.max(rx, ry) + 1
      for (let y = Math.floor(cy - m); y <= cy + m; y += 1) for (let x = Math.floor(cx - m); x <= cx + m; x += 1) {
        const dx = x - cx
        const dy = y - cy
        const u = (dx * c + dy * s) / rx
        const v = (-dx * s + dy * c) / ry
        if (u * u + v * v <= 1.05) this.set(x, y, col)
      }
    }
    poly(points, col) {
      const xs = points.map((p) => p[0])
      const ys = points.map((p) => p[1])
      for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y += 1) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x += 1) {
        let inside = false
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const [xi, yi] = points[i]
          const [xj, yj] = points[j]
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) this.set(x, y, col)
      }
    }
    recolor(fn) {
      this.each((x, y, col) => { if (col) { const next = fn(x, y, col); if (next) this.c[y * this.w + x] = next } })
    }
    /** Classic one-pixel outline: every empty pixel that touches a filled one (4-neighbour). */
    outline(col) {
      const add = []
      this.each((x, y, here) => {
        if (here) return
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y])
      })
      for (const [x, y] of add) this.set(x, y, col || INK)
      return this
    }
    blit(src, ox, oy) {
      src.each((x, y, col) => { if (col) this.set(ox + x, oy + y, col) })
      return this
    }
  }

  const rgbCache = new Map()
  function rgb(hex) {
    if (!rgbCache.has(hex)) rgbCache.set(hex, [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)])
    return rgbCache.get(hex)
  }
  function toURL(r) {
    const canvas = document.createElement('canvas')
    canvas.width = r.w
    canvas.height = r.h
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(r.w, r.h)
    r.each((x, y, col) => {
      if (!col) return
      const [cr, cg, cb] = rgb(col)
      const i = (y * r.w + x) * 4
      img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255
    })
    ctx.putImageData(img, 0, 0)
    return canvas.toDataURL('image/png')
  }
  const memo = new Map()
  const cached = (key, make) => {
    if (!memo.has(key)) memo.set(key, make())
    return memo.get(key)
  }

  // ---- palettes ------------------------------------------------------------

  const FRAMES = {
    cell:      { l: '#f6b884', b: '#c8703a', d: '#7f3f1d' },
    animal:    { l: '#f1f5f8', b: '#a9b6c1', d: '#5b6974' },
    human:     { l: '#cdb0ff', b: '#8a5cd6', d: '#4a2c86' },
    trial:     { l: '#ffe896', b: '#f2b53a', d: '#a86b14' },
    species:   { l: '#77705a', b: '#3a372f', d: '#15140f' },
    tool:      { l: '#9fc0ea', b: '#4a72a8', d: '#22385c' },
    milestone: { l: '#f4d8a4', b: '#c9925a', d: '#7a4f26' },
    back:      { l: '#6fd3c4', b: '#2a9d8f', d: '#1b6159' },
  }
  const PAPER = { light: '#f4ead5', shade: '#d8c9a8', dark: '#1a1d24', darkShade: '#2a2f3a' }
  const CHAPTERS = {
    clock:  { bg: '#1f2f52', bg2: '#27406b', fg: '#f4ead5', mid: '#93add9', acc: '#f2b53a' },
    organ:  { bg: '#4a1d24', bg2: '#5e2730', fg: '#f9d3b4', mid: '#e0735a', acc: '#ffd166' },
    brain:  { bg: '#2a1f4a', bg2: '#36295e', fg: '#f1e4ff', mid: '#b49ce0', acc: '#ff8fab' },
    immune: { bg: '#0f3f3d', bg2: '#16504d', fg: '#ddfbf1', mid: '#5fd0ac', acc: '#ffb703' },
    repair: { bg: '#47280f', bg2: '#5a3416', fg: '#ffe1b5', mid: '#f19a4d', acc: '#8ecae6' },
    tissue: { bg: '#4a1b38', bg2: '#5c2346', fg: '#ffd7ea', mid: '#e0659b', acc: '#f9c74f' },
    gene:   { bg: '#173a21', bg2: '#1f4a2a', fg: '#e7f9d3', mid: '#8fd16a', acc: '#ff6b6b' },
    span:   { bg: '#262b33', bg2: '#30363f', fg: '#eef2f5', mid: '#93a1b0', acc: '#f2b53a' },
  }

  // ---- motifs (40 × 32 window: B is the backdrop, L is outlined) -------------

  const W = WIN.w
  const H = WIN.h

  function backdrop(p) {
    return new Raster(W, H, p.bg)
  }

  const MOTIFS = {
    clock(r, p) {
      const B = backdrop(p)
      const L = new Raster(W, H)
      const cx = 20 + Math.round(between(r, -4, 4))
      const cy = 16 + Math.round(between(r, -1, 1))
      const R = 10 + Math.round(between(r, 0, 2))
      B.each((x, y) => { const d = Math.hypot(x - cx, y - cy); if (d > R + 1 && Math.floor((d - R) / 2) % 2 === 0) B.set(x, y, p.bg2) })
      L.disc(cx, cy, R, p.fg)
      L.ring(cx, cy, R - 2, p.mid)
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2
        L.set(cx + Math.cos(a) * (R - 0.6), cy + Math.sin(a) * (R - 0.6), i % 3 === 0 ? INK : p.mid)
      }
      const sa = r() * Math.PI * 2
      const sx = Math.round(cx + Math.cos(sa) * R * 0.45)
      const sy = Math.round(cy + Math.sin(sa) * R * 0.45)
      L.disc(sx, sy, 2.2, p.mid)
      L.set(sx, sy, p.fg)
      const h1 = r() * Math.PI * 2
      const h2 = r() * Math.PI * 2
      L.line(cx, cy, cx + Math.cos(h1) * (R - 5), cy + Math.sin(h1) * (R - 5), INK)
      L.line(cx, cy, cx + Math.cos(h2) * (R - 3), cy + Math.sin(h2) * (R - 3), p.acc)
      L.set(cx, cy, p.acc)
      return B.blit(L.outline(), 0, 0)
    },
    organ(r, p) {
      const B = backdrop(p)
      B.each((x, y) => { if (x % 4 === 0 && y % 4 === 0) B.set(x, y, p.bg2) })
      const L = new Raster(W, H)
      const cx = 20 + between(r, -4, 4)
      const cy = 16 + between(r, -2, 2)
      const R = between(r, 11, 13)
      const hs = [2, 3, 4].map((k) => ({ k, a: between(r, 0.05, 0.16) / (k - 1), ph: r() * Math.PI * 2 }))
      L.each((x, y) => {
        const dx = x - cx
        const dy = (y - cy) / 0.8
        const th = Math.atan2(dy, dx)
        let s = 1
        for (const h of hs) s += h.a * Math.cos(h.k * th + h.ph)
        const q = Math.hypot(dx, dy) / (R * s)
        if (q > 1) return
        const dith = (x + y) % 2 === 0 ? 0.04 : -0.04
        L.set(x, y, q + dith < 0.38 ? p.acc : q + dith < 0.7 ? p.mid : p.fg)
      })
      const y0 = between(r, 4, 28)
      const ph = r() * Math.PI * 2
      for (let x = 0; x < W; x += 1) L.set(x, y0 + Math.sin(x / 5 + ph) * 3, p.fg)
      return B.blit(L.outline(), 0, 0)
    },
    brain(r, p) {
      const B = backdrop(p)
      const L = new Raster(W, H)
      const ghost = (x, y, a, len, depth) => {
        const x2 = x + Math.cos(a) * len
        const y2 = y + Math.sin(a) * len
        B.line(x, y, x2, y2, p.bg2)
        if (depth > 0) { ghost(x2, y2, a - 0.6, len * 0.7, depth - 1); ghost(x2, y2, a + 0.6, len * 0.7, depth - 1) }
      }
      const gx = between(r, 3, 12)
      const gy = between(r, 4, 28)
      for (let i = 0; i < 4; i += 1) ghost(gx, gy, (i / 4) * Math.PI * 2 + r(), 5, 2)
      const sx = Math.round(between(r, 15, 26))
      const sy = Math.round(between(r, 11, 20))
      const branch = (x, y, a, len, depth) => {
        const x2 = x + Math.cos(a) * len
        const y2 = y + Math.sin(a) * len
        L.line(x, y, x2, y2, p.fg)
        if (depth <= 0) { L.set(x2, y2, p.acc); return }
        const spread = between(r, 0.4, 0.75)
        branch(x2, y2, a - spread, len * between(r, 0.6, 0.78), depth - 1)
        branch(x2, y2, a + spread, len * between(r, 0.6, 0.78), depth - 1)
      }
      const axon = r() * Math.PI * 2
      const prim = 4 + Math.floor(r() * 3)
      for (let i = 0; i < prim; i += 1) {
        const a = axon + Math.PI * 0.4 + (i / prim) * Math.PI * 1.2
        branch(sx + Math.cos(a) * 3, sy + Math.sin(a) * 3, a, between(r, 5, 7), 2)
      }
      let ax = sx
      let ay = sy
      let a = axon
      for (let i = 0; i < 12; i += 1) {
        a += between(r, -0.25, 0.25)
        const nx = ax + Math.cos(a) * 2.5
        const ny = ay + Math.sin(a) * 2.5
        L.line(ax, ay, nx, ny, i % 2 ? p.mid : p.fg)
        ax = nx
        ay = ny
      }
      L.disc(sx, sy, 3, p.fg)
      L.rect(sx - 1, sy - 1, 2, 2, p.acc)
      return B.blit(L.outline(), 0, 0)
    },
    immune(r, p) {
      const B = backdrop(p)
      for (let i = 0; i < 40; i += 1) B.set(between(r, 0, W), between(r, 0, H), p.bg2)
      const L = new Raster(W, H)
      const cells = []
      for (let tries = 0; tries < 200 && cells.length < 7; tries += 1) {
        const rad = between(r, 2.6, 5.6)
        const x = between(r, rad + 2, W - rad - 2)
        const y = between(r, rad + 2, H - rad - 2)
        if (cells.every((c) => Math.hypot(c.x - x, c.y - y) > c.rad + rad + 3)) cells.push({ x, y, rad })
      }
      cells.forEach((c, i) => {
        L.disc(c.x, c.y, c.rad, p.mid)
        if (r() < 0.35) for (let k = 0; k < 3; k += 1) { const a = (k / 3) * Math.PI * 2 + r(); L.set(c.x + Math.cos(a) * c.rad * 0.4, c.y + Math.sin(a) * c.rad * 0.4, p.acc) }
        else L.disc(c.x + between(r, -0.8, 0.8), c.y + between(r, -0.8, 0.8), c.rad * 0.45, p.fg)
        if (i === 0 || r() < 0.4) for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2; L.set(c.x + Math.cos(a) * (c.rad + 1.2), c.y + Math.sin(a) * (c.rad + 1.2), p.acc) }
      })
      return B.blit(L.outline(), 0, 0)
    },
    repair(r, p) {
      const B = backdrop(p)
      B.each((x, y) => { if ((x + y * 3) % 7 === 0) B.set(x, y, p.bg2) })
      const L = new Raster(W, H)
      const count = 2 + Math.floor(r() * 2)
      for (let i = 0; i < count; i += 1) {
        const cx = between(r, 9, 31)
        const cy = between(r, 8, 24)
        const len = between(r, 7, 10)
        const ang = pick(r, [0, 0.45, -0.45, 0.9, -0.9])
        const w = 3.6
        const x0 = cx - Math.cos(ang) * len
        const y0 = cy - Math.sin(ang) * len
        const x1 = cx + Math.cos(ang) * len
        const y1 = cy + Math.sin(ang) * len
        const lx = x1 - x0
        const ly = y1 - y0
        const len2 = lx * lx + ly * ly
        L.each((x, y) => {
          const t = Math.max(0, Math.min(1, ((x - x0) * lx + (y - y0) * ly) / len2))
          const d = Math.hypot(x - (x0 + lx * t), y - (y0 + ly * t))
          if (d > w) return
          const along = t * len * 2
          L.set(x, y, d < w - 1.2 && Math.floor(along / 2.2) % 2 === 0 ? p.fg : p.mid)
        })
      }
      for (let i = 0; i < 3; i += 1) {
        const x = between(r, 4, 36)
        const y = between(r, 4, 28)
        if (L.get(Math.round(x), Math.round(y))) continue
        L.ring(x, y, 2.2, p.acc)
        L.set(x, y, p.fg)
      }
      return B.blit(L.outline(), 0, 0)
    },
    tissue(r, p) {
      const B = backdrop(p)
      const th = between(r, -0.5, 0.5)
      const lam = between(r, 10, 16)
      const amp = between(r, 1.2, 2.4)
      const ph = r() * Math.PI * 2
      const striated = r() < 0.5
      const c = Math.cos(th)
      const s = Math.sin(th)
      B.each((x, y) => {
        const u = x * c + y * s
        const v = -x * s + y * c + amp * Math.sin((u / lam) * Math.PI * 2 + ph)
        const band = ((Math.floor(v / 3) % 3) + 3) % 3
        let col = band === 0 ? p.bg : band === 1 ? p.mid : p.fg
        if (striated && band !== 0 && ((Math.floor(u) % 4) + 4) % 4 === 0) col = band === 2 ? p.mid : p.bg2
        B.set(x, y, col)
      })
      const L = new Raster(W, H)
      for (let i = 0; i < 2; i += 1) L.ellipse(between(r, 6, 34), between(r, 6, 26), 2.4, 1.2, p.acc, th)
      return B.blit(L.outline(), 0, 0)
    },
    gene(r, p) {
      const B = backdrop(p)
      B.each((x, y) => { if (x % 6 === 0 && y % 2 === 0) B.set(x, y, p.bg2) })
      const L = new Raster(W, H)
      const A = between(r, 6, 8)
      const lam = between(r, 14, 18)
      const ph = r() * Math.PI * 2
      const slope = between(r, -0.15, 0.15)
      const special = 3 * Math.floor(between(r, 2, 12))
      const strand = (x, sign) => 16 + slope * (x - 20) + sign * A * Math.sin((x / lam) * Math.PI * 2 + ph)
      for (let x = 0; x < W; x += 3) {
        const y1 = strand(x, 1)
        const y2 = strand(x, -1)
        if (Math.abs(y1 - y2) > 2) L.line(x, y1, x, y2, x === special ? p.acc : p.mid)
      }
      for (let x = 0; x < W; x += 1) {
        const front = Math.cos((x / lam) * Math.PI * 2 + ph) > 0
        const order = front ? [[-1, p.acc], [1, p.fg]] : [[1, p.fg], [-1, p.acc]]
        for (const [sign, col] of order) { const y = strand(x, sign); L.set(x, y, col); L.set(x, y + 1, col) }
      }
      return B.blit(L.outline(), 0, 0)
    },
    span(r, p) {
      const B = backdrop(p)
      const ph = r() * Math.PI * 2
      for (let x = 0; x < W; x += 2) B.set(x, 3 + Math.sin(x / 4 + ph) * 1.5, p.bg2)
      const L = new Raster(W, H)
      L.line(4, 4, 4, 28, p.fg)
      L.line(4, 28, 36, 28, p.fg)
      for (let x = 10; x <= 34; x += 6) L.set(x, 29, p.fg)
      const n = 3 + Math.floor(r() * 2)
      const accent = Math.floor(r() * n)
      for (let k = 0; k < n; k += 1) {
        const b = between(r, 3, 8)
        const a = between(r, 0.03, 0.12)
        const pts = []
        for (let i = 0; i <= 16; i += 1) {
          const t = i / 16
          const sv = Math.exp((-a / b) * (Math.exp(b * t) - 1) * 6)
          pts.push([6 + t * 30, 26 - sv * 20])
        }
        L.path(pts, k === accent ? p.acc : k % 2 ? p.mid : p.fg)
      }
      L.disc(33, 7, 2, p.acc)
      return B.blit(L.outline(), 0, 0)
    },
  }

  // ---- species --------------------------------------------------------------

  const SPECIES_BG = { bg: '#1b2536', star: '#33415a', bright: '#8796b0' }

  function speciesWindow(key, silhouette) {
    const B = new Raster(W, H, SPECIES_BG.bg)
    const r = rng(key.length * 7919)
    for (let i = 0; i < 26; i += 1) B.set(between(r, 0, W), between(r, 0, H), i % 6 === 0 ? SPECIES_BG.bright : SPECIES_BG.star)
    const L = new Raster(W, H)
    const draw = SPECIES[key]
    if (draw) draw(L)
    if (silhouette) L.recolor(() => '#2b3954')
    L.outline(silhouette ? '#0f1520' : INK)
    if (!silhouette && SPECIES_AFTER[key]) SPECIES_AFTER[key](L)
    return B.blit(L, 0, 0)
  }

  const SPECIES = {
    mouse(L) {
      const a = '#b9aa98'; const b = '#8a7a69'; const c = '#e6d9c8'; const p = '#f2a3b3'
      L.thick(7, 21, 3, 24, p, 1.2); L.thick(3, 24, 3, 28, p, 1.2); L.thick(3, 28, 6, 30, p, 1.2)
      L.ellipse(17, 19, 11, 6.5, a)
      L.ellipse(27, 16, 6, 5, a)
      L.poly([[30, 12], [37, 17], [30, 21]], a)
      L.disc(25, 10, 3.5, a)
      L.disc(25, 10, 2, p)
      L.rect(10, 25, 3, 2, b); L.rect(21, 25, 3, 2, b)
      L.recolor((x, y, col) => (col === a && y >= 22 ? b : col === a && y <= 15 && x < 22 ? c : null))
      L.set(29, 15, INK)
      L.set(37, 17, p)
    },
    c_elegans(L) {
      const a = '#efe3c8'; const b = '#c4ad86'; const d = '#e07a5f'
      for (let x = 3; x <= 37; x += 0.25) {
        const t = (x - 3) / 34
        const y = 16 + 6 * Math.sin(2 * Math.PI * t * 1.25 + 0.4)
        const w = 2.6 * Math.pow(Math.sin(Math.PI * Math.min(0.97, Math.max(0.03, t))), 0.6)
        for (let dy = -w; dy <= w; dy += 0.5) L.set(x, y + dy, a)
      }
      for (let x = 7; x <= 31; x += 2) L.set(x, 16 + 6 * Math.sin(2 * Math.PI * ((x - 3) / 34) * 1.25 + 0.4), b)
      const hx = 34
      L.disc(hx, 16 + 6 * Math.sin(2 * Math.PI * ((hx - 3) / 34) * 1.25 + 0.4), 1.4, d)
    },
    drosophila(L) {
      const a = '#8a6a44'; const b = '#523c25'; const w = '#cfe4f2'; const d = '#e5484d'
      L.ellipse(12, 21, 9, 3.4, w, -0.6)
      L.ellipse(28, 21, 9, 3.4, w, 0.6)
      for (const [x0, y0, x1, y1] of [[16, 14, 11, 10], [16, 16, 10, 16], [17, 18, 13, 23], [24, 14, 29, 10], [24, 16, 30, 16], [23, 18, 27, 23]]) L.line(x0, y0, x1, y1, b)
      L.ellipse(20, 15, 4, 4, a)
      L.ellipse(20, 23, 3, 5.5, a)
      L.rect(18, 21, 5, 1, b); L.rect(18, 24, 5, 1, b)
      L.disc(20, 9, 2.6, a)
      L.disc(18, 8, 1.4, d); L.disc(22, 8, 1.4, d)
      L.line(19, 6, 17, 3, b); L.line(21, 6, 23, 3, b)
    },
    killifish(L) {
      const a = '#3fb8af'; const b = '#1f7a78'; const c = '#bff0e8'; const d = '#e5484d'; const f = '#f6c453'
      L.poly([[11, 16], [2, 8], [2, 24]], d)
      L.recolor((x, y, col) => (col === d && y % 3 === 0 ? f : null))
      L.poly([[15, 11], [27, 11], [26, 6], [17, 7]], d)
      L.poly([[17, 21], [26, 21], [24, 26], [18, 25]], d)
      L.ellipse(21, 16, 12, 6, a)
      L.recolor((x, y, col) => (col === a && x >= 12 && x <= 30 && x % 3 === 0 ? b : col === a && y >= 20 ? c : null))
      L.disc(29, 14, 1.4, '#ffffff')
      L.set(29, 14, INK)
    },
    zebrafish(L) {
      const a = '#ead9a2'; const b = '#2f5594'; const fin = '#d9c487'
      L.poly([[8, 16], [1, 10], [4, 16], [1, 22]], a)
      L.poly([[18, 12], [24, 12], [21, 9]], fin)
      L.poly([[18, 20], [25, 20], [22, 23]], fin)
      L.ellipse(21, 16, 15, 4, a)
      L.recolor((x, y, col) => (col === a && (y === 14 || y === 16 || y === 18) && x < 34 ? b : null))
      L.disc(32, 15, 1.2, '#ffffff')
      L.set(32, 15, INK)
    },
    planarian(L) {
      const a = '#a8805e'; const b = '#7a5a3f'; const c = '#d9b28d'
      L.ellipse(19, 17, 15, 5, a)
      L.poly([[30, 12], [38, 17], [30, 22]], a)
      L.poly([[29, 13], [33, 9], [33, 14]], a)
      L.poly([[29, 21], [33, 25], [33, 20]], a)
      for (let x = 9; x <= 26; x += 3) { L.line(x, 17, x - 1, 14, b); L.line(x, 17, x - 1, 20, b) }
      L.line(8, 17, 28, 17, b)
      L.ellipse(18, 17, 4, 1.4, c)
      L.rect(31, 15, 2, 1, '#ffffff'); L.rect(31, 18, 2, 1, '#ffffff')
      L.set(32, 15, INK); L.set(32, 18, INK)
    },
    butterfly(L) {
      const b = '#2c2436'; const d = '#e5484d'; const c = '#f6c453'; const body = '#4a4250'
      L.ellipse(11, 11, 10, 4, b, -0.5)
      L.ellipse(29, 11, 10, 4, b, 0.5)
      L.ellipse(13, 21, 6, 4.5, b, 0.45)
      L.ellipse(27, 21, 6, 4.5, b, -0.45)
      L.ellipse(11, 11, 6, 1.5, d, -0.5)
      L.ellipse(29, 11, 6, 1.5, d, 0.5)
      L.thick(9, 21, 15, 24, c, 1.4); L.thick(31, 21, 25, 24, c, 1.4)
      L.ellipse(20, 16, 1.4, 8, body)
      L.disc(20, 8, 1.6, body)
      L.line(19, 7, 15, 1, body); L.line(21, 7, 25, 1, body)
      L.set(15, 1, c); L.set(25, 1, c)
    },
    naked_mole_rat(L) {
      const p = '#e9aaa0'; const b = '#c47f74'; const w = '#fffbe8'
      L.thick(6, 19, 2, 21, p, 1.2)
      L.rect(9, 23, 3, 2, b); L.rect(24, 23, 3, 2, b)
      L.ellipse(18, 18, 13, 6, p)
      L.ellipse(30, 17, 6, 4.8, p)
      L.ellipse(35, 18, 2.6, 2.6, p)
      L.recolor((x, y, col) => (col === p && x >= 7 && x <= 30 && x % 3 === 0 && y > 13 ? b : col === p && y >= 22 ? b : null))
      L.rect(36, 21, 2, 2, w)
      L.set(32, 15, INK)
    },
    bowhead_whale(L) {
      const a = '#6b88a6'; const b = '#465f7c'; const c = '#eef3f7'
      L.poly([[6, 17], [0, 11], [2, 17], [0, 23]], a)
      L.poly([[4, 17], [9, 14], [16, 12], [24, 11], [30, 9], [34, 10], [37, 13], [39, 16], [39, 19], [37, 22], [33, 25], [27, 26], [20, 25], [13, 22], [8, 20]], a)
      L.poly([[21, 24], [26, 25], [21, 29], [19, 28]], b)
      L.recolor((x, y, col) => (col === a && y >= 23 ? b : null))
      L.poly([[30, 22], [37, 21], [35, 24], [30, 25]], c)
      L.path([[39, 17], [37, 14], [34, 13], [31, 15], [29, 20]], INK)
      L.set(27, 20, INK)
    },
  }
  const SPECIES_AFTER = {
    mouse(L) { L.set(38, 15, '#e6d9c8'); L.set(39, 14, '#e6d9c8'); L.set(38, 19, '#e6d9c8'); L.set(39, 20, '#e6d9c8') },
    naked_mole_rat(L) { L.set(39, 16, '#f5c9c0'); L.set(39, 19, '#f5c9c0') },
    bowhead_whale(L) { L.set(31, 6, '#cfe4f2'); L.set(30, 4, '#cfe4f2'); L.set(32, 4, '#cfe4f2'); L.set(31, 3, '#ffffff'); L.set(29, 2, '#cfe4f2'); L.set(33, 2, '#cfe4f2') },
  }

  // ---- tools and milestones ---------------------------------------------------

  const TOOL = { bg: '#1f3a5f', grid: '#294b75', fg: '#e8f1ff', mid: '#9cc0ea', acc: '#ffd166' }
  const TOOL_ICONS = {
    search(L) { L.ring(16, 13, 7, TOOL.fg, 2); L.thick(21, 18, 29, 26, TOOL.fg, 2.6); L.set(13, 10, TOOL.acc); L.set(14, 9, TOOL.acc) },
    book(L) { L.rect(8, 7, 11, 18, TOOL.fg); L.rect(21, 7, 11, 18, TOOL.fg); L.rect(19, 6, 2, 20, TOOL.acc); for (const y of [11, 14, 17, 20]) { L.rect(10, y, 7, 1, TOOL.mid); L.rect(23, y, 7, 1, TOOL.mid) } },
    db(L) { L.rect(11, 8, 19, 16, TOOL.fg); L.ellipse(20, 8, 9.5, 3, TOOL.fg); L.ellipse(20, 24, 9.5, 3, TOOL.fg); L.ellipse(20, 8, 7, 1.4, TOOL.mid); L.rect(11, 14, 20, 1, TOOL.acc); L.rect(11, 19, 20, 1, TOOL.acc) },
    clock(L) { L.ring(20, 16, 10, TOOL.fg, 2); L.line(20, 16, 20, 9, TOOL.fg); L.line(20, 16, 25, 19, TOOL.acc); L.set(20, 16, TOOL.acc) },
    helix(L) { for (let y = 3; y <= 28; y += 1) { const s = Math.sin(y / 4); if (y % 3 === 0) L.line(20 - 6 * s, y, 20 + 6 * s, y, TOOL.mid); L.set(20 + 6 * s, y, TOOL.fg); L.set(21 + 6 * s, y, TOOL.fg); L.set(20 - 6 * s, y, TOOL.acc); L.set(19 - 6 * s, y, TOOL.acc) } },
    bench(L) { L.rect(10, 18, 5, 9, TOOL.mid); L.rect(18, 9, 5, 18, TOOL.acc); L.rect(26, 14, 5, 13, TOOL.fg); L.rect(7, 27, 27, 1, TOOL.fg) },
    review(L) { L.rect(12, 5, 16, 22, TOOL.fg); for (const y of [9, 12, 15]) L.rect(15, y, 10, 1, TOOL.mid); L.thick(15, 20, 18, 23, TOOL.acc, 2); L.thick(18, 23, 25, 16, TOOL.acc, 2) },
  }
  function toolWindow(glyph) {
    const B = new Raster(W, H, TOOL.bg)
    B.each((x, y) => { if (x % 4 === 0 || y % 4 === 0) B.set(x, y, TOOL.grid) })
    const L = new Raster(W, H)
    ;(TOOL_ICONS[glyph] || TOOL_ICONS.search)(L)
    return B.blit(L.outline(), 0, 0)
  }

  const MILE = { bg: '#d9b77f', bg2: '#cfa96e', fg: '#fff6e0', mid: '#8a5a2b', acc: '#e5484d' }
  const MILE_ICONS = {
    pen(L) { L.thick(11, 25, 25, 11, MILE.fg, 3.2); L.thick(25, 11, 28, 8, MILE.acc, 3.2); L.set(10, 26, MILE.mid) },
    brief(L) { L.rect(13, 7, 14, 20, MILE.fg); L.rect(17, 5, 6, 3, MILE.acc); for (const y of [12, 15, 18, 21]) L.rect(15, y, 10, 1, MILE.mid) },
    plus(L) { L.rect(17, 7, 6, 18, MILE.acc); L.rect(11, 13, 18, 6, MILE.acc) },
    calendar(L) { L.rect(10, 8, 20, 18, MILE.fg); L.rect(10, 8, 20, 4, MILE.acc); for (let y = 14; y <= 23; y += 3) for (let x = 12; x <= 27; x += 3) L.set(x, y, MILE.mid); L.rect(13, 6, 1, 3, MILE.mid); L.rect(26, 6, 1, 3, MILE.mid) },
    repeat(L) { L.ring(20, 16, 8, MILE.fg, 2); L.rect(18, 7, 5, 2, MILE.bg); L.rect(18, 23, 5, 2, MILE.bg); L.poly([[22, 5], [26, 8], [22, 11]], MILE.acc); L.poly([[18, 21], [14, 24], [18, 27]], MILE.acc) },
    flag(L) { L.rect(12, 5, 2, 23, MILE.mid); L.poly([[14, 6], [29, 10], [14, 15]], MILE.acc) },
    calc(L) { L.rect(13, 5, 14, 22, MILE.fg); L.rect(15, 7, 10, 5, MILE.mid); for (let y = 15; y <= 24; y += 3) for (let x = 16; x <= 24; x += 4) L.rect(x, y, 2, 2, y === 24 && x === 24 ? MILE.acc : MILE.mid) },
    ab(L) { L.rect(7, 10, 11, 13, MILE.fg); L.rect(22, 10, 11, 13, MILE.acc); L.line(19, 16, 21, 16, MILE.mid); L.line(12, 20, 12, 13, MILE.mid); L.line(12, 13, 14, 13, MILE.mid); L.line(14, 13, 14, 20, MILE.mid); L.line(12, 16, 14, 16, MILE.mid) },
  }
  function milestoneWindow(glyph) {
    const B = new Raster(W, H, MILE.bg)
    B.each((x, y) => { if ((x + y) % 2 === 0 && (x * 7 + y * 3) % 5 === 0) B.set(x, y, MILE.bg2) })
    B.ring(33, 7, 5, MILE.acc)
    B.ring(33, 7, 3, MILE.bg2)
    const L = new Raster(W, H)
    ;(MILE_ICONS[glyph] || MILE_ICONS.pen)(L)
    return B.blit(L.outline(), 0, 0)
  }

  // ---- card frame -----------------------------------------------------------

  function frame(kind, dark) {
    const f = FRAMES[kind] || FRAMES.cell
    const r = new Raster(CARD_W, CARD_H)
    const paper = dark ? PAPER.dark : PAPER.light
    const shade = dark ? PAPER.darkShade : PAPER.shade
    r.each((x, y) => {
      const xr = CARD_W - 1 - x
      const yb = CARD_H - 1 - y
      if (Math.min(x, xr) + Math.min(y, yb) < 2 && Math.min(x, xr) < 2 && Math.min(y, yb) < 2) return
      const e = Math.min(x, y, xr, yb)
      let col
      if (e === 0) col = INK
      else if (e <= 3) col = (x === 1 || y === 1) && e === 1 ? f.l : (xr === 1 || yb === 1) && e === 1 ? f.d : f.b
      else col = e === 4 ? shade : paper
      r.set(x, y, col)
    })
    r.each((x, y) => {
      if (!r.get(x, y)) return
      const empty = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.get(x + dx, y + dy) == null)
      if (empty) r.set(x, y, INK)
    })
    // window border, banner box
    r.rect(WIN.x - 1, WIN.y - 1, WIN.w + 2, WIN.h + 2, INK)
    r.rect(5, 50, 40, 11, INK)
    r.rect(6, 51, 38, 9, '#232a30')
    r.rect(6, 51, 38, 1, '#3c464e')
    return r
  }

  function pips(r, rank, kind) {
    const f = FRAMES[kind]
    for (let i = 0; i < 4; i += 1) {
      const x = 5 + i * 4
      r.rect(x, 46, 3, 2, INK)
      if (i <= rank) { r.rect(x, 46, 3, 2, f.b); r.set(x, 46, f.l) }
    }
  }

  function lifespanBar(r, years) {
    const lo = Math.log10(7 / 365)
    const hi = Math.log10(300)
    const at = (y) => Math.round(5 + ((Math.log10(y) - lo) / (hi - lo)) * 39)
    r.rect(5, 47, 40, 1, '#4b5566')
    for (const y of [1 / 12, 1, 10, 100]) r.rect(at(y), 46, 1, 3, '#8796b0')
    r.rect(at(80), 45, 1, 4, '#ffffff')
    if (years) { const x = at(years); r.rect(x - 1, 44, 3, 1, '#f2b53a'); r.set(x, 45, '#f2b53a') }
  }

  const TIER_RANK = { cell: 0, animal: 1, human: 2, trial: 3 }

  function studyFace(card) {
    return cached(`s:${card.id}`, () => {
      const r = frame(card.tier, false)
      const p = CHAPTERS[card.art.motif] || CHAPTERS.clock
      r.blit((MOTIFS[card.art.motif] || MOTIFS.clock)(rng(card.art.seed), p), WIN.x, WIN.y)
      pips(r, TIER_RANK[card.tier], card.tier)
      return toURL(r)
    })
  }
  function speciesFace(sp, locked) {
    return cached(`sp:${sp.key}:${locked ? 1 : 0}`, () => {
      const r = frame('species', true)
      r.blit(speciesWindow(sp.key, locked), WIN.x, WIN.y)
      if (!locked) lifespanBar(r, sp.lifespan_years)
      return toURL(r)
    })
  }
  function toolFace(tool) {
    return cached(`t:${tool.glyph}`, () => frameWith('tool', toolWindow(tool.glyph)))
  }
  function milestoneFace(m) {
    return cached(`f:${m.glyph}`, () => frameWith('milestone', milestoneWindow(m.glyph)))
  }
  function frameWith(kind, win) {
    const r = frame(kind, false)
    r.blit(win, WIN.x, WIN.y)
    return toURL(r)
  }

  /** The deck back: what an unopened card and an empty album slot look like. */
  function back() {
    return cached('back', () => {
      const f = FRAMES.back
      const r = frame('back', true)
      for (let y = 5; y < CARD_H - 5; y += 1) for (let x = 5; x < CARD_W - 5; x += 1) {
        const lattice = (x + y) % 6 === 0 || (x - y + 60) % 6 === 0
        r.set(x, y, lattice ? '#1f525a' : '#163a42')
      }
      const L = new Raster(CARD_W, CARD_H)
      L.rect(15, 27, 20, 3, PAPER.light)
      L.rect(18, 30, 3, 12, PAPER.light)
      L.rect(29, 30, 3, 10, PAPER.light)
      L.rect(31, 40, 3, 2, PAPER.light)
      L.rect(15, 27, 20, 1, '#fffaf0')
      for (const [x, y] of [[10, 10], [39, 10], [10, 59], [39, 59]]) { L.set(x, y - 1, f.l); L.set(x - 1, y, f.l); L.set(x + 1, y, f.l); L.set(x, y + 1, f.l); L.set(x, y, '#f2b53a') }
      r.blit(L.outline(), 0, 0)
      return toURL(r)
    })
  }

  // ---- small sprites ------------------------------------------------------------

  function gem(tier) {
    return cached(`gem:${tier}`, () => {
      const f = FRAMES[tier] || FRAMES.cell
      const r = new Raster(9, 9)
      r.poly([[4, 0.5], [8, 4.5], [4, 8.5], [0, 4.5]], f.b)
      r.recolor((x, y) => (x + y < 7 && x < 5 && y < 5 ? f.l : x + y > 9 ? f.d : null))
      r.set(3, 3, '#ffffff')
      return toURL(r.outline())
    })
  }

  function seal(kind) {
    return cached(`seal:${kind}`, () => {
      const col = kind === 'ran' ? { b: '#e5484d', l: '#ff8a8d', d: '#9c2a2e' } : { b: '#2f8fe6', l: '#7cc0ff', d: '#1a5a9c' }
      const r = new Raster(11, 11)
      r.rect(1, 1, 9, 9, col.b)
      r.set(1, 1, null); r.set(9, 1, null); r.set(1, 9, null); r.set(9, 9, null)
      r.rect(2, 1, 7, 1, col.l); r.rect(1, 2, 1, 7, col.l)
      r.rect(2, 9, 7, 1, col.d); r.rect(9, 2, 1, 7, col.d)
      if (kind === 'ran') { r.rect(3, 4, 5, 1, '#ffffff'); r.rect(3, 6, 5, 1, '#ffffff') }
      else { r.set(3, 5, '#ffffff'); r.set(4, 6, '#ffffff'); r.set(5, 7, '#ffffff'); r.set(6, 6, '#ffffff'); r.set(7, 5, '#ffffff'); r.set(8, 4, '#ffffff') }
      return toURL(r.outline())
    })
  }

  const EMBLEMS = {
    clock(r, c) { r.ring(5, 5, 4, c); r.line(5, 5, 5, 2, c); r.line(5, 5, 7, 6, c) },
    organ(r, c) { r.ellipse(5, 5, 4, 3.5, c); r.ellipse(5, 5, 1.6, 1.4, null) },
    brain(r, c) { r.disc(5, 5, 1.4, c); r.line(5, 5, 5, 1, c); r.line(5, 5, 1, 8, c); r.line(5, 5, 9, 8, c); r.line(5, 5, 1, 3, c); r.line(5, 5, 9, 3, c) },
    immune(r, c) { r.disc(5, 5, 2.4, c); for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2; r.set(5 + Math.cos(a) * 4.2, 5 + Math.sin(a) * 4.2, c) } },
    repair(r, c) { r.rect(1, 3, 9, 5, c); r.set(1, 3, null); r.set(9, 3, null); r.set(1, 7, null); r.set(9, 7, null); r.set(3, 4, null); r.set(5, 6, null); r.set(7, 4, null) },
    tissue(r, c) { for (const y of [2, 5, 8]) for (let x = 0; x <= 10; x += 1) r.set(x, y + (x % 4 < 2 ? 0 : 1), c) },
    gene(r, c) { for (let y = 0; y <= 10; y += 1) { const s = Math.sin(y / 1.7); r.set(5 + 3 * s, y, c); r.set(5 - 3 * s, y, c) } },
    span(r, c) { r.line(1, 0, 1, 9, c); r.line(1, 9, 10, 9, c); r.path([[2, 1], [5, 2], [7, 5], [9, 8]], c) },
  }
  function emblem(motif, color) {
    return cached(`em:${motif}:${color || ''}`, () => {
      const r = new Raster(11, 11)
      ;(EMBLEMS[motif] || EMBLEMS.clock)(r, color || PAPER.light)
      return toURL(r)
    })
  }

  const PACKS = {
    daily: { b: '#43a862', l: '#8fe0a3', d: '#26703f', band: '#f4ead5', fg: '#f4ead5', acc: '#ffd166' },
    care:  { b: '#8a5cd6', l: '#cdb0ff', d: '#4a2c86', band: '#f2b53a', fg: '#f4ead5', acc: '#f2b53a' },
    pick:  { b: '#ef8a2a', l: '#ffc27a', d: '#a35210', band: '#232a30', fg: '#fff6e0', acc: '#e5484d' },
  }
  const PACK_EMBLEMS = {
    daily(L, p) { L.thick(15, 23, 15, 12, p.fg, 2); L.ellipse(11.5, 14.5, 4, 1.8, '#c8f5b0', 0.7); L.ellipse(18.5, 11.5, 4, 1.8, '#c8f5b0', -0.7); L.rect(10, 23, 11, 2, '#7a4f26') },
    care(L, p) { L.rect(10, 9, 11, 14, p.fg); L.rect(13, 7, 5, 3, p.acc); for (const y of [13, 16, 19]) L.rect(12, y, 7, 1, '#8a5cd6') },
    pick(L, p) { L.rect(6, 11, 7, 10, p.fg); L.rect(12, 9, 7, 10, p.acc); L.rect(18, 11, 7, 10, p.fg) },
  }
  function pack(kind) {
    return cached(`pack:${kind}`, () => {
      const p = PACKS[kind] || PACKS.daily
      const w = 30
      const h = 42
      const r = new Raster(w, h)
      for (let x = 1; x < w - 1; x += 1) {
        const tooth = x % 4 < 2 ? 0 : 1
        for (let y = tooth; y < h - tooth; y += 1) r.set(x, y, p.b)
      }
      r.recolor((x, y) => (x <= 3 ? p.l : x >= w - 4 ? p.d : (x === 7 || x === 8) && y > 4 && y < 37 && !(y >= 27 && y <= 31) ? p.l : null))
      r.rect(1, 3, w - 2, 1, p.d); r.rect(1, h - 4, w - 2, 1, p.d)
      r.rect(1, 27, w - 2, 5, p.band)
      for (let x = 4; x < w - 4; x += 3) r.set(x, 29, p.d)
      const L = new Raster(w, h)
      ;(PACK_EMBLEMS[kind] || PACK_EMBLEMS.daily)(L, p)
      L.outline()
      r.blit(L, 0, 0)
      return toURL(r.outline())
    })
  }

  // ---- background ------------------------------------------------------------------

  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
  const SWIRL = [[12, 34, 38], [16, 44, 48], [21, 56, 58], [27, 70, 69], [35, 86, 80]]
  function swirl(canvas) {
    const w = 192
    const h = 108
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(w, h)
    let t = 0
    const frameOnce = () => {
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        const u = (x - w / 2) / h
        const v = (y - h / 2) / h
        const rr = Math.hypot(u, v)
        const a = Math.atan2(v, u)
        const s = Math.sin(a * 2 + rr * 9 - t * 0.5 + Math.sin(rr * 5 + t * 0.25) * 1.4)
        const val = (s + 1) * 0.36 + rr * 0.45
        const idx = Math.max(0, Math.min(4, Math.floor(val * 4 + BAYER[y % 4][x % 4] / 16 - 0.5)))
        const [cr, cg, cb] = SWIRL[4 - idx]
        const i = (y * w + x) * 4
        img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      t += 0.06
    }
    frameOnce()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setInterval(frameOnce, 80)
  }

  root.PixelArt = { studyFace, speciesFace, toolFace, milestoneFace, back, gem, seal, emblem, pack, swirl, FRAMES, CHAPTERS, PACKS, CARD_W, CARD_H }
})(globalThis)
