'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { SettingRow } from '@/components/settings/SettingRow'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SetPinDialog } from '@/components/lock/SetPinDialog'
import { cn } from '@/lib/utils'
import {
  loadLockConfig,
  saveLockConfig,
  clearLockConfig,
  TIMEOUT_OPTIONS,
  type LockConfig,
} from '@/lib/lock/lock-config'
import { hashPin } from '@/lib/lock/pin'
import {
  isBiometricAvailable,
  registerPlatformCredential,
} from '@/lib/lock/webauthn'

type PinDialogMode = 'set' | 'change' | null

export function LockSettings() {
  const t = useTranslations('Lock')
  const [cfg, setCfg] = React.useState<LockConfig>(() => loadLockConfig())
  const [pinDialog, setPinDialog] = React.useState<PinDialogMode>(null)
  const [biometricAvailable, setBiometricAvailable] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await isBiometricAvailable()
      if (!cancelled) setBiometricAvailable(ok)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function toggleLock() {
    if (cfg.enabled) {
      // Disabling drops pin + biometric + enabled entirely.
      clearLockConfig()
      setCfg(loadLockConfig())
      toast(t('lockDisabled'))
      return
    }
    if (cfg.pin === null) {
      // Need a PIN before the lock can be enabled.
      setPinDialog('set')
      return
    }
    const next = { ...cfg, enabled: true }
    saveLockConfig(next)
    setCfg(next)
    toast.success(t('lockEnabled'))
  }

  async function handlePinSubmit(plain: string) {
    const pin = await hashPin(plain)
    if (pinDialog === 'change') {
      const next = { ...cfg, pin }
      saveLockConfig(next)
      setCfg(next)
      toast.success(t('pinSaved'))
    } else {
      const next = { ...cfg, enabled: true, pin }
      saveLockConfig(next)
      setCfg(next)
      toast.success(t('lockEnabled'))
    }
  }

  function handleTimeout(timeoutMinutes: number) {
    const next = { ...cfg, timeoutMinutes }
    saveLockConfig(next)
    setCfg(next)
  }

  async function handleAddBiometric() {
    const id = await registerPlatformCredential()
    if (id) {
      const next = { ...cfg, webauthnCredentialId: id }
      saveLockConfig(next)
      setCfg(next)
      toast.success(t('biometricOn'))
    }
  }

  function handleRemoveBiometric() {
    const next = { ...cfg, webauthnCredentialId: null }
    saveLockConfig(next)
    setCfg(next)
  }

  const enabled = cfg.enabled

  return (
    <section className="mb-5">
      <p className="mb-2 text-xs font-semibold tracking-wider text-muted-txt">
        {t('settingsTitle')}
      </p>
      <div className="overflow-hidden rounded-[12px] bg-surface">
        {/* Enable / disable toggle */}
        <SettingRow label={t('enableLock')} description={t('enableLockDesc')}>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t('enableLock')}
            onClick={toggleLock}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
              enabled ? 'bg-condor-primary' : 'bg-outline',
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </SettingRow>

        {enabled && (
          <>
            <div className="mx-4 h-px bg-outline/40" />
            <SettingRow
              label={t('changePin')}
              onPress={() => setPinDialog('change')}
            />

            <div className="mx-4 h-px bg-outline/40" />
            <SettingRow label={t('timeout')}>
              <Select
                value={String(cfg.timeoutMinutes)}
                onValueChange={(v) => handleTimeout(Number(v))}
              >
                <SelectTrigger
                  aria-label={t('timeout')}
                  className="h-8 border-outline bg-surface-2 text-text text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEOUT_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {t('minutes', { count: m })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <div className="mx-4 h-px bg-outline/40" />
            {!biometricAvailable ? (
              <SettingRow
                label={t('biometricUnavailable')}
                className="opacity-60"
              />
            ) : cfg.webauthnCredentialId === null ? (
              <SettingRow
                label={t('addBiometric')}
                onPress={handleAddBiometric}
              />
            ) : (
              <SettingRow
                label={t('removeBiometric')}
                onPress={handleRemoveBiometric}
              />
            )}
          </>
        )}
      </div>

      <SetPinDialog
        open={pinDialog !== null}
        onOpenChange={(o) => {
          if (!o) setPinDialog(null)
        }}
        title={pinDialog === 'change' ? t('changePin') : t('setPin')}
        onSubmit={handlePinSubmit}
      />
    </section>
  )
}
