import { useSyncExternalStore } from 'react'

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
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(KEY, preference)
  } catch {
    // Storage can be unavailable; the theme still switches for this visit.
  }
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
