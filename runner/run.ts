/** Runs one flow for real: stage by stage, one Claude tool loop per step, pausing at approvals. */
import Anthropic from '@anthropic-ai/sdk'
import { askChance, type RunnerEvent } from '../src/lib/engine'
import type { FlowAgent, FlowFile, FlowStep } from '../src/lib/flow-file'
import { ACTING_TOOLS, filesTool } from './files-tool'

/** Enough room for a full page of HTML in one reply. */
const MAX_TOKENS = 16_000
/** A step that keeps calling tools this many times is stuck. */
const MAX_TURNS = 24
/** Models with a server-side fallback for refusals. */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])

type Listener = (e: RunnerEvent) => void

export class Run {
  readonly events: RunnerEvent[] = []
  private listeners = new Set<Listener>()
  private decisions = new Map<string, (approve: boolean) => void>()
  private stopped = false
  private outputs: { step: FlowStep; text: string }[] = []
  private flow: FlowFile
  private streaks: Record<string, number>
  private workspace: string
  private client: Anthropic

  constructor(flow: FlowFile, streaks: Record<string, number>, workspace: string, client: Anthropic) {
    this.flow = flow
    this.streaks = streaks
    this.workspace = workspace
    this.client = client
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

  stop() {
    this.stopped = true
    for (const resolve of this.decisions.values()) resolve(false)
    this.decisions.clear()
  }

  private emit(e: RunnerEvent) {
    this.events.push(e)
    for (const listener of this.listeners) listener(e)
  }

  async start() {
    const stageCount = Math.max(...this.flow.steps.map((s) => s.stage)) + 1
    for (let stage = 0; stage < stageCount; stage++) {
      const steps = this.flow.steps.filter((s) => s.stage === stage)
      if (this.stopped) {
        steps.forEach((s) => this.emit({ type: 'step_skipped', stepId: s.id }))
        continue
      }
      const results = await Promise.all(steps.map((s) => this.runStep(s)))
      if (results.some((ok) => !ok)) this.stopped = true
    }
    this.emit({ type: 'run_done' })
  }

  /** Returns false when the step failed or was denied, which stops later stages. */
  private async runStep(step: FlowStep): Promise<boolean> {
    const agent = this.flow.agents.find((a) => a.id === step.agent)!
    this.emit({ type: 'step_started', stepId: step.id })

    if (agent.provider !== 'anthropic') {
      this.emit({ type: 'step_failed', stepId: step.id, error: `Real runs only support Anthropic models so far; ${agent.name} uses ${agent.provider}.` })
      return false
    }

    const wanted = step.tools ?? agent.tools
    const missing = wanted.filter((t) => t !== 'files')
    if (missing.length) this.emit({ type: 'step_log', stepId: step.id, text: `Not connected, skipped: ${missing.join(', ')}` })

    try {
      const files = wanted.includes('files') ? await filesTool(this.workspace) : null
      return await this.loop(step, agent, files)
    } catch (error) {
      this.emit({ type: 'step_failed', stepId: step.id, error: describe(error) })
      return false
    }
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
      if (this.stopped) return false
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

function describe(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.'
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited by the Anthropic API. Try again in a minute.'
  if (error instanceof Anthropic.APIError) return `Anthropic API error ${error.status}: ${error.message}`
  return error instanceof Error ? error.message : String(error)
}
