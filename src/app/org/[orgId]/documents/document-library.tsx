'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tier } from '@/lib/contracts';
import type { KnowledgeLibrary, KnowledgeDocument } from '@/lib/documents/knowledge-library';
import { changeFilter, formatPacific, initialQuery, tierOptions, viewLibrary } from '@/lib/documents/library-view';
import { DataTable } from '@/components/inspector/data-table';
import { fieldClass } from '@/components/inspector/field';
import { IndexRefresh, IndexStatusBadge } from '@/components/inspector/index-status';
import { UploadForm } from './upload-form';

const features = tableFeatures({});
const column = createColumnHelper<typeof features, KnowledgeDocument>();

export function DocumentLibrary({ data }: { readonly data: KnowledgeLibrary }) {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const narrowed = useMemo(() => data.documents.filter((d) => (!source || d.sourceId === source) && (!status || d.index.state === status)), [data.documents, source, status]);
  const view = useMemo(() => viewLibrary(narrowed, query), [narrowed, query]);
  const rows = view.rows.flatMap((row) => { const doc = data.documents.find((d) => d.id === row.id); return doc ? [doc] : []; });
  const columns = column.columns([
    column.accessor('title', { id: 'title', header: 'Title', cell: ({ row }) => <Link href={`/org/${data.org.id}/documents/${row.original.id}`} className="font-semibold text-primary underline underline-offset-2">{row.original.title}</Link> }),
    column.accessor('sourceName', { id: 'source', header: 'Source' }),
    column.accessor('whoCanRead', { id: 'who', header: 'Who can read' }),
    column.accessor('index', { id: 'index', header: 'Index status', cell: ({ row }) => <IndexStatusBadge status={row.original.index} name={row.original.title} /> }),
    column.accessor('chunkCount', { id: 'chunks', header: 'Chunks' }),
    column.accessor('agents', { id: 'agents', header: 'Agents', cell: ({ getValue }) => { const agents = getValue(); return <span title={agents.map((a) => `${a.name}: ${a.reason === 'allowed' ? 'can read' : a.reason}`).join('\n')}>{agents.filter((a) => a.reason === 'allowed').length} of {agents.length}</span>; } }),
    ...(data.canSeeCited ? [column.accessor('citedCount', { id: 'cited', header: 'Cited (30d)', cell: ({ getValue }) => getValue() ?? '—' })] : []),
    column.accessor('createdAt', { id: 'uploaded', header: 'Uploaded', cell: ({ getValue }) => <time dateTime={getValue().toISOString()}>{formatPacific(getValue())}</time> }),
  ]);
  const table = useTable({ features, columns, data: rows, getRowId: (doc) => doc.id });
  const filtered = view.filtered || Boolean(source || status);
  const clear = () => { setQuery(changeFilter(query, { search: '', tier: '' })); setSource(''); setStatus(''); };
  const sources = [...new Map(data.documents.map((d) => [d.sourceId, { id: d.sourceId, name: d.sourceName }])).values()];
  return <div className="space-y-6"><IndexRefresh pending={data.documents.some((d) => d.index.state === 'queued' || d.index.state === 'indexing')} />
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Demo index · split at headings · no embeddings</p>{data.canUpload && <UploadForm data={data} />}</div>
    {!data.member && <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-3"><Lock aria-hidden className="mt-0.5 size-4 shrink-0" />Public documents only. Club membership is required to read restricted documents.</p>}
    <section aria-label="Document library"><div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="w-64 max-w-full space-y-1"><span className="block font-semibold">Search documents</span><input type="search" value={query.search} onChange={(e) => setQuery(changeFilter(query, { search: e.target.value }))} className={fieldClass} /></label>
      <label className="w-40 space-y-1"><span className="block font-semibold">Tier</span><select value={query.tier} onChange={(e) => { const value = e.target.value; const tier: Tier | '' = tierOptions(data.org.kind).find((t) => t.value === value)?.value ?? ''; setQuery(changeFilter(query, { tier })); }} className={fieldClass}><option value="">All tiers</option>{tierOptions(data.org.kind).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <label className="w-44 space-y-1"><span className="block font-semibold">Source</span><select value={source} onChange={(e) => { setSource(e.target.value); setQuery({ ...query, page: 0 }); }} className={fieldClass}><option value="">All sources</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="w-40 space-y-1"><span className="block font-semibold">Status</span><select value={status} onChange={(e) => { setStatus(e.target.value); setQuery({ ...query, page: 0 }); }} className={fieldClass}><option value="">All statuses</option><option value="ready">Ready</option><option value="queued">Queued</option><option value="indexing">Indexing</option><option value="error">Error</option></select></label>
      {filtered && <Button variant="ghost" onClick={clear}>Clear filters</Button>}
      <p role="status" className="pb-2 text-sm text-muted-foreground">{filtered ? `${view.matching} of ` : ''}{data.documents.length} {data.documents.length === 1 ? 'document' : 'documents'}</p>
    </div><DataTable table={table} caption={`Documents you can read in ${data.org.name}, newest first`} numericColumns={['chunks', 'cited']} monoColumns={['uploaded']} rowHeaderColumn="title" sorted={{ id: 'uploaded', direction: 'desc' }} empty={!data.documents.length ? 'No documents are available to you yet. Ask the club president to upload a document with access for your position.' : <>No documents match these filters. <button className="text-primary underline" onClick={clear}>Clear filters</button>.</>} />
    {view.pageCount > 1 && <nav aria-label="Document pages" className="mt-3 flex items-center justify-end gap-3"><Button variant="secondary" size="sm" disabled={!view.page} onClick={() => setQuery({ ...query, page: view.page - 1 })}>Previous</Button><span aria-live="polite">Page {view.page + 1} of {view.pageCount}</span><Button variant="secondary" size="sm" disabled={view.page >= view.pageCount - 1} onClick={() => setQuery({ ...query, page: view.page + 1 })}>Next</Button></nav>}
    </section></div>;
}
