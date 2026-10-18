import { lazy, Suspense, useEffect } from 'react'
import { LiveView } from '@/components/live/live-view'
import { PromptDialog } from '@/components/setup/prompt-dialog'
import { SetupDialog } from '@/components/setup/setup-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAnimationFrame } from '@/hooks/use-animation-frame'
import { useColorMode } from '@/hooks/use-color-mode'
import { useFlow } from '@/lib/store'
import type { View } from '@/lib/types'

// The canvas (React Flow) is the heaviest part, so it loads the first time Set up opens.
const SetupView = lazy(() => import('@/components/setup/setup-view').then((m) => ({ default: m.SetupView })))

export default function App() {
  const view = useFlow((s) => s.view)
  const setView = useFlow((s) => s.setView)
  const frame = useFlow((s) => s.frame)
  const waiting = useFlow((s) => s.tasks.filter((t) => t.state === 'waiting').length)
  const colorMode = useColorMode()
  const checkRunner = useFlow((s) => s.checkRunner)

  useEffect(() => {
    checkRunner()
  }, [checkRunner])

  useAnimationFrame(frame)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark')
  }, [colorMode])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex h-dvh w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-balance">Agent Flow</h1>
          <p className="max-w-prose text-muted-foreground">
            Ask your agent to set up a flow, then see it here: every step, every prompt, and who is waiting for you.
            Tweak anything and run it again.
          </p>
        </header>

        <Tabs value={view} onValueChange={(v) => setView(v as View)} className="min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="setup" className="px-4">
              Set up
            </TabsTrigger>
            <TabsTrigger value="live" className="px-4">
              Live
              {waiting > 0 && (
                <Badge className="h-4 min-w-4 bg-waiting px-1 tabular-nums text-background animate-in zoom-in-50">
                  {waiting}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Mounted only while open, so React Flow measures the cards and fits them on arrival. */}
          <TabsContent value="setup" className="min-h-0 animate-in fade-in">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the canvas…</p>}>
              <SetupView />
            </Suspense>
          </TabsContent>
          <TabsContent
            value="live"
            forceMount
            className="min-h-0 overflow-y-auto data-[state=active]:animate-in data-[state=active]:fade-in data-[state=inactive]:hidden"
          >
            <LiveView />
          </TabsContent>
        </Tabs>
      </div>

      <PromptDialog />
      <SetupDialog />
    </TooltipProvider>
  )
}
