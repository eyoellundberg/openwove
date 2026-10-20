import {
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleDashedIcon,
  CreditCardIcon,
  HardDriveIcon,
  KeyRoundIcon,
  LogOutIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setThemePreference, useThemePreference, type ThemePreference } from '@/hooks/use-color-mode'
import { useFlow } from '@/lib/store'
import type { Provider, RunMode } from '@/lib/types'
import { cn } from '@/lib/utils'

const PROVIDERS: { id: Provider; name: string; env: string }[] = [
  { id: 'anthropic', name: 'Anthropic (Claude)', env: 'ANTHROPIC_API_KEY' },
  { id: 'openai', name: 'OpenAI', env: 'OPENAI_API_KEY' },
  { id: 'google', name: 'Google (Gemini)', env: 'GOOGLE_API_KEY' },
]

function Group({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {title && <h3 className="font-medium">{title}</h3>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}

function General() {
  const theme = useThemePreference()
  const defaultMode = useFlow((s) => s.defaultMode)
  const setDefaultMode = useFlow((s) => s.setDefaultMode)

  return (
    <div className="flex flex-col gap-8">
      <Group title="Appearance">
        <Row label="Theme">
          <Select value={theme} onValueChange={(v) => setThemePreference(v as ThemePreference)}>
            <SelectTrigger aria-label="Theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Match my computer</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Group>
      <Group title="Runs" description="Simulated runs play back made-up work for free. Real runs call models and cost money.">
        <Row label="Start in">
          <Select value={defaultMode} onValueChange={(v) => setDefaultMode(v as RunMode)}>
            <SelectTrigger aria-label="Default run mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simulated">Simulated run</SelectItem>
              <SelectItem value="real">Real run</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Group>
    </div>
  )
}

function ProviderRow({ provider }: { provider: (typeof PROVIDERS)[number] }) {
  const status = useFlow((s) => s.runnerStatus)
  const ready = status.state === 'ready'
  const connected = status.state === 'ready' && status.health.providers[provider.id]
  const runsForReal = provider.id === 'anthropic'
  const Icon = connected ? CheckIcon : runsForReal && ready ? CircleAlertIcon : CircleDashedIcon
  const note = !runsForReal
    ? 'Runs in simulated mode only for now'
    : !ready
      ? 'Start the runner to check'
      : connected
        ? 'Key found'
        : `Add ${provider.env} to .env.local, then restart the runner`

  return (
    <div className="flex items-center gap-3">
      <Icon className={cn('size-4', connected ? 'text-earned' : runsForReal && ready ? 'text-waiting' : 'text-muted-foreground')} />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm">{provider.name}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
    </div>
  )
}

function Models() {
  return (
    <Group description="Put keys in the .env.local file next to the app. The runner reads them when it starts, and Agent Flow never stores them.">
      <div className="flex flex-col gap-3">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.id} provider={p} />
        ))}
      </div>
    </Group>
  )
}

function Runner() {
  const status = useFlow((s) => s.runnerStatus)
  const claude = useFlow((s) => s.claudeStatus)

  return (
    <Group description="The small local program that runs flows and keeps their files.">
      <div className="flex flex-col gap-3 text-sm">
        <Row label="Status">
          <span className="text-muted-foreground">
            {status.state === 'ready' ? 'Running' : status.state === 'checking' ? 'Looking…' : 'Not running (npm run runner)'}
          </span>
        </Row>
        {status.state === 'ready' && claude && (
          <Row label="Claude">
            <span className="text-muted-foreground">{claude.text}</span>
          </Row>
        )}
        {status.state === 'ready' && (
          <div className="flex flex-col gap-1">
            <span>Files go to</span>
            <code className="rounded-lg border bg-muted p-2 font-mono text-xs break-all select-all">{status.health.workspace}</code>
          </div>
        )}
      </div>
    </Group>
  )
}

function YourAgent() {
  const openSetup = useFlow((s) => s.openSetup)
  const openSettings = useFlow((s) => s.openSettings)
  return (
    <Group description="Let Claude Code, Cursor or another agent set up and read your flows.">
      <div>
        <Button
          variant="outline"
          onClick={() => {
            openSettings(false)
            openSetup(true)
          }}
        >
          Connect your agent
        </Button>
      </div>
    </Group>
  )
}


/** Nothing here works yet: there is nothing to bill while Agent Flow runs only on your computer. */
function Billing() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Coming soon. Agent Flow doesn’t bill you. Your model providers bill you directly for what your runs use. When
        Usage is ready, spend will show up here too.
      </p>
      <div>
        <Button variant="outline" disabled>
          Manage billing
        </Button>
      </div>
    </div>
  )
}

/** Nothing here works yet: there are no accounts while Agent Flow runs only on your computer. */
function Account() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Coming soon. You’re not signed in: Agent Flow runs on your computer without an account. This will appear if you
        use a hosted version.
      </p>
      <Group
        title="Delete account"
        description="There’s no account to delete yet. Your flows and files stay on this computer, in the flows and workspace folders."
      >
        <div>
          <Button variant="destructive" disabled>
            Delete account
          </Button>
        </div>
      </Group>
    </div>
  )
}

const SECTIONS: { id: string; name: string; icon: ComponentType<{ className?: string }>; content: ComponentType }[] = [
  { id: 'general', name: 'General', icon: SlidersHorizontalIcon, content: General },
  { id: 'models', name: 'Models and keys', icon: KeyRoundIcon, content: Models },
  { id: 'runner', name: 'Runner', icon: HardDriveIcon, content: Runner },
  { id: 'agent', name: 'Your agent', icon: BotIcon, content: YourAgent },
  { id: 'billing', name: 'Billing', icon: CreditCardIcon, content: Billing },
  { id: 'account', name: 'Account', icon: UserRoundIcon, content: Account },
]

export function SettingsDialog() {
  const open = useFlow((s) => s.settingsOpen)
  const openSettings = useFlow((s) => s.openSettings)
  const [active, setActive] = useState(SECTIONS[0].id)
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]
  const Content = current.content

  return (
    <Dialog open={open} onOpenChange={openSettings}>
      <DialogContent className="max-h-svh gap-0 overflow-hidden p-0 sm:h-120 sm:max-w-3xl">
        <DialogDescription className="sr-only">Settings are kept on this computer.</DialogDescription>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav aria-label="Settings sections" className="flex shrink-0 flex-col gap-1 border-b bg-muted/40 p-3 sm:w-52 sm:border-r sm:border-b-0">
            <DialogTitle className="px-2 py-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">Settings</DialogTitle>
            <div className="flex gap-1 sm:flex-col">
              {SECTIONS.map(({ id, name, icon: Icon }) => (
                <Button
                  key={id}
                  variant={active === id ? 'secondary' : 'ghost'}
                  className="justify-start"
                  aria-current={active === id ? 'page' : undefined}
                  onClick={() => setActive(id)}
                >
                  <Icon />
                  {name}
                </Button>
              ))}
            </div>
            {/* Nothing to log out of until there is a hosted version with accounts. */}
            <Button variant="ghost" className="mt-auto justify-start text-muted-foreground" disabled>
              <LogOutIcon />
              Log out
            </Button>
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
            <h2 className="text-xl font-semibold">{current.name}</h2>
            <Content />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
