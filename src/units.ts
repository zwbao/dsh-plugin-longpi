// Unit and name normalization. Mirrors tools/skillkit/skillkit.py in
// longevity-skills: normalize_unit, fold_name and name_variants must return the
// same strings, checked by the shared schema/unit_cases.json.

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
}

const UNIT_ALIASES: Record<string, string> = {
  '岁': 'a', '年': 'a', years: 'a', year: 'a', yr: 'a', yrs: 'a', y: 'a',
  '小时': 'h', hours: 'h', hour: 'h', hr: 'h', hrs: 'h',
  '分钟': 'min', minutes: 'min', minute: 'min', mins: 'min',
  '天': 'd', days: 'd', day: 'd',
  '毫米汞柱': 'mmhg',
  'kg/m2': 'kg/m^2',
  '公斤': 'kg', '千克': 'kg', '克': 'g',
  '厘米': 'cm', '米': 'm', '毫米': 'mm',
  'k/ul': '10^3/ul', '10^3/mm^3': '10^3/ul', '10^3/mm3': '10^3/ul', 'thou/ul': '10^3/ul',
  '克/升': 'g/l', '克/分升': 'g/dl', '毫克/分升': 'mg/dl', '毫克/升': 'mg/l',
  '毫摩尔/升': 'mmol/l', '微摩尔/升': 'umol/l', '纳摩尔/升': 'nmol/l',
  '飞升': 'fl', '皮克': 'pg',
  '单位/升': 'u/l',
  '次/分': '/min', '次/分钟': '/min', bpm: '/min',
  ratio: '1', fraction: '1',
}

export function normalizeUnit(text: string | null | undefined): string {
  if (text == null) return ''
  let s = String(text)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^${[...run].map((char) => SUPERSCRIPTS[char] ?? '').join('')}`)
  s = s.normalize('NFKC')
  s = s.replace(/µ/g, 'u').replace(/μ/g, 'u')
  s = s.toLowerCase()
  s = s.replace(/\s+/g, '')
  s = s.replace(/^[×x*](?=10)/, '')
  s = s.replace(/10\*(\d+)/g, '10^$1')
  s = s.replace(/\^\^/g, '^')
  if (s.startsWith('iu/')) s = s.slice(1)
  return UNIT_ALIASES[s] ?? s
}

export function foldName(text: string): string {
  return String(text).normalize('NFKC').toLowerCase().replace(/[\s_\-·•:：,，/\\]+/g, '')
}

export function nameVariants(text: string): string[] {
  const raw = String(text).normalize('NFKC').trim()
  const found: string[] = []
  const add = (value: string) => {
    const folded = foldName(value)
    if (folded && !found.includes(folded)) found.push(folded)
  }
  add(raw)
  add(raw.replace(/[(\[（【][^)\]）】]*[)\]）】]/g, ' '))
  for (const match of raw.matchAll(/[(\[（【]([^)\]）】]*)[)\]）】]/g)) add(match[1] ?? '')
  return found
}

export function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  let text = raw.normalize('NFKC').trim()
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '')
  if (/^[<>≤≥]/.test(text) || text === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}
