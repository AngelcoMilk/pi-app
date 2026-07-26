import type { TimelineItem } from '@renderer/stores/ui-store'
import { markTrailingIncompleteAssistants } from '@shared/timeline-incomplete'

export function normalizeTimelineMessageText(t?: string): string {
  return (t || '').replace(/\s+/g, ' ').trim()
}

/** 去掉乐观占位 id，避免与 JSONL 历史叠在一起 */
export function stripOptimisticTimelineItems(items: TimelineItem[]): TimelineItem[] {
  return items.filter((i) => !String(i.id).startsWith('opt-'))
}

/** 仅合并同一持久化 entry，或仍带乐观占位标识的相邻重复用户消息。 */
export function dedupeAdjacentUserMessages(items: TimelineItem[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const it of items) {
    const prev = out[out.length - 1]
    if (it.type === 'user-message' && prev?.type === 'user-message') {
      const sameEntryId =
        !!it.sessionEntryId &&
        !!prev.sessionEntryId &&
        it.sessionEntryId === prev.sessionEntryId
      const optimisticDuplicate =
        (it.id.startsWith('opt-user-') || prev.id.startsWith('opt-user-')) &&
        normalizeTimelineMessageText(it.text) === normalizeTimelineMessageText(prev.text)
      if (sameEntryId || optimisticDuplicate) continue
    }
    out.push(it)
  }
  return out
}

export function sanitizeHistoryTimeline(items: TimelineItem[]): TimelineItem[] {
  // Heal crash mid-stream empty leaf so incomplete UI + rewind stay available after reopen.
  return markTrailingIncompleteAssistants(
    dedupeAdjacentUserMessages(stripOptimisticTimelineItems(items)),
  ) as TimelineItem[]
}