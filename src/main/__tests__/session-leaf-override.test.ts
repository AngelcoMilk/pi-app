import { beforeEach, describe, expect, it } from 'vitest'
import type { AppEvent } from '@shared/app-events'
import {
  applySettledRunToSessionLeafOverride,
  clearSessionLeafOverride,
  getSessionLeafOverride,
  setSessionLeafOverride,
} from '../session-leaf-override'

describe('session leaf override lifecycle', () => {
  beforeEach(() => {
    clearSessionLeafOverride()
  })

  it('should_clear_rewind_override_after_matching_session_settles', () => {
    const sessionFile = '/workspace/session-a.jsonl'
    setSessionLeafOverride(sessionFile, 'rewound-leaf')

    applySettledRunToSessionLeafOverride({
      type: 'run',
      phase: 'idle',
      settled: true,
      sessionFile,
      seq: 1,
      workspaceId: '/workspace',
      timestamp: 1,
    } as AppEvent)

    expect(getSessionLeafOverride(sessionFile)).toBeUndefined()
  })

  it('should_keep_override_for_other_sessions_and_nonterminal_events', () => {
    const sessionFile = '/workspace/session-a.jsonl'
    setSessionLeafOverride(sessionFile, 'rewound-leaf')

    applySettledRunToSessionLeafOverride({
      type: 'run',
      phase: 'running',
      sessionFile,
      seq: 1,
      workspaceId: '/workspace',
      timestamp: 1,
    } as AppEvent)
    applySettledRunToSessionLeafOverride({
      type: 'run',
      phase: 'idle',
      settled: true,
      sessionFile: '/workspace/session-b.jsonl',
      seq: 2,
      workspaceId: '/workspace',
      timestamp: 2,
    } as AppEvent)

    expect(getSessionLeafOverride(sessionFile)).toBe('rewound-leaf')
  })
})
