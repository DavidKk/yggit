import type { ParsedSkillMd } from './types'

/**
 * Parses SKILL.md containing optional YAML frontmatter.
 * Format:
 * ---
 * name: skill-name
 * description: Short summary of what this skill teaches the agent
 * ---
 * # Skill Content / Instructions
 */
export function parseSkillMarkdown(raw: string): ParsedSkillMd {
  const trimmed = raw.trim()
  let name = ''
  let description = ''
  let body = trimmed
  const metadata: Record<string, unknown> = {}

  if (trimmed.startsWith('---')) {
    const endMatch = trimmed.indexOf('\n---', 3)
    if (endMatch !== -1) {
      const frontmatter = trimmed.slice(3, endMatch).trim()
      body = trimmed.slice(endMatch + 4).trim()

      const lines = frontmatter.split('\n')
      for (const line of lines) {
        const colonIdx = line.indexOf(':')
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim()
          const val = line
            .slice(colonIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, '')
          metadata[key] = val
          if (key === 'name') name = val
          if (key === 'description') description = val
        }
      }
    }
  }

  // If no name found in frontmatter, extract first Markdown heading
  if (!name) {
    const headingMatch = body.match(/^#+\s*(.+)$/m)
    if (headingMatch) {
      name = headingMatch[1].trim()
    } else {
      name = 'Untitled Skill'
    }
  }

  // If no description in frontmatter, extract first paragraph
  if (!description) {
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
    if (lines.length > 0) {
      description = lines[0].slice(0, 160)
    } else {
      description = 'Custom Agent Skill instructions.'
    }
  }

  return { name, description, body, metadata }
}
