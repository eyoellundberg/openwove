import { cn } from '@/lib/utils'

/** The OpenWove mark: two strands each way, woven over and under. Follows the theme. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('size-6 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <g strokeWidth="3.5" className="stroke-background">
        <path d="M7 11.5h18M7 20.5h18M11.5 7v18M20.5 7v18" strokeLinecap="round" />
        {/* Each crossing cuts the strand that goes under, then redraws the one on top. */}
        <path d="M7.8 11.5h7.4M16.8 20.5h7.4" strokeWidth="7" className="stroke-foreground" />
        <path d="M7.4 11.5h8.2M16.4 20.5h8.2" />
        <path d="M20.5 7.8v7.4M11.5 16.8v7.4" strokeWidth="7" className="stroke-foreground" />
        <path d="M20.5 7.4v8.2M11.5 16.4v8.2" />
      </g>
    </svg>
  )
}
