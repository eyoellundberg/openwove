import { HugeiconsIcon } from '@hugeicons/react'
import { FloppyDiskIcon, PlayIcon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { ModeSelect } from '@/components/shared/mode-select'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { useFlow } from '@/lib/store'

export function SetupHeader() {
  const name = useFlow((s) => s.name)
  const request = useFlow((s) => s.request)
  const run = useFlow((s) => s.run)
  const addStep = useFlow((s) => s.addStep)
  const setView = useFlow((s) => s.setView)
  const file = useFlow((s) => s.file)
  const unsaved = useFlow((s) => s.unsaved)
  const runnerReady = useFlow((s) => s.runnerStatus.state === 'ready')
  const saveToFile = useFlow((s) => s.saveToFile)

  return (
    <PageHeader
      title={name}
      subtitle={
        request && (
          <span className="block truncate" title={request}>
            Set up by your agent from <q className="text-foreground">{request}</q>
          </span>
        )
      }
    >
      {unsaved && runnerReady && (
        <Button variant="outline" size="sm" onClick={saveToFile}>
          <HugeiconsIcon icon={FloppyDiskIcon} />
          {file ? 'Save changes' : 'Save to flows'}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={addStep}>
        <HugeiconsIcon icon={PlusSignIcon} />
        Add step
      </Button>
      <ModeSelect />
      <Button
        size="sm"
        onClick={async () => {
          await run()
          if (!useFlow.getState().notice) setView('live')
        }}
      >
        <HugeiconsIcon icon={PlayIcon} />
        Run flow
      </Button>
    </PageHeader>
  )
}
