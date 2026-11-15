// Owner: D. Additive judge-demo people; existing accounts and memberships are preserved.
import { and, eq } from 'drizzle-orm';
import { now } from '@/lib/clock';
import { memberships, orgCohorts, orgs, positions, rosterState } from '@/lib/db/schema';
import { ORG, POSITION, USER } from './ids';
import type { SeedDb } from './index';

const assignments = [
  { person: 'sam', position: 'president' },
  { person: 'taylor', position: 'treasurer' },
  { person: 'taylor', position: 'member' },
  { person: 'jordan', position: 'member' },
  { person: 'casey', position: 'member' },
] as const;

export function hackscPeopleRows(createdAt: Date) {
  return {
    org: { id: ORG.hacksc, kind: 'rso' as const, slug: 'hacksc', name: 'HackSC', createdAt },
    positions: Object.entries(POSITION.hacksc).map(([slug, id]) => ({
      id, orgId: ORG.hacksc, slug, name: slug[0].toUpperCase() + slug.slice(1), isOfficer: slug !== 'member', createdAt,
    })),
    memberships: assignments.map(({ person, position }) => ({
      userId: USER[person], orgId: ORG.hacksc, positionId: POSITION.hacksc[position],
      source: 'roster' as const, startedAt: createdAt, createdAt,
    })),
    roster: assignments.map(({ person, position }) => ({
      orgId: ORG.hacksc, positionSlug: position, externalUserId: person, importedAt: createdAt, createdAt,
    })),
  };
}

/** Owner CLI only. Adds missing fixture rows; never reactivates a departed membership. */
export async function seedHackscPeople(db: SeedDb): Promise<void> {
  const rows = hackscPeopleRows(now());
  await db.insert(orgs).values(rows.org).onConflictDoNothing();
  await db.insert(positions).values(rows.positions).onConflictDoNothing();
  await db.insert(orgCohorts).values({ orgId: ORG.hacksc, cohortSlug: 'pilot', createdAt: rows.org.createdAt }).onConflictDoNothing();
  for (const membership of rows.memberships) {
    const prior = await db.select({ id: memberships.id }).from(memberships).where(and(
      eq(memberships.orgId, membership.orgId), eq(memberships.userId, membership.userId), eq(memberships.positionId, membership.positionId),
    )).limit(1);
    if (prior.length === 0) await db.insert(memberships).values(membership);
  }
  await db.insert(rosterState).values(rows.roster).onConflictDoNothing();
}
