declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: {
      inject: (name: string, factory: () => unknown) => unknown
      register: (options: Record<string, unknown>, component: unknown) => unknown
    }
    skills: {
      register(skill: {
        name: string
        description: string
        content: string
        source?: string
        invocation?: { modelInvocable: boolean; userInvocable: boolean }
      }): () => void
      /** dsh-skill registry. Lower rank wins a duplicate name. list is the index; get loads the body. */
      registerProvider(create: (control: { signal: AbortSignal; invalidate: () => void }) => {
        name: string
        list: (options: { cwd?: string; signal?: AbortSignal }) => Promise<readonly {
          name: string
          description: string
          whenToUse?: string
          invocation: { modelInvocable: boolean; userInvocable: boolean }
          source: string
          provider: string
          rank: number
          locator: unknown
          path?: string
          resourceBase?: { kind: 'directory'; path: string }
          metadata?: Readonly<Record<string, unknown>>
        }[]>
        get: (candidate: { name: string; locator?: unknown }, options: { cwd?: string; signal?: AbortSignal }) => Promise<{
          name: string
          description: string
          whenToUse?: string
          invocation: { modelInvocable: boolean; userInvocable: boolean }
          source: string
          provider: string
          content: string
          path?: string
          resourceBase?: { kind: 'directory'; path: string }
          metadata?: Readonly<Record<string, unknown>>
        } | undefined>
      }): () => void
    }
    systemPrompt: {
      section(section: {
        name: string
        order: number
        text: string | (() => string)
      }): unknown
    }
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void
      }): () => void
    }
    commands: {
      register(definition: {
        name: string
        description: string
        handler: (invocation: { rawInput: string }) => { kind: 'success' | 'error'; text?: string }
      }): unknown
    }
  }
}

export {}
