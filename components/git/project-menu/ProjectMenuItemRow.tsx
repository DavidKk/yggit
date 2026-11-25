'use client'

import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from 'react'
import { LuCloud, LuCloudOff, LuGithub, LuGitlab, LuGlobe, LuHardDrive, LuLockKeyhole, LuPencil, LuTrash2 } from 'react-icons/lu'
import { TbCloudLock } from 'react-icons/tb'

import type { RemotesMenuAnchor } from '@/components/git/project-menu/ProjectMenuDialogs'
import type { useT } from '@/components/i18n/LocaleProvider'
import { Button, Tooltip } from '@/components/sk'
import { extractProjectRemotes, getRemoteCloudType, projectOpenTarget, remoteIdentity } from '@/lib/git/project-access'
import type { GitProjectHost, GitProjectView } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export function HostIcon({ host }: { host: GitProjectHost | 'generic' }) {
  if (host === 'github') return <LuGithub className="size-3.5 shrink-0 text-ink" aria-hidden />
  if (host === 'gitlab') return <LuGitlab className="size-3.5 shrink-0 text-ink" aria-hidden />
  if (host === 'generic') return <LuGlobe className="size-3.5 shrink-0 text-accent" aria-hidden />
  return <LuHardDrive className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
}

export function ProjectMenuItemRow({
  project,
  group,
  isLast,
  currentPath,
  isEdge,
  busy,
  draggingId,
  dropTarget,
  editingLabelProjectId,
  setEditingLabelProjectId,
  projectLabelDraft,
  setProjectLabelDraft,
  commitProjectLabel,
  remotesMenuAnchor,
  setRemotesMenuAnchor,
  setCloneTarget,
  setBindingRemoteProject,
  onOpenTarget,
  onOpenLocalFolder,
  onRemoveProject,
  requestRemoveProject,
  onProjectDragOver,
  commitDrop,
  onProjectDragStart,
  onProjectDragEnd,
  onProjectContextMenu,
  t,
}: {
  project: GitProjectView
  group: string
  isLast: boolean
  currentPath: string
  isEdge: boolean
  busy: boolean
  draggingId: string
  dropTarget: { group: string; beforeId: string | null } | null
  editingLabelProjectId: string | null
  setEditingLabelProjectId: Dispatch<SetStateAction<string | null>>
  projectLabelDraft: string
  setProjectLabelDraft: Dispatch<SetStateAction<string>>
  commitProjectLabel: (id: string) => Promise<void>
  remotesMenuAnchor: RemotesMenuAnchor | null
  setRemotesMenuAnchor: Dispatch<SetStateAction<RemotesMenuAnchor | null>>
  setCloneTarget: Dispatch<SetStateAction<GitProjectView | null>>
  setBindingRemoteProject: Dispatch<SetStateAction<GitProjectView | null>>
  onOpenTarget: (target: string) => void
  onOpenLocalFolder: (e: MouseEvent, localPath?: string) => Promise<void>
  onRemoveProject?: boolean
  requestRemoveProject: (project: GitProjectView) => Promise<void>
  onProjectDragOver: (event: DragEvent<HTMLElement>, group: string, projectId: string) => void
  commitDrop: (event: DragEvent<HTMLElement>) => Promise<void>
  onProjectDragStart: (event: DragEvent<HTMLButtonElement>, id: string) => void
  onProjectDragEnd: () => void
  onProjectContextMenu: (e: MouseEvent, project: GitProjectView) => void
  t: ReturnType<typeof useT>
}) {
  const target = projectOpenTarget(project)
  const online = !project.localPath && Boolean(target)
  const current = Boolean(target) && (target === currentPath || (online && remoteIdentity(target) === remoteIdentity(currentPath)))
  const showBefore = dropTarget?.group === group && dropTarget.beforeId === project.id
  const showAfter = dropTarget?.group === group && dropTarget.beforeId === null && isLast && draggingId !== project.id
  const remotes = extractProjectRemotes(project)
  const cloudType = getRemoteCloudType(remotes)
  const hasLocal = Boolean(project.localPath)

  return (
    <div className="relative w-full" onDragOver={(event) => onProjectDragOver(event, group, project.id)} onDrop={(event) => void commitDrop(event)}>
      {showBefore ? <span className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden /> : null}
      <div
        className={cn(
          'group/item flex w-full items-center pr-1.5 transition-colors',
          project.label ? 'h-11' : 'h-8',
          current
            ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent font-medium hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
            : 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]',
          draggingId === project.id && 'opacity-50'
        )}
        onContextMenu={(e) => onProjectContextMenu(e, project)}
      >
        {editingLabelProjectId === project.id ? (
          <div className="flex min-w-0 flex-1 items-center px-2 pl-7">
            <input
              autoFocus
              type="text"
              value={projectLabelDraft}
              placeholder={t('git.project.aliasPlaceholder') || 'Set project alias / notes…'}
              className="h-6 w-full rounded border border-accent bg-paper px-2 text-xs text-ink outline-none focus:ring-1 focus:ring-accent"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setProjectLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commitProjectLabel(project.id)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditingLabelProjectId(null)
                }
              }}
              onBlur={() => {
                void commitProjectLabel(project.id)
              }}
            />
          </div>
        ) : (
          <Button
            variant="plain"
            draggable={!busy}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'min-w-0 flex-1 cursor-grab justify-start gap-1.5 rounded-none px-2 pl-7 font-normal text-ink active:cursor-grabbing hover:enabled:bg-transparent',
              project.label ? 'h-11' : 'h-8'
            )}
            onDragStart={(event) => onProjectDragStart(event, project.id)}
            onDragEnd={onProjectDragEnd}
            onClick={() => {
              if (target) onOpenTarget(target)
              else setCloneTarget(project)
            }}
          >
            <HostIcon host={project.host} />
            {project.label ? (
              <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                <span className="truncate text-xs font-semibold text-ink leading-tight">{project.label}</span>
                <span className="truncate text-[10px] text-ink-soft leading-tight font-mono">{project.name}</span>
              </div>
            ) : (
              <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs font-medium">{project.name}</span>
            )}
          </Button>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          {onRemoveProject && (
            <Button
              variant="plain"
              size="icon"
              className="size-6 text-ink-soft hover:enabled:text-fail opacity-0 pointer-events-none group-hover/item:pointer-events-auto group-hover/item:opacity-100 disabled:opacity-0 group-hover/item:disabled:opacity-40 transition-opacity"
              aria-label={t('git.project.removeProjectConfirm', { name: project.label || project.name })}
              tooltip={t('git.project.removeProject')}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation()
                void requestRemoveProject(project)
              }}
            >
              <LuTrash2 className="size-3.5" aria-hidden />
            </Button>
          )}
          <Tooltip content={project.label ? t('git.project.editAlias') || 'Edit project alias' : t('git.project.setAlias') || 'Set project alias'}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEditingLabelProjectId(project.id)
                setProjectLabelDraft(project.label || '')
              }}
              className="flex size-6 opacity-0 pointer-events-none group-hover/item:pointer-events-auto group-hover/item:opacity-100 cursor-pointer items-center justify-center rounded text-ink-soft transition-all hover:bg-[var(--overlay-08)] hover:text-accent"
              aria-label={t('git.project.setAlias') || 'Set project alias'}
            >
              <LuPencil className="size-3" aria-hidden="true" />
            </button>
          </Tooltip>
          {hasLocal ? (
            <Tooltip content={isEdge ? t('git.project.localProject') || 'Local project' : t('git.project.openLocalProject') || 'Open local project'}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (project.localPath) {
                    void onOpenLocalFolder(e, project.localPath)
                  }
                }}
                className="flex size-6 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-[var(--overlay-08)] hover:text-accent"
                aria-label={isEdge ? t('git.project.localProject') || 'Local project' : t('git.project.openLocalProject') || 'Open local project'}
              >
                {isEdge && project.authorized === false ? (
                  <LuLockKeyhole className="size-3.5 text-warn" aria-hidden="true" />
                ) : (
                  <LuHardDrive className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          ) : (
            <span className="size-6 shrink-0" aria-hidden="true" />
          )}

          {cloudType === 'single-public' ? (
            <Tooltip content={t('git.project.publicRemoteTooltip', { name: remotes[0].name }) || `Public remote: ${remotes[0].name} · Click to open`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(remotes[0].webUrl, '_blank')
                }}
                className="flex size-6 cursor-pointer items-center justify-center rounded text-accent transition-colors hover:bg-accent/15 hover:text-[color-mix(in_oklab,var(--accent)_80%,black)]"
                aria-label={t('git.project.publicRemoteAria', { name: remotes[0].name }) || `Public remote: ${remotes[0].name}`}
              >
                <LuCloud className="size-3.5 text-accent" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : cloudType === 'single-private' ? (
            <Tooltip content={t('git.project.privateRemoteTooltip', { name: remotes[0].name }) || `Private remote: ${remotes[0].name} · Click to open`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(remotes[0].webUrl, '_blank')
                }}
                className="flex size-6 cursor-pointer items-center justify-center rounded text-warn transition-colors hover:bg-warn/15 hover:text-warn/80"
                aria-label={t('git.project.privateRemoteAria', { name: remotes[0].name }) || `Private remote: ${remotes[0].name}`}
              >
                <TbCloudLock className="size-3.5 text-warn" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : cloudType === 'mixed' ? (
            <Tooltip content={t('git.project.remotesListTooltip') || 'Remote list (multiple remotes) · Click to expand'}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setRemotesMenuAnchor((prev) => (prev?.projectId === project.id ? null : { projectId: project.id, rect, remotes }))
                }}
                className={cn(
                  'flex size-6 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-[var(--overlay-08)] hover:text-ink',
                  remotesMenuAnchor?.projectId === project.id && 'bg-[var(--overlay-08)] text-accent'
                )}
                aria-label={t('git.project.remotesList') || 'Remote list'}
                aria-haspopup="menu"
                aria-expanded={remotesMenuAnchor?.projectId === project.id}
              >
                <LuCloud className="size-3.5" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content={t('git.project.noRemoteBind')}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setBindingRemoteProject(project)
                }}
                className="flex size-6 cursor-pointer items-center justify-center rounded text-ink-soft/60 transition-colors hover:bg-[var(--overlay-08)] hover:text-accent"
                aria-label={t('git.project.noRemoteBind')}
              >
                <LuCloudOff className="size-3.5 text-ink-soft/60 hover:text-accent transition-colors" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      {showAfter ? <span className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-0.5 translate-y-1/2 rounded-full bg-accent" aria-hidden /> : null}
    </div>
  )
}
