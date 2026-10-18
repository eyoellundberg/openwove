/** The local runner: `npm run runner`. The app reaches it through Vite's /api proxy. */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { basename, join, resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { parseFlow } from '../src/lib/flow-file'
import { Run } from './run'

const PORT = Number(process.env.RUNNER_PORT ?? 5189)
const ROOT = resolve(import.meta.dirname, '..')
const FLOWS = join(ROOT, 'flows')
const WORKSPACE = join(ROOT, 'workspace')

if (existsSync(join(ROOT, '.env.local'))) process.loadEnvFile(join(ROOT, '.env.local'))
mkdirSync(WORKSPACE, { recursive: true })

const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
const client = hasAnthropic ? new Anthropic() : null
const runs = new Map<string, Run>()
let runCounter = 0

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
}

function listFlows() {
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, {
        providers: { anthropic: hasAnthropic, openai: false, google: false },
        tools: ['files'],
        workspace: WORKSPACE,
      })
    }

    if (req.method === 'GET' && url.pathname === '/flows') return send(res, 200, listFlows())

    if (req.method === 'GET' && parts[0] === 'flows' && parts[1]) {
      const file = join(FLOWS, basename(decodeURIComponent(parts[1])))
      if (!existsSync(file)) return send(res, 404, { error: 'That flow file isn’t in the flows folder.' })
      return send(res, 200, JSON.parse(readFileSync(file, 'utf8')))
    }

    if (req.method === 'POST' && url.pathname === '/runs') {
      if (!client) return send(res, 400, { error: 'Add ANTHROPIC_API_KEY to .env.local and restart the runner.' })
      const body = (await readJson(req)) as { flow?: unknown; streaks?: Record<string, number> }
      const parsed = parseFlow(body?.flow)
      if (!parsed.ok) return send(res, 400, { error: `The flow has a problem. ${parsed.error}` })
      const id = `live-${Date.now().toString(36)}-${++runCounter}`
      const run = new Run(parsed.flow, body.streaks ?? {}, WORKSPACE, client)
      runs.set(id, run)
      run.start().catch((error) => console.error(`Run ${id} crashed:`, error))
      return send(res, 200, { runId: id })
    }

    const run = parts[0] === 'runs' ? runs.get(parts[1]) : undefined
    if (parts[0] === 'runs' && !run) return send(res, 404, { error: 'That run isn’t known to this runner. It may have restarted.' })

    if (run && req.method === 'GET' && parts[2] === 'events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      const write = (e: unknown) => res.write(`data: ${JSON.stringify(e)}\n\n`)
      run.events.forEach(write)
      const unsubscribe = run.subscribe(write)
      req.on('close', unsubscribe)
      return
    }

    if (run && req.method === 'POST' && parts[2] === 'decide') {
      const { stepId, approve } = (await readJson(req)) as { stepId: string; approve: boolean }
      if (!run.decide(stepId, Boolean(approve))) return send(res, 409, { error: 'That step isn’t waiting for you anymore.' })
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

server.listen(PORT, () => {
  console.log(`Agent Flow runner on http://localhost:${PORT}`)
  console.log(`Workspace: ${WORKSPACE}`)
  console.log(hasAnthropic ? 'Anthropic: ready' : 'Anthropic: no key. Add ANTHROPIC_API_KEY to .env.local.')
})
