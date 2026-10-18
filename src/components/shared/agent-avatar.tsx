import { cva, type VariantProps } from 'class-variance-authority'
import { useAgent } from '@/lib/store'
import type { Provider } from '@/lib/types'
import { cn } from '@/lib/utils'

const MARK: Record<Provider, { glyph: string; className: string }> = {
  anthropic: { glyph: '✳', className: 'text-vendor-anthropic' },
  openai: { glyph: '◎', className: 'text-vendor-openai' },
  google: { glyph: '✦', className: 'text-vendor-google' },
}

const avatarVariants = cva('grid shrink-0 place-items-center rounded-lg border bg-card select-none', {
  variants: {
    size: {
      sm: 'size-7 text-sm',
      md: 'size-9 text-lg',
    },
  },
  defaultVariants: { size: 'md' },
})

export function AgentAvatar({
  agent,
  size,
  className,
}: { agent: string; className?: string } & VariantProps<typeof avatarVariants>) {
  const mark = MARK[useAgent(agent).provider]
  return (
    <span aria-hidden className={cn(avatarVariants({ size }), mark.className, className)}>
      {mark.glyph}
    </span>
  )
}
