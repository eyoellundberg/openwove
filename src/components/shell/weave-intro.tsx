import { Button } from '@/components/ui/button'

/** Where each strand starts drawing, so the four cross in turn. */
const STRANDS = [
  { d: 'M7 11.5h18', delay: '0.1s' },
  { d: 'M11.5 7v18', delay: '0.3s' },
  { d: 'M7 20.5h18', delay: '0.5s' },
  { d: 'M20.5 7v18', delay: '0.7s' },
]

/** The first thing you see: the mark weaving itself together, then the name. */
export function WeaveIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <svg viewBox="0 0 32 32" fill="none" role="img" aria-label="OpenWove" className="size-28">
        <rect width="32" height="32" rx="8" className="fill-foreground" />
        <g strokeWidth="3.5" strokeLinecap="round" className="stroke-background">
          {STRANDS.map(({ d, delay }) => (
            <path key={d} d={d} className="weave-strand" style={{ animationDelay: delay }} />
          ))}
          {/* Then each crossing cuts the strand that goes under and redraws the one on top. */}
          <g className="weave-cross">
            <path d="M7.8 11.5h7.4M16.8 20.5h7.4M20.5 7.8v7.4M11.5 16.8v7.4" strokeWidth="7" strokeLinecap="butt" className="stroke-foreground" />
            <path d="M7.4 11.5h8.2M16.4 20.5h8.2M20.5 7.4v8.2M11.5 16.4v8.2" strokeLinecap="butt" />
          </g>
        </g>
      </svg>
      <div className="flex flex-col gap-1.5">
        <h2 className="weave-rise text-3xl font-semibold tracking-tight">OpenWove</h2>
        <p className="weave-rise text-muted-foreground" style={{ animationDelay: '1.9s' }}>
          Your agents plan. You stay in charge.
        </p>
      </div>
      <Button size="lg" className="weave-rise" style={{ animationDelay: '2.2s' }} onClick={onContinue}>
        Get started
      </Button>
    </div>
  )
}
