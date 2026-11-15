// Owner: D (WP-2). Orgs, the pilot cohort and positions (§15).
import { orgCohorts, orgs, positions } from '@/lib/db/schema';
import { now } from '@/lib/clock';
import type { SeedDb } from './index';
import { ORG, POSITION } from './ids';
import { hackscPeopleRows } from './hacksc-people';

const NAMES: Record<string, string> = {
  admin: 'Admin', reviewer: 'Reviewer', president: 'President', treasurer: 'Treasurer',
  secretary: 'Secretary', member: 'Member',
};

export async function seedOrgs(db: SeedDb): Promise<void> {
  const createdAt = now();
  await db.insert(orgs).values([
    { id: ORG.usg, kind: 'usg', slug: 'usg', name: 'USG', createdAt },
    { id: ORG.startup, kind: 'rso', slug: 'startup', name: 'Startup Club', createdAt },
    { id: ORG.archery, kind: 'rso', slug: 'archery', name: 'Archery Club', createdAt },
    { id: ORG.dance, kind: 'rso', slug: 'dance', name: 'Dance Club', createdAt },
    hackscPeopleRows(createdAt).org,
  ]);
  await db.insert(orgCohorts).values([
    { cohortSlug: 'pilot', orgId: ORG.startup, createdAt },
    { cohortSlug: 'pilot', orgId: ORG.archery, createdAt },
    { cohortSlug: 'pilot', orgId: ORG.hacksc, createdAt },
  ]);
  const rows = (Object.keys(POSITION) as Array<keyof typeof POSITION>).flatMap((org) =>
    Object.entries(POSITION[org]).map(([slug, id]) => ({
      id, orgId: ORG[org], slug, name: NAMES[slug], isOfficer: slug !== 'member', createdAt,
    })),
  );
  await db.insert(positions).values(rows);
}
