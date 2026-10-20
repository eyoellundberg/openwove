import { findAgent } from './catalog'
import {
  ASK_DECAY,
  ASK_FLOOR,
  EARN_AFTER,
  GATE_AT,
  HANDOFF_MINUTES,
  SIM_INPUT_TOKENS_PER_MINUTE,
  SIM_OUTPUT_TOKENS_PER_MINUTE,
} from './constants'
import { costOf, modelInfo } from './models'
import type { Agent, RunCell, RunRecord, Step, Task, TaskState } from './types'

export interface Sim {
  simT: number
  tasks: Task[]
  steps: Step[]
  agents: Agent[]
  runs: RunRecord[]
  runId: string | null
  runRecorded: boolean
}

const FINISHED: TaskState[] = ['done', 'denied', 'failed', 'stopped', 'skipped']
const BROKEN: TaskState[] = ['denied', 'failed', 'stopped', 'skipped']
export const isFinished = (t: Task) => FINISHED.includes(t.state)

/** How often an "earned" step still asks, after `streak` approvals in a row. */
export const askChance = (streak: number) =>
  streak < EARN_AFTER ? 1 : Math.max(ASK_FLOOR, ASK_DECAY ** (streak - EARN_AFTER + 1))

/* ---------- cost ---------- */

export const taskCost = (t: Task) => costOf(t.model, t.inputTokens, t.outputTokens)
/** A cost is an estimate when the tokens were simulated or the model's price is an example. */
export const taskEstimated = (t: Task) => !t.live || !modelInfo(t.model).listPrice

export function totalCost(tasks: Task[]) {
  return {
    cost: tasks.reduce((sum, t) => sum + taskCost(t), 0),
    estimated: tasks.some(taskEstimated),
  }
}

/* ---------- stages: steps that run side by side ---------- */

export function toStages(steps: Step[]): Step[][] {
  const stages: Step[][] = []
  steps.forEach((s, i) => {
    if (i === 0 || s.mode === 'after') stages.push([s])
    else stages[stages.length - 1].push(s)
  })
  return stages
}

export const fromStages = (stages: Step[][]): Step[] =>
  stages
    .filter((stage) => stage.length)
    .flatMap((stage) =>
      stage.map((s, row): Step => ({ ...s, mode: row === 0 ? 'after' : 'with' })),
    )

export type Drop = { kind: 'join'; stage: number; row: number } | { kind: 'insert'; at: number }

/** Move a step into another stage, or into a new stage of its own. Indices refer to the stages before the move. */
export function moveStep(steps: Step[], id: string, drop: Drop): Step[] {
  const stages = toStages(steps).map((stage) => [...stage])
  const step = steps.find((s) => s.id === id)
  if (!step) return steps
  const fromStage = stages.findIndex((stage) => stage.some((s) => s.id === id))
  const wasAlone = stages[fromStage].length === 1
  stages[fromStage] = stages[fromStage].filter((s) => s.id !== id)

  if (drop.kind === 'join') {
    stages[drop.stage].splice(Math.min(drop.row, stages[drop.stage].length), 0, step)
  } else {
    // Dropping a lone step right next to where it was changes nothing.
    if (wasAlone && (drop.at === fromStage || drop.at === fromStage + 1)) return steps
    stages.splice(drop.at, 0, [step])
  }
  return fromStages(stages)
}

/** The made-up history and sample run shown on first open are simulated; drop them once real work is on the page. */
export const withoutDemoHistory = (sim: Sim): Sim => ({ ...sim, tasks: sim.tasks.filter((t) => t.live) })

/* ---------- running ---------- */

let runCounter = 0
export const newRunId = () => `run-${Date.now().toString(36)}-${++runCounter}`

/** Stop whatever the current run is doing and queue a fresh run of the flow. */
export function startRun(sim: Sim, options: { live?: boolean; runId?: string } = {}): Sim {
  const tasks = sim.tasks.map((t): Task =>
    t.runId === sim.runId && (t.state === 'running' || t.state === 'waiting' || t.state === 'pending')
      ? { ...t, state: t.start == null ? 'skipped' : 'stopped', end: t.start == null ? null : sim.simT }
      : t,
  )
  const runId = options.runId ?? newRunId()
  const fresh = toStages(sim.steps).flatMap((stage, stageIndex) =>
    stage.map(
      (s): Task => ({
        id: `${runId}-${s.id}`,
        runId,
        stepId: s.id,
        stage: stageIndex,
        agent: s.agent,
        model: findAgent(sim.agents, s.agent).model,
        label: s.task || 'Untitled step',
        tools: s.tools,
        minutes: s.minutes,
        worked: 0,
        start: null,
        end: null,
        state: 'pending',
        approval: s.approval,
        gatePassed: false,
        asked: false,
        actedAlone: false,
        gateText: s.gateText ?? `wants to finish “${s.task || 'this step'}”`,
        log: options.live
          ? []
          : (s.log ?? ['Read the brief', `Working on ${(s.task || 'the step').toLowerCase()}`, 'Checked the result']),
        inputTokens: 0,
        outputTokens: 0,
        live: options.live,
      }),
    ),
  )
  return { ...sim, tasks: [...tasks, ...fresh], runId, runRecorded: false }
}

function recordRunIfFinished(sim: Sim): Sim {
  const run = sim.tasks.filter((t) => t.runId === sim.runId)
  if (sim.runRecorded || !run.length || !run.every(isFinished)) return sim
  const cells = run.filter((t) => t.gatePassed).map((t): RunCell => (t.asked ? 'asked' : 'acted'))
  const { cost, estimated } = totalCost(run)
  return { ...sim, runs: [...sim.runs, { id: sim.runId!, cells, cost, estimated }], runRecorded: true }
}

/** Advance the clock by `dt` minutes. Simulated tasks also make progress; live ones wait for the runner. */
export function tick(sim: Sim, dt: number, windowMinutes: number, random: () => number = Math.random): Sim {
  const simT = sim.simT + dt
  const forgetBefore = simT - windowMinutes * 2
  const tasks = sim.tasks
    .filter((t) => t.runId === sim.runId || t.end == null || t.end > forgetBefore)
    .map((t) => ({ ...t }))
  const run = tasks.filter((t) => t.runId === sim.runId && !t.live)

  // Start whichever simulated stage is ready.
  const stageCount = Math.max(0, ...run.map((t) => (t.stage ?? 0) + 1))
  for (let g = 0; g < stageCount; g++) {
    const members = run.filter((t) => t.stage === g && t.state === 'pending')
    if (!members.length) continue
    const prev = run.filter((t) => t.stage === g - 1)
    if (prev.some((t) => BROKEN.includes(t.state))) {
      members.forEach((t) => (t.state = 'skipped'))
    } else if (g === 0 || (prev.every((t) => t.state === 'done') && simT >= Math.max(...prev.map((t) => t.end ?? 0)) + HANDOFF_MINUTES)) {
      members.forEach((t) => {
        t.state = 'running'
        t.start = simT
      })
    }
  }

  // Move simulated work forward, pausing at the approval point.
  for (const t of tasks) {
    if (t.state !== 'running') continue
    if (t.live) {
      t.worked += dt
      continue
    }
    t.worked += dt
    t.inputTokens += dt * SIM_INPUT_TOKENS_PER_MINUTE
    t.outputTokens += dt * SIM_OUTPUT_TOKENS_PER_MINUTE
    if (t.approval !== 'never' && !t.gatePassed && t.worked >= t.minutes * GATE_AT) {
      const streak = sim.steps.find((s) => s.id === t.stepId)?.streak ?? 0
      const ask = t.approval === 'always' || random() < askChance(streak)
      t.gatePassed = true
      if (ask) {
        t.state = 'waiting'
        t.asked = true
        t.waitingSince = simT
      } else {
        t.actedAlone = true
      }
    } else if (t.worked >= t.minutes) {
      t.state = 'done'
      t.end = simT
    }
  }

  return recordRunIfFinished({ ...sim, simT, tasks })
}

/* ---------- events from the real runner ---------- */

export type RunnerEvent =
  | { type: 'step_started'; stepId: string }
  | { type: 'step_log'; stepId: string; text: string }
  | { type: 'step_usage'; stepId: string; inputTokens: number; outputTokens: number }
  | { type: 'step_waiting'; stepId: string; gateText: string }
  | { type: 'step_acted_alone'; stepId: string }
  | { type: 'step_resumed'; stepId: string }
  | { type: 'step_done'; stepId: string }
  | { type: 'step_denied'; stepId: string }
  | { type: 'step_failed'; stepId: string; error: string }
  | { type: 'step_skipped'; stepId: string }
  | { type: 'run_done' }

export function applyRunnerEvent(sim: Sim, runId: string, e: RunnerEvent): Sim {
  if (runId !== sim.runId || e.type === 'run_done') return sim
  const id = `${runId}-${e.stepId}`
  const tasks = sim.tasks.map((t): Task => {
    if (t.id !== id) return t
    switch (e.type) {
      case 'step_started':
        return { ...t, state: 'running', start: sim.simT }
      case 'step_log':
        return { ...t, log: [...t.log, e.text] }
      case 'step_usage':
        return { ...t, inputTokens: t.inputTokens + e.inputTokens, outputTokens: t.outputTokens + e.outputTokens }
      case 'step_waiting':
        return { ...t, state: 'waiting', asked: true, gatePassed: true, gateText: e.gateText, waitingSince: sim.simT }
      case 'step_acted_alone':
        return { ...t, actedAlone: true, gatePassed: true }
      case 'step_resumed':
        return { ...t, state: 'running' }
      case 'step_done':
        return { ...t, state: 'done', end: sim.simT }
      case 'step_denied':
        return { ...t, state: 'denied', end: sim.simT }
      case 'step_failed':
        return { ...t, state: 'failed', end: t.start == null ? null : sim.simT, log: [...t.log, e.error] }
      case 'step_skipped':
        return { ...t, state: 'skipped' }
    }
  })
  return recordRunIfFinished({ ...sim, tasks })
}

/* ---------- approvals ---------- */

/** Record a decision: approvals build the step's streak, a "no" resets it. */
export function decide(sim: Sim, taskId: string, approve: boolean): Sim {
  const task = sim.tasks.find((t) => t.id === taskId)
  if (!task || task.state !== 'waiting') return sim
  // A live task stays waiting until the runner confirms; the streak still updates now.
  const tasks = task.live
    ? sim.tasks
    : sim.tasks.map((t): Task =>
        t.id !== taskId ? t : approve ? { ...t, state: 'running' } : { ...t, state: 'denied', end: sim.simT },
      )
  const steps = sim.steps.map((s) =>
    s.id === task.stepId ? { ...s, streak: approve ? s.streak + 1 : 0 } : s,
  )
  return recordRunIfFinished({ ...sim, tasks, steps })
}

/** Pretend the flow ran `count` more times and you approved whatever it asked. */
export function fastForward(sim: Sim, count: number, random: () => number = Math.random): Sim {
  let steps = sim.steps
  const runs = [...sim.runs]
  const perRun = steps.reduce(
    (sum, s) => sum + costOf(findAgent(sim.agents, s.agent).model, s.minutes * SIM_INPUT_TOKENS_PER_MINUTE, s.minutes * SIM_OUTPUT_TOKENS_PER_MINUTE),
    0,
  )
  for (let n = 0; n < count; n++) {
    const cells: RunCell[] = []
    steps = steps.map((s) => {
      if (s.approval === 'never') return s
      const ask = s.approval === 'always' || random() < askChance(s.streak)
      cells.push(ask ? 'asked' : 'acted')
      return ask ? { ...s, streak: s.streak + 1 } : s
    })
    runs.push({ id: newRunId(), cells, cost: perRun, estimated: true })
  }
  return { ...sim, steps, runs }
}

