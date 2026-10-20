/**
 * Browser storage that may be blocked or missing (private windows, sandboxed pages):
 * reads come back null and writes fail quietly, so the app goes on without remembering.
 */
type Kind = 'local' | 'session'

const storage = (kind: Kind) => (kind === 'local' ? localStorage : sessionStorage)

export function readStored(kind: Kind, key: string): string | null {
  try {
    return storage(kind).getItem(key)
  } catch {
    return null
  }
}

/** `null` removes the key. */
export function writeStored(kind: Kind, key: string, value: string | null) {
  try {
    if (value == null) storage(kind).removeItem(key)
    else storage(kind).setItem(key, value)
  } catch {
    // Nothing to do: it just won't be remembered next time.
  }
}
