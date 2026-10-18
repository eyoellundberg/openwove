import { AgentAvatar } from '@/components/shared/agent-avatar'
import { Badge } from '@/components/ui/badge'
import { TIMELINE_TICKS, WINDOW_MINUTES } from '@/lib/constants'
import { totalCost } from '@/lib/engine'
import { formatCost, modelInfo } from '@/lib/models'
import { useFlow } from '@/lib/store'
import type { Agent, Task } from '@/lib/types'
import { TaskBar } from './task-bar'

function agentBadge(tasks: Task[], agent: string) {
  const mine = tasks.filter((t) => t.agent === agent)
  if (mine.some((t) => t.state === 'waiting')) return 'waiting'
  if (mine.some((t) => t.state === 'running')) return null
  return 'idle'
}

/** Agents in the loaded flow, plus any agent that still has work on the timeline. */
function lanesFor(agents: Agent[], tasks: Task[]) {
  const extra = [...new Set(tasks.map((t) => t.agent))].filter((id) => !agents.some((a) => a.id === id))
  return [...agents.map((a) => a.id), ...extra]
}

export function Timeline({ onFlag }: { onFlag: (taskId: string) => void }) {
  const now = useFlow((s) => s.simT)
  const tasks = useFlow((s) => s.tasks)
  const agents = useFlow((s) => s.agents)
  const runId = useFlow((s) => s.runId)
  const mode = useFlow((s) => s.mode)

  const window = WINDOW_MINUTES[mode]
  /** Percent across the track for a moment in time. */
  const xOf = (t: number) => ((t - (now - window)) / window) * 100
  const tickX = (minutesAgo: number) => ((window - minutesAgo) / window) * 100

  const visible = tasks.filter((t) => t.start != null && xOf(t.end ?? now) > 0)
  const lanes = lanesFor(agents, visible)
  const laneY = (agent: string) => ((lanes.indexOf(agent) + 0.5) / lanes.length) * 100
  const run = tasks.filter((t) => t.runId === runId)

  // Hand-offs: from every step in a stage to every step in the next stage that has started.
  const links = run.flatMap((to) => {
    if (!to.stage || to.start == null) return []
    return run
      .filter((from) => from.stage === to.stage! - 1 && from.end != null && from.agent !== to.agent)
      .map((from) => {
        const x1 = xOf(from.end!)
        const x2 = xOf(to.start!)
        const bend = Math.max(x2 - x1, 1)
        const y1 = laneY(from.agent)
        const y2 = laneY(to.agent)
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
        <div className="flex w-40 shrink-0 flex-col sm:w-56">
          <div className="h-10" />
          {lanes.map((id) => {
            const agent = agents.find((a) => a.id === id)
            const mine = visible.filter((t) => t.agent === id)
            const spent = totalCost(mine)
            const badge = agentBadge(tasks, id)
            return (
              <div key={id} className="flex h-16 items-center gap-3 pl-4 animate-in fade-in">
                <AgentAvatar agent={id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    {agent?.name ?? id}
                    {badge === 'idle' && <Badge variant="secondary">Idle</Badge>}
                    {badge === 'waiting' && (
                      <Badge className="bg-waiting-subtle text-waiting animate-in fade-in">Needs you</Badge>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground tabular-nums">
                    {agent ? modelInfo(agent.model, agent.provider).label : 'Earlier work'}
                    {mine.length > 0 && ` · ${formatCost(spent.cost, spent.estimated)}`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="relative h-10 font-mono text-xs text-muted-foreground">
            {TIMELINE_TICKS[mode].map((m) => (
              <span key={m} className="absolute top-3 -translate-x-1/2" style={{ left: `${tickX(m)}%` }}>
                −{m}m
              </span>
            ))}
            <Badge className="absolute top-2 right-0 bg-running-subtle font-mono text-running">now</Badge>
          </div>

          <div className="relative">
            {TIMELINE_TICKS[mode].map((m) => (
              <div key={m} className="absolute inset-y-0 w-px bg-lane" style={{ left: `${tickX(m)}%` }} />
            ))}
            {lanes.map((id) => (
              <div key={id} className="relative h-16 border-t border-lane">
                {visible
                  .filter((t) => t.agent === id)
                  .map((t) => {
                    const left = xOf(t.start!)
                    return (
                      <TaskBar
                        key={t.id}
                        task={t}
                        now={now}
                        left={left}
                        width={Math.max(xOf(t.end ?? now) - left, 1)}
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
