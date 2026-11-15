// Owner: C (WP-9). getAuditPageData (club and USG audit views, §12, demo beat D8) against the seed
// as trojanops_app: who may read which view, names resolved from ids, and document titles under the
// viewer's own RLS ("Restricted document"). Runs go through gateway.runAgent. The DB suite needs a
// seeded database (pnpm db:reset) and is skipped when it is unreachable.
import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError, type Actor } from '@/lib/contracts';
import { auditEvents } from '@/lib/db/schema';
import type { Tx } from '@/lib/db/client';
import { effectiveAgent } from '@/lib/distribution';
import { getAuditPageData, type AuditPageData, type AuditScope } from '@/lib/documents/audit-view';
import type { AuditRow } from '@/lib/documents/audit-row';
import { uploadDocument } from '@/lib/documents/library';
import { runAgent } from '@/lib/gateway';
import { audit } from '@/lib/gateway/audit';
import { DOCUMENT, INSTALLATION, ORG, SOURCE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const sql = await appSql();
afterAll(async () => { await sql?.end(); if (sql) await closeAppDb(); });

const INPUT = 'Audit view sentinel question about pitch night';
const ROW_KEYS = ['action', 'actionLabel', 'actor', 'club', 'date', 'documents', 'id', 'target', 'time', 'ts'];
const byId = <T extends { id: string | null }>(rows: T[]) => [...rows].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));

const page = async (userId: string, orgId: string | null, scope: AuditScope) =>
  getAuditPageData(await actorFor(userId, orgId), scope);
const usg = (orgId?: string): AuditScope => (orgId ? { kind: 'usg', orgId } : { kind: 'usg' });
const club = (orgId: string): AuditScope => ({ kind: 'club', orgId });

async function forbidden(viewer: Promise<Actor>, scope: AuditScope): Promise<string | undefined> {
  try {
    await getAuditPageData(await viewer, scope);
  } catch (err) {
    if (err instanceof AppError) return err.error.code;
    throw err;
  }
  return undefined;
}

/** The run.access row's id for a run (read from audit_events, which has no RLS). */
async function accessRowId(tx: Tx, runId: string): Promise<number> {
  const [row] = await tx.select({ id: auditEvents.id }).from(auditEvents)
    .where(and(eq(auditEvents.runId, runId), eq(auditEvents.action, 'run.access')));
  return row.id;
}

const rowById = (data: AuditPageData | null, id: number): AuditRow | undefined => data?.rows.find((r) => r.id === id);

/** Sam (Startup president) runs funding-precheck: it reads the USG rulebook and both finance documents. */
async function samRunsFundingPrecheck(tx: Tx) {
  const run = await runAgent(await actorFor(USER.sam, ORG.startup), INSTALLATION.startupFundingPrecheck, INPUT);
  return { run, accessId: await accessRowId(tx, run.runId) };
}

describe.skipIf(!sql)('getAuditPageData', () => {
  it('D8: a USG admin sees the run.access row with Restricted document for club finance titles', () => inRolledBackApp(async (tx) => {
    const { accessId } = await samRunsFundingPrecheck(tx);
    const data = await page(USER.avery, ORG.usg, usg());
    const row = rowById(data, accessId);
    const agent = await effectiveAgent(INSTALLATION.startupFundingPrecheck);

    expect(row).toMatchObject({
      action: 'run.access',
      actionLabel: 'Run access',
      actor: { id: USER.sam, name: expect.any(String) },
      club: { id: ORG.startup, name: 'Startup Club' },
      target: { type: 'run', label: agent.name, restricted: false },
    });
    expect(row?.actor?.name).not.toBe(USER.sam);
    expect(byId(row?.documents ?? [])).toEqual(byId([
      { id: null, title: null },
      { id: null, title: null },
      { id: DOCUMENT.usgFundingRules, title: 'USG funding rules (demo text)' },
    ]));
    // Neither the title nor the id of an unreadable document reaches the page.
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/Spring 2026 budget|Sponsor contacts/);
    expect(json).not.toContain(DOCUMENT.spring2026Budget);
    expect(json).not.toContain(DOCUMENT.sponsorContacts);
    expect(row?.time).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM) PT$/);
    expect(row?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data).toMatchObject({ scope: { kind: 'usg' }, org: null, truncated: expect.any(Boolean) });
    expect(data?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data?.clubs.map((c) => c.id)).toEqual(expect.arrayContaining([ORG.startup, ORG.archery, ORG.dance]));
    expect(data?.clubs.map((c) => c.id)).not.toContain(ORG.usg);
  }));

  it('shows the club president the finance titles in the club view', () => inRolledBackApp(async (tx) => {
    const { accessId } = await samRunsFundingPrecheck(tx);
    const data = await page(USER.sam, ORG.startup, club(ORG.startup));
    expect(data).toMatchObject({ scope: { kind: 'club', orgId: ORG.startup }, org: { id: ORG.startup, name: 'Startup Club' }, clubs: [] });
    expect(byId(rowById(data, accessId)?.documents ?? [])).toEqual(byId([
      { id: DOCUMENT.usgFundingRules, title: 'USG funding rules (demo text)' },
      { id: DOCUMENT.spring2026Budget, title: 'Spring 2026 budget' },
      { id: DOCUMENT.sponsorContacts, title: 'Sponsor contacts' },
    ]));
    // The agent.run row names the run's agent too, and carries no documents.
    const done = data?.rows.find((r) => r.action === 'agent.run' && r.id > accessId);
    expect(done).toMatchObject({ actionLabel: 'Agent run', documents: [], club: { id: ORG.startup } });
  }));

  it('limits a club view to rows that concern the club, for a USG admin too', () => inRolledBackApp(async (tx) => {
    const { accessId } = await samRunsFundingPrecheck(tx);
    const archeryId = await audit('quota.limit.set', {
      actorUserId: USER.avery, actingOrgId: ORG.usg, targetType: 'org', targetId: ORG.archery,
      details: { scope: 'org', limitMicro: 5_000_000, previousMicro: 5_000_000 },
    });

    const startup = await page(USER.avery, ORG.usg, club(ORG.startup));
    expect(rowById(startup, accessId)).toBeDefined();
    expect(rowById(startup, archeryId)).toBeUndefined();
    expect(rowById(await page(USER.sam, ORG.startup, club(ORG.startup)), archeryId)).toBeUndefined();

    const all = await page(USER.avery, ORG.usg, usg());
    expect(rowById(all, archeryId)).toMatchObject({
      actionLabel: 'Quota limit set', club: { id: ORG.archery, name: 'Archery Club' },
      target: { type: 'org', label: 'Archery Club', restricted: false },
    });

    const archery = await page(USER.avery, ORG.usg, usg(ORG.archery));
    expect(archery?.org).toEqual({ id: ORG.archery, name: 'Archery Club' });
    expect(rowById(archery, archeryId)).toBeDefined();
    expect(rowById(archery, accessId)).toBeUndefined();
  }));

  it('D8: shows the club president a rejected widening with the agent and club', () => inRolledBackApp(async () => {
    // As B's checkedWrite writes it for a clamp_violation on PATCH /installations/:id.
    const rejectedId = await audit('installation.rejected', {
      actorUserId: USER.sam, actingOrgId: ORG.startup, installationId: INSTALLATION.startupFundingPrecheck,
      targetType: 'installation', targetId: INSTALLATION.startupFundingPrecheck,
      details: { field: 'maxTier', allowed: 'officers', action: 'installation.update' },
    });
    const agent = await effectiveAgent(INSTALLATION.startupFundingPrecheck);
    const expected = {
      action: 'installation.rejected', actionLabel: 'Agent change rejected',
      actor: { id: USER.sam }, club: { id: ORG.startup, name: 'Startup Club' },
      target: { type: 'installation', label: agent.name, restricted: false }, documents: [],
    };
    expect(rowById(await page(USER.sam, ORG.startup, club(ORG.startup)), rejectedId)).toMatchObject(expected);
    expect(rowById(await page(USER.avery, ORG.usg, usg()), rejectedId)).toMatchObject(expected);
  }));

  it('refuses anyone who may not read the view', async () => {
    expect(await forbidden(actorFor(USER.taylor, ORG.startup), club(ORG.startup))).toBe('forbidden');
    expect(await forbidden(actorFor(USER.casey, ORG.startup), club(ORG.startup))).toBe('forbidden');
    expect(await forbidden(actorFor(USER.sam, ORG.startup), club(ORG.archery))).toBe('forbidden');
    // listAudit would hand a president their own club for an unscoped read; the USG view refuses.
    expect(await forbidden(actorFor(USER.sam, ORG.startup), usg())).toBe('forbidden');
    expect(await forbidden(actorFor(USER.sam, ORG.startup), usg(ORG.startup))).toBe('forbidden');
    expect(await forbidden(actorFor(USER.riley, ORG.usg), usg())).toBe('forbidden');
    expect(await forbidden(actorFor(USER.lee, null), usg())).toBe('forbidden');
    expect(await forbidden(Promise.resolve({ userId: null, activeOrgId: null, positions: [], grants: [] }), club(ORG.startup)))
      .toBe('unauthenticated');
  });

  it('returns null for a club that is not a uuid or does not exist', async () => {
    expect(await page(USER.sam, ORG.startup, club('not-a-uuid'))).toBeNull();
    expect(await page(USER.sam, ORG.startup, club(DOCUMENT.recruitingFaq))).toBeNull();
    expect(await page(USER.avery, ORG.usg, usg('not-a-uuid'))).toBeNull();
    expect(await page(USER.avery, ORG.usg, usg(DOCUMENT.recruitingFaq))).toBeNull();
  });

  it('carries no run input or output (I15)', () => inRolledBackApp(async (tx) => {
    const { accessId } = await samRunsFundingPrecheck(tx);
    for (const [userId, orgId, scope] of [[USER.sam, ORG.startup, club(ORG.startup)], [USER.avery, ORG.usg, usg()]] as const) {
      const data = await page(userId, orgId, scope);
      expect(rowById(data, accessId)).toBeDefined();
      expect(JSON.stringify(data)).not.toContain(INPUT);
      expect(JSON.stringify(data)).not.toMatch(/Demo runtime|placeholder answer/);
      for (const row of data?.rows ?? []) expect(Object.keys(row).sort()).toEqual(ROW_KEYS);
    }
  }));

  it('resolves an uploaded document under the viewer’s RLS', () => inRolledBackApp(async () => {
    const sam = await actorFor(USER.sam, ORG.startup);
    await uploadDocument(sam, ORG.startup, {
      sourceId: SOURCE.startup.finance, title: 'Audit sentinel budget', tier: 'officers', allowedPositions: ['treasurer'], bodyMd: 'Officers only.',
    });
    await uploadDocument(sam, ORG.startup, {
      sourceId: SOURCE.startup.public, title: 'Audit sentinel FAQ', tier: 'public', allowedPositions: [], bodyMd: 'For everyone.',
    });
    const upload = (data: AuditPageData | null, docTitle: string | null) =>
      data?.rows.find((r) => r.action === 'document.upload' && r.target.label === (docTitle ?? 'Restricted document'));

    const own = await page(USER.sam, ORG.startup, club(ORG.startup));
    const mine = own?.rows.filter((r) => r.action === 'document.upload').slice(0, 2);
    expect(mine?.map((r) => r.target)).toEqual([
      { type: 'document', label: 'Audit sentinel FAQ', restricted: false },
      { type: 'document', label: 'Audit sentinel budget', restricted: false },
    ]);
    expect(upload(own, 'Audit sentinel budget')).toMatchObject({ actionLabel: 'Document uploaded', club: { id: ORG.startup } });

    const avery = await page(USER.avery, ORG.usg, usg(ORG.startup));
    const latest = avery?.rows.filter((r) => r.action === 'document.upload').slice(0, 2);
    expect(latest?.map((r) => r.target)).toEqual([
      { type: 'document', label: 'Audit sentinel FAQ', restricted: false },
      { type: 'document', label: 'Restricted document', restricted: true },
    ]);
    expect(JSON.stringify(avery)).not.toContain('Audit sentinel budget');
  }));

  it('never reads run rows: the module does not touch agent_runs', () => {
    const source = readFileSync(new URL('../src/lib/documents/audit-view.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/agentRuns|agent_runs/);
    expect(source).not.toMatch(/\.(input|output)\b/);
  });
});
