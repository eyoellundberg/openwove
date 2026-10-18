/**
 * The flow file (`flow.json`): what an agent writes when it sets up a flow, what the
 * canvas opens, and what the runner executes. Shared by the app and the runner, so it
 * imports nothing but zod.
 */
import { z } from 'zod'

export const PROVIDERS = ['anthropic', 'openai', 'google'] as const
export const EFFORTS = ['low', 'medium', 'high'] as const
export const APPROVALS = ['never', 'always', 'earned'] as const

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes, like "draft-page".')

export const FlowAgentSchema = z.object({
  id,
  name: z.string().min(1),
  provider: z.enum(PROVIDERS),
  /** The provider's model id, e.g. "claude-sonnet-5-5". */
  model: z.string().min(1),
  effort: z.enum(EFFORTS).default('medium'),
  /** Tools this agent may use unless a step says otherwise, e.g. ["files"]. */
  tools: z.array(z.string()).default([]),
})

export const FlowStepSchema = z.object({
  id,
  agent: z.string().min(1),
  /** A short name for the card, e.g. "Draft pricing page". */
  task: z.string().min(1),
  /** What the agent is told to do, in plain language. */
  prompt: z.string().min(1),
  /** Steps with the same stage run at the same time; stage 1 starts when all of stage 0 is done. */
  stage: z.number().int().min(0),
  tools: z.array(z.string()).optional(),
  approval: z.enum(APPROVALS).default('never'),
  /** How the approval request reads after the agent's name, e.g. "wants to publish the page". */
  asks: z.string().optional(),
})

export const FlowFileSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    /** What the person asked for, in their words. */
    request: z.string().default(''),
    agents: z.array(FlowAgentSchema).min(1),
    steps: z.array(FlowStepSchema).min(1),
  })
  .superRefine((flow, ctx) => {
    const agents = new Set(flow.agents.map((a) => a.id))
    const seen = new Set<string>()
    flow.steps.forEach((s, i) => {
      if (!agents.has(s.agent)) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'agent'], message: `No agent with id "${s.agent}".` })
      }
      if (seen.has(s.id)) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `Step id "${s.id}" is used twice.` })
      }
      seen.add(s.id)
    })
    const stages = [...new Set(flow.steps.map((s) => s.stage))].sort((a, b) => a - b)
    stages.forEach((stage, i) => {
      if (stage !== i) {
        ctx.addIssue({ code: 'custom', path: ['steps'], message: `Stages must count up from 0 without gaps; found ${stages.join(', ')}.` })
      }
    })
  })

export type FlowFile = z.infer<typeof FlowFileSchema>
export type FlowAgent = z.infer<typeof FlowAgentSchema>
export type FlowStep = z.infer<typeof FlowStepSchema>

/** Parse and check a flow file, with errors a person can act on. */
export function parseFlow(input: unknown): { ok: true; flow: FlowFile } | { ok: false; error: string } {
  const result = FlowFileSchema.safeParse(input)
  if (result.success) return { ok: true, flow: result.data }
  const first = result.error.issues[0]
  return { ok: false, error: `${first.path.join('.') || 'flow'}: ${first.message}` }
}
