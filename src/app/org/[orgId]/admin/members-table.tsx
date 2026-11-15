'use client';

// Owner: B (WP-7). The roster with every member's monthly budget, and D5's "Set limit" on each
// row. A member with no limit of their own reads the club's, which the row says in words
// ("Inheriting $5.00") rather than printing the same figure twice.
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { useState } from 'react';
import { AlertCircle, ArrowUpCircle, Check } from 'lucide-react';
import type { ClubAdmin, ClubMember } from '@/lib/distribution';
import { DataTable } from '../documents/data-table';
import { chip, memberBudget } from './admin-view';
import { BudgetButton } from './budget-dialog';

const features = tableFeatures({});
const column = createColumnHelper<typeof features, ClubMember>();

function BudgetChip({ member }: { member: ClubMember }) {
  const budget = memberBudget(member);
  if (budget.status === 'blocked') {
    return (
      <span className={chip}>
        <AlertCircle aria-hidden className="size-3 text-primary" />
        {budget.statusLabel}
      </span>
    );
  }
  if (budget.status === 'attention') {
    return (
      <span className={`${chip} border-transparent bg-gold-25`}>
        <ArrowUpCircle aria-hidden className="size-3 text-attention-ink" />
        {budget.statusLabel}
      </span>
    );
  }
  return (
    <span className={chip}>
      <Check aria-hidden className="size-3 text-success" />
      {budget.statusLabel}
    </span>
  );
}

export function MembersTable({ data }: { data: ClubAdmin }) {
  const [saved, setSaved] = useState<string | null>(null);

  const columns = column.columns([
    column.accessor('displayName', { id: 'member', header: 'Member' }),
    column.display({
      id: 'positions',
      header: 'Positions',
      cell: ({ row }) => (
        <span className={row.original.positions.length === 0 ? 'text-muted-foreground' : ''}>
          {row.original.positions.length > 0
            ? row.original.positions.map((held) => held.name).join(', ')
            : 'No position'}
        </span>
      ),
    }),
    column.display({
      id: 'limit',
      header: 'Monthly limit',
      cell: ({ row }) => {
        const budget = memberBudget(row.original);
        return (
          <span className="tabular-nums">
            {budget.limitLabel}
            {row.original.inherited && (
              <span className="text-muted-foreground"> from the club</span>
            )}
          </span>
        );
      },
    }),
    column.display({
      id: 'spent',
      header: 'Spent',
      cell: ({ row }) => memberBudget(row.original).spent,
    }),
    column.display({
      id: 'left',
      header: 'Left',
      cell: ({ row }) => memberBudget(row.original).left,
    }),
    column.display({
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <BudgetChip member={row.original} />,
    }),
    column.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-3">
          <BudgetButton data={data} member={row.original} onSaved={setSaved} />
        </div>
      ),
    }),
  ]);

  const table = useTable({
    features, columns, data: data.members, getRowId: (member) => member.userId,
  });

  return (
    <div className="space-y-3">
      <p role="status" className="text-muted-foreground">{saved ?? ''}</p>
      <DataTable
        table={table}
        caption={`Members of ${data.org.name} and their monthly limits, by name`}
        numericColumns={['spent', 'left']}
        rowHeaderColumn="member"
        sorted={{ id: 'member', direction: 'asc' }}
        minWidth={1020}
        empty={`${data.org.name} has no members on its roster yet. USG imports a club's roster from EngageSC; ask USG to sync it.`}
      />
    </div>
  );
}
