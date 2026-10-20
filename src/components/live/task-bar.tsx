import { CheckIcon, TriangleAlertIcon } from 'lucide-react'
import { memo } from 'react'
import { ToolIcons } from '@/components/shared/tool-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { taskCost, taskEstimated } from '@/lib/engine'
import { formatCost } from '@/lib/models'
import { useAgent } from '@/lib/store'
import { STATE_NAME, elapsed, formatMinutes, progressLog } from '@/lib/status'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

const BAR = {
  running: 'bg-running-subtle text-running border-r-2 border-running',
  waiting: 'bg-waiting-subtle text-waiting border-r-2 border-waiting',
  done: 'bg-muted text-foreground',
  stopped: 'bg-muted text-muted-foreground',
  failed: 'bg-failed-subtle text-failed',
  denied: 'bg-failed-subtle text-failed',
} as const

interface TaskBarProps {
  task: Task
  /** The clock, or the task's end once it has one, so a finished bar's props stay put. */
  now: number
  left: number
  width: number
  onFlag: (taskId: string) => void
}

export const TaskBar = memo(function TaskBar({ task, now, left, width, onFlag }: TaskBarProps) {
  const agent = useAgent(task.agent)
  const cost = formatCost(taskCost(task), taskEstimated(task))
  const lines = progressLog(task).slice(-2)
  if (task.state === 'waiting') lines.push(`Waiting: ${task.gateText}`)
  if (task.actedAlone) lines.push('Didn’t ask you: you’ve approved this enough times in a row')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          style={{ left: `${left}%`, width: `${width}%` }}
          className={cn(
            'absolute inset-y-2 flex items-center gap-2 overflow-hidden rounded-lg px-3 text-sm font-medium whitespace-nowrap',
            'transition-colors duration-300 animate-in fade-in',
            BAR[task.state as keyof typeof BAR] ?? BAR.done,
          )}
        >
          {task.state === 'running' && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-background/40 to-transparent"
            />
          )}
          <ToolIcons tools={task.tools} />
          <span className="min-w-0 truncate">{task.label}</span>
          {task.state === 'waiting' && (
            <Button
              size="xs"
              variant="outline"
              className="ml-auto animate-nudge text-waiting"
              onClick={() => onFlag(task.id)}
            >
              <TriangleAlertIcon />
              Needs you
            </Button>
          )}
          {!task.actedAlone && task.state !== 'waiting' && (
            <span className="ml-auto shrink-0 text-xs font-normal opacity-70 tabular-nums">{cost}</span>
          )}
          {task.actedAlone && task.state !== 'waiting' && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-background px-2 py-0.5 text-xs text-earned">
              <CheckIcon className="size-3" />
              Didn’t need to ask
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="flex-col items-start gap-1 px-3 py-2">
        <span className="text-background/70 tabular-nums">
          {agent.name} · {STATE_NAME[task.state]} · {formatMinutes(elapsed(task, now))} · {cost}
        </span>
        <span className="text-background/70 tabular-nums">
          {Math.round(task.inputTokens).toLocaleString()} tokens in · {Math.round(task.outputTokens).toLocaleString()} out
          {taskEstimated(task) && ' · estimate'}
        </span>
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
})
