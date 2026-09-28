// The overview reads the same grader as the server. Registered as a card; ResultsRow
// also mounts it, because the overview does not walk the card registry yet.

import React from 'react'
import { registerOverviewCard } from '../registry.ts'
import type { Journey, Tracking } from '../types.ts'
import {
  buildFeedback,
  markerFromChange,
  markerFromEngine,
  type BehaviourInput,
  type BioAgeInput,
  type FeedbackInput,
  type ProjectionInput,
} from '../../feedback/grade.ts'
import type { FeedbackMessage } from '../../contracts/feedback.ts'
import { shareCard, type ShareCardModel } from '../../feedback/share.ts'
import { FeedbackCard } from './feedback-card.ts'
import { ShareCard } from './share-card.ts'

const h = React.createElement

interface BioLoose {
  points?: Array<{ date: string; phenoage: number; advance: number | null }>
  band_years?: number | null
  band_verified?: boolean
}

export function feedbackInputOf(journey: Journey, tracking: Tracking | null): FeedbackInput {
  const markers = []
  const seen = new Set<string>()
  for (const item of tracking?.items ?? []) {
    for (const verdict of item.verdicts ?? []) {
      const key = verdict.indicator || verdict.marker
      const row = markerFromEngine(verdict, key)
      if (seen.has(row.label_zh)) continue
      seen.add(row.label_zh)
      markers.push(row)
    }
  }
  for (const change of journey.changes ?? []) {
    if (seen.has(change.label_zh) || seen.has(change.key)) continue
    seen.add(change.label_zh)
    markers.push(markerFromChange(change))
  }
  const loose = tracking?.bioage as BioLoose | undefined
  const points = loose?.points ?? []
  const result = journey.results.bioage
  const bio: BioAgeInput = {
    points,
    band_years: loose?.band_years ?? result.band_years,
    band_verified: loose?.band_verified === true,
    age: journey.profile.age,
    phenoage: points.at(-1)?.phenoage ?? result.phenoage,
    advance: points.at(-1)?.advance ?? result.advance,
    date: points.at(-1)?.date ?? result.date,
    draws: points.length > 0 ? points.length : result.checkups,
    same_lab: null,
  }
  const behaviours: BehaviourInput[] = (journey.plan.checkin_items ?? [])
    .filter((item) => item.done_today === true)
    .map((item) => ({ key: item.id, title_zh: item.title, date: journey.today }))
  const pheno = tracking?.models?.find((card) => card.model === 'phenoage')
  const projections: ProjectionInput[] = (pheno?.levers ?? []).slice(0, 4).map((row) => ({
    label_zh: row.label,
    from_zh: row.from,
    target_zh: row.to,
    years: row.years,
  }))
  return {
    today: journey.today,
    markers,
    bioage: result.status === 'ok' || points.length > 0 ? bio : null,
    behaviours,
    projections,
  }
}

export function messagesFor(journey: Journey, tracking: Tracking | null): FeedbackMessage[] {
  return buildFeedback(feedbackInputOf(journey, tracking))
}

export function shareFor(journey: Journey, tracking: Tracking | null): ShareCardModel | null {
  return shareCard(messagesFor(journey, tracking))
}

type Notify = (text: string, tone?: 'info' | 'good' | 'bad') => void

export function FeedbackBlock(props: { journey?: Journey; tracking?: Tracking | null; onNotice?: Notify }): React.ReactElement | null {
  if (!props.journey) return null
  const messages = messagesFor(props.journey, props.tracking ?? null)
  const summary = messages.find((row) => row.id === 'fb-summary')
  const behaviour = messages.find((row) => row.grade === 'behaviour_done')
  const projection = messages.find((row) => row.grade === 'projection')
  const share = shareCard(messages)
  const shown = [summary, behaviour, projection].filter((row): row is FeedbackMessage => row != null)
  if (shown.length === 0 && !share) return null
  return h(React.Fragment, null,
    shown.length > 0 ? h(FeedbackCard, { messages: shown }) : null,
    share ? h(ShareCard, { card: share, onNotice: props.onNotice }) : null)
}

registerOverviewCard({
  id: 'feedback',
  order: 25,
  Component: FeedbackBlock as unknown as React.ComponentType<Record<string, unknown>>,
})
