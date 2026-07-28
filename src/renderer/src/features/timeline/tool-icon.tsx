import { memo } from 'react'
import {
  FileEdit,
  FileText,
  FolderTree,
  PencilLine,
  Search,
  Terminal,
  Wrench,
  normalizeLegacyIconName,
  resolveAppIcon,
  type AppIconComponent,
  type AppIconName,
} from '@renderer/components/icons'
import { cn } from '@renderer/lib/utils'
import { resolveAdapterForTool } from './tool-card-registry'

const BUILTIN_ICON: Record<string, AppIconComponent> = {
  read: FileText,
  edit: PencilLine,
  write: FileEdit,
  insert: FileEdit,
  bash: Terminal,
  ls: FolderTree,
  find: Search,
  fffind: Search,
  grep: Search,
  ffgrep: Search,
}

export function resolveToolIconName(name: string): AppIconName {
  const adapterName = resolveAdapterForTool(name)?.toolCard?.icon
  return normalizeLegacyIconName(adapterName) ?? 'wrench'
}

function ToolIconImpl({ name, className }: { name: string; className?: string }) {
  const cls = className || 'h-3.5 w-3.5 timeline-text-quiet'
  const Builtin = BUILTIN_ICON[name]
  const Icon = Builtin ?? resolveAppIcon(resolveToolIconName(name)) ?? Wrench
  return <Icon className={cn(cls, 'text-current')} />
}

export const ToolIcon = memo(ToolIconImpl)
