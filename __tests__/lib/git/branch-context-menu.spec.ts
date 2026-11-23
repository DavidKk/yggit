/** @jest-environment jsdom */
import { buildBranchContextMenu, stripRemotePrefix } from '@/lib/git/branch-context-menu'
import { DEFAULT_CONTEXT_MENU_CONFIG, loadContextMenuConfig, saveContextMenuConfig } from '@/lib/git/context-menu-config'
import type { GitCommit } from '@/lib/git/types'

describe('branch context menu & config', () => {
  const mockCommit: GitCommit = {
    hash: '3beed2f5b98ee099d1598aa6a59be65141d956cd',
    short: '3beed2f',
    subject: 'feat(git): add customizable context menu',
    author: 'DavidJones',
    date: '2026-11-17',
    parents: ['1234567'],
    refs: [],
  }

  beforeEach(() => {
    localStorage.clear()
  })

  describe('context-menu-config persistence', () => {
    it('returns default configuration when storage is empty', () => {
      const config = loadContextMenuConfig()
      expect(config.quickActions).toContain('checkout-branch')
      expect(config.quickActions).toContain('merge-branch')
      expect(config.quickActions).toContain('rebase-branch')
      expect(config.enabledGroups.copy).toBe(true)
      expect(config.enabledGroups.branch).toBe(true)
      expect(config.dangerConfirm).toBe(true)
      expect(config.hideUnavailableCapabilities).toBe(true)
      expect(config.agentActions.length).toBeGreaterThanOrEqual(1)
    })

    it('saves and reloads custom configuration', () => {
      const customConfig = {
        ...DEFAULT_CONTEXT_MENU_CONFIG,
        quickActions: ['copy-hash', 'checkout-branch'],
        dangerConfirm: false,
      }
      saveContextMenuConfig(customConfig)
      const loaded = loadContextMenuConfig()
      expect(loaded.quickActions).toEqual(['copy-hash', 'checkout-branch'])
      expect(loaded.dangerConfirm).toBe(false)
    })
  })

  describe('buildBranchContextMenu', () => {
    it('builds compact main menu with ~4-5 top entries', () => {
      const items = buildBranchContextMenu({
        branchName: 'feat/test',
        commit: mockCommit,
        repo: 'owner/repo',
        remoteUrl: 'https://github.com/owner/repo.git',
        hasWorktrees: true,
        isReadOnly: false,
        config: DEFAULT_CONTEXT_MENU_CONFIG,
      })

      // Pinned quick actions (checkout, merge, rebase, new) + Submenus (Branch, Commit, View, Copy, Worktree) + Remote + Quotes
      expect(items.length).toBeLessThanOrEqual(14)

      const quoteBranch = items.find((i) => i.key === 'quote-branch-to-agent')
      expect(quoteBranch).toBeDefined()

      const copyGroup = items.find((i) => i.key === 'menu-copy-group')
      expect(copyGroup).toBeDefined()
      expect(copyGroup?.children?.length).toBeGreaterThanOrEqual(4)

      const branchGroup = items.find((i) => i.key === 'menu-branch-group')
      expect(branchGroup).toBeDefined()
      expect(branchGroup?.children?.some((c) => c.key === 'checkout-branch')).toBe(true)
      expect(branchGroup?.children?.some((c) => c.key === 'delete-branch')).toBe(true)

      const worktreeGroup = items.find((i) => i.key === 'menu-worktree-group')
      expect(worktreeGroup).toBeDefined()

      const remoteItem = items.find((i) => i.key === 'open-remote')
      expect(remoteItem).toBeDefined()
    })

    it('groups quick actions and quote agent together, then separates secondary submenus with dividers', () => {
      const items = buildBranchContextMenu({
        target: 'commit',
        commit: mockCommit,
        branchName: 'hotfix/test',
        repo: 'owner/repo',
        remoteUrl: 'https://github.com/owner/repo.git',
        hasWorktrees: true,
        config: DEFAULT_CONTEXT_MENU_CONFIG,
      })

      const quoteIndex = items.findIndex((i) => i.key === 'quote-commit-to-agent')
      expect(quoteIndex).toBeGreaterThan(0)
      // Quote action should NOT have dividerBefore (belongs to same quick action group)
      expect(items[quoteIndex].dividerBefore).toBeFalsy()

      // The first item right after quote action should be the first secondary submenu and HAVE dividerBefore
      const firstSecondary = items[quoteIndex + 1]
      expect(firstSecondary).toBeDefined()
      expect(firstSecondary.key).toBe('menu-branch-group')
      expect(firstSecondary.dividerBefore).toBe(true)

      // The next Git secondary submenu (menu-commit-group) should not duplicate divider
      const commitSubmenu = items.find((i) => i.key === 'menu-commit-group')
      expect(commitSubmenu?.dividerBefore).toBeFalsy()

      // The copy group begins the next secondary set and should have dividerBefore
      const copyGroup = items.find((i) => i.key === 'menu-copy-group')
      expect(copyGroup?.dividerBefore).toBe(true)
    })

    it('places dangerous operations at the bottom of branch submenu with confirmation requirements', () => {
      const items = buildBranchContextMenu({
        branchName: 'feat/danger',
        commit: mockCommit,
        config: {
          ...DEFAULT_CONTEXT_MENU_CONFIG,
          dangerConfirm: true,
        },
      })

      const branchGroup = items.find((i) => i.key === 'menu-branch-group')
      const children = branchGroup?.children || []
      const deleteAction = children[children.length - 1]

      expect(deleteAction.key).toBe('delete-branch')
      expect(deleteAction.danger).toBe(true)
      expect(deleteAction.needsConfirm).toBe(true)
      expect(deleteAction.confirmText).toBe('确定删除此分支？再次点击执行')
    })

    it('dynamically hides mutating operations in read-only mode', () => {
      const items = buildBranchContextMenu({
        branchName: 'feat/test',
        commit: mockCommit,
        isReadOnly: true,
        config: {
          ...DEFAULT_CONTEXT_MENU_CONFIG,
          hideUnavailableCapabilities: true,
        },
      })

      // Mutating branch group must be hidden in read-only mode
      const branchGroup = items.find((i) => i.key === 'menu-branch-group')
      expect(branchGroup).toBeUndefined()
    })

    it('dynamically hides worktree operations when worktrees are not supported', () => {
      const items = buildBranchContextMenu({
        branchName: 'feat/test',
        commit: mockCommit,
        hasWorktrees: false,
        config: {
          ...DEFAULT_CONTEXT_MENU_CONFIG,
          hideUnavailableCapabilities: true,
        },
      })

      const worktreeGroup = items.find((i) => i.key === 'menu-worktree-group')
      expect(worktreeGroup).toBeUndefined()
    })

    it('invokes onAgentPrompt with target repository, branch, and commit context', () => {
      const onAgentPrompt = jest.fn()
      const items = buildBranchContextMenu({
        branchName: 'feat/ai-test',
        commit: mockCommit,
        repo: 'owner/repo',
        config: {
          ...DEFAULT_CONTEXT_MENU_CONFIG,
          agentActions: [
            {
              id: 'custom-action',
              label: 'AI 总结变更',
              prompt: '总结改动要点',
              enabled: true,
            },
          ],
        },
        onAgentPrompt,
      })

      const agentGroup = items.find((i) => i.key === 'menu-agent-group')
      expect(agentGroup).toBeDefined()
      const customAction = agentGroup?.children?.find((c) => c.key === 'custom-action')
      expect(customAction).toBeDefined()

      customAction?.onSelect?.()
      expect(onAgentPrompt).toHaveBeenCalledWith(expect.stringContaining('feat/ai-test'))
      expect(onAgentPrompt).toHaveBeenCalledWith(expect.stringContaining('3beed2f'))
    })

    it('handles SOLO branch entry and toggles correctly', () => {
      const onSoloBranch = jest.fn()
      // Inactive solo mode
      const items = buildBranchContextMenu({
        branchName: 'feature/solo-test',
        commit: mockCommit,
        repo: 'owner/repo',
        config: DEFAULT_CONTEXT_MENU_CONFIG,
        soloBranch: null,
        onSoloBranch,
      })

      const soloItem = items.find((i) => i.key === 'solo-branch')
      expect(soloItem).toBeDefined()
      expect(soloItem?.label).toBe('只看此分支')
      expect(soloItem?.checked).toBe(false)

      soloItem?.onSelect?.()
      expect(onSoloBranch).toHaveBeenCalledWith('feature/solo-test')

      // Active solo mode on same branch
      const activeItems = buildBranchContextMenu({
        branchName: 'feature/solo-test',
        commit: mockCommit,
        repo: 'owner/repo',
        config: DEFAULT_CONTEXT_MENU_CONFIG,
        soloBranch: 'feature/solo-test',
        onSoloBranch,
      })

      const activeSoloItem = activeItems.find((i) => i.key === 'solo-branch')
      expect(activeSoloItem).toBeDefined()
      expect(activeSoloItem?.label).toBe('取消只看')
      expect(activeSoloItem?.checked).toBe(true)

      activeSoloItem?.onSelect?.()
      expect(onSoloBranch).toHaveBeenCalledWith(null)
    })

    describe('branch name copying & remote prefix handling', () => {
      it('correctly strips remote prefix while preserving multi-part category branches', () => {
        expect(stripRemotePrefix('origin/hotfix/section-renderer-v1.261121.2')).toBe('hotfix/section-renderer-v1.261121.2')
        expect(stripRemotePrefix('upstream/feature/JZY-3104/subscription-qrpc')).toBe('feature/JZY-3104/subscription-qrpc')
        expect(stripRemotePrefix('hotfix/section-renderer-v1.261121.2')).toBe('hotfix/section-renderer-v1.261121.2')
        expect(stripRemotePrefix('my-remote/hotfix/issue', ['my-remote'])).toBe('hotfix/issue')
        expect(stripRemotePrefix('origin/main')).toBe('main')
      })

      it('does NOT strip category prefixes for local branches', () => {
        const items = buildBranchContextMenu({
          branchName: 'hotfix/section-renderer-v1.261121.2',
          commit: mockCommit,
          isRemote: false,
          config: DEFAULT_CONTEXT_MENU_CONFIG,
        })
        const copyGroup = items.find((i) => i.key === 'menu-copy-group')
        const copyBranch = copyGroup?.children?.find((c) => c.key === 'copy-branch')
        expect(copyBranch).toBeDefined()
        expect(copyBranch?.label).toContain('hotfix/section-renderer-v1.261121.2')
      })

      it('preserves category prefixes when remote branch label is already stripped of remote', () => {
        const items = buildBranchContextMenu({
          branchName: 'hotfix/section-renderer-v1.261121.2',
          rawBranchName: 'origin/hotfix/section-renderer-v1.261121.2',
          commit: mockCommit,
          isRemote: true,
          remoteNames: ['origin'],
          config: DEFAULT_CONTEXT_MENU_CONFIG,
        })
        const copyGroup = items.find((i) => i.key === 'menu-copy-group')
        const copyBranch = copyGroup?.children?.find((c) => c.key === 'copy-branch')
        expect(copyBranch).toBeDefined()
        expect(copyBranch?.label).toContain('hotfix/section-renderer-v1.261121.2')

        const copyFullBranch = copyGroup?.children?.find((c) => c.key === 'copy-full-branch')
        expect(copyFullBranch).toBeDefined()
        expect(copyFullBranch?.label).toContain('origin/hotfix/section-renderer-v1.261121.2')
      })

      it('strips origin remote name if full remote ref was passed to branchName', () => {
        const items = buildBranchContextMenu({
          branchName: 'origin/feature/user-dashboard',
          commit: mockCommit,
          isRemote: true,
          config: DEFAULT_CONTEXT_MENU_CONFIG,
        })
        const copyGroup = items.find((i) => i.key === 'menu-copy-group')
        const copyBranch = copyGroup?.children?.find((c) => c.key === 'copy-branch')
        expect(copyBranch).toBeDefined()
        expect(copyBranch?.label).toContain('feature/user-dashboard')
      })
    })
  })
})
