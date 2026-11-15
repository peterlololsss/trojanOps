// Owner: A (WP-3). Grants from active memberships in the DB (I3); capGrants is the §5 table (I4).
// users, memberships, positions and orgs have no RLS, so they are read with getDb() (I1 covers
// documents and runs only).
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Actor, Grant, Tier } from '../contracts';
import { getDb } from '../db/client';
import { memberships, orgs, positions, users } from '../db/schema';

export interface ActiveMembership {
  orgId: string;
  orgName: string;
  orgKind: 'usg' | 'rso';
  positionSlug: string;
  positionName: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed uuid. Cookie values are checked with it before they reach SQL. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function membershipQuery() {
  return getDb()
    .select({
      userId: users.id,
      displayName: users.displayName,
      orgId: memberships.orgId,
      orgName: orgs.name,
      orgKind: orgs.kind,
      positionSlug: positions.slug,
      positionName: positions.name,
    })
    .from(users)
    .leftJoin(memberships, and(eq(memberships.userId, users.id), isNull(memberships.endedAt)))
    .leftJoin(positions, and(eq(positions.id, memberships.positionId), eq(positions.orgId, memberships.orgId)))
    .leftJoin(orgs, eq(orgs.id, memberships.orgId))
    .$dynamic();
}

type MembershipRow = Awaited<ReturnType<typeof membershipQuery>>[number];

/** Groups left-joined rows by user; a user without active memberships gets []. */
function groupByUser(rows: MembershipRow[]): Map<string, { displayName: string; held: ActiveMembership[] }> {
  const byUser = new Map<string, { displayName: string; held: ActiveMembership[] }>();
  for (const r of rows) {
    let entry = byUser.get(r.userId);
    if (!entry) byUser.set(r.userId, (entry = { displayName: r.displayName, held: [] }));
    if (r.orgId && r.orgName && r.orgKind && r.positionSlug && r.positionName) {
      entry.held.push({ orgId: r.orgId, orgName: r.orgName, orgKind: r.orgKind, positionSlug: r.positionSlug, positionName: r.positionName });
    }
  }
  return byUser;
}

/**
 * The user's active memberships (`ended_at is null`), ordered by org name, then position slug.
 * null when `userId` is not a user (including values that aren't uuids).
 */
export async function activeMemberships(userId: string): Promise<ActiveMembership[] | null> {
  if (!isUuid(userId)) return null;
  const rows = await membershipQuery().where(eq(users.id, userId)).orderBy(asc(orgs.name), asc(positions.slug));
  return groupByUser(rows).get(userId)?.held ?? null;
}

/** Every user with their active memberships, ordered by display name, in one query. */
export async function allActiveMemberships(): Promise<Array<{ userId: string; displayName: string; held: ActiveMembership[] }>> {
  const rows = await membershipQuery().orderBy(asc(users.displayName), asc(users.id), asc(orgs.name), asc(positions.slug));
  return [...groupByUser(rows)].map(([userId, e]) => ({ userId, ...e }));
}

/** '*', plus '<orgId>:*' and '<orgId>:<position>' from the memberships held in `orgId` only (I3). */
export function grantsFromMemberships(held: ActiveMembership[], orgId: string | null): Grant[] {
  const grants: Grant[] = ['*'];
  const inOrg = orgId ? held.filter((m) => m.orgId === orgId) : [];
  if (inOrg.length === 0) return grants;
  grants.push(`${orgId}:*`);
  for (const m of inOrg) {
    const g: Grant = `${orgId}:${m.positionSlug}`;
    if (!grants.includes(g)) grants.push(g);
  }
  return grants;
}

/**
 * Org-qualified grants from the user's active memberships in `orgId` only (I3):
 * '*' for any signed-in user, '<orgId>:*' for a member, '<orgId>:<position>' per position held.
 * [] when there is no such user. Recomputed on every call; never persisted.
 */
export async function grantsFor(userId: string | null, orgId: string | null): Promise<Grant[]> {
  if (!userId) return [];
  const held = await activeMemberships(userId);
  return held ? grantsFromMemberships(held, orgId) : [];
}

/** Caps a user's grants by the agent's max tier (I4, §5 table). */
export function capGrants(userGrants: Grant[], orgId: string, maxTier: Tier): Grant[] {
  switch (maxTier) {
    case 'public':
      return ['*'];
    case 'members': {
      const keep = new Set<string>(['*', `${orgId}:*`]);
      return userGrants.filter((g) => keep.has(g));
    }
    case 'officers':
    case 'usg_internal':
      return [...userGrants];
  }
}

/** True for a USG admin acting in USG: the admin position, held in the active org, which is USG. */
export async function isUsgAdmin(actor: Actor): Promise<boolean> {
  if (!actor.userId || !actor.activeOrgId || !actor.positions.includes('admin')) return false;
  const [org] = await getDb().select({ kind: orgs.kind }).from(orgs).where(eq(orgs.id, actor.activeOrgId));
  return org?.kind === 'usg';
}

/** Display labels for grants, e.g. "Startup Club · Treasurer", with names read from the DB. */
export async function grantLabels(grants: Grant[]): Promise<Array<{ grant: Grant; label: string }>> {
  const orgIds = [...new Set(grants.filter((g) => g !== '*').map((g) => g.split(':')[0]))].filter(isUuid);
  const orgNames = new Map<string, string>();
  const positionNames = new Map<string, string>();
  if (orgIds.length > 0) {
    const db = getDb();
    for (const o of await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(inArray(orgs.id, orgIds))) {
      orgNames.set(o.id, o.name);
    }
    const rows = await db
      .select({ orgId: positions.orgId, slug: positions.slug, name: positions.name })
      .from(positions)
      .where(inArray(positions.orgId, orgIds));
    for (const p of rows) positionNames.set(`${p.orgId}:${p.slug}`, p.name);
  }
  return grants.map((grant) => {
    if (grant === '*') return { grant, label: 'Any signed-in student' };
    const [orgId, position] = grant.split(':');
    const org = orgNames.get(orgId) ?? 'Unknown club';
    const pos = position === '*' ? 'Member' : (positionNames.get(grant) ?? position);
    return { grant, label: `${org} · ${pos}` };
  });
}
