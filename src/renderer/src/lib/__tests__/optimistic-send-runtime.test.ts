import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendOptimisticOutgoingMessage,
  bindOptimisticOutgoingToSession,
  clearOptimisticOutgoing,
} from '../optimistic-send'
import {
  clearAbortQueueIgnore,
  clearAbortUiHold,
  isAbortQueueIgnoreActive,
  isAbortUiHoldActive,
  markAbortQueueIgnore,
  markAbortUiHold,
} from '../abort-ui-hold'
import { useUIStore } from '../../stores/ui-store'

vi.mock('@renderer/features/timeline/timeline-bottom-anchor', () => ({
  requestTimelineBottomAnchor: vi.fn(),
}))

describe('optimistic send runtime', () => {
  beforeEach(() => {
    clearAbortUiHold()
    clearAbortQueueIgnore()
    useUIStore.setState({
      historySessionFile: '/sessions/current.jsonl',
      timelineItems: [],
      sessionRuntimeRunning: {},
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
      streamingAssistantId: null,
      runState: { status: 'idle', toolCount: 0, errorCount: 0 },
    })
  })

  it('scopes optimistic runtime to the visible session and clears it on send failure', () => {
    const token = appendOptimisticOutgoingMessage('hello')

    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({
      '/sessions/current.jsonl': true,
    })

    expect(clearOptimisticOutgoing(token)).toBe(true)

    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({})
    expect(useUIStore.getState().agentTurnBootstrapping).toBe(false)
    expect(useUIStore.getState().streamingAssistantId).toBeNull()
  })

  it('binds a pending-new optimistic turn to the created session', () => {
    useUIStore.setState({ historySessionFile: null })
    const token = appendOptimisticOutgoingMessage('hello')

    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({})

    bindOptimisticOutgoingToSession(token, '/sessions/new.jsonl')

    expect(token?.sessionFile).toBe('/sessions/new.jsonl')
    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({
      '/sessions/new.jsonl': true,
    })
  })

  it('clears an unmaterialized pending-new turn when creation fails', () => {
    useUIStore.setState({ historySessionFile: null })
    const token = appendOptimisticOutgoingMessage('hello')

    expect(clearOptimisticOutgoing(token)).toBe(true)
    expect(useUIStore.getState().agentTurnBootstrapping).toBe(false)
    expect(useUIStore.getState().streamingAssistantId).toBeNull()
  })

  it('clears a materialized pending-new turn when setup fails before token binding', () => {
    useUIStore.setState({ historySessionFile: null })
    const token = appendOptimisticOutgoingMessage('hello')
    useUIStore.setState({
      historySessionFile: '/sessions/new.jsonl',
      sessionRuntimeRunning: { '/sessions/new.jsonl': true },
    })

    expect(clearOptimisticOutgoing(token)).toBe(true)
    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({})
    expect(useUIStore.getState().streamingAssistantId).toBeNull()
  })

  it('lets a new turn replace the same session abort guard', () => {
    markAbortUiHold('/sessions/current.jsonl', 5000)
    markAbortQueueIgnore('/sessions/current.jsonl', 5000)

    appendOptimisticOutgoingMessage('new turn')

    expect(isAbortUiHoldActive('/sessions/current.jsonl')).toBe(false)
    expect(isAbortQueueIgnoreActive('/sessions/current.jsonl')).toBe(false)
    expect(useUIStore.getState().sessionRuntimeRunning).toEqual({
      '/sessions/current.jsonl': true,
    })
  })

  it('does not clear the current view when a previous session fails late', () => {
    useUIStore.setState({
      historySessionFile: '/sessions/current.jsonl',
      sessionRuntimeRunning: {
        '/sessions/previous.jsonl': true,
        '/sessions/current.jsonl': true,
      },
      optimisticPendingUserText: 'current prompt',
      agentTurnBootstrapping: true,
    })

    expect(
      clearOptimisticOutgoing({
        sessionFile: '/sessions/previous.jsonl',
        assistantId: 'previous-assistant',
      }),
    ).toBe(false)

    const state = useUIStore.getState()
    expect(state.sessionRuntimeRunning).toEqual({ '/sessions/current.jsonl': true })
    expect(state.optimisticPendingUserText).toBe('current prompt')
    expect(state.agentTurnBootstrapping).toBe(true)
  })
})
