import { describe, expect, it } from 'vitest'
import { projectTimelineItems } from './timeline-projection'

describe('projectTimelineItems', () => {
  it('merges adjacent assistant messages with same turnId', () => {
    const items = projectTimelineItems([
      {
        id: '1',
        type: 'assistant-message',
        text: 'Hel',
        runId: 'r1',
        turnId: 'turn-1',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'assistant-message',
        text: 'lo',
        runId: 'r1',
        turnId: 'turn-1',
        timestamp: 2,
      },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('Hello')
  })

  it('merges tool lifecycle by toolCallId', () => {
    const items = projectTimelineItems([
      {
        id: '1',
        type: 'tool-call',
        toolCallId: 'tc1',
        toolPhase: 'start',
        toolName: 'read',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'tool-call',
        toolCallId: 'tc1',
        toolPhase: 'end',
        toolOutput: 'ok',
        timestamp: 2,
      },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].toolPhase).toBe('end')
    expect(items[0].toolOutput).toBe('ok')
  })

  it('does not use runId as assistant turn proof', () => {
    const items = projectTimelineItems([
      { id: '1', type: 'assistant-message', text: 'a', runId: 'r1', timestamp: 1 },
      { id: '2', type: 'assistant-message', text: 'b', runId: 'r1', timestamp: 2 },
    ])
    expect(items).toHaveLength(2)
  })

  it('does not merge same-run assistants across different turnId', () => {
    const items = projectTimelineItems([
      {
        id: '1',
        type: 'assistant-message',
        text: 'first turn',
        runId: 'r1',
        turnId: 'turn-1',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'assistant-message',
        text: 'second turn',
        runId: 'r1',
        turnId: 'turn-2',
        timestamp: 2,
      },
    ])

    expect(items).toHaveLength(2)
  })

  it('merges matching turnId and preserves it on assistant and tool rows', () => {
    const assistants = projectTimelineItems([
      {
        id: '1',
        type: 'assistant-message',
        text: 'Hel',
        runId: 'r1',
        turnId: 'turn-1',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'assistant-message',
        text: 'lo',
        runId: 'r1',
        turnId: 'turn-1',
        timestamp: 2,
      },
    ])
    const tools = projectTimelineItems([
      {
        id: '3',
        type: 'tool-call',
        toolCallId: 'tc2',
        toolPhase: 'start',
        turnId: 'turn-1',
        timestamp: 3,
      },
      {
        id: '4',
        type: 'tool-call',
        toolCallId: 'tc2',
        toolPhase: 'end',
        toolOutput: 'ok',
        turnId: 'turn-1',
        timestamp: 4,
      },
    ])

    expect(assistants).toHaveLength(1)
    expect(assistants[0]).toMatchObject({ text: 'Hello', turnId: 'turn-1' })
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({ toolPhase: 'end', turnId: 'turn-1' })
  })

  it('does not merge adjacent assistants when only one has runId', () => {
    const items = projectTimelineItems([
      { id: '1', type: 'assistant-message', text: 'first turn', timestamp: 1 },
      { id: '2', type: 'assistant-message', text: 'second turn', runId: 'r2', timestamp: 2 },
    ])
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('first turn')
    expect(items[1].text).toBe('second turn')
  })

  it('does not merge disk assistants with different sessionEntryId', () => {
    const items = projectTimelineItems([
      {
        id: '1',
        type: 'assistant-message',
        text: 'answer A',
        sessionEntryId: 'asst-a',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'assistant-message',
        text: 'answer B',
        sessionEntryId: 'asst-b',
        timestamp: 2,
      },
    ])
    expect(items).toHaveLength(2)
  })

  it('still merges pure stream fragments without runId or sessionEntryId', () => {
    const items = projectTimelineItems([
      { id: '1', type: 'assistant-message', text: 'Hel', timestamp: 1 },
      { id: '2', type: 'assistant-message', text: 'lo', timestamp: 2 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('Hello')
  })
})