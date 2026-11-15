import { PageHeader } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() { return <><PageHeader title="Permission preview" /><div role="status" aria-label="Loading retrieval test" className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div></>; }
