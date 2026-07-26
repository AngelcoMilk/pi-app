import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyBackgroundAppEventToLiveTimeline,
  BACKGROUND_LIVE_TIMELINE_MAX_ITEMS,
  clearLiveSessionTimeline,
  getLiveSessionTimeline,
  saveLiveSessionTimeline,
} from '../live-session-timeline-cache'
import type { TimelineItem } from '@renderer/stores/ui-store-types'

const baseItems: TimelineItem[] = [
  { id: 'u1', type: 'user-message', text: 'hello', timestamp: 1 },
  { id: 'a1', type: 'assistant-message', text: '', thinkingText: '', timestamp: 2 },
]

describe('live-session-timeline-cache', () => {
  beforeEach(() => {
    clearLiveSessionTimeline()
  })

  it('keeps streaming assistant text while session is viewed in background', () => {
    saveLiveSessionTimeline({
      sessionId: 's1',
      sessionFile: '/tmp/s1.jsonl',
      timelineItems: baseItems,
      streamingAssistantId: 'a1',
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    applyBackgroundAppEventToLiveTimeline('/tmp/s1.jsonl', {
      type: 'message',
      role: 'assistant',
      phase: 'delta',
      contentKind: 'text',
      text: 'partial reply',
      seq: 1,
      workspaceId: '/w',
      sessionId: 's1',
      timestamp: 3,
    })

    const snap = getLiveSessionTimeline('/tmp/s1.jsonl')
    expect(snap?.streamingAssistantId).toBe('a1')
    expect(snap?.timelineItems.at(-1)?.text).toBe('partial reply')
  })

  it('bootstraps background cache when capture was missed', () => {
    applyBackgroundAppEventToLiveTimeline('/tmp/s2.jsonl', {
      type: 'message',
      role: 'assistant',
      phase: 'delta',
      contentKind: 'text',
      text: 'late stream',
      seq: 3,
      workspaceId: '/w',
      sessionFile: '/tmp/s2.jsonl',
      timestamp: 5,
    })

    expect(getLiveSessionTimeline('/tmp/s2.jsonl')?.timelineItems.at(-1)?.text).toBe('late stream')
  })

  it('marks cached live turn idle when background run ends', () => {
    applyBackgroundAppEventToLiveTimeline('/tmp/s1.jsonl', {
      type: 'run',
      phase: 'idle',
      seq: 2,
      workspaceId: '/w',
      sessionId: 's1',
      timestamp: 4,
    })

    expect(getLiveSessionTimeline('/tmp/s1.jsonl')?.runState.status).toBe('idle')
  })

  it('should_flush_pending_assistant_delta_before_background_tool_start', () => {
    const sessionFile = '/tmp/background-tool-race.jsonl'
    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: [
        {
          id: 'assistant-1',
          type: 'assistant-message',
          text: '',
          thinkingText: '',
          timestamp: 1,
        },
      ],
      streamingAssistantId: 'assistant-1',
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'message',
      role: 'assistant',
      phase: 'delta',
      contentKind: 'text',
      text: 'last chunk',
      seq: 1,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 2,
    })
    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'tool',
      phase: 'start',
      toolCallId: 'tool-1',
      toolName: 'read',
      input: {},
      seq: 2,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 3,
    })

    const assistant = getLiveSessionTimeline(sessionFile)?.timelineItems.find(
      (item) => item.id === 'assistant-1',
    )
    expect(assistant?.text).toBe('last chunk')
  })

  it('should_add_delivered_queued_user_turn_to_background_timeline', () => {
    const sessionFile = '/tmp/background-queued-user.jsonl'
    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: [
        {
          id: 'user-1',
          type: 'user-message',
          text: 'first question',
          sessionEntryId: 'user-entry-1',
          timestamp: 1,
        },
        {
          id: 'assistant-1',
          type: 'assistant-message',
          text: 'first answer',
          sessionEntryId: 'assistant-entry-1',
          timestamp: 2,
        },
      ],
      streamingAssistantId: null,
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'message',
      role: 'user',
      phase: 'start',
      text: 'queued follow-up',
      seq: 3,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 5,
    })
    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'message',
      role: 'user',
      phase: 'end',
      sessionEntryId: 'user-entry-2',
      seq: 4,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 6,
    })

    const users = getLiveSessionTimeline(sessionFile)?.timelineItems.filter(
      (item) => item.type === 'user-message',
    )
    expect(users?.map((item) => [item.text, item.sessionEntryId])).toEqual([
      ['first question', 'user-entry-1'],
      ['queued follow-up', 'user-entry-2'],
    ])
  })

  it('should_preserve_repeated_background_delta_chunks', () => {
    const sessionFile = '/tmp/background-repeated-deltas.jsonl'
    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: [
        {
          id: 'assistant-1',
          type: 'assistant-message',
          text: '',
          thinkingText: '',
          timestamp: 1,
        },
      ],
      streamingAssistantId: 'assistant-1',
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    for (const sequence of [1, 2]) {
      applyBackgroundAppEventToLiveTimeline(sessionFile, {
        type: 'message',
        role: 'assistant',
        phase: 'delta',
        contentKind: 'text',
        text: 'ha',
        seq: sequence,
        workspaceId: '/workspace',
        sessionFile,
        timestamp: sequence + 1,
      })
    }

    expect(getLiveSessionTimeline(sessionFile)?.timelineItems.at(-1)?.text).toBe('haha')
  })

  it('should_keep_identical_persisted_background_user_turns_distinct', () => {
    const sessionFile = '/tmp/background-identical-users.jsonl'
    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: [
        {
          id: 'persisted-user-1',
          type: 'user-message',
          text: 'continue',
          sessionEntryId: 'entry-1',
          timestamp: 1,
        },
      ],
      streamingAssistantId: null,
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'message',
      role: 'user',
      phase: 'start',
      text: 'continue',
      seq: 2,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 2,
    })

    expect(
      getLiveSessionTimeline(sessionFile)?.timelineItems.filter(
        (item) => item.type === 'user-message',
      ),
    ).toHaveLength(2)
  })

  it('should_not_reuse_stale_background_optimistic_id_without_pending_marker', () => {
    const sessionFile = '/tmp/background-stale-optimistic-user.jsonl'
    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: [
        {
          id: 'opt-user-stale',
          type: 'user-message',
          text: 'continue',
          sessionEntryId: 'entry-old',
          timestamp: 1,
        },
      ],
      streamingAssistantId: null,
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'message',
      role: 'user',
      phase: 'start',
      text: 'continue',
      runId: 'run-1',
      seq: 2,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 2,
    })

    expect(
      getLiveSessionTimeline(sessionFile)?.timelineItems.filter(
        (item) => item.type === 'user-message',
      ),
    ).toHaveLength(2)
  })

  it('should_reuse_background_optimistic_user_row', () => {
    const sessionFile = '/tmp/background-optimistic-user.jsonl'
    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: [
        {
          id: 'opt-user-1',
          type: 'user-message',
          text: 'continue',
          timestamp: 1,
        },
      ],
      streamingAssistantId: null,
      runState: { status: 'running', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: 'continue',
      agentTurnBootstrapping: true,
    })

    applyBackgroundAppEventToLiveTimeline(sessionFile, {
      type: 'message',
      role: 'user',
      phase: 'start',
      text: 'continue',
      runId: 'run-1',
      seq: 2,
      workspaceId: '/workspace',
      sessionFile,
      timestamp: 2,
    })

    const snapshot = getLiveSessionTimeline(sessionFile)
    expect(snapshot?.timelineItems.filter((item) => item.type === 'user-message')).toHaveLength(1)
    expect(snapshot?.optimisticPendingUserText).toBeNull()
    expect(snapshot?.agentTurnBootstrapping).toBe(false)
  })

  it('should_trim_saved_snapshot_to_background_item_budget', () => {
    const sessionFile = '/tmp/large-live-snapshot.jsonl'
    const items: TimelineItem[] = Array.from(
      { length: BACKGROUND_LIVE_TIMELINE_MAX_ITEMS + 20 },
      (_, index) => ({
        id: `user-${index}`,
        type: 'user-message',
        text: `message ${index}`,
        timestamp: index,
      }),
    )

    saveLiveSessionTimeline({
      sessionId: 'session-1',
      sessionFile,
      timelineItems: items,
      streamingAssistantId: null,
      runState: { status: 'idle', toolCount: 0, errorCount: 0 },
      pendingSteering: [],
      pendingFollowUp: [],
      optimisticPendingUserText: null,
      agentTurnBootstrapping: false,
    })

    expect(getLiveSessionTimeline(sessionFile)?.timelineItems).toHaveLength(
      BACKGROUND_LIVE_TIMELINE_MAX_ITEMS,
    )
  })
})
