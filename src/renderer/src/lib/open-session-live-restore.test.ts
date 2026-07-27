import { describe, expect, it } from 'vitest'
import { mergeLiveActiveSessionDisplay } from './open-session-live-restore'
import type { TimelineItem } from '@renderer/stores/ui-store-types'

describe('mergeLiveActiveSessionDisplay', () => {
  it('merges authoritative disk tail with live cache and projects', () => {
    const diskItems: TimelineItem[] = [
      { id: 'u1', type: 'user-message', text: 'hi', timestamp: 1 },
      { id: 'a1', type: 'assistant-message', text: 'old', timestamp: 2 },
    ]
    const liveItems: TimelineItem[] = [
      { id: 'u1', type: 'user-message', text: 'hi', timestamp: 1 },
      { id: 'a2', type: 'assistant-message', text: 'live', runId: 'r1', timestamp: 3 },
    ]
    const { displayed } = mergeLiveActiveSessionDisplay({
      diskItems,
      live: {
        sessionId: 's1',
        sessionFile: '/f.jsonl',
        timelineItems: liveItems,
        streamingAssistantId: 'a2',
        runState: { status: 'running', toolCount: 0, errorCount: 0 },
        pendingSteering: [],
        pendingFollowUp: [],
        optimisticPendingUserText: null,
        agentTurnBootstrapping: false,
      },
      totalCount: 50,
      cursor: { totalCount: 50, loadedOffsetFromEnd: 2, loadedThroughEntryId: null },
    })
    expect(displayed.some((i) => i.type === 'assistant-message' && i.text?.includes('live'))).toBe(true)
  })

  it('should_remap_active_live_id_to_displayed_structural_assistant', () => {
    const { displayed, mergedStreamId } = mergeLiveActiveSessionDisplay({
      diskItems: [
        {
          id: 'disk-user',
          type: 'user-message',
          text: 'question',
          turnId: 'turn-1',
          timestamp: 1,
        },
        {
          id: 'disk-assistant',
          type: 'assistant-message',
          text: 'richer disk partial',
          runId: 'run-1',
          turnId: 'turn-1',
          timestamp: 2,
        },
      ],
      live: {
        sessionId: 's1',
        sessionFile: '/f.jsonl',
        timelineItems: [
          {
            id: 'live-assistant',
            type: 'assistant-message',
            text: 'live',
            runId: 'run-1',
            turnId: 'turn-1',
            timestamp: 3,
          },
        ],
        streamingAssistantId: 'live-assistant',
        runState: { status: 'running', toolCount: 0, errorCount: 0 },
        pendingSteering: [],
        pendingFollowUp: [],
        optimisticPendingUserText: null,
        agentTurnBootstrapping: false,
      },
      totalCount: 2,
      cursor: { totalCount: 2, loadedOffsetFromEnd: 2, loadedThroughEntryId: null },
    })

    expect(mergedStreamId).toBe('disk-assistant')
    expect(
      displayed.some(
        (item) => item.type === 'assistant-message' && item.id === mergedStreamId,
      ),
    ).toBe(true)
  })

  it('should_not_remap_same_run_assistant_from_different_turn', () => {
    const { displayed, mergedStreamId } = mergeLiveActiveSessionDisplay({
      diskItems: [
        { id: 'disk-user', type: 'user-message', text: 'q2', turnId: 'turn-2', timestamp: 1 },
        {
          id: 'disk-assistant',
          type: 'assistant-message',
          text: 'current answer',
          runId: 'run-shared',
          turnId: 'turn-2',
          timestamp: 2,
        },
      ],
      live: {
        sessionId: 's1',
        sessionFile: '/f.jsonl',
        timelineItems: [
          {
            id: 'stale-assistant',
            type: 'assistant-message',
            text: 'stale answer',
            runId: 'run-shared',
            turnId: 'turn-1',
            timestamp: 3,
          },
        ],
        streamingAssistantId: 'stale-assistant',
        runState: { status: 'running', toolCount: 0, errorCount: 0 },
        pendingSteering: [],
        pendingFollowUp: [],
        optimisticPendingUserText: null,
        agentTurnBootstrapping: false,
      },
      totalCount: 2,
      cursor: { totalCount: 2, loadedOffsetFromEnd: 2, loadedThroughEntryId: null },
    })

    expect(displayed.at(-1)?.text).toBe('current answer')
    expect(mergedStreamId).toBeNull()
  })

  it('should_keep_terminal_display_stream_id_null', () => {
    const { mergedStreamId } = mergeLiveActiveSessionDisplay({
      diskItems: [
        { id: 'disk-user', type: 'user-message', text: 'question', timestamp: 1 },
        {
          id: 'disk-assistant',
          type: 'assistant-message',
          text: 'complete answer',
          runId: 'run-1',
          timestamp: 2,
        },
      ],
      live: {
        sessionId: 's1',
        sessionFile: '/f.jsonl',
        timelineItems: [
          {
            id: 'terminal-assistant',
            type: 'assistant-message',
            text: 'complete answer',
            runId: 'run-1',
            timestamp: 3,
          },
        ],
        streamingAssistantId: null,
        runState: { status: 'idle', toolCount: 0, errorCount: 0 },
        pendingSteering: [],
        pendingFollowUp: [],
        optimisticPendingUserText: null,
        agentTurnBootstrapping: false,
      },
      totalCount: 2,
      cursor: { totalCount: 2, loadedOffsetFromEnd: 2, loadedThroughEntryId: null },
    })

    expect(mergedStreamId).toBeNull()
  })
})