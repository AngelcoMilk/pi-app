import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  onGitWorkspaceChanged: vi.fn(() => () => {}),
}))

vi.mock('@renderer/lib/ipc-client', () => ({
  ipcClient: { invoke: mocks.invoke },
  onGitWorkspaceChanged: mocks.onGitWorkspaceChanged,
}))

import { useReviewGitData } from './use-review-git-data'

function response(path: string, branch = 'main') {
  return {
    diff: {
      raw: `diff --git a/${path} b/${path}`,
      status: ` M ${path}\n`,
      branch,
      log: 'head commit',
      isRepo: true,
    },
  }
}

describe('useReviewGitData', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    mocks.onGitWorkspaceChanged.mockClear()
  })

  it('keeps the previous snapshot mounted during a background refresh', async () => {
    let resolveNext: ((value: unknown) => void) | null = null
    mocks.invoke
      .mockResolvedValueOnce(response('a.ts'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve }))
    const { result, rerender } = renderHook(
      ({ signal }) => useReviewGitData({ enabled: true, workspace: '/repo', worktreeChangeSignal: signal }),
      { initialProps: { signal: 0 } },
    )

    await waitFor(() => expect(result.current.gitData?.files[0]?.path).toBe('a.ts'))
    rerender({ signal: 1 })
    expect(result.current.gitData?.files[0]?.path).toBe('a.ts')
    expect(result.current.refreshing).toBe(true)

    await act(async () => resolveNext?.(response('b.ts')))
    await waitFor(() => expect(result.current.gitData?.files[0]?.path).toBe('b.ts'))
  })

  it('coalesces concurrent refresh signals into a follow-up request', async () => {
    let resolveFirst: ((value: unknown) => void) | null = null
    let resolveSecond: ((value: unknown) => void) | null = null
    mocks.invoke
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    const { result, rerender } = renderHook(
      ({ signal }) => useReviewGitData({ enabled: true, workspace: '/repo', worktreeChangeSignal: signal }),
      { initialProps: { signal: 0 } },
    )
    rerender({ signal: 1 })
    expect(mocks.invoke).toHaveBeenCalledTimes(1)

    await act(async () => resolveFirst?.(response('a.ts')))
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2))
    await act(async () => resolveSecond?.(response('b.ts')))
    await waitFor(() => expect(result.current.gitData?.files[0]?.path).toBe('b.ts'))
  })

  it('does not publish a response from the previous workspace', async () => {
    let resolveOld: ((value: unknown) => void) | null = null
    mocks.invoke
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce(response('b.ts'))
    const { result, rerender } = renderHook(
      ({ workspace }) => useReviewGitData({ enabled: true, workspace, worktreeChangeSignal: 0 }),
      { initialProps: { workspace: '/repo-a' } },
    )

    rerender({ workspace: '/repo-b' })
    await act(async () => resolveOld?.(response('a.ts')))
    await waitFor(() => expect(result.current.gitData?.files[0]?.path).toBe('b.ts'))
    expect(result.current.gitData?.files[0]?.path).not.toBe('a.ts')
  })
})
