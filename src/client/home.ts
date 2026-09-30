// LongPi no longer changes DSH's blank-session home: the greeting that used to
// take the headline's place, and the row of pills under the composer, are gone.
// HomeHero stays as an export (client/index.ts still imports it) and renders
// nothing; nothing registers it in a slot. The prompt bridge that puts a
// prompt into the composer lives on in home-actions.ts.

import type React from 'react'
import type { Face } from './types.ts'

export function HomeHero(_props: Partial<Face>): React.ReactElement | null {
  return null
}
