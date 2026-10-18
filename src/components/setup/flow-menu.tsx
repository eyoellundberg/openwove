import { DownloadIcon, FileJsonIcon, FolderOpenIcon, RefreshCwIcon } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFlow } from '@/lib/store'

/** Open flows your agent wrote in flows/, open a file from disk, or download the current one. */
export function FlowMenu() {
  const flowFiles = useFlow((s) => s.flowFiles)
  const runnerReady = useFlow((s) => s.runnerStatus.state === 'ready')
  const checkRunner = useFlow((s) => s.checkRunner)
  const openFlowFile = useFlow((s) => s.openFlowFile)
  const loadFlow = useFlow((s) => s.loadFlow)
  const exportFlow = useFlow((s) => s.exportFlow)
  const name = useFlow((s) => s.name)
  const fileInput = useRef<HTMLInputElement>(null)

  const openFromDisk = async (file: File | undefined) => {
    if (!file) return
    let json: unknown = null
    try {
      json = JSON.parse(await file.text())
    } catch {
      // Not JSON; loadFlow reports the problem.
    }
    await loadFlow(json)
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportFlow()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          openFromDisk(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <DropdownMenu onOpenChange={(open) => open && checkRunner()}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileJsonIcon />
            Flows
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">In your flows folder</DropdownMenuLabel>
          {flowFiles.map((f) => (
            <DropdownMenuItem key={f.file} onSelect={() => openFlowFile(f.file)}>
              <FileJsonIcon />
              <span className="truncate">{f.name}</span>
            </DropdownMenuItem>
          ))}
          {!flowFiles.length && (
            <DropdownMenuItem disabled>
              <RefreshCwIcon />
              {runnerReady ? 'No flows yet' : 'Start the runner to list flows'}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <FolderOpenIcon />
            Open a flow file…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={download}>
            <DownloadIcon />
            Download this flow
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
