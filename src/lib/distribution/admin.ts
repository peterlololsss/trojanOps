// Owner: B (WP-7). Everything the club admin page acts on: who holds which position, what each
// member may spend, and the club's own agents.
//
// It is the president's page (§14), so the whole payload is president-only: it carries members'
// names and their individual budgets. A member who is not the president has no business reading
// what everyone else is allowed to spend.
import { asc, eq } from 'drizzle-orm';
import { allActiveMemberships, isUuid } from '../authz';
import { AppError, type Actor } from '../contracts';
import { getDb } from '../db/client';
import { positions } from '../db/schema';
import { ownLimitMicro, remaining } from '../gateway/quota';
import { catalog, clubProfile, type CatalogEntry } from './catalog';

export interface ClubMember {
  userId: string;
  displayName: string;
  /** Positions held in this club, officer or not. */
  positions: Array<{ slug: string; name: string }>;
  limitMicro: number;
  spentMicro: number;
  /** The limit is the club's, not one set for this member (§11's fallback). */
  inherited: boolean;
}

export interface ClubPosition {
  slug: string;
  name: string;
  isOfficer: boolean;
  /** Who holds it now. Several for a position like `member`; none when it is vacant. */
  holders: Array<{ userId: string; displayName: string }>;
}

export interface ClubAdmin {
  org: { id: string; name: string };
  clubLimitMicro: number;
  clubSpentMicro: number;
  /** Ordered officers first, then the rest, so the page lists the ones a transfer concerns. */
  positions: ClubPosition[];
  members: ClubMember[];
  agents: CatalogEntry[];
}

/**
 * The club admin page's data. Null when there is no such club; throws `forbidden` for anyone but
 * the president acting in it.
 *
 * The per-member quota reads run in sequence: each opens its own transaction, and concurrent
 * transactions would share one connection. A club has a handful of members.
 */
export async function clubAdmin(actor: Actor, orgId: string): Promise<ClubAdmin | null> {
  if (!isUuid(orgId)) return null;
  const org = await clubProfile(orgId);
  if (!org) return null;

  if (actor.activeOrgId !== orgId || !actor.positions.includes('president')) {
    throw new AppError({
      code: 'forbidden',
      message: 'Only the president, acting in this club, can manage it.',
    });
  }

  const defined = await getDb()
    .select({ slug: positions.slug, name: positions.name, isOfficer: positions.isOfficer })
    .from(positions)
    .where(eq(positions.orgId, orgId))
    .orderBy(asc(positions.slug));

  // One query for everyone's memberships, then narrowed to this club — rather than a query per
  // member, which is what a roster page would otherwise become.
  const everyone = await allActiveMemberships();
  const inClub = everyone
    .map((person) => ({
      userId: person.userId,
      displayName: person.displayName,
      held: person.held.filter((m) => m.orgId === orgId),
    }))
    .filter((person) => person.held.length > 0);

  const members: ClubMember[] = [];
  for (const person of inClub) {
    const spend = await remaining({ scope: 'member', orgId, userId: person.userId });
    const own = await ownLimitMicro(getDb(), { scope: 'member', orgId, userId: person.userId });
    members.push({
      userId: person.userId,
      displayName: person.displayName,
      positions: person.held.map((m) => ({ slug: m.positionSlug, name: m.positionName })),
      limitMicro: spend.limitMicro,
      spentMicro: spend.spentMicro,
      inherited: own === null,
    });
  }

  const club = await remaining({ scope: 'org', orgId });
  const library = await catalog(actor, orgId);

  return {
    org,
    clubLimitMicro: club.limitMicro,
    clubSpentMicro: club.spentMicro,
    positions: defined
      .map((p) => ({
        ...p,
        holders: members
          .filter((m) => m.positions.some((held) => held.slug === p.slug))
          .map((m) => ({ userId: m.userId, displayName: m.displayName })),
      }))
      .sort((a, b) => Number(b.isOfficer) - Number(a.isOfficer) || a.name.localeCompare(b.name)),
    members: members.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    agents: library?.agents ?? [],
  };
}

/** Members who could take a position: everyone in the club who does not already hold it. */
export function transferCandidates(data: ClubAdmin, positionSlug: string): ClubMember[] {
  return data.members.filter((m) => !m.positions.some((p) => p.slug === positionSlug));
}
