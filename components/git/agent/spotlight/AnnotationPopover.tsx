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
      className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <LuInfo className="h-3.5 w-3.5 text-accent" />
          <span>Agent 归因证据</span>
        </div>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Close">
          <LuX className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="text-[11px] font-medium text-muted-foreground">证据等级：</span>
          <span className="font-semibold text-foreground ml-1">
            {target.evidenceGrade === 'Fact'
              ? '事实证据 (Fact - 拓扑/Git 原生证实)'
              : target.evidenceGrade === 'Derived'
                ? '推导证据 (Derived - 算法计算得出)'
                : '假设证据 (Hypothesis - 模型推测)'}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-muted-foreground">诊断理由：</span>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/90 bg-muted/20 p-2 rounded border border-border/30">{target.reason}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <code className="text-[11px] font-mono text-muted-foreground">{target.shortHash || target.hash.slice(0, 7)}</code>
          <button type="button" onClick={handleCopy} className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer">
            {copied ? (
              <>
                <LuCheck className="h-3 w-3" />
                <span>已复制 Hash</span>
              </>
            ) : (
              <span>复制 Commit Hash</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
