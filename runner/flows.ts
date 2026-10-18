/** The flows folder: list, read and save flow files. Shared by the runner and the MCP server. */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { RUNNABLE_TOOLS } from '../src/lib/catalog'
import { type FlowFile, parseFlow } from '../src/lib/flow-file'
import { MODELS } from '../src/lib/models'

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

/** Valid, but won't do what the writer probably expects in a real run. */
export function flowWarnings(flow: FlowFile): string[] {
  const warnings: string[] = []
  for (const a of flow.agents) {
    const known = MODELS.find((m) => m.id === a.model)
    if (a.provider !== 'anthropic') warnings.push(`${a.name} uses ${a.provider}, which only runs in simulated mode.`)
    else if (!known) warnings.push(`${a.name}: "${a.model}" isn’t a model Agent Flow knows, so it has no cost and may fail in a real run.`)
    if (known && known.provider !== a.provider) warnings.push(`${a.name}: ${a.model} is a ${known.provider} model, not ${a.provider}.`)
  }
  const offline = new Set(flow.steps.flatMap((s) => s.tools ?? flow.agents.find((a) => a.id === s.agent)?.tools ?? []))
  RUNNABLE_TOOLS.forEach((t) => offline.delete(t))
  if (offline.size) warnings.push(`Not connected for real runs, so skipped there: ${[...offline].join(', ')}.`)
  return warnings
}

/** Check a flow and save it to flows/. Returns the file name and any warnings, or the problems to fix. */
export function saveFlow(
  input: unknown,
  file?: string,
): { ok: true; file: string; warnings: string[] } | { ok: false; error: string } {
  const parsed = parseFlow(input)
  if (!parsed.ok) return parsed
  const name = flowFileName(file ?? parsed.flow.name)
  mkdirSync(FLOWS, { recursive: true })
  writeFileSync(join(FLOWS, name), `${JSON.stringify(parsed.flow, null, 2)}\n`)
  return { ok: true, file: name, warnings: flowWarnings(parsed.flow) }
}
