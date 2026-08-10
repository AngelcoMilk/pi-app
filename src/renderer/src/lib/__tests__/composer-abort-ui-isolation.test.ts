import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAbortQueueIgnore,
  clearAbortUiHold,
  isAbortQueueIgnoreActive,
  isAbortUiHoldActive,
} from '../abort-ui-hold'
import {
  clearLiveSessionTimeline,
  getLiveSessionTimeline,
  saveLiveSessionTimeline,
} from '../live-session-timeline-cache'
import { applyComposerAbortUi } from '../composer-queue-restore'
import { useUIStore } from '../../stores/ui-store'

describe('composer abort UI isolation', () => {
  beforeEach(() => {
    clearAbortUiHold()
    clearAbortQueueIgnore()
    clearLiveSessionTimeline()
    useUIStore.setState({
      currentSessionId: 'session-b',
      historySessionFile: '/sessions/b.jsonl',
      sessionRuntimeRunning: {
        '/sessions/a.jsonl': true,
        '/sessions/b.jsonl': true,
      },
      workerLiveSnapshot: {
        sessionId: 'session-b',
        sessionFile: '/sessions/b.jsonl',
        status: 'running',
      },
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      streamingAssistantId: 'assistant-b',
      optimisticPendingUserText: 'prompt-b',
      agentTurnBootstrapping: true,
      pendingSteering: ['steer-b'],
      pendingFollowUp: ['follow-b'],
    })
  })

  it('does not clear the current view when a late abort result belongs to another session', () => {
    applyComposerAbortUi('/sessions/a.jsonl')

    const state = useUIStore.getState()
    expect(state.sessionRuntimeRunning).toEqual({ '/sessions/b.jsonl': true })
    expect(state.workerLiveSnapshot).toEqual({
      sessionId: 'session-b',
      sessionFile: '/sessions/b.jsonl',
      status: 'running',
    })
    expect(state.runState.status).toBe('running')
    expect(state.streamingAssistantId).toBe('assistant-b')
    expect(state.optimisticPendingUserText).toBe('prompt-b')
    expect(state.pendingSteering).toEqual(['steer-b'])
    expect(state.pendingFollowUp).toEqual(['follow-b'])
    expect(isAbortUiHoldActive('/sessions/a.jsonl')).toBe(true)
    expect(isAbortUiHoldActive('/sessions/b.jsonl')).toBe(false)
    expect(isAbortQueueIgnoreActive('/sessions/a.jsonl')).toBe(true)
    expect(isAbortQueueIgnoreActive('/sessions/b.jsonl')).toBe(false)
  })

  it('does not re-light an aborted session from a late running event', () => {
    useUIStore.setState({
      currentSessionId: 'session-a',
      historySessionFile: '/sessions/a.jsonl',
      workerLiveSnapshot: {
        sessionId: 'session-a',
        sessionFile: '/sessions/a.jsonl',
        status: 'running',
      },
      sessionRuntimeRunning: { '/sessions/a.jsonl': true },
      agentTurnBootstrapping: false,
    })
    applyComposerAbortUi('/sessions/a.jsonl')

    useUIStore.getState().processEvent({
      type: 'run',
      phase: 'running',
      runId: 'late-run-a',
      seq: 2,
      workspaceId: '/workspace',
      sessionFile: '/sessions/a.jsonl',
      timestamp: Date.now(),
    })

    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({})
    expect(useUIStore.getState().runState.status).toBe('idle')
  })

  it('does not re-light an aborted session from a late background running event', () => {
    saveLiveSessionTimeline({
      sessionId: 'session-a',
      sessionFile: '/sessions/a.jsonl',
      timelineItems: [
        {
          id: 'assistant-a',
          type: 'assistant-message',
          text: 'partial',
          timestamp: 1,
        },
      ],
      streamingAssistantId: 'assistant-a',
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })
    useUIStore.setState({
      currentSessionId: 'session-a',
      historySessionFile: '/sessions/a.jsonl',
      workerLiveSnapshot: {
        sessionId: 'session-a',
        sessionFile: '/sessions/a.jsonl',
        status: 'running',
      },
      sessionRuntimeRunning: { '/sessions/a.jsonl': true },
      agentTurnBootstrapping: false,
    })
    applyComposerAbortUi('/sessions/a.jsonl')
    useUIStore.setState({
      currentSessionId: 'session-b',
      historySessionFile: '/sessions/b.jsonl',
      workerLiveSnapshot: {
        sessionId: 'session-b',
        sessionFile: '/sessions/b.jsonl',
        status: 'idle',
      },
      runState: { status: 'idle', toolCount: 0, errorCount: 0 },
    })

    useUIStore.getState().processEvent({
      type: 'run',
      phase: 'running',
      runId: 'late-run-a',
      seq: 3,
      workspaceId: '/workspace',
      sessionFile: '/sessions/a.jsonl',
      timestamp: Date.now(),
    })
    useUIStore.getState().processEvent({
      type: 'message',
      role: 'assistant',
      phase: 'delta',
      contentKind: 'text',
      text: 'late text',
      runId: 'late-run-a',
      seq: 4,
      workspaceId: '/workspace',
      sessionFile: '/sessions/a.jsonl',
      timestamp: Date.now(),
    })

    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({})
    expect(useUIStore.getState().runState.status).toBe('idle')
    const live = getLiveSessionTimeline('/sessions/a.jsonl')
    expect(live?.runState.status).toBe('idle')
    expect(live?.streamingAssistantId).toBeNull()
    expect(live?.timelineItems.at(-1)?.text).toBe('partial')
  })
})
