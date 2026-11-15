'use client';

// Owner: C (WP-9). The audit table shared by /org/[orgId]/audit and /usg/audit (§12, demo beat D8;
// ui-designer.md "Audit"). Rows arrive resolved from the server: names, absolute Pacific times, and
// document titles under the viewer's RLS, with a null title for a document the viewer can't read.
// Filters run over the loaded rows; Export writes exactly the filtered rows.
import { useId, useMemo, useState, type ReactNode } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Download, FileText, Info, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuditAction } from '@/lib/contracts';
import { RESTRICTED_DOCUMENT, type AuditRow } from '@/lib/documents/audit-row';
import {
  actionOptions, actorOptions, auditExport, changeAuditFilter, dateRangeError, eventCount,
  initialAuditFilters, viewAudit, type AuditFilters,
} from './audit-filter';
import { DataTable } from './data-table';
import { fieldClass } from './field';

/** Documents shown in a run.access row before "+N more". */
const VISIBLE_DOCUMENTS = 3;

/** "Restricted document" with a lock, in muted text: no title, no id. */
export function RestrictedLabel() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Lock aria-hidden className="size-3 shrink-0" />
      {RESTRICTED_DOCUMENT}
    </span>
  );
}

function PermittedDocuments({ documents }: { documents: AuditRow['documents'] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (documents.length === 0) return <p className="mt-1 text-xs text-muted-foreground">Permitted: no documents</p>;
  const shown = open ? documents : documents.slice(0, VISIBLE_DOCUMENTS);
  const hidden = documents.length - shown.length;
  return (
    <div className="mt-1 text-xs">
      <span className="text-muted-foreground">Permitted ({documents.length}):</span>
      <ul id={listId} className="mt-0.5 space-y-0.5">
        {shown.map((doc, index) => (
          // Restricted documents have no id; the list order is fixed, so the index is a stable key.
          <li key={index}>
            {doc.title === null ? <RestrictedLabel /> : (
              <span className="inline-flex items-center gap-1">
                <FileText aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                {doc.title}
              </span>
            )}
          </li>
        ))}
      </ul>
      {documents.length > VISIBLE_DOCUMENTS && (
        <button
          type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}
          className="mt-0.5 text-primary underline"
        >{open ? 'Show fewer' : `+${hidden} more`}</button>
      )}
    </div>
  );
}

const none = (label: string) => (
  <span className="text-muted-foreground"><span aria-hidden>—</span><span className="sr-only">{label}</span></span>
);

const features = tableFeatures({});
const column = createColumnHelper<typeof features, AuditRow>();
const columns = column.columns([
  column.accessor('time', {
    id: 'time',
    header: 'Time',
    cell: ({ row }) => <time dateTime={row.original.ts}>{row.original.time}</time>,
  }),
  column.accessor((row) => row.actor?.name ?? 'System', {
    id: 'actor',
    header: 'Actor',
    cell: ({ row }) => row.original.actor?.name ?? <span className="text-muted-foreground">System</span>,
  }),
  column.accessor('actionLabel', { id: 'action', header: 'Action' }),
  column.accessor((row) => row.target.label, {
    id: 'target',
    header: 'Target',
    cell: ({ row }) => (
      <div className="min-w-0">
        {row.original.target.restricted ? <RestrictedLabel /> : row.original.target.label}
        {row.original.action === 'run.access' && <PermittedDocuments documents={row.original.documents} />}
      </div>
    ),
  }),
  column.accessor((row) => row.club?.name ?? '', {
    id: 'club',
    header: 'Club',
    cell: ({ row }) => row.original.club?.name ?? none('No club'),
  }),
  column.accessor('id', {
    id: 'auditId',
    header: 'Audit id',
    cell: ({ getValue }) => `#${getValue()}`,
  }),
]);

const pageButton = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

function download(filename: string, csv: string) {
  // A byte-order mark so spreadsheet apps read the file as UTF-8 (titles, "·", curly quotes).
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking in the same task can cancel the download in some Firefox and Safari builds.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface AuditTableProps {
  rows: AuditRow[];
  /** Names the export file: the club's name, or "USG". */
  scopeName: string;
  /** Today in Pacific time, from the server clock: the date fields' maximum and the file name. */
  today: string;
  truncated: boolean;
  /** Screen-reader caption, e.g. "Audit events in Startup Club, newest first". */
  caption: string;
  /** Shown when the scope has no events at all: what will appear here and a first action. */
  nothingYet: ReactNode;
  /** A server-side filter rendered first in the toolbar (the USG view's club form). */
  scopeFilter?: ReactNode;
  /** For tests and deep links; defaults to no filters. */
  initialFilters?: AuditFilters;
}

export function AuditTable({
  rows, scopeName, today, truncated, caption, nothingYet, scopeFilter, initialFilters = initialAuditFilters,
}: AuditTableProps) {
  const [filters, setFilters] = useState(initialFilters);
  const view = useMemo(() => viewAudit(rows, filters), [rows, filters]);
  const actors = useMemo(() => actorOptions(rows), [rows]);
  const actions = useMemo(() => actionOptions(rows), [rows]);
  const table = useTable({ features, columns, data: view.rows, getRowId: (row) => String(row.id) });
  const rangeError = dateRangeError(filters);
  const errorId = useId();
  const set = (patch: Partial<Omit<AuditFilters, 'page'>>) => setFilters(changeAuditFilter(filters, patch));
  const clearFilters = () => setFilters(initialAuditFilters);
  const exportRows = () => {
    const file = auditExport(rows, filters, scopeName, today);
    download(file.filename, file.csv);
  };

  return (
    <section aria-label="Audit events" className="space-y-3">
      {truncated && (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
          <span>Showing the latest 1,000 events. Older events stay in the audit log but are not listed here or in the export.</span>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {scopeFilter}
        {rows.length > 0 && (
          <>
            <label className="w-52 space-y-1">
              <span className="block font-semibold">Actor</span>
              <select value={filters.actor} onChange={(e) => set({ actor: e.target.value })} className={fieldClass}>
                <option value="">Everyone</option>
                {actors.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="w-52 space-y-1">
              <span className="block font-semibold">Action</span>
              <select value={filters.action} onChange={(e) => set({ action: e.target.value as AuditAction | '' })} className={fieldClass}>
                <option value="">All actions</option>
                {actions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="w-40 space-y-1">
              <span className="block font-semibold">From</span>
              <input type="date" value={filters.from} max={today} onChange={(e) => set({ from: e.target.value })} className={fieldClass} />
            </label>
            <label className="w-40 space-y-1">
              <span className="block font-semibold">To</span>
              <input
                type="date" value={filters.to} max={today} onChange={(e) => set({ to: e.target.value })}
                aria-invalid={rangeError ? true : undefined} aria-describedby={rangeError ? errorId : undefined}
                className={fieldClass}
              />
            </label>
            {view.filtered && view.empty !== 'no-results' && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
            <div className="ml-auto flex items-end gap-3">
              <p role="status" className="pb-2 text-muted-foreground">
                {view.filtered ? `${view.matches.length.toLocaleString('en-US')} of ${eventCount(view.total)}` : eventCount(view.total)}
              </p>
              {view.matches.length > 0 && (
                <Button variant="secondary" onClick={exportRows}>
                  <Download aria-hidden />Export {eventCount(view.matches.length)} as CSV
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      {rangeError && <p id={errorId} role="alert" className="text-primary">{rangeError}</p>}
      {rows.length === 0 ? (
        <div className="rounded-md border border-border p-6">{nothingYet}</div>
      ) : (
        <DataTable
          table={table}
          caption={caption}
          numericColumns={['auditId']}
          monoColumns={['time', 'auditId']}
          sorted={{ id: 'time', direction: 'desc' }}
          minWidth={1040}
          alignTop
          empty={<>No events match these filters (0 of {eventCount(view.total)}).{' '}
            <button type="button" className="text-primary underline" onClick={clearFilters}>Clear filters</button>
          </>}
        />
      )}
      {view.pageCount > 1 && (
        <nav aria-label="Audit pages" className="flex items-center justify-end gap-3">
          <Button
            variant="secondary" size="sm" className={pageButton} aria-disabled={view.page === 0}
            onClick={() => { if (view.page > 0) setFilters({ ...filters, page: view.page - 1 }); }}
          >Previous</Button>
          <span aria-live="polite">Page {view.page + 1} of {view.pageCount}</span>
          <Button
            variant="secondary" size="sm" className={pageButton} aria-disabled={view.page === view.pageCount - 1}
            onClick={() => { if (view.page < view.pageCount - 1) setFilters({ ...filters, page: view.page + 1 }); }}
          >Next</Button>
        </nav>
      )}
    </section>
  );
}
