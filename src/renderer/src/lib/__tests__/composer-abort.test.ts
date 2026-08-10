import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  applyComposerAbortUi: vi.fn(),
  abortHoldActive: true,
  store: {
    historySessionFile: null as string | null,
    workerLiveSnapshot: {
      sessionId: 'running-session',
      sessionFile: '/sessions/running.jsonl',
      status: 'running' as const,
    },
    runState: { status: 'running', toolCount: 0, errorCount: 0 },
    streamingAssistantId: 'assistant-a',
    optimisticPendingUserText: null as string | null,
    sessionRuntimeRunning: { '/sessions/running.jsonl': true } as Record<string, boolean>,
    agentTurnBootstrapping: false,
    pendingSteering: [] as string[],
    pendingFollowUp: [] as string[],
  },
}))

vi.mock('@renderer/lib/ipc-client', () => ({
  ipcClient: { invoke: mocks.invoke },
}))
vi.mock('@renderer/lib/composer-queue-restore', () => ({
  applyComposerAbortUi: mocks.applyComposerAbortUi,
}))
vi.mock('@renderer/lib/abort-ui-hold', () => ({
  isAbortUiHoldActive: () => mocks.abortHoldActive,
}))
vi.mock('@renderer/stores/ui-store', () => ({
  useUIStore: { getState: () => mocks.store },
}))

import { abortAgentTurn } from '../composer-abort'

describe('abortAgentTurn', () => {
  beforeEach(() => {
    mocks.store.historySessionFile = null
    mocks.store.workerLiveSnapshot = {
      sessionId: 'running-session',
      sessionFile: '/sessions/running.jsonl',
      status: 'running',
    }
    mocks.store.runState = { status: 'running', toolCount: 0, errorCount: 0 }
    mocks.store.streamingAssistantId = 'assistant-a'
    mocks.store.sessionRuntimeRunning = { '/sessions/running.jsonl': true }
    mocks.abortHoldActive = true
    mocks.invoke.mockReset()
    mocks.applyComposerAbortUi.mockReset()
  })

  it('does not abort a foreground worker when the visible view has no session identity', async () => {
    await abortAgentTurn()

    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.applyComposerAbortUi).not.toHaveBeenCalled()
  })

  it('aborts the explicitly visible running session', async () => {
    vi.useFakeTimers()
    try {
      mocks.store.historySessionFile = '/sessions/running.jsonl'

      await abortAgentTurn()

      expect(mocks.invoke).toHaveBeenCalledWith('prompt.abort', {
        sessionId: '',
        sessionFile: '/sessions/running.jsonl',
      })
      expect(mocks.applyComposerAbortUi).toHaveBeenCalledWith('/sessions/running.jsonl')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('does not share the abort cooldown across sessions', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-10T12:00:00Z'))
      mocks.invoke.mockResolvedValue({ aborted: true })
      mocks.store.historySessionFile = '/sessions/a.jsonl'
      mocks.store.workerLiveSnapshot = {
        sessionId: 'a',
        sessionFile: '/sessions/a.jsonl',
        status: 'running',
      }
      mocks.store.sessionRuntimeRunning = { '/sessions/a.jsonl': true }

      await abortAgentTurn()

      mocks.store.historySessionFile = '/sessions/b.jsonl'
      mocks.store.workerLiveSnapshot = {
        sessionId: 'b',
        sessionFile: '/sessions/b.jsonl',
        status: 'running',
      }
      mocks.store.sessionRuntimeRunning = { '/sessions/b.jsonl': true }
      await abortAgentTurn()

      expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'prompt.abort', {
        sessionId: '',
        sessionFile: '/sessions/a.jsonl',
      })
      expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'prompt.abort', {
        sessionId: '',
        sessionFile: '/sessions/b.jsonl',
      })
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('does not let a late abort settlement stop a replacement turn', async () => {
    vi.useFakeTimers()
    try {
      mocks.store.historySessionFile = '/sessions/replacement.jsonl'
      mocks.store.workerLiveSnapshot = {
        sessionId: 'replacement',
        sessionFile: '/sessions/replacement.jsonl',
        status: 'running',
      }
      mocks.store.sessionRuntimeRunning = { '/sessions/replacement.jsonl': true }
      let settleAbort!: (value: { ignored: boolean }) => void
      mocks.invoke.mockImplementation(
        () =>
          new Promise<{ ignored: boolean }>((resolve) => {
            settleAbort = resolve
          }),
      )

      const aborting = abortAgentTurn()
      expect(mocks.applyComposerAbortUi).toHaveBeenCalledTimes(1)

      // A replacement send clears this session's abort guard.
      mocks.abortHoldActive = false
      settleAbort({ ignored: true })
      await aborting
      await vi.advanceTimersByTimeAsync(250)

      expect(mocks.applyComposerAbortUi).toHaveBeenCalledTimes(1)
      expect(mocks.invoke).toHaveBeenCalledTimes(1)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})
