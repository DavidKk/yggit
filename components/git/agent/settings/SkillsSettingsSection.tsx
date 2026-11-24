'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { LuBookOpen, LuChevronRight, LuPlus, LuSparkles } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { listSkills, subscribeSkills, toggleSkill } from '@/lib/skills/storage'
import type { SkillDescriptor } from '@/lib/skills/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function SkillsSettingsSection() {
  const t = useT()
  const router = useRouter()
  const notify = useNotification()
  const [skills, setSkills] = useState<SkillDescriptor[]>([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const list = await listSkills()
    setSkills(list)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    return subscribeSkills(() => {
      void reload()
    })
  }, [])

  const handleToggle = async (id: string, current: boolean) => {
    await toggleSkill(id, !current)
    notify.success(current ? t('gitAgent.skillDisabled') || 'Skill disabled' : t('gitAgent.skillEnabled') || 'Skill enabled')
  }

  return (
    <div className="flex flex-col gap-3">
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuSparkles className="size-4 text-accent" />
            <span>Agent 技能库 (Custom Skills)</span>
          </div>
        }
        description="管理 Agent 专业知识、工作流程规范与外部指导准则。遵循 Agent Skills 开放标准 (SKILL.md)。点击技能项查看与配置详情。"
        titleAction={
          <Button variant="accent" size="sm" onClick={() => router.push('/settings/skills/new')}>
            <LuPlus className="size-3.5 mr-1" />
            <span>添加</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5">
          {skills.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
              <LuBookOpen className="size-8 text-ink-soft/40 mb-2" />
              <div className="text-xs font-semibold text-ink">暂未安装自定义 Skill</div>
              <p className="text-[11px] text-ink-soft max-w-sm mt-1">您可以从本地导入 SKILL.md 或关联 GitHub 仓库中的 Skill 知识库。</p>
            </div>
          )}

          {skills.map((s) => {
            const isBuiltin = s.source.type === 'builtin'
            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors',
                  s.enabled ? 'border-line bg-panel hover:border-line-solid' : 'border-line/40 bg-paper-2/60 opacity-60'
                )}
              >
                <Link
                  href={`/settings/skills/${encodeURIComponent(s.id)}`}
                  className="min-w-0 flex-1 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  aria-label={`查看或配置 ${s.name}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink group-hover:text-accent transition-colors">{s.name}</span>
                    <Badge tone={isBuiltin ? 'info' : s.source.type === 'github' ? 'accent' : 'neutral'} size="mini">
                      {isBuiltin ? '内置' : s.source.type === 'github' ? 'GitHub' : '本地'}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-soft mt-1 line-clamp-2 leading-relaxed">{s.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-ink-soft/80 font-mono">
                    <span>来源: {s.source.uri}</span>
                    {s.source.branch ? <span>分支: {s.source.branch}</span> : null}
                  </div>
                </Link>

                <div className="flex items-center gap-3 shrink-0">
                  <SwitchToggle
                    checked={s.enabled}
                    onCheckedChange={() => void handleToggle(s.id, s.enabled)}
                    size="sm"
                    tooltip={s.enabled ? '停用此技能' : '启用此技能'}
                    aria-label={`启用或停用 ${s.name}`}
                  />
                  <Link href={`/settings/skills/${encodeURIComponent(s.id)}`} className="text-ink-soft/40 hover:text-ink transition-colors p-1" title="查看详情">
                    <LuChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>
    </div>
  )
}
