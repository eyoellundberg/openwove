/**
 * What the runner sends and accepts, shared by the runner and the app's client so the two
 * can't drift apart. Like flow-file.ts, it imports nothing from the app.
 */
import type { Provider } from './types'

/** `GET /health`. */
export interface RunnerHealth {
  /** True for each provider that can run for real. */
  providers: Record<Provider, boolean>
  /** Tool ids the runner connects for real runs. */
  tools: string[]
  workspace: string
  /** The project folder, for the MCP setup snippet. */
  root: string
}

/** Whether Claude is up, from Anthropic's public status page. `GET /status`. */
export interface ProviderStatus {
  /** `unknown` means the status page itself couldn't be reached. */
  level: 'ok' | 'slow' | 'down' | 'unknown'
  /** One plain line, e.g. "All good" or "Slower than usual". */
  text: string
  /** What Anthropic says is going on, when something is. */
  incident?: string
  checkedAt: number
}

/** A file in flows/. `GET /flows`. */
export interface FlowListing {
  file: string
  name: string
}

/** Your agent saved a flow through the MCP server. Streamed on `GET /app-events`. */
export interface AppEvent {
  type: 'flow-saved'
  file: string
  open: boolean
}

/** What you can tell a step that ran into trouble. `POST /runs/:id/resolve`. */
export const RESOLUTIONS = ['retry', 'skip', 'stop'] as const
export type Resolution = (typeof RESOLUTIONS)[number]
