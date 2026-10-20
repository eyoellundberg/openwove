/** The local runner: `npm run runner`. The app reaches it through Vite's /api proxy. */
import { existsSync, mkdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { RUNNABLE_TOOLS } from '../src/lib/catalog'
import { parseFlow } from '../src/lib/flow-file'
import { listFlows, readFlow, ROOT, RUNNER_PORT as PORT, saveFlow, WORKSPACE } from './flows'
import { type AppEvent, RESOLUTIONS, type Resolution, type RunnerHealth } from '../src/lib/runner-types'
import { summarize, type StoredRun } from '../src/lib/usage'
import { API_TRIES, Run } from './run'
import { loadRuns, saveRun } from './run-store'
import { claudeStatus } from './status'

if (existsSync(join(ROOT, '.env.local'))) process.loadEnvFile(join(ROOT, '.env.local'))
mkdirSync(WORKSPACE, { recursive: true })

const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
const client = hasAnthropic ? new Anthropic({ maxRetries: API_TRIES - 1 }) : null
const runs = new Map<string, Run>()
/** Runs saved by an earlier runner, or by this one before it was restarted. */
const stored = new Map<string, StoredRun>(loadRuns().map((r) => [r.id, r]))
let runCounter = 0

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
  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const health: RunnerHealth = {
        providers: { anthropic: hasAnthropic, openai: false, google: false },
        tools: [...RUNNABLE_TOOLS],
        workspace: WORKSPACE,
        root: ROOT,
      }
      return send(res, 200, health)
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
      if (!client) return send(res, 400, { error: 'Add ANTHROPIC_API_KEY to .env.local and restart the runner.' })
      const body = (await readJson(req)) as { flow?: unknown; streaks?: Record<string, number> }
      const parsed = parseFlow(body?.flow)
      if (!parsed.ok) return send(res, 400, { error: `The flow has a problem. ${parsed.error}` })
      const id = `live-${Date.now().toString(36)}-${++runCounter}`
      const run = new Run(id, parsed.flow, body.streaks ?? {}, WORKSPACE, client, (r) => saveRun(r.toStored()))
      runs.set(id, run)
      run.start().catch((error) => console.error(`Run ${id} crashed:`, error))
      return send(res, 200, { runId: id })
    }

    // What every run cost, newest first, from this runner and from before it was restarted.
    if (req.method === 'GET' && url.pathname === '/runs') {
      const all = new Map(stored)
      runs.forEach((r) => all.set(r.id, r.toStored()))
      return send(res, 200, [...all.values()].map(summarize).sort((a, b) => b.startedAt - a.startedAt))
    }

    const run = parts[0] === 'runs' ? runs.get(parts[1]) : undefined
    if (parts[0] === 'runs' && !run) {
      const old = stored.get(parts[1])
      if (old && req.method === 'GET' && parts[2] === 'events') {
        // A finished run replays what happened. The stream stays open, like a live one, so the browser doesn't keep reconnecting.
        const write = openEventStream(res)
        old.events.forEach((e) => write(e))
        return
      }
      if (old) return send(res, 409, { error: 'That run has ended.' })
      return send(res, 404, { error: 'That run isn’t known to this runner.' })
    }

    if (run && req.method === 'GET' && parts[2] === 'events') {
      // Each event carries its index, so a reconnecting EventSource gets only what it missed.
      // Replaying everything would add step_usage tokens and step_log lines twice.
      const write = openEventStream(res)
      const from = Number(req.headers['last-event-id'] ?? -1) + 1
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
  console.log(hasAnthropic ? 'Anthropic: ready' : 'Anthropic: no key. Add ANTHROPIC_API_KEY to .env.local.')
})
