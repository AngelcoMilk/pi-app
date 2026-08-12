import { useTranslation } from 'react-i18next'
import { Inbox } from '@renderer/components/icons'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui-store'
import type { SandboxEntry } from './project-sidebar-types'
import { isSessionRuntimeRunning } from './session-runtime-running'
import { SessionRunningPixelGrid } from './session-running-pixel-grid'

export function SandboxDialogRow({
  box,
  active,
  onOpen,
  onContextMenu,
}: {
  box: SandboxEntry
  active: boolean
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { t } = useTranslation()
  const running = useUIStore((state) =>
    isSessionRuntimeRunning(box.sessionFile, state.sessionRuntimeRunning),
  )
  const displayLabel = box.label?.trim() || t('common:sidebar.tempChat')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => event.key === 'Enter' && onOpen()}
      onContextMenu={onContextMenu}
      className={cn(
        'nav-row sidebar-session-row mb-0.5 flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2',
        active ? 'nav-row-active' : 'text-foreground-secondary hover:text-foreground',
      )}
    >
      <Inbox className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'opacity-70')} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] leading-[20px] text-foreground">{displayLabel}</div>
        <div className="text-[11px] leading-[16px] tabular-nums text-foreground-secondary/85">
          {new Date(box.createdAt).toLocaleString(undefined, {
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
    </div>
  )
}
