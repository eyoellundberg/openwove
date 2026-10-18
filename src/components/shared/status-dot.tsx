import type { TaskState } from '@/lib/types'
import { cn } from '@/lib/utils'

const DOT: Partial<Record<TaskState, string>> = {
  running: 'bg-running animate-pulse-dot',
  waiting: 'bg-waiting',
  done: 'bg-muted-foreground',
  denied: 'bg-failed',
  failed: 'bg-failed',
  skipped: 'bg-failed',
}

export function StatusDot({ state, className }: { state?: TaskState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('size-2 shrink-0 rounded-full bg-border', state && DOT[state], className)}
    />
  )
}
