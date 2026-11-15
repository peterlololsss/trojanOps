'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LibraryDocument, Tier } from '@/lib/contracts';
import type { LibraryPageData } from '@/lib/documents/library-page';
import {
  changeFilter, formatPacific, initialQuery, tierLabels, tierOptions, viewLibrary,
} from '@/lib/documents/library-view';
import { DataTable } from './data-table';
import { fieldClass, UploadForm } from './upload-form';

const features = tableFeatures({});
const column = createColumnHelper<typeof features, LibraryDocument>();
const columns = column.columns([
  column.accessor('title', { id: 'title', header: 'Title' }),
  column.accessor('sourceName', { id: 'source', header: 'Source' }),
  column.accessor('tier', {
    id: 'tier',
    header: 'Tier',
    cell: ({ getValue }) => {
      const tier = getValue();
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-border px-2 text-xs">
          {tier === 'public' ? <FileText aria-hidden className="size-3" /> : <Lock aria-hidden className="size-3" />}
          {tierLabels[tier]}
        </span>
      );
    },
  }),
  column.accessor('version', { id: 'version', header: 'Version' }),
  column.accessor('createdAt', {
    id: 'uploaded',
    header: 'Uploaded',
    cell: ({ getValue }) => <time dateTime={getValue().toISOString()}>{formatPacific(getValue())}</time>,
  }),
]);

export function DocumentLibrary({ data }: { data: LibraryPageData }) {
  const [query, setQuery] = useState(initialQuery);
  const view = useMemo(() => viewLibrary(data.documents, query), [data.documents, query]);
  const table = useTable({ features, columns, data: view.rows, getRowId: (doc) => doc.id });
  const clearFilters = () => setQuery(changeFilter(query, { search: '', tier: '' }));

  return (
    <div className="space-y-6">
      {data.canUpload ? <UploadForm data={data} /> : (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Only this club’s president can upload documents, with this club active. Ask your president to upload, or{' '}
            <Link href="/" className="text-primary underline">switch your persona or active club</Link>.
          </span>
        </p>
      )}
      <section aria-label="Document library">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="w-72 max-w-full space-y-1">
            <span className="block font-semibold">Search documents</span>
            <input
              type="search"
              value={query.search}
              onChange={(event) => setQuery(changeFilter(query, { search: event.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="w-44 space-y-1">
            <span className="block font-semibold">Tier</span>
            <select
              value={query.tier}
              onChange={(event) => setQuery(changeFilter(query, { tier: event.target.value as Tier | '' }))}
              className={fieldClass}
            >
              <option value="">All tiers</option>
              {tierOptions(data.org.kind).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {view.filtered && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
          <p role="status" className="pb-2 text-muted-foreground">{view.matching} of {view.total} documents</p>
        </div>
        <DataTable
          table={table}
          caption={`Documents you can read in ${data.org.name}, newest first`}
          numericColumns={['version']}
          monoColumns={['uploaded']}
          rowHeaderColumn="title"
          sorted={{ id: 'uploaded', direction: 'desc' }}
          empty={view.empty === 'nothing-yet'
            ? 'No documents are available to you yet. Ask the club president to upload a document with access for your position.'
            : <>No documents match these filters. <button className="text-primary underline" onClick={clearFilters}>Clear filters</button>.</>}
        />
        {view.pageCount > 1 && (
          <nav aria-label="Document pages" className="mt-3 flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" disabled={view.page === 0} onClick={() => setQuery({ ...query, page: view.page - 1 })}>Previous</Button>
            <span>Page {view.page + 1} of {view.pageCount}</span>
            <Button variant="secondary" size="sm" disabled={view.page === view.pageCount - 1} onClick={() => setQuery({ ...query, page: view.page + 1 })}>Next</Button>
          </nav>
        )}
      </section>
    </div>
  );
}
