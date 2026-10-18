export type AgentId = 'researcher' | 'writer' | 'reviewer' | 'ops'
export type ToolId =
  | 'google'
  | 'notion'
  | 'figma'
  | 'slack'
  | 'github'
  | 'stripe'
  | 'gmail'
  | 'linear'
  | 'hubspot'
export type Vendor = 'anthropic' | 'openai' | 'google'

/** What a step does before it takes its final action. */
export type Approval = 'never' | 'always' | 'earned'

/** A step either starts a new stage, or runs alongside the step before it. */
export type StepMode = 'after' | 'with'

export interface Agent {
  id: AgentId
  name: string
  model: string
  vendor: Vendor
  tools: ToolId[]
}

export interface Step {
  id: string
  agent: AgentId
  task: string
  prompt: string
  promptEdited: boolean
  tools: ToolId[]
  /** How long the demo pretends this step takes, in simulated minutes. */
  minutes: number
  mode: StepMode
  approval: Approval
  /** Approvals in a row, used by "ask until it's earned it". */
  streak: number
  /** What the tray says the agent wants to do, e.g. "wants to publish the page". */
  gateText?: string
  /** What the agent reports while it works, revealed as it progresses. */
  log?: string[]
}

export type TaskState =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'done'
  | 'denied'
  | 'failed'
  | 'stopped'
  | 'skipped'

/** One step (or one background job) actually running on the timeline. */
export interface Task {
  id: string
  runId?: string
  stepId?: string
  /** Stage index inside its run; steps in the same stage run side by side. */
  stage?: number
  agent: AgentId
  label: string
  tools: ToolId[]
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
  waitingSince?: number
}

export type RunCell = 'asked' | 'acted'

export interface RunRecord {
  id: string
  cells: RunCell[]
}

export type View = 'setup' | 'live'
