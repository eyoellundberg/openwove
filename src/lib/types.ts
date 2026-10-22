import type { APPROVALS, FlowAgent, PROVIDERS } from './flow-file'

export type Provider = (typeof PROVIDERS)[number]

/** What a step does before it takes its final action. */
export type Approval = (typeof APPROVALS)[number]

/** A step either starts a new stage, or runs alongside the step before it. */
export type StepMode = 'after' | 'with'

/** Simulated runs play back made-up work; real runs call models through the local runner. */
export type RunMode = 'simulated' | 'real'

export type Agent = FlowAgent

export interface Step {
  id: string
  agent: string
  task: string
  prompt: string
  promptEdited: boolean
  tools: string[]
  /** How long a simulated run pretends this step takes, in minutes. */
  minutes: number
  mode: StepMode
  approval: Approval
  /** Approvals in a row, used by "ask until it's earned it". */
  streak: number
  /** What the tray says the agent wants to do, e.g. "wants to publish the page". */
  gateText?: string
  /** What the agent reports while it works, revealed as it progresses (simulated runs). */
  log?: string[]
}

/** Every state a step can be in, on the timeline and in a run report. */
export const TASK_STATES = ['pending', 'running', 'waiting', 'done', 'denied', 'failed', 'stopped', 'skipped'] as const
export type TaskState = (typeof TASK_STATES)[number]

/** One step (or one background job) actually running on the timeline. */
export interface Task {
  id: string
  runId?: string
  stepId?: string
  /** Stage index inside its run; steps in the same stage run side by side. */
  stage?: number
  agent: string
  model: string
  label: string
  tools: string[]
  minutes: number
  worked: number
  start: number | null
  end: number | null
  state: TaskState
  approval: Approval
  gatePassed: boolean
  asked: boolean
  actedAlone: boolean
  gateText: string
  log: string[]
  inputTokens: number
  outputTokens: number
  /** Driven by the real runner instead of the simulation. */
  live?: boolean
  waitingSince?: number
  /** What went wrong, while the step waits for you to retry, skip or stop. Kept if you skip it. */
  problem?: string
  /** Which try the problem came from. */
  attempt?: number
}

export type RunCell = 'asked' | 'acted'

export interface RunRecord {
  id: string
  cells: RunCell[]
  cost: number
  /** Some of the cost uses example prices or simulated token counts. */
  estimated: boolean
}

export type View = 'setup' | 'live' | 'usage'
