import type { ProjectableTimelineItem } from './timeline-projection-types'

/** Whether adjacent assistant fragments belong to one turn. */
function sameTurn(a: ProjectableTimelineItem, b: ProjectableTimelineItem): boolean {
  if (a.turnId && b.turnId) return a.turnId === b.turnId
  if (a.turnId || b.turnId) return false
  if (a.sessionEntryId && b.sessionEntryId) return a.sessionEntryId === b.sessionEntryId
  if (a.sessionEntryId || b.sessionEntryId) return false
  return !a.runId && !b.runId
}

function mergeAssistant(
  existing: ProjectableTimelineItem,
  incoming: ProjectableTimelineItem,
): ProjectableTimelineItem {
  const text = [existing.text, incoming.text].filter(Boolean).join('')
  const thinkingText = [existing.thinkingText, incoming.thinkingText].filter(Boolean).join('')
  return {
    ...existing,
    text: text || existing.text,
    thinkingText: thinkingText || existing.thinkingText,
    sessionEntryId: incoming.sessionEntryId ?? existing.sessionEntryId,
    turnId: incoming.turnId ?? existing.turnId,
    timestamp: incoming.timestamp ?? existing.timestamp,
    // Preserve interrupt markers across projection merges
    incomplete: !!(existing.incomplete || incoming.incomplete),
    stopReason: incoming.stopReason || existing.stopReason,
  }
}

function mergeTool(
  existing: ProjectableTimelineItem,
  incoming: ProjectableTimelineItem,
): ProjectableTimelineItem {
  const phase =
    incoming.toolPhase === 'end' || existing.toolPhase === 'end' ? 'end' : incoming.toolPhase ?? existing.toolPhase
  return {
    ...existing,
    ...incoming,
    toolPhase: phase,
    toolOutput: incoming.toolOutput?.length ? incoming.toolOutput : existing.toolOutput,
    toolDetails: incoming.toolDetails ?? existing.toolDetails,
    toolArgs: incoming.toolArgs ?? existing.toolArgs,
    isError: incoming.isError ?? existing.isError,
    sessionEntryId: incoming.sessionEntryId ?? existing.sessionEntryId,
    turnId: incoming.turnId ?? existing.turnId,
  }
}

/**
 * Collapse adjacent assistant deltas and tool start/end into display rows.
 * Does not mutate input.
 */
export function projectTimelineItems<T extends ProjectableTimelineItem>(items: T[]): T[] {
  const out: T[] = []
  for (const item of items) {
    const prev = out[out.length - 1]
    if (item.type === 'assistant-message' && prev?.type === 'assistant-message' && sameTurn(prev, item)) {
      out[out.length - 1] = mergeAssistant(prev, item) as T
      continue
    }
    if (item.type === 'tool-call' && item.toolCallId && prev?.type === 'tool-call' && prev.toolCallId === item.toolCallId) {
      out[out.length - 1] = mergeTool(prev, item) as T
      continue
    }
    out.push({ ...item })
  }
  return out
}