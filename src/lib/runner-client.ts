/** Talks to the local runner (`npm run runner`), which Vite proxies under /api. */
import type { RunnerEvent } from './engine'
import type { FlowFile } from './flow-file'
import type { AppEvent, FlowListing, ProviderStatus, Resolution, RunnerHealth } from './runner-types'
import type { RunSummary } from './usage'

export type { AppEvent, FlowListing, ProviderStatus, Resolution, RunnerHealth } from './runner-types'

async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `The runner answered ${res.status}.`)
  }
  return res.json() as Promise<T>
}
const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)

export const runner = {
  health: () => get<RunnerHealth>('/health'),
  listFlows: () => get<FlowListing[]>('/flows'),
  getFlow: (file: string) => get<unknown>(`/flows/${encodeURIComponent(file)}`),
  saveFlow: (file: string, flow: FlowFile) => request<{ file: string }>('PUT', `/flows/${encodeURIComponent(file)}`, flow),
  startRun: (flow: FlowFile, streaks: Record<string, number>) => post<{ runId: string }>('/runs', { flow, streaks }),
  decide: (runId: string, stepId: string, approve: boolean) => post<{ ok: true }>(`/runs/${runId}/decide`, { stepId, approve }),
  resolve: (runId: string, stepId: string, action: Resolution) => post<{ ok: true }>(`/runs/${runId}/resolve`, { stepId, action }),
  /** What every saved run cost, newest first. */
  runs: () => get<RunSummary[]>('/runs'),
  status: () => get<{ anthropic: ProviderStatus }>('/status').then((s) => s.anthropic),
  stop: (runId: string) => post<{ ok: true }>(`/runs/${runId}/stop`),
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
  /** Streams a run's events, replaying the ones already sent; returns a function that stops listening. `onLost` runs if the runner no longer has the run. */
  events(runId: string, onEvent: (e: RunnerEvent) => void, onLost?: () => void) {
    const source = new EventSource(`/api/runs/${runId}/events`)
    source.onmessage = (m) => {
      const e = JSON.parse(m.data) as RunnerEvent
      onEvent(e)
      if (e.type === 'run_done') source.close()
    }
    source.onerror = () => {
      // While connecting, the browser retries on its own. Closed means the runner answered with an error, e.g. 404 after a restart.
      if (source.readyState === EventSource.CLOSED) onLost?.()
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
