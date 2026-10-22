/**
 * The OpenWove MCP server: `npm run mcp`, started by the person's own agent (Claude Code,
 * Claude Desktop, Cursor…). The agent sets up flows with these tools; the app shows them.
 * It talks over stdio, so nothing here may write to stdout except the protocol.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { FlowFileSchema, parseFlow } from '../src/lib/flow-file'
import { buildReport, REPORT_STATUSES, RunReportSchema } from '../src/lib/run-report'
import { SCHEMA_NAMES, schemaJson } from '../src/lib/schemas'
import { flowWarnings, listFlows, readFlow, RUNNER_PORT, saveFlow, WORKSPACE } from './flows'
import { readRuns } from './run-store'

/** The builder skill, without its frontmatter, plus how it works over this connection. */
function guide(): string {
  // From source the skill is in the repo; in the packaged app it ships beside this file.
  const file = ['../skills', 'skills'].map((d) => join(import.meta.dirname, d, 'openwove-builder/SKILL.md')).find(existsSync)
  const skill = readFileSync(file!, 'utf8').replace(/^---[\s\S]*?---\s*/, '')
  return `${skill}
## Over this connection

- Save with the \`save_flow\` tool instead of writing the file and running check-flow. It checks the flow and tells you what to fix.
- Use \`get_schema\` for the JSON Schema of the flow file, and \`check_flow\` to validate a draft without saving.
- \`save_flow\` opens the flow on the canvas if the app is open. Its answer says what happened; pass that on to the person.
- To change a flow the person already has, read it with \`get_flow\` first. They may have edited it on the canvas.
- To review how a run went, use \`list_runs\` and \`get_run\`. The report says what each step did, what it asked the person, and what it cost.
- The person's workspace folder is ${WORKSPACE}. Real runs read and write only there.
`
}

const text = (t: string, isError = false) => ({ content: [{ type: 'text' as const, text: t }], isError })

/** Ask the runner to show a flow in any open app window. Never throws: the app may simply be closed. */
async function showInApp(file: string, open: boolean): Promise<string> {
  try {
    const res = await fetch(`http://127.0.0.1:${RUNNER_PORT}/app-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, open }),
    })
    const { apps } = (await res.json()) as { apps: number }
    if (apps === 0) return 'The OpenWove app isn’t open. The person can open it and find the flow under Flows.'
    if (!open) return 'The app shows it under Flows.'
    return 'The OpenWove app is showing it. If the person has unsaved changes or a run going, the app asks them first.'
  } catch {
    return 'The OpenWove runner isn’t running, so the app couldn’t be told. Ask the person to start it with `npm run runner`; the flow will be under Flows.'
  }
}

const server = new McpServer(
  { name: 'openwove', version: '0.1.0' },
  {
    instructions:
      'OpenWove shows multi-agent flows on a canvas so a person can see, tweak and run them. When the person asks for work split across several agents, read get_guide, then save the flow with save_flow. Don’t run flows yourself; the person runs them from the app.',
  },
)

server.registerPrompt(
  'set_up_flow',
  {
    title: 'Set up a flow',
    description: 'Turn a request into a multi-agent flow and show it in OpenWove.',
    argsSchema: { request: z.string().describe('What you want done, in your own words.') },
  },
  ({ request }) => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `${guide()}\n## The request\n\n${request}` },
      },
    ],
  }),
)

/** A tool result an agent can parse: the data itself, plus the same as text for agents that only read text. */
const data = <T extends Record<string, unknown>>(value: T, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
  isError,
})

const readOnly = { readOnlyHint: true }
const flowProblems = z.array(z.string()).describe('What to fix, one per line. Empty when the flow is fine.')
const flowWarnings_ = z.array(z.string()).describe('Things that are valid but won’t do what you probably expect in a real run.')

server.registerTool(
  'get_guide',
  {
    title: 'How to write a flow',
    description: 'The flow file format, how to pick agents and models, and when to ask before acting. Read it before your first save_flow.',
    annotations: readOnly,
  },
  () => text(guide()),
)

server.registerTool(
  'get_schema',
  {
    title: 'Get a JSON Schema',
    description:
      'The JSON Schema for what you write ("flow") or what you read back from a run ("run-report"). Use it to check your output before calling save_flow, or to understand get_run.',
    inputSchema: { name: z.enum(SCHEMA_NAMES).describe('"flow" is the flow file. "run-report" is what get_run returns.') },
    outputSchema: z.looseObject({}),
    annotations: readOnly,
  },
  ({ name }) => data(schemaJson(name)),
)

server.registerTool(
  'list_flows',
  {
    title: 'List flows',
    description: 'The flows in the person’s flows folder, by file and name.',
    outputSchema: { flows: z.array(z.object({ file: z.string(), name: z.string() })) },
    annotations: readOnly,
  },
  () => data({ flows: listFlows() }),
)

server.registerTool(
  'get_flow',
  {
    title: 'Read a flow',
    description: 'A flow file as it is now, including any changes the person made on the canvas. Check it against the "flow" schema.',
    inputSchema: { file: z.string().describe('The file name from list_flows, e.g. "landing-page.json".') },
    outputSchema: { file: z.string(), flow: z.looseObject({}).describe('The file as it is. It follows the "flow" schema unless the person broke it by hand.') },
    annotations: readOnly,
  },
  ({ file }) => {
    const flow = readFlow(file)
    return flow == null ? text(`There’s no ${file} in the flows folder.`, true) : data({ file, flow: flow as Record<string, unknown> })
  },
)

server.registerTool(
  'check_flow',
  {
    title: 'Check a flow without saving',
    description: 'Run every check save_flow would, without saving or showing anything. Use it while you draft.',
    inputSchema: { flow: z.looseObject({}).describe('The flow, as described by get_schema("flow").') },
    outputSchema: { ok: z.boolean(), problems: flowProblems, warnings: flowWarnings_ },
    annotations: readOnly,
  },
  ({ flow }) => {
    const parsed = parseFlow(flow)
    return parsed.ok
      ? data({ ok: true, problems: [], warnings: flowWarnings(parsed.flow) })
      : data({ ok: false, problems: parsed.error.split('\n'), warnings: [] })
  },
)

server.registerTool(
  'save_flow',
  {
    title: 'Save a flow',
    description:
      'Check a flow and save it to the flows folder, then show it in the OpenWove app. If it has a problem, nothing is saved and you get what to fix.',
    inputSchema: {
      flow: FlowFileSchema.describe('The flow. See get_guide for how to split work into stages and pick models.'),
      file: z
        .string()
        .optional()
        .describe('File name to save as, e.g. "launch-email.json". Leave out to name it after the flow. Saving to an existing name replaces it.'),
      open: z.boolean().optional().describe('Open it in the app. Defaults to true.'),
    },
    outputSchema: {
      saved: z.boolean(),
      file: z.string().optional().describe('The file it was saved as, inside flows/.'),
      app: z.string().optional().describe('Whether the app is showing it. Pass this on to the person.'),
      problems: flowProblems,
      warnings: flowWarnings_,
    },
  },
  async ({ flow, file, open }) => {
    const result = saveFlow(flow, file)
    if (!result.ok) return data({ saved: false, problems: result.error.split('\n'), warnings: [] }, true)
    return data({ saved: true, file: result.file, app: await showInApp(result.file, open !== false), problems: [], warnings: result.warnings })
  },
)

server.registerTool(
  'open_flow',
  {
    title: 'Show a flow',
    description: 'Open a flow from the flows folder in the OpenWove app.',
    inputSchema: { file: z.string().describe('The file name from list_flows.') },
  },
  async ({ file }) => {
    if (readFlow(file) == null) return text(`There’s no ${file} in the flows folder.`, true)
    return text(await showInApp(file, true))
  },
)

server.registerTool(
  'list_runs',
  {
    title: 'List runs',
    description: 'Runs the person has made, newest first, with their status and cost. Use get_run to read one.',
    inputSchema: { limit: z.int().min(1).max(100).optional().describe('How many to return. Defaults to 20.') },
    outputSchema: {
      runs: z.array(
        z.object({
          runId: z.string().describe('Pass it to get_run.'),
          flow: z.string().describe('The flow’s name.'),
          status: z.enum(REPORT_STATUSES).describe('"waiting": a step is waiting for the person.'),
          startedAt: z.string().describe('ISO 8601 time.'),
          costUsd: z.number().describe('What it has cost so far, in US dollars.'),
        }),
      ),
    },
    annotations: readOnly,
  },
  ({ limit }) => {
    const runs = readRuns()
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit ?? 20)
      .map((run) => {
        const report = buildReport(run)
        return { runId: report.runId, flow: report.flow.name, status: report.status, startedAt: report.startedAt, costUsd: report.cost.usd }
      })
    return data({ runs })
  },
)

server.registerTool(
  'get_run',
  {
    title: 'Review a run',
    description:
      'What a run did, step by step: each step’s status, what the agent said it did, the files it touched, whether and what it asked the person, what went wrong, and what it cost. Follows the "run-report" schema. Use it to check the work and suggest changes to the flow.',
    inputSchema: { runId: z.string().describe('From list_runs.') },
    outputSchema: RunReportSchema,
    annotations: readOnly,
  },
  ({ runId }) => {
    const run = readRuns().find((r) => r.id === runId)
    return run ? data(buildReport(run)) : text(`There’s no run ${runId}. list_runs shows the ones there are.`, true)
  },
)

await server.connect(new StdioServerTransport())
