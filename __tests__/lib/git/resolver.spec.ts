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
    expect(slug4?.repoKey).toBe('github/facebook/react')
    expect(slug4?.provider).toBe('github')
    expect(slug4?.owner).toBe('facebook')
    expect(slug4?.repo).toBe('react')
    expect(slug4?.resourceType).toBe('branch')
    expect(slug4?.resourceId).toBe('main')
  })

  it('generates consistent share URLs for remote and local repos', () => {
    const shareUrlRemote = makeShareUrl('https://github.com/DavidKk/yggit.git', '321aedc')
    expect(shareUrlRemote).toContain('/repo/r_')
    expect(shareUrlRemote).toContain('/commit/321aedc')

    const shareUrlLocal = makeShareUrl('/Users/david/local-project', '321aedc')
    expect(shareUrlLocal).toContain('/repo/l_')
    expect(shareUrlLocal).toContain('/commit/321aedc')
  })
})
