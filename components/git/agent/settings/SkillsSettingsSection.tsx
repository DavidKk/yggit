'use client'

import React, { useEffect, useRef, useState } from 'react'
import { LuBookOpen, LuEye, LuFolderOpen, LuGithub, LuPlus, LuRefreshCw, LuSparkles, LuTrash2 } from 'react-icons/lu'

import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, Modal, SwitchToggle } from '@/components/sk'
import { parseSkillMarkdown } from '@/lib/skills/parser'
import { checkAndUpdateGitHubSkill, discoverSkillsFromGitHub } from '@/lib/skills/providers/github-provider'
import { deleteSkill, listSkills, saveSkill, subscribeSkills, toggleSkill } from '@/lib/skills/storage'
import type { SkillDescriptor } from '@/lib/skills/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function SkillsSettingsSection() {
  const notify = useNotification()
  const [skills, setSkills] = useState<SkillDescriptor[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Modals state
  const [localModalOpen, setLocalModalOpen] = useState(false)
  const [githubModalOpen, setGithubModalOpen] = useState(false)
  const [viewSkill, setViewSkill] = useState<SkillDescriptor | null>(null)

  // Local Skill Form
  const [localSkillName, setLocalSkillName] = useState('')
  const [localSkillDesc, setLocalSkillDesc] = useState('')
  const [localSkillContent, setLocalSkillContent] = useState('')

  // GitHub Skill Form
  const [ghRepo, setGhRepo] = useState('')
  const [ghBranch, setGhBranch] = useState('main')
  const [ghDirectory, setGhDirectory] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [ghFetching, setGhFetching] = useState(false)

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
    notify.success(current ? 'Skill 已禁用' : 'Skill 已启用')
  }

  const handleDelete = async (id: string) => {
    await deleteSkill(id)
    notify.success('Skill 已移除')
  }

  const handleCheckUpdate = async (skill: SkillDescriptor) => {
    setUpdatingId(skill.id)
    try {
      const res = await checkAndUpdateGitHubSkill(skill)
      if (res.hasUpdate && res.updatedSkill) {
        await saveSkill(res.updatedSkill)
        notify.success(`已更新 Skill [${skill.name}] 至最新版本！`)
      } else {
        notify.info(`Skill [${skill.name}] 已经是最新版本`)
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '检查更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseSkillMarkdown(text)
      setLocalSkillContent(text)
      if (!localSkillName.trim()) setLocalSkillName(parsed.name)
      if (!localSkillDesc.trim()) setLocalSkillDesc(parsed.description)
      notify.success(`已载入文件: ${file.name}`)
    } catch {
      notify.error('读取本地文件失败')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreateLocalSkill = async () => {
    if (!localSkillContent.trim()) {
      notify.error('Skill 内容不能为空')
      return
    }
    const parsed = parseSkillMarkdown(localSkillContent)
    const name = localSkillName.trim() || parsed.name
    const desc = localSkillDesc.trim() || parsed.description

    const newSkill: SkillDescriptor = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      description: desc,
      source: {
        type: 'local',
        uri: 'local://custom-skill',
      },
      content: localSkillContent,
      enabled: true,
      trusted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await saveSkill(newSkill)
    notify.success(`已添加 Local Skill: ${name}`)
    setLocalModalOpen(false)
    setLocalSkillName('')
    setLocalSkillDesc('')
    setLocalSkillContent('')
  }

  const handleImportGitHubSkill = async () => {
    if (!ghRepo.trim()) {
      notify.error('请输入 GitHub 仓库地址 (owner/repo)')
      return
    }
    setGhFetching(true)
    try {
      const discovered = await discoverSkillsFromGitHub({
        repo: ghRepo.trim(),
        branch: ghBranch.trim() || 'main',
        directory: ghDirectory.trim(),
        token: ghToken.trim() || undefined,
      })
      for (const skill of discovered) {
        await saveSkill(skill)
      }
      if (discovered.length > 1) {
        notify.success(`成功发现并导入 ${discovered.length} 个 Skill!`)
      } else {
        notify.success(`成功导入 GitHub Skill: ${discovered[0].name}`)
      }
      setGithubModalOpen(false)
      setGhRepo('')
      setGhDirectory('')
      setGhToken('')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '从 GitHub 导入 Skill 失败')
    } finally {
      setGhFetching(false)
    }
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
        description="管理 Agent 专业知识、工作流程规范与外部指导准则。遵循 Agent Skills 开放标准 (SKILL.md)。"
        titleAction={
          <div className="flex items-center gap-2">
            <Button variant="default" size="mini" onClick={() => setGithubModalOpen(true)}>
              <LuGithub className="size-3.5 mr-1" />
              <span>关联 GitHub</span>
            </Button>
            <Button variant="accent" size="mini" onClick={() => setLocalModalOpen(true)}>
              <LuPlus className="size-3.5 mr-1" />
              <span>导入本地 Skill</span>
            </Button>
          </div>
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">{s.name}</span>
                    <Badge tone={isBuiltin ? 'info' : s.source.type === 'github' ? 'accent' : 'neutral'} size="mini">
                      {isBuiltin ? '内置' : s.source.type === 'github' ? 'GitHub' : '本地'}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-soft mt-1 line-clamp-2 leading-relaxed">{s.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-ink-soft/80 font-mono">
                    <span>来源: {s.source.uri}</span>
                    {s.source.branch ? <span>分支: {s.source.branch}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {s.source.type === 'github' && (
                    <Button variant="ghost" size="mini" disabled={updatingId === s.id} onClick={() => void handleCheckUpdate(s)} title="检查并同步 GitHub 最新版本">
                      <LuRefreshCw className={cn('size-3.5 text-accent', updatingId === s.id && 'animate-spin')} />
                    </Button>
                  )}
                  <Button variant="ghost" size="mini" onClick={() => setViewSkill(s)} title="查看详情与说明">
                    <LuEye className="size-3.5" />
                  </Button>
                  {!isBuiltin && (
                    <Button variant="ghost" size="mini" onClick={() => void handleDelete(s.id)} title="移除此 Skill">
                      <LuTrash2 className="size-3.5 text-fail" />
                    </Button>
                  )}
                  <SwitchToggle
                    checked={s.enabled}
                    onCheckedChange={() => void handleToggle(s.id, s.enabled)}
                    tooltip={s.enabled ? '停用此技能' : '启用此技能'}
                    aria-label={`启用或停用 ${s.name}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>

      {/* View Skill Modal */}
      {viewSkill && (
        <Modal
          open={Boolean(viewSkill)}
          title={`Skill: ${viewSkill.name}`}
          description={viewSkill.description}
          onClose={() => setViewSkill(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="plain" size="md" onClick={() => setViewSkill(null)}>
                关闭
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            <div className="text-[11px] font-semibold text-ink-soft">SKILL.md 规范与指令内容</div>
            <pre className="p-3 rounded border border-line bg-surface-panel font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {viewSkill.content}
            </pre>
          </div>
        </Modal>
      )}

      {/* Local Skill Modal */}
      {localModalOpen && (
        <Modal
          open={localModalOpen}
          title="导入本地 Skill (Agent Skills 规范)"
          description="粘贴或输入符合 Agent Skills 标准的 SKILL.md Markdown 内容。"
          onClose={() => setLocalModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="plain" size="md" onClick={() => setLocalModalOpen(false)}>
                取消
              </Button>
              <Button variant="accent" size="md" onClick={() => void handleCreateLocalSkill()}>
                保存并启用
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 py-1">
            <div className="flex items-center justify-between p-2 rounded bg-paper-2 border border-line">
              <span className="text-[11px] text-ink-soft">快速载入本地 SKILL.md 文件:</span>
              <input ref={fileInputRef} type="file" accept=".md,text/markdown" onChange={(e) => void handleLocalFileSelect(e)} className="hidden" />
              <Button variant="default" size="mini" onClick={() => fileInputRef.current?.click()}>
                <LuFolderOpen className="size-3 mr-1" />
                <span>选择文件</span>
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">Skill 名称 (可选，留空从文档解析)</label>
              <input
                type="text"
                placeholder="例如: Go Concurrency Review"
                value={localSkillName}
                onChange={(e) => setLocalSkillName(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">Skill 描述 (可选，留空从文档解析)</label>
              <input
                type="text"
                placeholder="简述该技能适用的任务与专长"
                value={localSkillDesc}
                onChange={(e) => setLocalSkillDesc(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">SKILL.md 内容</label>
              <textarea
                rows={10}
                placeholder={`---\nname: my-skill\ndescription: How agent solves specific problems\n---\n\n# Workflow Instructions\n...`}
                value={localSkillContent}
                onChange={(e) => setLocalSkillContent(e.target.value)}
                className="rounded border border-line bg-surface-panel p-2.5 font-mono text-xs text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* GitHub Skill Modal */}
      {githubModalOpen && (
        <Modal
          open={githubModalOpen}
          title="关联 GitHub Skill 仓库"
          description="从 GitHub 仓库直接加载 SKILL.md。支持 Public 与指定 Token 的 Private 仓库。"
          onClose={() => setGithubModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="plain" size="md" disabled={ghFetching} onClick={() => setGithubModalOpen(false)}>
                取消
              </Button>
              <Button variant="accent" size="md" loading={ghFetching} onClick={() => void handleImportGitHubSkill()}>
                拉取并导入
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">GitHub 仓库路径 (owner/repo)</label>
              <input
                type="text"
                placeholder="例如: google/skills 或 owner/repo"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">分支 (Branch)</label>
                <input
                  type="text"
                  placeholder="main"
                  value={ghBranch}
                  onChange={(e) => setGhBranch(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">目录 (可选)</label>
                <input
                  type="text"
                  placeholder="例如: skills/code-review"
                  value={ghDirectory}
                  onChange={(e) => setGhDirectory(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">Personal Access Token (私有仓库必填)</label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
              <p className="text-[10px] text-ink-soft">Token 仅保存在本地设备，用于向 GitHub API 请求读取 SKILL.md。</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
