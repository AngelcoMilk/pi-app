import type {
  ExtensionUIPendingRequest,
  ExtensionUIInteractiveRequest,
} from '@shared/extension-ui'
import { sessionFilePathsEqual } from '@shared/session-file-path'
import type { WorkerSlot } from './worker-manager-types'

export type ExtensionUIRegistryEntry = {
  pending: ExtensionUIPendingRequest
  slot: WorkerSlot
  responding: boolean
}

export class ExtensionUIRequestRegistry {
  private readonly entries = new Map<string, ExtensionUIRegistryEntry>()

  register(
    slot: WorkerSlot,
    sessionFile: string,
    request: ExtensionUIInteractiveRequest,
  ): ExtensionUIPendingRequest | null {
    if (!slot.sessionFile || !sessionFilePathsEqual(slot.sessionFile, sessionFile)) return null
    const existing = this.entries.get(request.id)
    if (existing && existing.slot !== slot) return null
    if (existing) return existing.pending

    const pending = { ...request, sessionFile: slot.sessionFile, createdAt: Date.now() }
    this.entries.set(request.id, { pending, slot, responding: false })
    slot.pendingExtensionUiCount++
    return pending
  }

  list(): ExtensionUIPendingRequest[] {
    return [...this.entries.values()]
      .map((entry) => entry.pending)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  beginResponse(id: string): ExtensionUIRegistryEntry | null {
    const entry = this.entries.get(id)
    if (!entry || entry.responding || entry.slot.stopping) return null
    entry.responding = true
    return entry
  }

  finishResponse(id: string, handled: boolean): ExtensionUIPendingRequest | null {
    const entry = this.entries.get(id)
    if (!entry) return null
    if (!handled) {
      entry.responding = false
      return null
    }
    this.deleteEntry(id, entry)
    return entry.pending
  }

  dismiss(slot: WorkerSlot, id: string): ExtensionUIPendingRequest | null {
    const entry = this.entries.get(id)
    if (!entry || entry.slot !== slot) return null
    this.deleteEntry(id, entry)
    return entry.pending
  }

  dismissAll(slot: WorkerSlot): ExtensionUIPendingRequest[] {
    const removed: ExtensionUIPendingRequest[] = []
    for (const [id, entry] of [...this.entries]) {
      if (entry.slot !== slot) continue
      removed.push(entry.pending)
      this.deleteEntry(id, entry)
    }
    return removed
  }

  private deleteEntry(id: string, entry: ExtensionUIRegistryEntry): void {
    if (!this.entries.delete(id)) return
    entry.slot.pendingExtensionUiCount = Math.max(0, entry.slot.pendingExtensionUiCount - 1)
  }
}
