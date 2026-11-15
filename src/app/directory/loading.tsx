import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function DirectoryLoading() {
  return <>
    <PageHeader title="Directory" />
    <div role="status" aria-label="Loading public agents" className="space-y-2">
      <span className="sr-only">Loading public agents</span>
      {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-10 w-full" />)}
    </div>
  </>;
}
