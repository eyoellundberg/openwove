import { toStages } from './engine'
import type { FlowFile } from './flow-file'
import { defaultPrompt, makeStep, SAMPLE_PLAYBACK } from './seed'
import type { Agent, Step } from './types'

export interface LoadedFlow {
  name: string
  request: string
  agents: Agent[]
  steps: Step[]
}

/** Turn a flow file into canvas state: steps ordered by stage, the first of each stage starting it. */
export function flowToState(flow: FlowFile): LoadedFlow {
  const agents: Agent[] = flow.agents.map((a) => ({ ...a }))
  const byStage = [...flow.steps].sort((a, b) => a.stage - b.stage)
  const steps = byStage.map((s, i) => {
    const agent = agents.find((a) => a.id === s.agent)!
    const playback = SAMPLE_PLAYBACK[s.id]
    return makeStep(agent, {
      id: s.id,
      task: s.task,
      prompt: s.prompt,
      tools: s.tools ?? agent.tools,
      mode: i === 0 || byStage[i - 1].stage !== s.stage ? 'after' : 'with',
      approval: s.approval,
      gateText: s.asks,
      ...playback,
    })
  })
  return { name: flow.name, request: flow.request, agents, steps }
}

/** Write the canvas back out as a flow file. Fills blanks the canvas allows but the file doesn't. */
export function stateToFlow(state: LoadedFlow): FlowFile {
  const stageOf = new Map(toStages(state.steps).flatMap((stage, g) => stage.map((s) => [s.id, g] as const)))
  return {
    version: 1,
    name: state.name,
    request: state.request,
    agents: state.agents,
    steps: state.steps.map((s) => ({
      id: s.id,
      agent: s.agent,
      task: s.task || 'Untitled step',
      prompt: s.prompt || defaultPrompt(s.task),
      stage: stageOf.get(s.id) ?? 0,
      tools: s.tools,
      approval: s.approval,
      ...(s.gateText && s.approval !== 'never' ? { asks: s.gateText } : {}),
    })),
  }
}
