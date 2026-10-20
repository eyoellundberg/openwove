import '@xyflow/react/dist/style.css'
import { ReactFlowProvider } from '@xyflow/react'
import { BotIcon } from 'lucide-react'
import { RunnerNote } from '@/components/shared/mode-select'
import { Notice } from '@/components/shared/notice'
import { Button } from '@/components/ui/button'
import { useFlow } from '@/lib/store'
import { FlowCanvas } from './flow-canvas'

export function SetupView() {
  const dirty = useFlow((s) => s.dirty)
  const unsaved = useFlow((s) => s.unsaved)
  const agentSaved = useFlow((s) => s.agentSaved)
  const openAgentSaved = useFlow((s) => s.openAgentSaved)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 empty:hidden">
        <span className="text-xs text-waiting animate-in fade-in">{dirty && 'Changes apply on the next run'}</span>
        <RunnerNote />
      </div>
      <Notice />
      {agentSaved && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-running-subtle px-3 py-2 text-sm text-running animate-in fade-in slide-in-from-top-1"
        >
          <BotIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Your agent saved {agentSaved}.{' '}
            {unsaved ? 'Opening it replaces your unsaved changes.' : 'Opening it ends the run that’s going.'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => openAgentSaved(false)}>
            Not now
          </Button>
          <Button size="sm" onClick={() => openAgentSaved(true)}>
            Open it
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <ReactFlowProvider>
          <FlowCanvas />
        </ReactFlowProvider>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag a card next to another to run them at the same time, or between two to make it its own stage. Scroll or
        pinch to zoom.
      </p>
    </div>
  )
}
