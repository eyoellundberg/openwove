import { FastForwardIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FAST_FORWARD_RUNS, RUNS_SHOWN, RUNS_SUMMARY } from '@/lib/constants'
import { useFlow } from '@/lib/store'
import type { RunCell } from '@/lib/types'
import { cn } from '@/lib/utils'

const CELL: Record<RunCell, string> = {
  asked: 'bg-waiting border-waiting',
  acted: 'bg-earned-subtle border-earned',
}

export function RunsStrip() {
  const runs = useFlow((s) => s.runs)
  const fastForward = useFlow((s) => s.fastForward)

  const shown = runs.slice(-RUNS_SHOWN)
  const offset = runs.length - shown.length
  const recent = runs.slice(-RUNS_SUMMARY).flatMap((r) => r.cells)
  const asked = recent.filter((c) => c === 'asked').length

  return (
    <section className="flex flex-wrap items-center gap-4 border-t px-4 py-3">
      <div className="flex min-w-40 flex-col gap-0.5">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Approvals per run</h3>
        <p className="text-xs text-muted-foreground">
          {recent.length
            ? `Last ${Math.min(RUNS_SUMMARY, runs.length)} runs: asked you ${asked} of ${recent.length} times`
            : 'Each square is one approval step'}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-1">
        {!shown.length && <span className="text-sm text-muted-foreground">Runs show up here when the flow finishes.</span>}
        {shown.map((r, i) => (
          <div key={r.id} title={`Run ${offset + i + 1}`} className="flex flex-col items-center gap-1">
            {(r.cells.length ? r.cells : [null]).map((c, j) => (
              <span
                key={j}
                className={cn('size-3.5 rounded-sm border bg-muted animate-in zoom-in-50 fade-in', c && CELL[c])}
              />
            ))}
            <small className="font-mono text-xs text-muted-foreground">{offset + i + 1}</small>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm border', CELL.asked)} />
          Asked you
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm border', CELL.acted)} />
          Went ahead on its own
        </span>
      </div>

      <Button variant="outline" size="sm" onClick={fastForward}>
        <FastForwardIcon />
        Fast-forward {FAST_FORWARD_RUNS} runs
      </Button>
    </section>
  )
}
