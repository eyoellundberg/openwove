import { useState } from 'react'
import { AgentAvatar } from '@/components/shared/agent-avatar'
import { ToolIcons } from '@/components/shared/tool-icons'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_BY_ID, APPROVAL_LABEL, TOOLS } from '@/lib/catalog'
import { useFlow } from '@/lib/store'
import type { Step } from '@/lib/types'

export function PromptDialog() {
  const step = useFlow((s) => s.steps.find((x) => x.id === s.promptStepId))
  const openPrompt = useFlow((s) => s.openPrompt)

  return (
    <Dialog open={!!step} onOpenChange={(open) => !open && openPrompt(null)}>
      <DialogContent className="sm:max-w-xl">{step && <PromptEditor key={step.id} step={step} />}</DialogContent>
    </Dialog>
  )
}

function PromptEditor({ step }: { step: Step }) {
  const [draft, setDraft] = useState(step.prompt)
  const savePrompt = useFlow((s) => s.savePrompt)
  const openPrompt = useFlow((s) => s.openPrompt)
  const agent = AGENT_BY_ID[step.agent]

  const save = () => {
    const next = draft.trim()
    if (next && next !== step.prompt) savePrompt(step.id, next)
    openPrompt(null)
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3">
        <AgentAvatar agent={step.agent} />
        <div className="flex flex-col gap-0.5">
          <DialogTitle>{step.task || 'Untitled step'}</DialogTitle>
          <DialogDescription>
            {agent.name} · {agent.model}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt-text">Prompt</Label>
        <Textarea
          id="prompt-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-48 font-mono text-sm leading-relaxed"
          autoFocus
        />
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-4">
          <dt className="w-28 shrink-0 text-muted-foreground">Can use</dt>
          <dd className="flex items-center gap-2">
            <ToolIcons tools={step.tools} />
            {step.tools.map((t) => TOOLS[t].name).join(', ')}
          </dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="w-28 shrink-0 text-muted-foreground">Before it acts</dt>
          <dd>{APPROVAL_LABEL[step.approval]}</dd>
        </div>
      </dl>

      <DialogFooter className="items-center">
        <p className="mr-auto text-xs text-muted-foreground">
          Your agent wrote this. Edit it like a message to a colleague.
        </p>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={save}>Save prompt</Button>
      </DialogFooter>
    </>
  )
}
