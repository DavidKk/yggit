import { buildGraphRows, graphScene, ROW, xAt } from '@/lib/git/graph-scene'
import type { GitCommit, GitStash } from '@/lib/git/types'

function commit(hash: string, date: number, parents: string[] = [], refs: string[] = []): GitCommit {
  return { hash, short: hash, parents, refs, author: 'Author', subject: hash, date: new Date(date * 1000).toISOString() }
}

function stash(hash: string, date: number, base = 'test-base'): GitStash {
  return { hash, name: `stash@{${hash}}`, base, subject: hash, date: new Date(date * 1000).toISOString() }
}

const commits = [
  commit('editor-tip', 100, ['editor-base'], ['HEAD -> editor']),
  commit('test-tip', 80, ['test-base']),
  commit('test-base', 40, ['root']),
  commit('editor-base', 30, ['root']),
  commit('root', 10),
]
const stashes = [stash('new', 90), stash('other', 85), stash('wip', 35, 'editor-base')]

function rowHashes(rows: ReturnType<typeof buildGraphRows>, history = commits) {
  return rows.map((row) => (row.kind === 'stash' ? row.stash.hash : row.kind === 'commit' ? history[row.index].hash : 'worktree'))
}

describe('stash graph scene', () => {
  it('inserts stashes at their creation time while keeping ordinary commit order', () => {
    const rows = buildGraphRows(commits, stashes, null)
    expect(rowHashes(rows)).toEqual(['editor-tip', 'new', 'other', 'test-tip', 'test-base', 'wip', 'editor-base', 'root'])
    expect(rows.filter((row) => row.kind === 'commit').map((row) => row.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('gives stashes with the same base separate visible lanes all the way to the base', () => {
    const scene = graphScene(commits, null, stashes)
    const first = scene.stashPoints.get('new')!
    const second = scene.stashPoints.get('other')!
    expect(scene.points[0].lane).toBe(0)
    expect([first.lane, second.lane, scene.points[1].lane]).toEqual([1, 2, 3])
    expect(first.color).not.toBe(second.color)
    expect(scene.stashMarks.slice(0, 2).map((mark) => mark.x)).toEqual([xAt(1), xAt(2)])
    const base = scene.points[2]
    expect(base.incoming).toEqual([
      { from: first.lane, to: base.lane, color: first.color },
      { from: second.lane, to: base.lane, color: second.color },
    ])
    for (const point of [first, second]) {
      const strokes = scene.strokes.filter((stroke) => stroke.color === point.color)
      expect(strokes.every((stroke) => stroke.dashed)).toBe(true)
      expect(strokes.at(-1)?.d).toContain(`${xAt(base.lane)} ${scene.commitRow[2] * ROW + ROW / 2}`)
    }
    expect([first.color, second.color]).not.toContain(base.color)
  })

  it('shows a recent stash before its base has been loaded and connects it after pagination', () => {
    const partial = graphScene(commits.slice(0, 2), null, stashes)
    const full = graphScene(commits, null, stashes)
    expect(rowHashes(partial.rows)).toEqual(['editor-tip', 'new', 'other', 'test-tip'])
    expect(full.rows.slice(0, partial.rows.length)).toEqual(partial.rows.map((row) => (row.kind === 'stash' ? { ...row, baseIndex: 2 } : row)))
    expect(partial.stashMarks).toEqual(full.stashMarks.slice(0, 2))
    expect(full.points[2].incoming).toHaveLength(2)
  })

  it('does not let an older stash precede its base when commit dates are skewed', () => {
    const rows = buildGraphRows(commits, [stash('skewed', 5)], null)
    expect(rowHashes(rows)).toEqual(['editor-tip', 'test-tip', 'skewed', 'test-base', 'editor-base', 'root'])
  })

  it('does not reorder Git history to compensate for skewed commit timestamps', () => {
    const skewed = [commit('child', 20, ['parent']), commit('parent', 50)]
    expect(rowHashes(buildGraphRows(skewed, [stash('saved', 25, 'parent')], null), skewed)).toEqual(['saved', 'child', 'parent'])
  })

  it('keeps a dirty worktree connected to HEAD above the independent stash nodes', () => {
    const scene = graphScene(commits, { files: 1, insertions: 1, deletions: 0 }, stashes)
    expect(rowHashes(scene.rows).slice(0, 4)).toEqual(['worktree', 'editor-tip', 'new', 'other'])
    expect(scene.dots[0].x).toBe(xAt(scene.points[0].lane))
    expect(scene.stashMarks).toHaveLength(3)
    expect(scene.height).toBe(scene.rows.length * ROW)
  })

  it('defers old stashes outside the loaded history and deduplicates stash objects', () => {
    expect(rowHashes(buildGraphRows(commits, [stash('old', 1, 'unloaded'), stashes[0], stashes[0]], null))).toEqual([
      'editor-tip',
      'new',
      'test-tip',
      'test-base',
      'editor-base',
      'root',
    ])
  })

  it('shows stash-only history without manufacturing an ordinary commit', () => {
    const scene = graphScene([], null, [stash('orphan', 100)])
    expect(rowHashes(scene.rows, [])).toEqual(['orphan'])
    expect(scene.points).toEqual([])
    expect(scene.stashMarks).toHaveLength(1)
    expect(scene.laneCount).toBe(1)
  })

  it('keeps ordinary joins solid and stash joins dashed when both converge at the same base', () => {
    const scene = graphScene([commit('head', 100, ['base']), commit('release', 80, ['base']), commit('base', 40)], null, [stash('saved', 90, 'base')])
    const saved = scene.stashPoints.get('saved')!
    const release = scene.points[1]
    const base = scene.points[2]
    expect(base.incoming).toEqual([
      { from: saved.lane, to: base.lane, color: saved.color },
      { from: release.lane, to: base.lane, color: release.color },
    ])
    const joins = scene.strokes.filter((stroke) => stroke.key.startsWith('base:attachment:'))
    expect(joins.map((stroke) => [stroke.color, stroke.dashed, stroke.bridge])).toEqual([
      [saved.color, true, true],
      [release.color, false, true],
    ])
    const firstBend = scene.strokes.findIndex((stroke) => stroke.bridge)
    expect(scene.strokes.slice(firstBend).every((stroke) => stroke.bridge)).toBe(true)
  })

  it('populates stroke gradient endpoints and lane indices for organic color transitions', () => {
    const scene = graphScene([commit('head', 100, ['base']), commit('feature', 80, ['base']), commit('base', 40)], null, [])
    const mergeStrokes = scene.strokes.filter((s) => s.bridge)
    expect(mergeStrokes.length).toBeGreaterThan(0)
    for (const stroke of mergeStrokes) {
      expect(stroke.startColor).toBeDefined()
      expect(stroke.targetColor).toBeDefined()
      expect(stroke.x1).toBeDefined()
      expect(stroke.y1).toBeDefined()
      expect(stroke.x2).toBeDefined()
      expect(stroke.y2).toBeDefined()
      expect(stroke.hash).toBeDefined()
    }
  })
})
