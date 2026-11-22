import type { GitProjectView } from '@/lib/git/types'
import { computeRemoteIdentityDigest, decodeRecipeFromUrlHash, encodeRecipeToUrlHash, matchRecipeWithLocalProjects, validateCheckRecipe } from '@/lib/workdesk/share'
import type { CheckRecipe } from '@/lib/workdesk/types'

describe('Portable Check Recipe Protocol', () => {
  const validRecipe: CheckRecipe = {
    version: 1,
    repositories: [{ identityDigest: 'digest_alpha' }, { identityDigest: 'digest_beta' }],
    checks: [
      {
        repoIdentityDigest: 'digest_alpha',
        type: 'sync',
        target: 'main',
      },
      {
        repoIdentityDigest: 'digest_beta',
        type: 'sync',
        target: 'master',
      },
    ],
  }

  it('validates a correct recipe', () => {
    expect(() => validateCheckRecipe(validRecipe)).not.toThrow()
  })

  it('rejects unsupported recipe version or missing fields', () => {
    expect(() => validateCheckRecipe({ version: 2 })).toThrow(/不支持的配方版本/)
    expect(() => validateCheckRecipe({ version: 1, repositories: [] })).toThrow(/至少一个仓库/)
  })

  it('round-trips recipe through URL hash encoding and decoding', () => {
    const encoded = encodeRecipeToUrlHash(validRecipe)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(10)

    const decoded = decodeRecipeFromUrlHash(encoded)
    expect(decoded.version).toBe(1)
    expect(decoded.repositories).toHaveLength(2)
    expect(decoded.checks).toHaveLength(2)
    expect(decoded.checks[0].type).toBe('sync')
  })

  it('matches recipe repositories with registered local projects', () => {
    const testUrl = 'https://github.com/my-org/my-repo.git'
    const digest = computeRemoteIdentityDigest(testUrl)

    const recipe: CheckRecipe = {
      version: 1,
      repositories: [{ identityDigest: digest }],
      checks: [{ repoIdentityDigest: digest, type: 'sync', target: 'main' }],
    }

    const localProjects: GitProjectView[] = [
      {
        id: 'p1',
        name: 'my-repo',
        group: '',
        host: 'github',
        localPath: '/repos/my-repo',
        httpsUrl: testUrl,
        local: true,
        remote: true,
        authorized: true,
      },
      {
        id: 'p2',
        name: 'other-repo',
        group: '',
        host: 'github',
        localPath: '/repos/other',
        httpsUrl: 'https://github.com/other/repo.git',
        local: true,
        remote: true,
        authorized: true,
      },
    ]

    const matches = matchRecipeWithLocalProjects(recipe, localProjects)
    expect(matches).toHaveLength(1)
    expect(matches[0].status).toBe('matched')
    expect(matches[0].matchedProject?.name).toBe('my-repo')
  })

  it('identifies unmatched projects as pending association', () => {
    const recipe: CheckRecipe = {
      version: 1,
      repositories: [{ identityDigest: 'non_existent_digest' }],
      checks: [{ repoIdentityDigest: 'non_existent_digest', type: 'sync' }],
    }

    const localProjects: GitProjectView[] = [
      {
        id: 'p1',
        name: 'local-repo',
        group: '',
        host: 'local',
        localPath: '/repos/local',
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      },
    ]

    const matches = matchRecipeWithLocalProjects(recipe, localProjects)
    expect(matches).toHaveLength(1)
    expect(matches[0].status).toBe('unmatched')
    expect(matches[0].matchedProject).toBeUndefined()
  })
})
