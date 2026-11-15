'use client'

import { LuGlobe, LuTerminal } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { useGitDriver } from '@/lib/git/driver'
import { cn } from '@/lib/utils'

export function GitModeSwitcher({ className }: { className?: string }) {
  const t = useT()
  const { setMode, isEdge } = useGitDriver()

  const toggleMode = () => {
    setMode(isEdge ? 'local' : 'edge')
  }

  const tooltipText = isEdge ? t('git.driver.modeEdgeTip') : t('git.driver.modeLocalTip')
  const label = isEdge ? t('git.driver.modeEdge') : t('git.driver.modeLocal')

  return (
    <Tooltip content={tooltipText} placement="bottom">
      <button
        type="button"
        onClick={toggleMode}
        aria-label={label}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent select-none',
          isEdge ? 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/15' : 'border-ok/30 bg-ok/10 text-ok hover:bg-ok/15',
          className
        )}
      >
        {isEdge ? <LuGlobe className="size-3.5 shrink-0" aria-hidden /> : <LuTerminal className="size-3.5 shrink-0" aria-hidden />}
        <span>{label}</span>
      </button>
    </Tooltip>
  )
}
