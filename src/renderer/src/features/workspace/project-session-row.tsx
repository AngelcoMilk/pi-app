import { useTranslation } from 'react-i18next'
import { ChevronRight, GitBranch } from '@renderer/components/icons'
import { SidebarAnimatedCollapse } from '@renderer/components/ui/sidebar-animated-collapse'
import { cn } from '@renderer/lib/utils'
import { openSubagentSessionPreview } from '@renderer/lib/subagent-session-navigation'
import { sessionFilesEqual } from '@renderer/lib/session-file-key'
import type { SubagentSessionChild } from '@renderer/lib/subagent-session-types'
import type { SessionItem } from './project-sidebar-types'
import { SessionRunningPixelGrid } from './session-running-pixel-grid'

export function ProjectSessionRow({
  session,
  workspacePath,
  currentWorkspace,
  currentSessionId,
  historySessionFile,
  children,
  expanded,
  running,
  onOpen,
  onToggle,
  onContextMenu,
}: {
  session: SessionItem
  workspacePath: string
  currentWorkspace: string | null
  currentSessionId: string | null
  historySessionFile: string | null
  children: SubagentSessionChild[]
  expanded: boolean
  running: boolean
  onOpen: () => void
  onToggle: () => void
  onContextMenu: (event: React.MouseEvent) => void
}) {
  const { t } = useTranslation()
  const title = session.title || session.sessionId.slice(0, 8)
  const parentActive =
    currentSessionId === session.sessionId &&
    workspacePath === currentWorkspace &&
    sessionFilesEqual(historySessionFile, session.sessionFile)
  return (
    <div className="mb-0.5">
      <div
        onContextMenu={onContextMenu}
        className={cn(
          'nav-row sidebar-session-row flex min-h-[38px] items-center gap-0.5 rounded-lg px-1 py-0.5',
          parentActive ? 'nav-row-active' : 'text-foreground-secondary hover:text-foreground',
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] leading-[18px] text-foreground">{title}</div>
            <div className="text-[11px] leading-[16px] tabular-nums text-foreground-secondary/85">
              {new Date(session.updatedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          {running ? (
            <SessionRunningPixelGrid
              className="ml-0.5 opacity-80"
              title={t('common:status.running', { defaultValue: 'Running' })}
            />
          ) : null}
        </button>
        {children.length > 0 && session.sessionFile && (
          <button
            type="button"
            aria-label={t('common:sidebar.toggleSubagents', { title })}
            aria-expanded={expanded}
            onClick={onToggle}
            className="chrome-icon-btn flex h-7 w-6 shrink-0 items-center justify-center rounded-md"
          >
            <ChevronRight
              className="chevron-expand h-3 w-3 text-foreground-secondary/75"
              data-open={expanded ? 'true' : 'false'}
            />
          </button>
        )}
      </div>
      {children.length > 0 && (
        <SidebarAnimatedCollapse open={expanded}>
          <div className="ml-5 border-l border-border/35 pb-0.5 pl-1.5 pt-0.5">
            {children.map((child) => {
              const canOpen = !!child.sessionFile
              const active =
                canOpen &&
                workspacePath === currentWorkspace &&
                sessionFilesEqual(child.sessionFile, historySessionFile)
              return (
                <button
                  key={child.key}
                  type="button"
                  disabled={!canOpen}
                  aria-label={
                    canOpen
                      ? t('common:sidebar.openSubagentSession', { agent: child.agent })
                      : t('common:sidebar.subagentSessionUnavailable', { agent: child.agent })
                  }
                  onClick={() => {
                    if (child.sessionFile) void openSubagentSessionPreview(child.sessionFile)
                  }}
                  className={cn(
                    'nav-row sidebar-subagent-row mb-0.5 flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left',
                    active ? 'nav-row-active' : 'text-foreground-secondary hover:text-foreground',
                    !canOpen && 'cursor-default opacity-60',
                  )}
                >
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-foreground-secondary/70" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] leading-[16px] text-foreground">
                      {child.agent}
                    </div>
                    <div className="truncate text-[10px] leading-[14px] text-foreground-secondary/75">
                      {child.task || t(`timeline:tree.state.${child.state}`)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[9px] font-medium text-foreground-secondary/65">
                    {t(`timeline:tree.state.${child.state}`)}
                  </span>
                </button>
              )
            })}
          </div>
        </SidebarAnimatedCollapse>
      )}
    </div>
  )
}
