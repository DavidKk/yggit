export type GraphLink = {
  from: number
  to: number
  color: number
}

export type GraphPoint = {
  lane: number
  color: number
  /** 上一行已经把线接到这个节点上方，需要从行顶画到圆点 */
  joins: boolean
  links: GraphLink[]
  /** Side rails converge only at the commit they actually target. */
  incoming?: GraphLink[]
}

type CommitNode = {
  hash: string
  parents: string[]
  /** A stash keeps its own lane until its base, without becoming part of branch ancestry. */
  attachment?: string
  /** A passthrough row keeps all existing lanes without placing a node dot or altering columns. */
  passthrough?: boolean
}

/**
 * 把「新的在前」的提交排成泳道。
 * 第一父提交沿用当前泳道，其余父提交另开泳道。
 * 不同颜色即使指向同一父提交，也保留独立路径，直到父提交所在行才汇合。
 */
export function layoutCommitGraph(commits: CommitNode[]): GraphPoint[] {
  let columns: Array<string | undefined> = []
  let colors: Array<number | undefined> = []
  let nextColor = 0
  const points: GraphPoint[] = []
  const attachments = new Map<string, string>()

  for (const commit of commits) {
    if (commit.passthrough) {
      const links: GraphLink[] = []
      columns.forEach((hash, index) => {
        if (!hash) return
        links.push({ from: index, to: index, color: colors[index] ?? 0 })
      })
      points.push({
        lane: -1,
        color: 0,
        joins: false,
        links,
      })
      continue
    }

    const expected = columns.indexOf(commit.hash)
    let lane = expected
    if (lane < 0) {
      lane = columns.findIndex((item) => item === undefined)
      if (lane < 0) {
        lane = columns.length
        columns.push(commit.hash)
        colors.push(undefined)
      } else {
        columns[lane] = commit.hash
      }
    }
    if (expected < 0 || colors[lane] === undefined) colors[lane] = nextColor++
    const commitColor = colors[lane] ?? 0

    const links: GraphLink[] = []
    columns.forEach((hash, index) => {
      if (!hash || index === lane || hash === commit.hash) return
      links.push({ from: index, to: index, color: colors[index] ?? 0 })
    })

    const nextColumns = columns.slice()
    const nextColors = colors.slice()
    nextColumns[lane] = undefined
    nextColors[lane] = undefined
    const incoming: GraphLink[] = []
    columns.forEach((hash, index) => {
      if (!hash || index === lane || (hash !== commit.hash && attachments.get(hash) !== commit.hash)) return
      incoming.push({ from: index, to: lane, color: colors[index] ?? 0 })
      const rail = links.findIndex((link) => link.from === index && link.to === index)
      if (rail >= 0) links.splice(rail, 1)
      nextColumns[index] = undefined
      nextColors[index] = undefined
      attachments.delete(hash)
    })

    if (commit.attachment) {
      attachments.set(commit.hash, commit.attachment)
      nextColumns[lane] = commit.hash
      nextColors[lane] = commitColor
      links.push({ from: lane, to: lane, color: commitColor })
    }

    for (let index = 0; index < commit.parents.length; index++) {
      const parent = commit.parents[index]
      // A first-parent edge carries this branch's color. Keep its lane even when
      // another branch is already waiting for the same parent.
      let parentLane = index === 0 ? lane : nextColumns.indexOf(parent)
      if (index === 0) {
        nextColumns[lane] = parent
        nextColors[lane] = commitColor
      }
      if (parentLane < 0) {
        // A lane with an incoming rail is unavailable until the next row.
        parentLane = nextColumns.findIndex((item, candidate) => item === undefined && columns[candidate] === undefined)
        if (parentLane < 0) parentLane = nextColumns.length
        while (nextColumns.length <= parentLane) {
          nextColumns.push(undefined)
          nextColors.push(undefined)
        }
        nextColumns[parentLane] = parent
      }
      while (nextColors.length <= parentLane) nextColors.push(undefined)
      if (nextColors[parentLane] === undefined) nextColors[parentLane] = index === 0 ? commitColor : nextColor++
      const color = index === 0 ? commitColor : (nextColors[parentLane] ?? commitColor)
      if (!links.some((link) => link.from === lane && link.to === parentLane)) links.push({ from: lane, to: parentLane, color })
    }

    while (nextColumns.length > 0 && nextColumns[nextColumns.length - 1] === undefined) {
      nextColumns.pop()
      nextColors.pop()
    }

    points.push({ lane, color: commitColor, joins: expected >= 0, links, ...(incoming.length ? { incoming } : {}) })
    columns = nextColumns
    colors = nextColors
  }

  return points
}
