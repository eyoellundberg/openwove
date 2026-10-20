import { ActivityIcon, DownloadIcon, FileJsonIcon, FolderOpenIcon, PlugIcon, WorkflowIcon } from 'lucide-react'
import { useRef } from 'react'
import { StatusDot } from '@/components/shared/status-dot'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useFlow } from '@/lib/store'

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow'

/** Your flows, plus opening one from disk or downloading the one on the canvas. */
function FlowsGroup() {
  const flowFiles = useFlow((s) => s.flowFiles)
  const file = useFlow((s) => s.file)
  const name = useFlow((s) => s.name)
  const view = useFlow((s) => s.view)
  const setView = useFlow((s) => s.setView)
  const openFlowFile = useFlow((s) => s.openFlowFile)
  const loadFlow = useFlow((s) => s.loadFlow)
  const exportFlow = useFlow((s) => s.exportFlow)
  const fileInput = useRef<HTMLInputElement>(null)

  const open = async (f: string) => {
    await openFlowFile(f)
    setView('setup')
  }

  const openFromDisk = async (picked: File | undefined) => {
    if (!picked) return
    let json: unknown = null
    try {
      json = JSON.parse(await picked.text())
    } catch {
      // Not JSON; loadFlow reports the problem.
    }
    if (await loadFlow(json)) setView('setup')
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportFlow()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${slug(name)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Flows</SidebarGroupLabel>
      <SidebarGroupContent>
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
        <SidebarMenu>
          {/* The flow on the canvas, when it isn't one of the files listed below. */}
          {!file && !flowFiles.some((f) => f.name === name) && (
            <SidebarMenuItem>
              <SidebarMenuButton isActive={view === 'setup'} tooltip={name} onClick={() => setView('setup')}>
                <WorkflowIcon />
                <span>{name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {flowFiles.map((f) => (
            <SidebarMenuItem key={f.file}>
              <SidebarMenuButton
                isActive={view === 'setup' && (file ? file === f.file : f.name === name)}
                tooltip={f.name}
                onClick={() => open(f.file)}
              >
                <FileJsonIcon />
                <span>{f.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground" tooltip="Open a flow file…" onClick={() => fileInput.current?.click()}>
              <FolderOpenIcon />
              <span>Open a flow file…</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground" tooltip="Download this flow" onClick={download}>
              <DownloadIcon />
              <span>Download this flow</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** Whether a real run can happen, in a few words. */
function RunnerStatus() {
  const status = useFlow((s) => s.runnerStatus)
  const label =
    status.state === 'checking'
      ? 'Looking for the runner…'
      : status.state === 'offline'
        ? 'Runner is off'
        : status.health.providers.anthropic
          ? 'Runner ready'
          : 'Runner needs an API key'
  const good = status.state === 'ready' && status.health.providers.anthropic

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
      <StatusDot
        className={good ? 'bg-earned' : status.state === 'checking' ? 'bg-running animate-pulse-dot' : 'bg-waiting'}
      />
      {label}
    </div>
  )
}

export function AppSidebar() {
  const view = useFlow((s) => s.view)
  const setView = useFlow((s) => s.setView)
  const waiting = useFlow((s) => s.tasks.filter((t) => t.state === 'waiting').length)
  const openSetup = useFlow((s) => s.openSetup)
  const checkRunner = useFlow((s) => s.checkRunner)

  return (
    <Sidebar collapsible="icon" onMouseEnter={checkRunner}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight">
          <WorkflowIcon className="size-5 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Agent Flow</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={view === 'live'} tooltip="Live" onClick={() => setView('live')}>
                  <ActivityIcon />
                  <span>Live</span>
                </SidebarMenuButton>
                {waiting > 0 && (
                  <SidebarMenuBadge className="bg-waiting text-background tabular-nums animate-in zoom-in-50">
                    {waiting}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <FlowsGroup />
      </SidebarContent>

      <SidebarFooter>
        <RunnerStatus />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Connect your agent" onClick={() => openSetup(true)}>
              <PlugIcon />
              <span>Connect your agent</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
