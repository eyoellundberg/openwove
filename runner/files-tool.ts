/**
 * The `files` tool: the official filesystem MCP server, limited to the workspace folder.
 * One server process is shared by every run.
 */
import { createRequire } from 'node:module'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type Anthropic from '@anthropic-ai/sdk'

/** Calls that change files. A step that needs approval pauses before its first one. */
export const ACTING_TOOLS = new Set(['write_file', 'edit_file', 'move_file'])

export interface FilesTool {
  tools: Anthropic.Beta.BetaTool[]
  call: (name: string, input: unknown) => Promise<{ text: string; isError: boolean }>
}

let connecting: Promise<FilesTool> | null = null

export function filesTool(workspace: string): Promise<FilesTool> {
  connecting ??= connect(workspace).catch((error) => {
    connecting = null
    throw error
  })
  return connecting
}

async function connect(workspace: string): Promise<FilesTool> {
  const require = createRequire(import.meta.url)
  // The packaged app ships the file server as one bundled file and says where it is.
  const server = process.env.OPENWOVE_FILES_SERVER ?? require.resolve('@modelcontextprotocol/server-filesystem/dist/index.js')
  const transport = new StdioClientTransport({ command: process.execPath, args: [server, workspace], cwd: workspace })
  const client = new Client({ name: 'openwove-runner', version: '0.1.0' })
  await client.connect(transport)
  const { tools } = await client.listTools()

  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description ?? t.name,
      input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
    })),
    call: async (name, input) => {
      const result = await client.callTool({ name, arguments: input as Record<string, unknown> })
      const content = Array.isArray(result.content) ? result.content : []
      const text = content
        .map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text : `[${c.type}]`))
        .join('\n')
      return { text: text || '(no output)', isError: Boolean(result.isError) }
    },
  }
}
