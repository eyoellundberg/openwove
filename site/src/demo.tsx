import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AGENTS, TONE, type TOOLS, type Tone, type Who } from './agents'
import { BrandMark, Tag, ToolChips } from './previews'

/* A small, working version of the app's Live view. A run plays by itself and stops where the real thing would: waiting
   for you. The rest of the window is skeleton, because it isn't what the demo is about. */

const ORDER = ['idle', 'research', 'write', 'waiting', 'publish', 'review', 'done'] as const
type Step = (typeof ORDER)[number]
type Phase = Step | 'denied'

/** How long each automatic step takes. */
const STEP_MS = 1400
/** Waits for the hero's reveal to finish before the run starts the first time. */
const FIRST_START_MS = 1500
/** Where each phase goes next on its own. `waiting` isn't here: it waits for a click. */
const NEXT: Partial<Record<Phase, Phase>> = { research: 'write', write: 'waiting', publish: 'review', review: 'done' }

const reached = (phase: Phase, step: Step) => ORDER.indexOf(phase === 'denied' ? 'waiting' : phase) >= ORDER.indexOf(step)

const AXIS = ['-25m', '-20m', '-15m', '-10m', '-5m', 'now']

type Lane = {
  who: Who
  model: string
  tools: (keyof typeof TOOLS)[]
  /** What it costs once it has run; `~` marks a price that's an example, not the provider's list price. */
  cost: number
  estimated?: boolean
  /** The phase it starts in, and where its bar sits (percent of the timeline). */
  from: Step
  at: number
  width: number
}

const LANES: Lane[] = [
  { who: 'researcher', model: 'Opus 5.5', tools: ['notion', 'slack'], cost: 0.31, from: 'research', at: 3, width: 30 },
  { who: 'writer', model: 'Sonnet 5.5', tools: ['figma'], cost: 0.27, from: 'write', at: 35, width: 27 },
  { who: 'reviewer', model: 'GPT-6', tools: ['github'], cost: 0.12, estimated: true, from: 'review', at: 82, width: 16 },
  { who: 'ops', model: 'Gemini 3.8', tools: ['slack'], cost: 0.05, estimated: true, from: 'waiting', at: 64, width: 17 },
]

/** The label and tone of a lane's bar right now. */
function barOf(who: Who, phase: Phase): { label: string; tone: Tone } {
  switch (who) {
    case 'researcher':
      return { label: 'Read the brief and notes', tone: 'muted' }
    case 'writer':
      return { label: 'Writing the page', tone: phase === 'write' ? 'running' : 'muted' }
    case 'ops':
      if (phase === 'denied') return { label: 'Denied', tone: 'failed' }
      if (phase === 'waiting') return { label: 'Needs you', tone: 'waiting' }
      return phase === 'publish' ? { label: 'Publishing', tone: 'running' } : { label: 'Published', tone: 'earned' }
    case 'reviewer':
      return phase === 'review' ? { label: 'Reviewing', tone: 'running' } : { label: 'Looks good', tone: 'earned' }
  }
}

const money = (n: number, estimated = false) => `${estimated ? '~' : ''}$${n.toFixed(2)}`

/** What is counted so far. A lane's cost starts adding up once its step has begun; Ops only once you've approved it. */
function spentOn(lane: Lane, phase: Phase) {
  if (lane.who === 'ops') return phase !== 'denied' && reached(phase, 'publish') ? lane.cost : 0
  return reached(phase, lane.from) ? lane.cost : 0
}

function statusOf(phase: Phase, total: number): ReactNode {
  const cost = `$${total.toFixed(2)} this run`
  if (phase === 'done') return `Done · 4 steps · $${total.toFixed(2)}`
  if (phase === 'denied') return `Stopped · ${cost}`
  if (phase === 'waiting') return (
    <>
      <span className="text-waiting">1 needs you</span> · {cost}
    </>
  )
  return `1 running · ${cost}`
}

function Tray({ phase, onApprove, onDeny, onRestart }: { phase: Phase; onApprove: () => void; onDeny: () => void; onRestart: () => void }) {
  if (phase === 'waiting') {
    return (
      <div className="reveal flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-waiting-subtle p-3">
          <BrandMark brand={AGENTS.ops.brand} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm">
              <span className="font-medium">Ops</span> wants to publish the Acme Inc page to the live site
            </span>
            <span className="text-xs text-muted-foreground">Publish to the site · waiting 4m</span>
          </div>
          <Button size="sm" variant="outline" onClick={onDeny}>
            Deny
          </Button>
          <Button size="sm" onClick={onApprove}>
            Approve
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Try it: approve it, or deny it.</p>
      </div>
    )
  }
  if (phase === 'publish' || phase === 'review') {
    return <p className="reveal rounded-xl bg-earned-subtle p-3 text-sm text-earned">Approved. Ops is publishing, and the Reviewer checks it next.</p>
  }
  if (phase === 'done' || phase === 'denied') {
    const done = phase === 'done'
    return (
      <div className={cn('reveal flex flex-wrap items-center gap-3 rounded-xl p-3', done ? 'bg-earned-subtle' : 'bg-failed-subtle')}>
        <p className={cn('min-w-0 flex-1 text-sm', done ? 'text-earned' : 'text-failed')}>
          {done ? 'Done. Every run ends in a report your agent can read too.' : 'You said no, so Ops stopped. Next time it asks again.'}
        </p>
        <Button size="sm" variant="outline" onClick={onRestart}>
          Run again
        </Button>
      </div>
    )
  }
  return <Skeleton className="h-14 rounded-xl" />
}

export function InteractiveApp() {
  const [phase, setPhase] = useState<Phase>('idle')
  /** Counts runs, so a replay grows the bars again instead of leaving them as they were. */
  const [run, setRun] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  // Start the first run when the window comes into view, once. People who prefer less motion get the paused moment straight away.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return
        started.current = true
        timer = setTimeout(() => setPhase(reduce ? 'waiting' : 'research'), reduce ? 0 : FIRST_START_MS)
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  // Each automatic step hands over to the next.
  useEffect(() => {
    const next = NEXT[phase]
    if (!next) return
    const timer = setTimeout(() => setPhase(next), STEP_MS)
    return () => clearTimeout(timer)
  }, [phase])

  const restart = () => {
    setRun((r) => r + 1)
    setPhase('research')
  }

  const total = LANES.reduce((sum, lane) => sum + spentOn(lane, phase), 0)

  return (
    <div ref={root} className="overflow-hidden rounded-2xl border bg-background text-left shadow-2xl" role="group" aria-label="A working demo of the OpenWove app">
      <div className="flex">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 text-sidebar-foreground md:flex">
          <div className="flex items-center gap-1.5 px-1 pt-1 pb-5" aria-hidden>
            <span className="size-3 rounded-full bg-failed" />
            <span className="size-3 rounded-full bg-waiting" />
            <span className="size-3 rounded-full bg-earned" />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5 text-sm font-medium">
            Live
            {phase === 'waiting' && <span className="ml-auto grid size-5 place-items-center rounded-full bg-waiting text-xs text-background tabular-nums">1</span>}
          </div>
          <Skeleton className="mx-2 my-2.5 h-3 w-12" />
          <p className="mt-4 px-2 pb-1 text-xs text-muted-foreground">Flows</p>
          <div className="truncate rounded-md px-2 py-1.5 text-sm">Acme Inc landing page</div>
          <Skeleton className="mx-2 my-2.5 h-3 w-32" />
          <Skeleton className="mx-2 my-2.5 h-3 w-28" />
          <Skeleton className="mx-2 my-2.5 h-3 w-24" />
          <div className="mt-auto flex flex-col gap-2.5 px-2 pt-8">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
            <div className="flex flex-col">
              <span className="font-semibold">Acme Inc landing page</span>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {statusOf(phase, total)}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Button size="sm" variant="outline" onClick={restart} disabled={phase === 'idle'}>
                Run again
              </Button>
              <Tag tone="running">Real run</Tag>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-2xl px-5 py-4">
              <div className="flex gap-4 pb-2 text-xs text-muted-foreground">
                <span className="w-52 shrink-0" />
                <div className="grid flex-1 grid-cols-6 font-mono">
                  {AXIS.map((a) => (
                    <span key={a} className={cn(a === 'now' && 'text-right text-foreground')}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {LANES.map((lane) => {
                  const begun = reached(phase, lane.from) && phase !== 'idle'
                  const bar = barOf(lane.who, phase)
                  // While a decision is waiting, everything else steps back.
                  const dim = phase === 'waiting' && lane.who !== 'ops'
                  return (
                    <div key={lane.who} className={cn('flex items-center gap-4 transition-all duration-500', dim && 'opacity-40 blur-xs')}>
                      <div className="flex w-52 shrink-0 items-center gap-2.5">
                        <BrandMark brand={AGENTS[lane.who].brand} />
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {AGENTS[lane.who].name}
                            {!begun && <Tag tone="muted">Idle</Tag>}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {lane.model} · <span className="tabular-nums">{money(spentOn(lane, phase), lane.estimated)}</span> <ToolChips tools={lane.tools} />
                          </span>
                        </div>
                      </div>
                      <div className="relative h-10 flex-1 rounded-lg border bg-muted/40">
                        {begun && (
                          <span
                            key={`${lane.who}-${run}`}
                            className={cn('wipe absolute inset-y-1 flex items-center truncate rounded-md px-2.5 text-xs transition-colors duration-500', TONE[bar.tone])}
                            style={{ left: `${lane.at}%`, width: `${lane.width}%` }}
                          >
                            {bar.label}
                          </span>
                        )}
                        <span className="absolute -inset-y-1 right-0 w-px bg-foreground/60" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="min-h-32 border-t px-5 py-4">
            <p className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Waiting for you</p>
            <Tray phase={phase} onApprove={() => setPhase('publish')} onDeny={() => setPhase('denied')} onRestart={restart} />
          </div>
        </div>
      </div>
    </div>
  )
}
