import { HugeiconsIcon } from '@hugeicons/react'
import { ChartColumnIcon } from '@hugeicons/core-free-icons'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shell/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCost } from '@/lib/models'
import { useFlow } from '@/lib/store'
import { groupUsage, type RunStatus, type RunSummary, type UsageRow } from '@/lib/usage'
import { cn } from '@/lib/utils'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const tokens = new Intl.NumberFormat(undefined, { notation: 'compact' })

const STATUS: Record<RunStatus, { label: string; className: string }> = {
  running: { label: 'Running', className: 'text-running' },
  done: { label: 'Done', className: 'text-earned' },
  failed: { label: 'Failed', className: 'text-failed' },
  stopped: { label: 'Stopped', className: 'text-waiting' },
  interrupted: { label: 'Interrupted', className: 'text-waiting' },
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardHeader>
    </Card>
  )
}

function Breakdown({ title, rows }: { title: string; rows: UsageRow[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{r.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {tokens.format(r.inputTokens + r.outputTokens)} tokens · {r.runs} {r.runs === 1 ? 'run' : 'runs'}
              </span>
            </span>
            <span className="tabular-nums">{formatCost(r.cost, r.estimated)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function RecentRuns({ runs }: { runs: RunSummary[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Recent runs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {runs.slice(0, 20).map((r) => (
          <div key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{r.flowName}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {' · '}
                <span className={cn(STATUS[r.status].className)}>{STATUS[r.status].label}</span>
              </span>
            </span>
            <span className="tabular-nums">{formatCost(r.cost, r.estimated)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function UsagePage() {
  const usage = useFlow((s) => s.usage)
  const loadUsage = useFlow((s) => s.loadUsage)
  const runnerReady = useFlow((s) => s.runnerStatus.state === 'ready')
  const [now] = useState(() => Date.now())

  useEffect(() => {
    loadUsage()
  }, [loadUsage, runnerReady])

  const total = usage?.reduce((sum, r) => sum + r.cost, 0) ?? 0
  const lastWeek = usage?.filter((r) => now - r.startedAt < WEEK_MS).reduce((sum, r) => sum + r.cost, 0) ?? 0
  const estimated = usage?.some((r) => r.estimated) ?? false

  return (
    <>
      <PageHeader title="Usage" subtitle="What your flows cost, from runs saved on this computer." />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
        {usage?.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Total spent" value={formatCost(total, estimated)} />
              <Stat label="Last 7 days" value={formatCost(lastWeek, estimated)} />
              <Stat label="Runs" value={String(usage.length)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Breakdown title="By model" rows={groupUsage(usage, 'model')} />
              <Breakdown title="By flow" rows={groupUsage(usage, 'flow')} />
            </div>
            <RecentRuns runs={usage} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <HugeiconsIcon icon={ChartColumnIcon} className="size-8 text-muted-foreground" />
              <h2 className="font-medium">{runnerReady ? 'No real runs yet' : 'The runner isn’t running'}</h2>
              <p className="text-sm text-muted-foreground">
                {runnerReady
                  ? 'Run a flow in Real run mode and what it cost shows up here. Simulated runs are free and aren’t counted.'
                  : 'Start it with npm run runner to see what your past runs cost.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
