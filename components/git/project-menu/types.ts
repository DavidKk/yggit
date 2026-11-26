import type { RefObject } from 'react'

import type { AddRemoteProjectOptions } from '@/lib/git/driver/types'
import type { GitProjectView } from '@/lib/git/types'

export type GitProjectMenuProps = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  currentPath: string
  projects: GitProjectView[]
  folders: string[]
  busy: boolean
  onClose: () => void
  onOpen: (path: string) => void
  onAddLocal: () => void
  onAddRemote: (input: AddRemoteProjectOptions) => Promise<string>
  onClone: (project: GitProjectView) => Promise<string>
  onCreateFolder: (name: string) => Promise<string>
  onDeleteFolder: (name: string) => Promise<{ error: string; removedCount?: number }>
  onRenameFolder?: (oldName: string, newName: string) => Promise<string>
  onClearFolder?: (name: string) => Promise<string>
  onSetProjectLabel?: (id: string, label: string) => Promise<string>
  onRemoveProject?: (id: string) => Promise<string>
  onMoveProject: (id: string, group: string, beforeId?: string) => Promise<string>
  onRefreshProjects?: () => Promise<void> | void
  /** Bump to open the project search field (Cmd+F from the switcher). */
  searchRequest?: number
  /** Highlights the Workdesk entry when rendered from the Workdesk header. */
  activeWorkdesk?: boolean
}
