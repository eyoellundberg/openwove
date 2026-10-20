import { create } from 'zustand'
import { findAgent } from './catalog'
import {
  APP_EVENTS_RETRY_MS,
  FAST_FORWARD_RUNS,
  MAX_FRAME_SECONDS,
  SLOW_FRAME_SECONDS,
  REAL_MINUTES_PER_SECOND,
  SIM_MINUTES_PER_SECOND,
  WINDOW_MINUTES,
} from './constants'
import { flowToState, stateToFlow } from './convert'
import * as engine from './engine'
import type { RunSummary } from './usage'
import { runner, type AppEvent, type FlowListing, type ProviderStatus, type Resolution } from './runner-client'
import type { RunnerStatus } from './runner-status'
import { initialHistory, makeStep, SAMPLE_FLOW } from './seed'
import { readStored, writeStored } from './storage'
import type { Agent, RunMode, Step, View } from './types'

interface FlowStore extends engine.Sim {
  name: string
  request: string
  mode: RunMode
  /** The mode the app starts in, saved on this computer. */
  defaultMode: RunMode
  runnerStatus: RunnerStatus
  /** Whether Claude is up; null until the runner has answered once. */
  claudeStatus: ProviderStatus | null
  /** Every saved run, newest first; null until the runner has answered. */
  usage: RunSummary[] | null
  flowFiles: FlowListing[]
  /** The file in flows/ this flow came from, if any. */
  file: string | null
  /** The canvas has changes that aren't saved to the flows folder. */
  unsaved: boolean
  /** Your agent saved a flow while you were busy; it opens when you say so. */
  agentSaved: string | null
  /** Something went wrong loading a flow or talking to the runner. */
  notice: string | null
  paused: boolean
  /** The steps changed since the current run started. */
  dirty: boolean
  view: View
  promptStepId: string | null
  setupOpen: boolean
  settingsOpen: boolean

  frame: (seconds: number) => void
  run: () => Promise<void>
  /** Rejoin the real run this tab started before it was reloaded. */
  resumeRun: () => Promise<void>
  togglePause: () => void
  decide: (taskId: string, approve: boolean) => void
  /** Tell a step that ran into trouble to try again, move on without it, or stop the run. */
  resolveProblem: (taskId: string, action: Resolution) => void
  checkClaude: () => Promise<void>
  loadUsage: () => Promise<void>
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
  saveToFile: () => Promise<void>
  openAgentSaved: (open: boolean) => void
  openPrompt: (id: string | null) => void
  savePrompt: (id: string, prompt: string) => void
  openSetup: (open: boolean) => void
  openSettings: (open: boolean) => void
  /** Which mode the app starts in next time, and the one it uses now. */
  setDefaultMode: (mode: RunMode) => void
  dismissNotice: () => void
}

const MODE_KEY = 'agent-flow-default-mode'
const savedMode = (): RunMode => (readStored('local', MODE_KEY) === 'real' ? 'real' : 'simulated')

const VIEW_KEY = 'agent-flow-view'
const savedView = (): View => (readStored('local', VIEW_KEY) === 'setup' ? 'setup' : 'live')

/** The real run this tab started, so a reload can rejoin it. */
const RUN_KEY = 'agent-flow-run'
interface SavedRun {
  runId: string
  file: string | null
  flow: unknown
}
const readSavedRun = (): SavedRun | null => {
  try {
    return JSON.parse(readStored('session', RUN_KEY) ?? 'null') as SavedRun | null
  } catch {
    return null
  }
}
const writeSavedRun = (run: SavedRun | null) => writeStored('session', RUN_KEY, run && JSON.stringify(run))

const sim = (s: FlowStore): engine.Sim => ({
  simT: s.simT, tasks: s.tasks, steps: s.steps, agents: s.agents, runs: s.runs, runId: s.runId, runRecorded: s.runRecorded,
})

/** Rejoining a run is tried once per page load, even if React mounts the app twice. */
let tried = false
let stopListening: (() => void) | null = null
/** Clock time not yet handed to the engine, while frames are batched. */
let frameSeconds = 0
let stopAppEvents: (() => void) | null = null

/** A real run is still going, so swapping the flow out would cut it off. */
const liveRunGoing = (s: FlowStore) => s.tasks.some((t) => t.live && t.runId === s.runId && engine.isActive(t))

export const useFlow = create<FlowStore>()((set, get) => {
  const editSteps = (steps: Step[]) => set({ steps, dirty: get().runId != null, unsaved: true })

  const onAgentSaved = (e: AppEvent) => {
    runner.listFlows().then((flowFiles) => set({ flowFiles })).catch(() => undefined)
    if (!e.open) return
    const s = get()
    if (s.unsaved || liveRunGoing(s)) {
      set({ agentSaved: e.file })
      return
    }
    s.openFlowFile(e.file).then(() => get().setView('setup'))
  }

  // The runner restarts often (tsx watch), so reconnect quietly when it drops.
  const listenForAgent = () => {
    stopAppEvents ??= runner.appEvents(onAgentSaved, () => {
      stopAppEvents = null
      setTimeout(listenForAgent, APP_EVENTS_RETRY_MS)
    })
  }
  const sample = flowToState(SAMPLE_FLOW)

  const follow = (runId: string) =>
    runner.events(
      runId,
      (e) => set(engine.applyRunnerEvent(sim(get()), runId, e)),
      () => {
        stopListening = null
        writeSavedRun(null)
        set({
          ...engine.abandonRun(sim(get())),
          notice: 'Lost the runner mid-run, so that run is over. Files it already wrote are still in workspace/.',
        })
      },
    )

  return {
    ...engine.startRun({
      simT: 0, tasks: initialHistory(), steps: sample.steps, agents: sample.agents, runs: [], runId: null, runRecorded: true,
    }),
    name: sample.name,
    request: sample.request,
    mode: savedMode(),
    defaultMode: savedMode(),
    runnerStatus: { state: 'checking' },
    claudeStatus: null,
    usage: null,
    flowFiles: [],
    file: null,
    unsaved: false,
    agentSaved: null,
    notice: null,
    paused: false,
    dirty: false,
    view: savedView(),
    promptStepId: null,
    setupOpen: false,
    settingsOpen: false,

    frame: (seconds) => {
      const s = get()
      if (s.paused) return
      frameSeconds += Math.min(seconds, MAX_FRAME_SECONDS)
      const smooth = s.mode === 'simulated' && s.view === 'live'
      if (!smooth && frameSeconds < SLOW_FRAME_SECONDS) return
      const rate = s.mode === 'real' ? REAL_MINUTES_PER_SECOND : SIM_MINUTES_PER_SECOND
      set(engine.tick(sim(s), frameSeconds * rate, WINDOW_MINUTES[s.mode]))
      frameSeconds = 0
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
      const flow = stateToFlow(s)
      const streaks = Object.fromEntries(s.steps.map((step) => [step.id, step.streak]))
      try {
        const { runId } = await runner.startRun(flow, streaks)
        if (previous) runner.stop(previous).catch(() => undefined)
        set({
          ...engine.startRun(engine.withoutDemoHistory(sim(get())), { live: true, runId }),
          dirty: false, paused: false, notice: null,
        })
        writeSavedRun({ runId, file: s.file, flow })
        stopListening = follow(runId)
      } catch (error) {
        set({ notice: error instanceof Error ? error.message : 'The runner could not start this flow.' })
      }
    },

    resumeRun: async () => {
      const saved = readSavedRun()
      if (!saved || tried) return
      tried = true
      const { parseFlow } = await import('./flow-file')
      const parsed = parseFlow(saved.flow)
      if (!parsed.ok) return writeSavedRun(null)
      if (!(await runner.knowsRun(saved.runId))) {
        writeSavedRun(null)
        set({ notice: 'The runner restarted, so that run is gone. Files it already wrote are still in workspace/.' })
        return
      }
      const loaded = flowToState(parsed.flow)
      const base = engine.withoutDemoHistory(get())
      set({
        ...engine.startRun({ ...base, steps: loaded.steps, agents: loaded.agents }, { live: true, runId: saved.runId }),
        name: loaded.name, request: loaded.request, file: saved.file, unsaved: false, mode: 'real', view: 'live',
      })
      stopListening = follow(saved.runId)
      get().checkRunner()
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

    resolveProblem: (taskId, action) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task?.live || !task.runId || !task.stepId) return
      // The step stays waiting until the runner confirms what happened next.
      runner.resolve(task.runId, task.stepId, action).catch((error: Error) => set({ notice: error.message }))
    },

    loadUsage: async () => {
      try {
        set({ usage: await runner.runs() })
      } catch {
        set({ usage: null })
      }
    },

    checkClaude: async () => {
      try {
        set({ claudeStatus: await runner.status() })
      } catch {
        set({ claudeStatus: null })
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
      writeStored('local', VIEW_KEY, view)
      set({ view })
    },
    setMode: (mode) => {
      set({ mode, dirty: get().runId != null, notice: null })
      if (mode === 'real') get().checkRunner()
    },
    checkRunner: async () => {
      // Keep showing "ready" while re-checking, so the status doesn't flicker.
      if (get().runnerStatus.state !== 'ready') set({ runnerStatus: { state: 'checking' } })
      try {
        const [health, flowFiles] = await Promise.all([runner.health(), runner.listFlows()])
        set({ runnerStatus: { state: 'ready', health }, flowFiles })
        listenForAgent()
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
      set({
        ...loaded, tasks: engine.withoutDemoHistory(sim(get())).tasks,
        file: null, unsaved: false, dirty: get().runId != null, notice: null, promptStepId: null,
      })
      return true
    },
    openFlowFile: async (file) => {
      try {
        if (await get().loadFlow(await runner.getFlow(file))) set({ file, agentSaved: null })
      } catch (error) {
        set({ notice: error instanceof Error ? error.message : 'Could not open that flow.' })
      }
    },
    exportFlow: () => JSON.stringify(stateToFlow(get()), null, 2),

    saveToFile: async () => {
      const s = get()
      try {
        const { file } = await runner.saveFlow(s.file ?? s.name, stateToFlow(s))
        set({ file, unsaved: false, notice: null })
        set({ flowFiles: await runner.listFlows() })
      } catch (error) {
        set({ notice: error instanceof Error ? error.message : 'Could not save to the flows folder.' })
      }
    },
    openAgentSaved: (open) => {
      const file = get().agentSaved
      set({ agentSaved: null })
      if (open && file) get().openFlowFile(file)
    },

    openPrompt: (promptStepId) => set({ promptStepId }),
    savePrompt: (id, prompt) => get().updateStep(id, { prompt, promptEdited: true }),
    openSetup: (setupOpen) => set({ setupOpen }),
    openSettings: (settingsOpen) => set({ settingsOpen }),
    setDefaultMode: (mode) => {
      writeStored('local', MODE_KEY, mode)
      set({ defaultMode: mode })
      get().setMode(mode)
    },
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
