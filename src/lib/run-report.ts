/**
 * What a run came to, as plain structured data for anyone reviewing it: an agent, a script or a
 * person. Built from a saved run's events, so it can't disagree with what the app shows.
 * The descriptions are the docs; agents see them in the published JSON Schema.
 */
import { z } from 'zod'
import { findAgent } from './catalog'
import type { RunnerEvent } from './engine'
import { APPROVALS, type FlowFile, FlowFileSchema } from './flow-file'
import { costOf, modelInfo } from './models'
import { TASK_STATES } from './types'

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

/** How a run ended, or that it hasn't. */
export const RUN_STATUSES = ['running', 'done', 'failed', 'stopped', 'interrupted'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]
/** A run's status, plus "waiting" for one blocked on the person. */
export const REPORT_STATUSES = [...RUN_STATUSES, 'waiting'] as const

const usage = z.strictObject({
  inputTokens: z.int().min(0).describe('Tokens sent to the model, cached ones included.'),
  outputTokens: z.int().min(0).describe('Tokens the model wrote.'),
  usd: z.number().min(0).describe('What this cost in US dollars.'),
  estimated: z.boolean().describe('True when the price is an example, not the provider’s list price.'),
})

export const StepReportSchema = z.strictObject({
  id: z.string().describe('The step’s id in the flow file.'),
  task: z.string().describe('The step’s short name.'),
  agent: z.string().describe('The agent’s name.'),
  model: z.string().describe('The model id the agent used.'),
  stage: z.int().min(0).describe('Steps in the same stage ran at the same time.'),
  status: z.enum(TASK_STATES).describe('"denied" means the person said no when it asked. "skipped" means the person chose to skip it after a problem, or it never started because an earlier step stopped the run.'),
  attempts: z.int().min(1).describe('How many times it was tried: 1 unless it ran into a problem and the person chose to retry.'),
  approval: z.strictObject({
    mode: z.enum(APPROVALS).describe('What the flow asked for.'),
    outcome: z
      .enum(['not-needed', 'approved', 'denied', 'acted-alone', 'waiting'])
      .describe('"acted-alone": it earned the right to skip asking. "not-needed": it never reached an acting step. "waiting": the person hasn’t answered yet.'),
    asked: z.string().nullable().describe('What it asked, e.g. "wants to publish the page", or null if it didn’t ask.'),
  }),
  summary: z.string().nullable().describe('What the agent said it did, in its own words. Null until it finishes. Read this first.'),
  actions: z
    .array(
      z.strictObject({
        tool: z.string().describe('The tool call, e.g. "write_file".'),
        path: z.string().optional().describe('The file it touched, inside the workspace folder.'),
        ok: z.boolean().describe('False if the tool reported an error.'),
      }),
    )
    .describe('Every tool call it made, in order.'),
  error: z.string().nullable().describe('Why it failed or had a problem, or null.'),
  usage,
})

export const RunReportSchema = z.strictObject({
  version: z.literal(1).describe('The report format version. Always 1.'),
  runId: z.string().describe('The id list_runs and the runner use for this run.'),
  flow: z.strictObject({
    name: z.string().describe('The flow’s name.'),
    request: z.string().describe('What the person asked for, in their words.'),
  }),
  status: z.enum(REPORT_STATUSES).describe('"waiting": a step is waiting for the person. "interrupted": OpenWove closed before it finished.'),
  startedAt: z.string().describe('ISO 8601 time.'),
  endedAt: z.string().nullable().describe('ISO 8601 time, or null while it is still going.'),
  durationMs: z.int().min(0).nullable().describe('How long it took, or null while it is still going.'),
  cost: usage.describe('Every step’s usage added up.'),
  waitingForPerson: z
    .array(z.strictObject({ stepId: z.string(), kind: z.enum(['approval', 'problem']), text: z.string() }))
    .describe('What is blocked on the person right now. Empty once the run has ended.'),
  steps: z.array(StepReportSchema).describe('Every step in the flow, in stage order.'),
})

export type StepReport = z.infer<typeof StepReportSchema>
export type RunReport = z.infer<typeof RunReportSchema>
export type ReportStatus = RunReport['status']

type Gate = { kind: 'approval' | 'problem'; text: string }

function stepFromEvents(events: RunnerEvent[], id: string) {
  let status: StepReport['status'] = 'pending'
  let attempts = 1
  let outcome: StepReport['approval']['outcome'] = 'not-needed'
  let asked: string | null = null
  let summary: string | null = null
  let error: string | null = null
  let gate: Gate | null = null
  const actions: StepReport['actions'] = []
  let inputTokens = 0
  let outputTokens = 0

  for (const e of events) {
    if (!('stepId' in e) || e.stepId !== id) continue
    switch (e.type) {
      case 'step_started': status = 'running'; break
      case 'step_usage': inputTokens += e.inputTokens; outputTokens += e.outputTokens; break
      case 'step_output': summary = e.text; break
      case 'step_action': actions.push({ tool: e.tool, ...(e.path ? { path: e.path } : {}), ok: e.ok }); break
      case 'step_waiting':
        status = 'waiting'; outcome = 'waiting'; asked = e.gateText; gate = { kind: 'approval', text: e.gateText }
        break
      case 'step_acted_alone': outcome = 'acted-alone'; break
      case 'step_problem':
        status = 'waiting'; attempts = e.attempt + 1; error = e.error; gate = { kind: 'problem', text: e.error }
        break
      case 'step_resumed':
        status = 'running'; gate = null
        if (outcome === 'waiting') outcome = 'approved'
        break
      case 'step_done': status = 'done'; break
      case 'step_denied': status = 'denied'; outcome = 'denied'; gate = null; break
      case 'step_failed': status = 'failed'; error = e.error; gate = null; break
      case 'step_skipped': status = 'skipped'; gate = null; break
      case 'step_stopped': status = 'stopped'; gate = null; break
      case 'step_log': break
    }
  }
  return { status, attempts, outcome, asked, summary, error, gate, actions, inputTokens, outputTokens }
}

const iso = (ms: number) => new Date(ms).toISOString()

export function buildReport(stored: StoredRun): RunReport {
  // Saved flows may predate a default (like approval), so fill them in the way the runner did.
  const run = { ...stored, flow: FlowFileSchema.parse(stored.flow) }
  const gates: RunReport['waitingForPerson'] = []
  const steps = run.flow.steps.map((step): StepReport => {
    const agent = findAgent(run.flow.agents, step.agent)
    const r = stepFromEvents(run.events, step.id)
    if (r.gate && run.endedAt == null) gates.push({ stepId: step.id, ...r.gate })
    const estimated = !modelInfo(agent.model).listPrice
    return {
      id: step.id,
      task: step.task,
      agent: agent.name,
      model: agent.model,
      stage: step.stage,
      status: r.status,
      attempts: r.attempts,
      approval: { mode: step.approval, outcome: r.outcome, asked: r.asked },
      summary: r.summary,
      actions: r.actions,
      error: r.error,
      usage: { inputTokens: r.inputTokens, outputTokens: r.outputTokens, usd: costOf(agent.model, r.inputTokens, r.outputTokens), estimated },
    }
  })

  const failed = steps.some((s) => s.status === 'failed')
  const stopped = steps.some((s) => s.status === 'denied' || s.status === 'stopped')
  const status: ReportStatus = run.interrupted
    ? 'interrupted'
    : run.endedAt == null
      ? gates.length
        ? 'waiting'
        : 'running'
      : failed
        ? 'failed'
        : stopped
          ? 'stopped'
          : 'done'

  return {
    version: 1,
    runId: run.id,
    flow: { name: run.flow.name, request: run.flow.request },
    status,
    startedAt: iso(run.startedAt),
    endedAt: run.endedAt == null ? null : iso(run.endedAt),
    durationMs: run.endedAt == null ? null : Math.max(0, run.endedAt - run.startedAt),
    cost: {
      inputTokens: steps.reduce((n, s) => n + s.usage.inputTokens, 0),
      outputTokens: steps.reduce((n, s) => n + s.usage.outputTokens, 0),
      usd: steps.reduce((n, s) => n + s.usage.usd, 0),
      estimated: steps.some((s) => s.usage.estimated && s.usage.inputTokens + s.usage.outputTokens > 0),
    },
    waitingForPerson: gates,
    steps: [...steps].sort((a, b) => a.stage - b.stage),
  }
}
