import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerSlot } from '../worker-manager-types'
import { WorkerManager } from '../worker-manager'
import { attachWorkerHandlers } from '../worker-manager-pool'
import { normalizeSessionKey } from '../worker-session-key'

vi.mock('../config-store', () => ({
  configStore: { get: vi.fn(() => undefined) },
}))

type FakeTransport = WorkerSlot['worker'] & {
  postMessage: ReturnType<typeof vi.fn>
  emitMessage: (message: Record<string, unknown>) => void
}

type MessageHandler = Parameters<WorkerSlot['worker']['onMessage']>[0]
type WorkerMessage = Parameters<MessageHandler>[0]

function fakeTransport(): FakeTransport {
  let onMessage: MessageHandler | null = null
  return {
    kind: 'utilityProcess',
    postMessage: vi.fn((_message: Record<string, unknown>) => {}),
    onMessage: (callback) => {
      onMessage = callback
    },
    onExit: vi.fn(),
    onStdout: vi.fn(),
    onStderr: vi.fn(),
    kill: vi.fn(),
    emitMessage: (message) => onMessage?.(message as WorkerMessage),
  }
}

function fakeSlot(sessionFile: string): WorkerSlot {
  return {
    poolKey: sessionFile,
    cwd: '/workspace',
    runtime: { mode: 'host', distro: null },
    sessionFile,
    worker: fakeTransport(),
    pendingRequests: new Map(),
    requestCounter: 0,
    initResolver: null,
    initRejecter: null,
    initPromise: null,
    agentTurnActive: false,
    lastIdleAt: Date.now(),
    lastForegroundAt: Date.now(),
    sdkFallback: false,
    autoRestartEnabled: true,
    stopping: false,
  }
}

function attach(slot: WorkerSlot, preview: Record<string, unknown>): void {
  const worker = slot.worker as FakeTransport
  attachWorkerHandlers(slot, worker, {
    mainWindow: null,
    onAppEvent: vi.fn(),
    onSlotExit: vi.fn(),
  })
  worker.postMessage.mockImplementation((message: Record<string, unknown>) => {
    queueMicrotask(() => worker.emitMessage({
      requestId: message.requestId as string | undefined,
      type: 'getSessionContextPreview-done',
      preview,
    }))
  })
}

describe('WorkerManager context preview isolation', () => {
  let manager: WorkerManager
  let internals: {
    pool: Map<string, WorkerSlot>
    foregroundPoolKey: string | null
  }

  beforeEach(() => {
    manager = new WorkerManager()
    internals = manager as unknown as typeof internals
  })

  it('queries only the existing slot bound to the requested session', async () => {
    const foregroundKey = normalizeSessionKey('/sessions/foreground.jsonl')
    const targetKey = normalizeSessionKey('/sessions/target.jsonl')
    const foreground = fakeSlot(foregroundKey)
    const target = fakeSlot(targetKey)
    attach(foreground, { sessionFile: foregroundKey, estimatedChars: 11 })
    attach(target, { sessionFile: targetKey, estimatedChars: 22 })
    internals.pool.set(foregroundKey, foreground)
    internals.pool.set(targetKey, target)
    internals.foregroundPoolKey = foregroundKey

    const preview = await manager.getSessionContextPreview(targetKey)

    expect(preview).toEqual(expect.objectContaining({
      sessionFile: targetKey,
      estimatedChars: 22,
    }))
    expect(foreground.worker.postMessage).not.toHaveBeenCalled()
    expect(target.worker.postMessage).toHaveBeenCalledOnce()
  })

  it('returns null when the requested session has no live slot', async () => {
    const foregroundKey = normalizeSessionKey('/sessions/foreground.jsonl')
    const missingKey = normalizeSessionKey('/sessions/missing.jsonl')
    const foreground = fakeSlot(foregroundKey)
    attach(foreground, { sessionFile: foregroundKey, estimatedChars: 11 })
    internals.pool.set(foregroundKey, foreground)
    internals.foregroundPoolKey = foregroundKey

    const preview = await manager.getSessionContextPreview(missingKey)

    expect(preview).toBeNull()
    expect(foreground.worker.postMessage).not.toHaveBeenCalled()
    expect(internals.pool.has(missingKey)).toBe(false)
  })
})
