// Owner: B (WP-7). The club admin page reads the roster and one quota row per member, so its first
// paint is a skeleton of the two tables it is about to show.
import { PageHeader } from '@/components/shell';

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-border" aria-hidden="true">
      <div className="h-10 border-b border-border bg-muted" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-10 items-center gap-6 border-b border-border px-3 last:border-0">
          <div className="h-3 w-1/4 animate-pulse bg-muted" />
          <div className="h-3 w-1/5 animate-pulse bg-muted" />
          <div className="h-3 w-1/6 animate-pulse bg-muted" />
          <div className="h-3 w-1/6 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default function ClubAdminLoading() {
  return (
    <section aria-busy="true" aria-label="Loading this club's roster and budgets">
      <PageHeader title="Manage club" description="Loading this club's positions, members and budgets…" />
      <div className="space-y-8">
        <div className="max-w-[640px] space-y-3 rounded-md border border-border p-4" aria-hidden="true">
          <div className="h-3 w-48 animate-pulse bg-muted" />
          <div className="h-2 w-full bg-border" />
        </div>
        <SkeletonTable rows={4} />
        <SkeletonTable rows={5} />
      </div>
    </section>
  );
}
