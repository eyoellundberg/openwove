/** Talks to the local runner (`npm run runner`), which Vite proxies under /api. */
import type { RunnerEvent } from './engine'
import type { FlowFile } from './flow-file'
import type { Provider } from './types'

export interface RunnerHealth {
  providers: Record<Provider, boolean>
  tools: string[]
  workspace: string
  /** The project folder, for the MCP setup snippet. */
  root: string
}

/** Your agent saved a flow through the MCP server. */
export interface AppEvent {
  type: 'flow-saved'
  file: string
  open: boolean
}

/** Whether Claude is up, from Anthropic's status page via the runner. */
export interface ProviderStatus {
  level: 'ok' | 'slow' | 'down' | 'unknown'
  text: string
  incident?: string
}

/** What you can tell a step that ran into trouble. */
export type Resolution = 'retry' | 'skip' | 'stop'

export interface FlowListing {
  file: string
  name: string
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `The runner answered ${res.status}.`)
  }
  return res.json() as Promise<T>
}

export const runner = {
  health: () => fetch('/api/health').then((r) => json<RunnerHealth>(r)),
  listFlows: () => fetch('/api/flows').then((r) => json<FlowListing[]>(r)),
  getFlow: (file: string) => fetch(`/api/flows/${encodeURIComponent(file)}`).then((r) => json<unknown>(r)),
  saveFlow: (file: string, flow: FlowFile) =>
    fetch(`/api/flows/${encodeURIComponent(file)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    }).then((r) => json<{ file: string }>(r)),
  startRun: (flow: FlowFile, streaks: Record<string, number>) =>
    fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow, streaks }),
    }).then((r) => json<{ runId: string }>(r)),
  decide: (runId: string, stepId: string, approve: boolean) =>
    fetch(`/api/runs/${runId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, approve }),
    }).then((r) => json<{ ok: true }>(r)),
  resolve: (runId: string, stepId: string, action: Resolution) =>
    fetch(`/api/runs/${runId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, action }),
    }).then((r) => json<{ ok: true }>(r)),
  status: () => fetch('/api/status').then((r) => json<{ anthropic: ProviderStatus }>(r)).then((s) => s.anthropic),
  stop: (runId: string) => fetch(`/api/runs/${runId}/stop`, { method: 'POST' }).then((r) => json<{ ok: true }>(r)),
  /** Whether the runner still knows a run. It forgets them when it restarts. */
  async knowsRun(runId: string): Promise<boolean> {
    const controller = new AbortController()
    try {
      const res = await fetch(`/api/runs/${runId}/events`, { signal: controller.signal })
      return res.status !== 404
    } catch {
      // The runner isn't reachable right now, which says nothing about the run.
      return true
    } finally {
      controller.abort()
    }
  },
  /** Streams a run's events, replaying the ones already sent; returns a function that stops listening. */
  events(runId: string, onEvent: (e: RunnerEvent) => void) {
    const source = new EventSource(`/api/runs/${runId}/events`)
    source.onmessage = (m) => {
      const e = JSON.parse(m.data) as RunnerEvent
      onEvent(e)
      if (e.type === 'run_done') source.close()
    }
    return () => source.close()
  },
  /** Listens for flows your agent saves; `onLost` runs if the runner goes away. */
  appEvents(onEvent: (e: AppEvent) => void, onLost: () => void) {
    const source = new EventSource('/api/app-events')
    source.onmessage = (m) => onEvent(JSON.parse(m.data) as AppEvent)
    source.onerror = () => {
      source.close()
      onLost()
    }
    return () => source.close()
  },
}
