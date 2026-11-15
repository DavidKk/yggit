import { projectId } from '@/lib/git/identity'
import { makeShareUrl, parseRepoSlug } from '@/lib/git/resolver'
import { resolveRepoSlug } from '@/services/git/resolver'

describe('resolver', () => {
  it('parses repo key slugs accurately', () => {
    const slug1 = parseRepoSlug(['r_07b1334090532dcc'])
    expect(slug1).not.toBeNull()
    expect(slug1?.repoKey).toBe('r_07b1334090532dcc')
    expect(slug1?.resourceType).toBeNull()

    const slug2 = parseRepoSlug(['r_07b1334090532dcc', 'commit', '321aedc'])
    expect(slug2?.repoKey).toBe('r_07b1334090532dcc')
    expect(slug2?.resourceType).toBe('commit')
    expect(slug2?.resourceId).toBe('321aedc')

    const slug3 = parseRepoSlug(['r_07b1334090532dcc', 'commit', '321aedc', 'diff'])
    expect(slug3?.resourceType).toBe('commit')
    expect(slug3?.subPath).toBe('diff')

    const slug4 = parseRepoSlug(['github', 'facebook', 'react', 'branch', 'main'])
    expect(slug4?.repoKey).toBe('github.com/facebook/react')
    expect(slug4?.provider).toBe('github')
    expect(slug4?.owner).toBe('facebook')
    expect(slug4?.repo).toBe('react')
    expect(slug4?.resourceType).toBe('branch')
    expect(slug4?.resourceId).toBe('main')

    const slug5 = parseRepoSlug(['git.internal.corp', 'team', 'service', 'commit', 'abc1234'])
    expect(slug5?.repoKey).toBe('git.internal.corp/team/service')
    expect(slug5?.owner).toBe('team')
    expect(slug5?.repo).toBe('service')
    expect(slug5?.resourceType).toBe('commit')
    expect(slug5?.resourceId).toBe('abc1234')

    // GitLab with nested subgroups: gitlab.com/org/dept/subgroup/project
    const slug6 = parseRepoSlug(['gitlab', 'org', 'dept', 'subgroup', 'project', 'commit', 'fedcba9'])
    expect(slug6?.provider).toBe('gitlab')
    expect(slug6?.owner).toBe('org/dept/subgroup')
    expect(slug6?.repo).toBe('project')
    expect(slug6?.repoKey).toBe('gitlab.com/org/dept/subgroup/project')
    expect(slug6?.resourceType).toBe('commit')
    expect(slug6?.resourceId).toBe('fedcba9')
  })

  it('generates consistent share URLs for public, corporate, and offline repos', () => {
    // 1. Public GitHub repository share URL
    const shareUrlGitHub = makeShareUrl('https://github.com/DavidKk/yggit.git', '321aedc')
    expect(shareUrlGitHub).toBe('/repo/github/DavidKk/yggit/commit/321aedc')

    // 2. Public GitLab repository share URL
    const shareUrlGitLab = makeShareUrl('https://gitlab.com/gitlab-org/gitlab.git', '9876543')
    expect(shareUrlGitLab).toBe('/repo/gitlab/gitlab-org/gitlab/commit/9876543')

    // 3. Public GitLab with nested subgroups
    const shareUrlGitLabNested = makeShareUrl('https://gitlab.com/group/subgroup/project.git', {
      hash: '5556667',
      file: 'src/main.rs',
      lines: '10-25',
    })
    expect(shareUrlGitLabNested).toBe('/repo/gitlab/group/subgroup/project/commit/5556667?file=src%2Fmain.rs#L10-25')

    // 4. Local clone with remote origin configured
    const shareUrlLocalClone = makeShareUrl('/Users/david/dev/yggit', '321aedc', 'https://github.com/DavidKk/yggit.git')
    expect(shareUrlLocalClone).toBe('/repo/github/DavidKk/yggit/commit/321aedc')

    // 5. Corporate / self-hosted GitLab / internal private repository (includes ?remote= for recipient discovery)
    const shareUrlCorp = makeShareUrl('/Users/alice/dev/service', 'abc1234', 'git@git.internal.corp:fintech/service.git')
    expect(shareUrlCorp).toBe('/repo/git.internal.corp/fintech/service/commit/abc1234?remote=https%3A%2F%2Fgit.internal.corp%2Ffintech%2Fservice.git')

    // 6. Pure offline repository without remote
    const shareUrlOffline = makeShareUrl('/Users/david/offline-project', '321aedc')
    expect(shareUrlOffline).toContain('/repo/l_')
    expect(shareUrlOffline).toContain('/commit/321aedc')

    // 7. Deterministic local project name hash (e.g. ticket-janitor -> l_5b8a0f89229d44ed)
    expect(projectId('ticket-janitor')).toBe('5b8a0f89229d44ed')
    const ticketShareUrl = makeShareUrl('ticket-janitor')
    expect(ticketShareUrl).toBe('/repo/l_5b8a0f89229d44ed')
  })

  it('resolves l_projectId slug matching local project name', () => {
    const res = resolveRepoSlug(['l_5b8a0f89229d44ed'])
    expect(res.parsed.repoKey).toBe('l_5b8a0f89229d44ed')
    if (res.resolved.project) {
      expect(res.resolved.name).toBe('ticket-janitor')
      expect(res.resolved.persistence).toBe('saved')
    }
  })
})
