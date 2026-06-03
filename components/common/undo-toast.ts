import { toast } from 'sonner'

interface UndoToastOptions {
  message: string
  actionLabel: string
  onUndo: () => void
}

export function showUndoToast({ message, actionLabel, onUndo }: UndoToastOptions): void {
  toast(message, {
    action: {
      label: actionLabel,
      onClick: onUndo,
    },
  })
}
