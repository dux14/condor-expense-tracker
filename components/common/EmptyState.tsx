import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-1 text-muted-txt opacity-60 [&_svg]:size-10">
          {icon}
        </div>
      )}

      <h3 className="font-heading text-base font-medium text-text">{title}</h3>

      {description && (
        <p className="text-sm text-muted-txt max-w-xs">{description}</p>
      )}

      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
