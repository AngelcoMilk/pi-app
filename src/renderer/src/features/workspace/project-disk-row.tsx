import { useTranslation } from 'react-i18next'
import { ChevronRight, Folder, Plus } from '@renderer/components/icons'
import { SidebarAnimatedCollapse } from '@renderer/components/ui/sidebar-animated-collapse'
import { cn } from '@renderer/lib/utils'

export function ProjectDiskRow({
  path,
  name,
  active,
  open,
  onToggleOpen,
  onNewSession,
  onProjectContextMenu,
  sessionTree,
}: {
  path: string
  name: string
  active: boolean
  open: boolean
  onToggleOpen: () => void
  onNewSession: () => void
  onProjectContextMenu: (event: React.MouseEvent) => void
  sessionTree: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="sidebar-project-row mb-0.5" onContextMenu={onProjectContextMenu}>
      <div
        className={cn(
          'nav-row flex min-h-[36px] items-center gap-0.5 rounded-lg px-0.5',
          (active || open) && 'bg-[var(--bg-hover)]/80',
        )}
      >
        <button
          type="button"
          onClick={onToggleOpen}
          className="sidebar-project-hit flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left"
          title={path}
          aria-expanded={open}
        >
          <ChevronRight
            className="chevron-expand h-3.5 w-3.5 shrink-0 text-foreground-secondary/80"
            data-open={open ? 'true' : 'false'}
          />
          <Folder
            className={cn(
              'folder-icon h-4 w-4 shrink-0 transition-colors duration-200',
              active ? 'text-brand' : 'text-foreground-secondary/70',
            )}
          />
          <span
            className={cn(
              'truncate text-[14px] leading-[20px]',
              active ? 'font-medium text-foreground' : 'text-foreground-secondary',
            )}
          >
            {name}
          </span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onNewSession()
          }}
          title={t('common:newSession')}
          className="chrome-icon-btn ml-0.5 cursor-pointer rounded p-1"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <SidebarAnimatedCollapse open={open}>{sessionTree}</SidebarAnimatedCollapse>
    </div>
  )
}
