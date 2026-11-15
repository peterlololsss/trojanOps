// Owner: A, with one section per stream. WP-0: every cross-stream interface resolves at its real path
// with its final shape. When you make your function real, move its section into tests/<area>.test.ts
// with real assertions and delete it here.
import { afterAll, describe, expect, it } from 'vitest';
import { capGrants } from '@/lib/authz';
import { now, resetClockForTests } from '@/lib/clock';
import { AppError, type Actor } from '@/lib/contracts';
import { pgTextArray } from '@/lib/db/with-actor';
import { canUse, directory, effectiveAgent, myAgents, provisionOrg, publishToAllStudents } from '@/lib/distribution';
import { transferPosition } from '@/lib/lifecycle/transfer';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { appSql, closeAppDb } from './db';

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

  // runAgent, audit, listAudit and quota are real since WP-4: tests/gateway.test.ts, tests/quota.test.ts.
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

