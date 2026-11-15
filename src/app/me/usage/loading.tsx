import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <><PageHeader title="Usage" /><div aria-label="Loading usage" role="status" className="space-y-4"><span className="sr-only">Loading usage</span><Skeleton className="h-16 w-full" />{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></>;
}
