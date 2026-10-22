import { Copy01Icon, Download01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import { useApplyColorMode } from '@/hooks/use-color-mode'
import { useCopy } from '@/hooks/use-copy'
import { setupPrompt } from '@/lib/mcp-snippets'
import { cn } from '@/lib/utils'
import { DOWNLOAD_MB, DOWNLOAD_URL, DOWNLOAD_URL_INTEL, REPO, VERSION } from './facts'
import { InteractiveApp } from './demo'
import { CanvasPreview, PromptPreview, WaitingPreview } from './previews'

/** The note the app hands you, with example paths. */
const SETUP_NOTE = setupPrompt({
  command: '/Applications/OpenWove.app/Contents/MacOS/node',
  args: ['/Applications/OpenWove.app/Contents/Resources/resources/mcp.mjs'],
  env: { OPENWOVE_HOME: '~/OpenWove' },
  claudeCode: true,
})

/** What goes wrong when agents work in the dark, and what OpenWove does about it. */
const WHY = [
  ['The plan is buried in a chat.', 'It’s a canvas: every step, every agent and its prompt, in order, with what runs at the same time.'],
  ['It acts first and tells you after.', 'It stops and asks before anything important, and asks less only once it has earned your trust.'],
  ['You learn the cost from the invoice.', 'Every step shows what it costs as it runs, from the API’s own token counts.'],
  ['You can’t tell what it actually did.', 'Every run ends in a report: what each step did, which files it touched, and what it asked you. Your agent can read it too.'],
  ['Your keys and files end up in someone else’s cloud.', 'It runs on your Mac with your own keys, and agents can only reach one folder.'],
  ['Every agent speaks its own format.', 'Flows are plain JSON with a published schema, so any agent that speaks MCP can write one.'],
] as const

const FEATURES = [
  ['Asks until it has earned it.', 'A step asks you every time until you have approved it three times in a row. One deny and it asks again.'],
  ['Try it for free.', 'Simulated runs play back made-up work, so you can see a flow before you spend anything.'],
  ['Any key you have.', 'Add Anthropic, OpenAI or Google keys. They stay in your Keychain. Only Anthropic runs for real so far.'],
  ['Written for you.', 'Tell it your company, where you are and your language once, and every agent writes for you.'],
  ['Review with your agent.', 'Run reports and flow files follow published JSON Schemas, so your agent can check the work and suggest changes.'],
  ['Open source.', 'The code is on GitHub under the MIT license. Read it, build it yourself, or send a fix.'],
] as const

const FAQ = [
  ['What is OpenWove?', 'A Mac app for the work your coding agent plans. Your agent writes a flow: which agents do what, in which order, and which steps ask you first. OpenWove shows it on a canvas, runs it, and stops to ask before anything important happens.'],
  ['Is it free?', 'Yes, for now. No account, no subscription. You pay your model provider for the runs you choose to make.'],
  ['Which Macs?', 'Any Mac on macOS 14 or later. The main download is for Apple silicon (M1 and later); Intel Macs have a download of their own.'],
  ['Why does macOS say it can’t verify it?', 'It’s a beta, and not signed with an Apple developer certificate yet. Open System Settings › Privacy & Security, scroll down, and press Open Anyway. You only do it once. We’ll sign it before 1.0.'],
  ['What happens to my API key?', 'It goes in your Mac’s Keychain and is used only by the runner on your Mac. It leaves your computer only in calls to the provider you added it for.'],
  ['Which models run for real?', 'Claude, through Anthropic. OpenAI and Google keys can be saved, but flows that use those models play back as simulations for now.'],
  ['How does my agent connect?', 'The app has a note you paste to your agent once. It adds OpenWove to itself. Claude Code, Cursor and anything else that speaks MCP can do it.'],
  ['What can agents touch?', 'Only the OpenWove folder in your home directory, and inside it only the workspace folder for file steps.'],
  ['Does it sync?', 'No. Everything stays on the Mac it runs on.'],
  ['How do updates work?', 'Download the new version and drop it over the old one. Your flows, runs and settings live in your OpenWove folder, so they stay.'],
] as const

export function Landing() {
  useApplyColorMode()
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Top />
      <main>
        <Hero />
        <Story />
        <Why />
        <Features />
        <Questions />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}

/** One box for the whole page, so every section shares the same left edge. Text inside is kept to a readable width. */
function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}

function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-3xl font-semibold tracking-tighter text-balance sm:text-4xl', className)}>{children}</h2>
}

function DownloadButton({ className }: { className?: string }) {
  return (
    <Button asChild size="lg" className={cn('h-10 rounded-full px-5', className)}>
      <a href={DOWNLOAD_URL}>
        <HugeiconsIcon icon={Download01Icon} /> Download for macOS
      </a>
    </Button>
  )
}

function Top() {
  return (
    <header className="py-5">
      <Wrap className="flex items-center gap-3">
        <a href="#" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo className="size-5" />
          OpenWove
        </a>
        <span className="hidden text-sm text-muted-foreground sm:inline">· beta</span>
        <nav className="ml-auto flex items-center gap-5 text-sm text-muted-foreground">
          <a href="#why" className="hover:text-foreground">
            Why?
          </a>
          <a href={REPO} className="hover:text-foreground">
            GitHub
          </a>
          <Button asChild size="sm" className="rounded-full px-3.5">
            <a href={DOWNLOAD_URL}>Download</a>
          </Button>
        </nav>
      </Wrap>
    </header>
  )
}

/** The hero line, word by word, so it arrives the way events do in the app. */
const HERO_WORDS = [
  ...'OpenWove'.split(' ').map((text) => ({ text, bold: true })),
  ...'is a place to see the work your agents plan.'.split(' ').map((text) => ({ text, bold: false })),
  ...'Under 40 megabytes,'.split(' ').map((text) => ({ text, bold: true })),
  ...'a canvas, a live timeline, and a window that stops to ask before anything important happens.'.split(' ').map((text) => ({ text, bold: false })),
]
/** Seconds between one word and the next, and where the blocks after the title start. */
const WORD_DELAY = 0.035
const AFTER_TITLE = HERO_WORDS.length * WORD_DELAY + 0.1

const delay = (seconds: number) => ({ animationDelay: `${seconds.toFixed(2)}s` })

function Hero() {
  return (
    <section className="pt-16 pb-16 sm:pt-24">
      <Wrap>
        <Logo className="reveal mb-8 size-12" />
        <p className="max-w-3xl text-2xl leading-snug font-medium tracking-tighter text-muted-foreground sm:text-4xl">
          {HERO_WORDS.map((word, i) => (
            <span key={i}>
              <span className={cn('reveal inline-block', word.bold && 'font-semibold text-foreground')} style={delay(0.05 + i * WORD_DELAY)}>
                {word.text}
              </span>{' '}
            </span>
          ))}
        </p>
        <p className="reveal mt-5 max-w-2xl text-lg text-muted-foreground" style={delay(AFTER_TITLE)}>
          Free, for any Mac on macOS 14 or later, Apple silicon or Intel.
        </p>
        <div className="reveal mt-8 flex flex-wrap items-center gap-3" style={delay(AFTER_TITLE + 0.15)}>
          <DownloadButton />
          <Button asChild size="lg" variant="secondary" className="h-10 rounded-full px-5">
            <a href="#why">Why?</a>
          </Button>
        </div>
        <p className="reveal mt-4 text-sm text-muted-foreground" style={delay(AFTER_TITLE + 0.3)}>
          Version {VERSION} · {DOWNLOAD_MB} MB · Free ·{' '}
          <a href={DOWNLOAD_URL_INTEL} className="underline underline-offset-4 hover:text-foreground">
            Intel Mac?
          </a>
        </p>
        <div className="reveal mt-14" style={delay(AFTER_TITLE + 0.45)}>
          <InteractiveApp />
        </div>
      </Wrap>
    </section>
  )
}

function Block({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="py-12">
      <Wrap>
        <Heading>{title}</Heading>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{body}</p>
        <div className="mt-8 rounded-2xl border bg-muted/50 p-4 sm:p-8">{children}</div>
      </Wrap>
    </section>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, copy] = useCopy(text)
  return (
    <div className="relative rounded-xl border bg-card p-4 pr-12 text-left">
      <pre className="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{text}</pre>
      <Button variant="ghost" size="icon-sm" className="absolute top-2.5 right-2.5" onClick={copy} aria-label="Copy">
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} />
      </Button>
    </div>
  )
}

function Story() {
  return (
    <>
      <Block title="Your agent writes the plan. You see it." body="Steps run in stages, and the ones in the same stage run at the same time. Each card says who does it, on which model, and what it costs.">
        <CanvasPreview />
      </Block>
      <Block title="Every prompt, readable." body="Open any step to see the agent, its model and its whole prompt. Change what you like and your agent reads your version next time.">
        <PromptPreview />
      </Block>
      <Block title="It asks before it acts." body="A step that saves a file or sends something waits in one tray until you say yes.">
        <WaitingPreview />
      </Block>
      <section className="py-12">
        <Wrap>
          <Heading>Any agent can set it up.</Heading>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Paste one note to Claude Code, Cursor or anything that speaks MCP. It adds OpenWove to itself, and from then on you just ask for
            the work.
          </p>
          <div className="mt-6 max-w-3xl">
            <CopyBlock text={SETUP_NOTE} />
          </div>
        </Wrap>
      </section>
    </>
  )
}

function Why() {
  return (
    <section id="why" className="scroll-mt-8 py-16">
      <Wrap>
        <Heading>Why?</Heading>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Coding agents are good at splitting work across several agents. They’re not good at showing you what they’re doing.
        </p>
        <div className="mt-10 divide-y border-y">
          {WHY.map(([problem, answer]) => (
            <div key={problem} className="grid gap-2 py-6 md:grid-cols-2 md:gap-10">
              <h3 className="text-lg font-medium tracking-tight text-muted-foreground">{problem}</h3>
              <p className="text-lg">{answer}</p>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

function Features() {
  return (
    <section className="py-16">
      <Wrap>
        <ul className="grid max-w-4xl gap-x-10 gap-y-6 sm:grid-cols-2">
          {FEATURES.map(([lead, body]) => (
            <li key={lead}>
              <strong className="font-semibold">{lead}</strong> <span className="text-muted-foreground">{body}</span>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  )
}

function Questions() {
  return (
    <section className="py-16">
      <Wrap>
        <Heading>Questions? Answers.</Heading>
        <div className="mt-6 max-w-3xl divide-y border-y">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {question}
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </Wrap>
    </section>
  )
}

function Closing() {
  return (
    <section className="py-16">
      <Wrap>
        <p className="max-w-3xl text-2xl font-medium tracking-tighter text-balance text-muted-foreground sm:text-3xl">
          OpenWove is free, for Macs on macOS 14 or later. Your agent plans, you stay in charge, and nothing leaves your Mac
          but the calls you choose to make.
        </p>
        <DownloadButton className="mt-8" />
      </Wrap>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-10 text-sm text-muted-foreground">
      <Wrap className="flex flex-wrap gap-x-4 gap-y-2">
        <span>
          Version {VERSION} · {DOWNLOAD_MB} MB ·{' '}
          <a href={DOWNLOAD_URL_INTEL} className="underline underline-offset-4 hover:text-foreground">
            Intel Mac?
          </a>
        </span>
        <a href="#why" className="hover:text-foreground">
          Why?
        </a>
        <a href={REPO} className="hover:text-foreground">
          GitHub
        </a>
        <span className="sm:ml-auto">© 2026 OpenWove</span>
      </Wrap>
    </footer>
  )
}
