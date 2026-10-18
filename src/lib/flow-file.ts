/**
 * The flow file (`flow.json`): what an agent writes when it sets up a flow, what the
 * canvas opens, and what the runner executes. Shared by the app and the runner, so it
 * imports nothing but zod. The descriptions are the docs: agents see them as JSON Schema.
 */
import { z } from 'zod'

export const PROVIDERS = ['anthropic', 'openai', 'google'] as const
export const EFFORTS = ['low', 'medium', 'high'] as const
export const APPROVALS = ['never', 'always', 'earned'] as const

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes, like "draft-page".')

const tools = (what: string) =>
  z
    .array(z.string().min(1))
    .describe(`${what} Tool ids, e.g. ["files"]. Only "files" (read and write in workspace/) is connected for real runs today.`)

export const FlowAgentSchema = z.strictObject({
  id: id.describe('Short id that steps use to refer to this agent, e.g. "writer".'),
  name: z.string().min(1).describe('Named by its job, e.g. "Writer".'),
  provider: z.enum(PROVIDERS).describe('Only "anthropic" runs for real today; others run in simulated mode.'),
  model: z.string().min(1).describe('The provider’s model id, e.g. "claude-sonnet-5-5".'),
  effort: z.enum(EFFORTS).default('medium').describe('How hard the model thinks.'),
  tools: tools('What this agent uses unless a step says otherwise.').default([]),
})

export const FlowStepSchema = z.strictObject({
  id: id.describe('Unique step id, e.g. "draft-page".'),
  agent: z.string().min(1).describe('The id of the agent that does this step.'),
  task: z.string().min(1).describe('A short name for the card, e.g. "Draft pricing page".'),
  prompt: z
    .string()
    .min(1)
    .describe('What the agent is told to do, in plain language: what to make, from what, where to save it. Earlier stages’ results are passed along automatically.'),
  stage: z
    .int()
    .min(0)
    .describe('Steps in the same stage run at the same time. Stage 1 starts when all of stage 0 is done. Count up from 0 without gaps.'),
  tools: tools('Replaces the agent’s tools for this step.').optional(),
  approval: z
    .enum(APPROVALS)
    .default('never')
    .describe('"always": ask the person before acting. "earned": ask until they’ve approved 3 times in a row, then ask less. "never": for steps that only read or write drafts.'),
  asks: z
    .string()
    .min(1)
    .optional()
    .describe('How the request reads after the agent’s name, e.g. "wants to publish the page". Only for steps that ask.'),
})

export const FlowFileSchema = z
  .strictObject({
    version: z.literal(1),
    name: z.string().min(1).describe('What the person will recognize the flow by.'),
    request: z.string().default('').describe('What the person asked for, in their words.'),
    agents: z.array(FlowAgentSchema).min(1),
    steps: z.array(FlowStepSchema).min(1),
  })
  .superRefine((flow, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
    const unique = <T extends { id: string }>(items: T[], key: string, what: string) => {
      const seen = new Set<string>()
      items.forEach((item, i) => {
        if (seen.has(item.id)) issue([key, i, 'id'], `${what} id "${item.id}" is used twice.`)
        seen.add(item.id)
      })
    }
    unique(flow.agents, 'agents', 'Agent')
    unique(flow.steps, 'steps', 'Step')

    const agents = new Set(flow.agents.map((a) => a.id))
    flow.steps.forEach((s, i) => {
      if (!agents.has(s.agent)) issue(['steps', i, 'agent'], `No agent with id "${s.agent}".`)
      if (s.asks && s.approval === 'never') issue(['steps', i, 'asks'], 'Only steps that ask before acting use "asks". Set approval, or remove asks.')
    })

    const stages = [...new Set(flow.steps.map((s) => s.stage))].sort((a, b) => a - b)
    if (stages.some((stage, i) => stage !== i)) {
      issue(['steps'], `Stages must count up from 0 without gaps; found ${stages.join(', ')}.`)
    }
  })

export type FlowFile = z.infer<typeof FlowFileSchema>
export type FlowAgent = z.infer<typeof FlowAgentSchema>
export type FlowStep = z.infer<typeof FlowStepSchema>

/** Parse and check a flow file. Lists every problem, so whoever wrote it can fix them in one go. */
export function parseFlow(input: unknown): { ok: true; flow: FlowFile } | { ok: false; error: string } {
  const result = FlowFileSchema.safeParse(input)
  if (result.success) return { ok: true, flow: result.data }
  const problems = result.error.issues.map((i) => `${i.path.join('.') || 'flow'}: ${i.message}`)
  return { ok: false, error: problems.join('\n') }
}
