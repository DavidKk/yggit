'use client'

export type AgentQuoteKind = 'branch' | 'commit' | 'file' | 'folder' | 'tag' | 'remote' | 'worktree' | 'stash'

export interface AgentReference {
  title: string
  kind?: AgentQuoteKind
  prompt?: string
  repoId?: string
  branch?: string
  commit?: string
  path?: string
  folder?: string
  tag?: string
  remote?: string
  worktree?: string
  stash?: string
  summary?: string
  [key: string]: unknown
}

export function quoteToAgent(reference: AgentReference, extraPrompt?: string) {
  if (typeof window === 'undefined') return
  const finalPrompt = extraPrompt || reference.prompt || reference.title
  window.dispatchEvent(
    new CustomEvent('yggit:agent_open', {
      detail: {
        reference,
        prompt: finalPrompt,
      },
    })
  )
}

export function quoteBranchToAgent(branch: string, isRemote?: boolean, repoId?: string) {
  const title = `分支: ${branch}`
  const prompt = `请协助分析分支 ${branch}${isRemote ? ' (远端)' : ''} 的代码改动、合并状态与协同处理建议。`
  quoteToAgent({ title, kind: 'branch', branch, repoId, prompt })
}

export function quoteCommitToAgent(commit: { hash: string; summary: string; author?: string }, repoId?: string) {
  const shortHash = commit.hash.slice(0, 7)
  const title = `提交 ${shortHash}: ${commit.summary}`
  const prompt = `请协助复核提交 ${shortHash}（"${commit.summary}"）的代码变更内容、影响范围与潜在风险。`
  quoteToAgent({ title, kind: 'commit', commit: commit.hash, summary: commit.summary, author: commit.author, repoId, prompt })
}

export function quoteFileToAgent(filePath: string, status?: string, repoId?: string) {
  const fileName = filePath.split('/').pop() || filePath
  const title = `文件: ${fileName}`
  const prompt = `请协助诊断文件 ${filePath}${status ? ` (${status})` : ''} 的改动逻辑与优化建议。`
  quoteToAgent({ title, kind: 'file', path: filePath, summary: status, repoId, prompt })
}

export function quoteFolderToAgent(folderPath: string, repoId?: string) {
  const title = `目录: ${folderPath}`
  const prompt = `请协助排查目录 ${folderPath} 下的变更范围与模块影响。`
  quoteToAgent({ title, kind: 'folder', folder: folderPath, repoId, prompt })
}

export function quoteTagToAgent(tagName: string, commitHash?: string, repoId?: string) {
  const title = `标签: ${tagName}`
  const prompt = `请协助检查发布标签 ${tagName}${commitHash ? ` (${commitHash.slice(0, 7)})` : ''} 的关联版本与变更集。`
  quoteToAgent({ title, kind: 'tag', tag: tagName, commit: commitHash, repoId, prompt })
}

export function quoteRemoteToAgent(remoteName: string, url?: string, repoId?: string) {
  const title = `远端: ${remoteName}`
  const prompt = `请协助检查远端仓库 ${remoteName}${url ? ` (${url})` : ''} 的连接与同步状态。`
  quoteToAgent({ title, kind: 'remote', remote: remoteName, summary: url, repoId, prompt })
}

export function quoteWorktreeToAgent(worktreePath: string, branch?: string, repoId?: string) {
  const dirName = worktreePath.split('/').pop() || worktreePath
  const title = `工作树: ${dirName}`
  const prompt = `请协助检查工作树 ${worktreePath}${branch ? ` (分支: ${branch})` : ''} 的工作状态与清理建议。`
  quoteToAgent({ title, kind: 'worktree', worktree: worktreePath, branch, repoId, prompt })
}

export function quoteStashToAgent(stashName: string, message?: string, repoId?: string) {
  const title = `暂存: ${stashName}`
  const prompt = `请协助查看暂存记录 ${stashName}${message ? ` (${message})` : ''} 的改动内容与恢复建议。`
  quoteToAgent({ title, kind: 'stash', stash: stashName, summary: message, repoId, prompt })
}
