import type { Agent, Approval } from './types'

interface ToolInfo {
  letter: string
  name: string
  className: string
}

/** Known tools get their own tile; any other tool id from a flow file gets a neutral one. Tailwind palette colors read in both themes. */
const TOOLS: Record<string, ToolInfo> = {
  files: { letter: 'Fs', name: 'Files', className: 'bg-emerald-600' },
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

export function toolInfo(id: string): ToolInfo {
  return TOOLS[id] ?? { letter: id.slice(0, 1).toUpperCase(), name: id, className: 'bg-neutral-500' }
}

/** Tools the local runner can actually connect today. */
export const RUNNABLE_TOOLS = new Set(['files'])

export const APPROVAL_LABEL: Record<Approval, string> = {
  never: 'Don’t ask me',
  always: 'Always ask me',
  earned: 'Ask until it’s earned it',
}

// Cached so a missing agent returns the same object each time (stable for store selectors).
const missing = new Map<string, Agent>()

export function findAgent(agents: Agent[], id: string): Agent {
  const found = agents.find((a) => a.id === id)
  if (found) return found
  if (!missing.has(id)) {
    missing.set(id, { id, name: id, provider: 'anthropic', model: 'unknown', effort: 'medium', tools: [] })
  }
  return missing.get(id)!
}
