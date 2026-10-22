import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import { useApplyColorMode } from '@/hooks/use-color-mode'
import { useCopy } from '@/hooks/use-copy'
import { setupPrompt } from '@/lib/mcp-snippets'
import { cn } from '@/lib/utils'
import { DOWNLOAD_MB, DOWNLOAD_URL, INSTALLED_MB, READY_SECONDS, REPO, VERSION } from './facts'
import { CanvasPreview, PromptPreview, TimelinePreview, WaitingPreview } from './previews'

/** The note the app hands you, with example paths. */
const SETUP_NOTE = setupPrompt({
  command: '/Applications/OpenWove.app/Contents/MacOS/node',
  args: ['/Applications/OpenWove.app/Contents/Resources/resources/mcp.mjs'],
  env: { OPENWOVE_HOME: '~/OpenWove' },
  claudeCode: true,
})

const FEATURES = [
  ['Asks until it has earned it.', 'A step asks you every time until you have approved it three times in a row. One deny and it asks again.'],
  ['Every cent in view.', 'Each bar, agent and run shows its cost, from the API’s own token counts at list prices. Guesses are marked with ~.'],
  ['Try it for free.', 'Simulated runs play back made-up work, so you can see a flow before you spend anything.'],
  ['Any key you have.', 'Add Anthropic, OpenAI or Google keys. They stay in your Keychain. Only Anthropic runs for real so far.'],
  ['One folder only.', 'Agents read and write inside a single workspace folder. Nothing else on your Mac is in reach.'],
  ['Written for you.', 'Tell it your company, where you are and your language once, and every agent writes for you.'],
  ['Plain files.', 'A flow is one JSON file with a published schema. Any agent can write one, and you can read it.'],
  ['Open source.', 'The code is on GitHub. Read it, build it yourself, or send a fix.'],
] as const

const NUMBERS = [
  [`${DOWNLOAD_MB} MB`, 'to download.', `${INSTALLED_MB} MB once it’s installed.`],
  [`${READY_SECONDS} s`, 'to ready.', 'From launch until the local runner answers. Median of three.'],
  ['0', 'accounts.', 'Nothing to sign up for, and nothing to sign in to.'],
  ['0', 'OpenWove servers.', 'The app and its runner stay on your Mac. Your key goes to your model provider and nowhere else.'],
] as const

const FAQ = [
  ['What is OpenWove?', 'A Mac app for the work your coding agent plans. Your agent writes a flow: which agents do what, in which order, and which steps ask you first. OpenWove shows it on a canvas, runs it, and stops to ask before anything important happens.'],
  ['Is it free?', 'Yes, for now. No account, no subscription. You pay your model provider for the runs you choose to make.'],
  ['Which Macs?', 'Apple silicon, on macOS 14 or later. There is no Intel build yet.'],
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
        <Numbers />
        <Features />
        <Questions />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}

function Column({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-3xl px-4 sm:px-6', className)}>{children}</div>
}

function Wide({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-4 sm:px-6', className)}>{children}</div>
}

function DownloadButton({ className }: { className?: string }) {
  return (
    <Button asChild size="lg" className={cn('h-10 rounded-full px-5', className)}>
      <a href={DOWNLOAD_URL}>
        <DownloadIcon /> Download for macOS
      </a>
    </Button>
  )
}

function Top() {
  return (
    <header className="py-5">
      <Wide className="flex items-center gap-3">
        <a href="#" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo className="size-5" />
          OpenWove
        </a>
        <span className="hidden text-sm text-muted-foreground sm:inline">· beta</span>
        <nav className="ml-auto flex items-center gap-5 text-sm text-muted-foreground">
          <a href={REPO} className="hover:text-foreground">
            GitHub
          </a>
          <Button asChild size="sm" className="rounded-full px-3.5">
            <a href={DOWNLOAD_URL}>Download</a>
          </Button>
        </nav>
      </Wide>
    </header>
  )
}

/** A Mac window around a picture of the app, so it reads as something you download. */
function Window({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-3" aria-hidden>
        <span className="size-3 rounded-full bg-failed" />
        <span className="size-3 rounded-full bg-waiting" />
        <span className="size-3 rounded-full bg-earned" />
      </div>
      {children}
    </div>
  )
}

function Hero() {
  return (
    <section className="pt-16 pb-14 sm:pt-24">
      <Column>
        <Logo className="mb-8 size-12" />
        <p className="text-xl leading-relaxed text-balance text-muted-foreground sm:text-2xl">
          <strong className="font-semibold text-foreground">OpenWove</strong> is a place to see the work your agents plan.{' '}
          <strong className="font-semibold text-foreground">Under {Math.ceil((DOWNLOAD_MB + 1) / 10) * 10} megabytes</strong>, a canvas, a
          live timeline, and a window that stops to ask before anything important happens. Free, for any Apple-silicon Mac on macOS 14 or
          later.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <DownloadButton />
          <Button asChild size="lg" variant="secondary" className="h-10 rounded-full px-5">
            <a href="#numbers">The numbers</a>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Version {VERSION} · {DOWNLOAD_MB} MB · Free · Intel Mac? Not yet.
        </p>
      </Column>
      <Wide className="mt-14">
        <Window>
          <div className="bg-background p-4 sm:p-6">
            <CanvasPreview />
          </div>
        </Window>
      </Wide>
    </section>
  )
}

function Block({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="py-12">
      <Column>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-lg text-muted-foreground">{body}</p>
      </Column>
      <Wide className="mt-8">
        <div className="rounded-2xl border bg-muted/50 p-4 sm:p-8">{children}</div>
      </Wide>
    </section>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, copy] = useCopy(text)
  return (
    <div className="relative rounded-xl border bg-card p-4 pr-12 text-left">
      <pre className="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{text}</pre>
      <Button variant="ghost" size="icon-sm" className="absolute top-2.5 right-2.5" onClick={copy} aria-label="Copy">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

function Story() {
  return (
    <>
      <Block title="Your agent writes it. You read it." body="Open any step to see the agent, its model and its whole prompt. Change what you like and your agent reads your version next time.">
        <PromptPreview />
      </Block>
      <Block title="It asks before it acts." body="A step that saves a file or sends something waits in one tray until you say yes.">
        <WaitingPreview />
      </Block>
      <Block title="Everything it does, as it does it." body="A timeline of every agent, what it’s on, and what it has cost so far.">
        <TimelinePreview />
      </Block>
      <section className="py-12">
        <Column>
          <h2 className="text-2xl font-semibold tracking-tight">Any agent can set it up.</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            Paste one note to Claude Code, Cursor or anything that speaks MCP. It adds OpenWove to itself, and from then on you just ask for the work.
          </p>
          <div className="mt-6">
            <CopyBlock text={SETUP_NOTE} />
          </div>
        </Column>
      </section>
    </>
  )
}

function Numbers() {
  return (
    <section id="numbers" className="scroll-mt-8 py-16">
      <Column>
        <h2 className="text-2xl font-semibold tracking-tight">Light enough to forget it’s there.</h2>
        <p className="mt-2 text-lg text-muted-foreground">Measured on an Apple-silicon Mac running macOS 26, from a cold start.</p>
        <dl className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {NUMBERS.map(([figure, label, note]) => (
            <div key={label}>
              <dt className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tighter tabular-nums">{figure}</span>
                <span className="text-lg font-medium">{label}</span>
              </dt>
              <dd className="mt-1 text-muted-foreground">{note}</dd>
            </div>
          ))}
        </dl>
      </Column>
    </section>
  )
}

function Features() {
  return (
    <section className="py-16">
      <Column>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FEATURES.map(([lead, body]) => (
            <li key={lead}>
              <strong className="font-semibold">{lead}</strong> <span className="text-muted-foreground">{body}</span>
            </li>
          ))}
        </ul>
      </Column>
    </section>
  )
}

function Questions() {
  return (
    <section className="py-16">
      <Column>
        <h2 className="text-2xl font-semibold tracking-tight">Questions? Answers.</h2>
        <div className="mt-6 divide-y border-y">
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
      </Column>
    </section>
  )
}

function Closing() {
  return (
    <section className="py-16">
      <Column>
        <p className="text-xl text-balance text-muted-foreground sm:text-2xl">
          OpenWove is free, for Apple-silicon Macs on macOS 14 or later. Your agent plans, you stay in charge, and nothing leaves your Mac but the
          calls you choose to make.
        </p>
        <DownloadButton className="mt-8" />
      </Column>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-10 text-sm text-muted-foreground">
      <Column className="flex flex-wrap gap-x-4 gap-y-2">
        <span>
          Version {VERSION} · {DOWNLOAD_MB} MB · Intel Mac?
        </span>
        <a href="#numbers" className="hover:text-foreground">
          The numbers
        </a>
        <a href={REPO} className="hover:text-foreground">
          GitHub
        </a>
        <span className="sm:ml-auto">© 2026 OpenWove</span>
      </Column>
    </footer>
  )
}
