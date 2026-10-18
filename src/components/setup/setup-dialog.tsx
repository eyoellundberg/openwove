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
import { SETUP_PROMPT } from '@/lib/seed'
import { useFlow } from '@/lib/store'

const STEPS = [
  'Paste this into Claude, ChatGPT or your coding agent, and change the first line to what you want done.',
  'Your agent writes a flow.json: the stages, which agent does each step, and their prompts.',
  'It appears under Flows here. Open any prompt to read or tweak it, then press Run.',
]

export function SetupDialog() {
  const open = useFlow((s) => s.setupOpen)
  const request = useFlow((s) => s.request)
  const prompt = SETUP_PROMPT(request || 'Describe the work you want done here.')
  const openSetup = useFlow((s) => s.openSetup)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        openSetup(next)
        if (!next) setCopied(false)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Set up a flow with your agent</DialogTitle>
          <DialogDescription>
            You don’t build flows by hand. You describe what you want, and your agent fills in the steps and prompts.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <pre className="rounded-lg border bg-muted p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap select-all">
          {prompt}
        </pre>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
