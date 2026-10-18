import { AgentAvatar } from '@/components/shared/agent-avatar'
import { Button } from '@/components/ui/button'
import { AGENT_BY_ID } from '@/lib/catalog'
import { EARN_AFTER } from '@/lib/constants'
import { formatMinutes } from '@/lib/status'
import { useFlow } from '@/lib/store'
import { cn } from '@/lib/utils'

export function WaitingTray({ flashId }: { flashId: string | null }) {
  const now = useFlow((s) => s.simT)
  const tasks = useFlow((s) => s.tasks)
  const steps = useFlow((s) => s.steps)
  const decide = useFlow((s) => s.decide)
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
                <span className="font-semibold">{AGENT_BY_ID[t.agent].name}</span> {t.gateText}
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
