import { PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { ModeSelect } from '@/components/shared/mode-select'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { WINDOW_MINUTES } from '@/lib/constants'
import { totalCost } from '@/lib/engine'
import { formatCost } from '@/lib/models'
import { useFlow } from '@/lib/store'

export function LiveHeader() {
  const running = useFlow((s) => s.tasks.filter((t) => t.state === 'running').length)
  const waiting = useFlow((s) => s.tasks.filter((t) => t.state === 'waiting').length)
  const paused = useFlow((s) => s.paused)
  const togglePause = useFlow((s) => s.togglePause)
  const run = useFlow((s) => s.run)
  const mode = useFlow((s) => s.mode)
  const runCost = useFlow((s) => {
    const { cost, estimated } = totalCost(s.tasks.filter((t) => t.runId === s.runId))
    return formatCost(cost, estimated)
  })

  return (
    <PageHeader
      title="Live"
      subtitle={
        <span className="tabular-nums">
          {running} running ·{' '}
          <span data-zero={waiting === 0} className="text-waiting transition-colors data-[zero=true]:text-muted-foreground">
            {waiting} need you
          </span>{' '}
          · {runCost} this run · last {WINDOW_MINUTES[mode]}m
        </span>
      }
    >
      <Button variant="outline" size="sm" onClick={togglePause}>
        {paused ? <PlayIcon /> : <PauseIcon />}
        {paused ? 'Resume' : 'Pause'}
      </Button>
      <Button variant="outline" size="sm" onClick={run}>
        <RotateCcwIcon />
        Run again
      </Button>
      <ModeSelect />
    </PageHeader>
  )
}
