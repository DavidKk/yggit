import git from 'isomorphic-git'

import { computeBranchAheadBehind, walkMultiBranchLog } from '@/lib/git/driver/edge-log-walker'

describe('edge-log-walker', () => {
  describe('walkMultiBranchLog', () => {
    it('walks multiple branches and sorts by committer timestamp desc', async () => {
      const mockCommits: Record<string, any> = {
        c_master_2: {
          oid: 'c_master_2',
          commit: {
            parent: ['c_master_1'],
            committer: { timestamp: 2000 },
            message: 'master commit 2',
          },
        },
        c_master_1: {
          oid: 'c_master_1',
          commit: {
            parent: ['c_root'],
            committer: { timestamp: 1500 },
            message: 'master commit 1',
          },
        },
        c_feature_1: {
          oid: 'c_feature_1',
          commit: {
            parent: ['c_root'],
            committer: { timestamp: 1800 },
            message: 'feature commit 1',
          },
        },
        c_root: {
          oid: 'c_root',
          commit: {
            parent: [],
            committer: { timestamp: 1000 },
            message: 'root commit',
          },
        },
      }

      jest.spyOn(git, 'readCommit').mockImplementation(async ({ oid }: { oid: string }) => {
        const item = mockCommits[oid]
        if (!item) throw new Error(`Not found ${oid}`)
        return item
      })

      const result = await walkMultiBranchLog({
        fs: {},
        tips: ['c_master_2', 'c_feature_1'],
        limit: 10,
      })

      expect(result).toHaveLength(4)
      expect(result.map((r) => r.oid)).toEqual(['c_master_2', 'c_feature_1', 'c_master_1', 'c_root'])

      jest.restoreAllMocks()
    })
  })

  describe('computeBranchAheadBehind', () => {
    it('returns ahead: 0, behind: 0 when tips match', async () => {
      const res = await computeBranchAheadBehind({}, {}, '/', 'oid_1', 'oid_1')
      expect(res).toEqual({ ahead: 0, behind: 0 })
    })

    it('computes ahead and behind counts correctly', async () => {
      const mockCommits: Record<string, any> = {
        local_2: { oid: 'local_2', commit: { parent: ['local_1'] } },
        local_1: { oid: 'local_1', commit: { parent: ['base'] } },
        remote_1: { oid: 'remote_1', commit: { parent: ['base'] } },
        base: { oid: 'base', commit: { parent: [] } },
      }

      jest.spyOn(git, 'readCommit').mockImplementation(async ({ oid }: { oid: string }) => {
        const item = mockCommits[oid]
        if (!item) throw new Error(`Not found ${oid}`)
        return item
      })

      // When remote is ahead: base -> remote_1
      const behindRes = await computeBranchAheadBehind({}, {}, '/', 'base', 'remote_1')
      expect(behindRes).toEqual({ ahead: 0, behind: 1 })

      // When local is ahead: base -> local_1 -> local_2
      const aheadRes = await computeBranchAheadBehind({}, {}, '/', 'local_2', 'base')
      expect(aheadRes).toEqual({ ahead: 2, behind: 0 })

      jest.restoreAllMocks()
    })
  })
})
