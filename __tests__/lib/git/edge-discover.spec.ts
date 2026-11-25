import { discoverEdgeGitRepos } from '@/lib/git/driver/edge-discover'

interface MockDirOptions {
  name: string
  hasGitDir?: boolean
  hasGitFile?: boolean
  children?: MockDirOptions[]
}

function createMockDirHandle(opts: MockDirOptions): FileSystemDirectoryHandle {
  const childMap = new Map<string, FileSystemDirectoryHandle>()
  for (const child of opts.children ?? []) {
    childMap.set(child.name, createMockDirHandle(child))
  }

  const handle = {
    kind: 'directory' as const,
    name: opts.name,
    getDirectoryHandle: async (name: string) => {
      if (name === '.git' && opts.hasGitDir) {
        return { kind: 'directory', name: '.git' } as FileSystemDirectoryHandle
      }
      const found = childMap.get(name)
      if (found) return found
      throw new DOMException('NotFoundError', 'NotFoundError')
    },
    getFileHandle: async (name: string) => {
      if (name === '.git' && opts.hasGitFile) {
        return { kind: 'file', name: '.git' } as FileSystemFileHandle
      }
      throw new DOMException('NotFoundError', 'NotFoundError')
    },
    values: async function* () {
      for (const child of childMap.values()) {
        yield child
      }
    },
  }

  return handle as unknown as FileSystemDirectoryHandle
}

describe('discoverEdgeGitRepos', () => {
  it('returns the root directly when the selected directory itself is a git repo', async () => {
    const root = createMockDirHandle({
      name: 'my-app',
      hasGitDir: true,
      children: [{ name: 'nested-repo', hasGitDir: true }],
    })

    const repos = await discoverEdgeGitRepos(root)
    expect(repos).toHaveLength(1)
    expect(repos[0].name).toBe('my-app')
    expect(repos[0].relativePath).toBe('my-app')
  })

  it('supports git worktrees/submodules with a .git file', async () => {
    const root = createMockDirHandle({
      name: 'workspace',
      children: [{ name: 'wt-feature', hasGitFile: true }],
    })

    const repos = await discoverEdgeGitRepos(root)
    expect(repos).toHaveLength(1)
    expect(repos[0].name).toBe('wt-feature')
    expect(repos[0].relativePath).toBe('workspace/wt-feature')
  })

  it('recursively discovers all git repos inside a parent workspace while skipping ignored directories', async () => {
    const root = createMockDirHandle({
      name: 'Develop',
      children: [
        { name: 'repo-alpha', hasGitDir: true },
        {
          name: 'ops',
          children: [
            { name: 'yggdrasil', hasGitDir: true },
            { name: 'other', hasGitDir: true },
          ],
        },
        {
          name: 'node_modules',
          children: [{ name: 'ignored-pkg', hasGitDir: true }],
        },
        {
          name: '.hidden',
          children: [{ name: 'ignored-hidden', hasGitDir: true }],
        },
      ],
    })

    const repos = await discoverEdgeGitRepos(root)
    expect(repos.map((r) => r.relativePath)).toEqual(['Develop/repo-alpha', 'Develop/ops/other', 'Develop/ops/yggdrasil'])
  })

  it('returns empty array when no git repositories are found', async () => {
    const root = createMockDirHandle({
      name: 'empty-dir',
      children: [{ name: 'docs' }],
    })

    const repos = await discoverEdgeGitRepos(root)
    expect(repos).toEqual([])
  })

  it('respects maxRepos limit', async () => {
    const root = createMockDirHandle({
      name: 'workspace',
      children: [
        { name: 'a', hasGitDir: true },
        { name: 'b', hasGitDir: true },
        { name: 'c', hasGitDir: true },
      ],
    })

    const repos = await discoverEdgeGitRepos(root, { maxRepos: 2 })
    expect(repos).toHaveLength(2)
  })
})
