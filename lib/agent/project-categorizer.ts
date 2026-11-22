/**
 * Smart Project Categorization & Taxonomy Heuristics Engine.
 * Adheres to docs/technical/yggit-project-categorization-and-governance.md §4
 */

import type { GitProjectView } from '@/lib/git/types'

export interface GroupingMoveAction {
  projectId: string
  projectName: string
  currentGroup: string
  targetGroup: string
  reason: string
}

export interface ProjectGroupingPlan {
  version: 1
  createdAt: number
  sourceGroupName: string
  totalProjects: number
  newGroupsToCreate: string[]
  actions: GroupingMoveAction[]
}

/**
 * Categorize a single project into an optimal architectural / business group.
 */
export function determineTargetGroup(project: GitProjectView): { targetGroup: string; reason: string } {
  const path = (project.localPath || '').toLowerCase()
  const url = (project.httpsUrl || '').toLowerCase()
  const name = (project.name || '').toLowerCase()

  // 1. Worktrees and playground environments
  if (path.includes('/worktree/') || path.includes('/tmp/') || name === 'test' || name.startsWith('test-') || name.startsWith('mock-')) {
    return {
      targetGroup: '独立工作树与实验',
      reason: '匹配到独立 Worktree 目录或临时实验环境',
    }
  }

  // 2. Infrastructure, DevOps, and Platform services
  if (
    path.includes('/develop/ops/') ||
    url.includes('yggit') ||
    name === 'yggdrasil' ||
    name.includes('server') ||
    name.includes('screenshot') ||
    name.includes('runner') ||
    name.includes('infra') ||
    name.includes('gateway')
  ) {
    return {
      targetGroup: '基础架构与运维',
      reason: '匹配到运维自动化、服务网关或平台基础设施',
    }
  }

  // 3. Backend Microservices & APIs
  if (
    path.includes('/develop/sl-backend/') ||
    url.includes('/backend/') ||
    name.endsWith('-api') ||
    name.endsWith('-bff') ||
    name.endsWith('-service') ||
    name.endsWith('-grpc') ||
    name === 'admin'
  ) {
    return {
      targetGroup: 'Shopline / 后端微服务',
      reason: '匹配到后端接口、BFF 架构或微服务模块',
    }
  }

  // 4. Frontend Applications & Editors
  if (
    path.includes('/develop/sl/') &&
    (name.endsWith('-editor') || name.endsWith('-admin') || name.includes('landing-page') || name.includes('cloudframe') || name.includes('layout'))
  ) {
    return {
      targetGroup: 'Shopline / 前端应用与编辑器',
      reason: '匹配到前端管理后台、画布编辑器或独立应用',
    }
  }

  // 5. Frontend Plugins, Components & Libraries
  if (name.includes('plugin') || name.includes('component') || name.includes('library') || name.includes('sdk') || url.includes('/frontend/') || path.includes('/develop/sl/')) {
    return {
      targetGroup: 'Shopline / 插件与扩展组件',
      reason: '匹配到扩展插件、公共组件库或前端依赖模块',
    }
  }

  // 6. Generic path fallback
  if (project.localPath) {
    const segments = project.localPath.split('/').filter(Boolean)
    if (segments.length >= 2) {
      const parentDir = segments[segments.length - 2]
      if (parentDir && parentDir !== 'Develop' && parentDir !== 'develop') {
        return {
          targetGroup: `项目 / ${parentDir}`,
          reason: `根据物理父级目录 [${parentDir}] 进行归类`,
        }
      }
    }
  }

  return {
    targetGroup: '其他项目',
    reason: '通用项目归档',
  }
}

/**
 * Classify a collection of projects and produce a deterministic ProjectGroupingPlan.
 */
export function classifyProjects(projects: GitProjectView[], targetSourceGroup?: string): ProjectGroupingPlan {
  const normalizedSource = (targetSourceGroup || '').trim()
  const candidateProjects = normalizedSource ? projects.filter((p) => (p.group || '个人项目') === normalizedSource) : projects

  const actions: GroupingMoveAction[] = []
  const groupSet = new Set<string>()

  for (const project of candidateProjects) {
    const currentGroup = project.group || '个人项目'
    const { targetGroup, reason } = determineTargetGroup(project)

    // Only move if target group is different
    if (currentGroup !== targetGroup) {
      actions.push({
        projectId: project.id,
        projectName: project.name,
        currentGroup,
        targetGroup,
        reason,
      })
      groupSet.add(targetGroup)
    }
  }

  return {
    version: 1,
    createdAt: Date.now(),
    sourceGroupName: normalizedSource || 'all',
    totalProjects: candidateProjects.length,
    newGroupsToCreate: Array.from(groupSet).sort(),
    actions,
  }
}
