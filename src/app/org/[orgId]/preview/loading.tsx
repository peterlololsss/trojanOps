import { PageHeader } from '@/components/shell/page-header';

export default function PreviewLoading() {
  return (
    <section aria-busy="true" aria-label="Loading permission preview">
      <PageHeader title="Permission preview" description="Loading agent permissions…" />
      <div aria-hidden="true" className="overflow-hidden rounded-md border border-border">
        <div className="h-16 bg-muted" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex h-10 items-center gap-6 border-t border-border px-3">
            <div className="h-3 w-1/4 animate-pulse bg-muted" /><div className="h-3 w-1/2 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}
