// Owner: C (WP-9). Markup of the audit views (demo beat D8): the shared table, its filters and states,
// the no-permission copy, and the CSV export of the filtered rows. Rendered to static HTML in node (no
// browser, no database), with seed ids for fixtures.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { AuditTable, type AuditTableProps } from '@/components/inspector';
import { AuditForbidden, AuditSignedOut } from '@/components/inspector/audit-access';
import {
  actionOptions, actorOptions, auditExport, dateRangeError, filterAuditRows, initialAuditFilters,
  SYSTEM_ACTOR, viewAudit, type AuditFilters,
} from '@/components/inspector/audit-filter';
import type { AuditRow } from '@/lib/documents/audit-row';
import { getAuditPageData, type AuditScope } from '@/lib/documents/audit-view';
import { runAgent } from '@/lib/gateway';
import { DOCUMENT, INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const sql = await appSql();
afterAll(async () => { await sql?.end(); if (sql) await closeAppDb(); });

const startup = { id: ORG.startup, name: 'Startup Club' };
const sam = { id: USER.sam, name: 'Sam Rivera' };
const avery = { id: USER.avery, name: 'Avery Chen' };

const row = (patch: Partial<AuditRow> & Pick<AuditRow, 'id' | 'action' | 'actionLabel'>): AuditRow => ({
  ts: '2026-11-15T18:42:00.000Z',
  time: 'Nov 15, 2026, 10:42 AM PT',
  date: '2026-11-15',
  actor: sam,
  club: startup,
  target: { type: 'run', label: 'Funding pre-check', restricted: false },
  documents: [],
  ...patch,
});

const rows: AuditRow[] = [
  row({
    id: 1043, action: 'run.access', actionLabel: 'Run access',
    documents: [
      { id: DOCUMENT.usgFundingRules, title: 'USG funding rules (demo text)' },
      { id: null, title: null },
      { id: null, title: null },
    ],
  }),
  row({
    id: 1040, action: 'document.upload', actionLabel: 'Document uploaded', actor: sam,
    target: { type: 'document', label: 'Restricted document', restricted: true },
  }),
  row({
    id: 980, action: 'quota.limit.set', actionLabel: 'Quota limit set', actor: avery,
    ts: '2026-11-14T17:05:00.000Z', time: 'Nov 14, 2026, 9:05 AM PT', date: '2026-11-14',
    target: { type: 'org', label: 'Startup Club', restricted: false },
  }),
  row({
    id: 12, action: 'org.provision', actionLabel: 'Club provisioned', actor: null,
    ts: '2026-11-13T16:00:00.000Z', time: 'Nov 13, 2026, 8:00 AM PT', date: '2026-11-13',
    target: { type: 'org', label: 'Startup Club', restricted: false },
  }),
];

const render = (props: Partial<AuditTableProps> = {}) => renderToStaticMarkup(createElement(AuditTable, {
  rows,
  scopeName: 'Startup Club',
  today: '2026-11-15',
  truncated: false,
  caption: 'Audit events in Startup Club, newest first',
  nothingYet: 'No audit events in Startup Club yet.',
  ...props,
}));

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const filters = (patch: Partial<AuditFilters>): AuditFilters => ({ ...initialAuditFilters, ...patch });

describe('audit table markup', () => {
  it('renders the columns, absolute PT times in mono, audit ids and the sort icon on Time only', () => {
    const html = render();
    expect([...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => text(m[1]).trim()))
      .toEqual(['Time', 'Actor', 'Action', 'Target', 'Club', 'Audit id']);
    expect(html.match(/aria-sort="descending"/g)).toHaveLength(1);
    expect(html).toMatch(/font-mono[^"]*"><time datetime="2026-11-15T18:42:00.000Z">Nov 15, 2026, 10:42 AM PT<\/time>/i);
    expect(html).toMatch(/font-mono[^"]*">#1043</);
    expect(text(html)).toContain('System');
  });

  it('shows unreadable documents as "Restricted document" with a lock, never their title or id', () => {
    const html = render();
    expect(text(html)).toContain('Permitted (3):');
    expect(text(html)).toContain('USG funding rules (demo text)');
    // Two restricted documents in the run.access row and the restricted upload target.
    expect(html.match(/Restricted document/g)).toHaveLength(3);
    // Each one: muted text, a lock icon, then the words.
    expect(html.match(/text-muted-foreground"><svg[^>]*lucide-lock[^>]*>(?:(?!<\/svg>).)*<\/svg>Restricted document/g)).toHaveLength(3);
    expect(html).not.toMatch(/Spring 2026 budget|Sponsor contacts/);
    for (const id of [DOCUMENT.spring2026Budget, DOCUMENT.sponsorContacts, DOCUMENT.usgFundingRules]) {
      expect(html).not.toContain(id);
    }
  });

  it('shows three documents of a run, then "+N more"', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `doc-${i}`, title: `Document ${i}` }));
    const html = render({ rows: [row({ id: 1, action: 'run.access', actionLabel: 'Run access', documents: many })] });
    expect(text(html)).toContain('Document 2');
    expect(text(html)).not.toContain('Document 3');
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>\+2 more<\/button>/);
  });

  it('labels the export with the count and offers the filters', () => {
    const html = render();
    expect(text(html)).toContain('Export 4 events as CSV');
    expect(html).toMatch(/<label[^>]*><span[^>]*>Actor<\/span><select/);
    expect(html).toMatch(/<option value="system">System<\/option>/);
    expect(html).toContain('<option value="run.access">Run access</option>');
    expect(html).not.toContain('Template retired');   // only actions present
    expect(html).toMatch(/type="date"[^>]*max="2026-11-15"/);
    expect(text(html)).not.toContain('Clear filters');
  });

  it('explains an empty log and hides filters and export', () => {
    const html = render({ rows: [] });
    expect(text(html)).toContain('No audit events in Startup Club yet.');
    expect(html).not.toContain('<select');
    expect(text(html)).not.toContain('Export');
  });

  it('gives the count and "Clear filters" when no row matches', () => {
    const html = render({ initialFilters: filters({ action: 'template.retire' }) });
    expect(text(html)).toContain('No events match these filters (0 of 4 events).');
    expect(html.match(/Clear filters/g)).toHaveLength(1);
    expect(text(html)).toContain('0 of 4 events');
    expect(text(html)).not.toContain('Export');
  });

  it('counts filtered rows and exports only those', () => {
    const html = render({ initialFilters: filters({ actor: USER.sam }) });
    expect(text(html)).toContain('2 of 4 events');
    expect(text(html)).toContain('Export 2 events as CSV');
    expect(text(html)).toContain('Clear filters');
  });

  it('says when only the latest 1,000 events are shown', () => {
    expect(text(render({ truncated: true }))).toContain('Showing the latest 1,000 events.');
    expect(text(render())).not.toContain('latest 1,000');
  });

  it('flags a reversed date range on the end date', () => {
    const html = render({ initialFilters: filters({ from: '2026-11-15', to: '2026-11-14' }) });
    expect(html).toMatch(/aria-invalid="true" aria-describedby="[^"]+"/);
    expect(html).toContain('role="alert"');
    expect(dateRangeError(filters({ from: '2026-11-14', to: '2026-11-15' }))).toBeNull();
  });
});

describe('audit filters and export', () => {
  it('filters by actor, System, action and inclusive PT dates', () => {
    const ids = (f: Partial<AuditFilters>) => filterAuditRows(rows, filters(f)).map((r) => r.id);
    expect(ids({})).toEqual([1043, 1040, 980, 12]);
    expect(ids({ actor: USER.avery })).toEqual([980]);
    expect(ids({ actor: SYSTEM_ACTOR })).toEqual([12]);
    expect(ids({ action: 'run.access' })).toEqual([1043]);
    expect(ids({ from: '2026-11-14' })).toEqual([1043, 1040, 980]);
    expect(ids({ from: '2026-11-14', to: '2026-11-14' })).toEqual([980]);
    expect(ids({ to: '2026-11-13' })).toEqual([12]);
  });

  it('lists actors by name with System last, and actions in label order', () => {
    expect(actorOptions(rows).map((o) => o.label)).toEqual(['Avery Chen', 'Sam Rivera', 'System']);
    expect(actionOptions(rows).map((o) => o.value)).toEqual(['run.access', 'quota.limit.set', 'org.provision', 'document.upload']);
  });

  it('pages 25 rows at a time and clamps the page', () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ id: i, action: 'agent.run', actionLabel: 'Agent run' }));
    const view = viewAudit(many, filters({ page: 9 }));
    expect(view).toMatchObject({ page: 1, pageCount: 2, total: 30, empty: null, filtered: false });
    expect(view.rows).toHaveLength(5);
    expect(view.matches).toHaveLength(30);
  });

  it('writes the CSV from the filtered rows only, with Restricted document for unreadable titles', () => {
    const { filename, csv } = auditExport(rows, filters({ actor: USER.sam }), 'Startup Club', '2026-11-15');
    expect(filename).toBe('startup-club-audit-2026-11-15.csv');
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);   // header + Sam's two rows
    expect(lines[1]).toContain('Run access');
    expect(lines[1]).toContain('USG funding rules (demo text); Restricted document; Restricted document');
    expect(lines[2]).toContain('Document uploaded,Restricted document');
    expect(csv).not.toMatch(/Avery Chen|Club provisioned/);
    expect(auditExport(rows, initialAuditFilters, 'USG', '2026-11-15').filename).toBe('usg-audit-2026-11-15.csv');
  });
});

describe.skipIf(!sql)('audit views over the seed (D8)', () => {
  const renderScope = async (userId: string, orgId: string, scope: AuditScope) => {
    const data = await getAuditPageData(await actorFor(userId, orgId), scope);
    if (!data) throw new Error('expected audit data');
    return renderToStaticMarkup(createElement(AuditTable, {
      rows: data.rows, scopeName: data.org?.name ?? 'USG', today: data.today, truncated: data.truncated,
      caption: 'Audit events', nothingYet: 'No audit events yet.',
    }));
  };

  it('shows Avery the funding pre-check run with restricted finance documents, and Sam their titles', () => inRolledBackApp(async () => {
    await runAgent(await actorFor(USER.sam, ORG.startup), INSTALLATION.startupFundingPrecheck, 'Audit render sentinel');
    const usg = await renderScope(USER.avery, ORG.usg, { kind: 'usg' });
    expect(text(usg)).toContain('Run access');
    expect(text(usg)).toContain('Permitted (3):');
    expect(text(usg)).toContain('USG funding rules (demo text)');
    expect(text(usg)).toContain('Restricted document');
    expect(usg).not.toMatch(/Spring 2026 budget|Sponsor contacts|Audit render sentinel/);
    expect(usg).not.toContain(DOCUMENT.spring2026Budget);
    expect(usg).not.toContain(DOCUMENT.sponsorContacts);
    expect(usg).toMatch(/Nov \d{1,2}, 2026, \d{1,2}:\d{2} (AM|PM) PT/);

    const club = await renderScope(USER.sam, ORG.startup, { kind: 'club', orgId: ORG.startup });
    expect(text(club)).toContain('Spring 2026 budget');
    expect(club).not.toContain('Audit render sentinel');
  }));
});

describe('audit access states', () => {
  it('says who can read the club log and how to switch', () => {
    const html = text(renderToStaticMarkup(createElement(AuditForbidden, { scope: 'club' })));
    expect(html).toContain('Only this club’s president, with this club active, and USG admins can read this audit log.');
    expect(html).toContain('Switch your persona or active club');
  });

  it('says only USG admins read the full log and points presidents to their club', () => {
    const html = text(renderToStaticMarkup(createElement(AuditForbidden, { scope: 'usg' })));
    expect(html).toContain('Only USG admins can read the full audit log.');
    expect(html).toContain('Club presidents can read their own club’s log from the club’s Audit page.');
  });

  it('links signed-out viewers to the persona picker', () => {
    expect(renderToStaticMarkup(createElement(AuditSignedOut))).toMatch(/<a[^>]*href="\/"[^>]*>Choose a persona to sign in<\/a>/);
  });
});
