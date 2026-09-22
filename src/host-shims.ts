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
