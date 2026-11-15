'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Check, CircleSlash, CircleAlert } from 'lucide-react';
import { DataTable } from '@/components/inspector/data-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { UsgClub } from '@/lib/distribution/usg-view';
import { creditLabel } from '@/lib/gateway/prices';
import { ErrorNotice, label, money, Pagination, PendingButton, SearchBar, SuccessNotice, useConsoleMutation } from '../templates/console-ui';
const features = tableFeatures({}); const column = createColumnHelper<typeof features, UsgClub>();

export function ClubsTable({ clubs }: { clubs: UsgClub[] }) {
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1);
  const found = clubs.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  const columns = column.columns([
    column.accessor('name', { id: 'name', header: 'Club', cell: ({ row }) => <Link className="text-primary underline" href={`/org/${row.original.id}/catalog`}>{row.original.name}</Link> }),
    column.accessor('status', { header: 'Status', cell: ({ getValue }) => <span className="inline-flex items-center gap-1">{getValue() === 'active' ? <Check className="size-3 text-success" aria-hidden="true" /> : <CircleSlash className="size-3" aria-hidden="true" />}{label(getValue())}</span> }),
    column.accessor('limitMicro', { header: 'Monthly limit', cell: ({ getValue }) => <span>{money(getValue())}<span className="block text-sm text-muted-foreground">{creditLabel(getValue())}</span></span> }),
    column.accessor('spentMicro', { header: 'Used', cell: ({ getValue }) => <span>{money(getValue())}<span className="block text-sm text-muted-foreground">{creditLabel(getValue())}</span></span> }),
    column.accessor('remainingMicro', { header: 'Remaining', cell: ({ getValue }) => <span>{money(getValue())}<span className="block text-sm text-muted-foreground">{creditLabel(getValue())}</span></span> }),
    column.display({ id: 'policy', header: 'Policy', cell: ({ row }) => row.original.hasPolicy ? <><span>{row.original.allowedModelClasses.map(label).join(', ') || 'No models'}</span><span className="block text-muted-foreground">Public agents {row.original.allowPublicAgents ? 'allowed' : 'blocked'}</span></> : <span className="inline-flex items-center gap-1"><CircleAlert className="size-3 text-primary" aria-hidden="true" />Policy missing</span> }),
    column.display({ id: 'actions', header: 'Actions', cell: ({ row }) => row.original.status === 'active' ? <ClubEditor key={`${row.original.id}:${row.original.limitMicro}:${row.original.allowPublicAgents}:${row.original.allowedModelClasses.join(',')}`} club={row.original} /> : <span className="text-muted-foreground">Inactive club</span> }),
  ]);
  const table = useTable({ features, data: found.slice((page - 1) * 10, page * 10), columns, getRowId: row => row.id });
  return <div className="space-y-4"><SearchBar value={query} onChange={v => { setQuery(v); setPage(1); }} count={found.length} />
    <DataTable table={table} caption="Club quotas and USG policy" rowHeaderColumn="name" sorted={{ id: 'name', direction: 'asc' }} numericColumns={['limitMicro', 'spentMicro', 'remainingMicro']} minWidth={980} empty={clubs.length ? 'No clubs match your search. Clear filters to see all clubs.' : 'No clubs yet. Import the roster from Management to provision clubs.'} />
    <Pagination page={page} setPage={setPage} total={found.length} /></div>;
}
function ClubEditor({ club }: { club: UsgClub }) {
  const [open, setOpen] = useState(false); const [limit, setLimit] = useState((club.limitMicro / 1_000_000).toFixed(2));
  const [models, setModels] = useState(club.allowedModelClasses); const [allowPublic, setAllowPublic] = useState(club.allowPublicAgents);
  const [confirmPolicy, setConfirmPolicy] = useState(false);
  const affected = club.modelAgents.filter((agent) => !models.includes(agent.modelClass));
  const [validation, setValidation] = useState<string | null>(null); const [policyValidation, setPolicyValidation] = useState<string | null>(null); const quota = useConsoleMutation(); const policy = useConsoleMutation();
  function saveQuota(event: FormEvent) {
    event.preventDefault(); const amount = Number(limit); const micro = Math.round(amount * 1_000_000); setValidation(null);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(micro)) { setValidation('Enter a valid amount of zero or more dollars.'); return; }
    quota.run(async () => { await quota.request('/api/quota/limits', 'PUT', { scope: 'org', orgId: club.id, limitMicro: micro }); return `${club.name}'s monthly quota is now ${money(micro)}.`; });
  }
  function savePolicy(event: FormEvent) {
    event.preventDefault(); setPolicyValidation(null); if (!models.length) { setPolicyValidation('Allow at least one model class, then save the policy again.'); return; } if (affected.length && !confirmPolicy) { setConfirmPolicy(true); return; } policy.run(async () => { await policy.request(`/api/usg/club-policy/${club.id}`, 'PUT', { allowedModelClasses: models, allowPublicAgents: allowPublic }); return 'Club policy saved. All non-retired installations fit this policy, including disabled and pinned agents. Retired agents remain blocked.'; });
  }
  return <Dialog open={open} onOpenChange={v => { setOpen(v); setConfirmPolicy(false); setValidation(null); setPolicyValidation(null); quota.clear(); policy.clear(); }}><DialogTrigger asChild><Button type="button" size="sm" variant="secondary">Manage</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Manage {club.name}</DialogTitle><DialogDescription>Quota and policy are saved separately. New limits apply to the next run.</DialogDescription></DialogHeader>
      <form onSubmit={saveQuota} className="space-y-3"><h3 className="font-semibold">Monthly quota</h3><div><label htmlFor={`quota-${club.id}`} className="mb-1 block font-semibold">Limit (USD)</label><Input id={`quota-${club.id}`} type="number" min="0" step="0.01" required value={limit} onChange={e => setLimit(e.target.value)} /></div>
        <p className="text-sm text-muted-foreground" aria-live="polite">{limit !== '' && Number.isFinite(Number(limit)) && Number(limit) >= 0 ? `${money(Math.round(Number(limit) * 1_000_000))} = ${creditLabel(Math.round(Number(limit) * 1_000_000))}` : '1 credit = $0.01.'}</p>
        <p className="text-muted-foreground">Used this month: {money(club.spentMicro)}. A limit of $0.00 blocks new runs. Child budgets must fit within this limit.</p><ErrorNotice message={validation ?? quota.error} /><SuccessNotice message={quota.success} /><PendingButton type="submit" pending={quota.pending}>Save quota</PendingButton></form>
      <form onSubmit={savePolicy} className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">Club policy</h3><fieldset><legend className="mb-2 font-semibold">Model classes</legend><div className="flex gap-4">{(['economy', 'standard'] as const).map(model => <label key={model} className="flex items-center gap-2"><input type="checkbox" checked={models.includes(model)} onChange={e => { setModels(e.target.checked ? [...models, model] : models.filter(m => m !== model)); setConfirmPolicy(false); }} />{label(model)}</label>)}</div></fieldset>
        <label className="flex items-start gap-2"><input type="checkbox" checked={allowPublic} onChange={e => { setAllowPublic(e.target.checked); setConfirmPolicy(false); }} className="mt-1" /><span>Allow public agents</span></label>
        {confirmPolicy && <div role="alert" className="rounded-md border border-primary p-3"><p className="font-semibold">Review the model change in {club.name}</p><ul className="mt-2 space-y-1">{affected.map((agent) => { const next = models.find((model) => agent.allowed.includes(model)); return <li key={agent.name}>{agent.name}: {next ? `will run on ${label(next)}.` : 'No permitted model remains. Saving will be refused.'}</li>; })}</ul><p className="mt-2 text-sm">Confirm to apply this policy. The server checks every non-retired installation again.</p></div>}
        <p className="text-muted-foreground">Public agents may be used by any signed-in student. Every non-retired installation must fit this policy, including disabled and pinned agents. Update any incompatible non-retired installations first. Retired agents remain blocked and do not prevent a stricter policy.</p><ErrorNotice message={policyValidation ?? policy.error} /><SuccessNotice message={policy.success} /><PendingButton type="submit" pending={policy.pending}>{confirmPolicy ? 'Confirm policy change' : 'Save policy'}</PendingButton></form>
      <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
    </DialogContent></Dialog>;
}
