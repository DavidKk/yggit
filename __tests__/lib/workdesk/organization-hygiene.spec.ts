import type { GitProjectView } from '@/lib/git/types'
import { BLOATED_GROUP_THRESHOLD, detectOrganizationHygiene } from '@/lib/workdesk/detectors/organization-hygiene'

describe('OrganizationHygieneDetector', () => {
  it('returns no findings when total projects in a group is less than the bloated threshold', () => {
    const projects: GitProjectView[] = [
      {
        id: '1',
        name: 'proj1',
        group: '个人项目',
        host: 'local',
        localPath: '/Users/dev/sl/proj1',
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      },
      {
        id: '2',
        name: 'proj2',
        group: '个人项目',
        host: 'local',
        localPath: '/Users/dev/sl-backend/proj2',
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      },
    ]

    const findings = detectOrganizationHygiene({ projects })
    expect(findings).toHaveLength(0)
  })

  it('detects bloated group with diverse path roots and produces organization finding', () => {
    const projects: GitProjectView[] = []

    // Create 12 projects: 6 in sl-backend, 6 in sl
    for (let i = 0; i < BLOATED_GROUP_THRESHOLD + 2; i++) {
      const parentDir = i % 2 === 0 ? 'sl-backend' : 'sl'
      projects.push({
        id: `id_${i}`,
        name: `project_${i}`,
        group: '个人项目',
        host: 'local',
        localPath: `/Users/davidjones/Develop/${parentDir}/project_${i}`,
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      })
    }

    const findings = detectOrganizationHygiene({ projects })
    expect(findings).toHaveLength(1)

    const finding = findings[0]
    expect(finding.evidence?.ruleId).toBe('project-organization-hygiene')
    expect(finding.kind).toBe('custom')
    expect(finding.severity).toBe('info')
    expect(finding.lifecycle).toBe('open')
    expect(finding.evidence?.details?.projectCount).toBe(BLOATED_GROUP_THRESHOLD + 2)
    expect(finding.evidence?.details?.distinctRoots).toEqual(expect.arrayContaining(['sl-backend', 'sl']))
  })

  it('does not produce finding if all projects share the exact same root namespace', () => {
    const projects: GitProjectView[] = []
    for (let i = 0; i < 15; i++) {
      projects.push({
        id: `id_${i}`,
        name: `project_${i}`,
        group: '个人项目',
        host: 'local',
        localPath: `/Users/davidjones/Develop/sl/project_${i}`,
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      })
    }

    const findings = detectOrganizationHygiene({ projects })
    expect(findings).toHaveLength(0)
  })
})
