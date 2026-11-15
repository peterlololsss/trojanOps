// Owner: D. Reporting only; membership history never participates in authorization here.
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { memberships, orgs, positions, users } from '@/lib/db/schema';
import { memberStatusLabels, memberStatusSummary } from './member-status-copy';

export interface IdentityMembershipRow {
  personId: string; person: string; orgId: string | null; organization: string | null;
  position: string | null; endedAt: Date | null;
}

/** Report a person separately for each organization, merging positions and rejoined tenures. */
export function identityMembershipPreview(records: readonly IdentityMembershipRow[]) {
  const groups = new Map<string, {
    person: string; organization: string; current: Set<string>; former: Set<string>; leftAt: Date | null;
  }>();
  for (const record of records) {
    const key = JSON.stringify([record.personId, record.orgId]);
    const group = groups.get(key) ?? {
      person: record.person, organization: record.organization ?? 'No organization',
      current: new Set<string>(), former: new Set<string>(), leftAt: null,
    };
    if (record.orgId && record.position) {
      if (record.endedAt === null) group.current.add(record.position);
      else {
        group.former.add(record.position);
        if (!group.leftAt || group.leftAt < record.endedAt) group.leftAt = record.endedAt;
      }
    }
    groups.set(key, group);
  }
  let active = 0, left = 0, none = 0;
  const rows = [...groups.values()].map(group => {
    const status = group.current.size ? 'active' : group.former.size ? 'left' : 'none';
    if (status === 'active') active++;
    else if (status === 'left') left++;
    else none++;
    const held = status === 'active' ? group.current : group.former;
    return [group.person, group.organization, [...held].sort().join('; ') || 'No positions',
      memberStatusLabels[status], status === 'left' && group.leftAt ? group.leftAt.toISOString().slice(0, 10) : '—'];
  }).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  const people = new Set(records.map(record => record.personId)).size;
  return { rows, summary: memberStatusSummary(people, active, left, none) };
}

/** The caller is the admin-authorized connector preview service, not the identity/grants path. */
export async function currentIdentityMembershipPreview() {
  const records = await getDb().select({
    personId: users.id, person: users.displayName, orgId: orgs.id, organization: orgs.name,
    position: positions.name, endedAt: memberships.endedAt,
  }).from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(positions, and(eq(positions.id, memberships.positionId), eq(positions.orgId, memberships.orgId)))
    .leftJoin(orgs, eq(orgs.id, memberships.orgId));
  return identityMembershipPreview(records);
}
