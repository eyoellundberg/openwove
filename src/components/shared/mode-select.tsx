import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NO_KEY_HINT, readiness } from '@/lib/runner-status'
import { useFlow } from '@/lib/store'
import type { RunMode } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ModeSelectProps {
  className?: string
  /** Which mode to show and change. Defaults to the run mode in use. */
  value?: RunMode
  onValueChange?: (mode: RunMode) => void
  label?: string
}

/** Simulated runs play back made-up work for free; real runs call models through the local runner. */
export function ModeSelect({ className, value, onValueChange, label = 'Run mode' }: ModeSelectProps) {
  const mode = useFlow((s) => s.mode)
  const setMode = useFlow((s) => s.setMode)
  const current = value ?? mode
  const change = onValueChange ?? setMode

  return (
    <Select value={current} onValueChange={(v) => change(v as RunMode)}>
      <SelectTrigger
        data-mode={current}
        className={cn('data-[mode=real]:border-running data-[mode=real]:text-running', className)}
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="simulated">Simulated run</SelectItem>
        <SelectItem value="real">Real run</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** One line on whether a real run can happen, and what's missing if not. */
export function RunnerNote() {
  const mode = useFlow((s) => s.mode)
  const level = useFlow((s) => readiness(s.runnerStatus))
  if (mode !== 'real') return null
  if (level === 'checking') return <span className="text-xs text-muted-foreground">Looking for the runner…</span>
  if (level === 'offline') {
    return (
      <span className="text-xs text-waiting animate-in fade-in">
        The runner isn’t running. Start it with <code className="font-mono">npm run runner</code>.
      </span>
    )
  }
  if (level === 'no-key') return <span className="text-xs text-waiting animate-in fade-in">{NO_KEY_HINT}</span>
  return <span className="text-xs text-earned animate-in fade-in">Runner ready · files go to workspace/</span>
}
