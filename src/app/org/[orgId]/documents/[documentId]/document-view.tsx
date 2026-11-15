'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Markdown } from '@/components/ui/markdown';
import { IndexRefresh, IndexStatusBadge } from '@/components/inspector/index-status';
import { accessDecisions, tierLabels } from '@/components/inspector/access-labels';
import { formatPacific } from '@/lib/documents/library-view';
import type { getDocumentPageData } from '@/lib/documents/document-page';

type Data = NonNullable<Awaited<ReturnType<typeof getDocumentPageData>>>;

export function DocumentView({ data }: { readonly data: Data }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'chunks' | 'text' | 'access'>('chunks');
  const doc = data.document;
  if (!doc) return null;
  const ready = doc.index.state === 'ready';
  const visibleCount = ready ? data.chunks.length : doc.index.state === 'indexing' ? doc.index.done : 0;
  const chunks = data.chunks.slice(0, visibleCount).filter((c) => `${c.heading} ${c.text}`.toLowerCase().includes(query.toLowerCase()));
  const firstAgent = doc.agents.find((a) => a.reason === 'allowed');
  return <><IndexRefresh pending={doc.index.state === 'queued' || doc.index.state === 'indexing'} />
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="rounded-sm border border-border px-2 py-1 text-xs">Demo index</span>{data.canTestRetrieval && <Link href={`/org/${data.org.id}/preview/retrieval${firstAgent ? `?installation=${firstAgent.id}` : ''}`} className="text-primary underline">Test retrieval</Link>}</div>
    <div className="flex flex-col items-start gap-6 lg:flex-row"><div className="w-full min-w-0 max-w-[720px] flex-1">
      <div role="tablist" aria-label="Document views" onKeyDown={(event) => { const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!offset && event.key !== 'Home' && event.key !== 'End') return; event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]; const index = buttons.indexOf(document.activeElement instanceof HTMLButtonElement ? document.activeElement : buttons[0]); const target = buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + offset + buttons.length) % buttons.length]; target?.focus(); target?.click(); }} className="mb-4 flex gap-2 border-b border-border">
        {(['chunks', 'text', ...(data.canTestRetrieval ? ['access'] as const : [])] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`min-h-9 px-3 py-2 ${tab === value ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{value === 'chunks' ? `Chunks (${doc.chunkCount})` : value === 'text' ? 'Text' : 'Access'}</button>)}
      </div>
      {tab === 'chunks' && <section aria-label="Document chunks"><p className="mb-3 text-sm">Each chunk inherits {tierLabels[doc.tier]}: {doc.whoCanRead}. Split at headings, up to 800 characters. No embeddings.</p>
        <label className="mb-4 block"><span className="mb-1 block font-semibold">Search chunks</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-full rounded-md border border-input px-3" /></label>
        {!ready && <div className="mb-4 rounded-md border border-border bg-muted p-4"><IndexStatusBadge status={doc.index} name={doc.title} />{doc.index.state === 'error' ? <p className="mt-2">{doc.index.fix}</p> : <p className="mt-2 text-sm">The demo index finishes in a few seconds. This page refreshes while it processes.</p>}</div>}
        {chunks.map((c) => <article key={c.n} id={`chunk-${String(c.n).padStart(2, '0')}`} className="scroll-mt-6 border-t border-border py-4 target:bg-gold-25"><div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">Chunk {String(c.n).padStart(2, '0')} · {c.heading}</h2><span className="text-xs tabular-nums text-muted-foreground">{c.chars} characters · about {c.tokens} tokens · {tierLabels[doc.tier]}</span></div><Markdown text={c.text} /></article>)}
        {!chunks.length && <p className="rounded-md border border-border p-4">{query ? 'No chunks match this search.' : ready ? 'No chunks yet.' : 'No chunks available yet.'}{query && <button type="button" onClick={() => setQuery('')} className="ml-2 text-primary underline">Clear search</button>}</p>}
      </section>}
      {tab === 'text' && <section aria-label="Document text"><Markdown text={data.bodyMd} /></section>}
      {tab === 'access' && data.canTestRetrieval && <section aria-label="Document access"><p className="mb-3 text-sm">The agent&apos;s audience separately decides who may run it.</p><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="sr-only">Who can read this document through each agent</caption><thead className="bg-muted"><tr><th scope="col" className="p-3 text-left">Position</th>{doc.agents.map((a) => <th key={a.id} scope="col" className="p-3 text-left">{a.name}</th>)}</tr></thead><tbody>{data.subjects.map((s) => <tr key={s.key} className="border-b border-border"><th scope="row" className="p-3 text-left font-semibold">{s.label}</th>{doc.agents.map((a) => { const decision = accessDecisions[a.cells[s.key] ?? 'not_granted']; const Icon = decision.icon; return <td key={a.id} className="p-3"><span className="inline-flex items-center gap-1"><Icon aria-hidden className="size-4 shrink-0" />{decision.label}</span></td>; })}</tr>)}</tbody></table></div></section>}
    </div><aside aria-label="Document details" className="w-[384px] max-w-full shrink-0 rounded-md border border-border p-4 lg:sticky lg:top-6">
      <h2 className="mb-3 text-[20px] font-semibold">Details</h2><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm"><dt>Status</dt><dd><IndexStatusBadge status={doc.index} /></dd><dt>Tier</dt><dd>{tierLabels[doc.tier]}</dd><dt>Source</dt><dd>{doc.sourceName}</dd><dt>Version</dt><dd>{doc.version}</dd><dt>Uploaded</dt><dd>{formatPacific(doc.createdAt)}{data.uploadedBy ? `, by ${data.uploadedBy}` : ''}</dd><dt>Size</dt><dd>{data.bodyMd.length.toLocaleString('en-US')} characters</dd><dt>Index</dt><dd>Demo index · split at headings · no embeddings</dd></dl>
      <section className="mt-6 border-t border-border pt-4"><h3 className="mb-2 font-semibold">Who can read</h3><p>{doc.whoCanRead}</p></section>
      <section className="mt-6 border-t border-border pt-4"><h3 className="mb-2 font-semibold">Agents</h3><ul className="space-y-3">{doc.agents.map((a) => { const decision = accessDecisions[a.reason]; const Icon = decision.icon; return <li key={a.id}><p className="font-semibold">{a.name}{a.status !== 'enabled' ? ` (${a.status})` : ''}</p><p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground"><Icon aria-hidden className="mt-0.5 size-4 shrink-0" />{decision.label}{a.positions.length ? ` for ${a.positions.join(', ')}` : ''}</p></li>; })}</ul>{!doc.agents.length && <p className="flex gap-2 text-sm text-muted-foreground"><AlertCircle aria-hidden className="size-4" />No available agents use this document.</p>}</section>
      {doc.citedCount !== null && <section className="mt-6 border-t border-border pt-4"><h3 className="mb-2 font-semibold">Cited in runs</h3><p className="tabular-nums">{doc.citedCount} completed runs in the last 30 days.</p></section>}
    </aside></div></>;
}
