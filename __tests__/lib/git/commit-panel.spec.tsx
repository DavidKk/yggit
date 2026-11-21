/** @jest-environment jsdom */
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitCommitPanel } from '@/components/git/GitCommitPanel'
import { getGitDriver } from '@/lib/git/driver'
import { GIT_WORKTREE_COMMIT, type GitCommit } from '@/lib/git/types'
import { readGitUiPref, writeGitUiPref } from '@/lib/git/ui-prefs'

jest.mock('@/components/git/RefChipsCell', () => ({
  FloatingMenu: ({ items, onClose }: { items: { key: string; label: string; checked?: boolean; onSelect: () => void }[]; onClose: () => void }) => (
    <div>
      {items.map((item) => (
        <button
          key={item.key}
          data-menu-key={item.key}
          role="menuitemcheckbox"
          aria-checked={item.checked}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}))

jest.mock('@/lib/git/driver', () => ({ getGitDriver: jest.fn() }))
jest.mock('@/components/i18n/LocaleProvider', () => {
  const t = (key: string, params?: { count?: number }) => (params?.count === undefined ? key : `${key}:${params.count}`)
  return { useT: () => t }
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
  SwitchToggle: ({
    checked,
    onCheckedChange,
    tooltip: _tooltip,
    size: _size,
    ...props
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    tooltip?: string
    size?: string
  }) => <button {...props} role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)} />,
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  VirtualList: jest.requireActual('@/components/sk/VirtualList').VirtualList,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  Spinner: () => <span data-testid="spinner" />,
  TextInput: (props: ComponentProps<'input'>) => <input {...props} />,
  SegmentedNav: ({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) => (
    <div>
      {items.map((item) => (
        <button key={item.id} role="tab" aria-selected={item.id === value} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}))

const commit: GitCommit = { hash: 'a'.repeat(40), short: 'aaaaaaa', parents: [], refs: [], author: '', date: '', subject: 'Test' }
const readCommitDiff = jest.fn(async ({ hash, all }: { hash: string; all?: boolean }) => ({
  hash,
  files: [{ path: all ? 'unchanged.txt' : 'changed.txt', oldPath: '', status: all ? '' : 'M' }],
  patch: '',
  truncated: false,
}))
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  window.localStorage.clear()
  jest.mocked(getGitDriver).mockReturnValue({ readCommitDiff } as unknown as ReturnType<typeof getGitDriver>)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function panel(selected: GitCommit) {
  return <GitCommitPanel repo="edge_test" commit={selected} width={408} selectedPath="" onSelect={jest.fn()} onClose={jest.fn()} />
}

function preference() {
  return readGitUiPref('commit.fileView', (value): value is string => typeof value === 'string')
}

it('keeps all-files available while a working-tree panel shares the preference', async () => {
  writeGitUiPref('commit.fileView', 'tree')
  await act(async () => {
    root.render(
      <>
        {panel(GIT_WORKTREE_COMMIT)}
        {panel(commit)}
      </>
    )
  })
  await act(async () => {
    const btn =
      container.querySelectorAll<HTMLButtonElement>('[aria-label="git.commit.fileViewsAria"]')[1] ||
      container.querySelectorAll<HTMLButtonElement>('[aria-label="视图与展开选项"]')[1]
    btn.click()
  })
  const allTab = container.querySelector<HTMLButtonElement>('[data-menu-key="view-all"]')!
  await act(async () => allTab.click())
  expect(preference()).toBe('all')
  expect(container.querySelectorAll('[role=tab]')).toHaveLength(0)
  expect(container.querySelector('[aria-label="git.commit.allFilesAria"]')?.textContent).toContain('unchanged.txt')
  expect(readCommitDiff).toHaveBeenCalledWith({ repo: 'edge_test', hash: commit.hash, tree: true, all: true })
  expect(readCommitDiff).not.toHaveBeenCalledWith(expect.objectContaining({ hash: GIT_WORKTREE_COMMIT.hash, all: true }))
})

it('uses a local tree fallback without replacing the saved all-files preference', async () => {
  writeGitUiPref('commit.fileView', 'all')
  await act(async () => root.render(panel(GIT_WORKTREE_COMMIT)))
  expect(preference()).toBe('all')
  expect(container.querySelector('[aria-label="git.commit.treeAria"]')).not.toBeNull()
  await act(async () => root.render(panel(commit)))
  expect(container.querySelector('[aria-label="git.commit.allFilesAria"]')?.textContent).toContain('unchanged.txt')
})

it('supports searching and filtering files with data-git-find attribute', async () => {
  await act(async () => root.render(panel(commit)))
  const aside = container.querySelector('aside')
  expect(aside?.getAttribute('data-git-find')).toBe('files')
  const searchButton = container.querySelector('button[aria-label="git.project.searchProjects"]') || container.querySelector('button[aria-label="搜索文件"]')
  expect(searchButton).not.toBeNull()
})

describe('conflict file controls', () => {
  beforeEach(() => {
    readCommitDiff.mockImplementation(async ({ hash }) => ({
      hash,
      files: [
        { path: 'theme/a.txt', oldPath: '', status: 'M' },
        { path: 'theme/nested/b.txt', oldPath: '', status: 'A' },
        { path: 'clean.txt', oldPath: '', status: 'M' },
      ],
      patch: '',
      truncated: false,
    }))
  })

  const conflictProps: Pick<ComponentProps<typeof GitCommitPanel>, 'conflictFiles' | 'conflictFileCounts'> = {
    conflictFiles: ['theme/a.txt', 'theme/nested/b.txt'],
    conflictFileCounts: { 'theme/a.txt': 2, 'theme/nested/b.txt': 3 },
  }
  function conflictedPanel(selected = commit, props = conflictProps) {
    return <GitCommitPanel repo="edge_test" commit={selected} width={540} selectedPath="" onSelect={jest.fn()} onClose={jest.fn()} {...props} />
  }
  async function toggle() {
    await act(async () => {
      const btn =
        container.querySelector<HTMLButtonElement>('[aria-label="git.commit.fileViewsAria"]') || container.querySelector<HTMLButtonElement>('[aria-label="视图与展开选项"]')
      btn?.click()
    })
    await act(async () => container.querySelector<HTMLButtonElement>('[data-menu-key="conflicts-only"]')!.click())
  }

  it.each(['tree', 'path', 'all'])('filters conflicts in %s view and restores other files when disabled', async (view) => {
    writeGitUiPref('commit.fileView', view)
    await act(async () => root.render(conflictedPanel()))
    expect(container.textContent).toContain('clean.txt')
    await toggle()
    expect(container.querySelector('[role=switch]')).toBeNull()
    expect(container.textContent).not.toContain('clean.txt')
    expect(container.textContent).toContain('a.txt')
    expect(container.textContent).toContain('b.txt')
    await toggle()
    expect(container.textContent).toContain('clean.txt')
  })

  it('shows conflict regions per file and aggregates them on ancestor folders', async () => {
    await act(async () => root.render(conflictedPanel()))
    const folder = container.querySelector('[data-git-tree-id="theme"]')!
    expect(folder.querySelector('[aria-label="git.commit.conflictLocations:5"]')?.textContent).toBe('5')
    const file = container.querySelector('[aria-label="git.status.modify a.txt"]')!
    expect(file.querySelector('[aria-label="git.commit.conflictLocations:2"]')?.textContent).toBe('2')
    expect(container.textContent).not.toContain('冲突')
    expect(container.querySelector('header')?.textContent).not.toContain('5')
  })

  it('keeps conflict files omitted from the regular diff and resets filtering on a new commit', async () => {
    await act(async () => root.render(conflictedPanel(commit, { conflictFiles: ['omitted.txt'], conflictFileCounts: { 'omitted.txt': 1 } })))
    await toggle()
    expect(container.textContent).toContain('omitted.txt')
    expect(container.textContent).not.toContain('clean.txt')
    await act(async () => root.render(conflictedPanel({ ...commit, hash: 'b'.repeat(40) })))
    expect(container.querySelector('[role=switch]')).toBeNull()
    expect(container.textContent).toContain('clean.txt')
  })

  it('uses an unknown count for old cache records until refreshed', async () => {
    await act(async () =>
      root.render(<GitCommitPanel repo="edge_test" commit={commit} width={540} selectedPath="" onSelect={jest.fn()} onClose={jest.fn()} conflictFiles={['theme/a.txt']} />)
    )
    expect(container.querySelector('[aria-label="git.commit.conflictCountUnknown"]')?.textContent).toBe('?')
  })

  it('automatically expands ancestor directories for the selectedPath even when default collapsed', async () => {
    writeGitUiPref('commit.treeExpandDefault', false)
    const nestedDiff = jest.fn(async ({ hash }: { hash: string }) => ({
      hash,
      files: [{ path: 'deep/nested/folder/file.txt', oldPath: '', status: 'M' }],
      patch: '',
      truncated: false,
    }))
    jest.mocked(getGitDriver).mockReturnValue({ readCommitDiff: nestedDiff } as unknown as ReturnType<typeof getGitDriver>)

    await act(async () => {
      root.render(<GitCommitPanel repo="edge_test" commit={commit} width={408} selectedPath="deep/nested/folder/file.txt" onSelect={jest.fn()} onClose={jest.fn()} />)
    })

    expect(container.textContent).toContain('file.txt')
  })
})
