// Owner: D. Read-only, per-club projection of current platform data for the USG Management page.
import { and, asc, eq } from 'drizzle-orm';
import { isUuid } from '@/lib/authz';
import type { Actor, ModelClass, Tier } from '@/lib/contracts';
import { getDb } from '@/lib/db/client';
import { memberships, orgs, positions, sources, users } from '@/lib/db/schema';
import { usgClubsView } from '@/lib/distribution/usg-view';
import { listLibraryDocuments } from '@/lib/documents/library';
import { requireRosterAdmin } from '@/lib/lifecycle/import';
import { memberStatusLabels } from './identity/member-status-copy';

export interface DetailTable { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
export type DetailBlock<T = DetailTable> = { readonly status: 'ready'; readonly data: T } | { readonly status: 'unavailable' };
export interface ClubQuota {
  readonly status: 'active' | 'inactive'; readonly hasPolicy: boolean;
  readonly limitMicro: number; readonly spentMicro: number; readonly remainingMicro: number;
  readonly allowedModelClasses: readonly ModelClass[]; readonly allowPublicAgents: boolean;
}
export interface ClubDetail {
  readonly id: string; readonly name: string;
  readonly identity: DetailBlock; readonly documents: DetailBlock; readonly quota: DetailBlock<ClubQuota>;
}

/** Clubs (not USG itself) the Management overview lists, by name. */
export async function listManagedClubs(actor: Actor): Promise<{ id: string; name: string }[]> {
  await requireRosterAdmin(actor);
  return getDb().select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.kind, 'rso')).orderBy(asc(orgs.name));
}

/**
 * Authorizes before any read. Returns null for an unknown id or a non-club org. Each block is read
 * on its own, so one failed source leaves the others available. Reads run one after another:
 * the document block uses withActor, which must not run concurrently with other transactions.
 */
export async function loadClubDetail(actor: Actor, orgId: string): Promise<ClubDetail | null> {
  await requireRosterAdmin(actor);
  if (!isUuid(orgId)) return null;
  const [org] = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs)
    .where(and(eq(orgs.id, orgId), eq(orgs.kind, 'rso')));
  if (!org) return null;
  const identity = await block(() => identityTable(org.id));
  const documents = await block(() => documentTable(actor, org.id));
  const quota = await block(() => quotaFor(actor, org.id));
  return { id: org.id, name: org.name, identity, documents, quota };
}

async function block<T>(read: () => Promise<T>): Promise<DetailBlock<T>> {
  try {
    return { status: 'ready', data: await read() };
  } catch {
    return { status: 'unavailable' };
  }
}

export interface ClubMembershipRecord { userId: string; person: string; position: string; endedAt: Date | null }

export const identityColumns = ['Person', 'Positions', 'Member status', 'Left on (UTC)'] as const;

/**
 * One row per person in this club's membership history. Any active position means Active member;
 * only ended positions means Left organization, with the latest departure date.
 */
export function clubIdentityRows(records: readonly ClubMembershipRecord[]): string[][] {
  const people = new Map<string, { person: string; current: Set<string>; former: Set<string>; leftAt: Date | null }>();
  for (const record of records) {
    let person = people.get(record.userId);
    if (!person) people.set(record.userId, person = { person: record.person, current: new Set(), former: new Set(), leftAt: null });
    if (record.endedAt === null) person.current.add(record.position);
    else {
      person.former.add(record.position);
      if (!person.leftAt || person.leftAt < record.endedAt) person.leftAt = record.endedAt;
    }
  }
  return [...people.values()].map(person => {
    const status = person.current.size ? 'active' : 'left';
    return [
      person.person,
      [...(status === 'active' ? person.current : person.former)].sort().join('; '),
      memberStatusLabels[status],
      status === 'left' && person.leftAt ? person.leftAt.toISOString().slice(0, 10) : '—',
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]));
}

async function identityTable(orgId: string): Promise<DetailTable> {
  const records = await getDb().select({
    userId: users.id, person: users.displayName, position: positions.name, endedAt: memberships.endedAt,
  }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(positions, and(eq(positions.id, memberships.positionId), eq(positions.orgId, memberships.orgId)))
    .where(eq(memberships.orgId, orgId));
  return { columns: identityColumns, rows: clubIdentityRows(records) };
}

const tierLabels: Record<Tier, string> = { public: 'Public', members: 'Members', officers: 'Officers', usg_internal: 'USG internal' };

/** C's library interface recomputes grants and applies document RLS; only this club's own sources are kept. */
async function documentTable(actor: Actor, orgId: string): Promise<DetailTable> {
  const own = new Set((await getDb().select({ id: sources.id }).from(sources).where(eq(sources.orgId, orgId))).map(source => source.id));
  const documents = (await listLibraryDocuments(actor, orgId)).filter(document => own.has(document.sourceId))
    .sort((a, b) => a.title.localeCompare(b.title));
  return {
    columns: ['Document', 'Source', 'Access tier', 'Version'],
    rows: documents.map(document => [document.title, document.sourceName, tierLabels[document.tier], String(document.version)]),
  };
}

/** B's USG console view supplies the quota and policy; this page only reads it. */
async function quotaFor(actor: Actor, orgId: string): Promise<ClubQuota> {
  const club = (await usgClubsView(actor)).find(candidate => candidate.id === orgId);
  if (!club) throw new Error('club missing from the USG console view');
  return {
    status: club.status, hasPolicy: club.hasPolicy, limitMicro: club.limitMicro, spentMicro: club.spentMicro,
    remainingMicro: club.remainingMicro, allowedModelClasses: club.allowedModelClasses, allowPublicAgents: club.allowPublicAgents,
  };
}
