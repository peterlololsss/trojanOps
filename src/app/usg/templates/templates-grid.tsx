'use client';

// Owner: B. /usg/templates: USG's agent templates as a grid of cards. Templates are few and each is a
// separate object with its own builder page, so they read as cards rather than table rows.
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { UsgTemplateRow, UsgTemplatesView } from '@/lib/distribution/usg-view';
import { absoluteTime, DistributionChip, Pagination, SearchBar, TemplateStatus } from './console-ui';

const PAGE_SIZE = 12;

export function TemplatesGrid({ data }: { data: UsgTemplatesView }) {
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1);
  const search = query.trim().toLowerCase();
  const found = data.templates
    .filter(t => `${t.name} ${t.slug} ${t.purpose}`.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = found.length > PAGE_SIZE ? found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : found;
  const targetName = (slug: string) => data.targets.find(t => t.slug === slug)?.name ?? slug;
  const filter = (value: string) => { setQuery(value); setPage(1); };

  return <div className="space-y-4">
    <SearchBar value={query} onChange={filter} count={found.length} placeholder="Search by name or purpose" />
    {!data.templates.length ? <div className="rounded-md border border-border p-6">
      <h2 className="font-semibold">No templates yet</h2>
      <p className="mt-1 text-muted-foreground">Create a template to publish its first version, then distribute it to clubs.</p>
    </div> : !found.length ? <div className="rounded-md border border-border p-6">
      <p>No templates match “{query.trim()}”.</p>
      <Button type="button" variant="link" className="h-auto px-0" onClick={() => filter('')}>Clear filters</Button>
    </div> : <ul aria-label="USG agent templates" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {shown.map(template => <TemplateCard key={template.id} template={template} targetName={targetName(template.target)} />)}
    </ul>}
    {found.length > PAGE_SIZE && <Pagination page={page} setPage={setPage} total={found.length} pageSize={PAGE_SIZE} />}
  </div>;
}

function TemplateCard({ template, targetName }: { template: UsgTemplateRow; targetName: string }) {
  const installed = `Installed in ${template.installedCount} of ${template.targetCount}`;
  return <li className="relative flex flex-col rounded-md border border-border bg-background p-4 hover:border-input hover:bg-accent [overflow-wrap:anywhere]">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-semibold leading-6">
        <Link href={`/usg/templates/${template.id}`} className="text-primary underline-offset-4 after:absolute after:inset-0 hover:underline">{template.name}</Link>
      </h2>
      <span className="shrink-0 text-xs leading-4 tabular-nums text-muted-foreground">{template.latestVersion ? `v${template.latestVersion}` : 'No version'}</span>
    </div>
    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{template.purpose || 'No version published yet.'}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <DistributionChip distribution={template.distribution} />
      <TemplateStatus status={template.status} />
    </div>
    <div className="mt-4 space-y-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span>{targetName}</span><span className="tabular-nums text-muted-foreground">{installed}</span>
      </p>
      <Progress value={template.installedCount} max={Math.max(1, template.targetCount)} aria-label={`${installed} clubs`} className="h-1.5" />
    </div>
    <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-t border-border pt-3 text-xs leading-4">
      <dt className="text-muted-foreground">Default model</dt>
      <dd className="font-mono">{template.defaultModelId ?? 'Not set'}</dd>
      <dt className="text-muted-foreground">Last distributed</dt>
      <dd className="font-mono">{template.distributedAt ? absoluteTime(template.distributedAt) : 'Not distributed'}</dd>
    </dl>
  </li>;
}
