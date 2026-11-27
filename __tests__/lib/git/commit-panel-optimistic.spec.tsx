/** @jest-environment jsdom */
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitCommitPanel } from '@/components/git/GitCommitPanel'
import { getGitDriver } from '@/lib/git/driver'
import { GIT_WORKTREE_COMMIT, type GitFileChange } from '@/lib/git/types'

const mockNotify = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}

jest.mock('@/components/notification/useNotification', () => ({
  useNotification: () => mockNotify,
}))
jest.mock('@/components/confirm/ConfirmProvider', () => ({
  useOptionalConfirm: () => jest.fn().mockResolvedValue(true),
}))
jest.mock('@/components/git/RefChipsCell', () => ({
  FloatingMenu: () => null,
}))
jest.mock('@/lib/git/driver', () => ({ getGitDriver: jest.fn() }))
jest.mock('@/components/i18n/LocaleProvider', () => {
  const t = (key: string) => key
  return { useT: () => t, useLocaleCode: () => 'en' }
})
jest.mock('@/components/sk', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    tooltip: _tooltip,
    tooltipSuppressed: _ts,
    ...props
  }: ComponentProps<'button'> & { variant?: string; size?: string; tooltip?: string; tooltipSuppressed?: boolean }) => <button {...props}>{children}</button>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SwitchToggle: ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (c: boolean) => void }) => (
    <button {...props} role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)} />
  ),
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  VirtualList: jest.requireActual('@/components/sk/VirtualList').VirtualList,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  Spinner: () => <span data-testid="spinner" />,
  TextInput: (props: ComponentProps<'input'>) => <input {...props} />,
  SegmentedNav: () => null,
}))

function createDeferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('GitCommitPanel optimistic staging and mutation queue', () => {
  let root: Root
  let container: HTMLDivElement
  let diskFiles: GitFileChange[]
  let readCommitDiff: jest.Mock
  let stage: jest.Mock
  let unstage: jest.Mock
  let commit: jest.Mock
  let onRefresh: jest.Mock
  let onFilesLoaded: jest.Mock
  let onCommitSuccess: jest.Mock

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    window.localStorage.clear()
    mockNotify.success.mockClear()
    mockNotify.error.mockClear()
    mockNotify.info.mockClear()

    diskFiles = [
      { path: 'alpha.ts', oldPath: '', status: 'M', staged: false, unstaged: true },
      { path: 'beta.ts', oldPath: '', status: 'M', staged: false, unstaged: true },
    ]

    readCommitDiff = jest.fn(async ({ hash }: { hash: string }) => ({
      hash,
      files: diskFiles.map((f) => ({ ...f })),
      patch: '',
      truncated: false,
    }))
    stage = jest.fn(async () => ({ ok: true, message: 'Staged' }))
    unstage = jest.fn(async () => ({ ok: true, message: 'Unstaged' }))
    commit = jest.fn(async () => ({ ok: true, message: 'Committed', hash: '1'.repeat(40) }))
    onRefresh = jest.fn(async () => {})
    onFilesLoaded = jest.fn()
    onCommitSuccess = jest.fn()

    jest.mocked(getGitDriver).mockReturnValue({
      readCommitDiff,
      stage,
      unstage,
      commit,
    } as unknown as ReturnType<typeof getGitDriver>)

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  async function renderWorktree() {
    await act(async () => {
      root.render(
        <GitCommitPanel
          repo="edge_repo"
          commit={GIT_WORKTREE_COMMIT}
          width={408}
          selectedPath=""
          onSelect={jest.fn()}
          onClose={jest.fn()}
          onRefresh={onRefresh}
          onFilesLoaded={onFilesLoaded}
          onCommitSuccess={onCommitSuccess}
        />
      )
    })
  }

  it('moves files into Staged optimistically before driver.stage resolves and skips heavy onRefresh on success', async () => {
    const deferred = createDeferred<{ ok: boolean; message: string }>()
    stage.mockImplementation(async () => {
      const res = await deferred.promise
      diskFiles = diskFiles.map((f) => ({ ...f, staged: true, unstaged: false }))
      return res
    })

    await renderWorktree()
    expect(container.querySelector('[aria-label="git.operations.stageAll"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="git.operations.unstageAll"]')).toBeNull()
    const initialReads = readCommitDiff.mock.calls.length

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="git.operations.stageAll"]')?.click()
    })

    // Immediately reflected in UI while background write is still pending
    expect(stage).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[aria-label="git.operations.unstageAll"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="git.operations.stageAll"]')).toBeNull()
    expect(onFilesLoaded).toHaveBeenLastCalledWith([
      { path: 'alpha.ts', oldPath: '', status: 'M', staged: true, unstaged: false },
      { path: 'beta.ts', oldPath: '', status: 'M', staged: true, unstaged: false },
    ])

    await act(async () => {
      deferred.resolve({ ok: true, message: 'Staged' })
      await deferred.promise
    })

    expect(readCommitDiff.mock.calls.length).toBe(initialReads + 1)
    expect(onRefresh).not.toHaveBeenCalled()
    expect(mockNotify.success).not.toHaveBeenCalled()
    expect(mockNotify.error).not.toHaveBeenCalled()
  })

  it('rolls back optimistic UI when driver.stage rejects and reconciles from disk', async () => {
    const deferred = createDeferred<{ ok: boolean; message: string }>()
    stage.mockImplementation(() => deferred.promise)

    await renderWorktree()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="git.operations.stageAll"]')?.click()
    })
    expect(container.querySelector('[aria-label="git.operations.unstageAll"]')).not.toBeNull()

    await act(async () => {
      deferred.reject(new Error('Permission denied'))
      await deferred.promise.catch(() => {})
    })

    expect(mockNotify.error).toHaveBeenCalledWith('Permission denied')
    expect(container.querySelector('[aria-label="git.operations.stageAll"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="git.operations.unstageAll"]')).toBeNull()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('flushes queued optimistic stage operations before invoking driver.commit', async () => {
    const order: string[] = []
    const deferred = createDeferred<{ ok: boolean; message: string }>()
    stage.mockImplementation(async () => {
      const res = await deferred.promise
      diskFiles = diskFiles.map((f) => ({ ...f, staged: true, unstaged: false }))
      order.push('stage:done')
      return res
    })
    commit.mockImplementation(async () => {
      order.push('commit:run')
      return { ok: true, message: 'Committed', hash: '2'.repeat(40) }
    })

    await renderWorktree()

    // Trigger optimistic Stage All (stays in-flight)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="git.operations.stageAll"]')?.click()
    })

    // Enter commit summary and trigger Commit while stage is still pending
    const summaryInput = container.querySelector<HTMLInputElement>('input[placeholder="git.operations.commitPlaceholder"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(summaryInput, 'feat: commit after optimistic stage')
      summaryInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const commitBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('git.operations.commit'))!
    let commitPromise!: Promise<void>
    await act(async () => {
      commitBtn.click()
      commitPromise = Promise.resolve()
    })

    expect(commit).not.toHaveBeenCalled()

    await act(async () => {
      deferred.resolve({ ok: true, message: 'Staged' })
      await commitPromise
    })

    expect(order).toEqual(['stage:done', 'commit:run'])
    expect(commit).toHaveBeenCalledWith('edge_repo', 'feat: commit after optimistic stage', {
      stageAll: false,
      amend: false,
      noVerify: false,
      pushAfter: false,
    })
    expect(onCommitSuccess).toHaveBeenCalledWith({
      hash: '2'.repeat(40),
      subject: 'feat: commit after optimistic stage',
      remainingFilesCount: 0,
    })
    expect(mockNotify.success).not.toHaveBeenCalled()
  })
})
