// M8 seams (AA §3.6). C0 stub: nothing runs while scienceMode is 'off'.

import type { FactPack } from '../contracts/factpack.ts'

export function scienceSummary(): FactPack['science'] {
  return { mode: 'off', active_studies: 0 }
}
