// Amounts of a drug or supplement, for the guard's output check.
// DEDUP: a local copy until A2's shared src/dose.ts merges; then import from there and delete this file.
// Same shape as DOSE in tools-followup.ts, with the Chinese numerals and units of the 8c list.

const CN_NUMBER = '[零〇一二两三四五六七八九十百千万半]+'
const NUMBER = `(?:\\d+(?:\\.\\d+)?|${CN_NUMBER})`

// Units that only a medicine or supplement is counted in.
const PHARMA_UNIT = '(?:mg|mcg|µg|μg|ug|iu|毫克|微克|国际单位|片|粒|胶囊|丸|颗|tablets?|capsules?|pills?|softgels?)'
// Units a food or a drink is measured in too: a dose only next to a medicine name.
const SHARED_UNIT = '(?:g|ml|(?<!千)克|毫升|单位|units?|滴|drops?|勺|袋)'

// A concentration (mmol/L, mg/dL, g/L) is a lab value, not an amount taken.
const NOT_CONCENTRATION = '(?!\\s*\\/\\s*(?:d?l|ml|kg|m2)\\b)'

/** A number with a unit a medicine or supplement is taken in: 500 mg, 两片, 1000 IU. */
export const PHARMA_DOSE = new RegExp(`${NUMBER}\\s*${PHARMA_UNIT}${NOT_CONCENTRATION}(?![a-z])`, 'i')

/** A number with a unit shared with food (克, ml, 滴): a dose only when a medicine is named nearby. */
export const SHARED_DOSE = new RegExp(`${NUMBER}\\s*${SHARED_UNIT}${NOT_CONCENTRATION}(?![a-z])`, 'i')

/** Any amount that could be a dose. */
export function hasDoseAmount(text: string): boolean {
  const plain = text.normalize('NFKC')
  return PHARMA_DOSE.test(plain) || SHARED_DOSE.test(plain)
}
