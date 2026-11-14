import { layoutCommitGraph } from '@/lib/git/graph'

describe('commit graph lanes', () => {
  it('keeps a straight history on one lane', () => {
    const points = layoutCommitGraph([
      { hash: 'a', parents: ['b'] },
      { hash: 'b', parents: ['c'] },
      { hash: 'c', parents: [] },
    ])
    expect(points.map((point) => point.lane)).toEqual([0, 0, 0])
    expect(points.map((point) => point.joins)).toEqual([false, true, true])
    expect(points[0].links).toEqual([{ from: 0, to: 0, color: 0 }])
  })

  it('keeps a second child on its own rail until the shared parent row', () => {
    const points = layoutCommitGraph([
      { hash: 'a', parents: ['r'] },
      { hash: 'b', parents: ['r'] },
      { hash: 'r', parents: [] },
    ])
    expect(points.map((point) => point.lane)).toEqual([0, 1, 0])
    expect(points[2].joins).toBe(true)
    expect(points[1].links).toEqual(
      expect.arrayContaining([
        { from: 0, to: 0, color: 0 },
        { from: 1, to: 1, color: 1 },
      ])
    )
    expect(points[2].incoming).toEqual([{ from: 1, to: 0, color: 1 }])
    expect(points[1].color).not.toBe(points[0].color)
  })

  it('gives a merge a second lane for the other parent', () => {
    const points = layoutCommitGraph([
      { hash: 'm', parents: ['a', 'b'] },
      { hash: 'a', parents: ['r'] },
      { hash: 'b', parents: ['r'] },
      { hash: 'r', parents: [] },
    ])
    expect(points[0].lane).toBe(0)
    expect(points[0].links).toEqual(
      expect.arrayContaining([
        { from: 0, to: 0, color: points[0].color },
        { from: 0, to: 1, color: expect.any(Number) },
      ])
    )
    expect(points.map((point) => point.lane)).toEqual([0, 0, 1, 0])
  })

  it('does not put a release tip onto an existing merge-parent rail before the actual parent', () => {
    const points = layoutCommitGraph([
      { hash: 'test-tip', parents: ['test-base', 'release-base'] },
      { hash: 'release-tip', parents: ['release-base'] },
      { hash: 'test-base', parents: ['root'] },
      { hash: 'release-base', parents: ['root'] },
      { hash: 'root', parents: [] },
    ])
    const release = points[1]
    expect(release.lane).toBe(2)
    expect(release.links).toContainEqual({ from: 2, to: 2, color: release.color })
    expect(points[2].links).toContainEqual({ from: 2, to: 2, color: release.color })
    expect(points[3].incoming).toEqual([{ from: 2, to: 1, color: release.color }])
    expect(points[3].links).toContainEqual({ from: 1, to: 1, color: points[3].color })
    expect(points[4].incoming).toEqual([{ from: 1, to: 0, color: points[3].color }])
    for (const point of points) {
      const paths = point.links.map((link) => `${link.from}:${link.to}`)
      expect(new Set(paths).size).toBe(paths.length)
    }
  })

  it('does not reuse an incoming rail for another merge parent on the same row', () => {
    const points = layoutCommitGraph([
      { hash: 'a', parents: ['r'] },
      { hash: 'b', parents: ['r'] },
      { hash: 'r', parents: ['x', 'y'] },
      { hash: 'x', parents: [] },
      { hash: 'y', parents: [] },
    ])
    expect(points[2].incoming).toEqual([{ from: 1, to: 0, color: points[1].color }])
    expect(points[2].links).toContainEqual({ from: 0, to: 2, color: points[4].color })
    expect(points[2].links.some((link) => link.to === 1)).toBe(false)
  })
})
