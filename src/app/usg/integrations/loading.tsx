import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function IntegrationsLoading() {
  return <>
    <PageHeader title="Management" />
    <div role="status" aria-label="Loading management data" className="space-y-2">
      <span className="sr-only">Loading management data</span>
      {[0, 1, 2, 3, 4, 5].map((row) => <Skeleton key={row} className="h-10 w-full" />)}
    </div>
  </>;
}
