// Owner: D (WP-2). The §15 personas and their memberships. Fictional people only (I13).
import { memberships, rosterState, users } from '@/lib/db/schema';
import { now } from '@/lib/clock';
import type { SeedDb } from './index';
import { ORG, POSITION, USER } from './ids';
import { hackscPeopleRows } from './hacksc-people';

/** Historical examples; ended memberships confer no current club access. */
export function departedMembershipSeeds(reference: Date) {
  const day = 24 * 60 * 60 * 1000;
  return [
    { userId: USER.lee, orgId: ORG.dance, positionId: POSITION.dance.member },
    { userId: USER.casey, orgId: ORG.archery, positionId: POSITION.archery.member },
  ].map((membership, index) => ({
    ...membership, source: 'manual' as const,
    startedAt: new Date(reference.getTime() - 120 * day),
    endedAt: new Date(reference.getTime() - (60 - index * 30) * day),
    createdAt: reference,
  }));
}

export async function seedPersonas(db: SeedDb): Promise<void> {
  const createdAt = now();
  const hacksc = hackscPeopleRows(createdAt);
  await db.insert(users).values(
    (Object.keys(USER) as Array<keyof typeof USER>).map((key) => ({
      id: USER[key],
      externalId: key,
      displayName: key[0].toUpperCase() + key.slice(1),
      demoEmail: `${key}@demo.trojanops.test`,
      createdAt,
    })),
  );
  const m = (userId: string, orgId: string, positionId: string) => ({
    userId, orgId, positionId, source: 'roster' as const, startedAt: createdAt, createdAt,
  });
  // roster_state mirrors roster.csv for the existing clubs, so the first sync reports 0 changes (D1).
  const r = (orgId: string, positionSlug: string, externalUserId: keyof typeof USER) => ({
    orgId, positionSlug, externalUserId, importedAt: createdAt, createdAt,
  });
  await db.insert(rosterState).values([
    r(ORG.startup, 'president', 'sam'),
    r(ORG.startup, 'treasurer', 'taylor'),
    r(ORG.startup, 'member', 'taylor'),
    r(ORG.startup, 'member', 'jordan'),
    r(ORG.startup, 'member', 'casey'),
    r(ORG.startup, 'member', 'morgan'),
    r(ORG.archery, 'treasurer', 'morgan'),
    ...hacksc.roster,
  ]);
  await db.insert(memberships).values([
    m(USER.avery, ORG.usg, POSITION.usg.admin),
    m(USER.riley, ORG.usg, POSITION.usg.reviewer),
    m(USER.sam, ORG.startup, POSITION.startup.president),
    m(USER.taylor, ORG.startup, POSITION.startup.treasurer),
    m(USER.taylor, ORG.startup, POSITION.startup.member),
    m(USER.jordan, ORG.startup, POSITION.startup.member),
    m(USER.casey, ORG.startup, POSITION.startup.member),
    m(USER.morgan, ORG.archery, POSITION.archery.treasurer),
    m(USER.morgan, ORG.startup, POSITION.startup.member),
    ...hacksc.memberships,
    ...departedMembershipSeeds(createdAt),
  ]);
}
