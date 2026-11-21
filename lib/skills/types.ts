/**
 * Agent Skills Standard Types
 * Conforms to the open Agent Skills specification (https://agentskills.io/)
 */

export type SkillSourceType = 'local' | 'github' | 'builtin' | 'remote'

export interface SkillSource {
  type: SkillSourceType
  uri: string
  branch?: string
  directory?: string
}

export interface SkillDescriptor {
  id: string
  name: string
  description: string
  source: SkillSource
  content: string // Full SKILL.md Markdown
  references?: Record<string, string> // Optional reference documents (path -> text)
  version?: string
  commitSha?: string
  enabled: boolean
  trusted: boolean
  createdAt: number
  updatedAt: number
}

export interface ParsedSkillMd {
  name: string
  description: string
  body: string
  metadata: Record<string, unknown>
}
