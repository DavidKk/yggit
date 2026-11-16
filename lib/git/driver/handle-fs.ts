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
  function toSegments(filepath: string): string[] {
    return filepath
      .replace(/\\/g, '/')
      .split('/')
      .filter((s) => s.length > 0 && s !== '.')
  }

  async function resolveTarget(filepath: string, createDirs = false): Promise<{ parent: FileSystemDirectoryHandle; name: string } | null> {
    const parts = toSegments(filepath)
    if (parts.length === 0) return null
    let current = rootHandle
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i], { create: createDirs })
      } catch {
        throw createError('ENOENT', `no such file or directory, open '${filepath}'`)
      }
    }
    return { parent: current, name: parts[parts.length - 1] }
  }

  async function resolveDir(dirpath: string, create = false): Promise<FileSystemDirectoryHandle> {
    const parts = toSegments(dirpath)
    let current = rootHandle
    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part, { create })
      } catch {
        throw createError('ENOENT', `no such file or directory, opendir '${dirpath}'`)
      }
    }
    return current
  }

  return {
    promises: {
      async readFile(filepath: string, opts?: unknown): Promise<Uint8Array | string> {
        const target = await resolveTarget(filepath)
        if (!target) {
          throw createError('EISDIR', `illegal operation on a directory, read`)
        }
        let fileHandle: FileSystemFileHandle
        try {
          fileHandle = await target.parent.getFileHandle(target.name)
        } catch {
          throw createError('ENOENT', `no such file or directory, open '${filepath}'`)
        }
        const file = await fileHandle.getFile()
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
        await target.parent.removeEntry(target.name, { recursive: true })
      },

      async unlink(filepath: string): Promise<void> {
        const target = await resolveTarget(filepath)
        if (!target) return
        await target.parent.removeEntry(target.name)
      },

      async readdir(dirpath: string): Promise<string[]> {
        const dir = await resolveDir(dirpath)
        const entries: string[] = []
        for await (const name of (dir as unknown as { keys: () => AsyncIterable<string> }).keys()) {
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
        const target = await resolveTarget(filepath)
        if (!target) {
          throw createError('ENOENT', `no such file or directory, stat '${filepath}'`)
        }
        // Try file first
        try {
          const fileHandle = await target.parent.getFileHandle(target.name)
          const file = await fileHandle.getFile()
          return {
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
            type: 'file',
            mode: 0o100644,
          }
        } catch {
          // Try directory
          try {
            await target.parent.getDirectoryHandle(target.name)
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
          } catch {
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
