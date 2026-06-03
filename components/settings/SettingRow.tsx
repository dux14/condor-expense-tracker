import { cn } from '@/lib/utils'

interface SettingRowProps {
  label: string
  description?: string
  children?: React.ReactNode
  onPress?: () => void
  danger?: boolean
  className?: string
}

export function SettingRow({
  label,
  description,
  children,
  onPress,
  danger = false,
  className,
}: SettingRowProps) {
  const Tag = onPress ? 'button' : 'div'

  return (
    <Tag
      type={onPress ? 'button' : undefined}
      onClick={onPress}
      className={cn(
        'flex w-full items-center justify-between gap-3',
        'min-h-[48px] px-4 py-3',
        'bg-surface',
        onPress && 'hover:bg-surface-2 active:bg-surface-3 transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
        className,
      )}
    >
      {/* Left: label + optional description */}
      <div className="flex flex-col gap-0.5 text-left">
        <span
          className={cn(
            'text-sm font-medium',
            danger ? 'text-danger' : 'text-text',
          )}
        >
          {label}
        </span>
        {description && (
          <span className="text-xs text-muted-txt">{description}</span>
        )}
      </div>

      {/* Right: trailing control/value */}
      {children && (
        <div className="flex items-center shrink-0">{children}</div>
      )}
    </Tag>
  )
}
