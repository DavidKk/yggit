/** @jest-environment jsdom */
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ThemedToken } from 'shiki'

import { highlightGitLines } from '@/components/git/gitHighlight'
import { useGitLineTokens } from '@/components/git/GitHighlightedCode'

jest.mock('@/components/git/gitHighlight', () => ({
  highlightGitLines: jest.fn(),
  highlightGitCode: jest.fn(),
}))
jest.mock('@/components/theme/ThemeProvider', () => ({ useThemeMode: () => 'light' }))

const highlight = jest.mocked(highlightGitLines)
let root: Root
let host: HTMLDivElement

function Probe({ lines }: { lines: string[] }) {
  const tokens = useGitLineTokens(lines, 'app.go')
  return <output>{tokens === null ? 'pending' : JSON.stringify(tokens)}</output>
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  jest.useRealTimers()
})

it('finishes pending highlighting after an equivalent array rerender in Strict Mode', async () => {
  let finish!: (tokens: ThemedToken[][]) => void
  const pending = new Promise<ThemedToken[][]>((resolve) => {
    finish = resolve
  })
  highlight.mockReturnValue(pending)
  const render = () => (
    <StrictMode>
      <Probe lines={['package main']} />
    </StrictMode>
  )
  await act(async () => root.render(render()))
  await act(async () => root.render(render()))
  const tokens = [[{ content: 'package main', color: '#ff0000', offset: 0 }]]
  await act(async () => finish(tokens))
  expect(host.textContent).toBe(JSON.stringify(tokens))
})

it('keeps the initial batch when background highlighting rejects', async () => {
  jest.useFakeTimers()
  highlight.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('highlight failed'))
  await act(async () => root.render(<Probe lines={Array.from({ length: 601 }, () => 'package main')} />))
  const initial = host.textContent
  expect(initial).not.toBe('pending')
  await act(async () => {
    jest.advanceTimersByTime(80)
  })
  expect(highlight).toHaveBeenCalledTimes(2)
  expect(host.textContent).toBe(initial)
})
