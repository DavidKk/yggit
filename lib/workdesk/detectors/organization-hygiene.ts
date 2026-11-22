/**
 * OrganizationHygieneDetector: Evaluates project folder distribution and grouping sprawl.
 * Adheres to docs/technical/yggit-project-categorization-and-governance.md §3
 */

import type { GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { Finding } from '@/lib/workdesk/types'

const ENGINE_VERSION = '1.0.0'
export const BLOATED_GROUP_THRESHOLD = 10

export interface OrganizationHygieneDetectorContext {
  projects: GitProjectView[]
}

/**
 * Execute OrganizationHygieneDetector across all catalog projects.
 */
export function detectOrganizationHygiene(input: OrganizationHygieneDetectorContext | GitProjectView[]): Finding[] {
  const projects = Array.isArray(input) ? input : input?.projects || []
  const findings: Finding[] = []
  const groupMap = new Map<string, GitProjectView[]>()

  for (const project of projects) {
    const group = (project.group || '个人项目').trim()
    if (!groupMap.has(group)) groupMap.set(group, [])
    groupMap.get(group)!.push(project)
  }

  for (const [groupName, groupProjects] of groupMap.entries()) {
    if (groupProjects.length < BLOATED_GROUP_THRESHOLD) continue

    const distinctRoots = new Set<string>()
    for (const p of groupProjects) {
      if (p.localPath) {
        const parts = p.localPath.split('/').filter(Boolean)
        if (parts.length >= 2) {
          distinctRoots.add(parts[parts.length - 2])
        }
      }
    }

    if (distinctRoots.size >= 2) {
      const fingerprint = generateFindingFingerprint({
        repoIdentity: `org_group_${encodeURIComponent(groupName)}`,
        kind: 'custom',
        ruleId: 'project-organization-hygiene',
        targetRef: groupName,
      })

      const samplePaths = groupProjects.slice(0, 5).map((p) => p.localPath)
      const projectIds = groupProjects.map((p) => p.id)

      findings.push({
        id: `finding_org_${encodeURIComponent(groupName)}`,
        fingerprint,
        repoId: 'global',
        repoAlias: groupName,
        kind: 'custom',
        source: 'rule',
        severity: 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: groupName },
        scenarioId: 'project-organization',
        evidence: {
          paths: Array.from(distinctRoots),
          ruleId: 'project-organization-hygiene',
          details: {
            groupName,
            projectCount: groupProjects.length,
            projectIds,
            samplePaths,
            distinctRoots: Array.from(distinctRoots),
            conclusion: `分组「${groupName}」堆叠了 ${groupProjects.length} 个项目，且涵盖 ${distinctRoots.size} 个不同物理目录前缀，建议按模块智能整理`,
            stateKind: 'warn',
          },
        },
        observedAt: Date.now(),
        baseCommitOid: '',
        engineVersion: ENGINE_VERSION,
      })
    }
  }

  return findings
}
