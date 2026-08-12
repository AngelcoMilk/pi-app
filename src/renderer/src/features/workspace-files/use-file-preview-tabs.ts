import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import {
  getSessionUIState,
  setSessionPreviewState,
  type SessionPreviewState,
  type SessionPreviewTab,
} from '@renderer/lib/session-ui-state'
import { normalizeSessionFileKey } from '@renderer/lib/session-file-key'

export type PreviewTab = SessionPreviewTab

let tabSeq = 0
function nextTabId() {
  tabSeq += 1
  return `ft-${tabSeq}`
}

const emptyState = (): SessionPreviewState => ({ tabs: [], activeId: null, fullscreen: false })

export function useFilePreviewTabs(sessionFile: string | null, viewIdentity: string | null) {
  const sessionKey = normalizeSessionFileKey(sessionFile)
  const [state, setState] = useState<SessionPreviewState>(() =>
    getSessionUIState(sessionKey)?.preview ?? emptyState(),
  )
  const { tabs, activeId } = state

  useLayoutEffect(() => {
    setState(getSessionUIState(sessionKey)?.preview ?? emptyState())
  }, [sessionKey, viewIdentity])

  const updateState = useCallback(
    (update: (previous: SessionPreviewState) => SessionPreviewState) => {
      setState((previous) => {
        const next = update(previous)
        setSessionPreviewState(sessionKey, next)
        return next
      })
    },
    [sessionKey],
  )

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeId) ?? null, [tabs, activeId])

  const openFile = useCallback((rel: string, name: string, mode: 'replace' | 'new-tab') => {
    updateState((previous) => {
      const prev = previous.tabs
      if (mode === 'new-tab') {
        const hit = prev.find((t) => t.rel === rel)
        if (hit) {
          return { ...previous, activeId: hit.id }
        }
        const id = nextTabId()
        return { ...previous, tabs: [...prev, { id, rel, name }], activeId: id }
      }

      if (prev.length === 0) {
        const id = nextTabId()
        return { ...previous, tabs: [{ id, rel, name }], activeId: id }
      }

      if (prev.length === 1) {
        return { ...previous, tabs: [{ ...prev[0], rel, name }], activeId: prev[0].id }
      }

      const aid = previous.activeId ?? prev[0]?.id ?? null
      return {
        ...previous,
        tabs: prev.map((t) => (t.id === aid ? { ...t, rel, name } : t)),
        activeId: aid,
      }
    })
  }, [updateState])

  const closeTab = useCallback((id: string) => {
    updateState((previous) => {
      const prev = previous.tabs
      const idx = prev.findIndex((t) => t.id === id)
      if (idx < 0) return previous
      const next = prev.filter((t) => t.id !== id)
      const neighbor = next[Math.min(idx, next.length - 1)]
      const nextActiveId = previous.activeId === id ? (neighbor?.id ?? null) : previous.activeId
      return {
        ...previous,
        tabs: next,
        activeId: nextActiveId,
        fullscreen: nextActiveId ? previous.fullscreen : false,
      }
    })
  }, [updateState])

  const activateTab = useCallback((id: string) => {
    updateState((previous) => ({ ...previous, activeId: id }))
  }, [updateState])

  const setFullscreen = useCallback((fullscreen: boolean) => {
    updateState((previous) => ({ ...previous, fullscreen }))
  }, [updateState])

  const reorderTabs = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return
    updateState((previous) => {
      const prev = previous.tabs
      const from = prev.findIndex((t) => t.id === fromId)
      const to = prev.findIndex((t) => t.id === toId)
      if (from < 0 || to < 0) return previous
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...previous, tabs: next }
    })
  }, [updateState])

  const renameTabRel = useCallback((oldRel: string, newRel: string, newName: string) => {
    updateState((previous) => ({
      ...previous,
      tabs: previous.tabs.map((t) =>
        t.rel === oldRel ? { ...t, rel: newRel, name: newName } : t,
      ),
    }))
  }, [updateState])

  return {
    tabs,
    activeId,
    activeTab,
    fullscreen: state.fullscreen,
    openFile,
    closeTab,
    activateTab,
    setFullscreen,
    reorderTabs,
    renameTabRel,
  }
}
