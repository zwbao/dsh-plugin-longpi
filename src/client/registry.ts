// Client registries (AA §3.1): modules add page tabs, overview cards, tool views, turn-tail actions and
// settings/profile sections here instead of editing client/index.ts.

import type * as React from 'react'

export interface PageTab { id: string; label_zh: string; order: number; Component: React.ComponentType<Record<string, unknown>> }
export interface OverviewCard { id: string; order: number; Component: React.ComponentType<Record<string, unknown>> }
export interface ToolView { tool: string; Component: React.ComponentType<Record<string, unknown>> }
export interface TurnTailAction { id: string; order: number; Component: React.ComponentType<Record<string, unknown>> }
export interface Section { id: string; order: number; Component: React.ComponentType<Record<string, unknown>> }

const tabs: PageTab[] = []
const overview: OverviewCard[] = []
const toolViews: ToolView[] = []
const turnTail: TurnTailAction[] = []
const settings: Section[] = []
const profile: Section[] = []

function add<T>(list: T[], row: T): () => void {
  list.push(row)
  return () => {
    const at = list.indexOf(row)
    if (at >= 0) list.splice(at, 1)
  }
}

const byOrder = <T extends { order: number }>(list: T[]): T[] => [...list].sort((a, b) => a.order - b.order)

export const registerPageTab = (tab: PageTab) => add(tabs, tab)
export const registerOverviewCard = (card: OverviewCard) => add(overview, card)
export const registerToolView = (view: ToolView) => add(toolViews, view)
export const registerTurnTailAction = (action: TurnTailAction) => add(turnTail, action)
export const registerSettingsSection = (section: Section) => add(settings, section)
export const registerProfileSection = (section: Section) => add(profile, section)

export const pageTabs = () => byOrder(tabs)
export const overviewCards = () => byOrder(overview)
export const toolViewList = () => [...toolViews]
export const turnTailActions = () => byOrder(turnTail)
export const settingsSections = () => byOrder(settings)
export const profileSections = () => byOrder(profile)
