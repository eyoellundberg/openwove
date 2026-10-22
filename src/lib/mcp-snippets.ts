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
