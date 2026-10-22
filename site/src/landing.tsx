import { ArrowRightIcon, CheckIcon, CopyIcon, FolderLockIcon, KeyRoundIcon, MonitorIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApplyColorMode } from '@/hooks/use-color-mode'
import { useCopy } from '@/hooks/use-copy'
import { mcpSnippets } from '@/lib/mcp-snippets'
import { cn } from '@/lib/utils'
import { CanvasPreview, PromptPreview, Tag, TimelinePreview, WaitingPreview } from './previews'

const REPO = 'https://github.com/eyoellundberg/openwove'
const MCP_COMMAND = mcpSnippets({ command: '/path/to/OpenWove/node_modules/.bin/tsx', args: ['/path/to/OpenWove/runner/mcp.ts'], env: {}, claudeCode: true }).claudeCode
/** The same command, broken after the `--` so it fits the card. */
const MCP_COMMAND_SHOWN = MCP_COMMAND.replace(' -- ', ' -- \\\n  ')
const INSTALL = [`git clone ${REPO}.git OpenWove`, 'cd OpenWove', 'npm install', 'npm run dev'].join('\n')

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#connect', label: 'Connect your agent' },
  { href: '#private', label: 'Privacy' },
]

export function Landing() {
  useApplyColorMode()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Nav />
      <Hero />
      <Intro />
      <Features />
      <Connect />
      <Private />
      <GetStarted />
      <Footer />
    </div>
  )
}

function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{children}</p>
}

function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-4xl font-semibold tracking-tight text-balance sm:text-5xl', className)}>{children}</h2>
}

function Brand() {
  return (
    <a href="#" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <Logo />
      OpenWove
    </a>
  )
}

function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
      <Wrap className="flex h-16 items-center gap-8">
        <Brand />
        <div className="hidden gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>
        <Button asChild size="lg" className="ml-auto rounded-full px-4">
          <a href="#start">Get started</a>
        </Button>
      </Wrap>
    </nav>
  )
}

function Hero() {
  return (
    <header className="pt-24 pb-16 text-center">
      <Wrap>
        <Tag tone="muted" className="mb-8 h-7 border-border bg-card px-3">
          <span className="size-1.5 rounded-full bg-earned" />
          Runs on your computer, with your own API key
        </Tag>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl">
          Multi-agent work, where you can see it.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
          Your agent sets up the flow. OpenWove lays it out on a canvas, runs it, and asks you before anything important
          happens.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="h-11 rounded-full px-6">
            <a href="#start">
              Get started <ArrowRightIcon data-icon="inline-end" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6">
            <a href={REPO}>View on GitHub</a>
          </Button>
        </div>
        <div className="mt-20">
          <CanvasPreview />
        </div>
      </Wrap>
    </header>
  )
}

function Intro() {
  return (
    <section className="py-28 text-center">
      <Wrap className="flex flex-col items-center gap-6">
        <Eyebrow>Introducing OpenWove</Eyebrow>
        <p className="max-w-4xl text-2xl font-medium tracking-tight text-balance sm:text-3xl">
          Coding agents can already split work across several agents.{' '}
          <span className="text-muted-foreground">
            What's missing is a place to see that plan, change it, and stay in charge while it runs.
          </span>{' '}
          OpenWove is that place.
        </p>
      </Wrap>
    </section>
  )
}

function Feature({
  eyebrow,
  title,
  body,
  points,
  flip,
  children,
}: {
  eyebrow: string
  title: string
  body: string
  points: string[]
  flip?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={cn(flip && 'md:order-2')}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading className="mt-3">{title}</Heading>
        <p className="mt-4 text-lg text-muted-foreground">{body}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex gap-3">
              <CheckIcon className="mt-1 size-4 shrink-0 text-earned" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-muted/50 p-6 sm:p-8">{children}</div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 pb-28">
      <Wrap className="flex flex-col gap-28">
        <Feature
          eyebrow="Set up"
          title="See the plan before it runs."
          body="Every step is a card: which agent, what it does, and whether it asks you before acting. Agents that work at the same time sit side by side."
          points={[
            'Drag a card beside another to run them together',
            'Open any step to read and edit its prompt',
            'Try it as a free simulated run before spending anything',
          ]}
        >
          <PromptPreview />
        </Feature>
        <Feature
          flip
          eyebrow="Live"
          title="Watch every agent, and what it costs."
          body="A timeline shows what each agent is doing right now. Every bar, agent and run shows its cost, from real token counts and list prices."
          points={[
            "Real runs use the API's own token counts",
            'Estimates are marked with "~", so you know which is which',
            'When a step fails, choose what happens next instead of starting over',
          ]}
        >
          <TimelinePreview />
        </Feature>
        <Feature
          eyebrow="Waiting for you"
          title="Nothing important happens without you."
          body="Steps that change things stop and ask, and you answer from one tray. A step asks every time until you've approved it three times in a row. Then it asks less."
          points={['Trust is earned step by step, not given to the whole flow', 'One deny and it asks every time again']}
        >
          <WaitingPreview />
        </Feature>
      </Wrap>
    </section>
  )
}

function CopyBlock({ text, children }: { text: string; children: ReactNode }) {
  const [copied, copy] = useCopy(text)
  return (
    <div className="relative rounded-xl border bg-card p-4 pr-12 text-left">
      <pre className="overflow-x-auto font-mono text-sm leading-relaxed">{children}</pre>
      <Button variant="ghost" size="icon-sm" className="absolute top-2.5 right-2.5" onClick={copy} aria-label="Copy">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

function Connect() {
  const steps = [
    <>
      Ask for multi-agent work: <em>"Turn brief.md into a landing page and a launch email."</em>
    </>,
    <>Your agent saves the flow, and it opens on the canvas.</>,
    <>
      Tweak it, press <span className="font-medium">Run flow</span>, and answer what's waiting for you.
    </>,
  ]
  return (
    <section id="connect" className="scroll-mt-16 border-y bg-muted/40 py-28">
      <Wrap className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <Eyebrow>Connect your agent</Eyebrow>
          <Heading className="mt-3">Your agent writes the flow. You run it.</Heading>
          <p className="mt-4 text-lg text-muted-foreground">
            OpenWove comes with an MCP server. Claude Code, or any agent that speaks MCP, can save a flow and open it in
            the app for you to look over. It never runs flows and never sees your key.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          <CopyBlock text={MCP_COMMAND}>
            <span className="text-muted-foreground"># Add OpenWove to Claude Code once</span>
            {`\n${MCP_COMMAND_SHOWN}`}
          </CopyBlock>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-card text-sm font-medium tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </Wrap>
    </section>
  )
}

const PRIVATE = [
  {
    icon: MonitorIcon,
    title: 'Runs locally',
    body: 'The app and its runner run on your machine. No account, and no OpenWove servers in the middle.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Bring your own key',
    body: 'Your API keys stay on your computer. Your model provider bills you directly; OpenWove never does.',
  },
  {
    icon: FolderLockIcon,
    title: 'One folder only',
    body: 'Agents read and write only inside workspace/. Nothing else on your computer is in reach.',
  },
]

function Private() {
  return (
    <section id="private" className="scroll-mt-16 py-28 text-center">
      <Wrap>
        <Eyebrow>Private by default</Eyebrow>
        <Heading className="mx-auto mt-3 max-w-2xl">Your computer. Your key. Your files.</Heading>
        <div className="mt-14 grid gap-4 text-left md:grid-cols-3">
          {PRIVATE.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader className="gap-3">
                <Icon className="mb-3 size-5" />
                <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
                <CardDescription className="text-base">{body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

function GetStarted() {
  return (
    <section id="start" className="scroll-mt-16 border-t py-28 text-center">
      <Wrap className="flex flex-col items-center">
        <Heading>Weave your first flow.</Heading>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Simulated runs are free. Add an Anthropic key when you're ready for real ones.
        </p>
        <div className="mt-10 w-full max-w-xl">
          <CopyBlock text={INSTALL}>{INSTALL}</CopyBlock>
        </div>
      </Wrap>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t py-12 text-sm text-muted-foreground">
      <Wrap className="flex flex-wrap items-center gap-6">
        <Brand />
        <span>© 2026</span>
        <div className="flex gap-6 sm:ml-auto">
          {NAV.slice(0, 2).map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
          <a href={REPO} className="hover:text-foreground">
            GitHub
          </a>
        </div>
      </Wrap>
    </footer>
  )
}
