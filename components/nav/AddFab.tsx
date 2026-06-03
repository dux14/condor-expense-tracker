import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddFabProps {
  className?: string
  label?: string
}

export function AddFab({ className, label }: AddFabProps) {
  return (
    <Link
      href="/anadir"
      aria-label={label ?? 'Añadir gasto'}
      className={cn(
        'flex items-center justify-center',
        'h-14 w-14 rounded-full',
        'bg-condor-primary text-on-primary',
        'shadow-soft',
        // Mint glow ring
        'ring-4 ring-condor-primary/30',
        'hover:ring-condor-primary/50 hover:scale-105',
        'active:scale-95',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-condor-primary/60',
        className,
      )}
    >
      <Plus size={28} strokeWidth={2.5} />
    </Link>
  )
}
