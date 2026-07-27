import type { TimelineItem } from '@renderer/stores/ui-store-types'

function streamChars(item: TimelineItem): number {
  if (item.type !== 'assistant-message') return 0
  return (item.text?.length ?? 0) + (item.thinkingText?.length ?? 0)
}

function countUserMessages(items: TimelineItem[]): number {
  return items.reduce((n, item) => (item.type === 'user-message' ? n + 1 : n), 0)
}

function precedingUserEntryId(items: TimelineItem[], assistantIndex: number): string | null {
  for (let index = assistantIndex - 1; index >= 0; index--) {
    const item = items[index]
    if (item.type === 'user-message') return item.sessionEntryId ?? null
  }
  return null
}

function isAssistantOnlyStreamTail(items: TimelineItem[]): boolean {
  return items.length > 0 && items.every((item) => item.type === 'assistant-message')
}

export function assistantItemsShareTurn(
  firstItems: TimelineItem[],
  firstAssistantIndex: number,
  secondItems: TimelineItem[],
  secondAssistantIndex: number,
): boolean {
  const firstAssistant = firstItems[firstAssistantIndex]
  const secondAssistant = secondItems[secondAssistantIndex]
  if (firstAssistant.sessionEntryId && secondAssistant.sessionEntryId) {
    return firstAssistant.sessionEntryId === secondAssistant.sessionEntryId
  }
  const firstUserEntryId = precedingUserEntryId(firstItems, firstAssistantIndex)
  const secondUserEntryId = precedingUserEntryId(secondItems, secondAssistantIndex)
  if (firstUserEntryId && secondUserEntryId) {
    return firstUserEntryId === secondUserEntryId
  }
  return !!firstAssistant.turnId && firstAssistant.turnId === secondAssistant.turnId
}

export function resolveMergedStreamingAssistantId(
  mergedItems: TimelineItem[],
  candidateItems: TimelineItem[],
  candidateStreamingAssistantId: string | null,
): string | null {
  if (!candidateStreamingAssistantId) return null
  const direct = mergedItems.find(
    (item) => item.id === candidateStreamingAssistantId && item.type === 'assistant-message',
  )
  if (direct) return direct.id

  const candidateIndex = candidateItems.findIndex(
    (item) => item.id === candidateStreamingAssistantId && item.type === 'assistant-message',
  )
  const mergedIndex = lastAssistantIndex(mergedItems)
  if (
    candidateIndex < 0 ||
    mergedIndex < 0 ||
    !assistantItemsShareTurn(mergedItems, mergedIndex, candidateItems, candidateIndex)
  ) {
    return null
  }
  return mergedItems[mergedIndex].id
}

export type LiveCacheMergeActivity = {
  incomingStreamingAssistantId?: string | null
  existingStreamingAssistantId?: string | null
}

export function persistedTimelineEntryIds(items: TimelineItem[]): string[] {
  const ids: string[] = []
  for (const item of items) {
    if (item.sessionEntryId && ids.at(-1) !== item.sessionEntryId) {
      ids.push(item.sessionEntryId)
    }
  }
  return ids
}

export function persistedTimelineBranchesConflict(
  current: TimelineItem[],
  candidate: TimelineItem[],
): boolean {
  const currentIds = persistedTimelineEntryIds(current)
  const candidateIds = persistedTimelineEntryIds(candidate)
  for (let currentIndex = currentIds.length - 1; currentIndex >= 0; currentIndex--) {
    const candidateIndex = candidateIds.lastIndexOf(currentIds[currentIndex])
    if (candidateIndex < 0) continue
    const compared = Math.min(
      currentIds.length - currentIndex - 1,
      candidateIds.length - candidateIndex - 1,
    )
    for (let offset = 1; offset <= compared; offset++) {
      if (currentIds[currentIndex + offset] !== candidateIds[candidateIndex + offset]) {
        return true
      }
    }
    return false
  }
  return currentIds.length > 0 && candidateIds.length > 0
}

/**
 * Prefer the more complete timeline snapshot, not merely the longer last-assistant string.
 * Background stream-only caches often have a longer partial assistant than a full-page
 * capture that was taken mid-token — choosing by chars alone used to drop all history.
 */
function timelineCompletenessScore(items: TimelineItem[]): number {
  const users = countUserMessages(items)
  const lastAsst = lastAssistantItem(items)
  const asstChars = lastAsst ? streamChars(lastAsst) : 0
  // users dominate, then item count, then stream richness
  return users * 1_000_000_000 + items.length * 1_000_000 + asstChars
}

export function lastAssistantItem(items: TimelineItem[]): TimelineItem | null {
  const idx = lastAssistantIndex(items)
  return idx >= 0 ? items[idx] : null
}

/** 同一轮流式 assistant：保留更长的正文/思维链，避免 capture 用未 flush 的可见层盖掉 cache */
export function pickRicherAssistantMessage(
  first: TimelineItem,
  second: TimelineItem,
): TimelineItem {
  if (first.type !== 'assistant-message' || second.type !== 'assistant-message') {
    return streamChars(first) >= streamChars(second) ? first : second
  }
  const richer = streamChars(first) >= streamChars(second) ? first : second
  const other = richer === first ? second : first
  return {
    ...richer,
    text:
      (richer.text?.length ?? 0) >= (other.text?.length ?? 0) ? richer.text : other.text,
    thinkingText:
      (richer.thinkingText?.length ?? 0) >= (other.thinkingText?.length ?? 0)
        ? richer.thinkingText
        : other.thinkingText,
    sessionEntryId: richer.sessionEntryId ?? other.sessionEntryId,
    turnId: richer.turnId ?? other.turnId,
  }
}

function enrichStructuralAssistant(
  structural: TimelineItem,
  candidate: TimelineItem,
): TimelineItem {
  if (structural.type !== 'assistant-message' || candidate.type !== 'assistant-message') {
    return structural
  }
  return {
    ...structural,
    text:
      (structural.text?.length ?? 0) >= (candidate.text?.length ?? 0)
        ? structural.text
        : candidate.text,
    thinkingText:
      (structural.thinkingText?.length ?? 0) >= (candidate.thinkingText?.length ?? 0)
        ? structural.thinkingText
        : candidate.thinkingText,
    turnId: structural.turnId ?? candidate.turnId,
  }
}

export function lastAssistantIndex(items: TimelineItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'assistant-message') return i
  }
  return -1
}

/** 合并两份 live cache：优先更完整的时间线，再合并最后一条 assistant 流式正文 */
export function mergeLiveCacheTimelineSnapshots(
  incoming: TimelineItem[],
  existing: TimelineItem[],
  activity: LiveCacheMergeActivity = {},
): TimelineItem[] {
  if (!existing.length) return incoming.map((i) => ({ ...i }))
  if (!incoming.length) return existing.map((i) => ({ ...i }))
  const inc = incoming.map((i) => ({ ...i }))
  const ex = existing.map((i) => ({ ...i }))
  if (persistedTimelineBranchesConflict(inc, ex)) return inc
  const incLast = lastAssistantIndex(inc)
  const exLast = lastAssistantIndex(ex)
  if (isAssistantOnlyStreamTail(inc) && isAssistantOnlyStreamTail(ex)) {
    const incomingActive = activity.incomingStreamingAssistantId === inc[incLast]?.id
    const existingActive = activity.existingStreamingAssistantId === ex[exLast]?.id
    if (incomingActive !== existingActive) return incomingActive ? inc : ex
  }
  const incScore = timelineCompletenessScore(inc)
  const exScore = timelineCompletenessScore(ex)
  // Same structure → prefer the side with longer last assistant (fresher stream)
  const base = incScore >= exScore ? inc : ex
  const other = base === inc ? ex : inc
  const baseLast = lastAssistantIndex(base)
  const otherLast = lastAssistantIndex(other)
  if (baseLast < 0) return other
  if (otherLast < 0) return base
  const sameTurn = assistantItemsShareTurn(base, baseLast, other, otherLast)
  if (isAssistantOnlyStreamTail(other)) {
    const otherStreamingAssistantId =
      other === inc
        ? activity.incomingStreamingAssistantId
        : activity.existingStreamingAssistantId
    if (otherStreamingAssistantId !== other[otherLast].id || !sameTurn) return base
  } else if (!sameTurn) {
    return base
  }
  const richer = enrichStructuralAssistant(base[baseLast], other[otherLast])
  return base.map((item, i) => (i === baseLast ? richer : { ...item }))
}

/** 切回合并后：用 live cache 里更长的流式正文补全最后一条 assistant */
export function applyLiveStreamingTextToMergedTimeline(
  merged: TimelineItem[],
  liveItems: TimelineItem[],
  streamingAssistantId: string | null,
): TimelineItem[] {
  const liveAsst =
    (streamingAssistantId ? liveItems.find((i) => i.id === streamingAssistantId) : undefined) ??
    lastAssistantItem(liveItems)
  if (!liveAsst || liveAsst.type !== 'assistant-message') return merged
  if (persistedTimelineBranchesConflict(merged, liveItems)) return merged
  const liveUserCount = countUserMessages(liveItems)
  if (liveUserCount > 0 && countUserMessages(merged) < liveUserCount) return merged
  const idx = lastAssistantIndex(merged)
  const liveIdx = liveItems.indexOf(liveAsst)
  if (idx < 0 || liveIdx < 0) return merged
  if (!assistantItemsShareTurn(merged, idx, liveItems, liveIdx)) return merged
  const richer = enrichStructuralAssistant(merged[idx], liveAsst)
  if (
    richer.text === merged[idx].text &&
    richer.thinkingText === merged[idx].thinkingText
  ) {
    return merged
  }
  const out = [...merged]
  out[idx] = richer
  return out
}
