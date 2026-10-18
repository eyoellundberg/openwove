import { PauseIcon, PlayIcon, RotateCcwIcon, SparkleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ModeSelect, RunnerNote } from '@/components/shared/mode-select'
import { Notice } from '@/components/shared/notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card'
import { WINDOW_MINUTES } from '@/lib/constants'
import { totalCost } from '@/lib/engine'
import { formatCost } from '@/lib/models'
import { useFlow } from '@/lib/store'
import { RunsStrip } from './runs-strip'
import { Timeline } from './timeline'
import { WaitingTray } from './waiting-tray'

const FLASH_MS = 900

export function LiveView() {
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
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    if (!flashId) return
    const t = setTimeout(() => setFlashId(null), FLASH_MS)
    return () => clearTimeout(t)
  }, [flashId])

  // "Needs you" on a bar points at its row in the tray.
  const flag = (taskId: string) => {
    setFlashId(taskId)
    const row = document.getElementById(`ask-${taskId}`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    row?.querySelector<HTMLButtonElement>('[data-approve]')?.focus({ preventScroll: true })
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-semibold">
            <SparkleIcon className="size-4 text-running" />
            Agents
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground tabular-nums">
            <span className="size-2 rounded-full bg-running" />
            {running} running
          </span>
          <span
            data-zero={waiting === 0}
            className="inline-flex items-center gap-1.5 text-sm font-normal text-waiting tabular-nums transition-colors data-[zero=true]:text-muted-foreground"
          >
            <span className="size-2 rounded-full bg-current" />
            {waiting} need you
          </span>
          <span className="text-sm font-normal text-muted-foreground tabular-nums">{runCost} this run</span>
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={togglePause}>
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" onClick={run}>
            <RotateCcwIcon />
            Run again
          </Button>
          <ModeSelect />
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Last {WINDOW_MINUTES[mode]}m
          </Badge>
        </CardAction>
      </CardHeader>
      <div className="flex flex-col gap-2 px-4 pt-3 empty:hidden">
        <Notice />
        {mode === 'real' && <RunnerNote />}
      </div>
      <Timeline onFlag={flag} />
      <WaitingTray flashId={flashId} />
      <RunsStrip />
    </Card>
  )
}
