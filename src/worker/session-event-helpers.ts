import type { AppEvent } from '@shared/app-events'
import { extractTextFromPiMessage, type PiSessionMessage } from '@shared/worker-message'

export function lastAssistantFromMessages(messages: unknown[]): PiSessionMessage | undefined {
  if (!Array.isArray(messages)) return undefined
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex] as PiSessionMessage
    if (message?.role === 'assistant') return message
  }
  return undefined
}

export function emitAgentErrorFromAssistant(
  base: Record<string, unknown>,
  msg: PiSessionMessage & { errorMessage?: string },
  emit: (event: AppEvent) => void,
): void {
  const stop = msg?.stopReason as string | undefined
  if (stop !== 'error' && stop !== 'aborted') return
  const raw =
    (typeof msg?.errorMessage === 'string' && msg.errorMessage.trim()) ||
    extractTextFromPiMessage(msg) ||
    (stop === 'aborted' ? 'Request was aborted.' : 'Unknown error')
  emit({
    ...base,
    type: 'agent_error',
    text: String(raw),
    kind: stop === 'aborted' ? 'aborted' : 'error',
    stopReason: stop,
  } as AppEvent)
}