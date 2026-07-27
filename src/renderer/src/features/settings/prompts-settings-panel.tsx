import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { RefreshCw, MessageSquareText, FolderGit2, Cpu, Plug, FileText } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ipcClient } from '@renderer/lib/ipc-client'
import { MarkdownResourceEditor } from '@renderer/features/settings/markdown-resource-editor'
import { SettingsPageHeader } from '@renderer/features/settings/settings-shell'
import { resolvePromptRowDisplay } from '@renderer/features/settings/prompt-catalog-i18n'

type PromptCategory = 'plugin_inject' | 'agents_context' | 'pi_builtin' | 'prompt_template'

type PromptRow = {
  id: string
  category: PromptCategory
  name: string
  description: string
  path: string | null
  command: string
  source?: string
  editable?: boolean
  readOnly?: boolean
  inSystemContext?: boolean
}

const GROUP_ICON: Record<PromptCategory, typeof FileText> = {
  agents_context: FolderGit2,
  pi_builtin: Cpu,
  prompt_template: MessageSquareText,
  plugin_inject: Plug,
}

export function PromptsSettingsPanel() {
  const { t, i18n } = useTranslation()
  const [flat, setFlat] = useState<PromptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [virtualSystemPreviewPath, setVirtualSystemPreviewPath] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ipcClient.invoke('prompts.list')
      const prompts: PromptRow[] = res?.prompts || []
      setFlat(prompts)
      setVirtualSystemPreviewPath(res?.virtualSystemPreviewPath || null)
    } catch (e) {
      toast.error(t('settings:prompts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(() => flat.find((p) => p.id === selectedId), [flat, selectedId])

  const editorPath = useMemo(() => {
    if (!selected) return null
    if (selected.id === 'builtin:system:default' && virtualSystemPreviewPath) {
      return virtualSystemPreviewPath
    }
    return selected.path
  }, [selected, virtualSystemPreviewPath])

  const editorReadOnly = selected?.readOnly === true || selected?.id === 'builtin:system:default'

  const displayGroups = useMemo(() => {
    const labels: Record<PromptCategory, string> = {
      plugin_inject: t('settings:prompts.pluginInject'),
      agents_context: t('settings:prompts.groupAgentsContext'),
      pi_builtin: t('settings:prompts.piBuiltin'),
      prompt_template: t('settings:prompts.promptTemplate'),
    }
    const order: PromptCategory[] = ['agents_context', 'pi_builtin', 'prompt_template', 'plugin_inject']
    return order
      .map((category) => ({
        category,
        label: labels[category],
        items: flat.filter((i) => i.category === category),
      }))
      .filter((g) => g.items.length > 0)
  }, [flat, i18n.language, t])

  return (
    <div className="w-full">
      <SettingsPageHeader
        title={t('settings:prompts.title')}
        description={t('settings:prompts.description')}
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="chrome-icon-btn rounded-md p-2"
            aria-label={t('common:refresh')}
            title={t('common:refresh')}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} strokeWidth={1.5} />
          </button>
        }
      />

      <div className="grid min-h-[min(72vh,640px)] gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <div className="max-h-[min(70vh,560px)] overflow-y-auto rounded-xl border border-border/50">
          {loading && flat.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('settings:prompts.loading')}</p>
          ) : displayGroups.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('settings:prompts.empty')}</p>
          ) : (
            <div className="divide-y divide-border/40">
              {displayGroups.map((g) => {
                const Icon = GROUP_ICON[g.category]
                return (
                  <section key={g.category}>
                    <div className="sticky top-0 z-[1] flex items-center gap-1.5 border-b border-border/30 bg-[var(--bg-1)]/95 px-3 py-2 backdrop-blur-sm">
                      <Icon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.5} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{g.label}</span>
                      <span className="font-mono text-2xs text-muted-foreground/50">({g.items.length})</span>
                    </div>
                    <ul>
                      {g.items.map((p) => {
                        const display = resolvePromptRowDisplay(p, t)
                        return (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={!p.path && p.id !== 'builtin:system:default'}
                            onClick={() => setSelectedId(p.id)}
                            className={cn(
                              'w-full px-3 py-2.5 text-left disabled:opacity-45',
                              selectedId === p.id && 'bg-primary/8',
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-base font-medium">{display.name}</span>
                              {p.inSystemContext ? (
                                <span className="shrink-0 rounded bg-brand/12 px-1 py-0.5 text-2xs text-brand">
                                  {t('settings:prompts.perTurnSystem')}
                                </span>
                              ) : null}
                              {p.readOnly ? (
                                <span className="shrink-0 text-2xs text-muted-foreground">{t('settings:prompts.readOnly')}</span>
                              ) : null}
                            </div>
                            {p.command ? (
                              <p className="mt-0.5 font-mono text-2xs text-muted-foreground">{p.command}</p>
                            ) : null}
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/70">{display.description}</p>
                          </button>
                        </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <MarkdownResourceEditor
          path={editorPath}
          title={
            selected
              ? selected.command
                ? t('settings:prompts.templateTitle', { command: selected.command })
                : resolvePromptRowDisplay(selected, t).name
              : ''
          }
          readOnly={editorReadOnly}
          onSaved={() => void load()}
        />
      </div>
    </div>
  )
}