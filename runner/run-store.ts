/** Saves every run to the runs folder, so a restart doesn't forget what happened. */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FINAL_EVENTS } from '../src/lib/engine'
import { parseFlow } from '../src/lib/flow-file'
import type { StoredRun } from '../src/lib/usage'
import { ROOT } from './flows'

export const RUNS_DIR = join(ROOT, 'runs')

export function saveRun(run: StoredRun) {
  mkdirSync(RUNS_DIR, { recursive: true })
  const path = join(RUNS_DIR, `${run.id}.json`)
  // Write beside it and rename, so a crash mid-write can't leave half a file.
  writeFileSync(`${path}.tmp`, JSON.stringify(run))
  renameSync(`${path}.tmp`, path)
}

/** A run that was going when the runner stopped: say so, and close out its steps so nothing looks stuck. */
function closeOut(run: StoredRun, endedAt: number): StoredRun {
  const started = new Set<string>()
  const finished = new Set<string>()
  for (const e of run.events) {
    if (e.type === 'step_started') started.add(e.stepId)
    if (FINAL_EVENTS.has(e.type) && 'stepId' in e) finished.add(e.stepId)
  }
  const events = [...run.events]
  for (const step of run.flow.steps) {
    if (finished.has(step.id)) continue
    events.push(started.has(step.id) ? { type: 'step_stopped', stepId: step.id } : { type: 'step_skipped', stepId: step.id })
  }
  events.push({ type: 'run_done' })
  return { ...run, events, endedAt, interrupted: true }
}

export function loadRuns(): StoredRun[] {
  if (!existsSync(RUNS_DIR)) return []
  const runs: StoredRun[] = []
  for (const file of readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const path = join(RUNS_DIR, file)
      const run = JSON.parse(readFileSync(path, 'utf8')) as StoredRun
      if (typeof run.id !== 'string' || !Array.isArray(run.events) || !parseFlow(run.flow).ok) continue
      if (run.endedAt == null) {
        const closed = closeOut(run, statSync(path).mtimeMs)
        saveRun(closed)
        runs.push(closed)
      } else {
        runs.push(run)
      }
    } catch {
      // A file that isn't a run (or is damaged) is left alone and skipped.
    }
  }
  return runs
}
