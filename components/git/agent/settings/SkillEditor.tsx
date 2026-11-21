'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { LuBookOpen, LuCheck, LuFolderOpen, LuGithub, LuPlus, LuRefreshCw, LuSparkles, LuTrash2 } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { parseSkillMarkdown } from '@/lib/skills/parser'
import { checkAndUpdateGitHubSkill, discoverSkillsFromGitHub } from '@/lib/skills/providers/github-provider'
import { deleteSkill, listSkills, saveSkill, toggleSkill } from '@/lib/skills/storage'
import type { SkillDescriptor } from '@/lib/skills/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

interface SkillEditorProps {
  skillId: string
}

export function SkillEditor({ skillId }: SkillEditorProps) {
  const router = useRouter()
  const notify = useNotification()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isNew = skillId === 'new'
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local')

  // Existing skill state
  const [skill, setSkill] = useState<SkillDescriptor | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editedContent, setEditedContent] = useState('')

  // New Local Skill form
  const [localName, setLocalName] = useState('')
  const [localDesc, setLocalDesc] = useState('')
  const [localContent, setLocalContent] = useState('')

  // New GitHub Skill form
  const [ghRepo, setGhRepo] = useState('')
  const [ghBranch, setGhBranch] = useState('main')
  const [ghDirectory, setGhDirectory] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [ghFetching, setGhFetching] = useState(false)

  // Load existing skill
  useEffect(() => {
    if (isNew) return
    let active = true
    void (async () => {
      setLoading(true)
      const list = await listSkills()
      const found = list.find((s) => s.id === skillId)
      if (active) {
        if (found) {
          setSkill(found)
          setEditedContent(found.content || '')
        }
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [skillId, isNew])

  const handleBack = () => {
    router.push('/settings/skills')
  }

  // Handle local file selection
  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseSkillMarkdown(text)
      setLocalContent(text)
      if (parsed.name && !localName) setLocalName(parsed.name)
      if (parsed.description && !localDesc) setLocalDesc(parsed.description)
      notify.success(`已解析 ${file.name}`)
    } catch {
      notify.error('读取 SKILL.md 文件失败')
    }
  }

  // Save new local skill
  const handleSaveLocalSkill = async () => {
    if (!localContent.trim()) {
      notify.error('请输入 SKILL.md 内容')
      return
    }
    const parsed = parseSkillMarkdown(localContent)
    const finalName = localName.trim() || parsed.name || 'Custom Skill'
    const finalDesc = localDesc.trim() || parsed.description || '自定义工作流规范'
    const id = `skill-local-${Date.now()}`

    const now = Date.now()
    const newSkill: SkillDescriptor = {
      id,
      name: finalName,
      description: finalDesc,
      source: {
        type: 'local',
        uri: `local://${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      },
      content: localContent,
      enabled: true,
      trusted: true,
      createdAt: now,
      updatedAt: now,
    }

    await saveSkill(newSkill)
    notify.success(`已添加技能 "${finalName}"`)
    router.push('/settings/skills')
  }

  // Import GitHub skill
  const handleImportGitHubSkill = async () => {
    if (!ghRepo.trim()) {
      notify.error('请输入 GitHub 仓库路径 (如 owner/repo)')
      return
    }

    setGhFetching(true)
    try {
      const results = await discoverSkillsFromGitHub({
        repo: ghRepo.trim(),
        branch: ghBranch.trim() || 'main',
        directory: ghDirectory.trim() || undefined,
        token: ghToken.trim() || undefined,
      })

      if (results.length === 0) {
        notify.warning('未在指定路径下找到有效的 SKILL.md 文件')
        return
      }

      for (const s of results) {
        await saveSkill(s)
      }
      notify.success(`成功导入 ${results.length} 个 GitHub Skill`)
      router.push('/settings/skills')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '从 GitHub 导入 Skill 失败')
    } finally {
      setGhFetching(false)
    }
  }

  // Toggle existing skill status
  const handleToggle = async () => {
    if (!skill) return
    await toggleSkill(skill.id, !skill.enabled)
    setSkill({ ...skill, enabled: !skill.enabled })
    notify.success(skill.enabled ? 'Skill 已禁用' : 'Skill 已启用')
  }

  // Check and sync GitHub updates
  const handleCheckUpdate = async () => {
    if (!skill || skill.source.type !== 'github') return
    setIsUpdating(true)
    try {
      const res = await checkAndUpdateGitHubSkill(skill)
      if (res.hasUpdate && res.updatedSkill) {
        await saveSkill(res.updatedSkill)
        setSkill(res.updatedSkill)
        setEditedContent(res.updatedSkill.content || '')
        notify.success('GitHub Skill 已同步至最新版本')
      } else {
        notify.info('当前 Skill 已是最新版本')
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '检查更新失败')
    } finally {
      setIsUpdating(false)
    }
  }

  // Save edits for local/custom skill content
  const handleSaveContentEdit = async () => {
    if (!skill) return
    const parsed = parseSkillMarkdown(editedContent)
    const updated: SkillDescriptor = {
      ...skill,
      name: parsed.name || skill.name,
      description: parsed.description || skill.description,
      content: editedContent,
      updatedAt: Date.now(),
    }
    await saveSkill(updated)
    setSkill(updated)
    notify.success('已保存 Skill 指令内容')
  }

  // Delete skill
  const handleDelete = () => {
    if (!skill) return
    confirm({
      title: '移除 Skill',
      description: `确定要移除技能「${skill.name}」吗？此操作无法撤销。`,
      confirmLabel: '移除',
      confirmVariant: 'fail',
      onConfirm: async () => {
        await deleteSkill(skill.id)
        notify.success('已移除 Skill')
        router.push('/settings/skills')
      },
    })
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-ink-soft">
        <LuRefreshCw className="size-4 animate-spin mr-2 text-accent" />
        <span>加载技能配置中…</span>
      </div>
    )
  }

  if (!isNew && !skill) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
        <LuBookOpen className="size-8 text-ink-soft/40 mb-2" />
        <div className="text-xs font-semibold text-ink">未找到该技能</div>
        <p className="text-[11px] text-ink-soft max-w-sm mt-1">此技能可能已被移除或 ID 不存在。</p>
        <Button variant="default" onClick={handleBack} className="mt-3">
          返回
        </Button>
      </div>
    )
  }

  // 1. New Skill Subpage
  if (isNew) {
    return (
      <div className="flex flex-col gap-3">
        <SettingsSectionCard
          title={
            <div className="flex items-center gap-2">
              <LuSparkles className="size-4 text-accent" />
              <span>新增 Agent 技能 (New Skill)</span>
            </div>
          }
          description="遵循 Agent Skills 开放标准 (SKILL.md)。可导入本地文件或直接关联 GitHub 仓库中的 Skill 规范。"
          titleAction={
            <Button variant="plain" size="sm" onClick={handleBack}>
              返回
            </Button>
          }
        >
          {/* Source Switcher */}
          <div className="flex items-center gap-1 rounded-md border border-line bg-paper-2 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('local')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer',
                activeTab === 'local' ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
              )}
            >
              <LuFolderOpen className="size-3.5" />
              <span>导入本地 SKILL.md</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('github')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer',
                activeTab === 'github' ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
              )}
            >
              <LuGithub className="size-3.5" />
              <span>关联 GitHub 仓库</span>
            </button>
          </div>

          {/* Local Tab Form */}
          {activeTab === 'local' && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center justify-between p-3 rounded-lg bg-paper-2 border border-line">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-ink">快速载入本地文件</span>
                  <span className="text-[11px] text-ink-soft">选择已有 SKILL.md 文件自动填充表单</span>
                </div>
                <input ref={fileInputRef} type="file" accept=".md,text/markdown" onChange={(e) => void handleLocalFileSelect(e)} className="hidden" />
                <Button variant="default" onClick={() => fileInputRef.current?.click()}>
                  <LuFolderOpen className="size-3.5 mr-1" />
                  <span>选择文件</span>
                </Button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Skill 名称 (可选，默认从文档元数据读取)</label>
                <input
                  type="text"
                  placeholder="例如: Go Concurrency Review"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Skill 描述 (可选，默认从文档元数据读取)</label>
                <input
                  type="text"
                  placeholder="简述该技能适用的任务与领域专长"
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">SKILL.md 内容规范与指令</label>
                <textarea
                  rows={12}
                  placeholder={`---\nname: my-skill\ndescription: How agent solves specific problems\n---\n\n# Workflow Instructions\n1. Review diff impact.\n2. Verify concurrency safety.`}
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  className="rounded border border-line bg-surface-panel p-2.5 font-mono text-xs text-ink outline-none focus:border-accent leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
                <Button variant="plain" onClick={handleBack}>
                  取消
                </Button>
                <Button variant="accent" onClick={() => void handleSaveLocalSkill()}>
                  <LuPlus className="size-3.5 mr-1" />
                  <span>保存</span>
                </Button>
              </div>
            </div>
          )}

          {/* GitHub Tab Form */}
          {activeTab === 'github' && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">GitHub 仓库路径 (owner/repo)</label>
                <input
                  type="text"
                  placeholder="例如: octocat/agent-skills"
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-ink">分支名称 (Branch)</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={ghBranch}
                    onChange={(e) => setGhBranch(e.target.value)}
                    className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-ink">技能目录路径 (可选)</label>
                  <input
                    type="text"
                    placeholder="留空自动递归检索所有 SKILL.md"
                    value={ghDirectory}
                    onChange={(e) => setGhDirectory(e.target.value)}
                    className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Personal Access Token (可选，私有仓库需填写)</label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
                <Button variant="plain" disabled={ghFetching} onClick={handleBack}>
                  取消
                </Button>
                <Button variant="accent" loading={ghFetching} onClick={() => void handleImportGitHubSkill()}>
                  <LuCheck className="size-3.5 mr-1" />
                  <span>导入</span>
                </Button>
              </div>
            </div>
          )}
        </SettingsSectionCard>
      </div>
    )
  }

  // 2. Existing Skill Detail & Configuration Subpage
  const isBuiltin = skill?.source.type === 'builtin'
  const isGitHub = skill?.source.type === 'github'

  return (
    <div className="flex flex-col gap-3">
      {/* Overview & Status Card */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <span>{skill?.name}</span>
            <Badge tone={isBuiltin ? 'info' : isGitHub ? 'accent' : 'neutral'} size="mini">
              {isBuiltin ? '内置' : isGitHub ? 'GitHub' : '本地'}
            </Badge>
          </div>
        }
        description={skill?.description}
        titleAction={
          <div className="flex items-center gap-2">
            <SwitchToggle
              checked={skill?.enabled ?? true}
              onCheckedChange={() => void handleToggle()}
              size="sm"
              tooltip={skill?.enabled ? '停用此技能' : '启用此技能'}
              aria-label={`启用或停用 ${skill?.name}`}
            />
            <Button variant="plain" size="sm" onClick={handleBack}>
              返回
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper-2/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-ink-soft font-mono">
            <span>来源: {skill?.source.uri}</span>
            {skill?.source.branch && <span>分支: {skill?.source.branch}</span>}
            {skill?.commitSha && <span>Commit: {skill?.commitSha.slice(0, 7)}</span>}
            {skill?.updatedAt && <span>更新时间: {new Date(skill.updatedAt).toLocaleString()}</span>}
          </div>

          {isGitHub && (
            <div className="pt-2 flex items-center gap-2 border-t border-line/60">
              <Button variant="default" disabled={isUpdating} loading={isUpdating} onClick={() => void handleCheckUpdate()} title="检查并同步 GitHub 最新版本">
                <LuRefreshCw className={cn('size-3.5 mr-1', isUpdating && 'animate-spin')} />
                <span>检查更新</span>
              </Button>
            </div>
          )}
        </div>
      </SettingsSectionCard>

      {/* Content / Instructions Card */}
      <SettingsSectionCard
        title="SKILL.md 规范与指令内容"
        description={isBuiltin ? '内置技能指令只读，由系统版本维护。' : '您可以根据团队需求修改工作流指令与规范。'}
        titleAction={
          !isBuiltin ? (
            <Button variant="accent" size="sm" onClick={() => void handleSaveContentEdit()}>
              <LuCheck className="size-3.5 mr-1" />
              <span>保存</span>
            </Button>
          ) : undefined
        }
      >
        {!isBuiltin ? (
          <textarea
            rows={16}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full rounded border border-line bg-surface-panel p-3 font-mono text-xs text-ink outline-none focus:border-accent leading-relaxed"
          />
        ) : (
          <pre className="max-h-[50vh] overflow-y-auto rounded border border-line bg-surface-panel p-3 font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap">
            {skill?.content}
          </pre>
        )}
      </SettingsSectionCard>

      {/* Danger Zone Card */}
      {!isBuiltin && (
        <SettingsSectionCard title="危险操作" description="移除后此技能将不再对 Agent 生效，可重新导入。">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-soft">移除此技能定义及本地缓存</span>
            <Button variant="outline-fail" onClick={handleDelete}>
              <LuTrash2 className="size-3.5 mr-1" />
              <span>删除</span>
            </Button>
          </div>
        </SettingsSectionCard>
      )}
    </div>
  )
}
