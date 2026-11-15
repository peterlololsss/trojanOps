'use client';

// Owner: B (WP-7). The club's positions and who holds them, with D7's succession on each officer
// row. The presentational DataTable is the same one the catalog uses (stream C's file; see the
// request to move it to src/components/ui in catalog-table.tsx).
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { useState } from 'react';
import { User, Users } from 'lucide-react';
import type { ClubAdmin } from '@/lib/distribution';
import { DataTable } from '../documents/data-table';
import { chip, holderLabel, transferState, transferUnavailable, type PositionRow } from './admin-view';
import { TransferButton } from './transfer-dialog';

const features = tableFeatures({});
const column = createColumnHelper<typeof features, PositionRow>();

export function PositionsTable({ data, rows }: { data: ClubAdmin; rows: PositionRow[] }) {
  const [transferred, setTransferred] = useState<string | null>(null);

  const columns = column.columns([
    column.display({
      id: 'position',
      header: 'Position',
      cell: ({ row }) => row.original.position.name,
    }),
    column.display({
      id: 'kind',
      header: 'Kind',
      cell: ({ row }) => (
        <span className={chip}>
          {row.original.position.isOfficer
            ? <User aria-hidden className="size-3" />
            : <Users aria-hidden className="size-3" />}
          {row.original.position.isOfficer ? 'Officer' : 'Every member'}
        </span>
      ),
    }),
    column.display({
      id: 'holders',
      header: 'Held by',
      cell: ({ row }) => (
        <span className={row.original.position.holders.length === 0 ? 'text-muted-foreground' : ''}>
          {holderLabel(row.original.position)}
        </span>
      ),
    }),
    column.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const state = transferState(row.original);
        return (
          <div className="flex items-center justify-end gap-3">
            {state === 'available' ? (
              <TransferButton
                data={data}
                position={row.original.position}
                candidates={row.original.candidates}
                onTransferred={setTransferred}
              />
            ) : (
              <span className="text-muted-foreground">{transferUnavailable[state]}</span>
            )}
          </div>
        );
      },
    }),
  ]);

  const table = useTable({ features, columns, data: rows, getRowId: (row) => row.position.slug });

  return (
    <div className="space-y-3">
      <p role="status" className="text-muted-foreground">
        {transferred ? `${transferred} The agents that position opens changed hands with it.` : ''}
      </p>
      <DataTable
        table={table}
        caption={`Positions in ${data.org.name}, officers first`}
        rowHeaderColumn="position"
        minWidth={860}
        empty={`${data.org.name} has no positions yet. A roster sync creates them from the club's roster.`}
      />
    </div>
  );
}
