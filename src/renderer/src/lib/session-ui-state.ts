import { normalizeSessionFileKey } from './session-file-key'

export type SessionPreviewTab = {
  id: string
  rel: string
  name: string
}

export type SessionPreviewState = {
  tabs: SessionPreviewTab[]
  activeId: string | null
  fullscreen: boolean
}

export type SessionTimelineState = {
  scrollTop: number
  followBottom: boolean
  renderCount: number
}

export type SessionUIState = {
  preview?: SessionPreviewState
  activePanel?: string
  timeline?: SessionTimelineState
}

const states = new Map<string, SessionUIState>()

function keyFor(sessionFile: string | null | undefined): string {
  return normalizeSessionFileKey(sessionFile)
}

export function getSessionUIState(sessionFile: string | null | undefined): SessionUIState | undefined {
  const key = keyFor(sessionFile)
  return key ? states.get(key) : undefined
}

function updateSessionUIState(
  sessionFile: string | null | undefined,
  patch: Partial<SessionUIState>,
): void {
  const key = keyFor(sessionFile)
  if (!key) return
  states.set(key, { ...states.get(key), ...patch })
}

export function setSessionPreviewState(
  sessionFile: string | null | undefined,
  preview: SessionPreviewState,
): void {
  updateSessionUIState(sessionFile, { preview })
}

export function setSessionActivePanel(
  sessionFile: string | null | undefined,
  activePanel: string,
): void {
  updateSessionUIState(sessionFile, { activePanel })
}

export function setSessionTimelineState(
  sessionFile: string | null | undefined,
  timeline: SessionTimelineState,
): void {
  updateSessionUIState(sessionFile, { timeline })
}

export function clearSessionUIState(sessionFile: string | null | undefined): void {
  const key = keyFor(sessionFile)
  if (key) states.delete(key)
}
