// Owner: C (WP-9). Skeleton rows for the audit views' loading.tsx: the toolbar and a table of
// placeholder rows at the real 40px height, so the page doesn't jump when the rows arrive.
import { PageHeader } from '@/components/shell/page-header';

export function AuditSkeleton({ description }: { description: string }) {
  return (
    <section aria-busy="true" aria-label="Loading the audit log">
      <PageHeader title="Audit log" description={description} />
      <div aria-hidden="true" className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {[208, 208, 160, 160].map((width, index) => (
            <div key={index} className="space-y-1" style={{ width }}>
              <div className="h-4 w-16 animate-pulse bg-muted" />
              <div className="h-9 rounded-md border border-border" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <div className="h-10 bg-muted" />
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex h-10 items-center gap-6 border-t border-border px-3">
              <div className="h-3 w-44 animate-pulse bg-muted" />
              <div className="h-3 w-24 animate-pulse bg-muted" />
              <div className="h-3 w-28 animate-pulse bg-muted" />
              <div className="h-3 flex-1 animate-pulse bg-muted" />
              <div className="h-3 w-24 animate-pulse bg-muted" />
              <div className="h-3 w-12 animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
