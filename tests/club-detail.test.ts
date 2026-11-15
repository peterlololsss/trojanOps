import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { clubIdentityRows, identityColumns, listManagedClubs, loadClubDetail, type ClubDetail } from '@/lib/connectors/club-detail';
import { grantsFor } from '@/lib/authz';
import { users } from '@/lib/db/schema';
import { withActor } from '@/lib/db/with-actor';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, ensureDocumentFixture, inRolledBackApp, ts } from './db';

// Lets one test make the quota source fail; every other call reaches B's real view.
const quotaSource = vi.hoisted(() => ({ fail: false }));
vi.mock('@/lib/distribution/usg-view', async (original) => {
  const real = await original<typeof import('@/lib/distribution/usg-view')>();
  return { ...real, usgClubsView: async (...args: Parameters<typeof real.usgClubsView>) => {
    if (quotaSource.fail) throw new Error('private source path');
    return real.usgClubsView(...args);
  } };
});

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
afterEach(() => { vi.restoreAllMocks(); quotaSource.fail = false; });

const ready = <T,>(block: { status: 'ready'; data: T } | { status: 'unavailable' }): T => {
  if (block.status !== 'ready') throw new Error('expected a ready block');
  return block.data;
};
const detailFor = async (orgId: string): Promise<ClubDetail> => {
  const detail = await loadClubDetail(await actorFor(USER.avery, ORG.usg), orgId);
  if (!detail) throw new Error('expected a club detail');
  return detail;
};

describe('club identity rows', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
  it('groups positions per person and reports the latest departure for former members', () => {
    const rows = clubIdentityRows([
      { userId: 'u-taylor', person: 'Taylor', position: 'Treasurer', endedAt: null },
      { userId: 'u-taylor', person: 'Taylor', position: 'Member', endedAt: null },
      { userId: 'u-casey', person: 'Casey', position: 'Member', endedAt: day('2026-08-01') },
      { userId: 'u-casey', person: 'Casey', position: 'Member', endedAt: day('2026-09-15') },
    ]);
    expect(rows).toEqual([
      ['Casey', 'Member', 'Left organization', 'Sep 15, 2026'],
      ['Taylor', 'Member; Treasurer', 'Active member', '—'],
    ]);
  });

  it('counts a remaining active position as membership even after another office ended', () => {
    const rows = clubIdentityRows([
      { userId: 'u-jordan', person: 'Jordan', position: 'Treasurer', endedAt: day('2026-10-01') },
      { userId: 'u-jordan', person: 'Jordan', position: 'Member', endedAt: null },
    ]);
    expect(rows).toEqual([['Jordan', 'Member', 'Active member', '—']]);
  });

  it('keeps two people with the same display name apart', () => {
    const rows = clubIdentityRows([
      { userId: 'u-1', person: 'Alex', position: 'Member', endedAt: null },
      { userId: 'u-2', person: 'Alex', position: 'Treasurer', endedAt: null },
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe.skipIf(!probe)('per-club management detail', () => {
  it('refuses anyone but a USG administrator', async () => {
    await inRolledBackApp(async () => {
      const sam = await actorFor(USER.sam, ORG.startup);
      await expect(loadClubDetail(sam, ORG.startup)).rejects.toMatchObject({ error: { code: 'forbidden' } });
      await expect(listManagedClubs(sam)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    });
  });

  it('lists clubs only, and returns null for unknown, malformed or non-club ids', async () => {
    await inRolledBackApp(async () => {
      const avery = await actorFor(USER.avery, ORG.usg);
      const clubs = await listManagedClubs(avery);
      expect(clubs.map(club => club.id)).toEqual(expect.arrayContaining([ORG.startup, ORG.archery, ORG.dance]));
      expect(clubs.some(club => club.id === ORG.usg)).toBe(false);
      for (const id of ['garbage', ORG.usg, '00000000-0000-4000-8000-00000000ffff']) {
        expect(await loadClubDetail(avery, id)).toBeNull();
      }
    });
  });

  it('shows current members of this club and no other club, without roster columns', async () => {
    await inRolledBackApp(async tx => {
      await tx.update(users).set({ displayName: 'Current account name' }).where(eq(users.id, USER.sam));
      const startup = ready((await detailFor(ORG.startup)).identity);
      expect(startup.columns).toEqual(['Person', 'Positions', 'Member status', 'Left on (UTC)']);
      expect(startup.columns).toEqual(identityColumns);
      expect(startup.rows.find(row => row[0] === 'Current account name')?.slice(1, 3)).toEqual(['President', 'Active member']);
      expect(startup.rows.find(row => row[0] === 'Morgan')?.[1]).not.toContain('Treasurer');
      expect(JSON.stringify(startup)).not.toContain(USER.sam);

      const archery = ready((await detailFor(ORG.archery)).identity);
      expect(archery.rows.find(row => row[0] === 'Casey')?.[2]).toBe('Left organization');
      expect(archery.rows.find(row => row[0] === 'Casey')?.[3]).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
      // Reporting a departure never restores access: Casey keeps only the public grant in Archery.
      expect(await grantsFor(USER.casey, ORG.archery)).toEqual(['*']);
      expect((await actorFor(USER.lee, null)).positions).toEqual([]);
      expect(archery.rows.some(row => row[0] === 'Sam')).toBe(false);
    });
  });

  it("lists only this club's own readable documents, without restricted titles or bodies", async () => {
    await inRolledBackApp(async tx => {
      await ensureDocumentFixture(tx);
      const documents = ready((await detailFor(ORG.startup)).documents);
      expect(documents.rows.some(row => row[0] === 'Recruiting FAQ' && row[2] === 'Public')).toBe(true);
      const text = JSON.stringify(documents);
      for (const hidden of ['Spring 2026 budget', 'Meeting minutes 2026-10-08', 'Demo text for', 'USG Funding Department Guidelines', 'Spring showcase info']) {
        expect(text).not.toContain(hidden);
      }
    });
  });

  it('exposes no model run data, including run input and output', async () => {
    await inRolledBackApp(async () => {
      const taylor = await actorFor(USER.taylor, ORG.startup);
      await withActor(taylor, {}, tx => tx.execute(sql`
        insert into agent_runs (installation_id, template_version, org_id, billed_org_id, user_id,
          input, output, model, cost_micro, status, started_at, created_at)
        values (${INSTALLATION.startupFundingPrecheck}, 1, ${ORG.startup}, ${ORG.startup}, ${USER.taylor},
          ${'private prompt sentinel'}, ${JSON.stringify({ reply: 'private output sentinel' })}::jsonb,
          ${'club-detail-model'}, 1234, 'completed', ${ts()}, ${ts()})
      `));
      const text = JSON.stringify(await detailFor(ORG.startup));
      for (const hidden of ['club-detail-model', 'private prompt sentinel', 'private output sentinel']) expect(text).not.toContain(hidden);
    });
  });

  it("reads the club's quota and policy, and isolates a failed source to its own block", async () => {
    await inRolledBackApp(async () => {
      const quota = ready((await detailFor(ORG.startup)).quota);
      expect(quota).toMatchObject({ status: 'active', hasPolicy: true });
      expect(quota.limitMicro).toBeGreaterThan(0);
      quotaSource.fail = true;
      const detail = await detailFor(ORG.startup);
      expect(detail.quota).toEqual({ status: 'unavailable' });
      expect(detail.identity.status).toBe('ready');
      expect(detail.documents.status).toBe('ready');
      expect(JSON.stringify(detail)).not.toContain('private source path');
    });
  });
});
