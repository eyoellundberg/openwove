import { taskCost, taskEstimated } from './engine'
import { formatCost } from './models'
import type { Task, TaskState } from './types'

export const formatMinutes = (m: number) => (m < 1 ? '<1m' : `${Math.floor(m)}m`)

export const elapsed = (t: Task, now: number) => (t.start == null ? 0 : (t.end ?? now) - t.start)

export const STATE_NAME: Record<TaskState, string> = {
  pending: 'Waiting to start',
  running: 'Running',
  waiting: 'Needs you',
  done: 'Done',
  denied: 'You said no',
  failed: 'Failed',
  stopped: 'Stopped',
  skipped: 'Skipped',
}

/** One line for a step card's footer. */
export function stepStatusLine(t: Task | undefined, now: number): string {
  if (!t) return 'Not run yet'
  switch (t.state) {
    case 'pending':
      return 'Waiting for the previous stage'
    case 'running':
      return `Running · ${formatMinutes(elapsed(t, now))}${t.actedAlone ? ' · went ahead on its own' : ''}`
    case 'done':
      return `Done in ${formatMinutes(elapsed(t, now))} · ${formatCost(taskCost(t), taskEstimated(t))}${t.actedAlone ? ' · didn’t need to ask' : ''}`
    case 'skipped':
      return t.problem ? 'Skipped by you' : 'Skipped: an earlier step didn’t finish'
    default:
      return STATE_NAME[t.state]
  }
}

/** What the agent has reported so far, newest last. */
export function progressLog(t: Task): string[] {
  if (t.live || t.state === 'done') return t.log
  const shown = Math.max(1, Math.ceil((t.worked / t.minutes) * t.log.length))
  return t.log.slice(0, shown)
}
