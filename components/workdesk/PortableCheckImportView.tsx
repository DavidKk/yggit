'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuCheck, LuFolderGit2, LuPlay, LuUpload } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, TextInput } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import type { GitProjectView } from '@/lib/git/types'
import { cn } from '@/lib/utils'
import { workdeskEngine } from '@/lib/workdesk/engine'
import { decodeRecipeFromUrlHash, matchRecipeWithLocalProjects } from '@/lib/workdesk/share'
import type { CheckRecipe, RepoMatchResult } from '@/lib/workdesk/types'

export function PortableCheckImportView() {
  const t = useT()
  const router = useRouter()

  const [rawInput, setRawInput] = useState('')
  const [recipe, setRecipe] = useState<CheckRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localProjects, setLocalProjects] = useState<GitProjectView[]>([])
  const [isChecking, setIsChecking] = useState(false)

  // 1. Load local projects
  useEffect(() => {
    getGitDriver()
      .getProjects()
      .then((cat) => {
        setLocalProjects(cat.projects || [])
      })
      .catch(() => {})
  }, [])

  // 2. Read hash from URL if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash && hash.length > 5) {
        try {
          const decoded = decodeRecipeFromUrlHash(hash)
          setRecipe(decoded)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : t('workdesk.import.invalidRecipe'))
        }
      }
    }
  }, [t])

  const handleManualDecode = () => {
    if (!rawInput.trim()) return
    try {
      const decoded = decodeRecipeFromUrlHash(rawInput.trim())
      setRecipe(decoded)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workdesk.import.invalidRecipe'))
    }
  }

  // Calculate matching matrix
  const matchResults: RepoMatchResult[] = useMemo(() => {
    if (!recipe || localProjects.length === 0) return []
    return matchRecipeWithLocalProjects(recipe, localProjects)
  }, [recipe, localProjects])

  const matchedCount = matchResults.filter((r) => r.status === 'matched').length
  const totalCount = recipe?.repositories.length || 0

  // Run checks on matched projects
  const handleVerifyMatched = async () => {
    if (!recipe) return
    setIsChecking(true)
    try {
      const matchedProjects = matchResults
        .filter((r) => r.status === 'matched' && r.matchedProject)
        .map((r) => {
          return localProjects.find((p) => p.id === r.matchedProject?.id)
        })
        .filter(Boolean) as GitProjectView[]

      await workdeskEngine.scan(matchedProjects)
      router.push('/workdesk')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <Link href="/workdesk">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <LuArrowLeft className="size-4" aria-hidden="true" />
            </Button>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-ink">{t('workdesk.import.title')}</h1>
            <p className="text-xs text-ink-muted">{t('workdesk.import.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Recipe Input when not loaded from hash */}
      {!recipe && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-xl border border-line bg-panel p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink">粘贴检查方案链接或载荷代码</span>
          <TextInput placeholder="#data=... 或粘贴 Base64 载荷" value={rawInput} onChange={(e) => setRawInput(e.target.value)} className="font-mono text-xs" />
          {error && <span className="text-xs text-red-500">{error}</span>}
          <Button onClick={handleManualDecode} disabled={!rawInput.trim()} size="sm" className="self-end">
            <LuUpload className="mr-1.5 size-3.5" aria-hidden="true" />
            解析方案
          </Button>
        </div>
      )}

      {/* Recipe Loaded: Matching Matrix */}
      {recipe && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {/* Status summary banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2/60 p-4">
            <div className="flex items-center gap-2.5">
              <LuFolderGit2 className="size-4 text-accent" aria-hidden="true" />
              <span className="text-xs font-bold text-ink">{t('workdesk.import.matchedCount', { matched: matchedCount, total: totalCount })}</span>
            </div>

            <Button size="sm" onClick={handleVerifyMatched} disabled={matchedCount === 0 || isChecking}>
              <LuPlay className={cn('mr-1.5 size-3.5', isChecking && 'animate-spin')} aria-hidden="true" />
              {isChecking ? t('workdesk.import.checkInProgress') : t('workdesk.import.verifyMatched')}
            </Button>
          </div>

          {/* Repositories Matrix List */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-ink-muted">配方仓库匹配列表</span>
            <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-panel">
              {matchResults.map((result, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 p-3.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-semibold text-ink">
                      项目 {idx + 1}
                      {result.matchedProject ? ` · ${result.matchedProject.name}` : ''}
                    </span>
                    <span className="truncate font-mono text-[10px] text-ink-soft">{result.identityDigest.slice(0, 16)}...</span>
                  </div>

                  <div>
                    {result.status === 'matched' ? (
                      <Badge tone="ok">
                        <LuCheck className="mr-1 size-3" aria-hidden="true" />
                        {t('workdesk.import.matched')}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{t('workdesk.import.pendingMatch')}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
