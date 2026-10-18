import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFlow } from '@/lib/store'
import type { RunMode } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Simulated runs play back made-up work for free; real runs call models through the local runner. */
export function ModeSelect({ className }: { className?: string }) {
  const mode = useFlow((s) => s.mode)
  const setMode = useFlow((s) => s.setMode)

  return (
    <Select value={mode} onValueChange={(v) => setMode(v as RunMode)}>
      <SelectTrigger
        data-mode={mode}
        className={cn('data-[mode=real]:border-running data-[mode=real]:text-running', className)}
        aria-label="Run mode"
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
  const status = useFlow((s) => s.runnerStatus)
  if (mode !== 'real') return null
  if (status.state === 'checking') return <span className="text-xs text-muted-foreground">Looking for the runner…</span>
  if (status.state === 'offline') {
    return (
      <span className="text-xs text-waiting animate-in fade-in">
        The runner isn’t running. Start it with <code className="font-mono">npm run runner</code>.
      </span>
    )
  }
  if (!status.health.providers.anthropic) {
    return (
      <span className="text-xs text-waiting animate-in fade-in">
        Add ANTHROPIC_API_KEY to <code className="font-mono">.env.local</code> and restart the runner.
      </span>
    )
  }
  return <span className="text-xs text-earned animate-in fade-in">Runner ready · files go to workspace/</span>
}
