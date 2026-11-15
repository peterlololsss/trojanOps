// Owner: A, with one section per stream. WP-0: every cross-stream interface resolves at its real path
// with its final shape. When you make your function real, move its section into tests/<area>.test.ts
// with real assertions and delete it here.
import { afterAll, describe, expect, it } from 'vitest';
import { capGrants } from '@/lib/authz';
import { now, resetClockForTests } from '@/lib/clock';
import { AppError, type Actor } from '@/lib/contracts';
import { pgTextArray } from '@/lib/db/with-actor';
import { canUse, directory, effectiveAgent, myAgents, provisionOrg, publishToAllStudents } from '@/lib/distribution';
import { listLibraryDocuments } from '@/lib/documents/library';
import { previewAccess } from '@/lib/documents/preview';
import { runAgent } from '@/lib/gateway';
import { audit, listAudit } from '@/lib/gateway/audit';
import { remaining, setLimit } from '@/lib/gateway/quota';
import { transferPosition } from '@/lib/lifecycle/transfer';
import { getConnectors, listConnectors } from '@/lib/connectors/registry';
import { parseRosterCsv } from '@/lib/connectors/roster/mock';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb } from './db';

// grantsFor reads the DB since WP-3, so calls that reach it (getActor, runAgent, B's canUse and
// myAgents) run only when the database is up. Pure stub calls take a literal Actor.
const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

const literal = (userId: string, orgId: string, position: string): Actor => ({
  userId, activeOrgId: orgId, positions: [position], grants: ['*', `${orgId}:*`, `${orgId}:${position}`],
});

describe('A: platform core', () => {
  it('clock starts at DEMO_NOW in demo mode', () => {
    process.env.DEMO_MODE = '1';
    process.env.DEMO_NOW = '2026-11-15T10:00:00-08:00';
    resetClockForTests();
    const drift = now().getTime() - Date.parse('2026-11-15T18:00:00Z');
    delete process.env.DEMO_MODE;
    delete process.env.DEMO_NOW;
    resetClockForTests();
    expect(drift).toBeGreaterThanOrEqual(0);
    expect(drift).toBeLessThan(5_000);
  });

  it('capGrants follows the §5 table', () => {
    const user = ['*', `${ORG.startup}:*`, `${ORG.startup}:treasurer`] as const;
    expect(capGrants([...user], ORG.startup, 'public')).toEqual(['*']);
    expect(capGrants([...user], ORG.startup, 'members')).toEqual(['*', `${ORG.startup}:*`]);
    expect(capGrants([...user], ORG.startup, 'officers')).toEqual([...user]);
  });

  it('withActor encodes text[] settings', () => {
    expect(pgTextArray(['*', `${ORG.startup}:*`])).toBe(`{"*","${ORG.startup}:*"}`);
    expect(pgTextArray([])).toBe('{}');
  });

  it('audit and quota keep their shapes', async () => {
    const actor = literal(USER.taylor, ORG.startup, 'treasurer');
    expect(await audit('quota.limit.set', { actorUserId: null, actingOrgId: null, targetType: 'org', targetId: ORG.startup, details: {} })).toEqual(expect.any(Number));
    expect(await listAudit(actor)).toEqual(expect.any(Array));
    await expect(setLimit(actor, { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 500_000 })).resolves.toBeUndefined();
    expect(await remaining({ scope: 'platform' })).toEqual({ scope: 'platform', limitMicro: expect.any(Number), spentMicro: expect.any(Number), remainingMicro: expect.any(Number) });
  });

  it.skipIf(!probe)('runAgent returns a RunResult and refuses with AppError', async () => {
    const taylor = await actorFor(USER.taylor, ORG.startup);
    const run = await runAgent(taylor, INSTALLATION.startupFundingPrecheck, 'Can we fund pitch night?');
    expect(Object.keys(run).sort()).toEqual(['citations', 'inspector', 'pendingActions', 'reply', 'runId']);
    expect(run.inspector.runGrants.length).toBeGreaterThan(0);
    await expect(runAgent({ ...taylor, userId: null }, INSTALLATION.startupHandoff, 'x')).rejects.toBeInstanceOf(AppError);
  });
});

describe('B: distribution', () => {
  it.skipIf(!probe)('keeps its shapes', async () => {
    const agent = await effectiveAgent(INSTALLATION.startupHandoff);
    expect(agent).toMatchObject({ installationId: INSTALLATION.startupHandoff, status: expect.any(String), sourceIds: expect.any(Array) });
    expect(await canUse(USER.casey, agent)).toHaveProperty('ok');
    await expect(effectiveAgent('nope')).rejects.toBeInstanceOf(AppError);
    expect(await directory()).toEqual(expect.any(Array));
    const clubs = await myAgents(USER.taylor);
    expect(clubs[0]).toEqual({ orgId: expect.any(String), orgName: expect.any(String), positionNames: expect.any(Array), agents: expect.any(Array) });
    expect(await provisionOrg(ORG.dance)).toHaveProperty('installed');
    const casey = literal(USER.casey, ORG.startup, 'member');
    await expect(publishToAllStudents(casey, INSTALLATION.startupRecruitingQa)).rejects.toBeInstanceOf(AppError);
    expect(transferPosition).toHaveLength(4);
  });
});

describe('C: documents', () => {
  it('keeps its shapes', async () => {
    const sam = literal(USER.sam, ORG.startup, 'president');
    expect(await listLibraryDocuments(sam, ORG.startup)).toEqual(expect.any(Array));
    const matrix = await previewAccess(sam, INSTALLATION.startupHandoff);
    expect(Object.keys(matrix).sort()).toEqual(['cells', 'documents', 'subjects']);
  });
});

describe('D: connectors', () => {
  it('keeps its shapes', async () => {
    expect(Object.keys(getConnectors()).sort()).toEqual(['applications', 'documents', 'identity', 'llm', 'roster']);
    expect((await listConnectors()).map((c) => c.kind).sort()).toEqual(['applications', 'documents', 'identity', 'llm', 'roster']);
    expect(await getConnectors().roster.fetch()).toEqual(expect.any(Array));
    expect(() => parseRosterCsv('bad,header\n')).toThrow();
  });
});
