/** Pointing an agent at the MCP server: how to start it, and connecting Claude Code for the person. */
import { execFile, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { AgentSetup } from '../src/lib/runner-types'
import { ROOT } from './flows'

const run = promisify(execFile)
const CONNECT_TIMEOUT_MS = 30_000
/** Beside the packaged runner, there's a bundled MCP server and the Node that runs it. */
const BUNDLED_MCP = join(import.meta.dirname, 'mcp.mjs')

/** Where `claude` usually lives. An app started from the Dock doesn't get the shell's PATH, so look in these first. */
const CLAUDE_PLACES = ['.local/bin/claude', '.claude/local/claude', '.npm-global/bin/claude'].map((p) => join(homedir(), p)).concat(['/opt/homebrew/bin/claude', '/usr/local/bin/claude'])

function findClaude(): string | null {
  const known = CLAUDE_PLACES.find(existsSync)
  if (known) return known
  try {
    // Last try: ask the person's own shell, which knows their PATH.
    return execFileSync('/bin/zsh', ['-lc', 'command -v claude'], { encoding: 'utf8', timeout: 5000 }).trim() || null
  } catch {
    return null
  }
}

export function agentSetup(): AgentSetup {
  const packaged = existsSync(BUNDLED_MCP)
  return {
    command: packaged ? process.execPath : join(ROOT, 'node_modules/.bin/tsx'),
    args: [packaged ? BUNDLED_MCP : join(ROOT, 'runner/mcp.ts')],
    env: packaged ? { OPENWOVE_HOME: ROOT } : {},
    claudeCode: findClaude() != null,
  }
}

/** Adds OpenWove to Claude Code for every folder. Returns what went wrong, or null. */
export async function connectClaudeCode(): Promise<string | null> {
  const claude = findClaude()
  if (!claude) return 'Couldn’t find Claude Code on this computer. Use the snippet below instead.'
  const { command, args, env } = agentSetup()
  const options = { timeout: CONNECT_TIMEOUT_MS }
  // Replace an older entry, e.g. from before the app moved. It's fine if there wasn't one.
  await run(claude, ['mcp', 'remove', '--scope', 'user', 'openwove'], options).catch(() => {})
  try {
    const envFlags = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`])
    await run(claude, ['mcp', 'add', '--scope', 'user', 'openwove', ...envFlags, '--', command, ...args], options)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Claude Code wouldn’t add it: ${message.split('\n')[0]}`
  }
}
