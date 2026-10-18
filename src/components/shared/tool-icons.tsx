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
            className={cn(
              'grid size-5 place-items-center rounded-md text-xs leading-none font-semibold text-white',
              tool.className,
            )}
          >
            {tool.letter}
          </span>
        )
      })}
    </span>
  )
}
