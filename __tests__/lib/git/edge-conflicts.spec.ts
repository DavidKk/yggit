import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { conflictRegions, fileRemergePatch } from '@/lib/git/conflict-regions'
import { buildEdgeRemergeDiff, detectEdgeMergeConflict, detectThreeWayConflicts } from '@/lib/git/driver/edge-conflicts'
import { EdgeRepositoryReader } from '@/lib/git/driver/edge-repository-reader'
import { detectMergeConflict } from '@/services/git/conflicts'

function createHandle(directoryPath: string): FileSystemDirectoryHandle {
  return {
    name: path.basename(directoryPath),
    kind: 'directory',
    async getDirectoryHandle(name: string) {
      const entry = path.join(directoryPath, name)
      if (!(await fs.stat(entry)).isDirectory()) throw new Error('Not a directory')
      return createHandle(entry)
    },
    async getFileHandle(name: string) {
      const entry = path.join(directoryPath, name)
      if (!(await fs.stat(entry)).isFile()) throw new Error('Not a file')
      return {
        async getFile() {
          const stat = await fs.stat(entry)
          return {
            size: stat.size,
            lastModified: stat.mtimeMs,
            async arrayBuffer() {
              return Uint8Array.from(await fs.readFile(entry)).buffer
            },
            async text() {
              return fs.readFile(entry, 'utf8')
            },
          }
        },
      }
    },
    async *keys() {
      yield* await fs.readdir(directoryPath)
    },
  } as unknown as FileSystemDirectoryHandle
}

describe('edge-conflicts', () => {
  it('detects overlapping 3-way edits as conflict regions', () => {
    const base = ['line1', 'line2', 'line3', 'line4'].join('\n')
    const ours = ['line1', 'ours2', 'line3', 'line4'].join('\n')
    const theirs = ['line1', 'theirs2', 'line3', 'line4'].join('\n')

    const res = detectThreeWayConflicts(base, ours, theirs, 'abc1234', 'def5678')
    expect(res.count).toBe(1)
    expect(res.conflictBlocks[0]).toContain('-<<<<<<< abc1234')
    expect(res.conflictBlocks[0]).toContain('-ours2')
    expect(res.conflictBlocks[0]).toContain('-=======')
    expect(res.conflictBlocks[0]).toContain('-theirs2')
    expect(res.conflictBlocks[0]).toContain('->>>>>>> def5678')
  })

  it('detects adjacent line edits and boundary insertions matching git merge-tree', () => {
    const base = ['line1', 'line2', 'line3', 'line4', ''].join('\n')

    // Adjacent lines 2 & 3 modified on opposite branches
    const adj = detectThreeWayConflicts(base, ['line1', 'OURS2', 'line3', 'line4', ''].join('\n'), ['line1', 'line2', 'THEIRS3', 'line4', ''].join('\n'))
    expect(adj.count).toBe(1)

    // Insertion right after line 1 collides with edit on line 2
    const insBoundary = detectThreeWayConflicts(base, ['line1', 'OURS2', 'line3', 'line4', ''].join('\n'), ['line1', 'INSERTED', 'line2', 'line3', 'line4', ''].join('\n'))
    expect(insBoundary.count).toBe(1)

    // Insertion after line 1 with edit on line 3 stays separated by untouched line 2
    const nonAdjacent = detectThreeWayConflicts(base, ['line1', 'line2', 'OURS3', 'line4', ''].join('\n'), ['line1', 'INSERTED', 'line2', 'line3', 'line4', ''].join('\n'))
    expect(nonAdjacent.count).toBe(0)
  })

  it('treats non-overlapping edits on different lines as clean', () => {
    const base = ['line1', 'line2', 'line3', 'line4'].join('\n')
    const ours = ['ours1', 'line2', 'line3', 'line4'].join('\n')
    const theirs = ['line1', 'line2', 'line3', 'theirs4'].join('\n')

    const res = detectThreeWayConflicts(base, ours, theirs)
    expect(res.count).toBe(0)
    expect(res.conflictBlocks).toEqual([])
  })

  it('treats identical edits on both sides as clean', () => {
    const base = ['line1', 'line2'].join('\n')
    const same = ['line1', 'updated'].join('\n')

    const res = detectThreeWayConflicts(base, same, same)
    expect(res.count).toBe(0)
  })
})

describe('edge-conflicts parity with Local git merge-tree', () => {
  let repoDir = ''

  function gitCmd(...args: string[]): string {
    return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', repoDir, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test Bot',
        GIT_AUTHOR_EMAIL: 'test@yggit.local',
        GIT_COMMITTER_NAME: 'Test Bot',
        GIT_COMMITTER_EMAIL: 'test@yggit.local',
      },
    }).trim()
  }

  beforeEach(async () => {
    repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yggit-edge-conflicts-'))
    gitCmd('init', '-b', 'main')
  })

  afterEach(async () => {
    if (repoDir) {
      await fs.rm(repoDir, { recursive: true, force: true })
    }
  })

  it('matches Local merge-tree on criss-cross multi-merge-base, adjacent, tree/file, empty add/add, and rename conflicts', async () => {
    await fs.writeFile(path.join(repoDir, 'crisscross.txt'), 'a\nb\nc\nd\n')
    await fs.writeFile(path.join(repoDir, 'adj.txt'), 'line1\nline2\nline3\nline4\n')
    await fs.writeFile(path.join(repoDir, 'rename-del.txt'), 'payload\nkeep\n')
    await fs.mkdir(path.join(repoDir, 'unchanged'), { recursive: true })
    await fs.writeFile(path.join(repoDir, 'unchanged', 'same.txt'), 'steady\n')
    gitCmd('add', '.')
    gitCmd('commit', '-m', 'base')
    const baseHash = gitCmd('rev-parse', 'HEAD')

    // Branch A modifies line 'b' -> FROM_A
    gitCmd('checkout', '-b', 'branch-a', baseHash)
    await fs.writeFile(path.join(repoDir, 'crisscross.txt'), 'a\nFROM_A\nc\nd\n')
    gitCmd('add', '.')
    gitCmd('commit', '-m', 'a1')
    const a1 = gitCmd('rev-parse', 'HEAD')

    // Branch B modifies the same line 'b' -> FROM_B
    gitCmd('checkout', '-b', 'branch-b', baseHash)
    await fs.writeFile(path.join(repoDir, 'crisscross.txt'), 'a\nFROM_B\nc\nd\n')
    gitCmd('add', '.')
    gitCmd('commit', '-m', 'b1')
    const b1 = gitCmd('rev-parse', 'HEAD')

    // Criss-cross step 1: A merges B1 resolving crisscross.txt to FROM_A; also edits adj.txt line 2, adds empty add-empty.txt, adds dir conflict target, deletes rename-del.txt
    gitCmd('checkout', a1)
    try {
      gitCmd('merge', '--no-ff', b1, '-m', 'a-merges-b1')
    } catch {
      await fs.writeFile(path.join(repoDir, 'crisscross.txt'), 'a\nFROM_A\nc\nd\n')
      gitCmd('add', 'crisscross.txt')
      gitCmd('commit', '--no-edit')
    }
    await fs.writeFile(path.join(repoDir, 'adj.txt'), 'line1\nOURS2\nline3\nline4\n')
    await fs.writeFile(path.join(repoDir, 'add-empty.txt'), '')
    await fs.mkdir(path.join(repoDir, 'node-collision'), { recursive: true })
    await fs.writeFile(path.join(repoDir, 'node-collision', 'child.txt'), 'inside tree\n')
    gitCmd('rm', 'rename-del.txt')
    gitCmd('add', '.')
    gitCmd('commit', '-m', 'a2')
    const p1 = gitCmd('rev-parse', 'HEAD')

    // Criss-cross step 2: B merges A1 resolving crisscross.txt to FROM_B (now P1 and P2 share TWO LCAs: A1 and B1!), edits adj.txt line 3, adds non-empty add-empty.txt, adds file node-collision, renames rename-del.txt -> moved.txt
    gitCmd('checkout', b1)
    try {
      gitCmd('merge', '--no-ff', a1, '-m', 'b-merges-a1')
    } catch {
      await fs.writeFile(path.join(repoDir, 'crisscross.txt'), 'a\nFROM_B\nc\nd\n')
      gitCmd('add', 'crisscross.txt')
      gitCmd('commit', '--no-edit')
    }
    await fs.writeFile(path.join(repoDir, 'adj.txt'), 'line1\nline2\nTHEIRS3\nline4\n')
    await fs.writeFile(path.join(repoDir, 'add-empty.txt'), 'non-empty on b\n')
    await fs.writeFile(path.join(repoDir, 'node-collision'), 'blob colliding with tree\n')
    gitCmd('mv', 'rename-del.txt', 'moved.txt')
    gitCmd('add', '.')
    gitCmd('commit', '-m', 'b2')
    const p2 = gitCmd('rev-parse', 'HEAD')

    // Create manual resolved merge commit with parents [p1, p2]
    try {
      gitCmd('merge', '--no-ff', p1, '-m', 'merge: resolved crisscross + structural')
    } catch {
      // Git conflicted as expected; write resolved state cleanly without markers
      await fs.rm(path.join(repoDir, 'node-collision'), { recursive: true, force: true })
      await fs.writeFile(path.join(repoDir, 'crisscross.txt'), 'resolved\n')
      await fs.writeFile(path.join(repoDir, 'adj.txt'), 'resolved\n')
      await fs.writeFile(path.join(repoDir, 'add-empty.txt'), 'resolved\n')
      await fs.writeFile(path.join(repoDir, 'node-collision'), 'resolved\n')
      await fs.writeFile(path.join(repoDir, 'moved.txt'), 'payload\nkeep\n')
      gitCmd('add', '.')
      gitCmd('commit', '--no-edit')
    }
    const mergeHash = gitCmd('rev-parse', 'HEAD')

    const localRecord = await detectMergeConflict(repoDir, mergeHash, [p2, p1])
    const reader = new EdgeRepositoryReader(createHandle(repoDir))
    const edgeRecord = await detectEdgeMergeConflict(reader, mergeHash, [p2, p1])
    const remerge = await buildEdgeRemergeDiff(reader, mergeHash)

    expect(localRecord.hasConflict).toBe(true)
    expect(edgeRecord.hasConflict).toBe(true)
    expect(edgeRecord.status).toBe('conflicted')
    expect(edgeRecord.conflictFiles).toEqual(expect.arrayContaining(['crisscross.txt', 'adj.txt', 'add-empty.txt', 'node-collision', 'rename-del.txt']))
    expect(remerge.files).toEqual(expect.arrayContaining(['crisscross.txt', 'adj.txt', 'add-empty.txt', 'node-collision', 'rename-del.txt']))

    const adjPatch = fileRemergePatch(remerge.diff, 'adj.txt')
    expect(adjPatch).toContain('-<<<<<<<')
    expect(adjPatch).toContain('-=======')
    expect(adjPatch).toContain('->>>>>>>')
    const adjOurs = (await reader.readBlob(p2, 'adj.txt')).content
    const adjTheirs = (await reader.readBlob(p1, 'adj.txt')).content
    expect(conflictRegions(adjPatch, [adjOurs, adjTheirs]).length).toBeGreaterThan(0)
  })
})
