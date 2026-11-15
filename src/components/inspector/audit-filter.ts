// Owner: C (WP-9). Pure view logic for the audit table (ui-designer.md "Audit"): actor, action and
// date filters over the rows the server already loaded, pagination, and the CSV export of exactly the
// filtered rows. No I/O and no React, so the table and the tests share one definition.
import type { AuditAction } from '@/lib/contracts';
import { auditCsv, auditCsvFilename } from '@/lib/documents/audit-csv';
import { ACTION_LABELS, type AuditRow } from '@/lib/documents/audit-row';

export const AUDIT_PAGE_SIZE = 25;

/** The actor filter's value for rows with no actor (seed, scheduled provisioning). */
export const SYSTEM_ACTOR = 'system';

export interface AuditFilters {
  /** A user id, SYSTEM_ACTOR, or '' for everyone. */
  actor: string;
  action: AuditAction | '';
  /** Pacific-time days, "2026-11-15", inclusive; '' for no bound. */
  from: string;
  to: string;
  /** Zero-based; clamped to the last page by viewAudit. */
  page: number;
}

export const initialAuditFilters: AuditFilters = { actor: '', action: '', from: '', to: '', page: 0 };

/** A filter change always returns to the first page; a page change keeps the filters. */
export function changeAuditFilter(filters: AuditFilters, patch: Partial<Omit<AuditFilters, 'page'>>): AuditFilters {
  return { ...filters, ...patch, page: 0 };
}

export const isFiltered = (f: AuditFilters) => f.actor !== '' || f.action !== '' || f.from !== '' || f.to !== '';

/** "The end date is before the start date…" when the range is reversed, else null. */
export function dateRangeError(f: AuditFilters): string | null {
  return f.from && f.to && f.to < f.from
    ? 'The end date is before the start date. Choose an end date on or after the start date.'
    : null;
}

export interface Option<T extends string = string> { value: T; label: string }

/** The actors present in the rows, by name, with "System" last. */
export function actorOptions(rows: readonly AuditRow[]): Option[] {
  const people = new Map<string, string>();
  let system = false;
  for (const row of rows) {
    if (row.actor) people.set(row.actor.id, row.actor.name);
    else system = true;
  }
  const options = [...people].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
  return system ? [...options, { value: SYSTEM_ACTOR, label: 'System' }] : options;
}

/** The actions present in the rows, in ACTION_LABELS order (runs, access, quota, distribution…). */
export function actionOptions(rows: readonly AuditRow[]): Option<AuditAction>[] {
  const present = new Set(rows.map((r) => r.action));
  return (Object.entries(ACTION_LABELS) as Array<[AuditAction, string]>)
    .filter(([value]) => present.has(value))
    .map(([value, label]) => ({ value, label }));
}

/** Rows matching every filter, in their input order (newest first). */
export function filterAuditRows(rows: readonly AuditRow[], f: AuditFilters): AuditRow[] {
  return rows.filter((row) => (!f.actor || (row.actor ? row.actor.id === f.actor : f.actor === SYSTEM_ACTOR))
    && (!f.action || row.action === f.action)
    && (!f.from || row.date >= f.from)
    && (!f.to || row.date <= f.to));
}

export interface AuditView {
  /** The current page. */
  rows: AuditRow[];
  /** Every row matching the filters, across pages: what Export writes. */
  matches: AuditRow[];
  total: number;
  page: number;
  pageCount: number;
  filtered: boolean;
  empty: 'nothing-yet' | 'no-results' | null;
}

export function viewAudit(rows: readonly AuditRow[], f: AuditFilters, pageSize = AUDIT_PAGE_SIZE): AuditView {
  const matches = filterAuditRows(rows, f);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(0, Math.trunc(f.page) || 0), pageCount - 1);
  return {
    rows: matches.slice(page * pageSize, (page + 1) * pageSize),
    matches,
    total: rows.length,
    page,
    pageCount,
    filtered: isFiltered(f),
    empty: rows.length === 0 ? 'nothing-yet' : matches.length === 0 ? 'no-results' : null,
  };
}

/** "1 event", "23 events", "1,000 events". */
export const eventCount = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'event' : 'events'}`;

/** The CSV file for the rows matching the filters: never the unfiltered set. */
export function auditExport(rows: readonly AuditRow[], f: AuditFilters, scopeName: string, today: string) {
  return { filename: auditCsvFilename(scopeName, today), csv: auditCsv(filterAuditRows(rows, f)) };
}
