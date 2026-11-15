import { Skeleton } from '@/components/ui/skeleton';

/** The workspace's three columns: rail, chat and run details. */
export default function MyAgentsLoading() {
  return <div role="status" aria-label="Loading your agents" aria-busy="true" className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
    <span className="sr-only">Loading your agents</span>
    <div className="w-full shrink-0 space-y-4 border-b border-sidebar-border px-4 py-4 lg:w-[272px] lg:border-r lg:border-b-0">
      <Skeleton className="mb-6 h-6 w-24" />
      {[0, 1].map((group) => <div key={group} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        {[0, 1].map((row) => <div key={row} className="space-y-2 rounded-md border border-sidebar-border p-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-28" />
        </div>)}
      </div>)}
    </div>
    <div className="flex min-h-[480px] min-w-0 flex-1 flex-col lg:min-h-0">
      <div className="border-b border-border py-4">
        <div className="mx-auto w-full max-w-[760px] space-y-2 px-6">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-8"><div className="w-full max-w-prose space-y-3"><Skeleton className="mb-6 h-7 w-56 max-w-full" />{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div></div>
      <div className="mx-auto w-full max-w-[760px] px-6 pb-4"><Skeleton className="h-[92px] w-full" /></div>
    </div>
    <div className="hidden w-[320px] shrink-0 space-y-3 border-l border-border px-4 py-3 lg:block">
      <Skeleton className="h-5 w-24" />
    </div>
  </div>;
}
