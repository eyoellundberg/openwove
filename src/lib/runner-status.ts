import type { RunnerHealth } from './runner-types'

export type RunnerStatus = { state: 'checking' } | { state: 'offline' } | { state: 'ready'; health: RunnerHealth }

/** What stands between you and a real run, if anything. */
export type Readiness = 'checking' | 'offline' | 'no-key' | 'ready'

export const readiness = (status: RunnerStatus): Readiness =>
  status.state !== 'ready' ? status.state : status.health.providers.anthropic ? 'ready' : 'no-key'

/** The one sentence every screen uses when the key is missing. The runner says the same. */
export const NO_KEY_HINT = 'Add ANTHROPIC_API_KEY to .env.local and restart the runner.'
