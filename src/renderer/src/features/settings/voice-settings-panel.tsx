import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, ExternalLink, Search, KeyRound } from 'lucide-react'
import { ipcClient } from '@renderer/lib/ipc-client'
import { useSettingsDraft } from '@renderer/features/settings/settings-draft-context'
import { SettingsPageHeader } from '@renderer/features/settings/settings-shell'
import { SettingRow, SettingsSection } from '@renderer/features/settings/settings-page-shared'
import { btnDanger, btnOutline, inputCls, selectCls } from '@renderer/features/settings/settings-controls'
import { cn } from '@renderer/lib/utils'

type CodexProbe = {
  ok: boolean
  authFile: string | null
  authMode?: string
  source?: 'manual' | 'file'
  tokenPreview?: string
  detail?: string
}

export function VoiceSettingsPanel() {
  const { t } = useTranslation()
  const { draft, dirty, setAsrConfig } = useSettingsDraft()
  const cfg = draft.asrConfig
  const [probe, setProbe] = useState<CodexProbe | null>(null)
  const [probing, setProbing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(
    cfg.provider === 'codex-asr-cli' || cfg.provider === 'codex-asr-serve',
  )

  const runProbe = useCallback(async () => {
    setProbing(true)
    try {
      const res = await ipcClient.invoke('asr.probeCodexAuth', {
        config: {
          codexAuthFile: cfg.codexAuthFile,
          codexAccessToken: cfg.codexAccessToken,
          codexAccessTokenPreserved: cfg.codexAccessTokenPreserved,
          codexAccessTokenSet: cfg.codexAccessTokenSet,
        },
      })
      setProbe(res as CodexProbe)
    } catch (e: unknown) {
      setProbe({ ok: false, authFile: null, detail: e instanceof Error ? e.message : String(e) })
    } finally {
      setProbing(false)
    }
  }, [cfg.codexAuthFile, cfg.codexAccessToken, cfg.codexAccessTokenPreserved, cfg.codexAccessTokenSet])

  useEffect(() => {
    if (cfg.provider === 'none') {
      setAsrConfig({ provider: 'codex-asr-builtin' })
    }
  }, [])

  useEffect(() => {
    void runProbe()
  }, [runProbe])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const testCfg =
        cfg.provider === 'none' || cfg.provider === 'codex-asr-builtin'
          ? { ...cfg, provider: 'codex-asr-builtin' as const }
          : cfg
      const res = await ipcClient.invoke('asr.testConnection', { config: testCfg })
      if (res?.ok) {
        setTestResult(`${t('settings:voice.testSuccess')}${res.detail ? `: ${res.detail}` : ''}`)
      } else {
        setTestResult(`${t('settings:voice.testFailed')}${res?.detail ? `: ${res.detail}` : ''}`)
      }
    } catch (e: unknown) {
      setTestResult(`${t('settings:voice.testFailed')}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTesting(false)
    }
  }

  const useBuiltin = cfg.provider === 'codex-asr-builtin' || cfg.provider === 'none'
  const testSuccessPrefix = t('settings:voice.testSuccess')
  const hasStoredToken = !!cfg.codexAccessTokenSet && !cfg.codexAccessToken?.trim()

  return (
    <div className="space-y-8">
      <SettingsPageHeader title={t('settings:voice.title')} description={t('settings:voice.descriptionBuiltin')} />

      {dirty && (
        <div className="rounded-md border border-amber-500/35 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {t('settings:voice.unsavedVoiceHint')}
        </div>
      )}

      <SettingsSection title={t('settings:voice.builtinTitle')}>
        <SettingRow label={t('settings:voice.builtinTitle')} description={t('settings:voice.builtinDesc')}>
          <button
            type="button"
            className={cn(btnOutline, useBuiltin && 'border-primary/50 bg-primary/5')}
            onClick={() => setAsrConfig({ provider: 'codex-asr-builtin' })}
          >
            {useBuiltin ? t('settings:voice.builtinOn') : t('settings:voice.builtinEnable')}
          </button>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t('settings:voice.codexLogin')} description={t('settings:voice.codexLoginDesc')}>
        <div className="space-y-2 py-3">
          <div className="text-base font-medium text-foreground">{t('settings:voice.accessTokenManual')}</div>
          <textarea
            className={cn(inputCls, 'min-h-[4.5rem] max-w-xl resize-y')}
            value={cfg.codexAccessToken || ''}
            placeholder={
              hasStoredToken
                ? t('settings:voice.accessTokenStoredPlaceholder', {
                    preview: cfg.codexAccessTokenPreview || '••••',
                  })
                : t('settings:voice.accessTokenPlaceholder')
            }
            spellCheck={false}
            onChange={(e) =>
              setAsrConfig({
                codexAccessToken: e.target.value || undefined,
                codexAccessTokenPreserved: false,
                codexAccessTokenSet: e.target.value.trim().length >= 20 ? true : false,
                codexAccessTokenPreview: undefined,
              })
            }
            onBlur={() => void runProbe()}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnOutline} disabled={probing} onClick={() => void runProbe()}>
              <KeyRound className="mr-1 inline h-3 w-3" strokeWidth={2} />
              {probing ? t('settings:voice.detecting') : t('settings:voice.verifyAuth')}
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={async () => {
                const res = await ipcClient.invoke('asr.importCodexAccessToken', {
                  codexAuthFile: cfg.codexAuthFile,
                })
                if (res?.ok && res.accessToken) {
                  setAsrConfig({
                    codexAccessToken: res.accessToken,
                    codexAccessTokenPreserved: false,
                    codexAccessTokenSet: true,
                  })
                  void runProbe()
                }
              }}
            >
              {t('settings:voice.fillFromAuthFile')}
            </button>
            {hasStoredToken && (
              <button
                type="button"
                className={cn(btnDanger, 'ml-auto')}
                onClick={() =>
                  setAsrConfig({
                    codexAccessToken: undefined,
                    codexAccessTokenSet: false,
                    codexAccessTokenPreserved: false,
                    codexAccessTokenPreview: undefined,
                  })
                }
              >
                {t('settings:voice.clearSavedToken')}
              </button>
            )}
          </div>
          {probe && (
            <div
              className={cn(
                'rounded-md border px-2.5 py-2 text-xs',
                probe.ok
                  ? 'border-green-500/30 bg-green-500/5 text-green-800 dark:text-green-300'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200',
              )}
            >
              {probe.ok ? (
                <>
                  <div>
                    {t('settings:voice.codexAuthOk')}
                    {probe.source === 'manual'
                      ? ` (${t('settings:voice.authSourceManual')})`
                      : probe.source === 'file'
                        ? ` (${t('settings:voice.authSourceFile')})`
                        : ''}
                  </div>
                  {probe.authFile && <div className="mt-0.5 font-mono opacity-80">{probe.authFile}</div>}
                  {probe.tokenPreview && (
                    <div className="mt-0.5">{t('settings:voice.tokenPreview', { preview: probe.tokenPreview })}</div>
                  )}
                </>
              ) : (
                <div>{probe.detail || t('settings:voice.codexAuthMissing')}</div>
              )}
            </div>
          )}
          <div className="pt-1">
            <div className="text-base font-medium text-foreground">{t('settings:voice.authFileOverride')}</div>
            <input
              className={cn(inputCls, 'mt-1 max-w-md')}
              value={cfg.codexAuthFile || ''}
              placeholder={t('settings:voice.authFilePlaceholder')}
              onChange={(e) => setAsrConfig({ codexAuthFile: e.target.value || undefined })}
            />
          </div>
        </div>
      </SettingsSection>

      {useBuiltin && (
        <SettingsSection title={t('settings:voice.language')} description={t('settings:voice.builtinRuntimeHint')}>
          <SettingRow label={t('settings:voice.language')}>
            <select
              className={selectCls}
              value={cfg.language || 'auto'}
              onChange={(e) => setAsrConfig({ language: e.target.value as 'auto' | 'zh' | 'en' })}
            >
              <option value="auto">{t('settings:voice.languageAuto')}</option>
              <option value="zh">{t('settings:voice.langZh')}</option>
              <option value="en">{t('settings:voice.langEn')}</option>
            </select>
          </SettingRow>
          <SettingRow label={t('settings:voice.testConnection')}>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <button type="button" className={btnOutline} disabled={testing} onClick={() => void handleTest()}>
                {testing ? t('settings:voice.testing') : t('settings:voice.testConnection')}
              </button>
              {testResult && (
                <div
                  className={cn(
                    'max-w-[280px] text-xs sm:text-right',
                    testResult.startsWith(testSuccessPrefix)
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-destructive',
                  )}
                >
                  {testResult}
                </div>
              )}
            </div>
          </SettingRow>
        </SettingsSection>
      )}

      <SettingsSection
        title={t('settings:voice.advancedTitle')}
        description={t('settings:voice.advancedHint')}
        action={
          <button
            type="button"
            className="text-xs text-muted-foreground/70 hover:text-foreground"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? t('settings:voice.hideAdvanced') : t('settings:voice.showAdvanced')}
          </button>
        }
      >
        {showAdvanced ? (
          <>
            <SettingRow label={t('settings:voice.provider')}>
              <select
                className={selectCls}
                value={cfg.provider === 'codex-asr-builtin' || cfg.provider === 'none' ? 'codex-asr-cli' : cfg.provider}
                onChange={(e) => setAsrConfig({ provider: e.target.value as typeof cfg.provider })}
              >
                <option value="codex-asr-cli">{t('settings:voice.providerCli')}</option>
                <option value="codex-asr-serve">{t('settings:voice.providerServe')}</option>
              </select>
            </SettingRow>
            {cfg.provider === 'codex-asr-cli' && (
              <SettingRow label={t('settings:voice.cliBinaryPath')} description={t('settings:voice.cliBinaryPathDesc')}>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <input
                    className={cn(inputCls, 'max-w-md')}
                    value={cfg.cliBinaryPath || ''}
                    placeholder="codex-asr"
                    onChange={(e) => setAsrConfig({ cliBinaryPath: e.target.value })}
                  />
                  <button
                    type="button"
                    className={btnOutline}
                    onClick={async () => {
                      const res = await ipcClient.invoke('asr.detectBinary')
                      if (res?.path) setAsrConfig({ cliBinaryPath: res.path })
                    }}
                  >
                    <Search className="mr-1 inline h-3 w-3" strokeWidth={2} />
                    {t('settings:voice.autoDetect')}
                  </button>
                </div>
              </SettingRow>
            )}
            {cfg.provider === 'codex-asr-serve' && (
              <>
                <SettingRow label={t('settings:voice.serverUrl')} description={t('settings:voice.serverUrlDesc')}>
                  <input
                    className={cn(inputCls, 'max-w-md')}
                    value={cfg.serverUrl || ''}
                    placeholder="http://127.0.0.1:8788"
                    onChange={(e) => setAsrConfig({ serverUrl: e.target.value })}
                  />
                </SettingRow>
                <SettingRow label={t('settings:voice.apiKey')} description={t('settings:voice.apiKeyDesc')}>
                  <input
                    type="password"
                    className={cn(inputCls, 'max-w-md')}
                    value={cfg.apiKey || ''}
                    placeholder={t('settings:voice.localApiKeyPlaceholder')}
                    onChange={(e) => setAsrConfig({ apiKey: e.target.value })}
                  />
                </SettingRow>
              </>
            )}
          </>
        ) : null}
      </SettingsSection>

      <div className="flex items-center gap-2 border-t border-border/40 pt-4 text-sm text-muted-foreground">
        <Mic className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span>{t('settings:voice.cliInstallHint')}</span>
        <a
          href={t('settings:voice.installUrl')}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          codex-asr <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </a>
      </div>
    </div>
  )
}
