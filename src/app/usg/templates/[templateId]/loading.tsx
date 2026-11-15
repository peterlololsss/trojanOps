import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return <div role="status" aria-label="Loading template" className="space-y-6"><span className="sr-only">Loading template</span>
    <div className="space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-9 w-72" /><Skeleton className="h-6 w-96 max-w-full" /></div>
    <Skeleton className="h-10 w-full" />
    <div className="grid gap-8 lg:grid-cols-[minmax(0,640px)_1fr]">
      <div className="space-y-4">{[0, 1, 2, 3].map(row => <Skeleton key={row} className="h-24 w-full" />)}</div>
      <Skeleton className="h-[520px] w-full" />
    </div></div>;
}
