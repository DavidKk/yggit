import type { SpotlightTarget } from '@/services/git/agent-impact'

import type { AgentToolDefinition } from './types'

/**
 * Tool definitions exposed to the agent LLM.
 */
export const AGENT_GIT_TOOLS: AgentToolDefinition[] = [
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
]

export interface ToolExecutionResponse {
  ok: boolean
  result: unknown
  spotlightTargets?: SpotlightTarget[]
}

/**
 * Executes a tool called by the LLM.
 */
export async function executeAgentTool(toolName: string, args: Record<string, unknown>, repo?: string): Promise<ToolExecutionResponse> {
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
