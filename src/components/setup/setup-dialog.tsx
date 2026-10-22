import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopy } from '@/hooks/use-copy'
import { mcpSnippets, setupPrompt } from '@/lib/mcp-snippets'
import { runner, type AgentSetup } from '@/lib/runner-client'
import { SETUP_PROMPT } from '@/lib/seed'
import { useFlow } from '@/lib/store'

const PASTE_STEPS = [
  'Paste this into Claude, ChatGPT or your coding agent, and change the first line to what you want done.',
  'Your agent writes a flow.json: the stages, which agent does each step, and their prompts.',
  'It appears under Flows here. Open any prompt to read or tweak it, then press Run.',
]

const CONNECT_STEPS = [
  'Paste the setup note below into your agent once. It adds OpenWove to itself. Claude Code can also do it in one click.',
  'Ask it for the work, e.g. “Set up a flow that turns my brief into a landing page.” In Claude Code you can also pick the set_up_flow prompt.',
  'The flow opens here as your agent saves it. Tweak it and press Save changes; your agent reads what you changed next time it looks.',
]

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, copy] = useCopy(text)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="rounded-lg border bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all select-all">
        {text}
      </pre>
    </div>
  )
}

/** Adds OpenWove to Claude Code for every folder, then says so. */
function ConnectClaudeCode() {
  const [state, setState] = useState<{ phase: 'idle' | 'busy' | 'done' } | { phase: 'failed'; error: string }>({ phase: 'idle' })
  const connect = async () => {
    setState({ phase: 'busy' })
    try {
      await runner.connectClaudeCode()
      setState({ phase: 'done' })
    } catch (e) {
      setState({ phase: 'failed', error: e instanceof Error ? e.message : 'Couldn’t connect.' })
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <Button onClick={connect} disabled={state.phase === 'busy' || state.phase === 'done'}>
          {state.phase === 'done' && <CheckIcon />}
          {state.phase === 'done' ? 'Connected to Claude Code' : state.phase === 'busy' ? 'Connecting…' : 'Connect Claude Code'}
        </Button>
        {state.phase === 'done' && <span className="text-sm text-muted-foreground">Start a new Claude Code session to use it.</span>}
      </div>
      {state.phase === 'failed' && <p className="text-sm text-failed">{state.error}</p>}
    </div>
  )
}

export function SetupDialog() {
  const open = useFlow((s) => s.setupOpen)
  const request = useFlow((s) => s.request)
  const openSetup = useFlow((s) => s.openSetup)
  const status = useFlow((s) => s.runnerStatus)
  const prompt = SETUP_PROMPT(request || 'Describe the work you want done here.')
  const ready = status.state === 'ready'
  const [agent, setAgent] = useState<AgentSetup | null>(null)
  useEffect(() => {
    if (open && ready) runner.agent().then(setAgent, () => setAgent(null))
  }, [open, ready])
  const snippets = agent && mcpSnippets(agent)

  return (
    <Dialog open={open} onOpenChange={openSetup}>
      <DialogContent className="max-h-svh overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Set up a flow with your agent</DialogTitle>
          <DialogDescription>
            You don’t build flows by hand. You describe what you want, and your agent fills in the steps and prompts.
            This is where you see and tweak what it set up.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="connect" className="min-w-0">
          <TabsList>
            <TabsTrigger value="connect">Connect your agent</TabsTrigger>
            <TabsTrigger value="paste">Paste a prompt</TabsTrigger>
          </TabsList>
          <TabsContent value="connect" className="flex min-w-0 flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
              {CONNECT_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {agent && snippets ? (
              <>
                <CopyBlock label="Paste this to your agent" text={setupPrompt(agent)} />
                {agent.claudeCode && <ConnectClaudeCode />}
                <CopyBlock label="Or add it by hand: MCP config for Claude Desktop, Cursor and others" text={snippets.json} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Start the runner (npm run runner) to get the connection details for your agent.</p>
            )}
            <p className="text-xs text-muted-foreground">Keep OpenWove open so flows appear here as your agent saves them.</p>
          </TabsContent>
          <TabsContent value="paste" className="flex min-w-0 flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
              {PASTE_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <CopyBlock label="Prompt" text={prompt} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
