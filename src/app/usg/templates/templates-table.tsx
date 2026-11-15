'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Check, CircleSlash, Lock } from 'lucide-react';
import { DataTable } from '@/components/inspector/data-table';
import type { UsgTemplateRow, UsgTemplatesView } from '@/lib/distribution/usg-view';
import { absoluteTime, chipClass, label, Pagination, SearchBar } from './console-ui';
const features = tableFeatures({});
const column = createColumnHelper<typeof features, UsgTemplateRow>();

export function TemplatesTable({ data }: { data: UsgTemplatesView }) {
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1);
  const found = data.templates.filter(t => `${t.name} ${t.slug} ${t.purpose}`.toLowerCase().includes(query.toLowerCase()));
  const columns = column.columns([
    column.accessor('name', { id: 'name', header: 'Template', cell: ({ row }) => <Link className="whitespace-nowrap text-primary underline" href={`/usg/templates/${row.original.id}`}>{row.original.name}</Link> }),
    column.accessor('purpose', { header: 'What it does', cell: ({ getValue }) => getValue() ? <span className="block min-w-[180px] max-w-[300px]">{getValue()}</span> : <span className="text-muted-foreground">No version published yet</span> }),
    column.accessor('distribution', { header: 'Distribution', cell: ({ getValue }) => <span className={chipClass}>{getValue() === 'required' && <Lock className="size-3" aria-hidden="true" />}{label(getValue())}</span> }),
    column.accessor('target', { header: 'Target', cell: ({ row }) => <span className="whitespace-nowrap">{data.targets.find(t => t.slug === row.original.target)?.name ?? row.original.target}
      <span className="block text-muted-foreground">{`Installed in ${row.original.installedCount} of ${row.original.targetCount}`}</span></span> }),
    column.accessor('latestVersion', { header: 'Version', cell: ({ getValue }) => `v${getValue()}` }),
    column.accessor('status', { header: 'Status', cell: ({ getValue }) => <span className={chipClass}>{getValue() === 'active' ? <Check aria-hidden="true" className="size-3 text-success" /> : <CircleSlash aria-hidden="true" className="size-3" />}{label(getValue())}</span> }),
    column.accessor('distributedAt', { header: 'Last distributed', cell: ({ getValue }) => getValue() ? absoluteTime(getValue()) : 'Not distributed' }),
  ]);
  const table = useTable({ features, data: found.slice((page - 1) * 10, page * 10), columns, getRowId: row => row.id });
  return <div className="space-y-4"><SearchBar value={query} onChange={v => { setQuery(v); setPage(1); }} count={found.length} placeholder="Search by name or purpose" />
    <DataTable table={table} caption="USG agent templates" rowHeaderColumn="name" sorted={{ id: 'name', direction: 'asc' }} numericColumns={['latestVersion']} monoColumns={['distributedAt']} minWidth={1100} alignTop
      empty={data.templates.length ? 'No templates match your search. Clear filters to see all templates.' : 'No templates yet. Create a template to publish its first version.'} />
    <Pagination page={page} setPage={setPage} total={found.length} /></div>;
}
