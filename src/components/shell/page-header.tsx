import type { ReactNode } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'

/** The bar across the top of a view: what it is, a line of context, and its buttons. */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-6">
      <SidebarTrigger />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
