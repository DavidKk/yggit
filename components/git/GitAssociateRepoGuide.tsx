'use client'

import { useState } from 'react'
import { LuCopy, LuExternalLink, LuFolder, LuFolderPlus, LuGitBranch, LuHash, LuSearch } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'

interface Props {
  identity: {
    key: string
    remoteUrl?: string
    name: string
    commitHash?: string
  }
}

export function GitAssociateRepoGuide({ identity }: Props) {
  const t = useT()
  const [localPath, setLocalPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handlePickFolder = async () => {
    setPicking(true)
    setError('')
    try {
      const res = await fetch('/api/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'folder', prompt: '选择关联的本地 Git 仓库文件夹' }),
      })
      const body = (await res.json()) as { ok?: boolean; path?: string; paths?: string[]; cancelled?: boolean }
      if (body.cancelled) return
      const chosen = body.path || (body.paths && body.paths[0])
      if (chosen) {
        setLocalPath(chosen)
      }
    } catch {
      setError('无法打开文件夹选择对话框')
    } finally {
      setPicking(false)
    }
  }

  const handleAssociate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const path = localPath.trim()
    if (!path) {
      setError('请输入本地仓库文件夹路径')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, discover: false }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.message || body.error || '关联失败，请确认该目录是否为有效的 Git 仓库')
      }
      // Successfully registered project in catalog. Reload to let resolver match the local repository.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '关联失败')
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg-canvas p-6 text-ink">
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-line bg-bg p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] text-accent">
            <LuFolderPlus className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">关联共享仓库</h2>
            <p className="text-xs text-ink-soft">同事或团队向你分享了仓库资源，请在本地指定对应克隆目录以快速进入</p>
          </div>
        </div>

        <div className="my-5 rounded-lg border border-line/70 bg-bg-panel/50 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">远程标识：</span>
            <div className="flex items-center gap-1.5 font-mono font-medium">
              <span>{identity.key}</span>
              <button
                type="button"
                className="opacity-70 hover:opacity-100"
                onClick={() => {
                  void copyToClipboard(identity.remoteUrl || identity.key)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                <LuCopy className="size-3.5" />
              </button>
            </div>
          </div>
          {identity.commitHash ? (
            <div className="flex items-center justify-between border-t border-line/40 pt-2">
              <span className="text-ink-soft flex items-center gap-1">
                <LuHash className="size-3.5" /> 目标提交：
              </span>
              <span className="font-mono text-accent">{identity.commitHash.slice(0, 10)}</span>
            </div>
          ) : null}
          {identity.remoteUrl ? (
            <div className="flex items-center justify-between border-t border-line/40 pt-2 text-[11px]">
              <span className="text-ink-soft">克隆命令参考：</span>
              <span className="font-mono text-ink-soft/80 select-all truncate max-w-[280px]">
                git clone {identity.remoteUrl}
              </span>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleAssociate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">
              指定你本机上该项目的文件夹路径：
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="/Users/.../your-project"
                className="h-9 flex-1 rounded-md border border-line bg-bg px-3 text-xs font-mono outline-none focus:border-accent"
              />
              <Button
                type="button"
                variant="default"
                size="md"
                className="h-9 shrink-0 gap-1.5"
                loading={picking}
                onClick={handlePickFolder}
              >
                <LuFolder className="size-3.5" />
                浏览目录
              </Button>
            </div>
          </div>

          {error ? <div className="text-xs text-fail bg-fail/10 p-2.5 rounded-md border border-fail/20">{error}</div> : null}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="plain"
              size="md"
              onClick={() => {
                window.location.href = '/'
              }}
            >
              返回首页
            </Button>
            <Button type="submit" variant="accent" size="md" loading={loading} className="gap-1.5">
              <LuFolderPlus className="size-4" />
              关联并打开
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
