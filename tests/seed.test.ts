// Owner: D. WP-2 seed requirements, independent of the other streams' seed contents.
import { readFile } from 'node:fs/promises';
import { getTableName, type Table } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { seed, type SeedDb } from '@db/seed';
import { seedOrgs } from '@db/seed/orgs';
import { seedPersonas } from '@db/seed/personas';
import { ORG, USER } from '@db/seed/ids';
import { parseRosterCsv } from '@/lib/connectors/roster/mock';

const calls = vi.hoisted(() => [] as string[]);
vi.mock('@db/seed/distribution', () => ({ seedDistribution: async () => { calls.push('distribution'); } }));
vi.mock('@db/seed/documents', () => ({ seedDocuments: async () => { calls.push('documents'); } }));
vi.mock('@db/seed/quota', () => ({ seedQuota: async () => { calls.push('quota'); } }));

// Capture actual seed writes to check their relationships against §15 and roster.csv.
function capture() {
  const rows: Record<string, Array<Record<string, unknown>>> = {};
  const db = {
    insert(table: Table) {
      return { async values(values: Array<Record<string, unknown>>) {
        const name = getTableName(table);
        calls.push(name);
        rows[name] = [...(rows[name] ?? []), ...values];
      } };
    },
  };
  return { rows, db: db as unknown as SeedDb };
}

describe('WP-2 seed', () => {
  it('seeds four organizations and the pilot cohort, leaving Robotics to roster sync', async () => {
    const { rows, db } = capture();
    await seedOrgs(db);
    expect(rows.orgs.map((o) => [o.slug, o.kind, o.name])).toEqual([
      ['usg', 'usg', 'USG'], ['startup', 'rso', 'Startup Club'],
      ['archery', 'rso', 'Archery Club'], ['dance', 'rso', 'Dance Club'],
    ]);
    expect(rows.org_cohorts.map((c) => [c.cohortSlug, c.orgId])).toEqual([
      ['pilot', ORG.startup], ['pilot', ORG.archery],
    ]);
    expect(rows.positions.every((p) => typeof p.name === 'string' && p.name.length > 0)).toBe(true);
    expect(rows.positions.filter((p) => p.slug === 'member').every((p) => p.isOfficer === false)).toBe(true);
  });

  it('seeds the eight personas and their exact memberships, including cross-club Morgan', async () => {
    const { rows, db } = capture();
    await seedOrgs(db);
    await seedPersonas(db);
    expect(rows.users.map((u) => u.displayName).sort()).toEqual([
      'Avery', 'Casey', 'Jordan', 'Lee', 'Morgan', 'Riley', 'Sam', 'Taylor',
    ]);
    expect(rows.users.map((u) => u.id).sort()).toEqual(Object.values(USER).sort());
    const memberships = rows.memberships.filter(m => !m.endedAt).map((m) => {
      const user = rows.users.find((u) => u.id === m.userId)!;
      const org = rows.orgs.find((o) => o.id === m.orgId)!;
      const position = rows.positions.find((p) => p.id === m.positionId)!;
      expect(position.orgId).toBe(org.id);
      expect(m.source).toBe('roster');
      expect(m.endedAt).toBeUndefined();
      return `${user.externalId}:${org.slug}:${position.slug}`;
    }).sort();
    expect(memberships).toEqual([
      'avery:usg:admin', 'casey:startup:member', 'jordan:startup:member',
      'morgan:archery:treasurer', 'morgan:startup:member', 'riley:usg:reviewer',
      'sam:startup:president', 'taylor:startup:member', 'taylor:startup:treasurer',
    ]);
    const departed = rows.memberships.filter(m => m.endedAt);
    expect(departed).toHaveLength(2);
    expect(departed.map(m => [m.userId, m.orgId])).toEqual([
      [USER.lee, ORG.dance], [USER.casey, ORG.archery],
    ]);
    for (const m of departed) {
      expect(m.source).toBe('manual');
      expect((m.startedAt as Date).getTime()).toBeLessThan((m.endedAt as Date).getTime());
      expect((m.endedAt as Date).getTime()).toBeLessThan((m.createdAt as Date).getTime());
    }
  });

  it('matches the roster baseline to existing club memberships, with only Robotics left to import', async () => {
    const { rows, db } = capture();
    await seedOrgs(db);
    await seedPersonas(db);
    const roster = parseRosterCsv(await readFile(new URL('../db/seed/roster.csv', import.meta.url), 'utf8'));
    const existing = roster.filter((r) => rows.orgs.some((o) => o.slug === r.orgSlug));
    const keys = existing.map((r) => `${r.orgSlug}:${r.position}:${r.externalUserId}`).sort();
    expect(rows.roster_state.map((r) => {
      const org = rows.orgs.find((o) => o.id === r.orgId)!;
      const user = rows.users.find((u) => u.externalId === r.externalUserId)!;
      const position = rows.positions.find((p) => p.orgId === org.id && p.slug === r.positionSlug)!;
      expect(rows.memberships.some((m) => m.userId === user.id && m.positionId === position.id && !m.endedAt)).toBe(true);
      return `${org.slug}:${r.positionSlug}:${r.externalUserId}`;
    }).sort()).toEqual(keys);
    for (const r of existing) {
      expect(rows.users.find((u) => u.externalId === r.externalUserId)?.displayName).toBe(r.userDisplayName);
      expect(rows.orgs.find((o) => o.slug === r.orgSlug)?.name).toBe(r.orgName);
    }
    expect([...new Set(roster.filter((r) => !existing.includes(r)).map((r) => r.orgSlug))]).toEqual(['robotics']);
  });

  it('runs all area seeds in one transaction and in dependency order', async () => {
    const tx = capture().db;
    const transaction = vi.fn(async (fn: (db: SeedDb) => Promise<void>) => fn(tx));
    calls.length = 0;
    await seed({ transaction } as unknown as SeedDb);
    expect(transaction).toHaveBeenCalledOnce();
    expect(calls).toEqual([
      'orgs', 'org_cohorts', 'positions', 'users', 'roster_state', 'memberships',
      'distribution', 'documents', 'quota',
    ]);
  });

  it('propagates seed errors so the transaction can roll back', async () => {
    const failure = new Error('seed insert failed');
    const tx = { insert: () => ({ values: async () => { throw failure; } }) } as unknown as SeedDb;
    const transaction = vi.fn(async (fn: (db: SeedDb) => Promise<void>) => fn(tx));
    calls.length = 0;
    await expect(seed({ transaction } as unknown as SeedDb)).rejects.toBe(failure);
    expect(calls).not.toContain('distribution');
  });
});
