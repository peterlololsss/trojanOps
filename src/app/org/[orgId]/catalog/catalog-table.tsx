'use client';

// Owner: B (WP-7). The club's agent library as a data table: what is installed, how hard USG pushes
// it, who it is for, whether this viewer may run it — and, for the president, D3's publish action.
//
// The presentational DataTable is stream C's (src/app/org/[orgId]/documents/data-table.tsx), which
// knows nothing about documents. Request to stream D: move it to src/components/ui/data-table.tsx so
// neither club page imports across streams.
import Link from 'next/link';
import { useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { AlertCircle, ArrowUpCircle, Check, CircleSlash, Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { CatalogEntry, ClubCatalog } from '@/lib/distribution';
import { DataTable } from '../documents/data-table';
import {
  accessLabel, audienceLabel, distributionLabels, publishState, statusLabels,
} from './catalog-view';
import { PublishButton } from './publish-dialog';

const chip = 'inline-flex max-w-[200px] items-center gap-1 whitespace-nowrap rounded-sm border border-border px-2 text-xs';
const features = tableFeatures({});
const column = createColumnHelper<typeof features, CatalogEntry>();

function StatusChip({ status }: { status: CatalogEntry['status'] }) {
  return (
    <span className={chip}>
      {status === 'enabled' ? <Check aria-hidden className="size-3 text-success" />
        : status === 'retired' ? <AlertCircle aria-hidden className="size-3 text-primary" />
          : <CircleSlash aria-hidden className="size-3 text-muted-foreground" />}
      {statusLabels[status]}
    </span>
  );
}

export function CatalogTable({ data }: { data: ClubCatalog }) {
  const [published, setPublished] = useState<string | null>(null);

  const columns = column.columns([
    column.accessor('name', { id: 'agent', header: 'Agent' }),
    column.accessor('purpose', {
      id: 'purpose',
      header: 'Purpose',
      cell: ({ getValue }) => (
        <span className="block max-w-[320px] truncate text-muted-foreground" title={getValue()}>{getValue()}</span>
      ),
    }),
    column.accessor('distribution', {
      id: 'distribution',
      header: 'Distribution',
      cell: ({ getValue }) => (
        <span className={chip}>
          {getValue() === 'required' && <Lock aria-hidden className="size-3" />}
          {distributionLabels[getValue()]}
        </span>
      ),
    }),
    column.display({
      id: 'audience',
      header: 'Audience',
      cell: ({ row }) => audienceLabel(row.original),
    }),
    column.display({
      id: 'access',
      header: 'Your access',
      cell: ({ row }) => (
        <span className={row.original.reasonLabel ? '' : 'text-muted-foreground'}>{accessLabel(row.original)}</span>
      ),
    }),
    column.accessor('templateVersion', {
      id: 'version',
      header: 'Version',
      cell: ({ row, getValue }) => (
        <span className="inline-flex items-center justify-end gap-2">
          v{getValue()}
          {row.original.updateAvailable && (
            <span className={`${chip} border-transparent bg-gold-25`}>
              <ArrowUpCircle aria-hidden className="size-3 text-attention-ink" />
              Update available
            </span>
          )}
        </span>
      ),
    }),
    column.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    }),
    column.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const entry = row.original;
        const state = publishState(entry, data.canManage, data.clubLimitMicro);
        const open = entry.status === 'enabled' && entry.reasonLabel !== null;
        return (
          <div className="flex items-center justify-end gap-3">
            {open && (
              <Link
                href={`/org/${data.orgId}/agents/${entry.installationId}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Open
              </Link>
            )}
            {state === 'available' && (
              <PublishButton
                orgId={data.orgId}
                orgName={data.orgName}
                clubLimitMicro={data.clubLimitMicro}
                entry={entry}
                onPublished={setPublished}
              />
            )}
            {state === 'retired' && (
              <span className="text-muted-foreground">USG withdrew this template, so it cannot be published.</span>
            )}
            {!open && state !== 'available' && state !== 'retired' && (
              <span className="text-muted-foreground">No action</span>
            )}
          </div>
        );
      },
    }),
  ]);

  const table = useTable({ features, columns, data: data.agents, getRowId: (entry) => entry.installationId });

  return (
    <div className="space-y-3">
      {!data.canManage && (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Only a president of {data.orgName} can turn an agent on or open it to all students, with this
            club active. If you are a president,{' '}
            <Link href="/" className="text-primary underline">switch your persona or active club</Link>.
          </span>
        </p>
      )}
      {data.canManage && data.agents.some((entry) => publishState(entry, true, data.clubLimitMicro) === 'unavailable') && (
        <p className="text-muted-foreground">
          An agent can be opened to all students only when USG published its template for the whole
          campus and lets {data.orgName} publish. The others stay internal to the club.
        </p>
      )}
      <p role="status" className="text-muted-foreground">
        {published
          ? `${published} is published. Anyone signed in with a USC account can use it from the campus directory.`
          : ''}
      </p>
      <DataTable
        table={table}
        caption={`Agents installed in ${data.orgName}, by name`}
        numericColumns={['version']}
        rowHeaderColumn="agent"
        sorted={{ id: 'agent', direction: 'asc' }}
        minWidth={1180}
        empty={`No agents are installed in ${data.orgName} yet. USG distributes agent templates to clubs; ask USG to distribute the one this club needs.`}
      />
    </div>
  );
}
