import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkerSlot } from '../worker-manager-types'
import { WorkerManager } from '../worker-manager'
import { attachWorkerHandlers } from '../worker-manager-pool'
import { normalizeSessionKey, workspacePoolKey } from '../worker-session-key'

vi.mock('../config-store', () => ({
  configStore: { get: vi.fn(() => undefined) },
}))

const { disposeWorkerSlot, forkWorkerForCwd } = vi.hoisted(() => ({
  disposeWorkerSlot: vi.fn(async () => {}),
  forkWorkerForCwd: vi.fn(),
}))

vi.mock('../worker-manager-pool', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../worker-manager-pool')>()
  return { ...actual, disposeWorkerSlot, forkWorkerForCwd }
})

type FakeTransport = WorkerSlot['worker'] & {
  postMessage: ReturnType<typeof vi.fn>
  emitMessage: (message: Record<string, unknown>) => void
}
type WorkerMessageHandler = Parameters<WorkerSlot['worker']['onMessage']>[0]
type WorkerMessage = Parameters<WorkerMessageHandler>[0]

function fakeTransport(): FakeTransport {
  let onMessage: WorkerMessageHandler | null = null
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
    emitMessage: (message) => {
      onMessage?.(message as WorkerMessage)
    },
  }
}

function fakeSlot(
  poolKey: string,
  active: boolean,
  runtime: WorkerSlot['runtime'] = { mode: 'host', distro: null },
): WorkerSlot {
  return {
    poolKey,
    cwd: '/workspace',
    runtime,
    sessionFile: poolKey.startsWith('ws:') ? null : poolKey,
    worker: fakeTransport(),
    pendingRequests: new Map(),
    requestCounter: 0,
    initResolver: null,
    initRejecter: null,
    initPromise: null,
    agentTurnActive: active,
    lastIdleAt: Date.now(),
    lastForegroundAt: Date.now(),
    sdkFallback: false,
    autoRestartEnabled: true,
    stopping: false,
  }
}

function wireReply(slot: WorkerSlot, reply: Record<string, unknown>): void {
  const worker = slot.worker as FakeTransport
  worker.postMessage.mockImplementation((message: { requestId?: string }) => {
    queueMicrotask(() => worker.emitMessage({ requestId: message.requestId, ...reply }))
  })
}

describe('WorkerManager new-session isolation', () => {
  beforeEach(() => {
    forkWorkerForCwd.mockReset()
    disposeWorkerSlot.mockReset()
  })

  it('reuses an idle unbound workspace worker', async () => {
    const manager = new WorkerManager()
    const internals = manager as unknown as {
      pool: Map<string, WorkerSlot>
      foregroundPoolKey: string | null
    }
    const workspaceKey = workspacePoolKey('/workspace')
    const workspace = fakeSlot(workspaceKey, false)
    internals.pool.set(workspaceKey, workspace)
    internals.foregroundPoolKey = workspaceKey
    attachWorkerHandlers(workspace, workspace.worker, {
      mainWindow: null,
      onAppEvent: vi.fn(),
      onSlotExit: vi.fn(),
    })
    const createdFile = normalizeSessionKey('/sessions/reused.jsonl')
    wireReply(workspace, {
      type: 'newSession-done',
      sessionId: 'reused-session',
      sessionFile: createdFile,
    })

    const result = await manager.newSession('/workspace')

    expect(result).toEqual({ sessionId: 'reused-session', sessionFile: createdFile })
    expect(forkWorkerForCwd).not.toHaveBeenCalled()
    expect(internals.pool.get(createdFile)).toBe(workspace)
    expect(internals.foregroundPoolKey).toBe(createdFile)
  })

  it('creates a new worker instead of sending newSession to the running foreground session', async () => {
    const manager = new WorkerManager()
    const internals = manager as unknown as {
      pool: Map<string, WorkerSlot>
      foregroundPoolKey: string | null
    }
    const runningKey = normalizeSessionKey('/sessions/running.jsonl')
    const running = fakeSlot(runningKey, true)
    internals.pool.set(runningKey, running)
    internals.foregroundPoolKey = runningKey
    attachWorkerHandlers(running, running.worker, {
      mainWindow: null,
      onAppEvent: vi.fn(),
      onSlotExit: vi.fn(),
    })
    wireReply(running, { type: 'error', error: 'SESSION_BUSY' })

    const created = fakeSlot(workspacePoolKey('/workspace'), false)
    forkWorkerForCwd.mockResolvedValue({ slot: created, init: Promise.resolve({ sessionId: 'temporary' }) })
    const createdFile = normalizeSessionKey('/sessions/new.jsonl')
    wireReply(created, { type: 'newSession-done', sessionId: 'new-session', sessionFile: createdFile })

    const result = await manager.newSession('/workspace')

    expect(result).toEqual({ sessionId: 'new-session', sessionFile: createdFile })
    expect(forkWorkerForCwd).toHaveBeenCalledWith('/workspace', {
      poolKey: workspacePoolKey('/workspace'),
      sessionFile: null,
    })
    expect(internals.pool.get(runningKey)).toBe(running)
    expect(running.agentTurnActive).toBe(true)
    expect(internals.foregroundPoolKey).toBe(createdFile)
  })

  it('does not reuse an unbound worker from a different runtime', async () => {
    const manager = new WorkerManager()
    const internals = manager as unknown as {
      pool: Map<string, WorkerSlot>
      foregroundPoolKey: string | null
    }
    const workspaceKey = workspacePoolKey('/workspace')
    const wslWorkspace = fakeSlot(workspaceKey, false, { mode: 'wsl', distro: 'Ubuntu' })
    internals.pool.set(workspaceKey, wslWorkspace)
    internals.foregroundPoolKey = workspaceKey

    const created = fakeSlot(`${workspaceKey}:new:1`, false)
    forkWorkerForCwd.mockResolvedValue({ slot: created, init: Promise.resolve({ sessionId: 'temporary' }) })
    const createdFile = normalizeSessionKey('/sessions/host.jsonl')
    wireReply(created, { type: 'newSession-done', sessionId: 'host-session', sessionFile: createdFile })

    const result = await manager.newSession('/workspace')

    expect(result).toEqual({ sessionId: 'host-session', sessionFile: createdFile })
    expect(forkWorkerForCwd).toHaveBeenCalledWith('/workspace', {
      poolKey: `${workspaceKey}:new:1`,
      sessionFile: null,
    })
    expect(wslWorkspace.worker.postMessage).not.toHaveBeenCalled()
  })

  it('sends abort only to the worker bound to the requested session', async () => {
    const manager = new WorkerManager()
    const internals = manager as unknown as {
      pool: Map<string, WorkerSlot>
      foregroundPoolKey: string | null
    }
    const foregroundKey = normalizeSessionKey('/sessions/foreground.jsonl')
    const requestedKey = normalizeSessionKey('/sessions/requested.jsonl')
    const foreground = fakeSlot(foregroundKey, true)
    const requested = fakeSlot(requestedKey, true)
    internals.pool.set(foregroundKey, foreground)
    internals.pool.set(requestedKey, requested)
    internals.foregroundPoolKey = foregroundKey
    attachWorkerHandlers(requested, requested.worker, {
      mainWindow: null,
      onAppEvent: vi.fn(),
      onSlotExit: vi.fn(),
    })
    wireReply(requested, { type: 'abort-done' })

    await manager.abort(requestedKey)

    expect(foreground.worker?.postMessage).not.toHaveBeenCalled()
    expect(requested.worker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'abort', sessionFile: requestedKey }),
    )
    expect(foreground.agentTurnActive).toBe(true)
  })

  it('rolls back a newly forked worker when newSession fails', async () => {
    const manager = new WorkerManager()
    const internals = manager as unknown as {
      pool: Map<string, WorkerSlot>
      foregroundPoolKey: string | null
    }
    const runningKey = normalizeSessionKey('/sessions/running.jsonl')
    const running = fakeSlot(runningKey, true)
    internals.pool.set(runningKey, running)
    internals.foregroundPoolKey = runningKey

    const created = fakeSlot(workspacePoolKey('/workspace'), false)
    forkWorkerForCwd.mockResolvedValue({ slot: created, init: Promise.resolve({ sessionId: 'temporary' }) })
    wireReply(created, { type: 'error', error: 'SESSION_NEW_CANCELLED' })

    await expect(manager.newSession('/workspace')).rejects.toThrow('SESSION_NEW_CANCELLED')

    expect(disposeWorkerSlot).toHaveBeenCalledWith(created)
    expect(internals.pool.has(workspacePoolKey('/workspace'))).toBe(false)
    expect(internals.pool.get(runningKey)).toBe(running)
    expect(internals.foregroundPoolKey).toBe(runningKey)
  })

  it('serializes concurrent new-session creation without losing worker slots', async () => {
    const manager = new WorkerManager()
    const internals = manager as unknown as {
      pool: Map<string, WorkerSlot>
      foregroundPoolKey: string | null
    }
    const runningKey = normalizeSessionKey('/sessions/running.jsonl')
    internals.pool.set(runningKey, fakeSlot(runningKey, true))
    internals.foregroundPoolKey = runningKey

    let sequence = 0
    forkWorkerForCwd.mockImplementation(async (_cwd: string, options?: { poolKey?: string }) => {
      const index = ++sequence
      const slot = fakeSlot(options?.poolKey || workspacePoolKey('/workspace'), false)
      const sessionFile = normalizeSessionKey(`/sessions/new-${index}.jsonl`)
      wireReply(slot, {
        type: 'newSession-done',
        sessionId: `new-${index}`,
        sessionFile,
      })
      return { slot, init: Promise.resolve({ sessionId: `temporary-${index}` }) }
    })

    const results = await Promise.all([
      manager.newSession('/workspace'),
      manager.newSession('/workspace'),
    ])

    expect(results.map((result) => result.sessionId)).toEqual(['new-1', 'new-2'])
    expect(forkWorkerForCwd).toHaveBeenCalledTimes(2)
    expect(internals.pool.has(normalizeSessionKey('/sessions/new-1.jsonl'))).toBe(true)
    expect(internals.pool.has(normalizeSessionKey('/sessions/new-2.jsonl'))).toBe(true)
    expect(internals.foregroundPoolKey).toBe(normalizeSessionKey('/sessions/new-2.jsonl'))
  })
})
