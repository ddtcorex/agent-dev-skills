import { readdir, readFile, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { Context } from '@deepseek-ai/cordis'
import type {
  SkillCandidate,
  SkillDefinition,
  SkillLookupOptions,
  SkillProviderControl,
} from '@deepseek-ai/dsh-skill'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SKILLS_DIR = resolve(__dirname, '../skills')

export const name = 'agent-dev-skills'
export const inject = ['skills']

export interface Config {
  /** Optional custom directory path holding skills folders. Defaults to `./skills`. */
  skillsDir?: string
  /** Provider precedence rank. Default: 350. */
  rank?: number
}

interface Frontmatter {
  name?: string
  description?: string
  [key: string]: unknown
}

function parseFrontmatter(rawContent: string): { metadata: Frontmatter; body: string } {
  if (!rawContent.startsWith('---')) {
    return { metadata: {}, body: rawContent }
  }
  const endIdx = rawContent.indexOf('\n---', 3)
  if (endIdx === -1) {
    return { metadata: {}, body: rawContent }
  }
  const yamlText = rawContent.slice(3, endIdx).trim()
  const body = rawContent.slice(endIdx + 4).trim()
  const metadata: Frontmatter = {}

  for (const line of yamlText.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      let val = line.slice(colonIdx + 1).trim()
      if (val.startsWith('|') || val.startsWith('>')) {
        val = ''
      }
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1)
      }
      metadata[key] = val
    }
  }

  return { metadata, body }
}

export function apply(ctx: Context, config: Config = {}) {
  const skillsDir = config.skillsDir ? resolve(config.skillsDir) : DEFAULT_SKILLS_DIR
  const rank = config.rank ?? 350

  const unregister = ctx.skills.registerProvider((_control: SkillProviderControl) => {
    return {
      name: 'agent-dev-skills',
      async list(_options: SkillLookupOptions) {
        const candidates: SkillCandidate[] = []
        try {
          const entries = await readdir(skillsDir)
          for (const entry of entries) {
            const skillFolder = join(skillsDir, entry)
            const st = await stat(skillFolder).catch(() => null)
            if (!st || !st.isDirectory()) continue

            const skillFilePath = join(skillFolder, 'SKILL.md')
            const fileSt = await stat(skillFilePath).catch(() => null)
            if (!fileSt || !fileSt.isFile()) continue

            const rawContent = await readFile(skillFilePath, 'utf-8').catch(() => '')
            const { metadata } = parseFrontmatter(rawContent)
            const skillName = metadata.name || entry
            const description = metadata.description || `Skill for ${skillName}`

            candidates.push({
              name: skillName,
              description,
              invocation: { modelInvocable: true, userInvocable: true },
              source: 'custom',
              provider: 'agent-dev-skills',
              rank,
              locator: skillFilePath,
              path: skillFilePath,
              resourceBase: { kind: 'directory', path: skillFolder },
              metadata,
            })
          }
        } catch {
          // If directory reading fails, return empty candidates
        }
        return candidates
      },

      async get(candidate: SkillCandidate, _options: SkillLookupOptions) {
        const filePath = candidate.locator as string
        try {
          const rawContent = await readFile(filePath, 'utf-8')
          const { metadata, body } = parseFrontmatter(rawContent)
          return {
            name: candidate.name,
            description: candidate.description,
            invocation: candidate.invocation,
            source: candidate.source,
            provider: candidate.provider,
            resourceBase: candidate.resourceBase,
            path: filePath,
            content: body,
            metadata,
          }
        } catch {
          return undefined
        }
      },
    }
  })

  ctx.effect(() => unregister)
}
