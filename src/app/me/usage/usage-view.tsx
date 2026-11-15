'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { AlertCircle } from 'lucide-react';
import { DataTable } from '@/components/inspector/data-table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { creditLabel } from '@/lib/gateway/prices';
import type { myUsage } from '@/lib/gateway/usage';
import { formatPacific } from '@/lib/documents/library-view';

type Data = Awaited<ReturnType<typeof myUsage>>;
const features = tableFeatures({});
const column = createColumnHelper<typeof features, Data['runs'][number]>();
const columns = column.columns([
  column.accessor('startedAt', { id: 'time', header: 'Time', cell: ({ getValue }) => <time dateTime={getValue().toISOString()}>{formatPacific(getValue())}</time> }),
  column.accessor('agent', { id: 'agent', header: 'Agent' }),
  column.accessor('model', { id: 'model', header: 'Model', cell: ({ getValue }) => { const model = getValue(); return model === 'demo-standard' ? 'Standard' : model === 'demo-economy' ? 'Economy' : model === 'mock' ? 'Demo (legacy)' : model ?? 'Not recorded'; } }),
  column.accessor('club', { id: 'club', header: 'Club billed' }),
  column.accessor('documentsRead', { id: 'documents', header: 'Documents read' }),
  column.accessor('costMicro', { id: 'credits', header: 'Cost', cell: ({ getValue, row }) => <span title={`$${(getValue() / 1_000_000).toFixed(2)}`}>{row.original.status === 'failed' ? 'Failed · ' : getValue() > 0 ? '−' : ''}{creditLabel(getValue())}</span> }),
]);

export function UsageView({ data }: { readonly data: Data }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(data.runs.length / 20));
  const table = useTable({ features, columns, data: data.runs.slice(page * 20, (page + 1) * 20), getRowId: (r) => r.id });
  return <div className="space-y-6">
    <section aria-labelledby="allowances"><h2 id="allowances" className="mb-3 text-[20px] font-semibold">Allowances</h2><div className="divide-y divide-border border-y border-border">
      {data.allowances.map((a) => {
        const percent = a.limitMicro === 0 ? 100 : Math.min(100, a.spentMicro / a.limitMicro * 100);
        return <div key={a.label} className="grid items-center gap-3 py-4 md:grid-cols-[200px_minmax(100px,1fr)_auto]"><p className="font-semibold">{a.label}</p><Progress value={percent} aria-label={`${a.label}: ${creditLabel(a.remainingMicro)} of ${creditLabel(a.limitMicro)} left`} /><div className="text-sm tabular-nums"><p>{creditLabel(a.remainingMicro)} of {creditLabel(a.limitMicro)} left {percent >= 80 && <span className="ml-2 rounded-sm bg-gold-25 px-2 py-1"><AlertCircle aria-hidden className="mr-1 inline size-3" />{Math.floor(percent)}% used</span>}</p><p className="mt-1 text-muted-foreground">{a.scope === 'student_daily' ? 'Resets at midnight PT' : `Resets ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(a.resetsAt))}`}</p></div></div>;
      })}
    </div></section>
    <section aria-labelledby="usage-runs"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-3"><h2 id="usage-runs" className="text-[20px] font-semibold">Runs, last 30 days</h2><p className="tabular-nums">{creditLabel(data.monthlyMicro)} this month</p></div>
      {data.blockedAttempts > 0 && <p className="mb-3 text-sm">Blocked attempts this month: {data.blockedAttempts}. Nothing was charged.</p>}
      <DataTable table={table} caption="Your runs, newest first" numericColumns={['documents', 'credits']} monoColumns={['time']} rowHeaderColumn="agent" sorted={{ id: 'time', direction: 'desc' }} empty={<>No runs yet. Your runs, the model each used and what it cost appear here. <Link href="/me/agents" className="text-primary underline">Open My agents</Link></>} />
      {pageCount > 1 && <nav aria-label="Usage pages" className="mt-3 flex items-center justify-end gap-3"><Button type="button" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><span>Page {page + 1} of {pageCount}</span><Button type="button" variant="secondary" disabled={page + 1 === pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button></nav>}
    </section>
    <p className="text-sm text-muted-foreground">Only you can see this list. Club presidents and USG see run metadata, never your questions or the answers.</p>
  </div>;
}
