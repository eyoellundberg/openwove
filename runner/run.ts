/** Runs one flow for real: stage by stage, one Claude tool loop per step, pausing at approvals. */
import Anthropic from '@anthropic-ai/sdk'
import { findAgent, RUNNABLE_TOOLS } from '../src/lib/catalog'
import { askChance, type RunnerEvent } from '../src/lib/engine'
import type { FlowAgent, FlowFile, FlowStep } from '../src/lib/flow-file'
import type { Resolution } from '../src/lib/runner-types'
import type { StoredRun } from '../src/lib/usage'
import { ACTING_TOOLS, filesTool } from './files-tool'

/** Enough room for a full page of HTML in one reply. */
const MAX_TOKENS = 16_000
/** A step that keeps calling tools this many times is stuck. */
const MAX_TURNS = 24
/** Tries per API call (the first plus retries) for temporary errors like rate limits and overloads, with a pause between. Then it asks you. */
export const API_TRIES = 3
/** Models with a server-side fallback for refusals. */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])

type Listener = (e: RunnerEvent) => void

export class Run {
  readonly events: RunnerEvent[] = []
  private listeners = new Set<Listener>()
  private decisions = new Map<string, (approve: boolean) => void>()
  private problems = new Map<string, (action: Resolution) => void>()
  private stopped = false
  private outputs: { step: FlowStep; text: string }[] = []
  private flow: FlowFile
  private streaks: Record<string, number>
  private workspace: string
  private client: Anthropic
  private startedAt = Date.now()
  private endedAt: number | null = null
  readonly id: string
  /** Called after every event, so the run can be saved as it goes. */
  private onChange?: () => void

  constructor(id: string, flow: FlowFile, streaks: Record<string, number>, workspace: string, client: Anthropic, onChange?: (run: Run) => void) {
    this.id = id
    this.flow = flow
    this.streaks = streaks
    this.workspace = workspace
    this.client = client
    this.onChange = onChange && (() => onChange(this))
  }

  /** The run as it can be saved and read back later. */
  toStored(): StoredRun {
    return { id: this.id, startedAt: this.startedAt, endedAt: this.endedAt, flow: this.flow, events: this.events }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  decide(stepId: string, approve: boolean) {
    const resolve = this.decisions.get(stepId)
    if (!resolve) return false
    this.decisions.delete(stepId)
    resolve(approve)
    return true
  }

  /** Your answer to a step that ran into trouble. False when it isn't waiting for one. */
  resolve(stepId: string, action: Resolution) {
    const resolve = this.problems.get(stepId)
    if (!resolve) return false
    this.problems.delete(stepId)
    resolve(action)
    return true
  }

  stop() {
    this.stopped = true
    for (const resolve of this.decisions.values()) resolve(false)
    this.decisions.clear()
    for (const resolve of this.problems.values()) resolve('stop')
    this.problems.clear()
  }

  private emit(e: RunnerEvent) {
    this.events.push(e)
    if (e.type === 'run_done') this.endedAt = Date.now()
    for (const listener of this.listeners) listener(e)
    this.onChange?.()
  }

  async start() {
    const stageCount = Math.max(...this.flow.steps.map((s) => s.stage)) + 1
    for (let stage = 0; stage < stageCount; stage++) {
      const steps = this.flow.steps.filter((s) => s.stage === stage)
      if (this.stopped) {
        steps.forEach((s) => this.emit({ type: 'step_skipped', stepId: s.id }))
        continue
      }
      // One step giving up stops its neighbours too, so nothing keeps spending after the run is over.
      await Promise.all(
        steps.map(async (s) => {
          if (!(await this.runStep(s))) this.stop()
        }),
      )
    }
    this.emit({ type: 'run_done' })
  }

  /** Returns false when the step failed or was denied, which stops later stages. */
  private async runStep(step: FlowStep): Promise<boolean> {
    const agent = findAgent(this.flow.agents, step.agent)
    this.emit({ type: 'step_started', stepId: step.id })

    if (agent.provider !== 'anthropic') {
      this.emit({ type: 'step_failed', stepId: step.id, error: `Real runs only support Anthropic models so far; ${agent.name} uses ${agent.provider}.` })
      return false
    }

    const wanted = step.tools ?? agent.tools
    const missing = wanted.filter((t) => !RUNNABLE_TOOLS.has(t))
    if (missing.length) this.emit({ type: 'step_log', stepId: step.id, text: `Not connected, skipped: ${missing.join(', ')}` })

    for (let attempt = 1; ; attempt++) {
      try {
        const files = wanted.includes('files') ? await filesTool(this.workspace) : null
        return await this.loop(step, agent, files)
      } catch (error) {
        if (this.stopped) {
          this.emit({ type: 'step_stopped', stepId: step.id })
          return false
        }
        const message = describe(error)
        const action = await this.problem(step, message, attempt)
        if (action === 'retry') continue
        if (action === 'skip') {
          this.emit({ type: 'step_skipped', stepId: step.id })
          return true
        }
        this.emit({ type: 'step_failed', stepId: step.id, error: message })
        return false
      }
    }
  }

  /** The step hit something it can't get past alone. Wait for you to say what to do. */
  private async problem(step: FlowStep, error: string, attempt: number): Promise<Resolution> {
    this.emit({ type: 'step_problem', stepId: step.id, error, attempt })
    const action = await new Promise<Resolution>((resolve) => this.problems.set(step.id, resolve))
    if (action === 'retry') this.emit({ type: 'step_resumed', stepId: step.id })
    return action
  }

  private async loop(step: FlowStep, agent: FlowAgent, files: Awaited<ReturnType<typeof filesTool>> | null) {
    const earlier = this.outputs.map((o) => `## ${o.step.task}\n${o.text}`).join('\n\n')
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: 'user',
        content: `${step.prompt}${earlier ? `\n\n# What earlier steps reported\n\n${earlier}` : ''}`,
      },
    ]
    let gated = step.approval === 'never'

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (this.stopped) {
        this.emit({ type: 'step_stopped', stepId: step.id })
        return false
      }
      const response = await this.client.beta.messages.create({
        model: agent.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(agent, step, this.workspace, Boolean(files)),
        output_config: { effort: agent.effort },
        ...(files ? { tools: files.tools } : {}),
        ...(FALLBACK_MODELS.has(agent.model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
        messages,
      })

      const u = response.usage
      this.emit({
        type: 'step_usage',
        stepId: step.id,
        inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens,
      })

      if (response.stop_reason === 'refusal') {
        throw new Error(`The model declined this step${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : '.'}`)
      }
      if (response.stop_reason === 'max_tokens') throw new Error('The reply ran past the length limit.')

      messages.push({ role: 'assistant', content: response.content })
      if (response.stop_reason === 'pause_turn') continue

      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      if (!calls.length) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        this.outputs.push({ step, text: text || '(no summary)' })
        const firstLine = text.split('\n').find((l) => l.trim())
        if (firstLine) this.emit({ type: 'step_log', stepId: step.id, text: firstLine.replace(/^#+\s*/, '').slice(0, 140) })
        this.emit({ type: 'step_done', stepId: step.id })
        return true
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
      for (const call of calls) {
        if (!gated && ACTING_TOOLS.has(call.name)) {
          gated = true
          const approved = await this.approval(step, call)
          if (!approved) {
            this.emit({ type: 'step_denied', stepId: step.id })
            return false
          }
        }
        const result = files ? await files.call(call.name, call.input) : { text: 'No tools are connected.', isError: true }
        this.emit({ type: 'step_log', stepId: step.id, text: logLine(call, result.isError) })
        results.push({ type: 'tool_result', tool_use_id: call.id, content: result.text, is_error: result.isError })
      }
      messages.push({ role: 'user', content: results })
    }
    throw new Error(`Stopped after ${MAX_TURNS} tool calls without finishing.`)
  }

  /** "Always" asks; "earned" asks less as the streak grows. Resolves true to go ahead. */
  private async approval(step: FlowStep, call: Anthropic.Beta.BetaToolUseBlock) {
    const ask = step.approval === 'always' || Math.random() < askChance(this.streaks[step.id] ?? 0)
    if (!ask) {
      this.emit({ type: 'step_acted_alone', stepId: step.id })
      return true
    }
    const path = (call.input as { path?: string })?.path
    this.emit({
      type: 'step_waiting',
      stepId: step.id,
      gateText: step.asks ?? `wants to ${call.name.replace('_', ' ')}${path ? ` ${path}` : ''}`,
    })
    const approve = await new Promise<boolean>((resolve) => this.decisions.set(step.id, resolve))
    if (approve) this.emit({ type: 'step_resumed', stepId: step.id })
    return approve
  }
}

function systemPrompt(agent: FlowAgent, step: FlowStep, workspace: string, hasFiles: boolean) {
  return [
    `You are ${agent.name}, one agent in a small team working through a flow. Your step: ${step.task}.`,
    hasFiles
      ? `You can read and write files in the workspace folder ${workspace}. Use paths inside it, e.g. ${workspace}/notes.md. Create folders before writing into them.`
      : 'You have no tools for this step; answer in text.',
    'Do only your step. When you are done, reply with two or three plain sentences on what you did and anything you were unsure about.',
  ].join('\n\n')
}

function logLine(call: Anthropic.Beta.BetaToolUseBlock, failed: boolean) {
  const input = call.input as { path?: string; paths?: string[] }
  const target = input?.path?.split('/workspace/').pop() ?? input?.paths?.map((p) => p.split('/').pop()).join(', ') ?? ''
  const verb: Record<string, string> = {
    read_text_file: 'Read',
    read_file: 'Read',
    read_multiple_files: 'Read',
    write_file: 'Wrote',
    edit_file: 'Edited',
    create_directory: 'Made folder',
    list_directory: 'Looked in',
    directory_tree: 'Looked through',
    search_files: 'Searched',
    move_file: 'Moved',
  }
  return `${failed ? 'Could not: ' : ''}${verb[call.name] ?? call.name} ${target}`.trim()
}

/** The plain message inside Anthropic's error body, without the JSON around it. */
function apiMessage(error: InstanceType<typeof Anthropic.APIError>) {
  const body = error.error as { error?: { message?: string } } | undefined
  return body?.error?.message ?? error.message
}

function describe(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.'
  if (error instanceof Anthropic.NotFoundError) return `Claude doesn’t have that model for your key (${apiMessage(error)}).`
  if (error instanceof Anthropic.RateLimitError) return `Claude is rate limiting this key, even after ${API_TRIES} tries. Give it a minute.`
  if (error instanceof Anthropic.APIConnectionError) return `Couldn’t reach Claude after ${API_TRIES} tries. Check your connection.`
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
    return `Claude is struggling (error ${error.status}) and kept failing after ${API_TRIES} tries.`
  }
  if (error instanceof Anthropic.APIError) return `Anthropic API error ${error.status}: ${apiMessage(error)}`
  return error instanceof Error ? error.message : String(error)
}
