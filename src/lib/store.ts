import { create } from 'zustand'
import { findAgent } from './catalog'
import {
  FAST_FORWARD_RUNS,
  MAX_FRAME_SECONDS,
  REAL_MINUTES_PER_SECOND,
  SIM_MINUTES_PER_SECOND,
  WINDOW_MINUTES,
} from './constants'
import { flowToState, stateToFlow } from './convert'
import * as engine from './engine'
import { runner, type FlowListing, type RunnerHealth } from './runner-client'
import { initialHistory, makeStep, SAMPLE_FLOW } from './seed'
import type { Agent, RunMode, Step, View } from './types'

export type RunnerStatus = { state: 'checking' } | { state: 'offline' } | { state: 'ready'; health: RunnerHealth }

interface FlowStore extends engine.Sim {
  name: string
  request: string
  mode: RunMode
  runnerStatus: RunnerStatus
  flowFiles: FlowListing[]
  /** Something went wrong loading a flow or talking to the runner. */
  notice: string | null
  paused: boolean
  /** The steps changed since the current run started. */
  dirty: boolean
  view: View
  promptStepId: string | null
  setupOpen: boolean

  frame: (seconds: number) => void
  run: () => Promise<void>
  togglePause: () => void
  decide: (taskId: string, approve: boolean) => void
  fastForward: () => void
  updateStep: (id: string, patch: Partial<Step>) => void
  addStep: () => void
  removeStep: (id: string) => void
  moveStep: (id: string, drop: engine.Drop) => void
  setView: (view: View) => void
  setMode: (mode: RunMode) => void
  checkRunner: () => Promise<void>
  loadFlow: (input: unknown) => Promise<boolean>
  openFlowFile: (file: string) => Promise<void>
  exportFlow: () => string
  openPrompt: (id: string | null) => void
  savePrompt: (id: string, prompt: string) => void
  openSetup: (open: boolean) => void
  dismissNotice: () => void
}

const VIEW_KEY = 'agent-flow-view'
const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'setup' ? 'setup' : 'live'
  } catch {
    return 'live'
  }
}

const sim = (s: FlowStore): engine.Sim => ({
  simT: s.simT, tasks: s.tasks, steps: s.steps, agents: s.agents, runs: s.runs, runId: s.runId, runRecorded: s.runRecorded,
})

let stopListening: (() => void) | null = null

export const useFlow = create<FlowStore>()((set, get) => {
  const editSteps = (steps: Step[]) => set({ steps, dirty: get().runId != null })
  const sample = flowToState(SAMPLE_FLOW)

  return {
    ...engine.startRun({
      simT: 0, tasks: initialHistory(), steps: sample.steps, agents: sample.agents, runs: [], runId: null, runRecorded: true,
    }),
    name: sample.name,
    request: sample.request,
    mode: 'simulated',
    runnerStatus: { state: 'checking' },
    flowFiles: [],
    notice: null,
    paused: false,
    dirty: false,
    view: savedView(),
    promptStepId: null,
    setupOpen: false,

    frame: (seconds) => {
      const s = get()
      if (s.paused) return
      const rate = s.mode === 'real' ? REAL_MINUTES_PER_SECOND : SIM_MINUTES_PER_SECOND
      set(engine.tick(sim(s), Math.min(seconds, MAX_FRAME_SECONDS) * rate, WINDOW_MINUTES[s.mode]))
    },

    run: async () => {
      stopListening?.()
      stopListening = null
      const s = get()
      if (s.mode === 'simulated') {
        set({ ...engine.startRun(sim(s)), dirty: false, paused: false, notice: null })
        return
      }
      const previous = s.runId
      const flow = stateToFlow({ name: s.name, request: s.request, agents: s.agents, steps: s.steps })
      const streaks = Object.fromEntries(s.steps.map((step) => [step.id, step.streak]))
      try {
        const { runId } = await runner.startRun(flow, streaks)
        if (previous) runner.stop(previous).catch(() => undefined)
        set({ ...engine.startRun(sim(get()), { live: true, runId }), dirty: false, paused: false, notice: null })
        stopListening = runner.events(runId, (e) => set(engine.applyRunnerEvent(sim(get()), runId, e)))
      } catch (error) {
        set({ notice: error instanceof Error ? error.message : 'The runner could not start this flow.' })
      }
    },

    togglePause: () => set((s) => ({ paused: !s.paused })),

    decide: (taskId, approve) => {
      const s = get()
      const task = s.tasks.find((t) => t.id === taskId)
      set(engine.decide(sim(s), taskId, approve))
      if (task?.live && task.runId && task.stepId) {
        runner.decide(task.runId, task.stepId, approve).catch((error: Error) => set({ notice: error.message }))
      }
    },

    fastForward: () => set(engine.fastForward(sim(get()), FAST_FORWARD_RUNS)),

    updateStep: (id, patch) =>
      editSteps(get().steps.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    addStep: () => {
      const { agents, steps } = get()
      const used = new Set(steps.map((s) => s.agent))
      const agent = agents.find((a) => !used.has(a.id)) ?? agents[0]
      editSteps([...steps, makeStep(agent)])
    },
    removeStep: (id) => editSteps(engine.fromStages(engine.toStages(get().steps.filter((s) => s.id !== id)))),
    moveStep: (id, drop) => {
      const next = engine.moveStep(get().steps, id, drop)
      if (next !== get().steps) editSteps(next)
    },

    setView: (view) => {
      try {
        localStorage.setItem(VIEW_KEY, view)
      } catch {
        // Storage can be unavailable; the view still switches.
      }
      set({ view })
    },
    setMode: (mode) => {
      set({ mode, dirty: get().runId != null, notice: null })
      if (mode === 'real') get().checkRunner()
    },
    checkRunner: async () => {
      set({ runnerStatus: { state: 'checking' } })
      try {
        const [health, flowFiles] = await Promise.all([runner.health(), runner.listFlows()])
        set({ runnerStatus: { state: 'ready', health }, flowFiles })
      } catch {
        set({ runnerStatus: { state: 'offline' }, flowFiles: [] })
      }
    },

    loadFlow: async (input) => {
      // The validator (zod) loads only when a flow file is opened.
      const { parseFlow } = await import('./flow-file')
      const parsed = parseFlow(input)
      if (!parsed.ok) {
        set({ notice: `That flow file has a problem. ${parsed.error}` })
        return false
      }
      const loaded = flowToState(parsed.flow)
      stopListening?.()
      stopListening = null
      set({ ...loaded, dirty: get().runId != null, notice: null, promptStepId: null })
      return true
    },
    openFlowFile: async (file) => {
      try {
        await get().loadFlow(await runner.getFlow(file))
      } catch (error) {
        set({ notice: error instanceof Error ? error.message : 'Could not open that flow.' })
      }
    },
    exportFlow: () => {
      const s = get()
      return JSON.stringify(stateToFlow({ name: s.name, request: s.request, agents: s.agents, steps: s.steps }), null, 2)
    },

    openPrompt: (promptStepId) => set({ promptStepId }),
    savePrompt: (id, prompt) => get().updateStep(id, { prompt, promptEdited: true }),
    openSetup: (setupOpen) => set({ setupOpen }),
    dismissNotice: () => set({ notice: null }),
  }
})

/** The agent behind an id, from the loaded flow. */
export const useAgent = (id: string): Agent => useFlow((s) => findAgent(s.agents, id))

/** Changing a step's agent also swaps in that agent's usual tools. */
export const agentPatch = (agent: Agent): Partial<Step> => ({
  agent: agent.id,
  tools: agent.tools,
  log: undefined,
  gateText: undefined,
})
