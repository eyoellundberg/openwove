import { ChatGptIcon, ClaudeIcon, FigmaIcon, GithubIcon, GoogleGeminiIcon, NotionIcon, SlackIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/* Still pictures of the app, built from the same components and tokens, so they stay true to it. */

type Tone = 'running' | 'waiting' | 'earned' | 'muted'

const TONE: Record<Tone, string> = {
  running: 'bg-running-subtle text-running',
  waiting: 'bg-waiting-subtle text-waiting',
  earned: 'bg-earned-subtle text-earned',
  muted: 'bg-muted text-muted-foreground',
}

export function Tag({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('rounded-full font-medium', TONE[tone], className)}>
      {children}
    </Badge>
  )
}

/** Each agent runs on a different provider, so the logos differ like they do in the app. */
const BRAND = {
  claude: { icon: ClaudeIcon, className: 'bg-vendor-anthropic text-white' },
  chatgpt: { icon: ChatGptIcon, className: 'bg-vendor-openai text-background' },
  gemini: { icon: GoogleGeminiIcon, className: 'bg-vendor-google text-white' },
}
type Brand = keyof typeof BRAND

function BrandMark({ brand, className }: { brand: Brand; className?: string }) {
  const { icon, className: tone } = BRAND[brand]
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', tone, className)}>
      <HugeiconsIcon icon={icon} className="size-3.5" />
    </span>
  )
}

const TOOLS: Record<string, IconSvgElement> = { notion: NotionIcon, slack: SlackIcon, figma: FigmaIcon, github: GithubIcon }

/** The tools an agent can use, as small logos. */
function ToolChips({ tools }: { tools: (keyof typeof TOOLS)[] }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      {tools.map((t) => (
        <HugeiconsIcon key={t} icon={TOOLS[t]} className="size-3.5" aria-label={t} />
      ))}
    </span>
  )
}

const AGENTS = {
  researcher: { brand: 'claude' as Brand, name: 'Researcher' },
  writer: { brand: 'claude' as Brand, name: 'Writer' },
  reviewer: { brand: 'chatgpt' as Brand, name: 'Reviewer' },
  ops: { brand: 'gemini' as Brand, name: 'Ops' },
}
type Who = keyof typeof AGENTS

function Agent({ who, model, extra }: { who: Who; model: string; extra?: string }) {
  const { brand, name } = AGENTS[who]
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <BrandMark brand={brand} className="size-5" />
      <span className="font-medium text-foreground">{name}</span>
      <span>· {model}</span>
      {extra && <span>· {extra}</span>}
    </div>
  )
}

type Step = { who: Who; model: string; task: string; tag: [Tone, string]; cost: string; state?: 'running' }

const STAGES: { label: string; steps: Step[] }[] = [
  { label: 'First', steps: [{ who: 'researcher', model: 'Haiku', task: 'Read the brief', tag: ['earned', 'Done'], cost: '$0.004' }] },
  {
    label: 'Then, at the same time',
    steps: [
      { who: 'writer', model: 'Sonnet', task: 'Write the landing page', tag: ['waiting', 'Asks you first'], cost: '$0.031', state: 'running' },
      { who: 'researcher', model: 'Haiku', task: 'Draft a short FAQ', tag: ['earned', 'Done'], cost: '$0.003' },
    ],
  },
  { label: 'Last', steps: [{ who: 'reviewer', model: 'Haiku', task: 'Review the page', tag: ['muted', 'Up next'], cost: '~$0.004' }] },
]

/** Dashed wires from every step to each step in the next stage, measured from the laid-out cards. */
function useWires() {
  const ref = useRef<HTMLDivElement>(null)
  const [wires, setWires] = useState({ d: '', width: 0, height: 0 })

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const draw = () => {
      const box = root.getBoundingClientRect()
      const stages = [...root.querySelectorAll('[data-stage]')]
      let d = ''
      stages.slice(0, -1).forEach((stage, i) => {
        for (const a of stage.querySelectorAll('[data-step]')) {
          for (const b of stages[i + 1].querySelectorAll('[data-step]')) {
            const r1 = a.getBoundingClientRect()
            const r2 = b.getBoundingClientRect()
            const [x1, y1] = [r1.right - box.left, r1.top + r1.height / 2 - box.top]
            const [x2, y2] = [r2.left - box.left, r2.top + r2.height / 2 - box.top]
            const mx = (x1 + x2) / 2
            d += `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
          }
        }
      })
      setWires({ d, width: box.width, height: box.height })
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(root)
    document.fonts?.ready.then(draw)
    return () => observer.disconnect()
  }, [])

  return { ref, wires }
}

export function CanvasPreview() {
  const { ref, wires } = useWires()
  return (
    <Card className="gap-0 overflow-hidden py-0 text-left shadow-lg" role="img" aria-label="The OpenWove canvas: four steps across three stages, one running and waiting for you.">
      <div className="flex items-center gap-3 border-b px-4 py-3 text-sm">
        <span className="font-medium">Acme Inc landing page</span>
        <Tag tone="running">Real run</Tag>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">$0.042</span>
        <Tag tone="waiting">1 waiting for you</Tag>
      </div>
      <div className="overflow-x-auto bg-dots px-8 py-10">
        <div ref={ref} className="relative grid min-w-3xl grid-cols-3 gap-14">
          <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${wires.width} ${wires.height}`} aria-hidden>
            <path d={wires.d} fill="none" strokeWidth="1.5" strokeDasharray="6 8" className="animate-march stroke-ring motion-reduce:animate-none" />
          </svg>
          {STAGES.map((stage) => (
            <div key={stage.label} data-stage className="relative flex flex-col justify-center gap-4">
              <span className="text-xs text-muted-foreground">{stage.label}</span>
              {stage.steps.map((step) => (
                <Card key={step.task} data-step size="sm" className={cn('gap-2 shadow-sm', step.state === 'running' && 'ring-running')}>
                  <CardContent className="flex flex-col gap-2">
                    <Agent who={step.who} model={step.model} />
                    <p className="text-sm font-medium">{step.task}</p>
                    <div className="flex items-center justify-between">
                      <Tag tone={step.tag[0]}>{step.tag[1]}</Tag>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">{step.cost}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export function PromptPreview() {
  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardContent className="flex flex-col gap-3">
        <Agent who="writer" model="Sonnet 5.5" extra="medium effort" />
        <p className="font-medium">Write the landing page</p>
        <pre className="rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          Using brief.md and notes.md, write site/index.html: one page with a headline, three benefits, the price, and a
          single "Get Acme" button.
        </pre>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Tag tone="waiting">Asks you before saving</Tag>
          <span>files</span>
        </div>
      </CardContent>
    </Card>
  )
}

type Bar = { at: number; width: number; label: string; tone: Tone }

const LANES: { who: Who; model: string; cost: string; tools: (keyof typeof TOOLS)[]; idle?: boolean; bars: Bar[] }[] = [
  { who: 'researcher', model: 'Opus 5.5', cost: '$0.31', tools: ['notion', 'slack'], bars: [{ at: 12, width: 34, label: 'Read the brief and notes', tone: 'muted' }] },
  { who: 'writer', model: 'Sonnet 5.5', cost: '$0.27', tools: ['figma'], bars: [{ at: 48, width: 30, label: 'Writing the page', tone: 'running' }] },
  { who: 'reviewer', model: 'GPT-6', cost: '~$0.12', tools: ['github'], idle: true, bars: [] },
  { who: 'ops', model: 'Gemini 3.8', cost: '~$0.05', tools: ['slack'], bars: [{ at: 66, width: 30, label: 'Needs you', tone: 'waiting' }] },
]

const AXIS = ['-25m', '-20m', '-15m', '-10m', '-5m', 'now']
const SIDEBAR_FLOWS = ['Acme Inc landing page', 'Acme Inc launch email', 'Acme Inc support triage', 'Pricing page refresh']

function SidebarItem({ children, active, badge }: { children: ReactNode; active?: boolean; badge?: string }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm', active ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground/80')}>
      <span className="truncate">{children}</span>
      {badge && <span className="ml-auto grid size-5 place-items-center rounded-full bg-waiting text-xs text-background tabular-nums">{badge}</span>}
    </div>
  )
}

/** The Live view as it looks in the app: sidebar, timeline of agents on different providers, and what's waiting for you. */
export function AppWindowPreview() {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-background text-left shadow-2xl"
      role="img"
      aria-label="The OpenWove app: a timeline of four agents on different models, and Ops waiting for you to approve publishing the Acme Inc page."
    >
      <div className="flex">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 text-sidebar-foreground md:flex">
          <div className="flex items-center gap-1.5 px-1 pt-1 pb-5" aria-hidden>
            <span className="size-3 rounded-full bg-failed" />
            <span className="size-3 rounded-full bg-waiting" />
            <span className="size-3 rounded-full bg-earned" />
          </div>
          <SidebarItem active badge="1">
            Live
          </SidebarItem>
          <SidebarItem>Usage</SidebarItem>
          <p className="mt-4 px-2 pb-1 text-xs text-muted-foreground">Flows</p>
          {SIDEBAR_FLOWS.map((f) => (
            <SidebarItem key={f}>{f}</SidebarItem>
          ))}
          <div className="mt-auto flex flex-col gap-1.5 px-2 pt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-earned" /> Claude: All good
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-earned" /> Runner ready
            </span>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
            <div className="flex flex-col">
              <span className="font-semibold">Acme Inc landing page</span>
              <span className="text-xs text-muted-foreground">
                1 running · <span className="text-waiting">1 needs you</span> · $0.75 this run
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline">
                Pause
              </Button>
              <Button size="sm" variant="outline">
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
                {LANES.map((lane) => (
                  <div key={lane.who} className="flex items-center gap-4">
                    <div className="flex w-52 shrink-0 items-center gap-2.5">
                      <BrandMark brand={AGENTS[lane.who].brand} />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {AGENTS[lane.who].name}
                          {lane.idle && <Tag tone="muted">Idle</Tag>}
                          {lane.who === 'ops' && <Tag tone="waiting">Needs you</Tag>}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {lane.model} · {lane.cost} <ToolChips tools={lane.tools} />
                        </span>
                      </div>
                    </div>
                    <div className="relative h-10 flex-1 rounded-lg border bg-muted/40">
                      {lane.bars.map((bar) => (
                        <span
                          key={bar.label}
                          className={cn('absolute inset-y-1 flex items-center truncate rounded-md px-2.5 text-xs', TONE[bar.tone])}
                          style={{ left: `${bar.at}%`, width: `${bar.width}%` }}
                        >
                          {bar.label}
                        </span>
                      ))}
                      <span className="absolute -inset-y-1 right-0 w-px bg-foreground/60" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t px-5 py-4">
            <p className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Waiting for you</p>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-waiting-subtle p-3">
              <BrandMark brand="gemini" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">
                  <span className="font-medium">Ops</span> wants to publish the Acme Inc page to the live site
                </span>
                <span className="text-xs text-muted-foreground">Publish to the site · waiting 4m</span>
              </div>
              <Button size="sm" variant="outline">
                Deny
              </Button>
              <Button size="sm">Approve</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WaitingPreview() {
  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-start gap-3">
          <Tag tone="waiting">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-waiting" />
            Waiting for you
          </Tag>
          <p className="text-sm">
            <span className="font-medium">Writer</span> wants to save the Acme Inc page to{' '}
            <code className="font-mono">site/index.html</code>
          </p>
          <div className="flex gap-2">
            <Button size="sm">Approve</Button>
            <Button size="sm" variant="outline">
              Deny
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="h-2 w-6 rounded-full bg-earned" />
        <span className="h-2 w-6 rounded-full bg-earned" />
        <span className="h-2 w-6 rounded-full bg-border" />
        <span className="ml-2">Approved 2 times in a row. One more and it asks less.</span>
      </div>
    </div>
  )
}
