import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

export interface MirobodyConfig {
  pythonBin: string
  mirobodyHome: string
  mcpUrl: string
  mcpToken: string
  timeoutMs: number
}

export interface MountState {
  mounted: boolean
  peer: boolean
  error: string
  pluginHome: string
}

export async function mountMirobody(ctx: Context, config: MirobodyConfig, pluginHome: string): Promise<MountState> {
  if (!pluginHome) {
    return { mounted: false, peer: false, error: 'dsh-plugin-mirobody not found: vendor/dsh-plugin-mirobody is missing from this install, and mirobodyPluginHome is empty', pluginHome: '' }
  }
  try {
    const loaded = await import(pathToFileURL(join(pluginHome, 'lib', 'index.js')).href) as {
      apply?: (ctx: Context, config: MirobodyConfig) => void | Promise<void>
    }
    if (typeof loaded.apply !== 'function') {
      return { mounted: false, peer: false, error: 'mirobody plugin has no apply()', pluginHome }
    }
    await loaded.apply(ctx, config)
    return { mounted: true, peer: false, error: '', pluginHome }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('already registered')) {
      return { mounted: true, peer: true, error: '', pluginHome }
    }
    // A checkout outside the DSH profile cannot see the host's packages (@deepseek-ai/*).
    const hint = message.includes('Cannot find package')
      ? ' (mirobodyPluginHome points outside the DSH profile; leave it empty to use the copy shipped with dsh-plugin-longpi)'
      : ''
    return { mounted: false, peer: false, error: `${message.slice(0, 400)}${hint}`, pluginHome }
  }
}
