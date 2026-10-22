/** What a saved run adds up to, for the Usage page. Pure, so the runner and the app read runs the same way. */
import { modelInfo } from './models'
import { buildReport, type RunStatus, type StoredRun } from './run-report'

export type { RunStatus, StoredRun } from './run-report'

export interface StepUsage {
  stepId: string
  task: string
  agent: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  /** Built on an example price, not the provider's list price. */
  estimated: boolean
}

export interface RunSummary {
  id: string
  flowName: string
  startedAt: number
  endedAt: number | null
  status: RunStatus
  cost: number
  estimated: boolean
  steps: StepUsage[]
}

/** The Usage page's view of a run: the report's numbers, without the per-step detail. */
export function summarize(run: StoredRun): RunSummary {
  const report = buildReport(run)
  return {
    id: run.id,
    flowName: run.flow.name,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    // A step waiting for the person is still a run that's going.
    status: report.status === 'waiting' ? 'running' : report.status,
    cost: report.cost.usd,
    estimated: report.cost.estimated,
    steps: report.steps.map((s) => ({
      stepId: s.id,
      task: s.task,
      agent: s.agent,
      model: s.model,
      inputTokens: s.usage.inputTokens,
      outputTokens: s.usage.outputTokens,
      cost: s.usage.usd,
      estimated: s.usage.estimated,
    })),
  }
}

export interface UsageRow {
  name: string
  runs: number
  inputTokens: number
  outputTokens: number
  cost: number
  estimated: boolean
}

/** Totals grouped by model or by flow, biggest spend first. */
export function groupUsage(runs: RunSummary[], by: 'model' | 'flow'): UsageRow[] {
  const rows = new Map<string, UsageRow & { runIds: Set<string> }>()
  for (const run of runs) {
    for (const step of run.steps) {
      if (step.inputTokens + step.outputTokens === 0) continue
      const key = by === 'model' ? modelInfo(step.model).label : run.flowName
      const row = rows.get(key) ?? { name: key, runs: 0, inputTokens: 0, outputTokens: 0, cost: 0, estimated: false, runIds: new Set() }
      row.runIds.add(run.id)
      row.inputTokens += step.inputTokens
      row.outputTokens += step.outputTokens
      row.cost += step.cost
      row.estimated ||= step.estimated
      rows.set(key, row)
    }
  }
  return [...rows.values()]
    .map(({ runIds, ...row }) => ({ ...row, runs: runIds.size }))
    .sort((a, b) => b.cost - a.cost)
}
