import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, DragDropVerticalIcon, MoreHorizontalIcon, Note01Icon } from '@hugeicons/core-free-icons'
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AgentAvatar } from '@/components/shared/agent-avatar'
import { StatusDot } from '@/components/shared/status-dot'
import { ToolIcons } from '@/components/shared/tool-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { APPROVAL_LABEL, RUNNABLE_TOOLS, findAgent, toolInfo } from '@/lib/catalog'
import { EARN_AFTER } from '@/lib/constants'
import { askChance } from '@/lib/engine'
import { modelInfo } from '@/lib/models'
import { stepStatusLine } from '@/lib/status'
import { agentPatch, useFlow } from '@/lib/store'
import type { Approval, Step } from '@/lib/types'
import { cn } from '@/lib/utils'

export type StepNodeType = Node<{ stepId: string; number: number }, 'step'>

function trustLine(step: Step) {
  if (step.approval !== 'earned') return null
  if (step.streak < EARN_AFTER) {
    return `Asks every time until you’ve approved ${EARN_AFTER} in a row (${step.streak} so far).`
  }
  return `Approved ${step.streak}× in a row. Now asks about ${Math.round(askChance(step.streak) * 100)}% of the time.`
}

function StepNodeView({ data }: NodeProps<StepNodeType>) {
  const step = useFlow((s) => s.steps.find((x) => x.id === data.stepId))
  const agents = useFlow((s) => s.agents)
  const realMode = useFlow((s) => s.mode === 'real')
  const canRemove = useFlow((s) => s.steps.length > 1)
  const status = useFlow(
    useShallow((s) => {
      const task = s.dirty ? undefined : s.tasks.find((t) => t.runId === s.runId && t.stepId === data.stepId)
      return { state: task?.state, taskId: task?.id, line: stepStatusLine(task, s.simT) }
    }),
  )
  const updateStep = useFlow((s) => s.updateStep)
  const removeStep = useFlow((s) => s.removeStep)
  const openPrompt = useFlow((s) => s.openPrompt)
  const decide = useFlow((s) => s.decide)

  if (!step) return null
  const agent = findAgent(agents, step.agent)
  const model = modelInfo(agent.model, agent.provider)
  const trust = trustLine(step)
  const unconnected = realMode ? step.tools.filter((t) => !RUNNABLE_TOOLS.has(t)) : []

  return (
    <Card
      size="sm"
      data-state={status.state}
      className={cn(
        'w-72 shadow-sm transition-shadow duration-300',
        'data-[state=running]:ring-2 data-[state=running]:ring-running/50',
        'data-[state=waiting]:ring-2 data-[state=waiting]:ring-waiting',
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="opacity-0" />

      <CardHeader className="flex items-center gap-2">
        <HugeiconsIcon icon={DragDropVerticalIcon} className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
        <span className="w-5 font-mono text-xs text-muted-foreground tabular-nums">
          {String(data.number).padStart(2, '0')}
        </span>
        <AgentAvatar agent={step.agent} size="sm" />
        <Select
          value={step.agent}
          onValueChange={(v) => updateStep(step.id, agentPatch(findAgent(agents, v)))}
        >
          <SelectTrigger size="sm" className="nodrag min-w-0 flex-1 font-medium" aria-label="Agent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="nodrag" aria-label={`More for step ${data.number}`}>
              <HugeiconsIcon icon={MoreHorizontalIcon} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openPrompt(step.id)}>
              <HugeiconsIcon icon={Note01Icon} />
              View and edit prompt
            </DropdownMenuItem>
            {canRemove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => removeStep(step.id)}>
                  <HugeiconsIcon icon={Delete02Icon} />
                  Remove step
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Input
          value={step.task}
          onChange={(e) => updateStep(step.id, { task: e.target.value, log: undefined, gateText: undefined })}
          className="nodrag font-medium"
          aria-label="What this step does"
          placeholder="What should it do?"
        />
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {model.label} · {agent.effort} effort
            {step.promptEdited && ' · prompt edited'}
          </span>
          <ToolIcons tools={step.tools} />
        </div>
        {unconnected.length > 0 && (
          <p className="text-xs text-waiting animate-in fade-in">
            Not connected for real runs: {unconnected.map((t) => toolInfo(t).name).join(', ')}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${step.id}-approval`} className="text-xs text-muted-foreground">
            Before it acts
          </Label>
          <Select
            value={step.approval}
            onValueChange={(v) => updateStep(step.id, { approval: v as Approval, streak: 0 })}
          >
            <SelectTrigger
              id={`${step.id}-approval`}
              size="sm"
              data-approval={step.approval}
              className="nodrag w-full data-[approval=always]:border-waiting data-[approval=always]:text-waiting data-[approval=earned]:border-earned data-[approval=earned]:text-earned"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(APPROVAL_LABEL) as Approval[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {APPROVAL_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {trust && <p className="text-xs text-muted-foreground animate-in fade-in">{trust}</p>}
        </div>
      </CardContent>

      <CardFooter
        data-state={status.state}
        className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground tabular-nums data-[state=running]:text-running data-[state=waiting]:text-waiting data-[state=denied]:text-failed data-[state=failed]:text-failed data-[state=skipped]:text-failed"
      >
        <StatusDot state={status.state} />
        <span className="truncate">{status.line}</span>
        {status.state === 'waiting' && status.taskId && (
          <Button size="xs" className="nodrag ml-auto animate-in zoom-in-95" onClick={() => decide(status.taskId!, true)}>
            Approve
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export const StepNode = memo(StepNodeView)
