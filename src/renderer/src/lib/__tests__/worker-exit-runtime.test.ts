import { describe, expect, it, vi } from 'vitest'
import { clearExitedSessionRuntime } from '../worker-exit-runtime'

describe('clearExitedSessionRuntime', () => {
  it('clears the exited session running projection without touching other sessions', () => {
    const setSessionRuntimeRunning = vi.fn()

    clearExitedSessionRuntime(
      { code: 17, cwd: '/workspace', sessionFile: '/workspace/session.jsonl' },
      setSessionRuntimeRunning,
    )

    expect(setSessionRuntimeRunning).toHaveBeenCalledOnce()
    expect(setSessionRuntimeRunning).toHaveBeenCalledWith('/workspace/session.jsonl', false)
  })

  it('does nothing when the exited worker was not bound to a session', () => {
    const setSessionRuntimeRunning = vi.fn()

    clearExitedSessionRuntime({ code: 0, cwd: '/workspace', sessionFile: null }, setSessionRuntimeRunning)

    expect(setSessionRuntimeRunning).not.toHaveBeenCalled()
  })
})
