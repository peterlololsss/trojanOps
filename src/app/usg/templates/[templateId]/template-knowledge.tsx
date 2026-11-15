'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UsgTemplateView } from '@/lib/distribution/usg-view';
import { KnowledgeUploadDialog } from './knowledge-upload';
import { scopeLabel, SOURCE_KINDS, sourceName, TIERS, withinTier } from '../template-config';

export function TemplateKnowledge({ data, onEdit }: {
  readonly data: UsgTemplateView;
  readonly onEdit?: () => void;
}) {
  const latest = data.versions.find(version => version.version === data.template.latestVersion);
  const sourceKinds = latest?.sourceKinds ?? [];
  const [source, setSource] = useState(() => sourceKinds.find(kind =>
    SOURCE_KINDS.find(option => option.slug === kind)?.owner === 'usg') ?? sourceKinds[0] ?? '');
  const [query, setQuery] = useState('');
  const sourceOption = SOURCE_KINDS.find(option => option.slug === source);
  const documents = latest ? data.usgDocuments.filter(doc =>
    sourceKinds.includes(doc.kind) && withinTier(doc.tier, latest.maxTier)) : [];
  const shown = documents.filter(doc => (!source || doc.kind === source) &&
    doc.title.toLowerCase().includes(query.trim().toLowerCase()));
  const upload = data.knowledgeUpload;
  const uploadSources = upload?.sources.filter(item =>
    item.kind === 'rulebook' && sourceKinds.includes(item.kind) && (!source || source === item.kind)) ?? [];

  return <section aria-labelledby="template-knowledge-title" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="template-knowledge-title" className="text-xl font-semibold">Knowledge base</h2>
        <p className="mt-1 text-muted-foreground">{latest
          ? `Version ${latest.version} · Reads up to ${TIERS[latest.maxTier].name}`
          : 'Publish the first version to connect knowledge sources.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/usg/documents" className={buttonVariants({ variant: 'link' })}>Manage USG library</Link>
        {onEdit && <Button variant="secondary" onClick={onEdit}>Edit sources</Button>}
      </div>
    </div>

    {sourceKinds.length === 0 ? <p className="rounded-md border border-border p-4 text-muted-foreground">
      {latest ? 'No sources connected. Use Edit sources to connect knowledge to a new version.' : 'No published sources yet.'}
    </p> : <div className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
      <div role="group" aria-label="Filter by knowledge source" className="self-start rounded-md border border-border p-2">
        <Button variant="ghost" className="w-full justify-start aria-pressed:bg-accent aria-pressed:text-primary"
          aria-pressed={!source} onClick={() => { setSource(''); setQuery(''); }}>All sources</Button>
        {sourceKinds.map(kind => {
          const owner = SOURCE_KINDS.find(option => option.slug === kind)?.owner;
          return <Button key={kind} variant="ghost"
            className="h-auto min-h-9 w-full flex-col items-start gap-0 whitespace-normal px-4 py-2 text-left aria-pressed:bg-accent aria-pressed:text-primary"
            aria-pressed={source === kind} onClick={() => { setSource(kind); setQuery(''); }}>
            {sourceName(kind)}<span className="text-xs font-normal text-muted-foreground">{scopeLabel(owner)}</span>
          </Button>;
        })}
      </div>

      <div className="min-w-0 space-y-3">
        {!source && sourceKinds.some(kind => SOURCE_KINDS.some(option => option.slug === kind && option.owner === 'club')) &&
          <p className="rounded-md border border-border p-4 text-muted-foreground">Club-managed sources are supplied separately by each installed club. Select a club source to view its ownership.</p>}
        {sourceOption?.owner === 'club' ? <div className="space-y-1 rounded-md border border-border p-4">
          <h3 className="font-semibold">{sourceOption.name}</h3>
          <p className="text-muted-foreground">Each installed club supplies its own {sourceOption.name.toLowerCase()} from its document library. Readers see the files their permissions allow.</p>
          <Link href="/usg/clubs" className="inline-block py-2 text-primary underline">View clubs</Link>
        </div> : <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-xs">
              <label htmlFor="knowledge-search" className="mb-1 block font-semibold">Search documents</label>
              <Input id="knowledge-search" value={query} onChange={event => setQuery(event.target.value)} />
            </div>
            {data.template.status !== 'retired' && upload && uploadSources.length > 0 && <KnowledgeUploadDialog templateId={data.template.id} orgId={upload.orgId} sources={uploadSources} />}
          </div>
          <div className="rounded-md border border-border">
            <Table>
              <caption className="sr-only">USG documents in connected sources</caption>
              <TableHeader><TableRow>
                <TableHead>Document</TableHead><TableHead>Source</TableHead><TableHead>Readable by</TableHead><TableHead>Version</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {shown.map(doc => <TableRow key={doc.id}>
                  <th scope="row" className="px-3 py-2 text-left font-semibold">
                    <Link className="inline-flex items-center gap-2 text-primary underline" href={`/usg/documents/${doc.id}`}>
                      <FileText aria-hidden className="size-4 shrink-0" />{doc.title}
                    </Link>
                  </th>
                  <TableCell>{sourceName(doc.kind)}</TableCell>
                  <TableCell><Badge>{TIERS[doc.tier].name}</Badge></TableCell>
                  <TableCell>v{doc.version}</TableCell>
                </TableRow>)}
                {!shown.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {query.trim() ? <>No documents match. <Button variant="link" size="sm" onClick={() => setQuery('')}>Clear search</Button></>
                    : 'No USG documents are within the template’s access tier for this selection.'}
                </TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">Adding a document updates the shared source for every agent connected to it. Document permissions apply when an agent runs.</p>
        </>}
      </div>
    </div>}
  </section>;
}
