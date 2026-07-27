import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'
import { Switch } from '@renderer/components/ui/switch'

/** 分组：uppercase 小标题 + 行列表分隔线，不套卡片 */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">{title}</h3>
        {action}
      </div>
      {description && <p className="mb-1 text-xs text-muted-foreground/70">{description}</p>}
      <div className="divide-y divide-border/40">{children}</div>
    </section>
  )
}

export function SettingRow({
  label,
  description,
  className,
  children,
}: {
  label: string
  description?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-foreground">{label}</div>
        {description && <div className="mt-0.5 text-xs text-muted-foreground/70">{description}</div>}
      </div>
      <div className="shrink-0 sm:ml-4">{children}</div>
    </div>
  )
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <Switch checked={on} onCheckedChange={onChange} disabled={disabled} />
}
