import { PageHeader } from '@/components/shell';

export default function CatalogLoading() {
  return (
    <section aria-busy="true" aria-label="Loading the catalog">
      <PageHeader title="Catalog" description="Loading this club's agents…" />
      <div className="overflow-hidden rounded-md border border-border" aria-hidden="true">
        <div className="h-10 border-b border-border bg-muted" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex h-10 items-center gap-6 border-b border-border px-3 last:border-0">
            <div className="h-3 w-1/4 animate-pulse bg-muted" />
            <div className="h-3 w-1/3 animate-pulse bg-muted" />
            <div className="h-3 w-1/6 animate-pulse bg-muted" />
            <div className="h-3 w-1/6 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}
