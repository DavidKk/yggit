import { createDirectoryHandleFs } from './handle-fs'

export interface EdgeGitRemoteConfig {
  remote: string
  url: string
}

export interface EdgeGitBranchUpstream {
  remote: string
  merge: string
}

export interface EdgeGitConfigData {
  remotes: EdgeGitRemoteConfig[]
  branchUpstreams: Map<string, EdgeGitBranchUpstream>
}

interface FsReadOnlyLike {
  promises: {
    readFile(filepath: string, opts?: unknown): Promise<Uint8Array | string>
  }
}

function stripGitConfigComment(line: string): string {
  let inQuotes = false
  let escaped = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inQuotes) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && (ch === '#' || ch === ';')) {
      return line.slice(0, i)
    }
  }
  return line
}

function unquoteGitConfigValue(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  }
  return trimmed
}

/**
 * Parse remote URLs and branch upstream tracking entries directly from `.git/config`.
 * Avoids repeated `git.getConfig` / `git.listRemotes` round-trips across folders and branches.
 */
export function parseGitConfigText(text: string): EdgeGitConfigData {
  const remoteMap = new Map<string, string>()
  const branchUpstreams = new Map<string, EdgeGitBranchUpstream>()

  let currentKind: 'remote' | 'branch' | '' = ''
  let currentName = ''

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripGitConfigComment(rawLine).trim()
    if (!line) continue

    if (line.startsWith('[') && line.endsWith(']')) {
      const inner = line.slice(1, -1).trim()
      const sectionMatch = /^([A-Za-z0-9.-]+)(?:\s+"((?:\\.|[^"])*)")?$/.exec(inner)
      if (!sectionMatch) {
        currentKind = ''
        currentName = ''
        continue
      }
      const section = sectionMatch[1].toLowerCase()
      const subsection = sectionMatch[2] ? sectionMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : ''
      if ((section === 'remote' || section === 'branch') && subsection) {
        currentKind = section
        currentName = subsection
      } else {
        currentKind = ''
        currentName = ''
      }
      continue
    }

    if (!currentKind || !currentName) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue
    const key = line.slice(0, eqIndex).trim().toLowerCase()
    const value = unquoteGitConfigValue(line.slice(eqIndex + 1))

    if (currentKind === 'remote' && key === 'url' && value && !remoteMap.has(currentName)) {
      remoteMap.set(currentName, value)
    } else if (currentKind === 'branch') {
      const prev = branchUpstreams.get(currentName) || { remote: '', merge: '' }
      if (key === 'remote') prev.remote = value
      else if (key === 'merge') prev.merge = value
      branchUpstreams.set(currentName, prev)
    }
  }

  return {
    remotes: Array.from(remoteMap.entries()).map(([remote, url]) => ({ remote, url })),
    branchUpstreams,
  }
}

/** Read parsed `.git/config` data from an Edge fs adapter without throwing on missing config. */
export async function readGitConfigData(fs: FsReadOnlyLike): Promise<EdgeGitConfigData> {
  try {
    const text = (await fs.promises.readFile('/.git/config', 'utf8')) as string
    return parseGitConfigText(text)
  } catch {
    return { remotes: [], branchUpstreams: new Map() }
  }
}

/** Read configured remotes straight from a FileSystemDirectoryHandle for project catalog discovery. */
export async function readGitRemotesFromHandle(handle: FileSystemDirectoryHandle): Promise<EdgeGitRemoteConfig[]> {
  try {
    const fs = createDirectoryHandleFs(handle)
    const { remotes } = await readGitConfigData(fs)
    return remotes
  } catch {
    return []
  }
}
