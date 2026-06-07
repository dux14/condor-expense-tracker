import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import esMessages from '@/messages/es.json'
import { LockSettings } from '@/components/lock/LockSettings'
import { loadLockConfig } from '@/lib/lock/lock-config'

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

beforeEach(() => localStorage.clear())

describe('LockSettings', () => {
  it('enabling the lock requires setting a PIN first, then persists enabled config', async () => {
    render(withIntl(<LockSettings />))
    await userEvent.click(
      screen.getByRole('switch', { name: /Bloqueo de la app/i }),
    )
    const newPin = await screen.findByLabelText(/Nuevo PIN/i)
    const confirm = screen.getByLabelText(/Confirma el PIN/i)
    await userEvent.type(newPin, '4321')
    await userEvent.type(confirm, '4321')
    await userEvent.click(
      screen.getByRole('button', { name: /Guardar|Confirmar/i }),
    )
    // hashPin is async (PBKDF2) — wait for persistence before asserting.
    await waitFor(() => {
      const cfg = loadLockConfig()
      expect(cfg.enabled).toBe(true)
      expect(cfg.pin).not.toBeNull()
    })
  })

  it('rejects mismatched PINs', async () => {
    render(withIntl(<LockSettings />))
    await userEvent.click(
      screen.getByRole('switch', { name: /Bloqueo de la app/i }),
    )
    await userEvent.type(await screen.findByLabelText(/Nuevo PIN/i), '1111')
    await userEvent.type(screen.getByLabelText(/Confirma el PIN/i), '2222')
    await userEvent.click(
      screen.getByRole('button', { name: /Guardar|Confirmar/i }),
    )
    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()
    expect(loadLockConfig().enabled).toBe(false)
  })
})
