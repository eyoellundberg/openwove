import { useEffect, useSyncExternalStore } from 'react'
import { readStored, writeStored } from '@/lib/storage'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'agent-flow-theme'
const query = () => window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

const subscribe = (onChange: () => void) => {
  listeners.add(onChange)
  const q = query()
  q.addEventListener('change', onChange)
  return () => {
    listeners.delete(onChange)
    q.removeEventListener('change', onChange)
  }
}

const readPreference = (): ThemePreference => {
  const saved = readStored('local', KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function setThemePreference(preference: ThemePreference) {
  writeStored('local', KEY, preference)
  listeners.forEach((l) => l())
}

/** What you picked in Settings: follow the system, or always light or dark. */
export const useThemePreference = () => useSyncExternalStore(subscribe, readPreference, () => 'system' as const)

/** The theme to show: your pick, or the system's when you picked "system". */
export function useColorMode(): 'light' | 'dark' {
  const preference = useThemePreference()
  const system = useSyncExternalStore(subscribe, () => (query().matches ? 'dark' : 'light'))
  return preference === 'system' ? system : preference
}

/** Puts the `dark` class on <html>, which the theme tokens key off. */
export function useApplyColorMode() {
  const colorMode = useColorMode()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark')
  }, [colorMode])
}
