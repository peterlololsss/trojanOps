import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyAgentsLoading() {
  return <>
    <PageHeader title="My agents" />
    <div role="status" aria-label="Loading your agents" className="space-y-2">
      <span className="sr-only">Loading your agents</span>
      <Skeleton className="mb-4 h-7 w-48 max-w-full" />
      {[0, 1, 2].map((row) => <Skeleton key={row} className="h-10 w-full" />)}
    </div>
  </>;
}
