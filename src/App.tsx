import { lazy, Suspense, useEffect } from 'react'
import { LiveHeader } from '@/components/live/live-header'
import { LiveView } from '@/components/live/live-view'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { SettingsDialog } from '@/components/shell/settings-dialog'
import { UsagePage } from '@/components/shell/usage-page'
import { PromptDialog } from '@/components/setup/prompt-dialog'
import { SetupHeader } from '@/components/setup/setup-header'
import { SetupDialog } from '@/components/setup/setup-dialog'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAnimationFrame } from '@/hooks/use-animation-frame'
import { useApplyColorMode } from '@/hooks/use-color-mode'
import { STATUS_POLL_MS } from '@/lib/constants'
import { useFlow } from '@/lib/store'

// The canvas (React Flow) is the heaviest part, so it loads the first time Set up opens.
const SetupView = lazy(() => import('@/components/setup/setup-view').then((m) => ({ default: m.SetupView })))

export default function App() {
  const view = useFlow((s) => s.view)
  const frame = useFlow((s) => s.frame)
  const checkRunner = useFlow((s) => s.checkRunner)
  const resumeRun = useFlow((s) => s.resumeRun)
  const checkClaude = useFlow((s) => s.checkClaude)

  useEffect(() => {
    checkRunner()
    resumeRun()
  }, [checkRunner, resumeRun])

  useEffect(() => {
    checkClaude()
    const timer = setInterval(checkClaude, STATUS_POLL_MS)
    return () => clearInterval(timer)
  }, [checkClaude])

  useAnimationFrame(frame)
  useApplyColorMode()

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-dvh min-w-0">
          {view === 'usage' && <UsagePage />}
          {view !== 'usage' && (
            <>
              {view === 'live' ? <LiveHeader /> : <SetupHeader />}
              <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6">
                {/* Mounted only while open, so React Flow measures the cards and fits them on arrival. */}
                {view === 'setup' && (
                  <div className="min-h-0 flex-1 animate-in fade-in">
                    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the canvas…</p>}>
                      <SetupView />
                    </Suspense>
                  </div>
                )}
                <div hidden={view !== 'live'} className="min-h-0 flex-1 overflow-y-auto animate-in fade-in">
                  <LiveView />
                </div>
              </div>
            </>
          )}
        </SidebarInset>
      </SidebarProvider>

      <PromptDialog />
      <SetupDialog />
      <SettingsDialog />
    </TooltipProvider>
  )
}
