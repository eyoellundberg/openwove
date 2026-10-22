import { HugeiconsIcon } from '@hugeicons/react'
import { Activity01Icon, ChartColumnIcon, Download01Icon, FileScriptIcon, FolderOpenIcon, PlugSocketIcon, Settings01Icon, WorkflowSquare01Icon } from '@hugeicons/core-free-icons'
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
import { HOVER_CHECK_MS } from '@/lib/constants'
import { flowFileName } from '@/lib/flow-name'
import { readiness, type Readiness } from '@/lib/runner-status'
import { useFlow } from '@/lib/store'

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
    link.download = flowFileName(name)
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
                <HugeiconsIcon icon={WorkflowSquare01Icon} />
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
                <HugeiconsIcon icon={FileScriptIcon} />
                <span>{f.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground" tooltip="Open a flow file…" onClick={() => fileInput.current?.click()}>
              <HugeiconsIcon icon={FolderOpenIcon} />
              <span>Open a flow file…</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground" tooltip="Download this flow" onClick={download}>
              <HugeiconsIcon icon={Download01Icon} />
              <span>Download this flow</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

const RUNNER_LABEL: Record<Readiness, string> = {
  checking: 'Looking for the runner…',
  offline: 'Runner is off',
  'no-key': 'Runner needs an API key',
  ready: 'Runner ready',
}

/** Whether a real run can happen, in a few words. */
function RunnerStatus() {
  const level = useFlow((s) => readiness(s.runnerStatus))

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
      <StatusDot className={level === 'ready' ? 'bg-earned' : level === 'checking' ? 'bg-running animate-pulse-dot' : 'bg-waiting'} />
      {RUNNER_LABEL[level]}
    </div>
  )
}

const CLAUDE_DOT = {
  ok: 'bg-earned',
  slow: 'bg-waiting',
  down: 'bg-failed',
  unknown: 'bg-border',
}

/** Whether Claude itself is up, so a failing step isn't a mystery. */
function ClaudeStatus() {
  const claude = useFlow((s) => s.claudeStatus)
  const runnerReady = useFlow((s) => s.runnerStatus.state === 'ready')
  if (!runnerReady || !claude) return null

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
      title={claude.incident}
    >
      <StatusDot className={CLAUDE_DOT[claude.level]} />
      Claude: {claude.text}
    </div>
  )
}

export function AppSidebar() {
  const view = useFlow((s) => s.view)
  const setView = useFlow((s) => s.setView)
  const waiting = useFlow((s) => s.tasks.filter((t) => t.state === 'waiting').length)
  const openSetup = useFlow((s) => s.openSetup)
  const openSettings = useFlow((s) => s.openSettings)
  const checkRunner = useFlow((s) => s.checkRunner)
  const checkClaude = useFlow((s) => s.checkClaude)
  const lastHoverCheck = useRef(0)

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => {
        if (Date.now() - lastHoverCheck.current < HOVER_CHECK_MS) return
        lastHoverCheck.current = Date.now()
        checkRunner()
        checkClaude()
      }}
    >
      {/* In the Mac app this is the top of the window: room for the traffic lights, and drag it to move, double-click to zoom. */}
      <SidebarHeader data-tauri-drag-region="deep" className="hidden desktop:flex">
        <div className="h-6" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={view === 'live'} tooltip="Live" onClick={() => setView('live')}>
                  <HugeiconsIcon icon={Activity01Icon} />
                  <span>Live</span>
                </SidebarMenuButton>
                {waiting > 0 && (
                  <SidebarMenuBadge className="bg-waiting text-background tabular-nums animate-in zoom-in-50">
                    {waiting}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={view === 'usage'} tooltip="Usage" onClick={() => setView('usage')}>
                  <HugeiconsIcon icon={ChartColumnIcon} />
                  <span>Usage</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <FlowsGroup />
      </SidebarContent>

      <SidebarFooter>
        <RunnerStatus />
        <ClaudeStatus />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Connect your agent" onClick={() => openSetup(true)}>
              <HugeiconsIcon icon={PlugSocketIcon} />
              <span>Connect your agent</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" onClick={() => openSettings(true)}>
              <HugeiconsIcon icon={Settings01Icon} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
