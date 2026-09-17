import React from 'react'

const ORDER = ['biological', 'physiological', 'psychological', 'behavioral', 'social_env'] as const

export function ModuleRadar(props: {
  chrono: number
  modules: Record<string, { age: number; label_zh: string }>
}): React.ReactElement {
  const cx = 110
  const cy = 110
  const maxR = 88
  const minAge = props.chrono - 10
  const maxAge = props.chrono + 10

  const point = (i: number, age: number) => {
    const t = (i / ORDER.length) * Math.PI * 2 - Math.PI / 2
    const tNorm = Math.min(1, Math.max(0, (age - minAge) / (maxAge - minAge)))
    const r = 28 + tNorm * (maxR - 28)
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r] as const
  }

  const chronoPts = ORDER.map((_, i) => point(i, props.chrono).join(',')).join(' ')
  const modulePts = ORDER.map((key, i) => point(i, props.modules[key]?.age ?? props.chrono).join(',')).join(' ')

  return React.createElement(
    'svg',
    { className: 'lp-radar', viewBox: '0 0 220 240', width: 220, height: 240, 'aria-hidden': true },
    React.createElement('polygon', { points: chronoPts, fill: 'none', stroke: '#C7D9D5', strokeDasharray: '4 4' }),
    React.createElement('polygon', { points: modulePts, fill: 'rgba(45,95,90,0.14)', stroke: '#2D5F5A', strokeWidth: 2 }),
    ...ORDER.map((key, i) => {
      const [x, y] = point(i, props.modules[key]?.age ?? props.chrono)
      const label = props.modules[key]?.label_zh ?? key
      const lx = cx + Math.cos((i / ORDER.length) * Math.PI * 2 - Math.PI / 2) * 104
      const ly = cy + Math.sin((i / ORDER.length) * Math.PI * 2 - Math.PI / 2) * 104
      return React.createElement(
        React.Fragment,
        { key },
        React.createElement('circle', { cx: x, cy: y, r: 3.5, fill: '#2D5F5A' }),
        React.createElement('text', { x: lx, y: ly, textAnchor: 'middle', className: 'lp-radar-label' }, label),
      )
    }),
  )
}
