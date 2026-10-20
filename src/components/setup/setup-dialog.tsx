import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
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
import { SETUP_PROMPT } from '@/lib/seed'
import { useFlow } from '@/lib/store'

const PASTE_STEPS = [
  'Paste this into Claude, ChatGPT or your coding agent, and change the first line to what you want done.',
  'Your agent writes a flow.json: the stages, which agent does each step, and their prompts.',
  'It appears under Flows here. Open any prompt to read or tweak it, then press Run.',
]

const CONNECT_STEPS = [
  'Add OpenWove to your agent once, with one of the snippets below.',
  'Ask it for the work, e.g. “Set up a flow that turns my brief into a landing page.” In Claude Code you can also pick the set_up_flow prompt.',
  'The flow opens here as your agent saves it. Tweak it and press Save changes; your agent reads what you changed next time it looks.',
]

const PLACEHOLDER_ROOT = '/path/to/OpenWove'

function mcpSnippets(root: string) {
  const command = `${root}/node_modules/.bin/tsx`
  const script = `${root}/runner/mcp.ts`
  return {
    claudeCode: `claude mcp add openwove -- ${command} ${script}`,
    json: JSON.stringify({ mcpServers: { openwove: { command, args: [script] } } }, null, 2),
  }
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
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

export function SetupDialog() {
  const open = useFlow((s) => s.setupOpen)
  const request = useFlow((s) => s.request)
  const openSetup = useFlow((s) => s.openSetup)
  const status = useFlow((s) => s.runnerStatus)
  const prompt = SETUP_PROMPT(request || 'Describe the work you want done here.')
  const root = status.state === 'ready' ? status.health.root : PLACEHOLDER_ROOT
  const snippets = mcpSnippets(root)

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
            <CopyBlock label="Claude Code" text={snippets.claudeCode} />
            <CopyBlock label="Claude Desktop, Cursor and other agents (MCP config)" text={snippets.json} />
            <p className="text-xs text-muted-foreground">
              {status.state === 'ready'
                ? 'Keep the runner going (npm run runner) so flows open here as your agent saves them.'
                : `Start the runner (npm run runner) to fill in your folder instead of ${PLACEHOLDER_ROOT}.`}
            </p>
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
