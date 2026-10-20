import { AgentAvatar } from '@/components/shared/agent-avatar'
import { Button } from '@/components/ui/button'
import { findAgent } from '@/lib/catalog'
import { EARN_AFTER } from '@/lib/constants'
import { formatMinutes } from '@/lib/status'
import { useFlow } from '@/lib/store'
import { cn } from '@/lib/utils'

export function WaitingTray({ flashId }: { flashId: string | null }) {
  // Whole minutes: the tray shows nothing finer, so it needn't re-render every frame.
  const now = useFlow((s) => Math.floor(s.simT))
  const tasks = useFlow((s) => s.tasks)
  const steps = useFlow((s) => s.steps)
  const decide = useFlow((s) => s.decide)
  const resolveProblem = useFlow((s) => s.resolveProblem)
  const claude = useFlow((s) => s.claudeStatus)
  const agents = useFlow((s) => s.agents)
  const waiting = tasks.filter((t) => t.state === 'waiting')

  return (
    <section aria-live="polite" className="flex flex-col gap-2 border-t px-4 py-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Waiting for you</h3>
      {!waiting.length && (
        <p className="text-sm text-muted-foreground animate-in fade-in">
          Nothing right now. Agents keep working until a step needs your OK.
        </p>
      )}
      {waiting.map((t) => {
        const step = steps.find((s) => s.id === t.stepId)
        const toEarn = step?.approval === 'earned' ? EARN_AFTER - step.streak : 0
        if (t.problem != null) {
          return (
            <div
              key={t.id}
              id={`ask-${t.id}`}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg bg-failed-subtle px-3 py-2 animate-in fade-in slide-in-from-bottom-1',
                flashId === t.id && 'ring-2 ring-failed',
              )}
            >
              <AgentAvatar agent={t.agent} size="sm" />
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-semibold">{findAgent(agents, t.agent).name}</span> got stuck on {t.label}
                </p>
                <p className="text-sm">{t.problem}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Try {t.attempt ?? 1} · waiting {formatMinutes(now - (t.waitingSince ?? now))}
                  {claude && claude.level !== 'ok' && claude.level !== 'unknown' && (
                    <span className="text-failed"> · Claude is {claude.text.toLowerCase()} right now{claude.incident ? `: ${claude.incident}` : ''}</span>
                  )}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => resolveProblem(t.id, 'stop')}>
                Stop the run
              </Button>
              <Button size="sm" variant="outline" onClick={() => resolveProblem(t.id, 'skip')}>
                Skip this step
              </Button>
              <Button size="sm" onClick={() => resolveProblem(t.id, 'retry')} data-retry={t.id}>
                Try again
              </Button>
            </div>
          )
        }
        return (
          <div
            key={t.id}
            id={`ask-${t.id}`}
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-lg bg-waiting-subtle px-3 py-2 animate-in fade-in slide-in-from-bottom-1',
              flashId === t.id && 'ring-2 ring-waiting',
            )}
          >
            <AgentAvatar agent={t.agent} size="sm" />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-semibold">{findAgent(agents, t.agent).name}</span> {t.gateText}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t.label} · waiting {formatMinutes(now - (t.waitingSince ?? now))}
                {toEarn > 0 && ` · approve ${toEarn} more in a row and it starts asking less`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => decide(t.id, false)}>
              Deny
            </Button>
            <Button size="sm" onClick={() => decide(t.id, true)} data-approve={t.id}>
              Approve
            </Button>
          </div>
        )
      })}
    </section>
  )
}
