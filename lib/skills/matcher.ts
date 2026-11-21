import type { SkillDescriptor } from './types'

/**
 * Matches enabled skills against user input.
 * If user prompt contains keywords or semantic hints relevant to a skill,
 * that skill is selected to augment the Agent's system context.
 */
export function matchSkillsForPrompt(prompt: string, skills: SkillDescriptor[]): SkillDescriptor[] {
  const p = prompt.toLowerCase()
  const enabledSkills = skills.filter((s) => s.enabled)

  const matched: SkillDescriptor[] = []

  for (const s of enabledSkills) {
    const nameLower = s.name.toLowerCase()
    const descLower = s.description.toLowerCase()

    // 1. Direct name match
    if (p.includes(nameLower)) {
      matched.push(s)
      continue
    }

    // 2. Keyword heuristic matching
    const keywords: string[] = []
    if (nameLower.includes('review') || descLower.includes('review')) {
      keywords.push('审查', 'review', 'cr', '代码审查', 'pr', '合入')
    }
    if (nameLower.includes('conflict') || descLower.includes('conflict')) {
      keywords.push('冲突', 'conflict', 'rebase', 'merge base', '3-way')
    }
    if (nameLower.includes('commit') || descLower.includes('commit')) {
      keywords.push('提交', 'commit', 'message', '规范', 'conventional')
    }

    if (keywords.some((kw) => p.includes(kw))) {
      matched.push(s)
    }
  }

  return matched
}

/**
 * Builds instructions prompt injected into agent's system message.
 */
export function buildSkillsSystemPrompt(matchedSkills: SkillDescriptor[]): string {
  if (matchedSkills.length === 0) return ''

  const sections = matchedSkills.map((s) => `### Skill: ${s.name}\n${s.content.trim()}`)

  return `\n\n[Active Agent Skills]\nYou must adhere to the following professional workflows and standards provided by active skills:\n\n${sections.join('\n\n')}\n`
}
