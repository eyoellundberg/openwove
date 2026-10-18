import { useSyncExternalStore } from 'react'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

const subscribe = (onChange: () => void) => {
  const q = query()
  q.addEventListener('change', onChange)
  return () => q.removeEventListener('change', onChange)
}

/** Follows the system light/dark setting. */
export function useColorMode(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, () => (query().matches ? 'dark' : 'light'))
}
