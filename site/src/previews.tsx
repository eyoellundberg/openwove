import { HugeiconsIcon } from '@hugeicons/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AGENTS, BRAND, TONE, TOOLS, type Brand, type Tone, type Who } from './agents'

/* Still pictures of the app, built from the same components and tokens, so they stay true to it. */

export function Tag({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('rounded-full font-medium', TONE[tone], className)}>
      {children}
    </Badge>
  )
}

export function BrandMark({ brand, className }: { brand: Brand; className?: string }) {
  const { icon, className: tone } = BRAND[brand]
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', tone, className)}>
      <HugeiconsIcon icon={icon} className="size-3.5" />
    </span>
  )
}

/** The tools an agent can use, as small logos. */
export function ToolChips({ tools }: { tools: (keyof typeof TOOLS)[] }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      {tools.map((t) => (
        <HugeiconsIcon key={t} icon={TOOLS[t]} className="size-3.5" aria-label={t} />
      ))}
    </span>
  )
}

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
