import { create } from 'zustand'
import { sessionFilesEqual } from '@renderer/lib/session-file-key'
import { useUIStore } from '@renderer/stores/ui-store'
import type { AskQuestionPayload } from '@renderer/features/extension-ui/questionnaire-dialog'
import type { ImageReviewPayload } from '@renderer/features/extension-ui/image-review-dialog'

type PendingIdentity = { id: string; sessionFile: string; createdAt: number }

export type ExtensionUIPending = PendingIdentity &
  (
    | { method: 'ask_user_question'; questions: AskQuestionPayload[] }
    | { method: 'select'; title: string; options: string[] }
    | { method: 'confirm'; title: string; message: string }
    | { method: 'input'; title: string; placeholder?: string }
    | { method: 'image_review'; payload: ImageReviewPayload }
  )

export type ExtensionUISuspended = {
  requestId: string
  toolCallId?: string
  toolName?: string
  timelineItemId?: string
  suspendedAt: number
}

type ExtensionUIState = {
  pendingById: Record<string, ExtensionUIPending>
  activeRequestId: string | null
  suspendedById: Record<string, ExtensionUISuspended>
  activePending: ExtensionUIPending | null
  upsertPending: (pending: ExtensionUIPending) => void
  activateForSession: (sessionFile: string | null, restoreSuspended?: boolean) => void
  suspendActive: (meta: Omit<ExtensionUISuspended, 'requestId' | 'suspendedAt'>) => void
  resumeSuspended: (requestId?: string) => void
  removePending: (requestId: string) => void
  clearAfterRespond: (requestId?: string) => void
  resetForSessionContext: () => void
  pruneStaleSuspension: () => void
}

function nextForSession(
  pendingById: Record<string, ExtensionUIPending>,
  sessionFile: string | null,
): ExtensionUIPending | null {
  if (!sessionFile) return null
  return (
    Object.values(pendingById)
      .filter((pending) => sessionFilesEqual(pending.sessionFile, sessionFile))
      .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null
  )
}

function removeRequest(state: ExtensionUIState, requestId: string): Partial<ExtensionUIState> {
  const pendingById = { ...state.pendingById }
  const suspendedById = { ...state.suspendedById }
  delete pendingById[requestId]
  delete suspendedById[requestId]
  const activeRequestId = state.activeRequestId === requestId ? null : state.activeRequestId
  return {
    pendingById,
    suspendedById,
    activeRequestId,
    activePending: activeRequestId ? pendingById[activeRequestId] ?? null : null,
  }
}

function pruneStaleSuspension(): void {
  const state = useExtensionUIStore.getState()
  const items = useUIStore.getState().timelineItems
  const suspendedById = { ...state.suspendedById }
  let changed = false
  for (const [id, suspension] of Object.entries(suspendedById)) {
    const row = suspension.timelineItemId
      ? items.find((item) => item.id === suspension.timelineItemId)
      : null
    if (!row?.extensionUiSuspended) {
      delete suspendedById[id]
      changed = true
    }
  }
  if (changed) useExtensionUIStore.setState({ suspendedById })
}

export const useExtensionUIStore = create<ExtensionUIState>((set, get) => ({
  pendingById: {},
  activeRequestId: null,
  suspendedById: {},
  activePending: null,

  upsertPending: (pending) =>
    set((state) => ({ pendingById: { ...state.pendingById, [pending.id]: pending } })),

  activateForSession: (sessionFile, restoreSuspended = false) =>
    set((state) => {
      const next = nextForSession(state.pendingById, sessionFile)
      if (!next) return { activeRequestId: null, activePending: null }
      if (!restoreSuspended && state.suspendedById[next.id]) {
        return { activeRequestId: null, activePending: null }
      }
      const suspendedById = { ...state.suspendedById }
      delete suspendedById[next.id]
      return { activeRequestId: next.id, activePending: next, suspendedById }
    }),

  suspendActive: (meta) =>
    set((state) => {
      const requestId = state.activeRequestId
      if (!requestId) return state
      return {
        activeRequestId: null,
        activePending: null,
        suspendedById: {
          ...state.suspendedById,
          [requestId]: { requestId, ...meta, suspendedAt: Date.now() },
        },
      }
    }),

  resumeSuspended: (requestId) =>
    set((state) => {
      const id = requestId || Object.keys(state.suspendedById)[0]
      const pending = id ? state.pendingById[id] : null
      if (!id || !pending) return state
      const suspendedById = { ...state.suspendedById }
      delete suspendedById[id]
      return { activeRequestId: id, activePending: pending, suspendedById }
    }),

  removePending: (requestId) => set((state) => removeRequest(state, requestId)),
  clearAfterRespond: (requestId) => {
    const id = requestId || get().activeRequestId
    if (id) set((state) => removeRequest(state, id))
  },
  pruneStaleSuspension: () => pruneStaleSuspension(),
  resetForSessionContext: () => set({ activeRequestId: null, activePending: null }),
}))

export function extensionUiBlocksComposer(): boolean {
  pruneStaleSuspension()
  const pending = useExtensionUIStore.getState().activePending
  return pending != null && useUIStore.getState().runState.status === 'running'
}

export function hasPendingExtensionUI(requestId?: string): boolean {
  const pending = useExtensionUIStore.getState().pendingById
  return requestId ? pending[requestId] != null : Object.keys(pending).length > 0
}
