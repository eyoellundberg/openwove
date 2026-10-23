import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { useFlow } from '@/lib/store'

/** Says the sample flow and its history are made up, and where to go from there. Gone once real work is open. */
export function DemoBanner() {
  const demo = useFlow((s) => s.demo)
  const run = useFlow((s) => s.run)
  const setView = useFlow((s) => s.setView)
  const setMode = useFlow((s) => s.setMode)
  const openSetup = useFlow((s) => s.openSetup)
  if (!demo) return null

  return (
    <div className="mx-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm sm:mx-6">
      <HugeiconsIcon icon={InformationCircleIcon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">You're looking at a demo. Nothing here is real, and it costs nothing.</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          // The demo's tools aren't connected, so it only ever plays as a simulation.
          setMode('simulated')
          setView('live')
          run()
        }}
      >
        Play the demo
      </Button>
      <Button size="sm" onClick={() => openSetup(true)}>
        Set up my own
      </Button>
    </div>
  )
}
