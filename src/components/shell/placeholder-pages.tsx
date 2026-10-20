import { ChartNoAxesColumnIcon } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { PageHeader } from '@/components/shell/page-header'

/** A page that isn't built yet: what it will be, in a few plain words. */
function PlaceholderPage({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Icon className="size-8 text-muted-foreground" />
          <h2 className="font-medium">Coming soon</h2>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
      </div>
    </>
  )
}

export const UsagePage = () => (
  <PlaceholderPage title="Usage" subtitle="What your flows cost." icon={ChartNoAxesColumnIcon}>
    This will add up what each flow, step and model cost, from runs saved on this computer. For now, each run shows its
    cost on the Live page.
  </PlaceholderPage>
)
