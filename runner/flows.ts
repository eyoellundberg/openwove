/** The flows folder: list, read and save flow files. Shared by the runner and the MCP server. */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseFlow } from '../src/lib/flow-file'

export const ROOT = resolve(import.meta.dirname, '..')
export const FLOWS = join(ROOT, 'flows')
export const WORKSPACE = join(ROOT, 'workspace')
export const RUNNER_PORT = Number(process.env.RUNNER_PORT ?? 5189)

export interface FlowListing {
  file: string
  name: string
}

/** A safe file name inside flows/, from a given name or the flow's own name. */
export function flowFileName(nameOrFile: string): string {
  const slug = basename(nameOrFile)
    .replace(/\.json$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'flow'}.json`
}

export function listFlows(): FlowListing[] {
  if (!existsSync(FLOWS)) return []
  return readdirSync(FLOWS)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      try {
        const parsed = parseFlow(JSON.parse(readFileSync(join(FLOWS, file), 'utf8')))
        return { file, name: parsed.ok ? parsed.flow.name : `${file} (has a problem)` }
      } catch {
        return { file, name: `${file} (not valid JSON)` }
      }
    })
}

/** The raw JSON of a flow file, or null if it isn't there. */
export function readFlow(file: string): unknown {
  const name = basename(file)
  const path = join(FLOWS, name.endsWith('.json') ? name : `${name}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Check a flow and save it to flows/. Returns the file name, or the problem to fix. */
export function saveFlow(input: unknown, file?: string): { ok: true; file: string } | { ok: false; error: string } {
  const parsed = parseFlow(input)
  if (!parsed.ok) return parsed
  const name = flowFileName(file ?? parsed.flow.name)
  mkdirSync(FLOWS, { recursive: true })
  writeFileSync(join(FLOWS, name), `${JSON.stringify(parsed.flow, null, 2)}\n`)
  return { ok: true, file: name }
}
