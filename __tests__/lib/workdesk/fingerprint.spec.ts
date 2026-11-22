import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'

describe('Workdesk Fingerprint Generator', () => {
  it('generates deterministic SHA-256 hex string for given payload', () => {
    const hash1 = generateFindingFingerprint({
      repoIdentity: 'github.com/test/repo',
      kind: 'sync',
      ruleId: 'default-branch-sync',
      targetRef: 'main',
      sources: ['origin/main'],
    })

    const hash2 = generateFindingFingerprint({
      repoIdentity: 'github.com/test/repo',
      kind: 'sync',
      ruleId: 'default-branch-sync',
      targetRef: 'main',
      sources: ['origin/main'],
    })

    expect(hash1).toHaveLength(64)
    expect(hash1).toBe(hash2)
  })

  it('is independent of the order of sources array', () => {
    const hashA = generateFindingFingerprint({
      repoIdentity: 'repo-1',
      kind: 'merge',
      targetRef: 'target',
      sources: ['branch-b', 'branch-a'],
    })

    const hashB = generateFindingFingerprint({
      repoIdentity: 'repo-1',
      kind: 'merge',
      targetRef: 'target',
      sources: ['branch-a', 'branch-b'],
    })

    expect(hashA).toBe(hashB)
  })

  it('produces different hash when target ref or kind differs', () => {
    const hash1 = generateFindingFingerprint({
      repoIdentity: 'repo-1',
      kind: 'sync',
      targetRef: 'main',
    })

    const hash2 = generateFindingFingerprint({
      repoIdentity: 'repo-1',
      kind: 'sync',
      targetRef: 'master',
    })

    expect(hash1).not.toBe(hash2)
  })
})
