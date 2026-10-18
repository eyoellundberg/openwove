import {
  ASK_DECAY,
  ASK_FLOOR,
  EARN_AFTER,
  GATE_AT,
  HANDOFF_MINUTES,
  WINDOW_MINUTES,
} from './constants'
import type { RunCell, RunRecord, Step, Task, TaskState } from './types'

export interface Sim {
  simT: number
  tasks: Task[]
  steps: Step[]
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

/* ---------- running ---------- */

let runCounter = 0

export function startRun(sim: Sim): Sim {
  const tasks = sim.tasks.map((t): Task =>
    t.runId === sim.runId && (t.state === 'running' || t.state === 'waiting' || t.state === 'pending')
      ? { ...t, state: t.start == null ? 'skipped' : 'stopped', end: t.start == null ? null : sim.simT }
      : t,
  )
  const runId = `run-${++runCounter}`
  const stages = toStages(sim.steps)
  const fresh = stages.flatMap((stage, stageIndex) =>
    stage.map(
      (s): Task => ({
        id: `${runId}-${s.id}`,
        runId,
        stepId: s.id,
        stage: stageIndex,
        agent: s.agent,
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
        log: s.log ?? ['Read the brief', `Working on ${(s.task || 'the step').toLowerCase()}`, 'Checked the result'],
      }),
    ),
  )
  return { ...sim, tasks: [...tasks, ...fresh], runId, runRecorded: false }
}

export function tick(sim: Sim, dt: number, random: () => number = Math.random): Sim {
  const simT = sim.simT + dt
  const forgetBefore = simT - WINDOW_MINUTES * 2
  const tasks = sim.tasks
    .filter((t) => t.runId === sim.runId || t.end == null || t.end > forgetBefore)
    .map((t) => ({ ...t }))
  const run = tasks.filter((t) => t.runId === sim.runId)

  // Start whichever stage is ready.
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

  // Move running work forward, pausing at the approval point.
  for (const t of tasks) {
    if (t.state !== 'running') continue
    t.worked += dt
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

  let { runs, runRecorded } = sim
  if (!runRecorded && run.length && run.every(isFinished)) {
    const cells = run.filter((t) => t.gatePassed).map((t): RunCell => (t.asked ? 'asked' : 'acted'))
    runs = [...runs, { id: sim.runId ?? `run-${runs.length}`, cells }]
    runRecorded = true
  }

  return { ...sim, simT, tasks, runs, runRecorded }
}

export function decide(sim: Sim, taskId: string, approve: boolean): Sim {
  const task = sim.tasks.find((t) => t.id === taskId)
  if (!task || task.state !== 'waiting') return sim
  const tasks = sim.tasks.map((t): Task =>
    t.id !== taskId ? t : approve ? { ...t, state: 'running' } : { ...t, state: 'denied', end: sim.simT },
  )
  const steps = sim.steps.map((s) =>
    s.id === task.stepId ? { ...s, streak: approve ? s.streak + 1 : 0 } : s,
  )
  return { ...sim, tasks, steps }
}

/** Pretend the flow ran `count` more times and you approved whatever it asked. */
export function fastForward(sim: Sim, count: number, random: () => number = Math.random): Sim {
  let steps = sim.steps
  const runs = [...sim.runs]
  for (let n = 0; n < count; n++) {
    const cells: RunCell[] = []
    steps = steps.map((s) => {
      if (s.approval === 'never') return s
      const ask = s.approval === 'always' || random() < askChance(s.streak)
      cells.push(ask ? 'asked' : 'acted')
      return ask ? { ...s, streak: s.streak + 1 } : s
    })
    runs.push({ id: `ff-${++runCounter}`, cells })
  }
  return { ...sim, steps, runs }
}
