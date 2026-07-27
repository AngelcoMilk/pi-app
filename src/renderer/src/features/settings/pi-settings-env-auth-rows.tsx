import { useTranslation } from 'react-i18next'
import { Check, AlertCircle } from 'lucide-react'
import { SettingRow } from './settings-page-shared'
import { type PiInfo, type PiSettingsSnapshot } from './pi-settings-shared'

export function PiSettingsEnvAuthRows({ info, ui }: { info: PiInfo | null; ui: PiSettingsSnapshot }) {
  const { t } = useTranslation()
  return (
    <>
      <SettingRow label={t('settings:pi.agentDir')} description={t('settings:pi.agentDirDesc')}>
        <span className="max-w-[220px] truncate font-mono text-xs text-muted-foreground" title={info?.agentDir}>
          {info?.agentDir || '~/.pi/agent'}
        </span>
      </SettingRow>
      <SettingRow label={t('settings:pi.auth')} description={t('settings:pi.authDesc')}>
        <div className="flex items-center gap-1.5">
          {info?.authStatus === 'configured' ? (
            <>
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" strokeWidth={2} />
              <span className="text-sm text-green-600 dark:text-green-400">{t('settings:pi.authConfigured')}</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-muted-foreground/50" strokeWidth={2} />
              <span className="text-sm text-muted-foreground">{t('settings:pi.authNotConfigured')}</span>
            </>
          )}
        </div>
      </SettingRow>
      {info && (info.authProviders?.length ?? 0) > 0 && (
        <SettingRow label={t('settings:pi.provider')} description={t('settings:pi.providerDesc')}>
          <div className="flex max-w-xs flex-wrap gap-1 sm:justify-end">
            {(info.authProviders as Array<{ provider?: string }>).map((p) => (
              <span key={p.provider} className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-2xs">
                {p.provider}
              </span>
            ))}
          </div>
        </SettingRow>
      )}
      <SettingRow label={t('settings:pi.sessionDir')} description={t('settings:pi.sessionDirDesc')}>
        <span className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
          {String(ui?.sessionDir || t('settings:pi.sessionDirDefault'))}
        </span>
      </SettingRow>
    </>
  )
}
