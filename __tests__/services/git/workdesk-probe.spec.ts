import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { computeLocalRepoSignature, probeLocalRepoForWorkdesk } from '@/services/git/workdesk-probe'

describe('workdesk lightweight local probe', () => {
  let repoDir = ''

  function git(...args: string[]): string {
    return execFileSync('git', ['-C', repoDir, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Probe Test',
        GIT_AUTHOR_EMAIL: 'probe@example.invalid',
        GIT_COMMITTER_NAME: 'Probe Test',
        GIT_COMMITTER_EMAIL: 'probe@example.invalid',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: os.devNull,
      },
    }).trim()
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yggit-workdesk-probe-'))
    git('init', '-q', '-b', 'main')
    fs.writeFileSync(path.join(repoDir, 'README.md'), 'init\n')
    git('add', '.')
    git('commit', '-qm', 'feat: initial commit')
  })

  afterAll(() => {
    if (repoDir) fs.rmSync(repoDir, { recursive: true, force: true })
  })

  it('returns unchanged=true when signature matches and detects new commits immediately', async () => {
    const first = await probeLocalRepoForWorkdesk({ repo: repoDir })
    expect(first.unchanged).toBe(false)
    expect(first.signature).toBeTruthy()
    expect(first.logView?.branch).toBe('main')
    expect(first.logView?.commits[0]?.subject).toBe('feat: initial commit')

    const second = await probeLocalRepoForWorkdesk({ repo: repoDir, knownSignature: first.signature })
    expect(second.unchanged).toBe(true)
    expect(second.logView).toBeUndefined()

    const forced = await probeLocalRepoForWorkdesk({ repo: repoDir, knownSignature: first.signature, force: true })
    expect(forced.unchanged).toBe(false)
    expect(forced.logView?.commits[0]?.subject).toBe('feat: initial commit')

    // Make a new commit and verify the metadata signature updates
    fs.writeFileSync(path.join(repoDir, 'CHANGELOG.md'), 'v2\n')
    git('add', '.')
    git('commit', '-qm', 'feat: second commit')

    const nextSig = computeLocalRepoSignature(repoDir)
    expect(nextSig).not.toBe(first.signature)

    const third = await probeLocalRepoForWorkdesk({ repo: repoDir, knownSignature: first.signature })
    expect(third.unchanged).toBe(false)
    expect(third.logView?.commits[0]?.subject).toBe('feat: second commit')
  })
})
