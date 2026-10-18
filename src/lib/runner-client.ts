/** Talks to the local runner (`npm run runner`), which Vite proxies under /api. */
import type { RunnerEvent } from './engine'
import type { FlowFile } from './flow-file'
import type { Provider } from './types'

export interface RunnerHealth {
  providers: Record<Provider, boolean>
  tools: string[]
  workspace: string
}

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
  stop: (runId: string) => fetch(`/api/runs/${runId}/stop`, { method: 'POST' }).then((r) => json<{ ok: true }>(r)),
  /** Streams a run's events; returns a function that stops listening. */
  events(runId: string, onEvent: (e: RunnerEvent) => void) {
    const source = new EventSource(`/api/runs/${runId}/events`)
    source.onmessage = (m) => onEvent(JSON.parse(m.data) as RunnerEvent)
    return () => source.close()
  },
}
