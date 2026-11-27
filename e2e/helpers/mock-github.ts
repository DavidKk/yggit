import { expect, type Page } from '@playwright/test'

export const MOCK_GH_OWNER = 'e2e-mock'
export const MOCK_GH_REPO = 'sample-repo'
export const MOCK_GH_URL = `https://github.com/${MOCK_GH_OWNER}/${MOCK_GH_REPO}`

const SHA_1 = '1111111111111111111111111111111111111111'
const SHA_2 = '2222222222222222222222222222222222222222'
const SHA_3 = '3333333333333333333333333333333333333333'

const MOCK_COMMITS = [
  {
    sha: SHA_1,
    commit: {
      author: { name: 'Mock Bot', date: '2026-11-27T12:00:00Z' },
      message: 'feat(edge): mock GitHub commit for zero-server E2E',
    },
    parents: [{ sha: SHA_2 }],
  },
  {
    sha: SHA_2,
    commit: {
      author: { name: 'Mock Bot', date: '2026-11-26T12:00:00Z' },
      message: 'chore: mock baseline commit',
    },
    parents: [{ sha: SHA_3 }],
  },
  {
    sha: SHA_3,
    commit: {
      author: { name: 'Mock Bot', date: '2026-11-25T12:00:00Z' },
      message: 'init: mock repository root',
    },
    parents: [],
  },
]

/**
 * Intercepts browser GitHub REST and raw content requests with deterministic fixtures
 * so Edge mode remote-repo E2E tests never hit live GitHub servers or IP rate limits.
 */
export async function mockGitHubApi(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path === `/repos/${MOCK_GH_OWNER}/${MOCK_GH_REPO}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', full_name: `${MOCK_GH_OWNER}/${MOCK_GH_REPO}` }),
      })
      return
    }

    if (path === `/repos/${MOCK_GH_OWNER}/${MOCK_GH_REPO}/branches`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { name: 'main', commit: { sha: SHA_1 } },
          { name: 'feat/mock-edge', commit: { sha: SHA_2 } },
        ]),
      })
      return
    }

    if (path === `/repos/${MOCK_GH_OWNER}/${MOCK_GH_REPO}/commits`) {
      const pageNum = Number(url.searchParams.get('page') || '1')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageNum <= 1 ? MOCK_COMMITS : []),
      })
      return
    }

    if (path.startsWith(`/repos/${MOCK_GH_OWNER}/${MOCK_GH_REPO}/commits/`)) {
      const pageNum = Number(url.searchParams.get('page') || '1')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files:
            pageNum <= 1
              ? [
                  {
                    filename: 'README.md',
                    status: 'modified',
                    patch: '@@ -1 +1,2 @@\n # Sample Repo\n+Added offline Edge mock diff line',
                  },
                ]
              : [],
        }),
      })
      return
    }

    if (path.startsWith(`/repos/${MOCK_GH_OWNER}/${MOCK_GH_REPO}/git/trees/`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tree: [{ path: 'README.md', type: 'blob' }],
          truncated: false,
        }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ message: `Unmocked GitHub API route: ${path}` }),
    })
  })

  await page.route('https://raw.githubusercontent.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: '# Sample Repo\nAdded offline Edge mock diff line\n',
    })
  })
}

/**
 * Boots `/git` purely in Edge mode and opens the mocked GitHub repository
 * via Project Switcher without hitting SSR or external GitHub servers.
 */
export async function openMockGitHubInEdgeMode(page: Page): Promise<void> {
  await mockGitHubApi(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('yggit.driver_mode', 'edge')
  })
  await page.goto('/git')

  const switcherBtn = page.locator('[data-git-find="project-switcher"] button').first()
  await expect(switcherBtn).toBeVisible()
  await switcherBtn.click()

  const searchBtn = page.getByRole('button', { name: /Search projects|搜索项目/i }).first()
  await expect(searchBtn).toBeVisible()
  await searchBtn.click()

  const searchInput = page.getByPlaceholder(/Search name|搜索名称/i).first()
  await expect(searchInput).toBeVisible()
  await searchInput.fill(MOCK_GH_URL)

  const tempBtn = page.getByRole('button', { name: /Open public repository in temporary mode|以临时模式打开公开仓库/i }).first()
  await expect(tempBtn).toBeVisible()
  await tempBtn.click()
}
