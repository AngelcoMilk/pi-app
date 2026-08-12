import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@renderer/lib/ipc-client', () => ({ ipcClient: { invoke } }))
vi.mock('@renderer/stores/ui-store-stream', () => ({
  flushStreamPendingSync: vi.fn(),
  clearStreamPending: vi.fn(),
  deleteStreamPendingForId: vi.fn(),
  queueStreamDelta: vi.fn(),
}))

import { enterBlankSession } from '../blank-session-transition'
import {
  clearSessionShellForTests,
  focusSessionSync,
  getSessionView,
} from '../session-shell'
import { useUIStore } from '@renderer/stores/ui-store'

describe('enterBlankSession', () => {
  beforeEach(() => {
    invoke.mockClear()
    clearSessionShellForTests()
    useUIStore.setState({
      currentWorkspace: '/workspace',
      currentSessionId: 'session-a',
      historySessionFile: '/sessions/a.jsonl',
      timelineItems: [],
      historyTotalCount: 0,
      historyLoadedCount: 0,
      historyLoading: false,
      streamingAssistantId: null,
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
      pendingSteering: ['steer-a'],
      pendingFollowUp: ['follow-a'],
      fileChanges: [{ path: 'a.ts', changeType: 'modified', source: 'edit' }],
      sessionRuntimeRunning: { '/sessions/a.jsonl': true },
      workerLiveSnapshot: {
        sessionId: 'session-a',
        sessionFile: '/sessions/a.jsonl',
        status: 'running',
      },
      runState: {
        status: 'running',
        activeRunId: 'run-a',
        activeTool: 'bash',
        toolCount: 1,
        errorCount: 0,
      },
    })
  })

  it('captures a queue-only session, clears the draft, and restores the original queue', () => {
    enterBlankSession('pending-project')

    expect(getSessionView('/sessions/a.jsonl')).toEqual(
      expect.objectContaining({
        pendingSteering: ['steer-a'],
        pendingFollowUp: ['follow-a'],
      }),
    )
    expect(useUIStore.getState()).toEqual(
      expect.objectContaining({
        pendingNewSessionPlaceholder: true,
        historySessionFile: null,
        timelineItems: [],
        pendingSteering: [],
        pendingFollowUp: [],
        fileChanges: [],
      }),
    )
    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({ '/sessions/a.jsonl': true })

    focusSessionSync('session-a', '/sessions/a.jsonl')
    expect(useUIStore.getState().pendingSteering).toEqual(['steer-a'])
    expect(useUIStore.getState().pendingFollowUp).toEqual(['follow-a'])
  })

  it('uses the same reset contract for an ephemeral sandbox draft', () => {
    enterBlankSession('ephemeral-sandbox')

    expect(useUIStore.getState()).toEqual(
      expect.objectContaining({
        ephemeralSandboxDraft: true,
        pendingNewSessionPlaceholder: false,
        currentWorkspace: null,
        currentSessionId: '__ephemeral_draft__',
        pendingSteering: [],
        pendingFollowUp: [],
      }),
    )
    expect(invoke).toHaveBeenCalledWith('session.setEphemeralDraft', { active: true })
  })
})
