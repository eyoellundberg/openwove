import { useEffect, useState } from 'react'
import { RunnerNote } from '@/components/shared/mode-select'
import { Notice } from '@/components/shared/notice'
import { Card } from '@/components/ui/card'
import { useFlow } from '@/lib/store'
import { RunsStrip } from './runs-strip'
import { Timeline } from './timeline'
import { WaitingTray } from './waiting-tray'

const FLASH_MS = 900

export function LiveView() {
  const mode = useFlow((s) => s.mode)
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    if (!flashId) return
    const t = setTimeout(() => setFlashId(null), FLASH_MS)
    return () => clearTimeout(t)
  }, [flashId])

  // "Needs you" on a bar points at its row in the tray.
  const flag = (taskId: string) => {
    setFlashId(taskId)
    const row = document.getElementById(`ask-${taskId}`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    row?.querySelector<HTMLButtonElement>('[data-approve]')?.focus({ preventScroll: true })
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-2 px-4 pt-3 empty:hidden">
        <Notice />
        {mode === 'real' && <RunnerNote />}
      </div>
      <Timeline onFlag={flag} />
      <WaitingTray flashId={flashId} />
      <RunsStrip />
    </Card>
  )
}
