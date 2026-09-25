// A fresh DeepSeek Harness has no workspace, so it opens no session and the
// composer stays inert: nothing LongPi puts next to it can show. When the
// host's workspace registry is there and empty, register one folder under the
// data directory as 「健康」, once. A marker file records that it was done, so a
// workspace the person later deletes is never created again, and a registry
// that already has workspaces is never touched.

import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The part of DSH's workspaceRegistry service (@deepseek-ai/dsh-workspace) this uses. */
export interface WorkspaceRegistryLike {
  list(): ReadonlyArray<{ id: string; path: string }>
  create(path: string, title?: string): Promise<{ id: string; path: string }>
}

export const WORKSPACE_MARKER = 'workspace-bootstrap.json'
export const WORKSPACE_DIR = 'workspace'
export const WORKSPACE_TITLE = '健康'

export type BootstrapResult =
  | { status: 'created'; path: string; workspace_id: string }
  | { status: 'disabled' | 'done_before' | 'not_empty' | 'no_registry' }
  | { status: 'error'; error: string }

/** Create the 健康 workspace when the registry is empty and it was never created before. Never throws. */
export async function bootstrapWorkspace(
  registry: WorkspaceRegistryLike | null | undefined,
  options: { dataDir: string; enabled: boolean; now?: Date },
): Promise<BootstrapResult> {
  try {
    if (!options.enabled) return { status: 'disabled' }
    if (!registry || typeof registry.list !== 'function' || typeof registry.create !== 'function') return { status: 'no_registry' }
    const marker = join(options.dataDir, WORKSPACE_MARKER)
    if (existsSync(marker)) return { status: 'done_before' }
    if (registry.list().length > 0) return { status: 'not_empty' }
    const dir = join(options.dataDir, WORKSPACE_DIR)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    // The registry keys workspaces by canonical path; give it one (a symlinked home resolves here).
    const path = realpathSync(dir)
    const workspace = await registry.create(path, WORKSPACE_TITLE)
    const row = { created_at: (options.now ?? new Date()).toISOString(), path, workspace_id: String(workspace.id) }
    writeFileSync(marker, `${JSON.stringify(row, null, 2)}\n`, { mode: 0o600 })
    return { status: 'created', path, workspace_id: row.workspace_id }
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) }
  }
}
