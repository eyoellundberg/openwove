/** How an agent is pointed at the MCP server. The app fills in your real folder once the runner says where it is. */
export const PLACEHOLDER_ROOT = '/path/to/OpenWove'

export function mcpSnippets(root = PLACEHOLDER_ROOT) {
  const command = `${root}/node_modules/.bin/tsx`
  const script = `${root}/runner/mcp.ts`
  return {
    claudeCode: `claude mcp add openwove -- ${command} ${script}`,
    json: JSON.stringify({ mcpServers: { openwove: { command, args: [script] } } }, null, 2),
  }
}
