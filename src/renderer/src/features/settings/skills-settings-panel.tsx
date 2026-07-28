import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from '@renderer/components/icons'
import { cn } from '@renderer/lib/utils'
import { ipcClient } from '@renderer/lib/ipc-client'
import { Switch } from '@renderer/components/ui/switch'
import { SettingsPageHeader } from '@renderer/features/settings/settings-shell'
import { useSettingsDirtySlice } from '@renderer/features/settings/use-settings-dirty-slice'
import { notifySettingsDirtyChanged } from '@renderer/features/settings/settings-dirty-registry'

type SkillRow = {
  name: string
  description: string
  path?: string
  source?: string
  key: string
  enabled: boolean
  command: string
}

function overridesFromRows(rows: SkillRow[]): Record<string, boolean> {
  const o: Record<string, boolean> = {}
  for (const r of rows) o[r.key] = r.enabled
  return o
}

function overridesEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

export function SkillsSettingsPanel() {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [baseline, setBaseline] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const skillsRef = useRef(skills)
  const draftRef = useRef(draft)
  const baselineRef = useRef(baseline)
  skillsRef.current = skills
  draftRef.current = draft
  baselineRef.current = baseline

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ipcClient.invoke('skills.list')
      const rows: SkillRow[] = res?.skills || []
      setSkills(rows)
      const o = overridesFromRows(rows)
      setBaseline(o)
      setDraft({ ...o })
      baselineRef.current = o
      draftRef.current = o
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const displayRows = useMemo(
    () => skills.map((s) => ({ ...s, enabled: draft[s.key] ?? s.enabled })),
    [skills, draft],
  )

  useSettingsDirtySlice({
    id: 'skills',
    label: t('settings:skills.title'),
    isDirty: () => !overridesEqual(draftRef.current, baselineRef.current),
    commit: async () => {
      const list = skillsRef.current
      const d = draftRef.current
      const b = baselineRef.current
      const changes: Array<{ name: string; path?: string; enabled: boolean }> = []
      for (const s of list) {
        const want = d[s.key] ?? s.enabled
        const was = b[s.key] ?? s.enabled
        if (want === was) continue
        changes.push({ name: s.name, path: s.path, enabled: want })
      }
      if (changes.length > 0) {
        await ipcClient.invoke('skills.applyOverrides', { changes })
      }
      const nextBaseline = { ...d }
      setBaseline(nextBaseline)
      setDraft({ ...nextBaseline })
      baselineRef.current = nextBaseline
      draftRef.current = nextBaseline
      notifySettingsDirtyChanged()
    },
    discard: () => {
      const b = baselineRef.current
      setDraft({ ...b })
      draftRef.current = { ...b }
      notifySettingsDirtyChanged()
    },
  })

  const toggle = (row: SkillRow) => {
    const next = !(draft[row.key] ?? row.enabled)
    setDraft((prev) => {
      const n = { ...prev, [row.key]: next }
      draftRef.current = n
      return n
    })
    notifySettingsDirtyChanged()
  }

  return (
    <div className="w-full">
      <SettingsPageHeader
        title={t('settings:skills.title')}
        description={t('settings:skills.hint')}
        action={
          <button
            type="button"
            className="chrome-icon-btn rounded-md p-2"
            aria-label={t('common:refresh')}
            title={t('common:refresh')}
            onClick={() => void load()}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} strokeWidth={1.5} />
          </button>
        }
      />

      {loading ? (
        <p className="py-3 text-sm text-muted-foreground">{t('common:loading')}</p>
      ) : displayRows.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{t('settings:skills.empty')}</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {displayRows.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium">{s.name}</div>
                {s.command ? <div className="font-mono text-2xs text-muted-foreground">{s.command}</div> : null}
                {s.description ? (
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/70">{s.description}</div>
                ) : null}
              </div>
              <Switch checked={s.enabled} onCheckedChange={() => toggle(s)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}