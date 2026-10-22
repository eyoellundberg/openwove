import type { AgentSetup } from './runner-types'

/** Quotes a path for the shell only if it needs it. */
const quote = (s: string) => (/^[\w./@:=+-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`)

/** How an agent is pointed at the MCP server, with the real paths the runner reported. */
export function mcpSnippets({ command, args, env }: AgentSetup) {
  const envFlags = Object.entries(env).map(([k, v]) => `-e ${quote(`${k}=${v}`)}`)
  return {
    claudeCode: ['claude mcp add --scope user openwove', ...envFlags, '--', quote(command), ...args.map(quote)].join(' '),
    json: JSON.stringify({ mcpServers: { openwove: { command, args, ...(Object.keys(env).length ? { env } : {}) } } }, null, 2),
  }
}

/** What to paste to any agent so it adds OpenWove to itself. */
export function setupPrompt(setup: AgentSetup) {
  const { claudeCode } = mcpSnippets(setup)
  const env = Object.entries(setup.env).map(([k, v]) => `${k}=${v}`)
  return `Please add OpenWove to yourself. OpenWove is a Mac app that shows multi-agent flows on a canvas, and it comes with an MCP server for you.

Add this MCP server for every project, not only this one:
- name: openwove
- command: ${setup.command}
- args: ${setup.args.join(' ')}${env.length ? `\n- env: ${env.join(', ')}` : ''}

If you are Claude Code, run:
${claudeCode}

Otherwise add the equivalent to your own MCP config. Then restart or reload so the tools show up, and tell me once you can see them (get_guide, list_flows, get_flow, save_flow, open_flow). Don't run anything else yet.`
}
