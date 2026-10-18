import { TriangleAlertIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFlow } from '@/lib/store'

/** A dismissible line for problems: a bad flow file, or a runner that couldn't start. */
export function Notice() {
  const notice = useFlow((s) => s.notice)
  const dismiss = useFlow((s) => s.dismissNotice)
  if (!notice) return null
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg bg-failed-subtle px-3 py-2 text-sm text-failed animate-in fade-in slide-in-from-top-1"
    >
      <TriangleAlertIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 whitespace-pre-line">{notice}</span>
      <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss">
        <XIcon />
      </Button>
    </div>
  )
}
