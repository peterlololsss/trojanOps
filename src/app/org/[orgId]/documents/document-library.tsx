'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowDown, FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LibraryPageData } from '@/lib/documents/library-page';
import { fieldClass, tierLabels, UploadForm } from './upload-form';
const timestamp = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: 'America/Los_Angeles', timeZoneName: 'short',
});
const pageSize = 10;

export function DocumentLibrary({ data }: { data: LibraryPageData }) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(0);
  const query = search.trim().toLowerCase();
  const filtered = data.documents.filter((doc) => (!tier || doc.tier === tier)
    && `${doc.title} ${doc.sourceName}`.toLowerCase().includes(query));
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function clearFilters() {
    setSearch('');
    setTier('');
    setPage(0);
  }

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
            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className={fieldClass} />
          </label>
          <label className="w-44 space-y-1">
            <span className="block font-semibold">Tier</span>
            <select value={tier} onChange={(event) => { setTier(event.target.value); setPage(0); }} className={fieldClass}>
              <option value="">All tiers</option>
              {Object.entries(tierLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {(search || tier) && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
          <p role="status" className="pb-2 text-muted-foreground">{filtered.length} of {data.documents.length} documents</p>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">Documents you can read in {data.org.name}, newest first</caption>
            <thead className="bg-muted">
              <tr className="h-10">
                <th scope="col" className="px-3 font-semibold">Title</th>
                <th scope="col" className="px-3 font-semibold">Source</th>
                <th scope="col" className="px-3 font-semibold">Tier</th>
                <th scope="col" className="px-3 text-right font-semibold">Version</th>
                <th scope="col" aria-sort="descending" className="px-3 font-semibold">
                  <span className="inline-flex items-center gap-1">Uploaded <ArrowDown aria-hidden className="size-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => (
                <tr key={doc.id} className="h-10 border-t border-border hover:bg-accent">
                  <th scope="row" className="px-3 py-2 font-semibold">{doc.title}</th>
                  <td className="px-3 py-2">{doc.sourceName}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-border px-2 text-xs">
                      {doc.tier === 'public' ? <FileText aria-hidden className="size-3" /> : <Lock aria-hidden className="size-3" />}
                      {tierLabels[doc.tier]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{doc.version}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    <time dateTime={doc.createdAt.toISOString()}>{timestamp.format(doc.createdAt)}</time>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {data.documents.length === 0
                    ? 'No documents are available to you yet. Ask the club president to upload a document with access for your position.'
                    : <>No documents match these filters. <button className="text-primary underline" onClick={clearFilters}>Clear filters</button>.</>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > pageSize && (
          <nav aria-label="Document pages" className="mt-3 flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span>Page {currentPage + 1} of {lastPage + 1}</span>
            <Button variant="secondary" size="sm" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </nav>
        )}
      </section>
    </div>
  );
}
