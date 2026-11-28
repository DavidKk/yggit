import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yggit-ephemeral-projects-test-'))

jest.mock('@/constants/paths', () => ({
  ROOT_PATH: mockRoot,
  DATA_DIR_NAME: 'data',
  DATA_DIR: path.join(mockRoot, 'data'),
}))

import { isEphemeralRepoPath } from '@/services/git/ephemeral'
import { listGitCatalog, readLastOpenedRepo, rememberLocalProject, writeLastOpenedRepo } from '@/services/git/projects'

describe('ephemeral repository guards', () => {
  const realTmpRepo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yggit-e2e-unit-'))

  afterAll(() => {
    fs.rmSync(realTmpRepo, { recursive: true, force: true })
    fs.rmSync(mockRoot, { recursive: true, force: true })
  })

  it('identifies temp directories while leaving workspace paths unaffected', () => {
    expect(isEphemeralRepoPath(realTmpRepo)).toBe(true)
    expect(isEphemeralRepoPath(path.join(os.tmpdir(), 'yggit-e2e-deleted-dir'))).toBe(true)
    expect(isEphemeralRepoPath('/Users/example/Develop/project')).toBe(false)
    expect(isEphemeralRepoPath('')).toBe(false)
  })

  it('does not persist ephemeral tmpdir repos into catalog.json or last.json by default', async () => {
    writeLastOpenedRepo(realTmpRepo)
    expect(readLastOpenedRepo()).toBe('')

    const transient = await rememberLocalProject(realTmpRepo)
    expect(transient.localPath).toBe(path.resolve(realTmpRepo))
    expect(listGitCatalog().projects).toEqual([])

    const catalogPath = path.join(mockRoot, 'data', 'git-projects', 'catalog.json')
    expect(fs.existsSync(catalogPath)).toBe(false)
  })
})
