// Owner: C (WP-9). The audit CSV export and the Pacific-time formatting the audit table uses. Pure:
// no database.
import { describe, expect, it } from 'vitest';
import { auditTime, ptDate } from '@/components/inspector/format';
import { AUDIT_CSV_HEADER, auditCsv, auditCsvFilename, csvCell } from '@/lib/documents/audit-csv';
import type { AuditRow } from '@/lib/documents/audit-row';

const row = (overrides: Partial<AuditRow> = {}): AuditRow => ({
  id: 1042,
  ts: '2026-11-15T18:42:00.000Z',
  time: 'Nov 15, 2026, 10:42 AM PT',
  date: '2026-11-15',
  actor: { id: 'u1', name: 'Sam Rivera' },
  action: 'run.access',
  actionLabel: 'Run access',
  club: { id: 'o1', name: 'Startup Club' },
  target: { type: 'run', label: 'Funding pre-check', restricted: false },
  documents: [],
  ...overrides,
});

describe('auditCsv', () => {
  it('writes the header and one CRLF line per row', () => {
    const csv = auditCsv([row(), row({ id: 1041, actor: null, club: null })]);
    expect(AUDIT_CSV_HEADER.join(',')).toBe('Time,Actor,Action,Target,Documents,Club,Audit id');
    expect(csv).toBe([
      'Time,Actor,Action,Target,Documents,Club,Audit id',
      '"Nov 15, 2026, 10:42 AM PT",Sam Rivera,Run access,Funding pre-check,,Startup Club,1042',
      '"Nov 15, 2026, 10:42 AM PT",System,Run access,Funding pre-check,,,1041',
      '',
    ].join('\r\n'));
  });

  it('writes Restricted document for a title the viewer cannot read, and joins documents with "; "', () => {
    const csv = auditCsv([row({ documents: [
      { id: 'd1', title: 'USG funding rules (demo text)' },
      { id: null, title: null },
      { id: null, title: null },
    ] })]);
    expect(csv).toContain(',USG funding rules (demo text); Restricted document; Restricted document,');
    expect(csv).not.toContain('d2');
  });

  it('writes a restricted document target as its label', () => {
    const csv = auditCsv([row({ action: 'document.upload', actionLabel: 'Document uploaded',
      target: { type: 'document', label: 'Restricted document', restricted: true } })]);
    expect(csv.split('\r\n')[1]).toBe('"Nov 15, 2026, 10:42 AM PT",Sam Rivera,Document uploaded,Restricted document,,Startup Club,1042');
  });

  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('cr\rlf')).toBe('"cr\rlf"');
    const csv = auditCsv([row({ target: { type: 'document', label: 'Budget, "final"\nv2', restricted: false } })]);
    expect(csv).toContain(',"Budget, ""final""\nv2",');
  });

  it('guards cells a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
    expect(csvCell('\rcmd')).toBe(`"'\rcmd"`);
    expect(csvCell('a=b')).toBe('a=b');
    const csv = auditCsv([row({ documents: [{ id: 'd1', title: '=cmd|calc' }] })]);
    expect(csv).toContain(",'=cmd|calc,");
  });
});

describe('auditCsvFilename', () => {
  it('names the file after the scope and the day', () => {
    expect(auditCsvFilename('Startup Club', '2026-11-15')).toBe('startup-club-audit-2026-11-15.csv');
    expect(auditCsvFilename('USG', '2026-11-15')).toBe('usg-audit-2026-11-15.csv');
    expect(auditCsvFilename('  Dance & Co. ', '2026-11-15')).toBe('dance-co-audit-2026-11-15.csv');
    expect(auditCsvFilename('', '2026/11/15')).toBe('trojanops-audit-20261115.csv');
  });
});

describe('Pacific time', () => {
  it('formats an absolute time with PT for both PST and PDT', () => {
    expect(auditTime(new Date('2026-11-15T18:42:00Z'))).toBe('Nov 15, 2026, 10:42 AM PT');  // PST
    expect(auditTime(new Date('2026-07-04T19:05:00Z'))).toBe('Jul 4, 2026, 12:05 PM PT');   // PDT
    expect(auditTime(new Date('2026-11-15T08:00:00Z'))).toBe('Nov 15, 2026, 12:00 AM PT');
  });

  it('gives the Pacific calendar day', () => {
    expect(ptDate(new Date('2026-11-15T18:42:00Z'))).toBe('2026-11-15');
    expect(ptDate(new Date('2026-11-15T07:59:00Z'))).toBe('2026-11-14');
    expect(ptDate(new Date('2026-03-01T12:00:00Z'))).toBe('2026-03-01');
  });
});
