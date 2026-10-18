import { TOOLS } from '@/lib/catalog'
import type { ToolId } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ToolIcons({ tools, className }: { tools: ToolId[]; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 gap-1', className)}>
      {tools.map((id) => (
        <span
          key={id}
          title={TOOLS[id].name}
          className={cn(
            'grid size-5 place-items-center rounded-md text-xs leading-none font-semibold text-white',
            TOOLS[id].className,
          )}
        >
          {TOOLS[id].letter}
        </span>
      ))}
    </span>
  )
}
