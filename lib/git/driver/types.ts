import type { GitCommitChanges, GitLogView, GitProjectCatalog, GitProjectView } from '@/lib/git/types'

export type GitDriverMode = 'edge' | 'local'

export interface ReadLogOptions {
  repo: string
  branch?: string
  ref?: string
  skip?: number
  take?: number
}

export interface ReadCommitDiffOptions {
  repo: string
  hash: string
  tree?: boolean
  file?: string
  all?: boolean
}

export interface ReadBlobOptions {
  repo: string
  hash: string
  path: string
}

export interface AddProjectPayload {
  pathOrUrl: string
  name?: string
  handle?: FileSystemDirectoryHandle
}

export interface IGitDriver {
  readonly mode: GitDriverMode

  /**
   * Check if this driver is supported and operational in the current environment
   */
  isAvailable(): Promise<boolean>

  /**
   * Read branches, tags, stashes, and commit DAG history
   */
  readLog(options: ReadLogOptions): Promise<GitLogView>

  /**
   * Read commit file diffs / patch / status
   */
  readCommitDiff(options: ReadCommitDiffOptions): Promise<GitCommitChanges>

  /**
   * Read single file blob content at a specific commit hash
   */
  readBlob(options: ReadBlobOptions): Promise<{ content: string; binary: boolean }>

  /**
   * Get list of registered projects
   */
  getProjects(): Promise<GitProjectCatalog>

  /**
   * Register or associate a local handle or remote project
   */
  addProject(payload: AddProjectPayload): Promise<GitProjectView>
}
