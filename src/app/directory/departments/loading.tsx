import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function DepartmentsLoading() {
  return <>
    <PageHeader title="Departments" />
    <div role="status" aria-label="Loading departments" className="space-y-2">
      <span className="sr-only">Loading departments</span>
      {[0, 1, 2].map((row) => <Skeleton key={row} className="h-14 w-full" />)}
    </div>
  </>;
}
