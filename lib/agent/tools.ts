import { getGitDriver } from '@/lib/git/driver'
import { projectOpenTarget } from '@/lib/git/project-access'
import type { GitProjectView } from '@/lib/git/types'
import type { SpotlightTarget } from '@/services/git/agent-impact'

import type { AgentCodeAnnotation } from './spotlight-context'
import type { AgentToolDefinition } from './types'

/**
 * Tool definitions exposed to the agent LLM.
 */
export const AGENT_GIT_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'focus_branch',
      description:
        'Focus and jump the visual Git graph view to a specific branch (e.g. "feat/agent-system", "master", "main"). In Yggdrasil, when a user asks to "跳转到/切换到/定位到/选中某分支", they mean focusing and jumping the visual Git graph to that branch\'s latest commit, NOT running git checkout on the local disk. ALWAYS call this tool for requests like "帮我跳转到 xxx", "切换到 xxx 分支", "定位分支 xxx", etc.',
      parameters: {
        type: 'object',
        properties: {
          branchName: {
            type: 'string',
            description: 'The name of the branch to jump to (e.g. "feat/agent-system", "master", "develop")',
          },
        },
        required: ['branchName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unmerged_branches',
      description:
        'Get all branches that have not been merged into a target base branch (e.g. "master" or "main"). Returns the total unmerged branch count, list of unmerged branches, number of unmerged commits ahead, latest commit details, and graph spotlight targets.',
      parameters: {
        type: 'object',
        properties: {
          targetBranch: {
            type: 'string',
            description: 'The target base branch to check against, e.g. "master", "MASTER", or "main". If omitted, defaults to "master" or the repository default branch.',
          },
          includeRemote: {
            type: 'boolean',
            description: 'Whether to include remote-tracking branches in the unmerged branch check. Defaults to true.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_branches',
      description: 'Get all Git branches in the repository, including branch count, local branches, remote branches, and the currently checked out branch.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_repo_summary',
      description: 'Get a quick summary of the Git repository: current branch, total commit count, branch count, latest commit info, and working tree cleanliness.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_branch_containment',
      description: 'Verify if commits from a source branch have been merged into a target branch, or check if a feature branch is polluted with commits from an unwanted branch.',
      parameters: {
        type: 'object',
        properties: {
          sourceBranch: {
            type: 'string',
            description: 'The source branch name, e.g. "feature/xyz" or "TEST"',
          },
          targetBranch: {
            type: 'string',
            description: 'The target branch name, e.g. "main" or "master"',
          },
        },
        required: ['sourceBranch', 'targetBranch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_today_merges',
      description: 'Get all merge commits created today (or since a specific time) with their commit details.',
      parameters: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'Time string like "midnight", "yesterday", or "24 hours ago". Defaults to "midnight".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_commits',
      description: 'Find commits by commit message keyword, author name, or date range.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keyword to search for in commit messages',
          },
          author: {
            type: 'string',
            description: 'Author name or email pattern',
          },
          since: {
            type: 'string',
            description: 'Time filter, e.g. "3 days ago", "1 week ago"',
          },
          maxCount: {
            type: 'number',
            description: 'Maximum number of commits to return (default 20)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_commit_details',
      description: 'Get details of a specific commit: author, full message, date, and list of changed files.',
      parameters: {
        type: 'object',
        properties: {
          commitHash: {
            type: 'string',
            description: 'Full or abbreviated Git commit hash',
          },
        },
        required: ['commitHash'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spotlight_commits',
      description: 'Highlight and spotlight specific commits in the Git Graph view, dimming irrelevant commits and focusing the user on relevant nodes.',
      parameters: {
        type: 'object',
        properties: {
          targets: {
            type: 'array',
            description: 'List of commit hashes and reasons to highlight in the graph',
            items: {
              type: 'object',
              properties: {
                hash: { type: 'string', description: 'Commit hash' },
                role: {
                  type: 'string',
                  enum: ['primary', 'related', 'candidate'],
                  description: 'Spotlight role',
                },
                evidenceGrade: {
                  type: 'string',
                  enum: ['Fact', 'Derived', 'Hypothesis'],
                  description: 'Evidence confidence grade',
                },
                reason: { type: 'string', description: 'Reason for highlighting' },
              },
              required: ['hash', 'role', 'reason'],
            },
          },
        },
        required: ['targets'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_code_issue',
      description:
        'Quickly jump to a file and highlight a specific line or code range with an Agent diagnostic review note. Use this to pinpoint code issues, show that a change already exists in another commit, point out bugs or logic flaws directly to the developer in the code diff or file viewer.',
      parameters: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'The relative file path to view and highlight (e.g. "w.txt" or "market/internal/domain/market_config_change_event.go")',
          },
          startLine: {
            type: 'number',
            description: 'The 1-based line number to mark',
          },
          endLine: {
            type: 'number',
            description: 'Optional 1-based end line number for multi-line ranges',
          },
          commitHash: {
            type: 'string',
            description: 'Optional commit hash where this change or issue is located',
          },
          title: {
            type: 'string',
            description: 'Short title for the finding (e.g. "改动已存在提示" or "代码重复风险")',
          },
          message: {
            type: 'string',
            description: 'The developer-like diagnostic finding and explanation to show directly on the line',
          },
        },
        required: ['file', 'startLine', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_ui',
      description:
        'Navigate to an application page or open a specific UI panel when the user asks to open settings, switch views, or inspect a section of Yggdrasil (e.g. "帮我打开设置", "打开设置页", "进入模型设置", "打开隐私脱敏设置", "打开通用设置", "打开右键菜单设置", "打开工作区", "打开提交面板", "打开冲突处理", "查看工作树").',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: [
              'settings_models_new',
              'settings_models',
              'settings_privacy',
              'settings_general',
              'settings_menus',
              'panel_commit',
              'panel_conflicts',
              'panel_worktree',
              'panel_branches',
              'panel_stash',
              'panel_tags',
              'git_home',
            ],
            description:
              'The page or panel destination: "settings_models_new" (新增模型接入界面，当用户说"接入新模型"、"新增模型"、"接入CHATGPT/OPENAI/CLAUDE模型"时调用此目标), "settings_models" (模型接入与配置设置列表), "settings_privacy" (隐私与脱敏设置), "settings_general" (通用设置), "settings_menus" (右键菜单设置), "panel_commit" (工作区/未提交改动/提交面板), "panel_conflicts" (三向合并冲突解决面板), "panel_worktree" (Worktree 工作树管理), "panel_branches" (分支面板), "panel_stash" (Stash 暂存记录), "git_home" (仓库首页). Default is "settings_models" for general settings requests.',
          },
          reason: {
            type: 'string',
            description: 'Brief reason or explanation for navigating, e.g. "打开模型接入设置"',
          },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_project',
      description:
        'Open or switch to a registered repository/project in Yggdrasil by its name, folder path, or ID (e.g. "test", "admin", "/Users/davidjones/Develop/worktree/test"). ALWAYS call this tool when the user asks "帮我打开 xxx 项目", "切换到 xxx 项目", "打开项目 xxx", "进入 xxx 仓库", etc.',
      parameters: {
        type: 'object',
        properties: {
          nameOrPath: {
            type: 'string',
            description: 'The name, folder path, or ID of the registered project to open (e.g. "test", "admin").',
          },
        },
        required: ['nameOrPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description:
        'List all registered repositories/projects in Yggdrasil, showing their names, paths, groups, and remote/local status. Call this tool when the user asks "有哪些项目", "列出所有项目", or when finding the exact project name before opening it.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_ui_theme',
      description:
        'Switch application appearance theme between automatic (following system), light mode, or dark mode. Call this tool when the user asks "切换深色模式", "切浅色模式", "切换为系统主题", "暗黑模式", etc.',
      parameters: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            enum: ['auto', 'light', 'dark'],
            description: 'Theme preference: "auto" (跟随系统), "light" (浅色模式), "dark" (深色模式)',
          },
        },
        required: ['theme'],
      },
    },
  },
]

export interface ToolExecutionResponse {
  ok: boolean
  result: unknown
  spotlightTargets?: SpotlightTarget[]
  codeAnnotation?: AgentCodeAnnotation
  uiNavigation?: {
    target: string
    reason?: string
  }
  projectNavigation?: {
    project: GitProjectView
    target: string
    url: string
  }
  uiPreference?: {
    type: 'theme'
    value: string
  }
}

async function getCatalogProjects(): Promise<GitProjectView[]> {
  try {
    if (typeof window === 'undefined') {
      const { listGitCatalog } = await import('@/services/git/projects')
      const catalog = listGitCatalog()
      return catalog.projects || []
    }
    const driver = getGitDriver()
    const catalog = await driver.getProjects()
    return catalog.projects || []
  } catch {
    return []
  }
}

/**
 * Executes a tool called by the LLM.
 */
export async function executeAgentTool(toolName: string, args: Record<string, unknown>, repo?: string): Promise<ToolExecutionResponse> {
  // If the tool is client-side UI navigation:
  if (toolName === 'navigate_ui') {
    const target = String(args.target || 'settings_models')
    const reason = args.reason ? String(args.reason) : '打开对应页面'
    return {
      ok: true,
      result: {
        message: `已为您打开界面: ${target}`,
        target,
        reason,
      },
      uiNavigation: {
        target,
        reason,
      },
    }
  }

  // Open or switch to a project:
  if (toolName === 'open_project') {
    const needle = String(args.nameOrPath || '')
      .trim()
      .toLowerCase()
    if (!needle) {
      return {
        ok: false,
        result: { error: '请提供要打开的项目名称或路径' },
      }
    }
    try {
      const projects = await getCatalogProjects()

      // 1. Exact match by name / id / localPath
      let matched = projects.find((p) => p.name.toLowerCase() === needle || p.id.toLowerCase() === needle || (p.localPath && p.localPath.toLowerCase() === needle))
      // 2. Substring match
      if (!matched) {
        matched = projects.find((p) => p.name.toLowerCase().includes(needle) || (p.localPath && p.localPath.toLowerCase().includes(needle)))
      }

      if (!matched) {
        return {
          ok: false,
          result: {
            error: `未找到匹配 "${args.nameOrPath}" 的项目。当前已注册的项目有: ${projects.map((p) => p.name).join(', ') || '暂无'}`,
            availableProjects: projects.map((p) => ({ id: p.id, name: p.name, localPath: p.localPath })),
          },
        }
      }

      const target = projectOpenTarget(matched) || matched.localPath || matched.httpsUrl || ''
      const url = `/git/l_${matched.id}`

      return {
        ok: true,
        result: {
          message: `已为您打开项目 "${matched.name}"`,
          project: {
            id: matched.id,
            name: matched.name,
            group: matched.group,
            localPath: matched.localPath,
            target,
            url,
          },
        },
        projectNavigation: {
          project: matched,
          target,
          url,
        },
      }
    } catch (err) {
      return {
        ok: false,
        result: { error: err instanceof Error ? err.message : '打开项目失败' },
      }
    }
  }

  // List all registered projects:
  if (toolName === 'list_projects') {
    try {
      const projectsList = await getCatalogProjects()
      const projects = projectsList.map((p) => ({
        id: p.id,
        name: p.name,
        group: p.group || '未分组',
        localPath: p.localPath || '',
        httpsUrl: p.httpsUrl || '',
        isLocal: Boolean(p.localPath),
      }))
      return {
        ok: true,
        result: {
          total: projects.length,
          projects,
        },
      }
    } catch (err) {
      return {
        ok: false,
        result: { error: err instanceof Error ? err.message : '获取项目列表失败' },
      }
    }
  }

  // Switch UI theme:
  if (toolName === 'set_ui_theme') {
    const theme = String(args.theme || 'auto') as 'auto' | 'light' | 'dark'
    return {
      ok: true,
      result: {
        message: `已将应用外观切换为: ${theme === 'auto' ? '自动（跟随系统）' : theme === 'light' ? '浅色模式' : '深色模式'}`,
        theme,
      },
      uiPreference: {
        type: 'theme',
        value: theme,
      },
    }
  }
  // If the tool is client-side code issue annotation:
  if (toolName === 'inspect_code_issue') {
    const annotation: AgentCodeAnnotation = {
      file: String(args.file || ''),
      startLine: Number(args.startLine) || 1,
      endLine: args.endLine ? Number(args.endLine) : undefined,
      commitHash: args.commitHash ? String(args.commitHash) : undefined,
      title: args.title ? String(args.title) : undefined,
      message: String(args.message || ''),
      severity: 'agent',
      author: 'Git Agent',
    }
    return {
      ok: true,
      result: {
        message: `Agent marked line ${annotation.startLine} in ${annotation.file}: ${annotation.message}`,
        annotation,
      },
      codeAnnotation: annotation,
    }
  }

  // If the tool is client-side graph highlighting:
  if (toolName === 'spotlight_commits') {
    const targets = (args.targets as SpotlightTarget[]) || []
    return {
      ok: true,
      result: { message: `Spotlighted ${targets.length} commits in graph`, count: targets.length },
      spotlightTargets: targets,
    }
  }

  // Otherwise, call backend tool dispatcher
  try {
    const res = await fetch('/api/git/agent/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: toolName,
        args,
        repo,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => null)
      return {
        ok: false,
        result: err?.error?.message || `Tool call failed (${res.status})`,
      }
    }

    const data = await res.json()
    // If the data returned spotlight targets, include them
    const spotlightTargets = Array.isArray(data.spotlightTargets) ? (data.spotlightTargets as SpotlightTarget[]) : undefined

    return {
      ok: true,
      result: data,
      spotlightTargets,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tool execution error'
    return {
      ok: false,
      result: msg,
    }
  }
}
