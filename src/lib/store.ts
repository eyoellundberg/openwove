import { create } from 'zustand'
import { AGENTS, AGENT_BY_ID } from './catalog'
import { FAST_FORWARD_RUNS, MAX_FRAME_SECONDS, SIM_MINUTES_PER_SECOND } from './constants'
import * as engine from './engine'
import { initialHistory, initialSteps, makeStep } from './seed'
import type { Step, View } from './types'

interface FlowStore extends engine.Sim {
  paused: boolean
  /** The steps changed since the current run started. */
  dirty: boolean
  view: View
  promptStepId: string | null
  setupOpen: boolean

  frame: (seconds: number) => void
  run: () => void
  togglePause: () => void
  decide: (taskId: string, approve: boolean) => void
  fastForward: () => void
  updateStep: (id: string, patch: Partial<Step>) => void
  addStep: () => void
  removeStep: (id: string) => void
  moveStep: (id: string, drop: engine.Drop) => void
  setView: (view: View) => void
  openPrompt: (id: string | null) => void
  savePrompt: (id: string, prompt: string) => void
  openSetup: (open: boolean) => void
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
  simT: s.simT, tasks: s.tasks, steps: s.steps, runs: s.runs, runId: s.runId, runRecorded: s.runRecorded,
})

export const useFlow = create<FlowStore>()((set, get) => {
  const editSteps = (steps: Step[]) => set({ steps, dirty: get().runId != null })

  return {
    ...engine.startRun({
      simT: 0, tasks: initialHistory(), steps: initialSteps(), runs: [], runId: null, runRecorded: true,
    }),
    paused: false,
    dirty: false,
    view: savedView(),
    promptStepId: null,
    setupOpen: false,

    frame: (seconds) => {
      const s = get()
      if (s.paused) return
      set(engine.tick(sim(s), Math.min(seconds, MAX_FRAME_SECONDS) * SIM_MINUTES_PER_SECOND))
    },
    run: () => set({ ...engine.startRun(sim(get())), dirty: false, paused: false }),
    togglePause: () => set((s) => ({ paused: !s.paused })),
    decide: (taskId, approve) => set(engine.decide(sim(get()), taskId, approve)),
    fastForward: () => set(engine.fastForward(sim(get()), FAST_FORWARD_RUNS)),

    updateStep: (id, patch) =>
      editSteps(get().steps.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    addStep: () => {
      const used = new Set(get().steps.map((s) => s.agent))
      const agent = (AGENTS.find((a) => !used.has(a.id)) ?? AGENTS[0]).id
      editSteps([...get().steps, makeStep(agent)])
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
    openPrompt: (promptStepId) => set({ promptStepId }),
    savePrompt: (id, prompt) => get().updateStep(id, { prompt, promptEdited: true }),
    openSetup: (setupOpen) => set({ setupOpen }),
  }
})

/** Changing a step's agent also swaps in that agent's usual tools. */
export const agentPatch = (agent: Step['agent']): Partial<Step> => ({
  agent,
  tools: AGENT_BY_ID[agent].tools,
  log: undefined,
  gateText: undefined,
})
