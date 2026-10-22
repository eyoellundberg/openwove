/** The local runner: `npm run runner`. The app reaches it through Vite's /api proxy. */
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { RUNNABLE_TOOLS } from '../src/lib/catalog'
import { parseFlow } from '../src/lib/flow-file'
import { listFlows, readFlow, ROOT, RUNNER_PORT as PORT, saveFlow, WORKSPACE } from './flows'
import type { Provider } from '../src/lib/types'
import { type AppEvent, RESOLUTIONS, type Resolution, type RunnerHealth } from '../src/lib/runner-types'
import { type RunSummary, summarize, type StoredRun } from '../src/lib/usage'
import { API_TRIES, Run } from './run'
import { loadRuns, saveRun } from './run-store'
import { agentSetup, connectClaudeCode } from './agent'
import { buildReport } from '../src/lib/run-report'
import { SCHEMA_NAMES, schemaJson, type SchemaName } from '../src/lib/schemas'
import { readProfile, profileContext, writeProfile } from './profile'
import { getKey, PROVIDER_IDS, removeKey, setKey } from './secrets'
import { claudeStatus } from './status'

// First launch of the app: put the sample flows and their inputs in the person's own folder.
const SEED_DIR = process.env.OPENWOVE_SEED
if (SEED_DIR && !existsSync(join(ROOT, 'flows'))) cpSync(SEED_DIR, ROOT, { recursive: true })

if (existsSync(join(ROOT, '.env.local'))) process.loadEnvFile(join(ROOT, '.env.local'))
mkdirSync(WORKSPACE, { recursive: true })

/** Set by the packaged app: the built UI, which the runner serves itself since there's no Vite proxy. */
const STATIC_DIR = process.env.OPENWOVE_STATIC
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

const API_ROUTES = new Set(['health', 'status', 'flows', 'runs', 'app-events', 'profile', 'keys', 'agent', 'schemas'])

/** A file from the built UI, or index.html for any page the app routes itself. */
function serveStatic(res: ServerResponse, pathname: string) {
  const wanted = normalize(join(STATIC_DIR!, pathname))
  const isFile = wanted.startsWith(STATIC_DIR!) && existsSync(wanted) && statSync(wanted).isFile()
  const file = isFile ? wanted : join(STATIC_DIR!, 'index.html')
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}

const hasAnthropic = () => Boolean(getKey('anthropic') || process.env.ANTHROPIC_AUTH_TOKEN)
/** Built when a run starts, so a key added in the app works without a restart. */
const makeClient = () => new Anthropic({ maxRetries: API_TRIES - 1, ...(getKey('anthropic') ? { apiKey: getKey('anthropic') } : {}) })
const runs = new Map<string, Run>()
/** Finished runs, from this runner and from before it was restarted. Served from their records, which don't change. */
const stored = new Map<string, StoredRun>(loadRuns().map((r) => [r.id, r]))
const summaries = new Map<string, RunSummary>()
let runCounter = 0

function summaryOf(record: StoredRun): RunSummary {
  let summary = summaries.get(record.id)
  if (!summary) {
    summary = summarize(record)
    summaries.set(record.id, summary)
  }
  return summary
}

/** Saves are coalesced: a burst of events (tokens, a log line, a state change) costs one write, once they've all been handled. */
const saving = new Set<string>()
function scheduleSave(run: Run) {
  if (saving.has(run.id)) return
  saving.add(run.id)
  setTimeout(() => {
    saving.delete(run.id)
    const record = run.toStored()
    saveRun(record)
    if (record.endedAt != null) {
      stored.set(run.id, record)
      runs.delete(run.id)
    }
  }, 0)
}

/** Where a reconnecting browser left off: the index of the first event it hasn't seen. */
const nextEventIndex = (req: IncomingMessage) => Number(req.headers['last-event-id'] ?? -1) + 1

/** Open app windows, listening for "your agent saved a flow". */
const apps = new Set<(e: AppEvent) => void>()

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Starts a server-sent event stream. An event with an id lets a reconnecting browser pick up where it left off. */
function openEventStream(res: ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.write(': connected\n\n')
  return (e: unknown, id?: number) => res.write(`${id == null ? '' : `id: ${id}\n`}data: ${JSON.stringify(e)}\n\n`)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  if (STATIC_DIR) {
    // The app calls /api/...; Vite strips the prefix in development, so do the same here.
    // The MCP server calls the routes directly, without it.
    if (url.pathname.startsWith('/api/')) url.pathname = url.pathname.slice('/api'.length)
    else if (!API_ROUTES.has(url.pathname.split('/')[1])) return serveStatic(res, url.pathname)
  }
  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const health: RunnerHealth = {
        providers: { anthropic: hasAnthropic(), openai: Boolean(getKey('openai')), google: Boolean(getKey('google')) },
        tools: [...RUNNABLE_TOOLS],
        workspace: WORKSPACE,
      }
      return send(res, 200, health)
    }

    // The JSON Schemas, for any agent that wants to check what it writes or reads.
    if (req.method === 'GET' && parts[0] === 'schemas' && parts[1]) {
      const name = parts[1].replace(/\.schema\.json$/, '') as SchemaName
      return SCHEMA_NAMES.includes(name) ? send(res, 200, schemaJson(name)) : send(res, 404, { error: `Known schemas: ${SCHEMA_NAMES.join(', ')}.` })
    }

    if (req.method === 'GET' && url.pathname === '/agent') return send(res, 200, agentSetup())
    if (req.method === 'POST' && url.pathname === '/agent/claude-code') {
      const problem = await connectClaudeCode()
      return problem ? send(res, 500, { error: problem }) : send(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/profile') return send(res, 200, readProfile())
    if (req.method === 'PUT' && url.pathname === '/profile') return send(res, 200, writeProfile(await readJson(req)))

    // Keys go in, never out: /health only says whether one is there.
    if (parts[0] === 'keys' && PROVIDER_IDS.includes(parts[1] as Provider)) {
      const provider = parts[1] as Provider
      if (req.method === 'PUT') {
        const { key } = (await readJson(req)) as { key?: string }
        const problem = setKey(provider, String(key ?? '').trim())
        return problem ? send(res, 400, { error: problem }) : send(res, 200, { ok: true })
      }
      if (req.method === 'DELETE') {
        removeKey(provider)
        return send(res, 200, { ok: true })
      }
    }

    if (req.method === 'GET' && url.pathname === '/status') return send(res, 200, { anthropic: await claudeStatus() })

    if (req.method === 'GET' && url.pathname === '/flows') return send(res, 200, listFlows())

    if (req.method === 'GET' && parts[0] === 'flows' && parts[1]) {
      const flow = readFlow(decodeURIComponent(parts[1]))
      if (flow == null) return send(res, 404, { error: 'That flow file isn’t in the flows folder.' })
      return send(res, 200, flow)
    }

    // The app saves canvas changes back, so your agent reads what you changed.
    if (req.method === 'PUT' && parts[0] === 'flows' && parts[1]) {
      const saved = saveFlow(await readJson(req), decodeURIComponent(parts[1]))
      if (!saved.ok) return send(res, 400, { error: `The flow has a problem. ${saved.error}` })
      return send(res, 200, saved)
    }

    if (req.method === 'GET' && url.pathname === '/app-events') {
      const write: (e: AppEvent) => void = openEventStream(res)
      apps.add(write)
      req.on('close', () => apps.delete(write))
      return
    }

    // The MCP server calls this after your agent saves a flow.
    if (req.method === 'POST' && url.pathname === '/app-events') {
      const { file, open } = (await readJson(req)) as { file?: string; open?: boolean }
      if (!file) return send(res, 400, { error: 'Say which flow file.' })
      apps.forEach((write) => write({ type: 'flow-saved', file, open: open !== false }))
      return send(res, 200, { apps: apps.size })
    }

    if (req.method === 'POST' && url.pathname === '/runs') {
      if (!hasAnthropic()) return send(res, 400, { error: 'Add your Anthropic key in Settings first.' })
      const body = (await readJson(req)) as { flow?: unknown; streaks?: Record<string, number> }
      const parsed = parseFlow(body?.flow)
      if (!parsed.ok) return send(res, 400, { error: `The flow has a problem. ${parsed.error}` })
      const id = `live-${Date.now().toString(36)}-${++runCounter}`
      const run = new Run(id, parsed.flow, body.streaks ?? {}, WORKSPACE, makeClient(), scheduleSave, profileContext(readProfile()))
      runs.set(id, run)
      run.start().catch((error) => console.error(`Run ${id} crashed:`, error))
      return send(res, 200, { runId: id })
    }

    // What every run cost, newest first, from this runner and from before it was restarted.
    if (req.method === 'GET' && url.pathname === '/runs') {
      const all = [...[...stored.values()].map(summaryOf), ...[...runs.values()].map((r) => summarize(r.toStored()))]
      return send(res, 200, all.sort((a, b) => b.startedAt - a.startedAt))
    }

    // A run, as structured data for reviewing it. Works while it's going and after.
    if (req.method === 'GET' && parts[0] === 'runs' && parts[2] === 'report') {
      const record = runs.get(parts[1])?.toStored() ?? stored.get(parts[1])
      return record ? send(res, 200, buildReport(record)) : send(res, 404, { error: 'That run isn’t known to this runner.' })
    }

    const run = parts[0] === 'runs' ? runs.get(parts[1]) : undefined
    if (parts[0] === 'runs' && !run) {
      const old = stored.get(parts[1])
      if (old && req.method === 'GET' && parts[2] === 'events') {
        // A finished run replays what happened. The stream stays open, like a live one, so the browser doesn't keep reconnecting.
        const write = openEventStream(res)
        const from = nextEventIndex(req)
        old.events.slice(from).forEach((e, i) => write(e, from + i))
        return
      }
      if (old) return send(res, 409, { error: 'That run has ended.' })
      return send(res, 404, { error: 'That run isn’t known to this runner.' })
    }

    if (run && req.method === 'GET' && parts[2] === 'events') {
      // Each event carries its index, so a reconnecting EventSource gets only what it missed.
      // Replaying everything would add step_usage tokens and step_log lines twice.
      const write = openEventStream(res)
      const from = nextEventIndex(req)
      run.events.slice(from).forEach((e, i) => write(e, from + i))
      const unsubscribe = run.subscribe((e) => write(e, run.events.length - 1))
      req.on('close', unsubscribe)
      return
    }

    if (run && req.method === 'POST' && parts[2] === 'decide') {
      const { stepId, approve } = (await readJson(req)) as { stepId: string; approve: boolean }
      if (!run.decide(stepId, Boolean(approve))) return send(res, 409, { error: 'That step isn’t waiting for you anymore.' })
      return send(res, 200, { ok: true })
    }

    if (run && req.method === 'POST' && parts[2] === 'resolve') {
      const { stepId, action } = (await readJson(req)) as { stepId: string; action: Resolution }
      if (!RESOLUTIONS.includes(action)) return send(res, 400, { error: 'Say retry, skip or stop.' })
      if (!run.resolve(stepId, action)) return send(res, 409, { error: 'That step isn’t waiting for you anymore.' })
      return send(res, 200, { ok: true })
    }

    if (run && req.method === 'POST' && parts[2] === 'stop') {
      run.stop()
      return send(res, 200, { ok: true })
    }

    send(res, 404, { error: 'Not found.' })
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : 'Something went wrong in the runner.' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`OpenWove runner on http://localhost:${PORT}`)
  console.log(`Workspace: ${WORKSPACE}`)
  console.log(hasAnthropic() ? 'Anthropic: ready' : 'Anthropic: no key yet. Add one in the app’s Settings.')
})
