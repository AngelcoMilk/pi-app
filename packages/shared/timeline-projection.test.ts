import { describe, expect, it } from 'vitest'
import { projectTimelineItems } from './timeline-projection'

describe('projectTimelineItems', () => {
  it('merges adjacent assistant messages with same runId', () => {
    const items = projectTimelineItems([
      { id: '1', type: 'assistant-message', text: 'Hel', runId: 'r1', timestamp: 1 },
      { id: '2', type: 'assistant-message', text: 'lo', runId: 'r1', timestamp: 2 },
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

  it('does not merge assistant across different runId', () => {
    const items = projectTimelineItems([
      { id: '1', type: 'assistant-message', text: 'a', runId: 'r1', timestamp: 1 },
      { id: '2', type: 'assistant-message', text: 'b', runId: 'r2', timestamp: 2 },
    ])
    expect(items).toHaveLength(2)
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