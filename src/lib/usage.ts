/** What a saved run adds up to. Pure, so the runner and the app read runs the same way. */
import { findAgent } from './catalog'
import type { RunnerEvent } from './engine'
import type { FlowFile } from './flow-file'
import { costOf, modelInfo } from './models'

/** A run as saved on this computer: the flow it ran and everything that happened. */
export interface StoredRun {
  id: string
  startedAt: number
  /** Null while the run is still going. */
  endedAt: number | null
  /** The runner stopped before the run finished (it was restarted or closed). */
  interrupted?: boolean
  flow: FlowFile
  events: RunnerEvent[]
}

export type RunStatus = 'running' | 'done' | 'failed' | 'stopped' | 'interrupted'

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

function statusOf(run: StoredRun): RunStatus {
  if (run.interrupted) return 'interrupted'
  if (run.endedAt == null) return 'running'
  if (run.events.some((e) => e.type === 'step_failed')) return 'failed'
  if (run.events.some((e) => e.type === 'step_denied' || e.type === 'step_stopped')) return 'stopped'
  return 'done'
}

export function summarize(run: StoredRun): RunSummary {
  const tokens = new Map<string, { inputTokens: number; outputTokens: number }>()
  for (const e of run.events) {
    if (e.type !== 'step_usage') continue
    const t = tokens.get(e.stepId) ?? { inputTokens: 0, outputTokens: 0 }
    t.inputTokens += e.inputTokens
    t.outputTokens += e.outputTokens
    tokens.set(e.stepId, t)
  }
  const steps = run.flow.steps.map((step): StepUsage => {
    const agent = findAgent(run.flow.agents, step.agent)
    const model = agent.model
    const { inputTokens, outputTokens } = tokens.get(step.id) ?? { inputTokens: 0, outputTokens: 0 }
    return {
      stepId: step.id,
      task: step.task,
      agent: agent.name,
      model,
      inputTokens,
      outputTokens,
      cost: costOf(model, inputTokens, outputTokens),
      estimated: !modelInfo(model).listPrice,
    }
  })
  return {
    id: run.id,
    flowName: run.flow.name,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    status: statusOf(run),
    cost: steps.reduce((sum, s) => sum + s.cost, 0),
    estimated: steps.some((s) => s.estimated && s.inputTokens + s.outputTokens > 0),
    steps,
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
