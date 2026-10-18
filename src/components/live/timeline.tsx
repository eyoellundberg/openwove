import { AgentAvatar } from '@/components/shared/agent-avatar'
import { Badge } from '@/components/ui/badge'
import { AGENTS, laneOf } from '@/lib/catalog'
import { TIMELINE_TICKS, WINDOW_MINUTES } from '@/lib/constants'
import { useFlow } from '@/lib/store'
import type { Task } from '@/lib/types'
import { TaskBar } from './task-bar'

/** Percent across the track for a moment in simulated time. */
const xOf = (t: number, now: number) => ((t - (now - WINDOW_MINUTES)) / WINDOW_MINUTES) * 100
const tickX = (minutesAgo: number) => ((WINDOW_MINUTES - minutesAgo) / WINDOW_MINUTES) * 100
/** Vertical centre of a lane, as a percent of all lanes. */
const laneY = (lane: number) => ((lane + 0.5) / AGENTS.length) * 100

function agentBadge(tasks: Task[], agent: Task['agent']) {
  const mine = tasks.filter((t) => t.agent === agent)
  if (mine.some((t) => t.state === 'waiting')) return 'waiting'
  if (mine.some((t) => t.state === 'running')) return null
  return 'idle'
}

export function Timeline({ onFlag }: { onFlag: (taskId: string) => void }) {
  const now = useFlow((s) => s.simT)
  const tasks = useFlow((s) => s.tasks)
  const runId = useFlow((s) => s.runId)

  const visible = tasks.filter((t) => t.start != null && xOf(t.end ?? now, now) > 0)
  const run = tasks.filter((t) => t.runId === runId)

  // Hand-offs: from every step in a stage to every step in the next stage that has started.
  const links = run.flatMap((to) => {
    if (!to.stage || to.start == null) return []
    return run
      .filter((from) => from.stage === to.stage! - 1 && from.end != null && from.agent !== to.agent)
      .map((from) => {
        const x1 = xOf(from.end!, now)
        const x2 = xOf(to.start!, now)
        const y1 = laneY(laneOf(from.agent))
        const y2 = laneY(laneOf(to.agent))
        const bend = Math.max(x2 - x1, 1)
        return {
          id: `${from.id}->${to.id}`,
          settled: to.state === 'done',
          d: `M${x1} ${y1} C${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        }
      })
  })

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-2xl pr-4">
        <div className="flex w-40 shrink-0 flex-col sm:w-52">
          <div className="h-10" />
          {AGENTS.map((a) => {
            const badge = agentBadge(tasks, a.id)
            return (
              <div key={a.id} className="flex h-16 items-center gap-3 pl-4">
                <AgentAvatar agent={a.id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    {a.name}
                    {badge === 'idle' && <Badge variant="secondary">Idle</Badge>}
                    {badge === 'waiting' && (
                      <Badge className="bg-waiting-subtle text-waiting animate-in fade-in">Needs you</Badge>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{a.model}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="relative h-10 font-mono text-xs text-muted-foreground">
            {TIMELINE_TICKS.map((m) => (
              <span key={m} className="absolute top-3 -translate-x-1/2" style={{ left: `${tickX(m)}%` }}>
                −{m}m
              </span>
            ))}
            <Badge className="absolute top-2 right-0 bg-running-subtle font-mono text-running">now</Badge>
          </div>

          <div className="relative">
            {TIMELINE_TICKS.map((m) => (
              <div key={m} className="absolute inset-y-0 w-px bg-lane" style={{ left: `${tickX(m)}%` }} />
            ))}
            {AGENTS.map((a) => (
              <div key={a.id} className="relative h-16 border-t border-lane">
                {visible
                  .filter((t) => t.agent === a.id)
                  .map((t) => {
                    const left = xOf(t.start!, now)
                    return (
                      <TaskBar
                        key={t.id}
                        task={t}
                        now={now}
                        left={left}
                        width={Math.max(xOf(t.end ?? now, now) - left, 1)}
                        onFlag={onFlag}
                      />
                    )
                  })}
              </div>
            ))}
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full overflow-visible"
            >
              {links.map((l) => (
                <path
                  key={l.id}
                  d={l.d}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="3 4"
                  className={l.settled ? 'stroke-muted-foreground/50' : 'animate-march stroke-running'}
                  strokeWidth={1.5}
                />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
