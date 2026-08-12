import { useLayoutEffect } from 'react'
import { getSessionUIState } from '@renderer/lib/session-ui-state'
import { useUIStore } from '@renderer/stores/ui-store'

export function useSessionPanelMemory(sessionFile: string | null, viewIdentity: string | null): void {
  useLayoutEffect(() => {
    const remembered = getSessionUIState(sessionFile)
    useUIStore.getState().setActivePanel(remembered?.activePanel ?? 'review')
    useUIStore.setState({
      filesPreviewChatExpand: remembered?.preview?.fullscreen === true,
    })
  }, [sessionFile, viewIdentity])
}
