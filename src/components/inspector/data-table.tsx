'use client';

// Owner: C. A presentational table over a TanStack v9 table instance, following the Data Table rules
// in .claude/agents/ui-designer.md: 40px rows, right-aligned numeric columns, a sort icon only on the
// sorted column, muted header row, 1px row dividers. Shared by the document library and the audit
// views; it knows nothing about either, so stream D can move it to src/components/ui. The caller owns
// state (filters, pages) and passes the table.
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactTable, RowData, TableFeatures } from '@tanstack/react-table';

export interface SortedColumn { id: string; direction: 'asc' | 'desc' }

export interface DataTableProps<TFeatures extends TableFeatures, TData extends RowData> {
  table: ReactTable<TFeatures, TData>;
  /** Visible to screen readers only. */
  caption: string;
  /** Column ids that hold numbers: right-aligned with tabular figures. */
  numericColumns?: readonly string[];
  /** Column ids whose cells are monospace text, such as timestamps and ids. */
  monoColumns?: readonly string[];
  /** The first column's cells render as row headers. */
  rowHeaderColumn?: string;
  /** The column the rows are already sorted by. Only it shows a sort icon. */
  sorted?: SortedColumn;
  /** Shown in one full-width row when there are no rows. */
  empty?: ReactNode;
  minWidth?: number;
  /** Top-align cells when some rows wrap to several lines. */
  alignTop?: boolean;
}

export function DataTable<TFeatures extends TableFeatures, TData extends RowData>({
  table, caption, numericColumns = [], monoColumns = [], rowHeaderColumn, sorted, empty, minWidth = 760, alignTop = false,
}: DataTableProps<TFeatures, TData>) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;
  return (
    <div tabIndex={0} role="region" aria-label={caption} className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="h-[40px]">
              {group.headers.map((header) => {
                const isSorted = sorted?.id === header.column.id;
                const numeric = numericColumns.includes(header.column.id);
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={isSorted ? (sorted.direction === 'desc' ? 'descending' : 'ascending') : undefined}
                    className={`px-3 font-semibold ${numeric ? 'text-right' : ''}`}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        <table.FlexRender header={header} />
                        {isSorted && (sorted.direction === 'desc'
                          ? <ArrowDown aria-hidden className="size-3" />
                          : <ArrowUp aria-hidden className="size-3" />)}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-[40px] border-t border-border hover:bg-accent">
              {row.getAllCells().map((cell) => {
                const id = cell.column.id;
                const className = `px-3 py-2 ${alignTop ? 'align-top' : ''} ${numericColumns.includes(id) ? 'text-right tabular-nums' : ''} ${
                  monoColumns.includes(id) ? 'whitespace-nowrap font-mono text-xs' : ''}`;
                return id === rowHeaderColumn
                  ? <th key={cell.id} scope="row" className={`${className} font-semibold`}><table.FlexRender cell={cell} /></th>
                  : <td key={cell.id} className={className}><table.FlexRender cell={cell} /></td>;
              })}
            </tr>
          ))}
          {rows.length === 0 && empty && (
            <tr><td colSpan={columnCount} className="p-6 text-center text-muted-foreground">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
