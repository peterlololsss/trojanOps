import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return <><PageHeader title="Agent templates" /><div role="status" aria-label="Loading templates" className="space-y-4"><span className="sr-only">Loading templates</span>
    <Skeleton className="h-9 w-full max-w-sm" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(card => <Skeleton key={card} className="h-56 w-full rounded-md" />)}</div></div></>;
}
