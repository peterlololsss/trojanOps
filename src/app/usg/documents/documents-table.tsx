'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { DataTable } from '@/components/inspector/data-table';
import type { UsgDocumentRow, UsgDocumentUser } from '@/lib/documents/usg-documents';
import { Pagination } from '../templates/console-ui';
import { TIERS } from '../templates/template-config';
const features = tableFeatures({});
const column = createColumnHelper<typeof features, UsgDocumentRow>();

/** Template names, linked when the template has a page in the USG console. */
export function UsedByList({ users }: { users: UsgDocumentUser[] }) {
  if (!users.length) return <span className="text-muted-foreground">None</span>;
  return <>{users.map((u, i) => <span key={u.templateId}>{i > 0 && ', '}
    {u.global ? <Link className="text-primary underline" href={`/usg/templates/${u.templateId}`}>{u.name}</Link> : u.name}</span>)}</>;
}

export function DocumentsTable({ documents, orgId }: { documents: UsgDocumentRow[]; orgId: string | null }) {
  const [page, setPage] = useState(1);
  const columns = column.columns([
    column.accessor('title', { id: 'title', header: 'Title', cell: ({ row }) => <Link className="text-primary underline" href={`/usg/documents/${row.original.id}`}>{row.original.title}</Link> }),
    column.accessor('sourceName', { header: 'Source' }),
    column.accessor('tier', { header: 'Readable by', cell: ({ getValue }) => TIERS[getValue()].name }),
    column.accessor('version', { header: 'Version', cell: ({ getValue }) => `v${getValue()}` }),
    column.display({ id: 'usedBy', header: 'Used by', cell: ({ row }) => <UsedByList users={row.original.usedBy} /> }),
  ]);
  const table = useTable({ features, data: documents.slice((page - 1) * 10, page * 10), columns, getRowId: row => row.id });
  return <div className="space-y-4">
    <DataTable table={table} caption="USG documents" rowHeaderColumn="title" sorted={{ id: 'title', direction: 'asc' }} numericColumns={['version']} minWidth={880}
      empty={<>No USG documents yet.{orgId && <Link className="ml-1 text-primary underline" href={`/org/${orgId}/documents`}>Upload a document</Link>}</>} />
    <Pagination page={page} setPage={setPage} total={documents.length} />
  </div>;
}
