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
import { FlowFileSchema } from '../src/lib/flow-file'
import { listFlows, readFlow, RUNNER_PORT, saveFlow, WORKSPACE } from './flows'

/** The builder skill, without its frontmatter, plus how it works over this connection. */
function guide(): string {
  // From source the skill is in the repo; in the packaged app it ships beside this file.
  const file = ['../skills', 'skills'].map((d) => join(import.meta.dirname, d, 'openwove-builder/SKILL.md')).find(existsSync)
  const skill = readFileSync(file!, 'utf8').replace(/^---[\s\S]*?---\s*/, '')
  return `${skill}
## Over this connection

- Save with the \`save_flow\` tool instead of writing the file and running check-flow. It checks the flow and tells you what to fix.
- \`save_flow\` opens the flow on the canvas if the app is open. Its answer says what happened; pass that on to the person.
- To change a flow the person already has, read it with \`get_flow\` first. They may have edited it on the canvas.
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

server.registerTool(
  'get_guide',
  {
    title: 'How to write a flow',
    description: 'The flow file format, how to pick agents and models, and when to ask before acting. Read it before your first save_flow.',
    annotations: { readOnlyHint: true },
  },
  () => text(guide()),
)

server.registerTool(
  'list_flows',
  {
    title: 'List flows',
    description: 'The flows in the person’s flows folder, by file and name.',
    annotations: { readOnlyHint: true },
  },
  () => text(JSON.stringify(listFlows(), null, 2)),
)

server.registerTool(
  'get_flow',
  {
    title: 'Read a flow',
    description: 'A flow file as it is now, including any changes the person made on the canvas.',
    inputSchema: { file: z.string().describe('The file name from list_flows, e.g. "landing-page.json".') },
    annotations: { readOnlyHint: true },
  },
  ({ file }) => {
    const flow = readFlow(file)
    return flow == null ? text(`There’s no ${file} in the flows folder.`, true) : text(JSON.stringify(flow, null, 2))
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
  },
  async ({ flow, file, open }) => {
    const saved = saveFlow(flow, file)
    if (!saved.ok) return text(`Not saved. Fix these and save again:\n${saved.error}`, true)
    const notes = saved.warnings.map((w) => `\nNote: ${w}`).join('')
    return text(`Saved flows/${saved.file}. ${await showInApp(saved.file, open !== false)}${notes}`)
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

await server.connect(new StdioServerTransport())
