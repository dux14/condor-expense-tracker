import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import esMessages from '@/messages/es.json'
import { LockScreen } from '@/components/lock/LockScreen'
import type { PinHash } from '@/lib/lock/pin'
import { hashPin } from '@/lib/lock/pin'

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

let storedPin: PinHash

beforeEach(async () => {
  storedPin = await hashPin('1234')
})

describe('LockScreen', () => {
  it('renders branding, the PIN field and unlock button', () => {
    render(withIntl(
      <LockScreen pinHash={storedPin} biometricCredentialId={null} onUnlocked={vi.fn()} />,
    ))
    expect(screen.getByText('Cóndor está bloqueado')).toBeInTheDocument()
    expect(screen.getByLabelText('PIN')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument()
  })

  it('shows the biometric button only when a credential id is present', () => {
    const { rerender } = render(withIntl(
      <LockScreen pinHash={storedPin} biometricCredentialId={null} onUnlocked={vi.fn()} />,
    ))
    expect(screen.queryByRole('button', { name: 'Usar biometría' })).toBeNull()

    rerender(withIntl(
      <LockScreen pinHash={storedPin} biometricCredentialId="Y3JlZA==" onUnlocked={vi.fn()} />,
    ))
    expect(screen.getByRole('button', { name: 'Usar biometría' })).toBeInTheDocument()
  })

  it('calls onUnlocked when the correct PIN is entered', async () => {
    const onUnlocked = vi.fn()
    render(withIntl(
      <LockScreen pinHash={storedPin} biometricCredentialId={null} onUnlocked={onUnlocked} />,
    ))
    await userEvent.type(screen.getByLabelText('PIN'), '1234')
    await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))
    // verifyPin runs PBKDF2 (210k iterations) asynchronously, so the unlock
    // callback fires after the click resolves — wait for it.
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce())
  })

  it('shows an error and does not unlock on a wrong PIN', async () => {
    const onUnlocked = vi.fn()
    render(withIntl(
      <LockScreen pinHash={storedPin} biometricCredentialId={null} onUnlocked={onUnlocked} />,
    ))
    await userEvent.type(screen.getByLabelText('PIN'), '9999')
    await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))
    expect(await screen.findByText('PIN incorrecto')).toBeInTheDocument()
    expect(onUnlocked).not.toHaveBeenCalled()
  })

  it('disables the unlock button after 5 failed attempts (backoff)', async () => {
    render(withIntl(
      <LockScreen pinHash={storedPin} biometricCredentialId={null} onUnlocked={vi.fn()} />,
    ))
    const input = screen.getByLabelText('PIN')
    const btn = screen.getByRole('button', { name: 'Desbloquear' })
    for (let i = 0; i < 5; i++) {
      await userEvent.clear(input)
      await userEvent.type(input, '0000')
      await userEvent.click(btn)
      // Each verifyPin is async (PBKDF2); the component clears the PIN field
      // once a failed attempt is processed. Wait for that before the next try
      // so the attempt counter actually increments to 5.
      await waitFor(() => expect(input).toHaveValue(''))
    }
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeDisabled(),
    )
  })
})
