import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'E2E Bot',
      GIT_AUTHOR_EMAIL: 'e2e@yggit.local',
      GIT_COMMITTER_NAME: 'E2E Bot',
      GIT_COMMITTER_EMAIL: 'e2e@yggit.local',
    },
  }).trim()
}

export interface RichRepoFixture {
  repoDir: string
  baseHash: string
  featHash: string
  mergeHash: string
  conflictFile: string
}

export function createRichTestRepo(): RichRepoFixture {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yggit-e2e-rich-'))
  const conflictFile = 'src/app.ts'

  runGit(repoDir, ['init', '-b', 'main'])
  fs.mkdirSync(path.join(repoDir, 'src/utils'), { recursive: true })
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Yggit E2E Fixture\nInitial documentation\n')
  fs.writeFileSync(path.join(repoDir, 'src/utils/math.ts'), 'export const add = (a: number, b: number) => a + b\n')
  fs.writeFileSync(path.join(repoDir, conflictFile), 'const version = 1\nconst mode = "base"\nexport { version, mode }\n')
  runGit(repoDir, ['add', '.'])
  runGit(repoDir, ['commit', '-m', 'chore: initial base commit'])
  const baseHash = runGit(repoDir, ['rev-parse', 'HEAD'])
  runGit(repoDir, ['tag', 'v1.0.0'])

  runGit(repoDir, ['checkout', '-b', 'feat/ui'])
  fs.writeFileSync(path.join(repoDir, conflictFile), 'const version = 2\nconst mode = "feat-ui"\nexport { version, mode }\n')
  fs.writeFileSync(path.join(repoDir, 'src/utils/math.ts'), 'export const add = (a: number, b: number) => a + b\nexport const sub = (a: number, b: number) => a - b\n')
  runGit(repoDir, ['add', '.'])
  runGit(repoDir, ['commit', '-m', 'feat(ui): add sub helper and ui mode'])
  const featHash = runGit(repoDir, ['rev-parse', 'HEAD'])

  runGit(repoDir, ['checkout', 'main'])
  runGit(repoDir, ['checkout', '-b', 'fix/api'])
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Yggit E2E Fixture\nAPI fix notes\n')
  runGit(repoDir, ['add', 'README.md'])
  runGit(repoDir, ['commit', '-m', 'fix(api): update api docs'])

  runGit(repoDir, ['checkout', 'main'])
  fs.writeFileSync(path.join(repoDir, conflictFile), 'const version = 3\nconst mode = "main-line"\nexport { version, mode }\n')
  runGit(repoDir, ['add', conflictFile])
  runGit(repoDir, ['commit', '-m', 'feat(core): update main mode'])

  try {
    runGit(repoDir, ['merge', '--no-ff', 'feat/ui', '-m', 'merge: conflicted feat/ui into main'])
  } catch {
    fs.writeFileSync(path.join(repoDir, conflictFile), 'const version = 3\nconst mode = "resolved"\nexport { version, mode }\n')
    runGit(repoDir, ['add', conflictFile])
    runGit(repoDir, ['commit', '--no-edit'])
  }

  const mergeHash = runGit(repoDir, ['rev-parse', 'HEAD'])
  return { repoDir, baseHash, featHash, mergeHash, conflictFile }
}

export function cleanupTestRepo(repoDir: string): void {
  if (repoDir && fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true })
  }
}

export interface RemoteRepoFixture {
  rootDir: string
  bareDir: string
  repoDir: string
}

export function createRepoWithBareRemote(): RemoteRepoFixture {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yggit-e2e-remote-'))
  const bareDir = path.join(rootDir, 'origin.git')
  const repoDir = path.join(rootDir, 'workspace')

  fs.mkdirSync(bareDir, { recursive: true })
  runGit(bareDir, ['init', '--bare', '-b', 'main'])

  fs.mkdirSync(repoDir, { recursive: true })
  runGit(repoDir, ['init', '-b', 'main'])
  runGit(repoDir, ['config', 'user.name', 'E2E Bot'])
  runGit(repoDir, ['config', 'user.email', 'e2e@yggit.local'])
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Remote Fixture\n')
  runGit(repoDir, ['add', 'README.md'])
  runGit(repoDir, ['commit', '-m', 'chore: initial remote commit'])
  runGit(repoDir, ['remote', 'add', 'origin', bareDir])
  runGit(repoDir, ['push', '-u', 'origin', 'main'])

  // Create a tracked modification + untracked file for stage/commit/stash tests
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Remote Fixture\nModified in worktree\n')
  fs.writeFileSync(path.join(repoDir, 'worktree.txt'), 'draft change 1\n')

  return { rootDir, bareDir, repoDir }
}
