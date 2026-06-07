'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { isValidPin } from '@/lib/lock/pin'

interface SetPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSubmit: (pin: string) => void
}

export function SetPinDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
}: SetPinDialogProps) {
  const t = useTranslations('Lock')
  const tCommon = useTranslations('Common')
  const [pin, setPin] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setPin('')
    setConfirm('')
    setError(null)
  }

  // Reset internal state whenever the dialog opens or closes, and forward
  // the change. Keeps the reset out of an effect (no cascading renders).
  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidPin(pin)) {
      setError(t('pinTooShort'))
      return
    }
    if (pin !== confirm) {
      setError(t('pinMismatch'))
      return
    }
    onSubmit(pin)
    reset()
    onOpenChange(false)
  }

  const onlyDigits = (v: string) => v.replace(/\D/g, '')

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </AlertDialogHeader>

          <div className="grid gap-3 text-left">
            <div className="grid gap-1.5">
              <label
                htmlFor="set-pin-new"
                className="text-sm font-medium text-text"
              >
                {t('newPin')}
              </label>
              <Input
                id="set-pin-new"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(onlyDigits(e.target.value))
                  setError(null)
                }}
              />
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="set-pin-confirm"
                className="text-sm font-medium text-text"
              >
                {t('confirmPin')}
              </label>
              <Input
                id="set-pin-confirm"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={confirm}
                onChange={(e) => {
                  setConfirm(onlyDigits(e.target.value))
                  setError(null)
                }}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              className="bg-condor-primary text-on-primary hover:bg-condor-primary/90"
            >
              Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
