import { toolInfo } from '@/lib/catalog'
import { cn } from '@/lib/utils'

export function ToolIcons({ tools, className }: { tools: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 gap-1', className)}>
      {tools.map((id) => {
        const tool = toolInfo(id)
        return (
          <span
            key={id}
            title={tool.name}
            className="grid size-5 place-items-center rounded-md bg-muted-foreground text-xs leading-none font-semibold text-background"
          >
            {tool.letter}
          </span>
        )
      })}
    </span>
  )
}
