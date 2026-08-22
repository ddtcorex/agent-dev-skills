declare module '@deepseek-ai/cordis' {
  export interface Context {
    skills: any
    effect(cb: () => void): () => void
    /** Cordis logger; available on every plugin context. */
    logger: { info(fmt: string, ...args: unknown[]): void; warn(fmt: string, ...args: unknown[]): void }
  }
}

declare module '@deepseek-ai/dsh-skill' {
  export interface SkillCandidate {
    name: string
    description: string
    invocation: { modelInvocable: boolean; userInvocable: boolean }
    source: string
    provider: string
    rank: number
    locator: unknown
    path?: string
    resourceBase?: { kind: 'directory'; path: string }
    metadata?: Record<string, unknown>
  }

  export interface SkillDefinition {
    name: string
    description: string
    invocation: { modelInvocable: boolean; userInvocable: boolean }
    source: string
    provider: string
    resourceBase?: { kind: 'directory'; path: string }
    path?: string
    content: string
    metadata?: Record<string, unknown>
  }

  export interface SkillLookupOptions {
    cwd?: string
    signal?: AbortSignal
  }

  export interface SkillProviderControl {
    signal: AbortSignal
    invalidate: () => void
  }
}
