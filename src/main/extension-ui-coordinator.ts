import type { BrowserWindow } from 'electron'
import type {
  ExtensionUIDismissEvent,
  ExtensionUIDismissReason,
  ExtensionUIPendingRequest,
  ExtensionUIRequest,
  ExtensionUIResponse,
  ExtensionUIResponseResult,
} from '@shared/extension-ui'
import { isInteractiveExtensionUIRequest } from '@shared/extension-ui'
import { ExtensionUIRequestRegistry } from './extension-ui-request-registry'
import { slotRequest } from './worker-manager-pool'
import type { WorkerSlot } from './worker-manager-types'

export class ExtensionUICoordinator {
  private readonly registry = new ExtensionUIRequestRegistry()

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly getForegroundPoolKey: () => string | null,
  ) {}

  handleRequest(slot: WorkerSlot, sessionFile: string, request: ExtensionUIRequest): void {
    if (!isInteractiveExtensionUIRequest(request)) {
      const foreground = this.getForegroundPoolKey()
      const isForeground = !foreground || foreground === slot.poolKey
      const allow = slot.agentTurnActive || request.notifyType === 'error'
      if (allow && (isForeground || request.notifyType === 'error')) {
        this.send('ipc:extension-ui-request', request)
      }
      return
    }
    const pending = this.registry.register(slot, sessionFile, request)
    if (pending) this.send('ipc:extension-ui-request', pending)
  }

  handleDismiss(
    slot: WorkerSlot,
    payload: { type: 'extension-ui-dismiss' | 'extension-ui-dismiss-all'; id?: string; reason?: string },
  ): void {
    const reason = (payload.reason || 'abort') as ExtensionUIDismissReason
    if (payload.type === 'extension-ui-dismiss' && payload.id) {
      const pending = this.registry.dismiss(slot, payload.id)
      if (pending) this.sendDismiss(payload.type, pending.sessionFile, reason, payload.id)
      return
    }
    for (const pending of this.registry.dismissAll(slot)) {
      this.sendDismiss('extension-ui-dismiss', pending.sessionFile, reason, pending.id)
    }
  }

  handleSlotExit(slot: WorkerSlot): void {
    for (const pending of this.registry.dismissAll(slot)) {
      this.sendDismiss('extension-ui-dismiss', pending.sessionFile, 'worker-exit', pending.id)
    }
  }

  listPending(): ExtensionUIPendingRequest[] {
    return this.registry.list()
  }

  async respond(response: ExtensionUIResponse): Promise<ExtensionUIResponseResult> {
    const entry = this.registry.beginResponse(response.id)
    if (!entry) return { ok: false, error: 'request-not-found' }
    let handled = false
    try {
      const result = await slotRequest(entry.slot, 'extension-ui-response', { response })
      handled = result.handled === true
    } catch {
      handled = false
    }
    const pending = this.registry.finishResponse(response.id, handled)
    if (!pending) return { ok: false, error: 'worker-rejected' }
    this.sendDismiss('extension-ui-dismiss', pending.sessionFile, 'answered', pending.id)
    return { ok: true }
  }

  private sendDismiss(
    type: ExtensionUIDismissEvent['type'],
    sessionFile: string,
    reason: ExtensionUIDismissReason,
    id?: string,
  ): void {
    this.send('ipc:extension-ui-dismiss', { type, id, sessionFile, reason })
  }

  private send(channel: string, payload: unknown): void {
    const win = this.getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }
}
