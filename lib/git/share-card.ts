import { makeShareUrl } from '@/lib/git/resolver'
import type { MergeTopologyInfo } from '@/lib/git/topology'
import type { GitCommit } from '@/lib/git/types'

export interface IssueSharePayload {
  repoName: string
  repoPathOrUrl: string
  remoteUrl?: string
  commit: GitCommit
  file?: string
  lines?: string
  topology?: MergeTopologyInfo
  originUrl?: string
}

export function makeIssueShareUrl(payload: IssueSharePayload): string {
  const base = makeShareUrl(payload.repoPathOrUrl, payload.commit.hash, payload.remoteUrl)
  const url = new URL(base, 'http://localhost') // dummy origin to manipulate URLSearchParams safely

  if (payload.file) {
    url.searchParams.set('file', payload.file)
  }

  let fullPath = `${url.pathname}${url.search}`
  if (payload.lines) {
    fullPath += `#L${payload.lines}`
  }

  return fullPath
}

export function formatIssueShareCard(payload: IssueSharePayload, fullShareUrl: string): {
  markdown: string
  plain: string
} {
  const { commit, repoName, file, lines, topology } = payload
  const linesInfo = lines ? ` (L${lines})` : ''
  const subject = commit.subject.trim()

  let topologyMarkdown = ''
  let topologyPlain = ''
  if (topology?.isMerge) {
    const src = topology.sourceBranchHint || 'feature'
    const tgt = topology.targetBranchHint || 'target'
    topologyMarkdown = `- **合并脉络**：\`${src}\` ➔ \`${tgt}\``
    topologyPlain = `合并脉络: ${src} -> ${tgt}`
  }

  const platform = payload.remoteUrl?.includes('gitlab')
    ? 'GitLab'
    : payload.remoteUrl?.includes('github')
      ? 'GitHub'
      : 'Git'
  const remoteInfo = payload.remoteUrl ? `- **远程源**：\`${payload.remoteUrl}\`` : ''
  const remotePlain = payload.remoteUrl ? `远程源: ${payload.remoteUrl}` : ''

  const markdownParts = [
    `🔍 **[Yggit 代码问题排查]**`,
    `- **平台与仓库**：${platform} · \`${repoName}\``,
    remoteInfo,
    `- **提交**：\`${commit.short}\` — ${subject}`,
    topologyMarkdown,
    file ? `- **问题文件**：\`${file}\`${linesInfo}` : '',
    `👉 **[点击在 Yggit 中交互式排查拓扑与代码差异](${fullShareUrl})**`,
  ].filter(Boolean)

  const plainParts = [
    `[Yggit 代码问题排查]`,
    `平台与仓库: ${platform} - ${repoName}`,
    remotePlain,
    `提交: ${commit.short} - ${subject}`,
    topologyPlain,
    file ? `问题文件: ${file}${linesInfo}` : '',
    `在线排查: ${fullShareUrl}`,
  ].filter(Boolean)

  return {
    markdown: markdownParts.join('\n'),
    plain: plainParts.join('\n'),
  }
}
