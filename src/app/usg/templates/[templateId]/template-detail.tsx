'use client';
// Owner: B. /usg/templates/[templateId]: the template's header with Distribute and Retire, then the
// builder (Configure), its knowledge, distribution settings and version history.
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { ArrowLeft, ChevronDown, Lock } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { DataTable } from '@/components/inspector/data-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { UsgTemplateView, UsgVersion } from '@/lib/distribution/usg-view';
import {
  absoluteTime, DistributionChip, ErrorNotice, PendingButton, Section, selectClass, SuccessNotice, TemplateStatus, useConsoleMutation,
} from '../console-ui';
import { audienceLabel, TIERS } from '../template-config';
import { VersionEditor } from './version-editor';
import { TemplateKnowledge } from './template-knowledge';
const features = tableFeatures({}); const column = createColumnHelper<typeof features, UsgVersion>();
const audience = (version: UsgVersion) => audienceLabel(version.audience, version.usableBy);
type Mutation = ReturnType<typeof useConsoleMutation>;

const TABS = [['configure', 'Configure'], ['knowledge', 'Knowledge'], ['distribution', 'Distribution'], ['versions', 'Versions']] as const;

export function TemplateDetail({ data }: { data: UsgTemplateView }) {
  const { template } = data; const retired = template.status === 'retired';
  const [name, setName] = useState(template.name); const [distribution, setDistribution] = useState(template.distribution);
  const [target, setTarget] = useState(template.target); const mutation = useConsoleMutation();
  const distributing = useConsoleMutation(); const retiring = useConsoleMutation();
  const [tab, setTab] = useState('configure'); const [retireOpen, setRetireOpen] = useState(false);
  const unsaved = name.trim() !== template.name || distribution !== template.distribution || target !== template.target;
  const targetName = data.targets.find(t => t.slug === template.target)?.name ?? template.target;
  // Why Distribute cannot run now, in the words the dialog shows instead of a disabled button.
  const blocked = template.distribution === 'optional' ? 'Optional templates are installed by each club, so they are not distributed. Choose Default or Required on the Distribution tab to distribute this template.'
    : template.latestVersion < 1 ? 'Publish the first version on the Configure tab before distributing this template.'
    : unsaved ? 'Save the settings on the Distribution tab before distributing this template.' : null;
  const columns = column.columns([
    column.accessor('version', { header: 'Version', cell: ({ getValue }) => `v${getValue()}` }),
    column.accessor('purpose', { header: 'Purpose' }), column.display({ id: 'audience', header: 'Audience', cell: ({ row }) => audience(row.original) }),
    column.accessor('maxTier', { header: 'Reads up to', cell: ({ getValue }) => TIERS[getValue()].name }),
    column.accessor('defaultModelId', { header: 'Default model' }),
    column.accessor('changelog', { header: 'Change note', cell: ({ getValue }) => getValue() || 'No change note' }),
    column.accessor('publishedAt', { header: 'Published', cell: ({ getValue }) => absoluteTime(getValue()) }),
  ]);
  const [page, setPage] = useState(1);
  const table = useTable({ features, data: data.versions.slice((page - 1) * 10, page * 10), columns, getRowId: row => String(row.version) });
  function metadata(event: FormEvent) {
    event.preventDefault(); mutation.run(async () => {
      await mutation.request(`/api/usg/templates/${template.id}`, 'PATCH', { name: name.trim(), distribution, target });
      return 'Template settings saved. Existing installations keep their overrides.';
    });
  }
  function editSources() {
    setTab('configure');
    // The Configure panel is always mounted; focus its Knowledge title once it is visible.
    requestAnimationFrame(() => document.getElementById('builder-knowledge-title')?.focus());
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <Link href="/usg/templates" className="inline-flex min-h-6 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />All templates</Link>
        <h1 className="mt-1 font-serif text-[28px] leading-9">{template.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <TemplateStatus status={template.status} /><DistributionChip distribution={template.distribution} />
          <span className="tabular-nums">{template.latestVersion ? `v${template.latestVersion}` : 'No version yet'}</span>
          <span aria-hidden="true">·</span>
          <span>{targetName} · <span className="tabular-nums">Installed in {template.installedCount} of {template.targetCount}</span></span>
        </div>
      </div>
      {!retired && <div className="flex shrink-0 flex-wrap gap-2">
        <DistributeDialog data={data} blocked={blocked} mutation={distributing} />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild><Button type="button" variant="secondary">More<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setRetireOpen(true)}>Retire template</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RetireDialog data={data} open={retireOpen} setOpen={setRetireOpen} mutation={retiring} />
      </div>}
    </header>
    <SuccessNotice message={distributing.success ?? retiring.success} />
    {retired && <Alert><Lock aria-hidden="true" /><div><AlertTitle>Retired by USG</AlertTitle><AlertDescription>Runs are blocked for every installation. This template can no longer be changed or distributed.</AlertDescription></div></Alert>}

    <Tabs.Root value={tab} onValueChange={setTab} className="space-y-6">
      <Tabs.List aria-label="Template sections" className="flex flex-wrap gap-4 border-b border-border">
        {TABS.map(([value, label]) => <Tabs.Trigger key={value} value={value}
          className="-mb-px min-h-9 border-b-2 border-transparent px-2 py-2 font-semibold text-muted-foreground hover:bg-accent data-[state=active]:border-primary data-[state=active]:text-primary">{label}</Tabs.Trigger>)}
      </Tabs.List>
      <Tabs.Content value="configure" forceMount className="data-[state=inactive]:hidden">
        <VersionEditor data={data} />
      </Tabs.Content>
      <Tabs.Content value="knowledge" forceMount className="data-[state=inactive]:hidden">
        <TemplateKnowledge data={data} onEdit={retired ? undefined : editSources} />
      </Tabs.Content>
      <Tabs.Content value="distribution" forceMount className="space-y-6 data-[state=inactive]:hidden">
        <Section title="Distribution"><dl className="grid max-w-md grid-cols-2 gap-2"><dt className="text-muted-foreground">Current version</dt><dd className="tabular-nums">v{template.latestVersion}</dd><dt className="text-muted-foreground">Installed clubs</dt><dd className="tabular-nums">{template.installedCount} of {template.targetCount}</dd><dt className="text-muted-foreground">Last distributed</dt><dd className="font-mono text-xs leading-6">{template.distributedAt ? absoluteTime(template.distributedAt) : 'Not distributed'}</dd></dl>
          {!retired && <form onSubmit={metadata} className="max-w-[640px] space-y-4 border-t border-border pt-4"><div><label htmlFor="template-name" className="mb-1 block font-semibold">Name</label><Input id="template-name" value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4"><div><label htmlFor="distribution" className="mb-1 block font-semibold">Distribution</label><select id="distribution" disabled={!!template.distributedAt} className={selectClass} value={distribution} onChange={e => setDistribution(e.target.value as typeof distribution)}>
              <option value="required">Required</option><option value="default">Default</option><option value="optional">Optional</option></select></div>
              <div><label htmlFor="metadata-target" className="mb-1 block font-semibold">Target</label><select id="metadata-target" className={selectClass} value={target} onChange={e => setTarget(e.target.value)}>{!data.targets.some(t => t.slug === target) && <option value={target}>{target} (unavailable)</option>}{data.targets.map(t => <option value={t.slug} key={t.slug}>{t.name} ({t.clubs.length})</option>)}</select></div></div>
            {template.distributedAt && <p className="text-muted-foreground">Distribution type cannot change after rollout.</p>}<ErrorNotice message={mutation.error} /><SuccessNotice message={mutation.success} />
            <PendingButton type="submit" pending={mutation.pending}>Save settings</PendingButton></form>}
          {!retired && blocked && <p role="status" className="border-t border-border pt-4 text-muted-foreground">{blocked}</p>}
        </Section>
      </Tabs.Content>
      <Tabs.Content value="versions" forceMount className="data-[state=inactive]:hidden">
        <Section title="Version history"><DataTable table={table} caption={`Published versions of ${template.name}`} numericColumns={['version']} monoColumns={['publishedAt', 'defaultModelId']} rowHeaderColumn="version" sorted={{ id: 'version', direction: 'desc' }} minWidth={1024} empty="No versions published yet. Publish the first version on the Configure tab." />
          {data.versions.length > 10 && <div className="flex items-center justify-end gap-3"><span>Page {page} of {Math.ceil(data.versions.length / 10)}</span><Button type="button" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button type="button" variant="secondary" disabled={page * 10 >= data.versions.length} onClick={() => setPage(page + 1)}>Next</Button></div>}
        </Section>
      </Tabs.Content>
    </Tabs.Root>
  </div>;
}

function DistributeDialog({ data, blocked, mutation }: { data: UsgTemplateView; blocked: string | null; mutation: Mutation }) {
  const [open, setOpen] = useState(false); const [confirmation, setConfirmation] = useState('');
  const selected = data.targets.find(t => t.slug === data.template.target); const version = data.versions.find(v => v.version === data.template.latestVersion);
  const required = data.template.distribution === 'required';
  function submit(event: FormEvent) {
    event.preventDefault();
    if (required && confirmation !== data.template.name) { document.getElementById('distribute-confirmation')?.focus(); return; }
    mutation.run(async () => {
      const result = await mutation.request(`/api/usg/templates/${data.template.id}/distribute`, 'POST', {}) as { count: number };
      return `Distribution complete: ${result.count} installation${result.count === 1 ? '' : 's'} changed. Existing club overrides were kept.`;
    }, () => setOpen(false));
  }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); mutation.clear(); setConfirmation(''); }}>
    <Button type="button" onClick={() => { mutation.clear(); setConfirmation(''); setOpen(true); }}>Distribute</Button>
    <DialogContent>{blocked ? <>
      <DialogHeader><DialogTitle>Distribute {data.template.name}</DialogTitle><DialogDescription>{blocked}</DialogDescription></DialogHeader>
      <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
    </> : <>
      <DialogHeader><DialogTitle>Distribute {data.template.name}?</DialogTitle><DialogDescription>Review the clubs and people who will gain access.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}><p><span className="font-semibold">Target</span> · {selected?.name ?? data.template.target}</p>
        <p><strong>{selected?.clubs.length ?? 0} active clubs</strong> are in this target. {version ? `${audience(version)} in each club can use version ${version.version}.` : 'Publish a version first.'}</p>
        <p className="text-muted-foreground">{selected?.clubs.map(c => c.name).join(', ') || 'No active clubs match this target.'}</p>
        <p className="text-muted-foreground">Existing overrides and pins are kept.{required ? ' Required installations will be enabled, including those turned off earlier.' : ' Clubs that turned this default agent off keep that choice.'}</p>
        {required && <div><label htmlFor="distribute-confirmation" className="mb-1 block font-semibold">Type template name</label><Input id="distribute-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} required aria-describedby="distribute-confirmation-hint" /><p id="distribute-confirmation-hint" className="mt-1 text-muted-foreground">Enter “{data.template.name}” to confirm the required rollout.</p></div>}
        {required && confirmation && confirmation !== data.template.name && <p className="text-primary">The name must match “{data.template.name}”.</p>}
        <ErrorNotice message={mutation.error} /><DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><PendingButton pending={mutation.pending} type="submit">Confirm distribution</PendingButton></DialogFooter>
      </form>
    </>}</DialogContent>
  </Dialog>;
}
function RetireDialog({ data, open, setOpen, mutation }: { data: UsgTemplateView; open: boolean; setOpen: (open: boolean) => void; mutation: Mutation }) {
  const [confirmation, setConfirmation] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault(); if (confirmation !== data.template.name) { document.getElementById('retire-confirmation')?.focus(); return; }
    mutation.run(async () => { await mutation.request(`/api/usg/templates/${data.template.id}/retire`, 'POST', {}); return 'Template retired. Every installation is blocked from running.'; }, () => setOpen(false));
  }
  return <Dialog open={open} onOpenChange={v => { setOpen(v); mutation.clear(); setConfirmation(''); }}>
    <DialogContent><DialogHeader><DialogTitle>Retire {data.template.name}?</DialogTitle><DialogDescription>This blocks runs in all {data.template.installedCount} installed clubs, including pinned versions. This console has no restore action.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><div><label htmlFor="retire-confirmation" className="mb-1 block font-semibold">Type template name</label><Input id="retire-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} required aria-describedby="retire-confirmation-hint" /><p id="retire-confirmation-hint" className="mt-1 text-muted-foreground">Enter “{data.template.name}” to confirm.</p></div>
        <ErrorNotice message={mutation.error} />{confirmation && confirmation !== data.template.name && <p className="text-primary">The name must match “{data.template.name}”.</p>}
        <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><PendingButton type="submit" variant="outline" pending={mutation.pending}>Retire template</PendingButton></DialogFooter></form>
    </DialogContent></Dialog>;
}
