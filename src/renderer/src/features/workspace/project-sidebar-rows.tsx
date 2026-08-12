import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { activateWorkspace, switchSessionInPlace } from '@renderer/lib/activate-workspace'
import { guardSessionSwitch } from '@renderer/lib/session-switch-guard'
import { useUIStore } from '@renderer/stores/ui-store'
import { sessionFilesEqual } from '@renderer/lib/session-file-key'
import { openSubagentSessionPreview } from '@renderer/lib/subagent-session-navigation'
import { collectActiveSubagentSessionChildren } from '@renderer/lib/subagent-session-activity'
import { useToolCardCatalogReady } from '@renderer/features/timeline/tool-card-registry'
import type { SessionItem } from './project-sidebar-types'
import { isSessionRuntimeRunning } from './session-runtime-running'
import { ProjectSessionRow } from './project-session-row'

export function ProjectSessionTree({
  workspacePath,
  projectSessions,
  loading,
  currentWorkspace,
  currentSessionId,
  onSessionContextMenu,
}: {
  workspacePath: string
  projectSessions: SessionItem[]
  loading: boolean
  currentWorkspace: string | null
  currentSessionId: string | null
  onSessionContextMenu: (
    e: React.MouseEvent,
    payload: { sessionId: string; sessionFile?: string; title: string; workspacePath: string },
  ) => void
}) {
  const { t } = useTranslation()
  const sessionRuntimeRunning = useUIStore((st) => st.sessionRuntimeRunning)
  const historySessionFile = useUIStore((st) => st.historySessionFile)
  const timelineItems = useUIStore((st) => st.timelineItems)
  const subagentSessionGroup = useUIStore((st) => st.subagentSessionGroup)
  const catalogReady = useToolCardCatalogReady()
  const [expandedSessionFiles, setExpandedSessionFiles] = useState<Set<string>>(() => new Set())
  const liveChildren = useMemo(
    () => collectActiveSubagentSessionChildren(timelineItems),
    [catalogReady, timelineItems],
  )

  const activeParentSessionFiles = useMemo(() => {
    const activeFiles = new Set<string>()
    for (const session of projectSessions) {
      if (!session.sessionFile) continue
      const currentParent =
        currentWorkspace === workspacePath
        && sessionFilesEqual(session.sessionFile, historySessionFile)
      const retainedChildren =
        subagentSessionGroup?.workspacePath === workspacePath
        && sessionFilesEqual(subagentSessionGroup.parentSessionFile, session.sessionFile)
          ? subagentSessionGroup.children
          : []
      const children = currentParent ? liveChildren : retainedChildren
      if (children.length > 0) activeFiles.add(session.sessionFile)
    }
    return activeFiles
  }, [currentWorkspace, historySessionFile, liveChildren, projectSessions, subagentSessionGroup, workspacePath])

  useEffect(() => {
    const group = subagentSessionGroup
    if (!group || group.workspacePath !== workspacePath) return
    const childSelected = group.children.some(
      (child) => child.sessionFile && sessionFilesEqual(child.sessionFile, historySessionFile),
    )
    if (!childSelected) return
    setExpandedSessionFiles((previous) => {
      if (previous.has(group.parentSessionFile)) return previous
      return new Set(previous).add(group.parentSessionFile)
    })
  }, [historySessionFile, subagentSessionGroup, workspacePath])

  useEffect(() => {
    setExpandedSessionFiles((previous) => {
      const next = new Set(
        [...previous].filter((sessionFile) => activeParentSessionFiles.has(sessionFile)),
      )
      return next.size === previous.size ? previous : next
    })
  }, [activeParentSessionFiles])

  const openParentSession = (session: SessionItem) => {
    guardSessionSwitch(() => {
      if (workspacePath === currentWorkspace) {
        void switchSessionInPlace(session.sessionId, session.sessionFile)
      } else {
        void activateWorkspace(workspacePath, {
          sessionId: session.sessionId,
          sessionFile: session.sessionFile,
        })
      }
    })
  }

  return (
    <div className="sidebar-session-tree ml-3 border-l border-border/40 pl-1.5 pt-0.5">
      {loading ? (
        <p className="px-2 py-2 text-[12px] text-foreground-secondary/80">{t('common:loading')}</p>
      ) : projectSessions.length === 0 ? (
        <p className="px-2 py-2 text-[12px] text-foreground-secondary/80">{t('common:sidebar.noSessions')}</p>
      ) : (
        projectSessions.map((s) => {
          const sessionFile = s.sessionFile
          const currentParent = !!sessionFile
            && currentWorkspace === workspacePath
            && sessionFilesEqual(sessionFile, historySessionFile)
          const retainedChildren =
            sessionFile
            && subagentSessionGroup?.workspacePath === workspacePath
            && sessionFilesEqual(subagentSessionGroup.parentSessionFile, sessionFile)
              ? subagentSessionGroup.children
              : []
          const children = currentParent ? liveChildren : retainedChildren
          const expanded = !!sessionFile && expandedSessionFiles.has(sessionFile)
          const running = isSessionRuntimeRunning(sessionFile, sessionRuntimeRunning)
          return (
            <ProjectSessionRow
              key={s.sessionId}
              session={s}
              workspacePath={workspacePath}
              currentWorkspace={currentWorkspace}
              currentSessionId={currentSessionId}
              historySessionFile={historySessionFile}
              children={children}
              expanded={expanded}
              running={running}
              onOpen={() => openParentSession(s)}
              onToggle={() => {
                if (!sessionFile) return
                setExpandedSessionFiles((previous) => {
                  const next = new Set(previous)
                  if (next.has(sessionFile)) next.delete(sessionFile)
                  else next.add(sessionFile)
                  return next
                })
              }}
              onContextMenu={(event) =>
                onSessionContextMenu(event, {
                  sessionId: s.sessionId,
                  sessionFile,
                  title: s.title || s.sessionId.slice(0, 8),
                  workspacePath,
                })
              }
            />
          )
        })
      )}
    </div>
  )
}
