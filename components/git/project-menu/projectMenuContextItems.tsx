'use client'

import { LuChevronDown, LuChevronRight, LuCopy, LuExternalLink, LuFolder, LuGlobe, LuHardDrive, LuPencil, LuTrash2 } from 'react-icons/lu'

import type { FloatingMenuItem } from '@/components/git/RefChipsCell'
import type { useT } from '@/components/i18n/LocaleProvider'
import type { GitProjectView } from '@/lib/git/types'

type TFn = ReturnType<typeof useT>

export function buildFolderContextItems({
  group,
  expanded,
  itemsInGroup,
  t,
  notify,
  copyValue,
  startRenameFolder,
  onToggleExpand,
  onClearFolder,
  requestDeleteFolder,
}: {
  group: string
  expanded: boolean
  itemsInGroup: GitProjectView[]
  t: TFn
  notify: { success: (msg: string) => void; error: (msg: string) => void }
  copyValue: (text: string) => Promise<void> | void
  startRenameFolder: (group: string) => void
  onToggleExpand: (group: string, next: boolean) => void
  onClearFolder?: (name: string) => Promise<string>
  requestDeleteFolder: (group: string) => Promise<void> | void
}): FloatingMenuItem[] {
  return [
    {
      key: 'rename-folder',
      label: t('git.project.renameFolder') || 'Rename Folder',
      icon: <LuPencil className="size-3.5 text-accent" />,
      onSelect: () => startRenameFolder(group),
      group: t('git.operations.groupActions') || 'Actions',
    },
    {
      key: 'toggle-expand',
      label: expanded ? t('git.project.collapseFolder') || 'Collapse Folder' : t('git.project.expandFolder') || 'Expand Folder',
      icon: expanded ? <LuChevronDown className="size-3.5" /> : <LuChevronRight className="size-3.5" />,
      onSelect: () => onToggleExpand(group, !expanded),
      group: t('git.operations.groupActions') || 'Actions',
    },
    {
      key: 'copy-folder-name',
      label: t('git.project.copyFolderName', { name: group }) || `Copy folder name (${group})`,
      icon: <LuCopy className="size-3.5 text-accent" />,
      onSelect: () => void copyValue(group),
      group: t('git.operations.groupCopy') || 'Copy',
    },
    {
      key: 'copy-projects-list',
      label: t('git.project.copyProjectsList', { count: itemsInGroup.length }) || `Copy project names (${itemsInGroup.length})`,
      icon: <LuCopy className="size-3.5 text-accent" />,
      onSelect: () => void copyValue(itemsInGroup.map((p) => p.label || p.name).join('\n')),
      group: t('git.operations.groupCopy') || 'Copy',
    },
    ...(onClearFolder
      ? [
          {
            key: 'clear-folder',
            label: t('git.project.clearFolder') || 'Clear folder (move out all projects)',
            icon: <LuTrash2 className="size-3.5 text-warn" />,
            onSelect: async () => {
              const msg = await onClearFolder(group)
              if (msg) notify.error(msg)
              else notify.success(t('git.project.clearFolderSuccess') || 'Folder cleared')
            },
            dividerBefore: true,
          },
        ]
      : []),
    {
      key: 'delete-folder',
      label: t('git.project.deleteFolder') || 'Delete folder',
      icon: <LuTrash2 className="size-3.5 text-fail" />,
      onSelect: () => void requestDeleteFolder(group),
    },
  ]
}

export function buildProjectContextItems({
  project,
  isEdge,
  t,
  copyValue,
  onEditLabel,
  onOpenLocalFolder,
  onRequestRemoveProject,
  canRemove,
}: {
  project: GitProjectView
  isEdge: boolean
  t: TFn
  copyValue: (text: string) => Promise<void> | void
  onEditLabel: (project: GitProjectView) => void
  onOpenLocalFolder: (localPath?: string) => Promise<void> | void
  onRequestRemoveProject: (project: GitProjectView) => Promise<void> | void
  canRemove: boolean
}): FloatingMenuItem[] {
  return [
    {
      key: 'edit-label',
      label: project.label
        ? t('git.project.editAliasCurrent', { label: project.label }) || `Edit alias (Current: ${project.label})`
        : t('git.project.setAlias') || 'Set project alias / notes',
      icon: <LuPencil className="size-3.5 text-accent" />,
      onSelect: () => onEditLabel(project),
      group: t('git.project.groupAction') || 'Actions',
    },
    {
      key: 'copy-name',
      label: t('git.project.copyProjectName', { name: project.name }) || `Copy project name (${project.name})`,
      icon: <LuCopy className="size-3.5 text-accent" />,
      onSelect: () => void copyValue(project.name),
      group: t('git.project.groupCopy') || 'Copy',
    },
    ...(project.label
      ? [
          {
            key: 'copy-label',
            label: t('git.project.copyProjectAlias', { label: project.label }) || `Copy project alias (${project.label})`,
            icon: <LuCopy className="size-3.5 text-accent" />,
            onSelect: () => void copyValue(project.label!),
            group: t('git.project.groupCopy') || 'Copy',
          },
        ]
      : []),
    ...(project.localPath
      ? [
          {
            key: 'copy-path',
            label: t('git.project.copyLocalPath', { path: project.localPath }) || `Copy local path (${project.localPath})`,
            icon: <LuHardDrive className="size-3.5 text-ink-soft" />,
            onSelect: () => void copyValue(project.localPath),
            group: t('git.project.groupCopy') || 'Copy',
          },
          ...(!isEdge
            ? [
                {
                  key: 'reveal-finder',
                  label: t('git.project.revealInFinder') || 'Reveal in Finder / File Explorer',
                  icon: <LuFolder className="size-3.5 text-accent" />,
                  onSelect: () => void onOpenLocalFolder(project.localPath),
                  group: t('git.project.groupAction') || 'Actions',
                },
              ]
            : []),
        ]
      : []),
    ...(project.httpsUrl
      ? [
          {
            key: 'copy-url',
            label: t('git.project.copyRepoUrl') || 'Copy repository URL',
            icon: <LuGlobe className="size-3.5 text-ink-soft" />,
            onSelect: () => void copyValue(project.httpsUrl),
            group: t('git.project.groupCopy') || 'Copy',
          },
          {
            key: 'open-browser',
            label: t('git.project.openInBrowser') || 'Open remote in browser',
            icon: <LuExternalLink className="size-3.5 text-accent" />,
            onSelect: () => window.open(project.httpsUrl.replace(/\.git$/, ''), '_blank'),
            group: t('git.project.groupAction') || 'Actions',
          },
        ]
      : []),
    ...(canRemove
      ? [
          {
            key: 'remove-project',
            label: t('git.project.removeFromSwitcher') || 'Remove from project switcher',
            icon: <LuTrash2 className="size-3.5 text-fail" />,
            onSelect: () => void onRequestRemoveProject(project),
            dividerBefore: true,
          },
        ]
      : []),
  ]
}
