/** Is Claude up? Reads Anthropic's public status page, so the app can say so before and after a step fails. */

const STATUS_URL = 'https://status.claude.com/api/v2/summary.json'
/** The part of Anthropic's status page that real runs depend on. */
const API_COMPONENT = 'Claude API (api.anthropic.com)'
/** Don't ask the status page more often than this, however many windows are open. */
const CACHE_MS = 30_000
const TIMEOUT_MS = 5_000

export interface ProviderStatus {
  /** `unknown` means the status page itself couldn't be reached. */
  level: 'ok' | 'slow' | 'down' | 'unknown'
  /** One plain line, e.g. "All good" or "Slower than usual". */
  text: string
  /** What Anthropic says is going on, when something is. */
  incident?: string
  checkedAt: number
}

interface Summary {
  components: { name: string; status: string }[]
  incidents: { name: string }[]
}

const LEVELS: Record<string, Pick<ProviderStatus, 'level' | 'text'>> = {
  operational: { level: 'ok', text: 'All good' },
  degraded_performance: { level: 'slow', text: 'Slower than usual' },
  under_maintenance: { level: 'slow', text: 'Under maintenance' },
  partial_outage: { level: 'slow', text: 'Partly down' },
  major_outage: { level: 'down', text: 'Down' },
}

let cached: ProviderStatus | null = null

export async function claudeStatus(): Promise<ProviderStatus> {
  if (cached && Date.now() - cached.checkedAt < CACHE_MS) return cached
  try {
    const res = await fetch(STATUS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Status page answered ${res.status}`)
    const summary = (await res.json()) as Summary
    const api = summary.components.find((c) => c.name === API_COMPONENT)
    const mapped = (api && LEVELS[api.status]) || { level: 'unknown' as const, text: 'Status unknown' }
    cached = { ...mapped, incident: summary.incidents[0]?.name, checkedAt: Date.now() }
  } catch {
    cached = { level: 'unknown', text: 'Status unknown', checkedAt: Date.now() }
  }
  return cached
}
