import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/lib/ipc-client', () => ({
  ipcClient: { invoke: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@renderer/lib/session-history', () => ({
  fetchSessionHistoryTail: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    sourceCount: 0,
  }),
}))
vi.mock('@renderer/lib/session-display-meta', () => ({
  applyComposerDisplayMeta: vi.fn().mockResolvedValue(undefined),
}))

import {
  clearLiveSessionTimeline,
  markLiveSessionTurnEnded,
  saveLiveSessionTimeline,
} from '../live-session-timeline-cache'
import {
  captureFocusFromUiStore,
  clearSessionShellForTests,
  focusSessionSync,
} from '../session-shell'
import { useUIStore } from '../../stores/ui-store'

const sessionA = '/sessions/a.jsonl'
const sessionB = '/sessions/b.jsonl'

describe('session shell runtime isolation', () => {
  beforeEach(() => {
    clearLiveSessionTimeline()
    clearSessionShellForTests()
    useUIStore.setState({
      currentWorkspace: '/workspace',
      currentSessionId: 'session-b',
      historySessionFile: sessionB,
      historyTotalCount: 1,
      historyLoadedCount: 1,
      historyLoading: false,
      timelineItems: [
        { id: 'assistant-b', type: 'assistant-message', text: 'done', timestamp: 1 },
      ],
      streamingAssistantId: 'assistant-b',
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
      pendingSteering: [],
      pendingFollowUp: [],
      sessionRuntimeRunning: { [sessionB]: true },
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      workerLiveSnapshot: {
        sessionId: 'session-b',
        sessionFile: sessionB,
        status: 'running',
      },
    })
    captureFocusFromUiStore()

    saveLiveSessionTimeline({
      sessionId: 'session-b',
      sessionFile: sessionB,
      timelineItems: [
        { id: 'assistant-b', type: 'assistant-message', text: 'done', timestamp: 1 },
      ],
      streamingAssistantId: null,
      runState: { status: 'idle', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    useUIStore.setState({
      currentSessionId: 'session-a',
      historySessionFile: sessionA,
      sessionRuntimeRunning: { [sessionA]: true },
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      workerLiveSnapshot: {
        sessionId: 'session-a',
        sessionFile: sessionA,
        status: 'running',
      },
    })
  })

  it('does not revive a terminal session from a stale cached running view', () => {
    focusSessionSync('session-b', sessionB)

    const state = useUIStore.getState()
    expect(state.runState.status).toBe('idle')
    expect(state.workerLiveSnapshot).toEqual({
      sessionId: 'session-b',
      sessionFile: sessionB,
      status: 'idle',
    })
    expect(state.sessionRuntimeRunning).toEqual({ [sessionA]: true })
    expect(state.streamingAssistantId).toBeNull()
  })

  it('preserves a failed terminal state while clearing stale running markers', () => {
    markLiveSessionTurnEnded(sessionB, 'failed')

    focusSessionSync('session-b', sessionB)

    const state = useUIStore.getState()
    expect(state.runState.status).toBe('failed')
    expect(state.workerLiveSnapshot.status).toBe('failed')
    expect(state.sessionRuntimeRunning).toEqual({ [sessionA]: true })
  })
})
