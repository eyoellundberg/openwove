import type { Agent, Approval } from './types'

interface ToolInfo {
  letter: string
  name: string
}

/** Known tools get a letter tile; any other tool id from a flow file gets its first letter. Tiles are all neutral, so color stays for status. */
const TOOLS: Record<string, ToolInfo> = {
  files: { letter: 'Fs', name: 'Files' },
  google: { letter: 'G', name: 'Google' },
  notion: { letter: 'N', name: 'Notion' },
  figma: { letter: 'F', name: 'Figma' },
  slack: { letter: 'S', name: 'Slack' },
  github: { letter: 'GH', name: 'GitHub' },
  stripe: { letter: 'S', name: 'Stripe' },
  gmail: { letter: 'M', name: 'Gmail' },
  linear: { letter: 'L', name: 'Linear' },
  hubspot: { letter: 'H', name: 'HubSpot' },
}

export function toolInfo(id: string): ToolInfo {
  return TOOLS[id] ?? { letter: id.slice(0, 1).toUpperCase(), name: id }
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
