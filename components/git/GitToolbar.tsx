'use client'

import { useRef, useState } from 'react'
import { LuArchive, LuArchiveRestore, LuArrowDownToLine, LuArrowUpFromLine, LuChevronDown, LuGitBranchPlus, LuRedo2, LuRefreshCw, LuUndo2 } from 'react-icons/lu'

import { CreateBranchModal } from '@/components/git/GitBranchModal'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Button, Spinner, Tooltip } from '@/components/sk'
import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import { cn } from '@/lib/utils'

export type PullOperation = 'pull-ff' | 'fetch-all' | 'pull-ff-only' | 'pull-rebase'

interface GitToolbarProps {
  repo: string
  currentBranch?: string
  hasStashes?: boolean
  disabled?: boolean
  onRefresh: () => Promise<void> | void
}

export function GitToolbar({ repo, currentBranch, hasStashes = false, disabled = false, onRefresh }: GitToolbarProps) {
  const t = useT()
  const notify = useNotification()
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [stashing, setStashing] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [redoing, setRedoing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [pullMenuOpen, setPullMenuOpen] = useState(false)
  const pullMenuAnchorRef = useRef<HTMLDivElement>(null)

  const [defaultPullOp, setDefaultPullOp] = useState<PullOperation>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yggit.toolbar.pull-op')
      if (saved === 'pull-ff' || saved === 'fetch-all' || saved === 'pull-ff-only' || saved === 'pull-rebase') {
        return saved
      }
    }
    return 'pull-ff'
  })

  const pullOptions: Array<{ key: PullOperation; label: string; desc: string }> = [
    { key: 'fetch-all', label: t('git.operations.pullFetchAll') || 'Fetch All', desc: t('git.operations.pullFetchAllDesc') || '抓取所有远程分支及元数据' },
    {
      key: 'pull-ff',
      label: t('git.operations.pullFastForwardIfPossible') || 'Pull (fast-forward if possible)',
      desc: t('git.operations.pullDefaultModeDesc') || '尽可能快进拉取合并 (默认)',
    },
    { key: 'pull-ff-only', label: t('git.operations.pullFastForwardOnly') || 'Pull (fast-forward only)', desc: t('git.operations.pullFastForwardDesc') || '仅在能直接快进时拉取' },
    { key: 'pull-rebase', label: t('git.operations.pullRebase') || 'Pull (rebase)', desc: t('git.operations.pullRebaseDesc') || '拉取并变基当前本地提交' },
  ]

  const handleExecutePull = async (op: PullOperation = defaultPullOp) => {
    if (pulling || disabled || !repo) return
    setPulling(true)
    try {
      const driver = getGitDriver()
      if (op === 'fetch-all') {
        const res = await driver.fetch(repo, { all: true })
        notify.success(res.message || t('git.operations.fetchSuccess') || '抓取完成 (Fetch All)')
      } else if (op === 'pull-ff-only') {
        const res = await driver.pull(repo, { ffOnly: true })
        notify.success(res.message || t('git.operations.pullSuccess') || '拉取成功 (Fast-forward only)')
      } else if (op === 'pull-rebase') {
        const res = await driver.pull(repo, { rebase: true })
        notify.success(res.message || t('git.operations.pullSuccess') || '拉取成功 (Rebase)')
      } else {
        const res = await driver.pull(repo)
        notify.success(res.message || t('git.operations.pullSuccess') || '拉取成功 (Pull)')
      }
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.errors.readGit') || '拉取失败')
    } finally {
      setPulling(false)
    }
  }

  const handlePush = async () => {
    if (pushing || disabled || !repo) return
    setPushing(true)
    try {
      const driver = getGitDriver()
      const res = await driver.push(repo, { setUpstream: true })
      notify.success(res.message || t('git.operations.pushSuccess') || '推送成功')
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.operations.pushSuccess') ? 'Push failed' : '推送失败')
    } finally {
      setPushing(false)
    }
  }

  const handleCreateBranch = async (name: string, startPoint?: string, checkout = true) => {
    try {
      const driver = getGitDriver()
      const res = await driver.createBranch(repo, name, startPoint, checkout)
      notify.success(res.message || (t('git.operations.createBranchSuccess') || '已创建分支 {branch}').replace('{branch}', name))
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.operations.createBranchTitle') ? 'Create branch failed' : '创建分支失败')
    }
  }

  const handleStashSave = async () => {
    if (stashing || disabled || !repo) return
    setStashing(true)
    try {
      const driver = getGitDriver()
      const res = await driver.stash(repo, { action: 'save' })
      notify.success(res.message || t('git.operations.stashSuccess') || '已暂存工作区更改 (Stash)')
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.operations.stashSuccess') ? 'Stash failed' : '暂存失败')
    } finally {
      setStashing(false)
    }
  }

  const handleStashPop = async () => {
    if (stashing || disabled || !repo) return
    setStashing(true)
    try {
      const driver = getGitDriver()
      const res = await driver.stash(repo, { action: 'pop' })
      notify.success(res.message || t('git.operations.popTooltipAction') || '已恢复最近暂存 (Pop Stash)')
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.operations.popTooltipAction') ? 'Pop stash failed' : '恢复暂存失败')
    } finally {
      setStashing(false)
    }
  }

  const handleUndo = async () => {
    if (undoing || disabled || !repo) return
    setUndoing(true)
    try {
      const driver = getGitDriver()
      const res = await driver.undo(repo)
      notify.success(res.message || t('git.operations.undoSuccess') || '已撤销上一次提交')
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.operations.undoError') || '撤销失败')
    } finally {
      setUndoing(false)
    }
  }

  const handleRedo = async () => {
    if (redoing || disabled || !repo) return
    setRedoing(true)
    try {
      const driver = getGitDriver()
      const res = await driver.redo(repo)
      notify.success(res.message || t('git.operations.redoSuccess') || '已恢复提交')
      await onRefresh()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('git.operations.redoError') || '重做失败')
    } finally {
      setRedoing(false)
    }
  }

  const handleManualRefresh = async () => {
    if (refreshing || disabled || !repo) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const isEdge = getDriverMode() === 'edge'
  const anyBusy = pulling || pushing || stashing || undoing || redoing || refreshing || disabled

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 text-xs">
      {/* Undo & Redo (Only in local mode) */}
      {!isEdge ? (
        <>
          <Tooltip content={t('git.operations.undoLastCommit') || '撤销上一次提交 (Undo)'}>
            <Button
              variant="plain"
              size="xs"
              disabled={anyBusy}
              loading={undoing}
              onClick={() => void handleUndo()}
              className="h-7 gap-1 px-1.5 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink disabled:opacity-40"
            >
              <LuUndo2 className="size-3.5" />
              <span className="hidden md:inline">{t('git.operations.undo') || 'Undo'}</span>
            </Button>
          </Tooltip>

          <Tooltip content={t('git.operations.redoLastCommit') || '恢复撤销的提交 (Redo)'}>
            <Button
              variant="plain"
              size="xs"
              disabled={anyBusy}
              loading={redoing}
              onClick={() => void handleRedo()}
              className="h-7 gap-1 px-1.5 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink disabled:opacity-40"
            >
              <LuRedo2 className="size-3.5" />
              <span className="hidden md:inline">{t('git.operations.redo') || 'Redo'}</span>
            </Button>
          </Tooltip>

          <span className="mx-0.5 h-3.5 w-px bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden />
        </>
      ) : null}

      {/* Pull Split Button */}
      <div ref={pullMenuAnchorRef} className="relative inline-flex items-center rounded bg-transparent">
        <Tooltip
          content={
            pulling
              ? t('git.toolbar.pulling') || '正在拉取…'
              : (t('git.operations.pullTooltipAction') || '执行 {mode}').replace('{mode}', pullOptions.find((o) => o.key === defaultPullOp)?.label || 'Pull')
          }
        >
          <button
            type="button"
            disabled={anyBusy}
            onClick={() => void handleExecutePull()}
            className="flex h-7 items-center gap-1 rounded-l px-2 text-xs font-normal text-ink-soft transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:text-ink disabled:opacity-50"
          >
            {pulling ? <Spinner className="size-3.5 text-accent" /> : <LuArrowDownToLine className="size-3.5" />}
            <span className="hidden sm:inline">{t('git.operations.pull') || 'Pull'}</span>
          </button>
        </Tooltip>
        <button
          type="button"
          disabled={anyBusy}
          aria-label={t('git.operations.pullSelectMode') || '选择默认拉取模式'}
          onClick={() => setPullMenuOpen((v) => !v)}
          className={cn(
            'flex h-7 items-center px-1 rounded-r text-ink-soft transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:text-ink disabled:opacity-50',
            pullMenuOpen && 'bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] text-ink'
          )}
        >
          <LuChevronDown className="size-3" />
        </button>

        {pullMenuOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-line bg-panel p-2 shadow-xl animate-in fade-in-50 zoom-in-95"
            tabIndex={-1}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setPullMenuOpen(false)
              }
            }}
          >
            <div className="border-b border-line pb-2 mb-2 px-1">
              <p className="text-[11px] font-semibold text-ink leading-tight">{t('git.operations.pullHeaderDesc') || '选择点击 Pull 按钮时执行的默认同步方式'}</p>
              <p className="text-[10px] text-ink-soft mt-0.5">{t('git.operations.pullDefaultModeDesc') || '选择点击 Pull 按钮时执行的默认同步方式'}</p>
            </div>
            <div className="flex flex-col gap-1">
              {pullOptions.map((opt) => {
                const selected = defaultPullOp === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setDefaultPullOp(opt.key)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('yggit.toolbar.pull-op', opt.key)
                      }
                      setPullMenuOpen(false)
                    }}
                    className={cn(
                      'flex items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      selected
                        ? 'bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] text-ink font-medium'
                        : 'hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] text-ink-soft hover:text-ink'
                    )}
                  >
                    <span className="pt-0.5">
                      <span
                        className={cn('flex size-3.5 items-center justify-center rounded-full border', selected ? 'border-accent bg-accent text-white' : 'border-line bg-canvas')}
                      >
                        {selected && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs">{opt.label}</span>
                      <span className="text-[10px] text-ink-soft/80">{opt.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Push Button */}
      <Tooltip content={pushing ? t('git.toolbar.pushing') || '正在推送…' : t('git.operations.pushTooltipAction') || '推送当前分支到远程 (Push)'}>
        <Button
          variant="plain"
          size="xs"
          className="h-7 gap-1 px-2 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink"
          disabled={anyBusy}
          onClick={() => void handlePush()}
        >
          {pushing ? <Spinner className="size-3.5 text-accent" /> : <LuArrowUpFromLine className="size-3.5" />}
          <span className="hidden sm:inline">{t('git.operations.push') || 'Push'}</span>
        </Button>
      </Tooltip>

      {/* Branch Button */}
      <Tooltip content={t('git.operations.branchTooltipAction') || '以当前状态创建新分支 (Branch)'}>
        <Button
          variant="plain"
          size="xs"
          className="h-7 gap-1 px-2 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink"
          disabled={anyBusy}
          onClick={() => setBranchModalOpen(true)}
        >
          <LuGitBranchPlus className="size-3.5 text-accent" />
          <span className="hidden sm:inline">{t('git.operations.branch') || 'Branch'}</span>
        </Button>
      </Tooltip>

      {/* Stash Button */}
      <Tooltip content={stashing ? t('git.operations.stashing') || '正在暂存…' : t('git.operations.stashTooltipAction') || '暂存所有工作区更改 (Stash)'}>
        <Button
          variant="plain"
          size="xs"
          className="h-7 gap-1 px-2 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink"
          disabled={anyBusy}
          onClick={() => void handleStashSave()}
        >
          {stashing ? <Spinner className="size-3.5 text-accent" /> : <LuArchive className="size-3.5 text-ink-soft" />}
          <span className="hidden sm:inline">{t('git.operations.stash') || 'Stash'}</span>
        </Button>
      </Tooltip>

      {/* Pop Stash Button */}
      <Tooltip
        content={
          stashing
            ? t('git.operations.stashing') || '正在暂存…'
            : hasStashes
              ? t('git.operations.popTooltipAction') || '弹出最近暂存 (Pop Stash)'
              : t('git.operations.noStashTooltipAction') || '弹出最近暂存 (当前暂无暂存)'
        }
      >
        <Button
          variant="plain"
          size="xs"
          className="h-7 gap-1 px-2 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink disabled:opacity-40"
          disabled={anyBusy}
          onClick={() => void handleStashPop()}
        >
          <LuArchiveRestore className="size-3.5 text-ink-soft" />
          <span className="hidden sm:inline">{t('git.operations.pop') || 'Pop'}</span>
        </Button>
      </Tooltip>

      {/* Refresh Button */}
      <Tooltip content={refreshing ? t('git.operations.refreshing') || '正在刷新…' : t('git.operations.refreshTooltipAction') || '刷新 Git 状态 (Refresh)'}>
        <Button
          variant="plain"
          size="xs"
          className="h-7 gap-1 px-2 text-xs font-normal text-ink-soft hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink"
          disabled={anyBusy}
          onClick={() => void handleManualRefresh()}
        >
          <LuRefreshCw className={cn('size-3.5 text-ink-soft', refreshing && 'animate-spin text-accent')} />
          <span className="hidden sm:inline">{t('git.operations.refresh') || 'Refresh'}</span>
        </Button>
      </Tooltip>

      <CreateBranchModal open={branchModalOpen} currentBranch={currentBranch} onClose={() => setBranchModalOpen(false)} onSubmit={handleCreateBranch} />
    </div>
  )
}
