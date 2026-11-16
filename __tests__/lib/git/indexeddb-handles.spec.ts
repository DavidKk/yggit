import {
  createEdgeFolder,
  deleteEdgeFolder,
  getDirectoryHandle,
  getEdgeCatalog,
  getEdgeFolders,
  isFileSystemAccessSupported,
  listDirectoryHandles,
  moveEdgeProject,
  openHandlesDatabase,
  removeDirectoryHandle,
  requestHandlePermission,
  resolveRepoAlias,
  saveDirectoryHandle,
  saveEdgeRemoteProject,
  saveRepoAlias,
  verifyHandlePermission,
} from '@/lib/git/indexeddb-handles'

describe('indexeddb-handles', () => {
  describe('environment detection', () => {
    it('detects lack of file system access API when showDirectoryPicker is missing', () => {
      expect(isFileSystemAccessSupported()).toBe(false)
    })

    it('handles non-browser or missing indexedDB gracefully', async () => {
      const db = await openHandlesDatabase()
      expect(db).toBeNull()
      const handle = await getDirectoryHandle('any-repo')
      expect(handle).toBeNull()
      const list = await listDirectoryHandles()
      expect(list).toEqual([])
    })
  })

  describe('permission checks with mock handle', () => {
    it('returns true when queryPermission returns granted', async () => {
      const mockHandle = {
        name: 'test-repo',
        kind: 'directory',
        queryPermission: jest.fn().mockResolvedValue('granted'),
      } as unknown as FileSystemDirectoryHandle

      const granted = await verifyHandlePermission(mockHandle)
      expect(granted).toBe(true)
      expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'read' })
    })

    it('returns false when queryPermission returns prompt or denied', async () => {
      const mockHandle = {
        name: 'test-repo',
        kind: 'directory',
        queryPermission: jest.fn().mockResolvedValue('prompt'),
      } as unknown as FileSystemDirectoryHandle

      const granted = await verifyHandlePermission(mockHandle)
      expect(granted).toBe(false)
    })

    it('requests permission and returns true when granted', async () => {
      const mockHandle = {
        name: 'test-repo',
        kind: 'directory',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      } as unknown as FileSystemDirectoryHandle

      const result = await requestHandlePermission(mockHandle, 'readwrite')
      expect(result).toBe(true)
      expect(mockHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' })
    })
  })

  describe('with mock IndexedDB implementation', () => {
    let mockStoreData: Record<string, Record<string, unknown>>
    let originalIndexedDB: unknown

    beforeEach(() => {
      mockStoreData = {
        directory_handles: {},
        repo_aliases: {},
        edge_folders: {},
        edge_remote_projects: {},
        edge_meta: {},
      }

      const mockDb = {
        objectStoreNames: {
          contains: (name: string) => name in mockStoreData,
        },
        createObjectStore: jest.fn(),
        transaction: (storeName: string, _mode: string) => ({
          objectStore: () => ({
            put: (item: { id?: string; alias?: string; name?: string; key?: string }) => {
              const key = item.id || item.alias || item.name || item.key || ''
              mockStoreData[storeName][key] = item
              const req: { onsuccess?: () => void; onerror?: () => void; error?: Error } = {}
              setTimeout(() => req.onsuccess?.(), 0)
              return req
            },
            get: (key: string) => {
              const result = mockStoreData[storeName][key]
              const req: { onsuccess?: () => void; onerror?: () => void; result?: unknown } = {}
              setTimeout(() => {
                req.result = result
                req.onsuccess?.()
              }, 0)
              return req
            },
            getAll: () => {
              const result = Object.values(mockStoreData[storeName])
              const req: { onsuccess?: () => void; onerror?: () => void; result?: unknown } = {}
              setTimeout(() => {
                req.result = result
                req.onsuccess?.()
              }, 0)
              return req
            },
            delete: (key: string) => {
              delete mockStoreData[storeName][key]
              const req: { onsuccess?: () => void; onerror?: () => void } = {}
              setTimeout(() => req.onsuccess?.(), 0)
              return req
            },
          }),
        }),
      }

      const fakeIndexedDB = {
        open: () => {
          const req: { onsuccess?: () => void; onerror?: () => void; result?: unknown } = {
            result: mockDb,
          }
          setTimeout(() => req.onsuccess?.(), 0)
          return req
        },
      }
      originalIndexedDB = (global as unknown as { indexedDB?: unknown }).indexedDB
      ;(global as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDB
      if (typeof window !== 'undefined') {
        ;(window as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDB
      }
    })

    afterEach(() => {
      ;(global as unknown as { indexedDB: unknown }).indexedDB = originalIndexedDB
      if (typeof window !== 'undefined') {
        ;(window as unknown as { indexedDB: unknown }).indexedDB = originalIndexedDB
      }
    })

    it('saves and retrieves directory handle', async () => {
      const mockHandle = { name: 'my-project' } as FileSystemDirectoryHandle
      await saveDirectoryHandle('repo-1', mockHandle, 'My Project')

      const retrieved = await getDirectoryHandle('repo-1')
      expect(retrieved).toBe(mockHandle)

      const list = await listDirectoryHandles()
      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({ id: 'repo-1', name: 'My Project' })
    })

    it('resolves alias correctly when retrieving handle', async () => {
      const mockHandle = { name: 'gitlab-project' } as FileSystemDirectoryHandle
      await saveDirectoryHandle('canonical-id', mockHandle, 'GitLab Project')
      await saveRepoAlias('gitlab.corp/team/repo', 'canonical-id')

      const resolvedCanonical = await resolveRepoAlias('gitlab.corp/team/repo')
      expect(resolvedCanonical).toBe('canonical-id')

      const handle = await getDirectoryHandle('gitlab.corp/team/repo')
      expect(handle).toBe(mockHandle)
    })

    it('removes directory handle', async () => {
      const mockHandle = { name: 'to-delete' } as FileSystemDirectoryHandle
      await saveDirectoryHandle('del-repo', mockHandle)
      expect(await getDirectoryHandle('del-repo')).toBe(mockHandle)

      await removeDirectoryHandle('del-repo')
      expect(await getDirectoryHandle('del-repo')).toBeNull()
    })

    describe('edge folders & catalog management', () => {
      it('reads local origin metadata and absorbs the matching remote while preserving separate clones', async () => {
        function localHandle(name: string): FileSystemDirectoryHandle {
          return {
            name,
            queryPermission: jest.fn().mockResolvedValue('granted'),
            async getDirectoryHandle() {
              return {
                async getFileHandle() {
                  return {
                    async getFile() {
                      return {
                        async text() {
                          return '[remote "origin"]\nurl = git@github.com:DavidKk/yggit.git\n'
                        },
                      }
                    },
                  }
                },
              }
            },
          } as unknown as FileSystemDirectoryHandle
        }
        await saveDirectoryHandle('one', localHandle('yggdrasil'))
        await saveEdgeRemoteProject({ id: 'remote', name: 'DavidKk/yggit', url: 'https://github.com/davidkk/YGGIT', host: 'github', updatedAt: Date.now() })
        let catalog = await getEdgeCatalog()
        expect(catalog.projects).toHaveLength(1)
        expect(catalog.projects[0]).toMatchObject({ localPath: 'one', host: 'github', httpsUrl: 'https://github.com/DavidKk/yggit.git', remote: true })
        await saveDirectoryHandle('two', localHandle('yggdrasil'))
        catalog = await getEdgeCatalog()
        expect(catalog.projects.map((project) => project.localPath)).toEqual(['one', 'two'])
      })

      it('keeps temporary visits out of saved folders and does not infer GitHub authorization', async () => {
        const sessionStorage = {
          getItem: () => JSON.stringify([{ id: 'temp', fingerprint: 'github.com/owner/temp', name: 'owner/temp', remoteUrl: 'https://github.com/owner/temp' }]),
        }
        const previousWindow = global.window
        Object.defineProperty(global, 'window', { value: { sessionStorage, indexedDB: global.indexedDB }, writable: true, configurable: true })
        await saveEdgeRemoteProject({ id: 'saved', name: 'owner/saved', url: 'https://github.com/owner/saved', host: 'github', updatedAt: Date.now() })
        const catalog = await getEdgeCatalog()
        expect(catalog.projects.map((project) => project.id)).toEqual(['saved'])
        expect(catalog.projects[0].authorized).toBe(false)
        Object.defineProperty(global, 'window', { value: previousWindow, writable: true, configurable: true })
      })

      it('shows one entry for duplicate handles to the same directory without deleting stored sources', async () => {
        const handle = { name: 'ticket-janitor', isSameEntry: async () => true } as unknown as FileSystemDirectoryHandle
        await saveDirectoryHandle('original', handle)
        await saveDirectoryHandle('alias', { ...handle })
        expect((await getEdgeCatalog()).projects).toHaveLength(1)
        expect(await listDirectoryHandles()).toHaveLength(2)
      })

      it('preserves same-name local clones using their stored identifiers', async () => {
        await saveDirectoryHandle('clone-one', { name: 'ticket-janitor' } as FileSystemDirectoryHandle)
        await saveDirectoryHandle('clone-two', { name: 'ticket-janitor' } as FileSystemDirectoryHandle)
        const catalog = await getEdgeCatalog()
        expect(catalog.projects.map((project) => project.localPath).sort()).toEqual(['clone-one', 'clone-two'])
      })

      it('seeds default folders when first initialized', async () => {
        const folders = await getEdgeFolders()
        expect(folders).toEqual(['工作项目', '个人项目'])
      })

      it('creates new edge folder', async () => {
        await createEdgeFolder('测试文件夹')
        const folders = await getEdgeFolders()
        expect(folders).toContain('测试文件夹')
      })

      it('prevents creating duplicate edge folder', async () => {
        await createEdgeFolder('公共组件')
        await expect(createEdgeFolder('公共组件')).rejects.toThrow('文件夹已存在')
      })

      it('deletes edge folder and cascade-removes associated handles and remotes', async () => {
        await createEdgeFolder('待删除分组')
        const mockHandle = { name: 'handle-in-group' } as FileSystemDirectoryHandle
        await saveDirectoryHandle('handle-1', mockHandle, 'handle-in-group', '待删除分组')

        await saveEdgeRemoteProject({
          id: 'remote-1',
          name: 'remote-in-group',
          url: 'https://github.com/foo/bar',
          host: 'github',
          group: '待删除分组',
          updatedAt: Date.now(),
        })

        const beforeCatalog = await getEdgeCatalog()
        expect(beforeCatalog.folders).toContain('待删除分组')
        expect(beforeCatalog.projects.some((p) => p.name === 'handle-in-group')).toBe(true)
        expect(beforeCatalog.projects.some((p) => p.name === 'remote-in-group')).toBe(true)

        const deleteResult = await deleteEdgeFolder('待删除分组')
        expect(deleteResult.removedCount).toBe(2)
        expect(deleteResult.folders).not.toContain('待删除分组')

        const afterCatalog = await getEdgeCatalog()
        expect(afterCatalog.folders).not.toContain('待删除分组')
        expect(afterCatalog.projects.some((p) => p.name === 'handle-in-group')).toBe(false)
        expect(afterCatalog.projects.some((p) => p.name === 'remote-in-group')).toBe(false)
      })

      it('moves project between folders in Edge mode', async () => {
        await createEdgeFolder('分组A')
        await createEdgeFolder('分组B')
        const mockHandle = { name: 'moveable-project' } as FileSystemDirectoryHandle
        await saveDirectoryHandle('move-1', mockHandle, 'moveable-project', '分组A')

        await moveEdgeProject('move-1', '分组B')
        const catalog = await getEdgeCatalog()
        const project = catalog.projects.find((p) => p.id === 'move-1')
        expect(project?.group).toBe('分组B')
      })

      it('automatically creates and assigns to "未分类" when adding a project with no folders existing', async () => {
        // Delete all folders
        const folders = await getEdgeFolders()
        for (const f of folders) {
          await deleteEdgeFolder(f)
        }
        const emptyFolders = await getEdgeFolders()
        expect(emptyFolders).toEqual([])

        // Save a new directory handle without specifying folder
        const mockHandle = { name: 'ticket-janitor' } as FileSystemDirectoryHandle
        await saveDirectoryHandle('handle-uncategorized', mockHandle, 'ticket-janitor')

        const catalog = await getEdgeCatalog()
        expect(catalog.folders).toContain('未分类')
        const proj = catalog.projects.find((p) => p.name === 'ticket-janitor')
        expect(proj?.group).toBe('未分类')

        // getDirectoryHandle can find it by l_{projectId}
        const found = await getDirectoryHandle('l_5b8a0f89229d44ed')
        expect(found).toBe(mockHandle)
      })

      it('automatically creates and assigns to "未分类" when adding a remote project with no folders existing', async () => {
        // Delete all folders
        const folders = await getEdgeFolders()
        for (const f of folders) {
          await deleteEdgeFolder(f)
        }

        await saveEdgeRemoteProject({
          id: 'remote-uncategorized',
          name: 'backend-api',
          url: 'https://gitlab.com/corp/backend-api.git',
          host: 'gitlab',
          updatedAt: Date.now(),
        })

        const catalog = await getEdgeCatalog()
        expect(catalog.folders).toContain('未分类')
        const proj = catalog.projects.find((p) => p.name === 'backend-api')
        expect(proj?.group).toBe('未分类')
      })
    })
  })
})
