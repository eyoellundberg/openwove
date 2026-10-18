import '@xyflow/react/dist/style.css'
import { ReactFlowProvider } from '@xyflow/react'
import { BotIcon, PlayIcon, PlusIcon, SaveIcon, SparklesIcon } from 'lucide-react'
import { ModeSelect, RunnerNote } from '@/components/shared/mode-select'
import { Notice } from '@/components/shared/notice'
import { Button } from '@/components/ui/button'
import { useFlow } from '@/lib/store'
import { FlowCanvas } from './flow-canvas'
import { FlowMenu } from './flow-menu'

export function SetupView() {
  const name = useFlow((s) => s.name)
  const request = useFlow((s) => s.request)
  const dirty = useFlow((s) => s.dirty)
  const run = useFlow((s) => s.run)
  const addStep = useFlow((s) => s.addStep)
  const openSetup = useFlow((s) => s.openSetup)
  const setView = useFlow((s) => s.setView)
  const file = useFlow((s) => s.file)
  const unsaved = useFlow((s) => s.unsaved)
  const runnerReady = useFlow((s) => s.runnerStatus.state === 'ready')
  const saveToFile = useFlow((s) => s.saveToFile)
  const agentSaved = useFlow((s) => s.agentSaved)
  const openAgentSaved = useFlow((s) => s.openAgentSaved)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold">{name}</h2>
          {request && (
            <p className="text-sm text-muted-foreground">
              Set up by your agent from <q className="text-foreground">{request}</q>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-xs text-waiting animate-in fade-in">Changes apply on the next run</span>}
          {unsaved && runnerReady && (
            <Button variant="outline" onClick={saveToFile}>
              <SaveIcon />
              {file ? 'Save changes' : 'Save to flows'}
            </Button>
          )}
          <FlowMenu />
          <Button variant="outline" onClick={() => openSetup(true)}>
            <SparklesIcon />
            Set up with your agent
          </Button>
          <Button variant="outline" onClick={addStep}>
            <PlusIcon />
            Add step
          </Button>
          <ModeSelect />
          <Button
            onClick={async () => {
              await run()
              if (!useFlow.getState().notice) setView('live')
            }}
          >
            <PlayIcon />
            Run flow
          </Button>
        </div>
      </div>
      <div className="flex justify-end">
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
