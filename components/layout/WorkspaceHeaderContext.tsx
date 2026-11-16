'use client'

import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface WorkspaceHeaderContextValue {
  inWorkspace: boolean
  slotNode: HTMLDivElement | null
  setSlotNode: (node: HTMLDivElement | null) => void
  actionsNode: HTMLDivElement | null
  setActionsNode: (node: HTMLDivElement | null) => void
}

const WorkspaceHeaderContext = createContext<WorkspaceHeaderContextValue | null>(null)

export function WorkspaceHeaderProvider({ children }: { children: ReactNode }) {
  const [slotNode, setSlotNode] = useState<HTMLDivElement | null>(null)
  const [actionsNode, setActionsNode] = useState<HTMLDivElement | null>(null)

  return (
    <WorkspaceHeaderContext.Provider
      value={{
        inWorkspace: true,
        slotNode,
        setSlotNode,
        actionsNode,
        setActionsNode,
      }}
    >
      {children}
    </WorkspaceHeaderContext.Provider>
  )
}

export function useWorkspaceHeader() {
  return useContext(WorkspaceHeaderContext)
}

export function useInWorkspaceHeader(): boolean {
  const ctx = useContext(WorkspaceHeaderContext)
  return Boolean(ctx?.inWorkspace)
}

export function WorkspaceHeaderSlot({ children }: { children: ReactNode }) {
  const ctx = useContext(WorkspaceHeaderContext)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!ctx || !ctx.inWorkspace || !ctx.slotNode || !mounted) {
    if (!ctx?.inWorkspace) {
      return <div className="flex items-center gap-2">{children}</div>
    }
    return null
  }

  return createPortal(children, ctx.slotNode)
}

export function WorkspaceHeaderActionsSlot({ children }: { children: ReactNode }) {
  const ctx = useContext(WorkspaceHeaderContext)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!ctx || !ctx.inWorkspace || !ctx.actionsNode || !mounted) {
    if (!ctx?.inWorkspace) {
      return <div className="flex items-center gap-1.5">{children}</div>
    }
    return null
  }

  return createPortal(children, ctx.actionsNode)
}
