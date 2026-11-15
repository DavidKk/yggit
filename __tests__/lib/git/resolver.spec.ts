import { generateRepoKey, makeShareUrl, parseRepoSlug } from '@/lib/git/resolver'

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
  })

  it('generates consistent share URLs for public, corporate, and offline repos', () => {
    // 1. Public GitHub repository share URL
    const shareUrlGitHub = makeShareUrl('https://github.com/DavidKk/yggit.git', '321aedc')
    expect(shareUrlGitHub).toBe('/repo/github/DavidKk/yggit/commit/321aedc')

    // 2. Local clone with remote origin configured
    const shareUrlLocalClone = makeShareUrl('/Users/david/dev/yggit', '321aedc', 'https://github.com/DavidKk/yggit.git')
    expect(shareUrlLocalClone).toBe('/repo/github/DavidKk/yggit/commit/321aedc')

    // 3. Corporate / internal private repository (both own)
    const shareUrlCorp = makeShareUrl('/Users/alice/dev/service', 'abc1234', 'git@git.internal.corp:fintech/service.git')
    expect(shareUrlCorp).toBe('/repo/git.internal.corp/fintech/service/commit/abc1234')

    // 4. Pure offline repository without remote
    const shareUrlOffline = makeShareUrl('/Users/david/offline-project', '321aedc')
    expect(shareUrlOffline).toContain('/repo/l_')
    expect(shareUrlOffline).toContain('/commit/321aedc')
  })
})
