import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { runner } from '@/lib/runner-client'
import { useFlow } from '@/lib/store'
import type { Provider } from '@/lib/types'

const PROVIDERS: { id: Provider; name: string; note?: string }[] = [
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'openai', name: 'OpenAI', note: 'Saved for later. Runs on these models are simulated for now.' },
  { id: 'google', name: 'Google (Gemini)', note: 'Saved for later. Runs on these models are simulated for now.' },
]

function KeyRow({ provider }: { provider: (typeof PROVIDERS)[number] }) {
  const status = useFlow((s) => s.runnerStatus)
  const checkRunner = useFlow((s) => s.checkRunner)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saved = status.state === 'ready' && status.health.providers[provider.id]

  const change = async (save: boolean) => {
    setBusy(true)
    setError('')
    try {
      await (save ? runner.saveKey(provider.id, key.trim()) : runner.removeKey(provider.id))
      setKey('')
      await checkRunner()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save it.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-sm font-medium">{provider.name}</span>
        {saved ? (
          <>
            <span className="flex items-center gap-1 text-sm text-earned">
              <HugeiconsIcon icon={Tick02Icon} className="size-4" /> Saved
            </span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => change(false)}>
              Remove
            </Button>
          </>
        ) : (
          <form
            className="flex w-72 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (key.trim()) change(true)
            }}
          >
            <Input type="password" autoComplete="off" spellCheck={false} aria-label={`${provider.name} key`} placeholder="Paste a key" value={key} onChange={(e) => setKey(e.target.value)} />
            <Button type="submit" size="sm" disabled={busy || !key.trim() || status.state !== 'ready'}>
              Add
            </Button>
          </form>
        )}
      </div>
      {error && <p className="text-sm text-failed">{error}</p>}
      {!error && provider.note && saved && <p className="text-xs text-muted-foreground">{provider.note}</p>}
    </div>
  )
}

/** Add whichever keys you have. They stay on this computer. */
export function KeyList() {
  return (
    <div className="flex flex-col gap-4">
      {PROVIDERS.map((p) => (
        <KeyRow key={p.id} provider={p} />
      ))}
    </div>
  )
}
