import '@xyflow/react/dist/style.css'
import { ReactFlowProvider } from '@xyflow/react'
import { PlayIcon, PlusIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ORIGIN_REQUEST } from '@/lib/seed'
import { useFlow } from '@/lib/store'
import { FlowCanvas } from './flow-canvas'

export function SetupView() {
  const dirty = useFlow((s) => s.dirty)
  const run = useFlow((s) => s.run)
  const addStep = useFlow((s) => s.addStep)
  const openSetup = useFlow((s) => s.openSetup)
  const setView = useFlow((s) => s.setView)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold">Pricing page refresh</h2>
          <p className="text-sm text-muted-foreground">
            Set up by Claude from <q className="text-foreground">{ORIGIN_REQUEST}</q>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-xs text-waiting animate-in fade-in">Changes apply on the next run</span>}
          <Button variant="outline" onClick={() => openSetup(true)}>
            <SparklesIcon />
            Set up with your agent
          </Button>
          <Button variant="outline" onClick={addStep}>
            <PlusIcon />
            Add step
          </Button>
          <Button
            onClick={() => {
              run()
              setView('live')
            }}
          >
            <PlayIcon />
            Run flow
          </Button>
        </div>
      </div>
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
