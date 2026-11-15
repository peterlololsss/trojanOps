// Owner: D. Real PostgreSQL roster reconciliation; external source responses are arranged per case.
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { now } from '@/lib/clock';
import { getConnectors, listConnectors } from '@/lib/connectors/registry';
import { memberships, orgs, positions, rosterState, users } from '@/lib/db/schema';
import * as distribution from '@/lib/distribution';
import * as auditLog from '@/lib/gateway/audit';
import { importRoster } from '@/lib/lifecycle/import';
import { ORG, POSITION, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
afterEach(() => vi.restoreAllMocks());

describe.skipIf(!probe)('roster import', () => {
  it('imports the real CSV and leaves seeded club memberships untouched', async () => {
    await inRolledBackApp(async (tx) => {
      const before = await tx.select().from(memberships);
      const actor = await actorFor(USER.avery, ORG.usg);
      const result = await importRoster(actor);
      const [robotics] = await tx.select().from(orgs).where(eq(orgs.slug, 'robotics'));
      expect(robotics).toMatchObject({ name: 'Robotics Club', kind: 'rso', status: 'active' });
      expect(result).toMatchObject({ orgsCreated: 1, usersCreated: 3, positionsCreated: 3, membershipsStarted: 3, membershipsEnded: 0, positionsChanged: 3 });
      expect(result.clubs.filter((c) => !c.created).map((c) => [c.orgName, c.positionsChanged])).toEqual([
        ['Archery Club', 0], ['Startup Club', 0],
      ]);
      const after = await tx.select().from(memberships);
      expect(after.filter((m) => m.orgId !== robotics?.id)).toEqual(before);
      const holders = await tx.select({ user: users.externalId, position: positions.slug }).from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId)).innerJoin(positions, eq(positions.id, memberships.positionId))
        .where(and(eq(memberships.orgId, robotics?.id ?? ''), isNull(memberships.endedAt)));
      expect(holders.sort((a, b) => a.user.localeCompare(b.user))).toEqual([
        { user: 'blake', position: 'member' }, { user: 'quinn', position: 'president' }, { user: 'rowan', position: 'treasurer' },
      ]);
    });
  });

  it('reports zero roster changes on a repeated sync', async () => {
    await inRolledBackApp(async () => {
      const actor = await actorFor(USER.avery, ORG.usg);
      await importRoster(actor);
      const result = await importRoster(actor);
      expect(result).toMatchObject({ orgsCreated: 0, usersCreated: 0, positionsCreated: 0, positionsChanged: 0, membershipsStarted: 0, membershipsEnded: 0 });
    });
  });

  it('preserves an arranged manual transfer when the source roster is unchanged', async () => {
    await inRolledBackApp(async (tx) => {
      const actor = await actorFor(USER.avery, ORG.usg);
      await tx.update(memberships).set({ endedAt: now() }).where(and(eq(memberships.positionId, POSITION.startup.treasurer), isNull(memberships.endedAt)));
      await tx.insert(memberships).values({ userId: USER.jordan, orgId: ORG.startup, positionId: POSITION.startup.treasurer, source: 'manual', startedAt: now(), createdAt: now() });
      await importRoster(actor);
      const active = await tx.select({ userId: memberships.userId, source: memberships.source }).from(memberships)
        .where(and(eq(memberships.positionId, POSITION.startup.treasurer), isNull(memberships.endedAt)));
      expect(active).toEqual([{ userId: USER.jordan, source: 'manual' }]);
    });
  });

  it('replaces the manual holder only after the source roster itself changes', async () => {
    await inRolledBackApp(async (tx) => {
      const actor = await actorFor(USER.avery, ORG.usg);
      await tx.update(memberships).set({ endedAt: now() }).where(and(eq(memberships.positionId, POSITION.startup.treasurer), isNull(memberships.endedAt)));
      await tx.insert(memberships).values({ userId: USER.jordan, orgId: ORG.startup, positionId: POSITION.startup.treasurer, source: 'manual', startedAt: now(), createdAt: now() });
      const source = getConnectors().roster;
      const rows = await source.fetch();
      vi.spyOn(source, 'fetch').mockResolvedValue(rows.map((r) => r.orgSlug === 'startup' && r.position === 'treasurer'
        ? { ...r, externalUserId: 'casey', userDisplayName: 'Casey' } : r));
      await importRoster(actor);
      const active = await tx.select({ userId: memberships.userId, source: memberships.source }).from(memberships)
        .where(and(eq(memberships.positionId, POSITION.startup.treasurer), isNull(memberships.endedAt)));
      expect(active).toEqual([{ userId: USER.casey, source: 'roster' }]);
      expect(await tx.select({ holder: rosterState.externalUserId }).from(rosterState)
        .where(and(eq(rosterState.orgId, ORG.startup), eq(rosterState.positionSlug, 'treasurer')))).toEqual([{ holder: 'casey' }]);
    });
  });

  it('requires the real USG admin membership before reading the roster', async () => {
    const source = vi.spyOn(getConnectors().roster, 'fetch');
    await expect(importRoster({ userId: USER.sam, activeOrgId: ORG.startup, positions: ['admin'], grants: [] })).rejects.toMatchObject({ status: 403 });
    expect(source).not.toHaveBeenCalled();
  });

  it('does not allow the club roster to overwrite USG', async () => {
    await inRolledBackApp(async (tx) => {
      vi.spyOn(getConnectors().roster, 'fetch').mockResolvedValue([
        { orgSlug: 'usg', orgName: 'Changed', externalUserId: 'casey', userDisplayName: 'Casey', position: 'admin' },
      ]);
      await expect(importRoster(await actorFor(USER.avery, ORG.usg))).rejects.toMatchObject({ status: 400 });
      expect((await tx.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, ORG.usg)))).toEqual([{ name: 'USG' }]);
    });
  });

  it('reconciles provisioning again after a failed post-import provision', async () => {
    await inRolledBackApp(async (tx) => {
      const actor = await actorFor(USER.avery, ORG.usg);
      const provision = vi.spyOn(distribution, 'provisionOrg').mockRejectedValueOnce(new Error('provision unavailable')).mockResolvedValue({ installed: 1 });
      await expect(importRoster(actor)).rejects.toThrow('provision unavailable');
      const result = await importRoster(actor);
      expect(result.orgsCreated).toBe(0);
      expect((await tx.select().from(orgs).where(eq(orgs.slug, 'robotics')))).toHaveLength(1);
      expect(result.clubs.map((c) => c.orgName)).toEqual(['Archery Club', 'Robotics Club', 'Startup Club']);
      expect(result.installationsCreated).toBe(3);
      for (const club of result.clubs) expect(provision).toHaveBeenCalledWith(club.orgId, actor);
    });
  });

  it('preserves the previous success time and reports degraded when completion auditing fails', async () => {
    await inRolledBackApp(async () => {
      const actor = await actorFor(USER.avery, ORG.usg);
      await importRoster(actor);
      const before = (await listConnectors()).find((c) => c.kind === 'roster');
      const writer = auditLog.audit;
      vi.spyOn(auditLog, 'audit').mockImplementation((action, event) => action === 'connector.sync' && event.details.succeeded === true
        ? Promise.reject(new Error('audit unavailable')) : writer(action, event));
      await expect(importRoster(actor)).rejects.toThrow('audit unavailable');
      const after = (await listConnectors()).find((c) => c.kind === 'roster');
      expect(after).toMatchObject({ status: 'degraded', lastSyncAt: before?.lastSyncAt });
    });
  });

  it('applies removals: a holder dropped from the source loses the position and the baseline row', async () => {
    await inRolledBackApp(async (tx) => {
      const actor = await actorFor(USER.avery, ORG.usg);
      const rows = await getConnectors().roster.fetch();
      vi.spyOn(getConnectors().roster, 'fetch').mockResolvedValue(rows.filter((r) => !(r.orgSlug === 'startup' && r.externalUserId === 'casey')));
      const result = await importRoster(actor);
      expect(result.membershipsEnded).toBe(1);
      expect(await tx.select().from(memberships).where(and(eq(memberships.userId, USER.casey), eq(memberships.orgId, ORG.startup), isNull(memberships.endedAt)))).toEqual([]);
      expect(await tx.select().from(rosterState).where(and(eq(rosterState.orgId, ORG.startup), eq(rosterState.externalUserId, 'casey')))).toEqual([]);
    });
  });

  it('applies removals: a club dropped from the source loses all of its baseline rows', async () => {
    await inRolledBackApp(async (tx) => {
      const actor = await actorFor(USER.avery, ORG.usg);
      const rows = await getConnectors().roster.fetch();
      vi.spyOn(getConnectors().roster, 'fetch').mockResolvedValue(rows.filter((r) => r.orgSlug !== 'archery'));
      await importRoster(actor);
      expect(await tx.select().from(rosterState).where(eq(rosterState.orgId, ORG.archery))).toEqual([]);
      expect(await tx.select().from(memberships).where(and(eq(memberships.orgId, ORG.archery), isNull(memberships.endedAt)))).toEqual([]);
    });
  });

  it('reports a clear error when the roster.import audit cannot be written after the reconcile', async () => {
    await inRolledBackApp(async () => {
      const actor = await actorFor(USER.avery, ORG.usg);
      const writer = auditLog.audit;
      vi.spyOn(auditLog, 'audit').mockImplementation((action, event) => action === 'roster.import' || (action === 'connector.sync' && event.details.succeeded === false)
        ? Promise.reject(new Error('audit unavailable')) : writer(action, event));
      await expect(importRoster(actor)).rejects.toMatchObject({ status: 400,
        error: { message: 'The roster changed but the audit record could not be written. Run the sync again to reconcile.' } });
    });
  });
});
