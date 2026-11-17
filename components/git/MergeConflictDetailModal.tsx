'use client'

import React, { useEffect, useState } from 'react'
import { LuCheck, LuCopy, LuFileCode, LuTriangleAlert, LuX } from 'react-icons/lu'

import { Button } from '@/components/sk'
import { fetchRemergeDiff, type MergeConflictRecord } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'

interface Props {
  repo?: string
  commit: GitCommit
  conflict?: MergeConflictRecord
  onClose: () => void
}

export function MergeConflictDetailModal({ repo = '', commit, conflict, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [diff, setDiff] = useState('')
  const [files, setFiles] = useState<string[]>(conflict?.conflictFiles || [])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchRemergeDiff(repo, commit.hash)
      .then((res) => {
        if (!cancelled) {
          setDiff(res.diff)
          if (res.files && res.files.length > 0) {
            setFiles(res.files)
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiff('暂无详细解决差异记录')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [repo, commit.hash])

  const handleCopy = () => {
    if (!diff) return
    void navigator.clipboard.writeText(diff)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[min(680px,90vh)] w-[min(820px,95vw)] flex-col rounded-xl border border-line bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel-2/70 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 items-center justify-center rounded-md bg-warn/15 text-warn shrink-0">
              <LuTriangleAlert className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-ink truncate">历史合并冲突解决详情</h2>
                <span className="font-mono text-[11px] text-ink-soft shrink-0">{commit.hash.slice(0, 8)}</span>
              </div>
              <p className="text-[11px] text-ink-soft truncate mt-0.5">{commit.subject}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink cursor-pointer"
            title="关闭"
          >
            <LuX className="size-4" />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 gap-3 bg-paper">
          {/* Conflicted Files list */}
          <div className="shrink-0 rounded-lg border border-line bg-panel p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <LuFileCode className="size-3.5 text-accent" />
                曾经发生冲突的文件 ({files.length} 个)
              </span>
              <span className="text-[10px] text-ink-soft">以下文件在合并时需要手动解决冲突：</span>
            </div>
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {files.map((file) => (
                  <span key={file} className="inline-flex items-center gap-1 rounded bg-[var(--overlay-10)] px-2 py-0.5 font-mono text-[11px] text-ink">
                    <span className="size-1.5 rounded-full bg-warn shrink-0" />
                    {file}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-soft">未检测到具体冲突文件清单</p>
            )}
          </div>

          {/* Remerge Diff Viewer */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-panel overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-panel-2/50 px-3 py-1.5">
              <span className="text-xs font-semibold text-ink">冲突最终解决差异 (Remerge Diff)</span>
              <Button size="mini" variant="ghost" onClick={handleCopy} disabled={!diff || loading}>
                {copied ? <LuCheck className="size-3.5 text-ok" /> : <LuCopy className="size-3.5" />}
                {copied ? '已复制' : '复制 Diff'}
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 bg-paper-2 font-mono text-xs leading-relaxed select-text">
              {loading ? (
                <div className="flex h-full items-center justify-center text-ink-soft text-xs">正在分析并读取冲突解决记录...</div>
              ) : diff ? (
                <pre className="whitespace-pre font-mono text-[11px] text-ink/90">{diff}</pre>
              ) : (
                <div className="flex h-full items-center justify-center text-ink-soft text-xs">未找到该提交的重合并差异记录</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 items-center justify-between border-t border-line bg-panel-2/70 px-4 py-2.5">
          <span className="text-[11px] text-ink-soft">提示：该记录由 Git 内存 3-way 重建计算，已自动持久化缓存至本地。</span>
          <Button size="mini" variant="accent" onClick={onClose}>
            完成
          </Button>
        </footer>
      </div>
    </div>
  )
}
