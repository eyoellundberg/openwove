import { lazy, Suspense, useEffect } from 'react'
import { LiveView } from '@/components/live/live-view'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { PromptDialog } from '@/components/setup/prompt-dialog'
import { SetupDialog } from '@/components/setup/setup-dialog'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAnimationFrame } from '@/hooks/use-animation-frame'
import { useColorMode } from '@/hooks/use-color-mode'
import { useFlow } from '@/lib/store'

// The canvas (React Flow) is the heaviest part, so it loads the first time Set up opens.
const SetupView = lazy(() => import('@/components/setup/setup-view').then((m) => ({ default: m.SetupView })))

export default function App() {
  const view = useFlow((s) => s.view)
  const frame = useFlow((s) => s.frame)
  const colorMode = useColorMode()
  const checkRunner = useFlow((s) => s.checkRunner)
  const resumeRun = useFlow((s) => s.resumeRun)

  useEffect(() => {
    checkRunner()
    resumeRun()
  }, [checkRunner, resumeRun])

  useAnimationFrame(frame)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark')
  }, [colorMode])

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-dvh min-w-0">
          <header className="flex shrink-0 items-center gap-2 px-4 pt-4 sm:px-6">
            <SidebarTrigger />
            <h1 className="text-sm font-medium text-muted-foreground">{view === 'live' ? 'Live' : 'Flow'}</h1>
          </header>

          <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6">
            {/* Mounted only while open, so React Flow measures the cards and fits them on arrival. */}
            {view === 'setup' && (
              <div className="min-h-0 flex-1 animate-in fade-in">
                <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the canvas…</p>}>
                  <SetupView />
                </Suspense>
              </div>
            )}
            <div
              hidden={view !== 'live'}
              className="min-h-0 flex-1 overflow-y-auto animate-in fade-in"
            >
              <LiveView />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <PromptDialog />
      <SetupDialog />
    </TooltipProvider>
  )
}
