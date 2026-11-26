'use client'

import React, { useEffect, useRef } from 'react'
import { LuCheck, LuInfo, LuX } from 'react-icons/lu'

import { copyToClipboard } from '@/lib/clipboard'
import type { SpotlightTarget } from '@/services/git/agent-impact'

interface Props {
  target: SpotlightTarget
  onClose: () => void
}

export function AnnotationPopover({ target, onClose }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState(false)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleCopy = () => {
    copyToClipboard(target.hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-line bg-panel p-3 text-ink shadow-xl animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <LuInfo className="h-3.5 w-3.5 text-accent" />
          <span>Agent Attribution Evidence</span>
        </div>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Close">
          <LuX className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="text-[11px] font-medium text-ink-muted">Evidence Grade:</span>
          <span className="font-semibold text-ink ml-1">
            {target.evidenceGrade === 'Fact'
              ? 'Fact (Confirmed by Git / topology)'
              : target.evidenceGrade === 'Derived'
                ? 'Derived (Computed algorithmically)'
                : 'Hypothesis (Model inference)'}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-ink-muted">Diagnostic Reason:</span>
          <p className="mt-0.5 text-xs leading-relaxed text-ink bg-panel-2/60 p-2 rounded-lg border border-line">{target.reason}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <code className="text-[11px] font-mono text-ink-muted">{target.shortHash || target.hash.slice(0, 7)}</code>
          <button type="button" onClick={handleCopy} className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer">
            {copied ? (
              <>
                <LuCheck className="h-3 w-3" />
                <span>Hash Copied</span>
              </>
            ) : (
              <span>Copy Commit Hash</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
