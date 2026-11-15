import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicAgentLoading() {
  return <>
    <PageHeader title="Public agent" />
    <div role="status" aria-label="Loading public agent" className="space-y-3">
      <span className="sr-only">Loading public agent</span>
      <Skeleton className="h-10 w-full max-w-[720px]" />
      <Skeleton className="h-32 w-full max-w-[720px]" />
    </div>
  </>;
}
