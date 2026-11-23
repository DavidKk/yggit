'use client'

import { useCallback } from 'react'

export type AgentQuoteKind = 'branch' | 'commit' | 'file' | 'folder' | 'tag' | 'remote' | 'worktree' | 'stash' | 'task'

export type AgentQuoteTarget = 'sidebar' | 'bottom' | 'auto'

export interface AgentReference {
  title: string
  kind?: AgentQuoteKind
  prompt?: string
  repoId?: string
  repoAlias?: string
  branch?: string
  commit?: string
  path?: string
  folder?: string
  tag?: string
  remote?: string
  worktree?: string
  stash?: string
  summary?: string
  taskId?: string
  itemId?: string
  solution?: string
  scope?: string
  [key: string]: unknown
}

export interface AgentOpenEventDetail {
  reference?: AgentReference
  prompt?: string
  target?: AgentQuoteTarget
}

export interface QuoteOptions {
  extraPrompt?: string
  target?: AgentQuoteTarget
}

/**
 * Checks whether the Agent sidebar is currently open.
 * Uses DOM dataset flag or query selector to work seamlessly in both React and non-React contexts.
 */
export function isAgentSidebarOpen(): boolean {
  if (typeof document === 'undefined') return false
  if (document.documentElement.dataset.agentSidebarOpen !== undefined) {
    return document.documentElement.dataset.agentSidebarOpen === 'true'
  }
  return !!document.querySelector('[data-agent-sidebar]')
}

/**
 * Unified central entry service for quoting references or prompts to Git Agent.
 *
 * Routing logic:
 * - If sidebar is NOT open (collapsed), quotes prioritize the bottom bar (GitAgentBar).
 * - If sidebar IS open, quotes route directly into the sidebar (AgentWorkspace).
 * - Explicit target override ('sidebar' or 'bottom') can be passed in options.
 */
export function quoteToAgent(referenceOrPrompt: AgentReference | string, options?: QuoteOptions | string) {
  if (typeof window === 'undefined') return

  const extraPrompt = typeof options === 'string' ? options : options?.extraPrompt
  const preferredTarget = typeof options === 'object' ? options?.target : undefined

  let reference: AgentReference | undefined
  let prompt: string | undefined

  if (typeof referenceOrPrompt === 'string') {
    prompt = referenceOrPrompt
  } else {
    reference = referenceOrPrompt
    prompt = extraPrompt || reference.prompt || reference.title
  }

  const resolvedTarget: AgentQuoteTarget = preferredTarget && preferredTarget !== 'auto' ? preferredTarget : isAgentSidebarOpen() ? 'sidebar' : 'bottom'

  window.dispatchEvent(
    new CustomEvent<AgentOpenEventDetail>('yggit:agent_open', {
      detail: {
        reference,
        prompt,
        target: resolvedTarget,
      },
    })
  )
}

/**
 * Quick helper to send a prompt to Agent respecting open/closed sidebar state.
 */
export function quotePromptToAgent(prompt: string, target?: AgentQuoteTarget) {
  quoteToAgent(prompt, { target })
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

export function quoteWorkdeskTaskToAgent(params: {
  title: string
  prompt?: string
  taskId?: string
  itemId?: string
  repoId?: string
  repoAlias?: string
  branch?: string
  summary?: string
  solution?: string
  scope?: string
  target?: AgentQuoteTarget
}) {
  const { title, prompt, target, ...rest } = params
  const defaultPrompt = prompt || `请协助分析并处理任务【${title}】。`
  quoteToAgent(
    {
      title,
      kind: 'task',
      prompt: defaultPrompt,
      ...rest,
    },
    { target }
  )
}

/**
 * React hook providing centralized Agent quote capabilities.
 */
export function useAgentQuote() {
  const isSidebarOpen = typeof window !== 'undefined' ? isAgentSidebarOpen() : false

  const quote = useCallback((referenceOrPrompt: AgentReference | string, options?: QuoteOptions | string) => {
    quoteToAgent(referenceOrPrompt, options)
  }, [])

  const quoteCommit = useCallback((commit: { hash: string; summary: string; author?: string }, repoId?: string) => {
    quoteCommitToAgent(commit, repoId)
  }, [])

  const quoteBranch = useCallback((branch: string, isRemote?: boolean, repoId?: string) => {
    quoteBranchToAgent(branch, isRemote, repoId)
  }, [])

  const quoteFile = useCallback((filePath: string, status?: string, repoId?: string) => {
    quoteFileToAgent(filePath, status, repoId)
  }, [])

  const quoteFolder = useCallback((folderPath: string, repoId?: string) => {
    quoteFolderToAgent(folderPath, repoId)
  }, [])

  const quoteTag = useCallback((tagName: string, commitHash?: string, repoId?: string) => {
    quoteTagToAgent(tagName, commitHash, repoId)
  }, [])

  const quoteRemote = useCallback((remoteName: string, url?: string, repoId?: string) => {
    quoteRemoteToAgent(remoteName, url, repoId)
  }, [])

  const quoteWorktree = useCallback((worktreePath: string, branch?: string, repoId?: string) => {
    quoteWorktreeToAgent(worktreePath, branch, repoId)
  }, [])

  const quoteStash = useCallback((stashName: string, message?: string, repoId?: string) => {
    quoteStashToAgent(stashName, message, repoId)
  }, [])

  const quotePrompt = useCallback((prompt: string, target?: AgentQuoteTarget) => {
    quotePromptToAgent(prompt, target)
  }, [])

  const quoteWorkdeskTask = useCallback((params: Parameters<typeof quoteWorkdeskTaskToAgent>[0]) => {
    quoteWorkdeskTaskToAgent(params)
  }, [])

  return {
    isSidebarOpen,
    quote,
    quoteCommit,
    quoteBranch,
    quoteFile,
    quoteFolder,
    quoteTag,
    quoteRemote,
    quoteWorktree,
    quoteStash,
    quotePrompt,
    quoteWorkdeskTask,
  }
}
