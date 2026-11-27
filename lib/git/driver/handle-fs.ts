function createError(code: string, message: string): Error & { code: string } {
  const err = new Error(`${code}: ${message}`) as Error & { code: string }
  err.code = code
  return err
}

/**
 * Lightweight FileSystem adapter for isomorphic-git built on top of the browser's
 * FileSystemDirectoryHandle (Web File System Access API).
 */
export function createDirectoryHandleFs(rootHandle: FileSystemDirectoryHandle) {
  const dirCache = new Map<string, FileSystemDirectoryHandle>([['', rootHandle]])
  const fileHandleCache = new Map<string, FileSystemFileHandle>()
  const kindCache = new Map<string, 'file' | 'directory'>([['', 'directory']])

  function clearCache() {
    dirCache.clear()
    dirCache.set('', rootHandle)
    fileHandleCache.clear()
    kindCache.clear()
    kindCache.set('', 'directory')
  }

  function invalidatePath(filepath: string) {
    const clean = toSegments(filepath).join('/')
    if (!clean) {
      clearCache()
      return
    }
    fileHandleCache.delete(clean)
    dirCache.delete(clean)
    kindCache.delete(clean)
    const prefix = `${clean}/`
    for (const key of dirCache.keys()) {
      if (key.startsWith(prefix)) dirCache.delete(key)
    }
    for (const key of fileHandleCache.keys()) {
      if (key.startsWith(prefix)) fileHandleCache.delete(key)
    }
    for (const key of kindCache.keys()) {
      if (key.startsWith(prefix)) kindCache.delete(key)
    }
  }

  function toSegments(filepath: string): string[] {
    return filepath
      .replace(/\\/g, '/')
      .split('/')
      .filter((s) => s.length > 0 && s !== '.')
  }

  async function resolveDirBySegments(parts: string[], create = false): Promise<FileSystemDirectoryHandle> {
    const key = parts.join('/')
    if (!create) {
      const cached = dirCache.get(key)
      if (cached) return cached
    }
    // Walk down from the deepest cached ancestor directory
    let startIdx = 0
    let current = rootHandle
    if (!create) {
      for (let i = parts.length - 1; i >= 1; i--) {
        const prefix = parts.slice(0, i).join('/')
        const ancestor = dirCache.get(prefix)
        if (ancestor) {
          current = ancestor
          startIdx = i
          break
        }
      }
    }
    for (let i = startIdx; i < parts.length; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i], { create })
        const prefix = parts.slice(0, i + 1).join('/')
        dirCache.set(prefix, current)
        kindCache.set(prefix, 'directory')
      } catch {
        throw createError('ENOENT', `no such file or directory, opendir '${key}'`)
      }
    }
    return current
  }

  async function resolveTarget(filepath: string, createDirs = false): Promise<{ parent: FileSystemDirectoryHandle; name: string; cleanPath: string } | null> {
    const parts = toSegments(filepath)
    if (parts.length === 0) return null
    const parentParts = parts.slice(0, -1)
    let parent: FileSystemDirectoryHandle
    try {
      parent = await resolveDirBySegments(parentParts, createDirs)
    } catch {
      throw createError('ENOENT', `no such file or directory, open '${filepath}'`)
    }
    return { parent, name: parts[parts.length - 1], cleanPath: parts.join('/') }
  }

  async function resolveDir(dirpath: string, create = false): Promise<FileSystemDirectoryHandle> {
    return resolveDirBySegments(toSegments(dirpath), create)
  }

  return {
    clearCache,
    promises: {
      async readFile(filepath: string, opts?: unknown): Promise<Uint8Array | string> {
        const target = await resolveTarget(filepath)
        if (!target) {
          throw createError('EISDIR', `illegal operation on a directory, read`)
        }
        let fileHandle = fileHandleCache.get(target.cleanPath)
        if (!fileHandle) {
          try {
            fileHandle = await target.parent.getFileHandle(target.name)
            fileHandleCache.set(target.cleanPath, fileHandle)
            kindCache.set(target.cleanPath, 'file')
          } catch {
            invalidatePath(target.cleanPath)
            throw createError('ENOENT', `no such file or directory, open '${filepath}'`)
          }
        }
        let file: File
        try {
          file = await fileHandle.getFile()
        } catch {
          fileHandleCache.delete(target.cleanPath)
          try {
            fileHandle = await target.parent.getFileHandle(target.name)
            fileHandleCache.set(target.cleanPath, fileHandle)
            file = await fileHandle.getFile()
          } catch {
            throw createError('ENOENT', `no such file or directory, open '${filepath}'`)
          }
        }
        const encoding = typeof opts === 'string' ? opts : (opts as { encoding?: string } | undefined)?.encoding
        if (encoding === 'utf8' || encoding === 'utf-8') {
          return await file.text()
        }
        const buf = await file.arrayBuffer()
        return new Uint8Array(buf)
      },

      async writeFile(filepath: string, data: Uint8Array | string): Promise<void> {
        const target = await resolveTarget(filepath, true)
        if (!target) {
          throw createError('EISDIR', `illegal operation on a directory, write`)
        }
        const fileHandle = await target.parent.getFileHandle(target.name, { create: true })
        fileHandleCache.set(target.cleanPath, fileHandle)
        kindCache.set(target.cleanPath, 'file')
        const writable = await fileHandle.createWritable()
        await writable.write(data as unknown as FileSystemWriteChunkType)
        await writable.close()
      },

      async mkdir(dirpath: string): Promise<void> {
        await resolveDir(dirpath, true)
      },

      async rmdir(dirpath: string): Promise<void> {
        const target = await resolveTarget(dirpath)
        if (!target) return
        invalidatePath(dirpath)
        await target.parent.removeEntry(target.name, { recursive: true })
      },

      async unlink(filepath: string): Promise<void> {
        const target = await resolveTarget(filepath)
        if (!target) return
        invalidatePath(filepath)
        await target.parent.removeEntry(target.name)
      },

      async readdir(dirpath: string): Promise<string[]> {
        const dir = await resolveDir(dirpath)
        const dirClean = toSegments(dirpath).join('/')
        const dirWithEntries = dir as unknown as {
          entries?: () => AsyncIterable<[string, FileSystemHandle]>
          keys?: () => AsyncIterable<string>
        }
        const entries: string[] = []
        if (typeof dirWithEntries.entries === 'function') {
          for await (const [name, handle] of dirWithEntries.entries()) {
            entries.push(name)
            const childPath = dirClean ? `${dirClean}/${name}` : name
            if (handle.kind === 'directory') {
              dirCache.set(childPath, handle as FileSystemDirectoryHandle)
              kindCache.set(childPath, 'directory')
            } else if (handle.kind === 'file') {
              fileHandleCache.set(childPath, handle as FileSystemFileHandle)
              kindCache.set(childPath, 'file')
            }
          }
          return entries
        }
        for await (const name of (dirWithEntries as { keys: () => AsyncIterable<string> }).keys()) {
          entries.push(name)
        }
        return entries
      },

      async stat(filepath: string): Promise<{
        isFile: () => boolean
        isDirectory: () => boolean
        isSymbolicLink: () => boolean
        size: number
        mtimeMs: number
        ctimeMs: number
        dev: number
        ino: number
        uid: number
        gid: number
        type: 'file' | 'dir'
        mode: number
      }> {
        const parts = toSegments(filepath)
        if (parts.length === 0) {
          return {
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
            size: 0,
            ctimeMs: 0,
            dev: 0,
            ino: 0,
            uid: 0,
            gid: 0,
            mtimeMs: Date.now(),
            type: 'dir',
            mode: 0o040755,
          }
        }
        const cleanPath = parts.join('/')
        const makeDirStat = () => ({
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false,
          size: 0,
          ctimeMs: 0,
          dev: 0,
          ino: 0,
          uid: 0,
          gid: 0,
          mtimeMs: Date.now(),
          type: 'dir' as const,
          mode: 0o040755,
        })
        const makeFileStat = (file: File) => ({
          isFile: () => true,
          isDirectory: () => false,
          isSymbolicLink: () => false,
          size: file.size,
          ctimeMs: 0,
          dev: 0,
          ino: 0,
          uid: 0,
          gid: 0,
          mtimeMs: file.lastModified,
          type: 'file' as const,
          mode: 0o100644,
        })

        // Fast path: cached directory handle from readdir()/resolveDir()
        if (kindCache.get(cleanPath) === 'directory' && dirCache.has(cleanPath)) {
          return makeDirStat()
        }

        // Fast path: cached file handle from readdir()/readFile()
        const cachedFileHandle = fileHandleCache.get(cleanPath)
        if (cachedFileHandle) {
          try {
            return makeFileStat(await cachedFileHandle.getFile())
          } catch {
            fileHandleCache.delete(cleanPath)
            kindCache.delete(cleanPath)
          }
        }

        const target = await resolveTarget(filepath)
        if (!target) {
          throw createError('ENOENT', `no such file or directory, stat '${filepath}'`)
        }
        // Try file first
        try {
          const fileHandle = await target.parent.getFileHandle(target.name)
          fileHandleCache.set(cleanPath, fileHandle)
          kindCache.set(cleanPath, 'file')
          const file = await fileHandle.getFile()
          return makeFileStat(file)
        } catch {
          // Try directory
          try {
            const subDir = await target.parent.getDirectoryHandle(target.name)
            dirCache.set(cleanPath, subDir)
            kindCache.set(cleanPath, 'directory')
            return makeDirStat()
          } catch {
            invalidatePath(cleanPath)
            throw createError('ENOENT', `no such file or directory, stat '${filepath}'`)
          }
        }
      },

      async lstat(filepath: string) {
        return this.stat(filepath)
      },

      async readlink(): Promise<string> {
        throw createError('ENOSYS', `readlink not supported`)
      },

      async symlink(): Promise<void> {
        throw createError('ENOSYS', `symlink not supported`)
      },
    },
  }
}
