import { sessionFilePathsEqual } from '@shared/session-file-path'
import type { WorkerResponsePayload } from '@shared/worker-rpc-types'
import { normalizeSessionKey } from './worker-session-key'
import type { WorkerSlot } from './worker-manager-types'

type RequestOnSlot = (
  slot: WorkerSlot,
  type: string,
  data?: Record<string, unknown>,
) => Promise<WorkerResponsePayload>

export async function bindWorkerSlotToSession(
  slot: WorkerSlot,
  sessionFile: string,
  request: RequestOnSlot,
  options?: { force?: boolean; leafId?: string | null },
): Promise<WorkerResponsePayload> {
  const target = normalizeSessionKey(sessionFile)
  if (!target) throw new Error('sessionFile required')

  if (!options && sessionFilePathsEqual(slot.verifiedSessionFile, target)) {
    return { type: 'loadSession-done', sessionFile: slot.verifiedSessionFile }
  }

  if (slot.bindingPromise) {
    await slot.bindingPromise
    if (sessionFilePathsEqual(slot.verifiedSessionFile, target) && !options) {
      return { type: 'loadSession-done', sessionFile: slot.verifiedSessionFile }
    }
  }

  slot.targetSessionFile = target
  slot.sessionFile = target
  slot.verifiedSessionFile = null
  slot.bindingTargetSessionFile = target

  let response: WorkerResponsePayload = {}
  const binding = (async () => {
    response = await request(slot, 'loadSession', {
      sessionFile: target,
      ...(options?.force ? { force: true } : {}),
      ...(options && 'leafId' in options ? { leafId: options.leafId } : {}),
    })
    const actual = normalizeSessionKey(String(response.sessionFile || ''))
    if (!actual || !sessionFilePathsEqual(actual, target)) {
      throw new Error('WORKER_SESSION_BIND_MISMATCH')
    }
    slot.verifiedSessionFile = actual
  })()
  slot.bindingPromise = binding

  try {
    await binding
    return response
  } catch (error) {
    slot.targetSessionFile = null
    slot.sessionFile = null
    slot.verifiedSessionFile = null
    throw error
  } finally {
    if (slot.bindingPromise === binding) {
      slot.bindingPromise = null
      slot.bindingTargetSessionFile = null
    }
  }
}
