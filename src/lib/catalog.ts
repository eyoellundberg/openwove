import type { Agent, AgentId, Approval, ToolId } from './types'

export const AGENTS: Agent[] = [
  { id: 'researcher', name: 'Researcher', model: 'Opus 5.5', vendor: 'anthropic', tools: ['google', 'notion'] },
  { id: 'writer', name: 'Writer', model: 'Sonnet 5.5', vendor: 'anthropic', tools: ['figma', 'notion'] },
  { id: 'reviewer', name: 'Reviewer', model: 'GPT-6 Sol', vendor: 'openai', tools: ['notion', 'slack'] },
  { id: 'ops', name: 'Ops', model: 'Gemini 3.8 Flash', vendor: 'google', tools: ['stripe', 'github'] },
]

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, Agent>

export const laneOf = (agent: AgentId) => AGENTS.findIndex((a) => a.id === agent)

/** Tool tiles use Tailwind palette colors so they read in both themes. */
export const TOOLS: Record<ToolId, { letter: string; name: string; className: string }> = {
  google: { letter: 'G', name: 'Google', className: 'bg-blue-500' },
  notion: { letter: 'N', name: 'Notion', className: 'bg-neutral-600' },
  figma: { letter: 'F', name: 'Figma', className: 'bg-orange-600' },
  slack: { letter: 'S', name: 'Slack', className: 'bg-purple-600' },
  github: { letter: 'GH', name: 'GitHub', className: 'bg-neutral-700' },
  stripe: { letter: 'S', name: 'Stripe', className: 'bg-indigo-500' },
  gmail: { letter: 'M', name: 'Gmail', className: 'bg-red-500' },
  linear: { letter: 'L', name: 'Linear', className: 'bg-violet-500' },
  hubspot: { letter: 'H', name: 'HubSpot', className: 'bg-orange-500' },
}

export const APPROVAL_LABEL: Record<Approval, string> = {
  never: 'Don’t ask me',
  always: 'Always ask me',
  earned: 'Ask until it’s earned it',
}
