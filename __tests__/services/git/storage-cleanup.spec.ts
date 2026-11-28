import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yggit-storage-cleanup-test-'))

jest.mock('@/constants/paths', () => ({
  ROOT_PATH: mockRoot,
  DATA_DIR_NAME: 'data',
  DATA_DIR: path.join(mockRoot, 'data'),
}))

import { deleteGitFolder, listGitCatalog, removeGitProject } from '@/services/git/projects'

function hashId(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

describe('cascade cleanup when removing git projects or folders', () => {
  const dataDir = path.join(mockRoot, 'data')
  const projectsDir = path.join(dataDir, 'git-projects')
  const conflictsDir = path.join(dataDir, 'git-conflicts')
  const marksDir = path.join(dataDir, 'git-marks')
  const workdeskDir = path.join(dataDir, 'git-workdesk')

  const alphaPath = '/Users/example/work/alpha'
  const betaPath = '/Users/example/work/beta'
  const gammaPath = '/Users/example/work/gamma'

  beforeEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true })
    fs.mkdirSync(projectsDir, { recursive: true })
    fs.mkdirSync(conflictsDir, { recursive: true })
    fs.mkdirSync(marksDir, { recursive: true })
    fs.mkdirSync(workdeskDir, { recursive: true })

    fs.writeFileSync(
      path.join(projectsDir, 'catalog.json'),
      JSON.stringify({
        folders: ['GroupA', 'GroupB'],
        projects: [
          { id: 'proj_alpha', name: 'alpha', group: 'GroupA', host: 'local', remoteKey: '', httpsUrl: '', localPath: alphaPath, credentialId: '' },
          { id: 'proj_beta', name: 'beta', group: 'GroupA', host: 'local', remoteKey: '', httpsUrl: '', localPath: betaPath, credentialId: '' },
          { id: 'proj_gamma', name: 'gamma', group: 'GroupB', host: 'local', remoteKey: '', httpsUrl: '', localPath: gammaPath, credentialId: '' },
        ],
      })
    )
    fs.writeFileSync(path.join(projectsDir, 'last.json'), JSON.stringify({ path: alphaPath }))

    for (const p of [alphaPath, betaPath, gammaPath]) {
      fs.writeFileSync(path.join(conflictsDir, `${hashId(p)}.json`), JSON.stringify({ repo: p, conflicts: {} }))
      fs.writeFileSync(path.join(marksDir, `${hashId(p)}.json`), JSON.stringify({ repo: p, branches: {} }))
    }

    fs.writeFileSync(
      path.join(workdeskDir, 'workdesk-store.json'),
      JSON.stringify({
        version: 1,
        lastChecked: 123,
        findings: [
          { id: 'f_alpha', repoId: 'proj_alpha' },
          { id: 'f_beta', repoId: 'proj_beta' },
          { id: 'f_gamma', repoId: 'proj_gamma' },
        ],
        cards: [{ id: 'c1', itemIds: ['i_alpha', 'i_gamma'] }],
        items: [
          { id: 'i_alpha', repoId: 'proj_alpha' },
          { id: 'i_gamma', repoId: 'proj_gamma' },
        ],
      })
    )
  })

  afterAll(() => {
    fs.rmSync(mockRoot, { recursive: true, force: true })
  })

  it('cascade-cleans conflict cache, branch marks, last.json, and workdesk entries on removeGitProject', () => {
    removeGitProject('proj_alpha')

    expect(listGitCatalog().projects.map((p) => p.id)).toEqual(['proj_beta', 'proj_gamma'])
    expect(fs.existsSync(path.join(conflictsDir, `${hashId(alphaPath)}.json`))).toBe(false)
    expect(fs.existsSync(path.join(marksDir, `${hashId(alphaPath)}.json`))).toBe(false)
    expect(fs.existsSync(path.join(projectsDir, 'last.json'))).toBe(false)

    // Unrelated projects stay intact
    expect(fs.existsSync(path.join(conflictsDir, `${hashId(betaPath)}.json`))).toBe(true)
    expect(fs.existsSync(path.join(conflictsDir, `${hashId(gammaPath)}.json`))).toBe(true)

    const workdesk = JSON.parse(fs.readFileSync(path.join(workdeskDir, 'workdesk-store.json'), 'utf8'))
    expect(workdesk.findings.map((f: { id: string }) => f.id)).toEqual(['f_beta', 'f_gamma'])
    expect(workdesk.items.map((it: { id: string }) => it.id)).toEqual(['i_gamma'])
    expect(workdesk.cards[0].itemIds).toEqual(['i_gamma'])
  })

  it('cascade-cleans all deleted projects when removing a folder with deleteGitFolder', () => {
    const res = deleteGitFolder('GroupA')

    expect(res.removedCount).toBe(2)
    expect(res.projects.map((p) => p.id)).toEqual(['proj_gamma'])
    expect(fs.existsSync(path.join(conflictsDir, `${hashId(alphaPath)}.json`))).toBe(false)
    expect(fs.existsSync(path.join(conflictsDir, `${hashId(betaPath)}.json`))).toBe(false)
    expect(fs.existsSync(path.join(conflictsDir, `${hashId(gammaPath)}.json`))).toBe(true)
    expect(fs.existsSync(path.join(marksDir, `${hashId(alphaPath)}.json`))).toBe(false)
    expect(fs.existsSync(path.join(marksDir, `${hashId(betaPath)}.json`))).toBe(false)
    expect(fs.existsSync(path.join(marksDir, `${hashId(gammaPath)}.json`))).toBe(true)

    const workdesk = JSON.parse(fs.readFileSync(path.join(workdeskDir, 'workdesk-store.json'), 'utf8'))
    expect(workdesk.findings.map((f: { id: string }) => f.id)).toEqual(['f_gamma'])
  })
})
