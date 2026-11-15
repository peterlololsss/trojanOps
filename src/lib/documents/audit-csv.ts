// Owner: C (WP-9). CSV export of the audit table (ui-designer.md "Audit"). Pure and client-safe: it
// formats rows the server already resolved, so a restricted title never reaches the file.
import { RESTRICTED_DOCUMENT, type AuditRow } from './audit-row';

export const AUDIT_CSV_HEADER = ['Time', 'Actor', 'Action', 'Target', 'Documents', 'Club', 'Audit id'] as const;

/** One CSV cell (RFC 4180). A cell a spreadsheet would read as a formula (= + - @, or a leading tab
 * or CR) gets a leading apostrophe, so it opens as text. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The audit rows as CSV: a header, one line per row, CRLF line endings. */
export function auditCsv(rows: AuditRow[]): string {
  const lines = [
    AUDIT_CSV_HEADER.join(','),
    ...rows.map((row) => [
      row.time,
      row.actor?.name ?? 'System',
      row.actionLabel,
      row.target.label,
      row.documents.map((doc) => doc.title ?? RESTRICTED_DOCUMENT).join('; '),
      row.club?.name ?? '',
      String(row.id),
    ].map(csvCell).join(',')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** "startup-club-audit-2026-11-15.csv" from the scope's name ("Startup Club", "USG") and a
 * Pacific-time day. */
export function auditCsvFilename(scopeName: string, date: string): string {
  const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trojanops';
  const day = date.replace(/[^0-9-]/g, '');
  return `${slug}-audit${day ? `-${day}` : ''}.csv`;
}
