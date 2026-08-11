import { describe, expect, it } from 'vitest'
import { buildSessionContextPreview } from './session-context-preview'

describe('buildSessionContextPreview', () => {
  it('builds the same scoped preview for live and disk session messages', () => {
    const preview = buildSessionContextPreview({
      sessionId: 'session-a',
      sessionFile: '/sessions/a.jsonl',
      systemPrompt: 'system',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: [{ type: 'text', text: 'world' }] },
        { role: 'toolResult', toolName: 'read', content: 'result' },
        { role: 'compactionSummary', content: 'summary' },
      ],
    })

    expect(preview).toEqual(expect.objectContaining({
      sessionId: 'session-a',
      sessionFile: '/sessions/a.jsonl',
      messageCount: 4,
      estimatedChars: 29,
      roleBreakdown: [
        { role: 'system', chars: 6 },
        { role: 'user', chars: 5 },
        { role: 'assistant', chars: 5 },
        { role: 'tool', chars: 6 },
        { role: 'summary', chars: 7 },
      ],
    }))
    expect(preview.segments.map((segment) => segment.role)).toEqual([
      'system',
      'user',
      'assistant',
      'toolResult',
      'compactionSummary',
    ])
  })
})
