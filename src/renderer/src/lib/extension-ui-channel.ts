import { toast } from 'sonner'
import type {
  ExtensionUIDismissEvent,
  ExtensionUIPendingRequest,
  ExtensionUIRequest,
} from '@shared/extension-ui'
import { onExtensionUIRequest, onExtensionUIDismiss, ipcClient } from '@renderer/lib/ipc-client'
import { sessionFilesEqual } from '@renderer/lib/session-file-key'
import { normalizeSessionFileKey } from '@renderer/lib/session-file-key'
import { useExtensionUIStore, type ExtensionUIPending } from '@renderer/stores/extension-ui-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { shouldShowExtensionNotify } from '@renderer/lib/extension-notify-policy'
import { signalDesktopAlert } from '@renderer/lib/desktop-alerts'
import type { AskQuestionPayload } from '@renderer/features/extension-ui/questionnaire-dialog'
import { traceAudioRenderer } from '@renderer/lib/audio-trace'
import { alertTrace } from '@renderer/lib/alert-trace'
import {
  linkExtensionDialogToToolRow,
  reconcileAllStaleInteractiveToolRows,
  reconcileStaleInteractiveToolRows,
} from '@renderer/lib/extension-ui-tool-sync'

let started = false
const seenDialogIds = new Set<string>()
const INTERACTIVE_TOOL_NAMES = new Set(['ask_user_question', 'image_review'])

function visibleSessionFile(): string | null {
  const state = useUIStore.getState()
  if (state.ephemeralSandboxDraft || state.pendingNewSessionPlaceholder) return null
  return state.historySessionFile || state.workerLiveSnapshot.sessionFile
}

function sessionIdentityChanged(current: string | null, previous: string | null): boolean {
  return normalizeSessionFileKey(current) !== normalizeSessionFileKey(previous)
}

function rawToPending(raw: ExtensionUIPendingRequest): ExtensionUIPending | null {
  const identity = { id: raw.id, sessionFile: raw.sessionFile, createdAt: raw.createdAt }
  if (raw.method === 'custom' && raw.kind === 'ask_user_question') {
    return {
      ...identity,
      method: 'ask_user_question',
      questions: (raw.questions as AskQuestionPayload[]) || [],
    }
  }
  if (raw.method === 'custom' && raw.kind === 'image_review') {
    return {
      ...identity,
      method: 'image_review',
      payload: {
        image: raw.image || '',
        title: raw.title || '图片审查',
        question: raw.question || '这张图片是否可用？',
        context: raw.context,
        options: raw.options || ['通过', '需要修改', '重做', '取消'],
        allowFeedback: raw.allowFeedback !== false,
      },
    }
  }
  if (raw.method === 'select') {
    return { ...identity, method: 'select', title: raw.title, options: raw.options || [] }
  }
  if (raw.method === 'confirm') {
    return { ...identity, method: 'confirm', title: raw.title, message: raw.message }
  }
  if (raw.method === 'input') {
    return { ...identity, method: 'input', title: raw.title, placeholder: raw.placeholder }
  }
  return null
}

function handleNotify(request: Extract<ExtensionUIRequest, { method: 'notify' }>): void {
  const type = request.notifyType || 'info'
  const message = request.message
  traceAudioRenderer('extension-ui.notify', { notifyType: type, msg: message.slice(0, 120) })
  const show = shouldShowExtensionNotify(message, type)
  alertTrace('extension notify', { notifyType: type, show, msg: message.slice(0, 120) })
  if (!show) return
  const running = useUIStore.getState().runState.status === 'running'
  if (!running && type !== 'error') return
  if (type === 'error') toast.error(message)
  else if (type === 'warning') toast.warning(message)
  else toast.info(message)
}

function handlePending(raw: ExtensionUIPendingRequest): void {
  const pending = rawToPending(raw)
  if (!pending) return
  const firstDelivery = !seenDialogIds.has(pending.id)
  seenDialogIds.add(pending.id)

  const store = useExtensionUIStore.getState()
  store.upsertPending(pending)
  if (sessionFilesEqual(visibleSessionFile(), pending.sessionFile)) {
    store.activateForSession(pending.sessionFile)
  }
  if (!firstDelivery) return

  traceAudioRenderer('extension-ui.dialog', { method: pending.method, id: pending.id })
  if (INTERACTIVE_TOOL_NAMES.has(pending.method)) {
    linkExtensionDialogToToolRow(pending.id, pending.method)
  }
  if (useUIStore.getState().runState.status === 'running') {
    void signalDesktopAlert('extension_ui', {
      title: 'pi Desktop · 等待操作',
      body: pending.method === 'image_review' ? pending.payload.title : '扩展请求等待操作',
    })
  }
}

function handleDismiss(payload: ExtensionUIDismissEvent): void {
  if (payload.type === 'extension-ui-dismiss-all') {
    for (const pending of Object.values(useExtensionUIStore.getState().pendingById)) {
      if (sessionFilesEqual(pending.sessionFile, payload.sessionFile)) {
        seenDialogIds.delete(pending.id)
        useExtensionUIStore.getState().removePending(pending.id)
      }
    }
    useExtensionUIStore.getState().activateForSession(visibleSessionFile())
    reconcileAllStaleInteractiveToolRows()
    return
  }
  if (!payload.id) return
  seenDialogIds.delete(payload.id)
  useExtensionUIStore.getState().removePending(payload.id)
  useExtensionUIStore.getState().activateForSession(visibleSessionFile())
  reconcileStaleInteractiveToolRows(payload.id)
}

export function clearExtensionDialogDedupe(): void {
  seenDialogIds.clear()
}

export function dismissExtensionDialogState(id?: string): void {
  const store = useExtensionUIStore.getState()
  const requestId = id || store.activeRequestId || undefined
  if (!requestId) return
  store.resetForSessionContext()
}

export function ensureExtensionUIChannel(): void {
  if (started) return
  started = true

  onExtensionUIDismiss(handleDismiss)
  onExtensionUIRequest((request) => {
    if (request.method === 'notify') handleNotify(request)
    else handlePending(request)
  })
  useUIStore.subscribe((state, previous) => {
    const current = state.historySessionFile || state.workerLiveSnapshot.sessionFile
    const prior = previous.historySessionFile || previous.workerLiveSnapshot.sessionFile
    if (sessionIdentityChanged(current, prior)) {
      useExtensionUIStore.getState().activateForSession(current, true)
    }
  })

  void ipcClient.invoke('extension.pendingUI', {}).then((result) => {
    for (const request of result.requests || []) handlePending(request)
  })
}
