/**
 * API keys. In the Mac app they live in the Keychain, under the name OpenWove; run from source, they
 * live in .env.local like before. Keys already in the environment win, so existing setups keep working.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Provider } from '../src/lib/types'
import { ROOT } from './flows'

const SERVICE = 'OpenWove'
const ENV_FILE = join(ROOT, '.env.local')
const ENV_NAMES: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
}
export const PROVIDER_IDS = Object.keys(ENV_NAMES) as Provider[]
/** The app sets OPENWOVE_HOME; the Keychain is only used there. */
const useKeychain = process.platform === 'darwin' && Boolean(process.env.OPENWOVE_HOME)
/** Every provider's key is made of these; anything else would need quoting for the Keychain. */
const KEY_SHAPE = /^[\w.-]{8,300}$/

const security = (args: string[], input?: string) =>
  execFileSync('security', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'ignore'] }).trim()

function fromKeychain(provider: Provider): string | undefined {
  try {
    return security(['find-generic-password', '-a', ENV_NAMES[provider], '-s', SERVICE, '-w']) || undefined
  } catch {
    return undefined
  }
}

// Imports run before the runner's own code, so read the file here too.
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)

const keys: Partial<Record<Provider, string>> = {}
for (const p of PROVIDER_IDS) keys[p] = process.env[ENV_NAMES[p]] || (useKeychain ? fromKeychain(p) : undefined)

export const getKey = (provider: Provider) => keys[provider]

/** Rewrites one line of .env.local, leaving the rest as it was. */
function writeEnvFile(name: string, value: string | null) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split('\n') : []
  const kept = lines.filter((l) => !l.startsWith(`${name}=`) && l !== '')
  if (value != null) kept.push(`${name}=${value}`)
  writeFileSync(ENV_FILE, `${kept.join('\n')}\n`, { mode: 0o600 })
}

/** Saves a key, or returns what's wrong with it. */
export function setKey(provider: Provider, key: string): string | null {
  if (!KEY_SHAPE.test(key)) return 'That doesn’t look like an API key. Paste just the key, with no spaces.'
  if (useKeychain) {
    // Through security's own prompt on stdin, so the key never shows up in the process list.
    security(['-i'], `add-generic-password -a ${ENV_NAMES[provider]} -s ${SERVICE} -w ${key} -U\n`)
  } else {
    writeEnvFile(ENV_NAMES[provider], key)
  }
  keys[provider] = key
  return null
}

export function removeKey(provider: Provider) {
  if (useKeychain) {
    try {
      security(['delete-generic-password', '-a', ENV_NAMES[provider], '-s', SERVICE])
    } catch {
      // It wasn't there.
    }
  } else {
    writeEnvFile(ENV_NAMES[provider], null)
  }
  delete keys[provider]
}
