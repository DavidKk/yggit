'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { LuBookOpen, LuCheck, LuClock, LuCode, LuEye, LuFolderOpen, LuGithub, LuPlus, LuRefreshCw, LuSparkles, LuTrash2 } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { useModeHref } from '@/lib/git/driver'
import { parseSkillMarkdown } from '@/lib/skills/parser'
import { checkAndUpdateGitHubSkill, discoverSkillsFromGitHub } from '@/lib/skills/providers/github-provider'
import { deleteSkill, listSkills, saveSkill, toggleSkill } from '@/lib/skills/storage'
import type { SkillDescriptor } from '@/lib/skills/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'
import { SkillMarkdownEditor, SkillMarkdownPreview } from './SkillMarkdownEditor'

interface SkillEditorProps {
  skillId: string
}

export function SkillEditor({ skillId }: SkillEditorProps) {
  const t = useT()
  const router = useRouter()
  const modeHref = useModeHref()
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
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview')

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
    router.replace(modeHref('/settings/skills'))
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
      notify.success(t('gitAgent.skillParsed', { name: file.name }) || `Parsed ${file.name}`)
    } catch {
      notify.error(t('gitAgent.skillReadFailed') || 'Failed to read SKILL.md file')
    }
  }

  // Save new local skill
  const handleSaveLocalSkill = async () => {
    if (!localContent.trim()) {
      notify.error(t('gitAgent.skillContentRequired') || 'Please enter SKILL.md content')
      return
    }
    const parsed = parseSkillMarkdown(localContent)
    const finalName = localName.trim() || parsed.name || 'Custom Skill'
    const finalDesc = localDesc.trim() || parsed.description || 'Custom workflow guide'
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
    notify.success(t('gitAgent.skillAdded', { name: finalName }) || `Added skill "${finalName}"`)
    router.replace(modeHref('/settings/skills'))
  }

  // Import GitHub skill
  const handleImportGitHubSkill = async () => {
    if (!ghRepo.trim()) {
      notify.error(t('gitAgent.skillRepoRequired') || 'Please enter GitHub repository path (e.g. owner/repo)')
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
        notify.warning(t('gitAgent.skillNoneFound') || 'No valid SKILL.md file found in the specified path')
        return
      }

      for (const s of results) {
        await saveSkill(s)
      }
      notify.success(t('gitAgent.skillImported', { count: results.length }) || `Successfully imported ${results.length} GitHub skills`)
      router.replace(modeHref('/settings/skills'))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t('gitAgent.skillImportFailed') || 'Failed to import skill from GitHub')
    } finally {
      setGhFetching(false)
    }
  }

  // Toggle existing skill status
  const handleToggle = async () => {
    if (!skill) return
    await toggleSkill(skill.id, !skill.enabled)
    setSkill({ ...skill, enabled: !skill.enabled })
    notify.success(skill.enabled ? t('gitAgent.skillDisabled') || 'Skill disabled' : t('gitAgent.skillEnabled') || 'Skill enabled')
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
        notify.success(t('gitAgent.skillUpdated') || 'GitHub skill updated to latest version')
      } else {
        notify.info(t('gitAgent.skillUpToDate') || 'Current skill is already up to date')
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t('gitAgent.skillUpdateFailed') || 'Failed to check for updates')
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
    notify.success(t('gitAgent.skillSaved') || 'Skill content saved')
  }

  // Delete skill
  const handleDelete = () => {
    if (!skill) return
    confirm({
      title: 'Remove Skill',
      description: `Are you sure you want to remove skill "${skill.name}"? This action cannot be undone.`,
      confirmLabel: 'Remove',
      confirmVariant: 'fail',
      onConfirm: async () => {
        try {
          await deleteSkill(skill.id)
          notify.success(t('gitAgent.skillRemoved') || 'Skill removed')
          router.replace(modeHref('/settings/skills'))
        } catch (err) {
          notify.error(err instanceof Error ? err.message : 'Failed to remove skill')
          throw err
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-ink-soft">
        <LuRefreshCw className="size-4 animate-spin mr-2 text-accent" />
        <span>Loading skill configuration…</span>
      </div>
    )
  }

  if (!isNew && !skill) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
        <LuBookOpen className="size-8 text-ink-soft/40 mb-2" />
        <div className="text-xs font-semibold text-ink">Skill not found</div>
        <p className="text-[11px] text-ink-soft max-w-sm mt-1">This skill may have been removed or the ID does not exist.</p>
        <Button variant="default" onClick={handleBack} className="mt-3">
          Back
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
              <span>New Agent Skill</span>
            </div>
          }
          description="Follows the open Agent Skills specification (SKILL.md). Import a local file or link a Skill from a GitHub repository."
          titleAction={
            <Button variant="plain" size="sm" onClick={handleBack}>
              Back
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
              <span>Import Local SKILL.md</span>
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
              <span>Link GitHub Repository</span>
            </button>
          </div>

          {/* Local Tab Form */}
          {activeTab === 'local' && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center justify-between p-3 rounded-lg bg-paper-2 border border-line">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-ink">Quick Load Local File</span>
                  <span className="text-[11px] text-ink-soft">Choose an existing SKILL.md file to auto-fill the form</span>
                </div>
                <input ref={fileInputRef} type="file" accept=".md,text/markdown" onChange={(e) => void handleLocalFileSelect(e)} className="hidden" />
                <Button variant="default" onClick={() => fileInputRef.current?.click()}>
                  <LuFolderOpen className="size-3.5 mr-1" />
                  <span>Choose File</span>
                </Button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Skill Name (optional, defaults to frontmatter metadata)</label>
                <input
                  type="text"
                  placeholder="e.g. Go Concurrency Review"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Skill Description (optional, defaults to frontmatter metadata)</label>
                <input
                  type="text"
                  placeholder="Briefly describe the tasks and domain expertise for this skill"
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">SKILL.md Specification & Instructions</label>
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
                  Cancel
                </Button>
                <Button variant="accent" onClick={() => void handleSaveLocalSkill()}>
                  <LuPlus className="size-3.5 mr-1" />
                  <span>Save</span>
                </Button>
              </div>
            </div>
          )}

          {/* GitHub Tab Form */}
          {activeTab === 'github' && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">GitHub Repository Path (owner/repo)</label>
                <input
                  type="text"
                  placeholder="e.g. octocat/agent-skills"
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-ink">Branch Name</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={ghBranch}
                    onChange={(e) => setGhBranch(e.target.value)}
                    className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-ink">Skills Directory Path (optional)</label>
                  <input
                    type="text"
                    placeholder="Leave empty to recursively scan all SKILL.md files"
                    value={ghDirectory}
                    onChange={(e) => setGhDirectory(e.target.value)}
                    className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Personal Access Token (optional, required for private repos)</label>
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
                  Cancel
                </Button>
                <Button variant="accent" loading={ghFetching} onClick={() => void handleImportGitHubSkill()}>
                  <LuCheck className="size-3.5 mr-1" />
                  <span>Import</span>
                </Button>
              </div>
            </div>
          )}
        </SettingsSectionCard>
      </div>
    )
  }

  // 2. Existing Skill Detail & Configuration Subpage (Single Merged Card)
  const isBuiltin = skill?.source.type === 'builtin'
  const isGitHub = skill?.source.type === 'github'
  const activeContent = isBuiltin ? skill?.content || '' : editedContent

  return (
    <div className="flex flex-col gap-3">
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <span>{skill?.name}</span>
            <Badge tone={isBuiltin ? 'info' : isGitHub ? 'accent' : 'neutral'} size="mini">
              {isBuiltin ? 'Built-in' : isGitHub ? 'GitHub' : 'Local'}
            </Badge>
          </div>
        }
        description={skill?.description}
        titleAction={
          <SwitchToggle
            checked={skill?.enabled ?? true}
            onCheckedChange={() => void handleToggle()}
            size="sm"
            tooltip={skill?.enabled ? 'Disable skill' : 'Enable skill'}
            aria-label={`Toggle ${skill?.name}`}
          />
        }
      >
        <div className="flex flex-col gap-3">
          {/* View mode switcher (Preview / Code) + GitHub sync button */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-md border border-line bg-paper-2 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  viewMode === 'preview' ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
                )}
              >
                <LuEye className="size-3.5" aria-hidden="true" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  viewMode === 'code' ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
                )}
              >
                <LuCode className="size-3.5" aria-hidden="true" />
                <span>Code</span>
              </button>
            </div>

            {isGitHub && (
              <Button
                variant="default"
                size="sm"
                disabled={isUpdating}
                loading={isUpdating}
                onClick={() => void handleCheckUpdate()}
                title="Check and sync latest version from GitHub"
              >
                <LuRefreshCw className={cn('size-3.5 mr-1', isUpdating && 'animate-spin')} />
                <span>Check for Updates</span>
              </Button>
            )}
          </div>

          {/* Unboxed Preview or Highlighted Code Editor */}
          {viewMode === 'preview' ? (
            <SkillMarkdownPreview value={activeContent} />
          ) : (
            <SkillMarkdownEditor value={activeContent} onChange={isBuiltin ? undefined : setEditedContent} readOnly={isBuiltin} height={420} />
          )}

          {/* Clean bottom footer for Source, UpdatedAt & custom skill actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft">
              <span className="inline-flex items-center gap-1 font-mono">
                {isGitHub ? <LuGithub className="size-3 shrink-0" aria-hidden="true" /> : <LuFolderOpen className="size-3 shrink-0" aria-hidden="true" />}
                <span>Source: {skill?.source.uri}</span>
                {skill?.source.branch && <span className="text-ink-soft/70">({skill.source.branch})</span>}
                {skill?.commitSha && <span className="text-ink-soft/70">@{skill.commitSha.slice(0, 7)}</span>}
              </span>
              {skill?.updatedAt && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <LuClock className="size-3 shrink-0" aria-hidden="true" />
                  <span>Updated: {new Date(skill.updatedAt).toLocaleString()}</span>
                </span>
              )}
            </div>

            {!isBuiltin && (
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline-fail" onClick={handleDelete}>
                  <LuTrash2 className="size-3.5 mr-1" />
                  <span>Delete</span>
                </Button>
                <Button variant="accent" onClick={() => void handleSaveContentEdit()}>
                  <LuCheck className="size-3.5 mr-1" />
                  <span>Save</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
