import { useEffect, useState } from 'react'

const COPIED_MS = 1500

/** Copies `text` to the clipboard and says so for a moment. Clipboard access can be refused; the text is still there to select. */
export function useCopy(text: string): [copied: boolean, copy: () => void] {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(t)
  }, [copied])
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }
  return [copied, copy]
}
